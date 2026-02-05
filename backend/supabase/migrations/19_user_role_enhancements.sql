-- =====================================================
-- USER ROLE ENHANCEMENTS
-- Adds auditor, procurement, and storekeeper roles
-- =====================================================

-- Add new roles to user_role enum
-- Note: PostgreSQL does not support ADD VALUE within a transaction block for enums
-- unless it's the first time the type is used? Actually it usually requires separate commands.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'auditor';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'procurement';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'storekeeper';

COMMENT ON TYPE user_role IS 'Updated user roles including procurement-specific roles (auditor, procurement, storekeeper)';
