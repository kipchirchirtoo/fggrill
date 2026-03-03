import { supabase } from '../config/database';
import crypto from 'crypto';

export interface IGuest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  idType?: string;
  idNumber?: string;
  address?: string;
  city?: string;
  country?: string;
  dateOfBirth?: string;
  nationality?: string;
  isVip: boolean;
  notes?: string;
  preferences?: any;
  blacklistStatus: boolean;
  blacklistReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Guest implements IGuest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  idType?: string;
  idNumber?: string;
  address?: string;
  city?: string;
  country?: string;
  dateOfBirth?: string;
  nationality?: string;
  isVip: boolean;
  notes?: string;
  preferences?: any;
  blacklistStatus: boolean;
  blacklistReason?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<IGuest>) {
    this.id = data.id || crypto.randomUUID();
    this.firstName = data.firstName || '';
    this.lastName = data.lastName || '';
    this.email = data.email;
    this.phone = data.phone;
    this.idType = data.idType;
    this.idNumber = data.idNumber;
    this.address = data.address;
    this.nationality = data.nationality;
    this.city = data.city;
    this.country = data.country;
    this.dateOfBirth = data.dateOfBirth;
    this.isVip = data.isVip || false;
    this.notes = data.notes;
    this.preferences = data.preferences || {};
    this.blacklistStatus = data.blacklistStatus || false;
    this.blacklistReason = data.blacklistReason;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // ===========================================================
  // All queries use the standalone `guests` table.
  // Guests are NOT users and do NOT need auth accounts.
  // The `reservations` table FK references `guests(id)`.
  // ===========================================================

  static async findById(id: string): Promise<Guest | null> {
    const { data, error } = await supabase
      .from('guests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return Guest.fromDatabase(data);
  }

  static async findByEmail(email: string): Promise<Guest | null> {
    const { data, error } = await supabase
      .from('guests')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error || !data) return null;
    return Guest.fromDatabase(data);
  }

  static async search(query: string, branchId?: number, checkedInOnly?: boolean): Promise<Guest[]> {
    let guestQuery = supabase.from('guests').select('*');

    // 1. Filter by search query if provided
    if (query) {
      guestQuery = guestQuery.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%,id_number.ilike.%${query}%`);
    }

    // 2. Filter by branchId if provided (via reservations)
    if (branchId) {
      const { data: branchGuestIds, error: branchError } = await supabase
        .from('reservations')
        .select('guest_id')
        .eq('branch_id', branchId);

      if (branchError) {
        console.error('Error fetching branch guests:', branchError);
      } else {
        const ids = [...new Set(branchGuestIds?.map(r => r.guest_id).filter(id => id))] as string[];
        if (ids.length > 0) {
          guestQuery = guestQuery.in('id', ids);
        } else {
          return []; // No guests for this branch
        }
      }
    }

    // 3. Filter by checked-in status if requested
    if (checkedInOnly) {
      const { data: activeReservations, error: reservationError } = await supabase
        .from('reservations')
        .select('guest_id')
        .eq('status', 'checked_in');

      if (reservationError) {
        console.error('Error fetching active reservations:', reservationError);
      } else {
        const activeIds = [...new Set(activeReservations?.map(r => r.guest_id).filter(id => id))] as string[];
        if (activeIds.length > 0) {
          guestQuery = guestQuery.in('id', activeIds);
        } else {
          return []; // No checked-in guests
        }
      }
    }

    const { data: guestsData, error: guestsError } = await guestQuery;

    if (guestsError) {
      console.error('Error fetching guests:', guestsError);
      return [];
    }

    return (guestsData || []).map(d => Guest.fromDatabase(d));
  }

  /**
   * Save guest to the `guests` table.
   * Guests do NOT need auth accounts or entries in the `users` table.
   */
  async save(): Promise<Guest> {
    const { data, error } = await supabase
      .from('guests')
      .upsert([
        {
          id: this.id,
          first_name: this.firstName,
          last_name: this.lastName,
          email: this.email,
          phone: this.phone,
          id_type: this.idType,
          id_number: this.idNumber,
          address: this.address,
          nationality: this.nationality,
          city: this.city,
          country: this.country,
          date_of_birth: this.dateOfBirth,
          preferences: this.preferences,
          is_vip: this.isVip,
          blacklist_status: this.blacklistStatus,
          blacklist_reason: this.blacklistReason,
          notes: this.notes,
          updated_at: new Date()
        }
      ], { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    return Guest.fromDatabase(data);
  }

  async delete(): Promise<void> {
    const { error } = await supabase
      .from('guests')
      .delete()
      .eq('id', this.id);

    if (error) throw error;
  }

  static fromDatabase(data: any): Guest {
    return new Guest({
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      phone: data.phone,
      idType: data.id_type,
      idNumber: data.id_number,
      address: data.address,
      nationality: data.nationality,
      city: data.city,
      country: data.country,
      dateOfBirth: data.date_of_birth,
      isVip: data.is_vip,
      notes: data.notes,
      preferences: data.preferences,
      blacklistStatus: data.blacklist_status,
      blacklistReason: data.blacklist_reason,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    });
  }
}
