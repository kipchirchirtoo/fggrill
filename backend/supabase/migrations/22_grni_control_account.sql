-- =====================================================
-- GRNI (Goods Received Not Invoiced) CONTROL ACCOUNT
-- Tracks inventory received but not yet invoiced
-- =====================================================

-- Create GRNI control account table
CREATE TABLE IF NOT EXISTS store_grni_control_account (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  grn_id UUID REFERENCES store_grn(id) NOT NULL,
  grn_number TEXT NOT NULL,
  supplier_id UUID REFERENCES store_suppliers(id) NOT NULL,
  po_id UUID REFERENCES store_purchase_orders(id),
  
  -- Financial details
  inventory_value DECIMAL(15, 2) NOT NULL,
  vat_amount DECIMAL(15, 2) DEFAULT 0,
  total_value DECIMAL(15, 2) NOT NULL,
  
  -- Journal entry references
  journal_entry_id UUID REFERENCES accounting_journal_entries(id),
  inventory_account_id UUID REFERENCES accounting_chart_of_accounts(id),
  grni_account_id UUID REFERENCES accounting_chart_of_accounts(id),
  
  -- Status tracking
  status TEXT DEFAULT 'open',
  cleared_at TIMESTAMP WITH TIME ZONE,
  cleared_by_invoice_id UUID, -- Will reference store_supplier_invoices
  
  -- Metadata
  created_by_id UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_grni_status CHECK (status IN ('open', 'cleared', 'cancelled')),
  CONSTRAINT valid_grni_amounts CHECK (
    inventory_value >= 0 AND
    vat_amount >= 0 AND
    total_value >= 0 AND
    total_value = inventory_value + vat_amount
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_grni_grn ON store_grni_control_account(grn_id);
CREATE INDEX IF NOT EXISTS idx_grni_supplier ON store_grni_control_account(supplier_id);
CREATE INDEX IF NOT EXISTS idx_grni_status ON store_grni_control_account(status);
CREATE INDEX IF NOT EXISTS idx_grni_po ON store_grni_control_account(po_id);

-- Function to create GRNI entry when GRN is approved
CREATE OR REPLACE FUNCTION create_grni_on_grn_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_inventory_value DECIMAL(15, 2);
  v_vat_amount DECIMAL(15, 2);
  v_total_value DECIMAL(15, 2);
  v_inventory_account_id UUID;
  v_grni_account_id UUID;
  v_journal_entry_id UUID;
  v_journal_number TEXT;
BEGIN
  -- Only create GRNI if GRN is being approved
  IF NEW.grn_approved = true AND (OLD.grn_approved IS NULL OR OLD.grn_approved = false) THEN
    
    -- Calculate total inventory value from accepted items only
    SELECT 
      COALESCE(SUM(accepted_quantity * unit_price), 0),
      COALESCE(SUM(accepted_quantity * unit_price * 0.16), 0) -- 16% VAT
    INTO v_inventory_value, v_vat_amount
    FROM store_grn_items
    WHERE grn_id = NEW.id;
    
    v_total_value := v_inventory_value + v_vat_amount;
    
    -- Only create GRNI if there's value
    IF v_total_value > 0 THEN
      
      -- Get inventory and GRNI account IDs from chart of accounts
      SELECT id INTO v_inventory_account_id
      FROM accounting_chart_of_accounts
      WHERE account_code = '1300' -- Inventory account
      LIMIT 1;
      
      SELECT id INTO v_grni_account_id
      FROM accounting_chart_of_accounts
      WHERE account_code = '2100' -- GRNI control account
      LIMIT 1;
      
      -- Generate journal entry number
      SELECT 'JE' || TO_CHAR(NOW(), 'YYMMDD') || LPAD((COUNT(*) + 1)::TEXT, 4, '0')
      INTO v_journal_number
      FROM accounting_journal_entries
      WHERE journal_number LIKE 'JE' || TO_CHAR(NOW(), 'YYMMDD') || '%';
      
      -- Create journal entry: Inventory (Dr), GRNI (Cr)
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
        CURRENT_DATE,
        'GRNI - Goods Received Not Invoiced - GRN ' || NEW.grn_number,
        'GRN-' || NEW.grn_number,
        v_total_value,
        v_total_value,
        'posted',
        NEW.approved_by_id,
        NOW()
      ) RETURNING id INTO v_journal_entry_id;
      
      -- Create journal entry lines
      -- Debit: Inventory
      INSERT INTO accounting_journal_lines (
        journal_entry_id,
        account_id,
        description,
        debit_amount,
        credit_amount
      ) VALUES (
        v_journal_entry_id,
        v_inventory_account_id,
        'Inventory received - GRN ' || NEW.grn_number,
        v_total_value,
        0
      );
      
      -- Credit: GRNI Control Account
      INSERT INTO accounting_journal_lines (
        journal_entry_id,
        account_id,
        description,
        debit_amount,
        credit_amount
      ) VALUES (
        v_journal_entry_id,
        v_grni_account_id,
        'GRNI - GRN ' || NEW.grn_number,
        0,
        v_total_value
      );
      
      -- Create GRNI control account entry
      INSERT INTO store_grni_control_account (
        grn_id,
        grn_number,
        supplier_id,
        po_id,
        inventory_value,
        vat_amount,
        total_value,
        journal_entry_id,
        inventory_account_id,
        grni_account_id,
        status,
        created_by_id
      ) VALUES (
        NEW.id,
        NEW.grn_number,
        NEW.supplier_id,
        NEW.po_id,
        v_inventory_value,
        v_vat_amount,
        v_total_value,
        v_journal_entry_id,
        v_inventory_account_id,
        v_grni_account_id,
        'open',
        NEW.approved_by_id
      );
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-create GRNI on GRN approval
DROP TRIGGER IF EXISTS create_grni_on_grn_approval_trigger ON store_grn;
CREATE TRIGGER create_grni_on_grn_approval_trigger
  AFTER UPDATE OF grn_approved ON store_grn
  FOR EACH ROW
  EXECUTE FUNCTION create_grni_on_grn_approval();

-- Create timestamp update trigger
CREATE TRIGGER update_grni_timestamp
  BEFORE UPDATE ON store_grni_control_account
  FOR EACH ROW
  EXECUTE FUNCTION update_store_timestamp();

COMMENT ON TABLE store_grni_control_account IS 'GRNI control account - tracks goods received but not yet invoiced';
COMMENT ON COLUMN store_grni_control_account.inventory_value IS 'Value of inventory received (excluding VAT)';
COMMENT ON COLUMN store_grni_control_account.vat_amount IS 'VAT amount on received goods';
COMMENT ON COLUMN store_grni_control_account.status IS 'Status: open (awaiting invoice), cleared (invoice received), cancelled';
COMMENT ON COLUMN store_grni_control_account.cleared_by_invoice_id IS 'Invoice that cleared this GRNI entry';
