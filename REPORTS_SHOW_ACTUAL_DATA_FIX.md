# Reports Show Actual Data Fix

## Problem
Reports in Central Store and Auditor modules should show actual data on screen, not just generate PDFs.

## Current State Analysis

### Central Store Reports
**Status**: ✅ WORKING - Shows actual data
- Location: `/dashboard/central-store/suppliers/reports`
- File: `frontend/src/app/dashboard/auditor/audit-reports/page.tsx`
- Features:
  - VAT Input Summary (shows table with actual invoices)
  - GRNI Control Account (shows outstanding GRN items)
  - Accounts Payable Aging (shows aging analysis table)
  - Audit Trail (shows immutable logs)
- All tabs display actual data before allowing PDF export

### Auditor Reports
**Status**: ❌ NEEDS FIX - Only generates PDFs
- Location: `/dashboard/auditor/audit-reports`
- File: `frontend/src/app/dashboard/auditor/audit-reports/page.tsx`
- Current behavior: Only shows "Generate PDF" buttons
- Missing: Data preview/display before export

### Other Auditor Report Pages
Most auditor report pages have similar issues - they focus on PDF generation without showing data first.

## Solution Approach

### Option 1: Add Data Preview to Audit Reports Page (RECOMMENDED)
Update `/dashboard/auditor/audit-reports/page.tsx` to:
1. Fetch and display actual data for each report type
2. Show data in tables/charts
3. Allow filtering and sorting
4. Keep "Export PDF" button for each report

### Option 2: Create Separate Data View Pages
Create individual pages for each report type with full data visualization.

## Implementation Plan

### Phase 1: Update Audit Reports Page Structure
1. Add state management for report data
2. Create data fetching functions for each report type
3. Add loading states and error handling

### Phase 2: Add Data Display Components
1. Create table components for each report type:
   - Exception Summary Table
   - Compliance Audit Table
   - Void Analytics Table
   - Revenue Reconciliation Table
   - Leakage Analysis Table
   - Expenditure Audit Table
   - Stock Variance Table
   - Consumption Analytics Table
   - GRN Audit Table

### Phase 3: Backend API Endpoints
Ensure backend has data endpoints (not just PDF generation):
- `/api/reports/auditor/exceptions`
- `/api/reports/auditor/compliance`
- `/api/reports/auditor/voids`
- `/api/reports/auditor/revenue`
- `/api/reports/auditor/leakage`
- `/api/reports/auditor/expenditure`
- `/api/reports/auditor/stock-variance`
- `/api/reports/auditor/consumption`
- `/api/reports/auditor/grn`

## Quick Fix: Show Data in Existing Pages

Since many auditor pages already exist with data display, we should:

1. **Revenue Audit** (`/dashboard/auditor/sales`) - ✅ Already shows data
2. **Stock Audit** (`/dashboard/auditor/stock`) - ✅ Already shows data
3. **Sold Items** (`/dashboard/auditor/sold-items`) - ✅ Already shows data
4. **Orders** (`/dashboard/auditor/orders`) - ✅ Already shows data
5. **Kitchen Wastage** (`/dashboard/auditor/kitchen-wastage`) - ✅ Already shows data
6. **Kitchen Ledger** (`/dashboard/auditor/ledger`) - ✅ Already shows data

The main issue is the **Audit Reports** page which acts as a report hub but doesn't show data.

## Recommended Fix

Update `frontend/src/app/dashboard/auditor/audit-reports/page.tsx` to:

1. Add tabs for each report category (Compliance, Financial, Inventory)
2. When a report is selected, fetch and display the data
3. Show data in tables with:
   - Sorting
   - Filtering
   - Pagination
   - Summary statistics
4. Add "Export to PDF" button at the top of the data view

## Files to Modify

1. `frontend/src/app/dashboard/auditor/audit-reports/page.tsx` - Main audit reports page
2. `frontend/src/lib/api.ts` - Add data fetching endpoints (if missing)
3. Backend report controllers - Ensure data endpoints exist

## Testing Steps

1. Navigate to each report page in Central Store
2. Verify data is displayed in tables/charts
3. Navigate to each report page in Auditor module
4. Verify data is displayed before PDF generation
5. Test filtering, sorting, and pagination
6. Test PDF export functionality
7. Verify data accuracy

## Status
🔄 IN PROGRESS - Needs implementation of data display in audit reports page
