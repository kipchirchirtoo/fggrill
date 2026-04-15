-- =====================================================
-- PHASE 2 FIX #4: Backfill NULL branch_id Values
-- Date: 2026-04-15
-- Purpose: Populate NULL branch_id values across all tables
-- Strategy: Use intelligent defaults based on related data
-- =====================================================

-- IMPORTANT: Review and adjust branch assignment logic before running!
-- This script makes assumptions about branch assignment that may need customization.

DO $
DECLARE
  default_branch_id INTEGER;
  affected_rows INTEGER;
  total_affected INTEGER := 0;
BEGIN
  -- Get the default branch (usually branch_id = 1 or the first branch)
  SELECT id INTO default_branch_id FROM branches ORDER BY id LIMIT 1;
  
  IF default_branch_id IS NULL THEN
    RAISE EXCEPTION 'No branches found in database. Please create at least one branch before running backfill.';
  END IF;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Starting branch_id backfill process';
  RAISE NOTICE 'Default branch_id: %', default_branch_id;
  RAISE NOTICE '========================================';
  
  -- =====================================================
  -- 1. STAFF_PROFILES
  -- Strategy: Use user's branch_id if available, otherwise default
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '1. Backfilling staff_profiles...';
  
  UPDATE staff_profiles sp
  SET branch_id = COALESCE(
    (SELECT u.branch_id FROM users u WHERE u.id = sp.user_id),
    default_branch_id
  )
  WHERE sp.branch_id IS NULL;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  total_affected := total_affected + affected_rows;
  RAISE NOTICE '   Updated % staff_profiles records', affected_rows;
  
  -- =====================================================
  -- 2. STAFF_SCHEDULES
  -- Strategy: Use staff's branch_id
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '2. Backfilling staff_schedules...';
  
  UPDATE staff_schedules ss
  SET branch_id = COALESCE(
    (SELECT sp.branch_id FROM staff_profiles sp WHERE sp.id = ss.staff_id),
    default_branch_id
  )
  WHERE ss.branch_id IS NULL;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  total_affected := total_affected + affected_rows;
  RAISE NOTICE '   Updated % staff_schedules records', affected_rows;
  
  -- =====================================================
  -- 3. STAFF_LEAVE
  -- Strategy: Use staff's branch_id
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '3. Backfilling staff_leave...';
  
  UPDATE staff_leave sl
  SET branch_id = COALESCE(
    (SELECT sp.branch_id FROM staff_profiles sp WHERE sp.id = sl.staff_id),
    default_branch_id
  )
  WHERE sl.branch_id IS NULL;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  total_affected := total_affected + affected_rows;
  RAISE NOTICE '   Updated % staff_leave records', affected_rows;
  
  -- =====================================================
  -- 4. STAFF_PAYROLL
  -- Strategy: Use staff's branch_id
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '4. Backfilling staff_payroll...';
  
  UPDATE staff_payroll sp
  SET branch_id = COALESCE(
    (SELECT spr.branch_id FROM staff_profiles spr WHERE spr.id = sp.staff_id),
    default_branch_id
  )
  WHERE sp.branch_id IS NULL;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  total_affected := total_affected + affected_rows;
  RAISE NOTICE '   Updated % staff_payroll records', affected_rows;
  
  -- =====================================================
  -- 5. STAFF_PERFORMANCE
  -- Strategy: Use staff's branch_id
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '5. Backfilling staff_performance...';
  
  UPDATE staff_performance sp
  SET branch_id = COALESCE(
    (SELECT spr.branch_id FROM staff_profiles spr WHERE spr.id = sp.staff_id),
    default_branch_id
  )
  WHERE sp.branch_id IS NULL;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  total_affected := total_affected + affected_rows;
  RAISE NOTICE '   Updated % staff_performance records', affected_rows;
  
  -- =====================================================
  -- 6. BOOKINGS
  -- Strategy: Use room's branch_id if available, otherwise default
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '6. Backfilling bookings...';
  
  UPDATE bookings b
  SET branch_id = COALESCE(
    (SELECT r.branch_id FROM rooms r WHERE r.id = b.room_id),
    default_branch_id
  )
  WHERE b.branch_id IS NULL;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  total_affected := total_affected + affected_rows;
  RAISE NOTICE '   Updated % bookings records', affected_rows;
  
  -- =====================================================
  -- 7. RESTAURANT_ORDERS
  -- Strategy: Use table's branch_id or created_by user's branch_id
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '7. Backfilling restaurant_orders...';
  
  UPDATE restaurant_orders ro
  SET branch_id = COALESCE(
    (SELECT rt.branch_id FROM restaurant_tables rt WHERE rt.table_number = ro.table_number LIMIT 1),
    (SELECT u.branch_id FROM users u WHERE u.id = ro.created_by),
    default_branch_id
  )
  WHERE ro.branch_id IS NULL;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  total_affected := total_affected + affected_rows;
  RAISE NOTICE '   Updated % restaurant_orders records', affected_rows;
  
  -- =====================================================
  -- 8. BAR_ORDERS
  -- Strategy: Use created_by user's branch_id
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '8. Backfilling bar_orders...';
  
  UPDATE bar_orders bo
  SET branch_id = COALESCE(
    (SELECT u.branch_id FROM users u WHERE u.id = bo.created_by),
    default_branch_id
  )
  WHERE bo.branch_id IS NULL;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  total_affected := total_affected + affected_rows;
  RAISE NOTICE '   Updated % bar_orders records', affected_rows;
  
  -- =====================================================
  -- 9. FINANCE_TRANSACTIONS
  -- Strategy: Use created_by user's branch_id
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '9. Backfilling finance_transactions...';
  
  UPDATE finance_transactions ft
  SET branch_id = COALESCE(
    (SELECT u.branch_id FROM users u WHERE u.id = ft.created_by),
    default_branch_id
  )
  WHERE ft.branch_id IS NULL;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  total_affected := total_affected + affected_rows;
  RAISE NOTICE '   Updated % finance_transactions records', affected_rows;
  
  -- =====================================================
  -- 10. EXPENSES
  -- Strategy: Use created_by user's branch_id
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '10. Backfilling expenses...';
  
  UPDATE expenses e
  SET branch_id = COALESCE(
    (SELECT u.branch_id FROM users u WHERE u.id = e.created_by),
    default_branch_id
  )
  WHERE e.branch_id IS NULL;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  total_affected := total_affected + affected_rows;
  RAISE NOTICE '   Updated % expenses records', affected_rows;
  
  -- =====================================================
  -- 11. HOUSEKEEPING_TASKS (hk_tasks)
  -- Strategy: Use room's branch_id if available
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '11. Backfilling hk_tasks...';
  
  UPDATE hk_tasks ht
  SET branch_id = COALESCE(
    (SELECT r.branch_id FROM rooms r WHERE r.id = ht.room_id),
    default_branch_id
  )
  WHERE ht.branch_id IS NULL;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  total_affected := total_affected + affected_rows;
  RAISE NOTICE '   Updated % hk_tasks records', affected_rows;
  
  -- =====================================================
  -- 12. STAFF_ATTENDANCE
  -- Strategy: Use user's branch_id
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '12. Backfilling staff_attendance...';
  
  UPDATE staff_attendance sa
  SET branch_id = COALESCE(
    (SELECT u.branch_id FROM users u WHERE u.id = sa.user_id),
    default_branch_id
  )
  WHERE sa.branch_id IS NULL;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  total_affected := total_affected + affected_rows;
  RAISE NOTICE '   Updated % staff_attendance records', affected_rows;
  
  -- =====================================================
  -- 13. INVENTORY_ITEMS (simple_items)
  -- Strategy: Default branch for now (may need manual review)
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '13. Backfilling simple_items...';
  
  UPDATE simple_items si
  SET branch_id = default_branch_id
  WHERE si.branch_id IS NULL;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  total_affected := total_affected + affected_rows;
  RAISE NOTICE '   Updated % simple_items records', affected_rows;
  RAISE NOTICE '   WARNING: Inventory items assigned to default branch - may need manual review';
  
  -- =====================================================
  -- 14. CASHIER_TRANSACTIONS
  -- Strategy: Use cashier_id user's branch_id
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '14. Backfilling cashier_transactions...';
  
  UPDATE cashier_transactions ct
  SET branch_id = COALESCE(
    (SELECT u.branch_id FROM users u WHERE u.id = ct.cashier_id),
    default_branch_id
  )
  WHERE ct.branch_id IS NULL;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  total_affected := total_affected + affected_rows;
  RAISE NOTICE '   Updated % cashier_transactions records', affected_rows;
  
  -- =====================================================
  -- 15. STAFF_EMPLOYMENT_HISTORY
  -- Strategy: Use staff's branch_id
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '15. Backfilling staff_employment_history...';
  
  UPDATE staff_employment_history seh
  SET branch_id = COALESCE(
    (SELECT sp.branch_id FROM staff_profiles sp WHERE sp.id = seh.staff_id),
    default_branch_id
  )
  WHERE seh.branch_id IS NULL;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  total_affected := total_affected + affected_rows;
  RAISE NOTICE '   Updated % staff_employment_history records', affected_rows;
  
  -- =====================================================
  -- 16. STAFF_DOCUMENTS
  -- Strategy: Use staff's branch_id
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '16. Backfilling staff_documents...';
  
  UPDATE staff_documents sd
  SET branch_id = COALESCE(
    (SELECT sp.branch_id FROM staff_profiles sp WHERE sp.id = sd.staff_id),
    default_branch_id
  )
  WHERE sd.branch_id IS NULL;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  total_affected := total_affected + affected_rows;
  RAISE NOTICE '   Updated % staff_documents records', affected_rows;
  
  -- =====================================================
  -- SUMMARY
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Backfill process completed successfully';
  RAISE NOTICE 'Total records updated: %', total_affected;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Review the updated records to ensure correct branch assignment';
  RAISE NOTICE '2. Manually review inventory items (simple_items) branch assignments';
  RAISE NOTICE '3. Test branch isolation queries to verify data is properly scoped';
  RAISE NOTICE '4. Update application code to include branch_id filters in all queries';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Backfill failed: % - %', SQLERRM, SQLSTATE;
END $;

-- =====================================================
-- VERIFICATION QUERIES
-- Run these after backfill to verify results
-- =====================================================

-- Check for remaining NULL branch_ids
DO $
DECLARE
  null_count INTEGER;
  table_name TEXT;
  tables TEXT[] := ARRAY[
    'staff_profiles', 'staff_schedules', 'staff_leave', 'staff_payroll', 'staff_performance',
    'bookings', 'restaurant_orders', 'bar_orders', 'finance_transactions', 'expenses',
    'hk_tasks', 'staff_attendance', 'simple_items', 'cashier_transactions',
    'staff_employment_history', 'staff_documents'
  ];
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICATION: Checking for remaining NULL branch_ids';
  RAISE NOTICE '========================================';
  
  FOREACH table_name IN ARRAY tables
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE branch_id IS NULL', table_name) INTO null_count;
    IF null_count > 0 THEN
      RAISE WARNING 'Table % still has % records with NULL branch_id', table_name, null_count;
    ELSE
      RAISE NOTICE 'Table %: All records have branch_id assigned ✓', table_name;
    END IF;
  END LOOP;
  
  RAISE NOTICE '========================================';
END $;
