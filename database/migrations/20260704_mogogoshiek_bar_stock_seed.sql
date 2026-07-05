-- ============================================================
-- 20260704_mogogoshiek_bar_stock_seed.sql
-- Seed bar_stock for Mogogoshiek (branch_id=2) Main Bar.
--
-- Root cause: bar_stock has no rows for branch 2, so the Bar
-- Stocktake screen shows Opening=0 / Closing=0 for every item
-- even after the 2026-07-03 stocktake was approved. The approval
-- flow does UPDATE bar_stock ... but can't update rows that don't
-- exist. Also backfills bar_drinks.inventory_item_id so future
-- approvals can correctly UPDATE bar_stock via that FK path.
--
-- Stock priority:
--   1. Latest approved bar_stocktake_records physical_quantity
--   2. pos_outlet_items.current_stock for the main_bar outlet
--   3. 0 (safe default)
--
-- Idempotent: ON CONFLICT (branch_id, drink_id) DO UPDATE.
-- ============================================================

DO $$
DECLARE
  v_branch INT  := 2;
  v_outlet UUID;
BEGIN
  -- 1. Resolve the main_bar outlet for this branch
  SELECT id INTO v_outlet
  FROM public.pos_outlets
  WHERE branch_id = v_branch AND outlet_type = 'main_bar'
  LIMIT 1;

  IF v_outlet IS NULL THEN
    RAISE EXCEPTION 'No main_bar outlet found for branch %', v_branch;
  END IF;

  -- 2. Ensure inventory_items rows exist for bar_drinks missing them
  INSERT INTO public.inventory_items
    (sku, item_name, category, unit, item_type,
     default_unit_cost, default_selling_price, reorder_level, is_active, metadata)
  SELECT
    COALESCE(NULLIF(bd.sku::text, ''), 'BAR-' || bd.id::text),
    bd.name::text,
    COALESCE(c.name::text, bd.category::text, 'bar'),
    COALESCE(NULLIF(bd.unit::text, ''), 'bottle'),
    'menu_item',
    COALESCE(bd.cost_price, 0),
    COALESCE(bd.price, bd.selling_price, 0),
    5,
    COALESCE(bd.is_active, true),
    jsonb_build_object('source', 'bar_drinks', 'source_id', bd.id)
  FROM public.bar_drinks bd
  LEFT JOIN public.bar_drink_categories c ON c.id = bd.category_id
  WHERE bd.branch_id = v_branch
    AND bd.inventory_item_id IS NULL
  ON CONFLICT (sku) DO UPDATE SET
    item_name             = EXCLUDED.item_name,
    category              = EXCLUDED.category,
    unit                  = EXCLUDED.unit,
    default_unit_cost     = EXCLUDED.default_unit_cost,
    default_selling_price = EXCLUDED.default_selling_price,
    updated_at            = NOW();

  -- 3. Backfill bar_drinks.inventory_item_id for branch 2 where missing
  UPDATE public.bar_drinks bd
  SET inventory_item_id = ii.id,
      updated_at = NOW()
  FROM public.inventory_items ii
  WHERE bd.branch_id = v_branch
    AND bd.inventory_item_id IS NULL
    AND ii.sku = COALESCE(NULLIF(bd.sku::text, ''), 'BAR-' || bd.id::text);

  -- 4. Seed bar_stock rows — stock from latest approved stocktake,
  --    falling back to pos_outlet_items, then 0
  INSERT INTO public.bar_stock
    (branch_id, outlet_id, drink_id, item_sku, item_name,
     current_stock, par_level, unit, low_stock,
     last_updated, created_at, updated_at)
  SELECT
    v_branch,
    v_outlet,
    bd.id,
    bd.sku,
    bd.name,
    COALESCE(
      (
        SELECT btr.physical_quantity
        FROM public.bar_stocktake_records btr
        WHERE btr.branch_id  = v_branch
          AND btr.item_id    = bd.inventory_item_id
          AND btr.status     = 'approved'
        ORDER BY btr.stocktake_date DESC, btr.created_at DESC
        LIMIT 1
      ),
      (
        SELECT poi.current_stock
        FROM public.pos_outlet_items poi
        WHERE poi.outlet_id      = v_outlet
          AND poi.source_table   = 'bar_drinks'
          AND poi.source_item_id = bd.id::text
        LIMIT 1
      ),
      0
    ),
    0,
    COALESCE(bd.unit, 'bottle'),
    false,
    NOW(), NOW(), NOW()
  FROM public.bar_drinks bd
  WHERE bd.branch_id = v_branch
    AND bd.is_active  = true
  ON CONFLICT ON CONSTRAINT bar_stock_branch_id_drink_id_key DO UPDATE SET
    current_stock = EXCLUDED.current_stock,
    item_name     = EXCLUDED.item_name,
    item_sku      = EXCLUDED.item_sku,
    unit          = EXCLUDED.unit,
    outlet_id     = EXCLUDED.outlet_id,
    last_updated  = NOW(),
    updated_at    = NOW();

  RAISE NOTICE 'Seeded % bar_stock rows for Mogogoshiek branch 2 (outlet %)',
    (SELECT COUNT(*) FROM public.bar_stock WHERE branch_id = v_branch),
    v_outlet;
END $$;
