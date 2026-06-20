import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { isGlobalRole } from '../utils/branchIsolation';

/**
 * Per-waiter/bartender accounting across all POS outlets at a branch.
 *
 * pos_shift_orders has no branch_id column directly, so branch scoping is
 * done by first resolving the branch's pos_outlets, then filtering orders
 * by outlet_id. "Cleared vs outstanding" is derived from existing data
 * (payment_status / balance_amount / linked staff_credit_bills.status)
 * rather than a new column, since no accountant sign-off state exists yet.
 */

const OUTSTANDING_CREDIT_STATUSES = new Set(['pending', 'accountant_confirmed', 'auditor_confirmed']);

function parseBranchId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function resolveBranchId(req: Request): number {
  const userBranchId = parseBranchId(req.user?.branch_id ?? req.user?.branchId);
  const requested = parseBranchId(req.query.branch_id);
  const isGlobal = isGlobalRole(req.user?.role);

  if (!isGlobal) {
    if (!userBranchId) {
      throw new AppError('Branch context is required for staff POS accounting', 403);
    }
    if (requested && requested !== userBranchId) {
      throw new AppError('Forbidden: cannot access staff accounting for another branch', 403);
    }
    return userBranchId;
  }

  const effectiveBranchId = requested || userBranchId;
  if (!effectiveBranchId) {
    throw new AppError('branch_id is required for staff POS accounting', 400);
  }
  return effectiveBranchId;
}

type DateRange = { from?: string; to?: string };

function dateRangeFrom(req: Request): DateRange {
  const from = String(req.query.from || '').trim();
  const to = String(req.query.to || '').trim();
  return {
    from: from || undefined,
    to: to || undefined,
  };
}

async function resolveOutletIdsForBranch(branchId: number): Promise<string[]> {
  const { data, error } = await supabase
    .from('pos_outlets')
    .select('id')
    .eq('branch_id', branchId);
  if (error) throw error;
  return (data || []).map((row: any) => row.id);
}

interface StaffOrderRow {
  id: string;
  waiter_id: string | null;
  waiter_name: string | null;
  total_amount: number | string | null;
  balance_amount: number | string | null;
  payment_status: string | null;
  staff_credit_bill_id: string | null;
  order_type: string | null;
  outlet_id: string | null;
  created_at: string | null;
}

async function fetchOrdersForBranch(
  outletIds: string[],
  range: DateRange,
  extra?: { waiterId?: string }
): Promise<StaffOrderRow[]> {
  if (outletIds.length === 0) return [];

  let query = supabase
    .from('pos_shift_orders')
    .select(
      'id, waiter_id, waiter_name, total_amount, balance_amount, payment_status, staff_credit_bill_id, order_type, outlet_id, created_at'
    )
    .in('outlet_id', outletIds)
    .not('waiter_id', 'is', null)
    .order('created_at', { ascending: false });

  if (extra?.waiterId) {
    query = query.eq('waiter_id', extra.waiterId);
  }
  if (range.from) {
    query = query.gte('created_at', range.from);
  }
  if (range.to) {
    query = query.lte('created_at', range.to);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as StaffOrderRow[];
}

async function fetchStaffDirectory(
  waiterIds: string[]
): Promise<{ usersById: Map<string, any>; profilesByUserId: Map<string, any> }> {
  if (waiterIds.length === 0) {
    return { usersById: new Map<string, any>(), profilesByUserId: new Map<string, any>() };
  }

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, first_name, last_name, role')
    .in('id', waiterIds);
  if (usersError) throw usersError;

  const { data: profiles, error: profilesError } = await supabase
    .from('staff_profiles')
    .select('id, user_id, employee_number, department, profile_photo')
    .in('user_id', waiterIds);
  if (profilesError) throw profilesError;

  return {
    usersById: new Map((users || []).map((u: any) => [String(u.id), u])),
    profilesByUserId: new Map((profiles || []).map((p: any) => [String(p.user_id), p])),
  };
}

async function fetchCreditBills(creditBillIds: string[]): Promise<Map<string, any>> {
  if (creditBillIds.length === 0) return new Map<string, any>();
  const { data, error } = await supabase
    .from('staff_credit_bills')
    .select('id, status, amount, balance')
    .in('id', creditBillIds);
  if (error) throw error;
  return new Map((data || []).map((b: any) => [String(b.id), b]));
}

function clearanceStatusFor(
  order: StaffOrderRow,
  creditBillsById: Map<string, any>
): 'cleared' | 'outstanding' {
  if (order.staff_credit_bill_id) {
    const bill = creditBillsById.get(String(order.staff_credit_bill_id));
    if (bill && OUTSTANDING_CREDIT_STATUSES.has(String(bill.status))) {
      return 'outstanding';
    }
  }
  if (Number(order.balance_amount || 0) > 0) {
    return 'outstanding';
  }
  return 'cleared';
}

export const getStaffPosAccountingSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) throw new AppError('Authentication required', 401);
    const branchId = resolveBranchId(req);
    const range = dateRangeFrom(req);
    const roleFilter = String(req.query.role || '').trim().toLowerCase();

    const outletIds = await resolveOutletIdsForBranch(branchId);
    const orders = await fetchOrdersForBranch(outletIds, range);

    const waiterIds = Array.from(new Set(orders.map((o) => String(o.waiter_id)).filter(Boolean)));
    const { usersById, profilesByUserId } = await fetchStaffDirectory(waiterIds);

    const creditBillIds = Array.from(
      new Set(orders.map((o) => o.staff_credit_bill_id).filter((id): id is string => Boolean(id)))
    );
    const creditBillsById = await fetchCreditBills(creditBillIds);

    const summaryByWaiter = new Map<string, Record<string, any>>();

    for (const order of orders) {
      const waiterId = String(order.waiter_id);
      const user = usersById.get(waiterId);
      const role = String(user?.role || '').toLowerCase();
      if (roleFilter && role !== roleFilter) continue;

      const profile = profilesByUserId.get(waiterId);
      const amount = Number(order.total_amount || 0);
      const status = clearanceStatusFor(order, creditBillsById);

      if (!summaryByWaiter.has(waiterId)) {
        const name = user
          ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
          : order.waiter_name || 'Unknown';
        summaryByWaiter.set(waiterId, {
          waiter_id: waiterId,
          name: name || order.waiter_name || 'Unknown',
          role: user?.role || null,
          employee_number: profile?.employee_number || null,
          department: profile?.department || null,
          profile_photo: profile?.profile_photo || null,
          total_orders: 0,
          total_sales: 0,
          total_cleared: 0,
          total_outstanding: 0,
          outstanding_order_count: 0,
        });
      }

      const entry = summaryByWaiter.get(waiterId);
      if (!entry) continue;
      entry.total_orders += 1;
      entry.total_sales += amount;
      if (status === 'outstanding') {
        entry.total_outstanding += amount;
        entry.outstanding_order_count += 1;
      } else {
        entry.total_cleared += amount;
      }
    }

    res.json({ success: true, data: Array.from(summaryByWaiter.values()) });
  } catch (error) {
    next(error);
  }
};

export const getStaffPosAccountingOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) throw new AppError('Authentication required', 401);
    const branchId = resolveBranchId(req);
    const range = dateRangeFrom(req);
    const waiterId = String(req.params.waiterId || '').trim();
    if (!waiterId) throw new AppError('waiterId is required', 400);

    const outletIds = await resolveOutletIdsForBranch(branchId);
    const orders = await fetchOrdersForBranch(outletIds, range, { waiterId });

    const creditBillIds = Array.from(
      new Set(orders.map((o) => o.staff_credit_bill_id).filter((id): id is string => Boolean(id)))
    );
    const creditBillsById = await fetchCreditBills(creditBillIds);

    const rows = orders.map((order) => ({
      ...order,
      clearance_status: clearanceStatusFor(order, creditBillsById),
      credit_bill: order.staff_credit_bill_id
        ? creditBillsById.get(String(order.staff_credit_bill_id)) || null
        : null,
    }));

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};
