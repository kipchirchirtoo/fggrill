-- =====================================================
-- SHIFT RECONCILIATION SYSTEM & SCHEMA STABILIZATION
-- This migration ensures the database is in a consistent state 
-- and adds the required columns for the reconciliation module.
-- =====================================================

-- 1. STABILIZE SALES_POINTS (Fixing legacy discrepancies)
ALTER TABLE sales_points ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE sales_points ADD COLUMN IF NOT EXISTS requires_staff_assignment BOOLEAN DEFAULT FALSE;
ALTER TABLE sales_points ADD COLUMN IF NOT EXISTS supports_petty_cash BOOLEAN DEFAULT FALSE;
ALTER TABLE sales_points ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Ensure unique constraint on code for ON CONFLICT
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_points_code_key') THEN
        ALTER TABLE sales_points ADD CONSTRAINT sales_points_code_key UNIQUE (code);
    END IF;
END $$;

-- 2. STABILIZE CASHIER_SHIFTS (Fixing legacy discrepancies)
ALTER TABLE cashier_shifts ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE cashier_shifts ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE cashier_shifts ADD COLUMN IF NOT EXISTS total_cash_in DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE cashier_shifts ADD COLUMN IF NOT EXISTS total_mpesa_in DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE cashier_shifts ADD COLUMN IF NOT EXISTS total_card_in DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE cashier_shifts ADD COLUMN IF NOT EXISTS total_revenue DECIMAL(15, 2) DEFAULT 0;

-- 3. ADD RECONCILIATION COLUMNS TO CASHIER_SHIFTS
ALTER TABLE cashier_shifts
ADD COLUMN IF NOT EXISTS total_credit_created DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_credit_paid_cash DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_expenses DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_refunds DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS expected_closing_amount DECIMAL(15, 2) DEFAULT 0;

-- 4. LINK STAFF_CREDIT_BILLS TO SHIFTS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_credit_bills' AND column_name = 'shift_id') THEN
        ALTER TABLE staff_credit_bills ADD COLUMN shift_id UUID REFERENCES cashier_shifts(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_credit_bills' AND column_name = 'paid_in_shift_id') THEN
        ALTER TABLE staff_credit_bills ADD COLUMN paid_in_shift_id UUID REFERENCES cashier_shifts(id);
    END IF;
END $$;

-- 5. CREATE INDICES
CREATE INDEX IF NOT EXISTS idx_staff_credit_bills_shift_id ON staff_credit_bills(shift_id);
CREATE INDEX IF NOT EXISTS idx_staff_credit_bills_paid_in_shift_id ON staff_credit_bills(paid_in_shift_id);

-- 6. RECONCILIATION TOTALS FUNCTION
CREATE OR REPLACE FUNCTION get_shift_reconciliation_totals(p_shift_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_cash_sales DECIMAL(15, 2);
  v_mpesa_sales DECIMAL(15, 2);
  v_card_sales DECIMAL(15, 2);
  v_total_sales DECIMAL(15, 2);
  v_tx_count INTEGER;
  v_credit_created DECIMAL(15, 2);
  v_credit_paid_cash DECIMAL(15, 2);
BEGIN
  -- Aggregate transactions from shift_transactions (Kyogong system)
  -- Note: We use COALESCE and ensure we're looking at non-voided transactions
  SELECT 
    COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN total_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method IN ('MPESA', 'MPESA_MANUAL') THEN total_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method = 'CARD' THEN total_amount ELSE 0 END), 0),
    COALESCE(SUM(total_amount), 0),
    COUNT(*)
  INTO 
    v_cash_sales, v_mpesa_sales, v_card_sales, v_total_sales, v_tx_count
  FROM shift_transactions
  WHERE shift_id = p_shift_id AND is_voided = FALSE;

  -- Get credit bill totals created during this shift
  SELECT COALESCE(SUM(amount), 0) INTO v_credit_created 
  FROM staff_credit_bills 
  WHERE shift_id = p_shift_id;

  -- Get cash collected from credit bills paid during this shift
  SELECT COALESCE(SUM(amount), 0) INTO v_credit_paid_cash 
  FROM staff_credit_bills 
  WHERE paid_in_shift_id = p_shift_id AND status = 'paid_cash';

  RETURN jsonb_build_object(
    'cash_sales', v_cash_sales,
    'mpesa_sales', v_mpesa_sales,
    'card_sales', v_card_sales,
    'total_sales', v_total_sales,
    'credit_created', v_credit_created,
    'credit_paid_cash', v_credit_paid_cash,
    'transaction_count', v_tx_count
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_shift_reconciliation_totals(UUID) IS 'Calculates comprehensive reconciliation totals for a shift including sales and staff credit activity.';
