-- ============================================================
-- 0018_storekeeping_dispatch_stock_tables.sql
-- Adds missing tables and columns for the storekeeping,
-- dispatch, department-inventory, and audit modules.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. branch_requisitions — add missing columns
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.branch_requisitions
  ADD COLUMN IF NOT EXISTS auditor_decision_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_to_central_store_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS barcode_value             TEXT,
  ADD COLUMN IF NOT EXISTS workflow_status           TEXT;

-- Drop the restrictive status CHECK so code can use its own
-- casing (DISPATCHED, IN_TRANSIT, etc.) without violating the constraint.
DO $$
DECLARE
  v_con TEXT;
BEGIN
  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'public.branch_requisitions'::regclass
    AND contype = 'c'
    AND conname LIKE '%status%'
  LIMIT 1;
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.branch_requisitions DROP CONSTRAINT %I', v_con);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. branch_requisition_lines — add missing columns
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.branch_requisition_lines
  ADD COLUMN IF NOT EXISTS unavailable_quantity NUMERIC(14,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejection_reason     TEXT;

-- ────────────────────────────────────────────────────────────
-- 3. branch_stock_movements — add missing columns
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.branch_stock_movements
  ADD COLUMN IF NOT EXISTS previous_stock   NUMERIC(14,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_stock        NUMERIC(14,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reference_type   TEXT,
  ADD COLUMN IF NOT EXISTS reference_id     UUID,
  ADD COLUMN IF NOT EXISTS reference_number TEXT,
  ADD COLUMN IF NOT EXISTS performed_by     UUID REFERENCES public.users(id);

-- ────────────────────────────────────────────────────────────
-- 4. branch_stock — replace VIEW with a real TABLE
--    The VIEW over inventory_balances is read-only; code
--    performs UPSERT with reorder_level / last_stock_out etc.
-- ────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.branch_stock CASCADE;

CREATE TABLE IF NOT EXISTS public.branch_stock (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  item_sku        TEXT    NOT NULL,
  quantity        NUMERIC(14,4) NOT NULL DEFAULT 0,
  reorder_level   NUMERIC(14,4) NOT NULL DEFAULT 10,
  max_stock_level NUMERIC(14,4) NOT NULL DEFAULT 100,
  last_stock_in   TIMESTAMPTZ,
  last_stock_out  TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_id, item_sku)
);

CREATE INDEX IF NOT EXISTS branch_stock_branch_idx ON public.branch_stock(branch_id);
CREATE INDEX IF NOT EXISTS branch_stock_sku_idx    ON public.branch_stock(item_sku);

-- Seed from inventory_balances where available (non-destructive)
INSERT INTO public.branch_stock (branch_id, item_sku, quantity, updated_at)
SELECT
  il.branch_id,
  ii.sku,
  COALESCE(ib.current_quantity, 0),
  COALESCE(ib.updated_at, NOW())
FROM public.inventory_balances ib
JOIN public.inventory_items     ii ON ii.id = ib.item_id
JOIN public.inventory_locations il ON il.id = ib.location_id
WHERE il.location_type = 'branch_store'
  AND il.branch_id IS NOT NULL
  AND ii.sku IS NOT NULL
ON CONFLICT (branch_id, item_sku) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 5. simple_items VIEW — add quantity at end (CREATE OR REPLACE
--    only allows appending columns, not inserting in the middle)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.simple_items AS
  SELECT
    id,
    sku,
    sku                      AS item_sku,
    item_name,
    description,
    category,
    unit                     AS unit_of_measure,
    unit,
    default_unit_cost        AS cost_price,
    default_selling_price    AS retail_price,
    reorder_level,
    is_active,
    store_type,
    metadata,
    created_at,
    updated_at,
    quantity
  FROM public.inventory_items;

-- ────────────────────────────────────────────────────────────
-- 6. dispatch_notes
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dispatch_notes (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_number          TEXT NOT NULL UNIQUE,
  dispatch_document_number TEXT,
  barcode_value            TEXT,
  stock_request_id         UUID,        -- soft ref to branch_requisitions
  from_branch_id           INTEGER REFERENCES public.branches(id),
  to_branch_id             INTEGER REFERENCES public.branches(id),
  created_by               UUID REFERENCES public.users(id),
  vehicle_number           TEXT,
  vehicle_id               UUID,
  driver_name              TEXT,
  driver_phone             TEXT,
  driver_id                UUID,
  estimated_delivery       TIMESTAMPTZ,
  dispatch_notes           TEXT,
  delivery_notes           TEXT,
  discrepancy_notes        TEXT,
  notes                    TEXT,
  status                   TEXT NOT NULL DEFAULT 'DRAFT',
  workflow_status          TEXT,
  picker_id                UUID REFERENCES public.users(id),
  packer_id                UUID REFERENCES public.users(id),
  dispatcher_id            UUID REFERENCES public.users(id),
  receiver_id              UUID REFERENCES public.users(id),
  picked_at                TIMESTAMPTZ,
  packed_at                TIMESTAMPTZ,
  packing_started_at       TIMESTAMPTZ,
  dispatched_at            TIMESTAMPTZ,
  delivered_at             TIMESTAMPTZ,
  confirmed_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dispatch_notes_from_idx   ON public.dispatch_notes(from_branch_id);
CREATE INDEX IF NOT EXISTS dispatch_notes_to_idx     ON public.dispatch_notes(to_branch_id);
CREATE INDEX IF NOT EXISTS dispatch_notes_status_idx ON public.dispatch_notes(status);
CREATE INDEX IF NOT EXISTS dispatch_notes_req_idx    ON public.dispatch_notes(stock_request_id);

-- ────────────────────────────────────────────────────────────
-- 7. dispatch_items
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dispatch_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id          UUID NOT NULL REFERENCES public.dispatch_notes(id) ON DELETE CASCADE,
  item_sku             TEXT NOT NULL,
  dispatched_quantity  NUMERIC(14,4) NOT NULL DEFAULT 0,
  approved_quantity    NUMERIC(14,4),
  picked_quantity      NUMERIC(14,4),
  packed_quantity      NUMERIC(14,4),
  received_quantity    NUMERIC(14,4),
  damaged_quantity     NUMERIC(14,4) NOT NULL DEFAULT 0,
  missing_quantity     NUMERIC(14,4) NOT NULL DEFAULT 0,
  unavailable_quantity NUMERIC(14,4) NOT NULL DEFAULT 0,
  batch_number         TEXT,
  expiry_date          DATE,
  bin_location         TEXT,
  discrepancy_reason   TEXT,
  status               TEXT NOT NULL DEFAULT 'PENDING',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dispatch_items_dispatch_idx ON public.dispatch_items(dispatch_id);
CREATE INDEX IF NOT EXISTS dispatch_items_sku_idx      ON public.dispatch_items(item_sku);

-- ────────────────────────────────────────────────────────────
-- 8. in_transit_stock
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.in_transit_stock (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID REFERENCES public.dispatch_notes(id) ON DELETE CASCADE,
  item_sku    TEXT NOT NULL,
  quantity    NUMERIC(14,4) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(dispatch_id, item_sku)
);

-- ────────────────────────────────────────────────────────────
-- 9. stock_counts  (bar stock audits + enterprise stock takes)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_counts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id                   INTEGER REFERENCES public.branches(id),
  count_date                  DATE,
  count_type                  TEXT DEFAULT 'daily',
  store_type                  TEXT,
  status                      TEXT NOT NULL DEFAULT 'draft',
  counted_by                  UUID REFERENCES public.users(id),
  submitted_to_accountant_by  UUID REFERENCES public.users(id),
  submitted_to_accountant_at  TIMESTAMPTZ,
  accountant_reviewed_by      UUID REFERENCES public.users(id),
  accountant_reviewed_at      TIMESTAMPTZ,
  accountant_review_notes     TEXT,
  accountant_submitted_by     UUID REFERENCES public.users(id),
  accountant_submitted_at     TIMESTAMPTZ,
  auditor_reviewed_by         UUID REFERENCES public.users(id),
  auditor_reviewed_at         TIMESTAMPTZ,
  auditor_review_notes        TEXT,
  total_variance_value        NUMERIC(14,2) DEFAULT 0,
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stock_counts_branch_idx ON public.stock_counts(branch_id);
CREATE INDEX IF NOT EXISTS stock_counts_status_idx ON public.stock_counts(status);
CREATE INDEX IF NOT EXISTS stock_counts_date_idx   ON public.stock_counts(count_date);

-- ────────────────────────────────────────────────────────────
-- 10. stock_count_items
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_count_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_count_id    UUID REFERENCES public.stock_counts(id) ON DELETE CASCADE,
  item_id           UUID,
  item_sku          TEXT,
  system_quantity   NUMERIC(14,4) DEFAULT 0,
  physical_quantity NUMERIC(14,4),
  counted_quantity  NUMERIC(14,4),
  variance          NUMERIC(14,4),
  unit_cost         NUMERIC(14,2) DEFAULT 0,
  variance_value    NUMERIC(14,2),
  reason            TEXT,
  status            TEXT DEFAULT 'draft',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stock_count_items_count_idx ON public.stock_count_items(stock_count_id);

-- ────────────────────────────────────────────────────────────
-- 11. Update _sync_stl_cols trigger
--     COALESCE so an explicit stock_count_id is preserved
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._sync_stl_cols()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_sku TEXT;
BEGIN
  NEW.stock_count_id    := COALESCE(NEW.stock_count_id, NEW.stock_take_id);
  NEW.opening_stock     := COALESCE(NEW.opening_stock, NEW.opening_quantity);
  NEW.additions         := COALESCE(NEW.additions, NEW.added_quantity);
  NEW.system_quantity   := COALESCE(NEW.system_quantity, 0);
  NEW.physical_quantity := COALESCE(NEW.physical_quantity, NEW.counted_quantity);
  NEW.unit_cost         := COALESCE(NEW.unit_cost, NEW.cost_price);
  IF NEW.item_sku IS NULL AND NEW.item_id IS NOT NULL THEN
    SELECT sku INTO v_sku FROM public.inventory_items WHERE id = NEW.item_id;
    NEW.item_sku := v_sku;
  END IF;
  RETURN NEW;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 12. department_inventory_accounts
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.department_inventory_accounts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id              INTEGER REFERENCES public.branches(id),
  department_code        TEXT NOT NULL,
  department_name        TEXT NOT NULL,
  department_type        TEXT NOT NULL DEFAULT 'other',
  inventory_account_code TEXT,
  expense_account_code   TEXT,
  accounting_treatment   TEXT NOT NULL DEFAULT 'expense',
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_id, department_code)
);

CREATE INDEX IF NOT EXISTS dept_accounts_branch_idx ON public.department_inventory_accounts(branch_id);

-- ────────────────────────────────────────────────────────────
-- 13. department_inventory_ledger
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.department_inventory_ledger (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID REFERENCES public.department_inventory_accounts(id),
  branch_id             INTEGER REFERENCES public.branches(id),
  item_sku              TEXT,
  movement_type         TEXT NOT NULL DEFAULT 'issue',
  quantity              NUMERIC(14,4) NOT NULL DEFAULT 0,
  unit_cost             NUMERIC(14,4) DEFAULT 0,
  total_cost            NUMERIC(14,4),
  shift_code            TEXT,
  destination_type      TEXT,
  event_name            TEXT,
  event_date            DATE,
  location              TEXT,
  pax_count             INTEGER,
  source_type           TEXT,
  source_id             UUID,
  source_number         TEXT,
  department_request_id UUID,
  document_number       TEXT,
  inventory_movement_id TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes                 TEXT,
  performed_by          UUID REFERENCES public.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dept_ledger_branch_idx  ON public.department_inventory_ledger(branch_id);
CREATE INDEX IF NOT EXISTS dept_ledger_account_idx ON public.department_inventory_ledger(account_id);
CREATE INDEX IF NOT EXISTS dept_ledger_source_idx  ON public.department_inventory_ledger(source_type, source_number);
CREATE INDEX IF NOT EXISTS dept_ledger_item_idx    ON public.department_inventory_ledger(item_sku);

-- ────────────────────────────────────────────────────────────
-- 14. department_request_logs
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.department_request_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number        TEXT NOT NULL UNIQUE,
  branch_id             INTEGER REFERENCES public.branches(id),
  department_account_id UUID REFERENCES public.department_inventory_accounts(id),
  department_code       TEXT,
  department_name       TEXT,
  requestor_name        TEXT NOT NULL,
  requestor_contact     TEXT,
  shift_code            TEXT,
  event_name            TEXT,
  event_date            DATE,
  pax_count             INTEGER,
  purpose               TEXT,
  remarks               TEXT,
  attachments           JSONB NOT NULL DEFAULT '[]'::jsonb,
  status                TEXT NOT NULL DEFAULT 'pending_audit',
  audit_status          TEXT NOT NULL DEFAULT 'pending_audit',
  logged_by             UUID REFERENCES public.users(id),
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dept_req_logs_branch_idx  ON public.department_request_logs(branch_id);
CREATE INDEX IF NOT EXISTS dept_req_logs_status_idx  ON public.department_request_logs(status);
CREATE INDEX IF NOT EXISTS dept_req_logs_number_idx  ON public.department_request_logs(request_number);

-- ────────────────────────────────────────────────────────────
-- 15. department_request_items
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.department_request_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       UUID NOT NULL REFERENCES public.department_request_logs(id) ON DELETE CASCADE,
  item_sku         TEXT NOT NULL,
  item_name        TEXT,
  quantity         NUMERIC(14,4) NOT NULL DEFAULT 0,
  unit             TEXT NOT NULL DEFAULT 'units',
  purpose          TEXT,
  pending_quantity NUMERIC(14,4) NOT NULL DEFAULT 0,
  issued_quantity  NUMERIC(14,4) NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'logged',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dept_req_items_req_idx ON public.department_request_items(request_id);

-- ────────────────────────────────────────────────────────────
-- 16. inventory_audit_logs
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_audit_logs (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id                 INTEGER,
  actor_id                  UUID REFERENCES public.users(id),
  action_type               TEXT NOT NULL,
  entity_type               TEXT,
  entity_id                 UUID,
  source_document_type      TEXT,
  source_document_reference TEXT,
  before_value              JSONB,
  after_value               JSONB,
  reason                    TEXT,
  device_info               JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata                  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inv_audit_branch_idx  ON public.inventory_audit_logs(branch_id);
CREATE INDEX IF NOT EXISTS inv_audit_action_idx  ON public.inventory_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS inv_audit_entity_idx  ON public.inventory_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS inv_audit_created_idx ON public.inventory_audit_logs(created_at DESC);

-- ────────────────────────────────────────────────────────────
-- 17. pos_inventory_mappings
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pos_inventory_mappings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id         INTEGER REFERENCES public.branches(id),
  outlet_id         UUID REFERENCES public.pos_outlets(id),
  outlet_item_id    UUID REFERENCES public.pos_outlet_items(id),
  item_sku          TEXT NOT NULL,
  quantity_per_sale NUMERIC(14,4) NOT NULL DEFAULT 1,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_by        UUID REFERENCES public.users(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(outlet_item_id, item_sku)
);

CREATE INDEX IF NOT EXISTS pos_inv_map_branch_idx ON public.pos_inventory_mappings(branch_id);
CREATE INDEX IF NOT EXISTS pos_inv_map_outlet_idx ON public.pos_inventory_mappings(outlet_id);

-- ────────────────────────────────────────────────────────────
-- 18. Refresh stock_requests + stock_request_items VIEWs
--     branch_requisitions gained new columns above; recreate
--     the VIEWs so SELECT * picks them up.
--     Also remove the duplicate requesting_branch_id alias
--     that conflicts now that the real column exists.
-- ────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.stock_requests CASCADE;
CREATE VIEW public.stock_requests AS
  SELECT * FROM public.branch_requisitions;

CREATE OR REPLACE VIEW public.stock_request_items AS
  SELECT * FROM public.branch_requisition_lines;
