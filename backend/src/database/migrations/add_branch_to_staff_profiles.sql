-- Add branch_id column to staff_profiles table
ALTER TABLE staff_profiles 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_staff_profiles_branch_id ON staff_profiles(branch_id);

-- Update existing staff profiles to have a default branch (branch 1 or 2)
-- This is a temporary fix - you should update these manually to the correct branches
UPDATE staff_profiles 
SET branch_id = 1 
WHERE branch_id IS NULL 
AND EXISTS (SELECT 1 FROM branches WHERE id = 1);
