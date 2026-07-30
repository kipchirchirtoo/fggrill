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
  branchId?: number;
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
  branchId?: number;
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
    this.branchId = data.branchId;
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
          branch_id: this.branchId,
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

  async getTransactionById(transactionId: string): Promise<ITransaction | null> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('folio_id', this.id)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      folioId: data.folio_id,
      type: data.type,
      category: data.category,
      amount: Number(data.amount || 0),
      description: data.description,
      referenceNumber: data.reference_number,
      performedBy: data.performed_by,
      createdAt: new Date(data.created_at)
    };
  }

  private isAdditionalServiceCharge(
    transaction: Pick<ITransaction, 'type' | 'category'>
  ): boolean {
    return String(transaction.type || '').toLowerCase() === 'charge' &&
      String(transaction.category || '').trim().toLowerCase() === 'additional service';
  }

  private async applyAdditionalServiceDelta(amountDelta: number): Promise<void> {
    if (!amountDelta) return;

    await this.refresh();

    const nextOtherCharges = Math.max(0, Number(this.otherCharges || 0) + amountDelta);
    const nextTotalCharges = Math.max(0, Number(this.totalCharges || 0) + amountDelta);
    const nextBalance = Math.max(0, nextTotalCharges - Number(this.totalPayments || 0));

    const { error } = await supabase
      .from('folios')
      .update({
        other_charges: nextOtherCharges,
        total_charges: nextTotalCharges,
        balance: nextBalance,
        updated_at: new Date()
      })
      .eq('id', this.id);

    if (error) throw error;

    this.otherCharges = nextOtherCharges;
    this.totalCharges = nextTotalCharges;
    this.balance = nextBalance;
    this.updatedAt = new Date();
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

    if (this.isAdditionalServiceCharge({
      type: transaction.type,
      category: transaction.category
    })) {
      await this.applyAdditionalServiceDelta(Number(transaction.amount || 0));
    } else {
      await this.refresh();
    }

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

  async updateTransaction(
    transactionId: string,
    patch: Partial<Pick<ITransaction, 'category' | 'amount' | 'description' | 'referenceNumber' | 'performedBy'>>
  ): Promise<ITransaction> {
    const existing = await this.getTransactionById(transactionId);
    if (!existing) {
      throw new Error('Transaction not found');
    }

    const nextCategory = patch.category ?? existing.category;
    const nextAmount = Number(patch.amount ?? existing.amount);
    const nextDescription = patch.description ?? existing.description;
    const nextReference = patch.referenceNumber ?? existing.referenceNumber;
    const nextPerformedBy = patch.performedBy ?? existing.performedBy;

    const { data, error } = await supabase
      .from('transactions')
      .update({
        category: nextCategory,
        amount: nextAmount,
        description: nextDescription,
        reference_number: nextReference,
        performed_by: nextPerformedBy
      })
      .eq('id', transactionId)
      .eq('folio_id', this.id)
      .select('*')
      .single();

    if (error || !data) throw error;

    const wasAdditionalService = this.isAdditionalServiceCharge(existing);
    const isAdditionalService = this.isAdditionalServiceCharge({
      type: existing.type,
      category: nextCategory
    });

    if (wasAdditionalService || isAdditionalService) {
      let delta = 0;
      if (wasAdditionalService && isAdditionalService) {
        delta = nextAmount - Number(existing.amount || 0);
      } else if (!wasAdditionalService && isAdditionalService) {
        delta = nextAmount;
      } else if (wasAdditionalService && !isAdditionalService) {
        delta = -Number(existing.amount || 0);
      }
      await this.applyAdditionalServiceDelta(delta);
    } else {
      await this.refresh();
    }

    return {
      id: data.id,
      folioId: data.folio_id,
      type: data.type,
      category: data.category,
      amount: Number(data.amount || 0),
      description: data.description,
      referenceNumber: data.reference_number,
      performedBy: data.performed_by,
      createdAt: new Date(data.created_at)
    };
  }

  async deleteTransaction(transactionId: string): Promise<void> {
    const existing = await this.getTransactionById(transactionId);
    if (!existing) {
      throw new Error('Transaction not found');
    }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId)
      .eq('folio_id', this.id);

    if (error) throw error;

    if (this.isAdditionalServiceCharge(existing)) {
      await this.applyAdditionalServiceDelta(-Number(existing.amount || 0));
    } else {
      await this.refresh();
    }
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
    const roomCharges = Number(data.room_charges || 0);
    const foodCharges = Number(data.food_charges || 0);
    const beverageCharges = Number(data.beverage_charges || 0);
    const otherCharges = Number(data.other_charges || 0);
    const calculatedSum = roomCharges + foodCharges + beverageCharges + otherCharges;
    const totalCharges = Math.max(Number(data.total_charges || 0), calculatedSum);
    const totalPayments = Number(data.total_payments || 0);
    const balance = (data.balance !== undefined && data.balance !== null && Number(data.balance) >= totalCharges)
        ? Number(data.balance)
        : Math.max(0, totalCharges - totalPayments);

    return new Folio({
      id: data.id,
      folioNumber: data.folio_number,
      reservationId: data.reservation_id,
      guestId: data.guest_id,
      branchId: data.branch_id,
      status: data.status,
      roomCharges,
      foodCharges,
      beverageCharges,
      otherCharges,
      totalCharges,
      totalPayments,
      balance,
      settled: data.settled,
      settledAt: data.settled_at ? new Date(data.settled_at) : undefined,
      notes: data.notes,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    });
  }
}
