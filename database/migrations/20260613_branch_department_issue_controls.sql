-- Branch Store -> Department Issue controls
-- Enforces audited no-negative branch stock and speeds Material Issue Note lookups.

DO $$
BEGIN
  IF to_regclass('public.branch_stock') IS NOT NULL THEN
    UPDATE public.branch_stock
    SET quantity = 0
    WHERE quantity < 0;

    ALTER TABLE public.branch_stock
      DROP CONSTRAINT IF EXISTS branch_stock_quantity_nonnegative;

    ALTER TABLE public.branch_stock
      ADD CONSTRAINT branch_stock_quantity_nonnegative CHECK (quantity >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.department_inventory_ledger') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_department_inventory_ledger_min_number
      ON public.department_inventory_ledger ((metadata->>'min_number'))
      WHERE source_type = 'material_issue_note';

    CREATE INDEX IF NOT EXISTS idx_department_inventory_ledger_issue_status
      ON public.department_inventory_ledger ((metadata->>'issue_status'), branch_id, created_at DESC)
      WHERE source_type = 'material_issue_note';
  END IF;
END $$;
