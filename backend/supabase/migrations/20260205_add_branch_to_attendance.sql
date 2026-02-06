-- Migration to add branch_id to staff_attendance for better filtering
ALTER TABLE staff_attendance 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_staff_attendance_branch_id ON staff_attendance(branch_id);

-- Update existing attendance records from staff_profiles
UPDATE staff_attendance sa
SET branch_id = sp.branch_id
FROM staff_profiles sp
WHERE sa.staff_id = sp.id
AND sa.branch_id IS NULL;
