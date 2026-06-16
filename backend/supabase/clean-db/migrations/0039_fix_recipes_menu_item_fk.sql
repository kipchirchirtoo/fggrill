-- ============================================================
-- 0039_fix_recipes_menu_item_fk.sql
-- Fix recipes.menu_item_id FK: was pointing to menu_items,
-- should point to restaurant_menu_items (the branch POS menu).
-- Idempotent: safe to re-run.
-- ============================================================

ALTER TABLE public.recipes
  DROP CONSTRAINT IF EXISTS recipes_menu_item_id_fkey;

ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_menu_item_id_fkey
    FOREIGN KEY (menu_item_id)
    REFERENCES public.restaurant_menu_items(id)
    ON DELETE SET NULL;
