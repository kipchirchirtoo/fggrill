// =====================================================
// HOUSEKEEPING SCHEDULING CONTROLLER
// =====================================================

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';

/**
 * @desc    Get shift definitions
 * @route   GET /api/housekeeping/scheduling/shifts
 * @access  Private
 */
export const getShiftDefinitions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = req.query.branchId as string || req.user?.branchId;

    const { data: shifts, error } = await supabase
      .from('hk_shift_definitions')
      .select('*')
      .or(`branch_id.eq.${branchId},branch_id.is.null`)
      .eq('is_active', true)
      .order('start_time');

    if (error) throw error;

    res.status(200).json({ success: true, data: shifts });
  } catch (error) {
    logger.error('Error fetching shift definitions:', error);
    next(error);
  }
};

/**
 * @desc    Get staff schedules for date range
 * @route   GET /api/housekeeping/scheduling/schedules
 * @access  Private
 */
export const getSchedules = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate, staffId } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({ success: false, message: 'Start and end dates required' });
      return;
    }

    let query = supabase
      .from('hk_staff_schedules')
      .select(`
        *,
        staff:hk_staff_profiles(id, staff_code, designation, user:users(first_name, last_name)),
        shift:hk_shift_definitions(name, shift_type, start_time, end_time)
      `)
      .gte('schedule_date', startDate)
      .lte('schedule_date', endDate)
      .order('schedule_date')
      .order('staff_id');

    if (staffId) query = query.eq('staff_id', staffId);

    const { data: schedules, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, data: schedules });
  } catch (error) {
    logger.error('Error fetching schedules:', error);
    next(error);
  }
};

/**
 * @desc    Create staff schedule
 * @route   POST /api/housekeeping/scheduling/schedules
 * @access  Private (Managers)
 */
export const createSchedule = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      staffId,
      shiftId,
      scheduleDate,
      assignedFloors,
      assignedSections,
      notes
    } = req.body;

    // Check for existing schedule
    const { data: existing } = await supabase
      .from('hk_staff_schedules')
      .select('id')
      .eq('staff_id', staffId)
      .eq('schedule_date', scheduleDate)
      .eq('shift_id', shiftId)
      .single();

    if (existing) {
      res.status(400).json({ success: false, message: 'Schedule already exists for this staff, date, and shift' });
      return;
    }

    const { data: schedule, error } = await supabase
      .from('hk_staff_schedules')
      .insert([{
        staff_id: staffId,
        shift_id: shiftId,
        schedule_date: scheduleDate,
        assigned_floors: assignedFloors || [],
        assigned_sections: assignedSections || [],
        notes,
        status: 'scheduled',
        created_by: req.user?.id
      }])
      .select(`
        *,
        staff:hk_staff_profiles(staff_code, user:users(first_name, last_name)),
        shift:hk_shift_definitions(name, shift_type)
      `)
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data: schedule });
    logger.info(`Schedule created for staff ${staffId} on ${scheduleDate}`);
  } catch (error) {
    logger.error('Error creating schedule:', error);
    next(error);
  }
};

/**
 * @desc    Bulk create schedules
 * @route   POST /api/housekeeping/scheduling/schedules/bulk
 * @access  Private (Managers)
 */
export const bulkCreateSchedules = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { schedules } = req.body;
    // schedules: [{ staffId, shiftId, scheduleDate, assignedFloors, assignedSections }]

    const insertData = schedules.map((s: any) => ({
      staff_id: s.staffId,
      shift_id: s.shiftId,
      schedule_date: s.scheduleDate,
      assigned_floors: s.assignedFloors || [],
      assigned_sections: s.assignedSections || [],
      status: 'scheduled',
      created_by: req.user?.id
    }));

    const { data: created, error } = await supabase
      .from('hk_staff_schedules')
      .insert(insertData)
      .select();

    if (error) throw error;

    res.status(201).json({ success: true, count: created?.length || 0, data: created });
  } catch (error) {
    logger.error('Error bulk creating schedules:', error);
    next(error);
  }
};

/**
 * @desc    Update schedule
 * @route   PUT /api/housekeeping/scheduling/schedules/:id
 * @access  Private (Managers)
 */
export const updateSchedule = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    delete updates.id;
    delete updates.created_by;
    delete updates.created_at;

    const { data: schedule, error } = await supabase
      .from('hk_staff_schedules')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, data: schedule });
  } catch (error) {
    logger.error('Error updating schedule:', error);
    next(error);
  }
};

/**
 * @desc    Delete schedule
 * @route   DELETE /api/housekeeping/scheduling/schedules/:id
 * @access  Private (Managers)
 */
export const deleteSchedule = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('hk_staff_schedules')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(200).json({ success: true, message: 'Schedule deleted' });
  } catch (error) {
    logger.error('Error deleting schedule:', error);
    next(error);
  }
};

/**
 * @desc    Get leave requests
 * @route   GET /api/housekeeping/scheduling/leave-requests
 * @access  Private
 */
export const getLeaveRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, staffId } = req.query;

    let query = supabase
      .from('hk_leave_requests')
      .select(`
        *,
        staff:hk_staff_profiles(id, staff_code, user:users(first_name, last_name)),
        reviewer:users!reviewed_by(first_name, last_name)
      `)
      .order('requested_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (staffId) query = query.eq('staff_id', staffId);

    const { data: requests, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    logger.error('Error fetching leave requests:', error);
    next(error);
  }
};

/**
 * @desc    Create leave request
 * @route   POST /api/housekeeping/scheduling/leave-requests
 * @access  Private
 */
export const createLeaveRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { staffId, leaveType, startDate, endDate, reason } = req.body;

    const { data: request, error } = await supabase
      .from('hk_leave_requests')
      .insert([{
        staff_id: staffId,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason,
        status: 'pending'
      }])
      .select(`*, staff:hk_staff_profiles(staff_code, user:users(first_name, last_name))`)
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data: request });
  } catch (error) {
    logger.error('Error creating leave request:', error);
    next(error);
  }
};

/**
 * @desc    Review leave request
 * @route   PUT /api/housekeeping/scheduling/leave-requests/:id/review
 * @access  Private (Managers)
 */
export const reviewLeaveRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { approved, reviewNotes } = req.body;

    const { data: request, error } = await supabase
      .from('hk_leave_requests')
      .update({
        status: approved ? 'approved' : 'rejected',
        reviewed_by: req.user?.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // If approved, update schedules to mark staff as on leave
    if (approved) {
      const { data: leaveReq } = await supabase
        .from('hk_leave_requests')
        .select('staff_id, start_date, end_date')
        .eq('id', id)
        .single();

      if (leaveReq) {
        await supabase
          .from('hk_staff_schedules')
          .update({ status: 'leave' })
          .eq('staff_id', leaveReq.staff_id)
          .gte('schedule_date', leaveReq.start_date)
          .lte('schedule_date', leaveReq.end_date);
      }
    }

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    logger.error('Error reviewing leave request:', error);
    next(error);
  }
};

/**
 * @desc    Get shift swaps
 * @route   GET /api/housekeeping/scheduling/shift-swaps
 * @access  Private
 */
export const getShiftSwaps = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status } = req.query;

    let query = supabase
      .from('hk_shift_swaps')
      .select(`
        *,
        requester:hk_staff_profiles!requester_id(id, staff_code, user:users(first_name, last_name)),
        target:hk_staff_profiles!target_id(id, staff_code, user:users(first_name, last_name)),
        requester_schedule:hk_staff_schedules!requester_schedule_id(schedule_date, shift:hk_shift_definitions(name)),
        target_schedule:hk_staff_schedules!target_schedule_id(schedule_date, shift:hk_shift_definitions(name))
      `)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data: swaps, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, data: swaps });
  } catch (error) {
    logger.error('Error fetching shift swaps:', error);
    next(error);
  }
};

/**
 * @desc    Create shift swap request
 * @route   POST /api/housekeeping/scheduling/shift-swaps
 * @access  Private
 */
export const createShiftSwap = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { requesterScheduleId, targetId, targetScheduleId, reason } = req.body;

    // Get requester's staff profile
    const { data: staff } = await supabase
      .from('hk_staff_profiles')
      .select('id')
      .eq('user_id', req.user?.id)
      .single();

    if (!staff) {
      res.status(403).json({ success: false, message: 'Staff profile required' });
      return;
    }

    const { data: swap, error } = await supabase
      .from('hk_shift_swaps')
      .insert([{
        requester_id: staff.id,
        requester_schedule_id: requesterScheduleId,
        target_id: targetId,
        target_schedule_id: targetScheduleId,
        reason,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data: swap });
  } catch (error) {
    logger.error('Error creating shift swap:', error);
    next(error);
  }
};

/**
 * @desc    Respond to shift swap (target staff)
 * @route   PUT /api/housekeeping/scheduling/shift-swaps/:id/respond
 * @access  Private
 */
export const respondToShiftSwap = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { accepted } = req.body;

    const { data: swap, error } = await supabase
      .from('hk_shift_swaps')
      .update({
        accepted_by_target: accepted,
        target_response_at: new Date().toISOString(),
        status: accepted ? 'accepted' : 'rejected'
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, data: swap });
  } catch (error) {
    logger.error('Error responding to shift swap:', error);
    next(error);
  }
};

/**
 * @desc    Approve shift swap (manager)
 * @route   PUT /api/housekeeping/scheduling/shift-swaps/:id/approve
 * @access  Private (Managers)
 */
export const approveShiftSwap = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { approved } = req.body;

    const { data: swap, error: fetchError } = await supabase
      .from('hk_shift_swaps')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !swap) {
      res.status(404).json({ success: false, message: 'Swap request not found' });
      return;
    }

    if (swap.status !== 'accepted') {
      res.status(400).json({ success: false, message: 'Swap must be accepted by target first' });
      return;
    }

    const { data: updated, error } = await supabase
      .from('hk_shift_swaps')
      .update({
        status: approved ? 'approved' : 'rejected',
        approved_by: req.user?.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // If approved, actually swap the schedules
    if (approved) {
      // Swap staff assignments
      await supabase
        .from('hk_staff_schedules')
        .update({ staff_id: swap.target_id })
        .eq('id', swap.requester_schedule_id);

      await supabase
        .from('hk_staff_schedules')
        .update({ staff_id: swap.requester_id })
        .eq('id', swap.target_schedule_id);
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error approving shift swap:', error);
    next(error);
  }
};

/**
 * @desc    Get today's roster
 * @route   GET /api/housekeeping/scheduling/today-roster
 * @access  Private
 */
export const getTodayRoster = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: roster, error } = await supabase
      .from('hk_staff_schedules')
      .select(`
        *,
        staff:hk_staff_profiles(
          id, staff_code, designation, is_available, current_room_number,
          user:users(first_name, last_name, phone_number)
        ),
        shift:hk_shift_definitions(name, shift_type, start_time, end_time)
      `)
      .eq('schedule_date', today)
      .order('status');

    if (error) throw error;

    // Group by shift
    const byShift: Record<string, any[]> = {};
    (roster || []).forEach(r => {
      const shiftName = r.shift?.name || 'Unassigned';
      if (!byShift[shiftName]) byShift[shiftName] = [];
      byShift[shiftName].push(r);
    });

    res.status(200).json({
      success: true,
      data: {
        date: today,
        total: roster?.length || 0,
        checkedIn: roster?.filter(r => r.status === 'checked_in').length || 0,
        roster,
        byShift
      }
    });
  } catch (error) {
    logger.error('Error fetching today roster:', error);
    next(error);
  }
};
