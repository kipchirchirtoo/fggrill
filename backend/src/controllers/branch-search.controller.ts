import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import { isGlobalRole } from '../utils/branchIsolation';

// ============================================================================
// Branch-strict universal search.
//
// One endpoint searches across every meaningful branch-scoped entity (staff,
// financials, POS orders, shifts, purchases, rooms, etc.). A registry describes
// each entity: which table, which columns are searchable, how to build a
// title/subtitle, and which fields a branch accountant may edit/delete.
//
// Branch isolation: non-global roles are ALWAYS pinned to their own branch
// (req.user.branch_id). Global roles may pass ?branch_id=.
// ============================================================================

type BranchMode = 'eq' | 'nullable' | 'requisition';

interface EntityConfig {
  type: string;
  label: string;
  group: string;
  icon: string;
  table: string;
  branchColumn: string; // physical branch column (used for write checks)
  branchMode: BranchMode;
  searchColumns: string[];
  titleColumns: string[];
  subtitleColumns: string[];
  dateColumn?: string;
  amountColumn?: string;
  statusColumn?: string;
  editableColumns: string[];
  deletable: boolean;
  creatable: boolean;
  requiredOnCreate?: string[];
}

const REGISTRY: EntityConfig[] = [
  // ── Staff & HR ────────────────────────────────────────────────────────────
  {
    type: 'staff', label: 'Staff', group: 'Staff & HR', icon: 'user', table: 'staff_profiles',
    branchColumn: 'branch_id', branchMode: 'eq',
    searchColumns: ['first_name', 'last_name', 'email', 'phone', 'employee_number', 'position', 'department', 'role', 'mpesa_number', 'kra_pin'],
    titleColumns: ['first_name', 'last_name'], subtitleColumns: ['position', 'department', 'role'],
    dateColumn: 'start_date', statusColumn: 'status',
    editableColumns: ['first_name', 'last_name', 'email', 'phone', 'position', 'department', 'shift', 'basic_salary', 'hourly_base_rate', 'bank_name', 'bank_branch', 'account_number', 'mpesa_number', 'kra_pin', 'nssf_number', 'nhif_number', 'shif_number', 'emergency_contact', 'next_of_kin_name', 'next_of_kin_phone', 'next_of_kin_relationship', 'employment_type', 'status'],
    deletable: false, creatable: false,
  },
  {
    type: 'user_account', label: 'User Account', group: 'Staff & HR', icon: 'identification', table: 'users',
    branchColumn: 'branch_id', branchMode: 'eq',
    searchColumns: ['email', 'first_name', 'last_name', 'phone_number', 'role', 'department'],
    titleColumns: ['first_name', 'last_name'], subtitleColumns: ['role', 'email'],
    statusColumn: 'status',
    editableColumns: ['first_name', 'last_name', 'phone_number', 'department', 'shift', 'status'],
    deletable: false, creatable: false,
  },
  {
    type: 'attendance', label: 'Attendance', group: 'Staff & HR', icon: 'clock', table: 'staff_attendance',
    branchColumn: 'branch_id', branchMode: 'eq',
    searchColumns: ['status', 'notes'],
    titleColumns: ['status'], subtitleColumns: ['date'],
    dateColumn: 'date', statusColumn: 'status',
    editableColumns: ['status', 'notes', 'overtime_hours'],
    deletable: false, creatable: false,
  },
  {
    type: 'payroll_record', label: 'Payroll Record', group: 'Staff & HR', icon: 'money', table: 'payroll_records',
    branchColumn: 'branch_id', branchMode: 'eq',
    searchColumns: ['id'],
    titleColumns: ['id'], subtitleColumns: ['payment_status'],
    dateColumn: 'created_at', amountColumn: 'net_pay',
    editableColumns: [],
    deletable: false, creatable: false,
  },
  {
    type: 'staff_loan', label: 'Staff Loan', group: 'Staff & HR', icon: 'money', table: 'staff_loans',
    branchColumn: 'branch_id', branchMode: 'eq',
    searchColumns: ['status'],
    titleColumns: ['id'], subtitleColumns: ['status'],
    dateColumn: 'loan_date', amountColumn: 'total_amount', statusColumn: 'status',
    editableColumns: ['status', 'monthly_installment', 'installment_amount', 'remaining_balance'],
    deletable: true, creatable: false,
  },
  {
    type: 'staff_advance', label: 'Salary Advance', group: 'Staff & HR', icon: 'money', table: 'staff_advances',
    branchColumn: 'branch_id', branchMode: 'eq',
    searchColumns: ['status'],
    titleColumns: ['id'], subtitleColumns: ['status'],
    dateColumn: 'advance_date', amountColumn: 'amount', statusColumn: 'status',
    editableColumns: ['status', 'amount'],
    deletable: true, creatable: false,
  },
  {
    type: 'staff_credit_bill', label: 'Staff Credit Bill', group: 'Staff & HR', icon: 'receipt', table: 'staff_credit_bills',
    branchColumn: 'branch_id', branchMode: 'eq',
    searchColumns: ['description', 'status'],
    titleColumns: ['description'], subtitleColumns: ['status'],
    dateColumn: 'bill_date', amountColumn: 'amount', statusColumn: 'status',
    editableColumns: ['description', 'status'],
    deletable: false, creatable: false,
  },
  // ── Financial ───────────────────────────────────────────────────────────
  {
    type: 'expense', label: 'Expense', group: 'Financial', icon: 'money', table: 'expenses',
    branchColumn: 'branch_id', branchMode: 'eq',
    searchColumns: ['category', 'description', 'status'],
    titleColumns: ['category'], subtitleColumns: ['description'],
    dateColumn: 'expense_date', amountColumn: 'amount', statusColumn: 'status',
    editableColumns: ['category', 'description', 'amount', 'status'],
    deletable: true, creatable: true, requiredOnCreate: ['category', 'amount'],
  },
  {
    type: 'banking', label: 'Banking Transaction', group: 'Financial', icon: 'bank', table: 'banking_transactions',
    branchColumn: 'branch_id', branchMode: 'eq',
    searchColumns: ['bank_name', 'account_name', 'transaction_type', 'status'],
    titleColumns: ['transaction_type', 'bank_name'], subtitleColumns: ['account_name'],
    dateColumn: 'transaction_date', amountColumn: 'amount', statusColumn: 'status',
    editableColumns: ['bank_name', 'account_name', 'account_number', 'amount', 'status'],
    deletable: true, creatable: true, requiredOnCreate: ['transaction_type', 'amount'],
  },
  {
    type: 'petty_cash', label: 'Petty Cash', group: 'Financial', icon: 'money', table: 'petty_cash_transactions',
    branchColumn: 'branch_id', branchMode: 'eq',
    searchColumns: ['description', 'status'],
    titleColumns: ['id'], subtitleColumns: ['description'],
    dateColumn: 'date', amountColumn: 'amount', statusColumn: 'status',
    editableColumns: ['description', 'amount', 'status'],
    deletable: true, creatable: true, requiredOnCreate: ['amount'],
  },
  {
    type: 'journal_entry', label: 'Journal Entry', group: 'Financial', icon: 'book', table: 'accounting_journal_entries',
    branchColumn: 'branch_id', branchMode: 'eq',
    searchColumns: ['description', 'reference', 'status'],
    titleColumns: ['id'], subtitleColumns: ['reference'],
    dateColumn: 'entry_date', amountColumn: 'total_debit', statusColumn: 'status',
    editableColumns: ['description', 'reference', 'status'],
    deletable: false, creatable: false,
  },
  {
    type: 'approval', label: 'Approval Request', group: 'Financial', icon: 'check', table: 'approval_requests',
    branchColumn: 'branch_id', branchMode: 'eq',
    searchColumns: ['request_type', 'description', 'status'],
    titleColumns: ['request_type'], subtitleColumns: ['description', 'status'],
    dateColumn: 'created_at', amountColumn: 'amount', statusColumn: 'status',
    editableColumns: ['status', 'notes'],
    deletable: false, creatable: false,
  },
  // ── POS & Orders ──────────────────────────────────────────────────────────
  {
    type: 'restaurant_order', label: 'Restaurant Order', group: 'POS & Orders', icon: 'fork', table: 'restaurant_orders',
    branchColumn: 'branch_id', branchMode: 'eq',
    searchColumns: ['order_number', 'status', 'payment_method', 'payment_status'],
    titleColumns: ['order_number'], subtitleColumns: ['status'],
    dateColumn: 'created_at', amountColumn: 'grand_total', statusColumn: 'status',
    editableColumns: ['status', 'payment_status', 'audit_notes'],
    deletable: false, creatable: false,
  },
  {
    type: 'bar_order', label: 'Bar Order', group: 'POS & Orders', icon: 'wine', table: 'bar_orders',
    branchColumn: 'branch_id', branchMode: 'eq',
    searchColumns: ['order_number', 'status', 'payment_method', 'payment_status'],
    titleColumns: ['order_number'], subtitleColumns: ['status'],
    dateColumn: 'created_at', amountColumn: 'total', statusColumn: 'status',
    editableColumns: ['status', 'payment_status', 'audit_notes'],
    deletable: false, creatable: false,
  },
  {
    type: 'cashier_transaction', label: 'Cashier Transaction', group: 'POS & Orders', icon: 'receipt', table: 'cashier_transactions',
    branchColumn: 'branch_id', branchMode: 'eq',
    searchColumns: ['transaction_number', 'customer_name', 'customer_phone', 'payment_reference', 'transaction_type', 'revenue_type'],
    titleColumns: ['transaction_number'], subtitleColumns: ['customer_name', 'revenue_type'],
    dateColumn: 'transaction_date', amountColumn: 'amount',
    editableColumns: [],
    deletable: false, creatable: false,
  },
  {
    type: 'shift_transaction', label: 'Shift Transaction', group: 'POS & Orders', icon: 'receipt', table: 'shift_transactions',
    branchColumn: 'branch_id', branchMode: 'eq',
    searchColumns: ['customer_name', 'customer_phone', 'service_category', 'transaction_type', 'mpesa_reference'],
    titleColumns: ['id'], subtitleColumns: ['customer_name', 'service_category'],
    dateColumn: 'created_at', amountColumn: 'total_amount',
    editableColumns: ['void_reason'],
    deletable: false, creatable: false,
  },
  // ── Shifts ──────────────────────────────────────────────────────────────
  {
    type: 'cashier_shift_log', label: 'Cashier Shift Log', group: 'Shifts', icon: 'clock', table: 'cashier_shift_logs',
    branchColumn: 'branch_id', branchMode: 'eq',
    searchColumns: ['shift_number', 'cashier_name', 'status', 'bank_deposit_ref'],
    titleColumns: ['shift_number', 'cashier_name'], subtitleColumns: ['status'],
    dateColumn: 'shift_start', amountColumn: 'total_sales', statusColumn: 'status',
    editableColumns: ['reconciliation_notes', 'verification_notes', 'notes', 'status'],
    deletable: false, creatable: false,
  },
  {
    type: 'cashier_shift', label: 'Cashier Shift', group: 'Shifts', icon: 'clock', table: 'cashier_shifts',
    branchColumn: 'branch_id', branchMode: 'eq',
    searchColumns: ['shift_number', 'status'],
    titleColumns: ['shift_number'], subtitleColumns: ['status'],
    dateColumn: 'shift_date', amountColumn: 'total_revenue', statusColumn: 'status',
    editableColumns: ['status'],
    deletable: false, creatable: false,
  },
  // ── Purchases & Procurement ───────────────────────────────────────────────
  {
    type: 'kitchen_requisition', label: 'Kitchen Requisition', group: 'Purchases', icon: 'cart', table: 'kitchen_requisitions',
    branchColumn: 'branch_id', branchMode: 'eq',
    searchColumns: ['reason', 'status', 'notes'],
    titleColumns: ['id'], subtitleColumns: ['status'],
    dateColumn: 'requested_at', statusColumn: 'status',
    editableColumns: ['reason', 'status', 'notes'],
    deletable: false, creatable: false,
  },
  {
    type: 'purchase_order', label: 'Purchase Order', group: 'Purchases', icon: 'cart', table: 'store_purchase_orders',
    branchColumn: 'branch_id', branchMode: 'requisition',
    searchColumns: ['po_number', 'status'],
    titleColumns: ['po_number'], subtitleColumns: ['status'],
    dateColumn: 'po_date', amountColumn: 'total_amount', statusColumn: 'status',
    editableColumns: ['status', 'expected_delivery_date'],
    deletable: false, creatable: false,
  },
  // ── Rooms & Bookings ──────────────────────────────────────────────────────
  {
    type: 'reservation', label: 'Reservation', group: 'Rooms & Bookings', icon: 'bed', table: 'reservations',
    branchColumn: 'branch_id', branchMode: 'eq',
    searchColumns: ['confirmation_number', 'status', 'special_requests', 'booking_source', 'purpose'],
    titleColumns: ['confirmation_number'], subtitleColumns: ['status'],
    dateColumn: 'check_in_date', amountColumn: 'total_amount', statusColumn: 'status',
    editableColumns: ['status', 'special_requests'],
    deletable: false, creatable: false,
  },
  {
    type: 'room', label: 'Room', group: 'Rooms & Bookings', icon: 'bed', table: 'rooms',
    branchColumn: 'branch_id', branchMode: 'eq',
    searchColumns: ['room_number', 'status'],
    titleColumns: ['room_number'], subtitleColumns: ['status'],
    statusColumn: 'status',
    editableColumns: ['status'],
    deletable: false, creatable: false,
  },
  // ── Menu (shared / branch) ────────────────────────────────────────────────
  {
    type: 'menu_item', label: 'Menu Item', group: 'Menu', icon: 'fork', table: 'restaurant_menu_items',
    branchColumn: 'branch_id', branchMode: 'nullable',
    searchColumns: ['name', 'description'],
    titleColumns: ['name'], subtitleColumns: ['description'],
    amountColumn: 'price', statusColumn: 'is_available',
    editableColumns: ['name', 'description', 'price', 'is_available'],
    deletable: false, creatable: false,
  },
  {
    type: 'bar_drink', label: 'Bar Drink', group: 'Menu', icon: 'wine', table: 'bar_drinks',
    branchColumn: 'branch_id', branchMode: 'nullable',
    searchColumns: ['name', 'unit'],
    titleColumns: ['name'], subtitleColumns: ['unit'],
    amountColumn: 'price', statusColumn: 'is_available',
    editableColumns: ['name', 'price', 'cost_price', 'is_available'],
    deletable: false, creatable: false,
  },
];

const byType = new Map(REGISTRY.map((c) => [c.type, c]));

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Resolve the branch the caller is allowed to search. Non-global roles are
// pinned to their own branch; global roles may target any branch.
const resolveBranchId = (req: Request): number | null => {
  const role = (req as any).user?.role;
  const userBranch = (req as any).user?.branch_id;
  const queryBranch = req.query.branch_id ?? req.params.branchId;
  if (isGlobalRole(role)) {
    const q = parseInt(String(queryBranch), 10);
    if (Number.isFinite(q) && q > 0) return q;
    const ub = parseInt(String(userBranch), 10);
    return Number.isFinite(ub) && ub > 0 ? ub : null;
  }
  const ub = parseInt(String(userBranch), 10);
  return Number.isFinite(ub) && ub > 0 ? ub : null;
};

// Strip characters that would break a Supabase .or() filter string.
const sanitize = (q: string): string => q.replace(/[,()%*]/g, ' ').trim();

const buildText = (row: Record<string, any>, cols: string[]): string => {
  const parts = cols
    .map((c) => row[c])
    .filter((v) => v != null && String(v).trim() !== '')
    .map((v) => String(v).trim());
  return parts.join(' · ');
};

const toResult = (cfg: EntityConfig, row: Record<string, any>) => ({
  type: cfg.type,
  label: cfg.label,
  group: cfg.group,
  icon: cfg.icon,
  id: String(row.id),
  title: buildText(row, cfg.titleColumns) || `${cfg.label} ${String(row.id).slice(0, 8)}`,
  subtitle: buildText(row, cfg.subtitleColumns),
  status: cfg.statusColumn ? row[cfg.statusColumn] ?? null : null,
  amount: cfg.amountColumn ? num(row[cfg.amountColumn]) : null,
  date: cfg.dateColumn ? row[cfg.dateColumn] ?? null : null,
});

// Restaurant/bar items shared across branches: resolve which requisition ids
// belong to the branch (for purchase orders).
const branchRequisitionIds = async (branchId: number): Promise<string[]> => {
  const { data } = await supabase
    .from('kitchen_requisitions')
    .select('id')
    .eq('branch_id', branchId);
  return ((data || []) as Array<Record<string, any>>).map((r) => String(r.id));
};

const searchEntity = async (
  cfg: EntityConfig,
  branchId: number,
  q: string,
  limit: number
): Promise<Array<ReturnType<typeof toResult>>> => {
  // NOTE: keep all PostgREST builder chaining synchronous here. A PostgREST
  // builder is "thenable", so returning one from an async helper and awaiting
  // it would EXECUTE the query early (yielding {data,error}, which has no
  // .or()/.limit()) — hence the previous "query.or is not a function".
  let query = supabase.from(cfg.table).select('*');

  if (cfg.branchMode === 'eq') {
    query = query.eq(cfg.branchColumn, branchId);
  } else if (cfg.branchMode === 'nullable') {
    query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`);
  } else if (cfg.branchMode === 'requisition') {
    const ids = await branchRequisitionIds(branchId);
    query = query.in(
      'requisition_id',
      ids.length ? ids : ['00000000-0000-0000-0000-000000000000']
    );
  }

  if (q) {
    const orExpr = cfg.searchColumns.map((c) => `${c}.ilike.%${q}%`).join(',');
    query = query.or(orExpr);
  }
  query = query.limit(limit);

  const { data, error } = await query;
  if (error) {
    logger.warn(`branch-search ${cfg.type} failed: ${error.message}`);
    return [];
  }
  return ((data || []) as Array<Record<string, any>>).map((row) => toResult(cfg, row));
};

// @desc    Search everything in the caller's branch
// @route   GET /api/branch-search?q=&types=&limit=
export const search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const branchId = resolveBranchId(req);
    if (!branchId) {
      res.status(400).json({ success: false, message: 'No branch context available' });
      return;
    }
    const q = sanitize(String(req.query.q ?? ''));
    const limit = Math.min(parseInt(String(req.query.limit ?? '15'), 10) || 15, 50);
    const typesParam = String(req.query.types ?? '').trim();
    const wanted = typesParam ? new Set(typesParam.split(',').map((t) => t.trim())) : null;

    const configs = REGISTRY.filter((c) => !wanted || wanted.has(c.type));

    const groups = await Promise.all(
      configs.map(async (cfg) => {
        const results = await searchEntity(cfg, branchId, q, limit);
        return { type: cfg.type, label: cfg.label, group: cfg.group, icon: cfg.icon, count: results.length, results };
      })
    );

    const nonEmpty = groups.filter((g) => g.results.length > 0);
    const total = nonEmpty.reduce((s, g) => s + g.count, 0);

    res.status(200).json({
      success: true,
      data: { branch_id: branchId, query: q, total, groups: nonEmpty },
    });
  } catch (error) {
    logger.error('branch-search failed:', error);
    next(error);
  }
};

// @desc    List searchable entity types (for filter chips)
// @route   GET /api/branch-search/types
export const listTypes = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      data: REGISTRY.map((c) => ({
        type: c.type, label: c.label, group: c.group, icon: c.icon,
        editable: c.editableColumns.length > 0, deletable: c.deletable, creatable: c.creatable,
      })),
    });
  } catch (error) {
    next(error);
  }
};

const ensureRowInBranch = async (
  cfg: EntityConfig,
  id: string,
  branchId: number
): Promise<Record<string, any> | null> => {
  const { data, error } = await supabase.from(cfg.table).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (cfg.branchMode === 'eq') {
    if (Number(data[cfg.branchColumn]) !== branchId) return null;
  } else if (cfg.branchMode === 'nullable') {
    const b = data[cfg.branchColumn];
    if (b != null && Number(b) !== branchId) return null;
  } else if (cfg.branchMode === 'requisition') {
    const ids = await branchRequisitionIds(branchId);
    if (!ids.includes(String(data.requisition_id))) return null;
  }
  return data;
};

// @desc    Full record + edit metadata (deep dive)
// @route   GET /api/branch-search/:type/:id
export const getDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cfg = byType.get(req.params.type);
    if (!cfg) {
      res.status(404).json({ success: false, message: 'Unknown entity type' });
      return;
    }
    const branchId = resolveBranchId(req);
    if (!branchId) {
      res.status(400).json({ success: false, message: 'No branch context available' });
      return;
    }
    const row = await ensureRowInBranch(cfg, req.params.id, branchId);
    if (!row) {
      res.status(404).json({ success: false, message: 'Record not found in your branch' });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        type: cfg.type,
        label: cfg.label,
        group: cfg.group,
        title: buildText(row, cfg.titleColumns) || cfg.label,
        record: row,
        meta: {
          editable_fields: cfg.editableColumns,
          deletable: cfg.deletable,
          creatable: cfg.creatable,
          amount_field: cfg.amountColumn ?? null,
          date_field: cfg.dateColumn ?? null,
          status_field: cfg.statusColumn ?? null,
        },
      },
    });
  } catch (error) {
    logger.error('branch-search detail failed:', error);
    next(error);
  }
};

// @desc    Update editable fields on a record (branch-checked)
// @route   PUT /api/branch-search/:type/:id
export const updateDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cfg = byType.get(req.params.type);
    if (!cfg) {
      res.status(404).json({ success: false, message: 'Unknown entity type' });
      return;
    }
    if (cfg.editableColumns.length === 0) {
      res.status(403).json({ success: false, message: 'This record type is read-only' });
      return;
    }
    const branchId = resolveBranchId(req);
    if (!branchId) {
      res.status(400).json({ success: false, message: 'No branch context available' });
      return;
    }
    const existing = await ensureRowInBranch(cfg, req.params.id, branchId);
    if (!existing) {
      res.status(404).json({ success: false, message: 'Record not found in your branch' });
      return;
    }

    const body = req.body || {};
    const update: Record<string, any> = {};
    for (const col of cfg.editableColumns) {
      if (col in body) update[col] = body[col] === '' ? null : body[col];
    }
    if (Object.keys(update).length === 0) {
      res.status(400).json({ success: false, message: 'No editable fields supplied' });
      return;
    }
    if ('updated_at' in existing) update.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from(cfg.table)
      .update(update)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;

    logger.info(`branch-search update ${cfg.type}:${req.params.id} by ${(req as any).user?.id}`);
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error('branch-search update failed:', error);
    next(error);
  }
};

// @desc    Delete a record (branch-checked, only if deletable)
// @route   DELETE /api/branch-search/:type/:id
export const deleteDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cfg = byType.get(req.params.type);
    if (!cfg) {
      res.status(404).json({ success: false, message: 'Unknown entity type' });
      return;
    }
    if (!cfg.deletable) {
      res.status(403).json({ success: false, message: 'This record type cannot be deleted' });
      return;
    }
    const branchId = resolveBranchId(req);
    if (!branchId) {
      res.status(400).json({ success: false, message: 'No branch context available' });
      return;
    }
    const existing = await ensureRowInBranch(cfg, req.params.id, branchId);
    if (!existing) {
      res.status(404).json({ success: false, message: 'Record not found in your branch' });
      return;
    }

    const { error } = await supabase.from(cfg.table).delete().eq('id', req.params.id);
    if (error) throw error;

    logger.info(`branch-search delete ${cfg.type}:${req.params.id} by ${(req as any).user?.id}`);
    res.status(200).json({ success: true, message: 'Record deleted' });
  } catch (error) {
    logger.error('branch-search delete failed:', error);
    next(error);
  }
};

// @desc    Create a record (branch forced, only for creatable types)
// @route   POST /api/branch-search/:type
export const createDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cfg = byType.get(req.params.type);
    if (!cfg) {
      res.status(404).json({ success: false, message: 'Unknown entity type' });
      return;
    }
    if (!cfg.creatable) {
      res.status(403).json({ success: false, message: 'This record type cannot be created here' });
      return;
    }
    const branchId = resolveBranchId(req);
    if (!branchId) {
      res.status(400).json({ success: false, message: 'No branch context available' });
      return;
    }

    const body = req.body || {};
    for (const req2 of cfg.requiredOnCreate || []) {
      if (body[req2] == null || body[req2] === '') {
        res.status(400).json({ success: false, message: `${req2} is required` });
        return;
      }
    }

    const insert: Record<string, any> = { [cfg.branchColumn]: branchId };
    for (const col of cfg.editableColumns) {
      if (col in body && body[col] !== '') insert[col] = body[col];
    }

    const { data, error } = await supabase.from(cfg.table).insert([insert]).select().single();
    if (error) throw error;

    res.status(201).json({ success: true, data });
  } catch (error) {
    logger.error('branch-search create failed:', error);
    next(error);
  }
};
