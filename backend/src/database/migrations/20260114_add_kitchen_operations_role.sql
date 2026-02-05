-- Add KITCHEN_OPERATIONS role to the database
-- Migration: 20260114_add_kitchen_operations_role.sql
-- Created: 2026-01-14

-- This migration adds the 'kitchen_operations' role to support the Kitchen Operations module

-- Note: This assumes you have a roles table or enum type for user roles
-- Adjust based on your actual database schema

-- Option 1: If using PostgreSQL ENUM type for roles
-- First, check if the role enum exists and add the new value
DO $$
BEGIN
    -- Check if the enum type exists
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        -- Add the new enum value if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'kitchen_operations' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
        ) THEN
            ALTER TYPE user_role ADD VALUE 'kitchen_operations';
        END IF;
    END IF;
END$$;

-- Option 2: If using a roles table
-- Uncomment and adjust if you have a separate roles table
/*
INSERT INTO roles (name, display_name, description, created_at)
VALUES (
    'kitchen_operations',
    'Kitchen Operations',
    'Full access to kitchen operations module including stock ledger, requisitions, recipes, usage tracking, wastage recording, and reports',
    NOW()
)
ON CONFLICT (name) DO NOTHING;
*/

-- Option 3: If roles are just stored as text in users table
-- No migration needed - the role can be assigned directly

-- Add comment
COMMENT ON TYPE user_role IS 'User roles including kitchen_operations for Kitchen Operations module access';

-- Verification query (optional - run after migration)
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role') ORDER BY enumlabel;
