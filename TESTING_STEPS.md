# Testing Steps - Offline Login Fix

## Prerequisites
- Node.js installed
- Dependencies installed (`npm install` already run)
- Supabase credentials in `.env` file

## Step-by-Step Testing

### Step 1: Clean Start (Optional but Recommended)
Delete the old database to start fresh:

**Windows:**
```
C:\Users\[YourUsername]\AppData\Roaming\fggrill-central\pos-offline.db
```

Delete this file if it exists.

### Step 2: Start the App
```bash
npm run electron:dev
```

### Step 3: Watch Console Output
You should see these messages in order:

```
[Main] Script loaded, checking lock...
[Main] Lock acquired.
[Main] FRONTEND_OUT_PATH: ...
[Database] Initializing at: ...
[Database] All tables created/verified
[Database] Initialized successfully
[Main] Database initialized
[Auto-Import] No cached PINs found, importing users from Supabase...
[Auto-Import] Service role key available: true/false
[Auto-Import] Using key type: SERVICE_ROLE or ANON
[Auto-Import] Found X users, caching...
[Import] ✓ Cached: R0123 - John Doe
[Import] ✓ Cached: B0456 - Jane Smith
...
[Auto-Import] ✓ Imported X users successfully
```

**✅ PASS**: If you see these messages, database initialization worked!
**❌ FAIL**: If you see errors, check Supabase credentials

### Step 4: Test Offline Login
1. In the app window, enter a valid PIN (e.g., `R0123`)
2. Watch the console for these messages:

```
[Terminal] handleLogin called
[Terminal] isElectron: true
[Terminal] isOnline: false
[Terminal] PIN length: 5
[Terminal] Offline login attempt...
[Cache] Verifying PIN: R0123
[Cache] ✓ PIN verified for user_id: [real-uuid-here]
[Terminal] Cached user result: { id: '...', first_name: 'John', ... }
[Terminal] Target path: /dashboard/cashier
[Terminal] Redirecting in Electron offline mode...
[Terminal] Redirect URL: pos://terminal.html/dashboard/cashier
[Terminal] Executing redirect...
[IPC] Navigation requested: pos://terminal.html/dashboard/cashier
[Protocol] Request: pos://terminal.html/dashboard/cashier
[Protocol] Resolving: dashboard/cashier -> ...
[Protocol] ✓ Found route HTML: ...
[IPC] Navigation successful: pos://terminal.html/dashboard/cashier
```

**✅ PASS**: If you see real user data (not "mock-user-id") and navigation succeeds
**❌ FAIL**: If you see "mock-user-id" or PIN verification returns null

### Step 5: Verify Redirection
After entering the PIN, the app should:
1. Show a success toast: "Offline login: [User Name]"
2. Redirect to the correct dashboard based on role:
   - Cashier → `/dashboard/cashier`
   - Bartender → `/dashboard/pos-kitchen?tab=bar`
   - Restaurant → `/dashboard/pos-kitchen?tab=restaurant`

**✅ PASS**: If redirection works and you see the dashboard
**❌ FAIL**: If stuck on login page or redirects to wrong page

### Step 6: Verify Database Contents (Optional)
Run the test script:
```bash
node test-database.js
```

Expected output:
```
============================================================
OFFLINE DATABASE TEST
============================================================
Database path: C:\Users\...\pos-offline.db

📋 TABLES:
  - bar_order_items
  - bar_orders
  - branches
  - cache_meta
  - cached_pins
  - cashier_transactions
  - menu_items
  - offline_orders
  - payments
  - pos_transactions
  - restaurant_menu_categories
  - restaurant_menu_items
  - restaurant_order_items
  - restaurant_orders
  - restaurant_tables
  - sync_queue

🔐 CACHED PINS:
  Total: 5

📝 PIN DETAILS:
  1. PIN: R0123
     User: John Doe
     Role: cashier
     Branch: 1
     Cached: 2024-02-16T10:30:00.000Z

  2. PIN: B0456
     User: Jane Smith
     Role: bartender
     Branch: 1
     Cached: 2024-02-16T10:30:00.000Z
  ...

============================================================
✅ TEST COMPLETE
============================================================
```

**✅ PASS**: If you see real user data with correct roles
**❌ FAIL**: If no PINs cached or data looks wrong

## Common Issues and Fixes

### Issue 1: No users imported (count = 0)
**Symptoms:**
```
[Auto-Import] Found 0 users
```

**Causes:**
1. Supabase credentials missing
2. RLS policies blocking access
3. No users have `pos_pin` set

**Fix:**
1. Check `.env` file has:
   ```
   VITE_SUPABASE_URL=https://...
   VITE_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Important!
   ```
2. Verify users in Supabase have `pos_pin` column filled
3. Check console for Supabase error messages

### Issue 2: PIN verification returns null
**Symptoms:**
```
[Cache] ✗ PIN not found in cache
```

**Causes:**
1. Auto-import didn't run
2. Wrong PIN entered
3. Database not initialized

**Fix:**
1. Check auto-import completed successfully
2. Verify PIN exists in database: `node test-database.js`
3. Try manual import:
   - Open DevTools (F12)
   - Run: `await window.electronAPI.cache.importUsers()`

### Issue 3: Still seeing "mock-user-id"
**Symptoms:**
```
[Cache] ✓ PIN verified for user_id: mock-user-id
```

**Causes:**
1. Old code still running
2. Database module not loaded correctly

**Fix:**
1. Restart the app completely
2. Check `electron/main.js` imports `./database` not `./powersync`
3. Delete old database and restart

### Issue 4: Redirection doesn't work
**Symptoms:**
- PIN verifies successfully
- But stays on login page

**Causes:**
1. Navigation handler not working
2. Protocol handler issue
3. User role not recognized

**Fix:**
1. Check console for navigation errors
2. Verify user role in cached data
3. Check `auth-context.tsx` role mapping

## Success Criteria

All of these must be true:

- ✅ Database initializes without errors
- ✅ Auto-import caches users from Supabase
- ✅ Console shows real user data (not "mock-user-id")
- ✅ PIN verification returns correct user
- ✅ Login redirects to correct dashboard
- ✅ No JavaScript errors in console
- ✅ Test script shows cached PINs

## Next Steps After Testing

1. **If all tests pass:**
   - Test with multiple user roles
   - Test online → offline transition
   - Test offline order creation
   - Deploy to production

2. **If tests fail:**
   - Check console for specific errors
   - Review troubleshooting section
   - Check Supabase credentials
   - Verify database file exists

---

**Need Help?**
Check the console output carefully - it will tell you exactly what's happening at each step.
