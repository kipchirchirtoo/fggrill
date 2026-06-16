-- ============================================================
-- 0033_bomet_bar_menu_seed.sql
-- FamousGate Bomet Town (branch_id = 2) — Bar Menu
-- Tables: bar_drink_categories, bar_drinks
-- Idempotent: safe to re-run.
-- ============================================================

-- Unique indexes needed for ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS uq_bar_drink_categories_name_branch
  ON public.bar_drink_categories (name, branch_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bar_drinks_sku
  ON public.bar_drinks (sku);

DO $$
DECLARE
  v   INT := 2;
  c_sdr UUID; c_ber UUID; c_can UUID; c_spr UUID;
  c_whk UUID; c_win UUID; c_cog UUID; c_enr UUID; c_oth UUID;
BEGIN

-- ── Categories ────────────────────────────────────────────────
INSERT INTO public.bar_drink_categories (name, branch_id, sort_order, is_active) VALUES
  ('Soft Drinks',   v,  1, true),
  ('Beers',         v,  2, true),
  ('Canned Beers',  v,  3, true),
  ('Spirits',       v,  4, true),
  ('Whisky',        v,  5, true),
  ('Wines',         v,  6, true),
  ('Cognac',        v,  7, true),
  ('Energy Drinks', v,  8, true),
  ('Others',        v,  9, true)
ON CONFLICT (name, branch_id) DO NOTHING;

SELECT id INTO c_sdr FROM public.bar_drink_categories WHERE name='Soft Drinks'   AND branch_id=v;
SELECT id INTO c_ber FROM public.bar_drink_categories WHERE name='Beers'         AND branch_id=v;
SELECT id INTO c_can FROM public.bar_drink_categories WHERE name='Canned Beers'  AND branch_id=v;
SELECT id INTO c_spr FROM public.bar_drink_categories WHERE name='Spirits'       AND branch_id=v;
SELECT id INTO c_whk FROM public.bar_drink_categories WHERE name='Whisky'        AND branch_id=v;
SELECT id INTO c_win FROM public.bar_drink_categories WHERE name='Wines'         AND branch_id=v;
SELECT id INTO c_cog FROM public.bar_drink_categories WHERE name='Cognac'        AND branch_id=v;
SELECT id INTO c_enr FROM public.bar_drink_categories WHERE name='Energy Drinks' AND branch_id=v;
SELECT id INTO c_oth FROM public.bar_drink_categories WHERE name='Others'        AND branch_id=v;

-- ── Soft Drinks ───────────────────────────────────────────────
INSERT INTO public.bar_drinks (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
  (c_sdr,v,'Soda 500ml',      100,'FGB-SDR-0001','bottle',true,true),
  (c_sdr,v,'H2O 1L',          100,'FGB-SDR-0002','bottle',true,true),
  (c_sdr,v,'Alvaro Can',      200,'FGB-SDR-0003','can',   true,true),
  (c_sdr,v,'Delmonte',        350,'FGB-SDR-0004','bottle',true,true),
  (c_sdr,v,'Lemonade',        100,'FGB-SDR-0005','bottle',true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, selling_price=EXCLUDED.selling_price,
  unit=EXCLUDED.unit, is_active=EXCLUDED.is_active,
  is_available=EXCLUDED.is_available, updated_at=NOW();

-- ── Beers ─────────────────────────────────────────────────────
INSERT INTO public.bar_drinks (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
  (c_ber,v,'T. Larger',        250,'FGB-BER-0001','bottle',true,true),
  (c_ber,v,'T. Cider',         300,'FGB-BER-0002','bottle',true,true),
  (c_ber,v,'T. Lite',          250,'FGB-BER-0003','bottle',true,true),
  (c_ber,v,'T. Malt',          250,'FGB-BER-0004','bottle',true,true),
  (c_ber,v,'Guiness',          300,'FGB-BER-0005','bottle',true,true),
  (c_ber,v,'Balozi',           250,'FGB-BER-0006','bottle',true,true),
  (c_ber,v,'Black Ice',        250,'FGB-BER-0007','bottle',true,true),
  (c_ber,v,'Snapp',            250,'FGB-BER-0008','bottle',true,true),
  (c_ber,v,'Pilsner',          250,'FGB-BER-0009','bottle',true,true),
  (c_ber,v,'Manyatta',         300,'FGB-BER-0010','bottle',true,true),
  (c_ber,v,'Desparado',        350,'FGB-BER-0011','bottle',true,true),
  (c_ber,v,'Hunters Beer',     300,'FGB-BER-0012','bottle',true,true),
  (c_ber,v,'White Cap',        250,'FGB-BER-0013','bottle',true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, selling_price=EXCLUDED.selling_price,
  unit=EXCLUDED.unit, is_active=EXCLUDED.is_active,
  is_available=EXCLUDED.is_available, updated_at=NOW();

-- ── Canned Beers ──────────────────────────────────────────────
INSERT INTO public.bar_drinks (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
  (c_can,v,'Guiness Can',         300,'FGB-CAN-0001','can',true,true),
  (c_can,v,'T. Can',              300,'FGB-CAN-0002','can',true,true),
  (c_can,v,'W. Cap Can',          270,'FGB-CAN-0003','can',true,true),
  (c_can,v,'Black Ice Can',       250,'FGB-CAN-0004','can',true,true),
  (c_can,v,'Guarana',             250,'FGB-CAN-0005','can',true,true),
  (c_can,v,'T. Lite Can',         300,'FGB-CAN-0006','can',true,true),
  (c_can,v,'T. Cider Can',        300,'FGB-CAN-0007','can',true,true),
  (c_can,v,'Manyatta Can',        300,'FGB-CAN-0008','can',true,true),
  (c_can,v,'Snapp Can',           250,'FGB-CAN-0009','can',true,true),
  (c_can,v,'Quarana Punch',       250,'FGB-CAN-0010','can',true,true),
  (c_can,v,'S/Raspberry Twist',   250,'FGB-CAN-0011','can',true,true),
  (c_can,v,'Gordons Can',         300,'FGB-CAN-0012','can',true,true),
  (c_can,v,'Faxe Can',            400,'FGB-CAN-0013','can',true,true),
  (c_can,v,'Balozi Can',          270,'FGB-CAN-0014','can',true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, selling_price=EXCLUDED.selling_price,
  unit=EXCLUDED.unit, is_active=EXCLUDED.is_active,
  is_available=EXCLUDED.is_available, updated_at=NOW();

-- ── Spirits ───────────────────────────────────────────────────
INSERT INTO public.bar_drinks (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
  (c_spr,v,'KC 1/4',          500, 'FGB-SPR-0001','bottle',true,true),
  (c_spr,v,'KC 1/2',          700, 'FGB-SPR-0002','bottle',true,true),
  (c_spr,v,'KC 3/4',         1300, 'FGB-SPR-0003','bottle',true,true),
  (c_spr,v,'Vodka 1/4',       600, 'FGB-SPR-0004','bottle',true,true),
  (c_spr,v,'Vodka 1/2',       800, 'FGB-SPR-0005','bottle',true,true),
  (c_spr,v,'Vodka 3/4',      1700, 'FGB-SPR-0006','bottle',true,true),
  (c_spr,v,'Richot 1/4',      600, 'FGB-SPR-0007','bottle',true,true),
  (c_spr,v,'Richot 1/2',      800, 'FGB-SPR-0008','bottle',true,true),
  (c_spr,v,'Richot 3/4',     1700, 'FGB-SPR-0009','bottle',true,true),
  (c_spr,v,'Gilbeys 1/4',     600, 'FGB-SPR-0010','bottle',true,true),
  (c_spr,v,'Gilbeys 1/2',     850, 'FGB-SPR-0011','bottle',true,true),
  (c_spr,v,'Gilbeys 3/4',    1700, 'FGB-SPR-0012','bottle',true,true),
  (c_spr,v,'Viceroy 1/4',     650, 'FGB-SPR-0013','bottle',true,true),
  (c_spr,v,'Viceroy 1/2',     900, 'FGB-SPR-0014','bottle',true,true),
  (c_spr,v,'Viceroy 3/4',    1800, 'FGB-SPR-0015','bottle',true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, selling_price=EXCLUDED.selling_price,
  unit=EXCLUDED.unit, is_active=EXCLUDED.is_active,
  is_available=EXCLUDED.is_available, updated_at=NOW();

-- ── Whisky ────────────────────────────────────────────────────
INSERT INTO public.bar_drinks (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
  (c_whk,v,'B/Whisky 3/4',              1300, 'FGB-WHK-0001','bottle',true,true),
  (c_whk,v,'B/Cream 750ml',             1500, 'FGB-WHK-0002','bottle',true,true),
  (c_whk,v,'All Seasons 3/4',           1500, 'FGB-WHK-0003','bottle',true,true),
  (c_whk,v,'VAT 69 1/2',               1100, 'FGB-WHK-0004','bottle',true,true),
  (c_whk,v,'VAT 69 3/4',               1900, 'FGB-WHK-0005','bottle',true,true),
  (c_whk,v,'Bond 7 1/4',                600, 'FGB-WHK-0006','bottle',true,true),
  (c_whk,v,'Bond 7 1/2',                800, 'FGB-WHK-0007','bottle',true,true),
  (c_whk,v,'Bond 7 3/4',               1700, 'FGB-WHK-0008','bottle',true,true),
  (c_whk,v,'Grants 3/4',               2500, 'FGB-WHK-0009','bottle',true,true),
  (c_whk,v,'Grants 1L',                3000, 'FGB-WHK-0010','bottle',true,true),
  (c_whk,v,'Red Label 1/4',            1000, 'FGB-WHK-0011','bottle',true,true),
  (c_whk,v,'Red Label 1/2',            1300, 'FGB-WHK-0012','bottle',true,true),
  (c_whk,v,'Red Label 3/4',            2500, 'FGB-WHK-0013','bottle',true,true),
  (c_whk,v,'Red Label 1L',             3000, 'FGB-WHK-0014','bottle',true,true),
  (c_whk,v,'Black Label 1/2',          2100, 'FGB-WHK-0015','bottle',true,true),
  (c_whk,v,'Black Label 3/4',          4000, 'FGB-WHK-0016','bottle',true,true),
  (c_whk,v,'Black Label 1L',           5000, 'FGB-WHK-0017','bottle',true,true),
  (c_whk,v,'JW Blonde',                3000, 'FGB-WHK-0018','bottle',true,true),
  (c_whk,v,'Hunters 1/4',              500,  'FGB-WHK-0019','bottle',true,true),
  (c_whk,v,'Hunters 1/2',              700,  'FGB-WHK-0020','bottle',true,true),
  (c_whk,v,'Hunters 3/4',             1300,  'FGB-WHK-0021','bottle',true,true),
  (c_whk,v,'B&S 1/2',                  800,  'FGB-WHK-0022','bottle',true,true),
  (c_whk,v,'B&S 3/4',                 1500,  'FGB-WHK-0023','bottle',true,true),
  (c_whk,v,'Savanna',                   350,  'FGB-WHK-0024','bottle',true,true),
  (c_whk,v,'Tang 10',                  6000,  'FGB-WHK-0025','bottle',true,true),
  (c_whk,v,'Gordons 1/2',             1200,  'FGB-WHK-0026','bottle',true,true),
  (c_whk,v,'Gordons 3/4',             2500,  'FGB-WHK-0027','bottle',true,true),
  (c_whk,v,'JD 1/2',                  2400,  'FGB-WHK-0028','bottle',true,true),
  (c_whk,v,'JD 3/4',                  4000,  'FGB-WHK-0029','bottle',true,true),
  (c_whk,v,'JD 1L',                   5000,  'FGB-WHK-0030','bottle',true,true),
  (c_whk,v,'Jameson 1/2',             1600,  'FGB-WHK-0031','bottle',true,true),
  (c_whk,v,'Jameson 3/4',             3200,  'FGB-WHK-0032','bottle',true,true),
  (c_whk,v,'Jameson 1L',              4000,  'FGB-WHK-0033','bottle',true,true),
  (c_whk,v,'Captain Morgan 1/4',       500,  'FGB-WHK-0034','bottle',true,true),
  (c_whk,v,'Captain Morgan 3/4',      1300,  'FGB-WHK-0035','bottle',true,true),
  (c_whk,v,'Captain Morgan 3/4 Melon',1500,  'FGB-WHK-0036','bottle',true,true),
  (c_whk,v,'Famous Grouse',           2500,  'FGB-WHK-0037','bottle',true,true),
  (c_whk,v,'William Lawsons 1/2',     1000,  'FGB-WHK-0038','bottle',true,true),
  (c_whk,v,'William Lawsons 3/4',     2100,  'FGB-WHK-0039','bottle',true,true),
  (c_whk,v,'William Lawsons 1L',      3000,  'FGB-WHK-0040','bottle',true,true),
  (c_whk,v,'V&A 1/4',                  400,  'FGB-WHK-0041','bottle',true,true),
  (c_whk,v,'V&A 3/4',                 1200,  'FGB-WHK-0042','bottle',true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, selling_price=EXCLUDED.selling_price,
  unit=EXCLUDED.unit, is_active=EXCLUDED.is_active,
  is_available=EXCLUDED.is_available, updated_at=NOW();

-- ── Wines ─────────────────────────────────────────────────────
INSERT INTO public.bar_drinks (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
  (c_win,v,'Cellar Cask',      1400,'FGB-WIN-0001','bottle',true,true),
  (c_win,v,'Heineken',          350,'FGB-WIN-0002','bottle',true,true),
  (c_win,v,'4th Street',       1300,'FGB-WIN-0003','bottle',true,true),
  (c_win,v,'Casabuena',        1100,'FGB-WIN-0004','bottle',true,true),
  (c_win,v,'Caprice',          1100,'FGB-WIN-0005','bottle',true,true),
  (c_win,v,'Four Cousins',     1200,'FGB-WIN-0006','bottle',true,true),
  (c_win,v,'Kingfisher',        300,'FGB-WIN-0007','bottle',true,true),
  (c_win,v,'Amarula 1/2',      1600,'FGB-WIN-0008','bottle',true,true),
  (c_win,v,'Amarula 3/4',      2500,'FGB-WIN-0009','bottle',true,true),
  (c_win,v,'Baileys 1/2',      1600,'FGB-WIN-0010','bottle',true,true),
  (c_win,v,'Baileys 3/4',      2800,'FGB-WIN-0011','bottle',true,true),
  (c_win,v,'Asconi',           2000,'FGB-WIN-0012','bottle',true,true),
  (c_win,v,'Drotdy',           1300,'FGB-WIN-0013','bottle',true,true),
  (c_win,v,'Robertson',        2000,'FGB-WIN-0014','bottle',true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, selling_price=EXCLUDED.selling_price,
  unit=EXCLUDED.unit, is_active=EXCLUDED.is_active,
  is_available=EXCLUDED.is_available, updated_at=NOW();

-- ── Cognac ────────────────────────────────────────────────────
INSERT INTO public.bar_drinks (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
  (c_cog,v,'Hennessy 750ml',      6500,'FGB-COG-0001','bottle',true,true),
  (c_cog,v,'Double Black 1L',     7500,'FGB-COG-0002','bottle',true,true),
  (c_cog,v,'Martel VS',           8500,'FGB-COG-0003','bottle',true,true),
  (c_cog,v,'Martel VSOP',        13000,'FGB-COG-0004','bottle',true,true),
  (c_cog,v,'Singletone 12YRS',    6000,'FGB-COG-0005','bottle',true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, selling_price=EXCLUDED.selling_price,
  unit=EXCLUDED.unit, is_active=EXCLUDED.is_active,
  is_available=EXCLUDED.is_available, updated_at=NOW();

-- ── Energy Drinks ─────────────────────────────────────────────
INSERT INTO public.bar_drinks (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
  (c_enr,v,'Redbull',   300,'FGB-ENR-0001','can',true,true),
  (c_enr,v,'Monster',   350,'FGB-ENR-0002','can',true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, selling_price=EXCLUDED.selling_price,
  unit=EXCLUDED.unit, is_active=EXCLUDED.is_active,
  is_available=EXCLUDED.is_available, updated_at=NOW();

-- ── Others ────────────────────────────────────────────────────
INSERT INTO public.bar_drinks (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
  (c_oth,v,'Camino',          4000,'FGB-OTH-0001','bottle',true,true),
  (c_oth,v,'Jagermeister',    4000,'FGB-OTH-0002','bottle',true,true),
  (c_oth,v,'Sheridans',       6000,'FGB-OTH-0003','bottle',true,true),
  (c_oth,v,'Bullet Bourbon',  5000,'FGB-OTH-0004','bottle',true,true),
  (c_oth,v,'Trust Classic',     50,'FGB-OTH-0005','piece', true,true),
  (c_oth,v,'Trust Studded',    100,'FGB-OTH-0006','piece', true,true),
  (c_oth,v,'Pool Tokens',       50,'FGB-OTH-0007','piece', true,true)
ON CONFLICT (sku) DO UPDATE SET
  category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id,
  name=EXCLUDED.name, selling_price=EXCLUDED.selling_price,
  unit=EXCLUDED.unit, is_active=EXCLUDED.is_active,
  is_available=EXCLUDED.is_available, updated_at=NOW();

END $$;
