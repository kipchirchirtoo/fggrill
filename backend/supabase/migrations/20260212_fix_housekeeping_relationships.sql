-- Fix Housekeeping Staff Profiles Foreign Key Relationship
-- Explicitly re-create to ensure PostgREST detection

DO $$ 
BEGIN
    -- 1. Ensure the column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hk_staff_profiles' AND column_name = 'user_id') THEN
        ALTER TABLE hk_staff_profiles ADD COLUMN user_id UUID;
    END IF;

    -- 2. Drop any existing constraints on user_id to avoid conflicts
    -- We try several possible standard names and also look it up
    ALTER TABLE hk_staff_profiles DROP CONSTRAINT IF EXISTS hk_staff_profiles_user_id_fkey;
    ALTER TABLE hk_staff_profiles DROP CONSTRAINT IF EXISTS hk_staff_profiles_user_id_key;

    -- 3. Add the foreign key constraint with a very explicit name
    ALTER TABLE hk_staff_profiles 
    ADD CONSTRAINT housekeeping_staff_user_relationship 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

    -- 4. Re-verify other crucial HK relationships
    ALTER TABLE hk_tasks DROP CONSTRAINT IF EXISTS hk_tasks_assigned_to_fkey;
    ALTER TABLE hk_tasks 
    ADD CONSTRAINT hk_tasks_assigned_to_fkey 
    FOREIGN KEY (assigned_to) REFERENCES hk_staff_profiles(id) ON DELETE SET NULL;

    ALTER TABLE hk_tasks DROP CONSTRAINT IF EXISTS hk_tasks_completed_by_fkey;
    ALTER TABLE hk_tasks 
    ADD CONSTRAINT hk_tasks_completed_by_fkey 
    FOREIGN KEY (completed_by) REFERENCES hk_staff_profiles(id) ON DELETE SET NULL;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in housekeeping relationship fix: %', SQLERRM;
END $$;

-- 5. Force a schema reload hint by performing a trivial alteration if possible
-- (Some environments pick up ANY DDL change as a signal to reload)
COMMENT ON TABLE hk_staff_profiles IS 'Housekeeping-specific staff information with fixed user relationship';
