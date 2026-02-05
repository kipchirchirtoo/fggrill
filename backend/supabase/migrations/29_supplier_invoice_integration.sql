-- =====================================================
-- SUPPLIER INVOICE INTEGRATION
-- Handles atomic invoice approval, GRNI clearing, and ledger updates
-- =====================================================

CREATE OR REPLACE FUNCTION approve_supplier_invoice_and_update_ledger(
  p_invoice_id UUID,
  p_approved_by UUID
)
RETURNS JSONB AS $$
DECLARE
  v_invoice_record RECORD;
BEGIN
  -- 1. Get and check invoice
  SELECT * INTO v_invoice_record FROM store_supplier_invoices WHERE id = p_invoice_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
  
  IF v_invoice_record.status = 'approved' THEN
    RAISE EXCEPTION 'Invoice is already approved';
  END IF;
  
  -- 2. Update status to approved
  UPDATE store_supplier_invoices
  SET 
    status = 'approved',
    approved_by_id = p_approved_by,
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_invoice_id
  RETURNING * INTO v_invoice_record;
  
  -- 3. Clear GRNI control entry if linked
  IF v_invoice_record.grni_cleared_id IS NOT NULL THEN
    UPDATE store_grni_control_account
    SET 
      status = 'cleared',
      cleared_at = NOW(),
      cleared_by_invoice_id = p_invoice_id,
      updated_at = NOW()
    WHERE id = v_invoice_record.grni_cleared_id;
  END IF;
  
  -- The following trigger in 25_supplier_ledger.sql will handle:
  -- - post_invoice_to_ledger_trigger (Ledger & AP updates)
  
  -- The following trigger in 27_procurement_audit_logs.sql will handle:
  -- - audit_invoice_approval_trigger (Audit Logs)
  
  RETURN to_jsonb(v_invoice_record);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
