-- =====================================================
-- AUTO-APPROVE STAFF ATTENDANCE RECORDS
-- =====================================================
-- This migration ensures all staff attendance records are auto-approved
-- No manual approval required - saves time for auditors

-- 1. Update the default value for is_approved to TRUE (if not already)
ALTER TABLE staff_attendance 
  ALTER COLUMN is_approved SET DEFAULT true;

-- 2. Auto-approve all existing pending attendance records
UPDATE staff_attendance 
SET 
  is_approved = true,
  updated_at = NOW()
WHERE is_approved = false OR is_approved IS NULL;

-- 3. Create a trigger to auto-approve new attendance records on insert
CREATE OR REPLACE FUNCTION auto_approve_attendance()
RETURNS TRIGGER AS $$
BEGIN
  -- Always set is_approved to true for new records
  NEW.is_approved := true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trigger_auto_approve_attendance ON staff_attendance;

-- Create the trigger
CREATE TRIGGER trigger_auto_approve_attendance
  BEFORE INSERT ON staff_attendance
  FOR EACH ROW
  EXECUTE FUNCTION auto_approve_attendance();

-- 4. Add a comment to document this behavior
COMMENT ON COLUMN staff_attendance.is_approved IS 
  'Auto-approved by default. All attendance records are automatically approved to reduce auditor workload.';

-- 5. Log the change
DO $$
BEGIN
  RAISE NOTICE 'Staff attendance auto-approval enabled. All records will be automatically approved.';
END $$;
