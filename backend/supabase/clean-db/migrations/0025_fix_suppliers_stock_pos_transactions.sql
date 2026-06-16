-- =============================================================
-- 0025: Fix store_suppliers, stock-take function ambiguity,
--       create pos_transactions + pos_transaction_items
-- =============================================================

-- ---------------------------------------------------------------
-- FIX 1: store_suppliers is a VIEW over 'suppliers' table
-- Add remaining missing columns to suppliers, then rebuild view
-- ---------------------------------------------------------------

-- Add the two columns not yet on suppliers
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS vat_registered     BOOLEAN DEFAULT FALSE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER DEFAULT 30;

-- Backfill aliases on the real table
UPDATE suppliers SET address_line1 = address WHERE address_line1 IS NULL AND address IS NOT NULL;
UPDATE suppliers SET tax_id = tax_pin WHERE tax_id IS NULL AND tax_pin IS NOT NULL;

-- Sync trigger on suppliers (the real table)
CREATE OR REPLACE FUNCTION sync_supplier_aliases()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.address IS DISTINCT FROM OLD.address THEN NEW.address_line1 := NEW.address; END IF;
  IF NEW.address_line1 IS DISTINCT FROM OLD.address_line1 THEN NEW.address := NEW.address_line1; END IF;
  IF NEW.tax_pin IS DISTINCT FROM OLD.tax_pin THEN NEW.tax_id := NEW.tax_pin; END IF;
  IF NEW.tax_id IS DISTINCT FROM OLD.tax_id THEN NEW.tax_pin := NEW.tax_id; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_supplier_aliases ON suppliers;
CREATE TRIGGER trg_sync_supplier_aliases
  BEFORE INSERT OR UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION sync_supplier_aliases();

-- Rebuild store_suppliers VIEW to expose all columns
DROP VIEW IF EXISTS store_suppliers;
CREATE VIEW store_suppliers AS
SELECT
  id, branch_id, supplier_code, name, legal_name, contact_person,
  phone, alternate_phone, email, website,
  address, address_line1, address_line2, city, state, country, postal_code,
  tax_pin, tax_id, vat_number, vat_registered, registration_number,
  payment_terms, payment_terms_days, credit_limit,
  bank_name, bank_account_number, bank_branch,
  lead_time_days, is_preferred, notes,
  status, metadata, created_at, updated_at
FROM suppliers;

CREATE INDEX IF NOT EXISTS idx_suppliers_branch ON suppliers(branch_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);

-- ---------------------------------------------------------------
-- FIX 2: get_stock_take_number ambiguity
-- Two overloads both match a no-arg call → drop the parameterized one
-- ---------------------------------------------------------------
DROP FUNCTION IF EXISTS get_stock_take_number(p_branch_id INTEGER);

-- ---------------------------------------------------------------
-- FIX 3: Create pos_transactions table
-- Used by: cashier.controller.ts (create/pay/status),
--          shiftPnLService.ts, foodControlService.ts,
--          payments.controller.ts, migrate-pending-bills.job.ts
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pos_transactions (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id         INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  outlet_id         UUID REFERENCES pos_outlets(id) ON DELETE SET NULL,
  shift_id          UUID REFERENCES pos_shifts(id) ON DELETE SET NULL,
  transaction_ref   TEXT UNIQUE,
  transaction_number TEXT,
  short_code        TEXT,
  cashier_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_name     TEXT,
  customer_phone    TEXT,
  subtotal          NUMERIC(12,2) DEFAULT 0,
  tax_amount        NUMERIC(12,2) DEFAULT 0,
  discount_amount   NUMERIC(12,2) DEFAULT 0,
  service_charge    NUMERIC(12,2) DEFAULT 0,
  total_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid       NUMERIC(12,2) DEFAULT 0,
  change_amount     NUMERIC(12,2) DEFAULT 0,
  payment_method    TEXT,
  payment_reference TEXT,
  status            TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING','PAID','VOIDED','REFUNDED','FAILED')),
  mpesa_checkout_id TEXT,
  paid_at           TIMESTAMPTZ,
  voided_at         TIMESTAMPTZ,
  voided_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  void_reason       TEXT,
  notes             TEXT,
  metadata          JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate transaction_number and short_code on insert
CREATE OR REPLACE FUNCTION trg_fn_pos_transaction_ref()
RETURNS TRIGGER AS $$
DECLARE seq BIGINT;
BEGIN
  IF NEW.transaction_number IS NULL THEN
    seq := public._next_seq('cstx:' || COALESCE(NEW.branch_id::TEXT,'g') || ':' || TO_CHAR(NOW(),'YYYYMMDD'));
    NEW.transaction_number := 'CS-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' || LPAD(seq::TEXT,4,'0');
  END IF;
  IF NEW.short_code IS NULL OR NEW.short_code = '' THEN
    NEW.short_code := extract_short_code(COALESCE(NEW.transaction_ref, NEW.transaction_number));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pos_transaction_ref ON pos_transactions;
CREATE TRIGGER trg_pos_transaction_ref
  BEFORE INSERT ON pos_transactions
  FOR EACH ROW EXECUTE FUNCTION trg_fn_pos_transaction_ref();

CREATE INDEX IF NOT EXISTS idx_pos_tx_branch  ON pos_transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_pos_tx_shift   ON pos_transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_pos_tx_status  ON pos_transactions(status);
CREATE INDEX IF NOT EXISTS idx_pos_tx_ref     ON pos_transactions(transaction_ref);
CREATE INDEX IF NOT EXISTS idx_pos_tx_short   ON pos_transactions(short_code);
CREATE INDEX IF NOT EXISTS idx_pos_tx_cashier ON pos_transactions(cashier_id);

-- ---------------------------------------------------------------
-- FIX 4: Create pos_transaction_items table
-- Used by: cashier.controller.ts, foodControlService.ts
-- Items inserted with: transaction_id, product_id, qty,
--   unit_price, discount_amount, tax_amount, line_total
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pos_transaction_items (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id  UUID NOT NULL REFERENCES pos_transactions(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES restaurant_menu_items(id) ON DELETE SET NULL,
  item_name       TEXT,
  sku             TEXT,
  qty             INTEGER NOT NULL DEFAULT 1,
  unit_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  tax_amount      NUMERIC(12,2) DEFAULT 0,
  line_total      NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_ti_transaction ON pos_transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_pos_ti_product     ON pos_transaction_items(product_id);
