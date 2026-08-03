import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { applyBranchFilter, isGlobalRole } from '../utils/branchIsolation';
import {
  loadStaySnapshots,
  resolveEffectiveRoomState,
  todayInNairobi,
} from '../services/receptionStayState.service';

// @desc    Get all rooms
// @route   GET /api/rooms
// @access  Public
export const getRooms = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Simplified query without complex joins to avoid database connection issues
    let query = supabase
      .from('rooms')
      .select('*, type:room_types!type_id(*), guest:guests!current_guest(*)');

    query = applyBranchFilter(query, req);
    const isGlobal = isGlobalRole(req.user?.role);
    
    // For global roles, use the query param branch_id if provided
    // For non-global roles, applyBranchFilter already applied their branch from token
    // But also support explicit branch_id filtering for all users when provided
    if (req.query.branch_id) {
      if (isGlobal) {
        // Global users can view any branch
        query = query.eq('branch_id', req.query.branch_id as string);
      } else {
        // Non-global users: only allow branch_id if it matches their assigned branch
        // This allows frontend to explicitly specify branch for clarity
        const queryBranchId = parseInt(req.query.branch_id as string);
        if (queryBranchId === req.user?.branch_id) {
          query = query.eq('branch_id', queryBranchId);
        }
        // If branch_id doesn't match, applyBranchFilter already filtered by their branch
      }
    }
    
    // Always ensure we filter by some branch_id to prevent returning unassigned rooms
    // If after applyBranchFilter we still don't have a branch filter, apply a default
    // Skip this check if branch_id was provided via query parameter
    if (!isGlobal && !(req.user?.branch_id) && !req.query.branch_id) {
      // This shouldn't happen for valid users, but as safety measure
      logger.warn('User without branch_id attempted to access rooms:', req.user?.id);
      query = query.eq('branch_id', -1); // Return nothing
    }
    if (req.query.status) {
      query = query.eq('status', req.query.status as string);
    }

    const { data: rooms, error } = await query;

    if (error) {
      logger.error('Database error in getRooms:', error);
      throw error;
    }

    const scopedBranchId = Number(
      req.query.branch_id ||
      (isGlobal ? 0 : req.user?.branch_id || 0)
    );
    const staySnapshots = scopedBranchId
      ? await loadStaySnapshots(scopedBranchId, {
          asOfDate: todayInNairobi(),
          includeConfirmed: true,
          limit: 400,
        })
      : [];
    const checkedInByRoomId = new Map<string, any>();
    const confirmedByRoomId = new Map<string, any>();
    staySnapshots.forEach((stay) => {
      if (!stay.room_id) return;
      if (stay.in_house && !checkedInByRoomId.has(stay.room_id)) {
        checkedInByRoomId.set(stay.room_id, stay);
        return;
      }
      if (!stay.in_house && stay.status.toLowerCase() === 'confirmed' && !confirmedByRoomId.has(stay.room_id)) {
        confirmedByRoomId.set(stay.room_id, stay);
      }
    });

    const enrichedRooms = (rooms || []).map((room: any) => {
      const resolved = resolveEffectiveRoomState(
        room,
        checkedInByRoomId,
        confirmedByRoomId,
        todayInNairobi()
      );
      const activeRes = resolved.activeStay || resolved.reservedStay || null;
      const effectiveStatus = resolved.status;

      return {
        ...room,
        status: effectiveStatus,
        guest_name: activeRes?.guest_name || null,
        guest: activeRes?.raw?.guest || null,
        check_in_date: activeRes?.check_in_date || null,
        check_out_date: activeRes?.effective_checkout_date || activeRes?.check_out_date || null,
        checked_in_at: activeRes?.checked_in_at || null,
        confirmation_number: activeRes?.confirmation_number || null,
        meal_plan: activeRes?.meal_plan || null,
        adults: activeRes?.adults ?? 0,
        children: activeRes?.children ?? 0,
        total_pax: activeRes?.pax ?? 0,
        current_guest: activeRes?.guest_id || null,
        overstay: activeRes?.overstay ?? false,
      };
    });

    res.status(200).json({
      success: true,
      data: enrichedRooms,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single room
// @route   GET /api/rooms/:id
// @access  Public
export const getRoom = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: room, error } = await supabase
      .from('rooms')
      .select(`
        *,
        type:room_types!type_id(*),
        status_history:room_status_history(*)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) {
      throw error;
    }

    if (!room) {
      res.status(404).json({
        success: false,
        message: 'Room not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: room
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get bookings for a room
// @route   GET /api/rooms/:id/bookings
// @access  Private
export const getRoomBookings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let roomQuery = supabase
      .from('rooms')
      .select('id, branch_id')
      .eq('id', req.params.id);

    if (!isGlobalRole(req.user?.role) && req.user?.branch_id) {
      roomQuery = roomQuery.eq('branch_id', req.user.branch_id);
    }

    const { data: room, error: roomError } = await roomQuery.single();
    if (roomError || !room) {
      res.status(404).json({
        success: false,
        message: 'Room not found'
      });
      return;
    }

    const { data: bookings, error } = await supabase
      .from('reservations')
      .select('*, guest:guests!guest_id(*), room:rooms!room_id(id, room_number, room_type, branch_id, status)')
      .eq('room_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: bookings || []
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create room
// @route   POST /api/rooms
// @access  Private (Admin, Manager)
export const createRoom = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      roomNumber,
      typeId,
      floor,
      status,
      priceOverride,
      amenities,
      imageUrl
    } = req.body;

    // Check if room number already exists
    const { data: existingRoom } = await supabase
      .from('rooms')
      .select('room_number')
      .eq('room_number', roomNumber)
      .single();

    if (existingRoom) {
      res.status(400).json({
        success: false,
        message: 'Room number already exists'
      });
      return;
    }

    const { data: room, error } = await supabase
      .from('rooms')
      .insert([
        {
          room_number: roomNumber,
          type_id: typeId,
          floor,
          status,
          price_override: priceOverride,
          amenities,
          image_url: imageUrl,
          branch_id: req.user?.branch_id || req.body.branch_id
        }
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      success: true,
      data: room
    });

    logger.info(`Room created: ${roomNumber}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Update room
// @route   PUT /api/rooms/:id
// @access  Private (Admin, Manager, Housekeeping)
export const updateRoom = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      roomNumber,
      typeId,
      floor,
      status,
      priceOverride,
      amenities,
      imageUrl,
      notes
    } = req.body;

    // Check if room exists
    const { data: existingRoom } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!existingRoom) {
      res.status(404).json({
        success: false,
        message: 'Room not found'
      });
      return;
    }

    // Check if new room number conflicts with existing one
    if (roomNumber && roomNumber !== existingRoom.room_number) {
      const { data: roomWithNumber } = await supabase
        .from('rooms')
        .select('room_number')
        .eq('room_number', roomNumber)
        .single();

      if (roomWithNumber) {
        res.status(400).json({
          success: false,
          message: 'Room number already exists'
        });
        return;
      }
    }

    const { data: room, error } = await supabase
      .from('rooms')
      .update({
        room_number: roomNumber,
        type_id: typeId,
        floor,
        status,
        price_override: priceOverride,
        amenities,
        image_url: imageUrl,
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      data: room
    });

    logger.info(`Room updated: ${roomNumber || existingRoom.room_number}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete room
// @route   DELETE /api/rooms/:id
// @access  Private (Admin, Manager)
export const deleteRoom = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: room, error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!room) {
      res.status(404).json({
        success: false,
        message: 'Room not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {}
    });

    logger.info(`Room deleted: ${room.room_number}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Update room status
// @route   PATCH /api/rooms/:id/status
// @access  Private (Admin, Manager, Housekeeping)
export const updateRoomStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, notes } = req.body;

    // GET /rooms returns a *computed* effective status (resolveEffectiveRoomState)
    // that ranks the housekeeping status (hk_status) above rooms.status. So a
    // manual status change here must also normalise hk_status, otherwise e.g.
    // "Mark available" is silently overridden back to "cleaning" on the next
    // refresh whenever the room still carries a checkout / vacant_dirty /
    // cleaning_in_progress housekeeping status left over from the last checkout.
    const hkStatusByRoomStatus: Record<string, string> = {
      available: 'vacant_clean',
      cleaning: 'cleaning_in_progress',
      dirty: 'vacant_dirty',
    };
    const mappedHkStatus = hkStatusByRoomStatus[String(status).toLowerCase()];

    const { data: room, error } = await supabase
      .from('rooms')
      .update({
        status,
        notes,
        updated_at: new Date().toISOString(),
        ...(status === 'cleaning' ? { last_cleaned: new Date().toISOString() } : {}),
        ...(mappedHkStatus ? { hk_status: mappedHkStatus } : {}),
        ...(status === 'available' ? { cleaning_priority: null } : {}),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!room) {
      res.status(404).json({
        success: false,
        message: 'Room not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: room
    });

    logger.info(`Room ${room.room_number} status updated to: ${status}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Get room types
// @route   GET /api/rooms/types
// @access  Public
export const getRoomTypes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: types, error } = await supabase
      .from('room_types')
      .select('*');

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      data: types
    });
  } catch (error) {
    next(error);
  }
};
// @desc    Create a room type
// @route   POST /api/rooms/types
// @access  Private/Admin
export const createRoomType = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: newType, error } = await supabase
      .from('room_types')
      .insert([req.body])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: newType
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a room type
// @route   PUT /api/rooms/types/:id
// @access  Private/Admin
export const updateRoomType = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: updatedType, error } = await supabase
      .from('room_types')
      .update({
        ...req.body,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: updatedType
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a room type
// @route   DELETE /api/rooms/types/:id
// @access  Private/Admin
export const deleteRoomType = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('room_types')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};
