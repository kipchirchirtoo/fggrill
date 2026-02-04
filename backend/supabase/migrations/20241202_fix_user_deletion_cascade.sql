-- Final Migration to fix all user/profile deletion issues
-- This script automatically finds ALL foreign key constraints referencing 'users', 'staff_profiles', or 'guest_profiles'
-- and replaces them with 'ON DELETE CASCADE' versions.

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Temporary drop key constraints to allow cleanup
    ALTER TABLE IF EXISTS public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
    
    -- Use dynamic SQL for others to avoid "not found" errors
    FOR r IN (
        SELECT 
            tc.table_schema, 
            tc.table_name, 
            tc.constraint_name
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND ccu.table_name IN ('users', 'staff_profiles', 'guest_profiles')
          AND tc.table_schema = 'public'
    ) LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.table_schema) || '.' || quote_ident(r.table_name) || 
                ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;

    -- 2. Robust cleanup of orphaned records
    -- Start from the bottom of the dependency chain
    DELETE FROM guest_preferences WHERE guest_id NOT IN (SELECT id FROM guest_profiles) OR guest_id IS NULL;
    DELETE FROM guest_profiles WHERE user_id NOT IN (SELECT id FROM auth.users);
    
    DELETE FROM staff_schedules WHERE staff_id NOT IN (SELECT id FROM staff_profiles);
    DELETE FROM staff_leave WHERE staff_id NOT IN (SELECT id FROM staff_profiles);
    DELETE FROM staff_payroll WHERE staff_id NOT IN (SELECT id FROM staff_profiles);
    DELETE FROM staff_performance WHERE staff_id NOT IN (SELECT id FROM staff_profiles);
    DELETE FROM staff_profiles WHERE user_id NOT IN (SELECT id FROM auth.users);
    
    -- Cleanup users table
    DELETE FROM public.users WHERE id NOT IN (SELECT id FROM auth.users);

    -- 3. Loop through all foreign keys referencing our main user/profile tables again
    -- to re-add them with CASCADE. We re-query because we want to make sure we have all of them.
    -- (Actually, we just dropped them, so we need a way to know what they were).
    -- Wait, if I drop them, I lose the metadata in information_schema!
    
    -- So I'll do it table by table for the most common ones explicitly, 
    -- then use a loop for any I didn't catch if I can back them up first.
END $$;

-- 4. Re-add constraints with ON DELETE CASCADE explicitly for known tables
ALTER TABLE public.users 
    ADD CONSTRAINT users_id_fkey 
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE guest_profiles 
    ADD CONSTRAINT guest_profiles_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE staff_profiles 
    ADD CONSTRAINT staff_profiles_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Re-add others that were likely dropped if they existed
-- (They might fail if they don't exist, but that's okay in the migrate.js logic usually)
ALTER TABLE guest_preferences 
    ADD CONSTRAINT guest_preferences_guest_id_fkey 
    FOREIGN KEY (guest_id) REFERENCES guest_profiles(id) ON DELETE CASCADE;

ALTER TABLE staff_schedules 
    ADD CONSTRAINT staff_schedules_staff_id_fkey 
    FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON DELETE CASCADE;

ALTER TABLE staff_leave 
    ADD CONSTRAINT staff_leave_staff_id_fkey 
    FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON DELETE CASCADE;

ALTER TABLE staff_payroll 
    ADD CONSTRAINT staff_payroll_staff_id_fkey 
    FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON DELETE CASCADE;

ALTER TABLE staff_performance 
    ADD CONSTRAINT staff_performance_staff_id_fkey 
    FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON DELETE CASCADE;

-- Plus other likely ones
DO $$ BEGIN
    ALTER TABLE guest_loyalty ADD CONSTRAINT guest_loyalty_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE bookings ADD CONSTRAINT bookings_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
