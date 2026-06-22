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

async function fetchOutletsById(outletIds: string[]): Promise<Map<string, any>> {
  if (outletIds.length === 0) return new Map<string, any>();
  const { data, error } = await supabase
    .from('pos_outlets')
    .select('id, name, outlet_code, outlet_type')
    .in('id', outletIds);
  if (error) throw error;
  return new Map((data || []).map((o: any) => [String(o.id), o]));
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

const DEEP_DRILL_COLUMNS = [
  'id', 'shift_id', 'outlet_id', 'source_type', 'source_id', 'order_number',
  'short_code', 'customer_name', 'order_type', 'table_number', 'room_number',
  'waiter_id', 'waiter_name', 'status', 'payment_status', 'kitchen_status',
  'total_amount', 'amount_paid', 'balance_amount', 'items',
  'void_request_status', 'is_split', 'split_parent_order_id', 'split_type',
  'is_merged', 'merged_into', 'staff_credit_bill_id', 'migrated_to_credit_bill',
  'inventory_posted_at', 'inventory_posted_by', 'inventory_reversed_at',
  'inventory_reversed_by', 'kitchen_started_at', 'kitchen_ready_at',
  'kitchen_served_at', 'voided_at', 'voided_by', 'void_reason',
  'captain_printed_at', 'bill_reprint_count', 'created_by', 'created_at',
  'updated_at',
].join(', ');

interface DeepDrillFilters extends DateRange {
  outletId?: string;
  waiterId?: string;
  status?: string;
  paymentStatus?: string;
  search?: string;
  limit: number;
  offset: number;
}

async function fetchDeepDrillOrders(
  outletIds: string[],
  filters: DeepDrillFilters
): Promise<{ rows: any[]; total: number }> {
  if (outletIds.length === 0) return { rows: [], total: 0 };

  let query = supabase
    .from('pos_shift_orders')
    .select(DEEP_DRILL_COLUMNS, { count: 'exact' })
    .in('outlet_id', filters.outletId ? [filters.outletId] : outletIds)
    .order('created_at', { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1);

  if (filters.waiterId) query = query.eq('waiter_id', filters.waiterId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.paymentStatus) query = query.eq('payment_status', filters.paymentStatus);
  if (filters.from) query = query.gte('created_at', filters.from);
  if (filters.to) query = query.lte('created_at', filters.to);
  if (filters.search) {
    const term = filters.search.replace(/[%_]/g, '');
    query = query.or(
      `short_code.ilike.%${term}%,order_number.ilike.%${term}%,customer_name.ilike.%${term}%,waiter_name.ilike.%${term}%,table_number.ilike.%${term}%,room_number.ilike.%${term}%`
    );
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data || [], total: count ?? (data || []).length };
}

async function fetchPaymentsForOrders(orderIds: string[]): Promise<Map<string, any[]>> {
  if (orderIds.length === 0) return new Map<string, any[]>();
  const { data, error } = await supabase
    .from('pos_shift_payments')
    .select('id, order_id, payment_method, amount, reference, received_by, created_at')
    .in('order_id', orderIds);
  if (error) throw error;
  const byOrder = new Map<string, any[]>();
  for (const payment of data || []) {
    const key = String((payment as any).order_id);
    if (!byOrder.has(key)) byOrder.set(key, []);
    byOrder.get(key)!.push(payment);
  }
  return byOrder;
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

/**
 * Full audit feed of every POS order at the branch (not just per-waiter),
 * with every column on pos_shift_orders plus resolved outlet name, waiter
 * name, linked credit bill, and the payments that cleared/part-cleared it.
 * Backs the "Deep Drill" view linked from Staff POS Accounting.
 */
export const getPosDeepDrillOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) throw new AppError('Authentication required', 401);
    const branchId = resolveBranchId(req);
    const range = dateRangeFrom(req);
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const outletIds = await resolveOutletIdsForBranch(branchId);
    const { rows: orders, total } = await fetchDeepDrillOrders(outletIds, {
      ...range,
      outletId: String(req.query.outlet_id || '').trim() || undefined,
      waiterId: String(req.query.waiter_id || '').trim() || undefined,
      status: String(req.query.status || '').trim() || undefined,
      paymentStatus: String(req.query.payment_status || '').trim() || undefined,
      search: String(req.query.search || '').trim() || undefined,
      limit,
      offset,
    });

    const outletsById = await fetchOutletsById(outletIds);

    const waiterIds = Array.from(
      new Set(orders.map((o) => o.waiter_id).filter((id): id is string => Boolean(id)))
    );
    const { usersById, profilesByUserId } = await fetchStaffDirectory(waiterIds);

    const creditBillIds = Array.from(
      new Set(orders.map((o) => o.staff_credit_bill_id).filter((id): id is string => Boolean(id)))
    );
    const creditBillsById = await fetchCreditBills(creditBillIds);

    const orderIds = orders.map((o) => String(o.id));
    const paymentsByOrder = await fetchPaymentsForOrders(orderIds);

    const rows = orders.map((order) => {
      const waiterId = order.waiter_id ? String(order.waiter_id) : null;
      const user = waiterId ? usersById.get(waiterId) : null;
      const profile = waiterId ? profilesByUserId.get(waiterId) : null;
      const outlet = order.outlet_id ? outletsById.get(String(order.outlet_id)) : null;
      const payments = paymentsByOrder.get(String(order.id)) || [];

      return {
        ...order,
        outlet_name: outlet?.name || null,
        outlet_code: outlet?.outlet_code || null,
        outlet_type: outlet?.outlet_type || null,
        waiter_resolved_name: user
          ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
          : order.waiter_name || null,
        waiter_role: user?.role || null,
        waiter_employee_number: profile?.employee_number || null,
        clearance_status: clearanceStatusFor(order, creditBillsById),
        credit_bill: order.staff_credit_bill_id
          ? creditBillsById.get(String(order.staff_credit_bill_id)) || null
          : null,
        payments,
        cleared_at: payments.length > 0
          ? payments.reduce((latest: string | null, p: any) =>
              !latest || (p.created_at && p.created_at > latest) ? p.created_at : latest, null)
          : null,
      };
    });

    res.json({ success: true, data: rows, total, limit, offset });
  } catch (error) {
    next(error);
  }
};
