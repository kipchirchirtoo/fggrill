# 🚀 Apply Security Migration - Step by Step

## Current Status
❌ Migration NOT yet applied  
✅ All dependencies installed (axios, pg)  
✅ Migration SQL file ready  

---

## 📋 STEP-BY-STEP INSTRUCTIONS

### Step 1: Open Supabase SQL Editor

1. Go to: **https://app.supabase.com**
2. **Login** to your account
3. **Select your project** (Famous Gates Hotels)
4. Click **"SQL Editor"** in the left sidebar (looks like a terminal icon)
5. Click **"New Query"** button

### Step 2: Copy the Migration SQL

**Option A: Copy from file**
1. Open the file: `database/migrations/013_add_geolocation_security_fields.sql`
2. Select ALL content (Ctrl+A)
3. Copy (Ctrl+C)

**Option B: Use the content below** (if file is not accessible)

<details>
<summary>Click to expand SQL (if needed)</summary>

The SQL is in: `database/migrations/013_add_geolocation_security_fields.sql`

It contains:
- ALTER TABLE statements to add 14 new columns to auth_logs
- CREATE TABLE statements for 4 new tables
- CREATE INDEX statements for 8 indexes
- CREATE FUNCTION statements for 3 functions
- CREATE TRIGGER statements for 2 triggers
- COMMENT statements for documentation

</details>

### Step 3: Paste and Run

1. **Paste** the SQL into the Supabase SQL Editor (Ctrl+V)
2. **Click "Run"** button (or press Ctrl+Enter)
3. **Wait** for execution (5-10 seconds)
4. **Check for success** message at the bottom

### Step 4: Verify Success

You should see a message like:
```
Success. No rows returned
```

This is CORRECT! The migration creates tables and columns, it doesn't return data.

### Step 5: Run Verification

Back in your terminal:

```bash
cd backend
node check-migration-status.js
```

You should now see:
```
✅ Migration appears to be COMPLETE
```

---

## ✅ Expected Results

After successful migration, you'll have:

### New Columns in `auth_logs`:
- geo_country
- geo_country_code
- geo_region
- geo_city
- geo_latitude
- geo_longitude
- geo_timezone
- geo_isp
- is_proxy
- is_vpn
- is_datacenter
- threat_score
- is_suspicious
- threat_reason

### New Tables:
- ip_blocklist
- ip_whitelist
- active_sessions
- security_alerts

### New Functions:
- detect_brute_force_attempts()
- detect_geo_anomaly()
- cleanup_expired_sessions()

### New Triggers:
- trigger_detect_brute_force
- trigger_detect_geo_anomaly

---

## 🎯 After Migration

### 1. Restart Backend

```bash
cd backend
npm run dev
```

### 2. Test the System

1. **Login** to your account from the frontend
2. **Check Supabase** > Table Editor > `auth_logs`
3. **Look at the latest row** - you should see:
   - Real IP address (not `::1`)
   - `geo_country` populated (e.g., "Kenya")
   - `geo_city` populated (e.g., "Nairobi")
   - `threat_score` calculated (e.g., 0-100)
   - `device_info` with browser/OS

### 3. Access Security Dashboard

Navigate to: **http://localhost:3001/dashboard/super/admin/security**

You should see:
- ✅ Login statistics
- ✅ Real IP addresses
- ✅ Geographic locations
- ✅ Threat detection
- ✅ Four tabs: Access Control, Threat Detection, Geolocation, Active Sessions

---

## ⚠️ Troubleshooting

### Issue: "Permission denied"
**Solution**: Make sure you're logged into Supabase with the correct account that has admin access to the project.

### Issue: "Column already exists"
**Solution**: This is fine! It means the column was already added. Continue with the rest of the migration.

### Issue: "Table already exists"
**Solution**: This is fine! Skip that statement and continue.

### Issue: SQL Editor shows error
**Solution**: 
1. Check the error message
2. If it says "already exists", that's OK
3. If it's a syntax error, make sure you copied the entire SQL file
4. Try running statements one section at a time

### Issue: Geolocation not working
**Solution**: 
1. Check your server has internet access
2. Try accessing: http://ip-api.com/json/8.8.8.8 in your browser
3. If blocked, you may need to use a different geolocation service

---

## 🔍 Manual Verification Queries

Run these in Supabase SQL Editor to verify:

### Check new columns:
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'auth_logs' 
AND column_name LIKE 'geo_%';
```

Should return 7 rows (geo_country, geo_city, etc.)

### Check new tables:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN ('ip_blocklist', 'ip_whitelist', 'active_sessions', 'security_alerts');
```

Should return 4 rows.

### Check triggers:
```sql
SELECT trigger_name, event_object_table
FROM information_schema.triggers 
WHERE trigger_name LIKE 'trigger_detect%';
```

Should return 2 rows.

---

## 📞 Need Help?

If you encounter issues:

1. **Check the error message** in Supabase SQL Editor
2. **Run verification queries** above to see what's missing
3. **Try running sections separately**:
   - First: ALTER TABLE statements
   - Second: CREATE TABLE statements
   - Third: CREATE INDEX statements
   - Fourth: CREATE FUNCTION statements
   - Fifth: CREATE TRIGGER statements

4. **Check backend logs**: `backend/logs/error.log`

---

## 🎉 Success Checklist

- [ ] Opened Supabase SQL Editor
- [ ] Copied migration SQL
- [ ] Pasted and ran in SQL Editor
- [ ] Saw success message
- [ ] Ran `node check-migration-status.js` - shows ✅
- [ ] Restarted backend
- [ ] Logged in to test
- [ ] Checked auth_logs table - sees geolocation data
- [ ] Accessed security dashboard - works!

---

**Ready to proceed?** Follow Step 1 above! 🚀
