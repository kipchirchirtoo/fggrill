// =====================================================
// HOUSEKEEPING STAFF CONTROLLER
// =====================================================

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';

/**
 * @desc    Get all housekeeping staff
 * @route   GET /api/housekeeping/staff
 * @access  Private (Supervisors, Managers)
 */
export const getStaff = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { available, designation, floor } = req.query;

    let query = supabase
      .from('hk_staff_profiles')
      .select(`
        *,
        user:users!user_id(id, first_name, last_name, email, phone_number, status)
      `)
      .order('staff_code');

    if (available !== undefined) query = query.eq('is_available', available === 'true');
    if (designation) query = query.eq('designation', designation);
    if (floor) query = query.contains('assigned_floors', [parseInt(floor as string)]);

    const { data: staff, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, count: staff?.length || 0, data: staff });
  } catch (error) {
    logger.error('Error fetching staff:', error);
    next(error);
  }
};

/**
 * @desc    Get single staff member
 * @route   GET /api/housekeeping/staff/:id
 * @access  Private
 */
export const getStaffMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const { data: staff, error } = await supabase
      .from('hk_staff_profiles')
      .select(`
        *,
        user:users!user_id(id, first_name, last_name, email, phone_number, status, avatar_url)
      `)
      .eq('id', id)
      .single();

    if (error) {
      res.status(404).json({ success: false, message: 'Staff member not found' });
      return;
    }

    // Get today's tasks
    const today = new Date().toISOString().split('T')[0];
    const { data: todayTasks } = await supabase
      .from('hk_tasks')
      .select('id, status, task_type, room_number, actual_duration_minutes')
      .eq('assigned_to', id)
      .gte('created_at', `${today}T00:00:00`);

    // Get recent performance
    const { data: recentMetrics } = await supabase
      .from('hk_staff_daily_metrics')
      .select('*')
      .eq('staff_id', id)
      .order('metric_date', { ascending: false })
      .limit(7);

    res.status(200).json({
      success: true,
      data: {
        ...staff,
        todayTasks,
        recentMetrics
      }
    });
  } catch (error) {
    logger.error('Error fetching staff member:', error);
    next(error);
  }
};

/**
 * @desc    Create housekeeping staff profile
 * @route   POST /api/housekeeping/staff
 * @access  Private (Managers)
 */
export const createStaffProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      userId,
      staffCode,
      designation,
      assignedFloors,
      assignedSections,
      maxRoomsPerShift,
      maxCreditsPerShift,
      skills,
      languages,
      hireDate
    } = req.body;

    // Check if user exists
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Check if profile already exists
    const { data: existing } = await supabase
      .from('hk_staff_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existing) {
      res.status(400).json({ success: false, message: 'Staff profile already exists for this user' });
      return;
    }

    const { data: profile, error } = await supabase
      .from('hk_staff_profiles')
      .insert([{
        user_id: userId,
        staff_code: staffCode,
        designation,
        assigned_floors: assignedFloors || [],
        assigned_sections: assignedSections || [],
        max_rooms_per_shift: maxRoomsPerShift || 14,
        max_credits_per_shift: maxCreditsPerShift || 14,
        skills: skills || [],
        languages: languages || ['en'],
        hire_date: hireDate || null,
        is_available: true
      }])
      .select(`*, user:users!user_id(first_name, last_name)`)
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data: profile });
    logger.info(`Housekeeping staff profile created: ${staffCode}`);
  } catch (error) {
    logger.error('Error creating staff profile:', error);
    next(error);
  }
};

/**
 * @desc    Update staff profile
 * @route   PUT /api/housekeeping/staff/:id
 * @access  Private (Managers)
 */
export const updateStaffProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.user_id;
    delete updates.created_at;

    const { data: profile, error } = await supabase
      .from('hk_staff_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(`*, user:users!user_id(first_name, last_name)`)
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    logger.error('Error updating staff profile:', error);
    next(error);
  }
};

/**
 * @desc    Get staff workload summary
 * @route   GET /api/housekeeping/staff/workload
 * @access  Private (Supervisors, Managers)
 */
export const getStaffWorkload = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: workload, error } = await supabase
      .from('vw_hk_staff_workload')
      .select('*')
      .order('staff_name');

    if (error) throw error;

    res.status(200).json({ success: true, data: workload });
  } catch (error) {
    logger.error('Error fetching staff workload:', error);
    next(error);
  }
};

/**
 * @desc    Update staff availability
 * @route   PUT /api/housekeeping/staff/:id/availability
 * @access  Private
 */
export const updateAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { isAvailable, currentTaskId, currentRoomNumber } = req.body;

    const { data: profile, error } = await supabase
      .from('hk_staff_profiles')
      .update({
        is_available: isAvailable,
        current_task_id: currentTaskId || null,
        current_room_number: currentRoomNumber || null,
        last_location_update: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    logger.error('Error updating availability:', error);
    next(error);
  }
};

/**
 * @desc    Get staff performance metrics
 * @route   GET /api/housekeeping/staff/:id/performance
 * @access  Private
 */
export const getStaffPerformance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { period = '7' } = req.query;
    const days = parseInt(period as string);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: metrics, error } = await supabase
      .from('hk_staff_daily_metrics')
      .select('*')
      .eq('staff_id', id)
      .gte('metric_date', startDate.toISOString().split('T')[0])
      .order('metric_date', { ascending: true });

    if (error) throw error;

    // Calculate aggregates
    const total = metrics?.length || 0;
    const summary = {
      totalTasks: metrics?.reduce((sum, m) => sum + m.tasks_completed, 0) || 0,
      avgCleaningTime: total > 0
        ? Math.round(metrics!.reduce((sum, m) => sum + (m.avg_cleaning_time_minutes || 0), 0) / total)
        : 0,
      avgQualityScore: total > 0
        ? parseFloat((metrics!.reduce((sum, m) => sum + (m.avg_quality_score || 0), 0) / total).toFixed(2))
        : 0,
      totalCredits: metrics?.reduce((sum, m) => sum + parseFloat(m.credits_earned || 0), 0) || 0,
      punctualityRate: total > 0
        ? Math.round((metrics!.filter(m => m.was_on_time).length / total) * 100)
        : 0
    };

    res.status(200).json({
      success: true,
      data: {
        period: days,
        metrics,
        summary
      }
    });
  } catch (error) {
    logger.error('Error fetching staff performance:', error);
    next(error);
  }
};

/**
 * @desc    Check in staff for shift
 * @route   POST /api/housekeeping/staff/:id/check-in
 * @access  Private
 */
export const checkIn = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const today = new Date().toISOString().split('T')[0];

    // Find today's schedule
    const { data: schedule, error: scheduleError } = await supabase
      .from('hk_staff_schedules')
      .select('*')
      .eq('staff_id', id)
      .eq('schedule_date', today)
      .single();

    if (scheduleError || !schedule) {
      res.status(404).json({ success: false, message: 'No schedule found for today' });
      return;
    }

    // Update schedule with check-in
    const { data: updated, error } = await supabase
      .from('hk_staff_schedules')
      .update({
        status: 'checked_in',
        check_in_time: new Date().toISOString()
      })
      .eq('id', schedule.id)
      .select()
      .single();

    if (error) throw error;

    // Update staff availability
    await supabase
      .from('hk_staff_profiles')
      .update({ is_available: true })
      .eq('id', id);

    res.status(200).json({ success: true, data: updated });
    logger.info(`Staff ${id} checked in`);
  } catch (error) {
    logger.error('Error checking in:', error);
    next(error);
  }
};

/**
 * @desc    Check out staff from shift
 * @route   POST /api/housekeeping/staff/:id/check-out
 * @access  Private
 */
export const checkOut = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const today = new Date().toISOString().split('T')[0];

    const { data: schedule } = await supabase
      .from('hk_staff_schedules')
      .select('*')
      .eq('staff_id', id)
      .eq('schedule_date', today)
      .eq('status', 'checked_in')
      .single();

    if (!schedule) {
      res.status(400).json({ success: false, message: 'Not checked in or already checked out' });
      return;
    }

    const { data: updated, error } = await supabase
      .from('hk_staff_schedules')
      .update({
        status: 'checked_out',
        check_out_time: new Date().toISOString()
      })
      .eq('id', schedule.id)
      .select()
      .single();

    if (error) throw error;

    // Update staff availability
    await supabase
      .from('hk_staff_profiles')
      .update({
        is_available: false,
        current_task_id: null,
        current_room_number: null
      })
      .eq('id', id);

    res.status(200).json({ success: true, data: updated });
    logger.info(`Staff ${id} checked out`);
  } catch (error) {
    logger.error('Error checking out:', error);
    next(error);
  }
};
