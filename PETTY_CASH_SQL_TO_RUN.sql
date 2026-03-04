-- ============================================================
-- PETTY CASH TRANSACTIONS TABLE
-- Copy this ENTIRE file and run it in Supabase SQL Editor
-- ============================================================

-- Create petty_cash_transactions table
CREATE TABLE IF NOT EXISTS petty_cash_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_petty_cash_branch ON petty_cash_transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_status ON petty_cash_transactions(status);
CREATE INDEX IF NOT EXISTS idx_petty_cash_date ON petty_cash_transactions(date);
CREATE INDEX IF NOT EXISTS idx_petty_cash_requested_by ON petty_cash_transactions(requested_by);
CREATE INDEX IF NOT EXISTS idx_petty_cash_approved_by ON petty_cash_transactions(approved_by);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_petty_cash_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_petty_cash_updated_at
    BEFORE UPDATE ON petty_cash_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_petty_cash_updated_at();

-- Enable Row Level Security
ALTER TABLE petty_cash_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Policy: Users can view petty cash transactions from their branch
CREATE POLICY "Users can view petty cash from their branch"
    ON petty_cash_transactions
    FOR SELECT
    USING (
        branch_id = (SELECT branch_id FROM users WHERE id = auth.uid())
        OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'general_manager', 'auditor')
        )
    );

-- Policy: Receptionists and managers can create petty cash requests
CREATE POLICY "Receptionists can create petty cash requests"
    ON petty_cash_transactions
    FOR INSERT
    WITH CHECK (
        branch_id = (SELECT branch_id FROM users WHERE id = auth.uid())
        AND
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('receptionist', 'branch_manager', 'super_admin', 'general_manager')
        )
    );

-- Policy: Managers and admins can update petty cash status
CREATE POLICY "Managers can update petty cash status"
    ON petty_cash_transactions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'general_manager', 'branch_manager')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'general_manager', 'branch_manager')
        )
    );

-- Policy: Admins can delete petty cash transactions
CREATE POLICY "Admins can delete petty cash transactions"
    ON petty_cash_transactions
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'general_manager')
        )
    );

-- Grant permissions
GRANT ALL ON petty_cash_transactions TO authenticated;
GRANT ALL ON petty_cash_transactions TO service_role;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

-- Add comment
COMMENT ON TABLE petty_cash_transactions IS 'Tracks petty cash requests and approvals for branch operations';
