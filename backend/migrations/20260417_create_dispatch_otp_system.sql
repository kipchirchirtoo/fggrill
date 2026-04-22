-- Migration: Create Dispatch OTP System
-- Description: Implements OTP-based verification for dispatch deliveries
-- Date: 2026-04-17

-- =====================================================
-- 1. CREATE DISPATCH OTP TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS dispatch_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID REFERENCES store_dispatches(id) ON DELETE CASCADE NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES users(id),
  is_used BOOLEAN DEFAULT FALSE NOT NULL,
  attempts INT DEFAULT 0 NOT NULL,
  max_attempts INT DEFAULT 3 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT valid_otp_code CHECK (otp_code ~ '^[0-9]{6}$'),
  CONSTRAINT valid_attempts CHECK (attempts >= 0 AND attempts <= max_attempts),
  CONSTRAINT valid_expiry CHECK (expires_at > generated_at)
);

-- =====================================================
-- 2. CREATE INDEXES
-- =====================================================

CREATE INDEX idx_dispatch_otps_dispatch ON dispatch_otps(dispatch_id);
CREATE INDEX idx_dispatch_otps_code ON dispatch_otps(otp_code);
CREATE INDEX idx_dispatch_otps_expires ON dispatch_otps(expires_at);
CREATE INDEX idx_dispatch_otps_used ON dispatch_otps(is_used);
CREATE UNIQUE INDEX idx_dispatch_otps_active ON dispatch_otps(dispatch_id) 
  WHERE is_used = FALSE AND verified_at IS NULL;

-- =====================================================
-- 3. CREATE OTP GENERATION FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION generate_dispatch_otp(
  p_dispatch_id UUID,
  p_expiry_hours INT DEFAULT 24
)
RETURNS TABLE (
  otp_id UUID,
  otp_code VARCHAR(6),
  expires_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_otp_code VARCHAR(6);
  v_expires_at TIMESTAMP WITH TIME ZONE;
  v_otp_id UUID;
  v_max_attempts INT := 10;
  v_attempt INT := 0;
BEGIN
  -- Invalidate any existing active OTPs for this dispatch
  UPDATE dispatch_otps
  SET is_used = TRUE, updated_at = NOW()
  WHERE dispatch_id = p_dispatch_id 
    AND is_used = FALSE 
    AND verified_at IS NULL;

  -- Generate unique OTP code
  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > v_max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique OTP after % attempts', v_max_attempts;
    END IF;

    -- Generate 6-digit random code
    v_otp_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    
    -- Check if code is unique and not recently used
    IF NOT EXISTS (
      SELECT 1 FROM dispatch_otps 
      WHERE otp_code = v_otp_code 
        AND generated_at > NOW() - INTERVAL '1 hour'
    ) THEN
      EXIT;
    END IF;
  END LOOP;

  -- Calculate expiry
  v_expires_at := NOW() + (p_expiry_hours || ' hours')::INTERVAL;

  -- Insert new OTP
  INSERT INTO dispatch_otps (
    dispatch_id,
    otp_code,
    generated_at,
    expires_at
  ) VALUES (
    p_dispatch_id,
    v_otp_code,
    NOW(),
    v_expires_at
  )
  RETURNING id, otp_code, expires_at
  INTO v_otp_id, v_otp_code, v_expires_at;

  RETURN QUERY SELECT v_otp_id, v_otp_code, v_expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. CREATE OTP VERIFICATION FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION verify_dispatch_otp(
  p_dispatch_id UUID,
  p_otp_code VARCHAR(6),
  p_user_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  otp_id UUID
) AS $$
DECLARE
  v_otp_record RECORD;
  v_success BOOLEAN := FALSE;
  v_message TEXT;
  v_otp_id UUID;
BEGIN
  -- Find the active OTP for this dispatch
  SELECT * INTO v_otp_record
  FROM dispatch_otps
  WHERE dispatch_id = p_dispatch_id
    AND is_used = FALSE
    AND verified_at IS NULL
  ORDER BY generated_at DESC
  LIMIT 1;

  -- Check if OTP exists
  IF v_otp_record IS NULL THEN
    RETURN QUERY SELECT FALSE, 'No active OTP found for this dispatch'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Check if max attempts exceeded
  IF v_otp_record.attempts >= v_otp_record.max_attempts THEN
    RETURN QUERY SELECT FALSE, 'Maximum verification attempts exceeded'::TEXT, v_otp_record.id;
    RETURN;
  END IF;

  -- Increment attempt counter
  UPDATE dispatch_otps
  SET attempts = attempts + 1, updated_at = NOW()
  WHERE id = v_otp_record.id;

  -- Check if expired
  IF v_otp_record.expires_at < NOW() THEN
    RETURN QUERY SELECT FALSE, 'OTP has expired'::TEXT, v_otp_record.id;
    RETURN;
  END IF;

  -- Verify OTP code
  IF v_otp_record.otp_code = p_otp_code THEN
    -- Mark as verified
    UPDATE dispatch_otps
    SET 
      is_used = TRUE,
      verified_at = NOW(),
      verified_by = p_user_id,
      updated_at = NOW()
    WHERE id = v_otp_record.id;

    -- Update dispatch status to COMPLETED
    UPDATE store_dispatches
    SET 
      status = 'COMPLETED',
      delivered_at = NOW(),
      received_by = p_user_id,
      updated_at = NOW()
    WHERE id = p_dispatch_id;

    v_success := TRUE;
    v_message := 'OTP verified successfully';
    v_otp_id := v_otp_record.id;
  ELSE
    v_success := FALSE;
    v_message := 'Invalid OTP code';
    v_otp_id := v_otp_record.id;
  END IF;

  RETURN QUERY SELECT v_success, v_message, v_otp_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. CREATE CLEANUP FUNCTION FOR EXPIRED OTPS
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS INT AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  -- Mark expired OTPs as used
  UPDATE dispatch_otps
  SET is_used = TRUE, updated_at = NOW()
  WHERE expires_at < NOW()
    AND is_used = FALSE
    AND verified_at IS NULL;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. ADD DISPATCH STATUS COLUMNS (IF NOT EXISTS)
-- =====================================================

DO $$ 
BEGIN
  -- Add delivered_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'store_dispatches' 
    AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE store_dispatches 
    ADD COLUMN delivered_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add received_by column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'store_dispatches' 
    AND column_name = 'received_by'
  ) THEN
    ALTER TABLE store_dispatches 
    ADD COLUMN received_by UUID REFERENCES users(id);
  END IF;
END $$;

-- =====================================================
-- 7. CREATE TRIGGER FOR AUTO OTP GENERATION
-- =====================================================

CREATE OR REPLACE FUNCTION auto_generate_dispatch_otp()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate OTP when dispatch is created
  IF NEW.status = 'DISPATCHED' OR NEW.status = 'IN_TRANSIT' THEN
    PERFORM generate_dispatch_otp(NEW.id, 24);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_generate_dispatch_otp
  AFTER INSERT ON store_dispatches
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_dispatch_otp();

-- =====================================================
-- 8. COMMENTS
-- =====================================================

COMMENT ON TABLE dispatch_otps IS 'OTP verification system for dispatch deliveries';
COMMENT ON COLUMN dispatch_otps.otp_code IS '6-digit numeric OTP code';
COMMENT ON COLUMN dispatch_otps.expires_at IS 'OTP expiration timestamp (default 24 hours)';
COMMENT ON COLUMN dispatch_otps.attempts IS 'Number of verification attempts';
COMMENT ON COLUMN dispatch_otps.max_attempts IS 'Maximum allowed verification attempts (default 3)';
COMMENT ON FUNCTION generate_dispatch_otp IS 'Generates a unique 6-digit OTP for dispatch verification';
COMMENT ON FUNCTION verify_dispatch_otp IS 'Verifies OTP and marks dispatch as completed';
COMMENT ON FUNCTION cleanup_expired_otps IS 'Marks expired OTPs as used (run periodically)';

-- =====================================================
-- 9. GRANT PERMISSIONS
-- =====================================================

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION generate_dispatch_otp TO authenticated;
GRANT EXECUTE ON FUNCTION verify_dispatch_otp TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_otps TO authenticated;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
