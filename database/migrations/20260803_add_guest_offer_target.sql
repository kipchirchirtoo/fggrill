-- ──────────────────────────────────────────────────────────────────────────────
-- Migration: 20260803_add_guest_offer_target.sql
-- Purpose:   Add 'guest' as a target_type for specific checked-in guest offers
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.offers
  DROP CONSTRAINT IF EXISTS offers_target_type_check;

ALTER TABLE public.offers
  ADD CONSTRAINT offers_target_type_check
  CHECK (target_type IN (
    'menu_item', 'menu_category', 'outlet',
    'room_type', 'all_rooms', 'guest'
  ));
