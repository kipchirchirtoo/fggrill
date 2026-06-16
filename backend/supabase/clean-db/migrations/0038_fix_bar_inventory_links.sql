-- ============================================================
-- 0038_fix_bar_inventory_links.sql
-- 1. Fix CAPTAIN MORGAN LEMON → MELON in inventory_items
-- 2. Link Manyatta Can bar_drink → existing MANYATTA (SKU 196)
-- 3. Add missing bar items to inventory_items + branch_stock
-- 4. Link all newly-added items to their bar_drinks entries
-- Idempotent: safe to re-run.
-- ============================================================

-- ── 1. Fix name: LEMON → MELON ───────────────────────────────
UPDATE public.inventory_items
  SET item_name='CAPTAIN MORGAN MELON 250ML', description='CAPTAIN MORGAN MELON 250ML', last_updated=NOW()
  WHERE sku='412';

UPDATE public.inventory_items
  SET item_name='CAPTAIN MORGAN MELON 750ML', description='CAPTAIN MORGAN MELON 750ML', last_updated=NOW()
  WHERE sku='413';

-- Move them from DRY GOODS to bar_store so they appear in branch storekeeper bar inventory
UPDATE public.inventory_items
  SET category='UDV', store_type='bar_store', last_updated=NOW()
  WHERE sku IN ('412','413');

-- ── 2. Link Manyatta Can → MANYATTA bottle stock (SKU 196) ──
UPDATE public.bar_drinks
  SET linked_inventory_sku='196'
  WHERE sku='FGB-CAN-0008' AND branch_id=2;

-- ── 3. Link Captain Morgan 3/4 Melon → SKU 413 ───────────────
UPDATE public.bar_drinks
  SET linked_inventory_sku='413'
  WHERE sku='FGB-WHK-0036' AND branch_id=2;

-- ── 4. Add missing bar items to inventory ────────────────────
INSERT INTO public.inventory_items
  (sku, item_name, description, category, store_type, default_unit_cost, unit, quantity, is_active)
VALUES
  ('422', 'GUARANA CAN',              'Guarana Canned Drink',              'CANNED BEERS',  'bar_store', 0, 'pcs', 0, true),
  ('423', 'QUARANA PUNCH',            'Quarana Punch Canned Drink',        'CANNED BEERS',  'bar_store', 0, 'pcs', 0, true),
  ('424', 'SAVANNA RASPBERRY TWIST',  'Savanna Raspberry Twist Cider',     'CANNED BEERS',  'bar_store', 0, 'pcs', 0, true),
  ('425', 'ALVARO CAN',               'Alvaro Non-Alcoholic Malt Can',     'CANNED BEERS',  'bar_store', 0, 'pcs', 0, true),
  ('426', 'BULLET BOURBON',           'Bullet Bourbon Whisky',             'WHISKY',        'bar_store', 0, 'pcs', 0, true)
ON CONFLICT (sku) DO UPDATE SET
  item_name=EXCLUDED.item_name, description=EXCLUDED.description,
  category=EXCLUDED.category, store_type=EXCLUDED.store_type,
  is_active=true, last_updated=NOW();

-- ── 5. Register all new items in branch_stock (branch 2) ─────
INSERT INTO public.branch_stock (branch_id, item_sku, quantity, reorder_level, max_stock_level, updated_at)
VALUES
  (2, '412', 0, 5,  50,  NOW()),
  (2, '413', 0, 5,  50,  NOW()),
  (2, '422', 0, 10, 100, NOW()),
  (2, '423', 0, 10, 100, NOW()),
  (2, '424', 0, 10, 100, NOW()),
  (2, '425', 0, 10, 100, NOW()),
  (2, '426', 0, 5,  30,  NOW())
ON CONFLICT (branch_id, item_sku) DO NOTHING;

-- ── 6. Link bar_drinks → inventory ───────────────────────────
UPDATE public.bar_drinks SET linked_inventory_sku='422' WHERE sku='FGB-CAN-0005' AND branch_id=2; -- Guarana
UPDATE public.bar_drinks SET linked_inventory_sku='423' WHERE sku='FGB-CAN-0010' AND branch_id=2; -- Quarana Punch
UPDATE public.bar_drinks SET linked_inventory_sku='424' WHERE sku='FGB-CAN-0011' AND branch_id=2; -- S/Raspberry Twist
UPDATE public.bar_drinks SET linked_inventory_sku='425' WHERE sku='FGB-SDR-0003' AND branch_id=2; -- Alvaro Can
UPDATE public.bar_drinks SET linked_inventory_sku='426' WHERE sku='FGB-OTH-0004' AND branch_id=2; -- Bullet Bourbon
