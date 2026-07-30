-- High-performance indexes for the hottest commercial workflows:
-- cashier station, POS outlet bootstrap, KDS feeds, menu/catalog fetches,
-- unpaid bill loading, and shift-linked petty cash.
-- Safe additive migration: indexes only, no data rewrite.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- POS outlet item catalog
CREATE INDEX IF NOT EXISTS idx_pos_outlet_items_outlet_active_branch
ON public.pos_outlet_items (outlet_id, is_active, branch_id);

CREATE INDEX IF NOT EXISTS idx_pos_outlet_items_outlet_category_name
ON public.pos_outlet_items (outlet_id, category, name);

CREATE INDEX IF NOT EXISTS idx_pos_outlet_items_name_trgm
ON public.pos_outlet_items USING gin (name gin_trgm_ops);

-- Restaurant menu fetches / sync into POS outlets
CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_branch_available_category
ON public.restaurant_menu_items (branch_id, is_available, category_id, name);

CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_name_trgm
ON public.restaurant_menu_items USING gin (name gin_trgm_ops);

-- KDS restaurant order feed
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_branch_status_created
ON public.restaurant_orders (branch_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_restaurant_order_items_order_id
ON public.restaurant_order_items (order_id);

-- POS captain orders / active bills / KDS POS feed
CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_shift_created
ON public.pos_shift_orders (shift_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_shift_payment_status
ON public.pos_shift_orders (shift_id, payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_shift_kitchen_status
ON public.pos_shift_orders (shift_id, kitchen_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_short_code
ON public.pos_shift_orders (short_code)
WHERE short_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_order_number
ON public.pos_shift_orders (order_number);

CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_master_bill
ON public.pos_shift_orders (master_bill_id)
WHERE master_bill_id IS NOT NULL;

-- POS shift resolution / bootstrap
CREATE INDEX IF NOT EXISTS idx_pos_outlet_shifts_branch_status_opened
ON public.pos_outlet_shifts (branch_id, status, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_outlet_shifts_outlet_status_opened
ON public.pos_outlet_shifts (outlet_id, status, opened_at DESC);

-- Cashier dashboard + bill queues
CREATE INDEX IF NOT EXISTS idx_cashier_transactions_branch_date
ON public.cashier_transactions (branch_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_unpaid_bills_branch_status_created
ON public.unpaid_bills (branch_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_bills_branch_approval
ON public.credit_bills (branch_id, approval_status, created_at DESC);

-- Canonical cashier shift log lookups
CREATE INDEX IF NOT EXISTS idx_cashier_shift_logs_cashier_status_start
ON public.cashier_shift_logs (cashier_id, status, shift_start DESC);

CREATE INDEX IF NOT EXISTS idx_cashier_shift_logs_branch_status_start
ON public.cashier_shift_logs (branch_id, status, shift_start DESC);

-- Shift-linked petty cash / expenses
CREATE INDEX IF NOT EXISTS idx_shift_reconciliation_expenses_branch_created
ON public.shift_reconciliation_expenses (branch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shift_reconciliation_expenses_shift_created
ON public.shift_reconciliation_expenses (shift_id, created_at DESC);
