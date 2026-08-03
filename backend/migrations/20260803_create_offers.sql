-- ============================================================================
-- Discounts & Offers
-- ----------------------------------------------------------------------------
-- Branch-manager-defined promotions. An offer discounts either POS menu items
-- (restaurant / bar) or room rates. Active offers are surfaced at the POS till
-- as an "OFFER" tag (auto-applied to matching items) and flow through to the
-- customer bill / receipt.
--
-- Targeting (target_type):
--   menu_item      -> a single restaurant/bar item  (item_kind + target_id = item uuid)
--   menu_category  -> every item in a category       (item_kind + target_id = category id)
--   outlet         -> the whole restaurant OR bar    (item_kind, target_id NULL)
--   room_type      -> a specific room type           (target_id = room_type id)
--   all_rooms      -> every room in the branch        (target_id NULL)
--
-- Discount value (discount_type):
--   percentage -> discount_value is a percent off (0-100)
--   fixed      -> discount_value is a flat KES amount off
--
-- target_label is a denormalised human-readable name (e.g. "Deluxe Room",
-- "Cocktails", "Whole Restaurant") captured at creation so the POS/bill tag and
-- the management list render without extra joins.
-- ============================================================================

CREATE TABLE IF NOT EXISTS offers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id      INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT,

  -- discount value
  discount_type  TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(12, 2) NOT NULL CHECK (discount_value >= 0),

  -- what the offer applies to
  target_type    TEXT NOT NULL CHECK (target_type IN
                   ('menu_item', 'menu_category', 'outlet', 'room_type', 'all_rooms')),
  item_kind      TEXT CHECK (item_kind IN ('restaurant', 'bar')),
  target_id      TEXT,
  target_label   TEXT,

  -- validity window
  is_active      BOOLEAN NOT NULL DEFAULT true,
  starts_on      DATE,
  ends_on        DATE,

  -- audit
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offers_branch_active_idx
  ON offers (branch_id, is_active);

CREATE INDEX IF NOT EXISTS offers_target_idx
  ON offers (target_type, item_kind, target_id);
