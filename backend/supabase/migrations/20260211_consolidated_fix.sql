-- Consolidation Fix for Staff and Housekeeping Schema Mismatches
-- Created: 2026-02-10

-- 1. Fix staff_profiles: Add missing columns required by the backend
ALTER TABLE staff_profiles 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS position TEXT;

-- 2. Fix hk_staff_profiles: Add missing columns required by modular HK controllers
ALTER TABLE hk_staff_profiles 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS national_id TEXT;

-- 3. Backfill staff_profiles from users table (where linked)
DO $$ 
BEGIN
    UPDATE staff_profiles sp
    SET first_name = u.first_name,
        last_name = u.last_name,
        email = u.email,
        phone = u.phone_number
    FROM users u
    WHERE sp.user_id = u.id
      AND sp.email IS NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error backfilling staff_profiles: %', SQLERRM;
END $$;

-- 4. Backfill hk_staff_profiles from users table (where linked)
DO $$ 
BEGIN
    UPDATE hk_staff_profiles sp
    SET first_name = u.first_name,
        last_name = u.last_name,
        email = u.email,
        phone = u.phone_number
    FROM users u
    WHERE sp.user_id = u.id
      AND sp.email IS NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error backfilling hk_staff_profiles: %', SQLERRM;
END $$;

-- 5. Ensure hk_staff_profiles has explicit foreign key to users
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hk_staff_profiles' AND column_name = 'user_id') THEN
        ALTER TABLE hk_staff_profiles ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Drop and recreate the foreign key to ensure it's detectable and has a standard name
DO $$
BEGIN
    ALTER TABLE hk_staff_profiles DROP CONSTRAINT IF EXISTS hk_staff_profiles_user_id_fkey;
    
    ALTER TABLE hk_staff_profiles 
    ADD CONSTRAINT hk_staff_profiles_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error fixing hk_staff_profiles foreign key: %', SQLERRM;
END $$;

-- 6. Fix hk_tasks relationship to hk_staff_profiles
DO $$
BEGIN
    ALTER TABLE hk_tasks DROP CONSTRAINT IF EXISTS hk_tasks_assigned_to_fkey;
    ALTER TABLE hk_tasks 
    ADD CONSTRAINT hk_tasks_assigned_to_fkey 
    FOREIGN KEY (assigned_to) REFERENCES hk_staff_profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error fixing hk_tasks assigned_to foreign key: %', SQLERRM;
END $$;

DO $$
BEGIN
    ALTER TABLE hk_tasks DROP CONSTRAINT IF EXISTS hk_tasks_completed_by_fkey;
    ALTER TABLE hk_tasks 
    ADD CONSTRAINT hk_tasks_completed_by_fkey 
    FOREIGN KEY (completed_by) REFERENCES hk_staff_profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error fixing hk_tasks completed_by foreign key: %', SQLERRM;
END $$;

-- 7. Add indexes for performance and relationship discovery
CREATE INDEX IF NOT EXISTS idx_staff_profiles_email ON staff_profiles(email);
CREATE INDEX IF NOT EXISTS idx_hk_staff_profiles_email ON hk_staff_profiles(email);
CREATE INDEX IF NOT EXISTS idx_hk_staff_profiles_user_id ON hk_staff_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_assigned_to ON hk_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_completed_by ON hk_tasks(completed_by);
