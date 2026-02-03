# Accounting & Bookkeeping Export Endpoints

## Overview
All accounting and bookkeeping features now use Python services to generate professional PDF and Excel documents. Export buttons are fully functional across all financial reports.

## Available Export Endpoints

### 1. Trial Balance
**PDF Export:**
```
GET /api/accounting/reports/trial-balance/export/pdf
Parameters:
  - branch_id (optional): Filter by branch
  - as_of_date (optional): Date for the report (default: today)

Response: PDF file download
Filename: trial_balance_{date}.pdf
```

### 2. Profit & Loss Statement
**PDF Export:**
```
GET /api/accounting/reports/p-and-l/export/pdf
Parameters:
  - branch_id (required): Branch ID
  - start_date (required): Period start date
  - end_date (required): Period end date

Response: PDF file download
Filename: profit_loss_{start_date}_to_{end_date}.pdf
```

### 3. Balance Sheet
**PDF Export:**
```
GET /api/accounting/reports/balance-sheet/export/pdf
Parameters:
  - branch_id (optional): Filter by branch
  - as_of_date (optional): Date for the report (default: today)

Response: PDF file download
Filename: balance_sheet_{date}.pdf
```

### 4. Journal Entries
**Excel Export:**
```
GET /api/accounting/journal-entries/export/excel
Parameters:
  - branch_id (optional): Filter by branch
  - start_date (optional): Period start date
  - end_date (optional): Period end date

Response: Excel file download
Filename: journal_entries_{start_date}_to_{end_date}.xlsx
```

### 5. Stock Counts
**PDF Export:**
```
GET /api/accounting/stock-counts/export/pdf
Parameters:
  - count_id (required): Stock count session ID

Response: PDF file download
Filename: stock_count_{count_id}.pdf
```

## Frontend Integration Example

```typescript
// Export Trial Balance
const exportTrialBalance = async () => {
  const params = new URLSearchParams({
    branch_id: activeBranchId,
    as_of_date: selectedDate
  });
  
  const url = `${PYTHON_API_URL}/api/accounting/reports/trial-balance/export/pdf?${params}`;
  window.open(url, '_blank');
};
```

## Document Features

### PDF Documents Include:
- ✅ Professional header with hotel branding
- ✅ Page numbers and generation timestamp
- ✅ Formatted tables with proper styling
- ✅ Color-coded sections
- ✅ Totals and subtotals
- ✅ KES currency formatting
- ✅ Branch name and date ranges

### Excel Documents Include:
- ✅ Formatted headers with styling
- ✅ Auto-sized columns
- ✅ Proper data types
- ✅ Professional color scheme
