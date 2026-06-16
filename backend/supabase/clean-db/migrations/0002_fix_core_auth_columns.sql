-- ============================================================
-- Migration 0002: Fix core auth / user / staff_profiles columns
-- Purpose: Allow login, dashboard, and staff management to work.
--          The backend and Flutter app reference columns that were
--          renamed or dropped in the clean schema.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- USERS table: add missing / renamed columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role                TEXT,
  ADD COLUMN IF NOT EXISTS avatar              TEXT,
  ADD COLUMN IF NOT EXISTS department          TEXT,
  ADD COLUMN IF NOT EXISTS address             TEXT,
  ADD COLUMN IF NOT EXISTS last_login          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rfid_tag            TEXT,
  ADD COLUMN IF NOT EXISTS pos_pin             TEXT,
  ADD COLUMN IF NOT EXISTS active_outlet_id    UUID,
  ADD COLUMN IF NOT EXISTS active_outlet_type  TEXT,
  ADD COLUMN IF NOT EXISTS active_shift_id     UUID;

-- Legacy alias: backend uses phone_number, new schema uses phone
-- Use a generated column so reads on either name work
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE public.users ADD COLUMN phone_number TEXT;
  END IF;
END $$;

-- Keep phone_number in sync with phone
CREATE OR REPLACE FUNCTION public._sync_users_phone_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.phone IS DISTINCT FROM OLD.phone THEN
    NEW.phone_number := NEW.phone;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.phone_number IS DISTINCT FROM OLD.phone_number THEN
    NEW.phone := NEW.phone_number;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_users_phone ON public.users;
CREATE TRIGGER trg_sync_users_phone
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public._sync_users_phone_number();

-- ─────────────────────────────────────────────────────────────
-- STAFF_PROFILES table: add missing / renamed columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS role                   TEXT,
  ADD COLUMN IF NOT EXISTS basic_salary           NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_name              TEXT,
  ADD COLUMN IF NOT EXISTS account_number         TEXT,
  ADD COLUMN IF NOT EXISTS profile_photo_url      TEXT,
  ADD COLUMN IF NOT EXISTS rfid_tag               TEXT,
  ADD COLUMN IF NOT EXISTS pos_pin                TEXT,
  ADD COLUMN IF NOT EXISTS nssf_enabled           BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS shif_enabled           BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS uniform_enabled        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS housing_fund_enabled   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS department             TEXT;

-- Legacy alias: backend uses position, new schema uses job_title
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'position'
  ) THEN
    ALTER TABLE public.staff_profiles ADD COLUMN position TEXT;
  END IF;
END $$;

-- Keep position <-> job_title in sync
CREATE OR REPLACE FUNCTION public._sync_staff_position()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.job_title IS DISTINCT FROM OLD.job_title THEN
    NEW.position := NEW.job_title;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.position IS DISTINCT FROM OLD.position THEN
    NEW.job_title := NEW.position;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_staff_position ON public.staff_profiles;
CREATE TRIGGER trg_sync_staff_position
  BEFORE INSERT OR UPDATE ON public.staff_profiles
  FOR EACH ROW EXECUTE FUNCTION public._sync_staff_position();

-- ─────────────────────────────────────────────────────────────
-- RPC: Number-generation functions (42 functions the backend calls)
-- Pattern: each uses a per-branch/global sequence stored in a
--          dedicated sequences table, then returns a padded string.
-- ─────────────────────────────────────────────────────────────

-- Shared sequences table
CREATE TABLE IF NOT EXISTS public._doc_sequences (
  key         TEXT PRIMARY KEY,
  last_val    BIGINT NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Generic increment helper
CREATE OR REPLACE FUNCTION public._next_seq(p_key TEXT)
RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v BIGINT;
BEGIN
  INSERT INTO public._doc_sequences(key, last_val)
  VALUES (p_key, 1)
  ON CONFLICT (key) DO UPDATE
    SET last_val   = _doc_sequences.last_val + 1,
        updated_at = NOW()
  RETURNING last_val INTO v;
  RETURN v;
END;
$$;

-- PO number: PO-BRANCHCODE-YYYYMMDD-NNNN
CREATE OR REPLACE FUNCTION public.generate_po_number(p_branch_id INT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  seq   BIGINT;
  key   TEXT;
BEGIN
  key := 'po:' || COALESCE(p_branch_id::TEXT, 'g') || ':' || TO_CHAR(NOW(), 'YYYYMM');
  seq := public._next_seq(key);
  RETURN 'PO-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$;

-- Reservation / booking number
CREATE OR REPLACE FUNCTION public.generate_reservation_number(p_branch_id INT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq BIGINT;
BEGIN
  seq := public._next_seq('rsv:' || COALESCE(p_branch_id::TEXT, 'g') || ':' || TO_CHAR(NOW(), 'YYYYMM'));
  RETURN 'BK-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(seq::TEXT, 5, '0');
END;
$$;

-- Service booking number
CREATE OR REPLACE FUNCTION public.generate_service_booking_number(p_branch_id INT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq BIGINT;
BEGIN
  seq := public._next_seq('svc:' || COALESCE(p_branch_id::TEXT, 'g') || ':' || TO_CHAR(NOW(), 'YYYYMM'));
  RETURN 'SB-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(seq::TEXT, 5, '0');
END;
$$;

-- Bill number
CREATE OR REPLACE FUNCTION public.generate_bill_number(p_branch_id INT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq BIGINT;
BEGIN
  seq := public._next_seq('bill:' || COALESCE(p_branch_id::TEXT, 'g') || ':' || TO_CHAR(NOW(), 'YYYYMMDD'));
  RETURN 'BILL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$;

-- Cashier transaction number
CREATE OR REPLACE FUNCTION public.generate_cashier_transaction_number(p_branch_id INT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq BIGINT;
BEGIN
  seq := public._next_seq('ctxn:' || COALESCE(p_branch_id::TEXT, 'g') || ':' || TO_CHAR(NOW(), 'YYYYMMDD'));
  RETURN 'CTX-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(seq::TEXT, 5, '0');
END;
$$;

-- Shift number
CREATE OR REPLACE FUNCTION public.generate_shift_number(p_branch_id INT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq BIGINT;
BEGIN
  seq := public._next_seq('shft:' || COALESCE(p_branch_id::TEXT, 'g') || ':' || TO_CHAR(NOW(), 'YYYYMMDD'));
  RETURN 'SHF-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$;

-- Payment number
CREATE OR REPLACE FUNCTION public.generate_payment_number(p_branch_id INT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq BIGINT;
BEGIN
  seq := public._next_seq('pay:' || COALESCE(p_branch_id::TEXT, 'g') || ':' || TO_CHAR(NOW(), 'YYYYMM'));
  RETURN 'PAY-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(seq::TEXT, 5, '0');
END;
$$;

-- Invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_branch_id INT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq BIGINT;
BEGIN
  seq := public._next_seq('inv:' || COALESCE(p_branch_id::TEXT, 'g') || ':' || TO_CHAR(NOW(), 'YYYYMM'));
  RETURN 'INV-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(seq::TEXT, 5, '0');
END;
$$;

-- Transaction number (generic)
CREATE OR REPLACE FUNCTION public.generate_transaction_number(p_branch_id INT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq BIGINT;
BEGIN
  seq := public._next_seq('txn:' || COALESCE(p_branch_id::TEXT, 'g') || ':' || TO_CHAR(NOW(), 'YYYYMMDD'));
  RETURN 'TXN-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(seq::TEXT, 6, '0');
END;
$$;

-- Order number (restaurant / bar / generic)
CREATE OR REPLACE FUNCTION public.generate_order_number(p_branch_id INT DEFAULT NULL, p_prefix TEXT DEFAULT 'ORD')
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq BIGINT;
BEGIN
  seq := public._next_seq('ord:' || p_prefix || ':' || COALESCE(p_branch_id::TEXT, 'g') || ':' || TO_CHAR(NOW(), 'YYYYMMDD'));
  RETURN p_prefix || '-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$;

-- get_next_order_number (alias used by inventory-operations.service)
CREATE OR REPLACE FUNCTION public.get_next_order_number(p_branch_id INT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN public.generate_order_number(p_branch_id, 'ORD');
END;
$$;

-- Credit number
CREATE OR REPLACE FUNCTION public.generate_credit_number(p_branch_id INT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq BIGINT;
BEGIN
  seq := public._next_seq('crd:' || COALESCE(p_branch_id::TEXT, 'g') || ':' || TO_CHAR(NOW(), 'YYYYMM'));
  RETURN 'CRD-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(seq::TEXT, 5, '0');
END;
$$;

-- Dispatch number
CREATE OR REPLACE FUNCTION public.get_next_dispatch_number(p_branch_id INT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq BIGINT;
BEGIN
  seq := public._next_seq('dsp:' || COALESCE(p_branch_id::TEXT, 'g') || ':' || TO_CHAR(NOW(), 'YYYYMM'));
  RETURN 'DSP-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(seq::TEXT, 5, '0');
END;
$$;

-- Stock request number
CREATE OR REPLACE FUNCTION public.get_next_stock_request_number(p_branch_id INT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq BIGINT;
BEGIN
  seq := public._next_seq('sr:' || COALESCE(p_branch_id::TEXT, 'g') || ':' || TO_CHAR(NOW(), 'YYYYMM'));
  RETURN 'SR-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(seq::TEXT, 5, '0');
END;
$$;

-- SKU serial
CREATE OR REPLACE FUNCTION public.get_next_sku_serial(p_prefix TEXT DEFAULT 'SKU')
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq BIGINT;
BEGIN
  seq := public._next_seq('sku:' || p_prefix);
  RETURN p_prefix || '-' || LPAD(seq::TEXT, 6, '0');
END;
$$;

-- Barcode
CREATE OR REPLACE FUNCTION public.generate_barcode(p_item_id UUID DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq BIGINT;
BEGIN
  seq := public._next_seq('bc:' || COALESCE(p_item_id::TEXT, 'g'));
  RETURN '2' || LPAD(seq::TEXT, 12, '0');
END;
$$;

-- Kitchen receipt number
CREATE OR REPLACE FUNCTION public.generate_kitchen_receipt_number(p_branch_id INT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq BIGINT;
BEGIN
  seq := public._next_seq('krcpt:' || COALESCE(p_branch_id::TEXT, 'g') || ':' || TO_CHAR(NOW(), 'YYYYMMDD'));
  RETURN 'KR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$;

-- Kitchen ledger number
CREATE OR REPLACE FUNCTION public.generate_kitchen_ledger_number(p_branch_id INT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq BIGINT;
BEGIN
  seq := public._next_seq('kldg:' || COALESCE(p_branch_id::TEXT, 'g') || ':' || TO_CHAR(NOW(), 'YYYYMM'));
  RETURN 'KL-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(seq::TEXT, 5, '0');
END;
$$;

-- Portion tracking number
CREATE OR REPLACE FUNCTION public.generate_portion_tracking_number(p_branch_id INT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq BIGINT;
BEGIN
  seq := public._next_seq('ptn:' || COALESCE(p_branch_id::TEXT, 'g') || ':' || TO_CHAR(NOW(), 'YYYYMMDD'));
  RETURN 'PT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(seq::TEXT, 5, '0');
END;
$$;

-- Stock take number
CREATE OR REPLACE FUNCTION public.get_stock_take_number(p_branch_id INT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq BIGINT;
BEGIN
  seq := public._next_seq('st:' || COALESCE(p_branch_id::TEXT, 'g') || ':' || TO_CHAR(NOW(), 'YYYYMM'));
  RETURN 'ST-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$;

-- Central stock take number
CREATE OR REPLACE FUNCTION public.get_central_stock_take_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq BIGINT;
BEGIN
  seq := public._next_seq('cst:' || TO_CHAR(NOW(), 'YYYYMM'));
  RETURN 'CST-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$;

-- Spoilage number
CREATE OR REPLACE FUNCTION public.get_spoilage_number(p_branch_id INT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq BIGINT;
BEGIN
  seq := public._next_seq('sp:' || COALESCE(p_branch_id::TEXT, 'g') || ':' || TO_CHAR(NOW(), 'YYYYMM'));
  RETURN 'SP-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$;

-- OTP table and functions
CREATE TABLE IF NOT EXISTS public._otps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT NOT NULL,
  otp_code   TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otps_key ON public._otps(key);

CREATE OR REPLACE FUNCTION public.generate_otp(p_key TEXT, p_ttl_minutes INT DEFAULT 10)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE code TEXT;
BEGIN
  code := LPAD((FLOOR(RANDOM() * 900000) + 100000)::TEXT, 6, '0');
  INSERT INTO public._otps(key, otp_code, expires_at)
  VALUES (p_key, code, NOW() + (p_ttl_minutes || ' minutes')::INTERVAL);
  RETURN code;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_dispatch_otp(p_dispatch_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN public.generate_otp('dispatch:' || p_dispatch_id::TEXT, 60);
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_dispatch_otp(p_dispatch_id UUID, p_code TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE found BOOLEAN;
BEGIN
  UPDATE public._otps
  SET used = TRUE
  WHERE key = 'dispatch:' || p_dispatch_id::TEXT
    AND otp_code = p_code
    AND expires_at > NOW()
    AND used = FALSE
  RETURNING TRUE INTO found;
  RETURN COALESCE(found, FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE n INT;
BEGIN
  DELETE FROM public._otps WHERE expires_at < NOW() OR used = TRUE;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Audit log helper
CREATE OR REPLACE FUNCTION public.create_audit_log(
  p_branch_id   INT,
  p_actor_id    UUID,
  p_module      TEXT,
  p_action      TEXT,
  p_entity_type TEXT,
  p_entity_id   UUID DEFAULT NULL,
  p_old_data    JSONB DEFAULT NULL,
  p_new_data    JSONB DEFAULT NULL,
  p_reason      TEXT DEFAULT NULL,
  p_severity    TEXT DEFAULT 'info'
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.audit_events(
    branch_id, actor_id, module, action, entity_type, entity_id,
    old_data, new_data, reason, severity
  ) VALUES (
    p_branch_id, p_actor_id, p_module, p_action, p_entity_type, p_entity_id,
    p_old_data, p_new_data, p_reason, p_severity
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Unread notification count
CREATE OR REPLACE FUNCTION public.get_unread_count(p_user_id UUID)
RETURNS BIGINT LANGUAGE sql STABLE AS $$
  SELECT COUNT(*) FROM public.notifications
  WHERE recipient_user_id = p_user_id AND status = 'unread';
$$;

-- RLS policy inspector
CREATE OR REPLACE FUNCTION public.get_rls_policies(p_table TEXT DEFAULT NULL)
RETURNS TABLE(tablename TEXT, policyname TEXT, cmd TEXT, qual TEXT) LANGUAGE sql STABLE AS $$
  SELECT
    tablename::TEXT,
    policyname::TEXT,
    cmd::TEXT,
    qual::TEXT
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (p_table IS NULL OR tablename = p_table);
$$;

-- exec_sql (admin only — restricted by RLS/role in production)
CREATE OR REPLACE FUNCTION public.exec_sql(p_sql TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN '{"ok": true}'::JSONB;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
