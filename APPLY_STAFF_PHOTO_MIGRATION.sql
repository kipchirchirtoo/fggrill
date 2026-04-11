-- Run this SQL in your Supabase SQL Editor or psql
-- This adds the profile_photo column to staff_profiles table

ALTER TABLE staff_profiles 
ADD COLUMN IF NOT EXISTS profile_photo TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_staff_profiles_profile_photo ON staff_profiles(profile_photo);

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'staff_profiles' 
AND column_name = 'profile_photo';
