-- 20260802_repair_unhealthy_db_schema.sql
-- Fixes missing columns, ambiguous function overloads, and FK constraints causing DB statement timeouts

-- 1. Missing columns across domain tables
ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE banking_transactions ADD COLUMN IF NOT EXISTS transaction_date TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE cashier_shifts ADD COLUMN IF NOT EXISTS expense_total NUMERIC DEFAULT 0;
ALTER TABLE bar_drinks ADD COLUMN IF NOT EXISTS min_stock NUMERIC DEFAULT 0;
ALTER TABLE bar_drinks ADD COLUMN IF NOT EXISTS reorder_level NUMERIC DEFAULT 0;
ALTER TABLE credit_bills ADD COLUMN IF NOT EXISTS short_code VARCHAR(20);
ALTER TABLE accounting_ar_invoices ADD COLUMN IF NOT EXISTS short_code VARCHAR(20);

-- 2. Unify overloaded generate_cashier_transaction_number function
DROP FUNCTION IF EXISTS generate_cashier_transaction_number();
DROP FUNCTION IF EXISTS generate_cashier_transaction_number(INTEGER);
CREATE OR REPLACE FUNCTION generate_cashier_transaction_number(p_branch_id INTEGER DEFAULT 1)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_seq INTEGER;
  v_result TEXT;
BEGIN
  v_prefix := 'CTX-' || COALESCE(p_branch_id::text, '1') || '-' || to_char(NOW(), 'YYYYMMDD') || '-';
  v_seq := FLOOR(1000 + random() * 8999)::INTEGER;
  v_result := v_prefix || v_seq::text;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 3. Auto-heal missing bar_drinks foreign key items for bar_stock & bar_stock_ledger
CREATE OR REPLACE FUNCTION auto_create_missing_bar_drink()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.drink_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM bar_drinks WHERE id = NEW.drink_id) THEN
    INSERT INTO bar_drinks (id, name, is_available, is_active, stock_quantity, created_at, updated_at)
    VALUES (NEW.drink_id, 'Bar Item (' || LEFT(NEW.drink_id::text, 8) || ')', true, true, 0, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_create_missing_bar_drink ON bar_stock;
CREATE TRIGGER trg_auto_create_missing_bar_drink
BEFORE INSERT OR UPDATE ON bar_stock
FOR EACH ROW EXECUTE FUNCTION auto_create_missing_bar_drink();

DROP TRIGGER IF EXISTS trg_auto_create_missing_bar_drink_ledger ON bar_stock_ledger;
CREATE TRIGGER trg_auto_create_missing_bar_drink_ledger
BEFORE INSERT OR UPDATE ON bar_stock_ledger
FOR EACH ROW EXECUTE FUNCTION auto_create_missing_bar_drink();
