-- =============================================================
-- 0012: Reception Module - Reservations missing columns
-- Adds all columns required by booking.controller.ts and
-- the Booking model (src/models/Booking.ts)
-- =============================================================

-- Check-in / check-out audit trail
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS checked_in_at   TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS checked_in_by   UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS checked_out_at  TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS checked_out_by  UUID REFERENCES users(id) ON DELETE SET NULL;

-- Cancellation audit trail
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancelled_at         TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancelled_by         UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancellation_reason  TEXT;

-- Room & rate plan linkage
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS room_type_id  UUID REFERENCES room_types(id) ON DELETE SET NULL;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS rate_plan_id  UUID REFERENCES rate_plans(id) ON DELETE SET NULL;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS room_rate     NUMERIC(12,2) DEFAULT 0;

-- Pricing breakdown
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS subtotal        NUMERIC(12,2) DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS tax_amount      NUMERIC(12,2) DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS service_charge  NUMERIC(12,2) DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0;

-- Deposit tracking (deposit_amount supplements existing amount_paid)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS deposit_amount   NUMERIC(12,2) DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS deposit_paid     BOOLEAN DEFAULT FALSE;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS deposit_paid_at  TIMESTAMPTZ;

-- Booking meta
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS booking_source       TEXT DEFAULT 'WALK_IN';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS channel_manager_ref  TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS meal_plan            TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS purpose              TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS notes                TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS internal_notes       TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS short_code           TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS infants              INTEGER DEFAULT 0;

-- Backfill: deposit_amount from amount_paid where not set
UPDATE reservations
SET deposit_amount = amount_paid
WHERE deposit_amount = 0 AND amount_paid IS NOT NULL AND amount_paid > 0;

-- Index for confirmation number lookups
CREATE INDEX IF NOT EXISTS idx_reservations_confirmation ON reservations(confirmation_number);
CREATE INDEX IF NOT EXISTS idx_reservations_status       ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_branch       ON reservations(branch_id);
CREATE INDEX IF NOT EXISTS idx_reservations_guest        ON reservations(guest_id);
CREATE INDEX IF NOT EXISTS idx_reservations_room         ON reservations(room_id);
