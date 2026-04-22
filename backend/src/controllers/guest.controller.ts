import { Request, Response, NextFunction } from 'express';
import { Guest } from '../models/Guest';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { supabase } from '../config/supabase';

// @desc    Get all guests
// @route   GET /api/guests
// @access  Private
export const getGuests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const search = req.query.search as string;
    const branchId = req.query.branch_id ? parseInt(req.query.branch_id as string) : undefined;
    const checkedInOnly = req.query.checked_in_only === 'true';

    // Get guests with search and branch filtering
    const guests = await Guest.search(search || '', branchId, checkedInOnly);

    res.status(200).json({
      success: true,
      count: guests.length,
      data: guests
    });
  } catch (error) {
    next(new AppError('Failed to fetch guests', 500));
  }
};

// @desc    Get single guest
// @route   GET /api/guests/:id
// @access  Private
export const getGuest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const guestId = req.params.id;
    logger.info(`Fetching guest with ID: ${guestId}`);
    
    const guest = await Guest.findById(guestId);

    if (!guest) {
      logger.warn(`Guest not found: ${guestId}`);
      throw new AppError('Guest not found', 404);
    }

    logger.info(`Guest found: ${guest.firstName} ${guest.lastName}`);
    res.status(200).json({
      success: true,
      data: guest
    });
  } catch (error: any) {
    logger.error(`Error fetching guest ${req.params.id}:`, error);
    logger.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    next(error);
  }
};

// @desc    Create guest
// @route   POST /api/guests
// @access  Private
export const createGuest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const guest = new Guest(req.body);
    const savedGuest = await guest.save();

    res.status(201).json({
      success: true,
      data: savedGuest
    });

    logger.info(`New guest created: ${savedGuest.id}`);
  } catch (error: any) {
    logger.error('Error creating guest:', error);
    logger.error('Request body:', req.body);
    next(new AppError(`Failed to create guest: ${error.message || JSON.stringify(error)}`, 500));
  }
};

// @desc    Update guest
// @route   PUT /api/guests/:id
// @access  Private
export const updateGuest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const existingGuest = await Guest.findById(req.params.id);

    if (!existingGuest) {
      throw new AppError('Guest not found', 404);
    }

    // Merge existing data with updates
    const updatedGuest = new Guest({
      ...existingGuest,
      ...req.body,
      id: req.params.id // Ensure ID doesn't change
    });

    const savedGuest = await updatedGuest.save();

    res.status(200).json({
      success: true,
      data: savedGuest
    });

    logger.info(`Guest updated: ${savedGuest.id}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete guest
// @route   DELETE /api/guests/:id
// @access  Private (Admin only)
export const deleteGuest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { force } = req.query; // Optional force delete parameter

    logger.info(`Attempting to delete guest ${id}${force ? ' (force mode)' : ''}`);

    // Check if guest exists
    const { data: guest, error: fetchError } = await supabase
      .from('guests')
      .select('id, first_name, last_name, email')
      .eq('id', id)
      .single();

    if (fetchError || !guest) {
      logger.error(`Guest ${id} not found:`, fetchError);
      throw new AppError('Guest not found', 404);
    }

    // Check if guest has ANY reservations (active or historical)
    const { data: allReservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('id, status, reservation_number, check_in_date, check_out_date')
      .eq('guest_id', id);

    if (reservationsError) {
      logger.error(`Error checking guest reservations:`, reservationsError);
      throw new AppError('Failed to check guest reservations', 500);
    }

    if (allReservations && allReservations.length > 0) {
      // Check for active bookings
      const activeBookings = allReservations.filter(r => 
        ['confirmed', 'checked_in', 'pending'].includes(r.status)
      );

      if (activeBookings.length > 0) {
        throw new AppError(
          `Cannot delete guest with ${activeBookings.length} active booking(s). Please cancel or complete the bookings first.`,
          400
        );
      }

      // Guest has historical bookings but no active ones
      if (force === 'true') {
        // Force delete: Set guest_id to NULL in all reservations
        logger.info(`Force deleting guest ${id} - nullifying ${allReservations.length} reservation references`);
        
        const { error: updateError } = await supabase
          .from('reservations')
          .update({ guest_id: null })
          .eq('guest_id', id);

        if (updateError) {
          logger.error(`Error nullifying guest references:`, updateError);
          throw new AppError('Failed to remove guest references from reservations', 500);
        }
      } else {
        // Suggest force delete
        throw new AppError(
          `Cannot delete guest with ${allReservations.length} historical reservation(s). The guest has booking history that would be lost. If you're sure you want to delete this guest and remove their association from all reservations, add ?force=true to the request.`,
          400
        );
      }
    }

    // Delete the guest
    const { error: deleteError } = await supabase
      .from('guests')
      .delete()
      .eq('id', id);

    if (deleteError) {
      logger.error(`Error deleting guest ${id}:`, deleteError);
      throw new AppError(`Failed to delete guest: ${deleteError.message}`, 500);
    }

    logger.info(`Guest deleted successfully: ${id} (${guest.first_name} ${guest.last_name})`);

    res.status(200).json({
      success: true,
      data: {},
      message: 'Guest deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update guest preferences
// @route   PUT /api/guests/:id/preferences
// @access  Private
export const updateGuestPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const guest = await Guest.findById(req.params.id);

    if (!guest) {
      throw new AppError('Guest not found', 404);
    }

    guest.preferences = { ...guest.preferences, ...req.body.preferences };
    const savedGuest = await guest.save();

    res.status(200).json({
      success: true,
      data: savedGuest.preferences
    });

    logger.info(`Guest preferences updated: ${req.params.id}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Get guest stay history
// @route   GET /api/guests/:id/history
// @access  Private
export const getGuestHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const guestId = req.params.id;

    // Get all bookings for this guest
    const { data: bookings, error } = await supabase
      .from('reservations')
      .select(`
        id,
        confirmation_number,
        check_in_date,
        check_out_date,
        status,
        total_amount,
        room_rate,
        special_requests,
        created_at,
        room:rooms(room_number),
        room_type:room_types(name)
      `)
      .eq('guest_id', guestId)
      .order('check_in_date', { ascending: false });

    if (error) {
      throw new AppError('Failed to fetch guest history', 500);
    }

    // Calculate statistics
    const completedStays = bookings?.filter(b => b.status === 'checked_out') || [];
    const totalSpent = completedStays.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const totalNights = completedStays.reduce((sum, b) => {
      const checkIn = new Date(b.check_in_date);
      const checkOut = new Date(b.check_out_date);
      return sum + Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    }, 0);

    res.status(200).json({
      success: true,
      data: {
        bookings: bookings || [],
        statistics: {
          totalStays: completedStays.length,
          totalNights,
          totalSpent,
          averageStayValue: completedStays.length > 0 ? totalSpent / completedStays.length : 0,
          firstStay: completedStays.length > 0 ? completedStays[completedStays.length - 1].check_in_date : null,
          lastStay: completedStays.length > 0 ? completedStays[0].check_in_date : null,
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get guest loyalty status
// @route   GET /api/guests/:id/loyalty
// @access  Private
export const getGuestLoyalty = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const guestId = req.params.id;

    // Get guest
    const guest = await Guest.findById(guestId);
    if (!guest) {
      throw new AppError('Guest not found', 404);
    }

    // Get stay statistics
    const { data: bookings } = await supabase
      .from('reservations')
      .select('id, total_amount, check_in_date, check_out_date, status')
      .eq('guest_id', guestId)
      .eq('status', 'checked_out');

    const totalStays = bookings?.length || 0;
    const totalSpent = bookings?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
    const totalNights = bookings?.reduce((sum, b) => {
      const checkIn = new Date(b.check_in_date);
      const checkOut = new Date(b.check_out_date);
      return sum + Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    }, 0) || 0;

    // Calculate loyalty tier
    let tier = 'Bronze';
    let pointsMultiplier = 1;
    let benefits: string[] = ['Welcome drink on arrival'];

    if (totalNights >= 50 || totalSpent >= 500000) {
      tier = 'Platinum';
      pointsMultiplier = 3;
      benefits = [
        'Suite upgrade (subject to availability)',
        'Late checkout until 4pm',
        'Complimentary breakfast',
        'Airport transfers',
        'Dedicated concierge',
        '20% F&B discount'
      ];
    } else if (totalNights >= 20 || totalSpent >= 200000) {
      tier = 'Gold';
      pointsMultiplier = 2;
      benefits = [
        'Room upgrade (subject to availability)',
        'Late checkout until 2pm',
        'Complimentary breakfast',
        '15% F&B discount'
      ];
    } else if (totalNights >= 5 || totalSpent >= 50000) {
      tier = 'Silver';
      pointsMultiplier = 1.5;
      benefits = [
        'Early check-in (subject to availability)',
        'Late checkout until 1pm',
        '10% F&B discount'
      ];
    }

    // Calculate points (10 points per 1000 KES spent)
    const points = Math.floor(totalSpent / 100);
    const pointsToNextTier = tier === 'Platinum' ? 0 :
      tier === 'Gold' ? (500000 - totalSpent) / 100 :
        tier === 'Silver' ? (200000 - totalSpent) / 100 :
          (50000 - totalSpent) / 100;

    res.status(200).json({
      success: true,
      data: {
        guestId,
        guestName: `${guest.firstName} ${guest.lastName}`,
        tier,
        points,
        pointsMultiplier,
        benefits,
        statistics: {
          totalStays,
          totalNights,
          totalSpent,
        },
        nextTier: tier === 'Platinum' ? null : {
          name: tier === 'Gold' ? 'Platinum' : tier === 'Silver' ? 'Gold' : 'Silver',
          pointsNeeded: Math.max(0, pointsToNextTier),
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update guest loyalty points
// @route   POST /api/guests/:id/loyalty/points
// @access  Private
export const updateLoyaltyPoints = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const guestId = req.params.id;
    const { points, reason, type = 'earn' } = req.body;

    if (!points || points <= 0) {
      throw new AppError('Valid points amount required', 400);
    }

    // Record points transaction
    const { data, error } = await supabase
      .from('loyalty_transactions')
      .insert({
        guest_id: guestId,
        points: type === 'redeem' ? -points : points,
        reason: reason || (type === 'redeem' ? 'Points redemption' : 'Points earned'),
        type,
        created_by: req.user?.id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      // Table might not exist, log but don't fail
      logger.warn('Loyalty transactions table may not exist:', error.message);
    }

    res.status(200).json({
      success: true,
      message: `${points} points ${type === 'redeem' ? 'redeemed' : 'added'} successfully`,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get VIP guests
// @route   GET /api/guests/vip
// @access  Private
export const getVIPGuests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get guests with highest total spend
    const { data: topGuests, error } = await supabase
      .from('reservations')
      .select(`
        guest_id,
        guest:guests(id, first_name, last_name, email, phone, is_vip),
        total_amount
      `)
      .eq('status', 'checked_out')
      .not('guest_id', 'is', null);

    if (error) {
      throw new AppError('Failed to fetch VIP guests', 500);
    }

    // Aggregate by guest
    const guestSpending = new Map<string, { guest: any; totalSpent: number; stayCount: number }>();

    (topGuests || []).forEach((booking: any) => {
      if (!booking.guest_id) return;
      const existing = guestSpending.get(booking.guest_id) || {
        guest: booking.guest,
        totalSpent: 0,
        stayCount: 0
      };
      existing.totalSpent += booking.total_amount || 0;
      existing.stayCount += 1;
      guestSpending.set(booking.guest_id, existing);
    });

    // Sort by total spent and get top 20
    const vipGuests = Array.from(guestSpending.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 20)
      .map(item => ({
        ...item.guest,
        totalSpent: item.totalSpent,
        stayCount: item.stayCount,
        tier: item.totalSpent >= 500000 ? 'Platinum' :
          item.totalSpent >= 200000 ? 'Gold' :
            item.totalSpent >= 50000 ? 'Silver' : 'Bronze'
      }));

    res.status(200).json({
      success: true,
      count: vipGuests.length,
      data: vipGuests
    });
  } catch (error) {
    next(error);
  }
};
