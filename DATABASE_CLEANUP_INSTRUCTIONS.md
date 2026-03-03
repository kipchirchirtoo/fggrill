# Database Cleanup for Client Handover - Instructions

## Overview
This guide will help you safely remove all operational data from your Kyogong database while preserving the superadmin login credentials for client handover.

## ⚠️ CRITICAL WARNINGS

1. **This process is IRREVERSIBLE** - All data will be permanently deleted
2. **BACKUP FIRST** - Always create a backup before proceeding
3. **Test environment** - If possible, test this on a staging database first
4. **Downtime required** - The system should be offline during this process

## What Will Be Preserved

✅ **Superadmin user account(s)** - Login credentials with `super_admin` role  
✅ **Database structure** - All tables, columns, and relationships  
✅ **Branches** (optional) - You can choose to keep or remove branch data  
✅ **Configuration tables** - SKU categories and system config structures

## What Will Be Deleted

❌ All financial transactions and records  
❌ All orders, bills, and invoices  
❌ All reservations and bookings  
❌ All inventory and stock data  
❌ All kitchen operations data  
❌ All staff records (except superadmin)  
❌ All supplier data  
❌ All maintenance records  
❌ All audit logs  
❌ All user accounts (except superadmin)

## Step-by-Step Instructions

### Step 1: Create a Backup

**In Supabase Dashboard:**
1. Navigate to **Database** → **Backups**
2. Click **"Create Backup"** or **"Backup Now"**
3. Wait for the backup to complete
4. Download the backup file for safekeeping

**Alternative - Using pg_dump (if you have direct database access):**
```bash
pg_dump -h your-db-host -U postgres -d your-database > backup_before_cleanup.sql
```

### Step 2: Verify Superadmin Exists

Before running the cleanup, verify your superadmin account exists:

```sql
SELECT id, email, first_name, last_name, role, created_at
FROM users
WHERE role = 'super_admin';
```

**Expected result:** You should see at least one user with role `super_admin`

> ⚠️ **STOP HERE** if no superadmin is found! You need to create one first.

### Step 3: Review the Cleanup Script

1. Open the file: `database_cleanup_for_client.sql`
2. Review all DELETE statements
3. Check if there are any tables you want to preserve
4. Modify the script if needed (e.g., keep certain lookup data)

### Step 4: Execute the Cleanup Script

**In Supabase SQL Editor:**

1. Go to **SQL Editor** in your Supabase Dashboard
2. Click **"New Query"**
3. Copy the entire contents of `database_cleanup_for_client.sql`
4. Paste into the SQL editor
5. **DO NOT RUN YET** - Read the next step first

### Step 5: Transaction Safety

The script runs inside a transaction (`BEGIN...COMMIT`). This means:

- Changes are NOT permanent until you run `COMMIT`
- You can review results before committing
- You can `ROLLBACK` if something looks wrong

**Execution process:**

1. Run the script (it will execute up to the verification queries)
2. Review the verification query results:
   - Check that only superadmin users remain
   - Verify all other tables show 0 records
3. If everything looks correct:
   ```sql
   COMMIT;
   ```
4. If something is wrong:
   ```sql
   ROLLBACK;
   ```

### Step 6: Post-Cleanup Tasks

After successfully committing the cleanup:

#### 6.1 Vacuum the Database

Run these commands separately (they cannot run in a transaction):

```sql
VACUUM FULL;
ANALYZE;
```

This will:
- Reclaim disk space from deleted records
- Update database statistics
- Improve query performance

#### 6.2 Clear Storage Buckets

If you have uploaded files in Supabase Storage:

1. Go to **Storage** in Supabase Dashboard
2. For each bucket, delete all files:
   - `staff-photos`
   - `id-cards`
   - `receipts`
   - `invoices`
   - `reports`
   - Any other custom buckets

#### 6.3 Update Superadmin Password (Recommended)

For security, update the superadmin password before handing over:

```sql
-- Replace 'NewSecurePassword' with the actual password
UPDATE users 
SET password = crypt('NewSecurePassword', gen_salt('bf'))
WHERE role = 'super_admin';
```

> 📝 **Note:** Make sure to document the new password securely for the client

#### 6.4 Test the Login

1. Log out of the system
2. Log in using the superadmin credentials
3. Verify you can access the dashboard
4. Check that the system shows empty/clean data

## Troubleshooting

### Error: "No superadmin user found"

**Solution:** Create a superadmin user first:

```sql
INSERT INTO users (
    email, 
    password, 
    first_name, 
    last_name, 
    role, 
    status,
    created_at
) VALUES (
    'admin@kyogong.com',
    crypt('YourSecurePassword', gen_salt('bf')),
    'System',
    'Administrator',
    'super_admin',
    'active',
    NOW()
);
```

### Error: Foreign key constraint violations

**Solution:** The script is ordered to handle foreign keys correctly. If you get this error:
1. Check if you modified the script
2. Ensure you're running the full script, not individual DELETE statements
3. Run `ROLLBACK` and review the script order

### Transaction timeout

**Solution:** For very large databases:
1. Increase the statement timeout in Supabase settings
2. Or run the cleanup in smaller batches
3. Comment out sections and run multiple times

## Alternative: Selective Cleanup

If you want to keep some data (e.g., suppliers, inventory items as templates):

1. Open `database_cleanup_for_client.sql`
2. Comment out the DELETE statements for tables you want to preserve:
   ```sql
   -- DELETE FROM suppliers;  -- Keep suppliers
   -- DELETE FROM inventory_items;  -- Keep as templates
   ```

## Final Checklist

Before handing over to the client:

- [ ] Database backup created and verified
- [ ] Cleanup script executed successfully
- [ ] Only superadmin user(s) remain
- [ ] All transactional data removed
- [ ] Database vacuumed and analyzed
- [ ] Storage buckets cleared
- [ ] Superadmin password updated
- [ ] Login tested successfully
- [ ] New credentials documented for client
- [ ] Client informed about the clean state

## Support

If you encounter any issues during the cleanup process:

1. **DO NOT COMMIT** if you're unsure
2. Run `ROLLBACK` to undo changes
3. Review the error messages
4. Restore from backup if needed

---

**Remember:** Always test on a staging/development database first if possible!
