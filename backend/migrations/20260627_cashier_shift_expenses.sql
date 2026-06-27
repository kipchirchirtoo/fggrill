-- Cashier dashboard: shift expense entries (e.g. fuel, petty purchases) the
-- cashier logs during their shift, tagged with how the expense was paid
-- (cash/mpesa/card) so it can reduce that method's reported sales — same
-- pattern already used for credit_bills_details/paid_bills_details on this
-- table (entries staged in the Close Shift Logbook dialog, persisted at
-- shift-close time, not as a separate live-relational table).
-- Confirmed against the live DB on 2026-06-27: cashier_shift_logs has no
-- expense_total/expense_details columns today. Additive only.

ALTER TABLE public.cashier_shift_logs
  ADD COLUMN IF NOT EXISTS expense_total NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expense_details JSONB NOT NULL DEFAULT '[]'::jsonb;
