-- ============================================================
-- 0028_fix_pos_outlet_items_menu_item_id.sql
-- pos_outlet_items.menu_item_id has NOT NULL but the controller
-- seeds rows using source_item_id instead (modern pattern).
-- menu_item_id is a legacy column — make it nullable so the
-- upsert does not fail when source_table != 'restaurant_menu_items'.
-- ============================================================

ALTER TABLE public.pos_outlet_items
  ALTER COLUMN menu_item_id DROP NOT NULL;
