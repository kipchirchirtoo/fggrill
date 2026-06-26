-- Reset the bill reprint count to 0 when the cashier acknowledges an item void request.
--
-- Why: The bill balance and contents have changed, making it a new version of the bill
-- rather than a duplicate reprint. The cashier must be able to print this updated bill
-- for the customer.
--

CREATE OR REPLACE FUNCTION public.cashier_acknowledge_item_void(p_request_id uuid, p_actioned_by uuid)
 RETURNS pos_shift_orders
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request public.pos_item_void_requests%ROWTYPE;
  v_order public.pos_shift_orders%ROWTYPE;
  v_item JSONB;
  v_quantity NUMERIC;
  v_unit_price NUMERIC;
  v_voided_qty_before NUMERIC;
  v_active_qty_before NUMERIC;
  v_active_qty_after NUMERIC;
  v_voided_qty_after NUMERIC;
  v_amount_voided NUMERIC;
  v_updated_item JSONB;
  v_new_items JSONB;
  v_new_total NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  IF p_request_id IS NULL OR p_actioned_by IS NULL THEN
    RAISE EXCEPTION 'Request id and actioning user are required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_request
  FROM public.pos_item_void_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Void request not found'
      USING ERRCODE = 'P0001';
  END IF;

  -- Stage 1: only a freshly-submitted (waiter) request can be acknowledged.
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Void request already processed'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_order
  FROM public.pos_shift_orders
  WHERE id = v_request.order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bill not found for this void request'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_order.items IS NULL OR jsonb_typeof(v_order.items) <> 'array'
     OR v_request.item_index >= jsonb_array_length(v_order.items) THEN
    RAISE EXCEPTION 'Item no longer exists on this bill'
      USING ERRCODE = 'P0001';
  END IF;

  v_item := v_order.items -> v_request.item_index;
  v_quantity := COALESCE((v_item->>'quantity')::NUMERIC, 0);
  v_unit_price := COALESCE((v_item->>'unit_price')::NUMERIC, v_request.unit_price, 0);
  v_voided_qty_before := COALESCE((v_item->>'voided_qty')::NUMERIC, 0);
  v_active_qty_before := v_quantity - v_voided_qty_before;

  IF v_request.qty_to_void > v_active_qty_before THEN
    RAISE EXCEPTION 'Void quantity exceeds the remaining active quantity for this item'
      USING ERRCODE = 'P0001';
  END IF;

  v_voided_qty_after := v_voided_qty_before + v_request.qty_to_void;
  v_active_qty_after := v_quantity - v_voided_qty_after;
  v_amount_voided := v_request.qty_to_void * v_unit_price;

  -- Apply the void to the bill now. void_pending_approval stays true so the
  -- item is still hidden from the customer-facing line list until the
  -- manager formally signs off, but the financial totals below are final.
  v_updated_item := v_item
    || jsonb_build_object(
      'voided_qty',            v_voided_qty_after,
      'active_qty',            v_active_qty_after,
      'is_fully_voided',       v_active_qty_after <= 0,
      'active_total',          v_active_qty_after * v_unit_price,
      'void_pending_approval',  true
    );

  v_new_items := jsonb_set(v_order.items, ARRAY[v_request.item_index::TEXT], v_updated_item);
  v_new_total := GREATEST(v_order.total_amount - v_amount_voided, 0);
  v_new_balance := GREATEST(v_order.balance_amount - v_amount_voided, 0);

  UPDATE public.pos_shift_orders
  SET items = v_new_items,
      total_amount = v_new_total,
      balance_amount = v_new_balance,
      bill_reprint_count = 0,
      updated_at = NOW()
  WHERE id = v_order.id
  RETURNING * INTO v_order;

  UPDATE public.pos_item_void_requests
  SET status = 'void_acknowledged',
      cashier_id = p_actioned_by,
      cashier_acknowledged_at = NOW(),
      cashier_action = 'acknowledged',
      updated_at = NOW()
  WHERE id = v_request.id;

  RETURN v_order;
END;
$function$;

REVOKE ALL ON FUNCTION public.cashier_acknowledge_item_void(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cashier_acknowledge_item_void(UUID, UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
