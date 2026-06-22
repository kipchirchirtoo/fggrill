-- Two-stage item void redesign:
-- Stage 1: cashier acknowledges (or declines) → receipt printed
-- Stage 2: manager/accountant approves (or rejects → item reinstated)
--
-- New status values (column is TEXT, no ENUM change needed):
--   pending              → waiter submitted, awaiting cashier
--   void_cashier_declined→ cashier declined, flow ends
--   void_acknowledged    → cashier acknowledged, awaiting manager
--   approved             → manager approved, void finalised
--   rejected             → manager rejected, item reinstated on bill

ALTER TABLE public.pos_item_void_requests
  ADD COLUMN IF NOT EXISTS cashier_id             UUID,
  ADD COLUMN IF NOT EXISTS cashier_acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cashier_action          TEXT,     -- 'acknowledged' | 'declined'
  ADD COLUMN IF NOT EXISTS manager_id              UUID,
  ADD COLUMN IF NOT EXISTS manager_reviewed_at     TIMESTAMPTZ;

-- The original table (20260621_item_level_void_system.sql) only allowed
-- ('pending', 'approved', 'rejected', 'expired'). The two-stage flow inserts
-- 'void_acknowledged' and 'void_cashier_declined', so the constraint must be
-- widened or every cashier acknowledge/decline fails with a check violation.
ALTER TABLE public.pos_item_void_requests
  DROP CONSTRAINT IF EXISTS pos_item_void_requests_status_check;

ALTER TABLE public.pos_item_void_requests
  ADD CONSTRAINT pos_item_void_requests_status_check
  CHECK (status IN ('pending', 'void_acknowledged', 'void_cashier_declined', 'approved', 'rejected', 'expired'));

-- The void_order_item RPC previously checked status = 'pending'.
-- Stage 2 approve now only fires on 'void_acknowledged' requests.
CREATE OR REPLACE FUNCTION public.void_order_item(p_request_id uuid, p_actioned_by uuid)
 RETURNS pos_shift_orders
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request public.pos_item_void_requests%ROWTYPE;
  v_order public.pos_shift_orders%ROWTYPE;
  v_outlet_type TEXT;
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

  -- Stage 2: request must be cashier-acknowledged before manager can approve.
  IF v_request.status <> 'void_acknowledged' THEN
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

  -- Apply the void and clear the pending-approval visual flag set at Stage 1.
  v_updated_item := v_item
    || jsonb_build_object(
      'voided_qty',           v_voided_qty_after,
      'active_qty',           v_active_qty_after,
      'is_fully_voided',      v_active_qty_after <= 0,
      'active_total',         v_active_qty_after * v_unit_price,
      'void_pending_approval', false
    );

  v_new_items := jsonb_set(v_order.items, ARRAY[v_request.item_index::TEXT], v_updated_item);
  v_new_total := GREATEST(v_order.total_amount - v_amount_voided, 0);
  v_new_balance := GREATEST(v_order.balance_amount - v_amount_voided, 0);

  SELECT outlet_type INTO v_outlet_type
  FROM public.pos_outlets
  WHERE id = v_order.outlet_id;

  UPDATE public.pos_shift_orders
  SET items = v_new_items,
      total_amount = v_new_total,
      balance_amount = v_new_balance,
      updated_at = NOW()
  WHERE id = v_order.id
  RETURNING * INTO v_order;

  INSERT INTO public.pos_item_void_log (
    void_request_id, shift_id, order_id, item_index, item_name, unit_price,
    qty_before_void, qty_voided, qty_after_void, amount_voided,
    authorized_by, requested_by, void_reason, reason_category,
    branch_id, outlet_type, bill_code, voided_at
  )
  VALUES (
    v_request.id, v_request.shift_id, v_request.order_id, v_request.item_index,
    v_request.item_name, v_unit_price,
    v_active_qty_before, v_request.qty_to_void, v_active_qty_after, v_amount_voided,
    p_actioned_by, v_request.requested_by, v_request.reason, v_request.reason_category,
    v_request.branch_id, v_outlet_type, v_order.short_code, NOW()
  );

  UPDATE public.pos_item_void_requests
  SET status = 'approved',
      actioned_by = p_actioned_by,
      actioned_at = NOW(),
      manager_id = p_actioned_by,
      manager_reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = v_request.id;

  RETURN v_order;
END;
$function$;

NOTIFY pgrst, 'reload schema';
