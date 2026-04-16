-- =====================================================
-- FIX: adjustment_status enum missing values + missing columns
--
-- Live table only has enum values: pending, applied, cancelled
-- Controllers try to set: approved, rejected → fails silently
-- Missing columns: approved_by, approved_at, rejected_by, rejected_at, rejection_reason
-- =====================================================

-- Add missing enum values (safe — IF NOT EXISTS equivalent via DO block)
DO $$
BEGIN
  ALTER TYPE adjustment_status ADD VALUE IF NOT EXISTS 'approved';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE adjustment_status ADD VALUE IF NOT EXISTS 'rejected';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add missing columns that the controller tries to set
ALTER TABLE staff_payroll_adjustments
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Backfill: mark all existing 'pending' adjustments as 'approved'
-- (they were created with intent to be approved but the enum blocked it)
UPDATE staff_payroll_adjustments
SET
  status = 'approved',
  approved_by = created_by,
  approved_at = updated_at
WHERE status = 'pending'
  AND staff_id IS NOT NULL;
