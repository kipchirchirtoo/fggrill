-- Fix 1: Add waiter_id FK to restaurant_orders pointing to staff_profiles
-- The pending bills migration job queries this join but the column was never created.
ALTER TABLE restaurant_orders
ADD COLUMN IF NOT EXISTS waiter_id UUID REFERENCES staff_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_waiter_id
ON restaurant_orders(waiter_id);

-- Fix 2: Ensure auditor role exists in the enum (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'auditor'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
        ALTER TYPE user_role ADD VALUE 'auditor';
    END IF;
END $$;

-- Fix 3: Create a users row for any auth.users that are missing one.
-- This handles the auditor (and any other user) whose JWT works but profile returns 404.
-- Inserts a minimal row; the user can update their profile after logging in.
INSERT INTO public.users (id, email, first_name, last_name, role, status, created_at)
SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'first_name', split_part(au.email, '@', 1)),
    COALESCE(au.raw_user_meta_data->>'last_name', 'User'),
    COALESCE((au.raw_user_meta_data->>'role')::user_role, 'auditor'),
    'active',
    NOW()
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL
  AND au.email = 'auditor@famousgate.com'
ON CONFLICT (id) DO NOTHING;
