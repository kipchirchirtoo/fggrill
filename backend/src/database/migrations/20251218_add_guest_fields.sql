-- Add missing fields to guest_profiles
ALTER TABLE guest_profiles 
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Kenya',
ADD COLUMN IF NOT EXISTS date_of_birth DATE;
