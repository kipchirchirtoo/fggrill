-- ============================================================================
-- CASHIER STATION SINGLE POINT OF COLLECTION MIGRATION
-- ============================================================================
-- Implements a unified payment collection system that treats the cashier station
-- as the central node for all incoming cash, regardless of the source invoice
-- or bill. Separates payment receipts from payment allocations.
-- ============================================================================

-- 1. Extend existing cashier_transactions to act as the comprehensive logbook
ALTER TABLE cashier_transactions
ADD COLUMN IF NOT EXISTS origin_branch_id INTEGER REFERENCES branches(id),
ADD COLUMN IF NOT EXISTS receiving_branch_id INTEGER REFERENCES branches(id),
ADD COLUMN IF NOT EXISTS entry_type VARCHAR(50), -- POS_BILL_PAYMENT, INVOICE_PAYMENT, etc.
ADD COLUMN IF NOT EXISTS direction VARCHAR(10) CHECK (direction IN ('IN', 'OUT')),
ADD COLUMN IF NOT EXISTS allocation_status VARCHAR(20) DEFAULT 'UNALLOCATED';

-- 2. Create Payment Receipts
CREATE TABLE IF NOT EXISTS payment_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id INTEGER NOT NULL REFERENCES branches(id),
    cashier_id UUID REFERENCES auth.users(id),
    shift_id UUID REFERENCES cashier_shift_logs(id),
    customer_name VARCHAR(255),
    total_amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'REVERSED', 'PENDING')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_branch ON payment_receipts(branch_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_shift ON payment_receipts(shift_id);

-- 3. Create Payment Tenders
CREATE TABLE IF NOT EXISTS payment_tenders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES payment_receipts(id) ON DELETE CASCADE,
    payment_method VARCHAR(50) NOT NULL,
    payment_reference VARCHAR(100),
    amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_tenders_receipt ON payment_tenders(receipt_id);

-- 4. Create Payment Allocations
CREATE TABLE IF NOT EXISTS payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES payment_receipts(id) ON DELETE CASCADE,
    allocation_type VARCHAR(50) NOT NULL, -- 'INVOICE', 'POS_BILL', 'ADVANCE'
    target_id UUID, -- ID of the corporate_invoice or pos_shift_order
    amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_target ON payment_allocations(target_id);

-- 5. Create Customer Account Ledger
CREATE TABLE IF NOT EXISTS customer_account_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    corporate_customer_id UUID REFERENCES corporate_customers(id) ON DELETE CASCADE,
    customer_name VARCHAR(255),
    transaction_type VARCHAR(50) NOT NULL, -- 'PAYMENT', 'INVOICE', 'ADVANCE'
    amount DECIMAL(12,2) NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('IN', 'OUT')), -- IN = Payment (reduces debt), OUT = Invoice (increases debt)
    reference_id UUID, -- Links to invoice or receipt
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer ON customer_account_ledger(corporate_customer_id);

-- 6. Create Cashier Entry Reversals
CREATE TABLE IF NOT EXISTS cashier_entry_reversals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_receipt_id UUID REFERENCES payment_receipts(id),
    reversal_receipt_id UUID REFERENCES payment_receipts(id),
    reason TEXT NOT NULL,
    approved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_timestamp_payment_receipts()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payment_receipts_timestamp ON payment_receipts;
CREATE TRIGGER trigger_update_payment_receipts_timestamp
BEFORE UPDATE ON payment_receipts
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_payment_receipts();
