-- Migration to support strict payroll workflow locking

-- 1. Enhance staff_attendance with confirmation fields
ALTER TABLE staff_attendance 
ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE;

-- 2. Enhance staff_leave with locking fields
-- Locked leave records cannot be edited, signifying they've been pulled into payroll
ALTER TABLE staff_leave
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;

-- 3. Update staff_payroll with verification snapshots
ALTER TABLE staff_payroll
ADD COLUMN IF NOT EXISTS attendance_snapshot_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS leave_snapshot_verified_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_attendance_confirmed ON staff_attendance(is_confirmed);
CREATE INDEX IF NOT EXISTS idx_staff_leave_locked ON staff_leave(is_locked);
