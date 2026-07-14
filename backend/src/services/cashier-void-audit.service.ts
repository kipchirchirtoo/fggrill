import { supabase } from '../config/database';
import { logger } from '../utils/logger';

type CompileShiftVoidAuditInput = {
  cashierShiftId: string;
  branchId: number;
  cashierId?: string | null;
  shiftStart: string;
  shiftEnd: string;
  outletShiftIds: string[];
  grossRevenue: number;
};

// Persists one cashier_shift_void_audits row per closed cashier_shift_logs
// shift, for the Branch Accountant's read-only void-audit review queue.
// Distinct from loadCashierVoidAudit() above (which is a live, unpersisted
// preview used elsewhere in this controller) — this is the spec'd standing
// record accountants mark reviewed/flag/note against.
export async function compileShiftVoidAudit(input: CompileShiftVoidAuditInput): Promise<void> {
  const shiftIds = input.outletShiftIds;

  const [wholeBillResult, itemVoidResult] = await Promise.all([
    shiftIds.length
      ? supabase.from('pos_void_requests').select('id').in('shift_id', shiftIds).eq('status', 'approved')
      : Promise.resolve({ data: [] as any[], error: null }),
    shiftIds.length
      ? supabase.from('pos_item_void_log').select('amount_voided').in('shift_id', shiftIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);
  if (wholeBillResult.error) throw wholeBillResult.error;
  if (itemVoidResult.error) throw itemVoidResult.error;

  const wholeBillIds = (wholeBillResult.data || []).map((row: any) => row.id);
  let wholeBillValue = 0;
  if (wholeBillIds.length) {
    const { data: auditRows, error: auditErr } = await supabase
      .from('void_bills_audit')
      .select('details')
      .in('void_id', wholeBillIds)
      .eq('action', 'cashier_void');
    if (auditErr) throw auditErr;
    wholeBillValue = (auditRows || []).reduce((sum: number, row: any) => sum + n(row.details?.original_total), 0);
  }

  const itemVoidRows = itemVoidResult.data || [];
  const itemVoidValue = itemVoidRows.reduce((sum: number, row: any) => sum + n(row.amount_voided), 0);

  const totalBillsVoided = wholeBillIds.length;
  const totalItemsVoided = itemVoidRows.length;
  const totalValueVoided = wholeBillValue + itemVoidValue;
  const voidPct = input.grossRevenue > 0 ? (totalValueVoided / input.grossRevenue) * 100 : 0;

  // Only the computed/refresh columns are in this payload, so an upsert on
  // an existing row leaves status/reviewed_by/flagged_by/accountant_note
  // untouched — a recompile never clobbers accountant review state.
  const { error: upsertErr } = await supabase
    .from('cashier_shift_void_audits')
    .upsert({
      shift_id: input.cashierShiftId,
      branch_id: input.branchId,
      cashier_id: input.cashierId || null,
      outlet_shift_ids: shiftIds,
      shift_opened_at: input.shiftStart,
      shift_closed_at: input.shiftEnd,
      total_bills_voided: totalBillsVoided,
      total_items_voided: totalItemsVoided,
      total_value_voided: totalValueVoided,
      gross_shift_revenue: input.grossRevenue,
      void_pct_of_revenue: voidPct,
      updated_at: new Date().toISOString()
    }, { onConflict: 'shift_id' });
  if (upsertErr) throw upsertErr;
}

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
  voided_by?: string | null;
  voided_by_name?: string | null;
  requested_by?: string | null;
  requested_by_name?: string | null;
  actioned_by?: string | null;
  actioned_by_name?: string | null;
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
          .select('*')
          .eq('branch_id', input.branchId)
          .eq('created_by', input.cashierId)
          .gte('created_at', input.shiftStart)
          .lte('created_at', shiftEnd)
      : Promise.resolve({ data: [], error: null }),
    input.cashierId
      ? supabase
          .from('bar_orders')
          .select('*')
          .eq('branch_id', input.branchId)
          .eq('created_by', input.cashierId)
          .gte('created_at', input.shiftStart)
          .lte('created_at', shiftEnd)
      : Promise.resolve({ data: [], error: null }),
    input.cashierShiftId
      ? supabase
          .from('cashier_shift_transactions')
          .select('*')
          .eq('shift_id', input.cashierShiftId)
      : Promise.resolve({ data: [], error: null }),
    posShiftIds.length
      ? supabase
          .from('pos_shift_orders')
          .select('id, order_number, short_code, customer_name, total_amount, payment_status, status, void_request_status, void_reason, voided_at, created_at, payment_method, voided_by')
          .in('shift_id', posShiftIds)
      : Promise.resolve({ data: [], error: null }),
    posShiftIds.length
      ? supabase
          .from('pos_item_void_requests')
          .select('id, shift_id, order_id, order_number, item_name, qty_to_void, unit_price, status, reason, reason_category, actioned_at, created_at, requested_by, actioned_by')
          .in('shift_id', posShiftIds)
          .eq('status', 'approved')
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (restaurantResult.error) throw restaurantResult.error;
  if (barResult.error) throw barResult.error;
  if (paymentVoidResult.error) throw paymentVoidResult.error;
  if (posOrderResult.error) throw posOrderResult.error;
  if (posItemVoidResult.error) throw posItemVoidResult.error;

  // Resolve user names for auditing who authorized/requested the voids
  const userIds = new Set<string>();
  (restaurantResult.data || []).forEach((row: any) => { if (row.voided_by) userIds.add(row.voided_by); });
  (barResult.data || []).forEach((row: any) => { if (row.voided_by) userIds.add(row.voided_by); });
  (posOrderResult.data || []).forEach((row: any) => { if (row.voided_by) userIds.add(row.voided_by); });
  (posItemVoidResult.data || []).forEach((row: any) => {
    if (row.requested_by) userIds.add(row.requested_by);
    if (row.actioned_by) userIds.add(row.actioned_by);
  });

  const userMap = new Map<string, string>();
  if (userIds.size > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .in('id', Array.from(userIds));
    (users || []).forEach((u: any) => {
      userMap.set(String(u.id), `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Staff');
    });
  }

  const lines: CashierVoidAuditLine[] = [];

  for (const row of restaurantResult.data || []) {
    const status = text(row.status || row.payment_status).toLowerCase();
    if (!status.includes('void') && !status.includes('cancel')) continue;
    lines.push({
      id: row.id || null,
      section: 'restaurant_void',
      reference: text(row.order_number || row.id, 'Restaurant order'),
      customer_name: text(row.customer_name || row.guest_name || row.order_type, 'Restaurant order'),
      payment_method: 'other',
      amount: n(row.total_amount),
      status: text(row.status || row.payment_status, 'voided'),
      created_at: row.created_at || null,
      source_table: 'restaurant_orders',
      source_id: row.id || null,
      revenue_type: 'restaurant',
      outlet_type: 'restaurant',
      void_type: 'whole_bill',
      voided_by: row.voided_by || null,
      voided_by_name: row.voided_by ? userMap.get(String(row.voided_by)) || null : null,
      void_reason: row.void_reason || null,
    });
  }

  for (const row of barResult.data || []) {
    const status = text(row.status || row.payment_status).toLowerCase();
    if (!status.includes('void') && !status.includes('cancel')) continue;
    lines.push({
      id: row.id || null,
      section: 'bar_void',
      reference: text(row.order_number || row.id, 'Bar order'),
      customer_name: text(row.customer_name, 'Bar order'),
      payment_method: 'other',
      amount: n(row.total ?? row.subtotal),
      status: text(row.status || row.payment_status, 'voided'),
      created_at: row.created_at || null,
      source_table: 'bar_orders',
      source_id: row.id || null,
      revenue_type: 'bar',
      outlet_type: 'bar',
      void_type: 'whole_bill',
      voided_by: row.voided_by || null,
      voided_by_name: row.voided_by ? userMap.get(String(row.voided_by)) || null : null,
      void_reason: row.void_reason || null,
    });
  }

  for (const row of paymentVoidResult.data || []) {
    if (row?.is_voided !== true && text(row?.status).toLowerCase() !== 'void') continue;
    lines.push({
      id: row.id || null,
      section: 'payment_void',
      reference: text(row.transaction_ref || row.id, 'Voided payment'),
      customer_name: text(row.customer_name, 'Voided cashier payment'),
      payment_method: text(row.payment_method, 'other').toLowerCase(),
      amount: n(row.amount),
      status: 'voided',
      created_at: row.transaction_time || null,
      source_table: 'cashier_shift_transactions',
      source_id: row.id || null,
      void_type: 'payment_void',
      voided_by: row.voided_by || null,
      voided_by_name: row.voided_by ? userMap.get(String(row.voided_by)) || null : null,
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
      voided_by: row.voided_by || null,
      voided_by_name: row.voided_by ? userMap.get(String(row.voided_by)) || null : null,
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
      requested_by: row.requested_by || null,
      requested_by_name: row.requested_by ? userMap.get(String(row.requested_by)) || null : null,
      actioned_by: row.actioned_by || null,
      actioned_by_name: row.actioned_by ? userMap.get(String(row.actioned_by)) || null : null,
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
