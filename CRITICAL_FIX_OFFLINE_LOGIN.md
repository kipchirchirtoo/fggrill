# CRITICAL FIX: Offline Login Issue

## ROOT CAUSE IDENTIFIED

The persistent offline login issue is caused by **MISSING POWERSYNC DEPENDENCIES**. The code in `electron/powersync.js` attempts to use PowerSync packages that are NOT installed:

```javascript
PowerSyncDatabase = require('@powersync/electron').PowerSyncDatabase;
Schema = require('@powersync/common').Schema;
// ... etc
```

**These packages are NOT in package.json**, so the code falls back to a shim that returns MOCK DATA instead of real cached PINs.

## EVIDENCE

1. `package.json` only has:
   - `better-sqlite3` ✓
   - `@supabase/supabase-js` ✓
   - **MISSING**: `@powersync/electron`, `@powersync/common`, `@powersync/better-sqlite3-adapter`

2. The fallback shim in `electron/powersync.js` returns mock user data:
   ```javascript
   if (query.includes('cached_pins')) {
     return {
       user_id: 'mock-user-id',
       user_data: JSON.stringify({
         id: 'mock-user-id',
         first_name: 'Test',
         last_name: 'User',
         role: 'cashier',
         branch_id: 1
       })
     };
   }
   ```

3. This explains why:
   - Login "succeeds" with any PIN (mock data always returns)
   - Redirection doesn't work (mock user has wrong role/data)
   - Real cached PINs are never checked

## SOLUTION OPTIONS

### Option 1: Install PowerSync (Recommended for Production)

Install the missing packages:

```bash
npm install @powersync/electron @powersync/common @powersync/better-sqlite3-adapter
```

Then rebuild native modules:

```bash
npm run postinstall
```

**Pros**: Full offline sync capabilities, production-ready
**Cons**: Requires native module compilation

### Option 2: Use Better-SQLite3 Directly (Quick Fix)

Since `better-sqlite3` is already installed, we can bypass PowerSync and use it directly. This is simpler and doesn't require additional dependencies.

**Pros**: Works immediately, no new dependencies
**Cons**: No PowerSync sync features (but we don't need them for offline PIN verification)

## RECOMMENDED FIX: Option 2 (Direct SQLite)

Replace `electron/powersync.js` with a simpler implementation using `better-sqlite3` directly.

### Implementation Steps

1. **Create new `electron/database.js`** - Direct SQLite implementation
2. **Update `electron/main.js`** - Use new database module
3. **Test offline login** - Verify PIN caching and verification works

### Why This Works

- `better-sqlite3` is already installed and working
- No need for PowerSync complexity for simple PIN caching
- Auto-import will work correctly
- Offline PIN verification will use real cached data

## NEXT STEPS

1. Implement Option 2 (direct SQLite)
2. Test PIN caching on successful online login
3. Test offline PIN verification
4. Verify redirection works with real user data

## FILES TO MODIFY

1. `electron/database.js` (NEW) - Direct SQLite implementation
2. `electron/main.js` - Update imports and initialization
3. `electron/powersync.js` - Can be removed or kept as backup

---

**CRITICAL**: The app is currently using MOCK DATA for all PIN verifications. This must be fixed before deployment.
