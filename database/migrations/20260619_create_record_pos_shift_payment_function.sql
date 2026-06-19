-- Create the POS cashier payment RPC expected by the backend.
-- This records a payment row and updates the order totals atomically.

CREATE OR REPLACE FUNCTION public.record_pos_shift_payment(
  p_amount NUMERIC,
  p_order_id UUID,
  p_outlet_id UUID,
  p_payment_method TEXT,
  p_received_by UUID,
  p_reference TEXT,
  p_shift_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_order public.pos_shift_orders%ROWTYPE;
  v_payment public.pos_shift_payments%ROWTYPE;
  v_total_amount NUMERIC(14,2);
  v_new_amount_paid NUMERIC(14,2);
  v_new_balance NUMERIC(14,2);
  v_payment_method TEXT;
  v_payment_status TEXT;
  v_order_status TEXT;
  v_remaining_balance NUMERIC(14,2);
BEGIN
  v_payment_method := LOWER(TRIM(COALESCE(p_payment_method, '')));

  IF p_order_id IS NULL OR p_shift_id IS NULL OR p_outlet_id IS NULL THEN
    RAISE EXCEPTION 'Order, shift, and outlet are required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_payment_method NOT IN ('cash', 'mpesa', 'card', 'credit_bill') THEN
    RAISE EXCEPTION 'Unsupported POS payment method: %', p_payment_method
      USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_order
  FROM public.pos_shift_orders
  WHERE id = p_order_id
    AND shift_id = p_shift_id
    AND outlet_id = p_outlet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POS order not found for the supplied shift/outlet'
      USING ERRCODE = 'P0001';
  END IF;

  IF LOWER(COALESCE(v_order.payment_status, '')) IN ('paid', 'credit_bill', 'voided') THEN
    RAISE EXCEPTION 'POS order is already cleared'
      USING ERRCODE = 'P0001';
  END IF;

  v_total_amount := ROUND(COALESCE(v_order.total_amount, 0)::NUMERIC, 2);
  v_remaining_balance := ROUND(
    GREATEST(
      COALESCE(v_order.balance_amount, v_total_amount - COALESCE(v_order.amount_paid, 0)),
      0
    )::NUMERIC,
    2
  );

  IF v_payment_method <> 'credit_bill' AND p_amount > v_remaining_balance + 0.01 THEN
    RAISE EXCEPTION 'Payment amount % exceeds remaining balance %', p_amount, v_remaining_balance
      USING ERRCODE = 'P0001';
  END IF;

  IF v_payment_method = 'credit_bill' THEN
    v_new_amount_paid := v_total_amount;
    v_new_balance := 0;
    v_payment_status := 'credit_bill';
    v_order_status := 'credit_bill';
  ELSE
    v_new_amount_paid := ROUND(
      LEAST(v_total_amount, COALESCE(v_order.amount_paid, 0) + p_amount)::NUMERIC,
      2
    );
    v_new_balance := ROUND(GREATEST(v_total_amount - v_new_amount_paid, 0)::NUMERIC, 2);
    v_payment_status := CASE
      WHEN v_new_balance <= 0.01 THEN 'paid'
      WHEN v_new_amount_paid > 0 THEN 'partial'
      ELSE 'unpaid'
    END;
    v_order_status := CASE
      WHEN v_payment_status = 'paid' THEN 'paid'
      ELSE 'open'
    END;
  END IF;

  INSERT INTO public.pos_shift_payments (
    shift_id,
    outlet_id,
    order_id,
    payment_method,
    amount,
    reference,
    received_by
  )
  VALUES (
    p_shift_id,
    p_outlet_id,
    p_order_id,
    v_payment_method,
    ROUND(p_amount::NUMERIC, 2),
    NULLIF(TRIM(COALESCE(p_reference, '')), ''),
    p_received_by
  )
  RETURNING * INTO v_payment;

  UPDATE public.pos_shift_orders
  SET
    amount_paid = v_new_amount_paid,
    balance_amount = v_new_balance,
    payment_status = v_payment_status,
    status = v_order_status,
    updated_at = NOW()
  WHERE id = v_order.id
  RETURNING * INTO v_order;

  RETURN jsonb_build_object(
    'payment', to_jsonb(v_payment),
    'order', to_jsonb(v_order)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_pos_shift_payment(NUMERIC, UUID, UUID, TEXT, UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_pos_shift_payment(NUMERIC, UUID, UUID, TEXT, UUID, TEXT, UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
