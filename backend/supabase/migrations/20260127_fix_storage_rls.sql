-- Ensure 'profile' bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile', 'profile', true)
ON CONFLICT (id) DO NOTHING;

-- DROP EXISTING POLICIES IF THEY EXIST
DROP POLICY IF EXISTS "Allow public select" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update own photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete own photos" ON storage.objects;

-- 1. Policy for viewing profile photos (Public)
CREATE POLICY "Allow public select"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile');

-- 2. Policy for uploading profile photos (Authenticated users)
-- Note: IDCardWidget uses filename like {user_id}-{timestamp}.{ext} in the root of the bucket
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile' AND
  (name LIKE auth.uid()::text || '-%')
);

-- 3. Policy for updating own profile photos
CREATE POLICY "Allow users to update own photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile' AND
  (name LIKE auth.uid()::text || '-%')
);

-- 4. Policy for deleting own profile photos
CREATE POLICY "Allow users to delete own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile' AND
  (name LIKE auth.uid()::text || '-%')
);
