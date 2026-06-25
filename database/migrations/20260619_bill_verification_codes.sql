-- ============================================================
-- BILL VERIFICATION CODES
-- Famous Gates Hotels & Restaurants - FamousGate POS/HMS
-- ============================================================
-- Live schema note:
--   branches.id is INTEGER, while users.id and pos_outlets.id are UUID.

DO $$
BEGIN
  CREATE TYPE public.code_status AS ENUM ('active', 'used', 'expired', 'voided');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE public.code_status ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE public.code_status ADD VALUE IF NOT EXISTS 'used';
ALTER TYPE public.code_status ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE public.code_status ADD VALUE IF NOT EXISTS 'voided';

DO $$
BEGIN
  CREATE TYPE public.bill_type AS ENUM (
    'restaurant',
    'accommodation',
    'conference',
    'banqueting',
    'pool',
    'carwash',
    'spa',
    'bar',
    'pos_outlet',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE public.bill_type ADD VALUE IF NOT EXISTS 'restaurant';
ALTER TYPE public.bill_type ADD VALUE IF NOT EXISTS 'accommodation';
ALTER TYPE public.bill_type ADD VALUE IF NOT EXISTS 'conference';
ALTER TYPE public.bill_type ADD VALUE IF NOT EXISTS 'banqueting';
ALTER TYPE public.bill_type ADD VALUE IF NOT EXISTS 'pool';
ALTER TYPE public.bill_type ADD VALUE IF NOT EXISTS 'carwash';
ALTER TYPE public.bill_type ADD VALUE IF NOT EXISTS 'spa';
ALTER TYPE public.bill_type ADD VALUE IF NOT EXISTS 'bar';
ALTER TYPE public.bill_type ADD VALUE IF NOT EXISTS 'pos_outlet';
ALTER TYPE public.bill_type ADD VALUE IF NOT EXISTS 'other';

CREATE TABLE IF NOT EXISTS public.bill_verification_codes (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(6) NOT NULL UNIQUE,
  bill_ref VARCHAR(50) NOT NULL,
  bill_type public.bill_type NOT NULL DEFAULT 'restaurant',
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  outlet_id UUID REFERENCES public.pos_outlets(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL,
  status public.code_status NOT NULL DEFAULT 'active',
  generated_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_bvc_code ON public.bill_verification_codes (code);
CREATE INDEX IF NOT EXISTS idx_bvc_bill_ref ON public.bill_verification_codes (bill_ref);
CREATE INDEX IF NOT EXISTS idx_bvc_branch ON public.bill_verification_codes (branch_id);
CREATE INDEX IF NOT EXISTS idx_bvc_status ON public.bill_verification_codes (status);
CREATE INDEX IF NOT EXISTS idx_bvc_created_at ON public.bill_verification_codes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bvc_outlet ON public.bill_verification_codes (outlet_id);

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.set_public_short_code()
RETURNS TRIGGER AS $$
DECLARE
  row_branch_key TEXT;
BEGIN
  row_branch_key := NULLIF(to_jsonb(NEW)->>'branch_id', '');

  IF NEW.short_code IS NULL OR btrim(NEW.short_code) = '' THEN
    NEW.short_code := public.generate_public_short_code(TG_RELID::REGCLASS, row_branch_key);
  ELSE
    NEW.short_code := upper(regexp_replace(NEW.short_code, '[^A-Z0-9]', '', 'g'));

    IF NEW.short_code !~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4,6}$' THEN
      RAISE EXCEPTION 'Invalid short_code %. Use 4-6 chars from 2-9 and A-Z excluding 0, O, I, 1.', NEW.short_code;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bvc_updated_at ON public.bill_verification_codes;
CREATE TRIGGER trg_bvc_updated_at
BEFORE UPDATE ON public.bill_verification_codes
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE OR REPLACE FUNCTION public.fn_generate_bill_code(code_length INT DEFAULT 5)
RETURNS VARCHAR AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code VARCHAR := '';
  i INT;
  attempts INT := 0;
BEGIN
  IF code_length < 4 OR code_length > 6 THEN
    RAISE EXCEPTION 'Bill verification code length must be between 4 and 6';
  END IF;

  LOOP
    new_code := '';
    FOR i IN 1..code_length LOOP
      new_code := new_code || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
    END LOOP;

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.bill_verification_codes WHERE code = new_code
    );

    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate a unique code after 100 attempts';
    END IF;
  END LOOP;

  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fn_create_bill_code(
  p_bill_ref VARCHAR,
  p_bill_type public.bill_type,
  p_branch_id INTEGER,
  p_generated_by UUID,
  p_amount NUMERIC,
  p_outlet_id UUID DEFAULT NULL,
  p_code_length INT DEFAULT 5,
  p_expires_hours INT DEFAULT 24,
  p_code VARCHAR DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (code VARCHAR, expires_at TIMESTAMPTZ) AS $$
DECLARE
  v_code VARCHAR;
  v_expires TIMESTAMPTZ;
BEGIN
  v_code := COALESCE(
    NULLIF(upper(regexp_replace(p_code, '[^A-Z0-9]', '', 'g')), ''),
    public.fn_generate_bill_code(p_code_length)
  );
  v_expires := NOW() + (p_expires_hours || ' hours')::INTERVAL;

  IF v_code !~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4,6}$' THEN
    RAISE EXCEPTION 'Invalid bill verification code %. Use 4-6 chars from 2-9 and A-Z excluding 0, O, I, 1.', v_code;
  END IF;

  INSERT INTO public.bill_verification_codes (
    code,
    bill_ref,
    bill_type,
    branch_id,
    outlet_id,
    amount,
    generated_by,
    expires_at,
    notes,
    metadata
  ) VALUES (
    v_code,
    p_bill_ref,
    p_bill_type,
    p_branch_id,
    p_outlet_id,
    p_amount,
    p_generated_by,
    v_expires,
    p_notes,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN QUERY SELECT v_code, v_expires;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fn_verify_bill_code(
  p_code VARCHAR,
  p_branch_id INTEGER,
  p_verified_by UUID
)
RETURNS VARCHAR AS $$
DECLARE
  v_row public.bill_verification_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.bill_verification_codes
  WHERE code = upper(regexp_replace(p_code, '[^A-Z0-9]', '', 'g'))
    AND branch_id = p_branch_id;

  IF NOT FOUND THEN
    RETURN 'invalid';
  END IF;

  IF v_row.status = 'used' THEN
    RETURN 'already_used';
  END IF;

  IF v_row.status IN ('expired', 'voided') THEN
    RETURN v_row.status::VARCHAR;
  END IF;

  IF v_row.expires_at < NOW() THEN
    UPDATE public.bill_verification_codes SET status = 'expired' WHERE id = v_row.id;
    RETURN 'expired';
  END IF;

  UPDATE public.bill_verification_codes
  SET status = 'used',
      verified_by = p_verified_by,
      verified_at = NOW()
  WHERE id = v_row.id;

  RETURN 'verified';
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.bill_verification_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bill_verification_codes_service_role_all ON public.bill_verification_codes;
CREATE POLICY bill_verification_codes_service_role_all
ON public.bill_verification_codes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

REVOKE ALL ON FUNCTION public.fn_create_bill_code(
  VARCHAR,
  public.bill_type,
  INTEGER,
  UUID,
  NUMERIC,
  UUID,
  INT,
  INT,
  VARCHAR,
  TEXT,
  JSONB
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.fn_verify_bill_code(VARCHAR, INTEGER, UUID)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_create_bill_code(
  VARCHAR,
  public.bill_type,
  INTEGER,
  UUID,
  NUMERIC,
  UUID,
  INT,
  INT,
  VARCHAR,
  TEXT,
  JSONB
) TO service_role;

GRANT EXECUTE ON FUNCTION public.fn_verify_bill_code(VARCHAR, INTEGER, UUID)
TO service_role;

NOTIFY pgrst, 'reload schema';
