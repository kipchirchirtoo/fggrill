// =====================================================
// HOUSEKEEPING REPORTS CONTROLLER
// =====================================================

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';

/**
 * @desc    Get daily housekeeping report
 * @route   GET /api/housekeeping/reports/daily
 * @access  Private (Supervisors, Managers)
 */
export const getDailyReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const branchId = req.query.branchId as string || req.user?.branchId;

    // Get tasks for the day
    const { data: tasks } = await supabase
      .from('hk_tasks')
      .select(`
        id, task_type, status, priority, actual_duration_minutes, is_rework,
        assigned_to, completed_by, room_number
      `)
      .gte('created_at', `${date}T00:00:00`)
      .lte('created_at', `${date}T23:59:59`);

    // Get inspections for the day
    const { data: inspections } = await supabase
      .from('hk_inspections')
      .select('result, overall_score')
      .gte('inspected_at', `${date}T00:00:00`)
      .lte('inspected_at', `${date}T23:59:59`);

    // Get staff attendance
    const { data: schedules } = await supabase
      .from('hk_staff_schedules')
      .select(`
        status, check_in_time, check_out_time,
        staff:hk_staff_profiles(staff_code, user:users!user_id(first_name, last_name))
      `)
      .eq('schedule_date', date);

    // Get maintenance requests
    const { data: maintenance } = await supabase
      .from('hk_maintenance_requests')
      .select('status, priority, category')
      .gte('created_at', `${date}T00:00:00`)
      .lte('created_at', `${date}T23:59:59`);

    // Get guest requests
    const { data: guestRequests } = await supabase
      .from('hk_guest_requests')
      .select('status, request_type, is_vip')
      .gte('created_at', `${date}T00:00:00`)
      .lte('created_at', `${date}T23:59:59`);

    // Calculate task metrics
    const taskMetrics = {
      total: tasks?.length || 0,
      completed: tasks?.filter(t => ['completed', 'inspection_passed'].includes(t.status)).length || 0,
      pending: tasks?.filter(t => t.status === 'pending').length || 0,
      inProgress: tasks?.filter(t => ['assigned', 'in_progress'].includes(t.status)).length || 0,
      rework: tasks?.filter(t => t.is_rework).length || 0,
      byType: {} as Record<string, number>,
      avgDuration: 0
    };

    const completedWithTime = tasks?.filter(t => t.actual_duration_minutes) || [];
    taskMetrics.avgDuration = completedWithTime.length > 0
      ? Math.round(completedWithTime.reduce((sum, t) => sum + t.actual_duration_minutes, 0) / completedWithTime.length)
      : 0;

    (tasks || []).forEach(t => {
      taskMetrics.byType[t.task_type] = (taskMetrics.byType[t.task_type] || 0) + 1;
    });

    // Calculate inspection metrics
    const inspectionMetrics = {
      total: inspections?.length || 0,
      passed: inspections?.filter(i => i.result === 'passed' || i.result === 'passed_with_notes').length || 0,
      failed: inspections?.filter(i => i.result === 'failed' || i.result === 'needs_rework').length || 0,
      avgScore: 0
    };

    if (inspections && inspections.length > 0) {
      inspectionMetrics.avgScore = parseFloat(
        (inspections.reduce((sum, i) => sum + (i.overall_score || 0), 0) / inspections.length).toFixed(2)
      );
    }

    // Staff attendance metrics
    const attendanceMetrics = {
      scheduled: schedules?.length || 0,
      present: schedules?.filter(s => s.check_in_time).length || 0,
      absent: schedules?.filter(s => s.status === 'absent').length || 0,
      staff: schedules?.map(s => ({
        name: (s.staff as any)?.user?.[0] ? `${(s.staff as any).user[0].first_name} ${(s.staff as any).user[0].last_name}` : 'Unknown',
        code: (s.staff as any)?.staff_code,
        status: s.status,
        checkIn: s.check_in_time,
        checkOut: s.check_out_time
      })) || []
    };

    // Maintenance metrics
    const maintenanceMetrics = {
      total: maintenance?.length || 0,
      pending: maintenance?.filter(m => ['submitted', 'acknowledged', 'assigned'].includes(m.status)).length || 0,
      completed: maintenance?.filter(m => ['completed', 'verified'].includes(m.status)).length || 0,
      byCategory: {} as Record<string, number>
    };

    (maintenance || []).forEach(m => {
      maintenanceMetrics.byCategory[m.category] = (maintenanceMetrics.byCategory[m.category] || 0) + 1;
    });

    // Guest request metrics
    const guestRequestMetrics = {
      total: guestRequests?.length || 0,
      completed: guestRequests?.filter(g => g.status === 'completed').length || 0,
      vip: guestRequests?.filter(g => g.is_vip).length || 0,
      byType: {} as Record<string, number>
    };

    (guestRequests || []).forEach(g => {
      guestRequestMetrics.byType[g.request_type] = (guestRequestMetrics.byType[g.request_type] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: {
        date,
        branchId,
        tasks: taskMetrics,
        inspections: inspectionMetrics,
        attendance: attendanceMetrics,
        maintenance: maintenanceMetrics,
        guestRequests: guestRequestMetrics
      }
    });
  } catch (error) {
    logger.error('Error generating daily report:', error);
    next(error);
  }
};

/**
 * @desc    Get staff performance report
 * @route   GET /api/housekeeping/reports/staff-performance
 * @access  Private (Supervisors, Managers)
 */
export const getStaffPerformanceReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({ success: false, message: 'Start and end dates required' });
      return;
    }

    // Get staff metrics for the period
    const { data: metrics } = await supabase
      .from('hk_staff_daily_metrics')
      .select(`
        *,
        staff:hk_staff_profiles(id, staff_code, designation, user:users!user_id(first_name, last_name))
      `)
      .gte('metric_date', startDate)
      .lte('metric_date', endDate);

    // Aggregate by staff
    const staffPerformance: Record<string, any> = {};

    (metrics || []).forEach(m => {
      const staffId = m.staff_id;
      if (!staffPerformance[staffId]) {
        staffPerformance[staffId] = {
          staffId,
          staffCode: m.staff?.staff_code,
          staffName: m.staff?.user ? `${m.staff.user.first_name} ${m.staff.user.last_name}` : 'Unknown',
          designation: m.staff?.designation,
          totalDays: 0,
          totalTasks: 0,
          totalRework: 0,
          totalCleaningTime: 0,
          totalCredits: 0,
          inspectionsPassed: 0,
          inspectionsFailed: 0,
          punctualDays: 0,
          scores: []
        };
      }

      const s = staffPerformance[staffId];
      s.totalDays++;
      s.totalTasks += m.tasks_completed || 0;
      s.totalRework += m.tasks_rework || 0;
      s.totalCleaningTime += m.total_cleaning_time_minutes || 0;
      s.totalCredits += parseFloat(m.credits_earned || 0);
      s.inspectionsPassed += m.inspections_passed || 0;
      s.inspectionsFailed += m.inspections_failed || 0;
      if (m.was_on_time) s.punctualDays++;
      if (m.avg_quality_score) s.scores.push(m.avg_quality_score);
    });

    // Calculate averages
    const report = Object.values(staffPerformance).map((s: any) => ({
      ...s,
      avgTasksPerDay: s.totalDays > 0 ? Math.round(s.totalTasks / s.totalDays * 10) / 10 : 0,
      avgCleaningTime: s.totalTasks > 0 ? Math.round(s.totalCleaningTime / s.totalTasks) : 0,
      avgQualityScore: s.scores.length > 0
        ? parseFloat((s.scores.reduce((a: number, b: number) => a + b, 0) / s.scores.length).toFixed(2))
        : 0,
      punctualityRate: s.totalDays > 0 ? Math.round((s.punctualDays / s.totalDays) * 100) : 0,
      reworkRate: s.totalTasks > 0 ? Math.round((s.totalRework / s.totalTasks) * 100) : 0,
      inspectionPassRate: (s.inspectionsPassed + s.inspectionsFailed) > 0
        ? Math.round((s.inspectionsPassed / (s.inspectionsPassed + s.inspectionsFailed)) * 100)
        : 100
    })).sort((a: any, b: any) => b.avgQualityScore - a.avgQualityScore);

    res.status(200).json({
      success: true,
      data: {
        period: { startDate, endDate },
        staffCount: report.length,
        report
      }
    });
  } catch (error) {
    logger.error('Error generating staff performance report:', error);
    next(error);
  }
};

/**
 * @desc    Get productivity report
 * @route   GET /api/housekeeping/reports/productivity
 * @access  Private (Managers)
 */
export const getProductivityReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    const branchId = req.query.branchId as string || req.user?.branchId;

    if (!startDate || !endDate) {
      res.status(400).json({ success: false, message: 'Start and end dates required' });
      return;
    }

    // Get daily metrics for the period
    const { data: dailyMetrics } = await supabase
      .from('hk_daily_metrics')
      .select('*')
      .eq('branch_id', branchId)
      .gte('metric_date', startDate)
      .lte('metric_date', endDate)
      .order('metric_date');

    // Get all tasks for the period
    const { data: tasks } = await supabase
      .from('hk_tasks')
      .select('status, actual_duration_minutes, is_rework, completed_at')
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`);

    // Calculate totals
    const totalTasks = tasks?.length || 0;
    const completedTasks = tasks?.filter(t => ['completed', 'inspection_passed'].includes(t.status)).length || 0;
    const reworkTasks = tasks?.filter(t => t.is_rework).length || 0;
    const tasksWithTime = tasks?.filter(t => t.actual_duration_minutes) || [];
    const avgCompletionTime = tasksWithTime.length > 0
      ? Math.round(tasksWithTime.reduce((sum, t) => sum + t.actual_duration_minutes, 0) / tasksWithTime.length)
      : 0;

    // Calculate trends
    const trends = (dailyMetrics || []).map(m => ({
      date: m.metric_date,
      tasks: m.total_tasks_completed,
      avgTime: m.avg_checkout_clean_time || m.avg_stayover_clean_time,
      quality: m.avg_quality_score,
      staffUtilization: m.staff_present > 0 ? Math.round((m.staff_present / m.staff_scheduled) * 100) : 0
    }));

    // Aggregate quality from inspections
    const { data: inspections } = await supabase
      .from('hk_inspections')
      .select('overall_score, result')
      .gte('inspected_at', `${startDate}T00:00:00`)
      .lte('inspected_at', `${endDate}T23:59:59`);

    const avgQuality = inspections && inspections.length > 0
      ? parseFloat((inspections.reduce((sum, i) => sum + (i.overall_score || 0), 0) / inspections.length).toFixed(2))
      : 0;

    const passRate = inspections && inspections.length > 0
      ? Math.round((inspections.filter(i => i.result === 'passed' || i.result === 'passed_with_notes').length / inspections.length) * 100)
      : 100;

    res.status(200).json({
      success: true,
      data: {
        period: { startDate, endDate },
        summary: {
          totalTasks,
          completedTasks,
          completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
          avgCompletionTime,
          reworkRate: totalTasks > 0 ? Math.round((reworkTasks / totalTasks) * 100) : 0,
          avgQualityScore: avgQuality,
          inspectionPassRate: passRate
        },
        trends
      }
    });
  } catch (error) {
    logger.error('Error generating productivity report:', error);
    next(error);
  }
};

/**
 * @desc    Get room turnaround report
 * @route   GET /api/housekeeping/reports/turnaround
 * @access  Private (Managers)
 */
export const getTurnaroundReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const branchId = req.query.branchId as string || req.user?.branchId;

    // Get checkout tasks with completion times
    const { data: checkoutTasks } = await supabase
      .from('hk_tasks')
      .select(`
        id, room_number, task_type, started_at, completed_at, actual_duration_minutes,
        room:rooms(id, floor, room_type)
      `)
      .in('task_type', ['checkout_full_clean', 'checkout_vip_clean'])
      .gte('created_at', `${date}T00:00:00`)
      .lte('created_at', `${date}T23:59:59`)
      .not('completed_at', 'is', null);

    // Calculate turnaround times
    const turnaroundTimes = (checkoutTasks || []).map(t => ({
      roomNumber: t.room_number,
      roomType: (t.room as any)?.room_type,
      floor: (t.room as any)?.floor,
      taskType: t.task_type,
      duration: t.actual_duration_minutes,
      startedAt: t.started_at,
      completedAt: t.completed_at
    }));

    // Group by room type
    const byRoomType: Record<string, { count: number; totalTime: number; times: number[] }> = {};
    turnaroundTimes.forEach(t => {
      const type = t.roomType || 'Standard';
      if (!byRoomType[type]) {
        byRoomType[type] = { count: 0, totalTime: 0, times: [] };
      }
      byRoomType[type].count++;
      byRoomType[type].totalTime += t.duration || 0;
      if (t.duration) byRoomType[type].times.push(t.duration);
    });

    const summaryByType = Object.entries(byRoomType).map(([type, data]) => ({
      roomType: type,
      count: data.count,
      avgTime: data.count > 0 ? Math.round(data.totalTime / data.count) : 0,
      minTime: data.times.length > 0 ? Math.min(...data.times) : 0,
      maxTime: data.times.length > 0 ? Math.max(...data.times) : 0
    }));

    const totalAvgTime = turnaroundTimes.length > 0
      ? Math.round(turnaroundTimes.reduce((sum, t) => sum + (t.duration || 0), 0) / turnaroundTimes.length)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        date,
        totalRooms: turnaroundTimes.length,
        avgTurnaroundTime: totalAvgTime,
        byRoomType: summaryByType,
        details: turnaroundTimes
      }
    });
  } catch (error) {
    logger.error('Error generating turnaround report:', error);
    next(error);
  }
};

/**
 * @desc    Get supply usage report
 * @route   GET /api/housekeeping/reports/supply-usage
 * @access  Private (Managers)
 */
export const getSupplyUsageReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({ success: false, message: 'Start and end dates required' });
      return;
    }

    // Get supply transactions for the period
    const { data: transactions } = await supabase
      .from('housekeeping_supply_transactions')
      .select(`
        supply_id, transaction_type, quantity,
        supply:housekeeping_supplies(id, name, unit, current_stock)
      `)
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`);

    // Aggregate by supply
    const usageBySupply: Record<string, any> = {};
    (transactions || []).forEach(t => {
      const supplyId = t.supply_id;
      if (!usageBySupply[supplyId]) {
        usageBySupply[supplyId] = {
          supplyId,
          name: (t.supply as any)?.name || 'Unknown',
          unit: (t.supply as any)?.unit || 'pcs',
          currentStock: (t.supply as any)?.current_stock || 0,
          totalIn: 0,
          totalOut: 0
        };
      }
      if (t.transaction_type === 'in') {
        usageBySupply[supplyId].totalIn += t.quantity;
      } else if (t.transaction_type === 'out') {
        usageBySupply[supplyId].totalOut += t.quantity;
      }
    });

    const report = Object.values(usageBySupply).map((s: any) => ({
      ...s,
      netChange: s.totalIn - s.totalOut
    })).sort((a: any, b: any) => b.totalOut - a.totalOut);

    res.status(200).json({
      success: true,
      data: {
        period: { startDate, endDate },
        supplies: report,
        summary: {
          totalItems: report.length,
          totalConsumed: report.reduce((sum: number, s: any) => sum + s.totalOut, 0),
          totalRestocked: report.reduce((sum: number, s: any) => sum + s.totalIn, 0)
        }
      }
    });
  } catch (error) {
    logger.error('Error generating supply usage report:', error);
    next(error);
  }
};

/**
 * @desc    Export report to CSV/PDF (placeholder)
 * @route   GET /api/housekeeping/reports/export
 * @access  Private (Managers)
 */
export const exportReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reportType, format, startDate, endDate } = req.query;

    // This would integrate with a reporting library like PDFKit or csv-writer
    // For now, return a placeholder response

    res.status(200).json({
      success: true,
      message: 'Export functionality coming soon',
      requestedReport: {
        type: reportType,
        format,
        period: { startDate, endDate }
      }
    });
  } catch (error) {
    logger.error('Error exporting report:', error);
    next(error);
  }
};
