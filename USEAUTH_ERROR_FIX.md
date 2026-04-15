# useAuth Error Fix Guide

## Error
```
ReferenceError: useAuth is not defined
at C (14055-3e82aaca716e5733.js:1:23194)
```

## Root Cause
This is a **build cache issue** in Next.js. The `useAuth` hook is properly defined and exported in `frontend/src/lib/auth-context.tsx`, but the production build has stale JavaScript bundles.

## Verification
✅ `useAuth` is properly exported in `frontend/src/lib/auth-context.tsx` (line 343)
✅ `KyogongPOSLayout.tsx` correctly imports it: `import { useAuth } from '@/lib/auth-context';`
✅ The sports-bar page properly uses the component

## Solution

### Option 1: Clear Build Cache and Rebuild (Recommended)
```bash
cd frontend
rm -rf .next
npm run build
# or for development
npm run dev
```

### Option 2: Force Hard Refresh in Browser
1. Open the sports-bar page
2. Press `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
3. Or open DevTools → Network tab → Check "Disable cache" → Refresh

### Option 3: Clear Service Worker Cache
The error shows Service Worker v6 is loaded. Clear it:
```javascript
// In browser console:
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(registration => registration.unregister());
});
// Then hard refresh the page
```

### Option 4: Full Clean Rebuild
```bash
cd frontend
rm -rf .next
rm -rf node_modules/.cache
npm run build
```

## Additional Issue Found
The error also shows:
```
api.hirall.com/api/kyogong/shifts/undefined/transactions:1 Failed to load resource: 500
```

This indicates `shiftId` is `undefined` when calling `fetchTransactions()`. This happens when:
- The shift data doesn't have an `id` field
- The API response structure changed

### Fix for Shift ID Issue
Add a safety check in `KyogongPOSLayout.tsx`:

```typescript
const fetchTransactions = async (shiftId: string) => {
    if (!shiftId) {
        console.warn('Cannot fetch transactions: shiftId is undefined');
        return;
    }
    try {
        const res = await kyogongAPI.getShiftTransactions(shiftId);
        if (res.success) setTransactions(res.data || []);
    } catch { /* silent */ }
};
```

And update the shift opener handler:
```typescript
const handleShiftOpened = (shift: any) => {
    setActiveShift(shift);
    setActiveTab('pos');
    if (shift?.id) {
        fetchTransactions(shift.id);
    }
};
```

## Prevention
To prevent this in the future:
1. Always clear `.next` folder before production builds
2. Use versioned service workers with proper cache invalidation
3. Add proper error boundaries around auth-dependent components
4. Implement null checks for API response data

## Status
- ✅ Staff Modal UI Fixed (original request)
- ⚠️ useAuth error is a build cache issue (requires rebuild)
- ⚠️ Shift transactions 500 error needs backend investigation
