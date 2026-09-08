import { supabase } from '../config/database';
import db from '../db';
import crypto from 'crypto';

export interface IGuest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  idType?: string;
  idNumber?: string;
  carNumberPlate?: string;
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
  carNumberPlate?: string;
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

  constructor(data: Partial<IGuest> & Record<string, any>) {
    this.id = data.id || crypto.randomUUID();
    this.firstName = data.first_name ?? data.firstName ?? '';
    this.lastName = data.last_name ?? data.lastName ?? '';
    this.email = data.email;
    this.phone = data.phone;
    this.idType = data.id_type ?? data.idType;
    this.idNumber = data.id_number ?? data.idNumber ?? data.identification_number;
    this.carNumberPlate =
      data.car_number_plate ??
      data.carNumberPlate ??
      data.vehicle_plate ??
      data.vehiclePlate ??
      data.number_plate;
    this.address = data.address;
    this.nationality = data.nationality;
    this.city = data.city;
    this.country = data.country;
    this.dateOfBirth = data.date_of_birth ?? data.dateOfBirth;
    this.isVip = data.is_vip ?? data.isVip ?? data.vip_status ?? false;
    this.notes = data.notes;
    this.preferences = data.preferences || {};
    this.blacklistStatus = data.blacklist_status ?? data.blacklistStatus ?? false;
    this.blacklistReason = data.blacklist_reason ?? data.blacklistReason;
    this.createdAt = data.created_at ? new Date(data.created_at) : (data.createdAt ? new Date(data.createdAt) : new Date());
    this.updatedAt = data.updated_at ? new Date(data.updated_at) : (data.updatedAt ? new Date(data.updatedAt) : new Date());
  }

  // ===========================================================
  // All queries use the standalone `guests` table.
  // Guests are NOT users and do NOT need auth accounts.
  // The `reservations` table FK references `guests(id)`.
  // ===========================================================

  static async findById(id: string): Promise<Guest | null> {
    try {
      const { data, error } = await supabase
        .from('guests')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error(`[Guest.findById] Database error for ID ${id}:`, error);
        throw error;
      }
      
      if (!data) {
        console.log(`[Guest.findById] No guest found with ID: ${id}`);
        return null;
      }
      
      return Guest.fromDatabase(data);
    } catch (error: any) {
      console.error(`[Guest.findById] Error fetching guest ${id}:`, error);
      throw new Error(`Failed to fetch guest: ${error.message}`);
    }
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
    // Raw SQL (not supabase-js/PostgREST) on purpose: branch scoping used to
    // fetch every matching reservations.guest_id client-side, then filter
    // guests with `.in('id', ids)`. A branch with hundreds of reservations
    // (e.g. Kyogong, 700+ distinct guest ids) builds a query string PostgREST
    // rejects with "Bad Request" — which this method then swallowed into an
    // empty array, so the guest picker silently showed "No guests found" for
    // any branch with real history. A subquery run server-side in Postgres
    // has no such limit and is a single round trip either way.
    const conditions: string[] = [];
    const params: any[] = [];

    if (query) {
      params.push(`%${query}%`);
      const p = `$${params.length}`;
      conditions.push(
        `(g.first_name ILIKE ${p} OR g.last_name ILIKE ${p} OR g.email ILIKE ${p} ` +
        `OR g.phone ILIKE ${p} OR g.id_number ILIKE ${p} OR g.car_number_plate ILIKE ${p})`
      );
    }

    // Branch scoping only applies when there's no search query — a search is
    // meant to find any existing guest profile system-wide, not just ones
    // with history at this branch.
    if (branchId && !query) {
      params.push(branchId);
      conditions.push(`g.id IN (SELECT guest_id FROM reservations WHERE branch_id = $${params.length} AND guest_id IS NOT NULL)`);
    }

    if (checkedInOnly) {
      conditions.push(`g.id IN (SELECT guest_id FROM reservations WHERE status IN ('checked_in', 'checked-in') AND guest_id IS NOT NULL)`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    try {
      const { rows } = await db.query(`SELECT g.* FROM guests g ${where} ORDER BY g.created_at DESC NULLS LAST`, params);
      return rows.map((d: any) => Guest.fromDatabase(d));
    } catch (error) {
      console.error('Error fetching guests:', error);
      return [];
    }
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
          car_number_plate: this.carNumberPlate,
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
      carNumberPlate: data.car_number_plate,
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
      createdAt: data.created_at ? new Date(data.created_at) : new Date(),
      updatedAt: data.updated_at ? new Date(data.updated_at) : new Date()
    });
  }
}
