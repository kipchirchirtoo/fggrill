-- ============================================================
-- UNIFIED BAR STOCK SYSTEM
-- Connects bar_stock, pos_outlet_items, inventory_balances,
-- and pos_shift_stock_counts into a single source of truth.
-- Restaurant POS outlets are NOT affected.
-- ============================================================
-- Date: 2026-06-21
-- Scope: Bar outlets only (main_bar, executive_bar, kyogong_executive_bar, kyogong_sports_bar)

-- ─────────────────────────────────────────────────────────────
-- 1. Add inventory_location_id to pos_outlets (nullable, safe)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.pos_outlets
  ADD COLUMN IF NOT EXISTS inventory_location_id UUID REFERENCES public.inventory_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pos_outlets_inventory_location_id
  ON public.pos_outlets(inventory_location_id);

-- ─────────────────────────────────────────────────────────────
-- 2. Ensure inventory_locations exist for bar outlets
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.inventory_locations (branch_id, location_code, name, location_type, metadata)
SELECT
  po.branch_id,
  'BAR-' || po.outlet_type || '-' || po.branch_id,
  COALESCE(po.name, 'Bar Outlet') || ' Stock',
  'pos_outlet',
  jsonb_build_object('source', 'pos_outlets', 'source_id', po.id, 'outlet_type', po.outlet_type)
FROM public.pos_outlets po
WHERE po.outlet_type IN ('main_bar', 'executive_bar', 'kyogong_executive_bar', 'kyogong_sports_bar')
  AND po.branch_id IS NOT NULL
ON CONFLICT (branch_id, location_code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 3. Link pos_outlets to their inventory_locations
-- ─────────────────────────────────────────────────────────────
UPDATE public.pos_outlets po
SET inventory_location_id = il.id
FROM public.inventory_locations il
WHERE il.branch_id = po.branch_id
  AND il.location_code = 'BAR-' || po.outlet_type || '-' || po.branch_id
  AND po.outlet_type IN ('main_bar', 'executive_bar', 'kyogong_executive_bar', 'kyogong_sports_bar')
  AND po.inventory_location_id IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 4. Ensure inventory_items exist for all bar_drinks
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.inventory_items (sku, item_name, description, category, unit, item_type, default_unit_cost, default_selling_price, reorder_level, is_active, metadata)
SELECT
  COALESCE(NULLIF(bd.sku::text, ''), 'BAR-' || bd.id::text),
  bd.name::text,
  bd.description::text,
  COALESCE(c.name::text, 'bar'),
  COALESCE(NULLIF(bd.unit::text, ''), 'bottle'),
  'menu_item',
  COALESCE(bd.cost_price, 0),
  COALESCE(bd.price, bd.selling_price, 0),
  COALESCE(bd.min_stock, 5),
  COALESCE(bd.is_available, true),
  jsonb_build_object('source', 'bar_drinks', 'source_id', bd.id)
FROM public.bar_drinks bd
LEFT JOIN public.bar_drink_categories c ON c.id = bd.category_id
WHERE bd.id IS NOT NULL
ON CONFLICT (sku) DO UPDATE SET
  item_name = EXCLUDED.item_name,
  category = EXCLUDED.category,
  unit = EXCLUDED.unit,
  default_unit_cost = EXCLUDED.default_unit_cost,
  default_selling_price = EXCLUDED.default_selling_price,
  reorder_level = EXCLUDED.reorder_level,
  is_active = EXCLUDED.is_active,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- ─────────────────────────────────────────────────────────────
-- 5. Seed inventory_balances for bar drinks at bar outlet locations
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.inventory_balances (item_id, location_id, current_quantity, reserved_quantity, damaged_quantity, expired_quantity, unit_cost)
SELECT
  ii.id,
  il.id,
  COALESCE(bs.current_stock, 0),
  0,
  0,
  0,
  COALESCE(bs.cost_per_unit, ii.default_unit_cost, 0)
FROM public.bar_drinks bd
JOIN public.inventory_items ii ON ii.sku = COALESCE(NULLIF(bd.sku::text, ''), 'BAR-' || bd.id::text)
JOIN public.bar_stock bs ON bs.drink_id = bd.id
JOIN public.inventory_locations il
  ON il.branch_id = bs.branch_id
  AND il.location_type = 'pos_outlet'
  AND il.location_code LIKE 'BAR-%'
WHERE bs.branch_id IS NOT NULL
  AND bs.current_stock IS NOT NULL
  AND bs.current_stock > 0
ON CONFLICT (item_id, location_id, batch_id) DO UPDATE SET
  current_quantity = EXCLUDED.current_quantity,
  unit_cost = EXCLUDED.unit_cost,
  updated_at = NOW();

-- ─────────────────────────────────────────────────────────────
-- 6. Sync pos_outlet_items.current_stock from inventory_balances for bar items
-- ─────────────────────────────────────────────────────────────
UPDATE public.pos_outlet_items poi
SET current_stock = ib.current_quantity,
    updated_at = NOW()
FROM public.inventory_balances ib
JOIN public.inventory_locations il ON il.id = ib.location_id
JOIN public.inventory_items ii ON ii.id = ib.item_id
WHERE poi.outlet_id = (
  SELECT po.id FROM public.pos_outlets po
  WHERE po.branch_id = il.branch_id
    AND po.outlet_type IN ('main_bar', 'executive_bar', 'kyogong_executive_bar', 'kyogong_sports_bar')
    AND po.inventory_location_id = il.id
  LIMIT 1
)
  AND poi.source_table = 'bar_drinks'
  AND poi.sku = ii.sku
  AND poi.current_stock <> ib.current_quantity;

-- ─────────────────────────────────────────────────────────────
-- 7. Create index for fast bar stock lookups by SKU
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inventory_items_sku_bar
  ON public.inventory_items(sku)
  WHERE item_type = 'menu_item';

-- ─────────────────────────────────────────────────────────────
-- 8. Function: get bar stock from unified view
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_bar_stock(p_branch_id INTEGER, p_outlet_id UUID DEFAULT NULL)
RETURNS TABLE (
  drink_id UUID,
  sku TEXT,
  name TEXT,
  category TEXT,
  unit TEXT,
  cost_price NUMERIC,
  selling_price NUMERIC,
  current_stock NUMERIC,
  min_stock NUMERIC,
  last_restocked TIMESTAMPTZ
) LANGUAGE sql STABLE AS $$
  SELECT
    bd.id AS drink_id,
    ii.sku,
    bd.name,
    COALESCE(c.name, bd.category::text, '') AS category,
    COALESCE(bd.unit, 'bottle') AS unit,
    COALESCE(ii.default_unit_cost, bd.cost_price, 0) AS cost_price,
    COALESCE(bd.price, bd.selling_price, ii.default_selling_price, 0) AS selling_price,
    COALESCE(ib.current_quantity, bs.current_stock, 0) AS current_stock,
    COALESCE(bs.par_level, bd.min_stock, 5) AS min_stock,
    bs.last_updated AS last_restocked
  FROM public.bar_drinks bd
  LEFT JOIN public.bar_drink_categories c ON c.id = bd.category_id
  LEFT JOIN public.inventory_items ii ON ii.sku = COALESCE(NULLIF(bd.sku::text, ''), 'BAR-' || bd.id::text)
  LEFT JOIN public.bar_stock bs ON bs.drink_id = bd.id AND bs.branch_id = p_branch_id
  LEFT JOIN public.inventory_locations il
    ON il.branch_id = p_branch_id
    AND il.location_type = 'pos_outlet'
    AND (p_outlet_id IS NULL OR il.location_code LIKE 'BAR-%')
  LEFT JOIN public.inventory_balances ib
    ON ib.item_id = ii.id AND ib.location_id = il.id
  WHERE bd.is_available IS NOT FALSE
    AND (bd.branch_id IS NULL OR bd.branch_id = p_branch_id)
  ORDER BY bd.name;
$$;

-- ─────────────────────────────────────────────────────────────
-- 9. Trigger: auto-sync pos_outlet_items when inventory_balances changes
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._sync_bar_pos_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_branch_id INTEGER;
  v_outlet_id UUID;
  v_sku TEXT;
BEGIN
  -- Only sync for pos_outlet locations
  IF (SELECT location_type FROM public.inventory_locations WHERE id = NEW.location_id) <> 'pos_outlet' THEN
    RETURN NEW;
  END IF;

  SELECT il.branch_id, ii.sku
  INTO v_branch_id, v_sku
  FROM public.inventory_locations il
  JOIN public.inventory_items ii ON ii.id = NEW.item_id
  WHERE il.id = NEW.location_id;

  IF v_sku IS NULL OR v_branch_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT po.id INTO v_outlet_id
  FROM public.pos_outlets po
  WHERE po.branch_id = v_branch_id
    AND po.inventory_location_id = NEW.location_id
    AND po.outlet_type IN ('main_bar', 'executive_bar', 'kyogong_executive_bar', 'kyogong_sports_bar')
  LIMIT 1;

  IF v_outlet_id IS NOT NULL THEN
    UPDATE public.pos_outlet_items
    SET current_stock = NEW.current_quantity,
        updated_at = NOW()
    WHERE outlet_id = v_outlet_id
      AND sku = v_sku
      AND source_table = 'bar_drinks';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_bar_pos_stock ON public.inventory_balances;
CREATE TRIGGER trg_sync_bar_pos_stock
  AFTER UPDATE ON public.inventory_balances
  FOR EACH ROW EXECUTE FUNCTION public._sync_bar_pos_stock();

SELECT 'Unified bar stock migration completed successfully' AS status;
