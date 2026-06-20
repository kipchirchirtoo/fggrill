-- Item-level void system for outlet POS bills.
--
-- pos_shift_orders.items is a JSONB array (no relational order_items table
-- backs live bills), so per-item void state is tracked inline on each item
-- object (voided_qty / active_qty / is_fully_voided / active_total) rather
-- than as real generated columns, which Postgres cannot apply to elements
-- inside a JSONB array. This sits alongside the existing whole-bill void
-- system (pos_void_requests / requestVoidShiftOrder / reviewPosVoidRequest)
-- without replacing it -- a waiter can still void an entire bill via that
-- flow, or void individual line items via this one.

CREATE TABLE IF NOT EXISTS pos_item_void_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES pos_outlet_shifts(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES pos_outlets(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES pos_shift_orders(id) ON DELETE CASCADE,
  order_number TEXT,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  -- Position of the item within pos_shift_orders.items (no per-line id
  -- exists today; split-bill already references items the same way via
  -- item_indexes).
  item_index INTEGER NOT NULL CHECK (item_index >= 0),
  item_name TEXT NOT NULL,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  qty_before_void NUMERIC(14,3) NOT NULL,
  qty_to_void NUMERIC(14,3) NOT NULL CHECK (qty_to_void > 0),
  reason TEXT NOT NULL,
  reason_category TEXT NOT NULL DEFAULT 'other'
    CHECK (reason_category IN ('wrong_order', 'duplicate_entry', 'customer_changed_mind', 'pricing_error', 'other')),
  note TEXT,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  actioned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  actioned_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_item_void_requests_status
  ON pos_item_void_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_item_void_requests_branch
  ON pos_item_void_requests(branch_id, status);

CREATE INDEX IF NOT EXISTS idx_pos_item_void_requests_order
  ON pos_item_void_requests(order_id);

CREATE INDEX IF NOT EXISTS idx_pos_item_void_requests_shift
  ON pos_item_void_requests(shift_id, status);

CREATE INDEX IF NOT EXISTS idx_pos_item_void_requests_requested_by
  ON pos_item_void_requests(requested_by);

-- DB-level backstop for "first to act wins": only one pending request per
-- line item at a time. The approve/reject RPC and controller also re-check
-- status under FOR UPDATE, but this index makes the race condition
-- impossible even under concurrent inserts.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_item_void_requests_one_pending_per_item
  ON pos_item_void_requests(order_id, item_index)
  WHERE status = 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_pos_item_void_requests_updated_at'
  ) THEN
    CREATE TRIGGER set_pos_item_void_requests_updated_at
    BEFORE UPDATE ON pos_item_void_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;

-- Append-only audit trail of every approved item void, independent of the
-- request's lifecycle row above, queryable per waiter/shift/branch.
CREATE TABLE IF NOT EXISTS pos_item_void_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  void_request_id UUID REFERENCES pos_item_void_requests(id) ON DELETE SET NULL,
  shift_id UUID NOT NULL REFERENCES pos_outlet_shifts(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES pos_shift_orders(id) ON DELETE CASCADE,
  item_index INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  qty_before_void NUMERIC(14,3) NOT NULL,
  qty_voided NUMERIC(14,3) NOT NULL,
  qty_after_void NUMERIC(14,3) NOT NULL,
  amount_voided NUMERIC(14,2) NOT NULL,
  authorized_by UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  void_reason TEXT,
  reason_category TEXT,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  outlet_type TEXT,
  bill_code TEXT,
  voided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_item_void_log_shift
  ON pos_item_void_log(shift_id);

CREATE INDEX IF NOT EXISTS idx_pos_item_void_log_order
  ON pos_item_void_log(order_id);

CREATE INDEX IF NOT EXISTS idx_pos_item_void_log_requested_by
  ON pos_item_void_log(requested_by, voided_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_item_void_log_branch
  ON pos_item_void_log(branch_id, voided_at DESC);

-- Realtime: all roles must see pending/approved/rejected updates live with
-- no polling. Client subscriptions filter by branch_id themselves (same
-- pattern as the existing communications channels below).
ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_item_void_requests;

-- Atomic execution of an approved item void: validates the request is still
-- pending, mutates the matching item inside pos_shift_orders.items (adds
-- voided_qty / active_qty / is_fully_voided / active_total onto that item's
-- JSON object without touching its original quantity), deducts the voided
-- amount from the bill's total/balance, writes the audit row, and marks the
-- request approved -- all under row locks so two concurrent approvals on the
-- same request cannot both succeed.
CREATE OR REPLACE FUNCTION public.void_order_item(
  p_request_id UUID,
  p_actioned_by UUID
)
RETURNS public.pos_shift_orders
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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

  SELECT *
  INTO v_request
  FROM public.pos_item_void_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Void request not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Void request already processed'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_order
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

  v_updated_item := v_item
    || jsonb_build_object(
      'voided_qty', v_voided_qty_after,
      'active_qty', v_active_qty_after,
      'is_fully_voided', v_active_qty_after <= 0,
      'active_total', v_active_qty_after * v_unit_price
    );

  v_new_items := jsonb_set(v_order.items, ARRAY[v_request.item_index::TEXT], v_updated_item);
  v_new_total := GREATEST(v_order.total_amount - v_amount_voided, 0);
  v_new_balance := GREATEST(v_order.balance_amount - v_amount_voided, 0);

  SELECT outlet_type INTO v_outlet_type
  FROM public.pos_outlets
  WHERE id = v_order.outlet_id;

  UPDATE public.pos_shift_orders
  SET
    items = v_new_items,
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
  SET
    status = 'approved',
    actioned_by = p_actioned_by,
    actioned_at = NOW(),
    updated_at = NOW()
  WHERE id = v_request.id;

  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.void_order_item(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_order_item(UUID, UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
