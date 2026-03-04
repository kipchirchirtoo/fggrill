# Auditor Stock-Take Notification Routing Fix

## Issue Summary
When auditors clicked on stock-take notifications, they received a 404 error trying to navigate to `/dashboard/auditor/stock-takes/[id]`.

## Root Cause
The NotificationModal had incorrect logic that was redirecting auditors away from the correct stock-take detail page URL. The backend was correctly creating notifications with `/dashboard/branch-store/stock-takes/${id}`, but the frontend was treating auditors as a special case and redirecting them.

## Solution Implemented

### Frontend Fix (NotificationModal.tsx)
Removed the auditor-specific redirection logic that was causing the 404. Auditors can now access branch-store stock-take detail pages for verification purposes.

**Changes:**
- Removed auditor handling from the stock-take URL redirection logic
- Kept central role logic for stock requests and kitchen usage
- Added comment explaining that auditors can access branch-store stock-take pages

### Backend (No Changes Needed)
The backend was already correctly creating notifications with the right URL:
```typescript
actionUrl: `/dashboard/branch-store/stock-takes/${stockTakeId}`
```

## How It Works Now

1. **Stock-take submission**: Branch storekeeper submits a stock-take
2. **Notification created**: Backend creates notification with URL `/dashboard/branch-store/stock-takes/${id}`
3. **Auditor clicks notification**: NotificationModal no longer redirects them away
4. **Auditor views detail**: Auditor can view the stock-take detail page for verification

## Files Modified
- `frontend/src/components/modals/NotificationModal.tsx`

## Testing
1. Submit a stock-take as a branch storekeeper
2. Log in as auditor
3. Click on the stock-take notification
4. Verify you can view the stock-take detail page without 404 error

## Additional Issues Identified (Not Fixed)

The following backend schema errors were identified but are separate issues:

1. **Cashier Logbooks Schema Error**
   - Error: `Could not find a relationship between 'cashier_logbooks' and 'branches' in the schema cache`
   - Affects: CashierLogbookVerification component
   - Endpoint: `GET /api/cashier/logbook/pending?status=pending_audit`

2. **Finance Daily Logs Schema Error**
   - Error: `Could not find a relationship between 'finance_daily_logs' and 'users' in the schema cache`
   - Affects: DailyLogVerification component
   - Endpoint: `GET /api/finance/daily-logs?status=submitted`

These require database schema fixes to add proper foreign key relationships.

## Status
✅ Stock-take notification routing fixed
⚠️ Additional schema errors identified (separate issue)
