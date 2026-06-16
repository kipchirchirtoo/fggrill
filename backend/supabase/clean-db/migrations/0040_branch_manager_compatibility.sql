-- Branch Manager compatibility and safety layer for the clean database.
-- This keeps the existing backend/API contracts stable while the clean schema matures.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Cashier clearances, KPI screens, Lina, and Branch Manager dashboards expect these fields.
ALTER TABLE public.cashier_shifts
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_notes text,
  ADD COLUMN IF NOT EXISTS flagged_by uuid,
  ADD COLUMN IF NOT EXISTS flagged_at timestamptz,
  ADD COLUMN IF NOT EXISTS flag_reason text,
  ADD COLUMN IF NOT EXISTS flag_notes text,
  ADD COLUMN IF NOT EXISTS expected_cash numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_cash numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_sales numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discrepancy_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shift_start timestamptz,
  ADD COLUMN IF NOT EXISTS shift_end timestamptz;

UPDATE public.cashier_shifts
SET
  shift_start = COALESCE(shift_start, start_time, opened_at, created_at),
  shift_end = COALESCE(shift_end, end_time, closed_at),
  expected_cash = COALESCE(NULLIF(expected_cash, 0), opening_float, 0),
  actual_cash = COALESCE(NULLIF(actual_cash, 0), closing_float, 0),
  discrepancy_amount = COALESCE(discrepancy_amount, actual_cash - expected_cash, 0)
WHERE shift_start IS NULL
   OR shift_end IS NULL
   OR expected_cash = 0
   OR actual_cash = 0
   OR discrepancy_amount IS NULL;

CREATE INDEX IF NOT EXISTS idx_cashier_shifts_branch_shift_start
  ON public.cashier_shifts (branch_id, shift_start DESC);
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_branch_status
  ON public.cashier_shifts (branch_id, status);
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_cashier_start
  ON public.cashier_shifts (cashier_id, shift_start DESC);

-- Staff attendance/leave actions need explicit review timestamps and rejection metadata.
ALTER TABLE public.staff_attendance
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

UPDATE public.staff_attendance
SET approved_at = COALESCE(approved_at, confirmed_at)
WHERE approved_at IS NULL AND (is_approved IS TRUE OR is_confirmed IS TRUE);

ALTER TABLE public.staff_leave
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS reported_to_duty_at timestamptz;

UPDATE public.staff_leave
SET reported_to_duty_at = COALESCE(reported_to_duty_at, reported_at)
WHERE reported_to_duty_at IS NULL AND reported_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_attendance_branch_date
  ON public.staff_attendance (branch_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_staff_leave_branch_status
  ON public.staff_leave (branch_id, status);

-- Branch Manager, Auditor, and waiter performance screens rank sales by staff/user.
ALTER TABLE public.restaurant_orders
  ADD COLUMN IF NOT EXISTS staff_id uuid,
  ADD COLUMN IF NOT EXISTS tip_amount numeric(14,2) NOT NULL DEFAULT 0;

UPDATE public.restaurant_orders
SET staff_id = COALESCE(staff_id, created_by)
WHERE staff_id IS NULL AND created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_branch_created
  ON public.restaurant_orders (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_staff_created
  ON public.restaurant_orders (staff_id, created_at DESC);

ALTER TABLE public.bar_orders
  ADD COLUMN IF NOT EXISTS staff_id uuid,
  ADD COLUMN IF NOT EXISTS subtotal numeric(14,2),
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS room_number text,
  ADD COLUMN IF NOT EXISTS tip_amount numeric(14,2) NOT NULL DEFAULT 0;

UPDATE public.bar_orders
SET
  staff_id = COALESCE(staff_id, created_by),
  subtotal = COALESCE(subtotal, total_amount, total, 0)
WHERE staff_id IS NULL OR subtotal IS NULL;

CREATE INDEX IF NOT EXISTS idx_bar_orders_branch_created
  ON public.bar_orders (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bar_orders_staff_created
  ON public.bar_orders (staff_id, created_at DESC);

-- POS shift orders are outlet-scoped in the clean schema; store a branch alias for branch dashboards.
ALTER TABLE public.pos_shift_orders
  ADD COLUMN IF NOT EXISTS branch_id integer,
  ADD COLUMN IF NOT EXISTS payment_method text;

UPDATE public.pos_shift_orders pso
SET branch_id = po.branch_id
FROM public.pos_outlets po
WHERE pso.outlet_id = po.id
  AND pso.branch_id IS NULL;

UPDATE public.pos_shift_orders pso
SET payment_method = p.payment_method
FROM (
  SELECT DISTINCT ON (order_id) order_id, payment_method
  FROM public.pos_shift_payments
  WHERE order_id IS NOT NULL AND payment_method IS NOT NULL
  ORDER BY order_id, created_at DESC
) p
WHERE p.order_id = pso.id
  AND pso.payment_method IS NULL;

CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_branch_created
  ON public.pos_shift_orders (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_outlet_created
  ON public.pos_shift_orders (outlet_id, created_at DESC);

-- Menu/stock aliases used by Branch Manager screens and analytics exports.
ALTER TABLE public.restaurant_menu_items
  ADD COLUMN IF NOT EXISTS price numeric(14,2),
  ADD COLUMN IF NOT EXISTS category text;

UPDATE public.restaurant_menu_items
SET price = COALESCE(price, selling_price, 0)
WHERE price IS NULL;

ALTER TABLE public.bar_drinks
  ADD COLUMN IF NOT EXISTS category text;

UPDATE public.bar_drinks bd
SET category = COALESCE(bd.category, c.name)
FROM public.bar_drink_categories c
WHERE bd.category_id = c.id
  AND bd.category IS NULL;

ALTER TABLE public.branch_stock
  ADD COLUMN IF NOT EXISTS item_name text,
  ADD COLUMN IF NOT EXISTS current_stock numeric(14,4),
  ADD COLUMN IF NOT EXISTS minimum_stock numeric(14,4),
  ADD COLUMN IF NOT EXISTS unit_cost numeric(14,2);

UPDATE public.branch_stock bs
SET
  current_stock = COALESCE(bs.current_stock, bs.quantity, 0),
  minimum_stock = COALESCE(bs.minimum_stock, bs.reorder_level, 0),
  item_name = COALESCE(bs.item_name, si.item_name, si.description, bs.item_sku),
  unit_cost = COALESCE(bs.unit_cost, si.cost_price, 0)
FROM public.simple_items si
WHERE (si.sku = bs.item_sku OR si.item_sku = bs.item_sku)
  AND (bs.item_name IS NULL OR bs.current_stock IS NULL OR bs.minimum_stock IS NULL OR bs.unit_cost IS NULL);

UPDATE public.branch_stock
SET
  current_stock = COALESCE(current_stock, quantity, 0),
  minimum_stock = COALESCE(minimum_stock, reorder_level, 0),
  item_name = COALESCE(item_name, item_sku),
  unit_cost = COALESCE(unit_cost, 0)
WHERE current_stock IS NULL OR minimum_stock IS NULL OR item_name IS NULL OR unit_cost IS NULL;

CREATE OR REPLACE FUNCTION public.branch_stock_compat_sync()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.quantity := COALESCE(NEW.quantity, NEW.current_stock, 0);
  NEW.current_stock := COALESCE(NEW.current_stock, NEW.quantity, 0);
  NEW.reorder_level := COALESCE(NEW.reorder_level, NEW.minimum_stock, 0);
  NEW.minimum_stock := COALESCE(NEW.minimum_stock, NEW.reorder_level, 0);
  NEW.item_name := COALESCE(NEW.item_name, NEW.item_sku);
  NEW.unit_cost := COALESCE(NEW.unit_cost, 0);
  NEW.updated_at := COALESCE(NEW.updated_at, NOW());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_branch_stock_compat_sync ON public.branch_stock;
CREATE TRIGGER trg_branch_stock_compat_sync
BEFORE INSERT OR UPDATE ON public.branch_stock
FOR EACH ROW EXECUTE FUNCTION public.branch_stock_compat_sync();

CREATE INDEX IF NOT EXISTS idx_branch_stock_branch_item
  ON public.branch_stock (branch_id, item_sku);
CREATE INDEX IF NOT EXISTS idx_branch_stock_branch_quantity
  ON public.branch_stock (branch_id, quantity);

-- Date/amount aliases used by Branch Manager P&L and finance pages.
ALTER TABLE public.conference_bookings
  ADD COLUMN IF NOT EXISTS booking_date date;

UPDATE public.conference_bookings
SET booking_date = COALESCE(booking_date, event_date, created_at::date)
WHERE booking_date IS NULL;

ALTER TABLE public.payroll
  ADD COLUMN IF NOT EXISTS pay_period_start date,
  ADD COLUMN IF NOT EXISTS pay_period_end date;

UPDATE public.payroll
SET
  pay_period_start = COALESCE(pay_period_start, make_date(year, month, 1)),
  pay_period_end = COALESCE(pay_period_end, (make_date(year, month, 1) + interval '1 month - 1 day')::date)
WHERE pay_period_start IS NULL OR pay_period_end IS NULL;

ALTER TABLE public.petty_cash_transactions
  ADD COLUMN IF NOT EXISTS transaction_type text,
  ADD COLUMN IF NOT EXISTS transaction_date date;

UPDATE public.petty_cash_transactions
SET
  transaction_type = COALESCE(transaction_type, txn_type),
  transaction_date = COALESCE(transaction_date, created_at::date)
WHERE transaction_type IS NULL OR transaction_date IS NULL;

ALTER TABLE public.additional_services
  ADD COLUMN IF NOT EXISTS amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS status text;

UPDATE public.additional_services
SET
  amount = COALESCE(amount, base_price, 0),
  status = COALESCE(status, CASE WHEN is_active THEN 'active' ELSE 'inactive' END)
WHERE amount IS NULL OR status IS NULL;

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS rate numeric(14,2);

UPDATE public.rooms
SET rate = COALESCE(rate, price_override, 0)
WHERE rate IS NULL;

ALTER TABLE public.room_types
  ADD COLUMN IF NOT EXISTS rate numeric(14,2),
  ADD COLUMN IF NOT EXISTS type_name text;

UPDATE public.room_types
SET
  rate = COALESCE(rate, price_per_night, base_rate, 0),
  type_name = COALESCE(type_name, name, code)
WHERE rate IS NULL OR type_name IS NULL;

-- Richer transaction view for cashier, branch analytics, and director/manager drill-down.
CREATE OR REPLACE VIEW public.shift_transactions
WITH (security_invoker = true) AS
SELECT
  cst.id,
  cst.shift_id,
  cst.transaction_id,
  cst.transaction_ref,
  cst.payment_method,
  cst.amount,
  cst.transaction_time,
  cst.source_table,
  cst.source_id,
  cst.branch_id,
  cst.notes,
  cst.is_voided,
  cst.voided_at,
  cst.voided_by,
  cst.created_at,
  cst.transaction_ref AS transaction_number,
  cst.amount AS total_amount,
  CASE
    WHEN lower(COALESCE(cst.source_table, '')) LIKE '%restaurant%' THEN 'restaurant'
    WHEN lower(COALESCE(cst.source_table, '')) LIKE '%bar%' THEN 'bar'
    WHEN lower(COALESCE(cst.source_table, '')) LIKE '%booking%' THEN 'rooms'
    WHEN lower(COALESCE(cst.source_table, '')) LIKE '%pos%' THEN 'pos'
    ELSE COALESCE(cst.source_table, 'cashier')
  END AS service_category
FROM public.cashier_shift_transactions cst;

-- Revenue/P&L compatibility views. Backend writes should stay on the canonical tables.
CREATE OR REPLACE VIEW public.orders
WITH (security_invoker = true) AS
SELECT
  ro.id,
  ro.branch_id,
  COALESCE(ro.grand_total, ro.total_amount, ro.subtotal, 0) AS total_amount,
  COALESCE(ro.order_type, 'restaurant') AS order_type,
  ro.status,
  ro.created_at,
  'restaurant_orders'::text AS source_table
FROM public.restaurant_orders ro
UNION ALL
SELECT
  bo.id,
  bo.branch_id,
  COALESCE(bo.total_amount, bo.total, bo.subtotal, 0) AS total_amount,
  'bar'::text AS order_type,
  bo.status,
  bo.created_at,
  'bar_orders'::text AS source_table
FROM public.bar_orders bo
UNION ALL
SELECT
  pso.id,
  COALESCE(pso.branch_id, po.branch_id) AS branch_id,
  COALESCE(pso.total_amount, 0) AS total_amount,
  COALESCE(pso.order_type, po.outlet_type, 'pos') AS order_type,
  pso.status,
  pso.created_at,
  'pos_shift_orders'::text AS source_table
FROM public.pos_shift_orders pso
LEFT JOIN public.pos_outlets po ON po.id = pso.outlet_id;

CREATE OR REPLACE VIEW public.purchases
WITH (security_invoker = true) AS
SELECT
  po.id,
  po.branch_id,
  po.po_number,
  po.supplier_id,
  COALESCE(po.total_amount, po.subtotal, 0) AS total_amount,
  po.status,
  COALESCE(po.order_date, po.po_date, po.created_at::date) AS purchase_date,
  po.created_at,
  'purchase_orders'::text AS source_table
FROM public.purchase_orders po;

CREATE OR REPLACE VIEW public.stock_out_records
WITH (security_invoker = true) AS
SELECT
  bsm.id,
  bsm.branch_id,
  bsm.item_sku,
  COALESCE(bs.item_name, si.item_name, bsm.item_sku) AS item_name,
  ABS(COALESCE(bsm.quantity, 0)) AS quantity,
  COALESCE(bsm.reference_type, bsm.movement_type, 'stock_out') AS department,
  COALESCE(bsm.reference_number, bsm.reference, bsm.movement_type) AS reference,
  bsm.movement_type,
  bsm.created_at
FROM public.branch_stock_movements bsm
LEFT JOIN public.branch_stock bs
  ON bs.branch_id = bsm.branch_id AND bs.item_sku = bsm.item_sku
LEFT JOIN public.simple_items si
  ON si.sku = bsm.item_sku OR si.item_sku = bsm.item_sku
WHERE COALESCE(bsm.quantity, 0) < 0
   OR lower(COALESCE(bsm.movement_type, '')) IN (
     'stock_out',
     'out',
     'issue',
     'department_issue',
     'pos_issue',
     'kitchen_issue',
     'usage'
   );

-- Controlled wastage records expected by Branch Manager and stock analytics.
CREATE TABLE IF NOT EXISTS public.wastage_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id integer REFERENCES public.branches(id) ON DELETE SET NULL,
  item_sku text,
  item_name text,
  quantity numeric(14,4) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit text,
  reason text,
  notes text,
  recorded_by uuid,
  status text NOT NULL DEFAULT 'recorded',
  record_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wastage_records_branch_date
  ON public.wastage_records (branch_id, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_wastage_records_item
  ON public.wastage_records (item_sku);

-- Common Branch Manager export/drill-down indexes.
CREATE INDEX IF NOT EXISTS idx_bookings_branch_checkin
  ON public.bookings (branch_id, check_in_date DESC);
CREATE INDEX IF NOT EXISTS idx_conference_bookings_branch_date
  ON public.conference_bookings (branch_id, booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_branch_period
  ON public.payroll (branch_id, pay_period_start, pay_period_end);
CREATE INDEX IF NOT EXISTS idx_petty_cash_branch_date
  ON public.petty_cash_transactions (branch_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_branch_date
  ON public.expenses (branch_id, expense_date DESC);
