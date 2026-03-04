-- Payment Verification System - Step by Step
-- Run this ENTIRE file at once in Supabase SQL Editor

-- Step 1: Create the table (no RLS yet)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id INTEGER NOT NULL,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('Cash', 'M-Pesa', 'Card', 'Bank Transfer', 'Cheque', 'Other')),
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
    auditor_status VARCHAR(20) CHECK (auditor_status IN ('approved', 'flagged', 'pending')),
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'accountant_verified', 'auditor_verified', 'flagged', 'void')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_payments_branch ON payments(branch_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_recorded_by ON payments(recorded_by);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_recorded_at ON payments(recorded_at);

-- Step 3: Create trigger function
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger
DROP TRIGGER IF EXISTS trigger_update_payments_updated_at ON payments;
CREATE TRIGGER trigger_update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_payments_updated_at();

-- Step 5: Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Step 6: Grant permissions BEFORE creating policies
GRANT ALL ON payments TO authenticated;
GRANT ALL ON payments TO service_role;

-- Step 7: Create RLS policies (simplified - no branch restrictions for now)
DROP POLICY IF EXISTS "Allow all authenticated users" ON payments;
CREATE POLICY "Allow all authenticated users"
    ON payments
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Step 8: Reload schema
NOTIFY pgrst, 'reload schema';
