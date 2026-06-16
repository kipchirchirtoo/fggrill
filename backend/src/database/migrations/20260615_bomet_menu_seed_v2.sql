-- ============================================================
-- FamousGate Bomet Town — Restaurant Menu Seed v2
-- Branch: Bomet Town (branch_id = 2)
-- Idempotent: safe to re-run
-- ============================================================

BEGIN;

ALTER TABLE restaurant_menu_categories ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE restaurant_menu_items ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE restaurant_menu_items ADD COLUMN IF NOT EXISTS item_code VARCHAR(50);
ALTER TABLE restaurant_menu_items ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10, 2);
ALTER TABLE restaurant_menu_items ADD COLUMN IF NOT EXISTS taxable BOOLEAN DEFAULT true;
ALTER TABLE restaurant_menu_items ADD COLUMN IF NOT EXISTS unit VARCHAR(50) DEFAULT 'Portion';
ALTER TABLE restaurant_menu_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_menu_item_code ON restaurant_menu_items(item_code);

DO $$
DECLARE v INT := 2;
c_brk UUID; c_hbv UUID; c_cbv UUID; c_snp UUID; c_bsd UUID;
c_egd UUID; c_swr UUID; c_plt UUID; c_fsh UUID; c_bef UUID;
c_mbz UUID; c_chb UUID; c_kuk UUID; c_spl UUID; c_fst UUID;
BEGIN
INSERT INTO restaurant_menu_categories(name,sort_order,branch_id)VALUES
('Breakfast',1,v),('Hot Beverages',2,v),('Cold Beverages',3,v),('Snacks & Pastries',4,v),
('Breakfast Sides',5,v),('Egg Dishes',6,v),('Sandwiches & Rolls',7,v),('Platters',8,v),
('Fish',9,v),('Beef',10,v),('Mbuzi (Goat Meat)',11,v),('Chicken (Broiler)',12,v),
('Kuku Kienyeji',13,v),('Specials',14,v),('Fast Foods',15,v)
ON CONFLICT DO NOTHING;
SELECT id INTO c_brk FROM restaurant_menu_categories WHERE name='Breakfast' AND branch_id=v;
SELECT id INTO c_hbv FROM restaurant_menu_categories WHERE name='Hot Beverages' AND branch_id=v;
SELECT id INTO c_cbv FROM restaurant_menu_categories WHERE name='Cold Beverages' AND branch_id=v;
SELECT id INTO c_snp FROM restaurant_menu_categories WHERE name='Snacks & Pastries' AND branch_id=v;
SELECT id INTO c_bsd FROM restaurant_menu_categories WHERE name='Breakfast Sides' AND branch_id=v;
SELECT id INTO c_egd FROM restaurant_menu_categories WHERE name='Egg Dishes' AND branch_id=v;
SELECT id INTO c_swr FROM restaurant_menu_categories WHERE name='Sandwiches & Rolls' AND branch_id=v;
SELECT id INTO c_plt FROM restaurant_menu_categories WHERE name='Platters' AND branch_id=v;
SELECT id INTO c_fsh FROM restaurant_menu_categories WHERE name='Fish' AND branch_id=v;
SELECT id INTO c_bef FROM restaurant_menu_categories WHERE name='Beef' AND branch_id=v;
SELECT id INTO c_mbz FROM restaurant_menu_categories WHERE name='Mbuzi (Goat Meat)' AND branch_id=v;
SELECT id INTO c_chb FROM restaurant_menu_categories WHERE name='Chicken (Broiler)' AND branch_id=v;
SELECT id INTO c_kuk FROM restaurant_menu_categories WHERE name='Kuku Kienyeji' AND branch_id=v;
SELECT id INTO c_spl FROM restaurant_menu_categories WHERE name='Specials' AND branch_id=v;
SELECT id INTO c_fst FROM restaurant_menu_categories WHERE name='Fast Foods' AND branch_id=v;

INSERT INTO restaurant_menu_items(category_id,branch_id,name,description,price,item_code,cost_price,taxable,unit,is_active,is_available,preparation_time)VALUES
(c_brk,v,'FG Breakfast','Milk, Ndari, Butternut, Chai',200,'FGH-BRK-0001',NULL,true,'Portion',true,true,15),
(c_brk,v,'FG Special','1 Protein, 1 Snack, 1 Starch, Fruit/Juice',400,'FGH-BRK-0002',NULL,true,'Portion',true,true,20)
ON CONFLICT(item_code)DO UPDATE SET category_id=EXCLUDED.category_id,branch_id=EXCLUDED.branch_id,name=EXCLUDED.name,description=EXCLUDED.description,price=EXCLUDED.price,cost_price=EXCLUDED.cost_price,taxable=EXCLUDED.taxable,unit=EXCLUDED.unit,is_active=EXCLUDED.is_active,is_available=EXCLUDED.is_available,preparation_time=EXCLUDED.preparation_time,updated_at=NOW();

INSERT INTO restaurant_menu_items(category_id,branch_id,name,description,price,item_code,cost_price,taxable,unit,is_active,is_available,preparation_time)VALUES
(c_hbv,v,'Tea Mug',NULL,50,'FGH-HBV-0001',NULL,true,'Portion',true,true,5),
(c_hbv,v,'Tea Pot',NULL,100,'FGH-HBV-0002',NULL,true,'Portion',true,true,5),
(c_hbv,v,'Black Tea',NULL,50,'FGH-HBV-0003',NULL,true,'Portion',true,true,5),
(c_hbv,v,'Lemon Tea',NULL,70,'FGH-HBV-0004',NULL,true,'Portion',true,true,5),
(c_hbv,v,'Lemon Tea Honey',NULL,100,'FGH-HBV-0005',NULL,true,'Portion',true,true,5),
(c_hbv,v,'Lemon Coffee Honey',NULL,100,'FGH-HBV-0006',NULL,true,'Portion',true,true,5),
(c_hbv,v,'Honey Plain',NULL,50,'FGH-HBV-0007',NULL,true,'Portion',true,true,3),
(c_hbv,v,'Ginger Tea',NULL,70,'FGH-HBV-0008',NULL,true,'Portion',true,true,7),
(c_hbv,v,'Dawa',NULL,100,'FGH-HBV-0009',NULL,true,'Portion',true,true,7),
(c_hbv,v,'Cocoa',NULL,70,'FGH-HBV-0010',NULL,true,'Portion',true,true,5),
(c_hbv,v,'Tea Masala',NULL,70,'FGH-HBV-0011',NULL,true,'Portion',true,true,7),
(c_hbv,v,'Hot Lemon',NULL,70,'FGH-HBV-0012',NULL,true,'Portion',true,true,5),
(c_hbv,v,'Special Tea',NULL,100,'FGH-HBV-0013',NULL,true,'Portion',true,true,5),
(c_hbv,v,'White Tea',NULL,70,'FGH-HBV-0014',NULL,true,'Portion',true,true,5),
(c_hbv,v,'White Coffee',NULL,70,'FGH-HBV-0015',NULL,true,'Portion',true,true,5),
(c_hbv,v,'Black Coffee',NULL,50,'FGH-HBV-0016',NULL,true,'Portion',true,true,5),
(c_hbv,v,'Chocolate / Milo',NULL,70,'FGH-HBV-0017',NULL,true,'Portion',true,true,5)
ON CONFLICT(item_code)DO UPDATE SET category_id=EXCLUDED.category_id,branch_id=EXCLUDED.branch_id,name=EXCLUDED.name,description=EXCLUDED.description,price=EXCLUDED.price,cost_price=EXCLUDED.cost_price,taxable=EXCLUDED.taxable,unit=EXCLUDED.unit,is_active=EXCLUDED.is_active,is_available=EXCLUDED.is_available,preparation_time=EXCLUDED.preparation_time,updated_at=NOW();

INSERT INTO restaurant_menu_items(category_id,branch_id,name,description,price,item_code,cost_price,taxable,unit,is_active,is_available,preparation_time)VALUES
(c_cbv,v,'Soda 300ml',NULL,50,'FGH-CBV-0001',NULL,true,'Portion',true,true,1),
(c_cbv,v,'Soda 300ml Take Away',NULL,70,'FGH-CBV-0002',NULL,true,'Portion',true,true,1),
(c_cbv,v,'Water 500ml',NULL,50,'FGH-CBV-0003',NULL,true,'Portion',true,true,1),
(c_cbv,v,'Water 1 Litre',NULL,100,'FGH-CBV-0004',NULL,true,'Portion',true,true,1),
(c_cbv,v,'Fresh Milk Glass',NULL,100,'FGH-CBV-0005',NULL,true,'Portion',true,true,1),
(c_cbv,v,'KCC Milk Packet',NULL,100,'FGH-CBV-0006',NULL,true,'Portion',true,true,1),
(c_cbv,v,'KCC Mala',NULL,100,'FGH-CBV-0007',NULL,true,'Portion',true,true,1),
(c_cbv,v,'Mursik Glass',NULL,100,'FGH-CBV-0008',NULL,true,'Portion',true,true,1),
(c_cbv,v,'Minute Maid 500ml',NULL,100,'FGH-CBV-0009',NULL,true,'Portion',true,true,1),
(c_cbv,v,'Delmonte Juice 1 Litre',NULL,120,'FGH-CBV-0010',NULL,true,'Portion',true,true,1),
(c_cbv,v,'Fresh Juice Passion/Mango',NULL,150,'FGH-CBV-0011',NULL,true,'Portion',true,true,3),
(c_cbv,v,'Milk Shake',NULL,150,'FGH-CBV-0012',NULL,true,'Portion',true,true,3),
(c_cbv,v,'Smoothies',NULL,150,'FGH-CBV-0013',NULL,true,'Portion',true,true,3)
ON CONFLICT(item_code)DO UPDATE SET category_id=EXCLUDED.category_id,branch_id=EXCLUDED.branch_id,name=EXCLUDED.name,description=EXCLUDED.description,price=EXCLUDED.price,cost_price=EXCLUDED.cost_price,taxable=EXCLUDED.taxable,unit=EXCLUDED.unit,is_active=EXCLUDED.is_active,is_available=EXCLUDED.is_available,preparation_time=EXCLUDED.preparation_time,updated_at=NOW();

INSERT INTO restaurant_menu_items(category_id,branch_id,name,description,price,item_code,cost_price,taxable,unit,is_active,is_available,preparation_time)VALUES
(c_snp,v,'Mahamri',NULL,50,'FGH-SNP-0001',NULL,true,'Portion',true,true,5),
(c_snp,v,'Ndazi',NULL,50,'FGH-SNP-0002',NULL,true,'Portion',true,true,5),
(c_snp,v,'Chapati',NULL,50,'FGH-SNP-0003',NULL,true,'Portion',true,true,5),
(c_snp,v,'Brown Chapati',NULL,70,'FGH-SNP-0004',NULL,true,'Portion',true,true,5),
(c_snp,v,'Samosa',NULL,60,'FGH-SNP-0005',NULL,true,'Portion',true,true,5),
(c_snp,v,'Sausage',NULL,70,'FGH-SNP-0006',NULL,true,'Portion',true,true,5),
(c_snp,v,'Pancake',NULL,100,'FGH-SNP-0007',NULL,true,'Portion',true,true,5),
(c_snp,v,'Dried Chapati',NULL,70,'FGH-SNP-0008',NULL,true,'Portion',true,true,5),
(c_snp,v,'Toasted Bread',NULL,50,'FGH-SNP-0009',NULL,true,'Portion',true,true,3),
(c_snp,v,'Corn Flakes',NULL,150,'FGH-SNP-0010',NULL,true,'Portion',true,true,3),
(c_snp,v,'Marble Cake',NULL,100,'FGH-SNP-0011',NULL,true,'Portion',true,true,3),
(c_snp,v,'Half Cake',NULL,50,'FGH-SNP-0012',NULL,true,'Portion',true,true,3),
(c_snp,v,'Cookies Pair',NULL,50,'FGH-SNP-0013',NULL,true,'Portion',true,true,3),
(c_snp,v,'Scones',NULL,70,'FGH-SNP-0014',NULL,true,'Portion',true,true,3),
(c_snp,v,'Queen Cakes',NULL,80,'FGH-SNP-0015',NULL,true,'Portion',true,true,3),
(c_snp,v,'Tea Scones 2 Pieces',NULL,100,'FGH-SNP-0016',NULL,true,'Portion',true,true,3),
(c_snp,v,'Kebab',NULL,100,'FGH-SNP-0017',NULL,true,'Portion',true,true,5)
ON CONFLICT(item_code)DO UPDATE SET category_id=EXCLUDED.category_id,branch_id=EXCLUDED.branch_id,name=EXCLUDED.name,description=EXCLUDED.description,price=EXCLUDED.price,cost_price=EXCLUDED.cost_price,taxable=EXCLUDED.taxable,unit=EXCLUDED.unit,is_active=EXCLUDED.is_active,is_available=EXCLUDED.is_available,preparation_time=EXCLUDED.preparation_time,updated_at=NOW();

INSERT INTO restaurant_menu_items(category_id,branch_id,name,description,price,item_code,cost_price,taxable,unit,is_active,is_available,preparation_time)VALUES
(c_bsd,v,'Porridge',NULL,100,'FGH-BSD-0001',NULL,true,'Portion',true,true,10),
(c_bsd,v,'Sweet Potatoes',NULL,100,'FGH-BSD-0002',NULL,true,'Portion',true,true,10),
(c_bsd,v,'Nduma',NULL,150,'FGH-BSD-0003',NULL,true,'Portion',true,true,10),
(c_bsd,v,'Banana 2 Pieces',NULL,40,'FGH-BSD-0004',NULL,true,'Portion',true,true,1)
ON CONFLICT(item_code)DO UPDATE SET category_id=EXCLUDED.category_id,branch_id=EXCLUDED.branch_id,name=EXCLUDED.name,description=EXCLUDED.description,price=EXCLUDED.price,cost_price=EXCLUDED.cost_price,taxable=EXCLUDED.taxable,unit=EXCLUDED.unit,is_active=EXCLUDED.is_active,is_available=EXCLUDED.is_available,preparation_time=EXCLUDED.preparation_time,updated_at=NOW();

INSERT INTO restaurant_menu_items(category_id,branch_id,name,description,price,item_code,cost_price,taxable,unit,is_active,is_available,preparation_time)VALUES
(c_egd,v,'Scrambled Eggs Kienyeji',NULL,200,'FGH-EGD-0001',NULL,true,'Portion',true,true,8),
(c_egd,v,'Scrambled Eggs Broiler',NULL,100,'FGH-EGD-0002',NULL,true,'Portion',true,true,8),
(c_egd,v,'Spanish Omelette Kienyeji',NULL,200,'FGH-EGD-0003',NULL,true,'Portion',true,true,10),
(c_egd,v,'Spanish Omelette Broiler',NULL,200,'FGH-EGD-0004',NULL,true,'Portion',true,true,10),
(c_egd,v,'Boiled Eggs Broiler',NULL,100,'FGH-EGD-0005',NULL,true,'Portion',true,true,8),
(c_egd,v,'Boiled Eggs Kienyeji',NULL,150,'FGH-EGD-0006',NULL,true,'Portion',true,true,8),
(c_egd,v,'Fried Eggs Broiler',NULL,100,'FGH-EGD-0007',NULL,true,'Portion',true,true,8),
(c_egd,v,'Fried Eggs Kienyeji',NULL,150,'FGH-EGD-0008',NULL,true,'Portion',true,true,8),
(c_egd,v,'Egg Fry Macho',NULL,100,'FGH-EGD-0009',NULL,true,'Portion',true,true,8),
(c_egd,v,'Poached Eggs',NULL,100,'FGH-EGD-0010',NULL,true,'Portion',true,true,10)
ON CONFLICT(item_code)DO UPDATE SET category_id=EXCLUDED.category_id,branch_id=EXCLUDED.branch_id,name=EXCLUDED.name,description=EXCLUDED.description,price=EXCLUDED.price,cost_price=EXCLUDED.cost_price,taxable=EXCLUDED.taxable,unit=EXCLUDED.unit,is_active=EXCLUDED.is_active,is_available=EXCLUDED.is_available,preparation_time=EXCLUDED.preparation_time,updated_at=NOW();

INSERT INTO restaurant_menu_items(category_id,branch_id,name,description,price,item_code,cost_price,taxable,unit,is_active,is_available,preparation_time)VALUES
(c_swr,v,'Egg Sandwich',NULL,150,'FGH-SWR-0001',NULL,true,'Portion',true,true,10),
(c_swr,v,'Vegetable Sandwich',NULL,150,'FGH-SWR-0002',NULL,true,'Portion',true,true,10),
(c_swr,v,'Chapati Roll Broiler',NULL,150,'FGH-SWR-0003',NULL,true,'Portion',true,true,8),
(c_swr,v,'Chapati Roll Kienyeji',NULL,200,'FGH-SWR-0004',NULL,true,'Portion',true,true,8),
(c_swr,v,'French Toast',NULL,100,'FGH-SWR-0005',NULL,true,'Portion',true,true,10)
ON CONFLICT(item_code)DO UPDATE SET category_id=EXCLUDED.category_id,branch_id=EXCLUDED.branch_id,name=EXCLUDED.name,description=EXCLUDED.description,price=EXCLUDED.price,cost_price=EXCLUDED.cost_price,taxable=EXCLUDED.taxable,unit=EXCLUDED.unit,is_active=EXCLUDED.is_active,is_available=EXCLUDED.is_available,preparation_time=EXCLUDED.preparation_time,updated_at=NOW();

INSERT INTO restaurant_menu_items(category_id,branch_id,name,description,price,item_code,cost_price,taxable,unit,is_active,is_available,preparation_time)VALUES
(c_plt,v,'Platter For 2',NULL,1500,'FGH-PLT-0001',NULL,true,'Portion',true,true,30),
(c_plt,v,'Platter For 4',NULL,4000,'FGH-PLT-0002',NULL,true,'Portion',true,true,35),
(c_plt,v,'Platter For 6',NULL,6000,'FGH-PLT-0003',NULL,true,'Portion',true,true,40),
(c_plt,v,'Platter For 9',NULL,9000,'FGH-PLT-0004',NULL,true,'Portion',true,true,45)
ON CONFLICT(item_code)DO UPDATE SET category_id=EXCLUDED.category_id,branch_id=EXCLUDED.branch_id,name=EXCLUDED.name,description=EXCLUDED.description,price=EXCLUDED.price,cost_price=EXCLUDED.cost_price,taxable=EXCLUDED.taxable,unit=EXCLUDED.unit,is_active=EXCLUDED.is_active,is_available=EXCLUDED.is_available,preparation_time=EXCLUDED.preparation_time,updated_at=NOW();

INSERT INTO restaurant_menu_items(category_id,branch_id,name,description,price,item_code,cost_price,taxable,unit,is_active,is_available,preparation_time)VALUES
(c_fsh,v,'Fish Dry Whole',NULL,550,'FGH-FSH-0001',NULL,true,'Portion',true,true,20),
(c_fsh,v,'Fish Wet Whole',NULL,600,'FGH-FSH-0002',NULL,true,'Portion',true,true,20)
ON CONFLICT(item_code)DO UPDATE SET category_id=EXCLUDED.category_id,branch_id=EXCLUDED.branch_id,name=EXCLUDED.name,description=EXCLUDED.description,price=EXCLUDED.price,cost_price=EXCLUDED.cost_price,taxable=EXCLUDED.taxable,unit=EXCLUDED.unit,is_active=EXCLUDED.is_active,is_available=EXCLUDED.is_available,preparation_time=EXCLUDED.preparation_time,updated_at=NOW();

INSERT INTO restaurant_menu_items(category_id,branch_id,name,description,price,item_code,cost_price,taxable,unit,is_active,is_available,preparation_time)VALUES
(c_bef,v,'Beef Stew 1/4 Kg',NULL,400,'FGH-BEF-0001',NULL,true,'Portion',true,true,25),
(c_bef,v,'Beef Stew 1 Kg',NULL,1600,'FGH-BEF-0002',NULL,true,'Portion',true,true,30),
(c_bef,v,'Beef Pan Fry 1/4 Kg',NULL,400,'FGH-BEF-0003',NULL,true,'Portion',true,true,25),
(c_bef,v,'Beef Pan Fry 1/2 Kg',NULL,800,'FGH-BEF-0004',NULL,true,'Portion',true,true,25),
(c_bef,v,'Beef Pan Fry 1 Kg',NULL,1600,'FGH-BEF-0005',NULL,true,'Portion',true,true,30),
(c_bef,v,'Beef Wet Fry 1/4 Kg',NULL,400,'FGH-BEF-0006',NULL,true,'Portion',true,true,25),
(c_bef,v,'Beef Wet Fry 1/2 Kg',NULL,800,'FGH-BEF-0007',NULL,true,'Portion',true,true,25),
(c_bef,v,'Beef Wet Fry 1 Kg',NULL,1600,'FGH-BEF-0008',NULL,true,'Portion',true,true,30)
ON CONFLICT(item_code)DO UPDATE SET category_id=EXCLUDED.category_id,branch_id=EXCLUDED.branch_id,name=EXCLUDED.name,description=EXCLUDED.description,price=EXCLUDED.price,cost_price=EXCLUDED.cost_price,taxable=EXCLUDED.taxable,unit=EXCLUDED.unit,is_active=EXCLUDED.is_active,is_available=EXCLUDED.is_available,preparation_time=EXCLUDED.preparation_time,updated_at=NOW();

INSERT INTO restaurant_menu_items(category_id,branch_id,name,description,price,item_code,cost_price,taxable,unit,is_active,is_available,preparation_time)VALUES
(c_mbz,v,'Mbuzi Wet Fry 1/4 Kg',NULL,350,'FGH-MBZ-0001',NULL,true,'Portion',true,true,35),
(c_mbz,v,'Mbuzi Wet Fry 1/2 Kg',NULL,700,'FGH-MBZ-0002',NULL,true,'Portion',true,true,35),
(c_mbz,v,'Mbuzi Wet Fry 1 Kg',NULL,1400,'FGH-MBZ-0003',NULL,true,'Portion',true,true,40),
(c_mbz,v,'Mbuzi Pan Fry 1/4 Kg',NULL,350,'FGH-MBZ-0004',NULL,true,'Portion',true,true,35),
(c_mbz,v,'Mbuzi Pan Fry 1/2 Kg',NULL,700,'FGH-MBZ-0005',NULL,true,'Portion',true,true,35),
(c_mbz,v,'Mbuzi Pan Fry 1 Kg',NULL,1400,'FGH-MBZ-0006',NULL,true,'Portion',true,true,40),
(c_mbz,v,'Mbuzi Choma 1/4 Kg',NULL,350,'FGH-MBZ-0007',NULL,true,'Portion',true,true,40),
(c_mbz,v,'Mbuzi Choma 1/2 Kg',NULL,700,'FGH-MBZ-0008',NULL,true,'Portion',true,true,40),
(c_mbz,v,'Mbuzi Choma 1 Kg',NULL,1400,'FGH-MBZ-0009',NULL,true,'Portion',true,true,45),
(c_mbz,v,'Mbuzi Boiled 1/4 Kg',NULL,350,'FGH-MBZ-0010',NULL,true,'Portion',true,true,35),
(c_mbz,v,'Mbuzi Boiled 1/2 Kg',NULL,700,'FGH-MBZ-0011',NULL,true,'Portion',true,true,35),
(c_mbz,v,'Mbuzi Boiled 1 Kg',NULL,1400,'FGH-MBZ-0012',NULL,true,'Portion',true,true,40)
ON CONFLICT(item_code)DO UPDATE SET category_id=EXCLUDED.category_id,branch_id=EXCLUDED.branch_id,name=EXCLUDED.name,description=EXCLUDED.description,price=EXCLUDED.price,cost_price=EXCLUDED.cost_price,taxable=EXCLUDED.taxable,unit=EXCLUDED.unit,is_active=EXCLUDED.is_active,is_available=EXCLUDED.is_available,preparation_time=EXCLUDED.preparation_time,updated_at=NOW();

INSERT INTO restaurant_menu_items(category_id,branch_id,name,description,price,item_code,cost_price,taxable,unit,is_active,is_available,preparation_time)VALUES
(c_chb,v,'1/4 Kg Chicken Wet Fry',NULL,400,'FGH-CHB-0001',NULL,true,'Portion',true,true,30),
(c_chb,v,'1/2 Kg Chicken Wet Fry',NULL,800,'FGH-CHB-0002',NULL,true,'Portion',true,true,30),
(c_chb,v,'1 Kg Chicken Wet Fry',NULL,1600,'FGH-CHB-0003',NULL,true,'Portion',true,true,35),
(c_chb,v,'1/4 Kg Chicken Pan Fry',NULL,400,'FGH-CHB-0004',NULL,true,'Portion',true,true,30),
(c_chb,v,'1/2 Kg Chicken Pan Fry',NULL,800,'FGH-CHB-0005',NULL,true,'Portion',true,true,30),
(c_chb,v,'1 Kg Chicken Pan Fry',NULL,1600,'FGH-CHB-0006',NULL,true,'Portion',true,true,35),
(c_chb,v,'1/4 Kg Chicken Choma',NULL,400,'FGH-CHB-0007',NULL,true,'Portion',true,true,35),
(c_chb,v,'1/2 Kg Chicken Choma',NULL,800,'FGH-CHB-0008',NULL,true,'Portion',true,true,35),
(c_chb,v,'1 Kg Chicken Choma',NULL,1600,'FGH-CHB-0009',NULL,true,'Portion',true,true,40),
(c_chb,v,'1/4 Kg Chicken Boiled',NULL,400,'FGH-CHB-0010',NULL,true,'Portion',true,true,30),
(c_chb,v,'1/2 Kg Chicken Boiled',NULL,800,'FGH-CHB-0011',NULL,true,'Portion',true,true,30),
(c_chb,v,'1 Kg Chicken Boiled',NULL,1600,'FGH-CHB-0012',NULL,true,'Portion',true,true,35)
ON CONFLICT(item_code)DO UPDATE SET category_id=EXCLUDED.category_id,branch_id=EXCLUDED.branch_id,name=EXCLUDED.name,description=EXCLUDED.description,price=EXCLUDED.price,cost_price=EXCLUDED.cost_price,taxable=EXCLUDED.taxable,unit=EXCLUDED.unit,is_active=EXCLUDED.is_active,is_available=EXCLUDED.is_available,preparation_time=EXCLUDED.preparation_time,updated_at=NOW();

INSERT INTO restaurant_menu_items(category_id,branch_id,name,description,price,item_code,cost_price,taxable,unit,is_active,is_available,preparation_time)VALUES
(c_kuk,v,'1/4 Kg Kuku Kienyeji Wet Fry',NULL,500,'FGH-KUK-0001',NULL,true,'Portion',true,true,35),
(c_kuk,v,'1/2 Kg Kuku Kienyeji Wet Fry',NULL,1000,'FGH-KUK-0002',NULL,true,'Portion',true,true,35),
(c_kuk,v,'1 Kg Kuku Kienyeji Wet Fry',NULL,2000,'FGH-KUK-0003',NULL,true,'Portion',true,true,40),
(c_kuk,v,'1/4 Kg Kuku Kienyeji Pan Fry',NULL,500,'FGH-KUK-0004',NULL,true,'Portion',true,true,35),
(c_kuk,v,'1/2 Kg Kuku Kienyeji Pan Fry',NULL,1000,'FGH-KUK-0005',NULL,true,'Portion',true,true,35),
(c_kuk,v,'1 Kg Kuku Kienyeji Pan Fry',NULL,2000,'FGH-KUK-0006',NULL,true,'Portion',true,true,40),
(c_kuk,v,'1/4 Kg Kuku Kienyeji Choma',NULL,500,'FGH-KUK-0007',NULL,true,'Portion',true,true,40),
(c_kuk,v,'1/2 Kg Kuku Kienyeji Choma',NULL,1000,'FGH-KUK-0008',NULL,true,'Portion',true,true,40),
(c_kuk,v,'1 Kg Kuku Kienyeji Choma',NULL,2000,'FGH-KUK-0009',NULL,true,'Portion',true,true,45),
(c_kuk,v,'1/4 Kg Kuku Kienyeji Boiled',NULL,500,'FGH-KUK-0010',NULL,true,'Portion',true,true,35),
(c_kuk,v,'1/2 Kg Kuku Kienyeji Boiled',NULL,1000,'FGH-KUK-0011',NULL,true,'Portion',true,true,35),
(c_kuk,v,'1 Kg Kuku Kienyeji Boiled',NULL,2000,'FGH-KUK-0012',NULL,true,'Portion',true,true,40)
ON CONFLICT(item_code)DO UPDATE SET category_id=EXCLUDED.category_id,branch_id=EXCLUDED.branch_id,name=EXCLUDED.name,description=EXCLUDED.description,price=EXCLUDED.price,cost_price=EXCLUDED.cost_price,taxable=EXCLUDED.taxable,unit=EXCLUDED.unit,is_active=EXCLUDED.is_active,is_available=EXCLUDED.is_available,preparation_time=EXCLUDED.preparation_time,updated_at=NOW();

INSERT INTO restaurant_menu_items(category_id,branch_id,name,description,price,item_code,cost_price,taxable,unit,is_active,is_available,preparation_time)VALUES
(c_spl,v,'Chicken Wings',NULL,300,'FGH-SPL-0001',NULL,true,'Portion',true,true,20),
(c_spl,v,'Chicken Gizzards',NULL,300,'FGH-SPL-0002',NULL,true,'Portion',true,true,20),
(c_spl,v,'Chicken Liver',NULL,300,'FGH-SPL-0003',NULL,true,'Portion',true,true,20),
(c_spl,v,'Chicken Drumsticks',NULL,300,'FGH-SPL-0004',NULL,true,'Portion',true,true,20)
ON CONFLICT(item_code)DO UPDATE SET category_id=EXCLUDED.category_id,branch_id=EXCLUDED.branch_id,name=EXCLUDED.name,description=EXCLUDED.description,price=EXCLUDED.price,cost_price=EXCLUDED.cost_price,taxable=EXCLUDED.taxable,unit=EXCLUDED.unit,is_active=EXCLUDED.is_active,is_available=EXCLUDED.is_available,preparation_time=EXCLUDED.preparation_time,updated_at=NOW();

INSERT INTO restaurant_menu_items(category_id,branch_id,name,description,price,item_code,cost_price,taxable,unit,is_active,is_available,preparation_time)VALUES
(c_fst,v,'Chips',NULL,150,'FGH-FST-0001',NULL,true,'Portion',true,true,15),
(c_fst,v,'Chips Chicken',NULL,350,'FGH-FST-0002',NULL,true,'Portion',true,true,20),
(c_fst,v,'Chips Sausage',NULL,250,'FGH-FST-0003',NULL,true,'Portion',true,true,15),
(c_fst,v,'Chips Kebab',NULL,300,'FGH-FST-0004',NULL,true,'Portion',true,true,15),
(c_fst,v,'Chips Gizzard',NULL,300,'FGH-FST-0005',NULL,true,'Portion',true,true,20),
(c_fst,v,'Chips Liver',NULL,300,'FGH-FST-0006',NULL,true,'Portion',true,true,20),
(c_fst,v,'Burger',NULL,300,'FGH-FST-0007',NULL,true,'Portion',true,true,15),
(c_fst,v,'Hotdog',NULL,200,'FGH-FST-0008',NULL,true,'Portion',true,true,10),
(c_fst,v,'Smokie',NULL,50,'FGH-FST-0009',NULL,true,'Portion',true,true,3)
ON CONFLICT(item_code)DO UPDATE SET category_id=EXCLUDED.category_id,branch_id=EXCLUDED.branch_id,name=EXCLUDED.name,description=EXCLUDED.description,price=EXCLUDED.price,cost_price=EXCLUDED.cost_price,taxable=EXCLUDED.taxable,unit=EXCLUDED.unit,is_active=EXCLUDED.is_active,is_available=EXCLUDED.is_available,preparation_time=EXCLUDED.preparation_time,updated_at=NOW();

END $$;
COMMIT;
