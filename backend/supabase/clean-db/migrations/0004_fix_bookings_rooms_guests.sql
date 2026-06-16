-- ============================================================
-- Migration 0004: Fix bookings / rooms / guests column gaps
--                 and add backward-compatible column aliases
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- BOOKINGS: add missing columns and column aliases
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS deposit_amount    NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_paid      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS room_rate         NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meal_plan         TEXT DEFAULT 'room_only',
  ADD COLUMN IF NOT EXISTS booking_source    TEXT DEFAULT 'walk_in',
  ADD COLUMN IF NOT EXISTS special_requests  TEXT,
  ADD COLUMN IF NOT EXISTS adults            INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS children          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS infants           INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS internal_notes    TEXT,
  ADD COLUMN IF NOT EXISTS payment_method    TEXT DEFAULT 'cash';

-- check_in_date / check_out_date aliases (backend uses these, schema uses check_in_at/check_out_at)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings'
      AND column_name = 'check_in_date'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN check_in_date DATE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings'
      AND column_name = 'check_out_date'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN check_out_date DATE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings'
      AND column_name = 'confirmation_number'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN confirmation_number TEXT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._sync_booking_cols()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Date aliases
  NEW.check_in_date     := COALESCE(NEW.check_in_date, NEW.check_in_at::DATE);
  NEW.check_in_at       := COALESCE(NEW.check_in_at,
                              (NEW.check_in_date::TEXT || ' 14:00:00')::TIMESTAMPTZ);
  NEW.check_out_date    := COALESCE(NEW.check_out_date, NEW.check_out_at::DATE);
  NEW.check_out_at      := COALESCE(NEW.check_out_at,
                              (NEW.check_out_date::TEXT || ' 10:00:00')::TIMESTAMPTZ);
  -- confirmation_number alias
  NEW.confirmation_number := COALESCE(NEW.confirmation_number, NEW.booking_number);
  NEW.booking_number      := COALESCE(NEW.booking_number, NEW.confirmation_number);
  -- pax from adults + children
  NEW.pax := GREATEST(1, COALESCE(NEW.adults, 1) + COALESCE(NEW.children, 0));
  -- room_rate default to subtotal
  IF NEW.room_rate = 0 AND NEW.subtotal > 0 THEN
    NEW.room_rate := NEW.subtotal;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_booking_cols ON public.bookings;
CREATE TRIGGER trg_sync_booking_cols
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public._sync_booking_cols();

-- ─────────────────────────────────────────────────────────────
-- RESERVATIONS: add missing columns (Flutter uses both bookings & reservations)
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reservations'
      AND column_name = 'check_in_date'
  ) THEN
    ALTER TABLE public.reservations ADD COLUMN check_in_date DATE;
    ALTER TABLE public.reservations ADD COLUMN check_out_date DATE;
    ALTER TABLE public.reservations ADD COLUMN confirmation_number TEXT;
    ALTER TABLE public.reservations ADD COLUMN total_amount NUMERIC(14,2) DEFAULT 0;
    ALTER TABLE public.reservations ADD COLUMN amount_paid NUMERIC(14,2) DEFAULT 0;
    ALTER TABLE public.reservations ADD COLUMN payment_status TEXT DEFAULT 'pending';
    ALTER TABLE public.reservations ADD COLUMN payment_method TEXT DEFAULT 'cash';
    ALTER TABLE public.reservations ADD COLUMN special_requests TEXT;
    ALTER TABLE public.reservations ADD COLUMN adults INTEGER DEFAULT 1;
    ALTER TABLE public.reservations ADD COLUMN children INTEGER DEFAULT 0;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- GUESTS: add missing columns and column aliases
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS is_vip            BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS blacklist_status  TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS blacklist_reason  TEXT,
  ADD COLUMN IF NOT EXISTS nationality       TEXT DEFAULT 'Kenyan',
  ADD COLUMN IF NOT EXISTS date_of_birth     DATE,
  ADD COLUMN IF NOT EXISTS total_visits      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS address           TEXT,
  ADD COLUMN IF NOT EXISTS preferences       JSONB DEFAULT '{}';

-- car_number_plate alias (backend uses this; schema uses car_plate)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'guests'
      AND column_name = 'car_number_plate'
  ) THEN
    ALTER TABLE public.guests ADD COLUMN car_number_plate TEXT;
  END IF;
  -- vip_tier alias -> loyalty_tier
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'guests'
      AND column_name = 'vip_tier'
  ) THEN
    ALTER TABLE public.guests ADD COLUMN vip_tier TEXT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._sync_guest_cols()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.car_number_plate := COALESCE(NEW.car_number_plate, NEW.car_plate);
  NEW.car_plate        := COALESCE(NEW.car_plate, NEW.car_number_plate);
  NEW.vip_tier         := COALESCE(NEW.vip_tier, NEW.loyalty_tier);
  NEW.loyalty_tier     := COALESCE(NEW.loyalty_tier, NEW.vip_tier, 'bronze');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_guest_cols ON public.guests;
CREATE TRIGGER trg_sync_guest_cols
  BEFORE INSERT OR UPDATE ON public.guests
  FOR EACH ROW EXECUTE FUNCTION public._sync_guest_cols();

-- Auto-increment total_visits when a booking is completed
CREATE OR REPLACE FUNCTION public._increment_guest_visits()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'checked_out' AND (OLD IS NULL OR OLD.status != 'checked_out') THEN
    UPDATE public.guests SET total_visits = total_visits + 1 WHERE id = NEW.guest_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_guest_visits ON public.bookings;
CREATE TRIGGER trg_increment_guest_visits
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public._increment_guest_visits();

-- ─────────────────────────────────────────────────────────────
-- ROOMS: add missing columns and aliases
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS amenities      JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS image_url      TEXT,
  ADD COLUMN IF NOT EXISTS price_override NUMERIC(14,2);

-- max_occupancy (exists on room_types; denormalise for read convenience)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rooms'
      AND column_name = 'max_occupancy'
  ) THEN
    ALTER TABLE public.rooms ADD COLUMN max_occupancy INTEGER DEFAULT 2;
  END IF;
  -- type_id alias -> room_type_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rooms'
      AND column_name = 'type_id'
  ) THEN
    ALTER TABLE public.rooms ADD COLUMN type_id UUID;
  END IF;
  -- is_clean shorthand for housekeeping_status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rooms'
      AND column_name = 'is_clean'
  ) THEN
    ALTER TABLE public.rooms ADD COLUMN is_clean BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._sync_room_cols()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.type_id  := NEW.room_type_id;
  NEW.is_clean := (NEW.housekeeping_status IN ('clean','inspected'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_room_cols ON public.rooms;
CREATE TRIGGER trg_sync_room_cols
  BEFORE INSERT OR UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public._sync_room_cols();

-- ─────────────────────────────────────────────────────────────
-- ROOM_TYPES: add base_rate alias
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'room_types'
      AND column_name = 'price_per_night'
  ) THEN
    ALTER TABLE public.room_types ADD COLUMN price_per_night NUMERIC(14,2);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._sync_rt_cols()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.price_per_night := COALESCE(NEW.price_per_night, NEW.base_rate, 0);
  NEW.base_rate       := COALESCE(NEW.base_rate, NEW.price_per_night, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_rt_cols ON public.room_types;
CREATE TRIGGER trg_sync_rt_cols
  BEFORE INSERT OR UPDATE ON public.room_types
  FOR EACH ROW EXECUTE FUNCTION public._sync_rt_cols();

-- ─────────────────────────────────────────────────────────────
-- FOLIOS: add missing columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.folios
  ADD COLUMN IF NOT EXISTS room_charges    NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS food_charges    NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS beverage_charges NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_charges   NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settled         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS settled_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes           TEXT,
  ADD COLUMN IF NOT EXISTS reservation_id  UUID REFERENCES public.reservations(id);

-- folio_transactions (line items on a folio)
CREATE TABLE IF NOT EXISTS public.folio_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio_id        UUID NOT NULL REFERENCES public.folios(id) ON DELETE CASCADE,
  branch_id       INTEGER REFERENCES public.branches(id),
  transaction_type TEXT NOT NULL, -- charge | payment | adjustment | refund
  category        TEXT,           -- room | food | beverage | service | other
  description     TEXT NOT NULL,
  amount          NUMERIC(14,2) DEFAULT 0,
  tax_amount      NUMERIC(14,2) DEFAULT 0,
  total_amount    NUMERIC(14,2) DEFAULT 0,
  reference       TEXT,
  posted_by       UUID REFERENCES public.users(id),
  posted_at       TIMESTAMPTZ DEFAULT NOW(),
  status          TEXT DEFAULT 'posted'
    CHECK (status IN ('posted','voided','reversed')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_folio_txn_folio ON public.folio_transactions(folio_id);

-- unpaid_bills (bills awaiting cashier settlement)
CREATE TABLE IF NOT EXISTS public.unpaid_bills (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  bill_number     TEXT UNIQUE NOT NULL,
  bill_type       TEXT NOT NULL, -- folio | pos_order | credit
  source_id       UUID,          -- folio_id or pos_order_id
  guest_name      TEXT,
  total_amount    NUMERIC(14,2) DEFAULT 0,
  amount_paid     NUMERIC(14,2) DEFAULT 0,
  balance_due     NUMERIC(14,2) DEFAULT 0,
  status          TEXT DEFAULT 'open'
    CHECK (status IN ('open','partial','paid','written_off','voided')),
  due_date        DATE,
  created_by      UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_unpaid_bills_branch ON public.unpaid_bills(branch_id, status);

-- ─────────────────────────────────────────────────────────────
-- Guest extended tables
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guest_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id      UUID NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES public.reservations(id),
  document_type TEXT NOT NULL,  -- passport | national_id | driving_license | other
  file_name     TEXT,
  file_url      TEXT,
  file_size     BIGINT,
  mime_type     TEXT,
  uploaded_by   UUID REFERENCES public.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.guest_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id    UUID NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,   -- room | dietary | amenity | communication
  preference  TEXT NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.guest_profiles (
  guest_id       UUID PRIMARY KEY REFERENCES public.guests(id) ON DELETE CASCADE,
  loyalty_number TEXT UNIQUE,
  vip_since      DATE,
  preferred_room_type UUID REFERENCES public.room_types(id),
  preferred_floor TEXT,
  allergies      JSONB DEFAULT '[]',
  notes          TEXT,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.guest_loyalty_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id        UUID NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  branch_id       INTEGER REFERENCES public.branches(id),
  transaction_type TEXT NOT NULL, -- earn | redeem | expire | adjustment
  points          NUMERIC(14,2) NOT NULL,
  reference       TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- Booking status history
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  old_status  TEXT,
  new_status  TEXT NOT NULL,
  changed_by  UUID REFERENCES public.users(id),
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-record status changes
CREATE OR REPLACE FUNCTION public._record_booking_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.booking_status_history(booking_id, old_status, new_status)
    VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_booking_status_history ON public.bookings;
CREATE TRIGGER trg_booking_status_history
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public._record_booking_status();

-- ─────────────────────────────────────────────────────────────
-- Room status history
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.room_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  old_status  TEXT,
  new_status  TEXT NOT NULL,
  changed_by  UUID REFERENCES public.users(id),
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public._record_room_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.room_status_history(room_id, old_status, new_status)
    VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_room_status_history ON public.rooms;
CREATE TRIGGER trg_room_status_history
  AFTER UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public._record_room_status();

-- ─────────────────────────────────────────────────────────────
-- Rate plans (referenced by booking.service.ts)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rate_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  room_type_id    UUID REFERENCES public.room_types(id),
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  rate_per_night  NUMERIC(14,2) NOT NULL DEFAULT 0,
  meal_plan       TEXT DEFAULT 'room_only',
  min_stay        INTEGER DEFAULT 1,
  max_stay        INTEGER,
  is_active       BOOLEAN DEFAULT TRUE,
  valid_from      DATE,
  valid_to        DATE,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- Conference tables (enough to unblock profit-loss & revenue endpoints)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conference_halls (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER NOT NULL REFERENCES public.branches(id),
  code          TEXT NOT NULL,
  name          TEXT NOT NULL,
  capacity      INTEGER DEFAULT 0,
  rate_per_day  NUMERIC(14,2) DEFAULT 0,
  amenities     JSONB DEFAULT '[]',
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (branch_id, code)
);

CREATE TABLE IF NOT EXISTS public.conference_bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER NOT NULL REFERENCES public.branches(id),
  hall_id         UUID REFERENCES public.conference_halls(id),
  booking_number  TEXT UNIQUE NOT NULL,
  customer_name   TEXT NOT NULL,
  event_name      TEXT,
  event_type      TEXT,
  event_date      DATE NOT NULL,
  start_time      TIME,
  end_time        TIME,
  pax             INTEGER DEFAULT 0,
  days            INTEGER DEFAULT 1,
  rate_per_day    NUMERIC(14,2) DEFAULT 0,
  subtotal        NUMERIC(14,2) DEFAULT 0,
  tax_amount      NUMERIC(14,2) DEFAULT 0,
  total_amount    NUMERIC(14,2) DEFAULT 0,
  amount_paid     NUMERIC(14,2) DEFAULT 0,
  balance_due     NUMERIC(14,2) DEFAULT 0,
  status          TEXT DEFAULT 'confirmed'
    CHECK (status IN ('draft','pending','confirmed','in_progress','completed','cancelled')),
  payment_status  TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('pending','partial','paid','refunded')),
  created_by      UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conference_hall_bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_booking_id UUID REFERENCES public.conference_bookings(id),
  hall_id         UUID REFERENCES public.conference_halls(id),
  date_from       DATE NOT NULL,
  date_to         DATE NOT NULL,
  setup_type      TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conference_daily_attendance (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_booking_id UUID NOT NULL REFERENCES public.conference_bookings(id),
  attendance_date       DATE NOT NULL,
  expected_pax          INTEGER DEFAULT 0,
  actual_pax            INTEGER DEFAULT 0,
  notes                 TEXT,
  recorded_by           UUID REFERENCES public.users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Update conference invoice RPC now that tables exist
CREATE OR REPLACE FUNCTION public.calculate_conference_invoice_with_attendance(
  p_booking_id UUID
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_bk public.conference_bookings%ROWTYPE;
        v_att RECORD;
BEGIN
  SELECT * INTO v_bk FROM public.conference_bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RETURN '{"ok":false,"error":"Not found"}'::JSONB; END IF;

  SELECT
    COUNT(*)            AS days,
    COALESCE(SUM(actual_pax),0) AS total_pax,
    COALESCE(MAX(actual_pax),0) AS peak_pax
  INTO v_att
  FROM public.conference_daily_attendance
  WHERE conference_booking_id = p_booking_id;

  RETURN jsonb_build_object(
    'ok', true,
    'booking_number', v_bk.booking_number,
    'days', v_att.days,
    'total_pax', v_att.total_pax,
    'subtotal', v_bk.subtotal,
    'tax_amount', v_bk.tax_amount,
    'total_amount', v_bk.total_amount
  );
END;
$$;
