-- ============================================
-- BANKING TRANSACTIONS TABLE
-- Run this in Supabase Dashboard SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS banking_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id) NOT NULL,
    transaction_date DATE NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'BANK_CHARGE')),
    
    -- Bank details
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_name TEXT,
    
    -- Transaction details
    amount DECIMAL(12,2) NOT NULL,
    currency TEXT DEFAULT 'KES',
    reference_number TEXT UNIQUE NOT NULL,
    
    -- Source/Destination
    source TEXT,
    destination TEXT,
    
    -- Payment method for deposits
    payment_method TEXT CHECK (payment_method IN ('CASH', 'CHEQUE', 'MPESA', 'BANK_TRANSFER', 'CARD')),
    
    -- Supporting documents
    receipt_number TEXT,
    slip_attachment_url TEXT,
    
    -- Reconciliation
    is_reconciled BOOLEAN DEFAULT FALSE,
    reconciled_at TIMESTAMP WITH TIME ZONE,
    reconciled_by UUID REFERENCES users(id),
    
    -- Purpose and notes
    purpose_category TEXT CHECK (purpose_category IN ('DAILY_SALES', 'CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT', 'EXPENSE', 'TRANSFER', 'OTHER')),
    purpose_description TEXT NOT NULL,
    notes TEXT,
    
    -- Audit
    recorded_by UUID REFERENCES users(id) NOT NULL,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'RECONCILED')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_banking_branch ON banking_transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_banking_date ON banking_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_banking_type ON banking_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_banking_status ON banking_transactions(status);
CREATE INDEX IF NOT EXISTS idx_banking_reference ON banking_transactions(reference_number);

-- Enable RLS
ALTER TABLE banking_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Accountants can view banking transactions" ON banking_transactions;
DROP POLICY IF EXISTS "Accountants can manage banking transactions" ON banking_transactions;

-- Banking Transactions Policies
CREATE POLICY "Accountants can view banking transactions"
ON banking_transactions FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'accountant', 'branch_accountant', 'auditor', 'manager')
    )
);

CREATE POLICY "Accountants can manage banking transactions"
ON banking_transactions FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'accountant', 'branch_accountant')
    )
);

-- ============================================
-- DONE! Banking transactions table is ready
-- ============================================
