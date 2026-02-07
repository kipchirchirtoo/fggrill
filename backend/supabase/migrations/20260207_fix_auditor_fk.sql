
-- Migration: Fix Auditor Verified_By FK and standardize stock movements
-- This changes verified_by to reference users(id) for flexibility.

DO $$ 
BEGIN
    -- 1. Fix stock_counts.verified_by FK
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'stock_counts_verified_by_fkey' 
        AND table_name = 'stock_counts'
    ) THEN
        ALTER TABLE stock_counts DROP CONSTRAINT stock_counts_verified_by_fkey;
    END IF;

    -- Re-add reference to users instead of staff_profiles
    -- This allows non-staff users (like super admins or external auditors) to verify counts.
    ALTER TABLE stock_counts 
    ADD CONSTRAINT fk_stock_counts_verified_by 
    FOREIGN KEY (verified_by) REFERENCES users(id);

    COMMENT ON COLUMN stock_counts.verified_by IS 'Reference to the user profile of the auditor who verified the count';
END $$;
