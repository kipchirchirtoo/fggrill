-- ============================================================================
-- Cash PO payment stamp
--
-- When a cashier confirms a cash payment for an approved/received Purchase
-- Order from the Expenses & Petty Cash module, we record WHO paid it and from
-- WHICH cashier shift, alongside the existing finance_status = 'paid' flag and
-- the PAYOUT cashier_transaction. Idempotent — safe to run multiple times.
-- ============================================================================

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS paid_by_cashier_id uuid,
  ADD COLUMN IF NOT EXISTS paid_shift_id      uuid,
  ADD COLUMN IF NOT EXISTS paid_at            timestamptz;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_paid_shift
  ON public.purchase_orders (paid_shift_id)
  WHERE paid_shift_id IS NOT NULL;
