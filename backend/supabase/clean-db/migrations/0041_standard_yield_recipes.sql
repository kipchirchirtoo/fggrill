-- ============================================================
-- 0041_standard_yield_recipes.sql
-- Seed standard yield reference recipes for branch 2
-- quantity_required = ingredient needed PER OUTPUT UNIT (per portion)
-- Idempotent: safe to re-run (upserts by menu_item_id + name).
-- ============================================================

DO $$
DECLARE
  -- Menu item IDs (branch 2)
  v_samosa        UUID; v_chapati       UUID; v_kebab         UUID;
  v_ndazi         UUID; v_chips         UUID; v_chips_sausage UUID;
  v_tea_mug       UUID; v_ugali         UUID; v_sp_managu     UUID;
  v_sp_sukuma     UUID; v_sp_pilau      UUID;
  v_beef_qtr      UUID; -- Beef Wet Fry 1/4 Kg

  -- Recipe IDs
  r_samosa        UUID; r_chapati       UUID; r_kebab         UUID;
  r_ndazi         UUID; r_chips         UUID; r_chips_sausage UUID;
  r_tea_mug       UUID; r_ugali         UUID; r_sp_managu     UUID;
  r_sp_sukuma     UUID; r_sp_pilau      UUID; r_beef_qtr      UUID;
BEGIN
  -- ── Fetch menu item IDs ──────────────────────────────────
  SELECT id INTO v_samosa        FROM public.restaurant_menu_items WHERE branch_id=2 AND name='Samosa'            LIMIT 1;
  SELECT id INTO v_chapati       FROM public.restaurant_menu_items WHERE branch_id=2 AND name='Chapati'           LIMIT 1;
  SELECT id INTO v_kebab         FROM public.restaurant_menu_items WHERE branch_id=2 AND name='Kebab'             LIMIT 1;
  SELECT id INTO v_ndazi         FROM public.restaurant_menu_items WHERE branch_id=2 AND name='Ndazi'             LIMIT 1;
  SELECT id INTO v_chips         FROM public.restaurant_menu_items WHERE branch_id=2 AND name='Chips'             LIMIT 1;
  SELECT id INTO v_chips_sausage FROM public.restaurant_menu_items WHERE branch_id=2 AND name='Chips Sausage'     LIMIT 1;
  SELECT id INTO v_tea_mug       FROM public.restaurant_menu_items WHERE branch_id=2 AND name='Tea Mug'           LIMIT 1;
  SELECT id INTO v_ugali         FROM public.restaurant_menu_items WHERE branch_id=2 AND name='Ugali'             LIMIT 1;
  SELECT id INTO v_sp_managu     FROM public.restaurant_menu_items WHERE branch_id=2 AND name='Special Managu'    LIMIT 1;
  SELECT id INTO v_sp_sukuma     FROM public.restaurant_menu_items WHERE branch_id=2 AND name='Special Sukuma'    LIMIT 1;
  SELECT id INTO v_sp_pilau      FROM public.restaurant_menu_items WHERE branch_id=2 AND name='Special Pilau'     LIMIT 1;
  SELECT id INTO v_beef_qtr      FROM public.restaurant_menu_items WHERE branch_id=2 AND name='Beef Wet Fry 1/4 Kg' LIMIT 1;

  -- ── Helper: upsert recipe + clear old items ──────────────
  -- We delete items and re-insert so re-runs are idempotent

  -- ── 1. Samosa: 1kg Minced Meat → 30 portions ────────────
  DELETE FROM public.recipe_items WHERE recipe_id IN
    (SELECT id FROM public.recipes WHERE menu_item_id=v_samosa AND name='Samosa (Standard Yield)');
  INSERT INTO public.recipes (branch_id, menu_item_id, name, output_quantity, output_unit, status)
  VALUES (2, v_samosa, 'Samosa (Standard Yield)', 30, 'portion', 'active')
  ON CONFLICT DO NOTHING RETURNING id INTO r_samosa;
  IF r_samosa IS NULL THEN
    SELECT id INTO r_samosa FROM public.recipes WHERE menu_item_id=v_samosa AND name='Samosa (Standard Yield)';
  END IF;
  INSERT INTO public.recipe_items (recipe_id, item_sku, item_name, quantity_required, unit)
  VALUES (r_samosa, '80', 'MINCED MEAT', 0.0333, 'kg');  -- 1kg ÷ 30 = 0.0333 kg per samosa

  -- ── 2. Chapati: 2kg EXE flour → 27 chapatis ─────────────
  DELETE FROM public.recipe_items WHERE recipe_id IN
    (SELECT id FROM public.recipes WHERE menu_item_id=v_chapati AND name='Chapati (Standard Yield)');
  INSERT INTO public.recipes (branch_id, menu_item_id, name, output_quantity, output_unit, status)
  VALUES (2, v_chapati, 'Chapati (Standard Yield)', 27, 'portion', 'active')
  ON CONFLICT DO NOTHING RETURNING id INTO r_chapati;
  IF r_chapati IS NULL THEN
    SELECT id INTO r_chapati FROM public.recipes WHERE menu_item_id=v_chapati AND name='Chapati (Standard Yield)';
  END IF;
  INSERT INTO public.recipe_items (recipe_id, item_sku, item_name, quantity_required, unit)
  VALUES (r_chapati, '3', 'EXE ALL PURPOSE', 0.0741, 'kg');  -- 2kg ÷ 27

  -- ── 3. Kebab: 2kg EXE flour → 70 kebabs ─────────────────
  DELETE FROM public.recipe_items WHERE recipe_id IN
    (SELECT id FROM public.recipes WHERE menu_item_id=v_kebab AND name='Kebab (Standard Yield)');
  INSERT INTO public.recipes (branch_id, menu_item_id, name, output_quantity, output_unit, status)
  VALUES (2, v_kebab, 'Kebab (Standard Yield)', 70, 'portion', 'active')
  ON CONFLICT DO NOTHING RETURNING id INTO r_kebab;
  IF r_kebab IS NULL THEN
    SELECT id INTO r_kebab FROM public.recipes WHERE menu_item_id=v_kebab AND name='Kebab (Standard Yield)';
  END IF;
  INSERT INTO public.recipe_items (recipe_id, item_sku, item_name, quantity_required, unit)
  VALUES (r_kebab, '3', 'EXE ALL PURPOSE', 0.0286, 'kg');  -- 2kg ÷ 70

  -- ── 4. Ndazi: 2kg Self Raising → 23 portions ────────────
  DELETE FROM public.recipe_items WHERE recipe_id IN
    (SELECT id FROM public.recipes WHERE menu_item_id=v_ndazi AND name='Ndazi (Standard Yield)');
  INSERT INTO public.recipes (branch_id, menu_item_id, name, output_quantity, output_unit, status)
  VALUES (2, v_ndazi, 'Ndazi (Standard Yield)', 23, 'portion', 'active')
  ON CONFLICT DO NOTHING RETURNING id INTO r_ndazi;
  IF r_ndazi IS NULL THEN
    SELECT id INTO r_ndazi FROM public.recipes WHERE menu_item_id=v_ndazi AND name='Ndazi (Standard Yield)';
  END IF;
  INSERT INTO public.recipe_items (recipe_id, item_sku, item_name, quantity_required, unit)
  VALUES (r_ndazi, '14', 'SELFRAISING', 0.0870, 'kg');  -- 2kg ÷ 23

  -- ── 5. Chips: 2kg Potatoes → 3 portions ─────────────────
  DELETE FROM public.recipe_items WHERE recipe_id IN
    (SELECT id FROM public.recipes WHERE menu_item_id=v_chips AND name='Chips (Standard Yield)');
  INSERT INTO public.recipes (branch_id, menu_item_id, name, output_quantity, output_unit, status)
  VALUES (2, v_chips, 'Chips (Standard Yield)', 3, 'portion', 'active')
  ON CONFLICT DO NOTHING RETURNING id INTO r_chips;
  IF r_chips IS NULL THEN
    SELECT id INTO r_chips FROM public.recipes WHERE menu_item_id=v_chips AND name='Chips (Standard Yield)';
  END IF;
  INSERT INTO public.recipe_items (recipe_id, item_sku, item_name, quantity_required, unit)
  VALUES (r_chips, '86', 'POTATOES', 0.6667, 'kg');  -- 2kg ÷ 3

  -- ── 6. Chips Sausage: 1kg Potatoes → 3 specials ─────────
  DELETE FROM public.recipe_items WHERE recipe_id IN
    (SELECT id FROM public.recipes WHERE menu_item_id=v_chips_sausage AND name='Chips Sausage (Standard Yield)');
  INSERT INTO public.recipes (branch_id, menu_item_id, name, output_quantity, output_unit, status)
  VALUES (2, v_chips_sausage, 'Chips Sausage (Standard Yield)', 3, 'portion', 'active')
  ON CONFLICT DO NOTHING RETURNING id INTO r_chips_sausage;
  IF r_chips_sausage IS NULL THEN
    SELECT id INTO r_chips_sausage FROM public.recipes WHERE menu_item_id=v_chips_sausage AND name='Chips Sausage (Standard Yield)';
  END IF;
  INSERT INTO public.recipe_items (recipe_id, item_sku, item_name, quantity_required, unit)
  VALUES (r_chips_sausage, '86', 'POTATOES', 0.3333, 'kg');  -- 1kg ÷ 3

  -- ── 7. Tea Mug: 1 litre Milk → 4 cups ──────────────────
  DELETE FROM public.recipe_items WHERE recipe_id IN
    (SELECT id FROM public.recipes WHERE menu_item_id=v_tea_mug AND name='Tea Mug (Standard Yield)');
  INSERT INTO public.recipes (branch_id, menu_item_id, name, output_quantity, output_unit, status)
  VALUES (2, v_tea_mug, 'Tea Mug (Standard Yield)', 4, 'portion', 'active')
  ON CONFLICT DO NOTHING RETURNING id INTO r_tea_mug;
  IF r_tea_mug IS NULL THEN
    SELECT id INTO r_tea_mug FROM public.recipes WHERE menu_item_id=v_tea_mug AND name='Tea Mug (Standard Yield)';
  END IF;
  INSERT INTO public.recipe_items (recipe_id, item_sku, item_name, quantity_required, unit)
  VALUES (r_tea_mug, '106', 'MILK PACKET', 0.25, 'litre');  -- 1L ÷ 4

  -- ── 8. Ugali: 2kg Ajab → 15 ugalis ─────────────────────
  DELETE FROM public.recipe_items WHERE recipe_id IN
    (SELECT id FROM public.recipes WHERE menu_item_id=v_ugali AND name='Ugali (Standard Yield)');
  INSERT INTO public.recipes (branch_id, menu_item_id, name, output_quantity, output_unit, status)
  VALUES (2, v_ugali, 'Ugali (Standard Yield)', 15, 'portion', 'active')
  ON CONFLICT DO NOTHING RETURNING id INTO r_ugali;
  IF r_ugali IS NULL THEN
    SELECT id INTO r_ugali FROM public.recipes WHERE menu_item_id=v_ugali AND name='Ugali (Standard Yield)';
  END IF;
  INSERT INTO public.recipe_items (recipe_id, item_sku, item_name, quantity_required, unit)
  VALUES (r_ugali, '2', 'AJAB UGALI', 0.1333, 'kg');  -- 2kg ÷ 15

  -- ── 9. Special Managu: 1kg Beef + 1kg Managu → 10 portions
  DELETE FROM public.recipe_items WHERE recipe_id IN
    (SELECT id FROM public.recipes WHERE menu_item_id=v_sp_managu AND name='Special Managu (Standard Yield)');
  INSERT INTO public.recipes (branch_id, menu_item_id, name, output_quantity, output_unit, status)
  VALUES (2, v_sp_managu, 'Special Managu (Standard Yield)', 10, 'portion', 'active')
  ON CONFLICT DO NOTHING RETURNING id INTO r_sp_managu;
  IF r_sp_managu IS NULL THEN
    SELECT id INTO r_sp_managu FROM public.recipes WHERE menu_item_id=v_sp_managu AND name='Special Managu (Standard Yield)';
  END IF;
  INSERT INTO public.recipe_items (recipe_id, item_sku, item_name, quantity_required, unit) VALUES
    (r_sp_managu, '79', 'BEEF STEAK',  0.1,  'kg'),  -- 1kg ÷ 10
    (r_sp_managu, '104', 'MANAGU',     0.1,  'kg');   -- ~1kg ÷ 10

  -- ── 10. Special Sukuma: 1kg Beef + 1kg Sukuma → 10 portions
  DELETE FROM public.recipe_items WHERE recipe_id IN
    (SELECT id FROM public.recipes WHERE menu_item_id=v_sp_sukuma AND name='Special Sukuma (Standard Yield)');
  INSERT INTO public.recipes (branch_id, menu_item_id, name, output_quantity, output_unit, status)
  VALUES (2, v_sp_sukuma, 'Special Sukuma (Standard Yield)', 10, 'portion', 'active')
  ON CONFLICT DO NOTHING RETURNING id INTO r_sp_sukuma;
  IF r_sp_sukuma IS NULL THEN
    SELECT id INTO r_sp_sukuma FROM public.recipes WHERE menu_item_id=v_sp_sukuma AND name='Special Sukuma (Standard Yield)';
  END IF;
  INSERT INTO public.recipe_items (recipe_id, item_sku, item_name, quantity_required, unit) VALUES
    (r_sp_sukuma, '79',  'BEEF STEAK',   0.1,  'kg'),
    (r_sp_sukuma, '427', 'SUKUMA WIKI',  0.1,  'kg');

  -- ── 11. Special Pilau: 1kg Beef + 1kg Rice → 7/12 mix ───
  --   Beef: 1kg → 12 specials → 0.0833 per portion
  --   Rice: 1kg → 7 plates   → 0.1429 per portion
  DELETE FROM public.recipe_items WHERE recipe_id IN
    (SELECT id FROM public.recipes WHERE menu_item_id=v_sp_pilau AND name='Special Pilau (Standard Yield)');
  INSERT INTO public.recipes (branch_id, menu_item_id, name, output_quantity, output_unit, status)
  VALUES (2, v_sp_pilau, 'Special Pilau (Standard Yield)', 7, 'portion', 'active')
  ON CONFLICT DO NOTHING RETURNING id INTO r_sp_pilau;
  IF r_sp_pilau IS NULL THEN
    SELECT id INTO r_sp_pilau FROM public.recipes WHERE menu_item_id=v_sp_pilau AND name='Special Pilau (Standard Yield)';
  END IF;
  INSERT INTO public.recipe_items (recipe_id, item_sku, item_name, quantity_required, unit) VALUES
    (r_sp_pilau, '5',  'RICE',       0.1429, 'kg'),  -- 1kg ÷ 7
    (r_sp_pilau, '79', 'BEEF STEAK', 0.0583, 'kg');  -- 7/12 of 1kg ÷ 7

  -- ── 12. Beef 1/4 Kg: 1kg Beef → 4 portions ──────────────
  DELETE FROM public.recipe_items WHERE recipe_id IN
    (SELECT id FROM public.recipes WHERE menu_item_id=v_beef_qtr AND name='Beef 1/4 Kg (Standard Yield)');
  INSERT INTO public.recipes (branch_id, menu_item_id, name, output_quantity, output_unit, status)
  VALUES (2, v_beef_qtr, 'Beef 1/4 Kg (Standard Yield)', 4, 'portion', 'active')
  ON CONFLICT DO NOTHING RETURNING id INTO r_beef_qtr;
  IF r_beef_qtr IS NULL THEN
    SELECT id INTO r_beef_qtr FROM public.recipes WHERE menu_item_id=v_beef_qtr AND name='Beef 1/4 Kg (Standard Yield)';
  END IF;
  INSERT INTO public.recipe_items (recipe_id, item_sku, item_name, quantity_required, unit)
  VALUES (r_beef_qtr, '79', 'BEEF STEAK', 0.25, 'kg');  -- 1kg ÷ 4

  RAISE NOTICE 'Standard yield recipes seeded successfully for branch 2';
END $$;
