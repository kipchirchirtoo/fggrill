-- =====================================================
-- SUPPLIER PAYMENTS
-- Payment processing with ledger integration
-- =====================================================

-- Create payment method enum
DO $$ BEGIN
  CREATE TYPE payment_method_type AS ENUM (
    'cash',
    'cheque',
    'bank_transfer',
    'mobile_money',
    'credit_card',
    'debit_card',
    'eft',
    'rtgs'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create payment status enum
DO $$ BEGIN
  CREATE TYPE payment_status_type AS ENUM (
    'draft',
    'pending_approval',
    'approved',
    'processed',
    'rejected',
    'cancelled',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create supplier payments table
CREATE TABLE IF NOT EXISTS store_supplier_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_number TEXT NOT NULL UNIQUE,
  
  -- Supplier reference
  supplier_id UUID REFERENCES store_suppliers(id) NOT NULL,
  
  -- Payment details
  payment_date DATE NOT NULL,
  payment_method payment_method_type NOT NULL,
  reference_number TEXT, -- Cheque number, transfer reference, etc.
  
  -- Financial details
  payment_amount DECIMAL(15, 2) NOT NULL,
  currency TEXT DEFAULT 'KES',
  
  -- Bank details (if applicable)
  bank_account_id UUID REFERENCES accounting_bank_accounts(id),
  bank_name TEXT,
  bank_account_number TEXT,
  
  -- Status and workflow
  status payment_status_type DEFAULT 'draft',
  
  -- Approval workflow (auditor-only)
  created_by_id UUID REFERENCES users(id) NOT NULL,
  submitted_by_id UUID REFERENCES users(id),
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_by_id UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_by_id UUID REFERENCES users(id),
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  
  -- Processing
  processed_by_id UUID REFERENCES users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  -- Accounting integration
  journal_entry_id UUID REFERENCES accounting_journal_entries(id),
  
  -- Metadata
  notes TEXT,
  supporting_documents JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_payment_amount CHECK (payment_amount > 0)
);

-- Create payment-invoice allocation table (many-to-many)
CREATE TABLE IF NOT EXISTS store_payment_invoice_allocations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID REFERENCES store_supplier_payments(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES store_supplier_invoices(id) NOT NULL,
  
  allocated_amount DECIMAL(15, 2) NOT NULL,
  allocation_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT valid_allocation_amount CHECK (allocated_amount > 0),
  CONSTRAINT unique_payment_invoice UNIQUE (payment_id, invoice_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON store_supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_status ON store_supplier_payments(status);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_date ON store_supplier_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_method ON store_supplier_payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON store_payment_invoice_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice ON store_payment_invoice_allocations(invoice_id);

-- Function to update invoice payment status when payment is allocated
CREATE OR REPLACE FUNCTION update_invoice_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update invoice amount_paid and balance_due
  UPDATE store_supplier_invoices
  SET 
    amount_paid = amount_paid + NEW.allocated_amount,
    balance_due = total_amount - (amount_paid + NEW.allocated_amount),
    status = CASE 
      WHEN (total_amount - (amount_paid + NEW.allocated_amount)) = 0 THEN 'paid'::supplier_invoice_status
      WHEN (amount_paid + NEW.allocated_amount) > 0 THEN 'partially_paid'::supplier_invoice_status
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = NEW.invoice_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update invoice on payment allocation
DROP TRIGGER IF EXISTS update_invoice_payment_status_trigger ON store_payment_invoice_allocations;
CREATE TRIGGER update_invoice_payment_status_trigger
  AFTER INSERT ON store_payment_invoice_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_payment_status();

-- Function to create journal entry on payment processing
CREATE OR REPLACE FUNCTION create_payment_journal_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_ap_account_id UUID;
  v_bank_account_id UUID;
  v_journal_entry_id UUID;
  v_journal_number TEXT;
BEGIN
  -- Only create journal entry when payment is processed
  IF NEW.status = 'processed' AND (OLD.status IS NULL OR OLD.status != 'processed') THEN
    
    -- Get AP and Bank account IDs
    SELECT id INTO v_ap_account_id
    FROM accounting_chart_of_accounts
    WHERE account_code = '2000' -- Accounts Payable
    LIMIT 1;
    
    SELECT id INTO v_bank_account_id
    FROM accounting_chart_of_accounts
    WHERE account_code = '1000' -- Cash/Bank
    LIMIT 1;
    
    -- Generate journal entry number
    SELECT 'JE' || TO_CHAR(NOW(), 'YYMMDD') || LPAD((COUNT(*) + 1)::TEXT, 4, '0')
    INTO v_journal_number
    FROM accounting_journal_entries
    WHERE journal_number LIKE 'JE' || TO_CHAR(NOW(), 'YYMMDD') || '%';
    
    -- Create journal entry: AP (Dr), Cash/Bank (Cr)
    INSERT INTO accounting_journal_entries (
      journal_number,
      entry_date,
      description,
      reference,
      total_debit,
      total_credit,
      status,
      posted_by,
      posted_at
    ) VALUES (
      v_journal_number,
      NEW.payment_date,
      'Supplier Payment - ' || NEW.payment_number,
      'PAY-' || NEW.payment_number,
      NEW.payment_amount,
      NEW.payment_amount,
      'posted',
      NEW.processed_by_id,
      NOW()
    ) RETURNING id INTO v_journal_entry_id;
    
    -- Debit: Accounts Payable
    INSERT INTO accounting_journal_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_ap_account_id,
      'Payment to supplier - ' || NEW.payment_number,
      NEW.payment_amount,
      0
    );
    
    -- Credit: Cash/Bank
    INSERT INTO accounting_journal_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_bank_account_id,
      'Payment - ' || NEW.payment_method || ' - ' || COALESCE(NEW.reference_number, ''),
      0,
      NEW.payment_amount
    );
    
    -- Update payment with journal entry reference
    NEW.journal_entry_id := v_journal_entry_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payment journal entry
DROP TRIGGER IF EXISTS create_payment_journal_entry_trigger ON store_supplier_payments;
CREATE TRIGGER create_payment_journal_entry_trigger
  BEFORE UPDATE OF status ON store_supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION create_payment_journal_entry();

-- Create timestamp update trigger
CREATE TRIGGER update_supplier_payments_timestamp
  BEFORE UPDATE ON store_supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_store_timestamp();

-- Function to generate payment number
CREATE OR REPLACE FUNCTION generate_payment_number()
RETURNS TEXT AS $$
DECLARE
  payment_date TEXT;
  next_seq INT;
  payment_number TEXT;
BEGIN
  payment_date := TO_CHAR(NOW(), 'YYMMDD');
  
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM store_supplier_payments
    WHERE payment_number LIKE 'PAY' || payment_date || '%'
  )
  SELECT next_seq INTO next_seq FROM seq;
  
  payment_number := 'PAY' || payment_date || LPAD(next_seq::TEXT, 4, '0');
  
  RETURN payment_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE store_supplier_payments IS 'Supplier payments with auditor approval workflow';
COMMENT ON COLUMN store_supplier_payments.reference_number IS 'Cheque number, bank transfer reference, etc.';
COMMENT ON COLUMN store_supplier_payments.approved_by_id IS 'Auditor who approved the payment';
COMMENT ON TABLE store_payment_invoice_allocations IS 'Allocation of payments to invoices (many-to-many)';
