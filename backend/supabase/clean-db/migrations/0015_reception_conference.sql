-- =============================================================
-- 0015: Reception Module - Conference halls & bookings fixes
-- conference.controller.ts uses different column names than DB
-- =============================================================

-- -------------------------
-- CONFERENCE_HALLS
-- -------------------------

-- Controller inserts/updates base_price_per_day; DB has rate_per_day
-- Add alias column and keep rate_per_day for backward compat
ALTER TABLE conference_halls ADD COLUMN IF NOT EXISTS base_price_per_day  NUMERIC(12,2) DEFAULT 0;
ALTER TABLE conference_halls ADD COLUMN IF NOT EXISTS base_price_per_hour NUMERIC(12,2) DEFAULT 0;
ALTER TABLE conference_halls ADD COLUMN IF NOT EXISTS description          TEXT;

-- Backfill base_price_per_day from rate_per_day
UPDATE conference_halls
SET base_price_per_day = rate_per_day
WHERE base_price_per_day = 0 AND rate_per_day IS NOT NULL;

-- Keep rate_per_day and base_price_per_day in sync via trigger
CREATE OR REPLACE FUNCTION sync_hall_price()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.base_price_per_day IS DISTINCT FROM OLD.base_price_per_day THEN
    NEW.rate_per_day := NEW.base_price_per_day;
  ELSIF NEW.rate_per_day IS DISTINCT FROM OLD.rate_per_day THEN
    NEW.base_price_per_day := NEW.rate_per_day;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_hall_price ON conference_halls;
CREATE TRIGGER trg_sync_hall_price
  BEFORE UPDATE ON conference_halls
  FOR EACH ROW EXECUTE FUNCTION sync_hall_price();

-- -------------------------
-- CONFERENCE_HALL_BOOKINGS
-- -------------------------
-- Controller queries: conference_hall_id, booking_status, start_date, end_date
-- DB has: hall_id, start_date (no end_date, no booking_status)

ALTER TABLE conference_hall_bookings ADD COLUMN IF NOT EXISTS conference_hall_id UUID REFERENCES conference_halls(id) ON DELETE CASCADE;
ALTER TABLE conference_hall_bookings ADD COLUMN IF NOT EXISTS booking_status     TEXT DEFAULT 'pending' CHECK (booking_status IN ('pending','confirmed','cancelled','completed'));
ALTER TABLE conference_hall_bookings ADD COLUMN IF NOT EXISTS end_date           DATE;

-- Additional booking metadata used by createConferenceBooking
ALTER TABLE conference_hall_bookings ADD COLUMN IF NOT EXISTS client_name       TEXT;
ALTER TABLE conference_hall_bookings ADD COLUMN IF NOT EXISTS client_phone      TEXT;
ALTER TABLE conference_hall_bookings ADD COLUMN IF NOT EXISTS client_email      TEXT;
ALTER TABLE conference_hall_bookings ADD COLUMN IF NOT EXISTS event_type        TEXT;
ALTER TABLE conference_hall_bookings ADD COLUMN IF NOT EXISTS num_attendees     INTEGER DEFAULT 0;
ALTER TABLE conference_hall_bookings ADD COLUMN IF NOT EXISTS total_amount      NUMERIC(12,2) DEFAULT 0;
ALTER TABLE conference_hall_bookings ADD COLUMN IF NOT EXISTS deposit_amount    NUMERIC(12,2) DEFAULT 0;
ALTER TABLE conference_hall_bookings ADD COLUMN IF NOT EXISTS balance_amount    NUMERIC(12,2) DEFAULT 0;
ALTER TABLE conference_hall_bookings ADD COLUMN IF NOT EXISTS payment_status    TEXT DEFAULT 'pending';
ALTER TABLE conference_hall_bookings ADD COLUMN IF NOT EXISTS invoice_number    TEXT;
ALTER TABLE conference_hall_bookings ADD COLUMN IF NOT EXISTS created_by        UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE conference_hall_bookings ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ DEFAULT NOW();

-- Backfill conference_hall_id from existing hall_id
UPDATE conference_hall_bookings
SET conference_hall_id = hall_id
WHERE conference_hall_id IS NULL AND hall_id IS NOT NULL;

-- Backfill end_date from date_to
UPDATE conference_hall_bookings
SET end_date = date_to
WHERE end_date IS NULL AND date_to IS NOT NULL;

-- Backfill booking_status (assume existing bookings are confirmed)
UPDATE conference_hall_bookings
SET booking_status = 'confirmed'
WHERE booking_status = 'pending' AND date_from < CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_chb_conference_hall ON conference_hall_bookings(conference_hall_id);
CREATE INDEX IF NOT EXISTS idx_chb_branch          ON conference_hall_bookings(branch_id);
CREATE INDEX IF NOT EXISTS idx_chb_status          ON conference_hall_bookings(booking_status);
