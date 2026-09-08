-- ============================================================================
-- Discounts & Offers — add Conference Hall targeting
-- ----------------------------------------------------------------------------
-- offers.target_type's CHECK constraint only ever allowed
-- ('menu_item', 'menu_category', 'outlet', 'room_type', 'all_rooms', 'guest')
-- — restaurant/bar items, room rates, and specific guests, but no way to
-- target a conference hall or "all conference halls" the way 'room_type' /
-- 'all_rooms' already do for rooms. Branch Manager's Discounts & Offers
-- screen now exposes those two target types; this widens the constraint to
-- accept them so INSERT/UPDATE on offers doesn't fail with a check-
-- constraint violation.
-- ============================================================================

ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_target_type_check;

ALTER TABLE offers ADD CONSTRAINT offers_target_type_check CHECK (
  target_type = ANY (ARRAY[
    'menu_item'::text,
    'menu_category'::text,
    'outlet'::text,
    'room_type'::text,
    'all_rooms'::text,
    'conference_hall'::text,
    'all_conference_halls'::text,
    'guest'::text
  ])
);
