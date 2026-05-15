-- =====================================================
-- SEED DATA DETECTION SCRIPT
-- =====================================================
-- Purpose: Identify all seed/sample/test data in the database
-- Usage: Run this in Supabase SQL Editor or via psql
-- =====================================================

-- Set search path
SET search_path TO public;

-- =====================================================
-- 1. CHECK BAR MODULE SEED DATA
-- =====================================================
SELECT 
  '1. BAR DRINKS (Seed Data)' as check_name,
  COUNT(*) as record_count,
  MIN(created_at) as earliest_record,
  MAX(created_at) as latest_record
FROM bar_drinks;

SELECT 
  '   Bar Drinks by Category' as detail,
  c.name as category,
  COUNT(d.id) as drink_count
FROM bar_drinks d
JOIN bar_drink_categories c ON d.category_id = c.id
GROUP BY c.name
ORDER BY drink_count DESC;

-- =====================================================
-- 2. CHECK KITCHEN FOOD CONTROLS (Seed Data)
-- =====================================================
SELECT 
  '2. KITCHEN FOOD CONTROLS (Seed Data)' as check_name,
  COUNT(*) as record_count,
  COUNT(DISTINCT raw_item_name) as unique_items
FROM kitchen_food_controls;

SELECT 
  '   Sample Food Controls' as detail,
  raw_item_name,
  raw_quantity,
  raw_unit,
  produced_item_name,
  produced_portions
FROM kitchen_food_controls
LIMIT 10;

-- =====================================================
-- 3. CHECK KITCHEN VARIANCE REASONS (Seed Data)
-- =====================================================
SELECT 
  '3. KITCHEN VARIANCE REASONS (Seed Data)' as check_name,
  COUNT(*) as record_count
FROM kitchen_variance_reasons;

SELECT 
  '   Variance Reasons' as detail,
  reason,
  requires_approval
FROM kitchen_variance_reasons;

-- =====================================================
-- 4. CHECK RESTAURANT MENU SEED DATA
-- =====================================================
SELECT 
  '4. RESTAURANT MENU ITEMS (Potential Seed)' as check_name,
  COUNT(*) as record_count,
  MIN(created_at) as earliest_record
FROM restaurant_menu_items;

SELECT 
  '   Menu Items by Category' as detail,
  c.name as category,
  COUNT(m.id) as item_count
FROM restaurant_menu_items m
JOIN restaurant_menu_categories c ON m.category_id = c.id
GROUP BY c.name
ORDER BY item_count DESC;

-- =====================================================
-- 5. CHECK SAMPLE DEPARTMENTS
-- =====================================================
SELECT 
  '5. DEPARTMENTS (Check for defaults)' as check_name,
  COUNT(*) as record_count
FROM departments;

SELECT 
  '   Department List' as detail,
  name,
  description,
  created_at
FROM departments
ORDER BY created_at;

-- =====================================================
-- 6. CHECK KENYAN PUBLIC HOLIDAYS (Seed Data)
-- =====================================================
SELECT 
  '6. KENYAN PUBLIC HOLIDAYS (Seed Data)' as check_name,
  COUNT(*) as record_count
FROM kenyan_public_holidays;

SELECT 
  '   Holiday List' as detail,
  name,
  holiday_date,
  is_recurring
FROM kenyan_public_holidays
ORDER BY holiday_date;

-- =====================================================
-- 7. CHECK PAYROLL POLICIES (Seed Data)
-- =====================================================
SELECT 
  '7. PAYROLL POLICIES (Seed Data)' as check_name,
  COUNT(*) as record_count
FROM payroll_policies
WHERE is_active = true;

SELECT 
  '   Active Policies' as detail,
  name,
  category,
  formula_type,
  rate
FROM payroll_policies
WHERE is_active = true;

-- =====================================================
-- 8. CHECK HR SETTINGS (Seed Data)
-- =====================================================
SELECT 
  '8. HR SETTINGS (Seed Data)' as check_name,
  COUNT(*) as record_count
FROM hr_settings;

SELECT 
  '   HR Settings' as detail,
  setting_key,
  setting_value,
  category
FROM hr_settings
ORDER BY category, setting_key;

-- =====================================================
-- 9. CHECK RESTAURANT SECTIONS (Sample Data)
-- =====================================================
SELECT 
  '9. RESTAURANT SECTIONS (Check for samples)' as check_name,
  COUNT(*) as record_count
FROM restaurant_sections;

SELECT 
  '   Section List' as detail,
  name,
  capacity,
  branch_id,
  created_at
FROM restaurant_sections
ORDER BY created_at;

-- =====================================================
-- 10. CHECK MAINTENANCE SPARE PARTS (Sample Data)
-- =====================================================
SELECT 
  '10. MAINTENANCE SPARE PARTS (Sample Data)' as check_name,
  COUNT(*) as record_count
FROM maintenance_spare_parts;

SELECT 
  '   Sample Parts' as detail,
  part_number,
  part_name,
  category,
  current_stock
FROM maintenance_spare_parts
LIMIT 10;

-- =====================================================
-- 11. TRANSACTIONAL DATA SUMMARY
-- =====================================================
SELECT '11. TRANSACTIONAL DATA COUNTS' as section;

SELECT 'Orders' as table_name, COUNT(*) as record_count FROM restaurant_orders
UNION ALL
SELECT 'Bills', COUNT(*) FROM restaurant_bills
UNION ALL
SELECT 'Bookings', COUNT(*) FROM bookings
UNION ALL
SELECT 'Payments', COUNT(*) FROM payments
UNION ALL
SELECT 'Invoices', COUNT(*) FROM invoices
UNION ALL
SELECT 'Credit Bills', COUNT(*) FROM credit_bills
UNION ALL
SELECT 'Stock Requests', COUNT(*) FROM stock_requests
UNION ALL
SELECT 'Stock Dispatches', COUNT(*) FROM stock_dispatches
UNION ALL
SELECT 'Purchase Orders', COUNT(*) FROM purchase_orders
UNION ALL
SELECT 'Attendance Records', COUNT(*) FROM attendance_records
UNION ALL
SELECT 'Payroll Records', COUNT(*) FROM payroll_records
UNION ALL
SELECT 'Staff Loans', COUNT(*) FROM staff_loans
UNION ALL
SELECT 'Approval Requests', COUNT(*) FROM approval_requests
UNION ALL
SELECT 'Kitchen Usage Logs', COUNT(*) FROM kitchen_usage_logs
UNION ALL
SELECT 'Bar Orders', COUNT(*) FROM bar_orders
UNION ALL
SELECT 'Communications', COUNT(*) FROM business_communications
ORDER BY record_count DESC;

-- =====================================================
-- 12. CHECK FOR TEST/DEMO USERS
-- =====================================================
SELECT 
  '12. USERS (Check for test accounts)' as check_name,
  COUNT(*) as total_users,
  COUNT(CASE WHEN email ILIKE '%test%' THEN 1 END) as test_email_count,
  COUNT(CASE WHEN email ILIKE '%demo%' THEN 1 END) as demo_email_count,
  COUNT(CASE WHEN email ILIKE '%sample%' THEN 1 END) as sample_email_count
FROM users;

SELECT 
  '   Potential Test Users' as detail,
  email,
  role,
  created_at
FROM users
WHERE 
  email ILIKE '%test%' 
  OR email ILIKE '%demo%' 
  OR email ILIKE '%sample%'
  OR email ILIKE '%example%'
ORDER BY created_at;

-- =====================================================
-- 13. CHECK BRANCH DATA
-- =====================================================
SELECT 
  '13. BRANCHES' as check_name,
  COUNT(*) as branch_count
FROM branches;

SELECT 
  '   Branch List' as detail,
  id,
  name,
  location,
  created_at
FROM branches
ORDER BY created_at;

-- =====================================================
-- 14. DATA BY BRANCH (for branch-aware cleanup)
-- =====================================================
SELECT 
  '14. RECORDS BY BRANCH' as section,
  b.name as branch_name,
  (SELECT COUNT(*) FROM restaurant_orders WHERE branch_id = b.id) as orders,
  (SELECT COUNT(*) FROM bookings WHERE branch_id = b.id) as bookings,
  (SELECT COUNT(*) FROM stock_requests WHERE branch_id = b.id) as stock_requests,
  (SELECT COUNT(*) FROM attendance_records WHERE branch_id = b.id) as attendance
FROM branches b
ORDER BY b.name;

-- =====================================================
-- 15. RECENT DATA (Last 7 days)
-- =====================================================
SELECT '15. RECENT DATA (Last 7 days)' as section;

SELECT 
  'Recent Orders' as data_type,
  COUNT(*) as count,
  MIN(created_at) as earliest,
  MAX(created_at) as latest
FROM restaurant_orders
WHERE created_at >= NOW() - INTERVAL '7 days';

SELECT 
  'Recent Bookings' as data_type,
  COUNT(*) as count,
  MIN(created_at) as earliest,
  MAX(created_at) as latest
FROM bookings
WHERE created_at >= NOW() - INTERVAL '7 days';

SELECT 
  'Recent Payments' as data_type,
  COUNT(*) as count,
  MIN(created_at) as earliest,
  MAX(created_at) as latest
FROM payments
WHERE created_at >= NOW() - INTERVAL '7 days';

-- =====================================================
-- SUMMARY
-- =====================================================
SELECT '
=====================================================
SUMMARY
=====================================================
This script has checked:
1. Bar drinks seed data
2. Kitchen food controls seed data
3. Kitchen variance reasons seed data
4. Restaurant menu items
5. Departments
6. Kenyan public holidays
7. Payroll policies
8. HR settings
9. Restaurant sections
10. Maintenance spare parts
11. All transactional data counts
12. Test/demo users
13. Branch information
14. Data distribution by branch
15. Recent data activity

NEXT STEPS:
- Review the output above
- Identify which data is seed/sample vs production
- Use the cleanup scripts to safely remove test data
- Always backup before running cleanup
=====================================================
' as summary;
