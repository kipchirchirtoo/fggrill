-- ============================================
-- MANUAL MIGRATION: Add branch_id to staff_profiles
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- Dashboard -> SQL Editor -> New Query -> Paste and Run
-- ============================================

-- Step 1: Add branch_id column to staff_profiles table
ALTER TABLE staff_profiles 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);

-- Step 2: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_staff_profiles_branch_id 
ON staff_profiles(branch_id);

-- Step 3: Update existing staff profiles to have a default branch
-- This assigns all existing staff to branch 1 (or change the number as needed)
UPDATE staff_profiles 
SET branch_id = 1 
WHERE branch_id IS NULL 
AND EXISTS (SELECT 1 FROM branches WHERE id = 1);

-- Step 4: Verify the migration
SELECT 
  COUNT(*) as total_staff,
  COUNT(branch_id) as staff_with_branch,
  COUNT(*) - COUNT(branch_id) as staff_without_branch
FROM staff_profiles;

-- Step 5: View staff by branch
SELECT 
  b.id as branch_id,
  b.name as branch_name,
  COUNT(sp.id) as staff_count
FROM branches b
LEFT JOIN staff_profiles sp ON sp.branch_id = b.id
GROUP BY b.id, b.name
ORDER BY b.id;

-- ============================================
-- After running this migration:
-- 1. Restart your backend server
-- 2. Uncomment the branch_id filter in staff.controller.ts
-- 3. Staff management will now properly filter by branch
-- ============================================
