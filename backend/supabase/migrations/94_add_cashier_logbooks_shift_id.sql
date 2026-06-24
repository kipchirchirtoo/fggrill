-- The close-shift logbook generator (generateCashierShiftLogbook in
-- cashier-shifts.controller.ts) links each generated cashier_logbooks row
-- back to its cashier_shift_logs row via cashier_shift_id, and uses that
-- column to find/update an existing logbook instead of duplicating one.
-- The column was never added, so every insert fails with PGRST204
-- ("Could not find the 'cashier_shift_id' column"), the error is swallowed
-- as a soft automation warning, and the Branch Accountant's Cashier
-- Logbooks queue stays empty forever.

ALTER TABLE cashier_logbooks
  ADD COLUMN IF NOT EXISTS cashier_shift_id UUID REFERENCES cashier_shift_logs(id);

CREATE INDEX IF NOT EXISTS idx_cashier_logbooks_cashier_shift_id
  ON cashier_logbooks(cashier_shift_id);
