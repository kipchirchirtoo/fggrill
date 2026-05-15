# Database Test Data Cleanup Guide

## Overview

This directory contains scripts to safely identify and remove sample/mock/test data from the FamousGates database.

## ⚠️ CRITICAL WARNINGS

1. **ALWAYS backup your database before running cleanup scripts**
2. **Test in development environment first**
3. **Review all data before deletion**
4. **Use dry-run mode first**
5. **Never run in production without explicit approval**

## Scripts

### 1. `analyze-database-data.ts`
**Purpose:** Analyze database to identify all data and potential test records

**Usage:**
```bash
cd /path/to/fggrill
ts-node scripts/analyze-database-data.ts
```

**Output:**
- Table-by-table record counts
- Identification of tables with branch_id (multi-branch data)
- Identification of tables with created_at (time-based filtering)
- Detection of test/demo/sample data patterns
- Recommendations for cleanup
- Detailed JSON report: `database-analysis-report.json`

**When to use:**
- Before any cleanup operation
- To understand current database state
- To identify what data exists
- To plan cleanup strategy

---

### 2. `check-seed-data.sql`
**Purpose:** SQL script to check for seed/sample data in specific tables

**Usage:**
```sql
-- In Supabase SQL Editor or psql
\i scripts/check-seed-data.sql
```

**What it checks:**
1. Bar drinks seed data (from migration 20251128_bar_seed_data.sql)
2. Kitchen food controls seed data
3. Kitchen variance reasons seed data
4. Restaurant menu items
5. Default departments
6. Kenyan public holidays
7. Payroll policies
8. HR settings
9. Restaurant sections
10. Maintenance spare parts
11. All transactional data counts
12. Test/demo users
13. Branch information
14. Data distribution by branch
15. Recent data activity (last 7 days)

**Output:**
- Detailed counts per category
- Sample data from each table
- Summary of findings

---

### 3. `cleanup-test-data.sql`
**Purpose:** SQL script for manual cleanup with transaction support

**Usage:**
```sql
-- In Supabase SQL Editor
BEGIN;

-- Uncomment sections you want to execute
-- Review the script carefully

-- If satisfied:
COMMIT;

-- If not satisfied:
ROLLBACK;
```

**Features:**
- Transaction-based (can rollback)
- Commented by default (must uncomment to execute)
- Organized by data type
- Includes verification queries
- Dependency-aware deletion order

**Sections:**
1. Bar drinks seed data
2. Kitchen food controls seed data
3. Kitchen variance reasons seed data
4. Sample restaurant sections
5. Sample maintenance spare parts
6. Default departments (if unused)
7. Test/demo users
8. Transactional test data (orders, bookings, payments, etc.)
9. Orphaned records cleanup
10. Database optimization (VACUUM ANALYZE)

---

### 4. `cleanup-test-data.ts`
**Purpose:** TypeScript script with dry-run support and safety checks

**Usage:**
```bash
# Dry-run (default - no changes)
ts-node scripts/cleanup-test-data.ts

# Execute cleanup
ts-node scripts/cleanup-test-data.ts --execute

# Clean specific table only
ts-node scripts/cleanup-test-data.ts --execute --only=bar_drinks
```

**Features:**
- ✅ Dry-run mode by default
- ✅ Environment-based safety checks
- ✅ Prevents execution in production
- ✅ Detailed logging
- ✅ Estimation before deletion
- ✅ Dependency-aware execution order
- ✅ 5-second countdown before execution

**Safety Checks:**
- Requires `--execute` flag to make changes
- Blocks execution if `NODE_ENV=production`
- Shows estimates before deletion
- Provides 5-second cancel window

---

## Cleanup Strategy

### Phase 1: Analysis (REQUIRED FIRST STEP)
```bash
# 1. Analyze current database state
ts-node scripts/analyze-database-data.ts

# 2. Review the output and database-analysis-report.json
# 3. Identify what needs to be cleaned
```

### Phase 2: Verification
```bash
# Run SQL checks
# In Supabase SQL Editor:
\i scripts/check-seed-data.sql

# Review all output carefully
# Identify production vs test data
```

### Phase 3: Backup
```bash
# In Supabase Dashboard:
# 1. Go to Database → Backups
# 2. Create manual backup
# 3. Wait for completion
# 4. Verify backup exists
```

### Phase 4: Dry-Run Cleanup
```bash
# Test cleanup without making changes
ts-node scripts/cleanup-test-data.ts

# Review what would be deleted
# Verify no production data is targeted
```

### Phase 5: Execute Cleanup
```bash
# Option A: TypeScript script (recommended for seed data)
ts-node scripts/cleanup-test-data.ts --execute

# Option B: SQL script (for manual control)
# In Supabase SQL Editor:
# 1. Open scripts/cleanup-test-data.sql
# 2. Uncomment sections to execute
# 3. Run in transaction (BEGIN...COMMIT/ROLLBACK)
```

### Phase 6: Verification
```bash
# 1. Re-run analysis
ts-node scripts/analyze-database-data.ts

# 2. Compare before/after reports
# 3. Verify application functionality
# 4. Check for any broken references
```

### Phase 7: Optimization
```sql
-- In Supabase SQL Editor:
VACUUM ANALYZE;
```

---

## Data Categories

### Seed Data (Safe to Remove)
These are inserted by migrations and can be safely removed:

1. **Bar Drinks** (`bar_drinks`)
   - 60+ drinks seeded from `20251128_bar_seed_data.sql`
   - Includes beers, spirits, wines, cocktails, soft drinks

2. **Kitchen Food Controls** (`kitchen_food_controls`)
   - Standard yield rules for common ingredients
   - BEEF/MBUZI, CHICKEN, FISH, RICE, etc.

3. **Kitchen Variance Reasons** (`kitchen_variance_reasons`)
   - Over-portioning, Under-portioning, Spillage, etc.

4. **Kenyan Public Holidays** (`kenyan_public_holidays`)
   - Seeded holidays for payroll calculations

5. **Payroll Policies** (`payroll_policies`)
   - Default PAYE, NSSF, NHIF rates

6. **HR Settings** (`hr_settings`)
   - Default statutory rates

7. **Default Departments** (`departments`)
   - Management, Front Office, Housekeeping, etc.
   - Only if no staff assigned

### Test Data (Review Before Removing)
These may contain production data mixed with test data:

1. **Test Users** (`users`)
   - Users with test/demo/sample/example in email
   - **VERIFY** before deletion

2. **Test Bookings** (`bookings`)
   - Bookings with test guest names/emails
   - **VERIFY** before deletion

3. **Test Payments** (`payments`)
   - Payments with test references
   - **VERIFY** before deletion

4. **Test Orders** (`restaurant_orders`, `bar_orders`, `kitchen_orders`)
   - Orders marked as test or very old
   - **VERIFY** before deletion

5. **Test Communications** (`business_communications`)
   - Messages with test in subject/content
   - **VERIFY** before deletion

### Transactional Data (DO NOT REMOVE WITHOUT APPROVAL)
These are likely production data:

- `bookings` (without test markers)
- `restaurant_orders` (recent)
- `restaurant_bills`
- `payments` (verified)
- `invoices`
- `credit_bills` (real customers)
- `stock_requests` (approved)
- `stock_dispatches`
- `purchase_orders`
- `attendance_records` (real staff)
- `payroll_records` (processed)
- `staff_loans`
- `daily_financial_records`

### Orphaned Records (Safe to Remove After Parent Deletion)
These reference deleted records:

- `attendance_records` for deleted users
- `notifications` for deleted users
- `restaurant_order_items` for deleted orders
- `restaurant_bill_items` for deleted bills

---

## Deletion Order (Dependency-Aware)

To avoid foreign key violations, delete in this order:

1. **Child records first:**
   - Order items → Orders
   - Bill items → Bills
   - Notifications → Users

2. **Transactional data:**
   - Payments
   - Orders
   - Bookings
   - Stock requests

3. **Master data:**
   - Users
   - Departments
   - Menu items

4. **Seed data:**
   - Bar drinks
   - Kitchen controls
   - Variance reasons

---

## Environment Variables

All scripts read from `backend/.env`:

```env
# Required
SUPABASE_PROJECT_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional
NODE_ENV=development  # Prevents execution in production
```

**Never hardcode these values in scripts!**

---

## Safety Features

### 1. Dry-Run Mode
- Default mode for TypeScript script
- Shows what would be deleted without making changes
- Provides estimates

### 2. Transaction Support
- SQL script runs in transaction
- Can ROLLBACK if something goes wrong
- Changes not permanent until COMMIT

### 3. Environment Checks
- TypeScript script blocks execution in production
- Requires explicit `--execute` flag

### 4. Estimation
- Shows record counts before deletion
- Allows review before proceeding

### 5. Logging
- Detailed logs of all operations
- Success/failure tracking
- Error messages

---

## Verification Steps

After cleanup, verify:

### 1. Data Integrity
```sql
-- Check for orphaned records
SELECT 'Orphaned Attendance' as check, COUNT(*) 
FROM attendance_records 
WHERE user_id NOT IN (SELECT id FROM users);

SELECT 'Orphaned Notifications' as check, COUNT(*) 
FROM notifications 
WHERE user_id IS NOT NULL 
  AND user_id NOT IN (SELECT id FROM users);
```

### 2. Application Functionality
- [ ] Login works
- [ ] Dashboard loads
- [ ] Orders can be created
- [ ] Bookings can be made
- [ ] Reports generate
- [ ] No console errors

### 3. Data Counts
```bash
# Re-run analysis
ts-node scripts/analyze-database-data.ts

# Compare with previous report
diff database-analysis-report.json database-analysis-report-before.json
```

### 4. Foreign Key Integrity
```sql
-- Check for FK violations
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE contype = 'f'
  AND connamespace = 'public'::regnamespace;
```

---

## Rollback Procedures

### If using SQL script:
```sql
-- If still in transaction:
ROLLBACK;

-- If already committed:
-- Restore from backup in Supabase Dashboard
```

### If using TypeScript script:
```bash
# Restore from Supabase backup:
# 1. Go to Database → Backups
# 2. Select backup before cleanup
# 3. Click "Restore"
# 4. Wait for completion
```

---

## Common Issues

### Issue: "Permission denied"
**Solution:** Ensure you're using `SUPABASE_SERVICE_ROLE_KEY`, not anon key

### Issue: "Foreign key violation"
**Solution:** Delete child records before parent records (see deletion order)

### Issue: "Table does not exist"
**Solution:** Table may not exist in your schema. Comment out that section.

### Issue: "Too many records to delete"
**Solution:** Add LIMIT clause and run multiple times:
```sql
DELETE FROM table_name 
WHERE condition 
LIMIT 1000;
```

### Issue: "Script hangs"
**Solution:** Large deletions may take time. Add indexes on filter columns:
```sql
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

---

## Best Practices

1. **Always backup first** - No exceptions
2. **Test in development** - Never test in production
3. **Use dry-run** - Review before executing
4. **Delete incrementally** - Don't delete everything at once
5. **Verify after each step** - Check application works
6. **Document what you delete** - Keep notes
7. **Preserve production data** - When in doubt, don't delete
8. **Use transactions** - So you can rollback
9. **Check dependencies** - Delete children before parents
10. **Optimize after** - Run VACUUM ANALYZE

---

## Support

If you encounter issues:

1. Check the error message carefully
2. Review the verification steps
3. Check foreign key constraints
4. Restore from backup if needed
5. Contact database administrator

---

## Changelog

- **2026-05-14**: Initial cleanup scripts created
  - Analysis script
  - SQL check script
  - SQL cleanup script
  - TypeScript cleanup script
  - Documentation

---

## License

Internal use only - FamousGates Hotels Management System
