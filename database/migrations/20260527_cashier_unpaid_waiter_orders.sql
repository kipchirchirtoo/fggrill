-- Cashier unpaid waiter-order clearance support.
-- Adds per-order paid/balance tracking and payroll migration markers used by
-- /api/cashier/unpaid-orders.

ALTER TABLE IF EXISTS restaurant_orders
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS migrated_to_credit_bill BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credit_bill_id UUID REFERENCES staff_credit_bills(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS bar_orders
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS migrated_to_credit_bill BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credit_bill_id UUID REFERENCES staff_credit_bills(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

UPDATE restaurant_orders
SET
  amount_paid = COALESCE(amount_paid, 0),
  balance_amount = GREATEST(COALESCE(total_amount, 0) - COALESCE(amount_paid, 0), 0)
WHERE balance_amount IS NULL;

UPDATE bar_orders
SET
  amount_paid = COALESCE(amount_paid, 0),
  balance_amount = GREATEST(COALESCE(total, 0) - COALESCE(amount_paid, 0), 0)
WHERE balance_amount IS NULL;

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_cashier_unpaid_day
  ON restaurant_orders(branch_id, created_at, payment_status)
  WHERE payment_status <> 'paid';

CREATE INDEX IF NOT EXISTS idx_bar_orders_cashier_unpaid_day
  ON bar_orders(branch_id, created_at, payment_status)
  WHERE payment_status <> 'paid';
