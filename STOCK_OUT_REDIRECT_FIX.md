# Stock Out Page Redirect Fix

## Problem
The stock-out page at `/dashboard/branch-store/stock-out?branch_id=2` is showing "Internal Runtime Error" and redirecting to a different URL. The error is caused by:

1. `useSearchParams()` hook causing hydration mismatch in Next.js 14
2. Missing `Check` icon import (already fixed)
3. The page needs proper error boundaries and Suspense handling

## Root Cause
When using `useSearchParams()` in Next.js 14 App Router without proper Suspense boundaries, it can cause hydration mismatches and runtime errors during server-side rendering.

## Solution
Wrap the component that uses `useSearchParams()` in a Suspense boundary or create a separate client component for the search params logic.

## Files to Fix
- `frontend/src/app/dashboard/branch-store/stock-out/page.tsx`

## Implementation Steps

### Option 1: Add Suspense Boundary (Recommended)
Create a wrapper component with Suspense:

```typescript
'use client';

import { Suspense } from 'react';
// ... other imports

function StockOutContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  
  const branchId = useMemo(() => {
    const id = searchParams.get('branch_id');
    return id ? parseInt(id) : (user?.branch_id || undefined);
  }, [searchParams, user?.branch_id]);
  
  // ... rest of the component logic
}

export default function BranchStockOutPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    }>
      <StockOutContent />
    </Suspense>
  );
}
```

### Option 2: Use useEffect Instead
Move searchParams logic to useEffect to avoid SSR issues:

```typescript
const [branchId, setBranchId] = useState<number | undefined>();
const searchParams = useSearchParams();
const { user } = useAuth();

useEffect(() => {
  const id = searchParams.get('branch_id');
  setBranchId(id ? parseInt(id) : (user?.branch_id || undefined));
}, [searchParams, user?.branch_id]);
```

## Status
- [x] Check icon import fixed
- [ ] Suspense boundary needed
- [ ] Test with branch_id query parameter

## Next Steps
1. Implement Suspense boundary wrapper
2. Test the page with `?branch_id=2` parameter
3. Verify no more redirects or runtime errors
