-- Branch stock take workflow hardening:
-- storekeeper count -> accountant review -> auditor final review.

DO $$
BEGIN
  IF to_regclass('public.stock_counts') IS NOT NULL THEN
    ALTER TABLE public.stock_counts
      ADD COLUMN IF NOT EXISTS accountant_reviewed_by UUID,
      ADD COLUMN IF NOT EXISTS accountant_reviewed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS accountant_review_notes TEXT,
      ADD COLUMN IF NOT EXISTS auditor_reviewed_by UUID,
      ADD COLUMN IF NOT EXISTS auditor_reviewed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS auditor_review_notes TEXT,
      ADD COLUMN IF NOT EXISTS locked_by UUID,
      ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS next_opening_posted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS variance_threshold_warning NUMERIC(8,2) DEFAULT 5,
      ADD COLUMN IF NOT EXISTS variance_threshold_critical NUMERIC(8,2) DEFAULT 10;

    ALTER TABLE public.stock_counts
      DROP CONSTRAINT IF EXISTS stock_counts_status_check;

    ALTER TABLE public.stock_counts
      ADD CONSTRAINT stock_counts_status_check
      CHECK (status IN (
        'draft',
        'submitted',
        'under_review',
        'accountant_approved',
        'accountant_rejected',
        'auditor_review',
        'auditor_approved',
        'auditor_flagged',
        -- legacy statuses retained for deployed rows during rollout
        'submitted_to_accountant',
        'approved',
        'rejected'
      ));

    ALTER TABLE public.stock_counts
      DROP CONSTRAINT IF EXISTS stock_counts_store_type_check;

    ALTER TABLE public.stock_counts
      ADD CONSTRAINT stock_counts_store_type_check
      CHECK (store_type IN (
        'foodstuffs',
        'restaurant_store',
        'bar_store',
        'store_items',
        'main_bar',
        'executive_bar',
        'sports_bar',
        'kitchen_shift_a',
        'kitchen_shift_b',
        'kitchen_production',
        'housekeeping',
        'spa_sauna',
        'pos_outlet',
        'general'
      ));
  END IF;

  IF to_regclass('public.stock_count_items') IS NOT NULL THEN
    ALTER TABLE public.stock_count_items
      ADD COLUMN IF NOT EXISTS category TEXT,
      ADD COLUMN IF NOT EXISTS unit_of_measure TEXT,
      ADD COLUMN IF NOT EXISTS transfers_in NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS transfers_out NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS production_quantity NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS sales_quantity NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS wastage_quantity NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS returns_quantity NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS selling_price NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS variance_percentage NUMERIC(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS variance_severity TEXT DEFAULT 'green',
      ADD COLUMN IF NOT EXISTS variance_reason TEXT,
      ADD COLUMN IF NOT EXISTS notes TEXT;

    CREATE INDEX IF NOT EXISTS idx_stock_count_items_variance_severity
      ON public.stock_count_items(variance_severity);
  END IF;
END $$;
