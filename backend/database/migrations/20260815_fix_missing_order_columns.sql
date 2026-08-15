-- Fix schema drift causing recurring 42703 "column does not exist" errors in
-- production (bar_orders.seat_number, restaurant_orders.amount_paid/balance_amount).
--
-- bar_orders.seat_number: defined in src/database/migrations/20251128_bar_module.sql's
-- CREATE TABLE IF NOT EXISTS — but that table already existed in production
-- before seat_number was added to the file, so the guard made the whole
-- statement a no-op and the column never actually landed.
--
-- restaurant_orders.amount_paid / balance_amount: referenced by
-- cashier.controller.ts's unpaid-orders/unpaid-bills queries and the
-- room-charge settlement flow, but never added by any migration.
--
-- All additive and idempotent — safe to run any number of times.

ALTER TABLE bar_orders
  ADD COLUMN IF NOT EXISTS seat_number VARCHAR(20);

ALTER TABLE restaurant_orders
  ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_amount DECIMAL(10, 2) DEFAULT 0;

-- Backfill existing rows from payment_status so historical orders aren't
-- all left showing balance_amount = total_amount (unpaid) when they were
-- actually already settled.
UPDATE restaurant_orders
SET
  amount_paid = CASE WHEN payment_status = 'paid' THEN total_amount ELSE amount_paid END,
  balance_amount = CASE WHEN payment_status = 'paid' THEN 0 ELSE COALESCE(total_amount, 0) - COALESCE(amount_paid, 0) END
WHERE amount_paid = 0 AND balance_amount = 0;
