-- ============================================================
-- 0044_sotik_bar_menu_seed.sql
-- FamousGate Sotik (branch_id = 4) — Main Bar Menu
-- Source: FG_Hotels_Bar_Menu_Price_List_260630_190647.pdf (price list
-- only — no opening stock counts, so all items start at current_stock=0,
-- same as Bomet's seed pattern; storekeeper enters real quantities later).
-- Tables: bar_drink_categories, bar_drinks, pos_outlet_items
-- Idempotent: safe to re-run.
--
-- NOTE: a few entries in the source PDF were ambiguous or had OCR/extract
-- artifacts; resolved as follows (flagged for the user to verify):
--   - "Gordon's Dry Gin" (no size given, 2,500) -> assumed 750ml.
--   - "Captain 1/4" -> normalized to "Captain Morgan 1/4" (same brand as
--     "Captain Morgan 3/4" elsewhere on the sheet).
--   - Bottled vs canned duplicates (Tusker Lager, Tusker Cider, White Cap,
--     Tusker Lite, Tusker Malt, Pilsner, Balozi, Snapp, Guinness) are kept
--     as separate items; the canned ones are suffixed "Can" so staff don't
--     see two identically-named items with different prices at checkout.
-- ============================================================

DO $$
DECLARE
  v   INT := 4;
  v_outlet_id UUID;
  c_brc UUID; c_vod UUID; c_spr UUID; c_whk UUID; c_crm UUID;
  c_win UUID; c_rum UUID; c_oth UUID; c_bev UUID; c_btl UUID;
  c_can UUID; c_mix UUID; c_gin UUID;
BEGIN

  SELECT id INTO v_outlet_id
  FROM public.pos_outlets
  WHERE branch_id = v AND outlet_type = 'main_bar'
  LIMIT 1;

  IF v_outlet_id IS NULL THEN
    RAISE EXCEPTION 'No main_bar outlet found for branch_id=%', v;
  END IF;

  -- ── Categories ────────────────────────────────────────────────
  INSERT INTO public.bar_drink_categories (name, branch_id, sort_order, is_active) VALUES
    ('Brandy/Cognac', v,  1, true),
    ('Vodka',         v,  2, true),
    ('Spirits',       v,  3, true),
    ('Whisky',        v,  4, true),
    ('Cream',         v,  5, true),
    ('Wine',          v,  6, true),
    ('Rum',           v,  7, true),
    ('Other',         v,  8, true),
    ('Beverages',     v,  9, true),
    ('Beer - Bottled',v, 10, true),
    ('Canned Beer',   v, 11, true),
    ('Mixtures',      v, 12, true),
    ('Gin',           v, 13, true)
  ON CONFLICT (name, branch_id) DO NOTHING;

  SELECT id INTO c_brc FROM public.bar_drink_categories WHERE name='Brandy/Cognac'   AND branch_id=v;
  SELECT id INTO c_vod FROM public.bar_drink_categories WHERE name='Vodka'           AND branch_id=v;
  SELECT id INTO c_spr FROM public.bar_drink_categories WHERE name='Spirits'         AND branch_id=v;
  SELECT id INTO c_whk FROM public.bar_drink_categories WHERE name='Whisky'          AND branch_id=v;
  SELECT id INTO c_crm FROM public.bar_drink_categories WHERE name='Cream'           AND branch_id=v;
  SELECT id INTO c_win FROM public.bar_drink_categories WHERE name='Wine'            AND branch_id=v;
  SELECT id INTO c_rum FROM public.bar_drink_categories WHERE name='Rum'             AND branch_id=v;
  SELECT id INTO c_oth FROM public.bar_drink_categories WHERE name='Other'           AND branch_id=v;
  SELECT id INTO c_bev FROM public.bar_drink_categories WHERE name='Beverages'       AND branch_id=v;
  SELECT id INTO c_btl FROM public.bar_drink_categories WHERE name='Beer - Bottled'  AND branch_id=v;
  SELECT id INTO c_can FROM public.bar_drink_categories WHERE name='Canned Beer'     AND branch_id=v;
  SELECT id INTO c_mix FROM public.bar_drink_categories WHERE name='Mixtures'        AND branch_id=v;
  SELECT id INTO c_gin FROM public.bar_drink_categories WHERE name='Gin'             AND branch_id=v;

  -- ── Brandy / Cognac ───────────────────────────────────────────
  INSERT INTO public.bar_drinks (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
    (c_brc,v,'Viceroy 1/4',        600,'FGB-STK-BRC-0001','bottle',true,true),
    (c_brc,v,'Viceroy 1/2',        900,'FGB-STK-BRC-0002','bottle',true,true),
    (c_brc,v,'Viceroy 750 ml',    1800,'FGB-STK-BRC-0003','bottle',true,true),
    (c_brc,v,'Viceroy 10 Yrs',    4000,'FGB-STK-BRC-0004','bottle',true,true),
    (c_brc,v,'Richot 1/4',         600,'FGB-STK-BRC-0005','bottle',true,true),
    (c_brc,v,'Richot 1/2',         800,'FGB-STK-BRC-0006','bottle',true,true),
    (c_brc,v,'Richot 750 ml',     1800,'FGB-STK-BRC-0007','bottle',true,true),
    (c_brc,v,'Robertson',         1800,'FGB-STK-BRC-0008','bottle',true,true)
  ON CONFLICT (sku) DO UPDATE SET
    category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id, name=EXCLUDED.name,
    selling_price=EXCLUDED.selling_price, unit=EXCLUDED.unit, is_active=EXCLUDED.is_active,
    is_available=EXCLUDED.is_available, updated_at=NOW();

  -- ── Vodka ─────────────────────────────────────────────────────
  INSERT INTO public.bar_drinks (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
    (c_vod,v,'Vodka 250 ml',       600,'FGB-STK-VOD-0001','bottle',true,true),
    (c_vod,v,'Vodka 350 ml',       800,'FGB-STK-VOD-0002','bottle',true,true),
    (c_vod,v,'Vodka 750 ml',      1700,'FGB-STK-VOD-0003','bottle',true,true)
  ON CONFLICT (sku) DO UPDATE SET
    category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id, name=EXCLUDED.name,
    selling_price=EXCLUDED.selling_price, unit=EXCLUDED.unit, is_active=EXCLUDED.is_active,
    is_available=EXCLUDED.is_available, updated_at=NOW();

  -- ── Spirits ───────────────────────────────────────────────────
  INSERT INTO public.bar_drinks (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
    (c_spr,v,'K.C 250 ml',         450,'FGB-STK-SPR-0001','bottle',true,true),
    (c_spr,v,'K.C 350 ml',         700,'FGB-STK-SPR-0002','bottle',true,true),
    (c_spr,v,'K.C 750 ml',        1200,'FGB-STK-SPR-0003','bottle',true,true),
    (c_spr,v,'Popov 250 ml',       350,'FGB-STK-SPR-0004','bottle',true,true)
  ON CONFLICT (sku) DO UPDATE SET
    category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id, name=EXCLUDED.name,
    selling_price=EXCLUDED.selling_price, unit=EXCLUDED.unit, is_active=EXCLUDED.is_active,
    is_available=EXCLUDED.is_available, updated_at=NOW();

  -- ── Whisky ────────────────────────────────────────────────────
  INSERT INTO public.bar_drinks (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
    (c_whk,v,'Jameson 1/2',               1600,'FGB-STK-WHK-0001','bottle',true,true),
    (c_whk,v,'Jameson 750 ml',            3000,'FGB-STK-WHK-0002','bottle',true,true),
    (c_whk,v,'VAT 69 1/2',                1000,'FGB-STK-WHK-0003','bottle',true,true),
    (c_whk,v,'VAT 69 750 ml',             2000,'FGB-STK-WHK-0004','bottle',true,true),
    (c_whk,v,'J.W Red 250 ml',             800,'FGB-STK-WHK-0005','bottle',true,true),
    (c_whk,v,'J.W Red 375 ml',            1700,'FGB-STK-WHK-0006','bottle',true,true),
    (c_whk,v,'J.W Red 750 ml',            2500,'FGB-STK-WHK-0007','bottle',true,true),
    (c_whk,v,'J.W Red 1 Ltr',             3000,'FGB-STK-WHK-0008','bottle',true,true),
    (c_whk,v,'J.W Black 250 ml',          1300,'FGB-STK-WHK-0009','bottle',true,true),
    (c_whk,v,'J.W Black 1/2',             2200,'FGB-STK-WHK-0010','bottle',true,true),
    (c_whk,v,'J.W Black 750 ml',          4500,'FGB-STK-WHK-0011','bottle',true,true),
    (c_whk,v,'J.W Black 1 Ltr',           5500,'FGB-STK-WHK-0012','bottle',true,true),
    (c_whk,v,'J.W Blonde 750 ml',         3000,'FGB-STK-WHK-0013','bottle',true,true),
    (c_whk,v,'J.W Black Green Label 1 L', 7500,'FGB-STK-WHK-0014','bottle',true,true),
    (c_whk,v,'Bond 7 1/4',                 600,'FGB-STK-WHK-0015','bottle',true,true),
    (c_whk,v,'Bond 7 1/2',                 800,'FGB-STK-WHK-0016','bottle',true,true),
    (c_whk,v,'Bond 7 3/4',                1700,'FGB-STK-WHK-0017','bottle',true,true),
    (c_whk,v,'Best Whisky 1/4',            500,'FGB-STK-WHK-0018','bottle',true,true),
    (c_whk,v,'Best Whisky 3/4',           1400,'FGB-STK-WHK-0019','bottle',true,true),
    (c_whk,v,'Famous Grouse 3/4',         2500,'FGB-STK-WHK-0020','bottle',true,true),
    (c_whk,v,'Glenfiddich 12 Yrs',        7500,'FGB-STK-WHK-0021','bottle',true,true),
    (c_whk,v,'Glenfiddich 15 Yrs',        7500,'FGB-STK-WHK-0022','bottle',true,true),
    (c_whk,v,'Hennessy',                  7500,'FGB-STK-WHK-0023','bottle',true,true),
    (c_whk,v,'Hennessy VSOP',             8500,'FGB-STK-WHK-0024','bottle',true,true),
    (c_whk,v,'Martell',                   8500,'FGB-STK-WHK-0025','bottle',true,true),
    (c_whk,v,'Martell VSOP',             12500,'FGB-STK-WHK-0026','bottle',true,true),
    (c_whk,v,'Jack Daniels 350 ml',       2500,'FGB-STK-WHK-0027','bottle',true,true),
    (c_whk,v,'Jack Daniels 750 ml',       4500,'FGB-STK-WHK-0028','bottle',true,true),
    (c_whk,v,'Jack Daniels 1 Ltr',        5300,'FGB-STK-WHK-0029','bottle',true,true),
    (c_whk,v,'Double Black 750 ml',       5800,'FGB-STK-WHK-0030','bottle',true,true),
    (c_whk,v,'Double Black 1 Ltr',        7000,'FGB-STK-WHK-0031','bottle',true,true),
    (c_whk,v,'All Seasons 3/4',           1400,'FGB-STK-WHK-0032','bottle',true,true),
    (c_whk,v,'William Lawsons 3/4',       2200,'FGB-STK-WHK-0033','bottle',true,true),
    (c_whk,v,'William Lawsons 1 Ltr',     3200,'FGB-STK-WHK-0034','bottle',true,true),
    (c_whk,v,'Grants 1/2',                1600,'FGB-STK-WHK-0035','bottle',true,true),
    (c_whk,v,'Grants 3/4',                2500,'FGB-STK-WHK-0036','bottle',true,true),
    (c_whk,v,'Grants 1 Ltr',              3200,'FGB-STK-WHK-0037','bottle',true,true),
    (c_whk,v,'Black & White 1/2',          800,'FGB-STK-WHK-0038','bottle',true,true),
    (c_whk,v,'Black & White 3/4',         1500,'FGB-STK-WHK-0039','bottle',true,true),
    (c_whk,v,'Hunters 1/4',                500,'FGB-STK-WHK-0040','bottle',true,true),
    (c_whk,v,'Hunters 1/2',                700,'FGB-STK-WHK-0041','bottle',true,true),
    (c_whk,v,'Hunters 3/4',               1300,'FGB-STK-WHK-0042','bottle',true,true),
    (c_whk,v,'J&B 750 ml',                2400,'FGB-STK-WHK-0043','bottle',true,true),
    (c_whk,v,'Singleton 12 Yrs',          6500,'FGB-STK-WHK-0044','bottle',true,true),
    (c_whk,v,'Singleton 15 Yrs',          8500,'FGB-STK-WHK-0045','bottle',true,true),
    (c_whk,v,'Tang 10',                   5300,'FGB-STK-WHK-0046','bottle',true,true)
  ON CONFLICT (sku) DO UPDATE SET
    category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id, name=EXCLUDED.name,
    selling_price=EXCLUDED.selling_price, unit=EXCLUDED.unit, is_active=EXCLUDED.is_active,
    is_available=EXCLUDED.is_available, updated_at=NOW();

  -- ── Cream ─────────────────────────────────────────────────────
  INSERT INTO public.bar_drinks (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
    (c_crm,v,'Amarula 1/2',       1800,'FGB-STK-CRM-0001','bottle',true,true),
    (c_crm,v,'Amarula 750 ml',    3000,'FGB-STK-CRM-0002','bottle',true,true),
    (c_crm,v,'Best Cream',        1400,'FGB-STK-CRM-0003','bottle',true,true),
    (c_crm,v,'Baileys 1/2',       1800,'FGB-STK-CRM-0004','bottle',true,true),
    (c_crm,v,'Baileys 750 ml',    3000,'FGB-STK-CRM-0005','bottle',true,true),
    (c_crm,v,'V&A 1/4',            400,'FGB-STK-CRM-0006','bottle',true,true),
    (c_crm,v,'V&A 750 ml',        1200,'FGB-STK-CRM-0007','bottle',true,true)
  ON CONFLICT (sku) DO UPDATE SET
    category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id, name=EXCLUDED.name,
    selling_price=EXCLUDED.selling_price, unit=EXCLUDED.unit, is_active=EXCLUDED.is_active,
    is_available=EXCLUDED.is_available, updated_at=NOW();

  -- ── Wine ──────────────────────────────────────────────────────
  INSERT INTO public.bar_drinks (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
    (c_win,v,'4th Street',        1200,'FGB-STK-WIN-0001','bottle',true,true),
    (c_win,v,'Cellar Cask',       1200,'FGB-STK-WIN-0002','bottle',true,true),
    (c_win,v,'Drostdy-Hof',       1200,'FGB-STK-WIN-0003','bottle',true,true),
    (c_win,v,'Chamdor 3/4',       1000,'FGB-STK-WIN-0004','bottle',true,true),
    (c_win,v,'Caprice Pkt',       1300,'FGB-STK-WIN-0005','bottle',true,true),
    (c_win,v,'Four Cousins',      1400,'FGB-STK-WIN-0006','bottle',true,true),
    (c_win,v,'Asconi',            1400,'FGB-STK-WIN-0007','bottle',true,true),
    (c_win,v,'Asconi 750 ml',     2000,'FGB-STK-WIN-0008','bottle',true,true),
    (c_win,v,'Casabuena 1 Ltr',   1300,'FGB-STK-WIN-0009','bottle',true,true),
    (c_win,v,'Jager',             6600,'FGB-STK-WIN-0010','bottle',true,true),
    (c_win,v,'Camino',            4600,'FGB-STK-WIN-0011','bottle',true,true),
    (c_win,v,'Jager Tot',          200,'FGB-STK-WIN-0012','tot',   true,true),
    (c_win,v,'Camino Tot',         200,'FGB-STK-WIN-0013','tot',   true,true)
  ON CONFLICT (sku) DO UPDATE SET
    category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id, name=EXCLUDED.name,
    selling_price=EXCLUDED.selling_price, unit=EXCLUDED.unit, is_active=EXCLUDED.is_active,
    is_available=EXCLUDED.is_available, updated_at=NOW();

  -- ── Rum ───────────────────────────────────────────────────────
  INSERT INTO public.bar_drinks (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
    (c_rum,v,'Captain Morgan 3/4', 1400,'FGB-STK-RUM-0001','bottle',true,true),
    (c_rum,v,'Captain Morgan 1/4',  500,'FGB-STK-RUM-0002','bottle',true,true)
  ON CONFLICT (sku) DO UPDATE SET
    category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id, name=EXCLUDED.name,
    selling_price=EXCLUDED.selling_price, unit=EXCLUDED.unit, is_active=EXCLUDED.is_active,
    is_available=EXCLUDED.is_available, updated_at=NOW();

  -- ── Other ─────────────────────────────────────────────────────
  INSERT INTO public.bar_drinks (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
    (c_oth,v,'Trust Studded',      100,'FGB-STK-OTH-0001','piece',true,true),
    (c_oth,v,'Trust Kiss',         100,'FGB-STK-OTH-0002','piece',true,true),
    (c_oth,v,'Trust Classic',       80,'FGB-STK-OTH-0003','piece',true,true)
  ON CONFLICT (sku) DO UPDATE SET
    category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id, name=EXCLUDED.name,
    selling_price=EXCLUDED.selling_price, unit=EXCLUDED.unit, is_active=EXCLUDED.is_active,
    is_available=EXCLUDED.is_available, updated_at=NOW();

  -- ── Beverages ─────────────────────────────────────────────────
  INSERT INTO public.bar_drinks (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
    (c_bev,v,'Soda 300 ml',         70,'FGB-STK-BEV-0001','bottle',true,true),
    (c_bev,v,'Soda 500 ml',        100,'FGB-STK-BEV-0002','bottle',true,true),
    (c_bev,v,'Coke Zero',          100,'FGB-STK-BEV-0003','bottle',true,true),
    (c_bev,v,'Novida',              80,'FGB-STK-BEV-0004','bottle',true,true),
    (c_bev,v,'Dasani 1/2',          50,'FGB-STK-BEV-0005','bottle',true,true),
    (c_bev,v,'Dasani 1 Ltr',       100,'FGB-STK-BEV-0006','bottle',true,true),
    (c_bev,v,'Minute Maid',        100,'FGB-STK-BEV-0007','bottle',true,true),
    (c_bev,v,'Predator',           100,'FGB-STK-BEV-0008','bottle',true,true),
    (c_bev,v,'Monster',            350,'FGB-STK-BEV-0009','can',   true,true),
    (c_bev,v,'Tonic Soda',         120,'FGB-STK-BEV-0010','bottle',true,true),
    (c_bev,v,'Lime Lemonade',      100,'FGB-STK-BEV-0011','bottle',true,true),
    (c_bev,v,'Hunters Gold 250 ml',300,'FGB-STK-BEV-0012','bottle',true,true)
  ON CONFLICT (sku) DO UPDATE SET
    category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id, name=EXCLUDED.name,
    selling_price=EXCLUDED.selling_price, unit=EXCLUDED.unit, is_active=EXCLUDED.is_active,
    is_available=EXCLUDED.is_available, updated_at=NOW();

  -- ── Beer - Bottled ────────────────────────────────────────────
  INSERT INTO public.bar_drinks (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
    (c_btl,v,'Manyatta',           280,'FGB-STK-BTL-0001','bottle',true,true),
    (c_btl,v,'Tusker Cider',       280,'FGB-STK-BTL-0002','bottle',true,true),
    (c_btl,v,'Guinness',           280,'FGB-STK-BTL-0003','bottle',true,true),
    (c_btl,v,'Snapp',              250,'FGB-STK-BTL-0004','bottle',true,true),
    (c_btl,v,'Tusker Lager',       250,'FGB-STK-BTL-0005','bottle',true,true),
    (c_btl,v,'Tusker Lite',        250,'FGB-STK-BTL-0006','bottle',true,true),
    (c_btl,v,'Tusker Malt',        250,'FGB-STK-BTL-0007','bottle',true,true),
    (c_btl,v,'Pilsner Lager',      250,'FGB-STK-BTL-0008','bottle',true,true),
    (c_btl,v,'White Cap Lager',    250,'FGB-STK-BTL-0009','bottle',true,true),
    (c_btl,v,'B. Ice',             250,'FGB-STK-BTL-0010','bottle',true,true),
    (c_btl,v,'Balozi',             250,'FGB-STK-BTL-0011','bottle',true,true),
    (c_btl,v,'Guarana',            250,'FGB-STK-BTL-0012','bottle',true,true)
  ON CONFLICT (sku) DO UPDATE SET
    category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id, name=EXCLUDED.name,
    selling_price=EXCLUDED.selling_price, unit=EXCLUDED.unit, is_active=EXCLUDED.is_active,
    is_available=EXCLUDED.is_available, updated_at=NOW();

  -- ── Canned Beer ───────────────────────────────────────────────
  INSERT INTO public.bar_drinks (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
    (c_can,v,'Guinness Can',       300,'FGB-STK-CAN-0001','can',true,true),
    (c_can,v,'Tusker Cider Can',   300,'FGB-STK-CAN-0002','can',true,true),
    (c_can,v,'Tusker Lager Can',   300,'FGB-STK-CAN-0003','can',true,true),
    (c_can,v,'White Cap Can',      300,'FGB-STK-CAN-0004','can',true,true),
    (c_can,v,'Tusker Lite Can',    300,'FGB-STK-CAN-0005','can',true,true),
    (c_can,v,'Tusker Malt Can',    300,'FGB-STK-CAN-0006','can',true,true),
    (c_can,v,'Pilsner Can',        300,'FGB-STK-CAN-0007','can',true,true),
    (c_can,v,'Balozi Can',         300,'FGB-STK-CAN-0008','can',true,true),
    (c_can,v,'Snapp Can',          300,'FGB-STK-CAN-0009','can',true,true),
    (c_can,v,'Manyatta Can',       300,'FGB-STK-CAN-0010','can',true,true),
    (c_can,v,'Faxe',               350,'FGB-STK-CAN-0011','can',true,true)
  ON CONFLICT (sku) DO UPDATE SET
    category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id, name=EXCLUDED.name,
    selling_price=EXCLUDED.selling_price, unit=EXCLUDED.unit, is_active=EXCLUDED.is_active,
    is_available=EXCLUDED.is_available, updated_at=NOW();

  -- ── Mixtures ──────────────────────────────────────────────────
  INSERT INTO public.bar_drinks (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
    (c_mix,v,'Heineken',           350,'FGB-STK-MIX-0001','bottle',true,true),
    (c_mix,v,'Desperado',          350,'FGB-STK-MIX-0002','bottle',true,true),
    (c_mix,v,'Alvaro',             200,'FGB-STK-MIX-0003','can',   true,true),
    (c_mix,v,'Savanna Cider',      350,'FGB-STK-MIX-0004','bottle',true,true),
    (c_mix,v,'Kingfisher',         300,'FGB-STK-MIX-0005','bottle',true,true),
    (c_mix,v,'Red Bull',           300,'FGB-STK-MIX-0006','can',   true,true),
    (c_mix,v,'Delmonte',           350,'FGB-STK-MIX-0007','bottle',true,true),
    (c_mix,v,'Windhoek',           250,'FGB-STK-MIX-0008','bottle',true,true)
  ON CONFLICT (sku) DO UPDATE SET
    category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id, name=EXCLUDED.name,
    selling_price=EXCLUDED.selling_price, unit=EXCLUDED.unit, is_active=EXCLUDED.is_active,
    is_available=EXCLUDED.is_available, updated_at=NOW();

  -- ── Gin ───────────────────────────────────────────────────────
  -- "Gordon's Dry Gin" had no size printed (just 2,500) — assumed 750ml
  -- based on its price relative to the explicitly-sized 1/2 (1,200).
  INSERT INTO public.bar_drinks (category_id,branch_id,name,selling_price,sku,unit,is_active,is_available) VALUES
    (c_gin,v,'Gilbeys Gin 1/4',          600,'FGB-STK-GIN-0001','bottle',true,true),
    (c_gin,v,'Gilbeys Gin 1/2',          800,'FGB-STK-GIN-0002','bottle',true,true),
    (c_gin,v,'Gilbeys Gin 750 ml',      1700,'FGB-STK-GIN-0003','bottle',true,true),
    (c_gin,v,'Gordons Dry Gin 1/2',     1200,'FGB-STK-GIN-0004','bottle',true,true),
    (c_gin,v,'Gordons Dry Gin 750 ml',  2500,'FGB-STK-GIN-0005','bottle',true,true)
  ON CONFLICT (sku) DO UPDATE SET
    category_id=EXCLUDED.category_id, branch_id=EXCLUDED.branch_id, name=EXCLUDED.name,
    selling_price=EXCLUDED.selling_price, unit=EXCLUDED.unit, is_active=EXCLUDED.is_active,
    is_available=EXCLUDED.is_available, updated_at=NOW();

  -- ── Project into pos_outlet_items for Sotik's Main Bar ───────
  INSERT INTO public.pos_outlet_items (
    outlet_id, sku, name, category, unit, cost_price, selling_price,
    opening_stock, current_stock, track_stock, is_active,
    source_table, source_item_id, item_group
  )
  SELECT
    v_outlet_id, 'M-' || bd.id::text, bd.name, COALESCE(bdc.name, 'Bar'), bd.unit,
    COALESCE(bd.cost_price, 0), COALESCE(bd.selling_price, 0),
    0, 0, true, true, 'bar_drinks', bd.id::text, 'bar'
  FROM public.bar_drinks bd
  LEFT JOIN public.bar_drink_categories bdc ON bdc.id = bd.category_id
  WHERE bd.branch_id = v AND bd.is_active = true
  ON CONFLICT (outlet_id, sku) DO UPDATE SET
    name=EXCLUDED.name, category=EXCLUDED.category, unit=EXCLUDED.unit,
    cost_price=EXCLUDED.cost_price, selling_price=EXCLUDED.selling_price,
    source_table=EXCLUDED.source_table, source_item_id=EXCLUDED.source_item_id,
    item_group=EXCLUDED.item_group, is_active=true;

  RAISE NOTICE 'Seeded Sotik (branch %) Main Bar menu: % bar_drinks rows, outlet %', v,
    (SELECT COUNT(*) FROM public.bar_drinks WHERE branch_id = v), v_outlet_id;
END $$;
