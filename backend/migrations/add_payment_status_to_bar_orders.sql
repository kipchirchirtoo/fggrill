-- The live bar_orders table is missing the payment_status column that
-- application code throughout cashier.controller.ts, cashier-shifts.controller.ts,
-- bar/orders.controller.ts, and others already read/write (mirroring
-- restaurant_orders.payment_status). Without it, shift close ("Cannot close
-- shift" unsettled-bills check), bar payment recording, and bar bills
-- listing all fail with: column bar_orders.payment_status does not exist (42703).
--
-- This restores the column as originally defined in
-- backend/src/database/migrations/20251128_bar_module.sql, and backfills
-- existing rows from the workflow `status` column so historical orders are
-- not all misreported as unpaid.

ALTER TABLE bar_orders
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';

UPDATE bar_orders
SET payment_status = CASE
  WHEN status IN ('completed', 'paid', 'cleared') THEN 'paid'
  WHEN status IN ('voided', 'cancelled') THEN 'voided'
  ELSE 'pending'
END
WHERE payment_status IS NULL OR payment_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_bar_orders_payment_status ON bar_orders(payment_status);
