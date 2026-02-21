# Offline Login Fix - COMPLETE

## What Was Fixed

### ROOT CAUSE
The app was using PowerSync packages that were NOT installed, causing it to fall back to a shim that returned MOCK DATA instead of real cached PINs.

### SOLUTION IMPLEMENTED
Replaced PowerSync with direct `better-sqlite3` implementation (which is already installed).

## Changes Made

### 1. New File: `electron/database.js`
- Direct SQLite database implementation
- No external dependencies beyond `better-sqlite3` (already installed)
- Handles all offline data: PINs, menu items, sync queue, orders, transactions
- Simple API: `get()`, `getAll()`, `execute()`, `transaction()`

### 2. Updated: `electron/main.js`
- Replaced PowerSync imports with direct database module
- Updated all IPC handlers to use new database functions
- Simplified initialization (no PowerSync complexity)
- All functionality preserved

### 3. Kept: `electron/powersync.js`
- Left as backup/reference
- Not used by the app anymore
- Can be removed later if desired

## How It Works Now

### Startup Flow
1. App starts → `initDatabase()` creates SQLite database
2. Database creates all required tables
3. Auto-import checks if cached PINs exist
4. If empty, fetches users from Supabase and caches them
5. App is ready for offline login

### Offline Login Flow
1. User enters PIN (e.g., "R0123")
2. App checks `cached_pins` table in SQLite
3. If found, returns real user data (not mock)
4. User is logged in with correct role and branch
5. Redirects to appropriate dashboard

### Online Login Flow
1. User enters PIN
2. App calls Supabase API
3. On success, caches PIN + user data in SQLite
4. User is logged in
5. Next time offline, PIN will work

## Testing Instructions

### 1. Clean Start Test
```bash
# Delete old database to start fresh
# Location: C:\Users\[user]\AppData\Roaming\fggrill-central\pos-offline.db

# Start app
npm run electron:dev
```

**Expected:**
- Console shows: `[Database] Initialized at: ...`
- Console shows: `[Auto-Import] No cached PINs found, importing...`
- Console shows: `[Auto-Import] Found X users, caching...`
- Console shows: `[Auto-Import] ✓ Imported X users successfully`

### 2. Offline Login Test
```bash
# Start app (should have cached PINs from step 1)
npm run electron:dev

# In the app:
# 1. Enter a valid PIN (e.g., R0123)
# 2. Check console for:
#    - [Cache] Verifying PIN: R0123
#    - [Cache] ✓ PIN verified for user_id: [uuid]
#    - [Terminal] Cached user result: {real user data}
# 3. App should redirect to correct dashboard
```

**Expected:**
- PIN verification uses REAL cached data (not mock)
- Console shows actual user data with correct role
- Redirection works to correct dashboard
- No "mock-user-id" in logs

### 3. Verify Database Contents
Create a test script to check cached PINs:

```javascript
// test-cached-pins.js
const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

const dbPath = path.join(app.getPath('userData'), 'pos-offline.db');
const db = new Database(dbPath);

const pins = db.prepare('SELECT * FROM cached_pins').all();
console.log('Cached PINs:', pins.length);
pins.forEach(pin => {
    const userData = JSON.parse(pin.user_data);
    console.log(`PIN: ${pin.id}, User: ${userData.first_name} ${userData.last_name}, Role: ${userData.role}`);
});

db.close();
```

## Verification Checklist

- [ ] Database initializes successfully
- [ ] Auto-import runs and caches users from Supabase
- [ ] Cached PINs table contains real user data (not mock)
- [ ] Offline PIN verification returns real user data
- [ ] Login redirects to correct dashboard based on role
- [ ] Console shows no "mock-user-id" references
- [ ] Console shows "[Cache] ✓ PIN verified for user_id: [real-uuid]"

## Troubleshooting

### Issue: Auto-import finds 0 users
**Cause:** Supabase credentials missing or RLS policies blocking access
**Fix:** 
1. Check `.env` file has correct Supabase URL and keys
2. Use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS
3. Check console for Supabase error messages

### Issue: PIN verification returns null
**Cause:** PIN not in database or database not initialized
**Fix:**
1. Check database file exists: `AppData\Roaming\fggrill-central\pos-offline.db`
2. Run auto-import manually via IPC: `window.electronAPI.cache.importUsers()`
3. Check console for database errors

### Issue: Redirection doesn't work
**Cause:** User data has wrong role or missing fields
**Fix:**
1. Check cached user data structure matches expected format
2. Verify `role` field is correct (e.g., "cashier", "bartender")
3. Check `auth-context.tsx` role mapping

## Next Steps

1. **Test thoroughly** with real user PINs
2. **Verify** all roles redirect correctly
3. **Test** online login → offline login flow
4. **Deploy** to production once verified

## Files Modified

- ✅ `electron/database.js` (NEW)
- ✅ `electron/main.js` (UPDATED)
- ⚠️ `electron/powersync.js` (KEPT AS BACKUP)

## Dependencies

- ✅ `better-sqlite3` (already installed)
- ✅ `@supabase/supabase-js` (already installed)
- ❌ No new dependencies required

---

**STATUS: READY FOR TESTING**

The fix is complete and ready to test. The app should now use real cached PINs instead of mock data.
