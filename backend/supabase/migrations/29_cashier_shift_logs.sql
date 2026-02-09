-- =====================================================
-- CASHIER SHIFT LOGBOOK SCHEMA
-- Tracks shift start/end, cash floats, and reconciliation
-- =====================================================

-- Shift Status Enum
DO $$ BEGIN
  CREATE TYPE shift_status AS ENUM ('open', 'closed', 'reconciled', 'verified');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Main Shift Logs Table
CREATE TABLE IF NOT EXISTS cashier_shift_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_number TEXT NOT NULL UNIQUE,
  branch_id INTEGER REFERENCES branches(id) NOT NULL,
  cashier_id UUID REFERENCES users(id) NOT NULL,
  cashier_name TEXT NOT NULL,
  
  -- Shift Timing
  shift_start TIMESTAMP WITH TIME ZONE NOT NULL,
  shift_end TIMESTAMP WITH TIME ZONE,
  
  -- Cash Float
  opening_float DECIMAL(10, 2) NOT NULL DEFAULT 0,
  closing_float DECIMAL(10, 2),
  expected_closing_float DECIMAL(10, 2),
  variance DECIMAL(10, 2),
  
  -- Transaction Summary
  total_cash_sales DECIMAL(10, 2) DEFAULT 0,
  total_mpesa_sales DECIMAL(10, 2) DEFAULT 0,
  total_card_sales DECIMAL(10, 2) DEFAULT 0,
  total_sales DECIMAL(10, 2) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  
  -- Reconciliation
  status shift_status DEFAULT 'open' NOT NULL,
  reconciled_by UUID REFERENCES users(id),
  reconciled_at TIMESTAMP WITH TIME ZONE,
  reconciliation_notes TEXT,
  
  -- Verification (Auditor)
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  verification_notes TEXT,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_opening_float CHECK (opening_float >= 0),
  CONSTRAINT valid_closing_float CHECK (closing_float IS NULL OR closing_float >= 0)
);

-- Shift Transactions (Link to actual transactions)
CREATE TABLE IF NOT EXISTS cashier_shift_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID REFERENCES cashier_shift_logs(id) ON DELETE CASCADE NOT NULL,
  transaction_id UUID NOT NULL, -- Reference to payment/transaction
  transaction_ref TEXT,
  payment_method TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  transaction_time TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shift_logs_branch ON cashier_shift_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_shift_logs_cashier ON cashier_shift_logs(cashier_id);
CREATE INDEX IF NOT EXISTS idx_shift_logs_status ON cashier_shift_logs(status);
CREATE INDEX IF NOT EXISTS idx_shift_logs_date ON cashier_shift_logs(shift_start);
CREATE INDEX IF NOT EXISTS idx_shift_transactions_shift ON cashier_shift_transactions(shift_id);

-- Enable RLS
ALTER TABLE cashier_shift_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashier_shift_transactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Cashiers can view own shifts" ON cashier_shift_logs
  FOR SELECT USING (
    cashier_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'accountant', 'branch_accountant', 'auditor'))
  );

CREATE POLICY "Cashiers can create shifts" ON cashier_shift_logs
  FOR INSERT WITH CHECK (
    cashier_id = auth.uid() AND
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('cashier', 'super_admin'))
  );

CREATE POLICY "Cashiers can update own open shifts" ON cashier_shift_logs
  FOR UPDATE USING (
    (cashier_id = auth.uid() AND status = 'open') OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'accountant', 'branch_accountant', 'auditor'))
  );

CREATE POLICY "Staff can view shift transactions" ON cashier_shift_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cashier_shift_logs csl
      WHERE csl.id = shift_id AND (
        csl.cashier_id = auth.uid() OR
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'accountant', 'branch_accountant', 'auditor'))
      )
    )
  );

-- Function to generate shift number
CREATE OR REPLACE FUNCTION generate_shift_number()
RETURNS TEXT AS $$
DECLARE
  shift_date TEXT;
  shift_seq INT;
  shift_number TEXT;
BEGIN
  shift_date := TO_CHAR(NOW(), 'YYMMDD');
  
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM cashier_shift_logs
    WHERE shift_number LIKE 'SFT' || shift_date || '%'
  )
  SELECT next_seq INTO shift_seq FROM seq;
  
  shift_number := 'SFT' || shift_date || LPAD(shift_seq::TEXT, 4, '0');
  
  RETURN shift_number;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate shift summary
CREATE OR REPLACE FUNCTION calculate_shift_summary(p_shift_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_summary JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_cash', COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN amount ELSE 0 END), 0),
    'total_mpesa', COALESCE(SUM(CASE WHEN payment_method IN ('MPESA', 'MPESA_MANUAL') THEN amount ELSE 0 END), 0),
    'total_card', COALESCE(SUM(CASE WHEN payment_method = 'CARD' THEN amount ELSE 0 END), 0),
    'total_sales', COALESCE(SUM(amount), 0),
    'transaction_count', COUNT(*)
  ) INTO v_summary
  FROM cashier_shift_transactions
  WHERE shift_id = p_shift_id;
  
  RETURN v_summary;
END;
$$ LANGUAGE plpgsql;
