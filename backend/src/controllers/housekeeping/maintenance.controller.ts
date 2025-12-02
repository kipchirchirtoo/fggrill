// =====================================================
// HOUSEKEEPING MAINTENANCE REQUESTS CONTROLLER
// =====================================================

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';
import { ICreateMaintenanceRequest, HKMaintenanceStatus, HKRoomStatus } from '../../types/housekeeping.types';

async function getStaffProfileId(userId: string | undefined): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabase.from('hk_staff_profiles').select('id').eq('user_id', userId).single();
  return data?.id || null;
}

/**
 * @desc    Get all maintenance requests
 * @route   GET /api/housekeeping/maintenance
 * @access  Private
 */
export const getMaintenanceRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const { status, priority, category } = req.query;
    const branchId = req.query.branchId as string || req.user?.branchId;

    let query = supabase
      .from('hk_maintenance_requests')
      .select(`
        *,
        reporter:hk_staff_profiles!reported_by(id, staff_code, user:users(first_name, last_name)),
        room:rooms(room_number, floor)
      `, { count: 'exact' })
      .eq('branch_id', branchId)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    if (category) query = query.eq('category', category);

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
    logger.error('Error fetching maintenance requests:', error);
    next(error);
  }
};

/**
 * @desc    Get single maintenance request
 * @route   GET /api/housekeeping/maintenance/:id
 * @access  Private
 */
export const getMaintenanceRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const { data: request, error } = await supabase
      .from('hk_maintenance_requests')
      .select(`
        *,
        reporter:hk_staff_profiles!reported_by(id, staff_code, designation, user:users(first_name, last_name, phone_number)),
        verifier:hk_staff_profiles!verified_by(id, staff_code, user:users(first_name, last_name)),
        room:rooms(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      res.status(404).json({ success: false, message: 'Request not found' });
      return;
    }

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    logger.error('Error fetching maintenance request:', error);
    next(error);
  }
};

/**
 * @desc    Create maintenance request
 * @route   POST /api/housekeeping/maintenance
 * @access  Private
 */
export const createMaintenanceRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      roomId,
      locationDescription,
      category,
      subcategory,
      description,
      priority = 'normal',
      isSafetyIssue,
      photos
    } = req.body as ICreateMaintenanceRequest;

    const staffId = await getStaffProfileId(req.user?.id);
    if (!staffId) {
      res.status(403).json({ success: false, message: 'Staff profile required' });
      return;
    }

    // Get room info if provided
    let roomNumber = null;
    if (roomId) {
      const { data: room } = await supabase
        .from('rooms')
        .select('room_number')
        .eq('id', roomId)
        .single();
      roomNumber = room?.room_number;
    }

    // Calculate SLA due time based on priority
    const slaDurations: Record<string, number> = {
      critical: 1,    // 1 hour
      urgent: 4,      // 4 hours
      high: 8,        // 8 hours
      normal: 24,     // 24 hours
      low: 72         // 72 hours
    };
    const slaDueAt = new Date();
    slaDueAt.setHours(slaDueAt.getHours() + (slaDurations[priority] || 24));

    const { data: request, error } = await supabase
      .from('hk_maintenance_requests')
      .insert([{
        room_id: roomId,
        room_number: roomNumber,
        location_description: locationDescription,
        category,
        subcategory,
        description,
        priority,
        is_safety_issue: isSafetyIssue || false,
        impacts_room_availability: !!roomId,
        photos: photos || [],
        reported_by: staffId,
        status: 'submitted',
        sla_due_at: slaDueAt.toISOString(),
        branch_id: req.user?.branchId
      }])
      .select()
      .single();

    if (error) throw error;

    // Update room status if safety issue or urgent
    if (roomId && (isSafetyIssue || priority === 'critical' || priority === 'urgent')) {
      await supabase
        .from('rooms')
        .update({ hk_status: HKRoomStatus.OUT_OF_ORDER })
        .eq('id', roomId);
    }

    res.status(201).json({ success: true, data: request });
    logger.info(`Maintenance request created: ${request.request_number}`);
  } catch (error) {
    logger.error('Error creating maintenance request:', error);
    next(error);
  }
};

/**
 * @desc    Update maintenance request status
 * @route   PUT /api/housekeeping/maintenance/:id/status
 * @access  Private
 */
export const updateRequestStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, resolutionNotes, resolutionPhotos } = req.body;

    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === HKMaintenanceStatus.IN_PROGRESS) {
      updateData.started_at = new Date().toISOString();
    }

    if (status === HKMaintenanceStatus.COMPLETED) {
      updateData.completed_at = new Date().toISOString();
      updateData.completed_by = req.user?.id;
      updateData.resolution_notes = resolutionNotes;
      updateData.resolution_photos = resolutionPhotos || [];
    }

    if (status === HKMaintenanceStatus.VERIFIED) {
      const staffId = await getStaffProfileId(req.user?.id);
      updateData.verified_by = staffId;
      updateData.verified_at = new Date().toISOString();
    }

    const { data: request, error } = await supabase
      .from('hk_maintenance_requests')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Update room status if maintenance completed
    if (status === HKMaintenanceStatus.VERIFIED && request.room_id) {
      await supabase
        .from('rooms')
        .update({ hk_status: HKRoomStatus.VACANT_DIRTY })
        .eq('id', request.room_id);
    }

    res.status(200).json({ success: true, data: request });
    logger.info(`Maintenance request ${request.request_number} status updated to ${status}`);
  } catch (error) {
    logger.error('Error updating maintenance request:', error);
    next(error);
  }
};

/**
 * @desc    Verify maintenance completion
 * @route   PUT /api/housekeeping/maintenance/:id/verify
 * @access  Private (Supervisors)
 */
export const verifyCompletion = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { verified, notes } = req.body;

    const staffId = await getStaffProfileId(req.user?.id);

    const { data: request, error: fetchError } = await supabase
      .from('hk_maintenance_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !request) {
      res.status(404).json({ success: false, message: 'Request not found' });
      return;
    }

    if (request.status !== 'completed') {
      res.status(400).json({ success: false, message: 'Can only verify completed requests' });
      return;
    }

    const { data: updated, error } = await supabase
      .from('hk_maintenance_requests')
      .update({
        status: verified ? 'verified' : 'submitted', // Reopen if not verified
        verified_by: staffId,
        verified_at: new Date().toISOString(),
        resolution_notes: notes ? `${request.resolution_notes || ''}\nVerification: ${notes}` : request.resolution_notes
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Release room if verified
    if (verified && request.room_id) {
      await supabase
        .from('rooms')
        .update({ hk_status: HKRoomStatus.VACANT_DIRTY })
        .eq('id', request.room_id);
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error verifying maintenance:', error);
    next(error);
  }
};

/**
 * @desc    Get maintenance statistics
 * @route   GET /api/housekeeping/maintenance/stats
 * @access  Private
 */
export const getMaintenanceStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = req.query.branchId as string || req.user?.branchId;

    const { data: requests, error } = await supabase
      .from('hk_maintenance_requests')
      .select('status, priority, category, sla_due_at, completed_at, sla_breached')
      .eq('branch_id', branchId);

    if (error) throw error;

    const total = requests?.length || 0;
    const stats = {
      total,
      pending: requests?.filter(r => ['submitted', 'acknowledged', 'assigned'].includes(r.status)).length || 0,
      inProgress: requests?.filter(r => r.status === 'in_progress').length || 0,
      completed: requests?.filter(r => ['completed', 'verified'].includes(r.status)).length || 0,
      slaBreached: requests?.filter(r => r.sla_breached).length || 0,
      byCategory: {} as Record<string, number>,
      byPriority: {} as Record<string, number>
    };

    (requests || []).forEach(r => {
      stats.byCategory[r.category] = (stats.byCategory[r.category] || 0) + 1;
      stats.byPriority[r.priority] = (stats.byPriority[r.priority] || 0) + 1;
    });

    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error fetching maintenance stats:', error);
    next(error);
  }
};

/**
 * @desc    Get pending maintenance for room
 * @route   GET /api/housekeeping/maintenance/room/:roomId
 * @access  Private
 */
export const getRoomMaintenance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roomId } = req.params;

    const { data: requests, error } = await supabase
      .from('hk_maintenance_requests')
      .select('*')
      .eq('room_id', roomId)
      .not('status', 'in', '("verified","cancelled")')
      .order('priority')
      .order('created_at');

    if (error) throw error;

    res.status(200).json({ success: true, count: requests?.length || 0, data: requests });
  } catch (error) {
    logger.error('Error fetching room maintenance:', error);
    next(error);
  }
};
