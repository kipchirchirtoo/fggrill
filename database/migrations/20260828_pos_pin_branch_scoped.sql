-- =====================================================
-- BRANCH-SCOPED POS PIN UNIQUENESS (Phase 2)
-- Migration: 20260828_pos_pin_branch_scoped.sql
-- Description:
--   Flips users.pos_pin uniqueness from GLOBAL to PER-BRANCH so the same POS
--   PIN can exist in different branches.
--
--   Safety: this only RELAXES the DB constraint (still unique WITHIN a branch).
--   It is safe to apply immediately because:
--     * Every existing pos_pin is already globally unique (old index), so the
--       new (branch_id, pos_pin) index builds without conflict.
--     * The application keeps a GLOBAL uniqueness guard on PIN assignment while
--       the POS_BRANCH_SCOPED_PINS feature flag is OFF, so no cross-branch
--       duplicate can actually be created until branch-aware terminals are live.
--     * POS login rejects an ambiguous (multi-branch) PIN rather than guessing.
-- =====================================================

DROP INDEX IF EXISTS idx_users_pos_pin_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_branch_pos_pin_unique
  ON users (branch_id, pos_pin)
  WHERE pos_pin IS NOT NULL;

COMMENT ON INDEX idx_users_branch_pos_pin_unique IS
  'POS PIN is unique per branch (branch-scoped). Cross-branch reuse is allowed; the app + branch-aware terminal login keep it unambiguous.';
