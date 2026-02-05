-- =====================================================
-- FIX GRN APPROVAL RPC
-- Uses 'completed' status instead of 'approved'
-- =====================================================

CREATE OR REPLACE FUNCTION approve_grn_and_update_all(
  p_grn_id UUID,
  p_approved_by UUID
)
RETURNS JSONB AS $$
DECLARE
  v_grn_record RECORD;
BEGIN
  -- 1. Check if GRN exists and is not already approved
  SELECT * INTO v_grn_record FROM store_grn WHERE id = p_grn_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRN not found';
  END IF;
  
  IF v_grn_record.grn_approved = true THEN
    RAISE EXCEPTION 'GRN is already approved';
  END IF;
  
  -- 2. Update GRN to approved
  UPDATE store_grn
  SET 
    grn_approved = true,
    approved_by_id = p_approved_by,
    approved_at = NOW(),
    status = 'completed',
    updated_at = NOW()
  WHERE id = p_grn_id
  RETURNING * INTO v_grn_record;
  
  RETURN to_jsonb(v_grn_record);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
