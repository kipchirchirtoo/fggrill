-- =====================================================
-- FOOD CONTROL TYPE CONFIGURATION (Phase 1)
-- Migration: 20260629_food_control_type_config.sql
-- Description: Registers the missing "Type C direct pass-through" and
-- "exempt" classifications, and adds a single lookup function that tells
-- the storekeeper UI what an item's food-control type is at issue time.
--
-- Type A (recipe BOM) already exists live: kitchen_production_recipes (180 rows).
-- Type B (yield/pool split) already exists live: pos_outlet_items.stock_pool_item_id
-- + pool_fraction, used today by real POS sales (outlet-pos.controller.ts,
-- branch-inventory.service.ts). Neither is duplicated here.
-- =====================================================

-- =====================================================
-- 1. DIRECT PASS-THROUGH REGISTRATION (Type C)
-- =====================================================
CREATE TABLE IF NOT EXISTS food_control_direct_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  stock_item_sku VARCHAR(50) NOT NULL,
  stock_item_name VARCHAR(255),
  pos_outlet_item_id UUID NOT NULL REFERENCES pos_outlet_items(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Africa/Nairobi'), -- KENYA TIME
  updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Africa/Nairobi'), -- KENYA TIME
  UNIQUE(branch_id, stock_item_sku, pos_outlet_item_id)
);

CREATE INDEX IF NOT EXISTS idx_fc_direct_items_branch ON food_control_direct_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_fc_direct_items_sku ON food_control_direct_items(branch_id, stock_item_sku);

-- =====================================================
-- 2. EXEMPT ITEMS (bar / non-food items explicitly out of scope)
-- =====================================================
CREATE TABLE IF NOT EXISTS food_control_exempt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  pos_outlet_item_id UUID NOT NULL REFERENCES pos_outlet_items(id),
  reason TEXT,
  exempted_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Africa/Nairobi'), -- KENYA TIME
  UNIQUE(branch_id, pos_outlet_item_id)
);

CREATE INDEX IF NOT EXISTS idx_fc_exempt_items_branch ON food_control_exempt_items(branch_id);

-- =====================================================
-- 3. TYPE LOOKUP FUNCTION
-- Classifies a branch stock SKU as:
--   EXEMPT          - explicitly marked out of scope
--   A_RECIPE_BOM    - consumed as an ingredient in an active kitchen_production_recipes row
--   B_YIELD_POOL    - is itself a pool parent, or a fractional item pointing at one
--   C_DIRECT        - registered as a direct 1:1 issuance pairing
--   UNREGISTERED    - sold/issued but has no food control classification yet
-- =====================================================
CREATE OR REPLACE FUNCTION get_stock_item_food_control_type(
  p_branch_id INTEGER,
  p_item_sku TEXT
) RETURNS TEXT AS $$
DECLARE
  v_type TEXT := 'UNREGISTERED';
BEGIN
  IF EXISTS (
    SELECT 1 FROM food_control_exempt_items fei
    JOIN pos_outlet_items poi ON poi.id = fei.pos_outlet_item_id
    WHERE fei.branch_id = p_branch_id AND poi.sku = p_item_sku
  ) THEN
    v_type := 'EXEMPT';
  ELSIF EXISTS (
    SELECT 1 FROM kitchen_production_recipes
    WHERE branch_id = p_branch_id AND raw_item_sku = p_item_sku AND is_active = true
  ) THEN
    v_type := 'A_RECIPE_BOM';
  ELSIF EXISTS (
    SELECT 1 FROM pos_outlet_items poi
    WHERE poi.branch_id = p_branch_id AND poi.sku = p_item_sku AND poi.stock_pool_item_id IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM pos_outlet_items pool
    JOIN pos_outlet_items frac ON frac.stock_pool_item_id = pool.id
    WHERE pool.branch_id = p_branch_id AND pool.sku = p_item_sku
  ) THEN
    v_type := 'B_YIELD_POOL';
  ELSIF EXISTS (
    SELECT 1 FROM food_control_direct_items
    WHERE branch_id = p_branch_id AND stock_item_sku = p_item_sku AND is_active = true
  ) THEN
    v_type := 'C_DIRECT';
  END IF;
  RETURN v_type;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- RLS — match existing convention (kitchen_production_recipes, branch_stock)
-- =====================================================
ALTER TABLE food_control_direct_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_control_exempt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated users"
ON food_control_direct_items FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users"
ON food_control_direct_items FOR ALL
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read for authenticated users"
ON food_control_exempt_items FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users"
ON food_control_exempt_items FOR ALL
USING (auth.role() = 'authenticated');

COMMENT ON TABLE food_control_direct_items IS 'Registered Type C direct pass-through mappings: branch stock SKU issued 1:1 into a POS outlet item, no recipe or pool conversion.';
COMMENT ON TABLE food_control_exempt_items IS 'POS outlet items explicitly excluded from food control tracking (e.g. bar items).';
COMMENT ON FUNCTION get_stock_item_food_control_type IS 'Classifies a branch stock SKU as EXEMPT / A_RECIPE_BOM / B_YIELD_POOL / C_DIRECT / UNREGISTERED for Kitchen Sessions issuance UI.';
