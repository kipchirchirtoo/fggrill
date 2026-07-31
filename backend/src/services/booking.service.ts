import { Booking, BookingStatus, PaymentStatus } from '../models/Booking';
import { Room, RoomStatus } from '../models/Room';
import { Folio } from '../models/Folio';
import { emailService } from './email.service';
import { barcodeGeneratorService } from './barcodeGenerator.service';
import { supabase } from '../config/database';
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
  ratePlanId?: string;
  mealPlanId?: string;
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
  resolvedMealPlan?: string;
  mealPlanId?: string;
  pricingSnapshot?: any;
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
      const { data: booked, error: bookedError } = await supabase
        .from('reservations')
        .select('room_id')
        .not('status', 'in', `(${BookingStatus.CANCELLED},${BookingStatus.CHECKED_OUT})`)
        .lt('check_in_date', checkOutDate)
        .gt('check_out_date', checkInDate);

      if (bookedError) throw bookedError;

      const bookedIds = (booked || []).map(b => b.room_id);

      let roomQuery = supabase
        .from('rooms')
        .select('*')
        .in('status', ['available', 'cleaning']);

      if (branchId) {
        roomQuery = roomQuery.eq('branch_id', branchId);
      }

      if (roomTypeId) {
        roomQuery = roomQuery.eq('room_type_id', roomTypeId);
      }

      if (bookedIds.length > 0) {
        const bookedList = `(${bookedIds.map(id => `"${id}"`).join(',')})`;
        roomQuery = roomQuery.not('id', 'in', bookedList);
      }

      const { data: availableRooms, error } = await roomQuery;

      if (error) {
        logger.error('Database error in checkAvailability:', error);
        throw error;
      }

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
    adults: number = 1,
    children: number = 0,
    mealPlan?: string,
    ratePlanId?: string
  ): Promise<PricingBreakdown> {
    try {
      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkOutDate);
      const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

      let roomRate = 5000;
      let resolvedMealPlan = mealPlan || 'bed_breakfast';
      let resolvedMealPlanId: string | undefined = undefined;
      let snapshot: any = null;

      if (roomTypeId) {
        const { data: roomType } = await supabase
          .from('room_types')
          .select('base_rate, name')
          .eq('id', roomTypeId)
          .maybeSingle();

        if (roomType?.base_rate) {
          roomRate = Number(roomType.base_rate);
        }
      }

      if (ratePlanId) {
        const { data: ratePlan } = await supabase
          .from('rate_plans')
          .select('*, meal_plans(id, code, name)')
          .eq('id', ratePlanId)
          .maybeSingle();

        if (ratePlan) {
          if (ratePlan.rate_per_night) {
            roomRate = Number(ratePlan.rate_per_night);
          }
          if (ratePlan.meal_plan) {
            resolvedMealPlan = String(ratePlan.meal_plan);
          } else if (ratePlan.meal_plans?.code) {
            resolvedMealPlan = String(ratePlan.meal_plans.code).toLowerCase();
          }
          if (ratePlan.meal_plan_id) {
            resolvedMealPlanId = String(ratePlan.meal_plan_id);
          }

          const extraAdults = Math.max(0, adults - 2);
          const extraAdultCost = extraAdults * Number(ratePlan.extra_adult_charge || 0);
          const extraChildren = Math.max(0, children);
          const extraChildCost = extraChildren * Number(ratePlan.extra_child_charge || 0);

          roomRate += extraAdultCost + extraChildCost;

          snapshot = {
            rate_plan_id: ratePlan.id,
            rate_plan_name: ratePlan.name,
            rate_plan_code: ratePlan.code,
            meal_plan: resolvedMealPlan,
            meal_plan_id: resolvedMealPlanId,
            rate_per_night: Number(ratePlan.rate_per_night || roomRate),
            extra_adult_charge: Number(ratePlan.extra_adult_charge || 0),
            extra_child_charge: Number(ratePlan.extra_child_charge || 0),
            extra_bed_charge: Number(ratePlan.extra_bed_charge || 0),
            locked_at: new Date().toISOString()
          };
        }
      }

      const totalAmount = roomRate * nights;
      const baseAmount = totalAmount / 1.26;
      const taxAmount = baseAmount * 0.16;
      const serviceCharge = baseAmount * 0.10;
      const discountAmount = 0;

      return {
        roomRate,
        subtotal: baseAmount,
        taxAmount,
        serviceCharge,
        discountAmount,
        totalAmount,
        nights,
        resolvedMealPlan,
        mealPlanId: resolvedMealPlanId,
        pricingSnapshot: snapshot
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
        const { data: room, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', bookingRequest.roomId)
          .single();

        if (roomError || !room) {
          throw new AppError('Requested room not found', 404);
        }

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
        if (!bookingRequest.branchId && room.branch_id) {
          bookingRequest.branchId = room.branch_id;
        }
      } else {
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

      // Create or find guest
      let guestId = bookingRequest.guestId;
      if (!guestId) {
        guestId = await this.createOrFindGuest(bookingRequest.guestInfo);
      } else {
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

      // Generate unique booking ID
      const confirmationNumber = await Booking.generateBookingNumber();

      // Calculate pricing
      const pricing = await this.calculatePricing(
        bookingRequest.checkInDate,
        bookingRequest.checkOutDate,
        bookingRequest.roomTypeId,
        bookingRequest.adults,
        bookingRequest.children,
        bookingRequest.mealPlan,
        bookingRequest.ratePlanId
      );

      // Create parent booking record
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
          meal_plan: pricing.resolvedMealPlan || bookingRequest.mealPlan,
          special_requests: bookingRequest.specialRequests,
          booking_source: bookingRequest.bookingSource,
          metadata: {
            roomTypeId: bookingRequest.roomTypeId,
            ratePlanId: bookingRequest.ratePlanId,
            mealPlanId: pricing.mealPlanId || bookingRequest.mealPlanId,
            pricingSnapshot: pricing.pricingSnapshot
          }
        }])
        .select('id')
        .single();

      if (bookingRowError || !bookingRow) {
        logger.error('Failed to create parent booking record:', bookingRowError);
        throw new AppError('Failed to create booking', 500);
      }

      // Create reservation
      const booking = new Booking({
        confirmationNumber,
        bookingId: bookingRow.id,
        guestId,
        roomId: selectedRoom.id,
        roomTypeId: bookingRequest.roomTypeId,
        ratePlanId: bookingRequest.ratePlanId,
        mealPlanId: pricing.mealPlanId || bookingRequest.mealPlanId,
        pricingSnapshot: pricing.pricingSnapshot,
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
        mealPlan: pricing.resolvedMealPlan || bookingRequest.mealPlan,
        purpose: bookingRequest.purpose,
        specialRequests: bookingRequest.specialRequests
      });

      const savedBooking = await booking.save();

      // Update room status if check-in is today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkIn = new Date(bookingRequest.checkInDate);
      checkIn.setHours(0, 0, 0, 0);

      if (checkIn.getTime() <= today.getTime()) {
        await this.updateRoomStatus(selectedRoom.id, RoomStatus.RESERVED);
      }

      // Create Folio
      try {
        const folio = new Folio({
          reservationId: savedBooking.id,
          guestId: savedBooking.guestId,
          branchId: savedBooking.branchId,
          status: 'open',
          roomCharges: pricing.totalAmount
        });
        await folio.save();
        logger.info(`Folio created for booking: ${confirmationNumber}`);
      } catch (folioError) {
        logger.error(`Failed to create folio for booking ${confirmationNumber}:`, folioError);
      }

      // Send confirmation email
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

  private async createOrFindGuest(guestInfo: BookingRequest['guestInfo']): Promise<string> {
    try {
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

      const { data: newGuest, error } = await supabase
        .from('guests')
        .insert([{
          first_name: guestInfo.firstName,
          last_name: guestInfo.lastName,
          email: guestInfo.email,
          phone: guestInfo.phone,
          id_type: guestInfo.idType || 'national_id',
          id_number: guestInfo.idNumber,
          nationality: guestInfo.nationality || 'Kenyan',
          address: guestInfo.address
        }])
        .select('id')
        .single();

      if (error || !newGuest) {
        throw new AppError('Failed to create guest record', 500);
      }

      return newGuest.id;
    } catch (error) {
      logger.error('Error creating or finding guest:', error);
      throw error;
    }
  }

  public async updateRoomStatus(
    roomId: string,
    status: RoomStatus,
    userId?: string,
    reason?: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', roomId);

      if (error) throw error;
    } catch (error) {
      logger.error('Error updating room status:', error);
      throw new AppError('Failed to update room status', 500);
    }
  }

  public async modifyBooking(id: string, updates: any, userId?: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error modifying booking:', error);
      throw new AppError('Failed to modify booking', 500);
    }
  }

  public async getBookingByConfirmation(confirmationNumber: string, emailOrBranchId?: string | number): Promise<any> {
    try {
      let query = supabase
        .from('reservations')
        .select('*')
        .eq('confirmation_number', confirmationNumber);

      if (typeof emailOrBranchId === 'number') {
        query = query.eq('branch_id', emailOrBranchId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error fetching booking by confirmation:', error);
      throw new AppError('Failed to fetch booking', 500);
    }
  }

  private async sendBookingConfirmationEmail(booking: Booking, guestInfo: BookingRequest['guestInfo']): Promise<void> {
    try {
      if (!guestInfo?.email) return;

      const bookingDetails = {
        id: booking.id,
        confirmation_number: booking.confirmationNumber,
        guest_name: `${guestInfo.firstName} ${guestInfo.lastName}`.trim(),
        check_in: booking.checkInDate.toISOString().split('T')[0],
        check_out: booking.checkOutDate.toISOString().split('T')[0],
        room_number: 'TBA',
        room_type: 'Standard',
        adults: booking.adults,
        children: booking.children,
        total_amount: booking.totalAmount,
        room_rate: booking.roomRate,
        subtotal: booking.subtotal,
        tax_amount: booking.taxAmount,
        service_charge: booking.serviceCharge,
        deposit_paid: booking.depositPaid,
        payment_method: booking.paymentMethod,
        special_requests: booking.specialRequests
      };

      await emailService.sendBookingConfirmation(guestInfo.email, bookingDetails);
    } catch (error) {
      logger.error('Error sending confirmation email:', error);
    }
  }
}

export const bookingService = new BookingService();
