-- Fix cashier item/whole-bill void totals.
--
-- Item voids must reduce the collectible bill total by the remaining active
-- item quantities, not by stale line totals. Whole-bill voids must carry a
-- zero bill total; the original amount is preserved in void audit tables.

CREATE OR REPLACE FUNCTION public.cashier_acknowledge_item_void(
  p_request_id uuid,
  p_actioned_by uuid
)
RETURNS public.pos_shift_orders
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

  IF v_order.items IS NULL
     OR jsonb_typeof(v_order.items) <> 'array'
     OR v_request.item_index >= jsonb_array_length(v_order.items) THEN
    RAISE EXCEPTION 'Item no longer exists on this bill'
      USING ERRCODE = 'P0001';
  END IF;

  v_item := v_order.items -> v_request.item_index;
  v_quantity := COALESCE((v_item->>'quantity')::NUMERIC, (v_item->>'qty')::NUMERIC, 0);
  v_unit_price := COALESCE((v_item->>'unit_price')::NUMERIC, (v_item->>'price')::NUMERIC, v_request.unit_price, 0);
  v_voided_qty_before := COALESCE((v_item->>'voided_qty')::NUMERIC, 0);
  v_active_qty_before := v_quantity - v_voided_qty_before;

  IF v_request.qty_to_void <= 0 OR v_request.qty_to_void > v_active_qty_before THEN
    RAISE EXCEPTION 'Void quantity exceeds the remaining active quantity for this item'
      USING ERRCODE = 'P0001';
  END IF;

  v_voided_qty_after := v_voided_qty_before + v_request.qty_to_void;
  v_active_qty_after := v_quantity - v_voided_qty_after;
  v_amount_voided := v_request.qty_to_void * v_unit_price;

  v_updated_item := v_item
    || jsonb_build_object(
      'voided_qty',            v_voided_qty_after,
      'active_qty',            v_active_qty_after,
      'is_fully_voided',       v_active_qty_after <= 0,
      'active_total',          v_active_qty_after * v_unit_price,
      'void_pending_approval', true
    );

  v_new_items := jsonb_set(v_order.items, ARRAY[v_request.item_index::TEXT], v_updated_item);

  SELECT COALESCE(SUM(
    CASE
      WHEN COALESCE((item->>'active_total')::NUMERIC, 0) > 0
        THEN COALESCE((item->>'active_total')::NUMERIC, 0)
      WHEN COALESCE((item->>'is_fully_voided')::BOOLEAN, false) = true
        THEN 0
      ELSE GREATEST(
        COALESCE((item->>'active_qty')::NUMERIC,
                 COALESCE((item->>'quantity')::NUMERIC, (item->>'qty')::NUMERIC, 0)
                 - COALESCE((item->>'voided_qty')::NUMERIC, 0)),
        0
      ) * COALESCE((item->>'unit_price')::NUMERIC, (item->>'price')::NUMERIC, 0)
    END
  ), 0)
  INTO v_new_total
  FROM jsonb_array_elements(v_new_items) AS line(item);

  v_new_balance := GREATEST(v_new_total - COALESCE(v_order.amount_paid, 0), 0);

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

-- Repair whole-bill voids that still carry a collectible total.
UPDATE public.pos_shift_orders
SET total_amount = 0,
    balance_amount = 0,
    updated_at = NOW()
WHERE status = 'voided'
   OR payment_status = 'voided';

-- Repair active item-void totals for bills that remain unpaid/partial.
WITH recalculated AS (
  SELECT
    o.id,
    COALESCE(SUM(
      CASE
        WHEN COALESCE((item->>'active_total')::NUMERIC, 0) > 0
          THEN COALESCE((item->>'active_total')::NUMERIC, 0)
        WHEN COALESCE((item->>'is_fully_voided')::BOOLEAN, false) = true
          THEN 0
        ELSE GREATEST(
          COALESCE((item->>'active_qty')::NUMERIC,
                   COALESCE((item->>'quantity')::NUMERIC, (item->>'qty')::NUMERIC, 0)
                   - COALESCE((item->>'voided_qty')::NUMERIC, 0)),
          0
        ) * COALESCE((item->>'unit_price')::NUMERIC, (item->>'price')::NUMERIC, 0)
      END
    ), 0) AS active_total
  FROM public.pos_shift_orders o
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) AS line(item)
  WHERE COALESCE(o.items, '[]'::jsonb) @> '[{"voided_qty": 1}]'::jsonb
    AND COALESCE(o.payment_status, '') IN ('unpaid', 'partial')
  GROUP BY o.id
)
UPDATE public.pos_shift_orders o
SET total_amount = r.active_total,
    balance_amount = GREATEST(r.active_total - COALESCE(o.amount_paid, 0), 0),
    bill_reprint_count = 0,
    updated_at = NOW()
FROM recalculated r
WHERE o.id = r.id;

NOTIFY pgrst, 'reload schema';
