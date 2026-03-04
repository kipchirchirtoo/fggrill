-- Petty Cash Transactions Table - FIXED VERSION
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS petty_cash_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id INTEGER NOT NULL,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_by UUID NOT NULL,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_petty_cash_branch ON petty_cash_transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_status ON petty_cash_transactions(status);
CREATE INDEX IF NOT EXISTS idx_petty_cash_date ON petty_cash_transactions(date);
CREATE INDEX IF NOT EXISTS idx_petty_cash_requested_by ON petty_cash_transactions(requested_by);
CREATE INDEX IF NOT EXISTS idx_petty_cash_approved_by ON petty_cash_transactions(approved_by);

CREATE OR REPLACE FUNCTION update_petty_cash_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_petty_cash_updated_at ON petty_cash_transactions;
CREATE TRIGGER trigger_update_petty_cash_updated_at
    BEFORE UPDATE ON petty_cash_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_petty_cash_updated_at();

ALTER TABLE petty_cash_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view petty cash from their branch" ON petty_cash_transactions;
CREATE POLICY "Users can view petty cash from their branch"
    ON petty_cash_transactions FOR SELECT
    USING (
        branch_id IN (SELECT branch_id FROM users WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'general_manager', 'auditor'))
    );

DROP POLICY IF EXISTS "Receptionists can create petty cash requests" ON petty_cash_transactions;
CREATE POLICY "Receptionists can create petty cash requests"
    ON petty_cash_transactions FOR INSERT
    WITH CHECK (
        branch_id IN (SELECT branch_id FROM users WHERE id = auth.uid())
        AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('receptionist', 'branch_manager', 'super_admin', 'general_manager'))
    );

DROP POLICY IF EXISTS "Managers can update petty cash status" ON petty_cash_transactions;
CREATE POLICY "Managers can update petty cash status"
    ON petty_cash_transactions FOR UPDATE
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'general_manager', 'branch_manager')))
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'general_manager', 'branch_manager')));

DROP POLICY IF EXISTS "Admins can delete petty cash transactions" ON petty_cash_transactions;
CREATE POLICY "Admins can delete petty cash transactions"
    ON petty_cash_transactions FOR DELETE
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'general_manager')));

GRANT ALL ON petty_cash_transactions TO authenticated;
GRANT ALL ON petty_cash_transactions TO service_role;

NOTIFY pgrst, 'reload schema';
