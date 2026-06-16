-- ============================================================
-- 0037_bomet_nonconsumables_outlet.sql
-- 1. Remove Trust Classic, Trust Studded, Pool Tokens from
--    the Main Bar pos_outlet_items (wrong outlet).
-- 2. Add them + their inventory_items entries into the
--    Non-consumables POS outlet (outlet_type='other').
-- 3. Link Trust Studded → STUDDED (SKU 397, already in stock).
-- 4. Add Trust Classic (SKU NC-001) and Pool Tokens (SKU NC-002)
--    to inventory_items as store_type='non_consumables'.
-- Idempotent: safe to re-run.
-- ============================================================

DO $$
DECLARE
  v_bar_id  UUID;
  v_nc_id   UUID;
  v_bd_tc   UUID;
  v_bd_ts   UUID;
  v_bd_pt   UUID;
BEGIN
  -- Outlets
  SELECT id INTO v_bar_id FROM public.pos_outlets WHERE branch_id=2 AND outlet_type='main_bar'  LIMIT 1;
  SELECT id INTO v_nc_id  FROM public.pos_outlets WHERE branch_id=2 AND outlet_type='other'     LIMIT 1;

  IF v_nc_id IS NULL THEN
    RAISE EXCEPTION 'Non-consumables outlet (other) not found for branch_id=2';
  END IF;

  -- bar_drinks IDs for the three items
  SELECT id INTO v_bd_tc FROM public.bar_drinks WHERE sku='FGB-OTH-0005' AND branch_id=2;
  SELECT id INTO v_bd_ts FROM public.bar_drinks WHERE sku='FGB-OTH-0006' AND branch_id=2;
  SELECT id INTO v_bd_pt FROM public.bar_drinks WHERE sku='FGB-OTH-0007' AND branch_id=2;

  -- ── Step 1: Remove from Main Bar outlet ─────────────────────
  IF v_bar_id IS NOT NULL THEN
    DELETE FROM public.pos_outlet_items
    WHERE outlet_id = v_bar_id
      AND sku IN ('M-' || v_bd_tc, 'M-' || v_bd_ts, 'M-' || v_bd_pt);
  END IF;

  -- ── Step 2: Add inventory_items for Trust Classic & Pool Tokens
  INSERT INTO public.inventory_items
    (sku, item_name, description, category, store_type, default_unit_cost, unit, quantity, is_active)
  VALUES
    ('NC-001', 'TRUST CLASSIC',  'Trust Classic Condom',  'NON CONSUMABLES', 'non_consumables', 30.00, 'pcs', 0, true),
    ('NC-002', 'POOL TOKENS',    'Swimming Pool Token',   'NON CONSUMABLES', 'non_consumables', 30.00, 'pcs', 0, true)
  ON CONFLICT (sku) DO UPDATE SET
    item_name=EXCLUDED.item_name, store_type=EXCLUDED.store_type,
    category=EXCLUDED.category, is_active=true, last_updated=NOW();

  -- ── Step 3: Register in branch_stock for branch 2 ───────────
  INSERT INTO public.branch_stock (branch_id, item_sku, quantity, reorder_level, max_stock_level, updated_at)
  VALUES
    (2, 'NC-001', 0, 10, 500, NOW()),
    (2, 'NC-002', 0, 10, 200, NOW()),
    (2, '397',    0, 10, 500, NOW())  -- STUDDED already in inventory
  ON CONFLICT (branch_id, item_sku) DO NOTHING;

  -- ── Step 4: Link bar_drinks to inventory ────────────────────
  UPDATE public.bar_drinks SET linked_inventory_sku='NC-001' WHERE sku='FGB-OTH-0005' AND branch_id=2;
  UPDATE public.bar_drinks SET linked_inventory_sku='397'    WHERE sku='FGB-OTH-0006' AND branch_id=2;
  UPDATE public.bar_drinks SET linked_inventory_sku='NC-002' WHERE sku='FGB-OTH-0007' AND branch_id=2;

  -- ── Step 5: Add to Non-consumables POS outlet ───────────────
  INSERT INTO public.pos_outlet_items (
    outlet_id, sku, name, category, unit,
    cost_price, selling_price, opening_stock, current_stock,
    track_stock, is_active, source_table, source_item_id, item_group
  ) VALUES
    (v_nc_id, 'NC-' || v_bd_tc, 'Trust Classic',  'Non-consumables', 'pcs', 30,  50,  0, 0, true, true, 'bar_drinks', v_bd_tc::text, 'other'),
    (v_nc_id, 'NC-' || v_bd_ts, 'Trust Studded',  'Non-consumables', 'pcs', 30,  100, 0, 0, true, true, 'bar_drinks', v_bd_ts::text, 'other'),
    (v_nc_id, 'NC-' || v_bd_pt, 'Pool Tokens',    'Non-consumables', 'pcs', 30,  50,  0, 0, true, true, 'bar_drinks', v_bd_pt::text, 'other')
  ON CONFLICT (outlet_id, sku) DO UPDATE SET
    name=EXCLUDED.name, category=EXCLUDED.category,
    selling_price=EXCLUDED.selling_price, is_active=true;

  RAISE NOTICE 'Done: Trust Classic/Studded/Pool Tokens moved to Non-consumables outlet %', v_nc_id;
END $$;
