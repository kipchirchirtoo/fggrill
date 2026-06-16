-- =============================================================
-- 0027: Fix all branch-storekeeper flow schema gaps
-- Covers: kitchen_food_controls columns, food_control_logs,
--         store_payment_invoice_allocations, store_supplier_balances,
--         store_supplier_payments aliases, store_purchase_order_items VIEW,
--         branch_departments
-- =============================================================

-- ---------------------------------------------------------------
-- FIX 1: kitchen_food_controls — add missing yield-rule columns
-- food-control.controller.ts inserts:
--   raw_item_name, raw_quantity, raw_unit, produced_item_name,
--   produced_portions, branch_id
-- requisitions.controller.ts uses: raw_item_sku, raw_item_name
-- expected-portions.controller.ts joins:
--   raw_item_name, raw_quantity, raw_unit, produced_item_name,
--   produced_portions
-- ---------------------------------------------------------------
ALTER TABLE kitchen_food_controls ADD COLUMN IF NOT EXISTS raw_item_name      TEXT;
ALTER TABLE kitchen_food_controls ADD COLUMN IF NOT EXISTS raw_item_sku       TEXT;
ALTER TABLE kitchen_food_controls ADD COLUMN IF NOT EXISTS raw_quantity       NUMERIC(12,4) DEFAULT 1;
ALTER TABLE kitchen_food_controls ADD COLUMN IF NOT EXISTS raw_unit           TEXT DEFAULT 'kg';
ALTER TABLE kitchen_food_controls ADD COLUMN IF NOT EXISTS produced_item_name TEXT;
ALTER TABLE kitchen_food_controls ADD COLUMN IF NOT EXISTS produced_item_sku  TEXT;
ALTER TABLE kitchen_food_controls ADD COLUMN IF NOT EXISTS produced_portions  NUMERIC(12,4) DEFAULT 1;
ALTER TABLE kitchen_food_controls ADD COLUMN IF NOT EXISTS produced_quantity  NUMERIC(12,4);
ALTER TABLE kitchen_food_controls ADD COLUMN IF NOT EXISTS produced_unit      TEXT;
ALTER TABLE kitchen_food_controls ADD COLUMN IF NOT EXISTS yield_percentage   NUMERIC(6,2);
ALTER TABLE kitchen_food_controls ADD COLUMN IF NOT EXISTS conversion_factor  NUMERIC(12,6) DEFAULT 1;
ALTER TABLE kitchen_food_controls ADD COLUMN IF NOT EXISTS category           TEXT;
ALTER TABLE kitchen_food_controls ADD COLUMN IF NOT EXISTS is_active          BOOLEAN DEFAULT TRUE;
ALTER TABLE kitchen_food_controls ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ DEFAULT NOW();

-- Auto-compute yield_percentage from raw/produced quantities
CREATE OR REPLACE FUNCTION trg_fn_food_control_yield()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.raw_quantity IS NOT NULL AND NEW.raw_quantity > 0 AND NEW.produced_portions IS NOT NULL THEN
    NEW.yield_percentage := ROUND((NEW.produced_portions / NEW.raw_quantity) * 100, 2);
    NEW.conversion_factor := NEW.produced_portions / NEW.raw_quantity;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_food_control_yield ON kitchen_food_controls;
CREATE TRIGGER trg_food_control_yield
  BEFORE INSERT OR UPDATE ON kitchen_food_controls
  FOR EACH ROW EXECUTE FUNCTION trg_fn_food_control_yield();

CREATE INDEX IF NOT EXISTS idx_kfc_branch      ON kitchen_food_controls(branch_id);
CREATE INDEX IF NOT EXISTS idx_kfc_raw_sku     ON kitchen_food_controls(raw_item_sku);
CREATE INDEX IF NOT EXISTS idx_kfc_raw_name    ON kitchen_food_controls(raw_item_name);

-- ---------------------------------------------------------------
-- FIX 2: kitchen_food_control_logs — add columns used by controller
-- food-control.controller.ts inserts:
--   rule_id, action, old_data, new_data, changed_by
-- Table currently has: id, control_id, item_sku, expected_qty, actual_qty,
--   variance_qty, notes, created_at
-- ---------------------------------------------------------------
ALTER TABLE kitchen_food_control_logs ADD COLUMN IF NOT EXISTS rule_id    UUID REFERENCES kitchen_food_controls(id) ON DELETE CASCADE;
ALTER TABLE kitchen_food_control_logs ADD COLUMN IF NOT EXISTS action     TEXT;
ALTER TABLE kitchen_food_control_logs ADD COLUMN IF NOT EXISTS old_data   JSONB;
ALTER TABLE kitchen_food_control_logs ADD COLUMN IF NOT EXISTS new_data   JSONB;
ALTER TABLE kitchen_food_control_logs ADD COLUMN IF NOT EXISTS changed_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------
-- FIX 3: supplier_payments (real table behind store_supplier_payments VIEW)
-- Controller inserts: payment_amount, reference_number, created_by_id, notes
-- Table has: amount, reference, created_by
-- Join in purchase-orders.controller.ts expects: payment_amount, reference_number
-- ---------------------------------------------------------------
ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS payment_amount   NUMERIC(12,2);
ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS created_by_id    UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS notes            TEXT;

-- Backfill from existing columns
UPDATE supplier_payments SET payment_amount   = amount    WHERE payment_amount   IS NULL AND amount    IS NOT NULL;
UPDATE supplier_payments SET reference_number = reference WHERE reference_number IS NULL AND reference  IS NOT NULL;
UPDATE supplier_payments SET created_by_id = created_by WHERE created_by_id IS NULL AND created_by IS NOT NULL;

-- Sync trigger on real table
CREATE OR REPLACE FUNCTION sync_supplier_payment_aliases()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.amount IS DISTINCT FROM OLD.amount THEN NEW.payment_amount := NEW.amount; END IF;
  IF NEW.payment_amount IS DISTINCT FROM OLD.payment_amount THEN NEW.amount := NEW.payment_amount; END IF;
  IF NEW.reference IS DISTINCT FROM OLD.reference THEN NEW.reference_number := NEW.reference; END IF;
  IF NEW.reference_number IS DISTINCT FROM OLD.reference_number THEN NEW.reference := NEW.reference_number; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_supplier_payment_aliases ON supplier_payments;
CREATE TRIGGER trg_sync_supplier_payment_aliases
  BEFORE INSERT OR UPDATE ON supplier_payments
  FOR EACH ROW EXECUTE FUNCTION sync_supplier_payment_aliases();

-- Rebuild store_supplier_payments VIEW to expose new columns
DROP VIEW IF EXISTS store_supplier_payments;
CREATE VIEW store_supplier_payments AS
SELECT
  id, branch_id, payment_number, supplier_id, payment_date,
  payment_method, amount, payment_amount, status,
  reference, reference_number,
  created_by, created_by_id, notes,
  released_by, released_at, metadata, created_at, updated_at
FROM supplier_payments;

-- ---------------------------------------------------------------
-- FIX 4: store_payment_invoice_allocations — CREATE (was missing)
-- FKs point to real underlying tables (not the VIEWs)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_payment_invoice_allocations (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id       UUID NOT NULL REFERENCES supplier_payments(id) ON DELETE CASCADE,
  invoice_id       UUID NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  allocated_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spai_payment ON store_payment_invoice_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_spai_invoice ON store_payment_invoice_allocations(invoice_id);

-- ---------------------------------------------------------------
-- FIX 5: store_supplier_balances — CREATE (was missing)
-- Used by: supplier-reports.controller.ts, native-pdf-reports.service.ts
-- Columns needed: current_balance, total_invoices, total_payments,
--   last_payment_date, last_invoice_date
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_supplier_balances (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id          INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  supplier_id        UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  current_balance    NUMERIC(12,2) DEFAULT 0,
  total_invoices     NUMERIC(12,2) DEFAULT 0,
  total_payments     NUMERIC(12,2) DEFAULT 0,
  invoice_count      INTEGER DEFAULT 0,
  payment_count      INTEGER DEFAULT 0,
  last_invoice_date  DATE,
  last_payment_date  DATE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_ssb_supplier ON store_supplier_balances(supplier_id);
CREATE INDEX IF NOT EXISTS idx_ssb_branch   ON store_supplier_balances(branch_id);

-- ---------------------------------------------------------------
-- FIX 6: store_purchase_order_items VIEW (missing)
-- Based on purchase_order_lines (real table behind store_po_items VIEW)
-- ---------------------------------------------------------------
CREATE OR REPLACE VIEW store_purchase_order_items AS
SELECT
  id,
  purchase_order_id AS po_id,
  purchase_order_id,
  item_id,
  item_id         AS sku,
  item_name,
  sku             AS item_sku,
  quantity_ordered,
  quantity_received,
  quantity_pending,
  unit,
  unit_price,
  line_total,
  created_at,
  updated_at
FROM purchase_order_lines;

-- ---------------------------------------------------------------
-- FIX 7: branch_departments — CREATE (referenced in stock flow)
-- Simple lookup table for department names/codes per branch
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS branch_departments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id       INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  department_code TEXT NOT NULL,
  department_name TEXT NOT NULL,
  department_type TEXT DEFAULT 'general' CHECK (department_type IN ('kitchen','bar','housekeeping','maintenance','restaurant','general','front_office','laundry')),
  is_active       BOOLEAN DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, department_code)
);

CREATE INDEX IF NOT EXISTS idx_branch_dept_branch ON branch_departments(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_dept_code   ON branch_departments(branch_id, department_code);

-- Seed default departments for existing branches
INSERT INTO branch_departments (branch_id, department_code, department_name, department_type)
SELECT
  b.id,
  dept.code,
  dept.name,
  dept.type
FROM branches b
CROSS JOIN (VALUES
  ('kitchen',       'Kitchen',        'kitchen'),
  ('bar',           'Bar',            'bar'),
  ('housekeeping',  'Housekeeping',   'housekeeping'),
  ('maintenance',   'Maintenance',    'maintenance'),
  ('restaurant',    'Restaurant',     'restaurant'),
  ('front_office',  'Front Office',   'front_office'),
  ('laundry',       'Laundry',        'laundry')
) AS dept(code, name, type)
ON CONFLICT (branch_id, department_code) DO NOTHING;

-- ---------------------------------------------------------------
-- NOTIFY PostgREST to reload schema
-- ---------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
