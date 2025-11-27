import { supabase } from '../config/database';
import { RoomType } from './Room';
import crypto from 'crypto';

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked-in',
  CHECKED_OUT = 'checked-out',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no-show'
}

export interface IBookingGuest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  idType?: string;
  idNumber?: string;
  nationality?: string;
  specialRequests?: string[];
}

export interface IPayment {
  id: string;
  amount: number;
  method: 'cash' | 'card' | 'bank-transfer' | 'mobile-money';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  transactionId?: string;
  paidAt?: Date;
  refundedAt?: Date;
  notes?: string;
}

export interface IBooking {
  id: string;
  bookingNumber: string;
  guest: IBookingGuest;
  userId?: string;
  roomType: RoomType;
  roomNumber?: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  adults: number;
  children: number;
  status: BookingStatus;
  basePrice: number;
  taxes: number;
  totalAmount: number;
  deposit?: number;
  depositPaid?: boolean;
  payments: IPayment[];
  specialRequests?: string[];
  notes?: string;
  source: 'direct' | 'website' | 'phone' | 'email' | 'walk-in' | 'agent';
  cancellationReason?: string;
  cancellationDate?: Date;
  noShowDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Booking implements IBooking {
  id: string;
  bookingNumber: string;
  guest: IBookingGuest;
  userId?: string;
  roomType: RoomType;
  roomNumber?: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  adults: number;
  children: number;
  status: BookingStatus;
  basePrice: number;
  taxes: number;
  totalAmount: number;
  deposit?: number;
  depositPaid?: boolean;
  payments: IPayment[];
  specialRequests?: string[];
  notes?: string;
  source: 'direct' | 'website' | 'phone' | 'email' | 'walk-in' | 'agent';
  cancellationReason?: string;
  cancellationDate?: Date;
  noShowDate?: Date;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<IBooking>) {
    this.id = data.id || crypto.randomUUID();
    this.bookingNumber = data.bookingNumber || '';
    this.guest = data.guest || { firstName: '', lastName: '', email: '', phone: '' };
    this.userId = data.userId;
    this.roomType = data.roomType || RoomType.STANDARD;
    this.roomNumber = data.roomNumber;
    this.checkIn = data.checkIn || new Date();
    this.checkOut = data.checkOut || new Date();
    this.nights = data.nights || 1;
    this.adults = data.adults || 1;
    this.children = data.children || 0;
    this.status = data.status || BookingStatus.PENDING;
    this.basePrice = data.basePrice || 0;
    this.taxes = data.taxes || 0;
    this.totalAmount = data.totalAmount || 0;
    this.deposit = data.deposit;
    this.depositPaid = data.depositPaid;
    this.payments = data.payments || [];
    this.specialRequests = data.specialRequests;
    this.notes = data.notes;
    this.source = data.source || 'direct';
    this.cancellationReason = data.cancellationReason;
    this.cancellationDate = data.cancellationDate;
    this.noShowDate = data.noShowDate;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  static async findById(id: string): Promise<Booking | null> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return new Booking(data);
  }

  static async findByNumber(bookingNumber: string): Promise<Booking | null> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('booking_number', bookingNumber)
      .single();

    if (error || !data) return null;
    return new Booking(data);
  }

  static async findByGuest(email: string): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('guest->email', email)
      .order('check_in', { ascending: false });

    if (error || !data) return [];
    return data.map(booking => new Booking(booking));
  }

  static async findByDateRange(startDate: Date, endDate: Date): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .gte('check_in', startDate.toISOString())
      .lte('check_out', endDate.toISOString())
      .order('check_in', { ascending: true });

    if (error || !data) return [];
    return data.map(booking => new Booking(booking));
  }

  static async findByStatus(status: BookingStatus): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('status', status)
      .order('check_in', { ascending: true });

    if (error || !data) return [];
    return data.map(booking => new Booking(booking));
  }

  async save(): Promise<Booking> {
    const { data, error } = await supabase
      .from('bookings')
      .upsert([
        {
          id: this.id,
          booking_number: this.bookingNumber,
          guest: this.guest,
          user_id: this.userId,
          room_type: this.roomType,
          room_number: this.roomNumber,
          check_in: this.checkIn,
          check_out: this.checkOut,
          nights: this.nights,
          adults: this.adults,
          children: this.children,
          status: this.status,
          base_price: this.basePrice,
          taxes: this.taxes,
          total_amount: this.totalAmount,
          deposit: this.deposit,
          deposit_paid: this.depositPaid,
          payments: this.payments,
          special_requests: this.specialRequests,
          notes: this.notes,
          source: this.source,
          cancellation_reason: this.cancellationReason,
          cancellation_date: this.cancellationDate,
          no_show_date: this.noShowDate,
          updated_at: new Date()
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return new Booking(data);
  }

  async delete(): Promise<void> {
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', this.id);

    if (error) throw error;
  }

  async confirm(): Promise<void> {
    this.status = BookingStatus.CONFIRMED;
    await this.save();
  }

  async performCheckIn(): Promise<void> {
    this.status = BookingStatus.CHECKED_IN;
    await this.save();
  }

  async performCheckOut(): Promise<void> {
    this.status = BookingStatus.CHECKED_OUT;
    await this.save();
  }

  async cancel(reason: string): Promise<void> {
    this.status = BookingStatus.CANCELLED;
    this.cancellationReason = reason;
    this.cancellationDate = new Date();
    await this.save();
  }

  async markNoShow(): Promise<void> {
    this.status = BookingStatus.NO_SHOW;
    this.noShowDate = new Date();
    await this.save();
  }

  async addPayment(payment: Omit<IPayment, 'id'>): Promise<void> {
    const newPayment = { ...payment, id: crypto.randomUUID() };
    this.payments = [...(this.payments || []), newPayment];
    
    // Update deposit paid status if applicable
    if (this.deposit && !this.depositPaid) {
      const totalPaid = this.payments.reduce((sum, p) => 
        p.status === 'completed' ? sum + p.amount : sum, 0);
      if (totalPaid >= this.deposit) {
        this.depositPaid = true;
      }
    }

    await this.save();
  }

  async updatePayment(paymentId: string, updates: Partial<IPayment>): Promise<void> {
    this.payments = (this.payments || []).map(payment =>
      payment.id === paymentId ? { ...payment, ...updates } : payment
    );
    await this.save();
  }

  calculateTotalAmount(): number {
    const nights = Math.ceil(
      (this.checkOut.getTime() - this.checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );
    const subtotal = this.basePrice * nights;
    const taxes = subtotal * 0.16; // 16% tax rate
    return subtotal + taxes;
  }

  isFullyPaid(): boolean {
    const totalPaid = this.payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);
    return totalPaid >= this.totalAmount;
  }

  getRemainingBalance(): number {
    const totalPaid = this.payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);
    return this.totalAmount - totalPaid;
  }
}
