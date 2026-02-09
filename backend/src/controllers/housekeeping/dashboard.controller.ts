// =====================================================
// HOUSEKEEPING DASHBOARD CONTROLLER
// =====================================================

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';
import {
  IHKDashboardData,
  IRoomStatusSummary,
  IStaffWorkloadSummary,
  IActivityItem,
  ISupplyAlert,
  HKRoomStatus,
  HKTaskStatus
} from '../../types/housekeeping.types';

/**
 * @desc    Get housekeeping dashboard data
 * @route   GET /api/housekeeping/dashboard
 * @access  Private (Housekeeping Staff, Supervisors, Managers)
 */
export const getDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = req.query.branchId as string || req.user?.branchId;
    const today = new Date().toISOString().split('T')[0];

    // Get room statistics
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id, room_number, floor, room_type, hk_status, cleaning_priority, is_vip, assigned_attendant_id, expected_checkout')
      .eq('branch_id', branchId);

    if (roomsError) throw roomsError;

    // Calculate room stats
    const roomStats = {
      totalRooms: rooms?.length || 0,
      vacantClean: rooms?.filter(r => r.hk_status === 'vacant_clean').length || 0,
      vacantDirty: rooms?.filter(r => r.hk_status === 'vacant_dirty').length || 0,
      checkouts: rooms?.filter(r => r.hk_status === 'checkout').length || 0,
      cleaningInProgress: rooms?.filter(r => r.hk_status === 'cleaning_in_progress').length || 0,
      outOfOrder: rooms?.filter(r => r.hk_status === 'out_of_order').length || 0,
      occupiedClean: rooms?.filter(r => r.hk_status === 'occupied_clean').length || 0,
      occupiedDirty: rooms?.filter(r => r.hk_status === 'occupied_dirty').length || 0
    };

    // Get task statistics
    const { data: tasks, error: tasksError } = await supabase
      .from('hk_tasks')
      .select('id, status, priority, completed_at, actual_duration_minutes')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    if (tasksError) throw tasksError;

    const taskStats = {
      pendingTasks: tasks?.filter(t => t.status === 'pending').length || 0,
      activeTasks: tasks?.filter(t => ['assigned', 'in_progress'].includes(t.status)).length || 0,
      completedToday: tasks?.filter(t => t.status === 'completed' || t.status === 'inspection_passed').length || 0,
      urgentPending: tasks?.filter(t => ['critical', 'urgent'].includes(t.priority) && !['completed', 'cancelled', 'inspection_passed'].includes(t.status)).length || 0,
      inspectionsPending: tasks?.filter(t => t.status === 'pending_inspection').length || 0
    };

    // Calculate average cleaning time
    const completedWithTime = tasks?.filter(t => t.actual_duration_minutes) || [];
    const avgCleaningTime = completedWithTime.length > 0
      ? Math.round(completedWithTime.reduce((sum, t) => sum + t.actual_duration_minutes, 0) / completedWithTime.length)
      : 0;

    // Get staff workload
    const { data: staffWorkload, error: staffError } = await supabase
      .from('vw_hk_staff_workload')
      .select('*');

    const workloadSummary: IStaffWorkloadSummary[] = (staffWorkload || []).map(s => ({
      staffId: s.id,
      staffName: s.staff_name,
      staffCode: s.staff_code,
      isAvailable: s.is_available,
      currentRoom: s.current_room_number,
      activeTasks: s.active_tasks || 0,
      completedToday: s.completed_today || 0,
      currentCredits: parseFloat(s.current_credits) || 0,
      maxCredits: parseFloat(s.max_credits_per_shift) || 14,
      qualityScore: parseFloat(s.quality_score) || undefined
    }));

    // Get urgent tasks
    const { data: urgentTasks, error: urgentError } = await supabase
      .from('hk_tasks')
      .select(`
        *,
        room:rooms(room_number, floor, room_type),
        assignee:hk_staff_profiles(id, staff_code, user:users!user_id(first_name, last_name))
      `)
      .in('priority', ['critical', 'urgent'])
      .not('status', 'in', '("completed","cancelled","inspection_passed")')
      .order('priority', { ascending: true })
      .order('due_by', { ascending: true })
      .limit(10);

    // Get recent activity
    const { data: recentTasks, error: activityError } = await supabase
      .from('hk_tasks')
      .select(`
        id, status, room_number, completed_at, updated_at,
        completed_by:hk_staff_profiles!completed_by(user:users!user_id(first_name, last_name))
      `)
      .gte('updated_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) // Last 2 hours
      .order('updated_at', { ascending: false })
      .limit(20);

    const recentActivity: IActivityItem[] = (recentTasks || []).map(t => ({
      id: t.id,
      type: t.status === 'completed' ? 'task_completed' : 'status_change',
      description: `Room ${t.room_number} - ${t.status.replace('_', ' ')}`,
      roomNumber: t.room_number,
      staffName: (t.completed_by as any)?.user?.[0] ? `${(t.completed_by as any).user[0].first_name} ${(t.completed_by as any).user[0].last_name}` : undefined,
      timestamp: new Date(t.updated_at)
    }));

    // Get supply alerts
    const { data: supplies, error: suppliesError } = await supabase
      .from('housekeeping_supplies')
      .select('id, name, current_stock, minimum_stock, status')
      .in('status', ['low', 'critical', 'out_of_stock']);

    const supplyAlerts: ISupplyAlert[] = (supplies || []).map(s => ({
      supplyId: s.id,
      supplyName: s.name,
      currentStock: s.current_stock,
      parLevel: s.minimum_stock,
      status: s.status as 'low' | 'critical' | 'out_of_stock',
      location: 'Central Store'
    }));

    // Get quality score from recent inspections
    const { data: inspections } = await supabase
      .from('hk_inspections')
      .select('overall_score')
      .gte('inspected_at', `${today}T00:00:00`)
      .not('overall_score', 'is', null);

    const avgQualityScore = inspections && inspections.length > 0
      ? parseFloat((inspections.reduce((sum, i) => sum + i.overall_score, 0) / inspections.length).toFixed(2))
      : 0;

    // Group rooms by floor
    const roomsByFloor: Record<number, IRoomStatusSummary[]> = {};
    (rooms || []).forEach(room => {
      const floor = room.floor || 1;
      if (!roomsByFloor[floor]) {
        roomsByFloor[floor] = [];
      }
      roomsByFloor[floor].push({
        roomId: room.id,
        roomNumber: room.room_number,
        status: room.hk_status as HKRoomStatus,
        priority: room.cleaning_priority,
        assignedTo: room.assigned_attendant_id,
        isVip: room.is_vip,
        checkoutTime: room.expected_checkout
      });
    });

    // Sort rooms within each floor
    Object.keys(roomsByFloor).forEach(floor => {
      roomsByFloor[parseInt(floor)].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
    });

    const dashboardData: IHKDashboardData = {
      stats: {
        ...roomStats,
        ...taskStats,
        avgCleaningTime,
        qualityScore: avgQualityScore
      },
      roomsByFloor,
      urgentTasks: urgentTasks || [],
      staffWorkload: workloadSummary,
      recentActivity,
      supplyAlerts
    };

    res.status(200).json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    logger.error('Error fetching housekeeping dashboard:', error);
    next(error);
  }
};

/**
 * @desc    Get real-time room status grid
 * @route   GET /api/housekeeping/dashboard/room-grid
 * @access  Private
 */
export const getRoomGrid = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = req.query.branchId as string || req.user?.branchId;
    const floor = req.query.floor as string;

    let query = supabase
      .from('rooms')
      .select(`
        id, room_number, floor, room_type, hk_status, cleaning_priority, is_vip,
        assigned_attendant_id, last_cleaned_at, expected_checkout, notes,
        attendant:hk_staff_profiles!assigned_attendant_id(
          id, staff_code,
          user:users!user_id(first_name, last_name)
        )
      `)
      .eq('branch_id', branchId)
      .order('floor', { ascending: true })
      .order('room_number', { ascending: true });

    if (floor) {
      query = query.eq('floor', parseInt(floor));
    }

    const { data: rooms, error } = await query;

    if (error) throw error;

    // Get active tasks for these rooms
    const roomIds = rooms?.map(r => r.id) || [];
    const { data: activeTasks } = await supabase
      .from('hk_tasks')
      .select('id, room_id, status, task_type, priority, started_at, assigned_to')
      .in('room_id', roomIds)
      .not('status', 'in', '("completed","cancelled","inspection_passed")');

    // Map tasks to rooms
    const tasksByRoom: Record<string, any> = {};
    (activeTasks || []).forEach(task => {
      tasksByRoom[task.room_id] = task;
    });

    const roomGrid = (rooms || []).map(room => ({
      id: room.id,
      roomNumber: room.room_number,
      floor: room.floor,
      roomType: room.room_type,
      status: room.hk_status,
      priority: room.cleaning_priority,
      isVip: room.is_vip,
      lastCleaned: room.last_cleaned_at,
      expectedCheckout: room.expected_checkout,
      notes: room.notes,
      attendant: room.attendant ? {
        id: (room.attendant as any).id,
        code: (room.attendant as any).staff_code,
        name: (room.attendant as any).user?.[0] ? `${(room.attendant as any).user[0].first_name} ${(room.attendant as any).user[0].last_name}` : null
      } : null,
      activeTask: tasksByRoom[room.id] || null
    }));

    // Group by floor
    const floors = [...new Set(roomGrid.map(r => r.floor))].sort((a, b) => a - b);

    res.status(200).json({
      success: true,
      data: {
        floors,
        rooms: roomGrid,
        roomsByFloor: floors.reduce((acc, f) => {
          acc[f] = roomGrid.filter(r => r.floor === f);
          return acc;
        }, {} as Record<number, typeof roomGrid>)
      }
    });

  } catch (error) {
    logger.error('Error fetching room grid:', error);
    next(error);
  }
};

/**
 * @desc    Get dashboard statistics summary
 * @route   GET /api/housekeeping/dashboard/stats
 * @access  Private
 */
export const getStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = req.query.branchId as string || req.user?.branchId;

    const { data, error } = await supabase
      .from('vw_hk_daily_summary')
      .select('*')
      .eq('branch_id', branchId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.status(200).json({
      success: true,
      data: data || {
        total_rooms: 0,
        vacant_clean: 0,
        vacant_dirty: 0,
        checkouts: 0,
        cleaning_in_progress: 0,
        out_of_order: 0,
        pending_tasks: 0,
        active_tasks: 0,
        completed_tasks: 0,
        urgent_pending: 0
      }
    });

  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    next(error);
  }
};

/**
 * @desc    Get workload distribution for auto-assignment
 * @route   GET /api/housekeeping/dashboard/workload
 * @access  Private (Supervisors, Managers)
 */
export const getWorkloadDistribution = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = req.query.branchId as string || req.user?.branchId;

    // Get available staff with their current workload
    const { data: staff, error } = await supabase
      .from('vw_hk_staff_workload')
      .select('*')
      .eq('is_available', true);

    if (error) throw error;

    // Get unassigned tasks
    const { data: unassignedTasks } = await supabase
      .from('hk_tasks')
      .select('id, credit_value, priority')
      .eq('status', 'pending')
      .is('assigned_to', null);

    const totalUnassignedCredits = (unassignedTasks || []).reduce((sum, t) => sum + parseFloat(t.credit_value || 1), 0);
    const availableStaff = staff?.length || 0;

    const distribution = (staff || []).map(s => {
      const currentCredits = parseFloat(s.current_credits) || 0;
      const maxCredits = parseFloat(s.max_credits_per_shift) || 14;
      const remainingCapacity = maxCredits - currentCredits;

      return {
        staffId: s.id,
        staffName: s.staff_name,
        staffCode: s.staff_code,
        currentCredits,
        maxCredits,
        remainingCapacity,
        activeTasks: s.active_tasks || 0,
        completedToday: s.completed_today || 0,
        canTakeMore: remainingCapacity > 0
      };
    }).sort((a, b) => b.remainingCapacity - a.remainingCapacity);

    res.status(200).json({
      success: true,
      data: {
        totalUnassignedTasks: unassignedTasks?.length || 0,
        totalUnassignedCredits,
        availableStaff,
        creditsPerStaff: availableStaff > 0 ? Math.round(totalUnassignedCredits / availableStaff * 10) / 10 : 0,
        distribution
      }
    });

  } catch (error) {
    logger.error('Error fetching workload distribution:', error);
    next(error);
  }
};
