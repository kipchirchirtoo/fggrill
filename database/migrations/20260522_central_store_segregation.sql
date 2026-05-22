-- =============================================================================
-- CENTRAL STORE CATEGORY SEGREGATION: FOODSTUFFS vs BAR STORE
-- SAFE AND IDEMPOTENT MIGRATION
-- =============================================================================

BEGIN;

-- 1. Add store_type column with CHECK constraint and default 'foodstuffs'
ALTER TABLE simple_items 
ADD COLUMN IF NOT EXISTS store_type TEXT 
CHECK (store_type IN ('foodstuffs', 'bar_store')) 
DEFAULT 'foodstuffs';

-- 2. Force NOT NULL constraint on store_type column safely by setting default for NULL rows first
UPDATE simple_items 
SET store_type = 'foodstuffs' 
WHERE store_type IS NULL;

ALTER TABLE simple_items 
ALTER COLUMN store_type SET NOT NULL;

-- 3. Auto-classify existing bar items based on categories (and names)
-- Map categories like 'beverage', 'Bar Stock-Alcoholic', etc. to 'bar_store'
UPDATE simple_items 
SET store_type = 'bar_store'
WHERE LOWER(category) IN (
  'beverage', 'beverages', 'liquor', 'alcohol', 'beer', 'wine', 
  'spirits', 'bar', 'drinks', 'soft drinks', 'bar stock-alcoholic'
);

-- Additionally, auto-classify by SKU prefix pattern (FGH-BAR- or containing -BAR-)
UPDATE simple_items 
SET store_type = 'bar_store'
WHERE sku ILIKE '%-BAR-%' 
   OR sku ILIKE 'FGH-BAR-%' 
   OR sku ILIKE '%BAR%';

-- 4. Create an index on store_type for fast query filtering
CREATE INDEX IF NOT EXISTS idx_simple_items_store_type ON simple_items (store_type);

COMMIT;
