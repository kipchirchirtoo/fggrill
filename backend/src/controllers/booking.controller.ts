import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import { Booking, BookingStatus } from '../models/Booking';
import { Room, RoomStatus } from '../models/Room';

// @desc    Get all bookings with filters and pagination
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
      .from('bookings')
      .select('*, room:rooms(*), guest:users!guest_id(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(startIndex, startIndex + limit - 1);

    // Add filters
    if (req.query.status) {
      query = query.eq('status', req.query.status);
    }
    if (req.query.checkIn) {
      query = query.gte('check_in_date', req.query.checkIn);
    }
    if (req.query.checkOut) {
      query = query.lte('check_out_date', req.query.checkOut);
    }
    if (req.query.roomType) {
      query = query.eq('room.type_id', req.query.roomType);
    }

    const { data: bookings, error, count } = await query;

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      count: bookings.length,
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit),
      data: bookings
    });
  } catch (error) {
    next(error);
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
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        *,
        room:rooms(*),
        guest:users!guest_id(*),
        payments:booking_payments(*),
        status_history:booking_status_history(*)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) {
      throw error;
    }

    if (!booking) {
      res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
      return;
    }

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
    const { roomId, checkInDate, checkOutDate, guestId, adults, children, specialRequests } = req.body;

    // Check room exists and get its price
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*, type:room_types(*)')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      res.status(404).json({
        success: false,
        message: 'Room not found'
      });
      return;
    }

    // Check if room is available for the dates
    const { data: conflictingBookings, error: conflictError } = await supabase
      .from('bookings')
      .select('id')
      .eq('room_id', roomId)
      .not('status', 'in', '(cancelled,checked_out)')
      .or(`check_in_date.lte.${checkInDate},check_out_date.gt.${checkInDate}`)
      .or(`check_in_date.lt.${checkOutDate},check_out_date.gte.${checkOutDate}`);

    if (conflictError) {
      throw conflictError;
    }

    if (conflictingBookings && conflictingBookings.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Room is not available for the selected dates'
      });
      return;
    }

    // Generate booking number
    const bookingNumber = await generateBookingNumber();

    // Calculate total amount
    const nights = Math.ceil(
      (new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const totalAmount = (room.price_override || room.type.base_price) * nights;

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert([
        {
          booking_number: bookingNumber,
          room_id: roomId,
          guest_id: guestId,
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          adults,
          children,
          special_requests: specialRequests,
          total_amount: totalAmount,
          created_by: req.user?.id
        }
      ])
      .select()
      .single();

    if (bookingError) {
      throw bookingError;
    }

    res.status(201).json({
      success: true,
      data: booking
    });

    logger.info(`New booking created: ${bookingNumber}`);
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
    let booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
      return;
    }

    // Check if status is being updated
    if (req.body.status && req.body.status !== booking.status) {
      const room = await Room.findByNumber(booking.roomNumber || '');
      if (!room) {
        res.status(404).json({
          success: false,
          message: 'Room not found'
        });
        return;
      }

      // Handle status changes
      switch (req.body.status) {
        case BookingStatus.CHECKED_IN:
          room.status = RoomStatus.OCCUPIED;
          room.currentGuest = booking.userId;
          await room.save();
          break;
        case BookingStatus.CHECKED_OUT:
          room.status = RoomStatus.CLEANING;
          room.currentGuest = undefined;
          await room.save();
          break;
        case BookingStatus.CANCELLED:
          if (room.status === RoomStatus.OCCUPIED && room.currentGuest === booking.userId) {
            room.status = RoomStatus.AVAILABLE;
            room.currentGuest = undefined;
            await room.save();
          }
          break;
      }
    }

    // Update booking
    Object.assign(booking, req.body);
    const updatedBooking = await booking.save();

    // Emit socket event if available
    const io = (req.app as any).get('io');
    if (io) {
      io.emit('booking:updated', updatedBooking);
    }

    res.status(200).json({
      success: true,
      data: booking
    });

    logger.info(`Booking updated: ${booking?.bookingNumber}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete booking
// @route   DELETE /api/bookings/:id
// @access  Private (Admin only)
export const deleteBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
      return;
    }

    await booking.delete();

    // Emit socket event if available
    const io = (req.app as any).get('io');
    if (io) {
      io.emit('booking:deleted', booking.id);
    }

    res.status(200).json({
      success: true,
      data: {}
    });

    logger.info(`Booking deleted: ${booking.bookingNumber}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Process payment for booking
// @route   POST /api/bookings/:id/payment
// @access  Private
export const processPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { amount, method } = req.body;

    // Get booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (bookingError || !booking) {
      res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
      return;
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('booking_payments')
      .insert([
        {
          booking_id: booking.id,
          amount,
          payment_method: method,
          transaction_id: `TXN${Date.now()}`,
          created_by: req.user?.id
        }
      ])
      .select()
      .single();

    if (paymentError) {
      throw paymentError;
    }

    // Get updated booking with new payment status
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .select('*, payments:booking_payments(*)')
      .eq('id', booking.id)
      .single();

    if (updateError) {
      throw updateError;
    }

    res.status(200).json({
      success: true,
      data: {
        booking: updatedBooking,
        payment
      }
    });

    logger.info(`Payment processed for booking: ${booking.booking_number}`);
  } catch (error) {
    next(error);
  }
};

// Helper function to generate unique booking number
const generateBookingNumber = async (): Promise<string> => {
  const prefix = 'BK';
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const bookingNumber = `${prefix}${date}${random}`;

  // Check if booking number exists
  const { data: exists } = await supabase
    .from('bookings')
    .select('booking_number')
    .eq('booking_number', bookingNumber)
    .single();

  if (exists) {
    return generateBookingNumber();
  }

  return bookingNumber;
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
    // Get booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (bookingError || !booking) {
      res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
      return;
    }

    // Check if booking can be cancelled
    if (booking.status === 'checked_in' || booking.status === 'checked_out') {
      res.status(400).json({
        success: false,
        message: 'Cannot cancel a checked-in or checked-out booking'
      });
      return;
    }

    // Update booking status
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: req.user?.id,
        notes: req.body.reason || 'No reason provided'
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    res.status(200).json({
      success: true,
      data: updatedBooking
    });

    logger.info(`Booking cancelled: ${booking.booking_number}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Check-in booking
// @route   PUT /api/bookings/:id/check-in
// @access  Private
export const checkInBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, room:rooms(*)')
      .eq('id', req.params.id)
      .single();

    if (bookingError || !booking) {
      res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
      return;
    }

    // Check if booking can be checked in
    if (booking.status !== 'confirmed') {
      res.status(400).json({
        success: false,
        message: 'Only confirmed bookings can be checked in'
      });
      return;
    }

    // Start a transaction
    const { data: updatedBooking, error: updateError } = await supabase
      .rpc('check_in_booking', { 
        booking_id: booking.id,
        user_id: req.user?.id
      });

    if (updateError) {
      throw updateError;
    }

    res.status(200).json({
      success: true,
      data: updatedBooking
    });

    logger.info(`Booking checked in: ${booking.booking_number}`);
  } catch (error) {
    next(error);
  }
};
