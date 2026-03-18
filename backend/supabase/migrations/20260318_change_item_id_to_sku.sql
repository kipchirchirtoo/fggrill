-- Migration to change item_id from UUID to VARCHAR to support SKU-based identification
-- This aligns store_po_items and store_grn_items with the simple_items SKU strategy

-- 1. store_po_items
ALTER TABLE store_po_items 
  ALTER COLUMN item_id TYPE VARCHAR(100);

-- 2. store_grn_items
ALTER TABLE store_grn_items 
  ALTER COLUMN item_id TYPE VARCHAR(100);

-- Note: We are not adding a formal FOREIGN KEY to simple_items(sku) yet 
-- because some legacy items might still use old IDs, and we want to ensure 
-- the system remains operational during the transition.
