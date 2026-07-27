-- Migration: Fix shift_reconciliation_expenses category check constraint
-- Drops the old restrictive CHECK constraint (category IN ('petty_cash','transaction_cost','other'))
-- so custom categories (e.g. 'MAINTENANCE', 'SUPPLIES', 'FOOD', 'STAFF', 'TRANSPORT', 'REPAIRS', etc.)
-- can be stored cleanly without throwing 23514 check constraint errors.

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Search for any check constraint on category column in shift_reconciliation_expenses
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.shift_reconciliation_expenses'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%category%'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.shift_reconciliation_expenses DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
    RAISE NOTICE 'Dropped category check constraint % on shift_reconciliation_expenses', v_constraint_name;
  END IF;
END $$;
