-- Outlet-aware POS shift, inventory, and profit control.
-- Supports Restaurant, Main Bar, Executive Bar, Non-consumables, and Cashier fallback POS.

CREATE TABLE IF NOT EXISTS pos_outlets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  outlet_type TEXT NOT NULL CHECK (outlet_type IN (
    'restaurant',
    'main_bar',
    'executive_bar',
    'non_consumables',
    'cashier'
  )),
  name TEXT NOT NULL,
  pin_prefix CHAR(1) NOT NULL CHECK (pin_prefix IN ('R', 'M', 'E', 'N', 'C')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (branch_id, outlet_type),
  UNIQUE (branch_id, pin_prefix)
);

CREATE TABLE IF NOT EXISTS pos_outlet_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  outlet_id UUID NOT NULL REFERENCES pos_outlets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'cashier',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (outlet_id, user_id)
);

CREATE TABLE IF NOT EXISTS pos_outlet_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  outlet_id UUID NOT NULL REFERENCES pos_outlets(id) ON DELETE CASCADE,
  source_table TEXT,
  source_item_id UUID,
  sku TEXT,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT DEFAULT 'each',
  cost_price NUMERIC(14,2) DEFAULT 0,
  selling_price NUMERIC(14,2) DEFAULT 0,
  opening_stock NUMERIC(14,3) DEFAULT 0,
  current_stock NUMERIC(14,3) DEFAULT 0,
  track_stock BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (outlet_id, sku)
);

CREATE TABLE IF NOT EXISTS pos_outlet_shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  outlet_id UUID NOT NULL REFERENCES pos_outlets(id) ON DELETE CASCADE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  cashier_id UUID NOT NULL REFERENCES users(id),
  opening_float NUMERIC(14,2) DEFAULT 0,
  status TEXT DEFAULT 'open' CHECK (status IN (
    'open',
    'closed',
    'pending_review',
    'approved',
    'rejected'
  )),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewer_id UUID REFERENCES users(id),
  review_notes TEXT,
  summary JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_outlet_shifts_one_open
  ON pos_outlet_shifts(outlet_id, cashier_id)
  WHERE status = 'open';

CREATE TABLE IF NOT EXISTS pos_shift_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES pos_outlet_shifts(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES pos_outlets(id) ON DELETE CASCADE,
  source_type TEXT DEFAULT 'manual' CHECK (source_type IN (
    'manual',
    'restaurant_order',
    'bar_order',
    'pos_transaction'
  )),
  source_id UUID,
  order_number TEXT,
  customer_name TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN (
    'open',
    'paid',
    'credit_bill',
    'voided',
    'cancelled'
  )),
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN (
    'unpaid',
    'paid',
    'credit_bill',
    'voided'
  )),
  total_amount NUMERIC(14,2) DEFAULT 0,
  credit_bill_id UUID,
  items JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_shift_status
  ON pos_shift_orders(shift_id, status, payment_status);

CREATE TABLE IF NOT EXISTS pos_shift_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES pos_outlet_shifts(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES pos_outlets(id) ON DELETE CASCADE,
  order_id UUID REFERENCES pos_shift_orders(id) ON DELETE SET NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN (
    'cash',
    'mpesa',
    'card',
    'credit_bill'
  )),
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  reference TEXT,
  credit_bill_id UUID,
  received_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_shift_stock_counts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES pos_outlet_shifts(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES pos_outlets(id) ON DELETE CASCADE,
  outlet_item_id UUID NOT NULL REFERENCES pos_outlet_items(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  sku TEXT,
  unit TEXT DEFAULT 'each',
  cost_price NUMERIC(14,2) DEFAULT 0,
  selling_price NUMERIC(14,2) DEFAULT 0,
  opening_stock NUMERIC(14,3) DEFAULT 0,
  additions NUMERIC(14,3) DEFAULT 0,
  sold_quantity NUMERIC(14,3) DEFAULT 0,
  system_closing_stock NUMERIC(14,3) DEFAULT 0,
  physical_count NUMERIC(14,3),
  variance NUMERIC(14,3) DEFAULT 0,
  variance_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (shift_id, outlet_item_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_outlets_branch_type
  ON pos_outlets(branch_id, outlet_type);
CREATE INDEX IF NOT EXISTS idx_pos_outlet_assignments_user
  ON pos_outlet_assignments(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_pos_outlet_items_outlet
  ON pos_outlet_items(outlet_id, is_active);
CREATE INDEX IF NOT EXISTS idx_pos_shift_stock_counts_shift
  ON pos_shift_stock_counts(shift_id);

ALTER TABLE IF EXISTS pos_transactions
  ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES pos_outlets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS outlet_shift_id UUID REFERENCES pos_outlet_shifts(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS cashier_transactions
  ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES pos_outlets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS outlet_shift_id UUID REFERENCES pos_outlet_shifts(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS restaurant_orders
  ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES pos_outlets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS outlet_shift_id UUID REFERENCES pos_outlet_shifts(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS bar_orders
  ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES pos_outlets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS outlet_shift_id UUID REFERENCES pos_outlet_shifts(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_pos_outlets_updated_at'
  ) THEN
    CREATE TRIGGER set_pos_outlets_updated_at
    BEFORE UPDATE ON pos_outlets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;

COMMENT ON TABLE pos_outlets IS 'Branch selling points for outlet-aware POS: restaurant, bars, non-consumables, cashier.';
COMMENT ON TABLE pos_outlet_items IS 'Outlet sellable menu/items with cost and selling price for COGS/profit.';
COMMENT ON TABLE pos_outlet_shifts IS 'Cashier shift lifecycle per outlet.';
COMMENT ON TABLE pos_shift_stock_counts IS 'Opening/additions/system closing/physical count/variance sheet per shift item.';

-- Seed the standard outlet structure for every branch. Existing rows are kept.
INSERT INTO pos_outlets (branch_id, outlet_type, name, pin_prefix)
SELECT id, 'restaurant', name || ' Restaurant POS', 'R'
FROM branches
ON CONFLICT (branch_id, outlet_type) DO NOTHING;

INSERT INTO pos_outlets (branch_id, outlet_type, name, pin_prefix)
SELECT id, 'main_bar', name || ' Main Bar POS', 'M'
FROM branches
ON CONFLICT (branch_id, outlet_type) DO NOTHING;

INSERT INTO pos_outlets (branch_id, outlet_type, name, pin_prefix)
SELECT id, 'executive_bar', name || ' Executive Bar POS', 'E'
FROM branches
ON CONFLICT (branch_id, outlet_type) DO NOTHING;

INSERT INTO pos_outlets (branch_id, outlet_type, name, pin_prefix)
SELECT id, 'non_consumables', name || ' Non-consumables POS', 'N'
FROM branches
ON CONFLICT (branch_id, outlet_type) DO NOTHING;

INSERT INTO pos_outlets (branch_id, outlet_type, name, pin_prefix)
SELECT id, 'cashier', name || ' Cashier POS', 'C'
FROM branches
ON CONFLICT (branch_id, outlet_type) DO NOTHING;
