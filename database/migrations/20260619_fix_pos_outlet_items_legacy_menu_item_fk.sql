-- POS outlet snapshots seed restaurant rows from restaurant_menu_items via
-- source_item_id. The legacy menu_item_id foreign key still points to
-- menu_items in some environments, which breaks outlet item sync with 23503
-- errors during GET /api/pos/outlets/:outletId/items.

ALTER TABLE IF EXISTS public.pos_outlet_items
  ALTER COLUMN menu_item_id DROP NOT NULL;

ALTER TABLE IF EXISTS public.pos_outlet_items
  DROP CONSTRAINT IF EXISTS pos_outlet_items_menu_item_id_fkey;

COMMENT ON COLUMN public.pos_outlet_items.menu_item_id IS
  'Legacy optional link. POS outlet sync uses source_table/source_item_id for restaurant_menu_items and bar_drinks.';
