-- ============================================================================
-- MASTER BILLS — one customer, one master bill, one receipt; every item still
-- assigned to its supplying outlet, and every outlet cashier confirms their
-- part of the settlement.
--
-- A customer seated at (say) the Sports Bar orders drinks there, food from the
-- Restaurant and a platter from Choma. All three are separate pos_shift_orders
-- in their OWN outlet shifts (so prep printing, stock and revenue stay per
-- outlet), grouped under ONE pos_master_bills row. The origin-outlet cashier
-- (the "settlement cashier") collects the whole amount; the other outlets'
-- sub-bills are auto-settled and each outlet cashier confirms their portion.
-- ============================================================================

-- Per-branch human-friendly master bill numbers, e.g. KYO-000245.
CREATE TABLE IF NOT EXISTS public.pos_master_bill_counters (
  branch_id   integer PRIMARY KEY,
  last_number integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.pos_master_bills (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_bill_number       text UNIQUE NOT NULL,
  branch_id                integer NOT NULL,
  origin_outlet_id         uuid,                 -- where the customer is seated
  origin_outlet_name       text,
  table_number             text,
  customer_name            text,
  opening_waiter_id        uuid,
  opening_waiter_name      text,
  -- Settlement (filled when the origin cashier collects payment).
  settlement_cashier_id    uuid,
  settlement_cashier_name  text,
  payment_method           text,
  -- open | bill_requested | payment_received | closed
  status                   text NOT NULL DEFAULT 'open',
  total_amount             numeric NOT NULL DEFAULT 0,
  amount_paid              numeric NOT NULL DEFAULT 0,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  bill_requested_at        timestamptz,
  paid_at                  timestamptz,
  closed_at                timestamptz
);
CREATE INDEX IF NOT EXISTS idx_pos_master_bills_branch_status
  ON public.pos_master_bills (branch_id, status);

-- Per-outlet settlement allocation within a master bill — the "sub-bill" ledger
-- the responsible outlet cashier confirms.
CREATE TABLE IF NOT EXISTS public.pos_master_bill_settlements (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_bill_id        uuid NOT NULL REFERENCES public.pos_master_bills(id) ON DELETE CASCADE,
  branch_id             integer NOT NULL,
  outlet_id             uuid NOT NULL,
  outlet_name           text,
  amount                numeric NOT NULL DEFAULT 0,
  is_origin             boolean NOT NULL DEFAULT false,  -- the settlement cashier's own outlet
  collecting_cashier_id uuid,                            -- who physically took the money
  -- open | settled | cashier_confirmed | disputed
  status                text NOT NULL DEFAULT 'open',
  confirmed_by          uuid,
  confirmed_at          timestamptz,
  dispute_reason        text,
  payment_method        text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (master_bill_id, outlet_id)
);
CREATE INDEX IF NOT EXISTS idx_pos_master_bill_settlements_outlet
  ON public.pos_master_bill_settlements (branch_id, outlet_id, status);

-- Orders belong to a master bill; sub_bill_status tracks the per-order lifecycle
-- (open -> prepared -> included -> settled -> cashier_confirmed). master_bill_id
-- NULL = standalone order (previous behaviour, unchanged).
ALTER TABLE public.pos_shift_orders
  ADD COLUMN IF NOT EXISTS master_bill_id  uuid,
  ADD COLUMN IF NOT EXISTS sub_bill_status text NOT NULL DEFAULT 'open';
CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_master_bill
  ON public.pos_shift_orders (master_bill_id) WHERE master_bill_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_waiter_open
  ON public.pos_shift_orders (branch_id, waiter_id, payment_status);

-- Atomically allocate the next master bill number for a branch (KYO-000245).
CREATE OR REPLACE FUNCTION public.next_master_bill_number(p_branch_id integer)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_next integer;
  v_code text;
BEGIN
  INSERT INTO public.pos_master_bill_counters (branch_id, last_number)
  VALUES (p_branch_id, 1)
  ON CONFLICT (branch_id)
  DO UPDATE SET last_number = public.pos_master_bill_counters.last_number + 1
  RETURNING last_number INTO v_next;

  SELECT COALESCE(NULLIF(btrim(code), ''), 'BR' || p_branch_id)
    INTO v_code FROM public.branches WHERE id = p_branch_id;
  IF v_code IS NULL THEN v_code := 'BR' || p_branch_id; END IF;

  RETURN v_code || '-' || lpad(v_next::text, 6, '0');
END;
$$;
