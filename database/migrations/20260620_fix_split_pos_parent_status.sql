-- Split POS bills should retire the parent order using the live
-- pos_shift_orders status vocabulary. Some environments reject 'cancelled'
-- for pos_shift_orders.status, but they consistently allow 'voided'.
-- The parent is still hidden from KDS via kitchen_status='served'; only the
-- accounting/order lifecycle status changes here.

CREATE OR REPLACE FUNCTION public.split_pos_shift_order(
  p_order_id UUID,
  p_shift_id UUID,
  p_children JSONB
)
RETURNS SETOF public.pos_shift_orders
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_order public.pos_shift_orders%ROWTYPE;
  v_child JSONB;
  v_inserted public.pos_shift_orders%ROWTYPE;
BEGIN
  IF p_order_id IS NULL OR p_shift_id IS NULL THEN
    RAISE EXCEPTION 'Order and shift are required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_children IS NULL OR jsonb_typeof(p_children) <> 'array' OR jsonb_array_length(p_children) < 2 THEN
    RAISE EXCEPTION 'At least two split bills are required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_order
  FROM public.pos_shift_orders
  WHERE id = p_order_id
    AND shift_id = p_shift_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POS order not found for the supplied shift'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_order.status <> 'open' THEN
    RAISE EXCEPTION 'Bill has already been cleared or split'
      USING ERRCODE = 'P0001';
  END IF;

  FOR v_child IN SELECT * FROM jsonb_array_elements(p_children)
  LOOP
    INSERT INTO public.pos_shift_orders (
      shift_id,
      outlet_id,
      branch_id,
      source_type,
      source_id,
      order_number,
      customer_name,
      order_type,
      table_number,
      room_number,
      waiter_id,
      waiter_name,
      status,
      kitchen_status,
      kitchen_started_at,
      kitchen_ready_at,
      kitchen_served_at,
      payment_status,
      total_amount,
      amount_paid,
      balance_amount,
      items,
      split_parent_order_id,
      split_type,
      created_by
    )
    VALUES (
      (v_child->>'shift_id')::UUID,
      (v_child->>'outlet_id')::UUID,
      (v_child->>'branch_id')::INTEGER,
      COALESCE(v_child->>'source_type', 'manual'),
      NULLIF(v_child->>'source_id', '')::UUID,
      v_child->>'order_number',
      v_child->>'customer_name',
      v_child->>'order_type',
      v_child->>'table_number',
      v_child->>'room_number',
      NULLIF(v_child->>'waiter_id', '')::UUID,
      v_child->>'waiter_name',
      COALESCE(v_child->>'status', 'open'),
      COALESCE(v_child->>'kitchen_status', 'served'),
      (v_child->>'kitchen_started_at')::TIMESTAMPTZ,
      (v_child->>'kitchen_ready_at')::TIMESTAMPTZ,
      (v_child->>'kitchen_served_at')::TIMESTAMPTZ,
      COALESCE(v_child->>'payment_status', 'unpaid'),
      COALESCE((v_child->>'total_amount')::NUMERIC, 0),
      COALESCE((v_child->>'amount_paid')::NUMERIC, 0),
      COALESCE((v_child->>'balance_amount')::NUMERIC, 0),
      COALESCE(v_child->'items', '[]'::jsonb),
      NULLIF(v_child->>'split_parent_order_id', '')::UUID,
      v_child->>'split_type',
      NULLIF(v_child->>'created_by', '')::UUID
    )
    RETURNING * INTO v_inserted;

    RETURN NEXT v_inserted;
  END LOOP;

  UPDATE public.pos_shift_orders
  SET
    is_split = TRUE,
    status = 'voided',
    payment_status = 'voided',
    kitchen_status = 'served',
    balance_amount = 0,
    updated_at = NOW()
  WHERE id = p_order_id;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.split_pos_shift_order(UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.split_pos_shift_order(UUID, UUID, JSONB) TO service_role;

NOTIFY pgrst, 'reload schema';
