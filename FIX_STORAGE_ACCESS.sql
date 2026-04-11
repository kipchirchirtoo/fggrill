-- Fix Supabase Storage Access for Profile Photos
-- This allows public read access to the profile bucket

-- Option 1: Create a policy for public read access
CREATE POLICY IF NOT EXISTS "Public Read Access for Profile Photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile');

-- Option 2: If the above doesn't work, make the entire bucket public
-- Run this in Supabase Dashboard → Storage → profile bucket → Settings
-- Toggle "Public bucket" to ON

-- Verify the policy was created
SELECT * FROM storage.policies WHERE bucket_id = 'profile';

-- Test access (replace with actual photo path)
-- Copy this URL and test in browser:
-- https://utsvlihpudfraxzcmtle.supabase.co/storage/v1/object/public/profile/staff-photos/YOUR-PHOTO-PATH.jpg
