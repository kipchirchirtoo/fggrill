-- =====================================================
-- CHANNEL PACKAGE DEFINITIONS
-- Migration: 20260719_channel_package_definitions.sql
-- Description:
--   Introduces one canonical package identity per branch/channel/package name
--   so Event Orders, raw package standards, and served POS package rows all
--   point to the same package definition instead of matching only by text.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.channel_package_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER NOT NULL REFERENCES public.branches(id),
  channel VARCHAR(100) NOT NULL,
  package_name VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_channel_package_definitions_branch_channel_name
  ON public.channel_package_definitions(branch_id, channel, package_name);

CREATE INDEX IF NOT EXISTS idx_channel_package_definitions_branch_channel
  ON public.channel_package_definitions(branch_id, channel);

ALTER TABLE public.channel_package_definitions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'channel_package_definitions'
      AND policyname = 'channel_package_definitions_select'
  ) THEN
    CREATE POLICY "channel_package_definitions_select"
    ON public.channel_package_definitions
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'channel_package_definitions'
      AND policyname = 'channel_package_definitions_modify'
  ) THEN
    CREATE POLICY "channel_package_definitions_modify"
    ON public.channel_package_definitions
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE public.channel_food_standards
  ADD COLUMN IF NOT EXISTS package_definition_id UUID NULL REFERENCES public.channel_package_definitions(id) ON DELETE SET NULL;

ALTER TABLE public.channel_package_menu_items
  ADD COLUMN IF NOT EXISTS package_definition_id UUID NULL REFERENCES public.channel_package_definitions(id) ON DELETE SET NULL;

ALTER TABLE public.event_orders
  ADD COLUMN IF NOT EXISTS package_definition_id UUID NULL REFERENCES public.channel_package_definitions(id) ON DELETE SET NULL;

WITH source_packages AS (
  SELECT DISTINCT branch_id, channel, package_name
  FROM public.channel_food_standards
  WHERE COALESCE(TRIM(package_name), '') <> ''
  UNION
  SELECT DISTINCT branch_id, channel, package_name
  FROM public.channel_package_menu_items
  WHERE COALESCE(TRIM(package_name), '') <> ''
)
INSERT INTO public.channel_package_definitions (branch_id, channel, package_name)
SELECT branch_id, channel, package_name
FROM source_packages
ON CONFLICT (branch_id, channel, package_name) DO NOTHING;

UPDATE public.channel_food_standards cfs
SET package_definition_id = cpd.id
FROM public.channel_package_definitions cpd
WHERE cfs.package_definition_id IS NULL
  AND cfs.branch_id = cpd.branch_id
  AND cfs.channel = cpd.channel
  AND COALESCE(TRIM(cfs.package_name), '') <> ''
  AND cfs.package_name = cpd.package_name;

UPDATE public.channel_package_menu_items cpmi
SET package_definition_id = cpd.id
FROM public.channel_package_definitions cpd
WHERE cpmi.package_definition_id IS NULL
  AND cpmi.branch_id = cpd.branch_id
  AND cpmi.channel = cpd.channel
  AND COALESCE(TRIM(cpmi.package_name), '') <> ''
  AND cpmi.package_name = cpd.package_name;

UPDATE public.event_orders eo
SET package_definition_id = cpd.id
FROM public.channel_package_definitions cpd
WHERE eo.package_definition_id IS NULL
  AND eo.branch_id = cpd.branch_id
  AND COALESCE(TRIM(eo.menu_package), '') <> ''
  AND eo.menu_package = cpd.package_name
  AND CASE
        WHEN eo.event_type = 'conference' THEN 'conference_event'
        WHEN eo.event_type = 'buffet' THEN 'buffet'
        WHEN eo.event_type = 'outside_catering' THEN 'outside_catering'
        WHEN eo.event_type = 'group_meal' THEN 'group_meal'
        ELSE ''
      END = cpd.channel;

COMMENT ON TABLE public.channel_package_definitions IS
  'Canonical package registry for channel-backed food-control packages. Event orders and standards rows point here instead of matching only by package name text.';
