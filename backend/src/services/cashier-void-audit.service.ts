import { supabase } from '../config/database';
import { logger } from '../utils/logger';

type VoidAuditInput = {
  branchId: number;
  cashierId?: string | null;
  shiftStart: string;
  shiftEnd?: string | null;
  cashierShiftId?: string | null;
};

export type CashierVoidAuditLine = {
  id: string | null;
  section: string;
  reference: string;
  customer_name: string;
  payment_method: string;
  amount: number;
  status: string;
  created_at: string | null;
  source_table: string;
  source_id: string | null;
  revenue_type?: string | null;
  outlet_type?: string | null;
  void_type: 'whole_bill' | 'item_void' | 'payment_void';
  void_reason?: string | null;
};

export type CashierVoidAuditSummary = {
  total_void_amount: number;
  total_void_count: number;
  whole_bill_void_amount: number;
  whole_bill_void_count: number;
  item_void_amount: number;
  item_void_count: number;
  payment_void_amount: number;
  payment_void_count: number;
};

export type CashierVoidAuditResult = {
  lines: CashierVoidAuditLine[];
  summary: CashierVoidAuditSummary;
};

const n = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const text = (value: unknown, fallback = ''): string => {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : fallback;
};

const isWholeOrderVoided = (row: any): boolean => {
  const status = text(row?.status).toLowerCase();
  const paymentStatus = text(row?.payment_status).toLowerCase();
  const voidRequestStatus = text(row?.void_request_status).toLowerCase();
  return (
    status === 'voided' ||
    paymentStatus === 'voided' ||
    voidRequestStatus === 'approved'
  );
};

async function loadPosShiftIds(input: VoidAuditInput): Promise<string[]> {
  if (!input.cashierId) return [];
  const shiftEnd = input.shiftEnd || new Date().toISOString();

  const { data, error } = await supabase
    .from('pos_outlet_shifts')
    .select('id')
    .eq('branch_id', input.branchId)
    .eq('cashier_id', input.cashierId)
    .lte('opened_at', shiftEnd)
    .or(`closed_at.gte.${input.shiftStart},closed_at.is.null`);

  if (error) {
    logger.warn('Cashier void audit: failed to load POS outlet shifts', {
      branchId: input.branchId,
      cashierId: input.cashierId,
      error: error.message,
    });
    return [];
  }

  return (data || []).map((row: any) => String(row.id)).filter(Boolean);
}

export async function loadCashierVoidAudit(
  input: VoidAuditInput
): Promise<CashierVoidAuditResult> {
  const shiftEnd = input.shiftEnd || new Date().toISOString();
  const posShiftIds = await loadPosShiftIds(input);

  const [
    restaurantResult,
    barResult,
    paymentVoidResult,
    posOrderResult,
    posItemVoidResult,
  ] = await Promise.all([
    input.cashierId
      ? supabase
          .from('restaurant_orders')
          .select('id, order_number, total_amount, payment_method, customer_name, guest_name, order_type, created_at, status, payment_status')
          .eq('branch_id', input.branchId)
          .eq('created_by', input.cashierId)
          .gte('created_at', input.shiftStart)
          .lte('created_at', shiftEnd)
      : Promise.resolve({ data: [], error: null }),
    input.cashierId
      ? supabase
          .from('bar_orders')
          .select('id, order_number, total, subtotal, payment_method, customer_name, guest_name, order_type, created_at, status, payment_status')
          .eq('branch_id', input.branchId)
          .eq('created_by', input.cashierId)
          .gte('created_at', input.shiftStart)
          .lte('created_at', shiftEnd)
      : Promise.resolve({ data: [], error: null }),
    input.cashierShiftId
      ? supabase
          .from('cashier_shift_transactions')
          .select('id, amount, payment_method, description, customer_name, transaction_ref, transaction_time, is_voided, status')
          .eq('shift_id', input.cashierShiftId)
      : Promise.resolve({ data: [], error: null }),
    posShiftIds.length
      ? supabase
          .from('pos_shift_orders')
          .select('id, order_number, short_code, customer_name, total_amount, payment_status, status, void_request_status, void_reason, voided_at, created_at, payment_method')
          .in('shift_id', posShiftIds)
      : Promise.resolve({ data: [], error: null }),
    posShiftIds.length
      ? supabase
          .from('pos_item_void_requests')
          .select('id, shift_id, order_id, order_number, item_name, qty_to_void, unit_price, status, reason, reason_category, actioned_at, created_at')
          .in('shift_id', posShiftIds)
          .eq('status', 'approved')
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (restaurantResult.error) throw restaurantResult.error;
  if (barResult.error) throw barResult.error;
  if (paymentVoidResult.error) throw paymentVoidResult.error;
  if (posOrderResult.error) throw posOrderResult.error;
  if (posItemVoidResult.error) throw posItemVoidResult.error;

  const lines: CashierVoidAuditLine[] = [];

  for (const row of restaurantResult.data || []) {
    const status = text(row.status || row.payment_status).toLowerCase();
    if (!status.includes('void') && !status.includes('cancel')) continue;
    lines.push({
      id: row.id || null,
      section: 'restaurant_void',
      reference: text(row.order_number || row.id, 'Restaurant order'),
      customer_name: text(row.customer_name || row.guest_name || row.order_type, 'Restaurant order'),
      payment_method: text(row.payment_method, 'other').toLowerCase(),
      amount: n(row.total_amount),
      status: text(row.status || row.payment_status, 'voided'),
      created_at: row.created_at || null,
      source_table: 'restaurant_orders',
      source_id: row.id || null,
      revenue_type: 'restaurant',
      outlet_type: 'restaurant',
      void_type: 'whole_bill',
    });
  }

  for (const row of barResult.data || []) {
    const status = text(row.status || row.payment_status).toLowerCase();
    if (!status.includes('void') && !status.includes('cancel')) continue;
    lines.push({
      id: row.id || null,
      section: 'bar_void',
      reference: text(row.order_number || row.id, 'Bar order'),
      customer_name: text(row.customer_name || row.guest_name || row.order_type, 'Bar order'),
      payment_method: text(row.payment_method, 'other').toLowerCase(),
      amount: n(row.total ?? row.subtotal),
      status: text(row.status || row.payment_status, 'voided'),
      created_at: row.created_at || null,
      source_table: 'bar_orders',
      source_id: row.id || null,
      revenue_type: 'bar',
      outlet_type: 'bar',
      void_type: 'whole_bill',
    });
  }

  for (const row of paymentVoidResult.data || []) {
    if (row?.is_voided !== true && text(row?.status).toLowerCase() !== 'void') continue;
    lines.push({
      id: row.id || null,
      section: 'payment_void',
      reference: text(row.transaction_ref || row.id, 'Voided payment'),
      customer_name: text(row.customer_name || row.description, 'Voided cashier payment'),
      payment_method: text(row.payment_method, 'other').toLowerCase(),
      amount: n(row.amount),
      status: 'voided',
      created_at: row.transaction_time || null,
      source_table: 'cashier_shift_transactions',
      source_id: row.id || null,
      void_type: 'payment_void',
    });
  }

  for (const row of posOrderResult.data || []) {
    if (!isWholeOrderVoided(row)) continue;
    lines.push({
      id: row.id || null,
      section: 'pos_void',
      reference: text(row.order_number || row.short_code || row.id, 'POS order'),
      customer_name: text(row.customer_name, 'POS order'),
      payment_method: text(row.payment_method, 'other').toLowerCase(),
      amount: n(row.total_amount),
      status: text(row.status || row.payment_status || row.void_request_status, 'voided'),
      created_at: row.voided_at || row.created_at || null,
      source_table: 'pos_shift_orders',
      source_id: row.id || null,
      revenue_type: 'pos',
      outlet_type: 'pos',
      void_type: 'whole_bill',
      void_reason: text(row.void_reason, ''),
    });
  }

  for (const row of posItemVoidResult.data || []) {
    lines.push({
      id: row.id || null,
      section: 'item_void',
      reference: text(row.order_number || row.order_id || row.id, 'Item void'),
      customer_name: text(row.item_name, 'Voided item'),
      payment_method: 'other',
      amount: n(row.qty_to_void) * n(row.unit_price),
      status: 'voided',
      created_at: row.actioned_at || row.created_at || null,
      source_table: 'pos_item_void_requests',
      source_id: row.id || null,
      revenue_type: 'pos',
      outlet_type: 'pos',
      void_type: 'item_void',
      void_reason: text(row.reason || row.reason_category, ''),
    });
  }

  const summary = lines.reduce<CashierVoidAuditSummary>(
    (acc, line) => {
      acc.total_void_amount += n(line.amount);
      acc.total_void_count += 1;
      if (line.void_type === 'whole_bill') {
        acc.whole_bill_void_amount += n(line.amount);
        acc.whole_bill_void_count += 1;
      } else if (line.void_type === 'item_void') {
        acc.item_void_amount += n(line.amount);
        acc.item_void_count += 1;
      } else if (line.void_type === 'payment_void') {
        acc.payment_void_amount += n(line.amount);
        acc.payment_void_count += 1;
      }
      return acc;
    },
    {
      total_void_amount: 0,
      total_void_count: 0,
      whole_bill_void_amount: 0,
      whole_bill_void_count: 0,
      item_void_amount: 0,
      item_void_count: 0,
      payment_void_amount: 0,
      payment_void_count: 0,
    }
  );

  lines.sort((left, right) => {
    const leftTs = new Date(left.created_at || 0).getTime();
    const rightTs = new Date(right.created_at || 0).getTime();
    return leftTs - rightTs;
  });

  return { lines, summary };
}
