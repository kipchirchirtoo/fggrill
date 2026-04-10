# 🔧 Manual Migration Guide - Security Center

The automatic migration script showed warnings because Supabase's JavaScript client doesn't support direct SQL execution. Here are **3 ways** to apply the migration:

---

## ✅ METHOD 1: Supabase SQL Editor (RECOMMENDED - Easiest)

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Copy the Migration SQL
Open the file: `database/migrations/013_add_geolocation_security_fields.sql`

Copy the **entire contents** of the file.

### Step 3: Paste and Run
1. Paste the SQL into the Supabase SQL Editor
2. Click **Run** (or press Ctrl+Enter)
3. Wait for completion (should take 5-10 seconds)

### Step 4: Verify
You should see a success message. The following should be created:
- 14 new columns in `auth_logs` table
- 4 new tables: `ip_blocklist`, `ip_whitelist`, `active_sessions`, `security_alerts`
- 8 indexes
- 3 functions
- 2 triggers

---

## ✅ METHOD 2: Using psql Command Line

If you have PostgreSQL client installed:

```bash
# Get your database connection string from Supabase Dashboard
# Settings > Database > Connection string (Direct connection)

psql "your-connection-string-here" -f database/migrations/013_add_geolocation_security_fields.sql
```

---

## ✅ METHOD 3: Using the Direct Migration Script

If you have `DATABASE_URL` in your `.env`:

```bash
cd backend
node apply-security-migration-direct.js
```

---

## 🔍 Verify Migration Success

Run this query in Supabase SQL Editor to verify:

```sql
-- Check if new columns exist in auth_logs
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'auth_logs' 
AND column_name IN ('geo_country', 'geo_city', 'threat_score', 'is_suspicious');

-- Check if new tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('ip_blocklist', 'ip_whitelist', 'active_sessions', 'security_alerts');

-- Check if triggers exist
SELECT trigger_name 
FROM information_schema.triggers 
WHERE trigger_name IN ('trigger_detect_brute_force', 'trigger_detect_geo_anomaly');
```

You should see:
- 4 columns from auth_logs
- 4 tables
- 2 triggers

---

## ⚠️ Troubleshooting

### Issue: "Column already exists"
**Solution**: This is fine! It means the column was already added. The migration is idempotent (safe to run multiple times).

### Issue: "Permission denied"
**Solution**: Make sure you're using the **Service Role Key** or running in Supabase SQL Editor (which has full permissions).

### Issue: "Table already exists"
**Solution**: This is fine! Skip that statement and continue with the rest.

---

## 🎯 After Migration

Once the migration is complete:

### 1. Install axios (if not already installed)
```bash
cd backend
npm install axios
```

### 2. Restart the backend
```bash
npm run dev
```

### 3. Access the Security Dashboard
Navigate to: `http://localhost:3001/dashboard/super/admin/security`

---

## 📝 What Gets Created

### New Columns in `auth_logs`:
- `geo_country` - Country name
- `geo_country_code` - 2-letter country code
- `geo_region` - State/Region
- `geo_city` - City name
- `geo_latitude` - Latitude coordinate
- `geo_longitude` - Longitude coordinate
- `geo_timezone` - Timezone
- `geo_isp` - Internet Service Provider
- `is_proxy` - Proxy detection flag
- `is_vpn` - VPN detection flag
- `is_datacenter` - Datacenter IP flag
- `threat_score` - Threat score (0-100)
- `is_suspicious` - Suspicious activity flag
- `threat_reason` - Reason for threat flag

### New Tables:

#### `ip_blocklist`
Stores blocked IP addresses with expiration support.

#### `ip_whitelist`
Stores trusted IP addresses that bypass security checks.

#### `active_sessions`
Tracks all active user sessions with device and location info.

#### `security_alerts`
Stores security alerts (brute force, geo anomalies, etc.).

### New Functions:

#### `detect_brute_force_attempts()`
Automatically detects 5+ failed login attempts within 15 minutes.

#### `detect_geo_anomaly()`
Detects impossible travel (logins from different countries within 60 minutes).

#### `cleanup_expired_sessions()`
Marks expired sessions as inactive.

### New Triggers:

#### `trigger_detect_brute_force`
Runs after each login attempt to check for brute force attacks.

#### `trigger_detect_geo_anomaly`
Runs after successful logins to check for geographic anomalies.

---

## 🚀 Next Steps

After successful migration:

1. ✅ Verify tables and columns exist (use verification query above)
2. ✅ Install axios: `npm install axios`
3. ✅ Restart backend: `npm run dev`
4. ✅ Test login to generate security logs
5. ✅ Access dashboard: `/dashboard/super/admin/security`
6. ✅ Verify real IPs are being captured (not `::1`)
7. ✅ Check geolocation data is populating

---

## 💡 Quick Test

After migration, try this:

1. **Login to your account** from the frontend
2. **Go to Supabase Dashboard** > Table Editor > `auth_logs`
3. **Check the latest row** - you should see:
   - Real IP address (not `::1`)
   - `geo_country` populated
   - `geo_city` populated
   - `threat_score` calculated
   - `device_info` with browser/OS

If you see this data, the migration is working! 🎉

---

## 📞 Need Help?

If you encounter issues:
1. Check the SQL error message in Supabase
2. Verify you have the correct permissions
3. Try running statements one at a time
4. Check backend logs: `backend/logs/error.log`

---

**Status**: Ready to apply migration using Method 1 (Supabase SQL Editor)
