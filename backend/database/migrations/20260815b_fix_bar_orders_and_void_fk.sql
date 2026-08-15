-- Follow-up to 20260815_fix_missing_order_columns.sql — same schema-drift
-- class of bug, newly surfaced now that the first round of errors stopped.

-- bar_orders: guest_name/amount_paid/balance_amount are selected together in
-- cashier.controller.ts's unpaid bar-orders queries but were never added by
-- any migration (guest_name predates this; amount_paid/balance_amount were
-- likely assumed-present by analogy with restaurant_orders).
ALTER TABLE bar_orders
  ADD COLUMN IF NOT EXISTS guest_name TEXT,
  ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_amount DECIMAL(10, 2) DEFAULT 0;

UPDATE bar_orders
SET
  amount_paid = CASE WHEN payment_status = 'paid' THEN total ELSE amount_paid END,
  balance_amount = CASE WHEN payment_status = 'paid' THEN 0 ELSE COALESCE(total, 0) - COALESCE(amount_paid, 0) END
WHERE amount_paid = 0 AND balance_amount = 0;

-- void_bills_audit_void_id_fkey currently references void_bills(id) — a
-- table nothing in the current codebase writes to or reads from. The actual
-- write path (outlet-pos.controller.ts's cashierVoidWholeBill) inserts
-- void_id = a pos_void_requests.id, so every insert has been failing the FK
-- check since the day this constraint was created. All 0 existing
-- void_bills_audit rows conflict with pos_void_requests (verified before
-- writing this), so repointing is a clean, non-destructive change.
ALTER TABLE void_bills_audit DROP CONSTRAINT IF EXISTS void_bills_audit_void_id_fkey;
ALTER TABLE void_bills_audit
  ADD CONSTRAINT void_bills_audit_void_id_fkey
  FOREIGN KEY (void_id) REFERENCES pos_void_requests(id);
