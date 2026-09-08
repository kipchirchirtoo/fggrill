-- ============================================================================
-- Discounts & Offers — add "Specific room" targeting
-- ----------------------------------------------------------------------------
-- 'room_type' discounts a whole category of rooms (e.g. every Deluxe room);
-- there was no way to discount ONE physical room regardless of room type or
-- who's currently staying in it (distinct from 'guest', which targets a
-- specific checked-in guest's stay and moves with them if they change
-- rooms). Adds 'room_number' alongside the existing room_type/all_rooms/
-- guest options.
-- ============================================================================

ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_target_type_check;

ALTER TABLE offers ADD CONSTRAINT offers_target_type_check CHECK (
  target_type = ANY (ARRAY[
    'menu_item'::text,
    'menu_category'::text,
    'outlet'::text,
    'room_type'::text,
    'room_number'::text,
    'all_rooms'::text,
    'conference_hall'::text,
    'all_conference_halls'::text,
    'guest'::text
  ])
);
