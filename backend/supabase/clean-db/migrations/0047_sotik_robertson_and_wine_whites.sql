-- ============================================================
-- 0047_sotik_robertson_and_wine_whites.sql
-- 1. Create ROBERTSON WHISKY as a new master inventory item (FG-454)
--    and relink Sotik's Robertson bar_drinks row to it (was wrongly
--    linked to FG-318 ROBERTSON SWEET RED, a wine — different brand).
-- 2. Add white variants for the 5 wines that carry both colours at
--    Sotik (Cellar Cask, Drostdy-Hof, Caprice, Four Cousins,
--    Casabuena). Opening stock for whites set to 0 (not on original
--    stock sheet — storekeeper should update after physical count).
--    Prices assumed same as the red variant; correct in the UI if different.
-- ============================================================

DO $$
DECLARE
  v_branch  INT  := 4;
  v_outlet  UUID;
  v_rob_id  UUID;
  v_cat_id  UUID;
BEGIN
  SELECT id INTO v_outlet FROM public.pos_outlets WHERE branch_id = v_branch AND outlet_type = 'main_bar' LIMIT 1;
  IF v_outlet IS NULL THEN RAISE EXCEPTION 'No main_bar outlet for branch %', v_branch; END IF;

  -- ── 1. New master item: ROBERTSON WHISKY ─────────────────────
  INSERT INTO public.inventory_items
    (sku, item_name, description, category, store_type, unit, item_type, default_unit_cost, default_selling_price, is_active)
  VALUES
    ('FG-454','ROBERTSON WHISKY','Robertson Blended Scotch Whisky','WHISKY','bar_store','pcs','stockable',0,0,true)
  ON CONFLICT (sku) DO NOTHING;

  SELECT id INTO v_rob_id FROM public.inventory_items WHERE sku = 'FG-454';

  -- Fix the bar_drinks row: rename + relink to whisky SKU
  UPDATE public.bar_drinks
  SET name = 'Robertson Whisky',
      linked_inventory_sku = '454',
      inventory_item_id = v_rob_id,
      updated_at = NOW()
  WHERE branch_id = v_branch AND sku = 'FGB-STK-BRC-0008';

  -- Mirror rename to pos_outlet_items
  UPDATE public.pos_outlet_items
  SET name = 'Robertson Whisky', updated_at = NOW()
  WHERE outlet_id = v_outlet AND source_table = 'bar_drinks'
    AND source_item_id = (SELECT id::text FROM public.bar_drinks WHERE branch_id = v_branch AND sku = 'FGB-STK-BRC-0008');

  -- Remove wrong branch_stock entry (wine Robertson), add correct whisky one
  DELETE FROM public.branch_stock WHERE branch_id = v_branch AND item_sku = 'FG-318';
  INSERT INTO public.branch_stock (branch_id, item_sku, quantity, reorder_level, max_stock_level, updated_at)
  VALUES (v_branch, 'FG-454', 0, 5, 50, NOW())
  ON CONFLICT (branch_id, item_sku) DO UPDATE SET updated_at = NOW();

  -- ── 2. Get the Wine category id for the white variants ────────
  SELECT id INTO v_cat_id FROM public.bar_drink_categories WHERE branch_id = v_branch AND name = 'Wine' LIMIT 1;

  -- White wine bar_drinks (prices same as red counterparts — confirm if different)
  INSERT INTO public.bar_drinks (category_id, branch_id, name, selling_price, sku, unit, is_active, is_available,
                                  linked_inventory_sku, inventory_item_id)
  SELECT v_cat_id, v_branch, v.name, v.price, v.sku, 'bottle', true, true, v.suffix, ii.id
  FROM (VALUES
    ('Cellar Cask White',      1200, 'FGB-STK-WIN-0014', '440'),
    ('Drostdy-Hof White',      1200, 'FGB-STK-WIN-0015', '437'),
    ('Caprice Sweet White',    1300, 'FGB-STK-WIN-0016', '323'),
    ('Four Cousins White',     1400, 'FGB-STK-WIN-0017', '321'),
    ('Casabuena Sangria White',1300, 'FGB-STK-WIN-0018', '326')
  ) AS v(name, price, sku, suffix)
  JOIN public.inventory_items ii ON ii.sku = 'FG-' || v.suffix
  ON CONFLICT (sku) DO UPDATE SET
    name = EXCLUDED.name, selling_price = EXCLUDED.selling_price,
    linked_inventory_sku = EXCLUDED.linked_inventory_sku,
    inventory_item_id = EXCLUDED.inventory_item_id,
    is_active = true, updated_at = NOW();

  -- Project white wines into pos_outlet_items
  INSERT INTO public.pos_outlet_items
    (outlet_id, sku, name, category, unit, cost_price, selling_price,
     opening_stock, current_stock, track_stock, is_active, source_table, source_item_id, item_group)
  SELECT v_outlet, 'M-' || bd.id::text, bd.name, 'Wine', 'bottle',
         0, bd.selling_price, 0, 0, true, true, 'bar_drinks', bd.id::text, 'bar'
  FROM public.bar_drinks bd
  WHERE bd.branch_id = v_branch
    AND bd.sku IN ('FGB-STK-WIN-0014','FGB-STK-WIN-0015','FGB-STK-WIN-0016','FGB-STK-WIN-0017','FGB-STK-WIN-0018')
  ON CONFLICT (outlet_id, sku) DO UPDATE SET
    name = EXCLUDED.name, selling_price = EXCLUDED.selling_price, is_active = true;

  -- branch_stock for white wines (qty 0 — storekeeper to fill after physical count)
  INSERT INTO public.branch_stock (branch_id, item_sku, quantity, reorder_level, max_stock_level, updated_at)
  SELECT v_branch, ii.sku, 0, 5, 100, NOW()
  FROM public.bar_drinks bd
  JOIN public.inventory_items ii ON ii.id = bd.inventory_item_id
  WHERE bd.branch_id = v_branch
    AND bd.sku IN ('FGB-STK-WIN-0014','FGB-STK-WIN-0015','FGB-STK-WIN-0016','FGB-STK-WIN-0017','FGB-STK-WIN-0018')
  ON CONFLICT (branch_id, item_sku) DO NOTHING;

  RAISE NOTICE 'Robertson fix + 5 white wine variants applied for branch %', v_branch;
END $$;
