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
  nationality?: string;
  preferences: Record<string, any>;
  isVip: boolean;
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
  nationality?: string;
  preferences: Record<string, any>;
  isVip: boolean;
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
    this.preferences = data.preferences || {};
    this.isVip = data.isVip || false;
    this.blacklistStatus = data.blacklistStatus || false;
    this.blacklistReason = data.blacklistReason;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  static async findById(id: string): Promise<Guest | null> {
    const { data, error } = await supabase
      .from('guests')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return Guest.fromDatabase(data);
  }

  static async findByEmail(email: string): Promise<Guest | null> {
    const { data, error } = await supabase
      .from('guests')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) return null;
    return Guest.fromDatabase(data);
  }

  static async search(query: string): Promise<Guest[]> {
    const { data, error } = await supabase
      .from('guests')
      .select('*')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
      .limit(20);

    if (error || !data) return [];
    return data.map(Guest.fromDatabase);
  }

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
          preferences: this.preferences,
          is_vip: this.isVip,
          blacklist_status: this.blacklistStatus,
          blacklist_reason: this.blacklistReason,
          updated_at: new Date()
        }
      ])
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
      preferences: data.preferences,
      isVip: data.is_vip,
      blacklistStatus: data.blacklist_status,
      blacklistReason: data.blacklist_reason,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    });
  }
}
