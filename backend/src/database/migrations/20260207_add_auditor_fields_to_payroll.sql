-- Add auditor confirmation fields to staff_loans and staff_advances
-- This enables the same approval workflow as credit_bills

-- Add auditor fields to staff_advances
ALTER TABLE staff_advances 
  ADD COLUMN IF NOT EXISTS accountant_confirmed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS accountant_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS auditor_confirmed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS auditor_id UUID REFERENCES users(id);

-- Add auditor fields to staff_loans
ALTER TABLE staff_loans 
  ADD COLUMN IF NOT EXISTS accountant_confirmed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS accountant_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS auditor_confirmed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS auditor_id UUID REFERENCES users(id);

-- Update status constraints to include confirmation states
-- For staff_advances
ALTER TABLE staff_advances DROP CONSTRAINT IF EXISTS staff_advances_status_check;
ALTER TABLE staff_advances ADD CONSTRAINT staff_advances_status_check 
  CHECK (status IN ('pending', 'accountant_confirmed', 'auditor_confirmed', 'approved', 'rejected', 'deducted'));

-- For staff_loans (if status constraint exists)
ALTER TABLE staff_loans DROP CONSTRAINT IF EXISTS staff_loans_status_check;
ALTER TABLE staff_loans ADD CONSTRAINT staff_loans_status_check 
  CHECK (status IN ('pending', 'accountant_confirmed', 'auditor_confirmed', 'active', 'completed', 'defaulted', 'rejected'));

-- Create indexes for faster queries on confirmation status
CREATE INDEX IF NOT EXISTS idx_staff_advances_auditor_confirmation 
  ON staff_advances(auditor_confirmed_at) WHERE auditor_confirmed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_staff_loans_auditor_confirmation 
  ON staff_loans(auditor_confirmed_at) WHERE auditor_confirmed_at IS NULL;

-- Comment
COMMENT ON COLUMN staff_advances.accountant_confirmed_at IS 'Timestamp when accountant confirmed the advance request';
COMMENT ON COLUMN staff_advances.auditor_confirmed_at IS 'Timestamp when auditor approved the advance request';
COMMENT ON COLUMN staff_loans.accountant_confirmed_at IS 'Timestamp when accountant confirmed the loan request';
COMMENT ON COLUMN staff_loans.auditor_confirmed_at IS 'Timestamp when auditor approved the loan request';
