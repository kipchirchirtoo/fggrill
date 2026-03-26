-- Add uniform_enabled flag to staff_profiles
ALTER TABLE staff_profiles 
ADD COLUMN IF NOT EXISTS uniform_enabled BOOLEAN DEFAULT FALSE;

-- Update existing staff who might have had uniform deductions 
-- (Optional: based on some existing criteria, but safe to default to false)
COMMENT ON COLUMN staff_profiles.uniform_enabled IS 'Indicates if the employee is enrolled in the uniform deduction policy';
