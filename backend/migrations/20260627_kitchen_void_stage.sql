-- Inserts a Kitchen (KDS) acknowledgment stage ahead of the existing
-- Cashier stage in both waiter-initiated void-approval pipelines:
--
--   Waiter requests void -> Kitchen (KDS) acknowledges/declines
--     -> Cashier acknowledges/declines (financial effect applied here, so
--        the cashier's own shift close reflects the void)
--     -> Branch Accountant gives final compliance approval/rejection.
--
-- Out of scope: the separate cashier-initiated instant-void tool
-- (cashierVoidWholeBill / cashierVoidLineItems, POST /pos/voids/cashier/*)
-- is untouched by this migration — it does not use pos_item_void_requests
-- or pos_void_requests status machines at all.
--
-- Confirmed against the live DB on 2026-06-27:
--   pos_item_void_requests.status CHECK currently allows
--     pending, void_acknowledged, void_cashier_declined, approved, rejected, expired
--   pos_void_requests.status CHECK currently allows
--     pending, approved, rejected
-- Both constraints are replaced below to add the new kitchen-stage values.
-- Additive only — no existing rows use the new statuses, so this is safe to
-- run on a live table with existing approved/rejected history.

-- ── Item-level void requests ────────────────────────────────────────────────
ALTER TABLE public.pos_item_void_requests
  ADD COLUMN IF NOT EXISTS kitchen_id UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS kitchen_acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kitchen_action TEXT;

ALTER TABLE public.pos_item_void_requests
  DROP CONSTRAINT IF EXISTS pos_item_void_requests_status_check;
ALTER TABLE public.pos_item_void_requests
  ADD CONSTRAINT pos_item_void_requests_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'kitchen_acknowledged'::text,
    'void_kitchen_declined'::text,
    'void_acknowledged'::text,
    'void_cashier_declined'::text,
    'approved'::text,
    'rejected'::text,
    'expired'::text
  ]));

-- Stage 1 (cashier ack) RPC precondition moves from 'pending' to
-- 'kitchen_acknowledged' now that kitchen review happens first. Body is
-- otherwise identical to the version in
-- backend/database/migrations/20260625_void_total_at_cashier_ack.sql.
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

  -- Stage 2: only a kitchen-acknowledged request can be cashier-acknowledged.
  IF v_request.status <> 'kitchen_acknowledged' THEN
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

-- ── Whole-bill void requests ─────────────────────────────────────────────────
ALTER TABLE public.pos_void_requests
  ADD COLUMN IF NOT EXISTS kitchen_id UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS kitchen_acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kitchen_action TEXT,
  ADD COLUMN IF NOT EXISTS cashier_id UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS cashier_acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cashier_action TEXT;

ALTER TABLE public.pos_void_requests
  DROP CONSTRAINT IF EXISTS pos_void_requests_status_check;
ALTER TABLE public.pos_void_requests
  ADD CONSTRAINT pos_void_requests_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'kitchen_acknowledged'::text,
    'void_kitchen_declined'::text,
    'cashier_acknowledged'::text,
    'void_cashier_declined'::text,
    'approved'::text,
    'rejected'::text
  ]));

NOTIFY pgrst, 'reload schema';
