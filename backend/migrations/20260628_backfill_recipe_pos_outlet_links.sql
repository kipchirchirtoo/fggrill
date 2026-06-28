-- Daily Control / Food Control: backfill pos_outlet_item_id for existing
-- kitchen_production_recipes rows where there is exactly one, unambiguous
-- exact-name match in pos_outlet_items for that recipe's branch.
--
-- Context: kitchen_production_recipes.pos_outlet_item_id lets a recipe link
-- precisely to the POS sales catalog (pos_outlet_items), which is what
-- pos_shift_orders.items[].outlet_item_id actually references. Until now the
-- Food Control "Link to POS Menu Item" picker read from the unrelated
-- restaurant_menu_items table, so pos_outlet_item_id was never populated by
-- any recipe (0/180 linked) even when a storekeeper picked a menu item.
--
-- Most existing recipes use generic produced_item_name values ("Chips
-- Portion", "Quarter Chicken", "Pilau Plate") that don't exact-match the POS
-- catalog's specific naming ("1/4 Kg Chicken Dry Fry", "Special Pilau") and
-- so cannot be safely auto-linked — those need a storekeeper to re-pick the
-- correct POS item once via the (now-fixed) Food Control edit dialog. This
-- migration only links the rare case where the recipe's produced_item_name
-- already matches a POS item name exactly and unambiguously.

UPDATE kitchen_production_recipes r
SET pos_outlet_item_id = poi.id,
    updated_at = now()
FROM pos_outlet_items poi
WHERE r.is_active = true
  AND r.pos_outlet_item_id IS NULL
  AND poi.branch_id = r.branch_id
  AND poi.is_active = true
  AND lower(trim(poi.name)) = lower(trim(r.produced_item_name))
  AND (
    SELECT count(*) FROM pos_outlet_items poi2
    WHERE poi2.branch_id = r.branch_id
      AND poi2.is_active = true
      AND lower(trim(poi2.name)) = lower(trim(r.produced_item_name))
  ) = 1;
