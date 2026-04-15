-- Migration: Ensure user_id is nullable in staff_profiles
-- This fixes the 500 error when creating staff members without user accounts

-- Make user_id nullable (staff don't need user accounts)
ALTER TABLE staff_profiles ALTER COLUMN user_id DROP NOT NULL;

-- Add a comment to document this design decision
COMMENT ON COLUMN staff_profiles.user_id IS 'Optional link to users table. Staff can exist without system login accounts.';

-- Verify the change
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'staff_profiles' 
        AND column_name = 'user_id' 
        AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'Migration failed: user_id is still NOT NULL';
    ELSE
        RAISE NOTICE 'Migration successful: user_id is now nullable';
    END IF;
END $$;
