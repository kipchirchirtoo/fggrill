-- Migration to fix shift reconciliation tables referencing the legacy cashier_shifts table.
-- They must reference cashier_shift_logs (the canonical shifts table).

ALTER TABLE IF EXISTS public.shift_actual_collections
  DROP CONSTRAINT IF EXISTS shift_actual_collections_shift_id_fkey;

ALTER TABLE IF EXISTS public.shift_actual_collections
  ADD CONSTRAINT shift_actual_collections_shift_id_fkey
  FOREIGN KEY (shift_id)
  REFERENCES public.cashier_shift_logs(id)
  ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.shift_reconciliation_expenses
  DROP CONSTRAINT IF EXISTS shift_reconciliation_expenses_shift_id_fkey;

ALTER TABLE IF EXISTS public.shift_reconciliation_expenses
  ADD CONSTRAINT shift_reconciliation_expenses_shift_id_fkey
  FOREIGN KEY (shift_id)
  REFERENCES public.cashier_shift_logs(id)
  ON DELETE CASCADE;
