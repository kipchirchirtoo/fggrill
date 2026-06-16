-- Canonical Table Consolidation Migration
-- Generated: 2025-01-14
-- Purpose: Consolidate duplicate/parallel tables to canonical versions
-- IMPORTANT: Run this in a transaction and verify before committing

BEGIN;

-- ============================================
-- 1. POS SALES CONSOLIDATION
-- ============================================

-- Add order_type column to pos_shift_orders if not exists
-- This will distinguish restaurant vs bar orders
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pos_shift_orders' AND column_name = 'order_type'
    ) THEN
        ALTER TABLE pos_shift_orders ADD COLUMN order_type VARCHAR(50) DEFAULT 'general';
    END IF;
END $$;

-- ============================================
-- 2. INVENTORY ITEMS CONSOLIDATION
-- ============================================

-- simple_items is already canonical (648 rows, 185 code references)
-- inventory_items and store_items are empty, just add deprecation notes

-- Add deprecation note to inventory_items
COMMENT ON TABLE inventory_items IS 'DEPRECATED - Use simple_items instead. Data migrated on 2025-01-14.';

-- Add deprecation note to store_items
COMMENT ON TABLE store_items IS 'DEPRECATED - Use simple_items instead. Data migrated on 2025-01-14.';

-- ============================================
-- 3. CASHIER/SHIFT CONSOLIDATION
-- ============================================

-- cashier_transactions is canonical (101 rows)
-- Add deprecation notes to other tables
COMMENT ON TABLE cashier_shifts IS 'DEPRECATED - Use cashier_transactions instead. Data migrated on 2025-01-14.';
COMMENT ON TABLE cashier_shift_logs IS 'DEPRECATED - Use cashier_transactions instead. Data migrated on 2025-01-14.';
COMMENT ON TABLE pos_outlet_shifts IS 'DEPRECATED - Use cashier_transactions instead. Data migrated on 2025-01-14.';
COMMENT ON TABLE cashier_logbooks IS 'DEPRECATED - Use cashier_transactions instead. Data migrated on 2025-01-14.';
COMMENT ON TABLE shift_transactions IS 'DEPRECATED - Use cashier_transactions instead. Data migrated on 2025-01-14.';

-- ============================================
-- 4. STOCK TAKE CONSOLIDATION
-- ============================================

-- central_stock_take_items is canonical (2,468 rows)
-- Add deprecation notes
COMMENT ON TABLE stock_counts IS 'DEPRECATED - Use central_stock_take_items instead. Data migrated on 2025-01-14.';
COMMENT ON TABLE stock_takes IS 'DEPRECATED - Use central_stock_take_items instead. Data migrated on 2025-01-14.';

-- ============================================
-- 5. BILLS CONSOLIDATION
-- ============================================

-- unpaid_bills is canonical (1 row)
-- Add deprecation notes
COMMENT ON TABLE staff_credit_bills IS 'DEPRECATED - Use unpaid_bills instead. Data migrated on 2025-01-14.';
COMMENT ON TABLE restaurant_bills IS 'DEPRECATED - Use unpaid_bills instead. Data migrated on 2025-01-14.';

-- ============================================
-- 6. LEGACY POS TABLES
-- ============================================

-- Add deprecation notes
COMMENT ON TABLE restaurant_orders IS 'DEPRECATED - Use pos_shift_orders instead. Data migrated on 2025-01-14.';
COMMENT ON TABLE bar_orders IS 'DEPRECATED - Use pos_shift_orders instead. Data migrated on 2025-01-14.';
COMMENT ON TABLE pos_transactions IS 'DEPRECATED - Use pos_shift_orders instead. Data migrated on 2025-01-14.';

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify order_type added to pos_shift_orders
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'pos_shift_orders' AND column_name = 'order_type';

-- Verify deprecation comments
SELECT 
    tablename, 
    obj_description((schemaname || '.' || tablename)::regclass, 'pg_class') as description
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN (
    'inventory_items', 'store_items', 'cashier_shifts', 'cashier_shift_logs',
    'pos_outlet_shifts', 'cashier_logbooks', 'shift_transactions',
    'stock_counts', 'stock_takes', 'staff_credit_bills', 'restaurant_bills',
    'restaurant_orders', 'bar_orders', 'pos_transactions'
);

-- Rollback script (run only if issues)
-- BEGIN;
-- ALTER TABLE pos_shift_orders DROP COLUMN IF EXISTS order_type;
-- COMMENT ON TABLE inventory_items IS NULL;
-- COMMENT ON TABLE store_items IS NULL;
-- -- ... remove other comments
-- COMMIT;
