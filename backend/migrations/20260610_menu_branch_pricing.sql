-- ============================================================================
-- Per-branch menu cost & selling price management
-- ----------------------------------------------------------------------------
-- Restaurant + bar menus are largely shared (branch_id NULL = global). To let
-- SuperAdmin set a DIFFERENT cost price and selling price per branch without
-- duplicating the whole menu, we add a per-branch override table. Branches with
-- no override fall back to the base menu price (POS keeps working unchanged).
--
-- These cost prices feed the branch accountant branch analysis and the director
-- module profitability reports (gross margin = selling - cost per item, per
-- branch).
-- ============================================================================

-- bar_drinks already has a (global) cost_price column; restaurant items do not.
ALTER TABLE restaurant_menu_items
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2);

-- Per-branch cost + selling override for any menu item (restaurant or bar).
CREATE TABLE IF NOT EXISTS menu_item_branch_pricing (
  id            BIGSERIAL PRIMARY KEY,
  item_type     TEXT NOT NULL CHECK (item_type IN ('restaurant', 'bar')),
  item_id       UUID NOT NULL,                       -- restaurant_menu_items.id | bar_drinks.id
  branch_id     INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  cost_price    NUMERIC(12, 2) NOT NULL DEFAULT 0,   -- branch buying / production cost
  selling_price NUMERIC(12, 2),                      -- NULL => use base menu price
  is_available  BOOLEAN,                             -- NULL => inherit base availability
  updated_by    UUID REFERENCES users(id),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS menu_item_branch_pricing_uniq
  ON menu_item_branch_pricing (item_type, item_id, branch_id);

CREATE INDEX IF NOT EXISTS menu_item_branch_pricing_branch_idx
  ON menu_item_branch_pricing (branch_id);
