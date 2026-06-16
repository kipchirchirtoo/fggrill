-- ============================================================
-- 0026_bomet_menu_seed.sql
-- FamousGate Bomet Town (branch_id = 2) — Restaurant Menu
-- Corrected from 20260615_bomet_menu_seed_v2.sql:
--   price       → selling_price
--   item_code   → sku
--   taxable, preparation_time columns removed (don't exist)
-- Idempotent: safe to re-run.
-- ============================================================

-- Ensure unique indexes exist for ON CONFLICT to work
CREATE UNIQUE INDEX IF NOT EXISTS uq_menu_categories_name_branch
  ON public.restaurant_menu_categories (name, branch_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_menu_items_sku
  ON public.restaurant_menu_items (sku);

DO $$
DECLARE
  v   INT := 2;
  c_brk UUID; c_hbv UUID; c_cbv UUID; c_snp UUID; c_bsd UUID;
  c_egd UUID; c_swr UUID; c_plt UUID; c_fsh UUID; c_bef UUID;
  c_mbz UUID; c_chb UUID; c_kuk UUID; c_spl UUID; c_fst UUID;
BEGIN

-- ── Categories ────────────────────────────────────────────────
INSERT INTO public.restaurant_menu_categories (name, branch_id, sort_order, is_active) VALUES
  ('Breakfast',          v,  1, true),
  ('Hot Beverages',      v,  2, true),
  ('Cold Beverages',     v,  3, true),
  ('Snacks & Pastries',  v,  4, true),
  ('Breakfast Sides',    v,  5, true),
  ('Egg Dishes',         v,  6, true),
  ('Sandwiches & Rolls', v,  7, true),
  ('Platters',           v,  8, true),
  ('Fish',               v,  9, true),
  ('Beef',               v, 10, true),
  ('Mbuzi (Goat Meat)',  v, 11, true),
  ('Chicken (Broiler)',  v, 12, true),
  ('Kuku Kienyeji',      v, 13, true),
  ('Specials',           v, 14, true),
  ('Fast Foods',         v, 15, true)
ON CONFLICT (name, branch_id) DO NOTHING;

SELECT id INTO c_brk FROM public.restaurant_menu_categories WHERE name='Breakfast'          AND branch_id=v;
SELECT id INTO c_hbv FROM public.restaurant_menu_categories WHERE name='Hot Beverages'      AND branch_id=v;
SELECT id INTO c_cbv FROM public.restaurant_menu_categories WHERE name='Cold Beverages'     AND branch_id=v;
SELECT id INTO c_snp FROM public.restaurant_menu_categories WHERE name='Snacks & Pastries'  AND branch_id=v;
SELECT id INTO c_bsd FROM public.restaurant_menu_categories WHERE name='Breakfast Sides'    AND branch_id=v;
SELECT id INTO c_egd FROM public.restaurant_menu_categories WHERE name='Egg Dishes'         AND branch_id=v;
SELECT id INTO c_swr FROM public.restaurant_menu_categories WHERE name='Sandwiches & Rolls' AND branch_id=v;
SELECT id INTO c_plt FROM public.restaurant_menu_categories WHERE name='Platters'           AND branch_id=v;
SELECT id INTO c_fsh FROM public.restaurant_menu_categories WHERE name='Fish'               AND branch_id=v;
SELECT id INTO c_bef FROM public.restaurant_menu_categories WHERE name='Beef'               AND branch_id=v;
SELECT id INTO c_mbz FROM public.restaurant_menu_categories WHERE name='Mbuzi (Goat Meat)'  AND branch_id=v;
SELECT id INTO c_chb FROM public.restaurant_menu_categories WHERE name='Chicken (Broiler)'  AND branch_id=v;
SELECT id INTO c_kuk FROM public.restaurant_menu_categories WHERE name='Kuku Kienyeji'      AND branch_id=v;
SELECT id INTO c_spl FROM public.restaurant_menu_categories WHERE name='Specials'           AND branch_id=v;
SELECT id INTO c_fst FROM public.restaurant_menu_categories WHERE name='Fast Foods'         AND branch_id=v;

-- ── Breakfast ─────────────────────────────────────────────────
INSERT INTO public.restaurant_menu_items (category_id,branch_id,name,description,selling_price,sku,unit,is_active,is_available) VALUES
  (c_brk,v,'FG Breakfast',   'Milk, Ndari, Butternut, Chai',              200,'FGH-BRK-0001','Portion',true,true),
  (c_brk,v,'FG Special',     '1 Protein, 1 Snack, 1 Starch, Fruit/Juice', 400,'FGH-BRK-0002','Portion',true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, description=EXCLUDED.description,
  selling_price=EXCLUDED.selling_price, unit=EXCLUDED.unit,
  is_active=EXCLUDED.is_active, is_available=EXCLUDED.is_available, updated_at=NOW();

-- ── Hot Beverages ─────────────────────────────────────────────
INSERT INTO public.restaurant_menu_items (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
  (c_hbv,v,'Tea Mug',              50,'FGH-HBV-0001','Portion',true,true),
  (c_hbv,v,'Tea Pot',             100,'FGH-HBV-0002','Portion',true,true),
  (c_hbv,v,'Black Tea',            50,'FGH-HBV-0003','Portion',true,true),
  (c_hbv,v,'Lemon Tea',            70,'FGH-HBV-0004','Portion',true,true),
  (c_hbv,v,'Lemon Tea Honey',     100,'FGH-HBV-0005','Portion',true,true),
  (c_hbv,v,'Lemon Coffee Honey',  100,'FGH-HBV-0006','Portion',true,true),
  (c_hbv,v,'Honey Plain',          50,'FGH-HBV-0007','Portion',true,true),
  (c_hbv,v,'Ginger Tea',           70,'FGH-HBV-0008','Portion',true,true),
  (c_hbv,v,'Dawa',                100,'FGH-HBV-0009','Portion',true,true),
  (c_hbv,v,'Cocoa',                70,'FGH-HBV-0010','Portion',true,true),
  (c_hbv,v,'Tea Masala',           70,'FGH-HBV-0011','Portion',true,true),
  (c_hbv,v,'Hot Lemon',            70,'FGH-HBV-0012','Portion',true,true),
  (c_hbv,v,'Special Tea',         100,'FGH-HBV-0013','Portion',true,true),
  (c_hbv,v,'White Tea',            70,'FGH-HBV-0014','Portion',true,true),
  (c_hbv,v,'White Coffee',         70,'FGH-HBV-0015','Portion',true,true),
  (c_hbv,v,'Black Coffee',         50,'FGH-HBV-0016','Portion',true,true),
  (c_hbv,v,'Chocolate / Milo',     70,'FGH-HBV-0017','Portion',true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, selling_price=EXCLUDED.selling_price,
  is_active=EXCLUDED.is_active, is_available=EXCLUDED.is_available, updated_at=NOW();

-- ── Cold Beverages ────────────────────────────────────────────
INSERT INTO public.restaurant_menu_items (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
  (c_cbv,v,'Soda 300ml',               50,'FGH-CBV-0001','Portion',true,true),
  (c_cbv,v,'Soda 300ml Take Away',      70,'FGH-CBV-0002','Portion',true,true),
  (c_cbv,v,'Water 500ml',               50,'FGH-CBV-0003','Portion',true,true),
  (c_cbv,v,'Water 1 Litre',            100,'FGH-CBV-0004','Portion',true,true),
  (c_cbv,v,'Fresh Milk Glass',         100,'FGH-CBV-0005','Portion',true,true),
  (c_cbv,v,'KCC Milk Packet',          100,'FGH-CBV-0006','Portion',true,true),
  (c_cbv,v,'KCC Mala',                 100,'FGH-CBV-0007','Portion',true,true),
  (c_cbv,v,'Mursik Glass',             100,'FGH-CBV-0008','Portion',true,true),
  (c_cbv,v,'Minute Maid 500ml',        100,'FGH-CBV-0009','Portion',true,true),
  (c_cbv,v,'Delmonte Juice 1 Litre',   120,'FGH-CBV-0010','Portion',true,true),
  (c_cbv,v,'Fresh Juice Passion/Mango',150,'FGH-CBV-0011','Portion',true,true),
  (c_cbv,v,'Milk Shake',               150,'FGH-CBV-0012','Portion',true,true),
  (c_cbv,v,'Smoothies',                150,'FGH-CBV-0013','Portion',true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, selling_price=EXCLUDED.selling_price,
  is_active=EXCLUDED.is_active, is_available=EXCLUDED.is_available, updated_at=NOW();

-- ── Snacks & Pastries ─────────────────────────────────────────
INSERT INTO public.restaurant_menu_items (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
  (c_snp,v,'Mahamri',            50,'FGH-SNP-0001','Portion',true,true),
  (c_snp,v,'Ndazi',              50,'FGH-SNP-0002','Portion',true,true),
  (c_snp,v,'Chapati',            50,'FGH-SNP-0003','Portion',true,true),
  (c_snp,v,'Brown Chapati',      70,'FGH-SNP-0004','Portion',true,true),
  (c_snp,v,'Samosa',             60,'FGH-SNP-0005','Portion',true,true),
  (c_snp,v,'Sausage',            70,'FGH-SNP-0006','Portion',true,true),
  (c_snp,v,'Pancake',           100,'FGH-SNP-0007','Portion',true,true),
  (c_snp,v,'Dried Chapati',      70,'FGH-SNP-0008','Portion',true,true),
  (c_snp,v,'Toasted Bread',      50,'FGH-SNP-0009','Portion',true,true),
  (c_snp,v,'Corn Flakes',       150,'FGH-SNP-0010','Portion',true,true),
  (c_snp,v,'Marble Cake',       100,'FGH-SNP-0011','Portion',true,true),
  (c_snp,v,'Half Cake',          50,'FGH-SNP-0012','Portion',true,true),
  (c_snp,v,'Cookies Pair',       50,'FGH-SNP-0013','Portion',true,true),
  (c_snp,v,'Scones',             70,'FGH-SNP-0014','Portion',true,true),
  (c_snp,v,'Queen Cakes',        80,'FGH-SNP-0015','Portion',true,true),
  (c_snp,v,'Tea Scones 2 Pieces',100,'FGH-SNP-0016','Portion',true,true),
  (c_snp,v,'Kebab',             100,'FGH-SNP-0017','Portion',true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, selling_price=EXCLUDED.selling_price,
  is_active=EXCLUDED.is_active, is_available=EXCLUDED.is_available, updated_at=NOW();

-- ── Breakfast Sides ───────────────────────────────────────────
INSERT INTO public.restaurant_menu_items (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
  (c_bsd,v,'Porridge',          100,'FGH-BSD-0001','Portion',true,true),
  (c_bsd,v,'Sweet Potatoes',    100,'FGH-BSD-0002','Portion',true,true),
  (c_bsd,v,'Nduma',             150,'FGH-BSD-0003','Portion',true,true),
  (c_bsd,v,'Banana 2 Pieces',    40,'FGH-BSD-0004','Portion',true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, selling_price=EXCLUDED.selling_price,
  is_active=EXCLUDED.is_active, is_available=EXCLUDED.is_available, updated_at=NOW();

-- ── Egg Dishes ────────────────────────────────────────────────
INSERT INTO public.restaurant_menu_items (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
  (c_egd,v,'Scrambled Eggs Kienyeji',    200,'FGH-EGD-0001','Portion',true,true),
  (c_egd,v,'Scrambled Eggs Broiler',     100,'FGH-EGD-0002','Portion',true,true),
  (c_egd,v,'Spanish Omelette Kienyeji',  200,'FGH-EGD-0003','Portion',true,true),
  (c_egd,v,'Spanish Omelette Broiler',   200,'FGH-EGD-0004','Portion',true,true),
  (c_egd,v,'Boiled Eggs Broiler',        100,'FGH-EGD-0005','Portion',true,true),
  (c_egd,v,'Boiled Eggs Kienyeji',       150,'FGH-EGD-0006','Portion',true,true),
  (c_egd,v,'Fried Eggs Broiler',         100,'FGH-EGD-0007','Portion',true,true),
  (c_egd,v,'Fried Eggs Kienyeji',        150,'FGH-EGD-0008','Portion',true,true),
  (c_egd,v,'Egg Fry Macho',             100,'FGH-EGD-0009','Portion',true,true),
  (c_egd,v,'Poached Eggs',              100,'FGH-EGD-0010','Portion',true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, selling_price=EXCLUDED.selling_price,
  is_active=EXCLUDED.is_active, is_available=EXCLUDED.is_available, updated_at=NOW();

-- ── Sandwiches & Rolls ────────────────────────────────────────
INSERT INTO public.restaurant_menu_items (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
  (c_swr,v,'Egg Sandwich',            150,'FGH-SWR-0001','Portion',true,true),
  (c_swr,v,'Vegetable Sandwich',      150,'FGH-SWR-0002','Portion',true,true),
  (c_swr,v,'Chapati Roll Broiler',    150,'FGH-SWR-0003','Portion',true,true),
  (c_swr,v,'Chapati Roll Kienyeji',   200,'FGH-SWR-0004','Portion',true,true),
  (c_swr,v,'French Toast',            100,'FGH-SWR-0005','Portion',true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, selling_price=EXCLUDED.selling_price,
  is_active=EXCLUDED.is_active, is_available=EXCLUDED.is_available, updated_at=NOW();

-- ── Platters ──────────────────────────────────────────────────
INSERT INTO public.restaurant_menu_items (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
  (c_plt,v,'Platter For 2',1500,'FGH-PLT-0001','Portion',true,true),
  (c_plt,v,'Platter For 4',4000,'FGH-PLT-0002','Portion',true,true),
  (c_plt,v,'Platter For 6',6000,'FGH-PLT-0003','Portion',true,true),
  (c_plt,v,'Platter For 9',9000,'FGH-PLT-0004','Portion',true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, selling_price=EXCLUDED.selling_price,
  is_active=EXCLUDED.is_active, is_available=EXCLUDED.is_available, updated_at=NOW();

-- ── Fish ──────────────────────────────────────────────────────
INSERT INTO public.restaurant_menu_items (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
  (c_fsh,v,'Fish Dry Whole',550,'FGH-FSH-0001','Portion',true,true),
  (c_fsh,v,'Fish Wet Whole',600,'FGH-FSH-0002','Portion',true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, selling_price=EXCLUDED.selling_price,
  is_active=EXCLUDED.is_active, is_available=EXCLUDED.is_available, updated_at=NOW();

-- ── Beef ──────────────────────────────────────────────────────
INSERT INTO public.restaurant_menu_items (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
  (c_bef,v,'Beef Stew 1/4 Kg',   400,'FGH-BEF-0001','Portion',true,true),
  (c_bef,v,'Beef Stew 1 Kg',    1600,'FGH-BEF-0002','Portion',true,true),
  (c_bef,v,'Beef Pan Fry 1/4 Kg', 400,'FGH-BEF-0003','Portion',true,true),
  (c_bef,v,'Beef Pan Fry 1/2 Kg', 800,'FGH-BEF-0004','Portion',true,true),
  (c_bef,v,'Beef Pan Fry 1 Kg', 1600,'FGH-BEF-0005','Portion',true,true),
  (c_bef,v,'Beef Wet Fry 1/4 Kg', 400,'FGH-BEF-0006','Portion',true,true),
  (c_bef,v,'Beef Wet Fry 1/2 Kg', 800,'FGH-BEF-0007','Portion',true,true),
  (c_bef,v,'Beef Wet Fry 1 Kg', 1600,'FGH-BEF-0008','Portion',true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, selling_price=EXCLUDED.selling_price,
  is_active=EXCLUDED.is_active, is_available=EXCLUDED.is_available, updated_at=NOW();

-- ── Mbuzi (Goat Meat) ─────────────────────────────────────────
INSERT INTO public.restaurant_menu_items (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
  (c_mbz,v,'Mbuzi Wet Fry 1/4 Kg',   350,'FGH-MBZ-0001','Portion',true,true),
  (c_mbz,v,'Mbuzi Wet Fry 1/2 Kg',   700,'FGH-MBZ-0002','Portion',true,true),
  (c_mbz,v,'Mbuzi Wet Fry 1 Kg',    1400,'FGH-MBZ-0003','Portion',true,true),
  (c_mbz,v,'Mbuzi Pan Fry 1/4 Kg',   350,'FGH-MBZ-0004','Portion',true,true),
  (c_mbz,v,'Mbuzi Pan Fry 1/2 Kg',   700,'FGH-MBZ-0005','Portion',true,true),
  (c_mbz,v,'Mbuzi Pan Fry 1 Kg',    1400,'FGH-MBZ-0006','Portion',true,true),
  (c_mbz,v,'Mbuzi Choma 1/4 Kg',     350,'FGH-MBZ-0007','Portion',true,true),
  (c_mbz,v,'Mbuzi Choma 1/2 Kg',     700,'FGH-MBZ-0008','Portion',true,true),
  (c_mbz,v,'Mbuzi Choma 1 Kg',      1400,'FGH-MBZ-0009','Portion',true,true),
  (c_mbz,v,'Mbuzi Boiled 1/4 Kg',    350,'FGH-MBZ-0010','Portion',true,true),
  (c_mbz,v,'Mbuzi Boiled 1/2 Kg',    700,'FGH-MBZ-0011','Portion',true,true),
  (c_mbz,v,'Mbuzi Boiled 1 Kg',     1400,'FGH-MBZ-0012','Portion',true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, selling_price=EXCLUDED.selling_price,
  is_active=EXCLUDED.is_active, is_available=EXCLUDED.is_available, updated_at=NOW();

-- ── Chicken (Broiler) ─────────────────────────────────────────
INSERT INTO public.restaurant_menu_items (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
  (c_chb,v,'1/4 Kg Chicken Wet Fry',   400,'FGH-CHB-0001','Portion',true,true),
  (c_chb,v,'1/2 Kg Chicken Wet Fry',   800,'FGH-CHB-0002','Portion',true,true),
  (c_chb,v,'1 Kg Chicken Wet Fry',    1600,'FGH-CHB-0003','Portion',true,true),
  (c_chb,v,'1/4 Kg Chicken Pan Fry',   400,'FGH-CHB-0004','Portion',true,true),
  (c_chb,v,'1/2 Kg Chicken Pan Fry',   800,'FGH-CHB-0005','Portion',true,true),
  (c_chb,v,'1 Kg Chicken Pan Fry',    1600,'FGH-CHB-0006','Portion',true,true),
  (c_chb,v,'1/4 Kg Chicken Choma',     400,'FGH-CHB-0007','Portion',true,true),
  (c_chb,v,'1/2 Kg Chicken Choma',     800,'FGH-CHB-0008','Portion',true,true),
  (c_chb,v,'1 Kg Chicken Choma',      1600,'FGH-CHB-0009','Portion',true,true),
  (c_chb,v,'1/4 Kg Chicken Boiled',    400,'FGH-CHB-0010','Portion',true,true),
  (c_chb,v,'1/2 Kg Chicken Boiled',    800,'FGH-CHB-0011','Portion',true,true),
  (c_chb,v,'1 Kg Chicken Boiled',     1600,'FGH-CHB-0012','Portion',true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, selling_price=EXCLUDED.selling_price,
  is_active=EXCLUDED.is_active, is_available=EXCLUDED.is_available, updated_at=NOW();

-- ── Kuku Kienyeji ─────────────────────────────────────────────
INSERT INTO public.restaurant_menu_items (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
  (c_kuk,v,'1/4 Kg Kuku Kienyeji Wet Fry',   500,'FGH-KUK-0001','Portion',true,true),
  (c_kuk,v,'1/2 Kg Kuku Kienyeji Wet Fry',  1000,'FGH-KUK-0002','Portion',true,true),
  (c_kuk,v,'1 Kg Kuku Kienyeji Wet Fry',    2000,'FGH-KUK-0003','Portion',true,true),
  (c_kuk,v,'1/4 Kg Kuku Kienyeji Pan Fry',   500,'FGH-KUK-0004','Portion',true,true),
  (c_kuk,v,'1/2 Kg Kuku Kienyeji Pan Fry',  1000,'FGH-KUK-0005','Portion',true,true),
  (c_kuk,v,'1 Kg Kuku Kienyeji Pan Fry',    2000,'FGH-KUK-0006','Portion',true,true),
  (c_kuk,v,'1/4 Kg Kuku Kienyeji Choma',     500,'FGH-KUK-0007','Portion',true,true),
  (c_kuk,v,'1/2 Kg Kuku Kienyeji Choma',    1000,'FGH-KUK-0008','Portion',true,true),
  (c_kuk,v,'1 Kg Kuku Kienyeji Choma',      2000,'FGH-KUK-0009','Portion',true,true),
  (c_kuk,v,'1/4 Kg Kuku Kienyeji Boiled',    500,'FGH-KUK-0010','Portion',true,true),
  (c_kuk,v,'1/2 Kg Kuku Kienyeji Boiled',   1000,'FGH-KUK-0011','Portion',true,true),
  (c_kuk,v,'1 Kg Kuku Kienyeji Boiled',     2000,'FGH-KUK-0012','Portion',true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, selling_price=EXCLUDED.selling_price,
  is_active=EXCLUDED.is_active, is_available=EXCLUDED.is_available, updated_at=NOW();

-- ── Specials ──────────────────────────────────────────────────
INSERT INTO public.restaurant_menu_items (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
  (c_spl,v,'Chicken Wings',     300,'FGH-SPL-0001','Portion',true,true),
  (c_spl,v,'Chicken Gizzards',  300,'FGH-SPL-0002','Portion',true,true),
  (c_spl,v,'Chicken Liver',     300,'FGH-SPL-0003','Portion',true,true),
  (c_spl,v,'Chicken Drumsticks',300,'FGH-SPL-0004','Portion',true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, selling_price=EXCLUDED.selling_price,
  is_active=EXCLUDED.is_active, is_available=EXCLUDED.is_available, updated_at=NOW();

-- ── Fast Foods ────────────────────────────────────────────────
INSERT INTO public.restaurant_menu_items (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
  (c_fst,v,'Chips',          150,'FGH-FST-0001','Portion',true,true),
  (c_fst,v,'Chips Chicken',  350,'FGH-FST-0002','Portion',true,true),
  (c_fst,v,'Chips Sausage',  250,'FGH-FST-0003','Portion',true,true),
  (c_fst,v,'Chips Kebab',    300,'FGH-FST-0004','Portion',true,true),
  (c_fst,v,'Chips Gizzard',  300,'FGH-FST-0005','Portion',true,true),
  (c_fst,v,'Chips Liver',    300,'FGH-FST-0006','Portion',true,true),
  (c_fst,v,'Burger',         300,'FGH-FST-0007','Portion',true,true),
  (c_fst,v,'Hotdog',         200,'FGH-FST-0008','Portion',true,true),
  (c_fst,v,'Smokie',          50,'FGH-FST-0009','Portion',true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, selling_price=EXCLUDED.selling_price,
  is_active=EXCLUDED.is_active, is_available=EXCLUDED.is_available, updated_at=NOW();

END $$;
