import { supabase } from '../../config/supabase';

interface StaffScore {
  staffId: string;
  staffName: string;
  staffCode: string;
  score: number;
  factors: {
    proximity: number;
    workload: number;
    skillMatch: number;
    performance: number;
    availability: number;
  };
  currentFloor: number | null;
  currentCredits: number;
  maxCredits: number;
  isAvailable: boolean;
}

interface AssignmentResult {
  success: boolean;
  taskId: string;
  assignedTo?: string;
  staffName?: string;
  score?: number;
  factors?: StaffScore['factors'];
  reason?: string;
}

interface TaskForAssignment {
  id: string;
  taskNumber: string;
  roomId: string;
  roomNumber: string;
  floorNumber: number;
  taskType: string;
  priority: string;
  isVip: boolean;
  creditValue: number;
  estimatedDuration: number;
}

class SmartAssignmentService {
  // Weight factors for scoring
  private weights = {
    proximity: 0.25,    // How close staff is to the room
    workload: 0.20,     // Current workload balance
    skillMatch: 0.25,   // Skill match for task type
    performance: 0.20,  // Historical performance
    availability: 0.10  // Immediate availability
  };

  // VIP rooms get different weights
  private vipWeights = {
    proximity: 0.15,
    workload: 0.15,
    skillMatch: 0.35,   // Skills more important for VIP
    performance: 0.30,  // Performance more important for VIP
    availability: 0.05
  };

  // Skill mapping for task types
  private taskSkillMap: Record<string, string[]> = {
    'checkout_full_clean': ['standard_cleaning', 'deep_cleaning'],
    'checkout_vip_clean': ['vip_service', 'deep_cleaning'],
    'stay_over_service': ['standard_cleaning'],
    'stay_over_full': ['standard_cleaning', 'deep_cleaning'],
    'deep_clean': ['deep_cleaning'],
    'turndown_service': ['turndown'],
    'touch_up': ['standard_cleaning'],
    'pre_arrival_vip': ['vip_service', 'deep_cleaning'],
    'guest_request': ['standard_cleaning', 'vip_service']
  };

  /**
   * Auto-assign a single task to the best available staff
   */
  async autoAssignTask(taskId: string): Promise<AssignmentResult> {
    try {
      // Get task details
      const { data: task, error: taskError } = await supabase
        .from('hk_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (taskError || !task) {
        return { success: false, taskId, reason: 'Task not found' };
      }

      if (task.status !== 'pending') {
        return { success: false, taskId, reason: 'Task is not pending' };
      }

      // Get available staff
      const availableStaff = await this.getAvailableStaff(task.floor_number);
      
      if (availableStaff.length === 0) {
        return { success: false, taskId, reason: 'No available staff' };
      }

      // Score each staff member
      const scoredStaff = await this.scoreStaffForTask(availableStaff, {
        id: task.id,
        taskNumber: task.task_number,
        roomId: task.room_id,
        roomNumber: task.room_number,
        floorNumber: task.floor_number,
        taskType: task.task_type,
        priority: task.priority,
        isVip: task.is_vip,
        creditValue: task.credit_value,
        estimatedDuration: task.estimated_duration_minutes
      });

      if (scoredStaff.length === 0) {
        return { success: false, taskId, reason: 'No suitable staff found' };
      }

      // Select best match
      const bestMatch = scoredStaff[0];

      // Assign task
      const { error: assignError } = await supabase
        .from('hk_tasks')
        .update({
          assigned_to: bestMatch.staffId,
          assigned_at: new Date().toISOString(),
          status: 'assigned'
        })
        .eq('id', taskId);

      if (assignError) {
        return { success: false, taskId, reason: 'Failed to assign task' };
      }

      // Log assignment for ML training
      await this.logAssignment(taskId, bestMatch);

      // Update staff availability
      await supabase
        .from('hk_staff_profiles')
        .update({ 
          is_available: bestMatch.currentCredits + task.credit_value < bestMatch.maxCredits 
        })
        .eq('id', bestMatch.staffId);

      return {
        success: true,
        taskId,
        assignedTo: bestMatch.staffId,
        staffName: bestMatch.staffName,
        score: bestMatch.score,
        factors: bestMatch.factors
      };
    } catch (error) {
      console.error('[SmartAssign] Error:', error);
      return { success: false, taskId, reason: 'Internal error' };
    }
  }

  /**
   * Auto-assign multiple tasks optimally
   */
  async autoAssignBatch(taskIds: string[]): Promise<AssignmentResult[]> {
    const results: AssignmentResult[] = [];

    // Sort tasks by priority (urgent first, then VIP, then by floor for efficiency)
    const { data: tasks } = await supabase
      .from('hk_tasks')
      .select('*')
      .in('id', taskIds)
      .eq('status', 'pending')
      .order('priority', { ascending: false });

    if (!tasks) return results;

    // Sort: urgent > high > normal, then VIP, then by floor
    const sortedTasks = tasks.sort((a, b) => {
      const priorityOrder = { 'urgent': 0, 'critical': 1, 'high': 2, 'normal': 3, 'low': 4 };
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 3;
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 3;
      
      if (aPriority !== bPriority) return aPriority - bPriority;
      if (a.is_vip !== b.is_vip) return a.is_vip ? -1 : 1;
      return a.floor_number - b.floor_number;
    });

    for (const task of sortedTasks) {
      const result = await this.autoAssignTask(task.id);
      results.push(result);
      
      // Small delay to allow state updates
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Get recommendation for manual assignment
   */
  async getAssignmentRecommendations(taskId: string, limit: number = 5): Promise<StaffScore[]> {
    const { data: task } = await supabase
      .from('hk_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (!task) return [];

    const availableStaff = await this.getAvailableStaff(task.floor_number, false); // Include busy staff
    
    const scoredStaff = await this.scoreStaffForTask(availableStaff, {
      id: task.id,
      taskNumber: task.task_number,
      roomId: task.room_id,
      roomNumber: task.room_number,
      floorNumber: task.floor_number,
      taskType: task.task_type,
      priority: task.priority,
      isVip: task.is_vip,
      creditValue: task.credit_value,
      estimatedDuration: task.estimated_duration_minutes
    });

    return scoredStaff.slice(0, limit);
  }

  /**
   * Re-assign task based on SLA breach or staff unavailability
   */
  async reassignTask(taskId: string, reason: string): Promise<AssignmentResult> {
    // Mark previous assignment as unsuccessful
    await supabase
      .from('hk_assignment_history')
      .update({ was_successful: false })
      .eq('task_id', taskId)
      .is('was_successful', null);

    // Reset task to pending
    await supabase
      .from('hk_tasks')
      .update({
        status: 'pending',
        assigned_to: null,
        assigned_at: null
      })
      .eq('id', taskId);

    // Auto-assign again
    return this.autoAssignTask(taskId);
  }

  // Private methods

  private async getAvailableStaff(floorNumber: number, availableOnly: boolean = true): Promise<any[]> {
    let query = supabase
      .from('hk_staff_profiles')
      .select(`
        id,
        staff_code,
        designation,
        assigned_floors,
        max_credits_per_shift,
        skills,
        quality_score,
        tasks_completed_today,
        is_available,
        current_room_number,
        user:users(first_name, last_name)
      `)
      .eq('designation', 'Room Attendant');

    if (availableOnly) {
      query = query.eq('is_available', true);
    }

    const { data: staff } = await query;

    if (!staff) return [];

    // Filter by floor assignment
    return staff.filter(s => 
      s.assigned_floors?.includes(floorNumber) || 
      s.assigned_floors?.length === 0
    );
  }

  private async scoreStaffForTask(staff: any[], task: TaskForAssignment): Promise<StaffScore[]> {
    const weights = task.isVip ? this.vipWeights : this.weights;
    const requiredSkills = this.taskSkillMap[task.taskType] || ['standard_cleaning'];

    const scores: StaffScore[] = [];

    for (const s of staff) {
      // Get current workload
      const { count: activeTasks } = await supabase
        .from('hk_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', s.id)
        .in('status', ['assigned', 'in_progress']);

      const { data: completedToday } = await supabase
        .from('hk_tasks')
        .select('credit_value')
        .eq('completed_by', s.id)
        .gte('completed_at', new Date().toISOString().split('T')[0]);

      const currentCredits = completedToday?.reduce((sum, t) => sum + (t.credit_value || 0), 0) || 0;

      // Calculate factors
      const factors = {
        proximity: this.calculateProximityScore(s, task.floorNumber),
        workload: this.calculateWorkloadScore(currentCredits, s.max_credits_per_shift, activeTasks || 0),
        skillMatch: this.calculateSkillMatchScore(s.skills || [], requiredSkills),
        performance: this.calculatePerformanceScore(s.quality_score, s.tasks_completed_today),
        availability: s.is_available ? 1.0 : 0.3
      };

      // Calculate weighted score
      const score = 
        factors.proximity * weights.proximity +
        factors.workload * weights.workload +
        factors.skillMatch * weights.skillMatch +
        factors.performance * weights.performance +
        factors.availability * weights.availability;

      // Determine current floor from room number
      const currentFloor = s.current_room_number 
        ? parseInt(s.current_room_number.charAt(0)) 
        : null;

      scores.push({
        staffId: s.id,
        staffName: `${s.user?.first_name || ''} ${s.user?.last_name || ''}`.trim(),
        staffCode: s.staff_code,
        score: Math.round(score * 100) / 100,
        factors,
        currentFloor,
        currentCredits,
        maxCredits: s.max_credits_per_shift,
        isAvailable: s.is_available
      });
    }

    // Sort by score descending
    return scores.sort((a, b) => b.score - a.score);
  }

  private calculateProximityScore(staff: any, targetFloor: number): number {
    // If staff has a current room, calculate distance
    if (staff.current_room_number) {
      const currentFloor = parseInt(staff.current_room_number.charAt(0));
      const floorDiff = Math.abs(currentFloor - targetFloor);
      return Math.max(0, 1 - (floorDiff * 0.25)); // 25% penalty per floor
    }

    // Check if target floor is in assigned floors
    if (staff.assigned_floors?.includes(targetFloor)) {
      return 0.8;
    }

    return 0.5;
  }

  private calculateWorkloadScore(currentCredits: number, maxCredits: number, activeTasks: number): number {
    const utilizationRate = currentCredits / maxCredits;
    
    // Prefer staff with moderate workload (not too busy, not too idle)
    if (activeTasks >= 2) return 0.2; // Already has 2+ active tasks
    if (utilizationRate > 0.9) return 0.1;
    if (utilizationRate > 0.7) return 0.5;
    if (utilizationRate > 0.4) return 0.9;
    if (utilizationRate > 0.2) return 1.0;
    return 0.8; // Very low utilization might indicate issues
  }

  private calculateSkillMatchScore(staffSkills: string[], requiredSkills: string[]): number {
    if (requiredSkills.length === 0) return 1.0;
    
    const matchedSkills = requiredSkills.filter(s => staffSkills.includes(s));
    return matchedSkills.length / requiredSkills.length;
  }

  private calculatePerformanceScore(qualityScore: number | null, tasksToday: number): number {
    const quality = qualityScore || 3.5; // Default if no score
    const normalizedQuality = (quality - 1) / 4; // 1-5 scale to 0-1
    
    // Slight bonus for productive staff
    const productivityBonus = Math.min(tasksToday * 0.02, 0.1);
    
    return Math.min(normalizedQuality + productivityBonus, 1.0);
  }

  private async logAssignment(taskId: string, staff: StaffScore): Promise<void> {
    await supabase
      .from('hk_assignment_history')
      .insert({
        task_id: taskId,
        staff_id: staff.staffId,
        assignment_method: 'auto',
        assignment_score: staff.score,
        factors: staff.factors
      });
  }
}

export const smartAssignment = new SmartAssignmentService();
export default smartAssignment;
