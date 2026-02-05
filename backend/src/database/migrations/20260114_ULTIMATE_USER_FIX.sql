-- COMPREHENSIVE FIX: User Creation & Kitchen Operations Roles
-- Migration: 20260114_ultimate_user_fix.sql
-- Created: 2026-01-14

-- Helper function to add enum value if missing
CREATE OR REPLACE FUNCTION add_role_if_missing(role_name TEXT) 
RETURNS VOID AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = role_name 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
        EXECUTE format('ALTER TYPE user_role ADD VALUE %L', role_name);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- PART 1: ADD ALL MISSING ROLES TO ENUM
DO $$
BEGIN
    -- List of roles to ensure exist
    PERFORM add_role_if_missing('general_manager');
    PERFORM add_role_if_missing('branch_manager');
    PERFORM add_role_if_missing('front_desk_supervisor');
    PERFORM add_role_if_missing('concierge');
    PERFORM add_role_if_missing('bell_captain');
    PERFORM add_role_if_missing('bellhop');
    PERFORM add_role_if_missing('housekeeping_supervisor');
    PERFORM add_role_if_missing('room_attendant');
    PERFORM add_role_if_missing('laundry_attendant');
    PERFORM add_role_if_missing('restaurant_manager');
    PERFORM add_role_if_missing('head_chef');
    PERFORM add_role_if_missing('sous_chef');
    PERFORM add_role_if_missing('line_cook');
    PERFORM add_role_if_missing('prep_cook');
    PERFORM add_role_if_missing('waiter');
    PERFORM add_role_if_missing('waitress');
    PERFORM add_role_if_missing('head_waiter');
    PERFORM add_role_if_missing('bartender');
    PERFORM add_role_if_missing('barista');
    PERFORM add_role_if_missing('food_runner');
    PERFORM add_role_if_missing('busser');
    PERFORM add_role_if_missing('host_hostess');
    PERFORM add_role_if_missing('pos_kitchen');
    PERFORM add_role_if_missing('kitchen');
    PERFORM add_role_if_missing('kitchen_operations');
    PERFORM add_role_if_missing('kitchen_helper');
    PERFORM add_role_if_missing('dishwasher');
    PERFORM add_role_if_missing('maintenance_supervisor');
    PERFORM add_role_if_missing('electrician');
    PERFORM add_role_if_missing('plumber');
    PERFORM add_role_if_missing('hvac_technician');
    PERFORM add_role_if_missing('groundskeeper');
    PERFORM add_role_if_missing('security_supervisor');
    PERFORM add_role_if_missing('security_guard');
    PERFORM add_role_if_missing('night_auditor');
    PERFORM add_role_if_missing('branch_accountant');
    PERFORM add_role_if_missing('finance_manager');
    PERFORM add_role_if_missing('hr_manager');
    PERFORM add_role_if_missing('payroll_clerk');
    PERFORM add_role_if_missing('cashier');
    PERFORM add_role_if_missing('central_storekeeper');
    PERFORM add_role_if_missing('branch_storekeeper');
    PERFORM add_role_if_missing('branch_operations_manager');
    PERFORM add_role_if_missing('facilities_manager');
    PERFORM add_role_if_missing('employee');
END$$;

-- Clean up helper function
DROP FUNCTION add_role_if_missing(TEXT);


-- PART 2: FIX THE USER TRIGGER
-- This ensures the initial insertion satisfies the char_length(2) constraints
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta_first_name TEXT;
  meta_last_name TEXT;
BEGIN
  -- Extract names from raw_user_meta_data if available
  meta_first_name := COALESCE(new.raw_user_meta_data->>'first_name', 'User');
  meta_last_name := COALESCE(new.raw_user_meta_data->>'last_name', 'Account');

  -- Ensure minimum length of 2 characters to satisfy 'first_name_length' constraint
  IF char_length(meta_first_name) < 2 THEN
    meta_first_name := meta_first_name || ' ';
  END IF;
  
  IF char_length(meta_last_name) < 2 THEN
    meta_last_name := meta_last_name || ' ';
  END IF;

  INSERT INTO public.users (id, email, first_name, last_name, role)
  VALUES (
    new.id,
    new.email, -- already unique and non-null
    meta_first_name,
    meta_last_name,
    'guest' -- Default role, controller will update this immediately
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PART 3: RE-SYNC RLS POLICIES (optional but good for consistency)
-- Ensure 'super_admin' and 'general_manager' have wide access
DROP POLICY IF EXISTS "Super admin can view all profiles" ON users;
CREATE POLICY "Super admin can view all profiles"
  ON users FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'general_manager')));

DROP POLICY IF EXISTS "Super admin can update all profiles" ON users;
CREATE POLICY "Super admin can update all profiles"
  ON users FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'general_manager')));

-- VERIFICATION
COMMENT ON TABLE public.users IS 'Consolidated user profiles with roles and branch assignments.';
