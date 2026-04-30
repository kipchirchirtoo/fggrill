-- ============================================================================
-- COMMUNICATIONS STORAGE FIX - RUN THIS IN SUPABASE SQL EDITOR
-- ============================================================================
-- This script fixes the RLS policies blocking file uploads
-- Run this entire script in your Supabase Dashboard > SQL Editor
-- ============================================================================

-- Step 1: Check if bucket exists, create if not
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'communications',
  'communications',
  true,
  10485760, -- 10MB limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ];

-- Step 2: Drop ALL existing policies for communications bucket
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage'
        AND policyname LIKE '%communication%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_record.policyname);
    END LOOP;
END $$;

-- Also drop by exact names
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "communications_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "communications_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "communications_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "communications_delete_policy" ON storage.objects;

-- Step 3: Create new permissive policies for PUBLIC bucket
-- Since bucket is public, allow anon role to upload
CREATE POLICY "communications_insert_policy"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'communications');

-- Allow public to SELECT/view files (bucket is public)
CREATE POLICY "communications_select_policy"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'communications');

-- Allow public to UPDATE files
CREATE POLICY "communications_update_policy"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'communications')
WITH CHECK (bucket_id = 'communications');

-- Allow public to DELETE files
CREATE POLICY "communications_delete_policy"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'communications');

-- Step 4: Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 5: Verify the policies were created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%communication%'
ORDER BY policyname;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
-- If you see 4 policies listed above (insert, select, update, delete),
-- the fix was successful! Try uploading a file again.
-- ============================================================================
