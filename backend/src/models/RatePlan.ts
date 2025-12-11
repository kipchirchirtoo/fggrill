import { supabase } from '../config/database';
import crypto from 'crypto';

export interface IRatePlan {
  id: string;
  name: string;
  code: string;
  description?: string;
  rateType: 'STANDARD' | 'WEEKEND' | 'CORPORATE' | 'GOVERNMENT' | 'AAA' | 'SENIOR';
  multiplier: number;
  isPercentage: boolean;
  fixedAmount?: number;
  minNights?: number;
  maxNights?: number;
  advanceBookingDays?: number;
  validFrom?: Date;
  validTo?: Date;
  daysOfWeek?: string[]; // ["MON", "TUE", ...]
  blackoutDates?: any[];
  refundable: boolean;
  cancellationHours: number;
  depositPercentage?: number;
  inclusions?: string[];
  restrictions?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class RatePlan implements IRatePlan {
  id: string;
  name: string;
  code: string;
  description?: string;
  rateType: 'STANDARD' | 'WEEKEND' | 'CORPORATE' | 'GOVERNMENT' | 'AAA' | 'SENIOR';
  multiplier: number;
  isPercentage: boolean;
  fixedAmount?: number;
  minNights?: number;
  maxNights?: number;
  advanceBookingDays?: number;
  validFrom?: Date;
  validTo?: Date;
  daysOfWeek?: string[];
  blackoutDates?: any[];
  refundable: boolean;
  cancellationHours: number;
  depositPercentage?: number;
  inclusions?: string[];
  restrictions?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<IRatePlan>) {
    this.id = data.id || crypto.randomUUID();
    this.name = data.name || '';
    this.code = data.code || '';
    this.description = data.description;
    this.rateType = data.rateType || 'STANDARD';
    this.multiplier = data.multiplier ?? 1.0;
    this.isPercentage = data.isPercentage ?? true;
    this.fixedAmount = data.fixedAmount;
    this.minNights = data.minNights;
    this.maxNights = data.maxNights;
    this.advanceBookingDays = data.advanceBookingDays;
    this.validFrom = data.validFrom;
    this.validTo = data.validTo;
    this.daysOfWeek = data.daysOfWeek || [];
    this.blackoutDates = data.blackoutDates || [];
    this.refundable = data.refundable ?? true;
    this.cancellationHours = data.cancellationHours ?? 24;
    this.depositPercentage = data.depositPercentage;
    this.inclusions = data.inclusions || [];
    this.restrictions = data.restrictions;
    this.active = data.active ?? true;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  static async findAll(): Promise<RatePlan[]> {
    const { data, error } = await supabase
      .from('rate_plans')
      .select('*')
      .order('name');

    if (error || !data) return [];
    return data.map(RatePlan.fromDatabase);
  }

  static async findById(id: string): Promise<RatePlan | null> {
    const { data, error } = await supabase
      .from('rate_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return RatePlan.fromDatabase(data);
  }

  async save(): Promise<RatePlan> {
    const { data, error } = await supabase
      .from('rate_plans')
      .upsert([{
        id: this.id,
        name: this.name,
        code: this.code,
        description: this.description,
        rate_type: this.rateType,
        multiplier: this.multiplier,
        is_percentage: this.isPercentage,
        fixed_amount: this.fixedAmount,
        min_nights: this.minNights,
        max_nights: this.maxNights,
        advance_booking_days: this.advanceBookingDays,
        valid_from: this.validFrom,
        valid_to: this.validTo,
        days_of_week: this.daysOfWeek,
        blackout_dates: this.blackoutDates,
        refundable: this.refundable,
        cancellation_hours: this.cancellationHours,
        deposit_percentage: this.depositPercentage,
        inclusions: this.inclusions,
        restrictions: this.restrictions,
        active: this.active,
        updated_at: new Date()
      }])
      .select()
      .single();

    if (error) throw error;
    return RatePlan.fromDatabase(data);
  }

  async delete(): Promise<void> {
    const { error } = await supabase
      .from('rate_plans')
      .delete()
      .eq('id', this.id);
    
    if (error) throw error;
  }

  static fromDatabase(data: any): RatePlan {
    return new RatePlan({
      id: data.id,
      name: data.name,
      code: data.code,
      description: data.description,
      rateType: data.rate_type,
      multiplier: data.multiplier,
      isPercentage: data.is_percentage,
      fixedAmount: data.fixed_amount,
      minNights: data.min_nights,
      maxNights: data.max_nights,
      advanceBookingDays: data.advance_booking_days,
      validFrom: data.valid_from ? new Date(data.valid_from) : undefined,
      validTo: data.valid_to ? new Date(data.valid_to) : undefined,
      daysOfWeek: data.days_of_week,
      blackoutDates: data.blackout_dates,
      refundable: data.refundable,
      cancellationHours: data.cancellation_hours,
      depositPercentage: data.deposit_percentage,
      inclusions: data.inclusions,
      restrictions: data.restrictions,
      active: data.active,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    });
  }
}
