-- ============================================================
-- FAMOUS GATE HOTEL - DATABASE CLEANUP FOR CLIENT HANDOVER
-- ============================================================
-- 
-- PURPOSE: Remove all operational data while preserving superadmin login
-- 
-- ⚠️ CRITICAL WARNINGS:
-- 1. This script will DELETE ALL DATA except the superadmin user
-- 2. BACKUP YOUR DATABASE before running this script
-- 3. This action is IRREVERSIBLE
-- 4. Review the script carefully before execution
-- 
-- BACKUP COMMAND (Run this first in Supabase Dashboard):
-- Go to Database > Backups and create a manual backup
-- 
-- ============================================================

-- Start transaction for safety
BEGIN;

-- ============================================================
-- STEP 1: IDENTIFY AND PRESERVE SUPERADMIN
-- ============================================================

-- First, let's verify the superadmin exists
DO $$
DECLARE
    superadmin_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO superadmin_count
    FROM users
    WHERE role = 'super_admin';
    
    IF superadmin_count = 0 THEN
        RAISE EXCEPTION 'No superadmin user found! Aborting cleanup.';
    END IF;
    
    RAISE NOTICE 'Found % superadmin user(s)', superadmin_count;
END $$;

-- ============================================================
-- STEP 2: DELETE TRANSACTIONAL DATA
-- ============================================================

-- Financial & Accounting Data
DELETE FROM finance_daily_log_lines;
DELETE FROM finance_daily_logs;
DELETE FROM accounting_journal_entries;
DELETE FROM mpesa_transaction_logs;
DELETE FROM payment_receipts;
DELETE FROM bills;
DELETE FROM invoices;

-- Staff Financial Records
DELETE FROM staff_credit_bills;
DELETE FROM staff_loan_payments;
DELETE FROM staff_loans;
DELETE FROM staff_advances;
DELETE FROM staff_payroll;

-- Kitchen & Food Service
DELETE FROM kitchen_variance_reasons;
DELETE FROM kitchen_portion_ledger;
DELETE FROM kitchen_portion_stock;
DELETE FROM kitchen_food_controls;
DELETE FROM kitchen_daily_variance;
DELETE FROM kitchen_wastage;
DELETE FROM kitchen_usage;
DELETE FROM recipe_items;
DELETE FROM recipes;
DELETE FROM kitchen_grn_items;
DELETE FROM kitchen_grn;
DELETE FROM kitchen_requisition_items;
DELETE FROM kitchen_requisitions;
DELETE FROM kitchen_stock_ledger;
DELETE FROM kitchen_stock;

-- POS & Orders
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM pos_sessions;
DELETE FROM pool_table_tokens;

-- Restaurant & Bar
DELETE FROM restaurant_bills;
DELETE FROM bar_stock_movements;
DELETE FROM restaurant_inventory;

-- Reservations & Bookings
DELETE FROM room_bookings;
DELETE FROM reservations;
DELETE FROM guest_profiles;

-- Housekeeping
DELETE FROM housekeeping_tasks;
DELETE FROM room_maintenance;
DELETE FROM laundry_records;

-- Inventory & Stock Management
DELETE FROM stock_history;
DELETE FROM dispatch_items;
DELETE FROM dispatch_notes;
DELETE FROM dispatch_returns;
DELETE FROM dispatch_tracking;
DELETE FROM stock_request_items;
DELETE FROM stock_requests;
DELETE FROM stock_levels;
DELETE FROM stock_take_items;
DELETE FROM stock_takes;
DELETE FROM stock_out_records;
DELETE FROM simple_transfer_items;
DELETE FROM simple_shop_items;
DELETE FROM branch_stock_movements;
DELETE FROM inventory_items;
DELETE FROM simple_items;

-- Procurement & Suppliers
DELETE FROM purchase_order_items;
DELETE FROM purchase_orders;
DELETE FROM grn_items;
DELETE FROM goods_received_notes;
DELETE FROM supplier_invoices;
DELETE FROM supplier_payments;
-- Keep suppliers table structure but clear data
DELETE FROM suppliers;

-- Maintenance
DELETE FROM maintenance_requests;
DELETE FROM maintenance_schedules;

-- Vehicles & Drivers
DELETE FROM vehicle_maintenance;
DELETE FROM drivers;
DELETE FROM vehicles;

-- Audit Logs (Optional - you may want to keep these)
-- DELETE FROM audit_logs;
-- DELETE FROM system_logs;

-- ============================================================
-- STEP 3: RESET SEQUENCES AND COUNTERS
-- ============================================================

-- Reset SKU categories serial numbers
UPDATE sku_categories SET current_serial = 0;

-- Clear order sequences
DELETE FROM order_sequences;

-- Clear simple sequences
DELETE FROM simple_sequences;

-- ============================================================
-- STEP 4: CLEAN UP USERS (KEEP ONLY SUPERADMIN)
-- ============================================================

-- Delete staff profiles for non-superadmin users
DELETE FROM staff_profiles 
WHERE user_id NOT IN (
    SELECT id FROM users WHERE role = 'super_admin'
);

-- Delete staff attendance records
DELETE FROM staff_attendance;

-- Delete staff leave records
DELETE FROM staff_leave;

-- Delete all users EXCEPT superadmin
DELETE FROM users 
WHERE role != 'super_admin';

-- ============================================================
-- STEP 5: OPTIONAL - RESET BRANCH DATA
-- ============================================================

-- You can choose to keep branches or reset them
-- Uncomment the following lines if you want to remove all branches:

-- DELETE FROM branches;

-- Or reset to default branches only:
-- DELETE FROM branches WHERE code NOT IN ('FGBOMET', 'FGKRCHO', 'FGLITEIN');

-- ============================================================
-- STEP 6: VACUUM AND ANALYZE
-- ============================================================

-- Note: VACUUM cannot run inside a transaction block
-- You'll need to run these commands separately after committing

-- VACUUM FULL;
-- ANALYZE;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check remaining users (should only be superadmin)
SELECT 
    id, 
    email, 
    first_name, 
    last_name, 
    role,
    created_at
FROM users;

-- Check data counts in major tables
SELECT 
    'orders' as table_name, COUNT(*) as record_count FROM orders
UNION ALL
SELECT 'bills', COUNT(*) FROM bills
UNION ALL
SELECT 'reservations', COUNT(*) FROM reservations
UNION ALL
SELECT 'stock_requests', COUNT(*) FROM stock_requests
UNION ALL
SELECT 'kitchen_stock', COUNT(*) FROM kitchen_stock
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'suppliers', COUNT(*) FROM suppliers
UNION ALL
SELECT 'inventory_items', COUNT(*) FROM inventory_items;

-- ============================================================
-- COMMIT OR ROLLBACK
-- ============================================================

-- Review the verification queries above
-- If everything looks correct, COMMIT the transaction:
-- COMMIT;

-- If something looks wrong, ROLLBACK:
-- ROLLBACK;

-- ⚠️ IMPORTANT: The transaction will remain open until you explicitly
-- run either COMMIT or ROLLBACK. Review carefully before committing!

-- ============================================================
-- POST-CLEANUP STEPS
-- ============================================================

-- After committing, run these commands separately:
-- 
-- 1. Vacuum the database:
--    VACUUM FULL;
--    ANALYZE;
-- 
-- 2. Clear Supabase Storage buckets (if needed):
--    - Go to Storage in Supabase Dashboard
--    - Manually delete files from buckets:
--      * staff-photos
--      * id-cards
--      * receipts
--      * invoices
--      * reports
-- 
-- 3. Update superadmin password (recommended):
--    UPDATE users 
--    SET password = crypt('NewSecurePassword', gen_salt('bf'))
--    WHERE role = 'super_admin';
-- 
-- 4. Test login with superadmin credentials
-- 
-- ============================================================
