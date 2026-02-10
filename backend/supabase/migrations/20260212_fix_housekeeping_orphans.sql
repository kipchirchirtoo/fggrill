-- Clean up orphans and ADD constraint correctly

-- 1. Delete orphan hk_staff_profiles that reference non-existent users
DELETE FROM hk_staff_profiles 
WHERE user_id IS NOT NULL 
  AND user_id NOT IN (SELECT id FROM users);

-- 2. Delete duplicate user_ids if any (keep the most recently updated)
-- Since we are about to add a UNIQUE constraint effectively via the 1:1 relationship
DELETE FROM hk_staff_profiles a USING hk_staff_profiles b
WHERE a.id < b.id 
  AND a.user_id = b.user_id;

-- 3. Now try to add the constraint again, explicitly
DO $$ 
BEGIN
    ALTER TABLE hk_staff_profiles DROP CONSTRAINT IF EXISTS housekeeping_staff_user_relationship;
    ALTER TABLE hk_staff_profiles DROP CONSTRAINT IF EXISTS hk_staff_profiles_user_id_fkey;

    ALTER TABLE hk_staff_profiles 
    ADD CONSTRAINT housekeeping_staff_user_relationship 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

    -- Also verify the unique constraint/index on user_id for 1:1
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'hk_staff_profiles' AND indexname = 'hk_staff_profiles_user_id_key') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS hk_staff_profiles_user_id_idx ON hk_staff_profiles(user_id);
    END IF;

EXCEPTION WHEN OTHERS THEN
    -- Do not swallow error this time, let it fail so migration tool reports it
    RAISE EXCEPTION 'Failed to fix HK relationships: %', SQLERRM;
END $$;
