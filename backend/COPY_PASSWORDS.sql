-- ============================================================================
-- COPY EXISTING PASSWORD HASHES FROM auth.users TO users TABLE
-- ============================================================================
-- 
-- This SQL copies the encrypted_password from auth.users to password_hash 
-- in the users table. This allows the backend to authenticate users directly
-- from the users table without accessing auth.users.
--
-- IMPORTANT: This preserves ALL existing user passwords!
-- Users will continue to use their CURRENT passwords after this runs.
--
-- Run this in Supabase SQL Editor
-- ============================================================================

UPDATE public.users u
SET password_hash = au.encrypted_password,
    updated_at = NOW()
FROM auth.users au
WHERE u.id = au.id 
  AND au.encrypted_password IS NOT NULL
  AND (u.password_hash IS NULL OR u.password_hash = '');

-- Show results
SELECT 
  COUNT(*) as total_users_updated,
  'Password hashes copied successfully' as status
FROM public.users
WHERE password_hash IS NOT NULL;
