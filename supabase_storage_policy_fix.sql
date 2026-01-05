-- Fix Supabase Storage RLS Policies for room-images bucket
-- This allows authenticated users to upload, read, and delete room images

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated uploads to room-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to room-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from room-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update to room-images" ON storage.objects;

-- Create policy to allow authenticated users to upload images
CREATE POLICY "Allow authenticated uploads to room-images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'room-images');

-- Create policy to allow public read access to room images
CREATE POLICY "Allow public read access to room-images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'room-images');

-- Create policy to allow authenticated users to update images
CREATE POLICY "Allow authenticated update to room-images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'room-images')
WITH CHECK (bucket_id = 'room-images');

-- Create policy to allow authenticated users to delete images
CREATE POLICY "Allow authenticated delete from room-images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'room-images');

-- Ensure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('room-images', 'room-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;
