// =====================================================
// HOUSEKEEPING ROOMS CONTROLLER
// =====================================================

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';
import { HKRoomStatus, IUpdateRoomStatusRequest } from '../../types/housekeeping.types';

/**
 * @desc    Get all rooms with housekeeping status
 * @route   GET /api/housekeeping/rooms
 * @access  Private
 */
export const getRooms = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { floor, status, priority } = req.query;
    const branchId = req.query.branchId as string || req.user?.branchId;

    let query = supabase
      .from('rooms')
      .select(`
        *,
        attendant:hk_staff_profiles!assigned_attendant_id(
          id, staff_code,
          user:users!user_id(first_name, last_name)
        ),
        active_task:hk_tasks!inner(id, status, task_type, priority, started_at)
      `)
      .eq('branch_id', branchId)
      .order('floor', { ascending: true })
      .order('room_number', { ascending: true });

    if (floor) query = query.eq('floor', parseInt(floor as string));
    if (status) query = query.eq('hk_status', status);
    if (priority) query = query.eq('cleaning_priority', priority);

    const { data: rooms, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, count: rooms?.length || 0, data: rooms });
  } catch (error) {
    logger.error('Error fetching rooms:', error);
    next(error);
  }
};

/**
 * @desc    Get single room details
 * @route   GET /api/housekeeping/rooms/:id
 * @access  Private
 */
export const getRoom = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const { data: room, error } = await supabase
      .from('rooms')
      .select(`
        *,
        attendant:hk_staff_profiles!assigned_attendant_id(
          id, staff_code, designation,
          user:users!user_id(first_name, last_name, phone_number)
        ),
        status_history:hk_room_status_history(
          id, previous_status, new_status, reason, created_at,
          changed_by:users(first_name, last_name)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      res.status(404).json({ success: false, message: 'Room not found' });
      return;
    }

    // Get recent tasks for this room
    const { data: recentTasks } = await supabase
      .from('hk_tasks')
      .select('id, task_number, task_type, status, completed_at, actual_duration_minutes')
      .eq('room_id', id)
      .order('created_at', { ascending: false })
      .limit(5);

    res.status(200).json({
      success: true,
      data: { ...room, recentTasks }
    });
  } catch (error) {
    logger.error('Error fetching room:', error);
    next(error);
  }
};

/**
 * @desc    Update room housekeeping status
 * @route   PUT /api/housekeeping/rooms/:id/status
 * @access  Private
 */
export const updateRoomStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, reason, notes } = req.body as IUpdateRoomStatusRequest;

    // Get current room status
    const { data: room, error: fetchError } = await supabase
      .from('rooms')
      .select('id, room_number, hk_status')
      .eq('id', id)
      .single();

    if (fetchError || !room) {
      res.status(404).json({ success: false, message: 'Room not found' });
      return;
    }

    const previousStatus = room.hk_status;

    // Update room status
    const updateData: Record<string, any> = {
      hk_status: status,
      updated_at: new Date().toISOString()
    };

    if (notes) updateData.notes = notes;

    if (status === HKRoomStatus.VACANT_CLEAN) {
      updateData.last_cleaned_at = new Date().toISOString();
    }

    if (status === HKRoomStatus.INSPECTED) {
      updateData.last_inspected_at = new Date().toISOString();
    }

    if (status === HKRoomStatus.OUT_OF_ORDER || status === HKRoomStatus.OUT_OF_SERVICE) {
      updateData.cleaning_priority = 'low';
    }

    const { data: updated, error } = await supabase
      .from('rooms')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log status change
    const { error: historyError } = await supabase.from('hk_room_status_history').insert([{
      room_id: id,
      previous_status: previousStatus,
      new_status: status,
      changed_by: req.user?.id,
      reason: reason || null,
      metadata: { notes }
    }]);

    if (historyError) {
      console.error('Database error:', historyError);
      throw historyError;
    }

    res.status(200).json({ success: true, data: updated });
    logger.info(`Room ${room.room_number} status changed from ${previousStatus} to ${status}`);
  } catch (error) {
    logger.error('Error updating room status:', error);
    next(error);
  }
};

/**
 * @desc    Bulk update room status
 * @route   PUT /api/housekeeping/rooms/bulk-status
 * @access  Private (Supervisors, Managers)
 */
export const bulkUpdateRoomStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roomIds, status, reason } = req.body;

    const { data: rooms, error } = await supabase
      .from('rooms')
      .update({ hk_status: status, updated_at: new Date().toISOString() })
      .in('id', roomIds)
      .select();

    if (error) throw error;

    // Log status changes
    for (const roomId of roomIds) {
      const { error: historyError } = await supabase.from('hk_room_status_history').insert([{
        room_id: roomId,
        new_status: status,
        changed_by: req.user?.id,
        reason: reason || 'Bulk update'
      }]);

      if (historyError) {
        console.error('Database error:', historyError);
        throw historyError;
      }
    }

    res.status(200).json({ success: true, count: rooms?.length || 0, data: rooms });
  } catch (error) {
    logger.error('Error bulk updating room status:', error);
    next(error);
  }
};

/**
 * @desc    Get rooms ready for inspection
 * @route   GET /api/housekeeping/rooms/for-inspection
 * @access  Private (Supervisors)
 */
export const getRoomsForInspection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = req.query.branchId as string || req.user?.branchId;

    const { data: rooms, error } = await supabase
      .from('rooms')
      .select(`
        id, room_number, floor, room_type, hk_status, last_cleaned_at, is_vip,
        attendant:hk_staff_profiles!assigned_attendant_id(
          id, staff_code,
          user:users!user_id(first_name, last_name)
        )
      `)
      .eq('branch_id', branchId)
      .eq('hk_status', 'inspected')
      .order('is_vip', { ascending: false })
      .order('last_cleaned_at', { ascending: true });

    if (error) throw error;

    res.status(200).json({ success: true, count: rooms?.length || 0, data: rooms });
  } catch (error) {
    logger.error('Error fetching rooms for inspection:', error);
    next(error);
  }
};

/**
 * @desc    Get room status history
 * @route   GET /api/housekeeping/rooms/:id/history
 * @access  Private
 */
export const getRoomHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const { data: history, error } = await supabase
      .from('hk_room_status_history')
      .select(`
        *,
        changed_by:users(first_name, last_name)
      `)
      .eq('room_id', id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.status(200).json({ success: true, data: history });
  } catch (error) {
    logger.error('Error fetching room history:', error);
    next(error);
  }
};

/**
 * @desc    Set room as Do Not Disturb
 * @route   PUT /api/housekeeping/rooms/:id/dnd
 * @access  Private
 */
export const setDND = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { enable } = req.body;

    const newStatus = enable ? HKRoomStatus.DO_NOT_DISTURB : HKRoomStatus.OCCUPIED_DIRTY;

    const { data: room, error } = await supabase
      .from('rooms')
      .update({
        hk_status: newStatus,
        dnd_start_time: enable ? new Date().toISOString() : null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Update any active tasks to paused/skipped
    if (enable) {
      await supabase
        .from('hk_tasks')
        .update({ status: 'skipped' })
        .eq('room_id', id)
        .in('status', ['pending', 'assigned']);
    }

    res.status(200).json({ success: true, data: room });
  } catch (error) {
    logger.error('Error setting DND:', error);
    next(error);
  }
};

/**
 * @desc    Assign attendant to room
 * @route   PUT /api/housekeeping/rooms/:id/assign
 * @access  Private (Supervisors)
 */
export const assignAttendant = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { attendantId } = req.body;

    const { data: room, error } = await supabase
      .from('rooms')
      .update({ assigned_attendant_id: attendantId })
      .eq('id', id)
      .select(`
        *,
        attendant:hk_staff_profiles!assigned_attendant_id(
          id, staff_code,
          user:users!user_id(first_name, last_name)
        )
      `)
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, data: room });
  } catch (error) {
    logger.error('Error assigning attendant:', error);
    next(error);
  }
};

/**
 * @desc    Get rooms by floor with summary
 * @route   GET /api/housekeeping/rooms/by-floor
 * @access  Private
 */
export const getRoomsByFloor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = req.query.branchId as string || req.user?.branchId;

    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('id, room_number, floor, room_type, hk_status, cleaning_priority, is_vip')
      .eq('branch_id', branchId)
      .order('floor')
      .order('room_number');

    if (error) throw error;

    // Group by floor with summary
    const floors: Record<number, any> = {};
    (rooms || []).forEach(room => {
      if (!floors[room.floor]) {
        floors[room.floor] = {
          floor: room.floor,
          rooms: [],
          summary: {
            total: 0,
            vacantClean: 0,
            vacantDirty: 0,
            occupied: 0,
            cleaning: 0,
            outOfOrder: 0
          }
        };
      }
      floors[room.floor].rooms.push(room);
      floors[room.floor].summary.total++;

      if (room.hk_status === 'vacant_clean') floors[room.floor].summary.vacantClean++;
      else if (room.hk_status === 'vacant_dirty' || room.hk_status === 'checkout') floors[room.floor].summary.vacantDirty++;
      else if (room.hk_status?.startsWith('occupied')) floors[room.floor].summary.occupied++;
      else if (room.hk_status === 'cleaning_in_progress') floors[room.floor].summary.cleaning++;
      else if (room.hk_status === 'out_of_order') floors[room.floor].summary.outOfOrder++;
    });

    res.status(200).json({
      success: true,
      data: Object.values(floors).sort((a: any, b: any) => a.floor - b.floor)
    });
  } catch (error) {
    logger.error('Error fetching rooms by floor:', error);
    next(error);
  }
};
