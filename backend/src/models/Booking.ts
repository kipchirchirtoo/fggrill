import { supabase } from '../config/database';
import { RoomType } from './Room';
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
  checkInDate: Date;
  checkOutDate: Date;
  status: BookingStatus;
  adults: number;
  children: number;
  ratePlanId?: number;
  totalAmount: number;
  notes?: string;
  specialRequests?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Booking implements IBooking {
  id: string;
  confirmationNumber: string;
  guestId: string;
  roomId?: string;
  roomTypeId: string;
  checkInDate: Date;
  checkOutDate: Date;
  status: BookingStatus;
  adults: number;
  children: number;
  ratePlanId?: number;
  totalAmount: number;
  notes?: string;
  specialRequests?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<IBooking>) {
    this.id = data.id || crypto.randomUUID();
    this.confirmationNumber = data.confirmationNumber || this.generateConfirmationNumber();
    this.guestId = data.guestId || '';
    this.roomId = data.roomId;
    this.roomTypeId = data.roomTypeId || '';
    this.checkInDate = data.checkInDate || new Date();
    this.checkOutDate = data.checkOutDate || new Date();
    this.status = data.status || BookingStatus.PENDING;
    this.adults = data.adults || 1;
    this.children = data.children || 0;
    this.ratePlanId = data.ratePlanId;
    this.totalAmount = data.totalAmount || 0;
    this.notes = data.notes;
    this.specialRequests = data.specialRequests;
    this.createdBy = data.createdBy;
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
    const { data, error } = await supabase
      .from('reservations')
      .upsert([
        {
          id: this.id,
          confirmation_number: this.confirmationNumber,
          guest_id: this.guestId,
          room_id: this.roomId,
          room_type_id: this.roomTypeId,
          check_in_date: this.checkInDate,
          check_out_date: this.checkOutDate,
          status: this.status,
          adults: this.adults,
          children: this.children,
          rate_plan_id: this.ratePlanId,
          total_amount: this.totalAmount,
          notes: this.notes,
          special_requests: this.specialRequests,
          created_by: this.createdBy,
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
      checkInDate: new Date(data.check_in_date),
      checkOutDate: new Date(data.check_out_date),
      status: data.status as BookingStatus,
      adults: data.adults,
      children: data.children,
      ratePlanId: data.rate_plan_id,
      totalAmount: data.total_amount,
      notes: data.notes,
      specialRequests: data.special_requests,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    });
  }
}
