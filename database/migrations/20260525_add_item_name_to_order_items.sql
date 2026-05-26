-- Add item_name column to restaurant_order_items for denormalized item name storage
-- This allows kitchen display and reports to show item names without FK joins

ALTER TABLE restaurant_order_items
  ADD COLUMN IF NOT EXISTS item_name VARCHAR(255);

-- Backfill existing rows with names from restaurant_menu_items
UPDATE restaurant_order_items oi
SET item_name = mi.name
FROM restaurant_menu_items mi
WHERE oi.menu_item_id = mi.id
  AND oi.item_name IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_restaurant_order_items_item_name
  ON restaurant_order_items(item_name);
