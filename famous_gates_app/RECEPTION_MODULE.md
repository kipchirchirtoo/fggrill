# Reception Module — Flutter App Reference

> **Scope:** The `famous_gates_app` (Flutter) reception front-desk experience — the Reception
> dashboard and its sections (reservations, check-in/out, breakfast pax, rooms, room bills, guests,
> housekeeping, conference, catering, cashier, history, email automation), the shared Room Bills /
> folio settlement widget, the reception repository (API client) and its domain models.
>
> **Backend / live-DB companion:** [`backend/RECEPTION_MODULE.md`](../backend/RECEPTION_MODULE.md) —
> full Postgres schema (verified against the live DB on 2026‑07‑29), triggers, and endpoint auth.
> This document focuses on the client; it references the backend doc for schema/field detail.

---

## 1. Where the code lives

```
famous_gates_app/lib/features/
├── reception/
│   ├── domain/
│   │   ├── models.dart          # Booking, Room, Guest models (+ parsers)
│   │   └── providers.dart       # Riverpod providers for reception state
│   ├── data/
│   │   └── repository.dart      # ReceptionRepository — all reception API calls
│   └── presentation/
│       ├── reception_dashboard.dart      # Shell + ReceptionSection router (entry point)
│       └── screens/
│           ├── screens.dart               # barrel export
│           ├── create_reservation_screen.dart
│           ├── check_in_screen.dart
│           ├── check_out_screen.dart
│           ├── room_management_screen.dart
│           ├── guest_management_screen.dart
│           ├── housekeeping_screen.dart
│           └── conference_booking_screen.dart
└── shared/presentation/
    ├── room_bills_view.dart      # Shared Room Bills list + folio sheet (Reception + Cashier)
    └── guest_invoice_pdf.dart    # Guest invoice/receipt PDF builder
```

Provider entry point: `receptionRepositoryProvider`
([repository.dart:12](lib/features/reception/data/repository.dart#L12)) wraps two Dio clients —
`dioProvider` (Node/Express API) and `pythonDioProvider` (Python reports/finance service).

---

## 2. The Reception dashboard shell

[`ReceptionDashboard`](lib/features/reception/presentation/reception_dashboard.dart) is a
`ConsumerStatefulWidget` built on `MasterDashboardShell`. On load it fires **~18 guarded API calls in
sequence** (`_load()` → `_ReceptionSnapshot`) — each wrapped in `guard()` so one failure never blanks
the dashboard. It can also deep-link into the embedded Cashier section via
`cashierBillRef`/`cashierAmount`/`cashierMethod` constructor args (used by "Pay at Cashier").

### 2.1 Sections (`enum ReceptionSection`) and their nav items
| Nav label | Section | Screen / widget | Backend |
|---|---|---|---|
| Overview | `overview` | inline KPIs (checked-in, breakfast-eligible, calculated/confirmed pax) | `/bookings`, `/rooms`, breakfast-pax |
| Reservations | `reservations` | reservations list + `create_reservation_screen` | `/bookings*` |
| Check In / Out | `checkInOut` | `check_in_screen` / `check_out_screen` | `/bookings/:id/check-in`,`/check-out` |
| Breakfast Pax | `breakfastPax` | inline pax confirm + kitchen-send + PDF | `/bookings/breakfast-pax/daily` |
| Rooms | `rooms` | `room_management_screen` | `/rooms*` |
| Room Bills | `roomBills` | `RoomBillsView(canSettle:false)` (read-only) | `/room-charge/eligible-guests`, `/folios/*` |
| Cashier | `cashier` | embedded cashier dashboard | `/cashier/*` |
| Guests | `guests` / `guestProfile` | `guest_management_screen` + profile/history | `/guests*` |
| Housekeeping | `housekeeping` | `housekeeping_screen` | `/housekeeping/*` |
| Conference | `conference` | `conference_booking_screen` | `/conference/*` |
| Catering | `catering` | catering bookings | `/catering-bookings*` |
| History | `history` | stay/guest history | `/guests/:id/history` |
| Email Automation | `emailAutomation` | SMTP email actions | `/email/*` |

> Reception embeds the **Cashier** module directly (`cashier_dashboard.dart`) so a receptionist can
> take payment without leaving the shell. "Room Bills" here is **read-only** (`canSettle:false`); the
> actual settlement happens in the Cashier's own Room Bills tab (`canSettle:true`).

---

## 3. `ReceptionRepository` — client API surface

Every method injects `branch_id` automatically (`_branchParams` / `_withBranch`, read from secure
storage). Responses are unwrapped through flexible extractors (`_payload`, `_mapList`) that handle
`{data:{...}}`, `{guests:[...]}`, `{bookings:[...]}`, bare arrays, etc.

### 3.1 Bookings / reservations
| Method | HTTP call |
|---|---|
| `getBookings({status, params})` / `getBookingRows` | `GET /bookings` |
| `getBooking(id)` | `GET /bookings/:id` |
| `createBooking(data)` / `createBookingRow` | `POST /bookings` |
| `updateBooking(id, data)` | `PUT /bookings/:id` |
| `cancelBooking(id, {reason})` | `PUT /bookings/:id/cancel` |
| `checkIn(id)` / `checkInBooking(id)` | `PUT /bookings/:id/check-in` |
| `checkOut(id)` / `checkOutBooking(id)` | `PUT /bookings/:id/check-out` |
| `getAvailableRooms(params)` | `GET /bookings/available` |
| `getQuote(data)` / `getBookingQuote({...})` | `POST /bookings/quote` |
| `getDailyBreakfastPax({date})` | `GET /bookings/breakfast-pax/daily` |
| `saveDailyBreakfastPax({date, confirmedPax, status, adjustmentReason})` | `PUT /bookings/breakfast-pax/daily` |

### 3.2 Rooms
`getRooms`/`getRoomRows` → `GET /rooms`; `getRoom(id)` → `GET /rooms/:id`;
`getRoomTypes()` → `GET /rooms/types`; `getRoomBookings(roomId)` → `GET /rooms/:id/bookings`;
`updateRoomStatus(roomId, status)` → `PATCH /rooms/:id/status`.

### 3.3 Guests
`getGuests`/`getGuestRows({search})` → `GET /guests`; `getGuest(id)` → `GET /guests/:id`;
`createGuest` → `POST /guests`; `updateGuest`/`deleteGuest`; `getGuestHistory(id)` →
`GET /guests/:id/history`; `getGuestLoyalty(id)` → `GET /guests/:id/loyalty`.

### 3.4 Folio / Room Bills
`getFolio(bookingId)` → `GET /folios/reservation/:reservationId` (returns `{folio, transactions}`).
The **Room Bills list** and **settle** are called directly via `dioProvider` from
`room_bills_view.dart` (see §5), not through named repository methods:
`GET /room-charge/eligible-guests` and `POST /room-charge/folio/:reservationId/settle`.

### 3.5 Housekeeping
`getHousekeepingTasks`, `getHousekeepingRoomGrid` → `/housekeeping/dashboard/room-grid`,
`getHousekeepingRooms` → `/housekeeping/rooms`, `createHousekeepingGuestRequest`,
`updateHousekeepingTaskStatus`, `updateHousekeepingRoomStatus`, `updateHousekeepingTask`.

### 3.6 Conference & catering
Conference: `getConferenceHalls`, `updateConferenceHall`, `getConferenceBookings`,
`createConferenceBooking`, `updateConferenceBookingStatus`, `cancelConferenceBooking`,
`addConferencePayment`, `downloadConferenceInvoice`.
Catering: `getCateringBookings`, `createCateringBooking`, `updateCateringBooking`,
`cancelCateringBooking`, `recordCateringPayment`.

### 3.7 Cashier bridge (used by the embedded cashier section)
`getCashierStats`, `getCashierPayments` (`/payments-verification`), `getUnpaidBills`
(`/cashier/unpaid-bills`), `getCreditBills`, `createDynamicBill`, `recordBillPayment`,
`getLogbookToday`/`saveLogbook`/`submitLogbook`, `clockAttendance`, `requestPettyCash`.

### 3.8 Email (SMTP) & reports (Python)
`sendBookingConfirmationEmail`, `sendCancellationEmail`, `sendPaymentReceiptEmail`,
`sendInvoiceEmail`, `sendCheckInReminder`, `sendCheckOutReminder`, `testEmailConnection`.
Python service: `verifyCheckoutAnomaly` (`/api/finance/verify-anomaly`),
`downloadCheckoutBill` (`/api/reports/generate/checkout-bill`) → saved PDF.

---

## 4. Domain models ([models.dart](lib/features/reception/domain/models.dart))

All three models keep the full API row in `raw` and expose typed getters; parsers are defensive
(accept snake_case & camelCase, nested `guest`/`room`/`type` objects).

### 4.1 `Booking`
Maps a `reservations` row. Fields: `id, guestId, roomId, guestName/Phone/Email, roomNumber, roomType,
checkIn, checkOut, status, totalAmount, amountPaid, confirmationNumber, specialRequests, createdAt`.
Derived: `balance = totalAmount − amountPaid`, plus raw getters `adults/children/infants, mealPlan,
bookingSource, depositAmount, paymentMethod, roomRate, subtotal, taxAmount, serviceCharge`.
`statusLabel` maps `confirmed/checked_in/checked_out/cancelled/pending` → display text.

### 4.2 `Room`
Fields: `id, number, roomNumber, type, floor, status, guestName, checkInDate, checkOutDate,
checkedInAt, mealPlan, adults, children, totalPax, pricePerNight`. `effectiveMealPlan` auto-upgrades
Deluxe/Executive/VIP room types to Bed & Breakfast when no meal plan is set. Getters: `maxOccupancy,
isClean, roomTypeId, displayNumber`.

### 4.3 `Guest`
Fields: `id, name, firstName, lastName, email, phone, idType, idNumber, carNumberPlate, isVip,
totalVisits, createdAt`. Raw getters: `address, nationality, vipTier, loyaltyPoints, blacklistStatus,
blacklistReason, notes`.

---

## 5. Room Bills + folio settlement (the money path)

[`RoomBillsView`](lib/features/shared/presentation/room_bills_view.dart) is the shared widget embedded
by **both** Reception (read-only) and the Cashier (`canSettle:true`).

1. **List** — `GET /room-charge/eligible-guests?branch_id=…` → in-house guests with `room_number`,
   `guest_name`, `folio_balance`, `total_amount`, `stay_nights`, meal plan, etc. (search + outstanding
   total header).
2. **Folio sheet** (`_FolioSheet`) — tap a guest → loads folio detail; shows a gradient header
   (room + guest + Settled/Outstanding badge), a "Guest & stay" card, a "Charges" breakdown
   (accommodation + food/beverage/other), a "Folio transactions" card, and a sticky action bar.
   Because a lazily-created folio can report `total_charges = 0`, the sheet falls back to the
   reservation figures (`_folioHasCharges` gate) so it never shows a misleading `KES 0`.
3. **Two actions:**
   - **Generate Invoice** → prints the customer invoice (folio charges as cart items) via the
     document/print service.
   - **Pay at Cashier** → hands the guest's `HTL…` confirmation number to the cashier. From Reception
     it calls `onPayAtCashier(lookupCode)` to open the **embedded** Cashier section (stays in the
     shell); standalone it navigates `context.go('/cashier?billRef=<HTL…>')`. The cashier's
     `getBillDetails` resolves the HTL code → auto-loads the guest + folio for settlement.
4. **Direct settle** (cashier) → `POST /room-charge/folio/:reservationId/settle {amount, method}` →
   backend inserts a folio `transactions` payment row; the `recalc_folio_totals` DB trigger drops the
   balance. See backend doc §4–§7 for the ledger/trigger detail.

> **Hotel bills are no longer in the cashier's general Unpaid Bills list** — they were deliberately
> moved to this Room Bills area. See [`backend/RECEPTION_MODULE.md` §7](../backend/RECEPTION_MODULE.md).

---

## 6. Charge-to-Room (POS side, for context)

Charge-to-Room is initiated from the **POS/cashier** modules, not the reception dashboard: a cashier
loads a POS bill, picks "Charge to Room", selects an in-house guest, and the backend
(`POST /room-charge/post`) posts the bill to that guest's folio (food/beverage/other bucket) and
settles the originating POS bill with method `ROOM_CHARGE`. Reception then sees the increased folio
balance in Room Bills. Feature gating (`GUEST_ROOM_CHARGING` + per-outlet flags) and in-house
eligibility rules are documented in the backend doc §6.4.

---

## 7. Breakfast Pax section

The Breakfast Pax section calls `GET /bookings/breakfast-pax/daily` to show **calculated** pax (every
checked-in guest in-house on the breakfast morning, check-out day inclusive) vs **confirmed** pax.
Reception can tag early/packed breakfasts and dietary notes, print an A4 breakfast sheet (guest names,
booking refs, room numbers, signature block), confirm & "send to kitchen", and save/lock the count via
`PUT /bookings/breakfast-pax/daily` (`status: draft|confirmed|locked`). Deluxe/Executive/VIP room types
are flagged breakfast-eligible automatically.

---

## 8. Notes / cautions for client work

1. **`branch_id` is auto-injected** by the repository — don't add it manually to request bodies/params.
2. **Response shapes vary** — always go through `_payload`/`_mapList`; the Room Bills list is under the
   `guests` key, folio under `folio`.
3. **"Pay at Cashier" needs `go_router`** for the standalone path; inside Reception prefer the
   `onPayAtCashier` callback so the user stays in the shell.
4. **Folio can be lazily created** with zero totals — UI must fall back to reservation figures (already
   handled in `_FolioSheet`).
5. **Settlement is Cashier-only** (`canSettle`); Reception's Room Bills is intentionally read-only.
6. **A `Booking` model == a `reservations` DB row** (the backend "Booking" class also maps to
   `reservations`). The parent `bookings` table is not surfaced directly in the app.
7. Avoid `ColorScheme.surfaceContainerHighest` (SDK may lack it) — the shared widgets use
   `Colors.grey.shade100` instead.

---

*Generated 2026‑07‑29 from the Flutter source. For the authoritative, live-verified database schema,
triggers and endpoint auth, see [`backend/RECEPTION_MODULE.md`](../backend/RECEPTION_MODULE.md).*
