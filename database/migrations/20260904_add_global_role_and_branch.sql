-- =====================================================
-- Migration: 20260904_add_global_role_and_branch.sql
-- Description:
--   1. Adds 'global' role to user_role enum (if exists) and roles table.
--   2. Adds 'Global' branch into branches table so POS terminals and users
--      can be registered under the Global branch with cross-branch access.
-- =====================================================

-- 1. Ensure 'global' value is in user_role enum if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum 
      WHERE enumtypid = 'user_role'::regtype AND enumlabel = 'global'
    ) THEN
      ALTER TYPE user_role ADD VALUE 'global';
    END IF;
  END IF;
END $$;

-- 2. Insert or update 'global' role in roles table
INSERT INTO roles (code, name, role_name, scope, is_system, permissions)
VALUES (
  'global',
  'Global',
  'Global',
  'global',
  true,
  '{"source": "system", "actions": ["*"], "legacy_role_name": "global"}'::jsonb
)
ON CONFLICT (code) DO UPDATE SET
  scope = 'global',
  is_system = true,
  updated_at = NOW();

-- 3. Insert 'Global' branch in branches table if it does not exist
INSERT INTO branches (
  name,
  legal_name,
  code,
  location,
  city,
  country,
  is_active,
  status,
  is_main_branch,
  is_central_warehouse,
  branch_type
)
SELECT
  'Global',
  'Famous Gate Global Operations',
  'GLB',
  'ALL',
  'ALL',
  'Kenya',
  true,
  'active',
  false,
  false,
  'hotel'
WHERE NOT EXISTS (
  SELECT 1 FROM branches WHERE LOWER(code) = 'glb' OR LOWER(name) = 'global'
);
