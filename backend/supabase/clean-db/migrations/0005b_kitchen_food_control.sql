-- ============================================================
-- Migration 0005b: Kitchen module + Food control tables
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- KITCHEN MODULE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kitchen_stock (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER NOT NULL REFERENCES public.branches(id),
  item_sku      TEXT NOT NULL,
  item_name     TEXT,
  category      TEXT,
  unit          TEXT DEFAULT 'kg',
  current_balance NUMERIC(14,3) DEFAULT 0,
  last_updated  TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (branch_id, item_sku)
);
CREATE INDEX IF NOT EXISTS idx_kstock_branch ON public.kitchen_stock(branch_id);

CREATE TABLE IF NOT EXISTS public.kitchen_stock_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  item_sku        TEXT NOT NULL,
  item_name       TEXT,
  transaction_type TEXT NOT NULL,
  reference_type  TEXT,
  reference_id    UUID,
  opening_balance NUMERIC(14,3) DEFAULT 0,
  quantity_in     NUMERIC(14,3) DEFAULT 0,
  quantity_out    NUMERIC(14,3) DEFAULT 0,
  closing_balance NUMERIC(14,3) DEFAULT 0,
  unit_of_measure TEXT DEFAULT 'unit',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kitchen_ledger_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER REFERENCES public.branches(id),
  ledger_id     UUID REFERENCES public.kitchen_stock_ledger(id),
  entry_number  TEXT UNIQUE NOT NULL,
  entry_type    TEXT NOT NULL,
  amount        NUMERIC(14,2) DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kitchen_usage_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER NOT NULL REFERENCES public.branches(id),
  dispatch_id     UUID,
  item_sku        TEXT NOT NULL,
  usage_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  received_quantity NUMERIC(14,3) DEFAULT 0,
  unit_cost       NUMERIC(14,4) DEFAULT 0,
  expected_revenue NUMERIC(14,2) DEFAULT 0,
  actual_revenue  NUMERIC(14,2),
  usage_type      TEXT DEFAULT 'standard',
  status          TEXT DEFAULT 'open'
    CHECK (status IN ('open','closed','approved')),
  recorded_by     UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kitchen_usage_entries (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_record_id      UUID NOT NULL REFERENCES public.kitchen_usage_records(id) ON DELETE CASCADE,
  item_sku             TEXT NOT NULL,
  quantity             NUMERIC(14,3) NOT NULL CHECK (quantity >= 0),
  responsible_staff_id UUID REFERENCES public.users(id),
  responsible_staff_name TEXT,
  reason               TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kitchen_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  usage_record_id UUID REFERENCES public.kitchen_usage_records(id),
  item_sku        TEXT NOT NULL,
  consumed_quantity  NUMERIC(14,3) DEFAULT 0,
  spoilt_quantity    NUMERIC(14,3) DEFAULT 0,
  lost_quantity      NUMERIC(14,3) DEFAULT 0,
  damaged_quantity   NUMERIC(14,3) DEFAULT 0,
  expired_quantity   NUMERIC(14,3) DEFAULT 0,
  returned_quantity  NUMERIC(14,3) DEFAULT 0,
  usage_date      DATE DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kitchen_portion_stock (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER REFERENCES public.branches(id),
  item_sku      TEXT NOT NULL,
  portions      NUMERIC(14,3) DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (branch_id, item_sku)
);

CREATE TABLE IF NOT EXISTS public.kitchen_portion_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  ledger_number   TEXT UNIQUE NOT NULL,
  item_sku        TEXT NOT NULL,
  opening_portions NUMERIC(14,3) DEFAULT 0,
  added_portions  NUMERIC(14,3) DEFAULT 0,
  sold_portions   NUMERIC(14,3) DEFAULT 0,
  closing_portions NUMERIC(14,3) DEFAULT 0,
  period_date     DATE DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kitchen_portion_tracking (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  tracking_number TEXT UNIQUE NOT NULL,
  item_sku        TEXT NOT NULL,
  portions_produced NUMERIC(14,3) DEFAULT 0,
  portions_sold   NUMERIC(14,3) DEFAULT 0,
  recorded_by     UUID REFERENCES public.users(id),
  tracking_date   DATE DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kitchen_requisitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER NOT NULL REFERENCES public.branches(id),
  request_number  TEXT UNIQUE NOT NULL,
  status          TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','fulfilled')),
  requested_by    UUID REFERENCES public.users(id),
  approved_by     UUID REFERENCES public.users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kitchen_requisition_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id     UUID NOT NULL REFERENCES public.kitchen_requisitions(id) ON DELETE CASCADE,
  item_sku           TEXT NOT NULL,
  item_name          TEXT,
  requested_quantity NUMERIC(14,3) NOT NULL CHECK (requested_quantity > 0),
  approved_quantity  NUMERIC(14,3) DEFAULT 0,
  unit               TEXT DEFAULT 'kg',
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kitchen_grn (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER NOT NULL REFERENCES public.branches(id),
  grn_number      TEXT UNIQUE NOT NULL,
  requisition_id  UUID REFERENCES public.kitchen_requisitions(id),
  status          TEXT DEFAULT 'posted'
    CHECK (status IN ('draft','posted','voided')),
  received_by     UUID REFERENCES public.users(id),
  received_at     TIMESTAMPTZ DEFAULT NOW(),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kitchen_grn_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id           UUID NOT NULL REFERENCES public.kitchen_grn(id) ON DELETE CASCADE,
  item_sku         TEXT NOT NULL,
  item_name        TEXT,
  quantity_received NUMERIC(14,3) NOT NULL CHECK (quantity_received >= 0),
  unit             TEXT DEFAULT 'kg',
  unit_cost        NUMERIC(14,4) DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kitchen_store_receipts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER NOT NULL REFERENCES public.branches(id),
  receipt_number TEXT UNIQUE NOT NULL,
  grn_id        UUID REFERENCES public.kitchen_grn(id),
  status        TEXT DEFAULT 'issued'
    CHECK (status IN ('draft','issued','voided')),
  issued_by     UUID REFERENCES public.users(id),
  issued_at     TIMESTAMPTZ DEFAULT NOW(),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kitchen_store_receipt_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id     UUID NOT NULL REFERENCES public.kitchen_store_receipts(id) ON DELETE CASCADE,
  item_sku       TEXT NOT NULL,
  item_name      TEXT,
  issued_quantity NUMERIC(14,3) NOT NULL CHECK (issued_quantity > 0),
  unit           TEXT DEFAULT 'kg',
  unit_cost      NUMERIC(14,4) DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kitchen_variance_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id      INTEGER REFERENCES public.branches(id),
  item_sku       TEXT NOT NULL,
  variance_date  DATE DEFAULT CURRENT_DATE,
  expected_qty   NUMERIC(14,3) DEFAULT 0,
  actual_qty     NUMERIC(14,3) DEFAULT 0,
  variance_qty   NUMERIC(14,3) DEFAULT 0,
  variance_pct   NUMERIC(8,4) DEFAULT 0,
  severity       TEXT DEFAULT 'low',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kitchen_variance_reasons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  variance_id UUID REFERENCES public.kitchen_variance_logs(id),
  reason      TEXT NOT NULL,
  recorded_by UUID REFERENCES public.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kitchen_food_controls (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER NOT NULL REFERENCES public.branches(id),
  control_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  shift         TEXT DEFAULT 'day',
  status        TEXT DEFAULT 'open'
    CHECK (status IN ('open','submitted','approved','rejected')),
  submitted_by  UUID REFERENCES public.users(id),
  approved_by   UUID REFERENCES public.users(id),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kitchen_food_control_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id     UUID NOT NULL REFERENCES public.kitchen_food_controls(id) ON DELETE CASCADE,
  item_sku       TEXT NOT NULL,
  expected_qty   NUMERIC(14,3) DEFAULT 0,
  actual_qty     NUMERIC(14,3) DEFAULT 0,
  variance_qty   NUMERIC(14,3) DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kitchen_expected_portions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    INTEGER REFERENCES public.branches(id),
  item_sku     TEXT NOT NULL,
  expected_date DATE NOT NULL DEFAULT CURRENT_DATE,
  portions     NUMERIC(14,3) DEFAULT 0,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kitchen_daily_variance (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id      INTEGER NOT NULL REFERENCES public.branches(id),
  variance_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  item_sku       TEXT NOT NULL,
  opening_qty    NUMERIC(14,3) DEFAULT 0,
  received_qty   NUMERIC(14,3) DEFAULT 0,
  expected_sold  NUMERIC(14,3) DEFAULT 0,
  actual_sold    NUMERIC(14,3) DEFAULT 0,
  variance_qty   NUMERIC(14,3) DEFAULT 0,
  variance_value NUMERIC(14,2) DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kitchen_wastage (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    INTEGER NOT NULL REFERENCES public.branches(id),
  item_sku     TEXT NOT NULL,
  quantity     NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit         TEXT DEFAULT 'kg',
  reason       TEXT,
  wastage_date DATE DEFAULT CURRENT_DATE,
  recorded_by  UUID REFERENCES public.users(id),
  approved_by  UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- FOOD CONTROL
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recipes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  menu_item_id    UUID REFERENCES public.menu_items(id),
  name            TEXT NOT NULL,
  output_quantity NUMERIC(14,3) DEFAULT 1,
  output_unit     TEXT DEFAULT 'portion',
  status          TEXT DEFAULT 'active'
    CHECK (status IN ('draft','active','inactive')),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.recipe_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id         UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES public.inventory_items(id),
  item_sku          TEXT,
  item_name         TEXT,
  quantity_required NUMERIC(14,4) NOT NULL CHECK (quantity_required > 0),
  unit              TEXT NOT NULL,
  waste_factor      NUMERIC(8,4) DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.recipe_change_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id  UUID REFERENCES public.recipes(id),
  changed_by UUID REFERENCES public.users(id),
  change_type TEXT NOT NULL,
  old_data   JSONB,
  new_data   JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.branch_food_control_config (
  branch_id            INTEGER PRIMARY KEY REFERENCES public.branches(id),
  variance_threshold   NUMERIC(8,4) DEFAULT 5.0,
  waste_approval_limit NUMERIC(14,2) DEFAULT 1000,
  enable_food_control  BOOLEAN DEFAULT TRUE,
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.food_control_variance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER NOT NULL REFERENCES public.branches(id),
  control_id      UUID REFERENCES public.kitchen_food_controls(id),
  item_sku        TEXT NOT NULL,
  variance_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  theoretical_qty NUMERIC(14,3) DEFAULT 0,
  actual_qty      NUMERIC(14,3) DEFAULT 0,
  variance_qty    NUMERIC(14,3) DEFAULT 0,
  variance_pct    NUMERIC(8,4) DEFAULT 0,
  variance_value  NUMERIC(14,2) DEFAULT 0,
  status          TEXT DEFAULT 'open'
    CHECK (status IN ('open','investigating','approved','rejected')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.central_spoilage_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    INTEGER REFERENCES public.branches(id),
  spoilage_number TEXT UNIQUE NOT NULL,
  item_sku     TEXT NOT NULL,
  quantity     NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  reason       TEXT,
  spoilage_date DATE DEFAULT CURRENT_DATE,
  recorded_by  UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.buffets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER NOT NULL REFERENCES public.branches(id),
  buffet_number TEXT UNIQUE NOT NULL,
  event_date    DATE NOT NULL,
  event_name    TEXT,
  expected_guests INTEGER DEFAULT 0,
  actual_guests   INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'open'
    CHECK (status IN ('open','closed','cancelled')),
  created_by    UUID REFERENCES public.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.buffet_menu_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buffet_id  UUID NOT NULL REFERENCES public.buffets(id) ON DELETE CASCADE,
  item_sku   TEXT NOT NULL,
  item_name  TEXT,
  quantity   NUMERIC(14,3) DEFAULT 0,
  unit       TEXT DEFAULT 'kg',
  cost_price NUMERIC(14,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Catering
CREATE TABLE IF NOT EXISTS public.catering_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER NOT NULL REFERENCES public.branches(id),
  event_number    TEXT UNIQUE NOT NULL,
  event_name      TEXT NOT NULL,
  event_date      DATE NOT NULL,
  pax             INTEGER DEFAULT 0,
  agreed_price    NUMERIC(14,2) DEFAULT 0,
  deposit_paid    NUMERIC(14,2) DEFAULT 0,
  balance_due     NUMERIC(14,2) DEFAULT 0,
  status          TEXT DEFAULT 'confirmed'
    CHECK (status IN ('draft','confirmed','in_progress','completed','cancelled')),
  created_by      UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.catering_bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER NOT NULL REFERENCES public.branches(id),
  event_id        UUID REFERENCES public.catering_events(id),
  booking_number  TEXT UNIQUE NOT NULL,
  customer_name   TEXT NOT NULL,
  venue           TEXT,
  event_date      DATE NOT NULL,
  pax             INTEGER DEFAULT 0,
  total_amount    NUMERIC(14,2) DEFAULT 0,
  amount_paid     NUMERIC(14,2) DEFAULT 0,
  status          TEXT DEFAULT 'confirmed',
  created_by      UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.outside_catering_bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER NOT NULL REFERENCES public.branches(id),
  booking_number  TEXT UNIQUE NOT NULL,
  customer_name   TEXT NOT NULL,
  contact_phone   TEXT,
  venue           TEXT,
  event_date      DATE NOT NULL,
  pax             INTEGER DEFAULT 0,
  total_amount    NUMERIC(14,2) DEFAULT 0,
  deposit_paid    NUMERIC(14,2) DEFAULT 0,
  balance_due     NUMERIC(14,2) DEFAULT 0,
  status          TEXT DEFAULT 'confirmed',
  notes           TEXT,
  created_by      UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.catering_menu_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID REFERENCES public.catering_events(id),
  item_name  TEXT NOT NULL,
  quantity   NUMERIC(14,3) DEFAULT 0,
  unit       TEXT DEFAULT 'portion',
  unit_cost  NUMERIC(14,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.catering_stock_allocations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID REFERENCES public.catering_events(id),
  item_sku     TEXT NOT NULL,
  item_name    TEXT,
  allocated_qty NUMERIC(14,3) NOT NULL CHECK (allocated_qty > 0),
  used_qty     NUMERIC(14,3) DEFAULT 0,
  unit         TEXT DEFAULT 'kg',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
