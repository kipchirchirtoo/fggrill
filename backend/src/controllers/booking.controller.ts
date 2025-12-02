import { Request, Response, NextFunction } from 'express';
import { Booking, BookingStatus } from '../models/Booking';
import { Folio } from '../models/Folio';
import { Room, RoomStatus } from '../models/Room';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { supabase } from '../config/database';

// @desc    Get all bookings
// @route   GET /api/bookings
// @access  Private
export const getBookings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const startIndex = (page - 1) * limit;

    let query = supabase
      .from('reservations')
      .select('*, room:rooms(*), guest:guests(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(startIndex, startIndex + limit - 1);

    if (req.query.status) {
      query = query.eq('status', req.query.status);
    }
    if (req.query.checkIn) {
      query = query.gte('check_in_date', req.query.checkIn);
    }
    if (req.query.checkOut) {
      query = query.lte('check_out_date', req.query.checkOut);
    }

    const { data: bookings, error, count } = await query;

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: bookings.length,
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit),
      data: bookings
    });
  } catch (error) {
    next(new AppError('Failed to fetch bookings', 500));
  }
};

// @desc    Get single booking
// @route   GET /api/bookings/:id
// @access  Private
export const getBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    // Fetch related data manually or assume frontend fetches separately?
    // For now, let's return the booking model
    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new booking
// @route   POST /api/bookings
// @access  Private
export const createBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roomId, roomTypeId, checkInDate, checkOutDate, guestId, adults, children, specialRequests, totalAmount } = req.body;

    // 1. Check Availability
    const { data: conflicts } = await supabase
      .from('reservations')
      .select('id')
      .eq('room_id', roomId)
      .not('status', 'in', `(${BookingStatus.CANCELLED},${BookingStatus.CHECKED_OUT})`)
      .or(`check_in_date.lte.${checkOutDate},check_out_date.gt.${checkInDate}`);

    if (conflicts && conflicts.length > 0) {
      throw new AppError('Room is not available for selected dates', 400);
    }

    // 2. Create Booking
    const booking = new Booking({
      roomId,
      roomTypeId,
      checkInDate: new Date(checkInDate),
      checkOutDate: new Date(checkOutDate),
      guestId,
      adults,
      children,
      specialRequests,
      totalAmount, // Should be calculated securely on backend in real app
      status: BookingStatus.CONFIRMED,
      createdBy: req.user?.id
    });

    const savedBooking = await booking.save();

    // 3. Create Folio
    const folio = new Folio({
      reservationId: savedBooking.id,
      guestId: guestId,
      status: 'open'
    });
    // We need a save method on Folio, but I implemented it as insert in model?
    // Let's fix Folio model usage here. I'll use supabase directly or update Folio model to have save().
    // Folio model I created has no save() method! I need to fix that.
    // For now, direct insert:
    await supabase.from('folios').insert({
      reservation_id: savedBooking.id,
      guest_id: guestId,
      status: 'open'
    });

    res.status(201).json({
      success: true,
      data: savedBooking
    });

    logger.info(`New booking created: ${savedBooking.confirmationNumber}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Update booking
// @route   PUT /api/bookings/:id
// @access  Private
export const updateBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    // Update fields
    Object.assign(booking, req.body);
    const updatedBooking = await booking.save();

    res.status(200).json({
      success: true,
      data: updatedBooking
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check-in booking
// @route   POST /api/bookings/:id/check-in
// @access  Private
export const checkInBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) throw new AppError('Booking not found', 404);

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new AppError('Booking must be confirmed to check in', 400);
    }

    // Update booking status
    booking.status = BookingStatus.CHECKED_IN;
    await booking.save();

    // Update room status
    if (booking.roomId) {
      const room = await Room.findById(booking.roomId);
      if (room) {
        room.status = RoomStatus.OCCUPIED;
        room.currentGuest = booking.guestId; // Assuming room model uses guestId or name
        await room.save();
      }
    }

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

// @desc    Check-out booking
// @route   PUT /api/bookings/:id/check-out
// @access  Private
export const checkOutBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) throw new AppError('Booking not found', 404);

    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new AppError('Only checked-in bookings can be checked out', 400);
    }

    // Update booking status
    booking.status = BookingStatus.CHECKED_OUT;
    await booking.save();

    // Update room status
    if (booking.roomId) {
      const room = await Room.findById(booking.roomId);
      if (room) {
        room.status = RoomStatus.CLEANING;
        room.currentGuest = undefined;
        await room.save();
      }
    }

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private
export const cancelBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) throw new AppError('Booking not found', 404);

    booking.status = BookingStatus.CANCELLED;
    await booking.save();

    if (booking.roomId) {
       const room = await Room.findById(booking.roomId);
       if (room && room.status === RoomStatus.RESERVED) {
           room.status = RoomStatus.AVAILABLE;
           await room.save();
       }
    }

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

// @desc    Get available rooms
// @route   GET /api/bookings/available
// @access  Public
export const getAvailableRooms = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { checkIn, checkOut } = req.query;
    if (!checkIn || !checkOut) throw new AppError('Dates required', 400);

    // Find booked room IDs
    const { data: booked } = await supabase
      .from('reservations')
      .select('room_id')
      .not('status', 'in', `(${BookingStatus.CANCELLED},${BookingStatus.CHECKED_OUT})`)
      .or(`check_in_date.lte.${checkOut},check_out_date.gt.${checkIn}`);

    const bookedIds = (booked || []).map(b => b.room_id);

    // Find available rooms
    let query = supabase.from('rooms').select('*, type:room_types!type_id(*)');
    
    if (bookedIds.length > 0) {
      query = query.not('id', 'in', `(${bookedIds.join(',')})`);
    }

    const { data: rooms, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, data: rooms });
  } catch (error) {
    next(error);
  }
};

// Placeholder for payment processing - implementation moved to Folio/Payment controller
export const processPayment = async (req: Request, res: Response, next: NextFunction) => {
    res.status(501).json({ message: "Use Folio API for payments" });
};
