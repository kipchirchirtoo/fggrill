import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

// @desc    Get all reservations
// @route   GET /api/restaurant/reservations
// @access  Private
export const getReservations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { branch_id, status, date } = req.query;

    let query = supabase
      .from('restaurant_reservations')
      .select(`
        *,
        customer:restaurant_customers(*),
        table:restaurant_tables(*)
      `)
      .order('reservation_date', { ascending: true })
      .order('reservation_time', { ascending: true });

    const branchId = req.user?.branch_id || req.query.branch_id;
    if (branchId) query = query.eq('branch_id', branchId);
    if (status) query = query.eq('status', status);
    if (date) query = query.eq('reservation_date', date);

    const { data: reservations, error } = await query;

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: reservations?.length || 0,
      data: reservations
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single reservation
// @route   GET /api/restaurant/reservations/:id
// @access  Private
export const getReservationById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: reservation, error } = await supabase
      .from('restaurant_reservations')
      .select(`
        *,
        customer:restaurant_customers(*),
        table:restaurant_tables(*,section:restaurant_sections(*))
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    if (!reservation) {
      res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: reservation
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new reservation
// @route   POST /api/restaurant/reservations
// @access  Private
export const createReservation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      branchId,
      guestName,
      guestEmail,
      guestPhone,
      partySize,
      reservationDate,
      reservationTime,
      sectionPreference,
      specialOccasion,
      dietaryRestrictions,
      specialRequests,
      depositAmount
    } = req.body;

    // Generate reservation number
    const { data: resNumber } = await supabase
      .rpc('generate_reservation_number');

    const { data: reservation, error } = await supabase
      .from('restaurant_reservations')
      .insert([{
        branch_id: req.user?.branch_id || branchId,
        reservation_number: resNumber,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        party_size: partySize,
        reservation_date: reservationDate,
        reservation_time: reservationTime,
        section_preference: sectionPreference,
        special_occasion: specialOccasion,
        dietary_restrictions: dietaryRestrictions,
        special_requests: specialRequests,
        deposit_amount: depositAmount || 0,
        status: 'pending',
        created_by: req.user?.id
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: reservation
    });

    logger.info(`New reservation created: ${resNumber}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Update reservation
// @route   PUT /api/restaurant/reservations/:id
// @access  Private
export const updateReservation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      partySize,
      reservationDate,
      reservationTime,
      sectionPreference,
      specialOccasion,
      dietaryRestrictions,
      specialRequests,
      tableId
    } = req.body;

    const { data: reservation, error } = await supabase
      .from('restaurant_reservations')
      .update({
        party_size: partySize,
        reservation_date: reservationDate,
        reservation_time: reservationTime,
        section_preference: sectionPreference,
        special_occasion: specialOccasion,
        dietary_restrictions: dietaryRestrictions,
        special_requests: specialRequests,
        table_id: tableId,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: reservation
    });

    logger.info(`Reservation updated: ${reservation.reservation_number}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Confirm reservation
// @route   PUT /api/restaurant/reservations/:id/confirm
// @access  Private
export const confirmReservation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: reservation, error } = await supabase
      .from('restaurant_reservations')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: reservation
    });

    logger.info(`Reservation confirmed: ${reservation.reservation_number}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Seat reservation (mark as seated)
// @route   PUT /api/restaurant/reservations/:id/seat
// @access  Private
export const seatReservation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { tableId } = req.body;

    const { data: reservation, error } = await supabase
      .from('restaurant_reservations')
      .update({
        status: 'seated',
        table_id: tableId,
        seated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Update table status to occupied
    if (tableId) {
      await supabase
        .from('restaurant_tables')
        .update({ status: 'occupied' })
        .eq('id', tableId);
    }

    res.status(200).json({
      success: true,
      data: reservation
    });

    logger.info(`Reservation seated: ${reservation.reservation_number}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel reservation
// @route   PUT /api/restaurant/reservations/:id/cancel
// @access  Private
export const cancelReservation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reason } = req.body;

    const { data: reservation, error } = await supabase
      .from('restaurant_reservations')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: reservation
    });

    logger.info(`Reservation cancelled: ${reservation.reservation_number}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Mark as no-show
// @route   PUT /api/restaurant/reservations/:id/no-show
// @access  Private
export const markNoShow = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: reservation, error } = await supabase
      .from('restaurant_reservations')
      .update({
        status: 'no_show',
        no_show_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: reservation
    });

    logger.info(`Reservation marked as no-show: ${reservation.reservation_number}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Check availability for date/time
// @route   GET /api/restaurant/reservations/availability
// @access  Public
export const checkAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { date, time, partySize, branchId } = req.query;

    // Get existing reservations for that date/time
    const { data: existingReservations } = await supabase
      .from('restaurant_reservations')
      .select('party_size')
      .eq('reservation_date', date)
      .eq('reservation_time', time)
      .eq('branch_id', branchId)
      .in('status', ['confirmed', 'pending', 'seated']);

    // Get total table capacity
    const { data: tables } = await supabase
      .from('restaurant_tables')
      .select('capacity')
      .eq('branch_id', branchId)
      .eq('is_active', true);

    const totalCapacity = tables?.reduce((sum, t) => sum + (t.capacity || 0), 0) || 0;
    const bookedCapacity = existingReservations?.reduce((sum, r) => sum + (r.party_size || 0), 0) || 0;
    const availableCapacity = totalCapacity - bookedCapacity;

    const isAvailable = availableCapacity >= parseInt(partySize as string);

    res.status(200).json({
      success: true,
      data: {
        available: isAvailable,
        totalCapacity,
        bookedCapacity,
        availableCapacity,
        requestedPartySize: parseInt(partySize as string)
      }
    });
  } catch (error) {
    next(error);
  }
};
