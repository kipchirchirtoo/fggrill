# Stock Take Submit Route Fix - Complete

## Issue
When submitting a new stock take to auditor in the branch accountant dashboard, the system returned a "route not found" error.

## Root Cause
The frontend API was calling the wrong endpoint path:
- **Frontend was calling**: `/store/stock-takes/${id}/submit`
- **Backend route exists at**: `/stock-takes/${id}/submit`

The confusion arose because:
1. Most stock take routes are under `/store/stock-takes/` (defined in `storekeeping.routes.ts`)
2. The submit endpoint is defined in a separate `stock-take.routes.ts` file registered at `/stock-takes/`
3. The `/store/stock-takes/` routes don't include the `/submit` endpoint

## Fix Applied
Updated the frontend API call in `frontend/src/lib/api.ts`:

```typescript
// Before (incorrect):
submitStockTakeToAuditor: (id: string) => fetchAPI<any>(`/store/stock-takes/${id}/submit`, { method: 'PUT' }),

// After (correct):
submitStockTakeToAuditor: (id: string) => fetchAPI<any>(`/stock-takes/${id}/submit`, { method: 'PUT' }),
```

## Backend Route Configuration
The submit route is properly configured in `backend/src/routes/stock-take.routes.ts`:

```typescript
router.put('/:id/submit',
    authorize([
        UserRole.SUPER_ADMIN,
        UserRole.GENERAL_MANAGER,
        UserRole.BRANCH_MANAGER,
        UserRole.BRANCH_ACCOUNTANT
    ]),
    submitStockTake
);
```

And registered in `backend/src/routes/index.ts`:
```typescript
router.use('/stock-takes', stockTakeRoutes);
```

## Files Modified
- `frontend/src/lib/api.ts` - Fixed API endpoint path

## Testing
The fix allows branch accountants to:
1. Create a new stock take
2. Record actual quantities for items
3. Submit the stock take to the auditor
4. The stock take is automatically verified upon submission

## Status
✅ Fix complete
✅ No syntax errors
✅ Ready for deployment
