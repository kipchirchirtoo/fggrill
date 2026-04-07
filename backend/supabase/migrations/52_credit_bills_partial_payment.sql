-- Add 'partial' status to staff_credit_bills and create payments tracking table

-- 1. Update status constraint to include 'partial'
DO $$
BEGIN
    ALTER TABLE staff_credit_bills DROP CONSTRAINT IF EXISTS staff_credit_bills_status_check;
    ALTER TABLE staff_credit_bills ADD CONSTRAINT staff_credit_bills_status_check
      CHECK (status IN ('pending', 'accountant_confirmed', 'auditor_confirmed', 'deducted', 'cancelled', 'paid_cash', 'partial'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 2. Ensure paid_amount column exists for tracking total paid so far
ALTER TABLE staff_credit_bills
    ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12, 2) DEFAULT 0;

-- 3. Backfill paid_amount for already-settled bills
UPDATE staff_credit_bills
SET paid_amount = amount
WHERE status IN ('paid_cash', 'deducted') AND paid_amount = 0;

-- 4. Create credit bill payments table for partial payment history
CREATE TABLE IF NOT EXISTS staff_credit_bill_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_bill_id UUID NOT NULL REFERENCES staff_credit_bills(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank', 'mpesa', 'deduction')),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference VARCHAR(100),
    notes TEXT,
    recorded_by UUID REFERENCES users(id),
    shift_id UUID REFERENCES cashier_shifts(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_bill_payments_bill_id ON staff_credit_bill_payments(credit_bill_id);
CREATE INDEX IF NOT EXISTS idx_credit_bill_payments_date ON staff_credit_bill_payments(payment_date);

COMMENT ON TABLE staff_credit_bill_payments IS 'Tracks individual partial and full payments against staff credit bills';
COMMENT ON COLUMN staff_credit_bills.paid_amount IS 'Total amount paid so far across all payments';
COMMENT ON COLUMN staff_credit_bills.balance IS 'Remaining unpaid balance (amount - paid_amount)';
