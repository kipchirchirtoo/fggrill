-- =====================================================
-- SUPPLIER VAT & COMPLIANCE ENHANCEMENTS
-- Adds Kenyan VAT compliance fields to suppliers
-- =====================================================

-- Add VAT and compliance fields to store_suppliers
ALTER TABLE store_suppliers
  ADD COLUMN IF NOT EXISTS supplier_pin TEXT,
  ADD COLUMN IF NOT EXISTS vat_registered BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vat_registration_number TEXT,
  ADD COLUMN IF NOT EXISTS withholding_vat_applicable BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS withholding_vat_rate DECIMAL(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kra_compliance_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER;

-- Add check constraint for KRA compliance status
ALTER TABLE store_suppliers
  ADD CONSTRAINT valid_kra_status 
  CHECK (kra_compliance_status IN ('compliant', 'pending', 'non_compliant', 'under_review'));

-- Add check constraint for withholding VAT rate
ALTER TABLE store_suppliers
  ADD CONSTRAINT valid_withholding_vat_rate 
  CHECK (withholding_vat_rate >= 0 AND withholding_vat_rate <= 100);

-- Create index for VAT registered suppliers
CREATE INDEX IF NOT EXISTS idx_store_suppliers_vat_registered 
  ON store_suppliers(vat_registered) WHERE vat_registered = true;

-- Create index for KRA compliance status
CREATE INDEX IF NOT EXISTS idx_store_suppliers_kra_status 
  ON store_suppliers(kra_compliance_status);

-- Function to derive payment_terms_days from payment_terms enum
CREATE OR REPLACE FUNCTION update_payment_terms_days()
RETURNS TRIGGER AS $$
BEGIN
  NEW.payment_terms_days := CASE NEW.payment_terms
    WHEN 'cash' THEN 0
    WHEN 'credit_7_days' THEN 7
    WHEN 'credit_15_days' THEN 15
    WHEN 'credit_30_days' THEN 30
    WHEN 'credit_45_days' THEN 45
    WHEN 'credit_60_days' THEN 60
    WHEN 'credit_90_days' THEN 90
    WHEN 'advance_payment' THEN -1
    ELSE 30
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update payment_terms_days
DROP TRIGGER IF EXISTS update_payment_terms_days_trigger ON store_suppliers;
CREATE TRIGGER update_payment_terms_days_trigger
  BEFORE INSERT OR UPDATE OF payment_terms ON store_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_terms_days();

-- Update existing records
UPDATE store_suppliers
SET payment_terms_days = CASE payment_terms
  WHEN 'cash' THEN 0
  WHEN 'credit_7_days' THEN 7
  WHEN 'credit_15_days' THEN 15
  WHEN 'credit_30_days' THEN 30
  WHEN 'credit_45_days' THEN 45
  WHEN 'credit_60_days' THEN 60
  WHEN 'credit_90_days' THEN 90
  WHEN 'advance_payment' THEN -1
  ELSE 30
END
WHERE payment_terms_days IS NULL;

COMMENT ON COLUMN store_suppliers.supplier_pin IS 'KRA PIN number for tax compliance';
COMMENT ON COLUMN store_suppliers.vat_registered IS 'Whether supplier is VAT registered with KRA';
COMMENT ON COLUMN store_suppliers.vat_registration_number IS 'VAT registration certificate number';
COMMENT ON COLUMN store_suppliers.withholding_vat_applicable IS 'Whether withholding VAT applies to this supplier';
COMMENT ON COLUMN store_suppliers.withholding_vat_rate IS 'Withholding VAT rate percentage';
COMMENT ON COLUMN store_suppliers.kra_compliance_status IS 'KRA compliance status: compliant, pending, non_compliant, under_review';
COMMENT ON COLUMN store_suppliers.payment_terms_days IS 'Payment terms in days (derived from payment_terms enum)';
