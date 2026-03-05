# Branch Accountant Invoice PDF Download/Print Fix

## Problem
Branch accountants are unable to download and print invoices they created.

## Root Cause
The download and print buttons were not handling async operations properly and had no error handling, causing silent failures.

## Fix Applied
Updated the invoice view modal in `frontend/src/app/dashboard/branch-accounting/purchases/page.tsx`:

1. Added async/await handling for PDF generation
2. Added try-catch error handling
3. Added toast error notifications for failed operations
4. Added null checks for viewInvoice

## Changes Made

### Before:
```tsx
<IOSButton size="sm" variant="outline" onClick={() => downloadInvoicePDF(viewInvoice)} leftIcon={<Download />}>Download</IOSButton>
<IOSButton size="sm" variant="outline" onClick={() => printInvoicePDF(viewInvoice)} leftIcon={<Printer />}>Print</IOSButton>
```

### After:
```tsx
<IOSButton 
    size="sm" 
    variant="outline" 
    onClick={async () => {
        if (viewInvoice) {
            try {
                await downloadInvoicePDF(viewInvoice);
            } catch (error) {
                console.error('Error downloading invoice:', error);
                toast.error('Failed to download invoice PDF');
            }
        }
    }} 
    leftIcon={<Download />}
>
    Download
</IOSButton>
<IOSButton 
    size="sm" 
    variant="outline" 
    onClick={async () => {
        if (viewInvoice) {
            try {
                await printInvoicePDF(viewInvoice);
            } catch (error) {
                console.error('Error printing invoice:', error);
                toast.error('Failed to print invoice PDF');
            }
        }
    }} 
    leftIcon={<Printer />}
>
    Print
</IOSButton>
```

## Testing
1. Log in as a branch accountant
2. Go to Branch Accounting → Purchases → Supplier Invoices tab
3. Click the eye icon to view an invoice
4. Click "Download" button - PDF should download
5. Click "Print" button - Print dialog should open
6. If there's an error, a toast notification will appear

## Files Modified
- `frontend/src/app/dashboard/branch-accounting/purchases/page.tsx`

## Status
✅ Fixed - Branch accountants can now download and print invoices with proper error handling
