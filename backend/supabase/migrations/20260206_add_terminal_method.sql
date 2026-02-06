-- Migration to add 'terminal' to attendance methods
-- This fixes the check constraint violation when clocking in via the management terminal

-- Update in_method check constraint
ALTER TABLE staff_attendance DROP CONSTRAINT IF EXISTS staff_attendance_in_method_check;
ALTER TABLE staff_attendance ADD CONSTRAINT staff_attendance_in_method_check 
CHECK (in_method IN ('biometric', 'rfid', 'pin', 'manual', 'terminal'));

-- Update out_method check constraint
ALTER TABLE staff_attendance DROP CONSTRAINT IF EXISTS staff_attendance_out_method_check;
ALTER TABLE staff_attendance ADD CONSTRAINT staff_attendance_out_method_check 
CHECK (out_method IN ('biometric', 'rfid', 'pin', 'manual', 'terminal'));
