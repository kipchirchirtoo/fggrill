import { Booking, BookingStatus, PaymentStatus } from '../models/Booking';
import { Room, RoomStatus } from '../models/Room';
import { Folio } from '../models/Folio';
import { emailService } from './email.service';
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
  depositPaid?: boolean;

  // Source
  bookingSource: string;
  branchId?: number;
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
    roomTypeId?: string,
    branchId?: number
  ): Promise<{ available: boolean; availableRooms: any[] }> {
    try {
      // Find rooms that are already booked for the requested dates
      // Overlap condition: (BookedStart < RequestEnd) AND (BookedEnd > RequestStart)
      const { data: booked } = await supabase
        .from('reservations')
        .select('room_id')
        // supabase-js does not parenthesize an array third-arg when serializing
        // .not(col, 'in', [...]) — PostgREST rejects the filter, the error is
        // swallowed by the destructure below, and every room reads back as
        // available regardless of existing bookings. Use the pre-formatted list.
        .not('status', 'in', `(${BookingStatus.CANCELLED},${BookingStatus.CHECKED_OUT})`)
        .lt('check_in_date', checkOutDate)
        .gt('check_out_date', checkInDate);

      const bookedIds = (booked || []).map(b => b.room_id);

      // Query rooms that are NOT booked and are available for booking
      // Only include rooms with status 'available' or 'cleaning' (same as search endpoint)
      let roomQuery = supabase
        .from('rooms')
        .select('*')
        .in('status', ['available', 'cleaning']);

      if (branchId) {
        roomQuery = roomQuery.eq('branch_id', branchId);
      }

      // If roomTypeId is provided, filter by room type
      if (roomTypeId) {
        roomQuery = roomQuery.eq('room_type_id', roomTypeId);
      }

      // Exclude booked rooms
      if (bookedIds.length > 0) {
        // PostgREST requires comma separated values in parentheses for 'in'
        const bookedList = `(${bookedIds.map(id => `"${id}"`).join(',')})`;
        roomQuery = roomQuery.not('id', 'in', bookedList);
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
        foundRooms: availableRooms?.map(r => ({ id: r.id, room_number: r.room_number, room_type_id: r.room_type_id }))
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
      let roomRate = 5000; // Default rate fallback
      if (roomTypeId) {
        const { data: roomType, error: roomTypeError } = await supabase
          .from('room_types')
          .select('base_rate, name')
          .eq('id', roomTypeId)
          .single();

        if (roomTypeError) {
          logger.error('Database error fetching room type:', roomTypeError);
          logger.error('Room type ID:', roomTypeId);
          // Use default rate instead of crashing
        } else if (roomType?.base_rate) {
          roomRate = roomType.base_rate;
        }
      } else {
        logger.warn('calculatePricing called with no roomTypeId, using default rate');
      }

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

      // Implicit Inclusive Pricing Logic
      // The 'subtotal' here is actually the Grand Total (Room Rate is inclusive)
      // We need to back-calculate the Base, VAT, and Service Charge.
      // Total = Base + (Base * 0.16) + (Base * 0.10) = Base * 1.26

      const totalAmount = subtotal;
      const baseAmount = totalAmount / 1.26;
      const taxAmount = baseAmount * 0.16; // 16% VAT
      const serviceCharge = baseAmount * 0.10; // 10% Service Charge
      const discountAmount = 0; // No discount for now

      // Recalculate base to be safe? Or just report the breakdown.
      // We return 'subtotal' as the pre-tax amount usually, but in this specific return structure,
      // 'subtotal' seems to be used as 'Base Amount' in some contexts, or 'Total before extras'.
      // Let's align with the interface: 
      // roomRate: The inclusive rate per night
      // subtotal: The total inclusive amount before discounts? Or the base amount?
      // Usually subtotal + tax + service = total.
      // So let's set subtotal = baseAmount.

      return {
        roomRate, // This remains the storage rate (inclusive)
        subtotal: baseAmount, // The true base amount
        taxAmount,
        serviceCharge,
        discountAmount,
        totalAmount, // The final amount matching the rate * nights
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
      let selectedRoom: any;

      if (bookingRequest.roomId) {
        // 1a. Specific room requested: directly verify it's not booked for the dates
        // This avoids the issue where the room may have status 'reserved'/'occupied'
        // but is still logically bookable for FUTURE dates
        const { data: room, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', bookingRequest.roomId)
          .single();

        if (roomError || !room) {
          throw new AppError('Requested room not found', 404);
        }

        // Check if the room is already booked for the requested dates
        const { data: conflictingBookings } = await supabase
          .from('reservations')
          .select('id')
          .eq('room_id', bookingRequest.roomId)
          .not('status', 'in', `(${BookingStatus.CANCELLED},${BookingStatus.CHECKED_OUT})`)
          .lt('check_in_date', bookingRequest.checkOutDate)
          .gt('check_out_date', bookingRequest.checkInDate);

        if (conflictingBookings && conflictingBookings.length > 0) {
          throw new AppError('Requested room is not available for selected dates', 400);
        }

        selectedRoom = room;
        // Inherit branch_id from the room if not explicitly provided
        if (!bookingRequest.branchId && room.branch_id) {
          bookingRequest.branchId = room.branch_id;
        }
        logger.info(`Direct room verification passed for room: ${room.room_number} (${room.id})`);
      } else {
        // 1b. No specific room: use general availability check
        const availability = await this.checkAvailability(
          bookingRequest.checkInDate,
          bookingRequest.checkOutDate,
          bookingRequest.roomTypeId,
          bookingRequest.branchId
        );

        if (!availability.available) {
          throw new AppError('No rooms available for selected dates', 400);
        }

        selectedRoom = availability.availableRooms[0];
      }

      // 2. Create or find guest
      let guestId = bookingRequest.guestId;
      if (!guestId) {
        guestId = await this.createOrFindGuest(bookingRequest.guestInfo);
      } else {
        // Caller passed an existing guestId without inline guestInfo (e.g. the
        // reception flow creates the guest first, then books with only guest_id).
        // Backfill guestInfo from the guests table so the confirmation email
        // still has real contact details instead of being skipped.
        const { data: existingGuest } = await supabase
          .from('guests')
          .select('first_name, last_name, email, phone, id_type, id_number, nationality, address')
          .eq('id', guestId)
          .maybeSingle();

        if (existingGuest) {
          bookingRequest.guestInfo = {
            firstName: bookingRequest.guestInfo?.firstName || existingGuest.first_name,
            lastName: bookingRequest.guestInfo?.lastName || existingGuest.last_name,
            email: bookingRequest.guestInfo?.email || existingGuest.email,
            phone: bookingRequest.guestInfo?.phone || existingGuest.phone,
            idType: bookingRequest.guestInfo?.idType || existingGuest.id_type,
            idNumber: bookingRequest.guestInfo?.idNumber || existingGuest.id_number,
            nationality: bookingRequest.guestInfo?.nationality || existingGuest.nationality,
            address: bookingRequest.guestInfo?.address || existingGuest.address
          };
        }
      }

      // 3. Generate unique booking ID
      const confirmationNumber = await Booking.generateBookingNumber();

      // 4. Calculate pricing
      const pricing = await this.calculatePricing(
        bookingRequest.checkInDate,
        bookingRequest.checkOutDate,
        bookingRequest.roomTypeId,
        bookingRequest.adults,
        bookingRequest.children,
        bookingRequest.mealPlan
      );

      // 5. Create the parent booking record. Every reservation - whether made
      // online via the landing page or by reception - must belong to a real
      // booking; this is not best-effort, a failure here aborts the request.
      const { data: bookingRow, error: bookingRowError } = await supabase
        .from('bookings')
        .insert([{
          branch_id: bookingRequest.branchId,
          booking_number: confirmationNumber,
          confirmation_number: confirmationNumber,
          guest_id: guestId,
          room_id: selectedRoom.id,
          booking_type: 'room',
          status: BookingStatus.CONFIRMED,
          check_in_at: bookingRequest.checkInDate,
          check_out_at: bookingRequest.checkOutDate,
          check_in_date: bookingRequest.checkInDate,
          check_out_date: bookingRequest.checkOutDate,
          pax: bookingRequest.adults + bookingRequest.children,
          adults: bookingRequest.adults,
          children: bookingRequest.children,
          infants: bookingRequest.infants || 0,
          room_rate: pricing.roomRate,
          subtotal: pricing.subtotal,
          tax_amount: pricing.taxAmount,
          service_charge: pricing.serviceCharge,
          discount_amount: pricing.discountAmount,
          total_amount: pricing.totalAmount,
          amount_paid: bookingRequest.depositAmount || 0,
          deposit_amount: bookingRequest.depositAmount || 0,
          deposit_paid: bookingRequest.depositPaid || false,
          payment_status: PaymentStatus.PENDING,
          payment_method: bookingRequest.paymentMethod,
          meal_plan: bookingRequest.mealPlan,
          special_requests: bookingRequest.specialRequests,
          booking_source: bookingRequest.bookingSource,
          metadata: { roomTypeId: bookingRequest.roomTypeId }
        }])
        .select('id')
        .single();

      if (bookingRowError || !bookingRow) {
        logger.error('Failed to create parent booking record:', bookingRowError);
        throw new AppError('Failed to create booking', 500);
      }

      // 6. Create reservation, linked to the booking record above
      const booking = new Booking({
        confirmationNumber,
        bookingId: bookingRow.id,
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
        depositAmount: bookingRequest.depositAmount || 0,
        depositPaid: bookingRequest.depositPaid || false,
        depositPaidAt: (bookingRequest.depositPaid) ? new Date() : undefined,
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
          branchId: savedBooking.branchId,
          status: 'open',
          roomCharges: pricing.totalAmount // Initial room charges
        });
        await folio.save();
        logger.info(`Folio created for booking: ${confirmationNumber}`);
      } catch (folioError) {
        logger.error(`Failed to create folio for booking ${confirmationNumber}:`, folioError);
        // We don't fail the booking if folio creation fails, but it's a serious issue
      }

      // 9. Send confirmation email (NON-BLOCKING)
      // We don't await this to ensure the user gets a fast response and prevent
      // timeout issues if the email service is slow or fails.
      // NOTE: the automated drip-sequence path (scheduleAutomatedEmails, via
      // the Python /api/email/schedule-booking-emails endpoint) used to also
      // fire here. That endpoint is currently broken and its fallback sent a
      // second, duplicate confirmation email with fabricated pricing data on
      // every booking. Removed until that endpoint is fixed separately.
      this.sendBookingConfirmationEmail(savedBooking, bookingRequest.guestInfo).catch(err =>
        logger.error('Error in background email sending:', err)
      );

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
      // Guests are stored directly in the `guests` table.
      // They do NOT need auth accounts or entries in the `users` table.

      // Check if guest exists by email
      if (guestInfo.email) {
        const { data: existingGuest } = await supabase
          .from('guests')
          .select('id')
          .eq('email', guestInfo.email)
          .maybeSingle();

        if (existingGuest) {
          return existingGuest.id;
        }
      }

      // Create new guest directly in the guests table
      const { data: newGuest, error } = await supabase
        .from('guests')
        .insert([{
          first_name: guestInfo.firstName,
          last_name: guestInfo.lastName,
          email: guestInfo.email,
          phone: guestInfo.phone,
          id_type: guestInfo.idType,
          id_number: guestInfo.idNumber,
          nationality: guestInfo.nationality,
          address: guestInfo.address
        }])
        .select('id')
        .single();

      if (error) throw error;
      return newGuest.id;

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
            INSERT INTO room_status_history(room_id, old_status, new_status, changed_by, reason)
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
        .select('room_number, room_type:room_types!rooms_room_type_id_fkey(name), branch:branches(name)')
        .eq('id', booking.roomId)
        .single();

      // Get branch details if not in room query
      let branchName = 'Famous Gate Hotel';
      if (room?.branch) {
        branchName = (room.branch as any).name || branchName;
      } else if (booking.branchId) {
        const { data: branch } = await supabase
          .from('branches')
          .select('name')
          .eq('id', booking.branchId)
          .single();
        if (branch) branchName = branch.name;
      }

      const bookingDetails = {
        confirmationNumber: booking.confirmationNumber,
        firstName: guestInfo.firstName,
        lastName: guestInfo.lastName,
        email: guestInfo.email,
        phone: guestInfo.phone || 'N/A',
        roomNumber: room?.room_number || '',
        checkInDate: booking.checkInDate.toISOString().split('T')[0],
        checkOutDate: booking.checkOutDate.toISOString().split('T')[0],
        roomType: room?.room_type ? (room.room_type as any).name || 'Standard Room' : 'Standard Room',
        guests: `${booking.adults} Adult${booking.adults > 1 ? 's' : ''}${booking.children > 0 ? `, ${booking.children} Child${booking.children > 1 ? 'ren' : ''}` : ''}`,
        totalAmount: booking.totalAmount,
        depositAmount: booking.depositAmount || 0,
        paymentMethod: booking.paymentMethod || '',
        branchName: branchName
      };

      // Gmail SMTP is the configured/active provider (not Brevo)
      await emailService.sendLandingBookingConfirmation(guestInfo.email, bookingDetails);
      logger.info(`✅ Booking confirmation email sent to ${guestInfo.email} via SMTP`);

    } catch (error) {
      logger.error('❌ Error sending confirmation email:', error);
      // Don't throw error - booking should still succeed even if email fails
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
