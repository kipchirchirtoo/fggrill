# CRITICAL FIX: Reports Not Showing Data

## Problem
Reports in Auditor Reports and Central Store Reports pages are generating PDFs/Excel files but showing NO ACTUAL DATA - just empty tables or "No data" messages even when data exists in the database.

## Root Cause
After analyzing the code, I found THREE critical issues:

### Issue 1: Data Fetcher Returns Error Objects Instead of Empty Structures
When `database_fetcher.fetch_report_data()` encounters an error or no data, it returns:
```python
{'error': 'Some error message'}
```

But the PDF generators expect:
```python
{
    'items': [],
    'total_value': 0,
    'voided_orders': [],
    # ... other fields
}
```

### Issue 2: Missing Data Validation in API Endpoint
The `/api/reports/generate/branded-pdf` endpoint doesn't validate if data was successfully fetched before passing it to the PDF generator.

### Issue 3: Frontend Not Handling Empty Data Responses
The frontend API calls don't check if the backend returned actual data or an error message.

## Files That Need Fixing

1. **python-services/reports/database_fetcher.py**
   - Lines: 1718-2300 (all fetch methods)
   - Fix: Ensure ALL fetch methods return proper empty structures, never `None` or error-only objects

2. **python-services/app.py**
   - Line: 143-180 (`generate_branded_pdf_report`)
   - Fix: Add data validation and better error handling

3. **python-services/reports/branded_pdf_generator.py**
   - Lines: 949-3250 (all report generators)
   - Fix: Add defensive checks for None/missing data

4. **frontend/src/lib/api.ts**
   - Lines: 3166-3375 (reportsAPI methods)
   - Fix: Add response validation

## Quick Test to Verify the Issue

Run this in your Python service console:
```python
from reports.database_fetcher import DatabaseFetcher
db = DatabaseFetcher()

# Test inventory report
data = db.fetch_report_data('inventory_status', {'branch_id': 1})
print("Inventory data:", data)

# Test exception logs
data = db.fetch_report_data('exception_logs', {
    'start_date': '2026-02-01',
    'end_date': '2026-02-18',
    'branch_id': 2
})
print("Exception logs:", data)
```

If you see `{'error': '...'}` or `None`, that's the problem!

## The Fix (Step by Step)

I'll now create the fixes for each file.
