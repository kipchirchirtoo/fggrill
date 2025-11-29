import { supabase } from '../../config/supabase';

interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  pointsValue: number;
  criteria: any;
}

interface StaffStats {
  staffId: string;
  totalPoints: number;
  weekPoints: number;
  monthPoints: number;
  totalTasks: number;
  weekTasks: number;
  avgQuality: number;
  badges: Achievement[];
  rank: number;
  streak: number;
}

interface LeaderboardEntry {
  rank: number;
  staffId: string;
  staffName: string;
  staffCode: string;
  points: number;
  tasksCompleted: number;
  qualityScore: number;
  badges: number;
  trend: 'up' | 'down' | 'same';
}

class GamificationService {
  // Points configuration
  private pointsConfig = {
    task_completion: {
      checkout_full_clean: 10,
      checkout_vip_clean: 15,
      stay_over_service: 5,
      stay_over_full: 8,
      deep_clean: 20,
      turndown_service: 3,
      touch_up: 2,
      pre_arrival_vip: 18,
      guest_request: 5,
      default: 5
    },
    inspection: {
      pass: 5,
      perfect: 15,  // 5.0 score
      fail: -3
    },
    speed_bonus: {
      fast_completion: 3,    // 20%+ faster than average
      very_fast: 5           // 30%+ faster
    },
    attendance: {
      on_time: 2,
      early: 3,
      late: -1
    },
    special: {
      vip_request_satisfied: 10,
      guest_compliment: 15,
      zero_rework_day: 5,
      perfect_week: 50
    }
  };

  /**
   * Award points for task completion
   */
  async awardTaskCompletionPoints(taskId: string): Promise<number> {
    const { data: task } = await supabase
      .from('hk_tasks')
      .select('*, completed_by, task_type, is_vip, actual_duration_minutes, estimated_duration_minutes')
      .eq('id', taskId)
      .single();

    if (!task || !task.completed_by) return 0;

    const basePoints = this.pointsConfig.task_completion[task.task_type as keyof typeof this.pointsConfig.task_completion] 
      || this.pointsConfig.task_completion.default;

    let totalPoints = basePoints;
    let description = `Completed ${task.task_type.replace(/_/g, ' ')}`;

    // VIP bonus
    if (task.is_vip) {
      totalPoints += 5;
      description += ' (VIP)';
    }

    // Speed bonus
    if (task.actual_duration_minutes && task.estimated_duration_minutes) {
      const timeSaved = task.estimated_duration_minutes - task.actual_duration_minutes;
      const savedPercentage = timeSaved / task.estimated_duration_minutes;

      if (savedPercentage >= 0.3) {
        totalPoints += this.pointsConfig.speed_bonus.very_fast;
        description += ' - Speed Bonus!';
      } else if (savedPercentage >= 0.2) {
        totalPoints += this.pointsConfig.speed_bonus.fast_completion;
        description += ' - Fast!';
      }
    }

    // Award points
    await this.addPoints(task.completed_by, totalPoints, 'task_completion', description, taskId);

    // Check for achievements
    await this.checkAchievements(task.completed_by, 'task_completion', task);

    return totalPoints;
  }

  /**
   * Award points for inspection result
   */
  async awardInspectionPoints(inspectionId: string): Promise<number> {
    const { data: inspection } = await supabase
      .from('hk_inspections')
      .select('*, task:hk_tasks(completed_by)')
      .eq('id', inspectionId)
      .single();

    if (!inspection || !inspection.task?.completed_by) return 0;

    const staffId = inspection.task.completed_by;
    let points = 0;
    let description = '';

    if (inspection.result === 'pass') {
      points = this.pointsConfig.inspection.pass;
      description = 'Inspection passed';

      if (inspection.overall_score >= 5.0) {
        points = this.pointsConfig.inspection.perfect;
        description = 'Perfect inspection score!';
      }
    } else {
      points = this.pointsConfig.inspection.fail;
      description = 'Inspection failed - rework required';
    }

    await this.addPoints(staffId, points, 'inspection', description, inspectionId);
    await this.checkAchievements(staffId, 'inspection', inspection);

    return points;
  }

  /**
   * Award attendance points
   */
  async awardAttendancePoints(staffId: string, type: 'on_time' | 'early' | 'late'): Promise<number> {
    const points = this.pointsConfig.attendance[type];
    const description = type === 'late' ? 'Late check-in' : `Check-in: ${type.replace('_', ' ')}`;

    await this.addPoints(staffId, points, 'attendance', description);
    await this.checkAchievements(staffId, 'attendance');

    return points;
  }

  /**
   * Award special bonus points
   */
  async awardSpecialBonus(staffId: string, type: keyof typeof this.pointsConfig.special, description?: string): Promise<number> {
    const points = this.pointsConfig.special[type];
    await this.addPoints(staffId, points, 'bonus', description || type.replace(/_/g, ' '));
    return points;
  }

  /**
   * Get staff leaderboard
   */
  async getLeaderboard(period: 'week' | 'month' | 'all' = 'month', limit: number = 10): Promise<LeaderboardEntry[]> {
    const now = new Date();
    let dateFilter: Date;

    switch (period) {
      case 'week':
        dateFilter = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        dateFilter = new Date(now.setMonth(now.getMonth() - 1));
        break;
      default:
        dateFilter = new Date(0);
    }

    const { data: pointsData } = await supabase
      .from('hk_staff_points')
      .select(`
        staff_id,
        points,
        earned_at,
        staff:hk_staff_profiles(
          staff_code,
          quality_score,
          tasks_completed_month,
          user:users(first_name, last_name)
        )
      `)
      .gte('earned_at', dateFilter.toISOString());

    if (!pointsData) return [];

    // Aggregate by staff
    const staffPoints: Record<string, { points: number; staff: any }> = {};
    
    for (const p of pointsData) {
      if (!staffPoints[p.staff_id]) {
        staffPoints[p.staff_id] = { points: 0, staff: p.staff };
      }
      staffPoints[p.staff_id].points += p.points;
    }

    // Get badge counts
    const { data: badgeCounts } = await supabase
      .from('hk_staff_achievements')
      .select('staff_id')
      .gte('earned_at', dateFilter.toISOString());

    const badgesByStaff: Record<string, number> = {};
    badgeCounts?.forEach(b => {
      badgesByStaff[b.staff_id] = (badgesByStaff[b.staff_id] || 0) + 1;
    });

    // Build leaderboard
    const leaderboard: LeaderboardEntry[] = Object.entries(staffPoints)
      .map(([staffId, data], index) => ({
        rank: 0, // Will be set after sorting
        staffId,
        staffName: `${data.staff?.user?.first_name || ''} ${data.staff?.user?.last_name || ''}`.trim() || 'Unknown',
        staffCode: data.staff?.staff_code || 'N/A',
        points: data.points,
        tasksCompleted: data.staff?.tasks_completed_month || 0,
        qualityScore: data.staff?.quality_score || 0,
        badges: badgesByStaff[staffId] || 0,
        trend: 'same' as const // TODO: Calculate actual trend
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, limit);

    // Assign ranks
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return leaderboard;
  }

  /**
   * Get staff statistics
   */
  async getStaffStats(staffId: string): Promise<StaffStats | null> {
    const now = new Date();
    const weekStart = new Date(now.setDate(now.getDate() - 7));
    const monthStart = new Date(now.setMonth(now.getMonth() - 1));

    // Get points
    const { data: points } = await supabase
      .from('hk_staff_points')
      .select('points, earned_at')
      .eq('staff_id', staffId);

    // Get badges
    const { data: badges } = await supabase
      .from('hk_staff_achievements')
      .select('achievement:hk_achievements(*)')
      .eq('staff_id', staffId);

    // Get tasks
    const { data: tasks } = await supabase
      .from('hk_tasks')
      .select('completed_at')
      .eq('completed_by', staffId)
      .not('completed_at', 'is', null);

    // Get quality
    const { data: staffProfile } = await supabase
      .from('hk_staff_profiles')
      .select('quality_score')
      .eq('id', staffId)
      .single();

    // Get rank
    const leaderboard = await this.getLeaderboard('month', 100);
    const staffEntry = leaderboard.find(e => e.staffId === staffId);

    if (!points) return null;

    const totalPoints = points.reduce((sum, p) => sum + p.points, 0);
    const weekPoints = points
      .filter(p => new Date(p.earned_at) >= weekStart)
      .reduce((sum, p) => sum + p.points, 0);
    const monthPoints = points
      .filter(p => new Date(p.earned_at) >= monthStart)
      .reduce((sum, p) => sum + p.points, 0);

    const totalTasks = tasks?.length || 0;
    const weekTasks = tasks?.filter(t => new Date(t.completed_at) >= weekStart).length || 0;

    return {
      staffId,
      totalPoints,
      weekPoints,
      monthPoints,
      totalTasks,
      weekTasks,
      avgQuality: staffProfile?.quality_score || 0,
      badges: badges?.map(b => (b.achievement as any) as Achievement) || [],
      rank: staffEntry?.rank || 0,
      streak: await this.calculateStreak(staffId)
    };
  }

  /**
   * Get available achievements
   */
  async getAchievements(): Promise<Achievement[]> {
    const { data } = await supabase
      .from('hk_achievements')
      .select('*')
      .eq('is_active', true)
      .order('points_value', { ascending: false });

    return data || [];
  }

  /**
   * Get staff earned achievements
   */
  async getStaffAchievements(staffId: string): Promise<any[]> {
    const { data } = await supabase
      .from('hk_staff_achievements')
      .select('*, achievement:hk_achievements(*)')
      .eq('staff_id', staffId)
      .order('earned_at', { ascending: false });

    return data || [];
  }

  /**
   * Get team challenges
   */
  async getTeamChallenges(activeOnly: boolean = true): Promise<any[]> {
    let query = supabase
      .from('hk_team_challenges')
      .select('*')
      .order('end_date', { ascending: true });

    if (activeOnly) {
      query = query.eq('status', 'active');
    }

    const { data } = await query;
    return data || [];
  }

  // Private methods

  private async addPoints(
    staffId: string,
    points: number,
    source: string,
    description: string,
    sourceId?: string
  ): Promise<void> {
    const now = new Date();

    await supabase
      .from('hk_staff_points')
      .insert({
        staff_id: staffId,
        points,
        source,
        source_id: sourceId,
        description,
        period_week: this.getWeekNumber(now),
        period_month: now.getMonth() + 1,
        period_year: now.getFullYear()
      });
  }

  private async checkAchievements(staffId: string, trigger: string, data?: any): Promise<void> {
    const { data: achievements } = await supabase
      .from('hk_achievements')
      .select('*')
      .eq('is_active', true);

    if (!achievements) return;

    for (const achievement of achievements) {
      const alreadyEarned = await this.hasAchievement(staffId, achievement.id);
      if (alreadyEarned) continue;

      const earned = await this.evaluateAchievementCriteria(staffId, achievement, trigger, data);
      
      if (earned) {
        await this.awardAchievement(staffId, achievement);
      }
    }
  }

  private async hasAchievement(staffId: string, achievementId: string): Promise<boolean> {
    const { count } = await supabase
      .from('hk_staff_achievements')
      .select('*', { count: 'exact', head: true })
      .eq('staff_id', staffId)
      .eq('achievement_id', achievementId);

    return (count || 0) > 0;
  }

  private async evaluateAchievementCriteria(
    staffId: string,
    achievement: any,
    trigger: string,
    data?: any
  ): Promise<boolean> {
    const criteria = achievement.criteria;

    switch (criteria.type) {
      case 'speed':
        if (data?.actual_duration_minutes && data?.estimated_duration_minutes) {
          const ratio = data.actual_duration_minutes / data.estimated_duration_minutes;
          return ratio <= criteria.threshold;
        }
        return false;

      case 'consecutive_pass': {
        const { data: inspections } = await supabase
          .from('hk_inspections')
          .select('result, task:hk_tasks(completed_by)')
          .eq('task.completed_by', staffId)
          .order('created_at', { ascending: false })
          .limit(criteria.count);

        return inspections?.every(i => i.result === 'pass') || false;
      }

      case 'monthly_tasks': {
        const { count } = await supabase
          .from('hk_tasks')
          .select('*', { count: 'exact', head: true })
          .eq('completed_by', staffId)
          .gte('completed_at', new Date(new Date().setDate(1)).toISOString());

        return (count || 0) >= criteria.count;
      }

      case 'vip_rooms': {
        const { count } = await supabase
          .from('hk_tasks')
          .select('*', { count: 'exact', head: true })
          .eq('completed_by', staffId)
          .eq('is_vip', true);

        return (count || 0) >= criteria.count;
      }

      default:
        return false;
    }
  }

  private async awardAchievement(staffId: string, achievement: any): Promise<void> {
    await supabase
      .from('hk_staff_achievements')
      .insert({
        staff_id: staffId,
        achievement_id: achievement.id,
        notes: `Earned ${achievement.name}`
      });

    // Award bonus points for achievement
    await this.addPoints(
      staffId,
      achievement.points_value,
      'achievement',
      `Achievement unlocked: ${achievement.name}`,
      achievement.id
    );
  }

  private async calculateStreak(staffId: string): Promise<number> {
    // Calculate consecutive days with completed tasks
    const { data: tasks } = await supabase
      .from('hk_tasks')
      .select('completed_at')
      .eq('completed_by', staffId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(100);

    if (!tasks || tasks.length === 0) return 0;

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    const taskDates = new Set(
      tasks.map(t => new Date(t.completed_at).toISOString().split('T')[0])
    );

    while (taskDates.has(currentDate.toISOString().split('T')[0])) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }

    return streak;
  }

  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }
}

export const gamification = new GamificationService();
export default gamification;
