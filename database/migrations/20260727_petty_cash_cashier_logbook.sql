-- =====================================================================
-- Cashier shift expenses — extend the canonical shift-expense table
-- =====================================================================
-- The cashier Expenses tab records petty-cash / cash expenses against the
-- current open shift. The correct, shift-linked table for this already exists
-- in production: `shift_reconciliation_expenses`
--   (id, shift_id, branch_id, category, amount, description, recorded_by,
--    created_at)
-- shared with the branch-accountant reconciliation flow
-- (cashier-clearance.controller.ts).
--
-- NOTE: `petty_cash_ledger` in production is a DOUBLE-ENTRY accounting ledger
-- (txn_id, debit, credit, balance) — NOT a shift-expense table — so cashier
-- expenses must NOT be written there.
--
-- This adds the optional detail columns the Expenses tab captures (who was
-- paid, receipt no., and an optional PO reference for traceability — tag only;
-- real supplier payments stay in the storekeeping AP/GRNI flow), plus lookup
-- indexes. shift_id references the cashier logbook shift (cashier_shift_logs).
--
-- Safe to run multiple times.
-- =====================================================================

ALTER TABLE shift_reconciliation_expenses
  ADD COLUMN IF NOT EXISTS paid_to_name TEXT;

ALTER TABLE shift_reconciliation_expenses
  ADD COLUMN IF NOT EXISTS receipt_number TEXT;

ALTER TABLE shift_reconciliation_expenses
  ADD COLUMN IF NOT EXISTS po_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_shift_recon_expenses_shift
  ON shift_reconciliation_expenses (shift_id);

CREATE INDEX IF NOT EXISTS idx_shift_recon_expenses_branch_date
  ON shift_reconciliation_expenses (branch_id, created_at DESC);
