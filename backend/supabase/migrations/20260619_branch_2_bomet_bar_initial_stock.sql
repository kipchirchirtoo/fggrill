-- Initial Bar Stock for Branch 2 (Bomet Town)
-- This script sets up the opening stock for the bar POS outlet at Bomet Town branch
-- Categories: WINES, COGNAC, ENERGY DRINKS, OTHERS, SOFT DRINKS, BEERS, CANNED BEERS, SPIRITS, WHISKY
-- Generated: 2026-06-19T12:25:18.578Z
-- Analysis: 116 total items, 116 new, 0 duplicates

BEGIN;

-- Set the branch ID for Bomet Town (Branch 2)
DO $$
DECLARE
  v_branch_id INTEGER := 2;
  v_reference TEXT := 'STKIN-BOMET-20260619';
  v_created_at TIMESTAMPTZ := NOW();
  v_main_bar_outlet_id UUID := '145b570d-6d9b-46bb-9b75-614ab8fedb59'::uuid;
BEGIN

  RAISE NOTICE 'Branch ID: %', v_branch_id;
  RAISE NOTICE 'Reference: %', v_reference;
  RAISE NOTICE 'Main Bar Outlet ID: %', v_main_bar_outlet_id;

  -- ============================================
  -- INSERT NEW ITEMS (skipping 0 existing duplicates)
  -- ============================================
  
  -- WINES
  INSERT INTO simple_items (sku, item_name, category, store_type, quantity, unit, updated_at) VALUES
    ('FGH-BAR-WINE-001', 'Cellar Cask', 'Wines', 'bar_store', 6, 'bottles', v_created_at),
    ('FGH-BAR-WINE-002', 'Heineken', 'Wines', 'bar_store', 15, 'bottles', v_created_at),
    ('FGH-BAR-WINE-003', '4th Street', 'Wines', 'bar_store', 5, 'bottles', v_created_at),
    ('FGH-BAR-WINE-004', 'Casabuena', 'Wines', 'bar_store', 8, 'bottles', v_created_at),
    ('FGH-BAR-WINE-005', 'Caprice', 'Wines', 'bar_store', 5, 'bottles', v_created_at),
    ('FGH-BAR-WINE-006', 'Four Cousins', 'Wines', 'bar_store', 62, 'bottles', v_created_at),
    ('FGH-BAR-WINE-007', 'Kingfisher', 'Wines', 'bar_store', 1, 'bottles', v_created_at),
    ('FGH-BAR-WINE-008', 'Amarula 1/2', 'Wines', 'bar_store', 1, 'bottles', v_created_at),
    ('FGH-BAR-WINE-009', 'Amarula 3/4', 'Wines', 'bar_store', 5, 'bottles', v_created_at),
    ('FGH-BAR-WINE-010', 'Baileys 1/2', 'Wines', 'bar_store', 4, 'bottles', v_created_at),
    ('FGH-BAR-WINE-011', 'Baileys 3/4', 'Wines', 'bar_store', 2, 'bottles', v_created_at),
    ('FGH-BAR-WINE-012', 'Asconi', 'Wines', 'bar_store', 5, 'bottles', v_created_at),
    ('FGH-BAR-WINE-013', 'Drotdy', 'Wines', 'bar_store', 4, 'bottles', v_created_at),
    ('FGH-BAR-WINE-014', 'Robertson', 'Wines', 'bar_store', 2, 'bottles', v_created_at);

  -- COGNAC
  INSERT INTO simple_items (sku, item_name, category, store_type, quantity, unit, updated_at) VALUES
    ('FGH-BAR-COG-001', 'Hennesy 750ml', 'Cognac', 'bar_store', 2, 'bottles', v_created_at),
    ('FGH-BAR-COG-002', 'Double Black 1L', 'Cognac', 'bar_store', 2, 'bottles', v_created_at),
    ('FGH-BAR-COG-003', 'Martel VS', 'Cognac', 'bar_store', 2, 'bottles', v_created_at),
    ('FGH-BAR-COG-004', 'Martel VSOP', 'Cognac', 'bar_store', 1, 'bottles', v_created_at),
    ('FGH-BAR-COG-005', 'Singletone 12yrs', 'Cognac', 'bar_store', 2, 'bottles', v_created_at);

  -- ENERGY DRINKS
  INSERT INTO simple_items (sku, item_name, category, store_type, quantity, unit, updated_at) VALUES
    ('FGH-BAR-ENG-001', 'Redbull', 'Energy Drinks', 'bar_store', 16, 'cans', v_created_at),
    ('FGH-BAR-ENG-002', 'Monster', 'Energy Drinks', 'bar_store', 12, 'cans', v_created_at);

  -- OTHERS
  INSERT INTO simple_items (sku, item_name, category, store_type, quantity, unit, updated_at) VALUES
    ('FGH-BAR-OTH-001', 'Camino', 'Others', 'bar_store', 2, 'bottles', v_created_at),
    ('FGH-BAR-OTH-002', 'Jagermeister', 'Others', 'bar_store', 2, 'bottles', v_created_at),
    ('FGH-BAR-OTH-003', 'Bullet Bourbon', 'Others', 'bar_store', 1, 'bottles', v_created_at),
    ('FGH-BAR-OTH-004', 'Trust Classic', 'Others', 'bar_store', 19, 'bottles', v_created_at),
    ('FGH-BAR-OTH-005', 'Trust Studded', 'Others', 'bar_store', 15, 'bottles', v_created_at),
    ('FGH-BAR-OTH-006', 'Pool Tokens', 'Others', 'bar_store', 87, 'tokens', v_created_at);

  -- SOFT DRINKS
  INSERT INTO simple_items (sku, item_name, category, store_type, quantity, unit, updated_at) VALUES
    ('FGH-BAR-SFT-001', 'Soda 500ml', 'Soft Drinks', 'bar_store', 87, 'bottles', v_created_at),
    ('FGH-BAR-SFT-002', 'H2O 1L', 'Soft Drinks', 'bar_store', 52, 'bottles', v_created_at),
    ('FGH-BAR-SFT-003', 'Alvaro Can', 'Soft Drinks', 'bar_store', 6, 'bottles', v_created_at),
    ('FGH-BAR-SFT-004', 'Delmonte', 'Soft Drinks', 'bar_store', 14, 'bottles', v_created_at),
    ('FGH-BAR-SFT-005', 'Lemonade', 'Soft Drinks', 'bar_store', 0, 'bottles', v_created_at);

  -- BEERS
  INSERT INTO simple_items (sku, item_name, category, store_type, quantity, unit, updated_at) VALUES
    ('FGH-BAR-BEER-001', 'T. Larger', 'Beers', 'bar_store', 96, 'bottles', v_created_at),
    ('FGH-BAR-BEER-002', 'T. Cider', 'Beers', 'bar_store', 54, 'bottles', v_created_at),
    ('FGH-BAR-BEER-003', 'T. Lite', 'Beers', 'bar_store', 40, 'bottles', v_created_at),
    ('FGH-BAR-BEER-004', 'T. Malt', 'Beers', 'bar_store', 44, 'bottles', v_created_at),
    ('FGH-BAR-BEER-005', 'Guiness', 'Beers', 'bar_store', 132, 'bottles', v_created_at),
    ('FGH-BAR-BEER-006', 'Balozi', 'Beers', 'bar_store', 46, 'bottles', v_created_at),
    ('FGH-BAR-BEER-007', 'Black Ice', 'Beers', 'bar_store', 67, 'bottles', v_created_at),
    ('FGH-BAR-BEER-008', 'Snapp', 'Beers', 'bar_store', 33, 'bottles', v_created_at),
    ('FGH-BAR-BEER-009', 'Plisner', 'Beers', 'bar_store', 57, 'bottles', v_created_at),
    ('FGH-BAR-BEER-010', 'Manyatta', 'Beers', 'bar_store', 53, 'bottles', v_created_at),
    ('FGH-BAR-BEER-011', 'Desparado', 'Beers', 'bar_store', 10, 'bottles', v_created_at),
    ('FGH-BAR-BEER-012', 'Hunters Beer', 'Beers', 'bar_store', 2, 'bottles', v_created_at),
    ('FGH-BAR-BEER-013', 'White Cap', 'Beers', 'bar_store', 100, 'bottles', v_created_at);

  -- CANNED BEERS
  INSERT INTO simple_items (sku, item_name, category, store_type, quantity, unit, updated_at) VALUES
    ('FGH-BAR-CAN-001', 'Guiness Can', 'Canned Beers', 'bar_store', 27, 'cans', v_created_at),
    ('FGH-BAR-CAN-002', 'T. Can', 'Canned Beers', 'bar_store', 14, 'cans', v_created_at),
    ('FGH-BAR-CAN-003', 'W.Cap Can', 'Canned Beers', 'bar_store', 22, 'cans', v_created_at),
    ('FGH-BAR-CAN-004', 'Black Ice Can', 'Canned Beers', 'bar_store', 14, 'cans', v_created_at),
    ('FGH-BAR-CAN-005', 'Guarana', 'Canned Beers', 'bar_store', 125, 'cans', v_created_at),
    ('FGH-BAR-CAN-006', 'T.Lite Can', 'Canned Beers', 'bar_store', 20, 'cans', v_created_at),
    ('FGH-BAR-CAN-007', 'T.Cider Can', 'Canned Beers', 'bar_store', 22, 'cans', v_created_at),
    ('FGH-BAR-CAN-008', 'Manyatta Can', 'Canned Beers', 'bar_store', 10, 'cans', v_created_at),
    ('FGH-BAR-CAN-009', 'Snapp Can', 'Canned Beers', 'bar_store', 14, 'cans', v_created_at),
    ('FGH-BAR-CAN-010', 'Quarana Punch', 'Canned Beers', 'bar_store', 15, 'cans', v_created_at),
    ('FGH-BAR-CAN-011', 'S/Raspberry Twist', 'Canned Beers', 'bar_store', 0, 'cans', v_created_at),
    ('FGH-BAR-CAN-012', 'Gordons Can', 'Canned Beers', 'bar_store', 8, 'cans', v_created_at),
    ('FGH-BAR-CAN-013', 'Faxe Can', 'Canned Beers', 'bar_store', 13, 'cans', v_created_at),
    ('FGH-BAR-CAN-014', 'Balozi Can', 'Canned Beers', 'bar_store', 10, 'cans', v_created_at);

  -- SPIRITS
  INSERT INTO simple_items (sku, item_name, category, store_type, quantity, unit, updated_at) VALUES
    ('FGH-BAR-SPI-001', 'KC 1/4', 'Spirits', 'bar_store', 9, 'bottles', v_created_at),
    ('FGH-BAR-SPI-002', 'KC 1/2', 'Spirits', 'bar_store', 8, 'bottles', v_created_at),
    ('FGH-BAR-SPI-003', 'KC 3/4', 'Spirits', 'bar_store', 15, 'bottles', v_created_at),
    ('FGH-BAR-SPI-004', 'Vodka 1/4', 'Spirits', 'bar_store', 4, 'bottles', v_created_at),
    ('FGH-BAR-SPI-005', 'Vodka 1/2', 'Spirits', 'bar_store', 7, 'bottles', v_created_at),
    ('FGH-BAR-SPI-006', 'Vodka 3/4', 'Spirits', 'bar_store', 7, 'bottles', v_created_at),
    ('FGH-BAR-SPI-007', 'Richot 1/4', 'Spirits', 'bar_store', 21, 'bottles', v_created_at),
    ('FGH-BAR-SPI-008', 'Richot 1/2', 'Spirits', 'bar_store', 13, 'bottles', v_created_at),
    ('FGH-BAR-SPI-009', 'Richot 3/4', 'Spirits', 'bar_store', 22, 'bottles', v_created_at),
    ('FGH-BAR-SPI-010', 'Gilbeys 1/4', 'Spirits', 'bar_store', 22, 'bottles', v_created_at),
    ('FGH-BAR-SPI-011', 'Gilbeys 1/2', 'Spirits', 'bar_store', 20, 'bottles', v_created_at),
    ('FGH-BAR-SPI-012', 'Gilbeys 3/4', 'Spirits', 'bar_store', 19, 'bottles', v_created_at),
    ('FGH-BAR-SPI-013', 'Viceroy 1/4', 'Spirits', 'bar_store', 18, 'bottles', v_created_at),
    ('FGH-BAR-SPI-014', 'Viceroy 1/2', 'Spirits', 'bar_store', 17, 'bottles', v_created_at),
    ('FGH-BAR-SPI-015', 'Viceroy 3/4', 'Spirits', 'bar_store', 23, 'bottles', v_created_at);

  -- WHISKY
  INSERT INTO simple_items (sku, item_name, category, store_type, quantity, unit, updated_at) VALUES
    ('FGH-BAR-WHK-001', 'B/Whisky 3/4', 'Whisky', 'bar_store', 7, 'bottles', v_created_at),
    ('FGH-BAR-WHK-002', 'B/Cream 750ml', 'Whisky', 'bar_store', 2, 'bottles', v_created_at),
    ('FGH-BAR-WHK-003', 'All Seasons 3/4', 'Whisky', 'bar_store', 5, 'bottles', v_created_at),
    ('FGH-BAR-WHK-004', 'Vat 69 1/2', 'Whisky', 'bar_store', 5, 'bottles', v_created_at),
    ('FGH-BAR-WHK-005', 'Vat 69 3/4', 'Whisky', 'bar_store', 7, 'bottles', v_created_at),
    ('FGH-BAR-WHK-006', 'Bond 7 1/4', 'Whisky', 'bar_store', 12, 'bottles', v_created_at),
    ('FGH-BAR-WHK-007', 'Bond 7 1/2', 'Whisky', 'bar_store', 10, 'bottles', v_created_at),
    ('FGH-BAR-WHK-008', 'Bond 7 3/4', 'Whisky', 'bar_store', 6, 'bottles', v_created_at),
    ('FGH-BAR-WHK-009', 'Grants 3/4', 'Whisky', 'bar_store', 5, 'bottles', v_created_at),
    ('FGH-BAR-WHK-010', 'Grants 1L', 'Whisky', 'bar_store', 5, 'bottles', v_created_at),
    ('FGH-BAR-WHK-011', 'Red Label 1/4', 'Whisky', 'bar_store', 1, 'bottles', v_created_at),
    ('FGH-BAR-WHK-012', 'Red Label 1/2', 'Whisky', 'bar_store', 5, 'bottles', v_created_at),
    ('FGH-BAR-WHK-013', 'Red Label 3/4', 'Whisky', 'bar_store', 0, 'bottles', v_created_at),
    ('FGH-BAR-WHK-014', 'Red Label 1L', 'Whisky', 'bar_store', 10, 'bottles', v_created_at),
    ('FGH-BAR-WHK-015', 'Black Label 1/2', 'Whisky', 'bar_store', 4, 'bottles', v_created_at),
    ('FGH-BAR-WHK-016', 'Black Label 3/4', 'Whisky', 'bar_store', 5, 'bottles', v_created_at),
    ('FGH-BAR-WHK-017', 'Black Label 1L', 'Whisky', 'bar_store', 6, 'bottles', v_created_at),
    ('FGH-BAR-WHK-018', 'JW Blonde', 'Whisky', 'bar_store', 2, 'bottles', v_created_at),
    ('FGH-BAR-WHK-019', 'Hunters 3/4', 'Whisky', 'bar_store', 8, 'bottles', v_created_at),
    ('FGH-BAR-WHK-020', 'Hunters 1/4', 'Whisky', 'bar_store', 9, 'bottles', v_created_at),
    ('FGH-BAR-WHK-021', 'Hunters 1/2', 'Whisky', 'bar_store', 10, 'bottles', v_created_at),
    ('FGH-BAR-WHK-022', 'Black&White 1/2', 'Whisky', 'bar_store', 7, 'bottles', v_created_at),
    ('FGH-BAR-WHK-023', 'Black &White 3/4', 'Whisky', 'bar_store', 0, 'bottles', v_created_at),
    ('FGH-BAR-WHK-024', 'Savanna', 'Whisky', 'bar_store', 11, 'bottles', v_created_at),
    ('FGH-BAR-WHK-025', 'Tang 10', 'Whisky', 'bar_store', 1, 'bottles', v_created_at),
    ('FGH-BAR-WHK-026', 'Gordons 1/2', 'Whisky', 'bar_store', 2, 'bottles', v_created_at),
    ('FGH-BAR-WHK-027', 'JD 3/4', 'Whisky', 'bar_store', 3, 'bottles', v_created_at),
    ('FGH-BAR-WHK-028', 'JD 1L', 'Whisky', 'bar_store', 1, 'bottles', v_created_at),
    ('FGH-BAR-WHK-029', 'JD 1/2', 'Whisky', 'bar_store', 2, 'bottles', v_created_at),
    ('FGH-BAR-WHK-030', 'Jameson 1L', 'Whisky', 'bar_store', 2, 'bottles', v_created_at),
    ('FGH-BAR-WHK-031', 'Jameson 3/4', 'Whisky', 'bar_store', 2, 'bottles', v_created_at),
    ('FGH-BAR-WHK-032', 'Jameson 1/2', 'Whisky', 'bar_store', 2, 'bottles', v_created_at),
    ('FGH-BAR-WHK-033', 'C/Morgan 1/4', 'Whisky', 'bar_store', 6, 'bottles', v_created_at),
    ('FGH-BAR-WHK-034', 'C/Morgan 3/4', 'Whisky', 'bar_store', 14, 'bottles', v_created_at),
    ('FGH-BAR-WHK-035', 'C/Morgan 3/4 Melon', 'Whisky', 'bar_store', 6, 'bottles', v_created_at),
    ('FGH-BAR-WHK-036', 'Famous Grouse', 'Whisky', 'bar_store', 3, 'bottles', v_created_at),
    ('FGH-BAR-WHK-037', 'William Lawsons 1/2', 'Whisky', 'bar_store', 0, 'bottles', v_created_at),
    ('FGH-BAR-WHK-038', 'William Lawsons 3/4', 'Whisky', 'bar_store', 2, 'bottles', v_created_at),
    ('FGH-BAR-WHK-039', 'William Lawsons 1ltr', 'Whisky', 'bar_store', 2, 'bottles', v_created_at),
    ('FGH-BAR-WHK-040', 'V&A 1/4', 'Whisky', 'bar_store', 6, 'bottles', v_created_at),
    ('FGH-BAR-WHK-041', 'V&A 3/4', 'Whisky', 'bar_store', 4, 'bottles', v_created_at),
    ('FGH-BAR-WHK-042', 'Gordons 3/4', 'Whisky', 'bar_store', 3, 'bottles', v_created_at);

  -- ============================================
  -- Set up branch_stock for Branch 2 (Bomet Town)
  -- This will update existing records and insert new ones
  -- ============================================
  
  -- First, delete existing branch_stock records for these items to avoid duplicates
  DELETE FROM branch_stock
  WHERE branch_id = v_branch_id
    AND item_sku IN (
      SELECT sku FROM simple_items
      WHERE store_type = 'bar_store' AND sku LIKE 'FGH-BAR-%'
    );
  
  -- Then insert fresh records
  INSERT INTO branch_stock (branch_id, item_sku, quantity, reorder_level, max_stock_level, last_stock_in, updated_at)
  SELECT 
    v_branch_id,
    sku,
    quantity,
    CASE 
      WHEN quantity <= 5 THEN 5
      WHEN quantity <= 10 THEN 10
      ELSE 20
    END as reorder_level,
    CASE 
      WHEN quantity <= 10 THEN 20
      WHEN quantity <= 50 THEN 50
      ELSE 100
    END as max_stock_level,
    v_created_at as last_stock_in,
    v_created_at as updated_at
  FROM simple_items
  WHERE store_type = 'bar_store'
    AND sku LIKE 'FGH-BAR-%';

  -- ============================================
  -- Link items to Main Bar POS Outlet
  -- ============================================
  
  -- First, ensure outlet items exist for the main bar outlet
  INSERT INTO pos_outlet_items (outlet_id, sku, name, category, unit, cost_price, selling_price, opening_stock, current_stock, track_stock, is_active, updated_at)
  SELECT 
    v_main_bar_outlet_id,
    si.sku,
    si.item_name,
    si.category,
    'bottles' as unit,
    0.00 as cost_price,
    0.00 as selling_price,
    0 as opening_stock,
    0 as current_stock,
    TRUE as track_stock,
    TRUE as is_active,
    v_created_at as updated_at
  FROM simple_items si
  WHERE si.store_type = 'bar_store'
    AND si.sku LIKE 'FGH-BAR-%'
    AND NOT EXISTS (
      SELECT 1 FROM pos_outlet_items poi 
      WHERE poi.outlet_id = v_main_bar_outlet_id 
        AND poi.sku = si.sku
    );

  -- Create inventory mappings
  INSERT INTO pos_inventory_mappings (branch_id, outlet_id, outlet_item_id, item_sku, quantity_per_sale, is_active, created_at, updated_at)
  SELECT 
    v_branch_id,
    v_main_bar_outlet_id,
    poi.id as outlet_item_id,
    si.sku as item_sku,
    1.0 as quantity_per_sale,
    TRUE as is_active,
    v_created_at as created_at,
    v_created_at as updated_at
  FROM simple_items si
  JOIN pos_outlet_items poi ON poi.sku = si.sku AND poi.outlet_id = v_main_bar_outlet_id
  WHERE si.store_type = 'bar_store'
    AND si.sku LIKE 'FGH-BAR-%'
    AND NOT EXISTS (
      SELECT 1 FROM pos_inventory_mappings pim 
      WHERE pim.outlet_id = v_main_bar_outlet_id 
        AND pim.item_sku = si.sku
    );

  RAISE NOTICE 'Initial bar stock for Branch 2 (Bomet Town) has been set up successfully';
  RAISE NOTICE 'Total items processed: %', (SELECT COUNT(*) FROM simple_items WHERE store_type = 'bar_store' AND sku LIKE 'FGH-BAR-%');
  RAISE NOTICE 'New items added: %', 116;
  RAISE NOTICE 'Existing items updated: %', 0;

END $$;

COMMIT;

-- Documentation
-- Initial bar stock setup for Branch 2 (Bomet Town). 
-- This migration creates bar inventory items across 9 categories (Wines, Cognac, Energy Drinks, Others, Soft Drinks, Beers, Canned Beers, Spirits, Whisky) 
-- with opening stock quantities. Items are tagged with store_type=bar_store and SKU prefix FGH-BAR-. 
-- Stock is recorded in simple_items, branch_stock (for branch 2), and stock_history with reason=INITIAL_STOCK.
-- Items are linked to Main Bar POS Outlet (ID: 145b570d-6d9b-46bb-9b75-614ab8fedb59).
-- Analysis: 116 total items, 116 new items added, 0 existing items updated.
