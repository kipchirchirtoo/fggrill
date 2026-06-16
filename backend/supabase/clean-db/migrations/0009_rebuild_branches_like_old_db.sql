-- ================================================================
-- Migration 0009: Rebuild Branch Master to Match Old DB IDs
--
-- Purpose:
--   - public.branches.id is the branch id, as integer values 1-10.
--   - public.branches.code stores KYO, BTN, KPL, etc.
--   - Remove confusing text branch_id / branch_code columns from branches.
--
-- Important:
--   This does not touch branch_id columns in other tables. Those remain
--   integer foreign keys pointing to public.branches(id).
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.branches DROP CONSTRAINT IF EXISTS branches_branch_code_key;
DROP INDEX IF EXISTS public.branches_branch_code_key;
DROP INDEX IF EXISTS public.branches_branch_code_uidx;
DROP INDEX IF EXISTS public.branches_code_uidx;

ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS manager_id UUID;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS is_main_branch BOOLEAN DEFAULT false;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS is_central_warehouse BOOLEAN DEFAULT false;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS can_create_items BOOLEAN DEFAULT false;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS can_dispatch BOOLEAN DEFAULT false;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS warehouse_capacity INTEGER DEFAULT 0;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS branch_type TEXT DEFAULT 'hotel';
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS number_of_rooms INTEGER DEFAULT 0;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Nairobi';
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'KES';
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS opening_date DATE;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS default_till_number TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'branches'
      AND column_name = 'branch_code'
  ) THEN
    UPDATE public.branches
    SET code = COALESCE(NULLIF(code, ''), NULLIF(branch_code, ''))
    WHERE code IS NULL OR code = '';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'branches'
      AND column_name = 'branch_id'
  ) THEN
    UPDATE public.branches
    SET code = COALESCE(NULLIF(code, ''), NULLIF(branch_id::text, ''))
    WHERE code IS NULL OR code = '';
  END IF;
END $$;

ALTER TABLE public.branches DROP COLUMN IF EXISTS branch_id;
ALTER TABLE public.branches DROP COLUMN IF EXISTS branch_code;
ALTER TABLE public.branches ALTER COLUMN updated_at DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.branches'::regclass
      AND tgname = 'trg_branches_updated_at'
      AND NOT tgisinternal
  ) THEN
    ALTER TABLE public.branches DISABLE TRIGGER trg_branches_updated_at;
  END IF;
END $$;

INSERT INTO public.branches (
  id, name, code, location, address, phone, email, manager_id,
  is_main_branch, status, created_at, updated_at, is_central_warehouse,
  can_create_items, can_dispatch, warehouse_capacity, contact_person,
  branch_type, number_of_rooms, settings, timezone, currency, logo_url,
  opening_date, default_till_number, is_active, legal_name, city, country,
  metadata
) VALUES
  (1, 'Kyogong', 'KYO', 'BOMET', NULL, NULL, NULL, NULL, true, 'active', '2025-11-26T20:19:29.631Z', '2026-03-02T11:57:58.685Z', true, false, false, 0, NULL, 'hotel', 0, '{}'::jsonb, 'Africa/Nairobi', 'KES', NULL, NULL, NULL, true, 'Kyogong', 'BOMET', 'Kenya', '{"legacy_branch_id":1}'::jsonb),
  (2, 'BOMET TOWN', 'BTN', 'BOMET', NULL, NULL, NULL, NULL, false, 'active', '2025-11-26T20:19:29.631Z', NULL, false, false, false, 0, NULL, 'hotel', 0, '{}'::jsonb, 'Africa/Nairobi', 'KES', NULL, NULL, NULL, true, 'BOMET TOWN', 'BOMET', 'Kenya', '{"legacy_branch_id":2}'::jsonb),
  (3, 'KAPLONG', 'KPL', 'BOMET', NULL, NULL, NULL, NULL, false, 'active', '2025-11-26T20:19:29.631Z', NULL, false, false, false, 0, NULL, 'hotel', 0, '{}'::jsonb, 'Africa/Nairobi', 'KES', NULL, NULL, NULL, true, 'KAPLONG', 'BOMET', 'Kenya', '{"legacy_branch_id":3}'::jsonb),
  (4, 'SOTIK', 'STK', 'BOMET', NULL, NULL, NULL, NULL, false, 'active', '2025-11-26T20:19:29.631Z', NULL, false, false, false, 0, NULL, 'hotel', 0, '{}'::jsonb, 'Africa/Nairobi', 'KES', NULL, NULL, NULL, true, 'SOTIK', 'BOMET', 'Kenya', '{"legacy_branch_id":4}'::jsonb),
  (5, 'MOGOGOSHIEK', 'MOG', 'BOMET', NULL, NULL, NULL, NULL, false, 'active', '2025-11-26T20:19:29.631Z', NULL, false, false, false, 0, NULL, 'hotel', 0, '{}'::jsonb, 'Africa/Nairobi', 'KES', NULL, NULL, NULL, true, 'MOGOGOSHIEK', 'BOMET', 'Kenya', '{"legacy_branch_id":5}'::jsonb),
  (6, 'KAPTOTE', 'KPT', 'KERICHO', NULL, NULL, NULL, NULL, false, 'active', '2025-11-26T20:19:29.631Z', NULL, false, false, false, 0, NULL, 'hotel', 0, '{}'::jsonb, 'Africa/Nairobi', 'KES', NULL, NULL, NULL, true, 'KAPTOTE', 'KERICHO', 'Kenya', '{"legacy_branch_id":6}'::jsonb),
  (7, 'LITEIN', 'LIT', 'KERICHO', NULL, NULL, NULL, NULL, false, 'active', '2025-11-28T13:49:42.520Z', NULL, false, false, false, 0, NULL, 'hotel', 0, '{}'::jsonb, 'Africa/Nairobi', 'KES', NULL, NULL, NULL, true, 'LITEIN', 'KERICHO', 'Kenya', '{"legacy_branch_id":7}'::jsonb),
  (8, 'KAPSOIT', 'KST', 'KERICHO', NULL, NULL, NULL, NULL, false, 'active', '2026-02-02T09:05:27.114Z', NULL, false, false, false, 0, NULL, 'hotel', 0, '{}'::jsonb, 'Africa/Nairobi', 'KES', NULL, NULL, NULL, true, 'KAPSOIT', 'KERICHO', 'Kenya', '{"legacy_branch_id":8}'::jsonb),
  (9, 'GRILL', 'GRL', 'KERICHO', NULL, NULL, NULL, NULL, true, 'active', '2025-12-26T06:41:13.789Z', NULL, false, false, false, 0, NULL, 'hotel', 0, '{}'::jsonb, 'Africa/Nairobi', 'KES', NULL, NULL, NULL, true, 'GRILL', 'KERICHO', 'Kenya', '{"legacy_branch_id":9}'::jsonb),
  (10, 'GUESTHOUSE', 'GHS', 'KERICHO', NULL, NULL, NULL, NULL, false, 'active', '2025-12-26T06:41:13.789Z', NULL, false, false, false, 0, NULL, 'hotel', 0, '{}'::jsonb, 'Africa/Nairobi', 'KES', NULL, NULL, NULL, true, 'GUESTHOUSE', 'KERICHO', 'Kenya', '{"legacy_branch_id":10}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  location = EXCLUDED.location,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  manager_id = EXCLUDED.manager_id,
  is_main_branch = EXCLUDED.is_main_branch,
  status = EXCLUDED.status,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at,
  is_central_warehouse = EXCLUDED.is_central_warehouse,
  can_create_items = EXCLUDED.can_create_items,
  can_dispatch = EXCLUDED.can_dispatch,
  warehouse_capacity = EXCLUDED.warehouse_capacity,
  contact_person = EXCLUDED.contact_person,
  branch_type = EXCLUDED.branch_type,
  number_of_rooms = EXCLUDED.number_of_rooms,
  settings = EXCLUDED.settings,
  timezone = EXCLUDED.timezone,
  currency = EXCLUDED.currency,
  logo_url = EXCLUDED.logo_url,
  opening_date = EXCLUDED.opening_date,
  default_till_number = EXCLUDED.default_till_number,
  is_active = EXCLUDED.is_active,
  legal_name = EXCLUDED.legal_name,
  city = EXCLUDED.city,
  country = EXCLUDED.country,
  metadata = COALESCE(public.branches.metadata, '{}'::jsonb) || EXCLUDED.metadata;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.branches'::regclass
      AND tgname = 'trg_branches_updated_at'
      AND NOT tgisinternal
  ) THEN
    ALTER TABLE public.branches ENABLE TRIGGER trg_branches_updated_at;
  END IF;
END $$;

UPDATE public.branches
SET status = 'inactive',
    is_active = false,
    updated_at = now()
WHERE id NOT BETWEEN 1 AND 10;

ALTER TABLE public.branches ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.branches ALTER COLUMN code SET NOT NULL;
ALTER TABLE public.branches ALTER COLUMN location SET NOT NULL;
ALTER TABLE public.branches ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE public.branches ALTER COLUMN is_main_branch SET DEFAULT false;
ALTER TABLE public.branches ALTER COLUMN is_central_warehouse SET DEFAULT false;
ALTER TABLE public.branches ALTER COLUMN can_create_items SET DEFAULT false;
ALTER TABLE public.branches ALTER COLUMN can_dispatch SET DEFAULT false;
ALTER TABLE public.branches ALTER COLUMN warehouse_capacity SET DEFAULT 0;
ALTER TABLE public.branches ALTER COLUMN branch_type SET DEFAULT 'hotel';
ALTER TABLE public.branches ALTER COLUMN number_of_rooms SET DEFAULT 0;
ALTER TABLE public.branches ALTER COLUMN settings SET DEFAULT '{}'::jsonb;
ALTER TABLE public.branches ALTER COLUMN timezone SET DEFAULT 'Africa/Nairobi';
ALTER TABLE public.branches ALTER COLUMN currency SET DEFAULT 'KES';
ALTER TABLE public.branches ALTER COLUMN is_active SET DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'branches_status_check'
      AND conrelid = 'public.branches'::regclass
  ) THEN
    ALTER TABLE public.branches
      ADD CONSTRAINT branches_status_check
      CHECK (status IN ('active', 'inactive', 'under_maintenance', 'under_renovation', 'coming_soon', 'closed'));
  END IF;
END $$;

DO $$
DECLARE
  is_identity TEXT;
BEGIN
  SELECT attidentity INTO is_identity
  FROM pg_attribute
  WHERE attrelid = 'public.branches'::regclass
    AND attname = 'id'
    AND NOT attisdropped;

  IF COALESCE(is_identity, '') = '' THEN
    CREATE SEQUENCE IF NOT EXISTS public.branches_id_seq;
    ALTER TABLE public.branches
      ALTER COLUMN id SET DEFAULT nextval('public.branches_id_seq'::regclass);
    ALTER SEQUENCE public.branches_id_seq OWNED BY public.branches.id;
    PERFORM setval('public.branches_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM public.branches), 10), true);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS branches_code_key ON public.branches(code);
CREATE INDEX IF NOT EXISTS idx_branches_code ON public.branches(code);
CREATE INDEX IF NOT EXISTS idx_branches_is_active ON public.branches(is_active);
CREATE INDEX IF NOT EXISTS idx_branches_name ON public.branches(name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_central_warehouse
  ON public.branches(is_central_warehouse)
  WHERE is_central_warehouse = true;
