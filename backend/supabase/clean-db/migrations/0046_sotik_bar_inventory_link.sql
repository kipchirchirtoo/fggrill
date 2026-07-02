-- ============================================================
-- 0046_sotik_bar_inventory_link.sql
-- Sotik (branch_id=4) bar menu: rename fraction sizes (1/4, 1/2,
-- 3/4) to match Central Store's explicit ml/L naming, link every
-- bar_drinks row to its master inventory_items SKU (Bomet/branch 2
-- linking convention: inventory_items.sku = 'FG-' || linked_inventory_sku),
-- and register branch_stock for branch 4 (bottle counts, not crates
-- -- per instruction, branch-level beer tracking uses bottle counts
-- even though Central Store tracks the same items by the crate).
--
-- New master inventory items created (did not exist before):
--   FG-444 KISS (condom), FG-445 COKE ZERO, FG-446 NOVIDA,
--   FG-447 MINUTE MAID, FG-448 PREDATOR, FG-449 TONIC SODA,
--   FG-450 GUARANA, FG-451 MANYATTA CAN, FG-452 JAGER TOT, FG-453 CAMINO TOT
--
-- Existing items recategorized to CONDOM: FG-397 (STUDDED), FG-NC-001
-- (TRUST CLASSIC) -- both already existed, just mis-filed.
--
-- Left UNLINKED (no reasonable master inventory match, not addressed
-- by user yet): Popov 250ml, J&B 750ml.
--
-- Several wine/spirit items had MULTIPLE candidate matches in master
-- inventory (e.g. Drostdy-Hof Red vs White) with no flavor specified
-- on the Sotik menu -- defaulted to one variant, flagged in code
-- comments below for confirmation.
-- ============================================================

DO $$
DECLARE
  v_branch INT := 4;
  v_outlet_id UUID;
BEGIN
  SELECT id INTO v_outlet_id FROM public.pos_outlets WHERE branch_id = v_branch AND outlet_type = 'main_bar' LIMIT 1;
  IF v_outlet_id IS NULL THEN
    RAISE EXCEPTION 'No main_bar outlet found for branch_id=%', v_branch;
  END IF;

  -- ── 1. New master inventory items ────────────────────────────
  INSERT INTO public.inventory_items (sku, item_name, description, category, store_type, unit, item_type, default_unit_cost, default_selling_price, is_active)
  VALUES
    ('FG-444', 'KISS',        'Trust Kiss Condom', 'CONDOM',      'foodstuffs', 'pcs',  'stockable', 0, 0, true),
    ('FG-445', 'COKE ZERO',   'Coke Zero',          'SOFT DRINKS', 'bar_store',  'pcs',  'stockable', 0, 0, true),
    ('FG-446', 'NOVIDA',      'Novida',             'SOFT DRINKS', 'bar_store',  'pcs',  'stockable', 0, 0, true),
    ('FG-447', 'MINUTE MAID', 'Minute Maid',        'SOFT DRINKS', 'bar_store',  'pcs',  'stockable', 0, 0, true),
    ('FG-448', 'PREDATOR',    'Predator',           'SOFT DRINKS', 'bar_store',  'pcs',  'stockable', 0, 0, true),
    ('FG-449', 'TONIC SODA',  'Tonic Soda',         'SOFT DRINKS', 'bar_store',  'pcs',  'stockable', 0, 0, true),
    ('FG-450', 'GUARANA',     'Guarana (bottled)',  'BEERS',       'bar_store',  'crate','stockable', 0, 0, true),
    ('FG-451', 'MANYATTA CAN','Manyatta Can',       'CANNED BEERS','bar_store',  'pcs',  'stockable', 0, 0, true),
    ('FG-452', 'JAGER TOT',   'Jager single tot',   'TOTS',        'bar_store',  'pcs',  'stockable', 0, 0, true),
    ('FG-453', 'CAMINO TOT',  'Camino single tot',  'TOTS',        'bar_store',  'pcs',  'stockable', 0, 0, true)
  ON CONFLICT (sku) DO NOTHING;

  -- ── 2. Recategorize existing items to CONDOM ─────────────────
  UPDATE public.inventory_items SET category = 'CONDOM', last_updated = NOW() WHERE sku = 'FG-397';
  UPDATE public.inventory_items SET category = 'CONDOM', last_updated = NOW() WHERE sku = 'FG-NC-001';

  -- ── 3. Rename + link Sotik bar_drinks to master inventory ────
  -- Suffix is what follows 'FG-' in the master SKU (numeric or NC-001-style).
  UPDATE public.bar_drinks bd
  SET name = v.new_name,
      linked_inventory_sku = v.suffix,
      inventory_item_id = ii.id,
      updated_at = NOW()
  FROM (VALUES
    ('FGB-STK-BRC-0001','Viceroy 250ml','229'), ('FGB-STK-BRC-0002','Viceroy 375ml','230'),
    ('FGB-STK-BRC-0003','Viceroy 750ml','231'), ('FGB-STK-BRC-0005','Richot 250ml','226'),
    ('FGB-STK-BRC-0006','Richot 350ml','227'),  ('FGB-STK-BRC-0007','Richot 750ml','228'),
    ('FGB-STK-BRC-0004','Viceroy 10 Yrs','403'), ('FGB-STK-BRC-0008','Robertson','318'),
    ('FGB-STK-VOD-0001','Vodka 250ml','232'), ('FGB-STK-VOD-0002','Vodka 350ml','233'), ('FGB-STK-VOD-0003','Vodka 750ml','234'),
    ('FGB-STK-SPR-0001','K.C 250ml','236'), ('FGB-STK-SPR-0002','K.C 350ml','237'), ('FGB-STK-SPR-0003','K.C 750ml','238'),
    ('FGB-STK-WHK-0001','Jameson 350ml','283'), ('FGB-STK-WHK-0002','Jameson 750ml','284'),
    ('FGB-STK-WHK-0003','VAT 69 350ml','295'), ('FGB-STK-WHK-0004','VAT 69 750ml','296'),
    ('FGB-STK-WHK-0005','J.W Red 250ml','378'), ('FGB-STK-WHK-0006','J.W Red 375ml','277'),
    ('FGB-STK-WHK-0007','J.W Red 750ml','278'), ('FGB-STK-WHK-0008','J.W Red 1 Ltr','276'),
    ('FGB-STK-WHK-0009','J.W Black 250ml','377'), ('FGB-STK-WHK-0010','J.W Black 375ml','273'),
    ('FGB-STK-WHK-0011','J.W Black 750ml','274'), ('FGB-STK-WHK-0012','J.W Black 1 Ltr','376'),
    ('FGB-STK-WHK-0013','J.W Blonde','411'), ('FGB-STK-WHK-0014','J.W Black Green Label 1 Ltr','275'),
    ('FGB-STK-WHK-0015','Bond 7 250ml','249'), ('FGB-STK-WHK-0016','Bond 7 350ml','250'), ('FGB-STK-WHK-0017','Bond 7 750ml','251'),
    ('FGB-STK-WHK-0018','Best Whisky 250ml','246'), ('FGB-STK-WHK-0019','Best Whisky 750ml','245'),
    ('FGB-STK-WHK-0020','Famous Grouse 750ml','259'),
    ('FGB-STK-WHK-0021','Glenfiddich 12 Yrs','261'), ('FGB-STK-WHK-0022','Glenfiddich 15 Yrs','262'),
    ('FGB-STK-WHK-0023','Hennessy','402'), ('FGB-STK-WHK-0024','Hennessy VSOP','267'),
    ('FGB-STK-WHK-0025','Martell VS','287'), ('FGB-STK-WHK-0026','Martell VSOP','288'),
    ('FGB-STK-WHK-0027','Jack Daniels 350ml','280'), ('FGB-STK-WHK-0028','Jack Daniels 700ml','281'),
    ('FGB-STK-WHK-0029','Jack Daniels 1 Ltr','282'),
    ('FGB-STK-WHK-0030','Double Black 750ml','257'), ('FGB-STK-WHK-0031','Double Black 1 Ltr','256'),
    ('FGB-STK-WHK-0032','All Seasons 750ml','243'),
    ('FGB-STK-WHK-0033','William Lawsons 750ml','298'), ('FGB-STK-WHK-0034','William Lawsons 1 Ltr','299'),
    ('FGB-STK-WHK-0035','Grants 350ml','264'), ('FGB-STK-WHK-0036','Grants 750ml','265'), ('FGB-STK-WHK-0037','Grants 1 Ltr','263'),
    ('FGB-STK-WHK-0038','Black & White 350ml','247'), ('FGB-STK-WHK-0039','Black & White 750ml','248'),
    ('FGB-STK-WHK-0040','Hunters 250ml','268'), ('FGB-STK-WHK-0041','Hunters 350ml','269'), ('FGB-STK-WHK-0042','Hunters 750ml','270'),
    ('FGB-STK-WHK-0044','Singleton 12 Yrs','290'), ('FGB-STK-WHK-0045','Singleton 15 Yrs','291'),
    ('FGB-STK-WHK-0046','Tang 10','242'),
    ('FGB-STK-CRM-0001','Amarula 375ml','300'), ('FGB-STK-CRM-0002','Amarula 750ml','301'),
    ('FGB-STK-CRM-0003','Best Cream 750ml','244'),
    ('FGB-STK-CRM-0004','Baileys 350ml','302'), ('FGB-STK-CRM-0005','Baileys 750ml','303'),
    ('FGB-STK-CRM-0006','V&A 250ml','381'), ('FGB-STK-CRM-0007','V&A 750ml','304'),
    ('FGB-STK-WIN-0001','4th Street','305'),
    ('FGB-STK-WIN-0002','Cellar Cask Red','439'),       -- assumed RED; confirm if White
    ('FGB-STK-WIN-0003','Drostdy-Hof Red','438'),       -- assumed RED; confirm if White
    ('FGB-STK-WIN-0004','Chamdor','310'),
    ('FGB-STK-WIN-0005','Caprice Sweet Red','308'),     -- assumed RED; confirm if White
    ('FGB-STK-WIN-0006','Four Cousins Red','312'),      -- assumed RED; confirm if White
    ('FGB-STK-WIN-0007','Asconi','307'),
    ('FGB-STK-WIN-0008','Asconi 750ml','307'),          -- same SKU as plain Asconi; only one Asconi size in master
    ('FGB-STK-WIN-0009','Casabuena Sangria Red','309'), -- assumed RED; confirm if White
    ('FGB-STK-WIN-0010','Jager 1 Ltr','336'),
    ('FGB-STK-WIN-0011','Camino Real Gold','335'),      -- assumed Real Gold; confirm if Blanco
    ('FGB-STK-RUM-0001','Captain Morgan 750ml','380'), ('FGB-STK-RUM-0002','Captain Morgan 250ml','379'),
    ('FGB-STK-OTH-0001','Trust Studded','397'),
    ('FGB-STK-OTH-0002','Trust Kiss','444'),
    ('FGB-STK-OTH-0003','Trust Classic','NC-001'),
    ('FGB-STK-BEV-0001','Soda 300ml','420'), ('FGB-STK-BEV-0002','Soda 500ml','419'),
    ('FGB-STK-BEV-0003','Coke Zero','445'), ('FGB-STK-BEV-0004','Novida','446'),
    ('FGB-STK-BEV-0005','Dasani 500ml','418'), ('FGB-STK-BEV-0006','Dasani 1 Ltr','417'),
    ('FGB-STK-BEV-0007','Minute Maid','447'), ('FGB-STK-BEV-0008','Predator','448'),
    ('FGB-STK-BEV-0009','Monster','219'), ('FGB-STK-BEV-0010','Tonic Soda','449'),
    ('FGB-STK-BEV-0011','Lime Lemonade','333'), ('FGB-STK-BEV-0012','Hunters Gold 250ml','195'),
    ('FGB-STK-BTL-0001','Manyatta','196'), ('FGB-STK-BTL-0002','Tusker Cider','202'),
    ('FGB-STK-BTL-0003','Guinness','193'), ('FGB-STK-BTL-0004','Snapp','200'),
    ('FGB-STK-BTL-0005','Tusker Lager','203'), ('FGB-STK-BTL-0006','Tusker Lite','204'),
    ('FGB-STK-BTL-0007','Tusker Malt','205'), ('FGB-STK-BTL-0008','Pilsner Lager','197'),
    ('FGB-STK-BTL-0009','White Cap Lager','206'), ('FGB-STK-BTL-0010','B. Ice','191'),
    ('FGB-STK-BTL-0011','Balozi','190'), ('FGB-STK-BTL-0012','Guarana','450'),
    ('FGB-STK-CAN-0001','Guinness Can','211'), ('FGB-STK-CAN-0002','Tusker Cider Can','214'),
    ('FGB-STK-CAN-0003','Tusker Lager Can','215'), ('FGB-STK-CAN-0004','White Cap Can','218'),
    ('FGB-STK-CAN-0005','Tusker Lite Can','216'), ('FGB-STK-CAN-0006','Tusker Malt Can','217'),
    ('FGB-STK-CAN-0007','Pilsner Can','212'), ('FGB-STK-CAN-0008','Balozi Can','208'),
    ('FGB-STK-CAN-0009','Snapp Can','213'), ('FGB-STK-CAN-0010','Manyatta Can','451'),
    ('FGB-STK-CAN-0011','Faxe','210'),
    ('FGB-STK-MIX-0001','Heineken','194'), ('FGB-STK-MIX-0002','Desperado','192'),
    ('FGB-STK-MIX-0003','Alvaro','425'), ('FGB-STK-MIX-0004','Savanna Cider','198'),
    ('FGB-STK-MIX-0005','Kingfisher','315'), ('FGB-STK-MIX-0006','Red Bull','220'),
    ('FGB-STK-MIX-0007','Delmonte Passion','329'),      -- assumed Passion flavor; confirm
    ('FGB-STK-MIX-0008','Windhoek','395'),
    ('FGB-STK-GIN-0001','Gilbeys Gin 250ml','221'), ('FGB-STK-GIN-0002','Gilbeys Gin 350ml','222'),
    ('FGB-STK-GIN-0003','Gilbeys Gin 750ml','223'),
    ('FGB-STK-GIN-0004','Gordons Dry Gin 350ml','225'), ('FGB-STK-GIN-0005','Gordons Dry Gin 750ml','314'),
    ('FGB-STK-WIN-0012','Jager Tot','452'), ('FGB-STK-WIN-0013','Camino Tot','453')
  ) AS v(sku, new_name, suffix)
  JOIN public.inventory_items ii ON ii.sku = 'FG-' || v.suffix
  WHERE bd.branch_id = v_branch AND bd.sku = v.sku;

  -- ── 4. Mirror the renames into pos_outlet_items (display name) ──
  UPDATE public.pos_outlet_items poi
  SET name = bd.name, updated_at = NOW()
  FROM public.bar_drinks bd
  WHERE poi.outlet_id = v_outlet_id
    AND poi.source_table = 'bar_drinks'
    AND poi.source_item_id = bd.id::text
    AND bd.branch_id = v_branch;

  -- ── 5. Register branch_stock for branch 4 — bottle counts, not
  --      crates, even for crate-tracked master items (per instruction:
  --      central store tracks crates, branch inventory tracks bottles).
  -- SUM per master SKU in case multiple bar_drinks rows share the same
  -- inventory_item_id (e.g. Asconi and Asconi 750ml both map to FG-307).
  INSERT INTO public.branch_stock (branch_id, item_sku, quantity, reorder_level, max_stock_level, updated_at)
  SELECT v_branch, ii.sku, SUM(poi.current_stock), 5, 200, NOW()
  FROM public.bar_drinks bd
  JOIN public.inventory_items ii ON ii.id = bd.inventory_item_id
  JOIN public.pos_outlet_items poi ON poi.source_table = 'bar_drinks' AND poi.source_item_id = bd.id::text AND poi.outlet_id = v_outlet_id
  WHERE bd.branch_id = v_branch AND bd.inventory_item_id IS NOT NULL
  GROUP BY ii.sku
  ON CONFLICT (branch_id, item_sku) DO UPDATE SET
    quantity = EXCLUDED.quantity, updated_at = NOW();

  RAISE NOTICE 'Sotik bar inventory link complete: % bar_drinks linked, % branch_stock rows',
    (SELECT COUNT(*) FROM public.bar_drinks WHERE branch_id = v_branch AND inventory_item_id IS NOT NULL),
    (SELECT COUNT(*) FROM public.branch_stock WHERE branch_id = v_branch);
END $$;
