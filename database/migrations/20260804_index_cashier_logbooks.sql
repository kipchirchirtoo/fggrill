-- ============================================================
-- Migration: Index Cashier Logbooks page and related tables
-- Date: 2026-08-04
-- Covers:
--   • cashier_logbooks          (list + detail lookups)
--   • cashier_logbook_lines     (grouped by logbook_id)
--   • cashier_shift_logs        (shift detail)
--   • cashier_shift_transactions (by shift_id + time)
--   • cashier_transactions      (by branch/cashier/time range)
--   • shift_actual_collections  (by shift_id)
--   • restaurant_orders         (by branch/cashier/time range)
--   • bar_orders                (by branch/cashier/time range)
--   • credit_bills              (by branch/time range)
--   • pos_outlet_shifts         (by cashier_id + opened_at)
--   • pos_shift_orders          (by shift_id)
--   • pos_shift_payments        (by shift_id)
-- ============================================================

-- ─── cashier_logbooks ────────────────────────────────────────
-- List page: ORDER BY log_date DESC, filtered by branch_id + status
CREATE INDEX IF NOT EXISTS idx_cashier_logbooks_branch_status_date
    ON public.cashier_logbooks (branch_id, status, log_date DESC);

-- Detail page: PK lookup by id (usually already PK but explicit)
CREATE INDEX IF NOT EXISTS idx_cashier_logbooks_id
    ON public.cashier_logbooks (id);

-- Filter by cashier_id (per-cashier logbook history)
CREATE INDEX IF NOT EXISTS idx_cashier_logbooks_cashier_id
    ON public.cashier_logbooks (cashier_id);

-- Filter by cashier_shift_id (linking logbook → shift)
CREATE INDEX IF NOT EXISTS idx_cashier_logbooks_cashier_shift_id
    ON public.cashier_logbooks (cashier_shift_id)
    WHERE cashier_shift_id IS NOT NULL;

-- Filter by outlet_shift_id
CREATE INDEX IF NOT EXISTS idx_cashier_logbooks_outlet_shift_id
    ON public.cashier_logbooks (outlet_shift_id)
    WHERE outlet_shift_id IS NOT NULL;

-- ─── cashier_logbook_lines ───────────────────────────────────
-- Both list (IN logbook_ids) and detail queries filter by logbook_id
CREATE INDEX IF NOT EXISTS idx_cashier_logbook_lines_logbook_id
    ON public.cashier_logbook_lines (logbook_id);

CREATE INDEX IF NOT EXISTS idx_cashier_logbook_lines_logbook_created
    ON public.cashier_logbook_lines (logbook_id, created_at ASC);

-- ─── cashier_shift_logs ──────────────────────────────────────
-- Detail page fetches by id; list/audit pages query by branch/cashier
CREATE INDEX IF NOT EXISTS idx_cashier_shift_logs_id
    ON public.cashier_shift_logs (id);

CREATE INDEX IF NOT EXISTS idx_cashier_shift_logs_branch_cashier
    ON public.cashier_shift_logs (branch_id, cashier_id);

CREATE INDEX IF NOT EXISTS idx_cashier_shift_logs_cashier_start
    ON public.cashier_shift_logs (cashier_id, shift_start DESC);

-- ─── cashier_shift_transactions ──────────────────────────────
-- Fetched by shift_id ORDER BY transaction_time
CREATE INDEX IF NOT EXISTS idx_cashier_shift_transactions_shift_time
    ON public.cashier_shift_transactions (shift_id, transaction_time ASC);

-- ─── shift_actual_collections ────────────────────────────────
-- Fetched by shift_id ORDER BY payment_method
CREATE INDEX IF NOT EXISTS idx_shift_actual_collections_shift_method
    ON public.shift_actual_collections (shift_id, payment_method ASC);

-- ─── cashier_transactions ────────────────────────────────────
-- Time-range query: branch_id + cashier_id + created_at range
CREATE INDEX IF NOT EXISTS idx_cashier_transactions_branch_cashier_time
    ON public.cashier_transactions (branch_id, cashier_id, created_at ASC);

-- ─── restaurant_orders ───────────────────────────────────────
-- Time-range query: branch_id + created_by + created_at range
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_branch_creator_time
    ON public.restaurant_orders (branch_id, created_by, created_at ASC);

-- payment_status is used in many cashier reconciliation queries
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_branch_payment_status
    ON public.restaurant_orders (branch_id, payment_status);

-- ─── bar_orders ──────────────────────────────────────────────
-- Same pattern as restaurant_orders
CREATE INDEX IF NOT EXISTS idx_bar_orders_branch_creator_time
    ON public.bar_orders (branch_id, created_by, created_at ASC);

-- ─── credit_bills ────────────────────────────────────────────
-- Time-range query: branch_id + created_at range
CREATE INDEX IF NOT EXISTS idx_credit_bills_branch_time
    ON public.credit_bills (branch_id, created_at ASC);

-- ─── pos_outlet_shifts ───────────────────────────────────────
-- Lookup by cashier_id + opened_at range to find matching outlet shifts
CREATE INDEX IF NOT EXISTS idx_pos_outlet_shifts_cashier_opened
    ON public.pos_outlet_shifts (cashier_id, opened_at ASC);

-- IN-list lookup by id when outletShiftIds are known
CREATE INDEX IF NOT EXISTS idx_pos_outlet_shifts_id
    ON public.pos_outlet_shifts (id);

-- ─── pos_shift_orders ────────────────────────────────────────
-- Fetched by shift_id (IN list) ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_shift_created
    ON public.pos_shift_orders (shift_id, created_at ASC);

-- ─── pos_shift_payments ──────────────────────────────────────
-- Fetched by shift_id (IN list) ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_pos_shift_payments_shift_created
    ON public.pos_shift_payments (shift_id, created_at ASC);
