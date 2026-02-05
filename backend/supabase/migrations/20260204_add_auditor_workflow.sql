-- =============================================
-- ADD AUDITOR WORKFLOW TO CASHIER LOGBOOKS
-- =============================================
-- Add auditor review fields and update status constraint

-- Add new columns for auditor workflow
ALTER TABLE cashier_logbooks
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auditor_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS audited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS audit_notes TEXT;

-- Drop old status constraint and add new one with additional statuses
ALTER TABLE cashier_logbooks DROP CONSTRAINT IF EXISTS cashier_logbooks_status_check;
ALTER TABLE cashier_logbooks ADD CONSTRAINT cashier_logbooks_status_check 
    CHECK (status IN ('open', 'pending_audit', 'approved', 'rejected'));

-- Create index for auditor queries
CREATE INDEX IF NOT EXISTS idx_cashier_logbooks_status ON cashier_logbooks(status);
CREATE INDEX IF NOT EXISTS idx_cashier_logbooks_auditor ON cashier_logbooks(auditor_id);

-- Comments
COMMENT ON COLUMN cashier_logbooks.submitted_at IS 'When the logbook was submitted for audit';
COMMENT ON COLUMN cashier_logbooks.auditor_id IS 'ID of the auditor who reviewed this logbook';
COMMENT ON COLUMN cashier_logbooks.audited_at IS 'When the logbook was audited';
COMMENT ON COLUMN cashier_logbooks.audit_notes IS 'Auditor comments and notes';
