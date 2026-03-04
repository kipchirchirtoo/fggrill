-- Payment Verification System - FINAL FIXED VERSION
-- This version has corrected RLS policies that work with your schema

-- Create the payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id INTEGER NOT NULL,
    
    -- Payment details
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('Cash', 'M-Pesa', 'Card', 'Bank Transfer', 'Cheque', 'Other')),
    reference_number VARCHAR(100),
    customer_name VARCHAR(255),
    bill_reference VARCHAR(100),
    bill_id UUID,
    
    -- Cashier/Recorder info
    recorded_by UUID NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    recorder_notes TEXT,
    
    -- Branch Accountant verification
    accountant_verified_by UUID,
    accountant_verified_at TIMESTAMP WITH TIME ZONE,
    accountant_notes TEXT,
    
    -- Auditor verification
    auditor_verified_by UUID,
    auditor_verified_at TIMESTAMP WITH TIME ZONE,
    auditor_notes TEXT,
    auditor_status VARCHAR(20) CHECK (auditor_status IN ('approved', 'flagged', 'pending')),
    
    -- Status tracking
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'accountant_verified', 'auditor_verified', 'flagged', 'void')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payments_branch ON payments(branch_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_recorded_by ON payments(recorded_by);
CREATE INDEX IF NOT EXISTS idx_payments_accountant_verified_by ON payments(accountant_verified_by);
CREATE INDEX IF NOT EXISTS idx_payments_auditor_verified_by ON payments(auditor_verified_by);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_recorded_at ON payments(recorded_at);
CREATE INDEX IF NOT EXISTS idx_payments_reference_number ON payments(reference_number);

-- Create trigger function
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_payments_updated_at ON payments;
CREATE TRIGGER trigger_update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_payments_updated_at();

-- Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view payments from their branch" ON payments;
DROP POLICY IF EXISTS "Authorized users can create payments" ON payments;
DROP POLICY IF EXISTS "Branch accountants can update payments" ON payments;
DROP POLICY IF EXISTS "Auditors can verify payments" ON payments;
DROP POLICY IF EXISTS "Admins can delete payments" ON payments;

-- Policy 1: Users can view payments from their branch
CREATE POLICY "Users can view payments from their branch"
    ON payments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND (
                users.branch_id = payments.branch_id
                OR users.role IN ('super_admin', 'general_manager', 'auditor')
            )
        )
    );

-- Policy 2: Authorized users can create payments
CREATE POLICY "Authorized users can create payments"
    ON payments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.branch_id = payments.branch_id
            AND users.role IN ('cashier', 'receptionist', 'branch_manager', 'super_admin', 'general_manager')
        )
    );

-- Policy 3: Branch accountants can update payments
CREATE POLICY "Branch accountants can update payments"
    ON payments FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.branch_id = payments.branch_id
            AND users.role IN ('branch_accountant', 'branch_manager', 'super_admin', 'general_manager')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.branch_id = payments.branch_id
            AND users.role IN ('branch_accountant', 'branch_manager', 'super_admin', 'general_manager')
        )
    );

-- Policy 4: Auditors can verify payments
CREATE POLICY "Auditors can verify payments"
    ON payments FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('auditor', 'super_admin', 'general_manager')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('auditor', 'super_admin', 'general_manager')
        )
    );

-- Policy 5: Admins can delete payments
CREATE POLICY "Admins can delete payments"
    ON payments FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('super_admin', 'general_manager')
        )
    );

-- Grant permissions
GRANT ALL ON payments TO authenticated;
GRANT ALL ON payments TO service_role;

-- Reload schema
NOTIFY pgrst, 'reload schema';
