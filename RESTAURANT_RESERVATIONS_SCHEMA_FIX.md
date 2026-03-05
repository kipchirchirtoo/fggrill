# Restaurant Reservations Schema Cache Fix

## Problem
Branch accountants were getting 500 Internal Server Error when accessing `/dashboard/branch-accounting/bookings`:
```
Error: Could not find a relationship between 'restaurant_reservations' and 'restaurant_customers' in the schema cache
```

## Root Cause
The backend controller was trying to use Supabase relationship syntax to join `restaurant_reservations` with `restaurant_customers` and `restaurant_tables`:

```typescript
.select(`
  *,
  customer:restaurant_customers(*),
  table:restaurant_tables(*)
`)
```

However, the `restaurant_reservations` table does NOT have a foreign key constraint on `customer_id` pointing to `restaurant_customers(id)`. The field exists but it's not a foreign key, so Supabase can't create the relationship.

## Database Schema
From `backend/supabase/migrations/13_restaurant_simple.sql`:

```sql
CREATE TABLE IF NOT EXISTS restaurant_reservations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id),
  reservation_number TEXT NOT NULL UNIQUE,
  customer_id UUID,  -- ❌ NOT a foreign key!
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  guest_phone TEXT,
  party_size INTEGER NOT NULL,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  status reservation_status DEFAULT 'pending' NOT NULL,
  table_id UUID REFERENCES restaurant_tables(id),  -- ✅ This IS a foreign key
  ...
);
```

## Solution Applied
Removed the relationship syntax from the controller queries. The reservations already contain all the guest information directly (guest_name, guest_email, guest_phone), so we don't need to join with restaurant_customers.

### Files Modified
- `backend/src/controllers/restaurant.reservation.controller.ts`
  - `getReservations()`: Changed `.select('*')` instead of joining with customer and table
  - `getReservationById()`: Changed `.select('*')` instead of joining with customer, table, and section

## Testing
1. Restart the backend server (if not already done)
2. Login as branch accountant
3. Navigate to Branch Accounting > Bookings
4. Click on "Restaurant" tab
5. Should now see restaurant reservations without 500 error

## Notes
- The frontend already handles displaying guest information from the reservation record directly
- The `customer_id` field in `restaurant_reservations` is optional and not currently used
- If customer relationship is needed in the future, a foreign key constraint should be added to the database schema

## Previous Fixes
- Added BRANCH_ACCOUNTANT role to GET routes in `backend/src/routes/restaurant.reservation.routes.ts` (403 fix)
- Removed invalid relationship queries from controller (500 fix)
