-- =====================================================
-- PROCUREMENT AUDIT LOGS
-- Immutable audit trail for all procurement transactions
-- =====================================================

-- Create audit action enum
DO $$ BEGIN
  CREATE TYPE procurement_audit_action AS ENUM (
    'create',
    'update',
    'delete',
    'approve',
    'reject',
    'submit',
    'lock',
    'unlock',
    'process',
    'cancel'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create procurement audit logs table
CREATE TABLE IF NOT EXISTS store_procurement_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- User and timestamp
  user_id UUID REFERENCES users(id) NOT NULL,
  user_email TEXT,
  user_name TEXT,
  action_timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- Action details
  action procurement_audit_action NOT NULL,
  entity_type TEXT NOT NULL, -- 'supplier', 'purchase_order', 'grn', 'invoice', 'payment', etc.
  entity_id UUID NOT NULL,
  entity_reference TEXT, -- PO number, invoice number, etc.
  
  -- Before and after values
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[], -- Array of field names that changed
  
  -- Context
  description TEXT NOT NULL,
  reason TEXT, -- For rejections, cancellations, etc.
  ip_address INET,
  user_agent TEXT,
  
  -- Compliance flags
  is_critical BOOLEAN DEFAULT false, -- Critical actions like approvals, payments
  requires_retention BOOLEAN DEFAULT true, -- Must be retained for statutory compliance
  retention_years INTEGER DEFAULT 7, -- KRA requires 7 years
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_procurement_audit_user ON store_procurement_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_procurement_audit_timestamp ON store_procurement_audit_logs(action_timestamp);
CREATE INDEX IF NOT EXISTS idx_procurement_audit_action ON store_procurement_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_procurement_audit_entity ON store_procurement_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_procurement_audit_critical ON store_procurement_audit_logs(is_critical) WHERE is_critical = true;

-- Enable RLS on audit logs (read-only for most users)
ALTER TABLE store_procurement_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read audit logs
CREATE POLICY audit_logs_read_policy ON store_procurement_audit_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only system can insert audit logs (via triggers)
CREATE POLICY audit_logs_insert_policy ON store_procurement_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Prevent updates and deletes (immutable)
CREATE POLICY audit_logs_no_update_policy ON store_procurement_audit_logs
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY audit_logs_no_delete_policy ON store_procurement_audit_logs
  FOR DELETE
  TO authenticated
  USING (false);

-- Function to create audit log entry
CREATE OR REPLACE FUNCTION create_audit_log(
  p_user_id UUID,
  p_action procurement_audit_action,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_entity_reference TEXT,
  p_old_values JSONB,
  p_new_values JSONB,
  p_description TEXT,
  p_reason TEXT DEFAULT NULL,
  p_is_critical BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
  v_user RECORD;
  v_changed_fields TEXT[];
  v_audit_id UUID;
BEGIN
  -- Get user details
  SELECT email, first_name || ' ' || last_name as full_name
  INTO v_user
  FROM users
  WHERE id = p_user_id;
  
  -- Calculate changed fields
  IF p_old_values IS NOT NULL AND p_new_values IS NOT NULL THEN
    SELECT array_agg(key)
    INTO v_changed_fields
    FROM jsonb_each(p_new_values)
    WHERE value IS DISTINCT FROM p_old_values->key;
  END IF;
  
  -- Insert audit log
  INSERT INTO store_procurement_audit_logs (
    user_id,
    user_email,
    user_name,
    action,
    entity_type,
    entity_id,
    entity_reference,
    old_values,
    new_values,
    changed_fields,
    description,
    reason,
    is_critical
  ) VALUES (
    p_user_id,
    v_user.email,
    v_user.full_name,
    p_action,
    p_entity_type,
    p_entity_id,
    p_entity_reference,
    p_old_values,
    p_new_values,
    v_changed_fields,
    p_description,
    p_reason,
    p_is_critical
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to audit GRN approval
CREATE OR REPLACE FUNCTION audit_grn_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.grn_approved = true AND (OLD.grn_approved IS NULL OR OLD.grn_approved = false) THEN
    PERFORM create_audit_log(
      NEW.approved_by_id,
      'approve',
      'grn',
      NEW.id,
      NEW.grn_number,
      to_jsonb(OLD),
      to_jsonb(NEW),
      'GRN approved - ' || NEW.grn_number,
      NULL,
      true -- Critical action
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for GRN approval audit
DROP TRIGGER IF EXISTS audit_grn_approval_trigger ON store_grn;
CREATE TRIGGER audit_grn_approval_trigger
  AFTER UPDATE OF grn_approved ON store_grn
  FOR EACH ROW
  EXECUTE FUNCTION audit_grn_approval();

-- Function to audit invoice approval/rejection
CREATE OR REPLACE FUNCTION audit_invoice_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Approval
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    PERFORM create_audit_log(
      NEW.approved_by_id,
      'approve',
      'supplier_invoice',
      NEW.id,
      NEW.invoice_number,
      to_jsonb(OLD),
      to_jsonb(NEW),
      'Invoice approved - ' || NEW.invoice_number || ' - Amount: ' || NEW.total_amount,
      NULL,
      true -- Critical action
    );
  END IF;
  
  -- Rejection
  IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
    PERFORM create_audit_log(
      NEW.rejected_by_id,
      'reject',
      'supplier_invoice',
      NEW.id,
      NEW.invoice_number,
      to_jsonb(OLD),
      to_jsonb(NEW),
      'Invoice rejected - ' || NEW.invoice_number,
      NEW.rejection_reason,
      true -- Critical action
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for invoice approval/rejection audit
DROP TRIGGER IF EXISTS audit_invoice_approval_trigger ON store_supplier_invoices;
CREATE TRIGGER audit_invoice_approval_trigger
  AFTER UPDATE OF status ON store_supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION audit_invoice_approval();

-- Function to audit payment processing
CREATE OR REPLACE FUNCTION audit_payment_processing()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'processed' AND (OLD.status IS NULL OR OLD.status != 'processed') THEN
    PERFORM create_audit_log(
      NEW.processed_by_id,
      'process',
      'supplier_payment',
      NEW.id,
      NEW.payment_number,
      to_jsonb(OLD),
      to_jsonb(NEW),
      'Payment processed - ' || NEW.payment_number || ' - Amount: ' || NEW.payment_amount || ' - Method: ' || NEW.payment_method,
      NULL,
      true -- Critical action
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payment processing audit
DROP TRIGGER IF EXISTS audit_payment_processing_trigger ON store_supplier_payments;
CREATE TRIGGER audit_payment_processing_trigger
  AFTER UPDATE OF status ON store_supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION audit_payment_processing();

-- Function to audit PO approval
CREATE OR REPLACE FUNCTION audit_po_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    PERFORM create_audit_log(
      COALESCE(NEW.approved_by_id, NEW.created_by_id),
      'approve',
      'purchase_order',
      NEW.id,
      NEW.po_number,
      to_jsonb(OLD),
      to_jsonb(NEW),
      'Purchase Order approved - ' || NEW.po_number || ' - Total: ' || NEW.total_amount,
      NULL,
      true -- Critical action
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for PO approval audit (if store_purchase_orders exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'store_purchase_orders') THEN
    DROP TRIGGER IF EXISTS audit_po_approval_trigger ON store_purchase_orders;
    CREATE TRIGGER audit_po_approval_trigger
      AFTER UPDATE OF status ON store_purchase_orders
      FOR EACH ROW
      EXECUTE FUNCTION audit_po_approval();
  END IF;
END $$;

COMMENT ON TABLE store_procurement_audit_logs IS 'Immutable audit trail for all procurement transactions (7-year retention for KRA compliance)';
COMMENT ON COLUMN store_procurement_audit_logs.old_values IS 'JSONB snapshot of record before change';
COMMENT ON COLUMN store_procurement_audit_logs.new_values IS 'JSONB snapshot of record after change';
COMMENT ON COLUMN store_procurement_audit_logs.changed_fields IS 'Array of field names that were modified';
COMMENT ON COLUMN store_procurement_audit_logs.is_critical IS 'Critical actions like approvals, payments (requires extra scrutiny)';
COMMENT ON COLUMN store_procurement_audit_logs.retention_years IS 'Number of years to retain (KRA requires 7 years)';
-- COMMENT ON FUNCTION create_audit_log IS 'Create immutable audit log entry for procurement transactions';
