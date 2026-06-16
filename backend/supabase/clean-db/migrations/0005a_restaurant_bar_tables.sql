-- ============================================================
-- Migration 0005a: Restaurant & Bar module tables
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- RESTAURANT MODULE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.restaurant_menu_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id  INTEGER REFERENCES public.branches(id),
  name       TEXT NOT NULL,
  code       TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.restaurant_menu_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  category_id     UUID REFERENCES public.restaurant_menu_categories(id),
  sku             TEXT,
  name            TEXT NOT NULL,
  description     TEXT,
  unit            TEXT DEFAULT 'portion',
  selling_price   NUMERIC(14,2) DEFAULT 0,
  cost_price      NUMERIC(14,4) DEFAULT 0,
  is_available    BOOLEAN DEFAULT TRUE,
  is_active       BOOLEAN DEFAULT TRUE,
  image_url       TEXT,
  menu_type       TEXT DEFAULT 'menu',
  reorder_level   INTEGER DEFAULT 0,
  stock_quantity  NUMERIC(14,3) DEFAULT 0,
  is_low_stock    BOOLEAN DEFAULT FALSE,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rest_menu_branch ON public.restaurant_menu_items(branch_id, is_active);

CREATE TABLE IF NOT EXISTS public.restaurant_tables (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    INTEGER NOT NULL REFERENCES public.branches(id),
  outlet_id    UUID REFERENCES public.pos_outlets(id),
  table_number TEXT NOT NULL,
  capacity     INTEGER DEFAULT 4,
  status       TEXT DEFAULT 'available'
    CHECK (status IN ('available','occupied','reserved','cleaning')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.restaurant_table_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id    UUID NOT NULL REFERENCES public.restaurant_tables(id),
  order_id    UUID,
  waiter_id   UUID REFERENCES public.users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  released_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.restaurant_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER NOT NULL REFERENCES public.branches(id),
  outlet_id       UUID REFERENCES public.pos_outlets(id),
  shift_id        UUID REFERENCES public.pos_shifts(id),
  order_number    TEXT UNIQUE NOT NULL,
  order_type      TEXT DEFAULT 'dine_in'
    CHECK (order_type IN ('dine_in','takeaway','room_service','delivery','bar')),
  table_number    TEXT,
  room_number     TEXT,
  waiter_name     TEXT,
  customer_name   TEXT,
  short_code      TEXT,
  source          TEXT DEFAULT 'pos',
  payment_status  TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('pending','partial','paid','voided')),
  void_request_status TEXT,
  status          TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','preparing','ready','served','completed','voided','cancelled')),
  subtotal        NUMERIC(14,2) DEFAULT 0,
  tax_amount      NUMERIC(14,2) DEFAULT 0,
  total_amount    NUMERIC(14,2) DEFAULT 0,
  bumped_at       TIMESTAMPTZ,
  created_by      UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rest_orders_branch ON public.restaurant_orders(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_rest_orders_shift  ON public.restaurant_orders(shift_id);

CREATE TABLE IF NOT EXISTS public.restaurant_order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES public.restaurant_orders(id) ON DELETE CASCADE,
  menu_item_id  UUID REFERENCES public.restaurant_menu_items(id),
  item_name     TEXT NOT NULL,
  quantity      NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit_price    NUMERIC(14,2) DEFAULT 0,
  line_total    NUMERIC(14,2) DEFAULT 0,
  notes         TEXT,
  is_ready      BOOLEAN DEFAULT FALSE,
  status        TEXT DEFAULT 'pending',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.restaurant_bills (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER REFERENCES public.branches(id),
  order_id      UUID REFERENCES public.restaurant_orders(id),
  bill_number   TEXT UNIQUE NOT NULL,
  customer_name TEXT,
  subtotal      NUMERIC(14,2) DEFAULT 0,
  tax_amount    NUMERIC(14,2) DEFAULT 0,
  total_amount  NUMERIC(14,2) DEFAULT 0,
  amount_paid   NUMERIC(14,2) DEFAULT 0,
  balance_due   NUMERIC(14,2) DEFAULT 0,
  status        TEXT DEFAULT 'open'
    CHECK (status IN ('open','paid','partial','voided')),
  payment_method TEXT,
  created_by    UUID REFERENCES public.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.restaurant_bill_audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id    UUID REFERENCES public.restaurant_bills(id),
  action     TEXT NOT NULL,
  actor_id   UUID REFERENCES public.users(id),
  details    JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.restaurant_bill_payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id        UUID NOT NULL REFERENCES public.restaurant_bills(id),
  payment_number TEXT UNIQUE NOT NULL,
  method         TEXT NOT NULL CHECK (method IN ('cash','mpesa','card','bank','credit','split')),
  amount         NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  reference      TEXT,
  received_by    UUID REFERENCES public.users(id),
  received_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.restaurant_inventory_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER REFERENCES public.branches(id),
  inventory_item_id UUID REFERENCES public.inventory_items(id),
  name          TEXT NOT NULL,
  unit          TEXT DEFAULT 'unit',
  current_stock NUMERIC(14,3) DEFAULT 0,
  min_stock     NUMERIC(14,3) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.restaurant_inventory_transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    INTEGER REFERENCES public.branches(id),
  item_id      UUID REFERENCES public.restaurant_inventory_items(id),
  txn_type     TEXT NOT NULL,
  quantity     NUMERIC(14,3) NOT NULL,
  reference    TEXT,
  created_by   UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.restaurant_bar_inventory (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER REFERENCES public.branches(id),
  item_name     TEXT NOT NULL,
  unit          TEXT DEFAULT 'unit',
  current_stock NUMERIC(14,3) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.restaurant_pool_token_sales (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id  INTEGER REFERENCES public.branches(id),
  tokens_sold INTEGER DEFAULT 0,
  amount     NUMERIC(14,2) DEFAULT 0,
  sold_by    UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.restaurant_reservations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        INTEGER REFERENCES public.branches(id),
  table_id         UUID REFERENCES public.restaurant_tables(id),
  guest_name       TEXT NOT NULL,
  guest_phone      TEXT,
  pax              INTEGER DEFAULT 1,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  status           TEXT DEFAULT 'confirmed'
    CHECK (status IN ('pending','confirmed','seated','completed','no_show','cancelled')),
  notes            TEXT,
  created_by       UUID REFERENCES public.users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- BAR MODULE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bar_drink_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id  INTEGER REFERENCES public.branches(id),
  name       TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bar_drinks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  outlet_id       UUID REFERENCES public.pos_outlets(id),
  category_id     UUID REFERENCES public.bar_drink_categories(id),
  sku             TEXT,
  name            TEXT NOT NULL,
  unit            TEXT DEFAULT 'tot',
  selling_price   NUMERIC(14,2) DEFAULT 0,
  cost_price      NUMERIC(14,4) DEFAULT 0,
  is_available    BOOLEAN DEFAULT TRUE,
  is_active       BOOLEAN DEFAULT TRUE,
  image_url       TEXT,
  stock_quantity  NUMERIC(14,3) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bar_drinks_branch ON public.bar_drinks(branch_id, is_active);

CREATE TABLE IF NOT EXISTS public.bar_stock (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER NOT NULL REFERENCES public.branches(id),
  outlet_id     UUID REFERENCES public.pos_outlets(id),
  drink_id      UUID REFERENCES public.bar_drinks(id),
  item_sku      TEXT,
  item_name     TEXT,
  current_stock NUMERIC(14,3) DEFAULT 0,
  par_level     NUMERIC(14,3) DEFAULT 0,
  unit          TEXT DEFAULT 'tot',
  low_stock     BOOLEAN DEFAULT FALSE,
  last_updated  TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (branch_id, drink_id)
);

CREATE TABLE IF NOT EXISTS public.bar_stock_ledger (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id      INTEGER REFERENCES public.branches(id),
  drink_id       UUID REFERENCES public.bar_drinks(id),
  transaction_type TEXT NOT NULL,
  quantity       NUMERIC(14,3) NOT NULL,
  opening_balance NUMERIC(14,3) DEFAULT 0,
  closing_balance NUMERIC(14,3) DEFAULT 0,
  reference      TEXT,
  performed_by   UUID REFERENCES public.users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bar_stock_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  drink_id    UUID REFERENCES public.bar_drinks(id),
  quantity    NUMERIC(14,3) DEFAULT 0,
  record_type TEXT NOT NULL,
  reference   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bar_stock_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER NOT NULL REFERENCES public.branches(id),
  outlet_id     UUID REFERENCES public.pos_outlets(id),
  request_number TEXT UNIQUE NOT NULL,
  status        TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','fulfilled')),
  requested_by  UUID REFERENCES public.users(id),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bar_stock_request_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       UUID NOT NULL REFERENCES public.bar_stock_requests(id) ON DELETE CASCADE,
  drink_id         UUID REFERENCES public.bar_drinks(id),
  requested_qty    NUMERIC(14,3) NOT NULL CHECK (requested_qty > 0),
  approved_qty     NUMERIC(14,3) DEFAULT 0,
  unit             TEXT DEFAULT 'tot',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bar_tabs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER NOT NULL REFERENCES public.branches(id),
  outlet_id     UUID REFERENCES public.pos_outlets(id),
  customer_name TEXT NOT NULL,
  running_total NUMERIC(14,2) DEFAULT 0,
  status        TEXT DEFAULT 'open'
    CHECK (status IN ('open','closed','voided')),
  opened_by     UUID REFERENCES public.users(id),
  closed_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bar_tab_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id     UUID NOT NULL REFERENCES public.bar_tabs(id) ON DELETE CASCADE,
  drink_id   UUID REFERENCES public.bar_drinks(id),
  item_name  TEXT NOT NULL,
  quantity   NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(14,2) DEFAULT 0,
  line_total NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bar_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER NOT NULL REFERENCES public.branches(id),
  outlet_id       UUID REFERENCES public.pos_outlets(id),
  tab_id          UUID REFERENCES public.bar_tabs(id),
  order_number    TEXT UNIQUE NOT NULL,
  customer_name   TEXT,
  status          TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','preparing','ready','completed','voided')),
  total           NUMERIC(14,2) DEFAULT 0,
  total_amount    NUMERIC(14,2) DEFAULT 0,
  created_by      UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bar_order_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES public.bar_orders(id) ON DELETE CASCADE,
  drink_id   UUID REFERENCES public.bar_drinks(id),
  item_name  TEXT NOT NULL,
  quantity   NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(14,2) DEFAULT 0,
  line_total NUMERIC(14,2) DEFAULT 0,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Now wire up the bar RPC stubs from migration 0003
CREATE OR REPLACE FUNCTION public.update_tab_total(p_tab_id UUID)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(line_total),0) INTO v_total
  FROM public.bar_tab_items WHERE tab_id = p_tab_id;

  UPDATE public.bar_tabs SET running_total = v_total, updated_at = NOW()
  WHERE id = p_tab_id;

  RETURN jsonb_build_object('ok', true, 'total', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_bar_stock(
  p_item_id   UUID,
  p_qty       NUMERIC,
  p_outlet_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.bar_stock
  SET current_stock = GREATEST(0, current_stock - p_qty),
      updated_at    = NOW()
  WHERE drink_id = p_item_id
    AND (p_outlet_id IS NULL OR outlet_id = p_outlet_id);

  RETURN jsonb_build_object('ok', true);
END;
$$;
