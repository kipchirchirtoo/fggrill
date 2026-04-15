# PHASE 2 Migrations - Quick Start Guide

**⚠️ IMPORTANT: Read this before running migrations!**

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Set Environment Variable

**Linux/macOS:**
```bash
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres"
```

**Windows (Command Prompt):**
```cmd
set DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres
```

**Windows (PowerShell):**
```powershell
$env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres"
```

### Step 2: Run Migration Script

**Linux/macOS:**
```bash
chmod +x backend/scripts/apply-phase2-migrations.sh
./backend/scripts/apply-phase2-migrations.sh
```

**Windows:**
```cmd
backend\scripts\apply-phase2-migrations.bat
```

### Step 3: Follow Prompts
The script will:
1. Check prerequisites
2. Create automatic backup
3. Apply migrations
4. Verify results
5. Show summary

**That's it!** ✅

---

## 📋 What Gets Changed

### Migration 1: Add branch_id Columns
- Adds `branch_id` to 5 staff tables
- Creates 5 performance indexes
- Updates 20 RLS policies
- Creates 4 auto-population triggers

### Migration 2: Backfill NULL Values
- Populates `branch_id` for 16 tables
- Updates thousands of existing records
- Uses intelligent defaults

---

## ⚠️ Before You Run

### Prerequisites Checklist
- [ ] PostgreSQL client (`psql`) installed
- [ ] Database connection string ready
- [ ] At least one branch exists in database
- [ ] Tested on staging environment first (recommended)
- [ ] Have 15-30 minutes for migration to complete

### Get Your Connection String

**Supabase:**
1. Go to: Project Settings → Database
2. Copy: Connection string (URI)
3. Replace `[YOUR-PASSWORD]` with your actual password

**Format:**
```
postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

---

## 🛡️ Safety Features

The script automatically:
- ✅ Creates backup before any changes
- ✅ Verifies prerequisites
- ✅ Tests database connection
- ✅ Rolls back on error
- ✅ Verifies results after each migration
- ✅ Offers to restore from backup if needed

---

## 📊 Expected Results

### Before Migrations:
```
staff_profiles table: NO branch_id column
Existing records: NULL branch_id values
Branch isolation: NOT WORKING
```

### After Migrations:
```
staff_profiles table: HAS branch_id column ✓
Existing records: ALL have branch_id values ✓
Branch isolation: WORKING ✓
```

---

## 🔍 Verify Success

After migration completes, check:

```sql
-- Should return 0 (no NULL values)
SELECT COUNT(*) FROM staff_profiles WHERE branch_id IS NULL;

-- Should show branch distribution
SELECT branch_id, COUNT(*) 
FROM staff_profiles 
GROUP BY branch_id;
```

---

## 🆘 Troubleshooting

### "psql: command not found"
**Install PostgreSQL client:**
- Ubuntu: `sudo apt-get install postgresql-client`
- macOS: `brew install postgresql`
- Windows: Download from postgresql.org

### "Failed to connect to database"
**Check:**
1. Connection string is correct
2. Password is correct
3. Database is running
4. Firewall allows connection

### "No branches found"
**The script will offer to create one automatically**
- Just answer 'y' when prompted
- Or create manually before running

### Migration Failed
**Don't panic!**
1. Migration automatically rolled back
2. Script offers to restore from backup
3. Check error message for details
4. Fix issue and re-run

---

## 📞 Need Help?

**Read the full guide:**
- `backend/scripts/MIGRATION_GUIDE.md` - Complete documentation
- `PHASE_2_SCHEMA_FIXES_APPLIED.md` - What the migrations do
- `PHASE_2_COMPLETE_SUMMARY.md` - Full PHASE 2 summary

**Common Issues:**
- Connection problems → Check connection string
- Permission errors → Use admin/postgres user
- Timeout errors → Database may be slow, try again

---

## ✅ Post-Migration Checklist

After successful migration:

- [ ] Review migration output for any warnings
- [ ] Check inventory item assignments:
  ```sql
  SELECT sku, name, branch_id FROM simple_items;
  ```
- [ ] Test branch isolation in application
- [ ] Update application code to include branch_id filters
- [ ] Deploy updated desktop app with security fixes
- [ ] Train users on branch-specific features

---

## 🎯 Next Steps

1. **Test thoroughly** on staging before production
2. **Review inventory** assignments (may need manual adjustment)
3. **Update application code** to use branch_id filters
4. **Deploy security fixes** from PHASE 2
5. **Monitor** for any issues

---

## 📝 Example Session

```bash
$ export DATABASE_URL="postgresql://postgres:mypass@db.abc123.supabase.co:5432/postgres"
$ ./backend/scripts/apply-phase2-migrations.sh

========================================
PHASE 2 Migration Application Script
========================================
This script will safely apply PHASE 2 migrations:
  1. Add branch_id columns to staff tables
  2. Backfill NULL branch_id values

✓ Using DATABASE_URL
✓ psql is installed
✓ Database connection successful
✓ All migration files found
✓ Found 2 branch(es)

⚠ This will modify your database schema and data
Do you want to proceed? (y/n) y

✓ Backup created successfully
✓ Migration 1 applied successfully
✓ Migration 1 verification passed
✓ Migration 2 applied successfully
✓ Migration 2 verification passed

✓ PHASE 2 migrations completed successfully!
```

---

**Ready to proceed?** Run the script and follow the prompts! 🚀

**Questions?** Check `backend/scripts/MIGRATION_GUIDE.md` for detailed documentation.

---

**Last Updated:** April 15, 2026  
**Estimated Time:** 15-30 minutes  
**Difficulty:** Easy (script handles everything)
