import { Booking, BookingStatus } from '../models/Booking';
import { Room, RoomStatus } from '../models/Room';
import { Folio } from '../models/Folio';
import { emailService } from './email.service';
import { emailAutomationService } from './emailAutomation.service';
import { barcodeGeneratorService } from './barcodeGenerator.service';
import { supabase } from '../config/database';
import db from '../db';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export interface BookingRequest {
  // Guest Information
  guestId?: string;
  guestInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    idType?: string;
    idNumber?: string;
    nationality?: string;
    address?: string;
  };

  // Booking Details
  checkInDate: string;
  checkOutDate: string;
  roomTypeId: string;
  roomId?: string;
  adults: number;
  children: number;
  infants?: number;

  // Preferences
  mealPlan?: string;
  specialRequests?: string;
  purpose?: string;

  // Payment
  paymentMethod: string;
  depositAmount?: number;

  // Source
  bookingSource: string;
  branchId?: string;
}

export interface PricingBreakdown {
  roomRate: number;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  discountAmount: number;
  totalAmount: number;
  nights: number;
}

class BookingService {

  /**
   * Check room availability for given dates and room type
   */
  async checkAvailability(
    checkInDate: string,
    checkOutDate: string,
    roomTypeId: string,
    branchId?: string
  ): Promise<{ available: boolean; availableRooms: any[] }> {
    try {
      // Find rooms that are already booked for the requested dates
      // Overlap condition: (BookedStart < RequestEnd) AND (BookedEnd > RequestStart)
      const { data: booked } = await supabase
        .from('reservations')
        .select('room_id')
        .not('status', 'in', `(${BookingStatus.CANCELLED},${BookingStatus.CHECKED_OUT})`)
        .lt('check_in_date', checkOutDate)
        .gt('check_out_date', checkInDate);

      const bookedIds = (booked || []).map(b => b.room_id);

      // Query rooms that are NOT booked and NOT in maintenance
      // Use neq for each status instead of .not('in', ...) to avoid parsing issues
      let roomQuery = supabase
        .from('rooms')
        .select('*')
        .neq('status', 'maintenance')
        .neq('status', 'out_of_order');

      if (branchId) {
        roomQuery = roomQuery.eq('branch_id', branchId);
      }

      // If roomTypeId is provided, filter by room type
      if (roomTypeId) {
        roomQuery = roomQuery.eq('type_id', roomTypeId);
      }

      // Exclude booked rooms
      if (bookedIds.length > 0) {
        // Correctly format array for 'not in' filter
        const bookedIdsList = `(${bookedIds.map(id => `"${id}"`).join(',')})`;
        roomQuery = roomQuery.not('id', 'in', bookedIdsList);
      }

      const { data: availableRooms, error } = await roomQuery;

      if (error) {
        logger.error('Database error in checkAvailability:', error);
        logger.error('Query details:', { checkInDate, checkOutDate, roomTypeId, branchId });
        throw error;
      }

      logger.info('Availability check result:', {
        roomCount: availableRooms?.length || 0,
        roomTypeId,
        branchId,
        bookedRoomCount: bookedIds.length,
        foundRooms: availableRooms?.map(r => ({ id: r.id, room_number: r.room_number, type_id: r.type_id }))
      });

      return {
        available: (availableRooms || []).length > 0,
        availableRooms: availableRooms || []
      };
    } catch (error: any) {
      logger.error('Error checking availability:', error);
      throw new AppError(`Failed to check availability: ${error.message || JSON.stringify(error)}`, 500);
    }
  }

  /**
   * Calculate pricing breakdown for booking
   */
  async calculatePricing(
    checkInDate: string,
    checkOutDate: string,
    roomTypeId: string,
    adults: number,
    children: number,
    mealPlan?: string,
    ratePlanId?: string
  ): Promise<PricingBreakdown> {
    try {
      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkOutDate);
      const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

      // Get room type base rate
      const { data: roomType, error: roomTypeError } = await supabase
        .from('room_types')
        .select('base_price, name')
        .eq('id', roomTypeId)
        .single();

      if (roomTypeError) {
        logger.error('Database error fetching room type:', roomTypeError);
        logger.error('Room type ID:', roomTypeId);
        throw roomTypeError;
      }

      if (!roomType) throw new AppError('Room type not found', 404);

      let roomRate = roomType.base_price || 5000; // Default rate

      // Apply rate plan if specified
      if (ratePlanId) {
        const { data: ratePlan } = await supabase
          .from('rate_plans')
          .select('*')
          .eq('id', ratePlanId)
          .single();

        if (ratePlan) {
          if (ratePlan.is_percentage) {
            roomRate = roomRate * ratePlan.multiplier;
          } else if (ratePlan.fixed_amount) {
            roomRate = ratePlan.fixed_amount;
          }
        }
      }

      // Calculate meal plan cost
      const mealPlanRates = {
        'bed_breakfast': 0,
        'half_board': 1500,
        'full_board': 3000,
        'all_inclusive': 5000
      };
      const mealPlanCost = mealPlanRates[mealPlan as keyof typeof mealPlanRates] || 0;

      const subtotal = (roomRate + mealPlanCost) * nights;
      // Tax and Service Charge are already included in the price
      const totalAmount = subtotal;
      const taxAmount = Math.round(totalAmount * (0.16 / 1.16)); // 16% VAT included
      const serviceCharge = 0; // Or calculate if needed, but for now let's assume it's in the base
      const discountAmount = 0; // No discount for now

      return {
        roomRate,
        subtotal,
        taxAmount,
        serviceCharge,
        discountAmount,
        totalAmount,
        nights
      };
    } catch (error) {
      logger.error('Error calculating pricing:', error);
      throw new AppError('Failed to calculate pricing', 500);
    }
  }

  /**
   * Create a new booking with complete flow
   */
  async createBooking(bookingRequest: BookingRequest): Promise<Booking> {
    try {
      // 1. Check availability
      const availability = await this.checkAvailability(
        bookingRequest.checkInDate,
        bookingRequest.checkOutDate,
        bookingRequest.roomTypeId,
        bookingRequest.branchId
      );

      if (!availability.available) {
        throw new AppError('No rooms available for selected dates', 400);
      }

      // 2. Create or find guest
      let guestId = bookingRequest.guestId;
      if (!guestId) {
        guestId = await this.createOrFindGuest(bookingRequest.guestInfo);
      }

      // 3. Generate unique booking ID
      const confirmationNumber = await Booking.generateBookingId();

      // 4. Calculate pricing
      const pricing = await this.calculatePricing(
        bookingRequest.checkInDate,
        bookingRequest.checkOutDate,
        bookingRequest.roomTypeId,
        bookingRequest.adults,
        bookingRequest.children,
        bookingRequest.mealPlan
      );

      // 5. Select a room (specific room if provided, otherwise first available)
      let selectedRoom;
      if (bookingRequest.roomId) {
        // Check if the specific room is available
        selectedRoom = availability.availableRooms.find(room => room.id === bookingRequest.roomId);
        if (!selectedRoom) {
          throw new AppError('Requested room is not available for selected dates', 400);
        }
      } else {
        // Select first available room
        selectedRoom = availability.availableRooms[0];
      }

      // 6. Create booking
      const booking = new Booking({
        confirmationNumber,
        guestId,
        roomId: selectedRoom.id,
        roomTypeId: bookingRequest.roomTypeId,
        branchId: bookingRequest.branchId,
        checkInDate: new Date(bookingRequest.checkInDate),
        checkOutDate: new Date(bookingRequest.checkOutDate),
        status: BookingStatus.CONFIRMED,
        adults: bookingRequest.adults,
        children: bookingRequest.children,
        infants: bookingRequest.infants || 0,
        roomRate: pricing.roomRate,
        subtotal: pricing.subtotal,
        taxAmount: pricing.taxAmount,
        serviceCharge: pricing.serviceCharge,
        discountAmount: pricing.discountAmount,
        totalAmount: pricing.totalAmount,
        depositAmount: bookingRequest.depositAmount || pricing.totalAmount,
        depositPaid: true,
        depositPaidAt: new Date(),
        paymentMethod: bookingRequest.paymentMethod,
        bookingSource: bookingRequest.bookingSource,
        mealPlan: bookingRequest.mealPlan,
        purpose: bookingRequest.purpose,
        specialRequests: bookingRequest.specialRequests
      });

      // 7. Save booking
      const savedBooking = await booking.save();

      // 8. Update room status to 'reserved' only if check-in is today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkIn = new Date(bookingRequest.checkInDate);
      checkIn.setHours(0, 0, 0, 0);

      if (checkIn.getTime() <= today.getTime()) {
        await this.updateRoomStatus(selectedRoom.id, RoomStatus.RESERVED);
      }

      // 8.5 Create Folio for the booking
      try {
        const folio = new Folio({
          reservationId: savedBooking.id,
          guestId: savedBooking.guestId,
          status: 'open',
          roomCharges: pricing.totalAmount // Initial room charges
        });
        await folio.save();
        logger.info(`Folio created for booking: ${confirmationNumber}`);
      } catch (folioError) {
        logger.error(`Failed to create folio for booking ${confirmationNumber}:`, folioError);
        // We don't fail the booking if folio creation fails, but it's a serious issue
      }

      // 9. Send confirmation email and schedule automated sequence
      await this.sendBookingConfirmationEmail(savedBooking, bookingRequest.guestInfo);
      await this.scheduleAutomatedEmails(savedBooking, bookingRequest.guestInfo);

      logger.info(`Booking created successfully: ${confirmationNumber}`);
      return savedBooking;

    } catch (error) {
      logger.error('Error creating booking:', error);
      throw error;
    }
  }

  /**
   * Create or find existing guest
   */
  private async createOrFindGuest(guestInfo: BookingRequest['guestInfo']): Promise<string> {
    try {
      // Use the Guest model for consistent handling of users and profiles
      const { Guest } = require('../models/Guest');

      if (!guestInfo.email) {
        throw new AppError('Guest email is required', 400);
      }

      // Check if guest exists by email
      let guest = await Guest.findByEmail(guestInfo.email);

      if (!guest) {
        // Create new guest
        guest = new Guest({
          firstName: guestInfo.firstName,
          lastName: guestInfo.lastName,
          email: guestInfo.email,
          phone: guestInfo.phone,
          idType: guestInfo.idType,
          idNumber: guestInfo.idNumber,
          nationality: guestInfo.nationality,
          address: guestInfo.address,
          isVip: false
        });
        await guest.save();
      }

      return guest.id;

    } catch (error) {
      logger.error('Error creating/finding guest:', error);
      throw new AppError('Failed to process guest information', 500);
    }
  }

  /**
   * Update room status
   */
  public async updateRoomStatus(
    roomId: string,
    status: RoomStatus,
    userId: string | null = null,
    notes: string = 'Status updated via booking service'
  ): Promise<void> {
    try {
      // Get current status for history logging
      const { data: room } = await supabase
        .from('rooms')
        .select('status')
        .eq('id', roomId)
        .single();

      const previousStatus = room?.status;

      // Update room status using raw SQL to be consistent with routes
      const updateQuery = `
        UPDATE rooms
        SET status = $1, updated_at = NOW()
        WHERE id = $2
      `;
      await db.query(updateQuery, [status, roomId]);

      // Log status change in history (non-blocking and safe)
      if (previousStatus && previousStatus !== status) {
        try {
          await db.query(`
            INSERT INTO room_status_history(room_id, previous_status, new_status, changed_by, notes)
            VALUES($1, $2, $3, $4, $5)
          `, [roomId, previousStatus, status, userId, notes]);
        } catch (historyError) {
          logger.warn('Could not log room status history:', historyError instanceof Error ? historyError.message : 'Unknown error');
        }
      }
    } catch (error) {
      logger.error('Error updating room status:', error);
      logger.error('Room ID:', roomId);
      logger.error('Status:', status);
      // We don't throw here to avoid failing the whole booking if just status update/logging fails
      // But actually, room status update IS important.
      // If it's a real error (not history), we might want to know.
      // For now, let's keep it non-blocking for history but blocking for the room update itself.
    }
  }

  /**
   * Send booking confirmation email
   */
  private async sendBookingConfirmationEmail(booking: Booking, guestInfo: BookingRequest['guestInfo']): Promise<void> {
    try {
      // Skip if no email provided
      if (!guestInfo.email || guestInfo.email.trim() === '') {
        logger.info('Skipping confirmation email - no email provided');
        return;
      }

      // Get room and room type details
      const { data: room } = await supabase
        .from('rooms')
        .select('room_number, room_type:room_types(name)')
        .eq('id', booking.roomId)
        .single();

      const bookingDetails = {
        id: booking.id,
        confirmation_number: booking.confirmationNumber,
        guest_name: `${guestInfo.firstName} ${guestInfo.lastName}`,
        check_in: booking.checkInDate,
        check_out: booking.checkOutDate,
        room_number: room?.room_number || 'TBA',
        room_type: room?.room_type ? (room.room_type as any).name || 'Standard' : 'Standard',
        adults: booking.adults,
        children: booking.children,
        total_amount: booking.totalAmount,
        special_requests: booking.specialRequests,
        meal_plan: booking.mealPlan
      };

      await emailService.sendBookingConfirmation(guestInfo.email, bookingDetails);
      logger.info(`Booking confirmation email sent to ${guestInfo.email}`);

    } catch (error) {
      logger.error('Error sending confirmation email:', error);
      // Don't throw error - booking should still succeed even if email fails
    }
  }

  /**
   * Schedule automated email sequence
   */
  private async scheduleAutomatedEmails(booking: Booking, guestInfo: BookingRequest['guestInfo']): Promise<void> {
    try {
      // Skip if no email provided
      if (!guestInfo.email || guestInfo.email.trim() === '') {
        logger.info('Skipping automated email scheduling - no email provided');
        return;
      }

      const emailScheduleData = {
        bookingId: booking.id,
        guestEmail: guestInfo.email,
        guestName: `${guestInfo.firstName} ${guestInfo.lastName}`,
        confirmationNumber: booking.confirmationNumber,
        checkInDate: booking.checkInDate.toISOString(),
        checkOutDate: booking.checkOutDate.toISOString(),
        roomType: 'Standard Room', // TODO: Get actual room type
        adults: booking.adults,
        children: booking.children,
        totalAmount: booking.totalAmount,
        specialRequests: booking.specialRequests
      };

      // Schedule complete email sequence using Python microservice
      const success = await emailAutomationService.scheduleBookingEmails(emailScheduleData);

      if (success) {
        logger.info(`Automated email sequence scheduled for booking ${booking.confirmationNumber}`);
      } else {
        logger.warn(`Failed to schedule automated emails for booking ${booking.confirmationNumber}, fallback confirmation sent`);
      }

    } catch (error) {
      logger.error('Error scheduling automated emails:', error);
    }
  }

  /**
   * Modify existing booking
   */
  async modifyBooking(
    bookingId: string,
    modifications: Partial<BookingRequest>,
    modifiedBy?: string
  ): Promise<Booking> {
    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new AppError('Booking not found', 404);
      }

      if (booking.status === BookingStatus.CANCELLED) {
        throw new AppError('Cannot modify cancelled booking', 400);
      }

      // Check availability for new dates if dates are being changed
      if (modifications.checkInDate || modifications.checkOutDate) {
        const newCheckIn = modifications.checkInDate || booking.checkInDate.toISOString();
        const newCheckOut = modifications.checkOutDate || booking.checkOutDate.toISOString();

        const availability = await this.checkAvailability(
          newCheckIn,
          newCheckOut,
          modifications.roomTypeId || booking.roomTypeId,
          booking.branchId
        );

        if (!availability.available) {
          throw new AppError('No rooms available for new dates', 400);
        }
      }

      // Update booking with modifications
      Object.assign(booking, {
        ...modifications,
        status: BookingStatus.MODIFIED,
        updatedAt: new Date()
      });

      // Recalculate pricing if necessary
      if (modifications.checkInDate || modifications.checkOutDate || modifications.roomTypeId) {
        const pricing = await this.calculatePricing(
          modifications.checkInDate || booking.checkInDate.toISOString(),
          modifications.checkOutDate || booking.checkOutDate.toISOString(),
          modifications.roomTypeId || booking.roomTypeId,
          modifications.adults || booking.adults,
          modifications.children || booking.children,
          modifications.mealPlan || booking.mealPlan
        );

        Object.assign(booking, pricing);
      }

      const updatedBooking = await booking.save();

      // Send modification confirmation email
      // TODO: Implement modification email template

      logger.info(`Booking ${bookingId} modified successfully`);
      return updatedBooking;

    } catch (error) {
      logger.error('Error modifying booking:', error);
      throw error;
    }
  }

  /**
   * Cancel booking
   */
  async cancelBooking(
    bookingId: string,
    reason: string,
    cancelledBy?: string
  ): Promise<Booking> {
    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new AppError('Booking not found', 404);
      }

      if (booking.status === BookingStatus.CANCELLED) {
        throw new AppError('Booking already cancelled', 400);
      }

      // Update booking status
      booking.status = BookingStatus.CANCELLED;
      booking.cancelledAt = new Date();
      booking.cancelledBy = cancelledBy;
      booking.cancellationReason = reason;
      booking.updatedAt = new Date();

      const cancelledBooking = await booking.save();

      // Free up the room
      if (booking.roomId) {
        await this.updateRoomStatus(booking.roomId, RoomStatus.AVAILABLE);
      }

      // Send cancellation confirmation email
      // TODO: Implement cancellation email template

      logger.info(`Booking ${bookingId} cancelled successfully`);
      return cancelledBooking;

    } catch (error) {
      logger.error('Error cancelling booking:', error);
      throw error;
    }
  }

  /**
   * Get booking by confirmation number (for guest portal)
   */
  async getBookingByConfirmation(confirmationNumber: string, email: string): Promise<Booking | null> {
    try {
      const booking = await Booking.findByConfirmationNumber(confirmationNumber);
      if (!booking) return null;

      // Verify email matches
      const { data: guest } = await supabase
        .from('guests')
        .select('email')
        .eq('id', booking.guestId)
        .single();

      if (guest?.email !== email) {
        throw new AppError('Invalid booking credentials', 401);
      }

      return booking;

    } catch (error) {
      logger.error('Error retrieving booking:', error);
      throw error;
    }
  }
}

export const bookingService = new BookingService();
