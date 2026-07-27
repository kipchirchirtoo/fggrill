-- Separate Central Store from Kyogong branch runtime ownership.
-- Date: 2026-07-26
-- Notes:
--   * Preserves legacy branch history while introducing warehouse-native context.
--   * Keeps simple_items(branch_id IS NULL) as the shared central catalog.
--   * Moves live central warehouse resolution onto inventory_warehouses + warehouse contexts.

CREATE TABLE IF NOT EXISTS public.inventory_warehouses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  operating_branch_id INTEGER REFERENCES public.branches(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.warehouse_user_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.inventory_warehouses(id) ON DELETE CASCADE,
  warehouse_role TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_warehouse_user_assignment UNIQUE (user_id, warehouse_id, warehouse_role)
);

CREATE TABLE IF NOT EXISTS public.user_context_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  context_type TEXT NOT NULL CHECK (context_type IN ('branch', 'warehouse')),
  branch_id INTEGER REFERENCES public.branches(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES public.inventory_warehouses(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_user_context_target CHECK (
    (context_type = 'branch' AND branch_id IS NOT NULL AND warehouse_id IS NULL)
    OR
    (context_type = 'warehouse' AND warehouse_id IS NOT NULL)
  ),
  CONSTRAINT uq_user_context_assignment UNIQUE NULLS NOT DISTINCT (user_id, context_type, branch_id, warehouse_id, role)
);

CREATE INDEX IF NOT EXISTS idx_inventory_warehouses_operating_branch
  ON public.inventory_warehouses (operating_branch_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_user_assignments_user
  ON public.warehouse_user_assignments (user_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_user_assignments_warehouse
  ON public.warehouse_user_assignments (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_user_context_assignments_user
  ON public.user_context_assignments (user_id);
CREATE INDEX IF NOT EXISTS idx_user_context_assignments_branch
  ON public.user_context_assignments (branch_id);
CREATE INDEX IF NOT EXISTS idx_user_context_assignments_warehouse
  ON public.user_context_assignments (warehouse_id);

CREATE OR REPLACE FUNCTION public._set_inventory_warehouse_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_warehouses_updated_at ON public.inventory_warehouses;
CREATE TRIGGER trg_inventory_warehouses_updated_at
BEFORE UPDATE ON public.inventory_warehouses
FOR EACH ROW
EXECUTE FUNCTION public._set_inventory_warehouse_updated_at();

DROP TRIGGER IF EXISTS trg_warehouse_user_assignments_updated_at ON public.warehouse_user_assignments;
CREATE TRIGGER trg_warehouse_user_assignments_updated_at
BEFORE UPDATE ON public.warehouse_user_assignments
FOR EACH ROW
EXECUTE FUNCTION public._set_inventory_warehouse_updated_at();

DROP TRIGGER IF EXISTS trg_user_context_assignments_updated_at ON public.user_context_assignments;
CREATE TRIGGER trg_user_context_assignments_updated_at
BEFORE UPDATE ON public.user_context_assignments
FOR EACH ROW
EXECUTE FUNCTION public._set_inventory_warehouse_updated_at();

ALTER TABLE public.inventory_locations
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.inventory_warehouses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.stock_requests
  ADD COLUMN IF NOT EXISTS fulfilling_warehouse_id UUID REFERENCES public.inventory_warehouses(id) ON DELETE SET NULL;

ALTER TABLE public.dispatch_notes
  ADD COLUMN IF NOT EXISTS source_warehouse_id UUID REFERENCES public.inventory_warehouses(id) ON DELETE SET NULL;

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'central_stock_takes',
    'central_stock_take_sessions',
    'central_spoilage',
    'central_spoilage_log',
    'store_grn',
    'goods_receipts',
    'direct_issues'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = v_table
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.inventory_warehouses(id) ON DELETE SET NULL',
        v_table
      );
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  v_warehouse_id UUID;
  v_kyogong_branch_id INTEGER;
  v_central_location_id UUID;
  v_primary_legacy_location_id UUID;
  v_location RECORD;
  v_operating_branch_name TEXT;
BEGIN
  SELECT id, name
  INTO v_kyogong_branch_id, v_operating_branch_name
  FROM public.branches
  WHERE upper(code) = 'KYO' OR upper(name) = 'KYOGONG'
  ORDER BY CASE WHEN id = 1 THEN 0 ELSE 1 END, id
  LIMIT 1;

  IF v_kyogong_branch_id IS NULL THEN
    RAISE NOTICE 'Kyogong branch not found; warehouse bootstrap skipped';
    RETURN;
  END IF;

  INSERT INTO public.inventory_warehouses (
    code,
    name,
    operating_branch_id,
    is_active,
    metadata
  )
  VALUES (
    'CENTRAL_STORE',
    'Central Store',
    v_kyogong_branch_id,
    true,
    jsonb_build_object(
      'hosted_at_branch_name', v_operating_branch_name,
      'legacy_branch_id', v_kyogong_branch_id
    )
  )
  ON CONFLICT (code)
  DO UPDATE SET
    name = EXCLUDED.name,
    operating_branch_id = EXCLUDED.operating_branch_id,
    is_active = true,
    metadata = COALESCE(public.inventory_warehouses.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    updated_at = now()
  RETURNING id INTO v_warehouse_id;

  IF v_warehouse_id IS NULL THEN
    SELECT id INTO v_warehouse_id
    FROM public.inventory_warehouses
    WHERE code = 'CENTRAL_STORE'
    LIMIT 1;
  END IF;

  UPDATE public.inventory_locations
  SET warehouse_id = v_warehouse_id
  WHERE location_type = 'central_store'
    AND is_active = true
    AND branch_id = v_kyogong_branch_id
    AND warehouse_id IS DISTINCT FROM v_warehouse_id;

  SELECT id
  INTO v_primary_legacy_location_id
  FROM public.inventory_locations
  WHERE branch_id = v_kyogong_branch_id
    AND location_type = 'central_store'
    AND is_active = true
  ORDER BY
    CASE
      WHEN location_code = 'CENTRAL-STORE-' || v_kyogong_branch_id THEN 0
      WHEN location_code = 'CENTRAL-' || v_kyogong_branch_id || '-STORE' THEN 1
      ELSE 2
    END,
    id
  LIMIT 1;

  INSERT INTO public.inventory_locations (
    branch_id,
    warehouse_id,
    location_code,
    name,
    location_type,
    is_active,
    metadata
  )
  VALUES (
    v_kyogong_branch_id,
    v_warehouse_id,
    'WAREHOUSE-CENTRAL-STORE',
    'Central Store',
    'central_store',
    true,
    jsonb_build_object(
      'canonical', true,
      'hosted_at_branch_name', v_operating_branch_name
    )
  )
  ON CONFLICT (branch_id, location_code)
  DO UPDATE SET
    warehouse_id = EXCLUDED.warehouse_id,
    name = EXCLUDED.name,
    location_type = EXCLUDED.location_type,
    is_active = true,
    metadata = COALESCE(public.inventory_locations.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    updated_at = now()
  RETURNING id INTO v_central_location_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_locations
    WHERE branch_id = v_kyogong_branch_id
      AND location_type = 'branch_store'
  ) THEN
    INSERT INTO public.inventory_locations (
      branch_id,
      location_code,
      name,
      location_type,
      is_active,
      metadata
    )
    VALUES (
      v_kyogong_branch_id,
      'BRANCH-STORE-' || v_kyogong_branch_id,
      'Branch Store',
      'branch_store',
      true,
      jsonb_build_object('created_by_migration', '20260726_separate_central_store_from_kyogong')
    );
  END IF;

  IF v_central_location_id IS NOT NULL AND v_primary_legacy_location_id IS NOT NULL AND v_primary_legacy_location_id <> v_central_location_id THEN
    INSERT INTO public.inventory_balances (
      id,
      location_id,
      item_id,
      batch_id,
      current_quantity,
      reserved_quantity,
      unit_cost,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      v_central_location_id,
      ib.item_id,
      ib.batch_id,
      ib.current_quantity,
      COALESCE(ib.reserved_quantity, 0),
      COALESCE(ib.unit_cost, 0),
      now(),
      now()
    FROM public.inventory_balances ib
    WHERE ib.location_id = v_primary_legacy_location_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.inventory_balances existing
        WHERE existing.location_id = v_central_location_id
          AND existing.item_id = ib.item_id
          AND existing.batch_id IS NOT DISTINCT FROM ib.batch_id
      );
  END IF;

  FOR v_location IN
    SELECT id, branch_id, location_code, name
    FROM public.inventory_locations
    WHERE location_type = 'central_store'
      AND is_active = true
      AND id <> v_central_location_id
      AND (
        branch_id = v_kyogong_branch_id
        OR (branch_id IS NOT NULL AND branch_id <> v_kyogong_branch_id)
      )
  LOOP
    UPDATE public.inventory_locations
    SET
      is_active = false,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'legacy_central_store_location', true,
        'replaced_by_location_id', v_central_location_id,
        'replaced_at', now()
      ),
      updated_at = now()
    WHERE id = v_location.id;
  END LOOP;

  INSERT INTO public.warehouse_user_assignments (
    user_id,
    warehouse_id,
    warehouse_role,
    is_default,
    metadata
  )
  SELECT
    u.id,
    v_warehouse_id,
    u.role,
    true,
    jsonb_build_object('migrated_from_branch_id', u.branch_id)
  FROM public.users u
  WHERE u.role IN ('central_storekeeper', 'central_operations_manager')
  ON CONFLICT (user_id, warehouse_id, warehouse_role)
  DO UPDATE SET
    is_default = EXCLUDED.is_default,
    metadata = COALESCE(public.warehouse_user_assignments.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    updated_at = now();

  INSERT INTO public.user_context_assignments (
    user_id,
    context_type,
    branch_id,
    warehouse_id,
    role,
    is_default,
    metadata
  )
  SELECT
    ubr.user_id,
    'branch',
    ubr.branch_id,
    NULL,
    ubr.role,
    COALESCE(ubr.is_primary, false),
    jsonb_build_object('source', 'user_branch_roles')
  FROM public.user_branch_roles ubr
  WHERE ubr.role NOT IN ('central_storekeeper', 'central_operations_manager')
  ON CONFLICT (user_id, context_type, branch_id, warehouse_id, role)
  DO UPDATE SET
    is_default = public.user_context_assignments.is_default OR EXCLUDED.is_default,
    metadata = COALESCE(public.user_context_assignments.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    updated_at = now();

  INSERT INTO public.user_context_assignments (
    user_id,
    context_type,
    branch_id,
    warehouse_id,
    role,
    is_default,
    metadata
  )
  SELECT
    wua.user_id,
    'warehouse',
    NULL,
    wua.warehouse_id,
    wua.warehouse_role,
    COALESCE(wua.is_default, true),
    jsonb_build_object('source', 'warehouse_user_assignments')
  FROM public.warehouse_user_assignments wua
  ON CONFLICT (user_id, context_type, branch_id, warehouse_id, role)
  DO UPDATE SET
    is_default = public.user_context_assignments.is_default OR EXCLUDED.is_default,
    metadata = COALESCE(public.user_context_assignments.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    updated_at = now();

  DELETE FROM public.user_context_assignments
  WHERE context_type = 'branch'
    AND role IN ('central_storekeeper', 'central_operations_manager');

  UPDATE public.stock_requests
  SET fulfilling_warehouse_id = v_warehouse_id
  WHERE fulfilling_warehouse_id IS NULL
    AND COALESCE(status, '') IN (
      'PENDING',
      'PENDING_AUDIT',
      'UNDER_REVIEW',
      'PENDING_BRANCH_ACCOUNTANT_APPROVAL',
      'APPROVED',
      'PARTIALLY_APPROVED',
      'READY',
      'DISPATCHED',
      'IN_TRANSIT'
    );

  UPDATE public.dispatch_notes
  SET source_warehouse_id = v_warehouse_id
  WHERE source_warehouse_id IS NULL
    AND from_branch_id = v_kyogong_branch_id
    AND COALESCE(status, '') IN (
      'PENDING',
      'PICKING',
      'PACKING',
      'READY',
      'DISPATCHED',
      'IN_TRANSIT',
      'DELIVERED',
      'CONFIRMED'
    );

  UPDATE public.branches
  SET is_central_warehouse = false,
      updated_at = now()
  WHERE COALESCE(is_central_warehouse, false) = true;
END;
$$;

DROP TRIGGER IF EXISTS trg_force_central_storekeeper_branch ON public.users;
DROP FUNCTION IF EXISTS public.force_central_storekeeper_branch();
DROP INDEX IF EXISTS public.idx_single_central_warehouse;
