-- ================================================================
-- Migration 0007: POS Outlet Shifts & Orders System
-- Creates every table required by outlet-pos.controller.ts that is
-- missing from the clean-db schema, and fixes column gaps on tables
-- that exist but have the wrong shape.
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. pos_outlet_assignments
--    (posStationAccess.ts → loadAssignedPosOutlets)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_outlet_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  outlet_id     UUID NOT NULL REFERENCES pos_outlets(id) ON DELETE CASCADE,
  assigned_by   UUID REFERENCES users(id),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pos_outlet_assignments_user_outlet_key
  ON pos_outlet_assignments(user_id, outlet_id);
CREATE INDEX IF NOT EXISTS pos_outlet_assignments_user_active_idx
  ON pos_outlet_assignments(user_id, is_active);

-- ────────────────────────────────────────────────────────────────
-- 2. pos_outlet_shifts  ← THE shift table the backend uses.
--    (DB had pos_shifts with a completely different schema; that
--     table is left intact so nothing else breaks.)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_outlet_shifts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id             UUID NOT NULL REFERENCES pos_outlets(id),
  cashier_id            UUID NOT NULL REFERENCES users(id),
  branch_id             INTEGER,
  shift_number          TEXT,
  opening_float         NUMERIC(14,2) NOT NULL DEFAULT 0,
  closing_cash_counted  NUMERIC(14,2),
  expected_cash         NUMERIC(14,2),
  cash_variance         NUMERIC(14,2),
  cash_variance_reason  TEXT,
  status                TEXT NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open','closed','pending_review','approved','rejected')),
  summary               JSONB DEFAULT '{}',
  opened_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at             TIMESTAMPTZ,
  submitted_at          TIMESTAMPTZ,
  reviewed_at           TIMESTAMPTZ,
  reviewer_id           UUID REFERENCES users(id),
  review_notes          TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pos_outlet_shifts_outlet_status_idx
  ON pos_outlet_shifts(outlet_id, status);
CREATE INDEX IF NOT EXISTS pos_outlet_shifts_cashier_idx
  ON pos_outlet_shifts(cashier_id);
CREATE INDEX IF NOT EXISTS pos_outlet_shifts_branch_status_idx
  ON pos_outlet_shifts(branch_id, status);

-- ────────────────────────────────────────────────────────────────
-- 3. pos_shift_orders  ← THE orders table the backend uses.
--    (DB had pos_orders / pos_order_items with different schemas;
--     those are left intact.)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_shift_orders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id                UUID NOT NULL REFERENCES pos_outlet_shifts(id),
  outlet_id               UUID NOT NULL REFERENCES pos_outlets(id),
  source_type             TEXT NOT NULL DEFAULT 'walk_in',
  source_id               TEXT,
  order_number            TEXT,
  customer_name           TEXT,
  order_type              TEXT DEFAULT 'dine_in',
  table_number            TEXT,
  room_number             TEXT,
  waiter_id               UUID REFERENCES users(id),
  waiter_name             TEXT,
  status                  TEXT NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open','paid','credit_bill','voided')),
  payment_status          TEXT NOT NULL DEFAULT 'unpaid'
                            CHECK (payment_status IN ('unpaid','partial','paid','credit_bill','voided')),
  kitchen_status          TEXT DEFAULT 'pending'
                            CHECK (kitchen_status IN (
                              'pending','started','ready','served','void_requested','voided')),
  total_amount            NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_paid             NUMERIC(14,2) NOT NULL DEFAULT 0,
  balance_amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
  items                   JSONB DEFAULT '[]',
  void_request_status     TEXT CHECK (void_request_status IN ('pending','approved','rejected')),
  is_split                BOOLEAN DEFAULT false,
  split_parent_order_id   UUID REFERENCES pos_shift_orders(id),
  split_type              TEXT,
  is_merged               BOOLEAN DEFAULT false,
  merged_into             UUID REFERENCES pos_shift_orders(id),
  staff_credit_bill_id    UUID REFERENCES staff_credit_bills(id),
  migrated_to_credit_bill BOOLEAN DEFAULT false,
  inventory_posted_at     TIMESTAMPTZ,
  inventory_posted_by     UUID REFERENCES users(id),
  inventory_reversed_at   TIMESTAMPTZ,
  inventory_reversed_by   UUID REFERENCES users(id),
  kitchen_started_at      TIMESTAMPTZ,
  kitchen_ready_at        TIMESTAMPTZ,
  kitchen_served_at       TIMESTAMPTZ,
  voided_at               TIMESTAMPTZ,
  voided_by               UUID REFERENCES users(id),
  void_reason             TEXT,
  created_by              UUID REFERENCES users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pos_shift_orders_shift_idx
  ON pos_shift_orders(shift_id);
CREATE INDEX IF NOT EXISTS pos_shift_orders_outlet_idx
  ON pos_shift_orders(outlet_id);
CREATE INDEX IF NOT EXISTS pos_shift_orders_payment_status_idx
  ON pos_shift_orders(shift_id, payment_status);
CREATE INDEX IF NOT EXISTS pos_shift_orders_waiter_idx
  ON pos_shift_orders(waiter_id);
CREATE INDEX IF NOT EXISTS pos_shift_orders_kitchen_status_idx
  ON pos_shift_orders(kitchen_status);

-- ────────────────────────────────────────────────────────────────
-- 4. pos_shift_payments
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_shift_payments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id             UUID NOT NULL REFERENCES pos_outlet_shifts(id),
  outlet_id            UUID NOT NULL REFERENCES pos_outlets(id),
  order_id             UUID REFERENCES pos_shift_orders(id),
  payment_method       TEXT NOT NULL DEFAULT 'cash',
  amount               NUMERIC(14,2) NOT NULL DEFAULT 0,
  reference            TEXT,
  credit_bill_id       UUID,
  staff_credit_bill_id UUID REFERENCES staff_credit_bills(id),
  received_by          UUID REFERENCES users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pos_shift_payments_shift_idx
  ON pos_shift_payments(shift_id);
CREATE INDEX IF NOT EXISTS pos_shift_payments_order_idx
  ON pos_shift_payments(order_id);
CREATE INDEX IF NOT EXISTS pos_shift_payments_method_shift_idx
  ON pos_shift_payments(shift_id, payment_method);

-- ────────────────────────────────────────────────────────────────
-- 5. pos_shift_stock_counts
--    NOTE: system_closing_stock is a plain column (NOT GENERATED)
--    because updateStockCount writes the value explicitly.
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_shift_stock_counts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id              UUID NOT NULL REFERENCES pos_outlet_shifts(id),
  outlet_id             UUID NOT NULL REFERENCES pos_outlets(id),
  outlet_item_id        UUID REFERENCES pos_outlet_items(id),
  item_name             TEXT NOT NULL,
  sku                   TEXT,
  unit                  TEXT DEFAULT 'pcs',
  cost_price            NUMERIC(14,2) DEFAULT 0,
  selling_price         NUMERIC(14,2) DEFAULT 0,
  opening_stock         NUMERIC(14,4) NOT NULL DEFAULT 0,
  additions             NUMERIC(14,4) NOT NULL DEFAULT 0,
  sold_quantity         NUMERIC(14,4) NOT NULL DEFAULT 0,
  system_closing_stock  NUMERIC(14,4) NOT NULL DEFAULT 0,
  physical_count        NUMERIC(14,4),
  variance              NUMERIC(14,4) DEFAULT 0,
  variance_reason       TEXT,
  track_stock           BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pos_shift_stock_counts_shift_idx
  ON pos_shift_stock_counts(shift_id);
CREATE INDEX IF NOT EXISTS pos_shift_stock_counts_outlet_item_idx
  ON pos_shift_stock_counts(outlet_item_id);

-- ────────────────────────────────────────────────────────────────
-- 6. pos_void_requests  (outlet POS void workflow)
--    Separate from the generic void_requests table which has a
--    completely different schema.
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_void_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id          UUID NOT NULL REFERENCES pos_outlet_shifts(id),
  outlet_id         UUID NOT NULL REFERENCES pos_outlets(id),
  order_id          UUID NOT NULL REFERENCES pos_shift_orders(id),
  order_number      TEXT,
  branch_id         INTEGER,
  requested_by      UUID NOT NULL REFERENCES users(id),
  reason            TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected')),
  reviewed_by       UUID REFERENCES users(id),
  reviewed_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pos_void_requests_status_idx
  ON pos_void_requests(status);
CREATE INDEX IF NOT EXISTS pos_void_requests_branch_status_idx
  ON pos_void_requests(branch_id, status);
CREATE INDEX IF NOT EXISTS pos_void_requests_order_idx
  ON pos_void_requests(order_id);

-- ────────────────────────────────────────────────────────────────
-- 7. spa_services  (item source for kyogong_spa outlet type)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spa_services (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        INTEGER,
  name             TEXT NOT NULL,
  category         TEXT,
  price            NUMERIC(14,2) NOT NULL DEFAULT 0,
  duration_minutes INTEGER,
  sku              TEXT,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS spa_services_sku_branch_key
  ON spa_services(branch_id, sku) WHERE sku IS NOT NULL;

-- ────────────────────────────────────────────────────────────────
-- 8. dynamic_services  (item source for kyogong_reception and
--    non_consumables outlet types)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dynamic_services (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    INTEGER,
  name         TEXT NOT NULL,
  category     TEXT,
  price        NUMERIC(14,2) NOT NULL DEFAULT 0,
  unit         TEXT DEFAULT 'pcs',
  sku          TEXT,
  service_type TEXT DEFAULT 'general',
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dynamic_services_branch_idx
  ON dynamic_services(branch_id);

-- ────────────────────────────────────────────────────────────────
-- 9. branch_stock_movements
--    (cashier-automation.service.ts → postAutomatedStockMovements
--     inserts SALE movement records here)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branch_stock_movements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id      INTEGER,
  item_sku       TEXT,
  item_id        UUID,
  movement_type  TEXT NOT NULL DEFAULT 'SALE',
  quantity       NUMERIC(14,4) NOT NULL,
  reference      TEXT,
  shift_id       UUID,
  order_id       UUID,
  notes          TEXT,
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS branch_stock_movements_branch_idx
  ON branch_stock_movements(branch_id);
CREATE INDEX IF NOT EXISTS branch_stock_movements_sku_idx
  ON branch_stock_movements(item_sku);
CREATE INDEX IF NOT EXISTS branch_stock_movements_shift_idx
  ON branch_stock_movements(shift_id);

-- ────────────────────────────────────────────────────────────────
-- 10. ALTER pos_outlets — add pin_prefix
--     (createOutlet writes pin_prefix; Flutter terminal_screen
--      reads it for PIN prefix lookup)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE pos_outlets ADD COLUMN IF NOT EXISTS pin_prefix TEXT;

-- ────────────────────────────────────────────────────────────────
-- 11. ALTER pos_outlet_items — add the 11 columns the backend needs
--     and fix the unique constraint (must be on outlet_id + sku,
--     NOT outlet_id + menu_item_id as the clean schema defined it).
-- ────────────────────────────────────────────────────────────────
ALTER TABLE pos_outlet_items ADD COLUMN IF NOT EXISTS sku             TEXT;
ALTER TABLE pos_outlet_items ADD COLUMN IF NOT EXISTS name            TEXT;
ALTER TABLE pos_outlet_items ADD COLUMN IF NOT EXISTS category        TEXT;
ALTER TABLE pos_outlet_items ADD COLUMN IF NOT EXISTS unit            TEXT    DEFAULT 'pcs';
ALTER TABLE pos_outlet_items ADD COLUMN IF NOT EXISTS cost_price      NUMERIC(14,2) DEFAULT 0;
ALTER TABLE pos_outlet_items ADD COLUMN IF NOT EXISTS opening_stock   NUMERIC(14,4) DEFAULT 0;
ALTER TABLE pos_outlet_items ADD COLUMN IF NOT EXISTS track_stock     BOOLEAN DEFAULT true;
ALTER TABLE pos_outlet_items ADD COLUMN IF NOT EXISTS is_active       BOOLEAN DEFAULT true;
ALTER TABLE pos_outlet_items ADD COLUMN IF NOT EXISTS source_table    TEXT;
ALTER TABLE pos_outlet_items ADD COLUMN IF NOT EXISTS source_item_id  TEXT;
ALTER TABLE pos_outlet_items ADD COLUMN IF NOT EXISTS item_group      TEXT;

-- Drop the wrong unique constraint (outlet_id, menu_item_id) if it still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'pos_outlet_items'
      AND constraint_name = 'pos_outlet_items_outlet_id_menu_item_id_key'
  ) THEN
    ALTER TABLE pos_outlet_items DROP CONSTRAINT pos_outlet_items_outlet_id_menu_item_id_key;
  END IF;
END;
$$;

-- Add the correct partial unique index on (outlet_id, sku)
CREATE UNIQUE INDEX IF NOT EXISTS pos_outlet_items_outlet_sku_key
  ON pos_outlet_items(outlet_id, sku)
  WHERE sku IS NOT NULL;

-- ────────────────────────────────────────────────────────────────
-- 12. ALTER cashier_logbooks — add outlet_shift_id so the
--     cashier-automation.service upsert keyed on outlet_shift_id
--     works, plus per-method totals it writes.
-- ────────────────────────────────────────────────────────────────
ALTER TABLE cashier_logbooks ADD COLUMN IF NOT EXISTS outlet_shift_id    UUID REFERENCES pos_outlet_shifts(id);
ALTER TABLE cashier_logbooks ADD COLUMN IF NOT EXISTS outlet_id          UUID REFERENCES pos_outlets(id);
ALTER TABLE cashier_logbooks ADD COLUMN IF NOT EXISTS total_cash         NUMERIC(14,2) DEFAULT 0;
ALTER TABLE cashier_logbooks ADD COLUMN IF NOT EXISTS total_mpesa        NUMERIC(14,2) DEFAULT 0;
ALTER TABLE cashier_logbooks ADD COLUMN IF NOT EXISTS total_card         NUMERIC(14,2) DEFAULT 0;
ALTER TABLE cashier_logbooks ADD COLUMN IF NOT EXISTS total_credit_bill  NUMERIC(14,2) DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS cashier_logbooks_outlet_shift_key
  ON cashier_logbooks(outlet_shift_id)
  WHERE outlet_shift_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────
-- 13. ALTER cashier_logbook_lines — add payment_method and order_id
--     (automation re-inserts lines from pos_shift_payments)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE cashier_logbook_lines ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE cashier_logbook_lines ADD COLUMN IF NOT EXISTS order_id       UUID REFERENCES pos_shift_orders(id);

-- ────────────────────────────────────────────────────────────────
-- 14. ALTER cashier_shift_logs — add branch_id and status
--     (outlet-pos.controller bridge logic queries these columns)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE cashier_shift_logs ADD COLUMN IF NOT EXISTS branch_id INTEGER;
ALTER TABLE cashier_shift_logs ADD COLUMN IF NOT EXISTS status    TEXT DEFAULT 'open';

-- ────────────────────────────────────────────────────────────────
-- DONE
-- ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '
╔══════════════════════════════════════════════════════════╗
║  Migration 0007 complete — POS Outlet Shifts System      ║
║                                                          ║
║  Created tables:                                         ║
║    pos_outlet_assignments                                ║
║    pos_outlet_shifts                                     ║
║    pos_shift_orders                                      ║
║    pos_shift_payments                                    ║
║    pos_shift_stock_counts                                ║
║    pos_void_requests                                     ║
║    spa_services                                          ║
║    dynamic_services                                      ║
║    branch_stock_movements                                ║
║                                                          ║
║  Altered tables:                                         ║
║    pos_outlets          (+pin_prefix)                    ║
║    pos_outlet_items     (+11 cols, fixed unique key)     ║
║    cashier_logbooks     (+outlet_shift_id, +4 totals)    ║
║    cashier_logbook_lines(+payment_method, +order_id)     ║
║    cashier_shift_logs   (+branch_id, +status)            ║
╚══════════════════════════════════════════════════════════╝
';
END;
$$;
