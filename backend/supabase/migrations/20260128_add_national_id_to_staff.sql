-- Add national_id column to staff_profiles
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS national_id TEXT;

-- Add constraint for national_id if not exists (optional but good for consistency)
-- ALTER TABLE staff_profiles ADD CONSTRAINT valid_national_id CHECK (char_length(national_id) >= 5 AND char_length(national_id) <= 20);

-- Update existing records if needed (setting to 'pending' or NULL)
UPDATE staff_profiles SET national_id = 'pending' WHERE national_id IS NULL;

-- Make it NOT NULL for future records if desired, but for now we'll allow NULL or 'pending'
-- For this transition, we'll keep it nullable or with a default.

COMMENT ON COLUMN staff_profiles.national_id IS 'Government-issued National Identification Number';
