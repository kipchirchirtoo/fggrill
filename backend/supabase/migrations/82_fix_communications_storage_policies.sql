-- Fix Communications Storage RLS Policies
-- This migration fixes the RLS policies to allow proper file uploads

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;

-- Recreate policies with correct permissions
-- Allow authenticated users to upload files to their own folder
CREATE POLICY "communications_insert_policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'communications'
);

-- Allow authenticated users to view all files in communications bucket
CREATE POLICY "communications_select_policy"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'communications');

-- Allow users to update files
CREATE POLICY "communications_update_policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'communications')
WITH CHECK (bucket_id = 'communications');

-- Allow users to delete files
CREATE POLICY "communications_delete_policy"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'communications');
