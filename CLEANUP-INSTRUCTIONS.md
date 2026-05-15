# 🚀 DATABASE CLEANUP - EXECUTION INSTRUCTIONS

**Status:** ✅ APPROVED  
**Date:** May 14, 2026  
**Script:** `EXECUTE-CLEANUP.sql`

---

## ⚠️ CRITICAL: READ BEFORE PROCEEDING

This will **PERMANENTLY DELETE 2,577 records** from your database.

**What gets deleted:**
- All payroll records (1,116)
- All auth logs (1,090)
- All orders, payments, guests
- All stock requests
- All notifications
- All rooms
- All transactional data

**What gets kept:**
- Users (27)
- Staff profiles (372)
- Menu items (253)
- Branches (10)
- Departments (12)
- Vehicles (3)
- All inventory/warehouse structures
- All storage uploads

---

## 📋 STEP-BY-STEP EXECUTION

### STEP 1: CREATE BACKUP (MANDATORY!)

1. Open your browser
2. Go to: https://supabase.com/dashboard
3. Select your project
4. Click **"Database"** in left sidebar
5. Click **"Backups"** tab
6. Click **"Create Backup"** button
7. Wait for backup to complete (shows green checkmark)
8. **DO NOT PROCEED** until backup is complete

---

### STEP 2: OPEN SQL EDITOR

1. In Supabase Dashboard
2. Click **"SQL Editor"** in left sidebar
3. Click **"New Query"**

---

### STEP 3: COPY THE CLEANUP SCRIPT

1. Open the file: `EXECUTE-CLEANUP.sql`
2. Select ALL content (Ctrl+A / Cmd+A)
3. Copy (Ctrl+C / Cmd+C)

---

### STEP 4: PASTE AND RUN

1. Paste into Supabase SQL Editor (Ctrl+V / Cmd+V)
2. Click **"Run"** button (or press Ctrl+Enter)
3. Wait for execution to complete (may take 30-60 seconds)

---

### STEP 5: REVIEW THE OUTPUT

The script will show you:

```
✅ MASTER DATA (KEPT)
  users                    27
  branches                 10
  staff_profiles          372
  departments              12
  room_types                6
  restaurant_menu_items   253
  restaurant_menu_categories 35
  vehicles                  3
  maintenance_spare_parts   2
  kenyan_public_holidays    7

❌ TRANSACTIONAL DATA (SHOULD BE 0)
  payroll_records           0
  auth_logs                 0
  notifications             0
  stock_requests            0
  restaurant_orders         0
  payments                  0
  guests                    0
  rooms                     0
  ... (all should be 0)
```

**Check carefully:**
- ✅ Master data counts match expected values
- ✅ All transactional tables show 0
- ✅ No unexpected deletions

---

### STEP 6: COMMIT OR ROLLBACK

#### If Everything Looks Good:

1. In the SQL Editor, type:
   ```sql
   COMMIT;
   ```
2. Click **"Run"**
3. Changes are now **PERMANENT**

#### If Something is Wrong:

1. In the SQL Editor, type:
   ```sql
   ROLLBACK;
   ```
2. Click **"Run"**
3. All changes are **UNDONE**
4. Database returns to original state

---

### STEP 7: VERIFY APPLICATION

After committing:

1. **Test Login**
   - Go to your application
   - Login with a user account
   - Verify login works

2. **Check Staff Profiles**
   - Navigate to staff section
   - Verify 372 staff profiles load
   - Check data displays correctly

3. **Check Menu Items**
   - Navigate to restaurant menu
   - Verify 253 menu items load
   - Check prices and categories

4. **Check Branches**
   - Navigate to branches section
   - Verify all 10 branches show
   - Check branch details

5. **Check for Errors**
   - Open browser console (F12)
   - Look for any error messages
   - Verify no 404 or 500 errors

---

## 🆘 TROUBLESHOOTING

### Problem: Script fails with error

**Solution:**
1. Read the error message carefully
2. Type `ROLLBACK;` and run
3. Check if table names are correct
4. Contact support if needed

### Problem: Some transactional tables still have data

**Solution:**
1. Type `ROLLBACK;` and run
2. Check which tables still have data
3. May need to delete in different order
4. Contact support

### Problem: Master data was deleted

**Solution:**
1. **IMMEDIATELY** type `ROLLBACK;` and run
2. Do NOT commit
3. Restore from backup:
   - Go to Database → Backups
   - Select the backup you created
   - Click "Restore"

### Problem: Application breaks after cleanup

**Solution:**
1. Check browser console for errors
2. Verify database connection
3. Check if RLS policies are intact
4. If critical, restore from backup

---

## ✅ SUCCESS CHECKLIST

After cleanup, verify:

- [ ] Login works
- [ ] Staff profiles load (372 records)
- [ ] Menu items display (253 records)
- [ ] Branches accessible (10 records)
- [ ] No console errors
- [ ] No 404/500 errors
- [ ] All features work
- [ ] Transactional tables are empty
- [ ] Master data intact

---

## 📊 EXPECTED RESULTS

### Before Cleanup:
- Total Records: 3,310
- Tables with Data: 24

### After Cleanup:
- Total Records: 733
- Tables with Data: 10
- Reduction: 78%

---

## 🔐 SECURITY NOTES

- Script runs in a transaction (safe)
- Can rollback before commit
- Backup created before execution
- No data loss if you rollback
- Master data is preserved
- Inventory structures preserved
- Storage uploads preserved

---

## ⏱️ ESTIMATED TIME

- Backup creation: 2-5 minutes
- Script execution: 30-60 seconds
- Verification: 5-10 minutes
- **Total: ~10-15 minutes**

---

## 📞 NEED HELP?

If you encounter issues:

1. **DO NOT PANIC**
2. Type `ROLLBACK;` and run
3. Take a screenshot of any errors
4. Check the backup exists
5. Contact your database administrator

---

## ✅ READY TO PROCEED?

**Pre-flight checklist:**

- [ ] I have read all instructions
- [ ] I have created a backup
- [ ] I have verified backup exists
- [ ] I understand what will be deleted
- [ ] I understand what will be kept
- [ ] I know how to COMMIT or ROLLBACK
- [ ] I am ready to execute

---

## 🚀 EXECUTE NOW

1. Create backup ✓
2. Open SQL Editor ✓
3. Copy `EXECUTE-CLEANUP.sql` ✓
4. Paste and Run ✓
5. Review output ✓
6. Type `COMMIT;` or `ROLLBACK;` ✓
7. Verify application ✓

---

**Good luck! 🍀**
