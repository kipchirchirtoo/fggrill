-- =============================================================
-- 0024: Create all missing restaurant/POS/kitchen tables
-- Tables: order_sequences, kitchen_requests, kitchen_request_items,
--         pos_shift_order_items, cashier_bills, void_requests,
--         pos_shift_payments (if missing)
-- =============================================================

-- ---------------------------------------------------------------
-- order_sequences: fallback counter for sku.service.ts
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_sequences (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_type TEXT NOT NULL,
  sequence_date DATE NOT NULL DEFAULT CURRENT_DATE,
  current_number INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sequence_type, sequence_date)
);

-- ---------------------------------------------------------------
-- kitchen_requests: direct kitchen tickets raised by restaurant/bar
-- Decoupled from full order flow — used for special requests,
-- modifications, and direct kitchen display routing
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kitchen_requests (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id       INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  request_number  TEXT UNIQUE,
  source          TEXT DEFAULT 'restaurant' CHECK (source IN ('restaurant','bar','room_service','pos','conference')),
  order_id        UUID REFERENCES restaurant_orders(id) ON DELETE SET NULL,
  bill_id         UUID REFERENCES restaurant_bills(id) ON DELETE SET NULL,
  pos_order_id    UUID REFERENCES pos_shift_orders(id) ON DELETE SET NULL,
  table_number    TEXT,
  room_number     TEXT,
  department      TEXT DEFAULT 'kitchen',
  priority        TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent','fire')),
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','acknowledged','preparing','ready','served','cancelled')),
  special_instructions TEXT,
  notes           TEXT,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  preparing_at    TIMESTAMPTZ,
  ready_at        TIMESTAMPTZ,
  served_at       TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kitchen_requests_branch  ON kitchen_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_requests_status  ON kitchen_requests(status);
CREATE INDEX IF NOT EXISTS idx_kitchen_requests_order   ON kitchen_requests(order_id);

-- Auto-generate request_number
CREATE OR REPLACE FUNCTION trg_fn_kitchen_request_number()
RETURNS TRIGGER AS $$
DECLARE seq BIGINT;
BEGIN
  IF NEW.request_number IS NULL THEN
    seq := public._next_seq('kds:' || COALESCE(NEW.branch_id::TEXT,'g') || ':' || TO_CHAR(NOW(),'YYYYMMDD'));
    NEW.request_number := 'KDS-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' || LPAD(seq::TEXT,4,'0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kitchen_request_number ON kitchen_requests;
CREATE TRIGGER trg_kitchen_request_number
  BEFORE INSERT ON kitchen_requests
  FOR EACH ROW EXECUTE FUNCTION trg_fn_kitchen_request_number();

-- ---------------------------------------------------------------
-- kitchen_request_items: line items for kitchen requests
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kitchen_request_items (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kitchen_request_id   UUID NOT NULL REFERENCES kitchen_requests(id) ON DELETE CASCADE,
  menu_item_id         UUID REFERENCES restaurant_menu_items(id) ON DELETE SET NULL,
  item_name            TEXT NOT NULL,
  quantity             INTEGER NOT NULL DEFAULT 1,
  unit_price           NUMERIC(12,2) DEFAULT 0,
  total_price          NUMERIC(12,2) DEFAULT 0,
  special_instructions TEXT,
  status               TEXT DEFAULT 'pending' CHECK (status IN ('pending','preparing','ready','served','cancelled')),
  is_ready             BOOLEAN DEFAULT FALSE,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kri_request ON kitchen_request_items(kitchen_request_id);

-- ---------------------------------------------------------------
-- pos_shift_order_items: explicit items table for POS orders
-- Currently pos_shift_orders stores items as JSONB.
-- This table coexists — populated when items are added individually.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pos_shift_order_items (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id             UUID NOT NULL REFERENCES pos_shift_orders(id) ON DELETE CASCADE,
  shift_id             UUID REFERENCES pos_shifts(id) ON DELETE SET NULL,
  outlet_id            UUID REFERENCES pos_outlets(id) ON DELETE SET NULL,
  branch_id            INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  menu_item_id         UUID REFERENCES restaurant_menu_items(id) ON DELETE SET NULL,
  item_name            TEXT NOT NULL,
  sku                  TEXT,
  category             TEXT,
  quantity             INTEGER NOT NULL DEFAULT 1,
  unit_price           NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount      NUMERIC(12,2) DEFAULT 0,
  line_total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount           NUMERIC(12,2) DEFAULT 0,
  special_instructions TEXT,
  status               TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','preparing','ready','served','voided','cancelled')),
  is_void              BOOLEAN DEFAULT FALSE,
  voided_at            TIMESTAMPTZ,
  voided_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  void_reason          TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_psoi_order  ON pos_shift_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_psoi_shift  ON pos_shift_order_items(shift_id);
CREATE INDEX IF NOT EXISTS idx_psoi_branch ON pos_shift_order_items(branch_id);

-- ---------------------------------------------------------------
-- cashier_bills: cashier-issued bills (hotel/manual)
-- Referenced in cashier.controller.ts as cashier_bills
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cashier_bills (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id       INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  bill_number     TEXT UNIQUE,
  short_code      TEXT,
  bill_type       TEXT DEFAULT 'general' CHECK (bill_type IN ('general','hotel','restaurant','bar','pos','credit','advance')),
  customer_name   TEXT,
  customer_phone  TEXT,
  customer_email  TEXT,
  guest_id        UUID REFERENCES guests(id) ON DELETE SET NULL,
  room_number     TEXT,
  reservation_id  UUID REFERENCES reservations(id) ON DELETE SET NULL,
  waiter_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  subtotal        NUMERIC(12,2) DEFAULT 0,
  tax_amount      NUMERIC(12,2) DEFAULT 0,
  service_charge  NUMERIC(12,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  total_amount    NUMERIC(12,2) DEFAULT 0,
  amount_paid     NUMERIC(12,2) DEFAULT 0,
  balance_due     NUMERIC(12,2) DEFAULT 0,
  payment_status  TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid','voided','credit')),
  payment_method  TEXT,
  status          TEXT DEFAULT 'open' CHECK (status IN ('open','closed','paid','voided','cancelled')),
  notes           TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  closed_at       TIMESTAMPTZ,
  closed_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Auto bill_number + short_code
CREATE OR REPLACE FUNCTION trg_fn_cashier_bill_number()
RETURNS TRIGGER AS $$
DECLARE seq BIGINT;
BEGIN
  IF NEW.bill_number IS NULL THEN
    seq := public._next_seq('cbill:' || COALESCE(NEW.branch_id::TEXT,'g') || ':' || TO_CHAR(NOW(),'YYYYMMDD'));
    NEW.bill_number := 'CBILL-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' || LPAD(seq::TEXT,4,'0');
  END IF;
  IF NEW.short_code IS NULL OR NEW.short_code = '' THEN
    NEW.short_code := extract_short_code(NEW.bill_number);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cashier_bill_number ON cashier_bills;
CREATE TRIGGER trg_cashier_bill_number
  BEFORE INSERT ON cashier_bills
  FOR EACH ROW EXECUTE FUNCTION trg_fn_cashier_bill_number();

CREATE INDEX IF NOT EXISTS idx_cashier_bills_branch     ON cashier_bills(branch_id);
CREATE INDEX IF NOT EXISTS idx_cashier_bills_short_code ON cashier_bills(short_code);
CREATE INDEX IF NOT EXISTS idx_cashier_bills_status     ON cashier_bills(status);

-- ---------------------------------------------------------------
-- void_requests: already exists — add missing columns for
-- restaurant-bills.controller.ts requestVoidOrder / approveVoidRequest
-- ---------------------------------------------------------------
ALTER TABLE void_requests ADD COLUMN IF NOT EXISTS order_id         UUID REFERENCES restaurant_orders(id) ON DELETE CASCADE;
ALTER TABLE void_requests ADD COLUMN IF NOT EXISTS pos_order_id     UUID REFERENCES pos_shift_orders(id) ON DELETE CASCADE;
ALTER TABLE void_requests ADD COLUMN IF NOT EXISTS source           TEXT DEFAULT 'restaurant';
ALTER TABLE void_requests ADD COLUMN IF NOT EXISTS reviewed_by      UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE void_requests ADD COLUMN IF NOT EXISTS reviewed_at      TIMESTAMPTZ;
ALTER TABLE void_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_void_requests_branch ON void_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_void_requests_status ON void_requests(status);
CREATE INDEX IF NOT EXISTS idx_void_requests_order  ON void_requests(order_id);

-- ---------------------------------------------------------------
-- pos_shift_payments: already exists — add missing columns
-- ---------------------------------------------------------------
ALTER TABLE pos_shift_payments ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE pos_shift_payments ADD COLUMN IF NOT EXISTS notes     TEXT;
ALTER TABLE pos_shift_payments ADD COLUMN IF NOT EXISTS short_code TEXT;

CREATE INDEX IF NOT EXISTS idx_psp_shift  ON pos_shift_payments(shift_id);
CREATE INDEX IF NOT EXISTS idx_psp_order  ON pos_shift_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_psp_branch ON pos_shift_payments(branch_id);
