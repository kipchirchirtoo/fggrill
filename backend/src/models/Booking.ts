import { supabase } from '../config/database';
import crypto from 'crypto';

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  CHECKED_OUT = 'checked_out',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show'
}

export interface IBooking {
  id: string;
  confirmationNumber: string;
  guestId: string;
  roomId?: string;
  roomTypeId: string;
  branchId?: string;
  checkInDate: Date;
  checkOutDate: Date;
  status: BookingStatus;

  // Guest Details
  adults: number;
  children: number;
  infants: number;

  // Pricing
  ratePlanId?: string;
  roomRate: number;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  discountAmount: number;
  totalAmount: number;

  // Payment
  depositAmount: number;
  depositPaid: boolean;
  depositPaidAt?: Date;
  paymentMethod?: string;

  // Meta
  bookingSource?: string;
  channelManagerRef?: string;
  mealPlan?: string;
  purpose?: string;
  specialRequests?: string;
  notes?: string;
  internalNotes?: string;

  // Timestamps & Users
  createdBy?: string;
  checkedInAt?: Date;
  checkedInBy?: string;
  checkedOutAt?: Date;
  checkedOutBy?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Booking implements IBooking {
  id: string;
  confirmationNumber: string;
  guestId: string;
  roomId?: string;
  roomTypeId: string;
  branchId?: string;
  checkInDate: Date;
  checkOutDate: Date;
  status: BookingStatus;

  adults: number;
  children: number;
  infants: number;

  ratePlanId?: string;
  roomRate: number;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  discountAmount: number;
  totalAmount: number;

  depositAmount: number;
  depositPaid: boolean;
  depositPaidAt?: Date;
  paymentMethod?: string;

  bookingSource?: string;
  channelManagerRef?: string;
  mealPlan?: string;
  purpose?: string;
  specialRequests?: string;
  notes?: string;
  internalNotes?: string;

  createdBy?: string;
  checkedInAt?: Date;
  checkedInBy?: string;
  checkedOutAt?: Date;
  checkedOutBy?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<IBooking>) {
    this.id = data.id || crypto.randomUUID();
    this.confirmationNumber = data.confirmationNumber || this.generateConfirmationNumber();
    this.guestId = data.guestId || '';
    this.roomId = data.roomId;
    this.roomTypeId = data.roomTypeId || '';
    this.branchId = data.branchId;
    this.checkInDate = data.checkInDate || new Date();
    this.checkOutDate = data.checkOutDate || new Date();
    this.status = data.status || BookingStatus.PENDING;

    this.adults = data.adults || 1;
    this.children = data.children || 0;
    this.infants = data.infants || 0;

    this.ratePlanId = data.ratePlanId;
    this.roomRate = data.roomRate || 0;
    this.subtotal = data.subtotal || 0;
    this.taxAmount = data.taxAmount || 0;
    this.serviceCharge = data.serviceCharge || 0;
    this.discountAmount = data.discountAmount || 0;
    this.totalAmount = data.totalAmount || 0;

    this.depositAmount = data.depositAmount || 0;
    this.depositPaid = data.depositPaid || false;
    this.depositPaidAt = data.depositPaidAt;
    this.paymentMethod = data.paymentMethod;

    this.bookingSource = data.bookingSource || 'WALK_IN';
    this.channelManagerRef = data.channelManagerRef;
    this.mealPlan = data.mealPlan;
    this.purpose = data.purpose;
    this.specialRequests = data.specialRequests;
    this.notes = data.notes;
    this.internalNotes = data.internalNotes;

    this.createdBy = data.createdBy;
    this.checkedInAt = data.checkedInAt;
    this.checkedInBy = data.checkedInBy;
    this.checkedOutAt = data.checkedOutAt;
    this.checkedOutBy = data.checkedOutBy;
    this.cancelledBy = data.cancelledBy;
    this.cancellationReason = data.cancellationReason;
    this.cancelledAt = data.cancelledAt;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  private generateConfirmationNumber(): string {
    return 'RES-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  }

  static async findById(id: string): Promise<Booking | null> {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return Booking.fromDatabase(data);
  }

  static async findByConfirmationNumber(confirmationNumber: string): Promise<Booking | null> {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('confirmation_number', confirmationNumber)
      .single();

    if (error || !data) return null;
    return Booking.fromDatabase(data);
  }

  static async findByGuest(guestId: string): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('guest_id', guestId)
      .order('check_in_date', { ascending: false });

    if (error || !data) return [];
    return data.map(Booking.fromDatabase);
  }

  async save(): Promise<Booking> {
    console.log('Saving booking payload...');
    const { data, error } = await supabase
      .from('reservations')
      .upsert([
        {
          id: this.id,
          confirmation_number: this.confirmationNumber,
          guest_id: this.guestId,
          room_id: this.roomId,
          room_type_id: this.roomTypeId,
          // branch_id: this.branchId, // Column missing in DB
          check_in_date: this.checkInDate,
          check_out_date: this.checkOutDate,
          status: this.status,

          adults: this.adults,
          children: this.children,
          infants: this.infants,

          rate_plan_id: this.ratePlanId,
          room_rate: this.roomRate,
          subtotal: this.subtotal,
          tax_amount: this.taxAmount,
          service_charge: this.serviceCharge,
          discount_amount: this.discountAmount,
          total_amount: this.totalAmount,

          deposit_amount: this.depositAmount,
          deposit_paid: this.depositPaid,
          deposit_paid_at: this.depositPaidAt,
          payment_method: this.paymentMethod,

          // booking_source: this.bookingSource, // Column missing in DB
          // channel_manager_ref: this.channelManagerRef,
          // meal_plan: this.mealPlan,
          // purpose: this.purpose,
          // special_requests: this.specialRequests,
          // notes: this.notes,
          // internal_notes: this.internalNotes,

          created_by: this.createdBy,
          checked_in_at: this.checkedInAt,
          checked_in_by: this.checkedInBy,
          checked_out_at: this.checkedOutAt,
          checked_out_by: this.checkedOutBy,
          cancelled_by: this.cancelledBy,
          cancellation_reason: this.cancellationReason,
          cancelled_at: this.cancelledAt,
          updated_at: new Date()
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return Booking.fromDatabase(data);
  }

  static fromDatabase(data: any): Booking {
    return new Booking({
      id: data.id,
      confirmationNumber: data.confirmation_number,
      guestId: data.guest_id,
      roomId: data.room_id,
      roomTypeId: data.room_type_id,
      branchId: data.branch_id,
      checkInDate: new Date(data.check_in_date),
      checkOutDate: new Date(data.check_out_date),
      status: data.status as BookingStatus,

      adults: data.adults,
      children: data.children,
      infants: data.infants,

      ratePlanId: data.rate_plan_id,
      roomRate: data.room_rate,
      subtotal: data.subtotal,
      taxAmount: data.tax_amount,
      serviceCharge: data.service_charge,
      discountAmount: data.discount_amount,
      totalAmount: data.total_amount,

      depositAmount: data.deposit_amount,
      depositPaid: data.deposit_paid,
      depositPaidAt: data.deposit_paid_at ? new Date(data.deposit_paid_at) : undefined,
      paymentMethod: data.payment_method,

      bookingSource: data.booking_source,
      channelManagerRef: data.channel_manager_ref,
      mealPlan: data.meal_plan,
      purpose: data.purpose,
      specialRequests: data.special_requests,
      notes: data.notes,
      internalNotes: data.internal_notes,

      createdBy: data.created_by,
      checkedInAt: data.checked_in_at ? new Date(data.checked_in_at) : undefined,
      checkedInBy: data.checked_in_by,
      checkedOutAt: data.checked_out_at ? new Date(data.checked_out_at) : undefined,
      checkedOutBy: data.checked_out_by,
      cancelledBy: data.cancelled_by,
      cancellationReason: data.cancellation_reason,
      cancelledAt: data.cancelled_at ? new Date(data.cancelled_at) : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    });
  }
}
