-- ============================================================
-- FamousGate: Add branch_id support to restaurant menu tables
-- This makes menus per-branch. NULL branch_id = global/shared item.
-- Run FIRST before the menu seed migration.
-- ============================================================

-- 1. Add branch_id to restaurant_menu_items
ALTER TABLE restaurant_menu_items
    ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;

-- 2. Add branch_id to restaurant_menu_categories (for branch-specific categories if needed)
ALTER TABLE restaurant_menu_categories
    ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;

-- 3. Indexes for fast per-branch queries
CREATE INDEX IF NOT EXISTS idx_menu_items_branch_id    ON restaurant_menu_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_branch_id ON restaurant_menu_categories(branch_id);

-- 4. Drop old UNIQUE(name) on categories (can't have same name across branches without this)
ALTER TABLE restaurant_menu_categories DROP CONSTRAINT IF EXISTS restaurant_menu_categories_name_key;

-- 5. Add new unique constraint: name is unique per branch (NULL branch = global)
CREATE UNIQUE INDEX IF NOT EXISTS uq_menu_category_name_branch
    ON restaurant_menu_categories(name, COALESCE(branch_id, 0));

-- Done. Existing items keep branch_id = NULL (global).
