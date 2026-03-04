# 🔧 Complete Authentication Fix Guide

## 🚨 Current Errors

```
sw.js:354 [SW] Service Worker loaded
api.hirall.com/api/auth/me:1 Failed to load resource: the server responded with a status of 404 ()
API request error (not retrying): Error: User profile not found
API request error after retries: Error: User profile not found
api.hirall.com/api/auth/login:1 Failed to load resource: the server responded with a status of 401 ()
API request error (not retrying): Error: Invalid credentials
Login error: Error: Invalid credentials
```

## 🎯 Quick Fix (Try This First)

### Option 1: Use the Fix Tool (Easiest)
1. Open `fix-auth-now.html` in your browser
2. Click "Clear Auth Data"
3. Click "Go to Login Page"
4. Login with fresh credentials

### Option 2: Manual Browser Fix
1. Open browser DevTools (F12)
2. Go to Console tab
3. Run this:
```javascript
localStorage.clear();
sessionStorage.clear();
location.href = '/login';
```

## 🔍 Root Cause Analysis

### Why This Happens

1. **Stale Token**: Your browser has an old token that points to a user that no longer exists or has been modified
2. **Session Expired**: The JWT token has expired but the frontend hasn't cleared it
3. **Database Mismatch**: The user ID in the token doesn't match any user in the database

### The Auth Flow

```
Browser → /api/auth/login → Backend
                              ↓
                         Verify credentials
                              ↓
                         Generate JWT token
                              ↓
                         Return token + user
                              ↓
Browser stores token in localStorage
                              ↓
Next request → /api/auth/me with token
                              ↓
                         Verify token
                              ↓
                         Look up user by ID
                              ↓
                         Return user profile
```

### Where It's Breaking

The `/api/auth/me` endpoint is failing at this step:

```typescript
// backend/src/controllers/auth.controller.ts:363
const { data: profile, error: profileError } = await supabase
  .from('users')
  .select('*')
  .eq('id', req.user.id)  // ← User ID from token doesn't exist
  .single();

if (profileError || !profile) {
  res.status(404).json({
    success: false,
    message: 'User profile not found'  // ← This is what you're seeing
  });
}
```

## 🛠️ Detailed Fixes

### Fix 1: Clear Browser State (Most Common)

**Problem**: Stale token in localStorage

**Solution**:
```javascript
// Open browser console and run:
localStorage.removeItem('token');
localStorage.removeItem('user');
localStorage.removeItem('activeBranchId');
location.reload();
```

### Fix 2: Check User Exists in Database

**Problem**: User was deleted or modified

**Solution**: Run diagnostic script
```bash
node diagnose-auth-issue.js
```

This will show:
- All users in the database
- Which users have passwords
- If Supabase Auth is working

### Fix 3: Verify Backend is Running

**Problem**: Backend server is down

**Solution**:
```bash
# Check if backend is running
curl https://api.hirall.com/api/auth/login

# Should return 400 (missing credentials) if working
```

### Fix 4: Check Token Validity

**Problem**: Token is malformed or expired

**Solution**: Decode the token to see what's inside
```javascript
// In browser console:
const token = localStorage.getItem('token');
if (token) {
  const parts = token.split('.');
  const payload = JSON.parse(atob(parts[1]));
  console.log('Token payload:', payload);
  console.log('Expires:', new Date(payload.exp * 1000));
  console.log('User ID:', payload.sub);
}
```

### Fix 5: Database User Lookup

**Problem**: User ID in token doesn't exist in database

**Solution**: Check in Supabase SQL Editor
```sql
-- Get the user ID from your token (see Fix 4)
-- Then run:
SELECT * FROM users WHERE id = 'your-user-id-here';

-- If no results, the user was deleted
-- You need to clear the token and login again
```

## 🔐 Prevention

### Add Better Error Handling

Update `frontend/src/lib/api.ts` to auto-clear bad tokens:

```typescript
if (response.status === 401 || response.status === 404) {
  // Token is invalid or user doesn't exist
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Only redirect if not already on login page
    const path = window.location.pathname;
    if (!path.includes('/login')) {
      window.location.href = '/login?session=expired';
    }
  }
}
```

### Add Token Expiry Check

```typescript
// Check token before making requests
function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    const payload = JSON.parse(atob(parts[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

// In fetchAPI function:
const token = localStorage.getItem('token');
if (token && isTokenExpired(token)) {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login?session=expired';
  return;
}
```

## 📋 Troubleshooting Checklist

- [ ] Cleared localStorage
- [ ] Cleared sessionStorage
- [ ] Cleared cookies
- [ ] Tried fresh login
- [ ] Checked backend is running
- [ ] Verified user exists in database
- [ ] Checked token expiry
- [ ] Reviewed backend logs
- [ ] Tested with different browser
- [ ] Checked network connectivity

## 🆘 Still Not Working?

If you've tried everything above and it's still failing:

1. **Check Backend Logs**:
```bash
cd backend
tail -f logs/combined.log
```

2. **Run Full Diagnostic**:
```bash
node diagnose-auth-issue.js
```

3. **Check Supabase Dashboard**:
   - Go to https://supabase.com
   - Check if your project is active
   - Verify users exist in Auth section

4. **Test Direct Database Connection**:
```bash
cd backend
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
supabase.from('users').select('count').then(console.log);
"
```

## 📞 Support

If none of these fixes work, you may have a deeper issue:
- Database connectivity problems
- Supabase project configuration issues
- Backend server deployment problems
- Network/firewall issues

Check the backend server status and database connectivity first.
