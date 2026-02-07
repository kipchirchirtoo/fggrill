-- Add auditor confirmation fields to staff_credit_bills
-- This makes it consistent with staff_advances and staff_loans

ALTER TABLE staff_credit_bills 
  ADD COLUMN IF NOT EXISTS accountant_confirmed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS accountant_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS auditor_confirmed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS auditor_id UUID REFERENCES users(id);

-- Update status constraint if needed
-- Current status: pending, deducted, cancelled, paid_cash
-- Adding: accountant_confirmed, auditor_confirmed
DO $$
BEGIN
    ALTER TABLE staff_credit_bills DROP CONSTRAINT IF EXISTS staff_credit_bills_status_check;
    ALTER TABLE staff_credit_bills ADD CONSTRAINT staff_credit_bills_status_check 
      CHECK (status IN ('pending', 'accountant_confirmed', 'auditor_confirmed', 'deducted', 'cancelled', 'paid_cash'));
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not update constraint, might already be correct or table missing';
END $$;

-- Create index for faster queries on confirmation status
CREATE INDEX IF NOT EXISTS idx_staff_credit_bills_auditor_confirmation 
  ON staff_credit_bills(auditor_confirmed_at) WHERE auditor_confirmed_at IS NULL;

-- Comments
COMMENT ON COLUMN staff_credit_bills.accountant_confirmed_at IS 'Timestamp when accountant confirmed the credit bill';
COMMENT ON COLUMN staff_credit_bills.auditor_confirmed_at IS 'Timestamp when auditor approved the credit bill';
