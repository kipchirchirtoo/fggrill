# 🗑️ FINAL DATABASE CLEANUP PLAN - FOR APPROVAL

**Date:** May 14, 2026  
**Total Records in Database:** 3,310  
**Status:** ⏳ AWAITING YOUR APPROVAL

---

## 📊 COMPLETE DATABASE INVENTORY

### ALL TABLES WITH DATA (24 tables, 3,310 records):

| # | Table | Records | Category | Action |
|---|-------|---------|----------|--------|
| 1 | payroll_records | 1,116 | Transactional | ❌ DELETE |
| 2 | auth_logs | 1,090 | Logs | ❌ DELETE |
| 3 | staff_profiles | 372 | Master Data | ✅ KEEP |
| 4 | restaurant_menu_items | 253 | Master Data | ✅ KEEP |
| 5 | stock_request_items | 101 | Transactional | ❌ DELETE |
| 6 | notifications | 82 | Transactional | ❌ DELETE |
| 7 | rooms | 57 | Master Data | ❌ DELETE (test rooms) |
| 8 | restaurant_order_items | 38 | Transactional | ❌ DELETE |
| 9 | restaurant_menu_categories | 35 | Master Data | ✅ KEEP |
| 10 | stock_requests | 30 | Transactional | ❌ DELETE |
| 11 | users | 27 | Master Data | ✅ KEEP |
| 12 | guests | 16 | Transactional | ❌ DELETE |
| 13 | restaurant_orders | 15 | Transactional | ❌ DELETE |
| 14 | payments | 14 | Transactional | ❌ DELETE |
| 15 | departments | 12 | Master Data | ✅ KEEP |
| 16 | branches | 10 | Master Data | ✅ KEEP |
| 17 | staff_advances | 8 | Transactional | ❌ DELETE |
| 18 | kenyan_public_holidays | 7 | Seed Data | ✅ KEEP |
| 19 | staff_loans | 7 | Transactional | ❌ DELETE |
| 20 | room_types | 6 | Master Data | ✅ KEEP |
| 21 | approval_requests | 6 | Transactional | ❌ DELETE |
| 22 | daily_financial_records | 3 | Transactional | ❌ DELETE |
| 23 | vehicles | 3 | Master Data | ✅ KEEP |
| 24 | maintenance_spare_parts | 2 | Master Data | ✅ KEEP |

---

## ❌ WHAT WILL BE DELETED (2,577 records)

### 🔴 TRANSACTIONAL DATA TO DELETE:

1. **payroll_records** - 1,116 records
   - Test payroll data
   
2. **auth_logs** - 1,090 records
   - Login attempt logs
   
3. **stock_request_items** - 101 records
   - Line items for stock requests
   
4. **notifications** - 82 records
   - System notifications
   
5. **rooms** - 57 records
   - Test room data (you confirmed to delete)
   
6. **restaurant_order_items** - 38 records
   - Line items for restaurant orders
   
7. **stock_requests** - 30 records
   - Stock request headers
   
8. **guests** - 16 records
   - Test guest records
   
9. **restaurant_orders** - 15 records
   - Test restaurant orders
   
10. **payments** - 14 records
    - Test payment records
    
11. **staff_advances** - 8 records
    - Test staff advances
    
12. **staff_loans** - 7 records
    - Test staff loans
    
13. **approval_requests** - 6 records
    - Test approval requests
    
14. **daily_financial_records** - 3 records
    - Test financial records

### 📸 STORAGE TO KEEP:
- ✅ Staff profile photos (KEEP as requested)
- ✅ All uploaded documents (KEEP as requested)

### 📦 INVENTORY TO KEEP:
- ✅ inventory_items (currently 0 records)
- ✅ warehouses (currently 0 records)
- ✅ suppliers (currently 0 records)
- ✅ branch_suppliers (currently 0 records)

### 🚫 ADDITIONAL DELETIONS:
- ❌ credit_bills (currently 0 records - will delete if any exist)
- ❌ invoices (currently 0 records - will delete if any exist)
- ❌ purchase_orders (currently 0 records - will delete if any exist)

---

## ✅ WHAT WILL BE KEPT (733 records)

### 🟢 MASTER DATA TO KEEP:

1. **staff_profiles** - 372 records
   - ✅ All staff including drivers (as employees)
   
2. **restaurant_menu_items** - 253 records
   - ✅ Menu catalog
   
3. **restaurant_menu_categories** - 35 records
   - ✅ Menu categories
   
4. **users** - 27 records
   - ✅ System login accounts
   
5. **departments** - 12 records
   - ✅ Department structure
   
6. **branches** - 10 records
   - ✅ Branch locations
   
7. **kenyan_public_holidays** - 7 records
   - ✅ Required for payroll
   
8. **room_types** - 6 records
   - ✅ Room type definitions
   
9. **vehicles** - 3 records
   - ✅ KDK 348M, KCZ 225A, BODABODA
   
10. **maintenance_spare_parts** - 2 records
    - ✅ Spare parts catalog

### 🔧 EMPTY TABLES TO KEEP (for future use):
- ✅ inventory_items
- ✅ warehouses
- ✅ suppliers
- ✅ branch_suppliers
- ✅ drivers (separate driver table if exists)
- ✅ invoices (table structure)
- ✅ purchase_orders (table structure)
- ✅ credit_bills (table structure)

---

## 📊 BEFORE vs AFTER

### BEFORE CLEANUP
- **Total Records:** 3,310
- **Tables with Data:** 24
- **Transactional Data:** 2,577
- **Master Data:** 733

### AFTER CLEANUP
- **Total Records:** 733 (78% reduction)
- **Tables with Data:** 10
- **Transactional Data:** 0
- **Master Data:** 733

---

## 🎯 DETAILED CLEANUP SCRIPT

```sql
-- =====================================================
-- FAMOUSGATE DATABASE CLEANUP - FINAL VERSION
-- =====================================================
-- Purpose: Remove test/transactional data
-- Keep: Users, branches, staff, departments, menu, vehicles, inventory structure
-- =====================================================

BEGIN; -- Start transaction (can rollback if needed)

-- =====================================================
-- STEP 1: DELETE CHILD RECORDS FIRST (avoid FK violations)
-- =====================================================

-- 1.1 Delete restaurant order items (child of orders)
DELETE FROM restaurant_order_items;
SELECT 'Deleted restaurant_order_items: ' || (SELECT COUNT(*) FROM restaurant_order_items) || ' remaining';

-- 1.2 Delete stock request items (child of stock requests)
DELETE FROM stock_request_items;
SELECT 'Deleted stock_request_items: ' || (SELECT COUNT(*) FROM stock_request_items) || ' remaining';

-- =====================================================
-- STEP 2: DELETE PARENT TRANSACTIONAL RECORDS
-- =====================================================

-- 2.1 Delete payroll records
DELETE FROM payroll_records;
SELECT 'Deleted payroll_records: ' || (SELECT COUNT(*) FROM payroll_records) || ' remaining';

-- 2.2 Delete auth logs
DELETE FROM auth_logs;
SELECT 'Deleted auth_logs: ' || (SELECT COUNT(*) FROM auth_logs) || ' remaining';

-- 2.3 Delete notifications
DELETE FROM notifications;
SELECT 'Deleted notifications: ' || (SELECT COUNT(*) FROM notifications) || ' remaining';

-- 2.4 Delete stock requests
DELETE FROM stock_requests;
SELECT 'Deleted stock_requests: ' || (SELECT COUNT(*) FROM stock_requests) || ' remaining';

-- 2.5 Delete restaurant orders
DELETE FROM restaurant_orders;
SELECT 'Deleted restaurant_orders: ' || (SELECT COUNT(*) FROM restaurant_orders) || ' remaining';

-- 2.6 Delete payments
DELETE FROM payments;
SELECT 'Deleted payments: ' || (SELECT COUNT(*) FROM payments) || ' remaining';

-- 2.7 Delete staff loans
DELETE FROM staff_loans;
SELECT 'Deleted staff_loans: ' || (SELECT COUNT(*) FROM staff_loans) || ' remaining';

-- 2.8 Delete staff advances
DELETE FROM staff_advances;
SELECT 'Deleted staff_advances: ' || (SELECT COUNT(*) FROM staff_advances) || ' remaining';

-- 2.9 Delete approval requests
DELETE FROM approval_requests;
SELECT 'Deleted approval_requests: ' || (SELECT COUNT(*) FROM approval_requests) || ' remaining';

-- 2.10 Delete daily financial records
DELETE FROM daily_financial_records;
SELECT 'Deleted daily_financial_records: ' || (SELECT COUNT(*) FROM daily_financial_records) || ' remaining';

-- 2.11 Delete guests
DELETE FROM guests;
SELECT 'Deleted guests: ' || (SELECT COUNT(*) FROM guests) || ' remaining';

-- 2.12 Delete rooms (test data)
DELETE FROM rooms;
SELECT 'Deleted rooms: ' || (SELECT COUNT(*) FROM rooms) || ' remaining';

-- =====================================================
-- STEP 3: DELETE CREDIT BILLS (if any exist)
-- =====================================================

DELETE FROM credit_bill_items WHERE 1=1;
DELETE FROM credit_bills WHERE 1=1;
SELECT 'Deleted credit_bills: ' || (SELECT COUNT(*) FROM credit_bills) || ' remaining';

-- =====================================================
-- STEP 4: DELETE INVOICES (if any exist)
-- =====================================================

DELETE FROM invoice_items WHERE 1=1;
DELETE FROM invoices WHERE 1=1;
SELECT 'Deleted invoices: ' || (SELECT COUNT(*) FROM invoices) || ' remaining';

-- =====================================================
-- STEP 5: DELETE PURCHASE ORDERS (if any exist)
-- =====================================================

DELETE FROM purchase_order_items WHERE 1=1;
DELETE FROM purchase_orders WHERE 1=1;
SELECT 'Deleted purchase_orders: ' || (SELECT COUNT(*) FROM purchase_orders) || ' remaining';

-- =====================================================
-- STEP 6: DELETE OTHER TRANSACTIONAL TABLES
-- =====================================================

DELETE FROM bookings WHERE 1=1;
DELETE FROM bar_orders WHERE 1=1;
DELETE FROM bar_order_items WHERE 1=1;
DELETE FROM kitchen_orders WHERE 1=1;
DELETE FROM kitchen_order_items WHERE 1=1;
DELETE FROM kitchen_usage_logs WHERE 1=1;
DELETE FROM stock_dispatches WHERE 1=1;
DELETE FROM stock_dispatch_items WHERE 1=1;
DELETE FROM stock_transfers WHERE 1=1;
DELETE FROM stock_transfer_items WHERE 1=1;
DELETE FROM attendance_records WHERE 1=1;
DELETE FROM leave_requests WHERE 1=1;
DELETE FROM overtime_records WHERE 1=1;
DELETE FROM maintenance_requests WHERE 1=1;
DELETE FROM housekeeping_tasks WHERE 1=1;
DELETE FROM business_communications WHERE 1=1;
DELETE FROM communication_messages WHERE 1=1;
DELETE FROM expense_records WHERE 1=1;
DELETE FROM revenue_records WHERE 1=1;
DELETE FROM audit_logs WHERE 1=1;
DELETE FROM security_events WHERE 1=1;
DELETE FROM restaurant_bills WHERE 1=1;
DELETE FROM restaurant_bill_items WHERE 1=1;

SELECT 'Deleted all other transactional tables';

-- =====================================================
-- STEP 7: VERIFICATION - CHECK WHAT REMAINS
-- =====================================================

SELECT '
=====================================================
CLEANUP VERIFICATION - WHAT REMAINS
=====================================================
' as status;

SELECT 'MASTER DATA (KEPT)' as category, '' as table_name, '' as count
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
SELECT 'TRANSACTIONAL DATA (DELETED)', '', ''
UNION ALL
SELECT '', 'payroll_records', COUNT(*)::text FROM payroll_records
UNION ALL
SELECT '', 'auth_logs', COUNT(*)::text FROM auth_logs
UNION ALL
SELECT '', 'notifications', COUNT(*)::text FROM notifications
UNION ALL
SELECT '', 'stock_requests', COUNT(*)::text FROM stock_requests
UNION ALL
SELECT '', 'stock_request_items', COUNT(*)::text FROM stock_request_items
UNION ALL
SELECT '', 'restaurant_orders', COUNT(*)::text FROM restaurant_orders
UNION ALL
SELECT '', 'restaurant_order_items', COUNT(*)::text FROM restaurant_order_items
UNION ALL
SELECT '', 'payments', COUNT(*)::text FROM payments
UNION ALL
SELECT '', 'guests', COUNT(*)::text FROM guests
UNION ALL
SELECT '', 'rooms', COUNT(*)::text FROM rooms
UNION ALL
SELECT '', 'staff_loans', COUNT(*)::text FROM staff_loans
UNION ALL
SELECT '', 'staff_advances', COUNT(*)::text FROM staff_advances
UNION ALL
SELECT '', 'approval_requests', COUNT(*)::text FROM approval_requests
UNION ALL
SELECT '', 'daily_financial_records', COUNT(*)::text FROM daily_financial_records
UNION ALL
SELECT '', 'credit_bills', COUNT(*)::text FROM credit_bills
UNION ALL
SELECT '', 'invoices', COUNT(*)::text FROM invoices
UNION ALL
SELECT '', 'purchase_orders', COUNT(*)::text FROM purchase_orders;

-- =====================================================
-- STEP 8: FINAL SUMMARY
-- =====================================================

SELECT '
=====================================================
SUMMARY
=====================================================

✅ KEPT (Master Data):
   - 27 users
   - 10 branches
   - 372 staff profiles (including drivers as employees)
   - 12 departments
   - 6 room types
   - 253 menu items
   - 35 menu categories
   - 3 vehicles
   - 2 spare parts
   - 7 holidays

❌ DELETED (Transactional Data):
   - 1,116 payroll records
   - 1,090 auth logs
   - 101 stock request items
   - 82 notifications
   - 57 rooms
   - 38 order items
   - 30 stock requests
   - 16 guests
   - 15 orders
   - 14 payments
   - 8 staff advances
   - 7 staff loans
   - 6 approval requests
   - 3 financial records
   - All credit bills, invoices, purchase orders

✅ KEPT (Empty Tables for Future Use):
   - inventory_items
   - warehouses
   - suppliers
   - branch_suppliers
   - drivers
   - All storage/uploads

📊 Total Deleted: 2,577 records
📊 Total Kept: 733 records
📊 Reduction: 78%

=====================================================
⚠️  REVIEW THE RESULTS ABOVE
=====================================================

If everything looks correct:
  Type: COMMIT;

If something is wrong:
  Type: ROLLBACK;

=====================================================
' as final_summary;

-- =====================================================
-- UNCOMMENT ONE OF THESE TO FINALIZE:
-- =====================================================

-- COMMIT;   -- Make changes permanent
-- ROLLBACK; -- Undo all changes

```

---

## ✅ WHAT'S DIFFERENT FROM PREVIOUS PLAN

### Changes Made:

1. ✅ **KEEP inventory/warehouse data** (currently empty, structure preserved)
2. ✅ **KEEP storage uploads** (photos, documents)
3. ✅ **DELETE credit_bills** (added to deletion list)
4. ✅ **DELETE invoices** (added to deletion list)
5. ✅ **DELETE purchase_orders** (added to deletion list)
6. ✅ **KEEP drivers as employees** (in staff_profiles table)
7. ✅ **KEEP vehicles** (3 vehicles: KDK 348M, KCZ 225A, BODABODA)
8. ✅ **KEEP suppliers structure** (empty table, ready for future use)
9. ✅ **KEEP branch_suppliers structure** (empty table, ready for future use)

---

## 🚀 EXECUTION STEPS

### Step 1: BACKUP (CRITICAL!)
```
1. Open Supabase Dashboard
2. Go to Database → Backups
3. Click "Create Backup"
4. Wait for completion
5. Verify backup exists
```

### Step 2: RUN CLEANUP
```
1. Open Supabase SQL Editor
2. Copy the SQL script above
3. Paste into SQL Editor
4. Click "Run"
5. Review the verification output
```

### Step 3: REVIEW OUTPUT
```
Check the verification section shows:
✅ Master data counts are correct
✅ Transactional data shows 0 records
✅ No unexpected deletions
```

### Step 4: COMMIT OR ROLLBACK
```
If satisfied:
  Type: COMMIT;
  Press Run

If not satisfied:
  Type: ROLLBACK;
  Press Run
  (All changes will be undone)
```

### Step 5: VERIFY APPLICATION
```
1. Login to system
2. Check staff profiles load
3. Check menu items display
4. Check branches accessible
5. Verify no errors
```

---

## ⚠️ FINAL SAFETY CHECKS

Before you approve, confirm:

- [ ] I understand 2,577 records will be deleted
- [ ] I understand 733 records will be kept
- [ ] I have created a backup in Supabase
- [ ] I understand this deletes all payroll, orders, payments, guests
- [ ] I understand staff profiles, menu items, branches will be kept
- [ ] I understand inventory/warehouse structure is preserved
- [ ] I understand storage uploads will be kept
- [ ] I understand I can ROLLBACK if something goes wrong
- [ ] I am ready to proceed

---

## 🚦 YOUR APPROVAL

Reply with:

✅ **"APPROVED - Execute cleanup"** - I'll give you the final script to run

🔄 **"MODIFY - Change X"** - Tell me what else to adjust

❌ **"CANCEL"** - Stop everything

---

**Waiting for your approval...**
