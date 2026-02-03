# Backend Server Restart Required

## Issue
The error `column payments.branch_id does not exist` indicates that the backend server is running an old version of the code.

## Solution
**You need to restart the backend server** for the updated `auditor.controller.ts` changes to take effect.

## What Was Fixed
The `getFinancialReconciliation` function in `auditor.controller.ts` (line 493-670) has been updated to:

1. **Remove direct branch_id filtering** from payments table (line 499-501)
2. **Infer branch_id** from related entities:
   - Reservations (bookings)
   - Restaurant orders
   - Bar orders
   - POS transactions
   - Invoices
3. **Filter enriched payments** by branch after inference (line 564-566)

## How to Restart Backend

### Option 1: Using PM2 (if configured)
```bash
pm2 restart backend
```

### Option 2: Manual Restart
1. Stop the current backend process (Ctrl+C if running in terminal)
2. Navigate to backend directory:
   ```bash
   cd c:\Users\user\Desktop\fggrill\backend
   ```
3. Start the server:
   ```bash
   npm run dev
   ```

## Verification
After restarting, the financial verification page should work without errors:
- `/dashboard/auditor/financial-verification`
- `/dashboard/auditor/financial-verification/[branchId]`

The API endpoint `/api/auditor/verify/finances` will now correctly handle payments without requiring a `branch_id` column.
