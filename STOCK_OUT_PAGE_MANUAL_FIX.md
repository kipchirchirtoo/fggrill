# Stock Out Page Manual Fix

## Problem
The page at `/dashboard/branch-store/stock-out?branch_id=2` shows "Internal Runtime Error" and redirects.

## Root Cause
The `useSearchParams()` hook in Next.js 14 can cause hydration errors when not properly handled.

## Quick Fix

In `frontend/src/app/dashboard/branch-store/stock-out/page.tsx`, find this code around line 61-67:

```typescript
  const { user } = useAuth();
  // console.log('[BranchStockOutPage] UserRole.AUDITOR:', UserRole.AUDITOR, 'User Role:', user?.role);
  const searchParams = useSearchParams();
  const branchId = useMemo(() => {
    const id = searchParams.get('branch_id');
    return id ? parseInt(id) : (user?.branch_id || undefined);
  }, [searchParams, user?.branch_id]);
```

Replace it with:

```typescript
  const { user } = useAuth();
  const searchParams = useSearchParams();
  
  const branchId = useMemo(() => {
    try {
      const id = searchParams?.get('branch_id');
      return id ? parseInt(id) : (user?.branch_id || undefined);
    } catch (error) {
      console.error('Error reading search params:', error);
      return user?.branch_id || undefined;
    }
  }, [searchParams, user?.branch_id]);
```

## Changes Made
1. Removed the console.log comment
2. Added try-catch around searchParams.get()
3. Added optional chaining (`searchParams?.get`) for safety
4. Added error logging

## Test
After applying the fix:
1. Visit `/dashboard/branch-store/stock-out?branch_id=2`
2. The page should load without errors
3. No more redirects should occur

## Status
- [x] Check icon import fixed (already done)
- [ ] Manual fix needed for searchParams handling
