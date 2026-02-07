-- Branch Accountant Daily Log System
-- 1. finance_daily_logs: Main log record for a specific date and branch
-- 2. finance_daily_log_lines: Detailed items for the log (payments, expenses, etc.)

CREATE TABLE IF NOT EXISTS finance_daily_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id) NOT NULL,
    log_date DATE NOT NULL,
    opening_balance DECIMAL(15, 2) DEFAULT 0,
    closing_balance DECIMAL(15, 2) DEFAULT 0,
    total_payments DECIMAL(15, 2) DEFAULT 0,
    total_expenses DECIMAL(15, 2) DEFAULT 0,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'verified', 'rejected')),
    created_by UUID REFERENCES users(id) NOT NULL,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(branch_id, log_date)
);

CREATE TABLE IF NOT EXISTS finance_daily_log_lines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    log_id UUID REFERENCES finance_daily_logs(id) ON DELETE CASCADE NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('payment', 'expense', 'invoice_payment', 'other')),
    reference_id UUID, -- Reference to original record (finance_payments, expenses, etc.)
    description TEXT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    payment_method TEXT,
    category TEXT, -- e.g., 'supplies', 'salaries', 'sales'
    section TEXT,   -- For grouping in UI (e.g., 'recorded_payments', 'petty_cash_expenses')
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE finance_daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_daily_log_lines ENABLE ROW LEVEL SECURITY;

-- Policies for finance_daily_logs
CREATE POLICY "Finance staff can view daily logs"
    ON finance_daily_logs FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'manager', 'accountant', 'branch_accountant', 'auditor')
    ));

CREATE POLICY "Finance staff can manage daily logs"
    ON finance_daily_logs FOR ALL
    USING (EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'manager', 'accountant', 'branch_accountant')
    ));

-- Policies for finance_daily_log_lines
CREATE POLICY "Finance staff can view daily log lines"
    ON finance_daily_log_lines FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'manager', 'accountant', 'branch_accountant', 'auditor')
    ));

CREATE POLICY "Finance staff can manage daily log lines"
    ON finance_daily_log_lines FOR ALL
    USING (EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'manager', 'accountant', 'branch_accountant')
    ));

-- Add updated_at trigger for daily logs
CREATE OR REPLACE FUNCTION update_finance_daily_logs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_finance_daily_logs_timestamp
    BEFORE UPDATE ON finance_daily_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_finance_daily_logs_timestamp();
