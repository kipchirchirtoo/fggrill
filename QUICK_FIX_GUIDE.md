# Quick Fix Guide - Get Offline Login Working

## ✅ What's Already Fixed

- better-sqlite3 installed and working
- Database initializes successfully
- PIN verification system working
- App loads correctly

## 🔧 What You Need to Do

### Step 1: Add Service Role Key

1. Open `.env` file in the root directory
2. Add this line (get the key from Supabase Dashboard):
   ```env
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### Step 2: Restart the App

```bash
npm run electron:dev
```

### Step 3: Verify Users Imported

Look for these logs in the console:
```
[Auto-Import] Found X users, caching...
[Auto-Import] ✓ Imported X users successfully
```

### Step 4: Test Login

1. Enter a valid PIN (e.g., R0123)
2. Should see:
   ```
   [Cache] ✓ PIN verified for user_id: [uuid]
   ```
3. App redirects to dashboard

## 🐛 If It Still Doesn't Work

### Check 1: Database File Exists
```bash
dir "%APPDATA%\fggrill-central\pos-offline.db"
```

### Check 2: Users in Database
Run this test script:
```bash
node test-database.js
```

### Check 3: Manual Import
In the app, open DevTools (F12) and run:
```javascript
await window.electronAPI.cache.importUsers()
```

## 📝 Common Issues

### Issue: "PIN not found in cache"
**Cause**: No users imported yet
**Fix**: Add service role key and restart

### Issue: "Supabase RLS policy error"
**Cause**: Using anon key instead of service role key
**Fix**: Add `SUPABASE_SERVICE_ROLE_KEY` to .env

### Issue: "Database not initialized"
**Cause**: better-sqlite3 not installed correctly
**Fix**: Run `npm run postinstall`

---

**That's it!** Once you add the service role key, everything should work.
