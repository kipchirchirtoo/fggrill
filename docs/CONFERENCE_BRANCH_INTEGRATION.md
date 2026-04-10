# Conference Booking & Branch Accounting Integration

## Overview

The conference booking system is now fully integrated with the branch accounting invoices page. All conference bookings are branch-aware and automatically appear in the correct branch's accounting view.

## ✅ Completed Integration

### 1. Database Schema
- ✅ `conference_hall_bookings` table has `branch_id` column
- ✅ `conference_hall_bookings` table has `invoice_number` column (format: CNF-YYYYMMDD-XXXX)
- ✅ `payments` table has `conference_booking_id` foreign key
- ✅ All existing bookings backfilled with proper branch_id and invoice_number

### 2. Backend Integration
- ✅ `createConferenceBooking` controller accepts and stores `branch_id`
- ✅ `getConferenceBookings` controller filters by `branch_id`
- ✅ `getBillDetails` cashier controller supports CNF- invoice lookups
- ✅ `processCashierPayment` controller handles conference payments
- ✅ Automatic hall status updates based on booking times (every 15 minutes)

### 3. Frontend Integration

#### Reception Page (`/dashboard/reception`)
- ✅ `ConferenceBookingModal` uses `activeBranchId` from `useBranch()` context
- ✅ All conference bookings created from reception are automatically assigned to active branch
- ✅ Conference bookings appear in the reception dashboard filtered by branch

#### Branch Accounting Invoices Page (`/dashboard/branch-accounting/invoices`)
- ✅ Fetches both accounting invoices AND conference bookings
- ✅ Maps conference bookings to invoice format with proper fields:
  - `invoice_number`: CNF-YYYYMMDD-XXXX
  - `customer`: Company name, email, phone
  - `total_amount`: Total booking amount
  - `status`: paid/partial/unpaid based on payment_status
  - `type`: 'CONFERENCE'
  - `branch_id`: Branch where booking was made
- ✅ Filters all invoices by `activeBranchId`
- ✅ Automatically refreshes when branch changes
- ✅ Supports PDF download and printing for conference invoices

#### Create Invoice Modal
- ✅ When type='conference' AND hall is selected AND dates are provided:
  - Creates actual conference booking via `conferenceAPI.createBooking()`
  - Includes `branch_id` from `activeBranchId`
  - Generates invoice number automatically
- ✅ Falls back to accounting invoice if no hall booking
- ✅ Supports hotel and restaurant invoice types as well

#### Cashier Page (`/dashboard/cashier`)
- ✅ Supports CNF- invoice number lookups
- ✅ Displays conference booking details properly
- ✅ Processes payments and updates booking status
- ✅ Records payments in `payments` table with `conference_booking_id`
- ✅ Generates receipts for conference payments

## 🎯 User Workflow

### Creating Conference Bookings

**Option 1: From Reception Page**
1. Navigate to Reception → Conference tab
2. Click "New Booking" button
3. Fill in conference details (hall, dates, customer, etc.)
4. System automatically assigns current branch
5. Invoice number generated: CNF-YYYYMMDD-XXXX
6. Booking appears in branch accounting invoices

**Option 2: From Branch Accounting Invoices**
1. Navigate to Branch Accounting → Invoices
2. Click "Conference" button
3. Fill in customer details
4. Select hall and dates (optional)
5. Add line items for charges
6. System creates conference booking with current branch
7. Booking appears in invoices list immediately

### Viewing Conference Invoices

1. Navigate to Branch Accounting → Invoices
2. Click "Conference" tab to filter
3. All conference bookings for active branch displayed
4. Switch branches to see different branch bookings
5. Download PDF or print invoices as needed

### Processing Payments

1. Navigate to Cashier page
2. Enter CNF- invoice number
3. System fetches conference booking details
4. Process payment (Cash/MPesa/Card)
5. Payment recorded in database
6. Booking status updated (pending → partial → paid)
7. Receipt generated automatically

## 🔄 Branch Synchronization

### Automatic Branch Filtering
- All conference bookings are filtered by `activeBranchId`
- When user switches branches, invoices refresh automatically
- Each branch only sees their own conference bookings
- Cross-branch visibility controlled by user role permissions

### Branch Assignment Rules
1. **New Bookings**: Assigned to `activeBranchId` at creation time
2. **Existing Bookings**: Backfilled from `conference_halls.branch_id`
3. **Hall Selection**: Only halls from active branch shown in dropdown
4. **Payment Processing**: Cashier transactions recorded with branch context

## 📊 Data Flow

```
Reception Page (ConferenceBookingModal)
    ↓
    Uses activeBranchId from useBranch()
    ↓
Backend (createConferenceBooking)
    ↓
    Stores branch_id in conference_hall_bookings
    ↓
Branch Accounting Invoices Page
    ↓
    Fetches bookings filtered by activeBranchId
    ↓
    Displays as invoices with type='CONFERENCE'
```

## 🧪 Testing

Run the integration test:
```bash
cd backend
node test-conference-integration.js
```

Expected output:
- ✅ Conference halls are branch-aware
- ✅ Conference bookings have branch_id column
- ✅ Conference bookings have invoice_number column
- ✅ Branch filtering works correctly
- ✅ Payments table supports conference bookings

## 🔧 Maintenance Scripts

### Check Schema
```bash
cd backend
node fix-conference-branch.js
```

### Backfill Invoice Numbers
```bash
cd backend
node backfill-invoice-numbers.js
```

## 📝 Database Schema

### conference_hall_bookings
```sql
CREATE TABLE conference_hall_bookings (
    id UUID PRIMARY KEY,
    conference_hall_id UUID REFERENCES conference_halls(id),
    branch_id INTEGER REFERENCES branches(id),  -- ✅ Branch integration
    invoice_number TEXT UNIQUE,                  -- ✅ Invoice number (CNF-YYYYMMDD-XXXX)
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    total_amount DECIMAL(12,2),
    amount_paid DECIMAL(12,2) DEFAULT 0,
    payment_status TEXT DEFAULT 'pending',
    booking_status TEXT DEFAULT 'confirmed',
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### payments
```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY,
    conference_booking_id UUID REFERENCES conference_hall_bookings(id),  -- ✅ Conference payments
    amount DECIMAL(12,2) NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT DEFAULT 'completed',
    reference TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 🚀 Next Steps

The integration is complete and ready for production use. All conference bookings will:
1. ✅ Be assigned to the correct branch automatically
2. ✅ Appear in branch accounting invoices page
3. ✅ Be filterable by branch
4. ✅ Support full payment processing
5. ✅ Generate proper invoices and receipts

## 🐛 Troubleshooting

### Conference bookings not appearing in branch accounting
- Check that `activeBranchId` is set correctly
- Verify booking has `branch_id` field populated
- Run `node fix-conference-branch.js` to backfill missing branch_ids

### Invoice number missing
- Run `node backfill-invoice-numbers.js` to generate missing invoice numbers
- New bookings automatically get invoice numbers

### Payment processing fails
- Verify `payments` table has `conference_booking_id` column
- Check migration 66 was applied successfully
- Ensure cashier has proper role permissions

## 📞 Support

For issues or questions, check:
1. Backend logs: `backend/logs/app.log`
2. Frontend console for errors
3. Database schema using Supabase SQL Editor
4. Run integration tests to verify system health
