
-- Add profile_photo to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_photo TEXT;
