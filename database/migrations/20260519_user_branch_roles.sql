-- ============================================================
-- Migration: user_branch_roles
-- Supports multi-role and multi-branch users.
-- Universal roles (super_admin, general_manager, central_storekeeper,
-- auditor, hr_manager, director) are NOT affected — they already
-- have system-wide access and skip the context selector.
-- ============================================================

-- 1. Create the junction table
CREATE TABLE IF NOT EXISTS user_branch_roles (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id   INTEGER REFERENCES branches(id) ON DELETE CASCADE,  -- NULL = role applies to all branches
  role        VARCHAR(50) NOT NULL,
  is_primary  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_user_branch_role UNIQUE (user_id, branch_id, role)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_ubr_user_id   ON user_branch_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_ubr_branch_id ON user_branch_roles (branch_id);

-- 3. updated_at trigger
CREATE OR REPLACE FUNCTION set_ubr_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_ubr_updated_at ON user_branch_roles;
CREATE TRIGGER trg_ubr_updated_at
  BEFORE UPDATE ON user_branch_roles
  FOR EACH ROW EXECUTE FUNCTION set_ubr_updated_at();

-- 4. Backfill existing users (each user's current role+branch → primary)
INSERT INTO user_branch_roles (user_id, branch_id, role, is_primary)
SELECT
  id,
  branch_id,         -- may be NULL for global roles
  role,
  true               -- mark as primary
FROM users
WHERE role IS NOT NULL
  AND role NOT IN ('guest')
ON CONFLICT (user_id, branch_id, role) DO NOTHING;

-- 5. RLS (Row Level Security)
ALTER TABLE user_branch_roles ENABLE ROW LEVEL SECURITY;

-- All roles that currently have cross-branch (global) access can manage role assignments.
-- Sources:
--   branchIsolation.ts -> isGlobalRole()          : super_admin, general_manager, hr_manager, central_storekeeper, auditor
--   auth.controller.ts -> UNIVERSAL_ROLES          : + director
--   branch-context.tsx -> canAccessAllBranches()   : + accountant, branch_operations_manager, facilities_manager
CREATE POLICY ubr_admin_all ON user_branch_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN (
          'super_admin',
          'general_manager',
          'director',
          'hr_manager',
          'central_storekeeper',
          'auditor',
          'accountant',
          'branch_operations_manager',
          'facilities_manager'
        )
    )
  );

-- Users can read their own role assignments (for context selector)
CREATE POLICY ubr_self_read ON user_branch_roles
  FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- Helper view: enriched role assignments with branch names
-- ============================================================
CREATE OR REPLACE VIEW user_branch_roles_view AS
SELECT
  ubr.id,
  ubr.user_id,
  ubr.role,
  ubr.is_primary,
  ubr.branch_id,
  b.name  AS branch_name,
  b.code  AS branch_code
FROM user_branch_roles ubr
LEFT JOIN branches b ON b.id = ubr.branch_id;
