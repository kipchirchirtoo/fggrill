-- =====================================================
-- SUPPLIER CREDIT NOTES & PROFILE ENHANCEMENTS
-- =====================================================

-- 1. Enhance store_suppliers table
ALTER TABLE store_suppliers
  ADD COLUMN IF NOT EXISTS contract_start_date DATE,
  ADD COLUMN IF NOT EXISTS contract_end_date DATE,
  ADD COLUMN IF NOT EXISTS trading_name TEXT,
  ADD COLUMN IF NOT EXISTS vat_category TEXT CHECK (vat_category IN ('standard_16', 'zero_rated', 'exempt'));

-- 2. Create Credit Note status enum
DO $$ BEGIN
  CREATE TYPE supplier_credit_note_status AS ENUM (
    'draft',
    'submitted',
    'approved',
    'rejected',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Create credit notes table
CREATE TABLE IF NOT EXISTS store_supplier_credit_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_note_number TEXT NOT NULL UNIQUE,
  
  -- References
  supplier_id UUID REFERENCES store_suppliers(id) NOT NULL,
  invoice_id UUID REFERENCES store_supplier_invoices(id),
  grn_id UUID REFERENCES store_grn(id),
  
  -- Details
  credit_note_date DATE NOT NULL,
  reason TEXT NOT NULL,
  
  -- Financials
  subtotal DECIMAL(15, 2) NOT NULL,
  vat_amount DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) NOT NULL,
  
  -- Status
  status supplier_credit_note_status DEFAULT 'draft',
  
  -- Metadata
  created_by_id UUID REFERENCES users(id) NOT NULL,
  approved_by_id UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_credit_note_amounts CHECK (
    subtotal >= 0 AND
    vat_amount >= 0 AND
    total_amount = subtotal + vat_amount
  )
);

-- 4. Create credit note items table
CREATE TABLE IF NOT EXISTS store_credit_note_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_note_id UUID REFERENCES store_supplier_credit_notes(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES store_items(id),
  
  description TEXT,
  quantity DECIMAL(12, 3) NOT NULL,
  unit_price DECIMAL(15, 2) NOT NULL,
  subtotal DECIMAL(15, 2) NOT NULL,
  vat_amount DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) NOT NULL,
  
  CONSTRAINT valid_item_amounts CHECK (
    quantity > 0 AND
    unit_price >= 0 AND
    subtotal = quantity * unit_price AND
    total_amount = subtotal + vat_amount
  )
);

-- 5. Add supplier_id to audit logs
ALTER TABLE store_procurement_audit_logs
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES store_suppliers(id);

-- Update audit log function to handle supplier_id
CREATE OR REPLACE FUNCTION create_audit_log(
  p_user_id UUID,
  p_action procurement_audit_action,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_entity_reference TEXT,
  p_old_values JSONB,
  p_new_values JSONB,
  p_description TEXT,
  p_supplier_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
  v_user_email TEXT;
  v_user_name TEXT;
BEGIN
  -- Get user details
  SELECT email, (first_name || ' ' || last_name)
  INTO v_user_email, v_user_name
  FROM users
  WHERE id = p_user_id;

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
    description,
    supplier_id,
    is_critical
  ) VALUES (
    p_user_id,
    v_user_email,
    v_user_name,
    p_action,
    p_entity_type,
    p_entity_id,
    p_entity_reference,
    p_old_values,
    p_new_values,
    p_description,
    p_supplier_id,
    p_action IN ('approve', 'process', 'cancel')
  ) RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger to post credit note to ledger upon approval
CREATE OR REPLACE FUNCTION post_credit_note_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  v_running_balance DECIMAL(15, 2);
BEGIN
  -- Only post if status changed to 'approved'
  IF (TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status != 'approved') THEN
    
    -- Get current balance
    SELECT current_balance INTO v_running_balance
    FROM store_supplier_balances
    WHERE supplier_id = NEW.supplier_id;
    
    -- New balance (reducing liability)
    v_running_balance := COALESCE(v_running_balance, 0) - NEW.total_amount;
    
    -- Insert into ledger
    INSERT INTO store_supplier_ledger (
      supplier_id,
      transaction_date,
      transaction_type,
      reference_number,
      debit_amount,
      credit_amount,
      running_balance,
      description,
      created_by_id
    ) VALUES (
      NEW.supplier_id,
      NEW.credit_note_date,
      'credit_note',
      NEW.credit_note_number,
      NEW.total_amount,
      0,
      v_running_balance,
      'Credit Note: ' || NEW.reason,
      NEW.created_by_id
    );
    
    -- Update summary balance
    INSERT INTO store_supplier_balances (supplier_id, total_credit_notes, current_balance, last_updated)
    VALUES (NEW.supplier_id, NEW.total_amount, v_running_balance, NOW())
    ON CONFLICT (supplier_id) DO UPDATE SET
      total_credit_notes = store_supplier_balances.total_credit_notes + EXCLUDED.total_credit_notes,
      current_balance = store_supplier_balances.current_balance - EXCLUDED.total_credit_notes,
      last_updated = NOW();
      
    -- Create audit log
    PERFORM create_audit_log(
      NEW.created_by_id,
      'approve',
      'credit_note',
      NEW.id,
      NEW.credit_note_number,
      NULL,
      row_to_json(NEW)::jsonb,
      'Approved supplier credit note',
      NEW.supplier_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_post_credit_note_to_ledger ON store_supplier_credit_notes;
CREATE TRIGGER trg_post_credit_note_to_ledger
  AFTER UPDATE ON store_supplier_credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION post_credit_note_to_ledger();

-- 7. Function to generate credit note number
CREATE OR REPLACE FUNCTION generate_credit_note_number()
RETURNS TEXT AS $$
DECLARE
  cn_date TEXT;
  next_seq INT;
  cn_number TEXT;
BEGIN
  cn_date := TO_CHAR(NOW(), 'YYMMDD');
  
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM store_supplier_credit_notes
    WHERE credit_note_number LIKE 'CN' || cn_date || '%'
  )
  SELECT next_seq INTO next_seq FROM seq;
  
  cn_number := 'CN' || cn_date || LPAD(next_seq::TEXT, 4, '0');
  
  RETURN cn_number;
END;
$$ LANGUAGE plpgsql;
