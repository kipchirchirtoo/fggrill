-- ============================================================================
-- Atomic POS split-bill creation and atomic, race-free POS payment settlement
-- ============================================================================
-- PURPOSE:
--   1. split_pos_shift_order: creates all split child bills and voids the
--      parent bill in a single transaction, so a failure partway through
--      cannot leave orphaned child orders alongside a still-open parent.
--   2. record_pos_shift_payment: records a payment and updates the order's
--      balance in a single transaction with a row lock on the order, so two
--      concurrent payment requests on the same bill cannot both read a stale
--      balance and clobber each other's contribution.
-- ============================================================================

CREATE OR REPLACE FUNCTION split_pos_shift_order(
  p_order_id uuid,
  p_shift_id uuid,
  p_children jsonb
) RETURNS SETOF pos_shift_orders
LANGUAGE plpgsql
AS $$
DECLARE
  v_order pos_shift_orders;
  v_child jsonb;
BEGIN
  SELECT * INTO v_order
  FROM pos_shift_orders
  WHERE id = p_order_id AND shift_id = p_shift_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POS order not found';
  END IF;

  IF v_order.payment_status IN ('paid', 'credit_bill', 'voided')
     OR v_order.status IN ('paid', 'credit_bill', 'voided', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot split a cleared, voided, or cancelled bill';
  END IF;

  FOR v_child IN SELECT * FROM jsonb_array_elements(p_children)
  LOOP
    INSERT INTO pos_shift_orders (
      shift_id, outlet_id, source_type, source_id, order_number, customer_name,
      order_type, table_number, room_number, waiter_id, waiter_name,
      status, kitchen_status, kitchen_started_at, kitchen_ready_at, kitchen_served_at,
      payment_status, total_amount, amount_paid, balance_amount, items,
      split_parent_order_id, split_type, created_by
    ) VALUES (
      (v_child->>'shift_id')::uuid,
      (v_child->>'outlet_id')::uuid,
      v_child->>'source_type',
      (v_child->>'source_id')::uuid,
      v_child->>'order_number',
      v_child->>'customer_name',
      v_child->>'order_type',
      v_child->>'table_number',
      v_child->>'room_number',
      (v_child->>'waiter_id')::uuid,
      v_child->>'waiter_name',
      v_child->>'status',
      v_child->>'kitchen_status',
      (v_child->>'kitchen_started_at')::timestamptz,
      (v_child->>'kitchen_ready_at')::timestamptz,
      (v_child->>'kitchen_served_at')::timestamptz,
      v_child->>'payment_status',
      (v_child->>'total_amount')::numeric,
      (v_child->>'amount_paid')::numeric,
      (v_child->>'balance_amount')::numeric,
      (v_child->'items'),
      (v_child->>'split_parent_order_id')::uuid,
      v_child->>'split_type',
      (v_child->>'created_by')::uuid
    );
  END LOOP;

  UPDATE pos_shift_orders
  SET is_split = true,
      status = 'cancelled',
      kitchen_status = 'served',
      payment_status = 'voided',
      balance_amount = 0,
      updated_at = now()
  WHERE id = p_order_id;

  RETURN QUERY
  SELECT * FROM pos_shift_orders WHERE split_parent_order_id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION record_pos_shift_payment(
  p_order_id uuid,
  p_shift_id uuid,
  p_outlet_id uuid,
  p_payment_method text,
  p_amount numeric,
  p_reference text,
  p_received_by uuid
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_order pos_shift_orders;
  v_payment pos_shift_payments;
  v_balance numeric;
  v_next_paid numeric;
  v_next_balance numeric;
  v_next_status text;
BEGIN
  SELECT * INTO v_order
  FROM pos_shift_orders
  WHERE id = p_order_id AND shift_id = p_shift_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POS order not found';
  END IF;

  IF v_order.payment_status IN ('paid', 'credit_bill', 'voided') THEN
    RAISE EXCEPTION 'POS order is already cleared';
  END IF;

  v_balance := GREATEST(0, COALESCE(v_order.balance_amount, v_order.total_amount - v_order.amount_paid));
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;
  IF p_amount - v_balance > 0.01 THEN
    RAISE EXCEPTION 'Payment cannot exceed remaining POS bill balance';
  END IF;

  INSERT INTO pos_shift_payments (
    shift_id, outlet_id, order_id, payment_method, amount, reference, received_by
  ) VALUES (
    p_shift_id, p_outlet_id, p_order_id, p_payment_method, p_amount, p_reference, p_received_by
  ) RETURNING * INTO v_payment;

  v_next_paid := v_order.amount_paid + p_amount;
  v_next_balance := GREATEST(0, v_order.total_amount - v_next_paid);
  v_next_status := CASE
    WHEN v_next_balance <= 0.01 THEN
      CASE WHEN p_payment_method = 'credit_bill' THEN 'credit_bill' ELSE 'paid' END
    ELSE 'partial'
  END;

  UPDATE pos_shift_orders
  SET amount_paid = v_next_paid,
      balance_amount = v_next_balance,
      payment_status = v_next_status,
      status = CASE WHEN v_next_balance <= 0.01 THEN v_next_status ELSE status END,
      updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN jsonb_build_object('payment', to_jsonb(v_payment), 'order', to_jsonb(v_order));
END;
$$;
