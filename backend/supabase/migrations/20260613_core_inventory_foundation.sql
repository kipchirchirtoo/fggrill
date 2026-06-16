-- Core inventory foundation.
-- Creates a shared inventory truth layer without removing existing storekeeping tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER REFERENCES public.branches(id) ON DELETE CASCADE,
  location_code TEXT NOT NULL UNIQUE,
  location_name TEXT NOT NULL,
  location_type TEXT NOT NULL CHECK (location_type IN (
    'central_store',
    'branch_store',
    'department',
    'pos_outlet',
    'supplier',
    'customer',
    'transit',
    'production',
    'waste',
    'adjustment',
    'reservation',
    'external'
  )),
  department_code TEXT,
  outlet_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_inventory_locations_updated_at ON public.inventory_locations;
CREATE TRIGGER trg_inventory_locations_updated_at
BEFORE UPDATE ON public.inventory_locations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.inventory_item_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table TEXT NOT NULL DEFAULT 'simple_items',
  source_item_key TEXT NOT NULL,
  sku TEXT NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'units',
  is_perishable BOOLEAN NOT NULL DEFAULT FALSE,
  tracking_mode TEXT NOT NULL DEFAULT 'none' CHECK (tracking_mode IN ('none', 'batch', 'lot', 'serial', 'expiry')),
  supplier_reference TEXT,
  default_unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (default_unit_cost >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_table, source_item_key)
);

CREATE INDEX IF NOT EXISTS idx_inventory_item_catalog_sku ON public.inventory_item_catalog(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_item_catalog_search
  ON public.inventory_item_catalog USING gin (to_tsvector('simple', sku || ' ' || item_name || ' ' || COALESCE(description, '')));

DROP TRIGGER IF EXISTS trg_inventory_item_catalog_updated_at ON public.inventory_item_catalog;
CREATE TRIGGER trg_inventory_item_catalog_updated_at
BEFORE UPDATE ON public.inventory_item_catalog
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.inventory_core_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.inventory_item_catalog(id) ON DELETE CASCADE,
  batch_number TEXT,
  lot_number TEXT,
  expiry_date DATE,
  supplier_reference TEXT,
  supplier_id UUID,
  received_document_type TEXT,
  received_document_reference TEXT,
  unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_core_batches_identity CHECK (
    batch_number IS NOT NULL OR lot_number IS NOT NULL OR expiry_date IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_inventory_core_batches_item ON public.inventory_core_batches(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_core_batches_expiry ON public.inventory_core_batches(expiry_date) WHERE expiry_date IS NOT NULL;

DROP TRIGGER IF EXISTS trg_inventory_core_batches_updated_at ON public.inventory_core_batches;
CREATE TRIGGER trg_inventory_core_batches_updated_at
BEFORE UPDATE ON public.inventory_core_batches
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Some deployments already have a legacy inventory_batches table with an incompatible shape.
-- Use inventory_core_batches and retarget foundation FKs safely.
DO $$
BEGIN
  IF to_regclass('public.inventory_movements') IS NOT NULL THEN
    ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_batch_id_fkey;
  END IF;
  IF to_regclass('public.inventory_reservations') IS NOT NULL THEN
    ALTER TABLE public.inventory_reservations DROP CONSTRAINT IF EXISTS inventory_reservations_batch_id_fkey;
  END IF;
  IF to_regclass('public.inventory_balances') IS NOT NULL THEN
    ALTER TABLE public.inventory_balances DROP CONSTRAINT IF EXISTS inventory_balances_batch_id_fkey;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_number TEXT NOT NULL UNIQUE,
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'purchase_receipt',
    'grn_posting',
    'branch_requisition_dispatch',
    'central_store_packing',
    'department_issue',
    'pos_issue',
    'production_consumption',
    'production_output',
    'stock_take_adjustment',
    'return',
    'write_off',
    'transfer',
    'reservation',
    'reservation_release'
  )),
  item_id UUID NOT NULL REFERENCES public.inventory_item_catalog(id) ON DELETE RESTRICT,
  batch_id UUID REFERENCES public.inventory_core_batches(id) ON DELETE SET NULL,
  source_location_id UUID NOT NULL REFERENCES public.inventory_locations(id) ON DELETE RESTRICT,
  destination_location_id UUID NOT NULL REFERENCES public.inventory_locations(id) ON DELETE RESTRICT,
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  total_cost NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  reason TEXT NOT NULL,
  document_type TEXT NOT NULL,
  document_reference TEXT NOT NULL,
  document_number TEXT,
  actor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  reversible BOOLEAN NOT NULL DEFAULT TRUE,
  reverses_movement_id UUID REFERENCES public.inventory_movements(id) ON DELETE RESTRICT,
  source_balance_before NUMERIC(14,3),
  source_balance_after NUMERIC(14,3),
  destination_balance_before NUMERIC(14,3),
  destination_balance_after NUMERIC(14,3),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_date ON public.inventory_movements(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_source ON public.inventory_movements(source_location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_destination ON public.inventory_movements(destination_location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_document ON public.inventory_movements(document_type, document_reference);

CREATE TABLE IF NOT EXISTS public.inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_number TEXT NOT NULL UNIQUE,
  item_id UUID NOT NULL REFERENCES public.inventory_item_catalog(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES public.inventory_locations(id) ON DELETE RESTRICT,
  batch_id UUID REFERENCES public.inventory_core_batches(id) ON DELETE SET NULL,
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  fulfilled_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (fulfilled_quantity >= 0),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'released', 'fulfilled', 'expired', 'cancelled')),
  source_document_type TEXT NOT NULL,
  source_document_reference TEXT NOT NULL,
  source_document_number TEXT,
  reason TEXT NOT NULL,
  reserved_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  released_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_reservations_fulfilled_limit CHECK (fulfilled_quantity <= quantity)
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_item_location
  ON public.inventory_reservations(item_id, location_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_document
  ON public.inventory_reservations(source_document_type, source_document_reference);

DROP TRIGGER IF EXISTS trg_inventory_reservations_updated_at ON public.inventory_reservations;
CREATE TRIGGER trg_inventory_reservations_updated_at
BEFORE UPDATE ON public.inventory_reservations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.inventory_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.inventory_item_catalog(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.inventory_locations(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.inventory_core_batches(id) ON DELETE SET NULL,
  current_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (current_quantity >= 0),
  reserved_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  damaged_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (damaged_quantity >= 0),
  expired_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (expired_quantity >= 0),
  available_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  last_movement_id UUID REFERENCES public.inventory_movements(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_balances_reserved_limit CHECK (reserved_quantity <= current_quantity),
  CONSTRAINT inventory_balances_available_nonnegative CHECK (available_quantity >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_balances_unique
  ON public.inventory_balances(item_id, location_id, COALESCE(batch_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_inventory_balances_location ON public.inventory_balances(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_balances_low ON public.inventory_balances(location_id, available_quantity);

CREATE OR REPLACE FUNCTION public.inventory_balance_compute_available()
RETURNS TRIGGER AS $$
BEGIN
  NEW.available_quantity :=
    COALESCE(NEW.current_quantity, 0)
    - COALESCE(NEW.reserved_quantity, 0)
    - COALESCE(NEW.damaged_quantity, 0)
    - COALESCE(NEW.expired_quantity, 0);

  IF NEW.available_quantity < 0 THEN
    RAISE EXCEPTION 'Inventory balance cannot have negative availability';
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_balances_compute_available ON public.inventory_balances;
CREATE TRIGGER trg_inventory_balances_compute_available
BEFORE INSERT OR UPDATE ON public.inventory_balances
FOR EACH ROW EXECUTE FUNCTION public.inventory_balance_compute_available();

CREATE TABLE IF NOT EXISTS public.inventory_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER REFERENCES public.branches(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  item_id UUID REFERENCES public.inventory_item_catalog(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
  before_value JSONB,
  after_value JSONB,
  reason TEXT NOT NULL,
  source_document_type TEXT,
  source_document_reference TEXT,
  device_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_audit_logs_branch_date
  ON public.inventory_audit_logs(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_audit_logs_entity
  ON public.inventory_audit_logs(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS public.inventory_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER REFERENCES public.branches(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.inventory_item_catalog(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'low_stock',
    'out_of_stock',
    'expired_stock',
    'damaged_stock',
    'suspicious_movement',
    'negative_balance_attempt',
    'over_reservation_attempt'
  )),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
  message TEXT NOT NULL,
  source_document_type TEXT,
  source_document_reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inventory_alerts_open
  ON public.inventory_alerts(branch_id, status, severity, created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_inventory_foundation_append_only_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_movements_append_only ON public.inventory_movements;
CREATE TRIGGER trg_inventory_movements_append_only
BEFORE UPDATE OR DELETE ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.prevent_inventory_foundation_append_only_mutation();

DROP TRIGGER IF EXISTS trg_inventory_audit_logs_append_only ON public.inventory_audit_logs;
CREATE TRIGGER trg_inventory_audit_logs_append_only
BEFORE UPDATE OR DELETE ON public.inventory_audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_inventory_foundation_append_only_mutation();

ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_item_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_core_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_alerts ENABLE ROW LEVEL SECURITY;

UPDATE public.inventory_movements m
SET batch_id = NULL
WHERE batch_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.inventory_core_batches b WHERE b.id = m.batch_id);

UPDATE public.inventory_reservations r
SET batch_id = NULL
WHERE batch_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.inventory_core_batches b WHERE b.id = r.batch_id);

UPDATE public.inventory_balances ib
SET batch_id = NULL
WHERE batch_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.inventory_core_batches b WHERE b.id = ib.batch_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_movements_batch_id_fkey'
      AND conrelid = 'public.inventory_movements'::regclass
  ) THEN
    ALTER TABLE public.inventory_movements
      ADD CONSTRAINT inventory_movements_batch_id_fkey
      FOREIGN KEY (batch_id) REFERENCES public.inventory_core_batches(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_reservations_batch_id_fkey'
      AND conrelid = 'public.inventory_reservations'::regclass
  ) THEN
    ALTER TABLE public.inventory_reservations
      ADD CONSTRAINT inventory_reservations_batch_id_fkey
      FOREIGN KEY (batch_id) REFERENCES public.inventory_core_batches(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_balances_batch_id_fkey'
      AND conrelid = 'public.inventory_balances'::regclass
  ) THEN
    ALTER TABLE public.inventory_balances
      ADD CONSTRAINT inventory_balances_batch_id_fkey
      FOREIGN KEY (batch_id) REFERENCES public.inventory_core_batches(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'inventory_locations',
    'inventory_item_catalog',
    'inventory_core_batches',
    'inventory_movements',
    'inventory_reservations',
    'inventory_balances',
    'inventory_audit_logs',
    'inventory_alerts'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS service_role_all ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY service_role_all ON public.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
      table_name
    );
  END LOOP;
END $$;
