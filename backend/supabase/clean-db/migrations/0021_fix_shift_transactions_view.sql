-- =============================================================
-- 0021: Add is_voided to cashier_shift_transactions + rebuild view
-- shift_transactions is a VIEW on cashier_shift_transactions.
-- The cashier controller filters by is_voided = false.
-- =============================================================

-- Add is_voided to the underlying table
ALTER TABLE cashier_shift_transactions ADD COLUMN IF NOT EXISTS is_voided BOOLEAN DEFAULT FALSE;
ALTER TABLE cashier_shift_transactions ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE cashier_shift_transactions ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Rebuild the view to expose is_voided (must drop first to add columns)
DROP VIEW IF EXISTS shift_transactions;
CREATE VIEW shift_transactions AS
SELECT
  id,
  shift_id,
  transaction_id,
  transaction_ref,
  payment_method,
  amount,
  transaction_time,
  source_table,
  source_id,
  branch_id,
  notes,
  is_voided,
  voided_at,
  voided_by,
  created_at
FROM cashier_shift_transactions;
