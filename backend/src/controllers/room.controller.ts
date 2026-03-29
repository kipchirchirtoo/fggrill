import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { applyBranchFilter, isGlobalRole } from '../utils/branchIsolation';

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
    if (isGlobal && req.query.branch_id) {
      query = query.eq('branch_id', req.query.branch_id as string);
    }
    if (req.query.status) {
      query = query.eq('status', req.query.status as string);
    }

    const { data: rooms, error } = await query;

    if (error) {
      logger.error('Database error in getRooms:', error);
      throw error;
    }

    res.status(200).json({
      success: true,
      data: rooms || []
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

    const { data: room, error } = await supabase
      .from('rooms')
      .update({
        status,
        notes,
        updated_at: new Date().toISOString(),
        ...(status === 'cleaning' ? { last_cleaned: new Date().toISOString() } : {})
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
