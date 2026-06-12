-- Enterprise inventory controls for department consumption, POS stock mapping,
-- branch stock-take approvals, kitchen production, and immutable audit history.

DO $$
BEGIN
  IF to_regclass('public.stock_counts') IS NOT NULL THEN
    ALTER TABLE public.stock_counts
      ADD COLUMN IF NOT EXISTS accountant_reviewed_by UUID,
      ADD COLUMN IF NOT EXISTS accountant_reviewed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS accountant_review_notes TEXT,
      ADD COLUMN IF NOT EXISTS auditor_review_notes TEXT,
      ADD COLUMN IF NOT EXISTS locked_by UUID,
      ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS next_opening_posted_at TIMESTAMPTZ;

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
      CHECK (store_type IN (
        'foodstuffs',
        'bar_store',
        'store_items',
        'main_bar',
        'executive_bar',
        'kitchen_shift_a',
        'kitchen_shift_b',
        'housekeeping',
        'spa_sauna',
        'pos_outlet',
        'general'
      ));
  END IF;

  IF to_regclass('public.pos_shift_orders') IS NOT NULL THEN
    ALTER TABLE public.pos_shift_orders
      ADD COLUMN IF NOT EXISTS inventory_posted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS inventory_posted_by UUID,
      ADD COLUMN IF NOT EXISTS inventory_reversed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS inventory_reversed_by UUID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.department_inventory_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  department_code TEXT NOT NULL,
  department_name TEXT NOT NULL,
  department_type TEXT NOT NULL CHECK (department_type IN (
    'kitchen',
    'bar',
    'housekeeping',
    'spa',
    'maintenance',
    'back_office',
    'event',
    'pos'
  )),
  accounting_treatment TEXT NOT NULL DEFAULT 'expense' CHECK (accounting_treatment IN (
    'inventory',
    'expense'
  )),
  inventory_account_code TEXT DEFAULT '1370',
  expense_account_code TEXT DEFAULT '6100',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (branch_id, department_code)
);

ALTER TABLE public.department_inventory_accounts
  ADD COLUMN IF NOT EXISTS accounting_treatment TEXT NOT NULL DEFAULT 'expense',
  ADD COLUMN IF NOT EXISTS inventory_account_code TEXT DEFAULT '1370',
  ADD COLUMN IF NOT EXISTS expense_account_code TEXT DEFAULT '6100';

DO $$
BEGIN
  ALTER TABLE public.department_inventory_accounts
    DROP CONSTRAINT IF EXISTS department_inventory_accounts_accounting_treatment_check;
  ALTER TABLE public.department_inventory_accounts
    ADD CONSTRAINT department_inventory_accounts_accounting_treatment_check
    CHECK (accounting_treatment IN ('inventory', 'expense'));
END $$;

CREATE TABLE IF NOT EXISTS public.department_inventory_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.department_inventory_accounts(id) ON DELETE RESTRICT,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  item_sku TEXT NOT NULL REFERENCES public.simple_items(sku) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'issue',
    'return',
    'consume',
    'waste',
    'spoilage',
    'sale',
    'production_input',
    'production_output',
    'adjustment'
  )),
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity >= 0),
  unit_cost NUMERIC(14,2) DEFAULT 0,
  total_cost NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  shift_code TEXT,
  destination_type TEXT,
  event_name TEXT,
  event_date DATE,
  location TEXT,
  pax_count INTEGER,
  source_type TEXT,
  source_id UUID,
  source_number TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  performed_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_department_inventory_accounts_branch
  ON public.department_inventory_accounts(branch_id, department_type, is_active);
CREATE INDEX IF NOT EXISTS idx_department_inventory_ledger_branch_date
  ON public.department_inventory_ledger(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_department_inventory_ledger_account
  ON public.department_inventory_ledger(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_department_inventory_ledger_sku
  ON public.department_inventory_ledger(item_sku, created_at DESC);

CREATE TABLE IF NOT EXISTS public.pos_inventory_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES public.pos_outlets(id) ON DELETE CASCADE,
  outlet_item_id UUID NOT NULL REFERENCES public.pos_outlet_items(id) ON DELETE CASCADE,
  item_sku TEXT NOT NULL REFERENCES public.simple_items(sku) ON DELETE RESTRICT,
  quantity_per_sale NUMERIC(14,3) NOT NULL DEFAULT 1 CHECK (quantity_per_sale > 0),
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (outlet_item_id, item_sku)
);

CREATE INDEX IF NOT EXISTS idx_pos_inventory_mappings_outlet
  ON public.pos_inventory_mappings(outlet_id, is_active);
CREATE INDEX IF NOT EXISTS idx_pos_inventory_mappings_branch_sku
  ON public.pos_inventory_mappings(branch_id, item_sku, is_active);

CREATE TABLE IF NOT EXISTS public.inventory_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id INTEGER REFERENCES public.branches(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  reference_type TEXT,
  reference_id TEXT,
  before_value JSONB,
  after_value JSONB,
  device_info JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_audit_log_branch_date
  ON public.inventory_audit_log(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_audit_log_entity
  ON public.inventory_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_inventory_audit_log_action
  ON public.inventory_audit_log(action, created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_inventory_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'inventory_audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_inventory_audit_log_update ON public.inventory_audit_log;
CREATE TRIGGER trg_prevent_inventory_audit_log_update
BEFORE UPDATE OR DELETE ON public.inventory_audit_log
FOR EACH ROW EXECUTE FUNCTION public.prevent_inventory_audit_log_mutation();

CREATE TABLE IF NOT EXISTS public.kitchen_production_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  production_date DATE NOT NULL DEFAULT CURRENT_DATE,
  production_area TEXT NOT NULL,
  shift_code TEXT CHECK (shift_code IS NULL OR shift_code IN ('A', 'B')),
  finished_item_name TEXT NOT NULL,
  finished_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  finished_unit TEXT DEFAULT 'portion',
  waste_quantity NUMERIC(14,3) DEFAULT 0,
  spoilage_quantity NUMERIC(14,3) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kitchen_production_inputs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.kitchen_production_batches(id) ON DELETE CASCADE,
  item_sku TEXT NOT NULL REFERENCES public.simple_items(sku) ON DELETE RESTRICT,
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity >= 0),
  unit_cost NUMERIC(14,2) DEFAULT 0,
  total_cost NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kitchen_production_batches_branch_date
  ON public.kitchen_production_batches(branch_id, production_date DESC, production_area);
CREATE INDEX IF NOT EXISTS idx_kitchen_production_inputs_batch
  ON public.kitchen_production_inputs(batch_id);

INSERT INTO public.department_inventory_accounts (branch_id, department_code, department_name, department_type)
SELECT b.id, seed.department_code, seed.department_name, seed.department_type
FROM public.branches b
CROSS JOIN (
  VALUES
    ('main_kitchen', 'Main Kitchen', 'kitchen'),
    ('choma_zone_kitchen', 'Choma Zone Kitchen', 'kitchen'),
    ('pastries_kitchen', 'Pastries Kitchen', 'kitchen'),
    ('buffet', 'Buffets', 'event'),
    ('outside_catering', 'Outside Catering', 'event'),
    ('accommodation_breakfast', 'Accommodation Breakfast', 'event'),
    ('main_bar', 'Main Bar', 'bar'),
    ('executive_bar', 'Executive Bar', 'bar'),
    ('housekeeping', 'Housekeeping & Maintenance', 'housekeeping'),
    ('spa_sauna', 'Spa & Sauna', 'spa'),
    ('back_office', 'Back Office', 'back_office')
) AS seed(department_code, department_name, department_type)
ON CONFLICT (branch_id, department_code) DO NOTHING;

UPDATE public.department_inventory_accounts
SET
  accounting_treatment = CASE
    WHEN department_type IN ('kitchen', 'bar', 'spa', 'event', 'pos') THEN 'inventory'
    ELSE 'expense'
  END,
  inventory_account_code = COALESCE(inventory_account_code, '1370'),
  expense_account_code = COALESCE(expense_account_code, '6100')
WHERE accounting_treatment IS NULL
   OR inventory_account_code IS NULL
   OR expense_account_code IS NULL;

DO $$
BEGIN
  IF to_regclass('public.accounting_chart_of_accounts') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'accounting_chart_of_accounts'
        AND column_name = 'account_type'
    ) THEN
      INSERT INTO public.accounting_chart_of_accounts (account_code, account_name, account_type)
      VALUES
        ('1360', 'Branch Store Inventory', 'asset'),
        ('1370', 'Department Inventory', 'asset'),
        ('6100', 'Department Consumption Expense', 'expense')
      ON CONFLICT (account_code) DO NOTHING;
    ELSE
      INSERT INTO public.accounting_chart_of_accounts (account_code, account_name)
      VALUES
        ('1360', 'Branch Store Inventory'),
        ('1370', 'Department Inventory'),
        ('6100', 'Department Consumption Expense')
      ON CONFLICT (account_code) DO NOTHING;
    END IF;
  END IF;
END $$;

ALTER TABLE public.department_inventory_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_inventory_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_inventory_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_production_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_production_inputs ENABLE ROW LEVEL SECURITY;
