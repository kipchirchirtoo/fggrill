-- Migration: Create Barcode System for Central Store Scanning Workflow
-- Date: 2026-04-17
-- Description: Creates tables for item barcodes, dispatches with dual OTP system, 
--              document storage, audit logs, and POS barcode integration

-- ============================================================================
-- 1. ITEM BARCODES TABLE
-- ============================================================================

-- Create item_barcodes table for tracking barcodes associated with inventory items
CREATE TABLE IF NOT EXISTS item_barcodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  barcode_value VARCHAR(100) UNIQUE NOT NULL,
  barcode_type VARCHAR(20) NOT NULL DEFAULT 'item', -- 'item', 'batch', 'serial'
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  printed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for item_barcodes
CREATE INDEX IF NOT EXISTS idx_item_barcodes_inventory_item_id ON item_barcodes(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_item_barcodes_barcode_value ON item_barcodes(barcode_value);
CREATE INDEX IF NOT EXISTS idx_item_barcodes_generated_at ON item_barcodes(generated_at);

-- ============================================================================
-- 2. DISPATCH STATUS ENUM
-- ============================================================================

-- Create dispatch_status enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE dispatch_status AS ENUM (
    'pending',
    'in_transit',
    'completed',
    'audited',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 3. DISPATCHES TABLE
-- ============================================================================

-- Create dispatches table for tracking deliveries from central store to branches
CREATE TABLE IF NOT EXISTS dispatches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispatch_number VARCHAR(50) UNIQUE NOT NULL,
  status dispatch_status NOT NULL DEFAULT 'pending',
  source_branch VARCHAR(50) NOT NULL DEFAULT 'Bomet', -- Central store location
  destination_branch VARCHAR(50) NOT NULL,
  driver_id UUID,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dispatched_at TIMESTAMPTZ,
  in_transit_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  audited_at TIMESTAMPTZ
);

-- Create indexes for dispatches
CREATE INDEX IF NOT EXISTS idx_dispatches_status ON dispatches(status);
CREATE INDEX IF NOT EXISTS idx_dispatches_destination_branch ON dispatches(destination_branch);
CREATE INDEX IF NOT EXISTS idx_dispatches_driver_id ON dispatches(driver_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_created_at ON dispatches(created_at);
CREATE INDEX IF NOT EXISTS idx_dispatches_dispatch_number ON dispatches(dispatch_number);

-- ============================================================================
-- 4. DISPATCH ITEMS TABLE
-- ============================================================================

-- Create dispatch_items table for items included in each dispatch
CREATE TABLE IF NOT EXISTS dispatch_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for dispatch_items
CREATE INDEX IF NOT EXISTS idx_dispatch_items_dispatch_id ON dispatch_items(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_items_inventory_item_id ON dispatch_items(inventory_item_id);

-- ============================================================================
-- 5. DISPATCH OTPS TABLE (Dual OTP System)
-- ============================================================================

-- Create dispatch_otps table for driver and branch OTP verification
CREATE TABLE IF NOT EXISTS dispatch_otps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispatch_id UUID NOT NULL UNIQUE REFERENCES dispatches(id) ON DELETE CASCADE,
  driver_otp VARCHAR(10) NOT NULL CHECK (driver_otp ~ '^D-[0-9]{4}$'), -- Format: D-XXXX
  branch_otp VARCHAR(10) NOT NULL CHECK (branch_otp ~ '^B-[0-9]{4}$'), -- Format: B-XXXX
  driver_otp_used_at TIMESTAMPTZ,
  branch_otp_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for dispatch_otps
CREATE INDEX IF NOT EXISTS idx_dispatch_otps_dispatch_id ON dispatch_otps(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_otps_driver_otp ON dispatch_otps(driver_otp);
CREATE INDEX IF NOT EXISTS idx_dispatch_otps_branch_otp ON dispatch_otps(branch_otp);
CREATE INDEX IF NOT EXISTS idx_dispatch_otps_expires_at ON dispatch_otps(expires_at);

-- ============================================================================
-- 6. DISPATCH DOCUMENTS TABLE
-- ============================================================================

-- Create dispatch_documents table for storing uploaded stock sheets and delivery documents
CREATE TABLE IF NOT EXISTS dispatch_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  document_type VARCHAR(50) NOT NULL, -- 'stock_sheet', 'delivery_note', 'photo'
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL, -- in bytes
  mime_type VARCHAR(100) NOT NULL,
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for dispatch_documents
CREATE INDEX IF NOT EXISTS idx_dispatch_documents_dispatch_id ON dispatch_documents(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_documents_uploaded_by ON dispatch_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_dispatch_documents_uploaded_at ON dispatch_documents(uploaded_at);

-- ============================================================================
-- 7. DISPATCH AUDIT LOG TABLE
-- ============================================================================

-- Create dispatch_audit_log table for tracking all actions on dispatches
CREATE TABLE IF NOT EXISTS dispatch_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL, -- 'created', 'driver_otp_verified', 'branch_otp_verified', 'document_uploaded', 'approved', 'flagged'
  performed_by UUID,
  notes TEXT,
  metadata JSONB, -- Additional data like old_status, new_status, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for dispatch_audit_log
CREATE INDEX IF NOT EXISTS idx_dispatch_audit_log_dispatch_id ON dispatch_audit_log(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_audit_log_performed_by ON dispatch_audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_dispatch_audit_log_created_at ON dispatch_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_dispatch_audit_log_action ON dispatch_audit_log(action);

-- ============================================================================
-- 8. AUDITOR REVIEWS TABLE
-- ============================================================================

-- Create auditor_reviews table for auditor approval/flagging of deliveries
CREATE TABLE IF NOT EXISTS auditor_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  auditor_id UUID,
  review_status VARCHAR(20) NOT NULL CHECK (review_status IN ('approved', 'flagged')),
  notes TEXT,
  flagged_reason TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for auditor_reviews
CREATE INDEX IF NOT EXISTS idx_auditor_reviews_dispatch_id ON auditor_reviews(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_auditor_reviews_auditor_id ON auditor_reviews(auditor_id);
CREATE INDEX IF NOT EXISTS idx_auditor_reviews_review_status ON auditor_reviews(review_status);
CREATE INDEX IF NOT EXISTS idx_auditor_reviews_reviewed_at ON auditor_reviews(reviewed_at);

-- ============================================================================
-- 9. POS BARCODES TABLE
-- ============================================================================

-- Create pos_barcodes table for POS transaction barcode integration
CREATE TABLE IF NOT EXISTS pos_barcodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id VARCHAR(100),
  order_id UUID,
  bill_id UUID,
  barcode_value VARCHAR(100) UNIQUE NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by UUID
);

-- Create indexes for pos_barcodes
CREATE INDEX IF NOT EXISTS idx_pos_barcodes_transaction_id ON pos_barcodes(transaction_id);
CREATE INDEX IF NOT EXISTS idx_pos_barcodes_order_id ON pos_barcodes(order_id);
CREATE INDEX IF NOT EXISTS idx_pos_barcodes_bill_id ON pos_barcodes(bill_id);
CREATE INDEX IF NOT EXISTS idx_pos_barcodes_barcode_value ON pos_barcodes(barcode_value);
CREATE INDEX IF NOT EXISTS idx_pos_barcodes_generated_at ON pos_barcodes(generated_at);

-- ============================================================================
-- 10. FUNCTIONS
-- ============================================================================

-- Function to generate unique barcode with prefix
CREATE OR REPLACE FUNCTION generate_barcode(prefix TEXT DEFAULT 'ITEM')
RETURNS TEXT AS $$
DECLARE
  uuid_part TEXT;
  barcode TEXT;
  exists_check INTEGER;
BEGIN
  LOOP
    -- Generate UUID and take first 12 characters (remove hyphens)
    uuid_part := REPLACE(SUBSTRING(uuid_generate_v4()::TEXT, 1, 15), '-', '');
    barcode := prefix || '-' || UPPER(uuid_part);
    
    -- Check if barcode already exists
    SELECT COUNT(*) INTO exists_check 
    FROM item_barcodes 
    WHERE barcode_value = barcode;
    
    -- If unique, return it
    IF exists_check = 0 THEN
      RETURN barcode;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to generate OTP with prefix (D- for driver, B- for branch)
CREATE OR REPLACE FUNCTION generate_otp(prefix TEXT)
RETURNS TEXT AS $$
DECLARE
  otp_digits TEXT;
  otp TEXT;
  exists_check INTEGER;
BEGIN
  LOOP
    -- Generate 4 random digits
    otp_digits := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    otp := prefix || '-' || otp_digits;
    
    -- Check if OTP already exists and is not expired
    IF prefix = 'D' THEN
      SELECT COUNT(*) INTO exists_check 
      FROM dispatch_otps 
      WHERE driver_otp = otp AND expires_at > NOW();
    ELSIF prefix = 'B' THEN
      SELECT COUNT(*) INTO exists_check 
      FROM dispatch_otps 
      WHERE branch_otp = otp AND expires_at > NOW();
    END IF;
    
    -- If unique, return it
    IF exists_check = 0 THEN
      RETURN otp;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to generate dispatch number
CREATE OR REPLACE FUNCTION generate_dispatch_number()
RETURNS TEXT AS $$
DECLARE
  year TEXT;
  month TEXT;
  counter INT;
  dispatch_num TEXT;
BEGIN
  year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  month := LPAD(EXTRACT(MONTH FROM CURRENT_DATE)::TEXT, 2, '0');
  
  SELECT COALESCE(MAX(SUBSTRING(dispatch_number FROM '\d+$')::INT), 0) + 1
  INTO counter
  FROM dispatches
  WHERE dispatch_number LIKE 'DISP-' || year || month || '-%';
  
  dispatch_num := 'DISP-' || year || month || '-' || LPAD(counter::TEXT, 4, '0');
  RETURN dispatch_num;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 11. TRIGGERS
-- ============================================================================

-- Trigger to auto-generate dispatch_number on insert
CREATE OR REPLACE FUNCTION set_dispatch_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.dispatch_number IS NULL OR NEW.dispatch_number = '' THEN
    NEW.dispatch_number := generate_dispatch_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_dispatch_number ON dispatches;
CREATE TRIGGER trigger_set_dispatch_number
  BEFORE INSERT ON dispatches
  FOR EACH ROW
  EXECUTE FUNCTION set_dispatch_number();

-- Trigger to log status transitions in dispatch_audit_log
CREATE OR REPLACE FUNCTION log_dispatch_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO dispatch_audit_log (dispatch_id, action, performed_by, metadata)
    VALUES (
      NEW.id,
      'status_changed',
      NEW.created_by, -- This should be updated to current user in application logic
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_dispatch_status_change ON dispatches;
CREATE TRIGGER trigger_log_dispatch_status_change
  AFTER UPDATE ON dispatches
  FOR EACH ROW
  EXECUTE FUNCTION log_dispatch_status_change();

-- Trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_item_barcodes_updated_at ON item_barcodes;
CREATE TRIGGER update_item_barcodes_updated_at
  BEFORE UPDATE ON item_barcodes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dispatches_updated_at ON dispatches;
CREATE TRIGGER update_dispatches_updated_at
  BEFORE UPDATE ON dispatches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dispatch_items_updated_at ON dispatch_items;
CREATE TRIGGER update_dispatch_items_updated_at
  BEFORE UPDATE ON dispatch_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE item_barcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditor_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_barcodes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for item_barcodes
-- Central storekeepers can insert/update, all authenticated users can read
CREATE POLICY item_barcodes_select_policy ON item_barcodes
  FOR SELECT
  USING (true);

CREATE POLICY item_barcodes_insert_policy ON item_barcodes
  FOR INSERT
  WITH CHECK (true);

-- RLS Policies for dispatches
-- Central storekeepers can create, branch storekeepers can read for their branch, auditors can read all
CREATE POLICY dispatches_select_policy ON dispatches
  FOR SELECT
  USING (true);

CREATE POLICY dispatches_insert_policy ON dispatches
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY dispatches_update_policy ON dispatches
  FOR UPDATE
  USING (true);

-- RLS Policies for dispatch_documents
-- Branch storekeepers can upload for their branch, auditors can read all
CREATE POLICY dispatch_documents_select_policy ON dispatch_documents
  FOR SELECT
  USING (true);

CREATE POLICY dispatch_documents_insert_policy ON dispatch_documents
  FOR INSERT
  WITH CHECK (true);

-- RLS Policies for dispatch_audit_log
-- Auditors can insert, all authenticated users can read
CREATE POLICY dispatch_audit_log_select_policy ON dispatch_audit_log
  FOR SELECT
  USING (true);

CREATE POLICY dispatch_audit_log_insert_policy ON dispatch_audit_log
  FOR INSERT
  WITH CHECK (true);

-- RLS Policies for auditor_reviews
-- Auditors can insert, all authenticated users can read
CREATE POLICY auditor_reviews_select_policy ON auditor_reviews
  FOR SELECT
  USING (true);

CREATE POLICY auditor_reviews_insert_policy ON auditor_reviews
  FOR INSERT
  WITH CHECK (true);

-- RLS Policies for pos_barcodes
-- Cashiers and branch storekeepers can insert, all authenticated users can read
CREATE POLICY pos_barcodes_select_policy ON pos_barcodes
  FOR SELECT
  USING (true);

CREATE POLICY pos_barcodes_insert_policy ON pos_barcodes
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Add comment to track migration
COMMENT ON TABLE item_barcodes IS 'Stores barcodes for inventory items - Part of Central Store Scanning Workflow';
COMMENT ON TABLE dispatches IS 'Tracks deliveries from central store to branches with dual OTP verification';
COMMENT ON TABLE dispatch_otps IS 'Stores driver (D-XXXX) and branch (B-XXXX) OTPs for secure delivery verification';
COMMENT ON TABLE dispatch_documents IS 'Stores uploaded stock sheets and delivery documents in Supabase Storage';
COMMENT ON TABLE dispatch_audit_log IS 'Audit trail for all dispatch-related actions';
COMMENT ON TABLE auditor_reviews IS 'Auditor approval/flagging of completed deliveries';
COMMENT ON TABLE pos_barcodes IS 'Barcodes for POS transactions (orders/bills)';
