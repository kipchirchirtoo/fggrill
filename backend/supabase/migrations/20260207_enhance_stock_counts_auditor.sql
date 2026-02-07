
-- Migration: Enhance stock_counts for Auditor Verification
-- This adds the columns required by the Auditor verification logic and expands allowed statuses.

DO $$ 
BEGIN
    -- 1. Add verification columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'stock_counts' AND COLUMN_NAME = 'verified_by') THEN
        ALTER TABLE stock_counts ADD COLUMN verified_by UUID REFERENCES staff_profiles(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'stock_counts' AND COLUMN_NAME = 'verified_at') THEN
        ALTER TABLE stock_counts ADD COLUMN verified_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'stock_counts' AND COLUMN_NAME = 'audit_notes') THEN
        ALTER TABLE stock_counts ADD COLUMN audit_notes TEXT;
    END IF;

    -- 2. Update status check constraint
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'stock_counts_status_check' 
        AND table_name = 'stock_counts'
    ) THEN
        ALTER TABLE stock_counts DROP CONSTRAINT stock_counts_status_check;
    END IF;

    ALTER TABLE stock_counts ADD CONSTRAINT stock_counts_status_check 
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'verified'));

    COMMENT ON COLUMN stock_counts.verified_by IS 'Reference to the staff profile of the auditor who verified the count';
    COMMENT ON COLUMN stock_counts.audit_notes IS 'Notes added by the auditor during verification';
END $$;
