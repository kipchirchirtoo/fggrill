-- =====================================================
-- SUPPLIER INVOICES WITH VAT COMPLIANCE
-- Kenyan VAT-compliant supplier invoice management
-- =====================================================

-- Create invoice status enum
DO $$ BEGIN
  CREATE TYPE supplier_invoice_status AS ENUM (
    'draft',
    'submitted',
    'pending_approval',
    'approved',
    'rejected',
    'paid',
    'partially_paid',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create VAT rate enum
DO $$ BEGIN
  CREATE TYPE vat_rate_type AS ENUM (
    'standard_16',      -- 16% standard VAT
    'zero_rated',       -- 0% zero-rated
    'exempt',           -- VAT exempt
    'withholding_vat'   -- Withholding VAT applicable
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create supplier invoices table
CREATE TABLE IF NOT EXISTS store_supplier_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  
  -- Supplier and PO/GRN references
  supplier_id UUID REFERENCES store_suppliers(id) NOT NULL,
  po_id UUID REFERENCES store_purchase_orders(id),
  grn_id UUID REFERENCES store_grn(id),
  
  -- Invoice details
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payment_terms_days INTEGER,
  
  -- Supplier VAT details
  supplier_pin TEXT NOT NULL,
  supplier_vat_registered BOOLEAN DEFAULT false,
  supplier_vat_number TEXT,
  
  -- Financial details
  subtotal DECIMAL(15, 2) NOT NULL,
  vat_rate_type vat_rate_type DEFAULT 'standard_16',
  vat_rate DECIMAL(5, 2) DEFAULT 16.00,
  vat_amount DECIMAL(15, 2) DEFAULT 0,
  withholding_vat_applicable BOOLEAN DEFAULT false,
  withholding_vat_rate DECIMAL(5, 2) DEFAULT 0,
  withholding_vat_amount DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) NOT NULL,
  
  -- Payment tracking
  amount_paid DECIMAL(15, 2) DEFAULT 0,
  balance_due DECIMAL(15, 2) NOT NULL,
  
  -- Status and workflow
  status supplier_invoice_status DEFAULT 'draft',
  is_locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMP WITH TIME ZONE,
  locked_by_id UUID REFERENCES users(id),
  
  -- Approval workflow (auditor-only)
  submitted_by_id UUID REFERENCES users(id),
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_by_id UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_by_id UUID REFERENCES users(id),
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  
  -- Supporting documents
  invoice_document_url TEXT,
  supporting_documents JSONB DEFAULT '[]'::jsonb,
  
  -- Accounting integration
  journal_entry_id UUID REFERENCES accounting_journal_entries(id),
  grni_cleared_id UUID REFERENCES store_grni_control_account(id),
  
  -- Metadata
  notes TEXT,
  created_by_id UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_invoice_dates CHECK (due_date >= invoice_date),
  CONSTRAINT valid_invoice_amounts CHECK (
    subtotal >= 0 AND
    vat_amount >= 0 AND
    withholding_vat_amount >= 0 AND
    total_amount >= 0 AND
    amount_paid >= 0 AND
    balance_due >= 0 AND
    amount_paid <= total_amount AND
    balance_due = total_amount - amount_paid
  ),
  CONSTRAINT valid_vat_rate CHECK (vat_rate >= 0 AND vat_rate <= 100),
  CONSTRAINT valid_withholding_vat_rate CHECK (withholding_vat_rate >= 0 AND withholding_vat_rate <= 100),
  CONSTRAINT invoice_requires_grn_or_po CHECK (grn_id IS NOT NULL OR po_id IS NOT NULL)
);

-- Create supplier invoice items table
CREATE TABLE IF NOT EXISTS store_supplier_invoice_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES store_supplier_invoices(id) ON DELETE CASCADE NOT NULL,
  grn_item_id UUID REFERENCES store_grn_items(id),
  po_item_id UUID REFERENCES store_po_items(id),
  item_id UUID REFERENCES store_items(id) NOT NULL,
  
  description TEXT,
  quantity DECIMAL(12, 3) NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  subtotal DECIMAL(15, 2) NOT NULL,
  vat_rate DECIMAL(5, 2) DEFAULT 16.00,
  vat_amount DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) NOT NULL,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT valid_invoice_item_amounts CHECK (
    quantity > 0 AND
    unit_price >= 0 AND
    subtotal >= 0 AND
    vat_amount >= 0 AND
    total_amount >= 0 AND
    subtotal = quantity * unit_price AND
    total_amount = subtotal + vat_amount
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier ON store_supplier_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_po ON store_supplier_invoices(po_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_grn ON store_supplier_invoices(grn_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_status ON store_supplier_invoices(status);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_date ON store_supplier_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_due_date ON store_supplier_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_locked ON store_supplier_invoices(is_locked) WHERE is_locked = true;
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_items_invoice ON store_supplier_invoice_items(invoice_id);

-- Function to auto-calculate VAT amount
CREATE OR REPLACE FUNCTION calculate_invoice_vat()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate VAT based on rate type
  CASE NEW.vat_rate_type
    WHEN 'standard_16' THEN
      NEW.vat_rate := 16.00;
      NEW.vat_amount := NEW.subtotal * 0.16;
    WHEN 'zero_rated' THEN
      NEW.vat_rate := 0.00;
      NEW.vat_amount := 0.00;
    WHEN 'exempt' THEN
      NEW.vat_rate := 0.00;
      NEW.vat_amount := 0.00;
    ELSE
      -- Use custom vat_rate if provided
      NEW.vat_amount := NEW.subtotal * (NEW.vat_rate / 100);
  END CASE;
  
  -- Calculate withholding VAT if applicable
  IF NEW.withholding_vat_applicable THEN
    NEW.withholding_vat_amount := NEW.vat_amount * (NEW.withholding_vat_rate / 100);
  ELSE
    NEW.withholding_vat_amount := 0;
  END IF;
  
  -- Calculate total (subtotal + VAT - withholding VAT)
  NEW.total_amount := NEW.subtotal + NEW.vat_amount - NEW.withholding_vat_amount;
  NEW.balance_due := NEW.total_amount - NEW.amount_paid;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for VAT calculation
DROP TRIGGER IF EXISTS calculate_invoice_vat_trigger ON store_supplier_invoices;
CREATE TRIGGER calculate_invoice_vat_trigger
  BEFORE INSERT OR UPDATE OF subtotal, vat_rate_type, vat_rate, withholding_vat_applicable, withholding_vat_rate, amount_paid
  ON store_supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION calculate_invoice_vat();

-- Function to prevent editing locked invoices
CREATE OR REPLACE FUNCTION prevent_locked_invoice_edit()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_locked = true AND NEW.is_locked = true THEN
    -- Allow only status and payment updates on locked invoices
    IF (NEW.status != OLD.status OR NEW.amount_paid != OLD.amount_paid OR NEW.balance_due != OLD.balance_due) THEN
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Cannot modify locked invoice. Invoice number: %', OLD.invoice_number;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent locked invoice edits
DROP TRIGGER IF EXISTS prevent_locked_invoice_edit_trigger ON store_supplier_invoices;
CREATE TRIGGER prevent_locked_invoice_edit_trigger
  BEFORE UPDATE ON store_supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION prevent_locked_invoice_edit();

-- Function to auto-lock invoice on submission
CREATE OR REPLACE FUNCTION auto_lock_invoice_on_submit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status = 'draft') THEN
    NEW.is_locked := true;
    NEW.locked_at := NOW();
    NEW.locked_by_id := NEW.submitted_by_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-lock
DROP TRIGGER IF EXISTS auto_lock_invoice_on_submit_trigger ON store_supplier_invoices;
CREATE TRIGGER auto_lock_invoice_on_submit_trigger
  BEFORE UPDATE OF status ON store_supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION auto_lock_invoice_on_submit();

-- Create timestamp update trigger
CREATE TRIGGER update_supplier_invoices_timestamp
  BEFORE UPDATE ON store_supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_store_timestamp();

-- Function to generate supplier invoice number
CREATE OR REPLACE FUNCTION generate_supplier_invoice_number()
RETURNS TEXT AS $$
DECLARE
  invoice_date TEXT;
  next_seq INT;
  invoice_number TEXT;
BEGIN
  invoice_date := TO_CHAR(NOW(), 'YYMMDD');
  
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM store_supplier_invoices
    WHERE invoice_number LIKE 'SINV' || invoice_date || '%'
  )
  SELECT next_seq INTO next_seq FROM seq;
  
  invoice_number := 'SINV' || invoice_date || LPAD(next_seq::TEXT, 4, '0');
  
  RETURN invoice_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE store_supplier_invoices IS 'Supplier invoices with Kenyan VAT compliance';
COMMENT ON COLUMN store_supplier_invoices.supplier_pin IS 'Supplier KRA PIN number (required for compliance)';
COMMENT ON COLUMN store_supplier_invoices.vat_rate_type IS 'VAT rate type: standard_16 (16%), zero_rated (0%), exempt, withholding_vat';
COMMENT ON COLUMN store_supplier_invoices.withholding_vat_applicable IS 'Whether withholding VAT applies to this invoice';
COMMENT ON COLUMN store_supplier_invoices.is_locked IS 'Invoice is locked after submission and cannot be edited';
COMMENT ON COLUMN store_supplier_invoices.approved_by_id IS 'Auditor who approved the invoice';
