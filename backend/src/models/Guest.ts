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
    const { data, error } = await supabase
      .from('guest_profiles')
      .select('*, users!inner(first_name, last_name, email, phone_number)')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return Guest.fromDatabase(data);
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
    let allowedGuestIds: string[] | null = null;

    // 0. If checkedInOnly, get IDs of guests with active reservations
    if (checkedInOnly) {
      const { data: activeReservations, error: reservationError } = await supabase
        .from('reservations')
        .select('guest_id')
        .eq('status', 'checked_in');

      if (reservationError) {
        console.error('Error fetching active reservations:', reservationError);
        return [];
      }

      allowedGuestIds = activeReservations?.map(r => r.guest_id).filter(id => id) || [];

      // If no checked-in guests, return empty immediately
      if (allowedGuestIds.length === 0) {
        return [];
      }
    }

    // 1. Get from guest_profiles (linked to users)
    let profileQuery = supabase
      .from('guest_profiles')
      .select('*, users!inner(first_name, last_name, email, phone_number)')

    if (query) {
      profileQuery = profileQuery.or(`users.first_name.ilike.%${query}%,users.last_name.ilike.%${query}%,users.email.ilike.%${query}%,users.phone_number.ilike.%${query}%`)
    }

    if (allowedGuestIds) {
      profileQuery = profileQuery.in('id', allowedGuestIds);
    }

    const { data: profileData, error: profileError } = await profileQuery;

    // 2. Get from guests table (compatibility/legacy)
    let guestTableQuery = supabase.from('guests').select('*');
    if (query) {
      guestTableQuery = guestTableQuery.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`);
    }

    if (allowedGuestIds) {
      guestTableQuery = guestTableQuery.in('id', allowedGuestIds);
    }

    const { data: guestTableData, error: guestTableError } = await guestTableQuery;

    if (profileError) console.error('Error fetching guest profiles:', profileError);
    if (guestTableError) console.error('Error fetching guests table:', guestTableError);

    // 3. Merge and deduplicate
    const guestMap = new Map<string, Guest>();

    if (profileData) {
      profileData.forEach(d => {
        guestMap.set(d.id, Guest.fromDatabase(d));
      });
    }

    if (guestTableData) {
      guestTableData.forEach(d => {
        if (!guestMap.has(d.id)) {
          guestMap.set(d.id, new Guest({
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
      });
    }

    let guests = Array.from(guestMap.values());

    // 4. Filter by branch if branchId is provided
    if (branchId) {
      // Since we removed the join, we can't filter by bookings in memory efficiently for now.
      // If strict branch filtering is required, we would need to fetch bookings separately.
      // For now, we return all guests to ensure the dropdown works.
      // TODO: Implement proper branch filtering if needed.
    }

    return guests;
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
    const { error } = await supabase
      .from('guest_profiles')
      .delete()
      .eq('id', this.id);

    if (error) throw error;
  }

  static fromDatabase(data: any): Guest {
    const userData = data.users || {};

    return new Guest({
      id: data.id,
      firstName: userData.first_name,
      lastName: userData.last_name,
      email: userData.email,
      phone: userData.phone_number,
      idType: data.id_type,
      idNumber: data.id_number,
      address: data.address,
      nationality: data.nationality,
      // Map fields
      city: data.city,
      country: data.country,
      dateOfBirth: data.date_of_birth,

      isVip: data.vip_status,
      notes: data.notes,
      preferences: data.preferences,
      blacklistStatus: data.blacklist_status,
      blacklistReason: data.blacklist_reason,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    });
  }
}
