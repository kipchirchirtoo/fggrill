-- ============================================================================
-- TEST SCRIPT: Verify migration safety on a test copy
-- ============================================================================
-- This script creates a test copy of the data and runs the migration
-- to verify it works correctly before running on production
-- ============================================================================

BEGIN;

-- Create test table
CREATE TEMP TABLE pos_shift_orders_test AS 
SELECT * FROM pos_shift_orders 
WHERE branch_id IS NULL 
LIMIT 5;

-- Show original state
SELECT 
    COUNT(*) as total_null_records,
    COUNT(DISTINCT shift_id) as unique_shifts,
    COUNT(DISTINCT outlet_id) as unique_outlets
FROM pos_shift_orders_test
WHERE branch_id IS NULL;

-- Create test log table
CREATE TEMP TABLE pos_shift_orders_branch_id_fix_log_test (
    id UUID,
    old_branch_id INTEGER,
    new_branch_id INTEGER,
    shift_id UUID,
    outlet_id UUID,
    fixed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log what will be fixed
INSERT INTO pos_shift_orders_branch_id_fix_log_test (id, old_branch_id, new_branch_id, shift_id, outlet_id)
SELECT 
    pso.id,
    pso.branch_id as old_branch_id,
    COALESCE(pos.branch_id, po.branch_id, 2) as new_branch_id,
    pso.shift_id,
    pso.outlet_id
FROM pos_shift_orders_test pso
LEFT JOIN pos_outlet_shifts pos ON pso.shift_id = pos.id
LEFT JOIN pos_outlets po ON pso.outlet_id = po.id
WHERE pso.branch_id IS NULL;

-- Show what will be updated
SELECT * FROM pos_shift_orders_branch_id_fix_log_test;

-- Apply the fix
UPDATE pos_shift_orders_test pso
SET branch_id = log.new_branch_id
FROM pos_shift_orders_branch_id_fix_log_test log
WHERE pso.id = log.id;

-- Verify results
SELECT 
    COUNT(*) as records_updated,
    COUNT(CASE WHEN branch_id IS NOT NULL THEN 1 END) as now_have_branch_id,
    COUNT(CASE WHEN branch_id IS NULL THEN 1 END) as still_null,
    ARRAY_AGG(DISTINCT branch_id) as branch_ids_assigned
FROM pos_shift_orders_test;

-- Show detailed results
SELECT 
    pso.id,
    pso.shift_id,
    pso.outlet_id,
    log.old_branch_id as before_migration,
    pso.branch_id as after_migration,
    pos.branch_id as shift_branch,
    po.branch_id as outlet_branch
FROM pos_shift_orders_test pso
LEFT JOIN pos_shift_orders_branch_id_fix_log_test log ON pso.id = log.id
LEFT JOIN pos_outlet_shifts pos ON pso.shift_id = pos.id
LEFT JOIN pos_outlets po ON pso.outlet_id = po.id;

-- Rollback test (don't commit)
ROLLBACK;

-- ============================================================================
-- SUCCESS CRITERIA:
-- ============================================================================
-- ✅ All null branch_id values should be updated
-- ✅ branch_id should match shift's branch_id or outlet's branch_id
-- ✅ No records should have invalid branch_id values
-- ✅ Audit log should contain all changes
-- ============================================================================