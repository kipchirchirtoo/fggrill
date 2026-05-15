-- =====================================================
-- TEST DATA CLEANUP SCRIPT
-- =====================================================
-- Purpose: Safely remove sample/mock/test data from database
-- 
-- IMPORTANT: 
-- 1. BACKUP YOUR DATABASE BEFORE RUNNING THIS SCRIPT
-- 2. Review each section carefully
-- 3. Uncomment only the sections you want to execute
-- 4. Run in a transaction so you can rollback if needed
-- 5. Test in development environment first
-- =====================================================

-- Start transaction (allows rollback)
BEGIN;

-- =====================================================
-- CONFIGURATION
-- =====================================================
-- Set to true to actually delete data, false for dry-run
\set execute_delete false

-- =====================================================
-- 1. REMOVE BAR DRINKS SEED DATA
-- =====================================================
-- These are the drinks seeded from 20251128_bar_seed_data.sql
-- Uncomment to delete:

/*
DELETE FROM bar_drinks
WHERE name IN (
  -- Beers
  'Tusker Lager', 'Tusker Malt', 'White Cap Lager', 'Pilsner Lager', 
  'Guinness', 'Senator Keg 500ml', 'Heineken', 'Corona', 'Budweiser',
  -- Whisky
  'Jameson (Shot)', 'Jameson (Double)', 'Jack Daniels (Shot)', 'Jack Daniels (Double)',
  'Johnnie Walker Red (Shot)', 'Johnnie Walker Black (Shot)', 'Glenfiddich 12yr (Shot)', 'Chivas Regal (Shot)',
  -- Vodka
  'Smirnoff (Shot)', 'Smirnoff (Double)', 'Absolut (Shot)', 'Grey Goose (Shot)', 'Ciroc (Shot)',
  -- Gin
  'Gordons Gin (Shot)', 'Tanqueray (Shot)', 'Bombay Sapphire (Shot)', 'Hendricks (Shot)',
  -- Rum
  'Captain Morgan (Shot)', 'Bacardi White (Shot)', 'Bacardi Gold (Shot)', 'Malibu (Shot)',
  -- Brandy
  'Viceroy (Shot)', 'KWV 5yr (Shot)', 'Hennessy VS (Shot)', 'Remy Martin VSOP (Shot)',
  -- Wines
  'House Red Wine (Glass)', 'House White Wine (Glass)', 'House Rose (Glass)',
  'Red Wine (Bottle)', 'White Wine (Bottle)', 'Sparkling Wine (Bottle)',
  -- Cocktails
  'Mojito', 'Margarita', 'Pina Colada', 'Long Island Iced Tea', 'Cosmopolitan',
  'Mai Tai', 'Daiquiri', 'Sex on the Beach', 'Whisky Sour', 'Old Fashioned',
  -- Shooters
  'Tequila Shot', 'Jagermeister Shot', 'B-52', 'Sambuca Shot',
  -- Soft Drinks
  'Coca Cola', 'Fanta Orange', 'Sprite', 'Tonic Water', 'Soda Water',
  'Ginger Ale', 'Red Bull', 'Mineral Water'
);

SELECT 'Deleted bar drinks seed data' as status;
*/

-- =====================================================
-- 2. REMOVE KITCHEN FOOD CONTROLS SEED DATA
-- =====================================================
-- These are standard yield rules seeded in migrations
-- Uncomment to delete:

/*
DELETE FROM kitchen_food_controls
WHERE raw_item_name IN (
  'BEEF/ MBUZI', 'BEEF / MBUZI', 'CHICKEN', 'FISH', 'RICE', 
  'UGALI', 'CHAPATI', 'VEGETABLES', 'POTATOES'
);

SELECT 'Deleted kitchen food controls seed data' as status;
*/

-- =====================================================
-- 3. REMOVE KITCHEN VARIANCE REASONS SEED DATA
-- =====================================================
-- Uncomment to delete:

/*
DELETE FROM kitchen_variance_reasons
WHERE reason IN (
  'Over-portioning', 'Under-portioning', 'Spillage', 
  'Cooking error', 'Quality issue', 'Customer complaint', 'Other'
);

SELECT 'Deleted kitchen variance reasons seed data' as status;
*/

-- =====================================================
-- 4. REMOVE SAMPLE RESTAURANT SECTIONS
-- =====================================================
-- Only removes sections named 'Main Dining' which is the sample
-- Uncomment to delete:

/*
DELETE FROM restaurant_sections
WHERE name = 'Main Dining' 
  AND capacity = 50;

SELECT 'Deleted sample restaurant sections' as status;
*/

-- =====================================================
-- 5. REMOVE SAMPLE MAINTENANCE SPARE PARTS
-- =====================================================
-- Uncomment to delete all spare parts (review first!):

/*
-- DELETE FROM maintenance_spare_parts;
-- SELECT 'Deleted all maintenance spare parts' as status;
*/

-- =====================================================
-- 6. REMOVE DEFAULT DEPARTMENTS (if not in use)
-- =====================================================
-- Only removes if they have no staff assigned
-- Uncomment to delete:

/*
DELETE FROM departments
WHERE name IN ('Management', 'Front Office', 'Housekeeping', 'Kitchen', 'Maintenance', 'Accounts')
  AND NOT EXISTS (
    SELECT 1 FROM staff_profiles WHERE department_id = departments.id
  );

SELECT 'Deleted unused default departments' as status;
*/

-- =====================================================
-- 7. REMOVE TEST/DEMO USERS
-- =====================================================
-- CAREFUL: Only removes users with test/demo/sample in email
-- Uncomment to delete:

/*
DELETE FROM users
WHERE email ILIKE '%test%'
   OR email ILIKE '%demo%'
   OR email ILIKE '%sample%'
   OR email ILIKE '%example%';

SELECT 'Deleted test/demo users' as status;
*/

-- =====================================================
-- 8. REMOVE TRANSACTIONAL TEST DATA
-- =====================================================
-- WARNING: This removes actual transactional records
-- Only use if you're certain they are test data
-- Consider using date filters or branch filters

-- 8a. Remove old test orders (example: older than 30 days)
/*
DELETE FROM restaurant_orders
WHERE created_at < NOW() - INTERVAL '30 days'
  AND status IN ('cancelled', 'draft');

SELECT 'Deleted old test orders' as status;
*/

-- 8b. Remove test bookings (example: with test guest names)
/*
DELETE FROM bookings
WHERE guest_name ILIKE '%test%'
   OR guest_name ILIKE '%demo%'
   OR guest_email ILIKE '%test%'
   OR guest_email ILIKE '%demo%';

SELECT 'Deleted test bookings' as status;
*/

-- 8c. Remove test payments (example: with test reference)
/*
DELETE FROM payments
WHERE reference ILIKE '%test%'
   OR reference ILIKE '%demo%'
   OR reference ILIKE '%sample%';

SELECT 'Deleted test payments' as status;
*/

-- 8d. Remove test stock requests
/*
DELETE FROM stock_requests
WHERE notes ILIKE '%test%'
   OR notes ILIKE '%demo%';

SELECT 'Deleted test stock requests' as status;
*/

-- 8e. Remove test attendance records (example: for deleted users)
/*
DELETE FROM attendance_records
WHERE user_id NOT IN (SELECT id FROM users);

SELECT 'Deleted orphaned attendance records' as status;
*/

-- 8f. Remove test payroll records
/*
DELETE FROM payroll_records
WHERE notes ILIKE '%test%'
   OR notes ILIKE '%demo%';

SELECT 'Deleted test payroll records' as status;
*/

-- 8g. Remove test credit bills
/*
DELETE FROM credit_bills
WHERE customer_name ILIKE '%test%'
   OR customer_name ILIKE '%demo%';

SELECT 'Deleted test credit bills' as status;
*/

-- 8h. Remove test communications
/*
DELETE FROM business_communications
WHERE subject ILIKE '%test%'
   OR subject ILIKE '%demo%'
   OR content ILIKE '%test%';

SELECT 'Deleted test communications' as status;
*/

-- =====================================================
-- 9. REMOVE ORPHANED RECORDS
-- =====================================================
-- Clean up records that reference deleted data

-- 9a. Remove order items for deleted orders
/*
DELETE FROM restaurant_order_items
WHERE order_id NOT IN (SELECT id FROM restaurant_orders);

SELECT 'Deleted orphaned order items' as status;
*/

-- 9b. Remove bill items for deleted bills
/*
DELETE FROM restaurant_bill_items
WHERE bill_id NOT IN (SELECT id FROM restaurant_bills);

SELECT 'Deleted orphaned bill items' as status;
*/

-- 9c. Remove notifications for deleted users
/*
DELETE FROM notifications
WHERE user_id IS NOT NULL 
  AND user_id NOT IN (SELECT id FROM users);

SELECT 'Deleted orphaned notifications' as status;
*/

-- =====================================================
-- 10. VACUUM AND ANALYZE
-- =====================================================
-- After cleanup, optimize the database
-- Uncomment to execute:

/*
VACUUM ANALYZE;
SELECT 'Database optimized' as status;
*/

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify cleanup

SELECT 'VERIFICATION RESULTS' as section;

SELECT 'Bar Drinks' as table_name, COUNT(*) as remaining_records FROM bar_drinks
UNION ALL
SELECT 'Kitchen Food Controls', COUNT(*) FROM kitchen_food_controls
UNION ALL
SELECT 'Kitchen Variance Reasons', COUNT(*) FROM kitchen_variance_reasons
UNION ALL
SELECT 'Restaurant Sections', COUNT(*) FROM restaurant_sections
UNION ALL
SELECT 'Departments', COUNT(*) FROM departments
UNION ALL
SELECT 'Users', COUNT(*) FROM users
UNION ALL
SELECT 'Restaurant Orders', COUNT(*) FROM restaurant_orders
UNION ALL
SELECT 'Bookings', COUNT(*) FROM bookings
UNION ALL
SELECT 'Payments', COUNT(*) FROM payments
UNION ALL
SELECT 'Stock Requests', COUNT(*) FROM stock_requests
UNION ALL
SELECT 'Attendance Records', COUNT(*) FROM attendance_records
UNION ALL
SELECT 'Payroll Records', COUNT(*) FROM payroll_records
UNION ALL
SELECT 'Credit Bills', COUNT(*) FROM credit_bills
UNION ALL
SELECT 'Communications', COUNT(*) FROM business_communications;

-- =====================================================
-- COMMIT OR ROLLBACK
-- =====================================================
-- Review the verification results above
-- If everything looks good, COMMIT
-- If something went wrong, ROLLBACK

-- ROLLBACK; -- Undo all changes
-- COMMIT;   -- Make changes permanent

SELECT '
=====================================================
CLEANUP SCRIPT COMPLETED
=====================================================
IMPORTANT: 
- Review the verification results above
- If satisfied, run: COMMIT;
- If not satisfied, run: ROLLBACK;
- This script is still in a transaction
=====================================================
' as notice;
