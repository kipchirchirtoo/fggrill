const fs = require('fs');
const path = require('path');

const dbData = JSON.parse(fs.readFileSync(path.join(__dirname, 'reception_db_structure.json'), 'utf8'));

function generateMarkdown() {
  let md = `# FAMOUSGATE HOTELS - RECEPTION & CASHIER MODULE DEEP-DIVE ANALYSIS REPORT

**Generated Date:** ${new Date().toISOString().split('T')[0]}  
**Environment:** Live Production Database (\`rvoaowhxyweswwuxbrzm\` - Supabase PostgreSQL 17)  
**Scope:** Backend API (\`backend/\`), Client Application (\`famous_gates_app/\`), and Live Database Schemas  

---

## 1. EXECUTIVE SUMMARY & ARCHITECTURE OVERVIEW

The **Reception & Cashier Module** forms the operational and financial core of the FamousGate Hotels Management System. It orchestrates the entire guest lifecycle from pre-arrival reservation to front desk check-in, in-house folio billing, cross-outlet charge-to-room posting, cashier shift reconciliation, and final check-out settlement.

### Key Architectural Layers
1. **Database Layer (Supabase / PostgreSQL 17)**: High-performance relational database with strict Row Level Security (RLS), automated triggers for folio balances, transactional integrity, and multi-branch data isolation via \`branch_id\`.
2. **Backend API Layer (Node.js / Express / TypeScript)**: Modular controller and service architecture handling operational business logic, rate calculation, shift reconciliation, audit trails, and payment provider integrations (M-Pesa, Cash, Card, Credit).
3. **Client Layer (\`famous_gates_app/\` & Next.js Frontend)**: Offline-first desktop and mobile client built with Flutter/Dart utilizing PowerSync SQLite local caching and real-time backend synchronization.

---

## 2. LIVE DATABASE SCHEMA ANALYSIS (${Object.keys(dbData).length} TABLES)

Below is the exact live database schema extracted directly from the active production PostgreSQL instance.

`;

  // Iterate over tables
  for (const [table, info] of Object.entries(dbData)) {
    md += `### Table: \`${table}\`
* **Live Row Count:** \`${info.rowCount}\`
* **Total Columns:** \`${info.columns.length}\`
* **Foreign Key References:** \`${info.foreignKeys.length}\`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
`;

    info.columns.forEach(col => {
      const isPk = col.column_name === 'id' ? ' **[PRIMARY KEY]**' : '';
      const fkMatch = info.foreignKeys.find(f => f.column_name === col.column_name);
      const fkDesc = fkMatch ? ` 🔗 FK -> \`${fkMatch.foreign_table_name}.${fkMatch.foreign_column_name}\`` : '';
      const defVal = col.column_default ? `\`${col.column_default.replace(/\|/g, '\\|')}\`` : '—';
      md += `| \`${col.column_name}\` | \`${col.data_type}\` | ${col.is_nullable === 'NO' ? '❌ No' : '✅ Yes'} | ${defVal} |${isPk}${fkDesc} |\n`;
    });

    if (info.foreignKeys.length > 0) {
      md += `\n#### Foreign Key Relationships\n`;
      info.foreignKeys.forEach(fk => {
        md += `- \`${table}.${fk.column_name}\` ➔ \`${fk.foreign_table_name}.${fk.foreign_column_name}\`\n`;
      });
    }

    md += `\n---\n\n`;
  }

  md += `
## 3. RECEPTION FEATURE DEEP-DIVE & BUSINESS LOGIC WORKFLOWS

### 3.1 Bookings & Reservations System
- **Twin Data Model (\`reservations\` & \`bookings\`):** Primary reservations live in \`reservations\` table, with status lifecycle: \`pending\`, \`confirmed\`, \`checked_in\`, \`checked_out\`, \`cancelled\`, \`no_show\`.
- **Reservation Creation & Pricing:** Calculates night count using Nairobi timezone (\`en-CA\` date formatting). Applies rate plans from \`rate_plans\` or custom room rates.
- **Check-In Workflow:** 
  1. Validates room status (must be vacant & clean/inspected).
  2. Updates reservation status to \`checked_in\`.
  3. Updates room status in \`rooms\` to \`occupied\`.
  4. Automatically initializes or attaches a guest folio in \`folios\` with opening room charges.
  5. Records timestamp in \`checked_in_at\`.
- **Check-Out Workflow:**
  1. Verifies folio balance is zero (\`balance <= 0\`).
  2. Settle outstanding charges or posts final payment via cashier.
  3. Updates reservation status to \`checked_out\` and sets \`checked_out_at\`.
  4. Updates room status to \`dirty\` (triggering housekeeping cleaning task in \`housekeeping_tasks\` / \`hk_tasks\`).
  5. Closes the guest folio (\`status = 'closed'\`).

### 3.2 Guest Profile & Document Management (\`guests\`, \`guest_profiles\`, \`guest_documents\`)
- **Guest Master Identification:** Tracks guest details including full name, phone number, email, national ID / Passport number, nationality, and VIP status.
- **KYC & Security Compliance:** Document uploads (\`guest_documents\`) store scanned copies of ID/Passport for police/security compliance.
- **Preference Tracking (\`guest_preferences\`):** Stores guest room preferences (e.g., quiet room, high floor, non-smoking, extra pillow).

### 3.3 Room Management & Real-Time Room Status (\`rooms\`, \`room_types\`, \`room_status_history\`)
- **Room Statuses:** \`vacant_clean\`, \`vacant_dirty\`, \`occupied\`, \`out_of_order\`, \`out_of_service\`, \`maintenance\`.
- **Audit History:** Any status transition writes a detailed log entry to \`room_status_history\` capturing previous status, new status, changed by user ID, reason, and branch ID.

### 3.4 Guest Folios & Accounting Engine (\`folios\`, \`folio_items\`, \`folio_payments\`, \`folio_transactions\`)
- **Folio Structure:**
  - \`room_charges\`: Total room stay cost.
  - \`food_charges\`: Restaurant & room service food charges.
  - \`beverage_charges\`: Bar & lounge beverage charges.
  - \`other_charges\`: Laundry, spa, transfer, or misc service charges.
  - \`total_charges\`: Sum of all charges.
  - \`total_payments\`: Cumulative payments posted to folio.
  - \`balance\`: Calculated as \`total_charges - total_payments\`.
- **Automated Database Triggers:** Triggers recalculate \`total_payments\`, \`total_charges\`, and \`balance\` upon insertion of rows into \`transactions\` / \`folio_items\`.

### 3.5 Charge-To-Room Functionality & Cross-Module Settlement
- **Outlet Posting Engine (\`room-charge.controller.ts\`):** Allows Cashiers and POS operators at Restaurant, Bar, Spa, or Outlets to post open bills directly to an in-house guest's room folio.
- **Validation Steps:**
  1. Checks if \`GUEST_ROOM_CHARGING\` feature flag is enabled for the branch in \`branch_features\`.
  2. Verifies specific outlet permission (e.g., \`RESTAURANT_ROOM_CHARGING\`, \`EXECUTIVE_BAR_ROOM_CHARGING\`, \`SPORTS_BAR_ROOM_CHARGING\`).
  3. Verifies that the guest reservation is actively checked-in (\`status IN ('checked_in', 'checked-in', 'in-house', 'active')\`) and check-in date <= today.
  4. Automatically resolves charge bucket (\`Food\`, \`Beverage\`, \`Other\`).
  5. Inserts charge row into \`transactions\` for the folio.
  6. Automatically updates the original POS source order/bill status to \`paid\` with payment method \`ROOM_CHARGE\` across 7 potential bill tables:
     - \`pos_shift_orders\`
     - \`unpaid_bills\`
     - \`shift_transactions\`
     - \`pos_master_bills\`
     - \`restaurant_orders\`
     - \`bar_orders\`
     - \`pos_orders\`

### 3.6 Cashier & Shift Management Engine (\`cashier_shifts\`, \`cashier_shift_logs\`, \`cashier_transactions\`, \`cashier_logbooks\`)
- **Shift Opening:** Cashier opens shift with an opening float (\`opening_float\`).
- **Shift Reconciliation & Closing:**
  - Records breakdown of total collections by payment mode: \`cash_collected\`, \`mpesa_collected\`, \`card_collected\`, \`bank_transfer_collected\`, \`room_charge_total\`, \`credit_bill_total\`.
  - Calculates variance: \`expected_cash = opening_float + cash_collected - cash_payouts\`, \`cash_variance = actual_cash_drawer - expected_cash\`.
  - Shift closing status requires supervisor/auditor clearance if variance exists (\`cashier-clearance.controller.ts\`).

### 3.7 Room Payments, Billing & Credit Management (\`payments\`, \`branch_payments\`, \`credit_bills\`, \`unpaid_bills\`, \`void_bills\`)
- **Supported Payment Methods:** Cash, M-Pesa (STK Push & Manual Reference), Credit Card (Stripe/Paystack), Bank Transfer, Room Charge, Staff/Corporate Credit.
- **Credit Bills (\`credit_bills\`):** Handles credit sales for corporate clients or approved guests. Tracks payment due date, auditor approvals, reconciliation status, and partial payments.
- **Void Bills & Auditing (\`void_bills\`, \`void_requests\`, \`cashier_shift_void_audits\`):** Any voided bill requires explicit supervisor approval, reason logging, and audit tracking.

### 3.8 Breakfast Pax & Meal Plan Engine (\`accommodation_breakfast_pax\`)
- **Pax Calculation (\`calculateBreakfastPaxSnapshot\`):**
  - Queries all checked-in guests for the branch.
  - Normalizes meal plans (\`BB\`, \`HB\`, \`FB\`, \`Bed & Breakfast\`, etc.).
  - Deluxe, Executive, and VIP room types automatically include breakfast eligibility.
  - Generates daily breakfast headcount snapshot for kitchen & restaurant staff reconciliation.

---

## 4. BACKEND API ENDPOINTS & CONTROLLER MAPPING

| HTTP Method | Route Endpoint | Controller File | Function Name | Description |
| :--- | :--- | :--- | :--- | :--- |
| \`GET\` | \`/api/bookings\` | \`booking.controller.ts\` | \`getBookings\` | List all reservations with filters & branch isolation |
| \`POST\` | \`/api/bookings\` | \`booking.controller.ts\` | \`createBooking\` | Create a new room reservation |
| \`POST\` | \`/api/bookings/:id/check-in\` | \`booking.controller.ts\` | \`checkIn\` | Execute guest check-in & room status update |
| \`POST\` | \`/api/bookings/:id/check-out\` | \`booking.controller.ts\` | \`checkOut\` | Execute guest check-out, folio closure & HK task trigger |
| \`GET\` | \`/api/rooms\` | \`room.controller.ts\` | \`getRooms\` | Fetch rooms listing with real-time status |
| \`PATCH\` | \`/api/rooms/:id/status\` | \`room.controller.ts\` | \`updateRoomStatus\` | Update room operational status & log to history |
| \`GET\` | \`/api/guests\` | \`guest.controller.ts\` | \`getGuests\` | Search and list guest profiles |
| \`POST\` | \`/api/guests\` | \`guest.controller.ts\` | \`createGuest\` | Create a new guest profile |
| \`GET\` | \`/api/room-charge/eligible-guests\` | \`room-charge.controller.ts\` | \`getEligibleGuests\` | List current in-house guests eligible for room charging |
| \`POST\` | \`/api/room-charge/post\` | \`room-charge.controller.ts\` | \`postRoomCharge\` | Post POS bill to in-house room folio & settle source bill |
| \`POST\` | \`/api/room-charge/folio/:id/settle\` | \`room-charge.controller.ts\` | \`settleRoomBill\` | Settle outstanding room folio balance at cashier |
| \`GET\` | \`/api/cashier/shifts/active\` | \`cashier-shifts.controller.ts\` | \`getActiveShift\` | Get currently open cashier shift |
| \`POST\` | \`/api/cashier/shifts/open\` | \`cashier-shifts.controller.ts\` | \`openShift\` | Open cashier shift with initial float |
| \`POST\` | \`/api/cashier/shifts/close\` | \`cashier-shifts.controller.ts\` | \`closeShift\` | Reconcile and close cashier shift |
| \`GET\` | \`/api/credit-bills\` | \`credit-bills.controller.ts\` | \`getCreditBills\` | Fetch corporate/guest credit bills |

---

## 5. FRONTEND CLIENT ARCHITECTURE (\`famous_gates_app/\`)

Located in \`famous_gates_app/lib/features/reception\` and \`famous_gates_app/lib/features/cashier\`:

### Key Presentation Screens
1. **Reception Dashboard (\`lib/features/reception/presentation/reception_dashboard.dart\` - 294 KB):**
   - Main front-desk hub displaying room grid, occupancy stats, quick check-in/check-out actions, arrival/departure feeds, and in-house guest list.
2. **Check-In Screen (\`screens/check_in_screen.dart\`):**
   - Handles guest search, room selection, ID verification, deposit payment, and check-in confirmation.
3. **Check-Out Screen (\`screens/check_out_screen.dart\`):**
   - Displays complete folio balance, itemized breakdown (room, food, beverage, laundry), payment collection, receipt printing, and check-out execution.
4. **Create Reservation Screen (\`screens/create_reservation_screen.dart\`):**
   - Date picker, room type selector, rate calculation, guest details, and advance deposit collection.
5. **Room Management Screen (\`screens/room_management_screen.dart\`):**
   - Interactive room grid with real-time status toggles (clean, dirty, out of order) and housekeeping assignment.
6. **Conference Booking Screen (\`screens/conference_booking_screen.dart\` - 102 KB):**
   - Conference hall reservation, seating arrangement, PAX count, and catering package selection.
7. **Cashier Dashboard (\`lib/features/cashier/presentation/cashier_dashboard.dart\` - 348 KB):**
   - Comprehensive POS & Front Desk Cashier station handling shift open/close, cash drawer management, bill settlement, room charge processing, and daily logbooks.

---

## 6. DATA ISOLATION & SECURITY AUDIT

1. **Multi-Branch Isolation (\`branch_id\`):**
   - Every reception table (\`reservations\`, \`rooms\`, \`folios\`, \`cashier_shifts\`, \`payments\`, \`credit_bills\`) includes an explicit \`branch_id\` column.
   - Database queries apply \`applyBranchFilter()\` middleware to enforce that branch staff can only view and mutate data belonging to their assigned branch.
   - Global roles (\`super_admin\`, \`director\`, \`general_manager\`, \`auditor\`) bypass branch restriction for cross-branch reporting.
2. **Audit Logging & Security:**
   - Security-sensitive actions (voiding bills, room status changes, manual balance adjustments) log to \`audit_logs\` and \`cashier_shift_void_audits\`.
   - RLS policies on Supabase prevent direct unauthorized database mutations from non-service clients.

---

## 7. SUMMARY & RECOMMENDATIONS

1. **Schema Consistency:** The twin presence of \`reservations\` and \`bookings\` is resolved in business logic by treating \`reservations\` as the active primary operational store.
2. **Charge-To-Room Robustness:** The charge-to-room engine cleanly settlement-syncs across 7 distinct source bill tables, eliminating orphan unpaid orders when charged to a room.
3. **Offline Sync Safety:** Ensure PowerSync triggers on \`famous_gates_app\` handle concurrent room status edits during network reconnection.

`;

  return md;
}

const content = generateMarkdown();
const target1 = path.resolve(__dirname, '../famous_gates_app/RECEPTION_MODULE_ANALYSIS_REPORT.md');
const target2 = path.resolve(__dirname, '../backend/RECEPTION_MODULE_ANALYSIS_REPORT.md');

fs.writeFileSync(target1, content, 'utf8');
console.log(`Saved ${target1}`);

fs.writeFileSync(target2, content, 'utf8');
console.log(`Saved ${target2}`);
