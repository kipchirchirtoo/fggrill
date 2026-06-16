-- Clean DB ETL: identity and organization
-- Run after legacy source rows have been loaded into legacy_import.

BEGIN;

INSERT INTO public.branches (id, branch_code, name, email, phone, address, city, country, is_active, metadata, created_at, updated_at)
SELECT
  b.id::integer,
  COALESCE(NULLIF(b.code::text, ''), 'BR-' || b.id::text),
  COALESCE(NULLIF(b.name::text, ''), 'Branch ' || b.id::text),
  NULLIF(b.email::text, ''),
  NULLIF(b.phone::text, ''),
  NULLIF(b.address::text, ''),
  NULLIF(b.city::text, ''),
  COALESCE(NULLIF(b.country::text, ''), 'Kenya'),
  COALESCE((b.is_active)::boolean, true),
  to_jsonb(b) - 'id' - 'code' - 'name' - 'email' - 'phone' - 'address' - 'city' - 'country' - 'is_active' - 'created_at' - 'updated_at',
  COALESCE(b.created_at::timestamptz, NOW()),
  COALESCE(b.updated_at::timestamptz, NOW())
FROM legacy_import.branches b
ON CONFLICT (id) DO UPDATE SET
  branch_code = EXCLUDED.branch_code,
  name = EXCLUDED.name,
  updated_at = NOW();

INSERT INTO public.roles (code, name, scope, is_system)
SELECT DISTINCT
  lower(trim(role_text)) AS code,
  initcap(replace(lower(trim(role_text)), '_', ' ')) AS name,
  CASE
    WHEN lower(trim(role_text)) IN ('super_admin', 'director', 'general_manager', 'auditor', 'central_storekeeper') THEN 'global'
    ELSE 'branch'
  END AS scope,
  true
FROM (
  SELECT role::text AS role_text FROM legacy_import.users WHERE role IS NOT NULL
  UNION
  SELECT role::text AS role_text FROM legacy_import.user_branch_roles WHERE role IS NOT NULL
) roles
WHERE NULLIF(trim(role_text), '') IS NOT NULL
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.users (id, auth_user_id, email, first_name, last_name, phone, status, default_branch_id, metadata, created_at, updated_at)
SELECT
  u.id::uuid,
  NULLIF(u.auth_user_id::text, '')::uuid,
  lower(trim(u.email::text)),
  NULLIF(COALESCE(u.first_name::text, split_part(u.name::text, ' ', 1)), ''),
  NULLIF(COALESCE(u.last_name::text, regexp_replace(u.name::text, '^\S+\s*', '')), ''),
  NULLIF(u.phone::text, ''),
  CASE WHEN COALESCE(u.status::text, 'active') IN ('active', 'inactive', 'suspended', 'archived') THEN u.status::text ELSE 'active' END,
  NULLIF(u.branch_id::text, '')::integer,
  to_jsonb(u) - 'id' - 'auth_user_id' - 'email' - 'first_name' - 'last_name' - 'name' - 'phone' - 'status' - 'branch_id' - 'created_at' - 'updated_at',
  COALESCE(u.created_at::timestamptz, NOW()),
  COALESCE(u.updated_at::timestamptz, NOW())
FROM legacy_import.users u
WHERE NULLIF(trim(u.email::text), '') IS NOT NULL
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(EXCLUDED.first_name, public.users.first_name),
  last_name = COALESCE(EXCLUDED.last_name, public.users.last_name),
  updated_at = NOW();

INSERT INTO public.user_branch_roles (user_id, branch_id, role_id, is_primary, created_at)
SELECT DISTINCT
  u.id,
  COALESCE(NULLIF(lubr.branch_id::text, '')::integer, u.default_branch_id),
  r.id,
  COALESCE((lubr.is_primary)::boolean, false),
  NOW()
FROM legacy_import.user_branch_roles lubr
JOIN public.users u ON u.id = lubr.user_id::uuid
JOIN public.roles r ON r.code = lower(trim(lubr.role::text))
WHERE COALESCE(NULLIF(lubr.branch_id::text, '')::integer, u.default_branch_id) IS NOT NULL
ON CONFLICT (user_id, branch_id, role_id) DO NOTHING;

COMMIT;

