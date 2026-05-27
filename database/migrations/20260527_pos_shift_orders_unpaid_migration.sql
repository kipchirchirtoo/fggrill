-- Allow uncleared outlet POS captain orders to migrate into waiter unpaid bills.

ALTER TABLE IF EXISTS pos_shift_orders
  ADD COLUMN IF NOT EXISTS migrated_to_credit_bill BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_unpaid_migration
  ON pos_shift_orders(payment_status, status, migrated_to_credit_bill, created_at);
