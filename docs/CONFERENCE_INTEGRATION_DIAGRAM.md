# Conference Booking & Branch Accounting Integration Diagram

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE LAYER                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Reception Page  │  │ Branch Accounting│  │   Cashier Page   │  │
│  │   /reception     │  │    /invoices     │  │    /cashier      │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│           │                     │                      │             │
│           │                     │                      │             │
│  ┌────────▼─────────────────────▼──────────────────────▼─────────┐  │
│  │              useBranch() Context Provider                      │  │
│  │              activeBranchId: number                            │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ activeBranchId
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      COMPONENT LAYER                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │         ConferenceBookingModal                               │   │
│  │  • Uses activeBranchId from useBranch()                      │   │
│  │  • Fetches halls: getHalls(activeBranchId)                   │   │
│  │  • Creates booking with branch_id                            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │         CreateInvoiceModal                                   │   │
│  │  • Uses activeBranchId from useBranch()                      │   │
│  │  • Type='conference' → createBooking(branch_id)              │   │
│  │  • Checks hall availability                                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │         Branch Accounting Invoices Page                      │   │
│  │  • Fetches: getBookings({ branch_id: activeBranchId })       │   │
│  │  • Maps conference bookings to invoice format                │   │
│  │  • Filters by activeBranchId                                 │   │
│  │  • Auto-refreshes on branch change                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ API Calls
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API LAYER                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  conferenceAPI.createBooking({ ...data, branch_id })                │
│  conferenceAPI.getBookings({ branch_id })                            │
│  conferenceAPI.getHalls(branch_id)                                   │
│  conferenceAPI.checkAvailability(hallId, start, end)                │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP Requests
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND LAYER                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  POST   /api/conference/bookings                                     │
│         → createConferenceBooking(req.body.branch_id)                │
│                                                                       │
│  GET    /api/conference/bookings?branch_id=X                         │
│         → getConferenceBookings(req.query.branch_id)                 │
│                                                                       │
│  GET    /api/conference/halls?branch_id=X                            │
│         → getHalls(req.query.branch_id)                              │
│                                                                       │
│  GET    /api/cashier/bill/:invoice_number (CNF-*)                    │
│         → getBillDetails(invoice_number)                             │
│                                                                       │
│  POST   /api/cashier/payment                                         │
│         → processCashierPayment(conference_booking_id)               │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ SQL Queries
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATABASE LAYER                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  conference_halls                                            │   │
│  │  • id (UUID)                                                 │   │
│  │  • name (TEXT)                                               │   │
│  │  • branch_id (INTEGER) ← FK to branches                      │   │
│  │  • capacity, base_price_per_day, base_price_per_hour        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  conference_hall_bookings                                    │   │
│  │  • id (UUID)                                                 │   │
│  │  • conference_hall_id (UUID) ← FK to conference_halls        │   │
│  │  • branch_id (INTEGER) ← FK to branches ✅                   │   │
│  │  • invoice_number (TEXT UNIQUE) ✅ CNF-YYYYMMDD-XXXX         │   │
│  │  • customer_name, customer_email, customer_phone             │   │
│  │  • start_date, end_date                                      │   │
│  │  • total_amount, amount_paid                                 │   │
│  │  • payment_status (pending/partial/paid)                     │   │
│  │  • booking_status (confirmed/cancelled/completed)            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  payments                                                    │   │
│  │  • id (UUID)                                                 │   │
│  │  • conference_booking_id (UUID) ← FK to bookings ✅          │   │
│  │  • amount, payment_method, status                            │   │
│  │  • reference, metadata                                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  cashier_transactions                                        │   │
│  │  • transaction_number                                        │   │
│  │  • branch_id (INTEGER) ← FK to branches                      │   │
│  │  • revenue_type: 'CONFERENCE'                                │   │
│  │  • reference_type: 'conference_booking'                      │   │
│  │  • reference_id (UUID)                                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow: Creating a Conference Booking

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: User Opens Modal                                             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: Modal Fetches Branch Context                                 │
│ const { activeBranchId } = useBranch()                               │
│ → activeBranchId = 1 (example)                                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: Fetch Available Halls                                        │
│ conferenceAPI.getHalls(activeBranchId)                               │
│ → Backend: SELECT * FROM conference_halls WHERE branch_id = 1        │
│ → Returns: [BOARDROOM, GARDEN HALL, OLIVE HALL]                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: User Fills Form & Submits                                    │
│ • Hall: BOARDROOM                                                     │
│ • Customer: KIPCHIMCHIM GROUP                                         │
│ • Dates: 2026-04-10 to 2026-04-12                                    │
│ • Amount: KES 25,000                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: Create Booking with Branch ID                                │
│ conferenceAPI.createBooking({                                         │
│   conference_hall_id: 'uuid-boardroom',                              │
│   branch_id: 1,  ← From activeBranchId                               │
│   customer_name: 'KIPCHIMCHIM GROUP',                                │
│   start_date: '2026-04-10',                                           │
│   end_date: '2026-04-12',                                             │
│   total_amount: 25000                                                 │
│ })                                                                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 6: Backend Generates Invoice Number                             │
│ const dateStr = '20260410'                                            │
│ const randomStr = '2792'                                              │
│ const invoice_number = 'CNF-20260410-2792'                            │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 7: Insert into Database                                         │
│ INSERT INTO conference_hall_bookings (                               │
│   id, conference_hall_id, branch_id, invoice_number,                 │
│   customer_name, start_date, end_date, total_amount,                 │
│   payment_status, booking_status                                     │
│ ) VALUES (                                                            │
│   'uuid-new', 'uuid-boardroom', 1, 'CNF-20260410-2792',              │
│   'KIPCHIMCHIM GROUP', '2026-04-10', '2026-04-12', 25000,            │
│   'pending', 'confirmed'                                              │
│ )                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 8: Update Hall Status                                           │
│ IF booking.start_date <= NOW() <= booking.end_date THEN              │
│   UPDATE conference_halls SET status = 'occupied'                    │
│   WHERE id = 'uuid-boardroom'                                         │
│ END IF                                                                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 9: Return Success to Frontend                                   │
│ { success: true, data: { invoice_number: 'CNF-20260410-2792' } }     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 10: Frontend Shows Success & Refreshes                          │
│ toast.success('Conference booking created')                          │
│ onSuccess() → Refreshes dashboard/invoices list                      │
└─────────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow: Viewing Conference Invoices

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: User Opens Branch Accounting Invoices Page                   │
│ Navigate to: /dashboard/branch-accounting/invoices                   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: Page Gets Active Branch                                      │
│ const { activeBranchId } = useBranch()                               │
│ → activeBranchId = 1                                                 │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: Fetch Accounting Invoices                                    │
│ const response = await api.accounting.getInvoices()                  │
│ → Returns: [INV-001, INV-002, ...]                                   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: Fetch Conference Bookings                                    │
│ const confResponse = await conferenceAPI.getBookings({               │
│   branch_id: activeBranchId,                                         │
│   status: 'confirmed'                                                 │
│ })                                                                    │
│ → Backend: SELECT * FROM conference_hall_bookings                    │
│            WHERE branch_id = 1 AND booking_status = 'confirmed'      │
│ → Returns: [CNF-20260410-2792, CNF-20260410-5274]                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: Map Conference Bookings to Invoice Format                    │
│ const conferenceInvoices = conferenceResponse.data.map(booking => ({ │
│   id: booking.id,                                                     │
│   invoice_number: booking.invoice_number,                            │
│   invoice_date: booking.created_at,                                   │
│   customer: {                                                         │
│     customer_name: booking.company_name || booking.customer_name,    │
│     email: booking.customer_email,                                    │
│     phone: booking.customer_phone                                     │
│   },                                                                  │
│   total_amount: booking.total_amount,                                 │
│   status: booking.payment_status,                                     │
│   type: 'CONFERENCE',                                                 │
│   branch_id: booking.branch_id                                        │
│ }))                                                                   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 6: Merge & Filter by Branch                                     │
│ let allInvoices = [...accountingInvoices, ...conferenceInvoices]     │
│ if (activeBranchId) {                                                 │
│   allInvoices = allInvoices.filter(inv =>                            │
│     inv.branch_id === activeBranchId                                  │
│   )                                                                   │
│ }                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 7: Display in UI                                                │
│ • INV-001 - Hotel Guest - KES 15,000                                 │
│ • CNF-20260410-2792 - KIPCHIMCHIM GROUP - KES 25,000                 │
│ • CNF-20260410-5274 - KIPTOO - KES 97,500                            │
│ • INV-002 - Restaurant Guest - KES 5,000                             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 8: User Switches Branch                                         │
│ activeBranchId changes: 1 → 2                                        │
│ → useEffect triggers with [activeBranchId] dependency                │
│ → fetchInvoices() runs again                                         │
│ → New invoices for branch 2 displayed                                │
└─────────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow: Processing Conference Payment

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: Cashier Enters Invoice Number                                │
│ Input: CNF-20260410-2792                                              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: Lookup Bill Details                                          │
│ cashierAPI.getBillDetails('CNF-20260410-2792')                        │
│ → Backend detects CNF- prefix                                        │
│ → SELECT * FROM conference_hall_bookings                             │
│   WHERE invoice_number = 'CNF-20260410-2792'                         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: Display Bill Details                                         │
│ • Customer: KIPCHIMCHIM GROUP                                         │
│ • Total: KES 25,000                                                   │
│ • Paid: KES 0                                                         │
│ • Balance: KES 25,000                                                 │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: Cashier Processes Payment                                    │
│ Amount: KES 25,000                                                    │
│ Method: MPesa                                                         │
│ Reference: QWERTY123                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: Backend Processes Payment                                    │
│ 1. Fetch booking by invoice_number                                   │
│ 2. INSERT INTO payments (                                            │
│      conference_booking_id, amount, payment_method, reference        │
│    )                                                                  │
│ 3. UPDATE conference_hall_bookings SET                               │
│      amount_paid = amount_paid + 25000,                              │
│      payment_status = 'paid'                                          │
│    WHERE invoice_number = 'CNF-20260410-2792'                        │
│ 4. INSERT INTO cashier_transactions (                                │
│      revenue_type: 'CONFERENCE',                                     │
│      reference_type: 'conference_booking'                            │
│    )                                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 6: Generate Receipt                                             │
│ POST /api/receipts/generate/base64                                   │
│ → Python service generates PDF receipt                               │
│ → Returns base64 encoded PDF                                         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 7: Display Success & Print Receipt                              │
│ toast.success('Payment processed successfully')                      │
│ → Opens print dialog with receipt                                    │
└─────────────────────────────────────────────────────────────────────┘
```

## 🎯 Key Integration Points

### 1. Branch Context Propagation
```typescript
// All components use the same branch context
const { activeBranchId } = useBranch();

// Reception Page
<ConferenceBookingModal /> // Uses activeBranchId internally

// Branch Accounting
<CreateInvoiceModal /> // Uses activeBranchId internally
fetchInvoices() // Filters by activeBranchId
```

### 2. Automatic Branch Assignment
```typescript
// When creating a booking
const bookingData = {
  ...formData,
  branch_id: activeBranchId  // ← Automatically assigned
};
await conferenceAPI.createBooking(bookingData);
```

### 3. Automatic Branch Filtering
```typescript
// When fetching bookings
const response = await conferenceAPI.getBookings({
  branch_id: activeBranchId,  // ← Automatically filtered
  status: 'confirmed'
});
```

### 4. Automatic Refresh on Branch Change
```typescript
// useEffect watches activeBranchId
useEffect(() => {
  fetchInvoices();
}, [activeBranchId]);  // ← Refetches when branch changes
```

## ✅ Verification Checklist

- [x] Conference halls have branch_id
- [x] Conference bookings have branch_id
- [x] Conference bookings have invoice_number
- [x] Payments table has conference_booking_id
- [x] Reception page uses activeBranchId
- [x] Branch accounting invoices uses activeBranchId
- [x] Branch accounting bookings uses activeBranchId
- [x] Create invoice modal uses activeBranchId
- [x] Cashier supports CNF- lookups
- [x] Auto-refresh on branch change
- [x] Hall status auto-updates
- [x] Payment processing works
- [x] Receipt generation works

## 🚀 System Ready for Production!
