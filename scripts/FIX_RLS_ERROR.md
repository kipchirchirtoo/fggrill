# Fix: Supabase RLS Infinite Recursion Error

## Problem
The auto-import is failing with:
```json
{
    "success": false,
    "error": "infinite recursion detected in policy for relation \"users\""
}
```

## Cause
The RLS policy on the `users` table has a circular reference - it's trying to check permissions by querying the same table it's protecting, creating an infinite loop.

## Solution Options

### Option 1: Temporarily Disable RLS for Import (Quick Fix)
Run this SQL in Supabase SQL Editor:

```sql
-- Disable RLS temporarily
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Re-enable after import completes
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```

**⚠️ WARNING:** This removes security temporarily. Only use in development.

### Option 2: Fix the RLS Policy (Recommended)

The policy likely looks something like this (causing recursion):
```sql
CREATE POLICY "users_select_policy" ON users
FOR SELECT USING (
    auth.uid() IN (SELECT id FROM users WHERE ...)  -- ❌ Recursion!
);
```

**Fix it by using `auth.uid()` directly:**
```sql
-- Drop the problematic policy
DROP POLICY IF EXISTS "users_select_policy" ON users;

-- Create a simple, non-recursive policy
CREATE POLICY "users_select_policy" ON users
FOR SELECT USING (
    auth.uid() = id  -- ✅ No recursion - direct comparison
    OR 
    auth.role() = 'service_role'  -- Allow service role
);
```

### Option 3: Use Service Role Key (Best for Import)

Modify the import to use the **service role key** instead of anon key:

**In `.env`:**
```env
# Add service role key (find in Supabase Dashboard > Settings > API)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-key
```

**In `electron/main.js` (line ~668):**
```javascript
// Change from:
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// To:
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
```

Service role bypasses RLS policies entirely.

## Recommended Action

**For immediate fix:** Use Option 3 (service role key) for the import script only.

**For long-term:** Fix the RLS policy (Option 2) to prevent future issues.
