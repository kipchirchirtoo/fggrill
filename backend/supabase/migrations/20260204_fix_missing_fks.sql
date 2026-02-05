-- Fix missing foreign keys for Audit Logs and Restaurant Orders
-- This addresses 500 errors regarding "Could not find a relationship" in PostgREST

-- 1. audit_logs -> users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'audit_logs_user_id_fkey'
    ) THEN
        ALTER TABLE "audit_logs" 
        ADD CONSTRAINT "audit_logs_user_id_fkey" 
        FOREIGN KEY ("user_id") 
        REFERENCES "users" ("id") 
        ON DELETE SET NULL;
    END IF;
END $$;

-- 2. restaurant_orders -> users (guest_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'restaurant_orders_guest_id_fkey'
    ) THEN
        ALTER TABLE "restaurant_orders" 
        ADD CONSTRAINT "restaurant_orders_guest_id_fkey" 
        FOREIGN KEY ("guest_id") 
        REFERENCES "users" ("id") 
        ON DELETE SET NULL;
    END IF;
END $$;

-- 3. restaurant_orders -> users (created_by)
-- Note: created_by might already reference something, but let's ensure it references users or staff_profiles. 
-- The controller doesn't seem to join on created_by, but it's good practice. 
-- The error mentioned relationship to 'users', which 'guest_id' uses in the explicit hint `guest: users!guest_id(*)`.
-- If the hint fails, it means this specific FK is missing.

-- 4. Reload PostgREST schema cache
-- This is usually done automatically by Supabase platform, but if running self-hosted:
NOTIFY pgrst, 'reload schema';
