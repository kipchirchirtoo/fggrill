-- =====================================================
-- FIX SUPPLIER LEDGER TRIGGERS
-- Ensures running balance is never null
-- =====================================================

CREATE OR REPLACE FUNCTION post_invoice_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  v_previous_balance DECIMAL(15, 2);
  v_new_balance DECIMAL(15, 2);
BEGIN
  -- Only post when invoice is approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Get previous balance
    SELECT running_balance INTO v_previous_balance
    FROM store_supplier_ledger
    WHERE supplier_id = NEW.supplier_id
    ORDER BY transaction_date DESC, created_at DESC
    LIMIT 1;
    
    -- Ensure 0 if no previous transaction
    v_previous_balance := COALESCE(v_previous_balance, 0);
    
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

CREATE OR REPLACE FUNCTION post_payment_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  v_previous_balance DECIMAL(15, 2);
  v_new_balance DECIMAL(15, 2);
BEGIN
  -- Only post when payment is processed
  IF NEW.status = 'processed' AND (OLD.status IS NULL OR OLD.status != 'processed') THEN
    
    -- Get previous balance
    SELECT running_balance INTO v_previous_balance
    FROM store_supplier_ledger
    WHERE supplier_id = NEW.supplier_id
    ORDER BY transaction_date DESC, created_at DESC
    LIMIT 1;
    
    v_previous_balance := COALESCE(v_previous_balance, 0);
    
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
