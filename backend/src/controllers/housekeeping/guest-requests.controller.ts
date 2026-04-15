// =====================================================
// HOUSEKEEPING GUEST REQUESTS CONTROLLER
// =====================================================

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';
import { ICreateGuestRequest, HKTaskStatus } from '../../types/housekeeping.types';

async function getStaffProfileId(userId: string | undefined): Promise<string | null> {
  if (!userId) return null;
  const { data , error } = await supabase.from('hk_staff_profiles').select('id').eq('user_id', userId).single();
  if (error) {
    console.error('Database error:', error);
    throw error;
  }
  return data?.id || null;
}

/**
 * @desc    Get all guest requests
 * @route   GET /api/housekeeping/guest-requests
 * @access  Private
 */
export const getGuestRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const { status, requestType, vip } = req.query;
    const branchId = req.query.branchId as string || req.user?.branchId;

    let query = supabase
      .from('hk_guest_requests')
      .select(`
        *,
        room:rooms(room_number, floor, room_type),
        assignee:hk_staff_profiles!assigned_to(id, staff_code, user:users!user_id(first_name, last_name))
      `, { count: 'exact' })
      .eq('branch_id', branchId)
      .order('is_vip', { ascending: false })
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) query = query.eq('status', status);
    if (requestType) query = query.eq('request_type', requestType);
    if (vip === 'true') query = query.eq('is_vip', true);

    const { data: requests, error, count } = await query;
    if (error) throw error;

    res.status(200).json({
      success: true,
      count: requests?.length || 0,
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit),
      data: requests
    });
  } catch (error) {
    logger.error('Error fetching guest requests:', error);
    next(error);
  }
};

/**
 * @desc    Get single guest request
 * @route   GET /api/housekeeping/guest-requests/:id
 * @access  Private
 */
export const getGuestRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const { data: request, error } = await supabase
      .from('hk_guest_requests')
      .select(`
        *,
        room:rooms(*),
        assignee:hk_staff_profiles!assigned_to(id, staff_code, user:users!user_id(first_name, last_name, phone_number)),
        completed_by_staff:hk_staff_profiles!completed_by(id, staff_code, user:users!user_id(first_name, last_name))
      `)
      .eq('id', id)
      .single();

    if (error) {
      res.status(404).json({ success: false, message: 'Request not found' });
      return;
    }

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    logger.error('Error fetching guest request:', error);
    next(error);
  }
};

/**
 * @desc    Create guest request
 * @route   POST /api/housekeeping/guest-requests
 * @access  Private
 */
export const createGuestRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      roomId,
      requestType,
      description,
      itemsRequested,
      preferredTime,
      preferredDate,
      priority = 'normal',
      source
    } = req.body as ICreateGuestRequest;

    // Get room info
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('room_number, is_vip, guest_preferences')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      res.status(404).json({ success: false, message: 'Room not found' });
      return;
    }

    const { data: request, error } = await supabase
      .from('hk_guest_requests')
      .insert([{
        room_id: roomId,
        room_number: room.room_number,
        request_type: requestType,
        description,
        items_requested: itemsRequested || [],
        preferred_time: preferredTime,
        preferred_date: preferredDate,
        priority,
        is_vip: room.is_vip,
        source,
        received_by: req.user?.id,
        status: 'pending',
        branch_id: req.user?.branchId
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data: request });
    logger.info(`Guest request created: ${request.request_number} for room ${room.room_number}`);
  } catch (error) {
    logger.error('Error creating guest request:', error);
    next(error);
  }
};

/**
 * @desc    Assign guest request
 * @route   PUT /api/housekeeping/guest-requests/:id/assign
 * @access  Private (Supervisors)
 */
export const assignGuestRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    const { data: request, error } = await supabase
      .from('hk_guest_requests')
      .update({
        assigned_to: assignedTo,
        assigned_at: new Date().toISOString(),
        status: 'assigned'
      })
      .eq('id', id)
      .select(`*, assignee:hk_staff_profiles!assigned_to(staff_code, user:users!user_id(first_name, last_name))`)
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    logger.error('Error assigning guest request:', error);
    next(error);
  }
};

/**
 * @desc    Complete guest request
 * @route   PUT /api/housekeeping/guest-requests/:id/complete
 * @access  Private
 */
export const completeGuestRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { completionNotes } = req.body;

    const staffId = await getStaffProfileId(req.user?.id);

    const { data: request, error } = await supabase
      .from('hk_guest_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: staffId,
        completion_notes: completionNotes
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, data: request });
    logger.info(`Guest request ${request.request_number} completed`);
  } catch (error) {
    logger.error('Error completing guest request:', error);
    next(error);
  }
};

/**
 * @desc    Record guest feedback
 * @route   PUT /api/housekeeping/guest-requests/:id/feedback
 * @access  Private
 */
export const recordFeedback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { satisfied, feedback } = req.body;

    const { data: request, error } = await supabase
      .from('hk_guest_requests')
      .update({
        guest_satisfied: satisfied,
        guest_feedback: feedback
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    logger.error('Error recording feedback:', error);
    next(error);
  }
};

/**
 * @desc    Get pending requests for room
 * @route   GET /api/housekeeping/guest-requests/room/:roomId
 * @access  Private
 */
export const getRoomRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roomId } = req.params;

    const { data: requests, error } = await supabase
      .from('hk_guest_requests')
      .select('*')
      .eq('room_id', roomId)
      .not('status', 'in', '("completed","cancelled")')
      .order('priority')
      .order('created_at');

    if (error) throw error;

    res.status(200).json({ success: true, count: requests?.length || 0, data: requests });
  } catch (error) {
    logger.error('Error fetching room requests:', error);
    next(error);
  }
};

/**
 * @desc    Get request types summary
 * @route   GET /api/housekeeping/guest-requests/types-summary
 * @access  Private
 */
export const getRequestTypesSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = req.query.branchId as string || req.user?.branchId;
    const today = new Date().toISOString().split('T')[0];

    const { data: requests, error } = await supabase
      .from('hk_guest_requests')
      .select('request_type, status, is_vip')
      .eq('branch_id', branchId)
      .gte('created_at', `${today}T00:00:00`);

    if (error) throw error;

    const summary = {
      total: requests?.length || 0,
      pending: requests?.filter(r => r.status === 'pending').length || 0,
      completed: requests?.filter(r => r.status === 'completed').length || 0,
      vip: requests?.filter(r => r.is_vip).length || 0,
      byType: {} as Record<string, number>
    };

    (requests || []).forEach(r => {
      summary.byType[r.request_type] = (summary.byType[r.request_type] || 0) + 1;
    });

    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    logger.error('Error fetching request types summary:', error);
    next(error);
  }
};
