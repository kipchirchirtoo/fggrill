-- Fixes two bugs in the post-payment item exchange flow (see
-- 20260622_pos_item_exchange_system.sql for the original schema):
--
-- 1. requestItemExchange only blocked a second request while the first was
--    'pending', so once an exchange was approved, the original bill could be
--    exchanged again. Closed in the TypeScript controller (checks 'pending'
--    and 'approved' now) and surfaced to the client via
--    has_active_exchange_request on getShiftOrders.
--
-- 2. approve_item_exchange set the new linked order's total_amount to either
--    price_difference (top_up) or 0 (refund/even) instead of the actual
--    value of the new item(s) -- so a bill showing "1x Water 500ml KES
--    50.00" printed with a KES 0.00 total. Fixed below: total_amount is now
--    always new_total; amount_paid/balance_amount are derived from it so a
--    top_up ticket still correctly shows only the outstanding top-up as its
--    unpaid balance.

CREATE OR REPLACE FUNCTION public.approve_item_exchange(
  p_request_id UUID,
  p_actioned_by UUID
)
RETURNS public.pos_shift_orders
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_request public.pos_item_exchange_requests%ROWTYPE;
  v_order public.pos_shift_orders%ROWTYPE;
  v_new_order public.pos_shift_orders%ROWTYPE;
  v_order_number TEXT;
  v_total NUMERIC;
  v_amount_paid NUMERIC;
  v_balance NUMERIC;
  v_payment_status TEXT;
  v_status TEXT;
BEGIN
  IF p_request_id IS NULL OR p_actioned_by IS NULL THEN
    RAISE EXCEPTION 'Request id and actioning user are required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_request
  FROM public.pos_item_exchange_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exchange request not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Exchange request already processed'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_order
  FROM public.pos_shift_orders
  WHERE id = v_request.order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original bill not found for this exchange request'
      USING ERRCODE = 'P0001';
  END IF;

  v_order_number := COALESCE(v_order.order_number, v_request.order_number) || '-EX';

  -- The new ticket's total is always the value of the new item(s) -- that is
  -- what's printed on the bill, regardless of direction. For a top_up, the
  -- old payment already covers everything except price_difference, so only
  -- that remainder is left unpaid; refund/even tickets are settled in full
  -- immediately (refund payout, if any, is tracked separately on the
  -- request row via issueExchangeRefund).
  v_total := v_request.new_total;
  IF v_request.direction = 'top_up' THEN
    v_amount_paid := v_total - v_request.price_difference;
    v_payment_status := 'unpaid';
    v_status := 'open';
  ELSE
    v_amount_paid := v_total;
    v_payment_status := 'paid';
    v_status := 'paid';
  END IF;
  v_balance := v_total - v_amount_paid;

  INSERT INTO public.pos_shift_orders (
    shift_id,
    outlet_id,
    branch_id,
    source_type,
    order_number,
    customer_name,
    order_type,
    table_number,
    room_number,
    waiter_id,
    waiter_name,
    status,
    kitchen_status,
    payment_status,
    total_amount,
    amount_paid,
    balance_amount,
    items,
    is_exchange,
    exchange_parent_order_id,
    exchange_request_id,
    created_by
  )
  VALUES (
    v_order.shift_id,
    v_order.outlet_id,
    v_order.branch_id,
    'manual',
    v_order_number,
    v_order.customer_name,
    v_order.order_type,
    v_order.table_number,
    v_order.room_number,
    v_order.waiter_id,
    v_order.waiter_name,
    v_status,
    'pending',
    v_payment_status,
    v_total,
    v_amount_paid,
    v_balance,
    v_request.new_items,
    TRUE,
    v_order.id,
    v_request.id,
    p_actioned_by
  )
  RETURNING * INTO v_new_order;

  UPDATE public.pos_item_exchange_requests
  SET
    status = 'approved',
    cashier_id = p_actioned_by,
    actioned_at = NOW(),
    exchange_order_id = v_new_order.id,
    updated_at = NOW()
  WHERE id = v_request.id;

  RETURN v_new_order;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_item_exchange(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_item_exchange(UUID, UUID) TO service_role;

-- Corrective backfill: recompute totals on every exchange order already
-- created by the old, buggy function (e.g. POS-1782135270687-EX), re-derived
-- from its own request row so this is safe to run any number of times.
UPDATE public.pos_shift_orders eo
SET
  total_amount = req.new_total,
  amount_paid = CASE WHEN req.direction = 'top_up' THEN req.new_total - req.price_difference ELSE req.new_total END,
  balance_amount = CASE WHEN req.direction = 'top_up' THEN req.price_difference ELSE 0 END,
  updated_at = NOW()
FROM public.pos_item_exchange_requests req
WHERE eo.exchange_request_id = req.id
  AND eo.is_exchange = TRUE;

NOTIFY pgrst, 'reload schema';
