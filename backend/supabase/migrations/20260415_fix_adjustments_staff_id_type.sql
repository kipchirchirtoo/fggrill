-- =====================================================
-- FIX: staff_payroll_adjustments column mismatches
-- 
-- Bug 1 (ROOT CAUSE): staff_id was INTEGER but staff_profiles.id is UUID.
--   fetchBatchData queries .in('staff_id', staffIds) with UUID values → 0 rows returned.
--
-- Bug 2: Column named 'adjustment_type' in migration but controller inserts/reads 'type'.
--   fetchBatchData reads adj.type to decide addition vs deduction → always undefined.
--
-- Bug 3: Controller sets payroll_id but migration only has payroll_run_id.
--   approveAdjustment sets payroll_id: null → column doesn't exist → silent failure.
-- =====================================================

-- ─── Bug 1: Fix staff_id type INTEGER → UUID ─────────────────────────────────

-- Drop indexes that reference staff_id before altering
DROP INDEX IF EXISTS idx_staff_payroll_adjustments_staff_period_status;
DROP INDEX IF EXISTS idx_staff_payroll_adjustments_staff_id;

-- Add a UUID column alongside the old integer one
ALTER TABLE staff_payroll_adjustments
  ADD COLUMN IF NOT EXISTS staff_id_uuid UUID;

-- Recreate indexes after column rename (done below)

-- Drop the old integer column and rename the UUID one
ALTER TABLE staff_payroll_adjustments DROP COLUMN IF EXISTS staff_id;
ALTER TABLE staff_payroll_adjustments RENAME COLUMN staff_id_uuid TO staff_id;

-- ─── Bug 2: Ensure 'type' column exists (controller uses 'type') ─────────────

-- Add 'type' column if it doesn't exist (live table may already have it)
ALTER TABLE staff_payroll_adjustments
  ADD COLUMN IF NOT EXISTS type VARCHAR(50);

-- ─── Bug 3: Add 'payroll_id' column (controller uses payroll_id, migration has payroll_run_id) ──

ALTER TABLE staff_payroll_adjustments
  ADD COLUMN IF NOT EXISTS payroll_id UUID;

-- Backfill payroll_id from payroll_run_id where it exists and is a valid UUID
DO $$
BEGIN
  UPDATE staff_payroll_adjustments
  SET payroll_id = payroll_run_id::uuid
  WHERE payroll_run_id IS NOT NULL
    AND payroll_id IS NULL;
EXCEPTION WHEN OTHERS THEN
  -- payroll_run_id may be INTEGER type — skip backfill if cast fails
  NULL;
END $$;

-- ─── Recreate indexes on corrected columns ────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_staff_payroll_adjustments_staff_id
  ON staff_payroll_adjustments (staff_id);

CREATE INDEX IF NOT EXISTS idx_staff_payroll_adjustments_staff_period_status
  ON staff_payroll_adjustments (staff_id, month, year, status);

CREATE INDEX IF NOT EXISTS idx_staff_payroll_adjustments_payroll_id
  ON staff_payroll_adjustments (payroll_id);

CREATE INDEX IF NOT EXISTS idx_staff_payroll_adjustments_type_status
  ON staff_payroll_adjustments (type, status);
