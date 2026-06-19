-- ============================================================================
-- ROLLBACK SCRIPT: Revert branch_id fixes in pos_shift_orders table
-- ============================================================================
-- PURPOSE: Restore original null branch_id values if needed
-- USAGE: Only run this if you need to undo the migration
-- ============================================================================

-- Check if the migration was applied
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_name = 'pos_shift_orders_branch_id_fix_log') THEN
        RAISE EXCEPTION 'Migration was never applied. Nothing to rollback.';
    END IF;
END $$;

-- Show what will be rolled back
DO $$
DECLARE
    records_to_rollback INTEGER;
BEGIN
    SELECT COUNT(*) INTO records_to_rollback FROM pos_shift_orders_branch_id_fix_log;
    RAISE NOTICE '============================================';
    RAISE NOTICE 'ROLLBACK PREVIEW:';
    RAISE NOTICE '  Records to be reverted: %', records_to_rollback;
    RAISE NOTICE '============================================';
END $$;

-- Rollback in small batches (same safe approach as migration)
DO $$
DECLARE
    batch_size INTEGER := 10;
    updated_count INTEGER := 0;
    total_updated INTEGER := 0;
BEGIN
    LOOP
        -- Revert small batch
        WITH to_revert AS (
            SELECT log.id, log.old_branch_id
            FROM pos_shift_orders_branch_id_fix_log log
            WHERE EXISTS (
                SELECT 1 FROM pos_shift_orders pso 
                WHERE pso.id = log.id
            )
            LIMIT batch_size
        )
        UPDATE pos_shift_orders
        SET branch_id = to_revert.old_branch_id
        FROM to_revert
        WHERE pos_shift_orders.id = to_revert.id;
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        total_updated := total_updated + updated_count;
        
        -- Delete rolled back records from log
        DELETE FROM pos_shift_orders_branch_id_fix_log
        WHERE id IN (SELECT id FROM to_revert);
        
        EXIT WHEN updated_count = 0;
        
        PERFORM pg_sleep(0.1);
    END LOOP;
    
    RAISE NOTICE 'Rolled back % records', total_updated;
END $$;

-- Optional: Drop the audit log table
-- DROP TABLE IF EXISTS pos_shift_orders_branch_id_fix_log;

-- Verify rollback
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count 
    FROM pos_shift_orders 
    WHERE branch_id IS NULL;
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'ROLLBACK COMPLETE:';
    RAISE NOTICE '  - Records with null branch_id: %', null_count;
    RAISE NOTICE '============================================';
END $$;