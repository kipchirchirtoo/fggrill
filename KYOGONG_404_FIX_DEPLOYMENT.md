# Kyogong 404 Fix - Production Deployment Guide

## Problem Summary

The Kyogong pages in production are showing 404 errors because the components were using `process.env.NEXT_PUBLIC_API_URL` directly, which gets baked into the build at build-time. If the environment variable was set incorrectly (e.g., `api.hirall.com` without `https://`), it creates malformed URLs like:

```
https://famousgate.hirall.com/dashboard/kyogong/api.hirall.com/api/kyogong/shifts/current
```

## What Was Fixed

All 7 Kyogong-related files now import and use `API_URL` from `@/lib/config` instead of using the raw environment variable:

1. ✅ `frontend/src/components/kyogong/KyogongPOSLayout.tsx`
2. ✅ `frontend/src/components/kyogong/ShiftOpener.tsx`
3. ✅ `frontend/src/components/kyogong/ShiftCloser.tsx`
4. ✅ `frontend/src/components/kyogong/SaleForm.tsx`
5. ✅ `frontend/src/components/kyogong/PettyCashModal.tsx`
6. ✅ `frontend/src/components/kyogong/ServiceFormModal.tsx`
7. ✅ `frontend/src/app/dashboard/admin/kyogong/services/page.tsx`

The `config.ts` file already has proper URL normalization logic that:
- Adds the correct protocol (http:// or https://) if missing
- Removes trailing slashes
- Handles localhost vs production URLs correctly
- Provides fallback to default production URLs

## Deployment Steps

### Step 1: Commit and Push Changes

```bash
git add .
git commit -m "fix: Kyogong 404 errors - use API_URL from config instead of raw env var"
git push origin main
```

### Step 2: Rebuild Frontend for Production

On your production server or build machine:

```bash
cd frontend

# Make sure environment variables are set correctly
# Either in .env.production or as environment variables:
export NEXT_PUBLIC_API_URL=https://api.hirall.com
export NEXT_PUBLIC_PYTHON_SERVICE_URL=https://services.hirall.com

# Clean previous build
rm -rf .next
rm -rf out

# Build for production
npm run build
```

### Step 3: Deploy the New Build

Deploy the new `out/` directory (or `.next/` if using Next.js server) to your production environment.

### Step 4: Verify the Fix

1. Open the production site: `https://famousgate.hirall.com`
2. Navigate to any Kyogong page (Spa, Executive Bar, Sports Bar, Reception)
3. Open browser DevTools Console (F12)
4. Check that:
   - ✅ No 404 errors for `/api/kyogong/*` endpoints
   - ✅ Sales points load correctly
   - ✅ Current shift status loads
   - ✅ All Kyogong operations work

### Step 5: Check Network Tab

In DevTools Network tab, verify API calls are going to:
- ✅ `https://api.hirall.com/api/kyogong/shifts/current`
- ✅ `https://api.hirall.com/api/kyogong/sales-points`

NOT to malformed URLs like:
- ❌ `https://famousgate.hirall.com/dashboard/kyogong/api.hirall.com/api/kyogong/...`

## Important Notes

### Environment Variables

Even if `NEXT_PUBLIC_API_URL` is set incorrectly in production (without protocol), the fix will now handle it properly because the `config.ts` normalization logic will add the protocol automatically.

**Recommended production .env:**
```bash
NEXT_PUBLIC_API_URL=https://api.hirall.com
NEXT_PUBLIC_PYTHON_SERVICE_URL=https://services.hirall.com
NEXT_PUBLIC_REPORTS_SERVICE_URL=https://services.hirall.com
```

### Why This Fix Works

Before:
```typescript
// Components used this directly - gets baked into build at build-time
fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/kyogong/shifts/current`)
```

After:
```typescript
// Components now use this - goes through normalization
import { API_URL } from '@/lib/config';
fetch(`${API_URL}/api/kyogong/shifts/current`)
```

The `API_URL` constant is evaluated at runtime and includes proper URL normalization, so even if the env var is wrong, it gets fixed.

## Rollback Plan

If something goes wrong, you can rollback by:

1. Reverting the git commit:
   ```bash
   git revert HEAD
   git push origin main
   ```

2. Rebuilding and redeploying the previous version

## Testing Checklist

After deployment, test these scenarios:

- [ ] Open Spa POS page - sales points load
- [ ] Open Executive Bar POS page - sales points load
- [ ] Open Sports Bar POS page - sales points load
- [ ] Open Reception POS page - sales points load
- [ ] Open a shift successfully
- [ ] Record a transaction
- [ ] Close a shift
- [ ] Admin can manage services at `/dashboard/admin/kyogong/services`
- [ ] No console errors about 404 or malformed URLs

## Support

If you encounter any issues after deployment:

1. Check browser console for errors
2. Check Network tab for failed requests
3. Verify environment variables are set correctly
4. Check that the build was created with the latest code
5. Clear browser cache and try again

---

**Status**: ✅ Code changes complete and ready for production deployment
**Next Step**: Rebuild frontend and deploy to production
