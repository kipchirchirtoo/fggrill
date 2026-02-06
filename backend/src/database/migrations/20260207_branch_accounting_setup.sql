-- Branch Accounting Enhancements
-- 1. Enhance finance_invoices for generic customers
-- 2. Ensure payroll/credit tables exist (Idempotent check)

-- A. Enhance finance_invoices
DO $$
BEGIN
    -- Add generic customer fields if they don't exist
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_invoices' AND column_name = 'customer_name') THEN
        ALTER TABLE finance_invoices ADD COLUMN customer_name TEXT;
        ALTER TABLE finance_invoices ADD COLUMN customer_phone TEXT;
        ALTER TABLE finance_invoices ADD COLUMN customer_email TEXT;
        ALTER TABLE finance_invoices ADD COLUMN customer_address TEXT;
        ALTER TABLE finance_invoices ADD COLUMN terms_notes TEXT;
    END IF;
END $$;

-- B. Ensure Staff Credit/Loan Tables Exist (from simplified payroll schema)
-- We re-declare them here safely to ensure strict compliance with the new dashboard requirements

-- staff_credit_bills
CREATE TABLE IF NOT EXISTS staff_credit_bills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES staff_profiles(id) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  bill_date DATE DEFAULT CURRENT_DATE NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'deducted', 'cancelled', 'paid_cash')),
  deducted_in_payroll_id UUID,
  credit_number TEXT, -- Added for searchability
  branch_id INTEGER REFERENCES branches(id), -- Important for filtering
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- staff_loans
CREATE TABLE IF NOT EXISTS staff_loans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES staff_profiles(id) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount > 0),
  installment_amount DECIMAL(10, 2) NOT NULL CHECK (installment_amount > 0),
  remaining_balance DECIMAL(10, 2) NOT NULL CHECK (remaining_balance >= 0),
  reason TEXT NOT NULL,
  loan_date DATE DEFAULT CURRENT_DATE NOT NULL,
  start_deduction_month INTEGER NOT NULL,
  start_deduction_year INTEGER NOT NULL,
  status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'paid', 'cancelled', 'pending_approval')),
  approved_by UUID REFERENCES users(id),
  branch_id INTEGER REFERENCES branches(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- staff_advances
CREATE TABLE IF NOT EXISTS staff_advances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES staff_profiles(id) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  advance_date DATE DEFAULT CURRENT_DATE NOT NULL,
  month_to_deduct INTEGER NOT NULL,
  year_to_deduct INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'deducted', 'cancelled')),
  approved_by UUID REFERENCES users(id),
  deducted_in_payroll_id UUID,
  branch_id INTEGER REFERENCES branches(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- C. Mpesa Logs Table (for raw tracking/reconciliation)
CREATE TABLE IF NOT EXISTS mpesa_transaction_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_type TEXT NOT NULL, -- 'C2B', 'B2C', 'STK_PUSH'
    trans_id TEXT UNIQUE, -- Mpesa Receipt Number
    trans_time TEXT,
    trans_amount DECIMAL(10,2),
    business_short_code TEXT,
    bill_ref_number TEXT, -- Account Number
    invoice_number TEXT,
    org_account_balance DECIMAL(10,2),
    third_party_trans_id TEXT,
    msisdn TEXT, -- Phone Number
    first_name TEXT,
    middle_name TEXT,
    last_name TEXT,
    status TEXT DEFAULT 'completed',
    branch_id INTEGER REFERENCES branches(id),
    raw_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- D. Policies (Idempotent-ish)
DO $$
BEGIN
    -- Enable RLS
    ALTER TABLE staff_credit_bills ENABLE ROW LEVEL SECURITY;
    ALTER TABLE staff_loans ENABLE ROW LEVEL SECURITY;
    ALTER TABLE staff_advances ENABLE ROW LEVEL SECURITY;
    ALTER TABLE mpesa_transaction_logs ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies to recreate them (simplest way to update)
    -- We wrap in begin/exception or just use IF EXISTS if supported, but standard PG doesn't have DROP POLICY IF EXISTS cleanly in older versions
    -- Assuming PG 10+:
    
    -- Staff Credit Bills
    DROP POLICY IF EXISTS "Management view all credit bills" ON staff_credit_bills;
    CREATE POLICY "Management view all credit bills" ON staff_credit_bills FOR ALL
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'accountant', 'auditor', 'branch_accountant')));

    -- Staff Loans
    DROP POLICY IF EXISTS "Management view all loans" ON staff_loans;
    CREATE POLICY "Management view all loans" ON staff_loans FOR ALL
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'accountant', 'auditor', 'branch_accountant')));

    -- Staff Advances
    DROP POLICY IF EXISTS "Management view all advances" ON staff_advances;
    CREATE POLICY "Management view all advances" ON staff_advances FOR ALL
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'accountant', 'auditor', 'branch_accountant')));
    
    -- Mpesa Logs
    DROP POLICY IF EXISTS "Management view mpesa logs" ON mpesa_transaction_logs;
    CREATE POLICY "Management view mpesa logs" ON mpesa_transaction_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'accountant', 'auditor', 'branch_accountant')));
    
END $$;
