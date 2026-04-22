import { Request, Response, NextFunction } from 'express';
import { Booking, BookingStatus } from '../models/Booking';
import { Folio } from '../models/Folio';
import { Room, RoomStatus } from '../models/Room';
import { RatePlan } from '../models/RatePlan';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { supabase } from '../config/database';
import { bookingService, BookingRequest } from '../services/booking.service';
import { isGlobalRole } from '../utils/branchIsolation';

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

    const isGlobal = isGlobalRole(req.user?.role);
    const branchId = isGlobal ? req.query.branch_id : req.user?.branch_id;

    // Construct select string based on whether we need to filter by branch (which requires inner join on rooms)
    let selectString = '*, guest:guests!guest_id(*)';
    if (branchId) {
      // Use inner join to filter by room's branch_id
      selectString += ', room:rooms!room_id!inner(id, room_number, room_type, branch_id, status)';
    } else {
      selectString += ', room:rooms!room_id(id, room_number, room_type, branch_id, status)';
    }

    let query = supabase
      .from('reservations')
      .select(selectString, { count: 'exact' })
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
    if (branchId) {
      query = query.eq('room.branch_id', branchId);
    }

    const { data: bookings, error, count } = await query;

    if (error) throw error;

    const formattedBookings = bookings.map((b: any) => {
      const checkIn = b.check_in_date || b.check_in;
      const checkOut = b.check_out_date || b.check_out;
      const nights = checkIn && checkOut
        ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return {
        ...b,
        check_in: checkIn,
        check_out: checkOut,
        nights,
        amount_paid: b.deposit_amount || 0,
        total: b.total_amount || b.total || 0,
        guest_name: b.guest ? `${b.guest.first_name} ${b.guest.last_name}` : 'Unknown',
        phone: b.guest ? b.guest.phone : null,
        email: b.guest ? b.guest.email : null,
        guest_phone: b.guest ? b.guest.phone : '-',
        room_number: b.room ? b.room.room_number : '-',
        room_type: b.room ? b.room.room_type : '-',
        guests: (b.adults || 1) + (b.children || 0),
        special_requests: b.special_requests || null,
      };
    });

    res.status(200).json({
      success: true,
      count: formattedBookings.length,
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit),
      data: formattedBookings
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

// @desc    Create new booking (Enhanced)
// @route   POST /api/bookings
// @access  Public/Private
export const createBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Handle both roomId (specific room) and roomTypeId (any room of type)
    let roomTypeId = req.body.roomTypeId || req.body.room_type_id;
    let specificRoomId = req.body.roomId || req.body.room_id;

    // If roomId is provided, get the room type from the room
    if (specificRoomId && !roomTypeId) {
      const { data: room } = await supabase
        .from('rooms')
        .select('room_type_id')
        .eq('id', specificRoomId)
        .single();

      if (room) {
        roomTypeId = room.room_type_id;
      } else {
        throw new AppError('Room not found', 404);
      }
    }

    if (!roomTypeId) {
      throw new AppError('Room type ID is required', 400);
    }

    // Use enhanced booking service for complete flow
    const bookingRequest: BookingRequest = {
      guestId: req.body.guestId || req.body.guest_id,
      guestInfo: {
        firstName: req.body.guestInfo?.firstName || req.body.firstName,
        lastName: req.body.guestInfo?.lastName || req.body.lastName,
        email: req.body.guestInfo?.email || req.body.email,
        phone: req.body.guestInfo?.phone || req.body.phone,
        idType: req.body.guestInfo?.idType || req.body.idType || req.body.id_type,
        idNumber: req.body.guestInfo?.idNumber || req.body.idNumber || req.body.id_number,
        nationality: req.body.guestInfo?.nationality || req.body.nationality,
        address: req.body.guestInfo?.address || req.body.address
      },
      roomId: specificRoomId, // Renamed from specificRoomId to roomId as per instruction
      roomTypeId: roomTypeId,
      checkInDate: req.body.checkInDate || req.body.check_in_date || req.body.check_in,
      checkOutDate: req.body.checkOutDate || req.body.check_out_date || req.body.check_out,
      adults: req.body.adults || 1,
      children: req.body.children || 0,
      infants: req.body.infants || 0,
      mealPlan: req.body.mealPlan || req.body.meal_plan,
      specialRequests: req.body.specialRequests || req.body.special_requests,
      purpose: req.body.purpose,
      paymentMethod: req.body.paymentMethod || 'card',
      depositAmount: req.body.depositAmount || req.body.total_amount,
      bookingSource: req.body.bookingSource || 'WEBSITE',
      branchId: req.user?.branch_id || req.body.branchId || req.body.branch_id
    };

    const booking = await bookingService.createBooking(bookingRequest);

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: {
        booking,
        confirmationNumber: booking.confirmationNumber,
        bookingId: booking.id
      }
    });

    logger.info(`New booking created: ${booking.confirmationNumber} by ${req.body.guestInfo?.email || 'system'}`);
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
// @desc    Check-in booking
// @route   POST /api/bookings/:id/check-in
// @access  Private
export const checkInBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    logger.info(`Check-in attempt for booking ${id} by user ${userId}`);

    // 1. Get the booking
    const { data: booking, error: fetchError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      logger.error(`Error fetching booking ${id}:`, fetchError);
      throw new AppError('Booking not found', 404);
    }

    if (!booking) {
      logger.warn(`Booking ${id} not found`);
      throw new AppError('Booking not found', 404);
    }

    logger.info(`Booking ${id} current status: ${booking.status}`);

    if (booking.status !== 'confirmed') {
      logger.warn(`Cannot check in booking ${id} - status is ${booking.status}, must be confirmed`);
      throw new AppError(`Cannot check in: Booking status is "${booking.status}". Only confirmed bookings can be checked in.`, 400);
    }

    // 2. Update booking status
    const { data: updatedBooking, error: updateError } = await supabase
      .from('reservations')
      .update({
        status: 'checked_in',
        checked_in_at: new Date().toISOString(),
        checked_in_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      logger.error(`Error updating booking ${id} to checked_in:`, updateError);
      throw updateError;
    }

    // 3. Update room status if room is assigned
    if (booking.room_id) {
      try {
        await bookingService.updateRoomStatus(
          booking.room_id,
          RoomStatus.OCCUPIED,
          userId,
          `Room occupied via check-in for booking ${booking.confirmation_number}`
        );
        logger.info(`Room ${booking.room_id} status updated to OCCUPIED`);
      } catch (roomError) {
        logger.error('Failed to update room status during check-in:', roomError);
        // Don't fail the check-in if room status update fails
      }
    }

    logger.info(`Successfully checked in booking ${id}`);
    res.status(200).json({ success: true, data: updatedBooking });
  } catch (error: any) {
    logger.error(`Check-in error for booking ${req.params.id}:`, error);
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
    const { id } = req.params;
    const userId = req.user?.id;

    // 1. Get the booking
    const { data: booking, error: fetchError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !booking) {
      throw new AppError('Booking not found', 404);
    }

    if (booking.status !== 'checked_in') {
      throw new AppError(`Only checked-in bookings can be checked out. Current status: ${booking.status}`, 400);
    }

    // 2. Update booking status
    const { data: updatedBooking, error: updateError } = await supabase
      .from('reservations')
      .update({
        status: 'checked_out',
        checked_out_at: new Date().toISOString(),
        checked_out_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 3. Update room status if room is assigned
    if (booking.room_id) {
      try {
        await bookingService.updateRoomStatus(
          booking.room_id,
          RoomStatus.CLEANING,
          userId,
          `Room set to cleaning via check-out for booking ${booking.confirmation_number}`
        );
      } catch (roomError) {
        logger.error('Failed to update room status during check-out:', roomError);
      }
    }

    res.status(200).json({ success: true, data: updatedBooking });
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
    const { id } = req.params;
    const userId = req.user?.id;
    const { reason } = req.body;

    // 1. Get the booking
    const { data: booking, error: fetchError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !booking) {
      throw new AppError('Booking not found', 404);
    }

    // 2. Update booking status
    const { data: updatedBooking, error: updateError } = await supabase
      .from('reservations')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId,
        cancellation_reason: reason || 'User cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 3. Update room status if room is assigned and was reserved
    if (booking.room_id) {
      try {
        const { data: room } = await supabase
          .from('rooms')
          .select('status')
          .eq('id', booking.room_id)
          .single();

        if (room && room.status === RoomStatus.RESERVED) {
          await bookingService.updateRoomStatus(
            booking.room_id,
            RoomStatus.AVAILABLE,
            userId,
            `Room released via cancellation for booking ${booking.confirmation_number}`
          );
        }
      } catch (roomError) {
        logger.error('Failed to update room status during cancellation:', roomError);
      }
    }

    res.status(200).json({ success: true, data: updatedBooking });
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

    // Find booked room IDs from reservations table
    const { data: booked, error: bookedError } = await supabase
      .from('reservations')
      .select('room_id')
      .not('status', 'in', '(cancelled,checked_out)')
      .lt('check_in_date', checkOut as string)
      .gt('check_out_date', checkIn as string);

    if (bookedError) {
      logger.error('Error fetching booked rooms:', bookedError);
      // Continue with empty booked IDs if there's an error
    }

    const bookedIds = (booked || []).map((b: { room_id: string }) => b.room_id).filter(Boolean);

    // Find available rooms
    // Only show rooms that are:
    // 1. Status is 'available' or 'cleaning' (cleaning rooms can be booked for future dates)
    // 2. Not in maintenance or out of order
    // 3. Not already booked for the selected dates
    let query = supabase
      .from('rooms')
      .select('*, type:room_types!type_id(*)')
      .in('status', ['available', 'cleaning']);

    if (bookedIds.length > 0) {
      // Format array for Supabase filter: ("id1","id2")
      const bookedIdsString = `(${bookedIds.map(id => `"${id}"`).join(',')})`;
      query = query.not('id', 'in', bookedIdsString);
    }

    const isGlobal = isGlobalRole(req.user?.role);
    const branchId = isGlobal ? req.query.branch_id : req.user?.branch_id;
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data: rooms, error } = await query;
    if (error) {
      logger.error('Error fetching available rooms:', error);
      throw new AppError('Failed to fetch available rooms', 500);
    }

    // Calculate nights for the stay
    const checkInDate = new Date(checkIn as string);
    const checkOutDate = new Date(checkOut as string);
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

    // Provide helpful message if no rooms available
    const message = rooms && rooms.length > 0
      ? `Found ${rooms.length} available room${rooms.length > 1 ? 's' : ''} for your dates`
      : 'No rooms available for the selected dates. Please try different dates or contact us for assistance.';

    res.status(200).json({
      success: true,
      message,
      data: rooms || [],
      count: rooms?.length || 0,
      nights: nights,
      dates: {
        checkIn: checkIn,
        checkOut: checkOut
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check room availability
// @route   GET /api/bookings/check-availability
// @access  Public
export const checkAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { checkInDate, checkOutDate, roomTypeId, branchId } = req.query;

    if (!checkInDate || !checkOutDate || !roomTypeId) {
      throw new AppError('Check-in date, check-out date, and room type are required', 400);
    }

    const isGlobal = isGlobalRole(req.user?.role);
    const effectiveBranchId = isGlobal && branchId ? branchId as string : req.user?.branch_id?.toString();

    const availability = await bookingService.checkAvailability(
      checkInDate as string,
      checkOutDate as string,
      roomTypeId as string,
      effectiveBranchId
    );

    res.status(200).json({
      success: true,
      data: availability
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get pricing quote
// @route   POST /api/bookings/quote
// @access  Public
export const getPricingQuote = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { checkInDate, checkOutDate, roomTypeId, adults, children, mealPlan, ratePlanId } = req.body;

    if (!checkInDate || !checkOutDate || !roomTypeId) {
      throw new AppError('Check-in date, check-out date, and room type are required', 400);
    }

    const pricing = await bookingService.calculatePricing(
      checkInDate,
      checkOutDate,
      roomTypeId,
      adults || 1,
      children || 0,
      mealPlan,
      ratePlanId
    );

    res.status(200).json({
      success: true,
      data: pricing
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Modify booking
// @route   PUT /api/bookings/:id/modify
// @access  Private
export const modifyBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const bookingId = req.params.id;
    const modifications = req.body;
    const modifiedBy = req.user?.id;

    const updatedBooking = await bookingService.modifyBooking(
      bookingId,
      modifications,
      modifiedBy
    );

    res.status(200).json({
      success: true,
      message: 'Booking modified successfully',
      data: updatedBooking
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get booking by confirmation number (Guest Portal)
// @route   GET /api/bookings/confirmation/:confirmationNumber
// @access  Public
export const getBookingByConfirmation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { confirmationNumber } = req.params;
    const { email } = req.query;

    if (!email) {
      throw new AppError('Email is required for verification', 400);
    }

    const booking = await bookingService.getBookingByConfirmation(
      confirmationNumber,
      email as string
    );

    if (!booking) {
      throw new AppError('Booking not found or invalid credentials', 404);
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    next(error);
  }
};
