import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

type SearchRecord = Record<string, any>;

// ─── Per-table search configuration ─────────────────────────────────────────
// `textKeys`  — columns searched with ilike (text / varchar only).
// `label`     — human-readable title for the result.
// `subtitle`  — secondary line shown in the result.
// ─────────────────────────────────────────────────────────────────────────────

interface SearchConfig {
  module: string;
  table: string;
  /** Text columns to search with ilike. Must actually exist in the table. */
  textKeys: string[];
  label: (row: SearchRecord) => string;
  subtitle: (row: SearchRecord) => string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const str = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const pick = (row: SearchRecord, keys: string[]): string => {
  for (const k of keys) {
    const v = str(row[k]).trim();
    if (v) return v;
  }
  return '';
};

const fullName = (row: SearchRecord): string => {
  const full = pick(row, ['name', 'full_name', 'guest_name', 'customer_name']);
  if (full) return full;
  return `${str(row.first_name)} ${str(row.last_name)}`.trim();
};

const kes = (v: unknown) => (v ? `KES ${v}` : '');

// ── Table registry ────────────────────────────────────────────────────────────

const configs: SearchConfig[] = [
  // ── Users & Staff ────────────────────────────────────────────────────────
  {
    module: 'user',
    table: 'users',
    textKeys: ['first_name', 'last_name', 'email', 'role', 'phone_number', 'employee_id'],
    label: (r) => fullName(r) || r.email || 'User',
    subtitle: (r) => [r.email, r.role].filter(Boolean).join(' · '),
  },
  {
    module: 'staff',
    table: 'staff_profiles',
    textKeys: ['first_name', 'last_name', 'email', 'phone', 'phone_number', 'employee_id', 'staff_id', 'department', 'position'],
    label: (r) => fullName(r) || pick(r, ['employee_id', 'staff_id']) || 'Staff',
    subtitle: (r) => [pick(r, ['employee_id', 'staff_id']), pick(r, ['department', 'position'])].filter(Boolean).join(' · '),
  },
  {
    module: 'staff_alt',
    table: 'staff',
    textKeys: ['first_name', 'last_name', 'email', 'phone', 'employee_id', 'department', 'position', 'role'],
    label: (r) => fullName(r) || pick(r, ['employee_id']) || 'Staff',
    subtitle: (r) => [r.employee_id, r.department, r.role].filter(Boolean).join(' · '),
  },
  // ── Branches ─────────────────────────────────────────────────────────────
  {
    module: 'branch',
    table: 'branches',
    textKeys: ['name', 'code', 'location', 'address', 'email', 'phone'],
    label: (r) => r.name || r.code || 'Branch',
    subtitle: (r) => [r.code, r.location, r.status].filter(Boolean).join(' · '),
  },
  // ── Rooms ────────────────────────────────────────────────────────────────
  {
    module: 'room',
    table: 'rooms',
    textKeys: ['room_number', 'room_name', 'name', 'floor', 'category', 'type', 'status'],
    label: (r) => `Room ${pick(r, ['room_number', 'room_name', 'name'])}`,
    subtitle: (r) => [r.floor, r.category || r.type, r.status].filter(Boolean).join(' · '),
  },
  // ── Bookings ─────────────────────────────────────────────────────────────
  {
    module: 'booking',
    table: 'bookings',
    textKeys: ['confirmation_number', 'booking_number', 'short_code', 'guest_name', 'guest_phone', 'phone', 'status', 'email'],
    label: (r) => `Booking ${pick(r, ['confirmation_number', 'booking_number', 'short_code']) || r.id}`,
    subtitle: (r) => [r.guest_name, r.status, kes(r.total_amount)].filter(Boolean).join(' · '),
  },
  // ── Restaurant ───────────────────────────────────────────────────────────
  {
    module: 'restaurant_order',
    table: 'restaurant_orders',
    textKeys: ['order_number', 'short_code', 'bill_number', 'table_number', 'waiter_name', 'customer_name', 'status', 'payment_status'],
    label: (r) => `Restaurant Order ${pick(r, ['order_number', 'short_code', 'bill_number']) || r.id}`,
    subtitle: (r) => [r.waiter_name, r.status, kes(r.total_amount)].filter(Boolean).join(' · '),
  },
  {
    module: 'restaurant_bill',
    table: 'restaurant_bills',
    textKeys: ['bill_number', 'order_number', 'short_code', 'customer_name', 'waiter_name', 'status', 'payment_status'],
    label: (r) => `Restaurant Bill ${pick(r, ['bill_number', 'order_number', 'short_code']) || r.id}`,
    subtitle: (r) => [r.customer_name || r.waiter_name, r.status, kes(r.total_amount)].filter(Boolean).join(' · '),
  },
  // ── Bar ──────────────────────────────────────────────────────────────────
  {
    module: 'bar_order',
    table: 'bar_orders',
    textKeys: ['order_number', 'short_code', 'bartender_name', 'customer_name', 'status', 'payment_status'],
    label: (r) => `Bar Order ${pick(r, ['order_number', 'short_code']) || r.id}`,
    subtitle: (r) => [r.bartender_name, r.status, kes(r.total_amount)].filter(Boolean).join(' · '),
  },
  // ── POS Transactions ─────────────────────────────────────────────────────
  {
    module: 'pos_transaction',
    table: 'pos_transactions',
    textKeys: ['transaction_id', 'reference', 'short_code', 'outlet_type', 'cashier_name', 'payment_method', 'status'],
    label: (r) => `POS Transaction ${pick(r, ['transaction_id', 'reference', 'short_code']) || r.id}`,
    subtitle: (r) => [r.outlet_type, r.cashier_name, kes(r.total_amount)].filter(Boolean).join(' · '),
  },
  {
    module: 'pos_shift_order',
    table: 'pos_shift_orders',
    textKeys: ['order_number', 'reference', 'short_code', 'outlet_type', 'waiter_name', 'status', 'payment_status'],
    label: (r) => `POS Order ${pick(r, ['order_number', 'reference', 'short_code']) || r.id}`,
    subtitle: (r) => [r.outlet_type, r.waiter_name, r.status, kes(r.total_amount)].filter(Boolean).join(' · '),
  },
  // ── Cashier ──────────────────────────────────────────────────────────────
  {
    module: 'cashier_shift',
    table: 'cashier_shifts',
    textKeys: ['shift_code', 'cashier_name', 'outlet_name', 'status'],
    label: (r) => `Cashier Shift ${pick(r, ['shift_code', 'id'])}`,
    subtitle: (r) => [r.cashier_name, r.outlet_name, r.status].filter(Boolean).join(' · '),
  },
  {
    module: 'unpaid_bill',
    table: 'unpaid_bills',
    textKeys: ['bill_number', 'order_number', 'short_code', 'customer_name', 'waiter_name', 'outlet_type', 'status'],
    label: (r) => `Unpaid Bill ${pick(r, ['bill_number', 'order_number', 'short_code']) || r.id}`,
    subtitle: (r) => [r.customer_name || r.waiter_name, r.outlet_type, kes(r.total_amount)].filter(Boolean).join(' · '),
  },
  {
    module: 'credit_bill',
    table: 'credit_bills',
    textKeys: ['bill_number', 'order_number', 'short_code', 'customer_name', 'guest_name', 'status'],
    label: (r) => `Credit Bill ${pick(r, ['bill_number', 'order_number', 'short_code']) || r.id}`,
    subtitle: (r) => [pick(r, ['customer_name', 'guest_name']), r.status, kes(r.total_amount)].filter(Boolean).join(' · '),
  },
  {
    module: 'staff_credit_bill',
    table: 'staff_credit_bills',
    textKeys: ['bill_number', 'short_code', 'staff_name', 'employee_id', 'status'],
    label: (r) => `Staff Credit Bill ${pick(r, ['bill_number', 'short_code']) || r.id}`,
    subtitle: (r) => [r.staff_name, r.employee_id, r.status, kes(r.total_amount)].filter(Boolean).join(' · '),
  },
  // ── Payments ─────────────────────────────────────────────────────────────
  {
    module: 'payment',
    table: 'payments',
    textKeys: ['payment_id', 'reference', 'transaction_id', 'mpesa_reference', 'method', 'status'],
    label: (r) => `Payment ${pick(r, ['payment_id', 'reference', 'transaction_id', 'mpesa_reference']) || r.id}`,
    subtitle: (r) => [r.method, r.status, kes(r.amount)].filter(Boolean).join(' · '),
  },
  // ── Stock / Store ─────────────────────────────────────────────────────────
  {
    module: 'stock_request',
    table: 'stock_requests',
    textKeys: ['request_number', 'reason', 'request_type', 'priority', 'status'],
    label: (r) => `Stock Request ${r.request_number || r.id}`,
    subtitle: (r) => [r.request_type, r.priority, r.status].filter(Boolean).join(' · '),
  },
  {
    module: 'bar_stock_request',
    table: 'bar_stock_requests',
    textKeys: ['request_number', 'reason', 'request_type', 'priority', 'status'],
    label: (r) => `Bar Stock Request ${r.request_number || r.id}`,
    subtitle: (r) => [r.request_type, r.status].filter(Boolean).join(' · '),
  },
  {
    module: 'store_item',
    table: 'store_items',
    textKeys: ['name', 'item_name', 'sku', 'barcode', 'category', 'store_type', 'supplier_code'],
    label: (r) => pick(r, ['name', 'item_name']) || r.sku || 'Store Item',
    subtitle: (r) => [r.sku, r.category, r.store_type].filter(Boolean).join(' · '),
  },
  {
    module: 'purchase_order',
    table: 'store_purchase_orders',
    textKeys: ['po_number', 'order_number', 'reference', 'supplier_name', 'status'],
    label: (r) => `PO ${pick(r, ['po_number', 'order_number', 'reference']) || r.id}`,
    subtitle: (r) => [r.supplier_name, r.status, kes(r.total_amount)].filter(Boolean).join(' · '),
  },
  {
    module: 'supplier',
    table: 'store_suppliers',
    textKeys: ['name', 'code', 'email', 'phone', 'contact_person', 'tax_pin', 'address'],
    label: (r) => r.name || r.code || 'Supplier',
    subtitle: (r) => [r.code, r.email, r.phone].filter(Boolean).join(' · '),
  },
  {
    module: 'grn',
    table: 'store_grn',
    textKeys: ['grn_number', 'reference', 'supplier_name', 'invoice_number', 'status'],
    label: (r) => `GRN ${pick(r, ['grn_number', 'reference']) || r.id}`,
    subtitle: (r) => [r.supplier_name, r.status, kes(r.total_amount)].filter(Boolean).join(' · '),
  },
  // ── Finance & Accounting ──────────────────────────────────────────────────
  {
    module: 'invoice',
    table: 'finance_invoices',
    textKeys: ['invoice_number', 'reference', 'customer_name', 'status'],
    label: (r) => `Invoice ${pick(r, ['invoice_number', 'reference']) || r.id}`,
    subtitle: (r) => [r.customer_name, r.status, kes(r.total_amount)].filter(Boolean).join(' · '),
  },
  {
    module: 'ar_invoice',
    table: 'accounting_ar_invoices',
    textKeys: ['invoice_number', 'reference', 'customer_name', 'status'],
    label: (r) => `AR Invoice ${pick(r, ['invoice_number', 'reference']) || r.id}`,
    subtitle: (r) => [r.customer_name, r.status, kes(r.total_amount)].filter(Boolean).join(' · '),
  },
  // ── POS Outlets ───────────────────────────────────────────────────────────
  {
    module: 'pos_outlet',
    table: 'pos_outlets',
    textKeys: ['name', 'code', 'outlet_type', 'status'],
    label: (r) => r.name || r.code || 'POS Outlet',
    subtitle: (r) => [r.code, r.outlet_type, r.status].filter(Boolean).join(' · '),
  },
  // ── Audit ─────────────────────────────────────────────────────────────────
  {
    module: 'audit_log',
    table: 'audit_logs',
    textKeys: ['action', 'entity', 'entity_id', 'user_email', 'description'],
    label: (r) => pick(r, ['action', 'entity']) || 'Audit Log',
    subtitle: (r) => [r.entity, r.user_email].filter(Boolean).join(' · '),
  },
  // ── Departments ───────────────────────────────────────────────────────────
  {
    module: 'department',
    table: 'departments',
    textKeys: ['name', 'code', 'status'],
    label: (r) => r.name || 'Department',
    subtitle: (r) => [r.code, r.status].filter(Boolean).join(' · '),
  },
  // ── Void requests ─────────────────────────────────────────────────────────
  {
    module: 'void_request',
    table: 'void_requests',
    textKeys: ['order_number', 'bill_number', 'short_code', 'reason', 'status', 'requested_by_name'],
    label: (r) => `Void ${pick(r, ['order_number', 'bill_number', 'short_code']) || r.id}`,
    subtitle: (r) => [r.reason, r.status].filter(Boolean).join(' · '),
  },
];

// ── Core search handler ───────────────────────────────────────────────────────

/**
 * Global search across the entire database using server-side ilike filtering.
 * Each table is queried independently (in parallel, via Promise.allSettled so
 * a missing/empty table never breaks the whole search).
 */
export const globalSearch = async (req: Request, res: Response) => {
  try {
    const { q, modules } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const searchQuery = q.trim().toLowerCase();

    if (searchQuery.length < 2) {
      return res.status(400).json({ success: false, message: 'Query must be at least 2 characters' });
    }

    const moduleFilter = modules
      ? new Set(
          (Array.isArray(modules) ? modules : String(modules).split(','))
            .map((m) => String(m).trim())
            .filter(Boolean)
        )
      : null;

    const selectedConfigs = moduleFilter
      ? configs.filter((c) => moduleFilter.has(c.module))
      : configs;

    const settled = await Promise.allSettled(
      selectedConfigs.map(async (config) => {
        // Build an OR filter with ilike on each text key — server-side, no row-limit trap
        const orFilter = config.textKeys
          .map((k) => `${k}.ilike.%${searchQuery}%`)
          .join(',');

        const { data, error } = await supabase
          .from(config.table)
          .select('*')
          .or(orFilter)
          .limit(15);

        if (error || !data || data.length === 0) return [];

        return data.map((row) => ({
          type: config.module,
          id: row.id,
          display_name: config.label(row),
          subtitle: config.subtitle(row),
          metadata: row,
        }));
      })
    );

    const results = settled.flatMap((entry) =>
      entry.status === 'fulfilled' ? entry.value : []
    );

    return res.status(200).json({
      success: true,
      data: results,
      count: results.length,
      query: searchQuery,
    });
  } catch (error) {
    console.error('Global search error:', error);
    return res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
