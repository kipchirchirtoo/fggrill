# Auditor Orders Page - View & PDF Export Fix

## Summary
Fixed the Eye icon (view option) and PDF Archive button on the auditor orders page to properly display order details and generate comprehensive PDF reports.

## Changes Made

### 1. Frontend - Orders Page (`orders/page.tsx`)

#### Added State Management
- `selectedOrder`: Stores the currently selected order for viewing
- `isExporting`: Tracks PDF export loading state

#### Added Handler Functions

**`handleViewOrder(orderId)`**
- Fetches full order details from backend
- Finds the specific order by ID
- Opens modal with order details

**`handleExportPDF()`**
- Calls Python service to generate comprehensive PDF
- Uses `auditorReportsAPI.exportBrandedPdf('branch_orders', ...)`
- Shows loading state during generation
- Displays success/error toast notifications

#### Updated UI Components

**Eye Button (View)**
```tsx
<button 
    onClick={() => handleViewOrder(req.id)}
    className="w-8 h-8 rounded-lg hover:bg-stone-900 hover:text-white transition-all flex items-center justify-center text-stone-300"
>
    <Eye className="h-4 w-4" />
</button>
```

**PDF Archive Button**
```tsx
<button 
    onClick={handleExportPDF}
    disabled={isExporting}
    className="btn-secondary h-12 px-6"
>
    {isExporting ? (
        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
    ) : (
        <FileDown className="h-4 w-4 mr-2" />
    )}
    {isExporting ? 'Generating...' : 'PDF Archive'}
</button>
```

#### Added Order Details Modal
- Full-screen modal overlay
- Displays order information:
  - Requisition number
  - Department
  - Status with color-coded badges
  - Created date
  - Total items count
- Shows detailed items table:
  - Item name
  - Quantity requested
  - Quantity approved
- Displays notes if available
- Click outside or X button to close

### 2. Python Services - Audit Report Template

#### Created `generate_branch_orders_report()` Method
**File**: `audit_report_templates.py`

**Report Sections**:
1. **Executive Summary**
   - Total requisitions
   - Pending approval count
   - Approved orders
   - Dispatched orders
   - Rejected orders

2. **Requisition Details Table**
   - Requisition number
   - Department
   - Date
   - Item count
   - Status
   - Limited to first 50 requisitions

3. **Audit Findings & Recommendations**
   - Pending requisitions alerts
   - Rejected requisitions analysis
   - Documentation verification
   - Workflow recommendations
   - Dispatch timing suggestions

4. **Auditor Certification**
   - Audit period
   - Report generation timestamp
   - Signature fields
   - Auditor name field

**Features**:
- Professional formatting with Famous Gate branding
- Color-coded tables (Blue, Green headers)
- Status indicators (✓ verified, ⚠ warnings)
- Proper date formatting
- Comprehensive audit trail

### 3. Python Services - Auditor Reports Endpoint

#### Updated `/branch-orders` Endpoint
**File**: `auditor_reports.py`

**Changes**:
- Now uses `audit_templates.generate_branch_orders_report()`
- Properly handles branch_id (supports null for "All Branches")
- Improved filename with timestamp
- Returns comprehensive audit report PDF

**Request Parameters**:
```json
{
  "branch_id": number | null,
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "branch_name": "Branch Name" (optional)
}
```

**Response**:
- PDF file download
- Filename: `branch_orders_audit_{branch_id}_{timestamp}.pdf`

## How It Works

### View Order Flow
1. User clicks Eye icon on any requisition row
2. `handleViewOrder()` fetches full order details
3. Modal opens with complete order information
4. User can review:
   - Order metadata (department, status, date)
   - All requested items with quantities
   - Any notes attached to the order
5. User closes modal by clicking outside or X button

### PDF Export Flow
1. User clicks "PDF Archive" button
2. `handleExportPDF()` calls Python service
3. Python service:
   - Fetches all requisitions for the date range
   - Generates comprehensive audit report
   - Includes executive summary, details table, findings
   - Adds auditor certification section
4. PDF automatically downloads to user's device
5. Success notification shown

## Testing

### Test View Functionality
1. Navigate to `/dashboard/auditor/orders`
2. Select a branch (or view all branches)
3. Click Eye icon on any requisition
4. Verify modal shows:
   - Correct requisition number
   - Department and status
   - All items with quantities
   - Notes (if any)

### Test PDF Export
1. Navigate to `/dashboard/auditor/orders`
2. Select a branch and date range
3. Click "PDF Archive" button
4. Verify:
   - Button shows "Generating..." with spinner
   - PDF downloads automatically
   - PDF contains:
     - Executive summary with correct counts
     - Requisitions table with all orders
     - Audit findings and recommendations
     - Auditor certification section

## Files Modified

### Frontend
- `frontend/src/app/dashboard/auditor/orders/page.tsx`

### Python Services
- `python-services/reports/audit_report_templates.py` (new method)
- `python-services/reports/auditor_reports.py` (updated endpoint)

## Benefits

✅ **View Functionality**: Auditors can quickly review order details without leaving the page
✅ **Modal Interface**: Clean, focused view of order information
✅ **PDF Export**: Professional audit reports for compliance and record-keeping
✅ **Comprehensive Reports**: Includes summary, details, findings, and certification
✅ **Loading States**: Clear feedback during data fetching and PDF generation
✅ **Error Handling**: Toast notifications for success/failure
✅ **Professional Formatting**: Branded PDF with proper tables and formatting

## Next Steps

After deploying these changes:
1. **Restart Python services** to load new template method
2. **Test view functionality** on production
3. **Test PDF generation** with real data
4. **Verify PDF formatting** and content accuracy
5. **Train auditors** on new features
