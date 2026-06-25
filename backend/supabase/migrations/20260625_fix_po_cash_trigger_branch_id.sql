-- Fix fn_po_cash_create_outbound to:
-- 1. Handle NULL branch_id (central store POs have no branch → use main branch)
-- 2. Generate payment_number to satisfy NOT NULL UNIQUE constraint on branch_payments

CREATE OR REPLACE FUNCTION fn_po_cash_create_outbound()
RETURNS TRIGGER AS $$
DECLARE
  v_payment_id     UUID;
  v_payee_name     TEXT;
  v_branch_id      INTEGER;
  v_payment_number TEXT;
BEGIN
  IF NEW.payment_terms = 'cash' THEN
    NEW.is_daily_expense := true;

    -- Resolve supplier name
    SELECT name INTO v_payee_name FROM suppliers WHERE id = NEW.supplier_id;
    IF v_payee_name IS NULL THEN
      SELECT name INTO v_payee_name FROM store_suppliers WHERE id = NEW.supplier_id;
    END IF;
    v_payee_name := COALESCE(v_payee_name, 'Unknown supplier');

    -- Resolve branch_id: NULL means central store, default to main branch
    v_branch_id := NEW.branch_id;
    IF v_branch_id IS NULL THEN
      SELECT id INTO v_branch_id FROM branches WHERE is_main_branch = true LIMIT 1;
      IF v_branch_id IS NULL THEN
        SELECT id INTO v_branch_id FROM branches LIMIT 1;
      END IF;
    END IF;

    -- Generate unique payment number: PAY-YYYYMMDD-<short uuid>
    v_payment_number := 'PAY-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 8));

    INSERT INTO branch_payments (
      branch_id, purchase_order_id, payment_number, amount, payee_name,
      payment_method, category, cash_flow_category, source, settlement_status,
      description, created_by, created_at
    ) VALUES (
      v_branch_id, NEW.id, v_payment_number, NEW.total_amount, v_payee_name,
      'cash', 'vendor', 'daily_purchase', 'purchase_order', 'pending',
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

-- Re-register trigger on purchase_orders (store_purchase_orders is a view over it)
DROP TRIGGER IF EXISTS trg_po_cash_outbound ON purchase_orders;
CREATE TRIGGER trg_po_cash_outbound
BEFORE INSERT ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION fn_po_cash_create_outbound();
