-- =============================================================
-- 0019: Fix missing columns causing 42703 column-not-found errors
--
-- Errors fixed:
-- 4. GET /api/catering-bookings   → column catering_bookings.booking_status does not exist
-- 5. GET /api/cashier/credit-bills → column credit_date does not exist
-- 6. POST /api/analytics/branch-sales → column restaurant_orders.grand_total does not exist
-- =============================================================

-- ---------------------------------------------------------------
-- FIX 4: catering_bookings.booking_status
-- Controller filters: .eq('booking_status', status)
-- DB only has 'status'. Add booking_status as a synced alias.
-- ---------------------------------------------------------------
ALTER TABLE catering_bookings ADD COLUMN IF NOT EXISTS booking_status TEXT DEFAULT 'pending';

-- Backfill from existing status
UPDATE catering_bookings SET booking_status = status WHERE booking_status IS NULL OR booking_status = 'pending';

-- Also add other columns used by catering-bookings.controller.ts
ALTER TABLE catering_bookings ADD COLUMN IF NOT EXISTS client_name      TEXT;
ALTER TABLE catering_bookings ADD COLUMN IF NOT EXISTS client_phone     TEXT;
ALTER TABLE catering_bookings ADD COLUMN IF NOT EXISTS client_email     TEXT;
ALTER TABLE catering_bookings ADD COLUMN IF NOT EXISTS event_type       TEXT;
ALTER TABLE catering_bookings ADD COLUMN IF NOT EXISTS description      TEXT;
ALTER TABLE catering_bookings ADD COLUMN IF NOT EXISTS deposit_amount   NUMERIC(12,2) DEFAULT 0;
ALTER TABLE catering_bookings ADD COLUMN IF NOT EXISTS balance_amount   NUMERIC(12,2) DEFAULT 0;
ALTER TABLE catering_bookings ADD COLUMN IF NOT EXISTS payment_status   TEXT DEFAULT 'pending';
ALTER TABLE catering_bookings ADD COLUMN IF NOT EXISTS payment_method   TEXT;
ALTER TABLE catering_bookings ADD COLUMN IF NOT EXISTS notes            TEXT;
ALTER TABLE catering_bookings ADD COLUMN IF NOT EXISTS invoice_number   TEXT;
ALTER TABLE catering_bookings ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW();

-- Sync trigger: keep booking_status in sync with status
CREATE OR REPLACE FUNCTION sync_catering_booking_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.booking_status IS DISTINCT FROM OLD.booking_status AND NEW.status = OLD.status THEN
    NEW.status := NEW.booking_status;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.booking_status := NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_catering_status ON catering_bookings;
CREATE TRIGGER trg_sync_catering_status
  BEFORE UPDATE ON catering_bookings
  FOR EACH ROW EXECUTE FUNCTION sync_catering_booking_status();

-- ---------------------------------------------------------------
-- FIX 5: credit_bills.credit_date
-- cashier.controller.ts raw SQL: WHERE credit_date >= $n ORDER BY credit_date
-- DB has bill_date. Add credit_date as a persisted alias.
-- ---------------------------------------------------------------
ALTER TABLE credit_bills ADD COLUMN IF NOT EXISTS credit_date DATE;

-- Backfill from bill_date
UPDATE credit_bills SET credit_date = bill_date::DATE
  WHERE credit_date IS NULL AND bill_date IS NOT NULL;

-- Backfill from created_at where bill_date is also null
UPDATE credit_bills SET credit_date = created_at::DATE
  WHERE credit_date IS NULL;

-- Sync trigger
CREATE OR REPLACE FUNCTION sync_credit_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bill_date IS NOT NULL THEN
    NEW.credit_date := NEW.bill_date::DATE;
  ELSIF NEW.credit_date IS NOT NULL THEN
    NEW.bill_date := NEW.credit_date;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_credit_date ON credit_bills;
CREATE TRIGGER trg_sync_credit_date
  BEFORE INSERT OR UPDATE ON credit_bills
  FOR EACH ROW EXECUTE FUNCTION sync_credit_date();

CREATE INDEX IF NOT EXISTS idx_credit_bills_credit_date ON credit_bills(credit_date);

-- ---------------------------------------------------------------
-- FIX 6: restaurant_orders.grand_total
-- Multiple controllers: branch-analytics, financial-workspace,
-- performance, profit-loss all select grand_total.
-- DB only has total_amount. Add grand_total as a synced alias.
-- ---------------------------------------------------------------
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS grand_total NUMERIC(12,2);

-- Backfill from total_amount
UPDATE restaurant_orders SET grand_total = total_amount WHERE grand_total IS NULL;

-- Sync trigger: grand_total always mirrors total_amount
CREATE OR REPLACE FUNCTION sync_restaurant_grand_total()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_amount IS NOT NULL THEN
    NEW.grand_total := NEW.total_amount;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_restaurant_grand_total ON restaurant_orders;
CREATE TRIGGER trg_sync_restaurant_grand_total
  BEFORE INSERT OR UPDATE OF total_amount ON restaurant_orders
  FOR EACH ROW EXECUTE FUNCTION sync_restaurant_grand_total();

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_grand_total ON restaurant_orders(grand_total);
