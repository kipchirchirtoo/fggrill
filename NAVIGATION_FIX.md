# Quick Fix Applied

## Problem
User stuck on terminal/login page after successful PIN verification, even though logs showed pages loading.

## Root Cause
`window.location.href` was being intercepted by Next.js's client-side router, preventing actual navigation in the static export.

## Solution
Changed to `window.location.replace()` with a 100ms delay:
```typescript
setTimeout(() => {
    window.location.replace(`pos://terminal.html${targetPath}`);
}, 100);
```

This forces a **full page reload** and clears the navigation history, completely bypassing Next.js's router.

## Test
1. Restart Electron app
2. Enter PIN
3. Should immediately navigate to dashboard (POS Kitchen or Cashier based on role)

The 100ms delay ensures localStorage is written before navigation.
