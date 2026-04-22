-- Migration: Add Driver to user_role Enum
-- Description: Adds 'driver' value to the user_role enum type
-- Date: 2026-04-17

-- =====================================================
-- 1. ADD DRIVER TO user_role ENUM
-- =====================================================

-- Check if the enum value already exists
DO $$
BEGIN
  -- Add 'driver' to user_role enum if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'driver' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'driver';
    RAISE NOTICE 'Added driver to user_role enum';
  ELSE
    RAISE NOTICE 'driver already exists in user_role enum';
  END IF;
END $$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Verify the enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
ORDER BY enumsortorder;
