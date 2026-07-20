-- =====================================================
-- CHANNEL PACKAGE MENU ITEMS
-- Migration: 20260718_channel_package_menu_items.sql
-- Description:
--   1. Defines the POS outlet menu items served by a channel package
--   2. Keeps package service definition separate from raw consumption rows
-- =====================================================

CREATE TABLE IF NOT EXISTS public.channel_package_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL
    CHECK (
      channel IN (
        'accommodation_breakfast',
        'staff_meal',
        'buffet',
        'conference_event',
        'outside_catering',
        'group_meal'
      )
    ),
  package_name VARCHAR(255) NOT NULL,
  pos_outlet_item_id UUID NOT NULL REFERENCES public.pos_outlet_items(id) ON DELETE CASCADE,
  pos_item_sku VARCHAR(100) NOT NULL,
  pos_item_name VARCHAR(255) NOT NULL,
  quantity_per_pax NUMERIC(10,4) NOT NULL DEFAULT 1 CHECK (quantity_per_pax >= 0),
  unit VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_channel_package_menu_item UNIQUE (
    branch_id,
    channel,
    package_name,
    pos_outlet_item_id
  )
);

CREATE INDEX IF NOT EXISTS idx_channel_package_menu_items_branch_channel_package
  ON public.channel_package_menu_items(branch_id, channel, package_name);

ALTER TABLE public.channel_package_menu_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'channel_package_menu_items'
      AND policyname = 'channel_package_menu_items_select'
  ) THEN
    CREATE POLICY "channel_package_menu_items_select"
    ON public.channel_package_menu_items
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'channel_package_menu_items'
      AND policyname = 'channel_package_menu_items_insert'
  ) THEN
    CREATE POLICY "channel_package_menu_items_insert"
    ON public.channel_package_menu_items
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'channel_package_menu_items'
      AND policyname = 'channel_package_menu_items_update'
  ) THEN
    CREATE POLICY "channel_package_menu_items_update"
    ON public.channel_package_menu_items
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'channel_package_menu_items'
      AND policyname = 'channel_package_menu_items_delete'
  ) THEN
    CREATE POLICY "channel_package_menu_items_delete"
    ON public.channel_package_menu_items
    FOR DELETE
    TO authenticated
    USING (true);
  END IF;
END $$;
