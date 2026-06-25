-- Fix fn_po_cash_create_outbound to handle NULL branch_id (which happens for central store purchase orders)
-- by defaulting to the main/central branch (where is_main_branch = true).

CREATE OR REPLACE FUNCTION fn_po_cash_create_outbound()
RETURNS TRIGGER AS $$
DECLARE
  v_payment_id UUID;
  v_payee_name TEXT;
  v_branch_id INTEGER;
BEGIN
  IF NEW.payment_terms = 'cash' THEN
    NEW.is_daily_expense := true;

    SELECT name INTO v_payee_name FROM suppliers WHERE id = NEW.supplier_id;
    -- For store_purchase_orders, the foreign key might be store_suppliers
    IF v_payee_name IS NULL THEN
      SELECT name INTO v_payee_name FROM store_suppliers WHERE id = NEW.supplier_id;
    END IF;
    v_payee_name := COALESCE(v_payee_name, 'Unknown supplier');

    -- Resolve branch_id: if null (central_store), default to the main branch
    v_branch_id := NEW.branch_id;
    IF v_branch_id IS NULL THEN
      SELECT id INTO v_branch_id FROM branches WHERE is_main_branch = true LIMIT 1;
      -- Fallback to any branch if main is not marked
      IF v_branch_id IS NULL THEN
        SELECT id INTO v_branch_id FROM branches LIMIT 1;
      END IF;
    END IF;

    INSERT INTO branch_payments (
      branch_id, purchase_order_id, amount, payee_name, payment_method,
      cash_flow_category, source, settlement_status, description, created_by, created_at
    ) VALUES (
      v_branch_id, NEW.id, NEW.total_amount,
      v_payee_name, 'cash',
      'daily_purchase', 'purchase_order', 'pending',
      'Auto-generated from cash purchase order ' || NEW.po_number, NEW.created_by_id, NOW()
    )
    RETURNING id INTO v_payment_id;

    INSERT INTO branch_payment_audit (payment_id, action, actor_id, actor_name, actor_role, details)
    VALUES (
      v_payment_id, 'created', NEW.created_by_id, 'System: PO cash-trigger', 'system',
      jsonb_build_object('source', 'purchase_order_trigger', 'purchase_order_id', NEW.id, 'po_number', NEW.po_number)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger is registered on purchase_orders
DROP TRIGGER IF EXISTS trg_po_cash_outbound ON purchase_orders;
CREATE TRIGGER trg_po_cash_outbound
BEFORE INSERT ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION fn_po_cash_create_outbound();

-- Ensure trigger is registered on store_purchase_orders
DROP TRIGGER IF EXISTS trg_po_cash_outbound ON store_purchase_orders;
CREATE TRIGGER trg_po_cash_outbound
BEFORE INSERT ON store_purchase_orders
FOR EACH ROW EXECUTE FUNCTION fn_po_cash_create_outbound();
