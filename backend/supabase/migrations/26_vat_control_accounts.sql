-- =====================================================
-- VAT CONTROL ACCOUNTS & TRACKING
-- Kenyan VAT compliance and reporting
-- =====================================================

-- Create VAT transaction table
CREATE TABLE IF NOT EXISTS store_vat_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Transaction details
  transaction_date DATE NOT NULL,
  transaction_type TEXT NOT NULL, -- 'input_vat', 'output_vat', 'withholding_vat'
  
  -- Source document references
  invoice_id UUID REFERENCES store_supplier_invoices(id),
  supplier_id UUID REFERENCES store_suppliers(id),
  
  -- VAT details
  vat_rate_type vat_rate_type NOT NULL,
  vat_rate DECIMAL(5, 2) NOT NULL,
  taxable_amount DECIMAL(15, 2) NOT NULL,
  vat_amount DECIMAL(15, 2) NOT NULL,
  withholding_vat_amount DECIMAL(15, 2) DEFAULT 0,
  
  -- Supplier VAT details
  supplier_pin TEXT,
  supplier_vat_number TEXT,
  supplier_vat_registered BOOLEAN DEFAULT false,
  
  -- Accounting integration
  journal_entry_id UUID REFERENCES accounting_journal_entries(id),
  vat_control_account_id UUID REFERENCES accounting_chart_of_accounts(id),
  
  -- KRA compliance
  kra_period TEXT, -- Format: YYYY-MM (e.g., 2026-02)
  kra_return_filed BOOLEAN DEFAULT false,
  kra_return_date DATE,
  
  -- Metadata
  description TEXT,
  created_by_id UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT valid_vat_amounts CHECK (
    taxable_amount >= 0 AND
    vat_amount >= 0 AND
    withholding_vat_amount >= 0
  ),
  CONSTRAINT valid_transaction_type CHECK (
    transaction_type IN ('input_vat', 'output_vat', 'withholding_vat')
  )
);

-- Create VAT control account summary table
CREATE TABLE IF NOT EXISTS store_vat_control_summary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Period details
  period_month DATE NOT NULL UNIQUE, -- First day of month
  period_name TEXT NOT NULL, -- e.g., "February 2026"
  
  -- Input VAT (VAT paid to suppliers)
  total_input_vat DECIMAL(15, 2) DEFAULT 0,
  input_vat_standard_16 DECIMAL(15, 2) DEFAULT 0,
  input_vat_zero_rated DECIMAL(15, 2) DEFAULT 0,
  input_vat_exempt DECIMAL(15, 2) DEFAULT 0,
  
  -- Output VAT (VAT collected from customers)
  total_output_vat DECIMAL(15, 2) DEFAULT 0,
  output_vat_standard_16 DECIMAL(15, 2) DEFAULT 0,
  output_vat_zero_rated DECIMAL(15, 2) DEFAULT 0,
  
  -- Withholding VAT
  total_withholding_vat DECIMAL(15, 2) DEFAULT 0,
  
  -- Net VAT position
  net_vat_payable DECIMAL(15, 2) DEFAULT 0, -- Output VAT - Input VAT
  net_vat_refundable DECIMAL(15, 2) DEFAULT 0,
  
  -- KRA filing
  kra_return_filed BOOLEAN DEFAULT false,
  kra_return_date DATE,
  kra_reference_number TEXT,
  
  -- Metadata
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT valid_vat_summary_amounts CHECK (
    total_input_vat >= 0 AND
    total_output_vat >= 0 AND
    total_withholding_vat >= 0
  )
);

-- Create supplier VAT summary table (for reporting)
CREATE TABLE IF NOT EXISTS store_supplier_vat_summary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Supplier and period
  supplier_id UUID REFERENCES store_suppliers(id) NOT NULL,
  period_month DATE NOT NULL, -- First day of month
  
  -- Supplier details
  supplier_pin TEXT,
  supplier_vat_number TEXT,
  supplier_vat_registered BOOLEAN DEFAULT false,
  
  -- VAT summary
  total_purchases DECIMAL(15, 2) DEFAULT 0,
  total_vat_standard_16 DECIMAL(15, 2) DEFAULT 0,
  total_vat_zero_rated DECIMAL(15, 2) DEFAULT 0,
  total_vat_exempt DECIMAL(15, 2) DEFAULT 0,
  total_withholding_vat DECIMAL(15, 2) DEFAULT 0,
  total_input_vat DECIMAL(15, 2) DEFAULT 0,
  
  -- Invoice count
  invoice_count INTEGER DEFAULT 0,
  
  -- Metadata
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT unique_supplier_period UNIQUE (supplier_id, period_month)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vat_transactions_date ON store_vat_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_vat_transactions_type ON store_vat_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_vat_transactions_supplier ON store_vat_transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_vat_transactions_invoice ON store_vat_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_vat_transactions_period ON store_vat_transactions(kra_period);
CREATE INDEX IF NOT EXISTS idx_vat_control_summary_period ON store_vat_control_summary(period_month);
CREATE INDEX IF NOT EXISTS idx_supplier_vat_summary_supplier ON store_supplier_vat_summary(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_vat_summary_period ON store_supplier_vat_summary(period_month);

-- Function to record VAT transaction on invoice approval
CREATE OR REPLACE FUNCTION record_vat_transaction_on_invoice()
RETURNS TRIGGER AS $$
DECLARE
  v_kra_period TEXT;
BEGIN
  -- Only record VAT when invoice is approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Calculate KRA period (YYYY-MM)
    v_kra_period := TO_CHAR(NEW.invoice_date, 'YYYY-MM');
    
    -- Record input VAT transaction
    INSERT INTO store_vat_transactions (
      transaction_date,
      transaction_type,
      invoice_id,
      supplier_id,
      vat_rate_type,
      vat_rate,
      taxable_amount,
      vat_amount,
      withholding_vat_amount,
      supplier_pin,
      supplier_vat_number,
      supplier_vat_registered,
      kra_period,
      description,
      created_by_id
    ) VALUES (
      NEW.invoice_date,
      'input_vat',
      NEW.id,
      NEW.supplier_id,
      NEW.vat_rate_type,
      NEW.vat_rate,
      NEW.subtotal,
      NEW.vat_amount,
      NEW.withholding_vat_amount,
      NEW.supplier_pin,
      NEW.supplier_vat_number,
      NEW.supplier_vat_registered,
      v_kra_period,
      'Input VAT - Invoice ' || NEW.invoice_number,
      NEW.approved_by_id
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to record VAT on invoice approval
DROP TRIGGER IF EXISTS record_vat_transaction_on_invoice_trigger ON store_supplier_invoices;
CREATE TRIGGER record_vat_transaction_on_invoice_trigger
  AFTER UPDATE OF status ON store_supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION record_vat_transaction_on_invoice();

-- Function to update VAT control summary
CREATE OR REPLACE FUNCTION update_vat_control_summary(p_period_month DATE)
RETURNS void AS $$
DECLARE
  v_input_vat_16 DECIMAL(15, 2);
  v_input_vat_zero DECIMAL(15, 2);
  v_total_input_vat DECIMAL(15, 2);
  v_total_withholding_vat DECIMAL(15, 2);
BEGIN
  -- Calculate input VAT for the period
  SELECT 
    COALESCE(SUM(CASE WHEN vat_rate_type = 'standard_16' THEN vat_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN vat_rate_type = 'zero_rated' THEN vat_amount ELSE 0 END), 0),
    COALESCE(SUM(vat_amount), 0),
    COALESCE(SUM(withholding_vat_amount), 0)
  INTO v_input_vat_16, v_input_vat_zero, v_total_input_vat, v_total_withholding_vat
  FROM store_vat_transactions
  WHERE transaction_type = 'input_vat'
    AND DATE_TRUNC('month', transaction_date) = p_period_month;
  
  -- Insert or update VAT control summary
  INSERT INTO store_vat_control_summary (
    period_month,
    period_name,
    total_input_vat,
    input_vat_standard_16,
    input_vat_zero_rated,
    total_withholding_vat,
    last_updated
  ) VALUES (
    p_period_month,
    TO_CHAR(p_period_month, 'Month YYYY'),
    v_total_input_vat,
    v_input_vat_16,
    v_input_vat_zero,
    v_total_withholding_vat,
    NOW()
  )
  ON CONFLICT (period_month) DO UPDATE
  SET 
    total_input_vat = v_total_input_vat,
    input_vat_standard_16 = v_input_vat_16,
    input_vat_zero_rated = v_input_vat_zero,
    total_withholding_vat = v_total_withholding_vat,
    last_updated = NOW();
    
END;
$$ LANGUAGE plpgsql;

-- Function to update supplier VAT summary
CREATE OR REPLACE FUNCTION update_supplier_vat_summary(p_supplier_id UUID, p_period_month DATE)
RETURNS void AS $$
DECLARE
  v_supplier RECORD;
  v_total_purchases DECIMAL(15, 2);
  v_vat_16 DECIMAL(15, 2);
  v_vat_zero DECIMAL(15, 2);
  v_withholding_vat DECIMAL(15, 2);
  v_total_input_vat DECIMAL(15, 2);
  v_invoice_count INTEGER;
BEGIN
  -- Get supplier details
  SELECT supplier_pin, vat_registration_number, vat_registered
  INTO v_supplier
  FROM store_suppliers
  WHERE id = p_supplier_id;
  
  -- Calculate VAT summary for supplier in period
  SELECT 
    COALESCE(SUM(subtotal), 0),
    COALESCE(SUM(CASE WHEN vat_rate_type = 'standard_16' THEN vat_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN vat_rate_type = 'zero_rated' THEN vat_amount ELSE 0 END), 0),
    COALESCE(SUM(withholding_vat_amount), 0),
    COALESCE(SUM(vat_amount), 0),
    COUNT(*)
  INTO v_total_purchases, v_vat_16, v_vat_zero, v_withholding_vat, v_total_input_vat, v_invoice_count
  FROM store_supplier_invoices
  WHERE supplier_id = p_supplier_id
    AND status = 'approved'
    AND DATE_TRUNC('month', invoice_date) = p_period_month;
  
  -- Insert or update supplier VAT summary
  INSERT INTO store_supplier_vat_summary (
    supplier_id,
    period_month,
    supplier_pin,
    supplier_vat_number,
    supplier_vat_registered,
    total_purchases,
    total_vat_standard_16,
    total_vat_zero_rated,
    total_withholding_vat,
    total_input_vat,
    invoice_count,
    last_updated
  ) VALUES (
    p_supplier_id,
    p_period_month,
    v_supplier.supplier_pin,
    v_supplier.vat_registration_number,
    v_supplier.vat_registered,
    v_total_purchases,
    v_vat_16,
    v_vat_zero,
    v_withholding_vat,
    v_total_input_vat,
    v_invoice_count,
    NOW()
  )
  ON CONFLICT (supplier_id, period_month) DO UPDATE
  SET 
    total_purchases = v_total_purchases,
    total_vat_standard_16 = v_vat_16,
    total_vat_zero_rated = v_vat_zero,
    total_withholding_vat = v_withholding_vat,
    total_input_vat = v_total_input_vat,
    invoice_count = v_invoice_count,
    last_updated = NOW();
    
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE store_vat_transactions IS 'VAT transaction log for KRA compliance';
COMMENT ON COLUMN store_vat_transactions.transaction_type IS 'input_vat (paid to suppliers), output_vat (collected from customers), withholding_vat';
COMMENT ON COLUMN store_vat_transactions.kra_period IS 'KRA reporting period in YYYY-MM format';
COMMENT ON TABLE store_vat_control_summary IS 'Monthly VAT control account summary for KRA returns';
COMMENT ON TABLE store_supplier_vat_summary IS 'Supplier VAT summary per period for reporting';
COMMENT ON FUNCTION update_vat_control_summary IS 'Update VAT control summary for a given period (run monthly)';
COMMENT ON FUNCTION update_supplier_vat_summary IS 'Update supplier VAT summary for a given supplier and period';
