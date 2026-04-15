# PHASE 2 Migration Guide

**Date:** April 15, 2026  
**Purpose:** Safe application of PHASE 2 schema and backfill migrations

---

## Overview

This guide explains how to safely apply PHASE 2 migrations using the provided scripts. These migrations add branch isolation to staff tables and backfill NULL branch_id values across the system.

---

## Prerequisites

### 1. Database Access
You need a PostgreSQL connection string with admin privileges:
- **Supabase:** `postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres`
- **Self-hosted:** `postgresql://user:password@host:port/database`

### 2. PostgreSQL Client
Install `psql` (PostgreSQL command-line client):

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql-client
```

**macOS:**
```bash
brew install postgresql
```

**Windows:**
- Download from: https://www.postgresql.org/download/windows/
- Or via Chocolatey: `choco install postgresql`

### 3. At Least One Branch
The database must have at least one branch in the `branches` table. The script will offer to create one if none exists.

---

## Environment Variables

Set your database connection string:

### Linux/macOS:
```bash
export DATABASE_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"
```

Or for Supabase specifically:
```bash
export SUPABASE_DB_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"
```

### Windows (Command Prompt):
```cmd
set DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

### Windows (PowerShell):
```powershell
$env:DATABASE_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"
```

---

## Running the Migration Script

### Linux/macOS:

1. **Make script executable:**
   ```bash
   chmod +x backend/scripts/apply-phase2-migrations.sh
   ```

2. **Run the script:**
   ```bash
   ./backend/scripts/apply-phase2-migrations.sh
   ```

### Windows:

1. **Run the batch script:**
   ```cmd
   backend\scripts\apply-phase2-migrations.bat
   ```

---

## What the Script Does

### 1. Pre-flight Checks
- ✅ Verifies environment variables are set
- ✅ Checks if `psql` is installed
- ✅ Tests database connection
- ✅ Verifies migration files exist
- ✅ Checks if branches table has data

### 2. Backup Creation
- ✅ Creates `backups/` directory if needed
- ✅ Generates timestamped backup file
- ✅ Backs up entire database before changes

### 3. Migration 1: Add branch_id Columns
- ✅ Adds `branch_id` to `staff_profiles`
- ✅ Adds `branch_id` to `staff_schedules`
- ✅ Adds `branch_id` to `staff_leave`
- ✅ Adds `branch_id` to `staff_payroll`
- ✅ Adds `branch_id` to `staff_performance`
- ✅ Creates performance indexes
- ✅ Updates RLS policies for branch isolation
- ✅ Creates auto-population triggers

### 4. Verification 1
- ✅ Confirms all columns were created
- ✅ Confirms all indexes were created
- ✅ Reports any issues

### 5. Migration 2: Backfill NULL Values
- ✅ Populates `branch_id` for 16 tables
- ✅ Uses intelligent defaults based on related data
- ✅ Reports progress for each table
- ✅ Shows total records updated

### 6. Verification 2
- ✅ Checks for remaining NULL values
- ✅ Reports any tables with NULL branch_ids
- ✅ Confirms backfill success

### 7. Summary
- ✅ Shows what was applied
- ✅ Shows backup location
- ✅ Provides next steps

---

## Script Output Example

```
========================================
PHASE 2 Migration Application Script
========================================
This script will safely apply PHASE 2 migrations:
  1. Add branch_id columns to staff tables
  2. Backfill NULL branch_id values

========================================
Checking Environment Variables
========================================
✓ Using DATABASE_URL

========================================
Checking PostgreSQL Client
========================================
✓ psql is installed: psql (PostgreSQL) 14.5

========================================
Testing Database Connection
========================================
✓ Database connection successful

========================================
Checking Migration Files
========================================
✓ All migration files found

========================================
Checking Branches Table
========================================
✓ Found 2 branch(es)

⚠ This will modify your database schema and data
Do you want to proceed? (y/n) y

========================================
Creating Database Backup
========================================
ℹ Backing up database to: backups/backup_before_phase2_20260415_143022.sql
✓ Backup created successfully
ℹ Backup size: 45M

========================================
Applying Migration: 20260415_add_branch_id_to_staff_profiles.sql
========================================
ℹ Executing migration...
✓ Migration applied successfully

ℹ Migration Summary:
  Migration 20260415_add_branch_id_to_staff_profiles completed successfully
  Added branch_id to: staff_profiles, staff_schedules, staff_leave, staff_payroll, staff_performance
  Updated RLS policies for branch isolation
  Created auto-population triggers for related tables
  NEXT STEP: Run backfill script to populate NULL branch_id values

========================================
Verifying Migration 1 Results
========================================
✓ Column branch_id exists in staff_profiles
✓ Column branch_id exists in staff_schedules
✓ Column branch_id exists in staff_leave
✓ Column branch_id exists in staff_payroll
✓ Column branch_id exists in staff_performance
✓ Index idx_staff_profiles_branch_id exists
✓ Index idx_staff_schedules_branch_id exists
✓ Index idx_staff_leave_branch_id exists
✓ Index idx_staff_payroll_branch_id exists
✓ Index idx_staff_performance_branch_id exists
✓ Migration 1 verification passed

========================================
Applying Migration: 20260415_backfill_null_branch_ids.sql
========================================
ℹ Executing migration...
✓ Migration applied successfully

ℹ Migration Summary:
  Starting branch_id backfill process
  Default branch_id: 1
  
  1. Backfilling staff_profiles...
     Updated 45 staff_profiles records
  
  2. Backfilling staff_schedules...
     Updated 230 staff_schedules records
  
  ... (continues for all 16 tables)
  
  Backfill process completed successfully
  Total records updated: 3,456

========================================
Verifying Migration 2 Results
========================================
✓ Table staff_profiles: All records have branch_id
✓ Table bookings: All records have branch_id
✓ Table restaurant_orders: All records have branch_id
✓ Table bar_orders: All records have branch_id
✓ Table finance_transactions: All records have branch_id
✓ Migration 2 verification passed - No NULL branch_ids found

========================================
Migration Summary
========================================
Migrations Applied:
  ✓ 20260415_add_branch_id_to_staff_profiles.sql
  ✓ 20260415_backfill_null_branch_ids.sql

Backup Location:
  backups/backup_before_phase2_20260415_143022.sql

Next Steps:
  1. Review the migration output above
  2. Test branch isolation in your application
  3. Review inventory item assignments:
     psql $DATABASE_URL -c "SELECT sku, name, branch_id FROM simple_items;"
  4. Update application code to include branch_id filters
  5. Deploy updated desktop app with security fixes

✓ PHASE 2 migrations completed successfully!
```

---

## Troubleshooting

### Error: "psql: command not found"
**Solution:** Install PostgreSQL client (see Prerequisites section)

### Error: "Failed to connect to database"
**Solutions:**
1. Check your connection string is correct
2. Verify database is running
3. Check firewall/network access
4. For Supabase: Ensure you're using the correct password and project reference

### Error: "No branches found in database"
**Solution:** The script will offer to create a default branch. Accept this or create one manually:
```sql
INSERT INTO branches (name, location, status) 
VALUES ('Main Branch', 'Main Location', 'active');
```

### Error: "Migration failed"
**Solution:** 
1. Check the error details in the output
2. The script automatically rolls back the failed migration
3. If needed, restore from backup (script will prompt)
4. Fix the underlying issue and re-run

### Warning: "Table X has Y records with NULL branch_id"
**This may be expected for:**
- New tables that weren't included in backfill
- Tables where NULL is intentional
- Tables that need manual review (like inventory)

**Action:** Review these records and assign branch_id manually if needed

---

## Manual Migration (Alternative)

If you prefer to run migrations manually:

### 1. Connect to database:
```bash
psql "$DATABASE_URL"
```

### 2. Create backup:
```bash
pg_dump "$DATABASE_URL" > backup_before_phase2.sql
```

### 3. Run migrations:
```sql
\i backend/supabase/migrations/20260415_add_branch_id_to_staff_profiles.sql
\i backend/supabase/migrations/20260415_backfill_null_branch_ids.sql
```

### 4. Verify results:
```sql
-- Check for NULL branch_ids
SELECT 'staff_profiles' as table_name, COUNT(*) as null_count
FROM staff_profiles WHERE branch_id IS NULL
UNION ALL
SELECT 'bookings', COUNT(*) FROM bookings WHERE branch_id IS NULL;
-- ... repeat for other tables
```

---

## Rollback Procedure

If you need to rollback the migrations:

### Using Backup (Recommended):
```bash
psql "$DATABASE_URL" < backups/backup_before_phase2_[timestamp].sql
```

### Manual Rollback:
```sql
-- Remove branch_id columns
ALTER TABLE staff_profiles DROP COLUMN IF EXISTS branch_id;
ALTER TABLE staff_schedules DROP COLUMN IF EXISTS branch_id;
ALTER TABLE staff_leave DROP COLUMN IF EXISTS branch_id;
ALTER TABLE staff_payroll DROP COLUMN IF EXISTS branch_id;
ALTER TABLE staff_performance DROP COLUMN IF EXISTS branch_id;

-- Drop triggers
DROP TRIGGER IF EXISTS populate_staff_schedule_branch_id ON staff_schedules;
DROP TRIGGER IF EXISTS populate_staff_leave_branch_id ON staff_leave;
DROP TRIGGER IF EXISTS populate_staff_payroll_branch_id ON staff_payroll;
DROP TRIGGER IF EXISTS populate_staff_performance_branch_id ON staff_performance;

-- Drop function
DROP FUNCTION IF EXISTS populate_staff_related_branch_id();

-- Restore original RLS policies (from backup)
```

---

## Post-Migration Tasks

### 1. Review Inventory Assignments
```sql
SELECT sku, name, branch_id, category 
FROM simple_items 
ORDER BY category, name;
```

If items are assigned to wrong branch:
```sql
UPDATE simple_items 
SET branch_id = 2 
WHERE sku IN ('SKU001', 'SKU002', ...);
```

### 2. Test Branch Isolation
- Log in as branch manager
- Verify they can only see their branch's data
- Log in as super admin
- Verify they can see all branches

### 3. Update Application Code
Add branch_id filters to all queries:
```typescript
// Before
const orders = await supabase.from('restaurant_orders').select('*');

// After
const orders = await supabase
  .from('restaurant_orders')
  .select('*')
  .eq('branch_id', userBranchId);
```

### 4. Deploy Security Fixes
- Build new desktop app with security fixes
- Distribute to all users
- Deprecate old versions

---

## Support

For issues or questions:
- Review: `PHASE_2_SECURITY_FIXES_APPLIED.md`
- Review: `PHASE_2_SCHEMA_FIXES_APPLIED.md`
- Review: `PHASE_2_COMPLETE_SUMMARY.md`
- Check: `PHASE_1_BUG_REPORT.md` for context

---

## Safety Features

The migration script includes:
- ✅ Automatic database backup before changes
- ✅ Transaction-based migrations (auto-rollback on error)
- ✅ Pre-flight checks to prevent common issues
- ✅ Verification steps after each migration
- ✅ Detailed progress reporting
- ✅ Option to restore from backup if needed
- ✅ Confirmation prompts before destructive operations

---

**Last Updated:** April 15, 2026  
**Script Version:** 1.0  
**Tested On:** PostgreSQL 14.5, Supabase
