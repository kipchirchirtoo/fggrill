-- ============================================================
-- 0034_bomet_bar_outlet_items.sql
-- Populate pos_outlet_items for Bomet Town (branch_id=2) Main Bar
-- from the 117 bar_drinks items seeded in 0033.
-- Idempotent: ON CONFLICT (outlet_id, sku) DO UPDATE.
-- ============================================================

DO $$
DECLARE
  v_outlet_id UUID;
BEGIN
  -- Find the Bomet Main Bar POS outlet
  SELECT id INTO v_outlet_id
  FROM public.pos_outlets
  WHERE branch_id = 2
    AND outlet_type = 'main_bar'
  LIMIT 1;

  IF v_outlet_id IS NULL THEN
    RAISE EXCEPTION 'No main_bar outlet found for branch_id=2. Ensure 0008 migration ran.';
  END IF;

  -- Insert one pos_outlet_item per bar_drink for this branch
  INSERT INTO public.pos_outlet_items (
    outlet_id,
    sku,
    name,
    category,
    unit,
    cost_price,
    selling_price,
    opening_stock,
    current_stock,
    track_stock,
    is_active,
    source_table,
    source_item_id,
    item_group
  )
  SELECT
    v_outlet_id,
    'M-' || bd.id::text,
    bd.name,
    COALESCE(bdc.name, 'Bar'),
    bd.unit,
    COALESCE(bd.cost_price, 0),
    COALESCE(bd.selling_price, 0),
    0,   -- opening_stock
    0,   -- current_stock (storekeeper issues stock later)
    true,
    true,
    'bar_drinks',
    bd.id::text,
    'bar'
  FROM public.bar_drinks bd
  LEFT JOIN public.bar_drink_categories bdc ON bdc.id = bd.category_id
  WHERE bd.branch_id = 2
    AND bd.is_active = true
  ON CONFLICT (outlet_id, sku) DO UPDATE SET
    name            = EXCLUDED.name,
    category        = EXCLUDED.category,
    unit            = EXCLUDED.unit,
    cost_price      = EXCLUDED.cost_price,
    selling_price   = EXCLUDED.selling_price,
    source_table    = EXCLUDED.source_table,
    source_item_id  = EXCLUDED.source_item_id,
    item_group      = EXCLUDED.item_group,
    is_active       = true;

  RAISE NOTICE 'Seeded pos_outlet_items for outlet % (Bomet Main Bar)', v_outlet_id;
END $$;
