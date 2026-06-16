-- Migration 0011: Fix users & staff_profiles column data after DB migration
-- Problems solved:
--   1. users.employee_id missing → PaygREST errors in payroll, loans, advances, credit-bills
--   2. users.pos_pin null (data in metadata) → POS PIN login always fails
--   3. users.phone_number null (sync trigger never ran on migrated rows) → null phone in APIs
--   4. users.branch_id null for some users → branch isolation bypassed
--   5. staff_profiles.employee_id missing → report controller errors

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Add employee_id to users (was never in new schema)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS employee_id TEXT;
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON public.users(employee_id) WHERE employee_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Add employee_id to staff_profiles (alias for employee_number)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS employee_id TEXT;
CREATE INDEX IF NOT EXISTS idx_staff_profiles_employee_id ON public.staff_profiles(employee_id) WHERE employee_id IS NOT NULL;

-- Backfill staff_profiles.employee_id from employee_number
UPDATE public.staff_profiles
SET employee_id = COALESCE(employee_id, NULLIF(TRIM(employee_number), ''))
WHERE employee_id IS NULL AND employee_number IS NOT NULL AND employee_number != '';

-- Keep employee_id ↔ employee_number in sync on staff_profiles
CREATE OR REPLACE FUNCTION public._sync_staff_employee_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.employee_id IS NULL AND NEW.employee_number IS NOT NULL THEN
    NEW.employee_id := NULLIF(TRIM(NEW.employee_number), '');
  END IF;
  IF NEW.employee_number IS NULL AND NEW.employee_id IS NOT NULL THEN
    NEW.employee_number := NULLIF(TRIM(NEW.employee_id), '');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_staff_employee_id ON public.staff_profiles;
CREATE TRIGGER trg_sync_staff_employee_id
  BEFORE INSERT OR UPDATE ON public.staff_profiles
  FOR EACH ROW EXECUTE FUNCTION public._sync_staff_employee_id();

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Backfill users columns from metadata (migrated rows never had them set)
-- ────────────────────────────────────────────────────────────────────────────
UPDATE public.users
SET
  employee_id  = COALESCE(NULLIF(employee_id, ''),  NULLIF(TRIM(metadata->>'employee_id'), '')),
  pos_pin      = COALESCE(NULLIF(pos_pin, ''),       NULLIF(TRIM(metadata->>'pos_pin'), '')),
  department   = COALESCE(NULLIF(department, ''),    NULLIF(TRIM(metadata->>'department'), '')),
  avatar       = COALESCE(NULLIF(avatar, ''),        NULLIF(TRIM(metadata->>'avatar'), ''))
WHERE
  (employee_id IS NULL OR employee_id = '')
  OR (pos_pin IS NULL OR pos_pin = '')
  OR (department IS NULL OR department = '');

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Sync phone ↔ phone_number (trigger only fires on INSERT/UPDATE, not for
--    rows imported via ETL/bulk copy)
-- ────────────────────────────────────────────────────────────────────────────
UPDATE public.users
SET phone_number = phone
WHERE phone IS NOT NULL AND phone != ''
  AND (phone_number IS NULL OR phone_number = '');

UPDATE public.users
SET phone = phone_number
WHERE phone_number IS NOT NULL AND phone_number != ''
  AND (phone IS NULL OR phone = '');

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Ensure branch_id exists and is populated for non-central users
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES public.branches(id);

-- First pass: copy default_branch_id → branch_id
UPDATE public.users
SET branch_id = default_branch_id
WHERE branch_id IS NULL AND default_branch_id IS NOT NULL;

-- Second pass: derive from user_branch_roles for branch-level roles
UPDATE public.users u
SET branch_id = (
  SELECT ubr.branch_id
  FROM public.user_branch_roles ubr
  WHERE ubr.user_id = u.id
    AND ubr.branch_id IS NOT NULL
  ORDER BY ubr.is_primary DESC, ubr.created_at ASC
  LIMIT 1
)
WHERE u.branch_id IS NULL
  AND u.role NOT IN ('super_admin', 'general_manager', 'director', 'auditor',
                     'finance_manager', 'central_storekeeper')
  AND EXISTS (
    SELECT 1 FROM public.user_branch_roles ubr
    WHERE ubr.user_id = u.id AND ubr.branch_id IS NOT NULL
  );

-- Central users: branch_id should be null (they cross all branches)
UPDATE public.users
SET branch_id = NULL
WHERE role = 'central_storekeeper'
  AND default_branch_id IS NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Trigger: auto-extract metadata fields on future inserts/updates
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._sync_users_from_metadata()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.employee_id IS NULL OR NEW.employee_id = '') AND (NEW.metadata->>'employee_id') IS NOT NULL THEN
    NEW.employee_id := NULLIF(TRIM(NEW.metadata->>'employee_id'), '');
  END IF;
  IF (NEW.pos_pin IS NULL OR NEW.pos_pin = '') AND (NEW.metadata->>'pos_pin') IS NOT NULL THEN
    NEW.pos_pin := NULLIF(TRIM(NEW.metadata->>'pos_pin'), '');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_users_from_metadata ON public.users;
CREATE TRIGGER trg_sync_users_from_metadata
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public._sync_users_from_metadata();

-- ────────────────────────────────────────────────────────────────────────────
-- 7. Summary
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  pin_count   integer;
  phone_count integer;
  emp_u_count integer;
  emp_s_count integer;
BEGIN
  SELECT COUNT(*) INTO pin_count   FROM public.users WHERE pos_pin IS NOT NULL AND pos_pin != '';
  SELECT COUNT(*) INTO phone_count FROM public.users WHERE phone_number IS NOT NULL AND phone_number != '';
  SELECT COUNT(*) INTO emp_u_count FROM public.users WHERE employee_id IS NOT NULL AND employee_id != '';
  SELECT COUNT(*) INTO emp_s_count FROM public.staff_profiles WHERE employee_id IS NOT NULL AND employee_id != '';
  RAISE NOTICE 'users with pos_pin=%, phone_number=%, employee_id=%  |  staff_profiles with employee_id=%',
    pin_count, phone_count, emp_u_count, emp_s_count;
END $$;
