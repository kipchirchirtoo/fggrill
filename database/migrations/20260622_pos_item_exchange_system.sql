-- Post-payment item exchange system for outlet POS bills.
--
-- Distinct from both void systems: the original bill is a closed, paid
-- pos_shift_orders row and is NEVER mutated by this flow (it remains the
-- historical record of what was actually collected that day). An exchange
-- creates a brand-new, linked pos_shift_orders row carrying the new item(s)
-- -- this is what the kitchen sees and, when a top-up is owed, what the
-- cashier collects against. Approval is single-stage and cashier-only (no
-- manager/accountant mutation access -- they get read-only history via
-- getExchangeHistory in the controller).

CREATE TABLE IF NOT EXISTS pos_item_exchange_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES pos_outlet_shifts(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES pos_outlets(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES pos_shift_orders(id) ON DELETE CASCADE,
  order_number TEXT,
  -- Items being returned (taken from the original bill) and items the
  -- customer wants instead. Each element: { item_index, outlet_item_id,
  -- name, unit_price, quantity }. item_index on old_items refers to the
  -- position in the ORIGINAL order's items array, kept only for display/
  -- audit -- it is never used to mutate that array.
  old_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  new_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  old_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  new_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- new_total - old_total. Positive = customer owes a top-up, negative =
  -- cashier owes a refund, zero = straight exchange.
  price_difference NUMERIC(14,2) NOT NULL DEFAULT 0,
  direction TEXT NOT NULL CHECK (direction IN ('top_up', 'refund', 'even')),
  reason TEXT,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  cashier_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actioned_at TIMESTAMPTZ,
  rejection_reason TEXT,
  -- The new linked pos_shift_orders row, set once the cashier approves.
  exchange_order_id UUID REFERENCES pos_shift_orders(id) ON DELETE SET NULL,
  refund_amount NUMERIC(14,2),
  refund_issued_at TIMESTAMPTZ,
  refund_issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_item_exchange_requests_status
  ON pos_item_exchange_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_item_exchange_requests_branch
  ON pos_item_exchange_requests(branch_id, status);

CREATE INDEX IF NOT EXISTS idx_pos_item_exchange_requests_order
  ON pos_item_exchange_requests(order_id);

CREATE INDEX IF NOT EXISTS idx_pos_item_exchange_requests_shift
  ON pos_item_exchange_requests(shift_id, status);

CREATE INDEX IF NOT EXISTS idx_pos_item_exchange_requests_requested_by
  ON pos_item_exchange_requests(requested_by);

CREATE INDEX IF NOT EXISTS idx_pos_item_exchange_requests_exchange_order
  ON pos_item_exchange_requests(exchange_order_id);

-- DB-level backstop: only one pending exchange request per original bill
-- at a time. The approve/reject controller also re-checks status under
-- FOR UPDATE inside approve_item_exchange, but this makes the race
-- condition impossible even under concurrent inserts.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_item_exchange_requests_one_pending_per_order
  ON pos_item_exchange_requests(order_id)
  WHERE status = 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_pos_item_exchange_requests_updated_at'
  ) THEN
    CREATE TRIGGER set_pos_item_exchange_requests_updated_at
    BEFORE UPDATE ON pos_item_exchange_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_item_exchange_requests;

-- Linking columns on pos_shift_orders, following the same convention as
-- is_split/split_parent_order_id and is_merged/merged_into.
ALTER TABLE pos_shift_orders
  ADD COLUMN IF NOT EXISTS is_exchange BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exchange_parent_order_id UUID REFERENCES pos_shift_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS exchange_request_id UUID REFERENCES pos_item_exchange_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_exchange_parent
  ON pos_shift_orders(exchange_parent_order_id)
  WHERE exchange_parent_order_id IS NOT NULL;

-- Atomic execution of an approved exchange: validates the request is still
-- pending, inserts the new linked order carrying the new item(s), and marks
-- the request approved -- all under a row lock so two concurrent approvals
-- on the same request cannot both succeed. Stock movement (returning the
-- old item, deducting the new item) and kitchen/cashier notifications are
-- handled by the controller after this returns, since postPosInventorySale
-- is a TypeScript service, not something this function can call directly.
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

  -- direction='top_up': a small unpaid bill the cashier collects against,
  -- equal to the price difference. direction='refund'/'even': nothing left
  -- to collect on this ticket -- it is closed immediately; refund payout is
  -- tracked separately on the request row via issueExchangeRefund.
  IF v_request.direction = 'top_up' THEN
    v_total := v_request.price_difference;
    v_payment_status := 'unpaid';
    v_status := 'open';
  ELSE
    v_total := 0;
    v_payment_status := 'paid';
    v_status := 'paid';
  END IF;

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
    0,
    v_total,
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

NOTIFY pgrst, 'reload schema';
