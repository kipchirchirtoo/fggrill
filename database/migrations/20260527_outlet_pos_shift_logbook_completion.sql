-- Complete outlet POS shift logbook support.
-- Adds split bill clearance, staff-credit source links, cashier close cash
-- fields, and Kyogong-capable outlet definitions while preserving separate POS
-- stations.

ALTER TABLE IF EXISTS pos_outlets
  DROP CONSTRAINT IF EXISTS pos_outlets_outlet_type_check;

ALTER TABLE IF EXISTS pos_outlets
  ADD CONSTRAINT pos_outlets_outlet_type_check CHECK (outlet_type IN (
    'restaurant',
    'main_bar',
    'executive_bar',
    'non_consumables',
    'cashier',
    'kyogong_reception',
    'kyogong_spa',
    'kyogong_executive_bar',
    'kyogong_sports_bar'
  ));

ALTER TABLE IF EXISTS pos_outlets
  DROP CONSTRAINT IF EXISTS pos_outlets_pin_prefix_check;

ALTER TABLE IF EXISTS pos_outlets
  ADD CONSTRAINT pos_outlets_pin_prefix_check CHECK (pin_prefix IN (
    'R', 'M', 'E', 'N', 'C', 'K', 'S', 'X', 'Y'
  ));

ALTER TABLE IF EXISTS pos_shift_orders
  DROP CONSTRAINT IF EXISTS pos_shift_orders_payment_status_check;

ALTER TABLE IF EXISTS pos_shift_orders
  ADD CONSTRAINT pos_shift_orders_payment_status_check CHECK (payment_status IN (
    'unpaid',
    'partial',
    'paid',
    'credit_bill',
    'voided'
  ));

ALTER TABLE IF EXISTS pos_shift_orders
  ADD COLUMN IF NOT EXISTS waiter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS waiter_name TEXT,
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS staff_credit_bill_id UUID REFERENCES staff_credit_bills(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS pos_shift_payments
  ADD COLUMN IF NOT EXISTS staff_credit_bill_id UUID REFERENCES staff_credit_bills(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS pos_shift_stock_counts
  ADD COLUMN IF NOT EXISTS track_stock BOOLEAN DEFAULT TRUE;

ALTER TABLE IF EXISTS pos_outlet_shifts
  ADD COLUMN IF NOT EXISTS closing_cash_counted NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS expected_cash NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_variance NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_variance_reason TEXT;

ALTER TABLE IF EXISTS staff_credit_bills
  ADD COLUMN IF NOT EXISTS source_pos_shift_id UUID REFERENCES pos_outlet_shifts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_pos_order_id UUID REFERENCES pos_shift_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_pos_payment_id UUID REFERENCES pos_shift_payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_waiter
  ON pos_shift_orders(waiter_id);

CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_payment_status
  ON pos_shift_orders(shift_id, payment_status);

CREATE INDEX IF NOT EXISTS idx_pos_shift_payments_staff_credit
  ON pos_shift_payments(staff_credit_bill_id);

CREATE INDEX IF NOT EXISTS idx_staff_credit_bills_source_pos
  ON staff_credit_bills(source_pos_shift_id, source_pos_order_id);

UPDATE pos_shift_orders
SET
  amount_paid = COALESCE(amount_paid, 0),
  balance_amount = GREATEST(COALESCE(total_amount, 0) - COALESCE(amount_paid, 0), 0)
WHERE amount_paid IS NULL OR balance_amount IS NULL;

INSERT INTO pos_outlets (branch_id, outlet_type, name, pin_prefix)
SELECT id, 'kyogong_reception', name || ' Kyogong Reception POS', 'K'
FROM branches
ON CONFLICT (branch_id, outlet_type) DO NOTHING;

INSERT INTO pos_outlets (branch_id, outlet_type, name, pin_prefix)
SELECT id, 'kyogong_spa', name || ' Kyogong Spa POS', 'S'
FROM branches
ON CONFLICT (branch_id, outlet_type) DO NOTHING;

INSERT INTO pos_outlets (branch_id, outlet_type, name, pin_prefix)
SELECT id, 'kyogong_executive_bar', name || ' Kyogong Executive Bar POS', 'X'
FROM branches
ON CONFLICT (branch_id, outlet_type) DO NOTHING;

INSERT INTO pos_outlets (branch_id, outlet_type, name, pin_prefix)
SELECT id, 'kyogong_sports_bar', name || ' Kyogong Sports Bar POS', 'Y'
FROM branches
ON CONFLICT (branch_id, outlet_type) DO NOTHING;
