-- =============================================================
-- 0023: Short code auto-generation triggers
-- short_code = last 6 chars of bill_number / order_number / confirmation_number
-- Ensures every bill and order gets a unique scannable short code
-- =============================================================

-- ---------------------------------------------------------------
-- Helper: extract short code from any reference number
-- Logic: take last 6 alphanumeric chars, uppercase
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION extract_short_code(ref TEXT)
RETURNS TEXT AS $$
BEGIN
  IF ref IS NULL THEN RETURN NULL; END IF;
  RETURN UPPER(RIGHT(REGEXP_REPLACE(ref, '[^A-Za-z0-9]', '', 'g'), 6));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ---------------------------------------------------------------
-- restaurant_bills: auto short_code on insert/update of bill_number
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_bill_short_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bill_number IS NOT NULL AND (NEW.short_code IS NULL OR NEW.short_code = '') THEN
    NEW.short_code := extract_short_code(NEW.bill_number);
  END IF;
  -- Keep balance in sync with balance_due
  IF NEW.balance_due IS NOT NULL THEN
    NEW.balance := NEW.balance_due;
  END IF;
  -- Keep guest_name in sync with customer_name
  IF NEW.customer_name IS NOT NULL AND NEW.guest_name IS NULL THEN
    NEW.guest_name := NEW.customer_name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bill_short_code ON restaurant_bills;
CREATE TRIGGER trg_bill_short_code
  BEFORE INSERT OR UPDATE OF bill_number ON restaurant_bills
  FOR EACH ROW EXECUTE FUNCTION trg_fn_bill_short_code();

-- Backfill short_code for existing restaurant_bills
UPDATE restaurant_bills
SET short_code = extract_short_code(bill_number)
WHERE (short_code IS NULL OR short_code = '') AND bill_number IS NOT NULL;

-- ---------------------------------------------------------------
-- restaurant_orders: auto short_code + sync bill_number from bill
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_order_short_code()
RETURNS TRIGGER AS $$
DECLARE v_bill_number TEXT;
BEGIN
  -- Auto short_code from order_number
  IF NEW.order_number IS NOT NULL AND (NEW.short_code IS NULL OR NEW.short_code = '') THEN
    NEW.short_code := extract_short_code(NEW.order_number);
  END IF;
  -- Sync bill_number from restaurant_bills when bill_id is set
  IF NEW.bill_id IS NOT NULL AND NEW.bill_number IS NULL THEN
    SELECT bill_number INTO v_bill_number FROM restaurant_bills WHERE id = NEW.bill_id;
    NEW.bill_number := v_bill_number;
  END IF;
  -- Sync guest_name from customer_name
  IF NEW.customer_name IS NOT NULL AND NEW.guest_name IS NULL THEN
    NEW.guest_name := NEW.customer_name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_short_code ON restaurant_orders;
CREATE TRIGGER trg_order_short_code
  BEFORE INSERT OR UPDATE OF order_number, bill_id ON restaurant_orders
  FOR EACH ROW EXECUTE FUNCTION trg_fn_order_short_code();

-- Backfill short_code for existing restaurant_orders
UPDATE restaurant_orders
SET short_code = extract_short_code(order_number)
WHERE (short_code IS NULL OR short_code = '') AND order_number IS NOT NULL;

-- ---------------------------------------------------------------
-- pos_shift_orders: add short_code column then trigger
-- ---------------------------------------------------------------
ALTER TABLE pos_shift_orders ADD COLUMN IF NOT EXISTS short_code TEXT;

CREATE OR REPLACE FUNCTION trg_fn_pos_order_short_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NOT NULL AND (NEW.short_code IS NULL OR NEW.short_code = '') THEN
    NEW.short_code := extract_short_code(NEW.order_number);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pos_order_short_code ON pos_shift_orders;
CREATE TRIGGER trg_pos_order_short_code
  BEFORE INSERT OR UPDATE OF order_number ON pos_shift_orders
  FOR EACH ROW EXECUTE FUNCTION trg_fn_pos_order_short_code();

-- Backfill for existing pos_shift_orders
UPDATE pos_shift_orders
SET short_code = extract_short_code(order_number)
WHERE (short_code IS NULL OR short_code = '') AND order_number IS NOT NULL;

-- ---------------------------------------------------------------
-- reservations: auto short_code from confirmation_number
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_reservation_short_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.confirmation_number IS NOT NULL AND (NEW.short_code IS NULL OR NEW.short_code = '') THEN
    NEW.short_code := extract_short_code(NEW.confirmation_number);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reservation_short_code ON reservations;
CREATE TRIGGER trg_reservation_short_code
  BEFORE INSERT OR UPDATE OF confirmation_number ON reservations
  FOR EACH ROW EXECUTE FUNCTION trg_fn_reservation_short_code();

-- Backfill for existing reservations
UPDATE reservations
SET short_code = extract_short_code(confirmation_number)
WHERE (short_code IS NULL OR short_code = '') AND confirmation_number IS NOT NULL;

-- ---------------------------------------------------------------
-- bar_orders: add short_code column + trigger
-- ---------------------------------------------------------------
ALTER TABLE bar_orders ADD COLUMN IF NOT EXISTS short_code TEXT;

CREATE OR REPLACE FUNCTION trg_fn_bar_order_short_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NOT NULL AND (NEW.short_code IS NULL OR NEW.short_code = '') THEN
    NEW.short_code := extract_short_code(NEW.order_number);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bar_order_short_code ON bar_orders;
CREATE TRIGGER trg_bar_order_short_code
  BEFORE INSERT OR UPDATE OF order_number ON bar_orders
  FOR EACH ROW EXECUTE FUNCTION trg_fn_bar_order_short_code();

UPDATE bar_orders SET short_code = extract_short_code(order_number)
WHERE (short_code IS NULL OR short_code = '') AND order_number IS NOT NULL;

-- ---------------------------------------------------------------
-- generate_payment_number DB function (used in recordPayment)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_payment_number(p_branch_id INTEGER DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE seq BIGINT;
BEGIN
  seq := public._next_seq('pay:' || COALESCE(p_branch_id::TEXT, 'g') || ':' || TO_CHAR(NOW(), 'YYYYMMDD'));
  RETURN 'PAY-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;
