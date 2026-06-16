-- =============================================================
-- 0026: Fix simple_items (missing branch_id) and bar_drinks (missing price)
-- =============================================================

-- ---------------------------------------------------------------
-- FIX 1: inventory_items + simple_items VIEW
-- simple_items is a VIEW over inventory_items.
-- seedStockCountItemsFromBranchStock filters by .eq('branch_id', branchId)
-- and .is('branch_id', null) — so branch_id must exist on inventory_items
-- and be exposed through the view.
-- ---------------------------------------------------------------

-- Add branch_id to the underlying inventory_items table
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_items_branch ON inventory_items(branch_id);

-- Rebuild simple_items VIEW to expose branch_id (plus is_active already there)
DROP VIEW IF EXISTS simple_items;
CREATE VIEW simple_items AS
SELECT
  id,
  sku,
  sku               AS item_sku,
  item_name,
  description,
  category,
  unit              AS unit_of_measure,
  unit,
  default_unit_cost AS cost_price,
  default_selling_price AS retail_price,
  reorder_level,
  is_active,
  store_type,
  branch_id,
  metadata,
  created_at,
  updated_at,
  quantity
FROM inventory_items;

-- ---------------------------------------------------------------
-- FIX 2: bar_drinks — add 'price' alias for selling_price
-- Queried as 'price' in outlet-pos.controller.ts and
-- menu-pricing.controller.ts but column is 'selling_price'
-- ---------------------------------------------------------------
ALTER TABLE bar_drinks ADD COLUMN IF NOT EXISTS price NUMERIC(12,2);

-- Backfill price from selling_price
UPDATE bar_drinks SET price = selling_price WHERE price IS NULL AND selling_price IS NOT NULL;

-- Sync trigger: keep price ↔ selling_price in sync
CREATE OR REPLACE FUNCTION sync_bar_drink_price()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.selling_price IS DISTINCT FROM OLD.selling_price THEN
    NEW.price := NEW.selling_price;
  END IF;
  IF NEW.price IS DISTINCT FROM OLD.price THEN
    NEW.selling_price := NEW.price;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_bar_drink_price ON bar_drinks;
CREATE TRIGGER trg_sync_bar_drink_price
  BEFORE INSERT OR UPDATE ON bar_drinks
  FOR EACH ROW EXECUTE FUNCTION sync_bar_drink_price();
