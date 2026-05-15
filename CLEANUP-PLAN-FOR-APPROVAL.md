# 🗑️ DATABASE CLEANUP PLAN - AWAITING APPROVAL

**Date:** May 14, 2026  
**Purpose:** Remove all test/demo transactional data, keep only master data  
**Status:** ⏳ AWAITING YOUR APPROVAL

---

## 📋 WHAT WILL BE DELETED

### 🔴 TRANSACTIONAL DATA TO DELETE (2,477 records)

| Table | Records | Type | Reason |
|-------|---------|------|--------|
| **payroll_records** | 1,116 | Transactional | Test payroll data |
| **auth_logs** | 1,090 | Logs | Test login attempts |
| **notifications** | 82 | Transactional | Test notifications |
| **rooms** | 57 | Master (but deleting) | Test room data |
| **stock_requests** | 30 | Transactional | Test stock requests |
| **guests** | 16 | Transactional | Test guest records |
| **restaurant_orders** | 15 | Transactional | Test orders |
| **payments** | 14 | Transactional | Test payments |
| **staff_loans** | 7 | Transactional | Test loans |
| **staff_advances** | 8 | Transactional | Test advances |
| **approval_requests** | 6 | Transactional | Test approvals |
| **daily_financial_records** | 3 | Transactional | Test financial data |
| **credit_bills** | 0 | Transactional | (empty) |
| **business_communications** | 0 | Transactional | (empty) |
| **invoices** | 0 | Transactional | (empty) |
| **restaurant_bills** | 0 | Transactional | (empty) |
| **bookings** | 0 | Transactional | (empty) |
| **bar_orders** | 0 | Transactional | (empty) |
| **kitchen_orders** | 0 | Transactional | (empty) |
| **kitchen_usage_logs** | 0 | Transactional | (empty) |
| **stock_dispatches** | 0 | Transactional | (empty) |
| **stock_transfers** | 0 | Transactional | (empty) |
| **purchase_orders** | 0 | Transactional | (empty) |
| **attendance_records** | 0 | Transactional | (empty) |
| **leave_requests** | 0 | Transactional | (empty) |
| **overtime_records** | 0 | Transactional | (empty) |
| **maintenance_requests** | 0 | Transactional | (empty) |
| **housekeeping_tasks** | 0 | Transactional | (empty) |
| **expense_records** | 0 | Transactional | (empty) |
| **revenue_records** | 0 | Transactional | (empty) |
| **audit_logs** | 0 | Logs | (empty) |
| **security_events** | 0 | Logs | (empty) |

### 📸 STORAGE/UPLOADS TO DELETE
- Staff profile photos
- Guest documents
- Communication attachments
- Any uploaded files in Supabase Storage

### 📦 INVENTORY DATA TO DELETE
- Central store master inventory items
- Warehouse stock levels
- Inventory transactions

---

## ✅ WHAT WILL BE KEPT (421 records)

### 🟢 MASTER DATA TO KEEP

| Table | Records | Why Keep |
|-------|---------|----------|
| **users** | 27 | ✅ System users (login accounts) |
| **branches** | 10 | ✅ Branch locations |
| **staff_profiles** | 372 | ✅ Staff master data |
| **departments** | 12 | ✅ Department structure |
| **room_types** | 6 | ✅ Room type definitions |
| **restaurant_menu_items** | 253 | ✅ Menu catalog |
| **restaurant_menu_categories** | 35 | ✅ Menu categories |
| **kenyan_public_holidays** | 7 | ✅ Required for payroll |

**Total Master Data:** 722 records

---

## 🎯 CLEANUP STRATEGY

### Phase 1: Backup (CRITICAL)
1. Create Supabase backup
2. Export critical tables to CSV
3. Verify backup exists

### Phase 2: Delete Transactional Data (Order matters!)
```
Step 1: Delete child records first
  → restaurant_order_items (if any)
  → restaurant_bill_items (if any)
  → stock_request_items (if any)
  
Step 2: Delete transactional records
  → payroll_records (1,116)
  → auth_logs (1,090)
  → notifications (82)
  → stock_requests (30)
  → restaurant_orders (15)
  → payments (14)
  → staff_loans (7)
  → staff_advances (8)
  → approval_requests (6)
  → daily_financial_records (3)
  → guests (16)
  → rooms (57)
  
Step 3: Delete storage files
  → Staff photos
  → Uploaded documents
  → Communication attachments
  
Step 4: Delete inventory data
  → inventory_items
  → warehouse stock
  → central store data
```

### Phase 3: Verification
1. Check record counts
2. Verify master data intact
3. Test user login
4. Verify no orphaned records

### Phase 4: Optimization
1. Run VACUUM ANALYZE
2. Rebuild indexes
3. Update statistics

---

## 📊 BEFORE vs AFTER

### BEFORE CLEANUP
- Total Records: **3,159**
- Tables with Data: **19**
- Transactional Data: **2,437**
- Master Data: **722**

### AFTER CLEANUP
- Total Records: **722** (77% reduction)
- Tables with Data: **8**
- Transactional Data: **0**
- Master Data: **722**

---

## ⚠️ RISKS & MITIGATION

### Risk 1: Accidental deletion of production data
**Mitigation:** 
- Full backup before starting
- Dry-run mode first
- Manual verification of each step

### Risk 2: Foreign key violations
**Mitigation:**
- Delete in correct dependency order
- Check for orphaned records after

### Risk 3: Application breaks
**Mitigation:**
- Test login after cleanup
- Verify menu items load
- Check staff profiles accessible

### Risk 4: Cannot rollback
**Mitigation:**
- Keep backup for 30 days
- Document what was deleted
- Export data to CSV before deletion

---

## 🔧 EXECUTION METHOD

### Option A: Automated Script (Recommended)
- Run TypeScript cleanup script
- Automatic dependency handling
- Built-in verification
- Detailed logging

### Option B: Manual SQL
- Execute SQL statements one by one
- Full control over each step
- Can review between steps
- More time-consuming

---

## 📝 DETAILED SQL CLEANUP SCRIPT

```sql
-- =====================================================
-- FAMOUSGATE DATABASE CLEANUP
-- =====================================================
-- Purpose: Remove all test/transactional data
-- Keep: Users, branches, staff, departments, menu items
-- =====================================================

BEGIN; -- Start transaction (can rollback if needed)

-- =====================================================
-- STEP 1: DELETE TRANSACTIONAL DATA
-- =====================================================

-- 1.1 Delete payroll records
DELETE FROM payroll_records;
SELECT 'Deleted payroll_records: ' || ROW_COUNT() || ' records';

-- 1.2 Delete auth logs
DELETE FROM auth_logs;
SELECT 'Deleted auth_logs: ' || ROW_COUNT() || ' records';

-- 1.3 Delete notifications
DELETE FROM notifications;
SELECT 'Deleted notifications: ' || ROW_COUNT() || ' records';

-- 1.4 Delete stock requests
DELETE FROM stock_requests;
SELECT 'Deleted stock_requests: ' || ROW_COUNT() || ' records';

-- 1.5 Delete restaurant orders
DELETE FROM restaurant_orders;
SELECT 'Deleted restaurant_orders: ' || ROW_COUNT() || ' records';

-- 1.6 Delete payments
DELETE FROM payments;
SELECT 'Deleted payments: ' || ROW_COUNT() || ' records';

-- 1.7 Delete staff loans
DELETE FROM staff_loans;
SELECT 'Deleted staff_loans: ' || ROW_COUNT() || ' records';

-- 1.8 Delete staff advances
DELETE FROM staff_advances;
SELECT 'Deleted staff_advances: ' || ROW_COUNT() || ' records';

-- 1.9 Delete approval requests
DELETE FROM approval_requests;
SELECT 'Deleted approval_requests: ' || ROW_COUNT() || ' records';

-- 1.10 Delete daily financial records
DELETE FROM daily_financial_records;
SELECT 'Deleted daily_financial_records: ' || ROW_COUNT() || ' records';

-- 1.11 Delete guests
DELETE FROM guests;
SELECT 'Deleted guests: ' || ROW_COUNT() || ' records';

-- 1.12 Delete rooms
DELETE FROM rooms;
SELECT 'Deleted rooms: ' || ROW_COUNT() || ' records';

-- =====================================================
-- STEP 2: DELETE EMPTY TRANSACTIONAL TABLES
-- =====================================================

DELETE FROM credit_bills;
DELETE FROM business_communications;
DELETE FROM communication_messages;
DELETE FROM invoices;
DELETE FROM restaurant_bills;
DELETE FROM bookings;
DELETE FROM bar_orders;
DELETE FROM kitchen_orders;
DELETE FROM kitchen_usage_logs;
DELETE FROM stock_dispatches;
DELETE FROM stock_transfers;
DELETE FROM purchase_orders;
DELETE FROM attendance_records;
DELETE FROM leave_requests;
DELETE FROM overtime_records;
DELETE FROM maintenance_requests;
DELETE FROM housekeeping_tasks;
DELETE FROM expense_records;
DELETE FROM revenue_records;
DELETE FROM audit_logs;
DELETE FROM security_events;

SELECT 'Deleted all empty transactional tables';

-- =====================================================
-- STEP 3: DELETE INVENTORY DATA
-- =====================================================

DELETE FROM inventory_items;
SELECT 'Deleted inventory_items: ' || ROW_COUNT() || ' records';

DELETE FROM warehouses;
SELECT 'Deleted warehouses: ' || ROW_COUNT() || ' records';

DELETE FROM suppliers;
SELECT 'Deleted suppliers: ' || ROW_COUNT() || ' records';

-- =====================================================
-- STEP 4: VERIFICATION
-- =====================================================

SELECT '
=====================================================
CLEANUP VERIFICATION
=====================================================
';

-- Check what remains
SELECT 'users' as table_name, COUNT(*) as remaining FROM users
UNION ALL
SELECT 'branches', COUNT(*) FROM branches
UNION ALL
SELECT 'staff_profiles', COUNT(*) FROM staff_profiles
UNION ALL
SELECT 'departments', COUNT(*) FROM departments
UNION ALL
SELECT 'room_types', COUNT(*) FROM room_types
UNION ALL
SELECT 'restaurant_menu_items', COUNT(*) FROM restaurant_menu_items
UNION ALL
SELECT 'restaurant_menu_categories', COUNT(*) FROM restaurant_menu_categories
UNION ALL
SELECT 'kenyan_public_holidays', COUNT(*) FROM kenyan_public_holidays
UNION ALL
SELECT 'payroll_records', COUNT(*) FROM payroll_records
UNION ALL
SELECT 'auth_logs', COUNT(*) FROM auth_logs
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'stock_requests', COUNT(*) FROM stock_requests
UNION ALL
SELECT 'restaurant_orders', COUNT(*) FROM restaurant_orders
UNION ALL
SELECT 'payments', COUNT(*) FROM payments
UNION ALL
SELECT 'guests', COUNT(*) FROM guests
UNION ALL
SELECT 'rooms', COUNT(*) FROM rooms;

-- =====================================================
-- REVIEW THE OUTPUT ABOVE
-- If everything looks good: COMMIT;
-- If something is wrong: ROLLBACK;
-- =====================================================

SELECT '
⚠️  IMPORTANT: Review the verification results above
✅ If satisfied, run: COMMIT;
❌ If not satisfied, run: ROLLBACK;
';

-- COMMIT;   -- Uncomment to make changes permanent
-- ROLLBACK; -- Uncomment to undo all changes
```

---

## ✅ APPROVAL CHECKLIST

Before I proceed, please confirm:

- [ ] **I have read and understand what will be deleted**
- [ ] **I confirm this is test data and can be deleted**
- [ ] **I understand users, branches, staff, departments, and menu items will be kept**
- [ ] **I have a backup or accept the risk**
- [ ] **I want to proceed with cleanup**

---

## 🚀 NEXT STEPS

### If You Approve:
1. I will create the cleanup script
2. You run it in Supabase SQL Editor
3. Review the verification output
4. You decide to COMMIT or ROLLBACK

### If You Want Changes:
- Tell me what to keep or delete differently
- I'll update the plan

---

## ❓ QUESTIONS TO CONSIDER

1. **Are you sure the 372 staff profiles are real?**
   - These will be kept
   
2. **Are the 253 menu items real or test data?**
   - Currently set to KEEP
   - Change to DELETE if they're test data

3. **Do you want to keep the 57 rooms?**
   - Currently set to DELETE
   - Change to KEEP if they're real room definitions

4. **What about the 10 branches?**
   - Currently set to KEEP
   - Are all 10 branches real?

---

## 📞 AWAITING YOUR APPROVAL

**Reply with:**
- ✅ "APPROVED - Proceed with cleanup" 
- 🔄 "MODIFY - Change X, Y, Z"
- ❌ "CANCEL - Don't delete anything"

---

**⚠️ CRITICAL: Once you approve, I will create the final cleanup script. You will need to:**
1. Create a backup in Supabase Dashboard
2. Run the script in Supabase SQL Editor
3. Review the verification output
4. Type COMMIT; to make it permanent (or ROLLBACK; to undo)
