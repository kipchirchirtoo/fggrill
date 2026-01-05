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

  static async findById(id: string): Promise<Guest | null> {
    // 1. Try guest_profiles first
    const { data: profile, error: profileError } = await supabase
      .from('guest_profiles')
      .select('*, users!inner(first_name, last_name, email, phone_number)')
      .eq('id', id)
      .maybeSingle();

    if (profile) return Guest.fromDatabase(profile);

    // 2. Fallback to guests table
    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (guest) {
      return new Guest({
        id: guest.id,
        firstName: guest.first_name,
        lastName: guest.last_name,
        email: guest.email,
        phone: guest.phone,
        idType: guest.id_type,
        idNumber: guest.id_number,
        address: guest.address,
        nationality: guest.nationality,
        isVip: guest.is_vip,
        notes: guest.notes,
        createdAt: new Date(guest.created_at),
        updatedAt: new Date(guest.updated_at)
      });
    }

    return null;
  }

  static async findByEmail(email: string): Promise<Guest | null> {
    // First check guest_profiles (linked to users)
    const { data, error } = await supabase
      .from('guest_profiles')
      .select('*, users!inner(first_name, last_name, email, phone_number)')
      .eq('users.email', email)
      .maybeSingle();

    if (data) return Guest.fromDatabase(data);

    // If not found, check guests table
    const { data: guestData, error: guestError } = await supabase
      .from('guests')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (guestData) {
      return new Guest({
        id: guestData.id,
        firstName: guestData.first_name,
        lastName: guestData.last_name,
        email: guestData.email,
        phone: guestData.phone,
        idType: guestData.id_type,
        idNumber: guestData.id_number,
        address: guestData.address,
        nationality: guestData.nationality,
        preferences: guestData.preferences,
        isVip: guestData.is_vip,
        blacklistStatus: guestData.blacklist_status,
        blacklistReason: guestData.blacklist_reason,
        notes: guestData.notes,
        createdAt: new Date(guestData.created_at),
        updatedAt: new Date(guestData.updated_at)
      });
    }

    return null;
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

    return (guestsData || []).map(d => new Guest({
      id: d.id,
      firstName: d.first_name,
      lastName: d.last_name,
      email: d.email,
      phone: d.phone,
      idType: d.id_type,
      idNumber: d.id_number,
      address: d.address,
      nationality: d.nationality,
      isVip: d.is_vip,
      notes: d.notes,
      createdAt: new Date(d.created_at),
      updatedAt: new Date(d.updated_at)
    }));
  }

  async save(): Promise<Guest> {
    // First check if this guest exists
    const { data: existingGuest, error: findError } = await supabase
      .from('guest_profiles')
      .select('id, user_id')
      .eq('id', this.id)
      .single();

    if (findError && findError.code !== 'PGRST116') throw findError;

    // If guest exists, update the profile
    if (existingGuest) {
      const { data, error } = await supabase
        .from('guest_profiles')
        .update({
          id_type: this.idType,
          id_number: this.idNumber,
          address: this.address,
          nationality: this.nationality,
          vip_status: this.isVip,
          notes: this.notes,
          updated_at: new Date()
        })
        .eq('id', this.id)
        .select('*, users!inner(first_name, last_name, email, phone_number)')
        .single();

      if (error) throw error;

      // Sync with guests table for reservations compatibility
      await supabase
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
            preferences: this.preferences,
            is_vip: this.isVip,
            blacklist_status: this.blacklistStatus,
            blacklist_reason: this.blacklistReason,
            notes: this.notes,
            updated_at: new Date()
          }
        ]);

      // Also update user details if changed
      if (this.firstName || this.lastName || this.email || this.phone) {
        await supabase
          .from('users')
          .update({
            first_name: this.firstName,
            last_name: this.lastName,
            email: this.email,
            phone_number: this.phone
          })
          .eq('id', existingGuest.user_id);
      }

      return Guest.fromDatabase(data);
    } else {
      // For new guests, we need to check if a user with this email already exists
      let userData;
      if (this.email) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', this.email)
          .maybeSingle();
        userData = existingUser;
      }

      if (!userData) {
        // Create new user if not exists
        if (!this.email) {
          throw new Error('Email is required for guest registration');
        }
        const { data: newUserData, error: userError } = await supabase
          .from('users')
          .insert([
            {
              id: crypto.randomUUID(),
              first_name: this.firstName,
              last_name: this.lastName,
              email: this.email,
              phone_number: this.phone,
              role: 'guest'
            }
          ])
          .select()
          .single();

        if (userError) throw userError;
        userData = newUserData;
      }

      const { data, error } = await supabase
        .from('guest_profiles')
        .insert([
          {
            id: this.id,
            user_id: userData.id,
            id_type: this.idType || 'national_id',
            id_number: this.idNumber || 'pending',
            nationality: this.nationality || 'Kenyan',
            address: this.address,
            vip_status: this.isVip,
            notes: this.notes,
            updated_at: new Date()
          }
        ])
        .select('*, users!inner(first_name, last_name, email, phone_number)')
        .single();

      if (error) throw error;

      // Sync with guests table for reservations compatibility
      await supabase
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
            preferences: this.preferences,
            is_vip: this.isVip,
            blacklist_status: this.blacklistStatus,
            blacklist_reason: this.blacklistReason,
            notes: this.notes,
            created_at: this.createdAt,
            updated_at: new Date()
          }
        ]);

      return Guest.fromDatabase(data);
    }
  }

  async delete(): Promise<void> {
    // 1. Delete from guest_profiles
    const { error: profileError } = await supabase
      .from('guest_profiles')
      .delete()
      .eq('id', this.id);

    if (profileError) throw profileError;

    // 2. Delete from guests table
    const { error: guestError } = await supabase
      .from('guests')
      .delete()
      .eq('id', this.id);

    if (guestError) throw guestError;
  }

  static fromDatabase(data: any): Guest {
    const userData = data.users || {};

    return new Guest({
      id: data.id,
      firstName: userData.first_name || data.first_name,
      lastName: userData.last_name || data.last_name,
      email: userData.email || data.email,
      phone: userData.phone_number || data.phone,
      idType: data.id_type,
      idNumber: data.id_number,
      address: data.address,
      nationality: data.nationality,
      city: data.city,
      country: data.country,
      dateOfBirth: data.date_of_birth,
      isVip: data.vip_status || data.is_vip,
      notes: data.notes,
      preferences: data.preferences,
      blacklistStatus: data.blacklist_status,
      blacklistReason: data.blacklist_reason,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    });
  }
}
