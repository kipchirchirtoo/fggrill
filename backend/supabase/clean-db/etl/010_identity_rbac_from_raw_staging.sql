-- Canonical identity/RBAC ETL from legacy_import.raw_rows.
-- Safe to rerun: all writes are upserts into canonical public tables.

BEGIN;

-- Branches keep their old integer IDs because application branch isolation and
-- existing JWTs use branch_id as an integer.
INSERT INTO public.branches (
  id,
  branch_code,
  name,
  legal_name,
  email,
  phone,
  address,
  city,
  country,
  is_active,
  metadata,
  created_at,
  updated_at
)
SELECT
  NULLIF(row_data->>'id', '')::integer,
  COALESCE(NULLIF(row_data->>'code', ''), 'BR-' || NULLIF((row_data->>'id'), '')),
  COALESCE(NULLIF(row_data->>'name', ''), 'Branch ' || NULLIF((row_data->>'id'), '')),
  NULLIF(row_data->>'legal_name', ''),
  NULLIF(row_data->>'email', ''),
  COALESCE(NULLIF(row_data->>'phone', ''), NULLIF(row_data->>'contact_phone', '')),
  NULLIF(row_data->>'address', ''),
  COALESCE(NULLIF(row_data->>'location', ''), NULLIF(row_data->>'city', '')),
  COALESCE(NULLIF(row_data->>'country', ''), 'Kenya'),
  COALESCE(NULLIF(row_data->>'is_active', '')::boolean, (row_data->>'status') IS DISTINCT FROM 'inactive', true),
  row_data - 'id' - 'code' - 'name' - 'legal_name' - 'email' - 'phone' - 'contact_phone' - 'address' - 'location' - 'city' - 'country' - 'is_active',
  COALESCE(NULLIF(row_data->>'created_at', '')::timestamptz, now()),
  COALESCE(NULLIF(row_data->>'updated_at', '')::timestamptz, now())
FROM legacy_import.raw_rows
WHERE table_schema = 'public'
  AND table_name = 'branches'
  AND NULLIF(row_data->>'id', '') IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
  branch_code = EXCLUDED.branch_code,
  name = EXCLUDED.name,
  legal_name = EXCLUDED.legal_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  country = EXCLUDED.country,
  is_active = EXCLUDED.is_active,
  metadata = EXCLUDED.metadata,
  updated_at = now();

SELECT setval(
  pg_get_serial_sequence('public.branches', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.branches), 1),
  true
);

WITH legacy_role_names AS (
  SELECT DISTINCT NULLIF(row_data->>'role', '') AS role_name
  FROM legacy_import.raw_rows
  WHERE table_schema = 'public'
    AND table_name IN ('users', 'user_branch_roles')
    AND NULLIF(row_data->>'role', '') IS NOT NULL
  UNION
  SELECT DISTINCT NULLIF(row_data->>'role_name', '') AS role_name
  FROM legacy_import.raw_rows
  WHERE table_schema = 'public'
    AND table_name = 'roles'
    AND NULLIF(row_data->>'role_name', '') IS NOT NULL
),
normalized_roles AS (
  SELECT
    lower(regexp_replace(role_name, '[^a-zA-Z0-9]+', '_', 'g')) AS code,
    initcap(replace(lower(regexp_replace(role_name, '[^a-zA-Z0-9]+', ' ', 'g')), '_', ' ')) AS name,
    role_name
  FROM legacy_role_names
),
deduped_roles AS (
  SELECT DISTINCT ON (code)
    code,
    name,
    role_name
  FROM normalized_roles
  WHERE code IS NOT NULL
    AND code <> ''
  ORDER BY code, role_name
)
INSERT INTO public.roles (code, name, scope, permissions, is_system)
SELECT
  code,
  name,
  CASE
    WHEN code IN ('super_admin', 'director', 'general_manager', 'auditor', 'central_storekeeper') THEN 'global'
    WHEN code LIKE '%cashier%' OR code IN ('waiter', 'waitress', 'restaurant', 'kitchen', 'pos_kitchen', 'kitchen_operations') THEN 'outlet'
    ELSE 'branch'
  END AS scope,
  jsonb_build_object(
    'source', 'legacy_user_roles',
    'legacy_role_name', role_name,
    'actions', jsonb_build_array()
  ) AS permissions,
  true
FROM deduped_roles
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  scope = EXCLUDED.scope,
  permissions = EXCLUDED.permissions,
  is_system = true,
  updated_at = now();

WITH legacy_role_names AS (
  SELECT DISTINCT NULLIF(row_data->>'role', '') AS role_name
  FROM legacy_import.raw_rows
  WHERE table_schema = 'public'
    AND table_name IN ('users', 'user_branch_roles')
    AND NULLIF(row_data->>'role', '') IS NOT NULL
  UNION
  SELECT DISTINCT NULLIF(row_data->>'role_name', '') AS role_name
  FROM legacy_import.raw_rows
  WHERE table_schema = 'public'
    AND table_name = 'roles'
    AND NULLIF(row_data->>'role_name', '') IS NOT NULL
),
desired_roles AS (
  SELECT DISTINCT
    lower(regexp_replace(role_name, '[^a-zA-Z0-9]+', '_', 'g')) AS code
  FROM legacy_role_names
  WHERE role_name IS NOT NULL
)
DELETE FROM public.roles role_row
WHERE role_row.permissions->>'source' = 'legacy_user_roles'
  AND NOT EXISTS (
    SELECT 1
    FROM desired_roles desired
    WHERE desired.code = role_row.code
  );

-- Users from legacy public.users. This preserves password_hash for the current
-- custom backend auth flow. Supabase Auth users are not inserted directly here.
INSERT INTO public.users (
  id,
  auth_user_id,
  email,
  password_hash,
  first_name,
  last_name,
  phone,
  status,
  default_branch_id,
  metadata,
  created_at,
  updated_at
)
SELECT
  NULLIF(row_data->>'id', '')::uuid,
  NULLIF(row_data->>'id', '')::uuid,
  lower(COALESCE(NULLIF(row_data->>'email', ''), 'legacy-user-' || left((row_data->>'id'), 8) || '@legacy.local')),
  NULLIF(row_data->>'password_hash', ''),
  NULLIF(row_data->>'first_name', ''),
  NULLIF(row_data->>'last_name', ''),
  COALESCE(NULLIF(row_data->>'phone_number', ''), NULLIF(row_data->>'phone', '')),
  CASE
    WHEN lower(COALESCE(row_data->>'status', 'active')) IN ('active', 'inactive', 'suspended', 'archived')
      THEN lower(COALESCE(row_data->>'status', 'active'))
    WHEN COALESCE((row_data->>'is_locked')::boolean, false) THEN 'suspended'
    ELSE 'active'
  END,
  NULLIF(row_data->>'branch_id', '')::integer,
  row_data - 'id' - 'email' - 'password_hash' - 'first_name' - 'last_name' - 'phone_number' - 'phone' - 'status' - 'branch_id',
  COALESCE(NULLIF(row_data->>'created_at', '')::timestamptz, now()),
  COALESCE(NULLIF(row_data->>'updated_at', '')::timestamptz, now())
FROM legacy_import.raw_rows
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND NULLIF(row_data->>'id', '') IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
  auth_user_id = EXCLUDED.auth_user_id,
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone,
  status = EXCLUDED.status,
  default_branch_id = EXCLUDED.default_branch_id,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- Legacy departments were mostly global. The clean schema is branch-scoped, so
-- global department definitions are replicated to every branch.
WITH legacy_departments AS (
  SELECT
    row_data,
    NULLIF(row_data->>'branch_id', '')::integer AS legacy_branch_id,
    COALESCE(NULLIF(row_data->>'name', ''), 'Department ' || (row_data->>'id')) AS department_name,
    upper(regexp_replace(COALESCE(NULLIF(row_data->>'code', ''), NULLIF(row_data->>'name', ''), row_data->>'id'), '[^a-zA-Z0-9]+', '_', 'g')) AS department_code
  FROM legacy_import.raw_rows
  WHERE table_schema = 'public'
    AND table_name = 'departments'
),
department_branches AS (
  SELECT
    b.id AS branch_id,
    ld.department_code,
    ld.department_name,
    ld.row_data
  FROM legacy_departments ld
  JOIN public.branches b
    ON ld.legacy_branch_id IS NULL OR b.id = ld.legacy_branch_id
),
deduped_department_branches AS (
  SELECT DISTINCT ON (branch_id, department_code)
    branch_id,
    department_code,
    department_name,
    row_data
  FROM department_branches
  ORDER BY branch_id, department_code, department_name
)
INSERT INTO public.departments (
  branch_id,
  code,
  name,
  department_type,
  is_stock_destination,
  is_active
)
SELECT
  branch_id,
  department_code,
  department_name,
  CASE
    WHEN lower(department_name) LIKE '%kitchen%' OR lower(department_name) LIKE '%chef%' THEN 'kitchen'
    WHEN lower(department_name) LIKE '%bar%' THEN 'bar'
    WHEN lower(department_name) LIKE '%restaurant%' OR lower(department_name) LIKE '%waiter%' THEN 'restaurant'
    WHEN lower(department_name) LIKE '%store%' THEN 'store'
    WHEN lower(department_name) LIKE '%housekeeping%' THEN 'housekeeping'
    WHEN lower(department_name) LIKE '%reception%' THEN 'reception'
    WHEN lower(department_name) LIKE '%finance%' THEN 'finance'
    ELSE 'general'
  END,
  lower(department_name) ~ '(kitchen|chef|bar|restaurant|waiter|store|housekeeping|maintenance|spa|swimming)',
  COALESCE(NULLIF(row_data->>'is_active', '')::boolean, true)
FROM deduped_department_branches
ON CONFLICT (branch_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  department_type = EXCLUDED.department_type,
  is_stock_destination = EXCLUDED.is_stock_destination,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Staff profiles preserve the old staff UUID and attach to the best matching
-- branch-scoped department.
WITH staff_rows AS (
  SELECT
    row_data,
    NULLIF(row_data->>'id', '')::uuid AS staff_id,
    NULLIF(row_data->>'user_id', '')::uuid AS legacy_user_id,
    COALESCE(NULLIF(row_data->>'branch_id', '')::integer, 1) AS branch_id,
    upper(regexp_replace(COALESCE(NULLIF(row_data->>'department', ''), 'GENERAL'), '[^a-zA-Z0-9]+', '_', 'g')) AS department_code
  FROM legacy_import.raw_rows
  WHERE table_schema = 'public'
    AND table_name = 'staff_profiles'
    AND NULLIF(row_data->>'id', '') IS NOT NULL
)
INSERT INTO public.staff_profiles (
  id,
  user_id,
  branch_id,
  department_id,
  employee_number,
  first_name,
  last_name,
  national_id,
  phone,
  email,
  job_title,
  employment_status,
  hire_date,
  metadata,
  created_at,
  updated_at
)
SELECT
  sr.staff_id,
  users.id,
  sr.branch_id,
  d.id,
  COALESCE(NULLIF(sr.row_data->>'employee_id', ''), NULLIF(sr.row_data->>'rfid_tag', ''), 'STAFF-' || left(sr.staff_id::text, 8)),
  COALESCE(NULLIF(sr.row_data->>'first_name', ''), 'Staff'),
  NULLIF(sr.row_data->>'last_name', ''),
  COALESCE(NULLIF(sr.row_data->>'national_id', ''), NULLIF(sr.row_data->>'id_number', '')),
  COALESCE(NULLIF(sr.row_data->>'phone', ''), NULLIF(sr.row_data->>'phone_number', '')),
  lower(NULLIF(sr.row_data->>'email', '')),
  COALESCE(NULLIF(sr.row_data->>'position', ''), NULLIF(sr.row_data->>'role', '')),
  CASE
    WHEN lower(COALESCE(sr.row_data->>'status', 'active')) IN ('active', 'inactive', 'terminated', 'on_leave')
      THEN lower(COALESCE(sr.row_data->>'status', 'active'))
    ELSE 'active'
  END,
  NULLIF(sr.row_data->>'start_date', '')::date,
  sr.row_data - 'id' - 'user_id' - 'branch_id' - 'employee_id' - 'first_name' - 'last_name' - 'national_id' - 'id_number' - 'phone' - 'phone_number' - 'email' - 'position' - 'role' - 'status' - 'start_date',
  COALESCE(NULLIF(sr.row_data->>'created_at', '')::timestamptz, now()),
  COALESCE(NULLIF(sr.row_data->>'updated_at', '')::timestamptz, now())
FROM staff_rows sr
LEFT JOIN public.users users
  ON users.id = sr.legacy_user_id
LEFT JOIN public.departments d
  ON d.branch_id = sr.branch_id
 AND d.code = sr.department_code
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  branch_id = EXCLUDED.branch_id,
  department_id = EXCLUDED.department_id,
  employee_number = EXCLUDED.employee_number,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  national_id = EXCLUDED.national_id,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  job_title = EXCLUDED.job_title,
  employment_status = EXCLUDED.employment_status,
  hire_date = EXCLUDED.hire_date,
  metadata = EXCLUDED.metadata,
  updated_at = now();

DELETE FROM public.users
WHERE metadata->>'source' = 'legacy_staff_profile_placeholder';

-- Branch/role assignments from legacy users.
WITH legacy_user_roles AS (
  SELECT
    NULLIF(row_data->>'id', '')::uuid AS user_id,
    NULLIF(row_data->>'branch_id', '')::integer AS branch_id,
    lower(regexp_replace(row_data->>'role', '[^a-zA-Z0-9]+', '_', 'g')) AS role_code
  FROM legacy_import.raw_rows
  WHERE table_schema = 'public'
    AND table_name = 'users'
    AND NULLIF(row_data->>'id', '') IS NOT NULL
    AND NULLIF(row_data->>'role', '') IS NOT NULL
),
resolved_user_roles AS (
  SELECT
    lur.user_id,
    CASE WHEN r.scope = 'global' THEN NULL ELSE lur.branch_id END AS branch_id,
    r.id AS role_id
  FROM legacy_user_roles lur
  JOIN public.roles r ON r.code = lur.role_code
)
INSERT INTO public.user_branch_roles (user_id, branch_id, role_id, is_primary)
SELECT user_id, branch_id, role_id, true
FROM resolved_user_roles
ON CONFLICT (user_id, branch_id, role_id) DO UPDATE SET
  is_primary = true;

-- Explicit legacy user_branch_roles rows when present.
WITH legacy_rows AS (
  SELECT
    COALESCE(NULLIF(row_data->>'user_id', '')::uuid, NULLIF(row_data->>'id', '')::uuid) AS user_id,
    NULLIF(row_data->>'branch_id', '')::integer AS branch_id,
    lower(regexp_replace(COALESCE(NULLIF(row_data->>'role', ''), NULLIF(row_data->>'role_code', '')), '[^a-zA-Z0-9]+', '_', 'g')) AS role_code
  FROM legacy_import.raw_rows
  WHERE table_schema = 'public'
    AND table_name = 'user_branch_roles'
),
resolved AS (
  SELECT
    lr.user_id,
    CASE WHEN r.scope = 'global' THEN NULL ELSE lr.branch_id END AS branch_id,
    r.id AS role_id
  FROM legacy_rows lr
  JOIN public.roles r ON r.code = lr.role_code
  WHERE lr.user_id IS NOT NULL
)
INSERT INTO public.user_branch_roles (user_id, branch_id, role_id, is_primary)
SELECT user_id, branch_id, role_id, false
FROM resolved
ON CONFLICT (user_id, branch_id, role_id) DO NOTHING;

INSERT INTO public.audit_events (
  module,
  action,
  entity_type,
  new_data,
  reason,
  severity
)
VALUES (
  'clean_database_rebuild',
  'identity_rbac_etl',
  'migration_batch',
  jsonb_build_object(
    'branches', (SELECT count(*) FROM public.branches),
    'roles', (SELECT count(*) FROM public.roles),
    'users', (SELECT count(*) FROM public.users),
    'user_branch_roles', (SELECT count(*) FROM public.user_branch_roles),
    'departments', (SELECT count(*) FROM public.departments),
    'staff_profiles', (SELECT count(*) FROM public.staff_profiles)
  ),
  'Migrated identity, branch, role, department and staff data from staged old database rows.',
  'info'
);

COMMIT;
