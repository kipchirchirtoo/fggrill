-- Fix a lost-update race in POS stock decrements: updateStockForItems()
-- (outlet-pos.controller.ts) does SELECT current value, compute new value
-- in application code, then UPDATE -- two concurrent sales on the same item
-- can both read the same stale value and one decrement gets silently lost.
--
-- Note: assertPosStockAvailable() deliberately allows overselling (stock
-- can go negative, reconciled at stocktake) -- this migration does not
-- change that. It only makes the write itself atomic; it does not add a
-- stock-availability gate.
--
-- These two RPCs replace the read-then-write WRITE step only. The
-- surrounding branching logic in updateStockForItems (pool-shared items,
-- bar-sourced items routed through recordBarStockMovement) is unchanged --
-- this migration deliberately does not touch that, since recordBarStockMovement
-- is a separate, already-reasoned-about service with its own multi-table sync.

-- p_outlet_id is an extra safety filter for the "decrement this exact
-- outlet's own item" call sites; pass NULL to skip it (the original
-- pool-shared-item decrement only ever filtered by id, never by outlet_id,
-- since a pool item's own outlet_id may differ from the selling item's).
CREATE OR REPLACE FUNCTION public.decrement_pos_outlet_item_stock(
  p_item_id UUID,
  p_outlet_id UUID,
  p_quantity_delta NUMERIC
)
RETURNS public.pos_outlet_items
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item public.pos_outlet_items%ROWTYPE;
BEGIN
  UPDATE public.pos_outlet_items
  SET current_stock = GREATEST(0, COALESCE(current_stock, 0) - p_quantity_delta),
      updated_at = NOW()
  WHERE id = p_item_id
    AND (p_outlet_id IS NULL OR outlet_id = p_outlet_id)
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

REVOKE ALL ON FUNCTION public.decrement_pos_outlet_item_stock(UUID, UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_pos_outlet_item_stock(UUID, UUID, NUMERIC) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_pos_shift_stock_count_sale(
  p_shift_id UUID,
  p_outlet_item_id UUID,
  p_quantity_delta NUMERIC
)
RETURNS public.pos_shift_stock_counts
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_row public.pos_shift_stock_counts%ROWTYPE;
BEGIN
  UPDATE public.pos_shift_stock_counts
  SET sold_quantity = GREATEST(0, COALESCE(sold_quantity, 0) + p_quantity_delta),
      system_closing_stock = COALESCE(opening_stock, 0) + COALESCE(additions, 0)
        - GREATEST(0, COALESCE(sold_quantity, 0) + p_quantity_delta),
      variance = CASE
        WHEN physical_count IS NULL THEN 0
        ELSE physical_count - (
          COALESCE(opening_stock, 0) + COALESCE(additions, 0)
          - GREATEST(0, COALESCE(sold_quantity, 0) + p_quantity_delta)
        )
      END,
      updated_at = NOW()
  WHERE shift_id = p_shift_id
    AND outlet_item_id = p_outlet_item_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_pos_shift_stock_count_sale(UUID, UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_pos_shift_stock_count_sale(UUID, UUID, NUMERIC) TO service_role;

NOTIFY pgrst, 'reload schema';
