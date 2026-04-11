-- Add profile_photo column to staff_profiles table
-- This allows staff to have photos without requiring user accounts

ALTER TABLE staff_profiles 
ADD COLUMN IF NOT EXISTS profile_photo TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_staff_profiles_profile_photo ON staff_profiles(profile_photo);

-- Comment for documentation
COMMENT ON COLUMN staff_profiles.profile_photo IS 'Supabase storage path for staff profile photo (e.g., staff-photos/uuid-timestamp.jpg)';
