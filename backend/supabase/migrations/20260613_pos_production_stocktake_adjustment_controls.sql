-- POS outlet stock, production/assembly, enterprise stock take, and controlled adjustments.
-- Additive only: extends the active POS/stock-count/inventory-foundation surfaces without dropping legacy data.

CREATE TABLE IF NOT EXISTS public.stock_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  count_number TEXT UNIQUE,
  store_type TEXT NOT NULL DEFAULT 'foodstuffs',
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  take_type TEXT NOT NULL DEFAULT 'full_count',
  workflow_status TEXT NOT NULL DEFAULT 'draft',
  status TEXT NOT NULL DEFAULT 'draft',
  is_blind_count BOOLEAN NOT NULL DEFAULT FALSE,
  target_skus TEXT[] DEFAULT '{}',
  outlet_id UUID REFERENCES public.pos_outlets(id) ON DELETE SET NULL,
  outlet_code TEXT,
  shift_id UUID REFERENCES public.pos_outlet_shifts(id) ON DELETE SET NULL,
  notes TEXT,
  total_system_value NUMERIC(14,2) DEFAULT 0,
  total_physical_value NUMERIC(14,2) DEFAULT 0,
  total_variance_value NUMERIC(14,2) DEFAULT 0,
  total_variance_quantity NUMERIC(14,3) DEFAULT 0,
  variance_classification TEXT DEFAULT 'small',
  accountant_reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  accountant_reviewed_at TIMESTAMPTZ,
  accountant_review_notes TEXT,
  auditor_reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  auditor_reviewed_at TIMESTAMPTZ,
  auditor_review_notes TEXT,
  locked_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  locked_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reopened_at TIMESTAMPTZ,
  reopened_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_count_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_count_id UUID NOT NULL REFERENCES public.stock_counts(id) ON DELETE CASCADE,
  item_id UUID,
  item_sku TEXT NOT NULL,
  item_name TEXT,
  category TEXT,
  unit_of_measure TEXT DEFAULT 'units',
  store_type TEXT,
  opening_stock NUMERIC(14,3) DEFAULT 0,
  additions NUMERIC(14,3) DEFAULT 0,
  transfers_in NUMERIC(14,3) DEFAULT 0,
  transfers_out NUMERIC(14,3) DEFAULT 0,
  production_quantity NUMERIC(14,3) DEFAULT 0,
  sales_quantity NUMERIC(14,3) DEFAULT 0,
  issued_quantity NUMERIC(14,3) DEFAULT 0,
  wastage_quantity NUMERIC(14,3) DEFAULT 0,
  returns_quantity NUMERIC(14,3) DEFAULT 0,
  system_quantity NUMERIC(14,3) DEFAULT 0,
  system_closing_stock NUMERIC(14,3) DEFAULT 0,
  physical_quantity NUMERIC(14,3),
  variance_quantity NUMERIC(14,3) GENERATED ALWAYS AS (COALESCE(physical_quantity, 0) - COALESCE(system_closing_stock, system_quantity, 0)) STORED,
  unit_cost NUMERIC(14,2) DEFAULT 0,
  cost_price NUMERIC(14,2) DEFAULT 0,
  selling_price NUMERIC(14,2) DEFAULT 0,
  variance_value NUMERIC(14,2) GENERATED ALWAYS AS ((COALESCE(physical_quantity, 0) - COALESCE(system_closing_stock, system_quantity, 0)) * COALESCE(unit_cost, cost_price, 0)) STORED,
  variance_percentage NUMERIC(10,2) DEFAULT 0,
  variance_severity TEXT DEFAULT 'small',
  variance_reason TEXT,
  reason TEXT,
  notes TEXT,
  counted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  counted_at TIMESTAMPTZ,
  posted_movement_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (stock_count_id, item_sku)
);

ALTER TABLE IF EXISTS public.stock_counts
  ADD COLUMN IF NOT EXISTS take_type TEXT NOT NULL DEFAULT 'full_count',
  ADD COLUMN IF NOT EXISTS workflow_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS is_blind_count BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS target_skus TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES public.pos_outlets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS outlet_code TEXT,
  ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES public.pos_outlet_shifts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS total_system_value NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_physical_value NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_variance_value NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_variance_quantity NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variance_classification TEXT DEFAULT 'small',
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS posted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reopened_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.stock_counts
  DROP CONSTRAINT IF EXISTS stock_counts_status_check;
ALTER TABLE IF EXISTS public.stock_counts
  ADD CONSTRAINT stock_counts_status_check
  CHECK (status IN (
    'draft',
    'started',
    'counting',
    'submitted',
    'submitted_to_accountant',
    'under_review',
    'accountant_review',
    'accountant_approved',
    'accountant_rejected',
    'auditor_review',
    'auditor_approved',
    'auditor_flagged',
    'approved',
    'posted',
    'closed',
    'rejected',
    'cancelled'
  ));

ALTER TABLE IF EXISTS public.stock_counts
  DROP CONSTRAINT IF EXISTS stock_counts_workflow_status_check;
ALTER TABLE IF EXISTS public.stock_counts
  ADD CONSTRAINT stock_counts_workflow_status_check
  CHECK (workflow_status IN (
    'draft',
    'started',
    'counting',
    'submitted',
    'accountant_review',
    'auditor_review',
    'approved',
    'posted',
    'closed',
    'rejected',
    'cancelled'
  ));

ALTER TABLE IF EXISTS public.stock_counts
  DROP CONSTRAINT IF EXISTS stock_counts_take_type_check;
ALTER TABLE IF EXISTS public.stock_counts
  ADD CONSTRAINT stock_counts_take_type_check
  CHECK (take_type IN (
    'full_count',
    'cycle_count',
    'spot_count',
    'blind_count',
    'investigation_count',
    'outlet_count'
  ));

ALTER TABLE IF EXISTS public.stock_count_items
  ADD COLUMN IF NOT EXISTS item_name TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS unit_of_measure TEXT DEFAULT 'units',
  ADD COLUMN IF NOT EXISTS store_type TEXT,
  ADD COLUMN IF NOT EXISTS transfers_in NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transfers_out NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS production_quantity NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_quantity NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wastage_quantity NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS returns_quantity NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variance_percentage NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variance_severity TEXT DEFAULT 'small',
  ADD COLUMN IF NOT EXISTS variance_reason TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS counted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS counted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS posted_movement_id UUID;

ALTER TABLE IF EXISTS public.pos_shift_stock_counts
  ADD COLUMN IF NOT EXISTS received_stock NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS produced_stock NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transferred_in NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS issued_out_quantity NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wastage_quantity NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expected_closing_stock NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_closing_stock NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS variance_value NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variance_status TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS variance_classification TEXT DEFAULT 'small',
  ADD COLUMN IF NOT EXISTS explanation TEXT,
  ADD COLUMN IF NOT EXISTS posted_movement_id UUID,
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.pos_shift_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.pos_shift_orders(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES public.pos_outlet_shifts(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES public.pos_outlets(id) ON DELETE CASCADE,
  outlet_item_id UUID REFERENCES public.pos_outlet_items(id) ON DELETE SET NULL,
  item_sku TEXT,
  item_name TEXT NOT NULL,
  category TEXT,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  unit_price NUMERIC(14,2) DEFAULT 0,
  line_total NUMERIC(14,2) DEFAULT 0,
  inventory_posted_at TIMESTAMPTZ,
  inventory_movement_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_shift_order_items_order
  ON public.pos_shift_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_pos_shift_order_items_shift
  ON public.pos_shift_order_items(shift_id);
CREATE INDEX IF NOT EXISTS idx_pos_shift_order_items_outlet_item
  ON public.pos_shift_order_items(outlet_id, outlet_item_id);

INSERT INTO public.pos_shift_order_items (
  order_id, shift_id, outlet_id, outlet_item_id, item_sku, item_name, category, quantity, unit_price, line_total, metadata
)
SELECT
  o.id,
  o.shift_id,
  o.outlet_id,
  CASE WHEN item.value->>'outlet_item_id' ~* '^[0-9a-f-]{36}$' THEN (item.value->>'outlet_item_id')::uuid ELSE NULL END,
  COALESCE(item.value->>'item_sku', item.value->>'sku'),
  COALESCE(NULLIF(item.value->>'name', ''), NULLIF(item.value->>'item_name', ''), 'POS Item'),
  item.value->>'category',
  CASE WHEN COALESCE(item.value->>'quantity', item.value->>'qty', '0') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN COALESCE(item.value->>'quantity', item.value->>'qty')::numeric ELSE 0 END,
  CASE WHEN COALESCE(item.value->>'unit_price', item.value->>'price', '0') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN COALESCE(item.value->>'unit_price', item.value->>'price')::numeric ELSE 0 END,
  CASE WHEN COALESCE(item.value->>'line_total', item.value->>'total', '0') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN COALESCE(item.value->>'line_total', item.value->>'total')::numeric ELSE 0 END,
  item.value
FROM public.pos_shift_orders o
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) item(value)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.pos_shift_order_items existing
  WHERE existing.order_id = o.id
);

CREATE TABLE IF NOT EXISTS public.inventory_production_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_number TEXT NOT NULL UNIQUE,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  production_date DATE NOT NULL DEFAULT CURRENT_DATE,
  production_area TEXT NOT NULL DEFAULT 'branch_store',
  destination_outlet_id UUID REFERENCES public.pos_outlets(id) ON DELETE SET NULL,
  destination_location_id UUID,
  shift_id UUID REFERENCES public.pos_outlet_shifts(id) ON DELETE SET NULL,
  batch_reference TEXT,
  operator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'posted',
  total_input_cost NUMERIC(14,2) DEFAULT 0,
  total_output_value NUMERIC(14,2) DEFAULT 0,
  yield_percentage NUMERIC(10,2) DEFAULT 0,
  variance_classification TEXT DEFAULT 'small',
  remarks TEXT,
  posted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (status IN ('draft', 'submitted', 'posted', 'cancelled', 'reversed'))
);

CREATE TABLE IF NOT EXISTS public.inventory_production_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_run_id UUID NOT NULL REFERENCES public.inventory_production_runs(id) ON DELETE CASCADE,
  item_sku TEXT NOT NULL,
  item_name TEXT,
  quantity_consumed NUMERIC(14,3) NOT NULL CHECK (quantity_consumed > 0),
  unit TEXT DEFAULT 'units',
  unit_cost NUMERIC(14,2) DEFAULT 0,
  movement_id UUID,
  batch_number TEXT,
  expiry_date DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_production_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_run_id UUID NOT NULL REFERENCES public.inventory_production_runs(id) ON DELETE CASCADE,
  outlet_item_id UUID REFERENCES public.pos_outlet_items(id) ON DELETE SET NULL,
  item_sku TEXT NOT NULL,
  item_name TEXT,
  quantity_produced NUMERIC(14,3) NOT NULL CHECK (quantity_produced > 0),
  unit TEXT DEFAULT 'units',
  unit_cost NUMERIC(14,2) DEFAULT 0,
  movement_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_production_runs_branch_date
  ON public.inventory_production_runs(branch_id, production_date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_production_runs_outlet
  ON public.inventory_production_runs(destination_outlet_id, posted_at DESC);

CREATE TABLE IF NOT EXISTS public.inventory_adjustment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_number TEXT NOT NULL UNIQUE,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  location_id UUID,
  location_type TEXT NOT NULL DEFAULT 'branch_store',
  outlet_id UUID REFERENCES public.pos_outlets(id) ON DELETE SET NULL,
  adjustment_reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  reason TEXT NOT NULL,
  requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  posted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  posted_at TIMESTAMPTZ,
  audited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  audited_at TIMESTAMPTZ,
  rejection_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (adjustment_reason IN ('damage', 'expiry', 'loss', 'theft', 'breakage', 'correction', 'count_variance', 'spoilage', 'write_off')),
  CHECK (status IN ('requested', 'reviewed', 'approved', 'posted', 'audited', 'rejected', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS public.inventory_adjustment_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_request_id UUID NOT NULL REFERENCES public.inventory_adjustment_requests(id) ON DELETE CASCADE,
  item_sku TEXT NOT NULL,
  item_name TEXT,
  system_quantity NUMERIC(14,3) DEFAULT 0,
  adjustment_quantity NUMERIC(14,3) NOT NULL,
  final_quantity NUMERIC(14,3),
  unit TEXT DEFAULT 'units',
  unit_cost NUMERIC(14,2) DEFAULT 0,
  movement_id UUID,
  explanation TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_adjustment_requests_branch_status
  ON public.inventory_adjustment_requests(branch_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.stock_take_investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  stock_count_id UUID REFERENCES public.stock_counts(id) ON DELETE SET NULL,
  stock_count_item_id UUID REFERENCES public.stock_count_items(id) ON DELETE SET NULL,
  item_sku TEXT,
  severity TEXT NOT NULL DEFAULT 'critical',
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (severity IN ('small', 'medium', 'large', 'critical')),
  CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed'))
);

DO $$
BEGIN
  IF to_regclass('public.inventory_documents') IS NOT NULL THEN
    ALTER TABLE public.inventory_documents
      DROP CONSTRAINT IF EXISTS inventory_documents_document_type_check;
    ALTER TABLE public.inventory_documents
      ADD CONSTRAINT inventory_documents_document_type_check
      CHECK (document_type IN (
        'branch_request',
        'auditor_approval',
        'packing_list',
        'dispatch_document',
        'receipt_verification',
        'department_request_log',
        'material_issue_note',
        'supplier_payment_receipt',
        'production_run',
        'shift_closing',
        'stock_take',
        'stock_take_variance',
        'stock_adjustment'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stock_counts_branch_date
  ON public.stock_counts(branch_id, count_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_counts_workflow
  ON public.stock_counts(branch_id, workflow_status, status);
CREATE INDEX IF NOT EXISTS idx_stock_count_items_sku
  ON public.stock_count_items(item_sku);
CREATE INDEX IF NOT EXISTS idx_stock_take_investigations_branch
  ON public.stock_take_investigations(branch_id, status, created_at DESC);

ALTER TABLE IF EXISTS public.pos_shift_stock_counts
  DROP CONSTRAINT IF EXISTS pos_shift_stock_counts_variance_status_check;
ALTER TABLE IF EXISTS public.pos_shift_stock_counts
  ADD CONSTRAINT pos_shift_stock_counts_variance_status_check
  CHECK (variance_status IN ('normal', 'low_stock', 'out_of_stock', 'shortage', 'overage', 'critical_variance'));

ALTER TABLE IF EXISTS public.pos_shift_stock_counts
  DROP CONSTRAINT IF EXISTS pos_shift_stock_counts_variance_classification_check;
ALTER TABLE IF EXISTS public.pos_shift_stock_counts
  ADD CONSTRAINT pos_shift_stock_counts_variance_classification_check
  CHECK (variance_classification IN ('small', 'medium', 'large', 'critical'));
