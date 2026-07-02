-- ============================================================
-- 0048_sotik_bar_stock_seed.sql
-- Seed bar_stock for Sotik (branch_id=4) Main Bar from the opening
-- stock quantities already stored in pos_outlet_items.current_stock.
-- bar_stock.current_stock is what the Bar Stocktake screen reads for
-- the "Opening" column — without this table populated the screen
-- shows 0 for every item even though pos_outlet_items was correctly
-- set from the handwritten stock sheet.
-- Idempotent: ON CONFLICT DO UPDATE.
-- ============================================================

DO $$
DECLARE
  v_branch INT  := 4;
  v_outlet UUID;
BEGIN
  SELECT id INTO v_outlet FROM public.pos_outlets WHERE branch_id = v_branch AND outlet_type = 'main_bar' LIMIT 1;
  IF v_outlet IS NULL THEN RAISE EXCEPTION 'No main_bar outlet for branch %', v_branch; END IF;

  INSERT INTO public.bar_stock
    (branch_id, outlet_id, drink_id, item_sku, item_name, current_stock, par_level, unit, low_stock, last_updated, created_at, updated_at)
  SELECT
    v_branch,
    v_outlet,
    bd.id,
    bd.sku,
    bd.name,
    COALESCE(poi.current_stock, 0),
    0,
    bd.unit,
    false,
    NOW(), NOW(), NOW()
  FROM public.bar_drinks bd
  JOIN public.pos_outlet_items poi
    ON poi.outlet_id  = v_outlet
    AND poi.source_table   = 'bar_drinks'
    AND poi.source_item_id = bd.id::text
  WHERE bd.branch_id = v_branch
  ON CONFLICT (branch_id, drink_id) DO UPDATE SET
    current_stock = EXCLUDED.current_stock,
    item_name     = EXCLUDED.item_name,
    item_sku      = EXCLUDED.item_sku,
    unit          = EXCLUDED.unit,
    last_updated  = NOW(),
    updated_at    = NOW();

  RAISE NOTICE 'Seeded % bar_stock rows for Sotik branch (outlet %)',
    (SELECT COUNT(*) FROM public.bar_stock WHERE branch_id = v_branch), v_outlet;
END $$;
