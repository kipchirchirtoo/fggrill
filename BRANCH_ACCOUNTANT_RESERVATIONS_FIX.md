# Branch Accountant Restaurant Reservations Access Fix

## Issue
Branch accountants were getting 403 Forbidden errors when trying to access the bookings page at `/dashboard/branch-accounting/bookings`.

Error: `User role branch_accountant is not authorized to access this route`

## Root Cause
The restaurant reservations API endpoint (`/api/restaurant/reservations`) only allowed these roles:
- SUPER_ADMIN
- GENERAL_MANAGER  
- RESTAURANT
- RECEPTIONIST

Branch accountants need read access to restaurant reservations for accounting/billing purposes.

## Fix Applied
Updated `backend/src/routes/restaurant.reservation.routes.ts` to add `BRANCH_ACCOUNTANT` role to:
- `GET /api/restaurant/reservations` - List all reservations
- `GET /api/restaurant/reservations/:id` - Get single reservation details

Branch accountants now have READ-ONLY access to view restaurant reservations but cannot:
- Create reservations
- Update reservations
- Confirm/seat/cancel reservations
- Mark as no-show

## Files Modified
- `backend/src/routes/restaurant.reservation.routes.ts`

## Testing
1. Login as branch accountant
2. Navigate to Branch Accounting > Bookings
3. Click on "Restaurant" tab
4. Should now see restaurant reservations without 403 error

## Note on Barcode Service Error
The console also shows: `GET http://localhost:5001/api/barcode/barcode-image/... net::ERR_CONNECTION_REFUSED`

This is a separate issue - the Python barcode service is not running. To fix:
1. Navigate to `python-services/` directory
2. Run: `python app.py` (or `python3 app.py`)
3. Service should start on port 5001

The barcode service is used for generating barcodes on invoices and other documents. PDFs will still generate without it, but won't include barcodes.
