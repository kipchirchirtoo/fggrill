-- Add rfid_tag column to staff_profiles if it doesn't exist
ALTER TABLE staff_profiles 
ADD COLUMN IF NOT EXISTS rfid_tag TEXT UNIQUE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_staff_profiles_rfid_tag ON staff_profiles(rfid_tag);
