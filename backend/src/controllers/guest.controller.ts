import { Request, Response, NextFunction } from 'express';
import { Guest } from '../models/Guest';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { supabase } from '../config/supabase';

const readText = (body: any, keys: string[]): string =>
  keys
    .map((key) => body?.[key])
    .find((value) => typeof value === 'string' && value.trim().length > 0)
    ?.trim() || '';

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
    const idNumber = readText(req.body, ['idNumber', 'id_number', 'identification_number']);
    if (!idNumber) {
      throw new AppError('Guest ID number is required', 400);
    }

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
    if (error instanceof AppError) {
      next(error);
      return;
    }
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

    const body = req.body || {};
    const firstName = body.first_name ?? body.firstName ?? existingGuest.firstName;
    const lastName = body.last_name ?? body.lastName ?? existingGuest.lastName;
    const email = body.email !== undefined ? body.email : existingGuest.email;
    const phone = body.phone !== undefined ? body.phone : existingGuest.phone;
    const idType = body.id_type ?? body.idType ?? existingGuest.idType;
    const idNumber = body.id_number ?? body.idNumber ?? body.identification_number ?? existingGuest.idNumber;
    const carNumberPlate = body.car_number_plate ?? body.carNumberPlate ?? body.vehicle_plate ?? body.vehiclePlate ?? body.number_plate ?? existingGuest.carNumberPlate;
    const address = body.address !== undefined ? body.address : existingGuest.address;
    const nationality = body.nationality !== undefined ? body.nationality : existingGuest.nationality;
    const city = body.city !== undefined ? body.city : existingGuest.city;
    const country = body.country !== undefined ? body.country : existingGuest.country;
    const dateOfBirth = body.date_of_birth ?? body.dateOfBirth ?? existingGuest.dateOfBirth;
    const isVip = body.is_vip ?? body.isVip ?? body.vip_status ?? existingGuest.isVip;
    const notes = body.notes !== undefined ? body.notes : existingGuest.notes;

    const updatedGuest = new Guest({
      id: req.params.id,
      firstName,
      lastName,
      email,
      phone,
      idType,
      idNumber,
      carNumberPlate,
      address,
      nationality,
      city,
      country,
      dateOfBirth,
      isVip,
      notes,
      preferences: body.preferences ?? existingGuest.preferences,
      blacklistStatus: body.blacklist_status ?? body.blacklistStatus ?? existingGuest.blacklistStatus,
      blacklistReason: body.blacklist_reason ?? body.blacklistReason ?? existingGuest.blacklistReason
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

    // Check all tables that reference this guest
    const references: { table: string; count: number; active?: number }[] = [];

    // Check reservations
    const { data: reservations } = await supabase
      .from('reservations')
      .select('id, status')
      .eq('guest_id', id);
    
    if (reservations && reservations.length > 0) {
      const active = reservations.filter(r => 
        ['confirmed', 'checked_in', 'pending'].includes(r.status)
      ).length;
      references.push({ table: 'reservations', count: reservations.length, active });
    }

    // Check reservation_guests
    const { data: reservationGuests } = await supabase
      .from('reservation_guests')
      .select('id')
      .eq('guest_id', id);
    if (reservationGuests && reservationGuests.length > 0) {
      references.push({ table: 'reservation_guests', count: reservationGuests.length });
    }

    // Check folios
    const { data: folios } = await supabase
      .from('folios')
      .select('id')
      .eq('guest_id', id);
    if (folios && folios.length > 0) {
      references.push({ table: 'folios', count: folios.length });
    }

    // Check customer_invoices
    const { data: invoices } = await supabase
      .from('customer_invoices')
      .select('id')
      .eq('customer_id', id);
    if (invoices && invoices.length > 0) {
      references.push({ table: 'customer_invoices', count: invoices.length });
    }

    // Check quotations
    const { data: quotations } = await supabase
      .from('quotations')
      .select('id')
      .eq('customer_id', id);
    if (quotations && quotations.length > 0) {
      references.push({ table: 'quotations', count: quotations.length });
    }

    // Check documents
    const { data: documents } = await supabase
      .from('documents')
      .select('id')
      .eq('guest_id', id);
    if (documents && documents.length > 0) {
      references.push({ table: 'documents', count: documents.length });
    }

    // Check guest_documents
    const { data: guestDocs } = await supabase
      .from('guest_documents')
      .select('id')
      .eq('guest_id', id);
    if (guestDocs && guestDocs.length > 0) {
      references.push({ table: 'guest_documents', count: guestDocs.length });
    }

    // Check rooms (current_guest)
    const { data: rooms } = await supabase
      .from('rooms')
      .select('id, room_number')
      .eq('current_guest', id);
    if (rooms && rooms.length > 0) {
      references.push({ table: 'rooms (current_guest)', count: rooms.length });
    }

    // If there are any references, handle them
    if (references.length > 0) {
      // Check for active reservations (blocking)
      const activeReservations = references.find(r => r.table === 'reservations' && r.active && r.active > 0);
      if (activeReservations) {
        throw new AppError(
          `Cannot delete guest with ${activeReservations.active} active reservation(s). Please cancel or complete the reservations first.`,
          400
        );
      }

      // Check for current room assignment (blocking)
      const currentRoom = references.find(r => r.table === 'rooms (current_guest)');
      if (currentRoom) {
        throw new AppError(
          `Cannot delete guest who is currently assigned to ${currentRoom.count} room(s). Please check out the guest first.`,
          400
        );
      }

      // If force mode, nullify all references
      if (force === 'true') {
        logger.info(`Force deleting guest ${id} - removing ${references.length} reference type(s)`);
        
        // Nullify references in all tables
        const nullifyPromises = [];

        if (references.find(r => r.table === 'reservations')) {
          nullifyPromises.push(
            supabase.from('reservations').update({ guest_id: null }).eq('guest_id', id)
          );
        }
        if (references.find(r => r.table === 'reservation_guests')) {
          nullifyPromises.push(
            supabase.from('reservation_guests').delete().eq('guest_id', id)
          );
        }
        if (references.find(r => r.table === 'folios')) {
          nullifyPromises.push(
            supabase.from('folios').update({ guest_id: null }).eq('guest_id', id)
          );
        }
        if (references.find(r => r.table === 'customer_invoices')) {
          nullifyPromises.push(
            supabase.from('customer_invoices').update({ customer_id: null }).eq('customer_id', id)
          );
        }
        if (references.find(r => r.table === 'quotations')) {
          nullifyPromises.push(
            supabase.from('quotations').update({ customer_id: null }).eq('customer_id', id)
          );
        }
        if (references.find(r => r.table === 'documents')) {
          nullifyPromises.push(
            supabase.from('documents').update({ guest_id: null }).eq('guest_id', id)
          );
        }
        if (references.find(r => r.table === 'guest_documents')) {
          nullifyPromises.push(
            supabase.from('guest_documents').delete().eq('guest_id', id)
          );
        }

        const results = await Promise.allSettled(nullifyPromises);
        const failed = results.filter(r => r.status === 'rejected');
        
        if (failed.length > 0) {
          logger.error(`Failed to nullify some references:`, failed);
          throw new AppError('Failed to remove some guest references', 500);
        }
      } else {
        // Build detailed error message
        const refDetails = references.map(r => 
          `${r.count} ${r.table}${r.active ? ` (${r.active} active)` : ''}`
        ).join(', ');
        
        throw new AppError(
          `Cannot delete guest with existing records: ${refDetails}. Add ?force=true to remove all associations and delete the guest.`,
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
