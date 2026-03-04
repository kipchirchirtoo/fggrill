-- Payment Verification - MINIMAL VERSION
-- Just creates the table with NO constraints, NO RLS

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id INTEGER,
    amount DECIMAL(10, 2),
    payment_method VARCHAR(50),
    reference_number VARCHAR(100),
    customer_name VARCHAR(255),
    bill_reference VARCHAR(100),
    bill_id UUID,
    recorded_by UUID,
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

GRANT ALL ON payments TO authenticated;
GRANT ALL ON payments TO service_role;
