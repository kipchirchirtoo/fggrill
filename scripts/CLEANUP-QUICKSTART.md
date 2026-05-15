# Database Cleanup - Quick Start Guide

## 🚀 Quick Start (5 Steps)

### Step 1: Analyze Current State
```bash
cd /path/to/fggrill
ts-node scripts/analyze-database-data.ts
```
**Review the output** - understand what data exists

---

### Step 2: Backup Database
1. Open Supabase Dashboard
2. Go to **Database → Backups**
3. Click **"Create Backup"**
4. Wait for completion ✅

---

### Step 3: Dry-Run Cleanup
```bash
ts-node scripts/cleanup-test-data.ts
```
**Review what would be deleted** - ensure no production data

---

### Step 4: Execute Cleanup
```bash
# Only if dry-run looks good!
ts-node scripts/cleanup-test-data.ts --execute
```

---

### Step 5: Verify
```bash
# Re-analyze
ts-node scripts/analyze-database-data.ts

# Test application
# - Login
# - Create order
# - Check reports
```

---

## 🎯 What Gets Deleted

### ✅ Safe to Delete (Seed Data)
- Bar drinks (60+ items from migration)
- Kitchen food controls (standard yields)
- Kitchen variance reasons
- Sample restaurant sections
- Default departments (if unused)

### ⚠️ Review Before Delete (Test Data)
- Users with test/demo/sample in email
- Bookings with test guest names
- Payments with test references
- Orders marked as test
- Communications with test content

### ❌ Never Delete (Production Data)
- Real user accounts
- Verified payments
- Completed bookings
- Processed payroll
- Financial records
- Approved stock requests

---

## 🛡️ Safety Features

- ✅ **Dry-run by default** - no changes unless `--execute`
- ✅ **Production protection** - blocks if `NODE_ENV=production`
- ✅ **Estimation first** - shows counts before deletion
- ✅ **5-second countdown** - time to cancel
- ✅ **Detailed logging** - track all operations

---

## 🔧 Alternative: Manual SQL Cleanup

If you prefer manual control:

```sql
-- In Supabase SQL Editor

BEGIN;  -- Start transaction

-- Check what exists
SELECT COUNT(*) FROM bar_drinks;

-- Delete seed data (uncomment to execute)
-- DELETE FROM bar_drinks WHERE name IN ('Tusker Lager', 'Heineken', ...);

-- Verify
SELECT COUNT(*) FROM bar_drinks;

-- If good:
COMMIT;

-- If not good:
ROLLBACK;
```

---

## 📋 Pre-Flight Checklist

Before running cleanup:

- [ ] Database backup created
- [ ] Backup verified in Supabase Dashboard
- [ ] Dry-run executed and reviewed
- [ ] No production data in deletion list
- [ ] Application tested in development
- [ ] Team notified (if applicable)
- [ ] Rollback plan ready

---

## 🆘 Emergency Rollback

If something goes wrong:

1. **Stop immediately** - Don't run more scripts
2. **Check Supabase Dashboard** - Database → Backups
3. **Restore backup** - Select backup → Click "Restore"
4. **Wait for completion** - Don't interrupt
5. **Verify restoration** - Check data is back
6. **Test application** - Ensure everything works

---

## 📞 Need Help?

1. Read full documentation: `scripts/README-CLEANUP.md`
2. Check common issues section
3. Review error messages carefully
4. Restore from backup if unsure
5. Contact database administrator

---

## ⚡ One-Liner Commands

```bash
# Full cleanup workflow
ts-node scripts/analyze-database-data.ts && \
ts-node scripts/cleanup-test-data.ts && \
read -p "Review output. Execute? (y/n) " -n 1 -r && \
[[ $REPLY =~ ^[Yy]$ ]] && ts-node scripts/cleanup-test-data.ts --execute

# Analyze only
ts-node scripts/analyze-database-data.ts

# Dry-run only
ts-node scripts/cleanup-test-data.ts

# Execute (after dry-run)
ts-node scripts/cleanup-test-data.ts --execute

# Clean specific table
ts-node scripts/cleanup-test-data.ts --execute --only=bar_drinks
```

---

## 📊 Expected Results

### Before Cleanup
```
Total Tables: 60+
Tables with Data: 40+
Total Records: 10,000+
```

### After Cleanup (Seed Data Only)
```
Total Tables: 60+
Tables with Data: 35+
Total Records: 9,500+
Removed: ~500 seed records
```

### After Full Cleanup (Seed + Test Data)
```
Total Tables: 60+
Tables with Data: 30+
Total Records: 8,000+
Removed: ~2,000 test records
```

*Actual numbers depend on your database state*

---

## 🎓 Understanding the Output

### Analysis Output
```
📊 TABLES WITH DATA:
🏢📅 users                    150 records
🏢📅 bookings                 45 records
   bar_drinks                 60 records
```

**Legend:**
- 🏢 = Has `branch_id` (multi-branch data)
- 📅 = Has `created_at` (can filter by date)
- No icons = Global data

### Cleanup Output
```
Checking: Bar drinks seed data
  ⚠️  Found 60 records to delete

Total records to delete: 60
```

---

## ✅ Success Indicators

After cleanup, you should see:

1. **Reduced record counts** in analysis
2. **No application errors** when testing
3. **All features working** (login, orders, reports)
4. **No orphaned records** in verification queries
5. **Faster queries** (after VACUUM ANALYZE)

---

## 🚨 Warning Signs

Stop and restore backup if you see:

- ❌ Application won't load
- ❌ Login fails for real users
- ❌ Foreign key errors in logs
- ❌ Missing critical data
- ❌ Reports show zero data
- ❌ Features broken

---

## 💡 Pro Tips

1. **Run during low-traffic hours** - minimize impact
2. **Notify team first** - avoid surprises
3. **Keep backup for 7 days** - in case issues appear later
4. **Document what you delete** - for future reference
5. **Test thoroughly** - don't assume it worked
6. **Run VACUUM ANALYZE** - optimize after cleanup
7. **Monitor for 24 hours** - watch for issues

---

## 📅 Recommended Schedule

- **Daily**: Not needed
- **Weekly**: Not needed
- **Monthly**: Review for test data accumulation
- **Quarterly**: Full analysis and cleanup
- **Annually**: Deep cleanup and optimization

---

## 🔐 Security Notes

- Scripts use `SUPABASE_SERVICE_ROLE_KEY` from `.env`
- Never commit `.env` file to git
- Never share service role key
- Rotate keys after team member leaves
- Use read-only keys for analysis when possible

---

**Remember: When in doubt, DON'T delete. Restore from backup instead.**
