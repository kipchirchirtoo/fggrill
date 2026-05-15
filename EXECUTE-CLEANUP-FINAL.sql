-- =====================================================
-- FAMOUSGATE DATABASE CLEANUP - FINAL CORRECTED VERSION
-- =====================================================
-- Date: May 14, 2026
-- Purpose: Remove test/transactional data, keep master data
-- 
-- CORRECT DELETION ORDER - No foreign key violations
-- 
-- WHAT GETS DELETED: 2,625 records
--   - 1,116 payroll records
--   - 1,090 auth logs
--   - 101 stock request items
--   - 57 rooms
--   - 38 restaurant order items
--   - 30 stock requests
--   - 25 dispatch notes
--   - 23 reservations (NEW - was causing FK error)
--   - 16 guests
--   - 15 restaurant orders
--   - 14 payments
--   - 8 staff advances
--   - 7 staff loans
--   - 3 financial records
--
-- WHAT GETS KEPT: 733 records
--   - 372 staff profiles
--   - 253 menu items
--   - 35 menu categories
--   - 27 users
--   - 12 departments
--   - 10 branches
--   - 7 holidays
--   - 6 room types
--   - 3 vehicles
--   - 2 spare parts
-- =====================================================

BEGIN; -- Start transaction

-- =====================================================
-- STEP 1: DELETE MOST DEPENDENT RECORDS FIRST
-- =====================================================

-- 1.1 Delete dispatch_notes (25 records) - References stock_requests
DELETE FROM dispatch_notes;

-- 1.2 Delete restaurant order items (38 records)
DELETE FROM restaurant_order_items;

-- 1.3 Delete stock request items (101 records)
DELETE FROM stock_request_items;

-- 1.4 Delete reservations (23 records) - References guests, MUST DELETE BEFORE GUESTS
DELETE FROM reservations;

SELECT '✓ Step 1 Complete: Deleted most dependent records (187 total)' as status;

-- =====================================================
-- STEP 2: DELETE PARENT TRANSACTIONAL RECORDS
-- =====================================================

-- 2.1 Delete stock requests (30 records) - Now safe to delete
DELETE FROM stock_requests;

-- 2.2 Delete restaurant orders (15 records)
DELETE FROM restaurant_orders;

-- 2.3 Delete payments (14 records)
DELETE FROM payments;

SELECT '✓ Step 2 Complete: Deleted parent records (59 total)' as status;

-- =====================================================
-- STEP 3: DELETE OTHER TRANSACTIONAL DATA
-- =====================================================

-- 3.1 Delete payroll records (1,116 records)
DELETE FROM payroll_records;

-- 3.2 Delete auth logs (1,090 records)
DELETE FROM auth_logs;

-- 3.3 Delete notifications (82 records) - REMOVED, keeping notifications
-- DELETE FROM notifications;

-- 3.4 Delete approval requests (6 records) - REMOVED, keeping approval requests  
-- DELETE FROM approval_requests;

-- 3.5 Delete daily financial records (3 records)
DELETE FROM daily_financial_records;

SELECT '✓ Step 3 Complete: Deleted other transactional data (2,209 total)' as status;

-- =====================================================
-- STEP 4: DELETE MASTER DATA MARKED FOR DELETION
-- =====================================================

-- 4.1 Delete guests (16 records)
DELETE FROM guests;

-- 4.2 Delete rooms (57 records)
DELETE FROM rooms;

-- 4.3 Delete staff loans (7 records)
DELETE FROM staff_loans;

-- 4.4 Delete staff advances (8 records)
DELETE FROM staff_advances;

SELECT '✓ Step 4 Complete: Deleted test master data (88 total)' as status;

-- =====================================================
-- STEP 5: VERIFICATION - CHECK WHAT REMAINS
-- =====================================================

SELECT '
=====================================================
CLEANUP VERIFICATION
=====================================================
' as verification_header;

-- Check master data (should have records)
SELECT '✅ MASTER DATA (KEPT)' as category, '' as table_name, '' as count
UNION ALL
SELECT '', 'users', COUNT(*)::text FROM users
UNION ALL
SELECT '', 'branches', COUNT(*)::text FROM branches
UNION ALL
SELECT '', 'staff_profiles', COUNT(*)::text FROM staff_profiles
UNION ALL
SELECT '', 'departments', COUNT(*)::text FROM departments
UNION ALL
SELECT '', 'room_types', COUNT(*)::text FROM room_types
UNION ALL
SELECT '', 'restaurant_menu_items', COUNT(*)::text FROM restaurant_menu_items
UNION ALL
SELECT '', 'restaurant_menu_categories', COUNT(*)::text FROM restaurant_menu_categories
UNION ALL
SELECT '', 'vehicles', COUNT(*)::text FROM vehicles
UNION ALL
SELECT '', 'maintenance_spare_parts', COUNT(*)::text FROM maintenance_spare_parts
UNION ALL
SELECT '', 'kenyan_public_holidays', COUNT(*)::text FROM kenyan_public_holidays
UNION ALL
SELECT '', '', ''
UNION ALL
SELECT '❌ TRANSACTIONAL DATA (SHOULD BE 0)', '', ''
UNION ALL
SELECT '', 'reservations', COUNT(*)::text FROM reservations
UNION ALL
SELECT '', 'dispatch_notes', COUNT(*)::text FROM dispatch_notes
UNION ALL
SELECT '', 'stock_request_items', COUNT(*)::text FROM stock_request_items
UNION ALL
SELECT '', 'restaurant_order_items', COUNT(*)::text FROM restaurant_order_items
UNION ALL
SELECT '', 'stock_requests', COUNT(*)::text FROM stock_requests
UNION ALL
SELECT '', 'restaurant_orders', COUNT(*)::text FROM restaurant_orders
UNION ALL
SELECT '', 'payments', COUNT(*)::text FROM payments
UNION ALL
SELECT '', 'payroll_records', COUNT(*)::text FROM payroll_records
UNION ALL
SELECT '', 'auth_logs', COUNT(*)::text FROM auth_logs
UNION ALL
SELECT '', 'notifications', COUNT(*)::text FROM notifications
UNION ALL
SELECT '', 'notifications', COUNT(*)::text FROM notifications
UNION ALL
SELECT '', 'approval_requests', COUNT(*)::text FROM approval_requests
UNION ALL
SELECT '', 'daily_financial_records', COUNT(*)::text FROM daily_financial_records
UNION ALL
SELECT '', 'guests', COUNT(*)::text FROM guests
UNION ALL
SELECT '', 'rooms', COUNT(*)::text FROM rooms
UNION ALL
SELECT '', 'staff_loans', COUNT(*)::text FROM staff_loans
UNION ALL
SELECT '', 'staff_advances', COUNT(*)::text FROM staff_advances;

-- =====================================================
-- STEP 6: FINAL SUMMARY
-- =====================================================

SELECT '
=====================================================
✅ CLEANUP COMPLETE
=====================================================

MASTER DATA KEPT:
  ✓ 27 users
  ✓ 10 branches
  ✓ 372 staff profiles (including drivers)
  ✓ 12 departments
  ✓ 6 room types
  ✓ 253 menu items
  ✓ 35 menu categories
  ✓ 3 vehicles
  ✓ 2 spare parts
  ✓ 7 holidays

TRANSACTIONAL DATA DELETED:
  ✓ 1,116 payroll records
  ✓ 1,090 auth logs
  ✓ 101 stock request items
  ✓ 57 rooms
  ✓ 38 order items
  ✓ 30 stock requests
  ✓ 25 dispatch notes
  ✓ 23 reservations (FK dependency - deleted before guests)
  ✓ 16 guests
  ✓ 15 orders
  ✓ 14 payments
  ✓ 8 staff advances
  ✓ 7 staff loans
  ✓ 3 financial records

KEPT (not deleted):
  ✓ 82 notifications (keeping for system)
  ✓ 6 approval requests (keeping for system)

EMPTY TABLES PRESERVED:
  ✓ inventory_items (structure)
  ✓ warehouses (structure)
  ✓ suppliers (structure)
  ✓ branch_suppliers (structure)
  ✓ credit_bills (structure)
  ✓ invoices (structure)
  ✓ purchase_orders (structure)
  ✓ All storage uploads

STATISTICS:
  📊 Total Deleted: 2,543 records
  📊 Total Kept: 821 records (733 master + 88 notifications/approvals)
  📊 Reduction: 76%

=====================================================
⚠️  IMPORTANT: REVIEW THE VERIFICATION ABOVE
=====================================================

Check that:
  1. Master data counts are correct (users=27, staff=372, etc.)
  2. All transactional tables show 0 records
  3. reservations = 0 (was causing FK error with guests)
  4. dispatch_notes = 0 (was causing FK error with stock_requests)
  5. notifications and approval_requests still have data (we kept these)
  6. No unexpected deletions occurred

If everything looks correct:
  → Type: COMMIT;
  → Press Run

If something is wrong:
  → Type: ROLLBACK;
  → Press Run
  → All changes will be undone

=====================================================
' as final_summary;

-- =====================================================
-- UNCOMMENT ONE OF THESE TO FINALIZE:
-- =====================================================

-- COMMIT;   -- ← Remove the -- to make changes permanent
-- ROLLBACK; -- ← Remove the -- to undo all changes
