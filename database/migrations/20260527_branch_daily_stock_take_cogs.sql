-- Daily branch stock takes for COGS and accountant/auditor review.

DO $$
BEGIN
  IF to_regclass('public.stock_counts') IS NOT NULL THEN
    ALTER TABLE public.stock_counts
      ADD COLUMN IF NOT EXISTS store_type TEXT DEFAULT 'foodstuffs',
      ADD COLUMN IF NOT EXISTS outlet_code TEXT,
      ADD COLUMN IF NOT EXISTS submitted_to_accountant_by UUID,
      ADD COLUMN IF NOT EXISTS submitted_to_accountant_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS accountant_submitted_by UUID,
      ADD COLUMN IF NOT EXISTS accountant_submitted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS auditor_reviewed_by UUID,
      ADD COLUMN IF NOT EXISTS auditor_reviewed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS total_stock_value NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_cogs_value NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_variance_value NUMERIC(14,2) DEFAULT 0;

    ALTER TABLE public.stock_counts
      DROP CONSTRAINT IF EXISTS stock_counts_status_check;

    ALTER TABLE public.stock_counts
      ADD CONSTRAINT stock_counts_status_check
      CHECK (status IN (
        'draft',
        'submitted_to_accountant',
        'submitted',
        'approved',
        'rejected'
      ));

    ALTER TABLE public.stock_counts
      DROP CONSTRAINT IF EXISTS stock_counts_store_type_check;

    ALTER TABLE public.stock_counts
      ADD CONSTRAINT stock_counts_store_type_check
      CHECK (store_type IN ('foodstuffs', 'bar_store', 'store_items'));

    CREATE INDEX IF NOT EXISTS idx_stock_counts_branch_date_type
      ON public.stock_counts(branch_id, count_date, store_type, outlet_code);
  END IF;

  IF to_regclass('public.stock_count_items') IS NOT NULL THEN
    ALTER TABLE public.stock_count_items
      ADD COLUMN IF NOT EXISTS store_type TEXT,
      ADD COLUMN IF NOT EXISTS opening_stock NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS additions NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS issued_quantity NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS system_closing_stock NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS variance_reason TEXT,
      ADD COLUMN IF NOT EXISTS department_issued JSONB DEFAULT '{}'::jsonb;

    CREATE INDEX IF NOT EXISTS idx_stock_count_items_store_type
      ON public.stock_count_items(store_type);
  END IF;
END $$;
