-- =============================================================
-- 0016: Reception Module - Additional Services & Service Bookings
-- Used by additional-services.controller.ts
-- Covers: pool, car wash, banqueting, spa, tours etc.
-- =============================================================

CREATE TABLE IF NOT EXISTS additional_services (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id             INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  service_code          TEXT,
  service_name          TEXT NOT NULL,
  service_type          TEXT NOT NULL,  -- pool, car_wash, banqueting, spa, tour, other
  description           TEXT,
  pricing_type          TEXT DEFAULT 'fixed' CHECK (pricing_type IN ('fixed','per_person','per_hour','per_day')),
  base_price            NUMERIC(12,2) DEFAULT 0,
  currency              TEXT DEFAULT 'KES',
  capacity              INTEGER,
  duration_minutes      INTEGER,
  is_active             BOOLEAN DEFAULT TRUE,
  is_branch_specific    BOOLEAN DEFAULT TRUE,
  requires_booking      BOOLEAN DEFAULT TRUE,
  advance_booking_hours INTEGER DEFAULT 0,
  terms_and_conditions  TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_additional_services_branch ON additional_services(branch_id);
CREATE INDEX IF NOT EXISTS idx_additional_services_type   ON additional_services(service_type);
CREATE INDEX IF NOT EXISTS idx_additional_services_active ON additional_services(is_active);

-- =============================================================
-- Service Bookings
-- =============================================================
CREATE TABLE IF NOT EXISTS service_bookings (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_number   TEXT UNIQUE,
  service_id       UUID NOT NULL REFERENCES additional_services(id) ON DELETE RESTRICT,
  branch_id        INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  -- Customer can be a hotel guest or walk-in
  customer_type    TEXT DEFAULT 'walk_in' CHECK (customer_type IN ('guest','walk_in','corporate')),
  guest_id         UUID REFERENCES guests(id) ON DELETE SET NULL,
  customer_name    TEXT,
  customer_phone   TEXT,
  customer_email   TEXT,
  -- Scheduling
  booking_date     DATE NOT NULL,
  start_time       TIME,
  end_time         TIME,
  duration_hours   NUMERIC(5,2),
  number_of_people INTEGER DEFAULT 1,
  -- Financials
  total_amount     NUMERIC(12,2) DEFAULT 0,
  deposit_amount   NUMERIC(12,2) DEFAULT 0,
  balance_amount   NUMERIC(12,2) DEFAULT 0,
  payment_status   TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','partial','paid','refunded')),
  booking_status   TEXT DEFAULT 'pending' CHECK (booking_status IN ('pending','confirmed','cancelled','completed','no_show')),
  special_requests TEXT,
  notes            TEXT,
  booked_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  confirmed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at     TIMESTAMPTZ,
  cancelled_at     TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_bookings_branch  ON service_bookings(branch_id);
CREATE INDEX IF NOT EXISTS idx_service_bookings_service ON service_bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_service_bookings_date    ON service_bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_service_bookings_status  ON service_bookings(booking_status);
CREATE INDEX IF NOT EXISTS idx_service_bookings_guest   ON service_bookings(guest_id);

-- Function to generate service booking number
CREATE OR REPLACE FUNCTION generate_service_booking_number()
RETURNS TEXT AS $$
DECLARE
  v_number TEXT;
  v_count  INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM service_bookings
  WHERE DATE(created_at) = CURRENT_DATE;
  v_number := 'SB' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || '-' || LPAD((v_count + 1)::TEXT, 4, '0');
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;
