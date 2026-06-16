-- =============================================================
-- 0022: Fix restaurant_bills, restaurant_orders, restaurant_order_items,
--       restaurant_bill_payments, restaurant_bill_audit_log columns
--       to match what restaurant-bills.controller.ts expects
-- =============================================================

-- ---------------------------------------------------------------
-- restaurant_bills: add all missing columns
-- ---------------------------------------------------------------
ALTER TABLE restaurant_bills ADD COLUMN IF NOT EXISTS table_number        TEXT;
ALTER TABLE restaurant_bills ADD COLUMN IF NOT EXISTS room_number         TEXT;
ALTER TABLE restaurant_bills ADD COLUMN IF NOT EXISTS guest_id            UUID REFERENCES guests(id) ON DELETE SET NULL;
ALTER TABLE restaurant_bills ADD COLUMN IF NOT EXISTS guest_name          TEXT;
ALTER TABLE restaurant_bills ADD COLUMN IF NOT EXISTS guest_phone         TEXT;
ALTER TABLE restaurant_bills ADD COLUMN IF NOT EXISTS waiter_id           UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE restaurant_bills ADD COLUMN IF NOT EXISTS short_code          TEXT;
ALTER TABLE restaurant_bills ADD COLUMN IF NOT EXISTS balance             NUMERIC(12,2) DEFAULT 0;
ALTER TABLE restaurant_bills ADD COLUMN IF NOT EXISTS vat_rate            NUMERIC(5,2) DEFAULT 16.00;
ALTER TABLE restaurant_bills ADD COLUMN IF NOT EXISTS service_charge_rate NUMERIC(5,2) DEFAULT 0;
ALTER TABLE restaurant_bills ADD COLUMN IF NOT EXISTS parent_bill_id      UUID REFERENCES restaurant_bills(id) ON DELETE SET NULL;
ALTER TABLE restaurant_bills ADD COLUMN IF NOT EXISTS split_type          TEXT;
ALTER TABLE restaurant_bills ADD COLUMN IF NOT EXISTS is_split            BOOLEAN DEFAULT FALSE;
ALTER TABLE restaurant_bills ADD COLUMN IF NOT EXISTS is_merged           BOOLEAN DEFAULT FALSE;
ALTER TABLE restaurant_bills ADD COLUMN IF NOT EXISTS merged_into         UUID REFERENCES restaurant_bills(id) ON DELETE SET NULL;
ALTER TABLE restaurant_bills ADD COLUMN IF NOT EXISTS closed_at           TIMESTAMPTZ;
ALTER TABLE restaurant_bills ADD COLUMN IF NOT EXISTS closed_by           UUID REFERENCES users(id) ON DELETE SET NULL;

-- Backfill balance from balance_due
UPDATE restaurant_bills SET balance = balance_due WHERE balance = 0 AND balance_due IS NOT NULL;

-- Backfill guest_name from customer_name
UPDATE restaurant_bills SET guest_name = customer_name WHERE guest_name IS NULL AND customer_name IS NOT NULL;

-- ---------------------------------------------------------------
-- restaurant_orders: add all missing columns
-- ---------------------------------------------------------------
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bill_id              UUID REFERENCES restaurant_bills(id) ON DELETE SET NULL;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS guest_id             UUID REFERENCES guests(id) ON DELETE SET NULL;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS guest_name           TEXT;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS special_instructions TEXT;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS confirmed_at         TIMESTAMPTZ;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS confirmed_by         UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS prepared_at          TIMESTAMPTZ;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS delivered_at         TIMESTAMPTZ;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS cancelled_at         TIMESTAMPTZ;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS cancellation_reason  TEXT;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS voided_at            TIMESTAMPTZ;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS voided_by            UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS void_reason          TEXT;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bill_number          TEXT;

-- Backfill guest_name from customer_name
UPDATE restaurant_orders SET guest_name = customer_name WHERE guest_name IS NULL AND customer_name IS NOT NULL;

-- ---------------------------------------------------------------
-- restaurant_order_items: add all missing columns
-- total_price alias for line_total, special_instructions alias for notes, bill_id for split
-- ---------------------------------------------------------------
ALTER TABLE restaurant_order_items ADD COLUMN IF NOT EXISTS total_price          NUMERIC(12,2) DEFAULT 0;
ALTER TABLE restaurant_order_items ADD COLUMN IF NOT EXISTS special_instructions TEXT;
ALTER TABLE restaurant_order_items ADD COLUMN IF NOT EXISTS bill_id              UUID REFERENCES restaurant_bills(id) ON DELETE SET NULL;
ALTER TABLE restaurant_order_items ADD COLUMN IF NOT EXISTS item_name            TEXT;

-- Backfill total_price from line_total
UPDATE restaurant_order_items SET total_price = line_total WHERE total_price = 0 AND line_total IS NOT NULL;
-- Backfill special_instructions from notes
UPDATE restaurant_order_items SET special_instructions = notes WHERE special_instructions IS NULL AND notes IS NOT NULL;
-- Backfill item_name from menu_item join (run inline)
UPDATE restaurant_order_items roi
SET item_name = rmi.name
FROM restaurant_menu_items rmi
WHERE roi.menu_item_id = rmi.id AND (roi.item_name IS NULL OR roi.item_name = '');

-- Sync triggers: keep total_price↔line_total and special_instructions↔notes in sync
CREATE OR REPLACE FUNCTION sync_order_item_aliases()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.line_total IS DISTINCT FROM OLD.line_total THEN NEW.total_price := NEW.line_total; END IF;
  IF NEW.total_price IS DISTINCT FROM OLD.total_price THEN NEW.line_total := NEW.total_price; END IF;
  IF NEW.notes IS DISTINCT FROM OLD.notes THEN NEW.special_instructions := NEW.notes; END IF;
  IF NEW.special_instructions IS DISTINCT FROM OLD.special_instructions THEN NEW.notes := NEW.special_instructions; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_order_item_aliases ON restaurant_order_items;
CREATE TRIGGER trg_sync_order_item_aliases
  BEFORE INSERT OR UPDATE ON restaurant_order_items
  FOR EACH ROW EXECUTE FUNCTION sync_order_item_aliases();

-- ---------------------------------------------------------------
-- restaurant_bill_payments: fix column name mismatches
-- Controller writes: payment_method, payment_reference, paid_by, cashier_id, reversed, paid_at
-- DB has:           method,          reference,        received_by,          received_at
-- ---------------------------------------------------------------
ALTER TABLE restaurant_bill_payments ADD COLUMN IF NOT EXISTS payment_method    TEXT;
ALTER TABLE restaurant_bill_payments ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE restaurant_bill_payments ADD COLUMN IF NOT EXISTS paid_by           UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE restaurant_bill_payments ADD COLUMN IF NOT EXISTS cashier_id        UUID;
ALTER TABLE restaurant_bill_payments ADD COLUMN IF NOT EXISTS paid_at           TIMESTAMPTZ;
ALTER TABLE restaurant_bill_payments ADD COLUMN IF NOT EXISTS notes             TEXT;
ALTER TABLE restaurant_bill_payments ADD COLUMN IF NOT EXISTS reversed          BOOLEAN DEFAULT FALSE;
ALTER TABLE restaurant_bill_payments ADD COLUMN IF NOT EXISTS reversed_at       TIMESTAMPTZ;
ALTER TABLE restaurant_bill_payments ADD COLUMN IF NOT EXISTS reversed_by       UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE restaurant_bill_payments ADD COLUMN IF NOT EXISTS reversal_reason   TEXT;

-- Backfill aliases
UPDATE restaurant_bill_payments SET payment_method = method WHERE payment_method IS NULL AND method IS NOT NULL;
UPDATE restaurant_bill_payments SET payment_reference = reference WHERE payment_reference IS NULL AND reference IS NOT NULL;
UPDATE restaurant_bill_payments SET paid_by = received_by WHERE paid_by IS NULL AND received_by IS NOT NULL;
UPDATE restaurant_bill_payments SET paid_at = received_at WHERE paid_at IS NULL AND received_at IS NOT NULL;

-- Sync trigger
CREATE OR REPLACE FUNCTION sync_bill_payment_aliases()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.method IS DISTINCT FROM OLD.method THEN NEW.payment_method := NEW.method; END IF;
  IF NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN NEW.method := NEW.payment_method; END IF;
  IF NEW.reference IS DISTINCT FROM OLD.reference THEN NEW.payment_reference := NEW.reference; END IF;
  IF NEW.payment_reference IS DISTINCT FROM OLD.payment_reference THEN NEW.reference := NEW.payment_reference; END IF;
  IF NEW.received_by IS DISTINCT FROM OLD.received_by THEN NEW.paid_by := NEW.received_by; END IF;
  IF NEW.paid_by IS DISTINCT FROM OLD.paid_by THEN NEW.received_by := NEW.paid_by; END IF;
  IF NEW.received_at IS DISTINCT FROM OLD.received_at THEN NEW.paid_at := NEW.received_at; END IF;
  IF NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN NEW.received_at := NEW.paid_at; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_bill_payment_aliases ON restaurant_bill_payments;
CREATE TRIGGER trg_sync_bill_payment_aliases
  BEFORE INSERT OR UPDATE ON restaurant_bill_payments
  FOR EACH ROW EXECUTE FUNCTION sync_bill_payment_aliases();

-- ---------------------------------------------------------------
-- restaurant_bill_audit_log: fix column name mismatches
-- Controller writes: performed_by, description, metadata, performed_at
-- DB has:           actor_id,     details,     (none),    created_at
-- ---------------------------------------------------------------
ALTER TABLE restaurant_bill_audit_log ADD COLUMN IF NOT EXISTS performed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE restaurant_bill_audit_log ADD COLUMN IF NOT EXISTS description  TEXT;
ALTER TABLE restaurant_bill_audit_log ADD COLUMN IF NOT EXISTS metadata     JSONB;
ALTER TABLE restaurant_bill_audit_log ADD COLUMN IF NOT EXISTS performed_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill
UPDATE restaurant_bill_audit_log SET performed_by = actor_id WHERE performed_by IS NULL AND actor_id IS NOT NULL;
UPDATE restaurant_bill_audit_log SET description = details WHERE description IS NULL AND details IS NOT NULL;
UPDATE restaurant_bill_audit_log SET performed_at = created_at WHERE performed_at IS NULL AND created_at IS NOT NULL;

-- ---------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_restaurant_bills_branch    ON restaurant_bills(branch_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_bills_status    ON restaurant_bills(status);
CREATE INDEX IF NOT EXISTS idx_restaurant_bills_short     ON restaurant_bills(short_code);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_bill     ON restaurant_orders(bill_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_branch   ON restaurant_orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_short    ON restaurant_orders(short_code);
CREATE INDEX IF NOT EXISTS idx_roi_order                  ON restaurant_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_roi_bill                   ON restaurant_order_items(bill_id);
