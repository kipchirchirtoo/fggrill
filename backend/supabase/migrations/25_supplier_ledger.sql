-- =====================================================
-- SUPPLIER LEDGER (Accounts Payable)
-- Tracks all supplier transactions and running balances
-- =====================================================

-- Create ledger transaction type enum
DO $$ BEGIN
  CREATE TYPE supplier_ledger_transaction_type AS ENUM (
    'opening_balance',
    'invoice',
    'payment',
    'credit_note',
    'debit_note',
    'adjustment'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create supplier ledger table
CREATE TABLE IF NOT EXISTS store_supplier_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Supplier reference
  supplier_id UUID REFERENCES store_suppliers(id) NOT NULL,
  
  -- Transaction details
  transaction_date DATE NOT NULL,
  transaction_type supplier_ledger_transaction_type NOT NULL,
  
  -- Source document references
  invoice_id UUID REFERENCES store_supplier_invoices(id),
  payment_id UUID REFERENCES store_supplier_payments(id),
  reference_number TEXT,
  
  -- Financial details
  debit_amount DECIMAL(15, 2) DEFAULT 0,  -- Payments, credit notes (reduce liability)
  credit_amount DECIMAL(15, 2) DEFAULT 0, -- Invoices, debit notes (increase liability)
  running_balance DECIMAL(15, 2) NOT NULL,
  
  -- Aging analysis fields
  current_amount DECIMAL(15, 2) DEFAULT 0,      -- 0-30 days
  days_30_amount DECIMAL(15, 2) DEFAULT 0,      -- 31-60 days
  days_60_amount DECIMAL(15, 2) DEFAULT 0,      -- 61-90 days
  days_90_plus_amount DECIMAL(15, 2) DEFAULT 0, -- 90+ days
  
  -- Metadata
  description TEXT,
  notes TEXT,
  created_by_id UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  is_posted BOOLEAN DEFAULT true,
  
  CONSTRAINT valid_ledger_amounts CHECK (
    debit_amount >= 0 AND
    credit_amount >= 0 AND
    (debit_amount = 0 OR credit_amount = 0) -- Either debit or credit, not both
  )
);

-- Create supplier balance summary table
CREATE TABLE IF NOT EXISTS store_supplier_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES store_suppliers(id) NOT NULL UNIQUE,
  
  -- Balance details
  opening_balance DECIMAL(15, 2) DEFAULT 0,
  total_invoices DECIMAL(15, 2) DEFAULT 0,
  total_payments DECIMAL(15, 2) DEFAULT 0,
  total_credit_notes DECIMAL(15, 2) DEFAULT 0,
  current_balance DECIMAL(15, 2) DEFAULT 0,
  
  -- Aging analysis
  current_amount DECIMAL(15, 2) DEFAULT 0,      -- 0-30 days
  days_30_amount DECIMAL(15, 2) DEFAULT 0,      -- 31-60 days
  days_60_amount DECIMAL(15, 2) DEFAULT 0,      -- 61-90 days
  days_90_plus_amount DECIMAL(15, 2) DEFAULT 0, -- 90+ days
  
  -- Statistics
  last_invoice_date DATE,
  last_payment_date DATE,
  average_payment_days INTEGER,
  
  -- Metadata
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT valid_balance_amounts CHECK (
    current_balance = opening_balance + total_invoices - total_payments - total_credit_notes
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_supplier_ledger_supplier ON store_supplier_ledger(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_ledger_date ON store_supplier_ledger(transaction_date);
CREATE INDEX IF NOT EXISTS idx_supplier_ledger_type ON store_supplier_ledger(transaction_type);
CREATE INDEX IF NOT EXISTS idx_supplier_ledger_invoice ON store_supplier_ledger(invoice_id);
CREATE INDEX IF NOT EXISTS idx_supplier_ledger_payment ON store_supplier_ledger(payment_id);
CREATE INDEX IF NOT EXISTS idx_supplier_balances_supplier ON store_supplier_balances(supplier_id);

-- Function to post invoice to supplier ledger
CREATE OR REPLACE FUNCTION post_invoice_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  v_previous_balance DECIMAL(15, 2);
  v_new_balance DECIMAL(15, 2);
BEGIN
  -- Only post when invoice is approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Get previous balance
    SELECT COALESCE(running_balance, 0) INTO v_previous_balance
    FROM store_supplier_ledger
    WHERE supplier_id = NEW.supplier_id
    ORDER BY transaction_date DESC, created_at DESC
    LIMIT 1;
    
    -- Calculate new balance (credit increases liability)
    v_new_balance := v_previous_balance + NEW.total_amount;
    
    -- Post to ledger
    INSERT INTO store_supplier_ledger (
      supplier_id,
      transaction_date,
      transaction_type,
      invoice_id,
      reference_number,
      credit_amount,
      running_balance,
      description,
      created_by_id
    ) VALUES (
      NEW.supplier_id,
      NEW.invoice_date,
      'invoice',
      NEW.id,
      NEW.invoice_number,
      NEW.total_amount,
      v_new_balance,
      'Supplier Invoice - ' || NEW.invoice_number,
      NEW.approved_by_id
    );
    
    -- Update supplier balance summary
    INSERT INTO store_supplier_balances (supplier_id, current_balance, total_invoices, last_invoice_date)
    VALUES (NEW.supplier_id, v_new_balance, NEW.total_amount, NEW.invoice_date)
    ON CONFLICT (supplier_id) DO UPDATE
    SET 
      total_invoices = store_supplier_balances.total_invoices + NEW.total_amount,
      current_balance = store_supplier_balances.current_balance + NEW.total_amount,
      last_invoice_date = NEW.invoice_date,
      last_updated = NOW();
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to post invoice to ledger
DROP TRIGGER IF EXISTS post_invoice_to_ledger_trigger ON store_supplier_invoices;
CREATE TRIGGER post_invoice_to_ledger_trigger
  AFTER UPDATE OF status ON store_supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION post_invoice_to_ledger();

-- Function to post payment to supplier ledger
CREATE OR REPLACE FUNCTION post_payment_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  v_previous_balance DECIMAL(15, 2);
  v_new_balance DECIMAL(15, 2);
BEGIN
  -- Only post when payment is processed
  IF NEW.status = 'processed' AND (OLD.status IS NULL OR OLD.status != 'processed') THEN
    
    -- Get previous balance
    SELECT COALESCE(running_balance, 0) INTO v_previous_balance
    FROM store_supplier_ledger
    WHERE supplier_id = NEW.supplier_id
    ORDER BY transaction_date DESC, created_at DESC
    LIMIT 1;
    
    -- Calculate new balance (debit reduces liability)
    v_new_balance := v_previous_balance - NEW.payment_amount;
    
    -- Post to ledger
    INSERT INTO store_supplier_ledger (
      supplier_id,
      transaction_date,
      transaction_type,
      payment_id,
      reference_number,
      debit_amount,
      running_balance,
      description,
      created_by_id
    ) VALUES (
      NEW.supplier_id,
      NEW.payment_date,
      'payment',
      NEW.id,
      NEW.payment_number,
      NEW.payment_amount,
      v_new_balance,
      'Payment - ' || NEW.payment_method || ' - ' || COALESCE(NEW.reference_number, ''),
      NEW.processed_by_id
    );
    
    -- Update supplier balance summary
    UPDATE store_supplier_balances
    SET 
      total_payments = total_payments + NEW.payment_amount,
      current_balance = current_balance - NEW.payment_amount,
      last_payment_date = NEW.payment_date,
      last_updated = NOW()
    WHERE supplier_id = NEW.supplier_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to post payment to ledger
DROP TRIGGER IF EXISTS post_payment_to_ledger_trigger ON store_supplier_payments;
CREATE TRIGGER post_payment_to_ledger_trigger
  AFTER UPDATE OF status ON store_supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION post_payment_to_ledger();

-- Function to calculate aging analysis
CREATE OR REPLACE FUNCTION calculate_supplier_aging()
RETURNS void AS $$
DECLARE
  v_supplier RECORD;
  v_invoice RECORD;
  v_days_outstanding INTEGER;
  v_current DECIMAL(15, 2);
  v_30_days DECIMAL(15, 2);
  v_60_days DECIMAL(15, 2);
  v_90_plus DECIMAL(15, 2);
BEGIN
  -- Loop through all suppliers with outstanding balances
  FOR v_supplier IN 
    SELECT id FROM store_suppliers WHERE status = 'active'
  LOOP
    v_current := 0;
    v_30_days := 0;
    v_60_days := 0;
    v_90_plus := 0;
    
    -- Loop through unpaid/partially paid invoices
    FOR v_invoice IN
      SELECT id, invoice_date, balance_due
      FROM store_supplier_invoices
      WHERE supplier_id = v_supplier.id
        AND balance_due > 0
        AND status IN ('approved', 'partially_paid')
    LOOP
      v_days_outstanding := CURRENT_DATE - v_invoice.invoice_date;
      
      IF v_days_outstanding <= 30 THEN
        v_current := v_current + v_invoice.balance_due;
      ELSIF v_days_outstanding <= 60 THEN
        v_30_days := v_30_days + v_invoice.balance_due;
      ELSIF v_days_outstanding <= 90 THEN
        v_60_days := v_60_days + v_invoice.balance_due;
      ELSE
        v_90_plus := v_90_plus + v_invoice.balance_due;
      END IF;
    END LOOP;
    
    -- Update supplier balance summary
    UPDATE store_supplier_balances
    SET 
      current_amount = v_current,
      days_30_amount = v_30_days,
      days_60_amount = v_60_days,
      days_90_plus_amount = v_90_plus,
      last_updated = NOW()
    WHERE supplier_id = v_supplier.id;
    
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE store_supplier_ledger IS 'Supplier accounts payable ledger with running balances';
COMMENT ON COLUMN store_supplier_ledger.debit_amount IS 'Payments and credit notes (reduce liability)';
COMMENT ON COLUMN store_supplier_ledger.credit_amount IS 'Invoices and debit notes (increase liability)';
COMMENT ON COLUMN store_supplier_ledger.running_balance IS 'Running balance after this transaction';
COMMENT ON TABLE store_supplier_balances IS 'Summary of supplier balances with aging analysis';
COMMENT ON FUNCTION calculate_supplier_aging IS 'Calculate aging analysis for all suppliers (run periodically)';
