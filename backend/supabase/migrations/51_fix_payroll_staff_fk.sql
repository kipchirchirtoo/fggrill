-- Fix payroll_records.staff_id to reference staff_profiles(id) instead of users(id)
-- This is needed because staff are stored in staff_profiles without user accounts

-- Drop the existing FK constraint
ALTER TABLE payroll_records
DROP CONSTRAINT IF EXISTS payroll_records_staff_id_fkey;

-- Re-add FK pointing to staff_profiles
ALTER TABLE payroll_records
ADD CONSTRAINT payroll_records_staff_id_fkey
FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON DELETE CASCADE;

-- Also fix the unique constraint (payroll_run_id, staff_id) - should still work
-- No change needed there
