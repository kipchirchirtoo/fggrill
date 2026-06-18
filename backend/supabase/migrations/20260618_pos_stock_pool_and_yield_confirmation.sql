-- ============================================================
-- POS SHARED STOCK POOL + PRODUCTION YIELD CONFIRMATION
-- Created: 2026-06-18
-- Purpose:
--   1. Let multiple POS sellable items (e.g. Full / Half / Quarter
--      Chicken) share one underlying stock pool. Selling any of them
--      deducts its fraction from the pool instead of its own stock.
--   2. Distinguish Food Controls whose yield is uncertain (baking —
--      e.g. flour -> chapati) from those whose conversion is a fixed,
--      exact count (e.g. rice -> portions, chicken -> cuts). Only the
--      former needs a follow-up "confirm actual yield" step, with any
--      shortfall billed to the producing staff member immediately.
-- ============================================================

-- ============================================
-- 1. POS STOCK POOL
-- ============================================
ALTER TABLE pos_outlet_items
    ADD COLUMN IF NOT EXISTS stock_pool_item_id UUID REFERENCES pos_outlet_items(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS pool_fraction NUMERIC(10,4) NOT NULL DEFAULT 1;

COMMENT ON COLUMN pos_outlet_items.stock_pool_item_id IS
    'When set, this item has no independent stock of its own — selling it deducts pool_fraction * qty from the referenced pool item''s current_stock instead.';
COMMENT ON COLUMN pos_outlet_items.pool_fraction IS
    'Portion of the pool item one unit of this item consumes (e.g. 0.5 for Half Chicken, 0.25 for Quarter Chicken).';

CREATE INDEX IF NOT EXISTS idx_pos_outlet_items_stock_pool ON pos_outlet_items(stock_pool_item_id);

-- ============================================
-- 2. FOOD CONTROL YIELD-CONFIRMATION FLAG
-- ============================================
ALTER TABLE kitchen_production_recipes
    ADD COLUMN IF NOT EXISTS requires_yield_confirmation BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN kitchen_production_recipes.requires_yield_confirmation IS
    'TRUE for baking/yield-uncertain conversions (pastries) — requires the storekeeper to confirm actual output and bills any shortfall to the producer. FALSE for fixed/exact conversions (chicken cuts, rice portions) which finalize immediately on production.';

-- Existing preloaded standard controls: only flour-based (pastry) outputs need confirmation.
UPDATE kitchen_production_recipes
SET requires_yield_confirmation = (raw_item_sku LIKE 'FLOUR-%')
WHERE raw_item_sku IN (
    'BEEF-001', 'MBUZI-001', 'RICE-001', 'POTATO-001',
    'FLOUR-EXE-001', 'FLOUR-SR-001', 'FLOUR-AJAB-001',
    'MILK-001', 'MANAGU-001', 'CHICKEN-FULL-001'
);

-- ============================================
-- 3. ACTUAL YIELD TRACKING ON PRODUCTION RECORDS
-- ============================================
ALTER TABLE kitchen_shift_production
    ADD COLUMN IF NOT EXISTS actual_quantity NUMERIC(14,3),
    ADD COLUMN IF NOT EXISTS actual_recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS actual_recorded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS variance_quantity NUMERIC(14,3) GENERATED ALWAYS AS (actual_quantity - produced_quantity) STORED,
    ADD COLUMN IF NOT EXISTS variance_cost NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS credit_bill_id UUID REFERENCES staff_credit_bills(id) ON DELETE SET NULL;

COMMENT ON COLUMN kitchen_shift_production.produced_quantity IS
    'Expected yield computed from the Food Control conversion ratio at the time stock was issued for production.';
COMMENT ON COLUMN kitchen_shift_production.actual_quantity IS
    'Actual output physically counted by the storekeeper after production. NULL until confirmed.';
COMMENT ON COLUMN kitchen_shift_production.variance_cost IS
    'Cost of the shortfall (negative variance_quantity) billed to actual_recorded_by''s producer via credit_bill_id. NULL/0 when no shortfall.';

CREATE INDEX IF NOT EXISTS idx_kitchen_production_credit_bill ON kitchen_shift_production(credit_bill_id);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
