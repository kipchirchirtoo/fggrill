import { Request } from 'express';
import { supabase } from '../config/supabase';
import db from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { isGlobalRole } from '../utils/branchIsolation';
import {
  isCashierStationRole,
  resolveCashierStationRole,
} from '../utils/posStationAccess';

// ============================================================================
// Shared, multi-branch Cashier Expenses & Petty Cash service.
//
// One canonical implementation used by the generic /cashier/expenses routes AND
// the legacy /kyogong/petty-cash compatibility aliases. Cashier-facing roles are
// hard-scoped to their OWN currently-open cashier_shift_logs record (shift_id +
// branch_id are derived server-side; any client-supplied branch/shift/date/
// history filters are ignored). Management roles get branch-permissioned history.
// ============================================================================

// Reception cashiers behave like station cashiers for expenses: scoped to their
// own active shift.
const RECEPTION_CASHIER_ROLES = new Set([
  'receptionist',
  'branch_receptionist',
  'front_desk_supervisor',
  'kyogong_reception_cashier',
]);

// Roles allowed to read historical (cross-shift) expenses, branch-permissioned.
const MANAGEMENT_ROLES = new Set([
  'super_admin',
  'general_manager',
  'branch_manager',
  'branch_accountant',
  'accountant',
  'auditor',
  'director',
]);

export const PETTY_CASH_CATEGORIES = [
  { code: 'REPAIRS', name: 'Repairs' },
  { code: 'MAINTENANCE', name: 'Maintenance' },
  { code: 'FUEL', name: 'Fuel' },
  { code: 'TRANSPORT', name: 'Staff Transport' },
  { code: 'SUPPLIES', name: 'Supplies' },
  { code: 'OTHER', name: 'Other' },
];

type ShiftRow = { id: string; branch_id: number; cashier_id: string; status: string };

export type ExpenseScope =
  | { mode: 'cashier'; userId: string; role: string; branchId: number; shiftId: string }
  | { mode: 'management'; userId: string; role: string; branchId: number | null; global: boolean };

const normalizedRole = (req: Request): string =>
  resolveCashierStationRole(req.user?.role, req.user?.branch_id);

const isCashierFacing = (req: Request): boolean => {
  const role = normalizedRole(req);
  return isCashierStationRole(role, req.user?.branch_id) || RECEPTION_CASHIER_ROLES.has(role);
};

const isManagement = (req: Request): boolean => MANAGEMENT_ROLES.has(normalizedRole(req));

// The caller's currently-open cashier logbook shift (multi-branch). This is the
// single source of truth for a cashier's shift_id AND branch_id.
export const resolveActiveCashierShift = async (userId: string): Promise<ShiftRow | null> => {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('cashier_shift_logs')
    .select('id, branch_id, cashier_id, status')
    .eq('cashier_id', userId)
    .eq('status', 'open')
    .order('shift_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ShiftRow) || null;
};

// Resolve the authoritative scope for a request. Cashiers are pinned to their
// active shift; management is pinned to their authorized branch.
export const resolveExpenseScope = async (req: Request): Promise<ExpenseScope> => {
  const userId = String(req.user?.id || '');
  const role = normalizedRole(req);
  const userBranch = req.user?.branch_id ? Number(req.user.branch_id) : null;

  if (isCashierFacing(req)) {
    const shift = await resolveActiveCashierShift(userId);
    if (!shift) {
      throw new AppError('No open cashier shift — open your shift to record or view expenses.', 400);
    }
    return { mode: 'cashier', userId, role, branchId: Number(shift.branch_id), shiftId: String(shift.id) };
  }

  if (isManagement(req)) {
    const global = isGlobalRole(role);
    // Global roles may target a branch (or all authorized when omitted). Branch-
    // scoped management is forced to their OWN branch regardless of any query.
    let branchId: number | null;
    if (global) {
      const requested = Number(req.query.branch_id);
      branchId = Number.isFinite(requested) && requested > 0 ? requested : null;
    } else {
      branchId = userBranch && userBranch > 0 ? userBranch : -1; // -1 => empty, never leak
    }
    return { mode: 'management', userId, role, branchId, global };
  }

  throw new AppError('Not permitted to access cashier expenses.', 403);
};

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

// ── Record ──────────────────────────────────────────────────────────────────
// Recording ALWAYS binds to the caller's own active shift (shift_id + branch_id
// derived from cashier_shift_logs). Client-supplied branch/shift are ignored.
export const recordExpense = async (req: Request): Promise<any> => {
  const userId = String(req.user?.id || '');
  const shift = await resolveActiveCashierShift(userId);
  if (!shift) {
    throw new AppError('No open cashier shift — open your shift before recording an expense.', 400);
  }
  const branchId = Number(shift.branch_id);
  const shiftId = String(shift.id);

  const body = req.body || {};
  const amount = num(body.amount);
  const category = String(body.category || body.purpose_category || '').trim();
  const description = String(body.description || body.purpose_description || '').trim();
  const paidToName = body.paid_to_name ? String(body.paid_to_name) : null;
  const receiptNumber = body.receipt_number ? String(body.receipt_number) : null;
  const poReference = body.po_reference ? String(body.po_reference) : null;

  if (!(amount > 0) || !category || !description) {
    throw new AppError('Amount (greater than zero), category and description are required.', 400);
  }

  const entry = await insertExpenseRow({
    branchId, shiftId, amount, category, description, paidToName, receiptNumber, poReference, recordedBy: userId,
  });

  await applyShiftCashOut(shiftId, amount);
  await recordPayoutTransaction({ branchId, shiftId, amount, category, description, poReference, recordedBy: userId });
  if (poReference) {
    await markPurchaseOrderPaid(poReference, userId, shiftId);
  }

  return entry;
};

// Insert into the canonical shift_reconciliation_expenses table, with a fallback
// for any legacy category CHECK constraint (23514).
const insertExpenseRow = async (p: {
  branchId: number; shiftId: string; amount: number; category: string; description: string;
  paidToName: string | null; receiptNumber: string | null; poReference: string | null; recordedBy: string;
}): Promise<any> => {
  const payload = {
    branch_id: p.branchId,
    shift_id: p.shiftId,
    amount: p.amount,
    category: p.category,
    description: p.description,
    paid_to_name: p.paidToName,
    receipt_number: p.receiptNumber,
    po_reference: p.poReference,
    recorded_by: p.recordedBy,
  };
  const { data, error } = await supabase
    .from('shift_reconciliation_expenses').insert(payload).select('*').single();
  if (!error) return data;

  if (error.code === '23514') {
    const allowed = ['petty_cash', 'transaction_cost', 'other'];
    const fallbackCat = allowed.includes(p.category.toLowerCase()) ? p.category.toLowerCase() : 'other';
    const fallbackDesc = p.description.toLowerCase().includes(p.category.toLowerCase())
      ? p.description
      : `[${p.category}] ${p.description}`;
    const fb = await supabase.from('shift_reconciliation_expenses')
      .insert({ ...payload, category: fallbackCat, description: fallbackDesc }).select('*').single();
    if (fb.error) throw fb.error;
    return fb.data;
  }
  throw error;
};

// Single atomic decrement — cash and expense totals each move by exactly one
// `amount` (no double-apply).
const applyShiftCashOut = async (shiftId: string, amount: number): Promise<void> => {
  try {
    await db.query(
      `UPDATE cashier_shift_logs
         SET expense_total = COALESCE(expense_total, 0) + $1,
             cash_at_hand  = GREATEST(0, COALESCE(cash_at_hand, opening_float, 0) - $1),
             updated_at    = NOW()
       WHERE id = $2`,
      [Number(amount), shiftId]
    );
  } catch (err) {
    logger.warn('cashier-expenses: failed to update shift cash_at_hand/expense_total', err as any);
  }
};

const recordPayoutTransaction = async (p: {
  branchId: number; shiftId: string; amount: number; category: string; description: string;
  poReference: string | null; recordedBy: string;
}): Promise<void> => {
  try {
    await supabase.from('cashier_transactions').insert({
      branch_id: p.branchId,
      cashier_shift_log_id: p.shiftId,
      amount: Number(p.amount),
      payment_method: 'CASH',
      revenue_type: 'EXPENSE',
      transaction_type: 'PAYOUT',
      status: 'completed',
      notes: `${p.category}: ${p.description}`,
      source_document_type: p.poReference ? 'PO' : 'PETTY_CASH',
      recorded_by: p.recordedBy,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn('cashier-expenses: failed to insert PAYOUT cashier_transaction', err as any);
  }
};

// Tag the PO paid and stamp WHO paid it and from WHICH shift.
const markPurchaseOrderPaid = async (poReference: string, cashierId: string, shiftId: string): Promise<void> => {
  try {
    await supabase.from('purchase_orders').update({
      finance_status: 'paid',
      paid_by_cashier_id: cashierId,
      paid_shift_id: shiftId,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).or(`po_number.eq.${poReference},id.eq.${poReference}`);
  } catch (err) {
    logger.warn('cashier-expenses: failed to stamp PO payment', err as any);
  }
};

// ── List ────────────────────────────────────────────────────────────────────
export const listExpenses = async (req: Request): Promise<any[]> => {
  const scope = await resolveExpenseScope(req);

  let query = supabase
    .from('shift_reconciliation_expenses')
    .select('*, recorded_by_user:users!recorded_by(id, first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(500);

  if (scope.mode === 'cashier') {
    // Active shift only — branch + shift derived, client filters ignored.
    query = query.eq('branch_id', scope.branchId).eq('shift_id', scope.shiftId);
  } else {
    if (scope.branchId !== null) query = query.eq('branch_id', scope.branchId);
    // Management history filters (branch-permissioned above).
    const { shift_id, start_date, end_date, category } = req.query;
    if (shift_id) query = query.eq('shift_id', String(shift_id));
    if (start_date) query = query.gte('created_at', String(start_date));
    if (end_date) query = query.lte('created_at', String(end_date));
    if (category) query = query.eq('category', String(category));
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

// ── Summary ─────────────────────────────────────────────────────────────────
export const summarizeExpenses = async (req: Request): Promise<any> => {
  const scope = await resolveExpenseScope(req);

  let query = supabase.from('shift_reconciliation_expenses').select('amount, category');
  if (scope.mode === 'cashier') {
    query = query.eq('branch_id', scope.branchId).eq('shift_id', scope.shiftId);
  } else {
    if (scope.branchId !== null) query = query.eq('branch_id', scope.branchId);
    const { shift_id, start_date, end_date } = req.query;
    if (shift_id) query = query.eq('shift_id', String(shift_id));
    if (start_date) query = query.gte('created_at', String(start_date));
    if (end_date) query = query.lte('created_at', String(end_date));
  }

  const { data, error } = await query;
  if (error) throw error;

  const summary = { total_cash_in: 0, total_cash_out: 0, net_balance: 0, by_category: {} as Record<string, number> };
  for (const row of data || []) {
    const amt = num((row as any).amount);
    summary.total_cash_out += amt;
    const cat = (row as any).category || 'OTHER';
    summary.by_category[cat] = (summary.by_category[cat] || 0) + amt;
  }
  summary.net_balance = summary.total_cash_in - summary.total_cash_out;
  return summary;
};

// ── Categories ──────────────────────────────────────────────────────────────
export const getCategories = (): typeof PETTY_CASH_CATEGORIES => PETTY_CASH_CATEGORIES;

// ── Pending cash POs ──────────────────────────────────────────────────────────
// Filtered by the ACTIVE SHIFT's branch for cashiers; by authorized branch for
// management.
export const listPendingCashPOs = async (req: Request): Promise<any[]> => {
  const scope = await resolveExpenseScope(req);
  const branchId = scope.branchId;

  let query = supabase
    .from('purchase_orders')
    .select('*')
    .in('status', ['approved', 'APPROVED', 'received', 'RECEIVED', 'fully_received'])
    .order('created_at', { ascending: false });
  if (branchId !== null) query = query.eq('branch_id', branchId);

  const { data: pos, error } = await query;
  if (error) {
    const rows = await db.query(
      `SELECT po.*, s.name as supplier_name
         FROM purchase_orders po
         LEFT JOIN suppliers s ON po.supplier_id = s.id
        WHERE LOWER(po.status) IN ('approved','received','fully_received')
          ${branchId !== null ? 'AND po.branch_id = $1' : ''}
        ORDER BY po.created_at DESC LIMIT 100`,
      branchId !== null ? [branchId] : []
    );
    return rows.rows || [];
  }

  const supplierIds = (pos || []).map((p: any) => p.supplier_id || p.vendor_id).filter(Boolean);
  let supplierMap = new Map<string, string>();
  if (supplierIds.length) {
    const { data: suppliers } = await supabase.from('suppliers').select('id, name').in('id', supplierIds);
    supplierMap = new Map((suppliers || []).map((s: any) => [s.id, s.name]));
  }
  return (pos || []).map((p: any) => ({
    ...p,
    supplier_name: p.supplier_name || supplierMap.get(p.supplier_id || p.vendor_id) || 'Supplier',
  }));
};
