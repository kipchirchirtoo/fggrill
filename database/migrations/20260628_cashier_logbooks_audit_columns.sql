-- Migration: Add missing audit/review columns to cashier_logbooks
-- Fixes PGRST204 errors for accountant_notes, accountant_reviewed_by,
-- accountant_reviewed_at, auditor_id, audited_at, audit_notes

ALTER TABLE cashier_logbooks
  ADD COLUMN IF NOT EXISTS accountant_reviewed_by  UUID,
  ADD COLUMN IF NOT EXISTS accountant_reviewed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accountant_notes        TEXT,
  ADD COLUMN IF NOT EXISTS auditor_id              UUID,
  ADD COLUMN IF NOT EXISTS audited_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS audit_notes             TEXT;

-- Drop the wrong auth.users FK if it was already created, then add correct one
ALTER TABLE cashier_logbooks
  DROP CONSTRAINT IF EXISTS cashier_logbooks_accountant_reviewed_by_fkey,
  DROP CONSTRAINT IF EXISTS cashier_logbooks_auditor_id_fkey;

ALTER TABLE cashier_logbooks
  ADD CONSTRAINT cashier_logbooks_accountant_reviewed_by_fkey
    FOREIGN KEY (accountant_reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT cashier_logbooks_auditor_id_fkey
    FOREIGN KEY (auditor_id) REFERENCES users(id) ON DELETE SET NULL;

-- Index to speed up auditor/accountant queue queries
CREATE INDEX IF NOT EXISTS idx_cashier_logbooks_auditor
  ON cashier_logbooks(auditor_id)
  WHERE auditor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cashier_logbooks_accountant_reviewer
  ON cashier_logbooks(accountant_reviewed_by)
  WHERE accountant_reviewed_by IS NOT NULL;
