# PHASE 3D: BRANCH ISOLATION - EXECUTION PLAN

## 🎯 OBJECTIVE
Fix 140 HIGH severity errors by adding `.eq('branch_id', userBranchId)` filters to all branch-scoped queries.

## 📋 AFFECTED TABLES (Branch-Scoped)
- rooms
- staff_profiles
- restaurant_orders
- bar_orders
- bookings
- inventory_items
- menu_items
- shifts
- store_items
- expenses
- simple_items
- cashier_transactions
- stock_requests
- branch_stock_movements
- branch_stock

## 🔧 APPROACH

### **Option A: Automated Script** (RECOMMENDED)
Create a script that:
1. Reads all controller files
2. Finds all `.from('table').select()` queries
3. Checks if table is branch-scoped
4. Adds `.eq('branch_id', userBranchId)` if missing
5. Preserves existing code structure

### **Option B: Manual Fixes**
Fix each file individually (140 locations)

### **Option C: Database-Level RLS**
Update RLS policies to automatically filter by branch_id

---

## 🚀 RECOMMENDED: Option C - Database-Level RLS

**Advantages:**
- ✅ Fixes ALL 140 errors at once
- ✅ No code changes required
- ✅ Enforced at database level (more secure)
- ✅ Automatic for all future queries
- ✅ Can't be bypassed by code

**Implementation:**
Update RLS policies to use `auth.uid()` to get user's branch_id from staff_profiles.

---

## 📝 IMPLEMENTATION

I'll create a migration that updates RLS policies for all branch-scoped tables to automatically filter by the user's branch_id.

