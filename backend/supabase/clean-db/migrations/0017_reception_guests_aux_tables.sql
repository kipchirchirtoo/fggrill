-- =============================================================
-- 0017: Reception Module - Auxiliary guest/reservation tables
-- reservation_guests, loyalty_transactions,
-- customer_invoices, quotations
-- All referenced in guest.controller.ts deleteGuest()
-- =============================================================

-- -------------------------
-- reservation_guests
-- Additional guests on a reservation (companions)
-- -------------------------
CREATE TABLE IF NOT EXISTS reservation_guests (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  guest_id       UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  is_primary     BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(reservation_id, guest_id)
);

CREATE INDEX IF NOT EXISTS idx_reservation_guests_res   ON reservation_guests(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_guests_guest ON reservation_guests(guest_id);

-- -------------------------
-- loyalty_transactions
-- Guest loyalty points ledger
-- -------------------------
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_id   UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  points     INTEGER NOT NULL,
  type       TEXT DEFAULT 'earn' CHECK (type IN ('earn','redeem','adjust','expire')),
  reason     TEXT,
  reference  TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_guest ON loyalty_transactions(guest_id);

-- Trigger: keep guests.loyalty_points in sync
CREATE OR REPLACE FUNCTION sync_guest_loyalty_points()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE guests
  SET loyalty_points = (
    SELECT COALESCE(SUM(points), 0)
    FROM loyalty_transactions
    WHERE guest_id = COALESCE(NEW.guest_id, OLD.guest_id)
  )
  WHERE id = COALESCE(NEW.guest_id, OLD.guest_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_loyalty_points ON loyalty_transactions;
CREATE TRIGGER trg_sync_loyalty_points
  AFTER INSERT OR UPDATE OR DELETE ON loyalty_transactions
  FOR EACH ROW EXECUTE FUNCTION sync_guest_loyalty_points();

-- -------------------------
-- customer_invoices
-- Finance invoices issued to guests
-- -------------------------
CREATE TABLE IF NOT EXISTS customer_invoices (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id       INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  invoice_number  TEXT UNIQUE,
  customer_id     UUID REFERENCES guests(id) ON DELETE SET NULL,
  folio_id        UUID REFERENCES folios(id) ON DELETE SET NULL,
  reservation_id  UUID REFERENCES reservations(id) ON DELETE SET NULL,
  amount          NUMERIC(12,2) DEFAULT 0,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','issued','paid','cancelled','overdue')),
  due_date        DATE,
  issued_at       TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  notes           TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_invoices_customer ON customer_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_branch   ON customer_invoices(branch_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_status   ON customer_invoices(status);

-- -------------------------
-- quotations
-- Pre-booking quotations for guests / corporate
-- -------------------------
CREATE TABLE IF NOT EXISTS quotations (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id        INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  quotation_number TEXT UNIQUE,
  customer_id      UUID REFERENCES guests(id) ON DELETE SET NULL,
  customer_name    TEXT,
  customer_email   TEXT,
  customer_phone   TEXT,
  room_type_id     UUID REFERENCES room_types(id) ON DELETE SET NULL,
  check_in_date    DATE,
  check_out_date   DATE,
  adults           INTEGER DEFAULT 1,
  children         INTEGER DEFAULT 0,
  meal_plan        TEXT,
  total_amount     NUMERIC(12,2) DEFAULT 0,
  status           TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected','expired','converted')),
  valid_until      DATE,
  notes            TEXT,
  converted_to_reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_branch   ON quotations(branch_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status   ON quotations(status);
