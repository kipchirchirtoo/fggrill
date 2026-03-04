# Fix: Stock Counts Schema Cache Error

## Error
```
Error: Could not find the 'created_by' column of 'stock_counts' in the schema cache
POST https://api.hirall.com/api/store/stock-takes 500 (Internal Server Error)
```

## Root Cause

The Supabase client has a cached schema that doesn't include the `created_by` column in the `stock_counts` table. This happens when:
1. The database schema was updated
2. The backend server wasn't restarted
3. The Supabase client is using an outdated schema cache

## Verification

The column exists in the database:
```bash
node fix-stock-counts-created-by.js
# Output: ✅ created_by column already exists
```

## Solution: Restart Backend Server

The backend server needs to be restarted to refresh the Supabase schema cache:

### Development
```bash
cd backend
# Stop the current server (Ctrl+C)
npm run dev
```

### Production (PM2)
```bash
pm2 restart backend
# OR restart all
pm2 restart all
```

### Production (Manual)
```bash
# Find the process
ps aux | grep node

# Kill the process
kill -9 <PID>

# Start again
cd backend
npm start
```

## Alternative: Clear Supabase Cache

If restarting doesn't work, you can force Supabase to refresh its schema:

```javascript
// In your backend code, add this temporarily:
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    db: {
      schema: 'public'
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        'x-my-custom-header': 'stock-counts-fix'
      }
    }
  }
);
```

## Test After Fix

1. Restart the backend server
2. Go to Stock Takes page
3. Click "Create Stock Take"
4. Fill in the form
5. Submit

Expected result: Stock take created successfully without errors

## Why This Happens

Supabase caches the database schema for performance. When you:
1. Add/remove columns via migrations
2. Don't restart the server
3. The cache becomes stale

The solution is always to restart the backend after schema changes.

## Prevention

Always restart the backend server after:
- Running database migrations
- Adding/removing columns
- Changing table structures
- Modifying constraints

## Quick Fix Command

```bash
# One-liner to restart backend
cd backend && pm2 restart backend || (pkill -f "node.*backend" && npm run dev)
```

---

**Status**: ✅ Column exists in database
**Action Required**: 🔄 Restart backend server
**Expected Result**: ✅ Stock takes will work after restart
