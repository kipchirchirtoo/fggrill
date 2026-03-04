-- Payment Verification System Table
-- Using different name to avoid conflict with existing payments table

CREATE TABLE IF NOT EXISTS payment_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id INTEGER NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    reference_number VARCHAR(100),
    customer_name VARCHAR(255),
    bill_reference VARCHAR(100),
    bill_id UUID,
    recorded_by UUID NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    recorder_notes TEXT,
    accountant_verified_by UUID,
    accountant_verified_at TIMESTAMP WITH TIME ZONE,
    accountant_notes TEXT,
    auditor_verified_by UUID,
    auditor_verified_at TIMESTAMP WITH TIME ZONE,
    auditor_notes TEXT,
    auditor_status VARCHAR(20),
    status VARCHAR(30) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grant permissions
GRANT ALL ON payment_verifications TO authenticated;
GRANT ALL ON payment_verifications TO service_role;
GRANT ALL ON payment_verifications TO anon;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payment_verifications_branch ON payment_verifications(branch_id);
CREATE INDEX IF NOT EXISTS idx_payment_verifications_status ON payment_verifications(status);
CREATE INDEX IF NOT EXISTS idx_payment_verifications_recorded_by ON payment_verifications(recorded_by);
CREATE INDEX IF NOT EXISTS idx_payment_verifications_recorded_at ON payment_verifications(recorded_at DESC);
