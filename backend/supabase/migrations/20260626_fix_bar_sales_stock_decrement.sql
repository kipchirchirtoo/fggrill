-- Fix the functional gap between bar POS sales and the bar stocktake.
-- When a bar order is completed, the backend calls decrement_bar_stock(p_drink_id, p_branch_id, p_quantity).
-- The old implementation decremented the legacy bar_stock table, which meant the
-- Bar Stock screen (restaurant_bar_inventory) and the Bar Stocktake never saw the sale.
-- This migration rewires the function to decrement restaurant_bar_inventory via the
-- unified inventory_item_id link, while still falling back to bar_stock for legacy consumers.

CREATE OR REPLACE FUNCTION public.decrement_bar_stock(
  p_drink_id UUID,
  p_branch_id INTEGER,
  p_quantity INTEGER
)
RETURNS VOID AS $$
DECLARE
  v_inventory_item_id UUID;
BEGIN
  -- Resolve the unified inventory item for this bar drink.
  SELECT inventory_item_id INTO v_inventory_item_id
  FROM public.bar_drinks
  WHERE id = p_drink_id;

  IF v_inventory_item_id IS NULL THEN
    RAISE NOTICE 'decrement_bar_stock: bar_drinks row % has no inventory_item_id; skipping restaurant_bar_inventory decrement', p_drink_id;
  ELSE
    -- Decrement the live Bar Stock table that the Bar Stocktake reads from.
    UPDATE public.restaurant_bar_inventory
    SET current_bottles = GREATEST(0, COALESCE(current_bottles, 0) - p_quantity),
        current_stock   = GREATEST(0, COALESCE(current_stock, 0) - p_quantity),
        updated_at      = NOW()
    WHERE inventory_item_id = v_inventory_item_id
      AND (branch_id = p_branch_id OR branch_id IS NULL);
  END IF;

  -- Keep the legacy bar_stock table in sync for any old consumers.
  IF to_regclass('public.bar_stock') IS NOT NULL THEN
    UPDATE public.bar_stock
    SET quantity = GREATEST(0, COALESCE(quantity, 0) - p_quantity),
        updated_at = NOW()
    WHERE drink_id = p_drink_id
      AND branch_id = p_branch_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
