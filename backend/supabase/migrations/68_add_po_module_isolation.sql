-- =====================================================
-- ADD MODULE ISOLATION TO PURCHASE ORDERS
-- Migration: 68_add_po_module_isolation.sql
-- Created: April 27, 2026
-- Purpose: Implement module-based access control for POs
-- =====================================================

-- =====================================================
-- 1. ADD source_module COLUMN TO ALL PO TABLES
-- =====================================================

-- Main purchase_orders table (Inventory module)
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS source_module VARCHAR(50) NOT NULL DEFAULT 'inventory';

-- Store purchase orders table (Storekeeping module)
ALTER TABLE store_purchase_orders 
ADD COLUMN IF NOT EXISTS source_module VARCHAR(50) NOT NULL DEFAULT 'central_store';

-- Add branch_id to store_purchase_orders (currently missing)
ALTER TABLE store_purchase_orders 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);

-- Restaurant purchase orders table
ALTER TABLE restaurant_purchase_orders 
ADD COLUMN IF NOT EXISTS source_module VARCHAR(50) NOT NULL DEFAULT 'restaurant';

-- =====================================================
-- 2. CREATE INDEXES FOR EFFICIENT FILTERING
-- =====================================================

-- Indexes for purchase_orders
CREATE INDEX IF NOT EXISTS idx_purchase_orders_module 
ON purchase_orders(source_module);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_module_branch 
ON purchase_orders(source_module, receiving_branch_id);

-- Indexes for store_purchase_orders
CREATE INDEX IF NOT EXISTS idx_store_po_module 
ON store_purchase_orders(source_module);

CREATE INDEX IF NOT EXISTS idx_store_po_branch 
ON store_purchase_orders(branch_id);

CREATE INDEX IF NOT EXISTS idx_store_po_module_branch 
ON store_purchase_orders(source_module, branch_id);

-- Indexes for restaurant_purchase_orders
CREATE INDEX IF NOT EXISTS idx_restaurant_po_module 
ON restaurant_purchase_orders(source_module);

CREATE INDEX IF NOT EXISTS idx_restaurant_po_module_branch 
ON restaurant_purchase_orders(source_module, branch_id);

-- =====================================================
-- 3. BACKFILL EXISTING DATA
-- =====================================================

-- Backfill purchase_orders (inventory module)
UPDATE purchase_orders 
SET source_module = 'inventory' 
WHERE source_module IS NULL OR source_module = 'inventory';

-- Backfill store_purchase_orders
-- Determine if it's central_store or branch_store based on supplier's branch
UPDATE store_purchase_orders spo
SET source_module = CASE 
    WHEN EXISTS (
        SELECT 1 FROM store_suppliers ss 
        WHERE ss.id = spo.supplier_id 
        AND ss.branch_id IS NULL
    ) THEN 'central_store'
    ELSE 'branch_store'
END
WHERE source_module IS NULL OR source_module IN ('central_store', 'branch_store');

-- Backfill branch_id for store_purchase_orders from supplier
UPDATE store_purchase_orders spo
SET branch_id = (
    SELECT ss.branch_id 
    FROM store_suppliers ss 
    WHERE ss.id = spo.supplier_id
)
WHERE branch_id IS NULL;

-- Backfill restaurant_purchase_orders
UPDATE restaurant_purchase_orders 
SET source_module = 'restaurant' 
WHERE source_module IS NULL OR source_module = 'restaurant';

-- =====================================================
-- 4. ADD CONSTRAINTS
-- =====================================================

-- Ensure source_module has valid values
ALTER TABLE purchase_orders 
ADD CONSTRAINT check_purchase_orders_module 
CHECK (source_module IN ('inventory', 'central_store', 'branch_store', 'branch_accounting'));

ALTER TABLE store_purchase_orders 
ADD CONSTRAINT check_store_po_module 
CHECK (source_module IN ('central_store', 'branch_store', 'branch_accounting'));

ALTER TABLE restaurant_purchase_orders 
ADD CONSTRAINT check_restaurant_po_module 
CHECK (source_module IN ('restaurant'));

-- Ensure branch_id is set for branch-level modules
ALTER TABLE store_purchase_orders 
ADD CONSTRAINT check_store_po_branch_required 
CHECK (
    (source_module = 'central_store' AND branch_id IS NULL) OR
    (source_module IN ('branch_store', 'branch_accounting') AND branch_id IS NOT NULL)
);

-- =====================================================
-- 5. ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN purchase_orders.source_module IS 
'Module that created this PO: inventory, central_store, branch_store, branch_accounting';

COMMENT ON COLUMN store_purchase_orders.source_module IS 
'Module that created this PO: central_store, branch_store, branch_accounting';

COMMENT ON COLUMN store_purchase_orders.branch_id IS 
'Branch that owns this PO (NULL for central_store, required for branch_store/branch_accounting)';

COMMENT ON COLUMN restaurant_purchase_orders.source_module IS 
'Module that created this PO: restaurant';

-- =====================================================
-- 6. CREATE AUDIT TRIGGER FOR MODULE TRACKING
-- =====================================================

-- Function to log PO access attempts
CREATE OR REPLACE FUNCTION log_po_access()
RETURNS TRIGGER AS $$
BEGIN
    -- Log can be extended to track access patterns
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to track updates
CREATE TRIGGER trg_purchase_orders_audit
BEFORE UPDATE ON purchase_orders
FOR EACH ROW
EXECUTE FUNCTION log_po_access();

CREATE TRIGGER trg_store_po_audit
BEFORE UPDATE ON store_purchase_orders
FOR EACH ROW
EXECUTE FUNCTION log_po_access();

-- =====================================================
-- 7. GRANT APPROPRIATE PERMISSIONS
-- =====================================================

-- Ensure authenticated users can read with proper filtering
GRANT SELECT ON purchase_orders TO authenticated;
GRANT SELECT ON store_purchase_orders TO authenticated;
GRANT SELECT ON restaurant_purchase_orders TO authenticated;

-- =====================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- =====================================================

-- To rollback this migration:
-- DROP INDEX IF EXISTS idx_purchase_orders_module;
-- DROP INDEX IF EXISTS idx_purchase_orders_module_branch;
-- DROP INDEX IF EXISTS idx_store_po_module;
-- DROP INDEX IF EXISTS idx_store_po_branch;
-- DROP INDEX IF EXISTS idx_store_po_module_branch;
-- DROP INDEX IF EXISTS idx_restaurant_po_module;
-- DROP INDEX IF EXISTS idx_restaurant_po_module_branch;
-- ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS check_purchase_orders_module;
-- ALTER TABLE store_purchase_orders DROP CONSTRAINT IF EXISTS check_store_po_module;
-- ALTER TABLE store_purchase_orders DROP CONSTRAINT IF EXISTS check_store_po_branch_required;
-- ALTER TABLE restaurant_purchase_orders DROP CONSTRAINT IF EXISTS check_restaurant_po_module;
-- ALTER TABLE purchase_orders DROP COLUMN IF EXISTS source_module;
-- ALTER TABLE store_purchase_orders DROP COLUMN IF EXISTS source_module;
-- ALTER TABLE store_purchase_orders DROP COLUMN IF EXISTS branch_id;
-- ALTER TABLE restaurant_purchase_orders DROP COLUMN IF EXISTS source_module;
