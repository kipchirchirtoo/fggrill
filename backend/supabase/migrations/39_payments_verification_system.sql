-- Migration: Payment Verification System
-- Description: Creates payments table with 3-tier verification workflow (Cashier → Branch Accountant → Auditor)

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    
    -- Payment details
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('Cash', 'M-Pesa', 'Card', 'Bank Transfer', 'Cheque', 'Other')),
    reference_number VARCHAR(100), -- M-Pesa code, card transaction ID, cheque number, etc.
    customer_name VARCHAR(255),
    bill_reference VARCHAR(100), -- Bill number, order number, etc.
    bill_id UUID, -- Link to actual bill if exists
    
    -- Cashier/Recorder info
    recorded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    recorder_notes TEXT,
    
    -- Branch Accountant verification
    accountant_verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    accountant_verified_at TIMESTAMP WITH TIME ZONE,
    accountant_notes TEXT,
    
    -- Auditor verification
    auditor_verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    auditor_verified_at TIMESTAMP WITH TIME ZONE,
    auditor_notes TEXT,
    auditor_status VARCHAR(20) CHECK (auditor_status IN ('approved', 'flagged', 'pending')),
    
    -- Status tracking
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'accountant_verified', 'auditor_verified', 'flagged', 'void')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_branch ON payments(branch_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_recorded_by ON payments(recorded_by);
CREATE INDEX IF NOT EXISTS idx_payments_accountant_verified_by ON payments(accountant_verified_by);
CREATE INDEX IF NOT EXISTS idx_payments_auditor_verified_by ON payments(auditor_verified_by);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_recorded_at ON payments(recorded_at);
CREATE INDEX IF NOT EXISTS idx_payments_reference_number ON payments(reference_number);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_payments_updated_at();

-- Enable Row Level Security
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view payments from their branch
CREATE POLICY "Users can view payments from their branch"
    ON payments FOR SELECT
    USING (
        branch_id = (SELECT branch_id FROM users WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'general_manager', 'auditor'))
    );

-- Cashiers and authorized roles can create payments
CREATE POLICY "Authorized users can create payments"
    ON payments FOR INSERT
    WITH CHECK (
        branch_id = (SELECT branch_id FROM users WHERE id = auth.uid())
        AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('cashier', 'receptionist', 'branch_manager', 'super_admin', 'general_manager'))
    );

-- Branch accountants can verify payments
CREATE POLICY "Branch accountants can update payments"
    ON payments FOR UPDATE
    USING (
        branch_id = (SELECT branch_id FROM users WHERE id = auth.uid())
        AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('branch_accountant', 'branch_manager', 'super_admin', 'general_manager'))
    )
    WITH CHECK (
        branch_id = (SELECT branch_id FROM users WHERE id = auth.uid())
        AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('branch_accountant', 'branch_manager', 'super_admin', 'general_manager'))
    );

-- Auditors can update payment status
CREATE POLICY "Auditors can verify payments"
    ON payments FOR UPDATE
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('auditor', 'super_admin', 'general_manager')))
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('auditor', 'super_admin', 'general_manager')));

-- Only admins can delete payments
CREATE POLICY "Admins can delete payments"
    ON payments FOR DELETE
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'general_manager')));

-- Grant permissions
GRANT ALL ON payments TO authenticated;
GRANT ALL ON payments TO service_role;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
