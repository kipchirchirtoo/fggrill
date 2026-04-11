-- =====================================================
-- Migration 014: Add branch_id to approval_requests and audit_approvals
-- Description: Enables strict branch-level data isolation for approval workflows.
--              Branch-scoped roles (auditor, branch_accountant) must only see
--              approvals belonging to their own branch.
-- =====================================================

-- Add branch_id to approval_requests if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'approval_requests' AND column_name = 'branch_id'
    ) THEN
        ALTER TABLE approval_requests
            ADD COLUMN branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;

        CREATE INDEX IF NOT EXISTS idx_approval_requests_branch_id
            ON approval_requests(branch_id) WHERE branch_id IS NOT NULL;

        COMMENT ON COLUMN approval_requests.branch_id IS
            'Branch that originated this approval request. Used for branch-level data isolation.';
    END IF;
END $$;

-- Add branch_id to audit_approvals if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'audit_approvals' AND column_name = 'branch_id'
    ) THEN
        ALTER TABLE audit_approvals
            ADD COLUMN branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;

        CREATE INDEX IF NOT EXISTS idx_audit_approvals_branch_id
            ON audit_approvals(branch_id) WHERE branch_id IS NOT NULL;

        COMMENT ON COLUMN audit_approvals.branch_id IS
            'Branch associated with this audit approval. Used for branch-level data isolation.';
    END IF;
END $$;

-- Backfill branch_id on approval_requests from metadata JSONB where possible
UPDATE approval_requests
SET branch_id = (metadata->>'branch_id')::INTEGER
WHERE branch_id IS NULL
  AND metadata IS NOT NULL
  AND metadata->>'branch_id' IS NOT NULL
  AND (metadata->>'branch_id') ~ '^\d+$';
