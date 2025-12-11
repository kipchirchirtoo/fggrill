import { supabase } from '../config/database';
import crypto from 'crypto';

export interface ITransaction {
  id: string;
  folioId: string;
  type: 'charge' | 'payment' | 'refund' | 'adjustment';
  category: string;
  amount: number;
  description?: string;
  referenceNumber?: string;
  performedBy?: string;
  createdAt: Date;
}

export interface IFolio {
  id: string;
  folioNumber: string;
  reservationId: string;
  guestId: string;
  status: 'open' | 'closed' | 'posted';
  
  // Billing
  roomCharges: number;
  foodCharges: number;
  beverageCharges: number;
  otherCharges: number;
  totalCharges: number;
  totalPayments: number;
  balance: number;
  
  // Status
  settled: boolean;
  settledAt?: Date;
  notes?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export class Folio implements IFolio {
  id: string;
  folioNumber: string;
  reservationId: string;
  guestId: string;
  status: 'open' | 'closed' | 'posted';
  
  roomCharges: number;
  foodCharges: number;
  beverageCharges: number;
  otherCharges: number;
  totalCharges: number;
  totalPayments: number;
  balance: number;
  
  settled: boolean;
  settledAt?: Date;
  notes?: string;
  
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<IFolio>) {
    this.id = data.id || crypto.randomUUID();
    this.folioNumber = data.folioNumber || this.generateFolioNumber();
    this.reservationId = data.reservationId || '';
    this.guestId = data.guestId || '';
    this.status = data.status || 'open';
    
    this.roomCharges = data.roomCharges || 0;
    this.foodCharges = data.foodCharges || 0;
    this.beverageCharges = data.beverageCharges || 0;
    this.otherCharges = data.otherCharges || 0;
    this.totalCharges = data.totalCharges || 0;
    this.totalPayments = data.totalPayments || 0;
    this.balance = data.balance || 0;
    
    this.settled = data.settled || false;
    this.settledAt = data.settledAt;
    this.notes = data.notes;
    
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  private generateFolioNumber(): string {
    return 'FOL-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  }

  async save(): Promise<Folio> {
    const { data, error } = await supabase
      .from('folios')
      .upsert([
        {
          id: this.id,
          folio_number: this.folioNumber,
          reservation_id: this.reservationId,
          guest_id: this.guestId,
          status: this.status,
          room_charges: this.roomCharges,
          food_charges: this.foodCharges,
          beverage_charges: this.beverageCharges,
          other_charges: this.otherCharges,
          // total_charges, total_payments, balance are usually generated/calculated in DB or by triggers
          // but we can pass them if we are authoritative
          settled: this.settled,
          settled_at: this.settledAt,
          notes: this.notes,
          updated_at: new Date()
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return Folio.fromDatabase(data);
  }

  static async findByReservationId(reservationId: string): Promise<Folio | null> {
    const { data, error } = await supabase
      .from('folios')
      .select('*')
      .eq('reservation_id', reservationId)
      .single();

    if (error || !data) return null;
    return Folio.fromDatabase(data);
  }

  async getTransactions(): Promise<ITransaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('folio_id', this.id)
      .order('created_at', { ascending: true });

    if (error || !data) return [];
    return data.map(t => ({
      id: t.id,
      folioId: t.folio_id,
      type: t.type,
      category: t.category,
      amount: t.amount,
      description: t.description,
      referenceNumber: t.reference_number,
      performedBy: t.performed_by,
      createdAt: new Date(t.created_at)
    }));
  }

  async addTransaction(transaction: Omit<ITransaction, 'id' | 'folioId' | 'createdAt'>): Promise<ITransaction> {
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        folio_id: this.id,
        type: transaction.type,
        category: transaction.category,
        amount: transaction.amount,
        description: transaction.description,
        reference_number: transaction.referenceNumber,
        performed_by: transaction.performedBy
      })
      .select()
      .single();

    if (error) throw error;
    
    // Update folio totals (trigger handles this in DB, but good to refresh)
    await this.refresh();
    
    return {
      id: data.id,
      folioId: data.folio_id,
      type: data.type,
      category: data.category,
      amount: data.amount,
      description: data.description,
      referenceNumber: data.reference_number,
      performedBy: data.performed_by,
      createdAt: new Date(data.created_at)
    };
  }

  async refresh(): Promise<void> {
    const { data, error } = await supabase
      .from('folios')
      .select('*')
      .eq('id', this.id)
      .single();

    if (error || !data) throw error;
    
    const refreshed = Folio.fromDatabase(data);
    this.totalCharges = refreshed.totalCharges;
    this.totalPayments = refreshed.totalPayments;
    this.balance = refreshed.balance;
    this.status = refreshed.status;
    this.updatedAt = refreshed.updatedAt;
  }

  static fromDatabase(data: any): Folio {
    return new Folio({
      id: data.id,
      reservationId: data.reservation_id,
      guestId: data.guest_id,
      status: data.status,
      totalCharges: data.total_charges,
      totalPayments: data.total_payments,
      balance: data.balance,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    });
  }
}
