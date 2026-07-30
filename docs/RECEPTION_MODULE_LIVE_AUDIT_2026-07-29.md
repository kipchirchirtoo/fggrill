# Reception Module Live Audit

Date: 2026-07-29
Workspace: `c:\Users\user\OneDrive\Desktop\fggrill`
Active Flutter frontend: `famous_gates_app`
Backend API: `backend`

## Purpose

This document is a thorough audit of the current Reception module across:

- Flutter reception screens
- backend routes/controllers/services
- live Supabase tables actually holding reception data
- overlapping legacy vs active data models
- room billing, folio, cashier, breakfast pax, and charge-to-room flows

It is intended to answer one question clearly:

What is the real source of truth for reception operations right now?

## Method Used

I used three sources together:

1. Codebase scan of the active frontend and backend.
2. Live database inspection against Supabase using the backend service-role connection.
3. Repository schema snapshots and migrations where direct metadata access timed out from this machine.

Important limitation:

- Live table rows and sample columns were inspected directly.
- Some zero-row table schemas were supplemented from `schema_analysis.json`, `schema-audit-report.json`, and migrations because direct `information_schema` access timed out.

## Main Reception Code Paths

### Frontend

- `famous_gates_app/lib/features/reception/presentation/reception_dashboard.dart`
- `famous_gates_app/lib/features/reception/data/repository.dart`
- `famous_gates_app/lib/features/reception/domain/models.dart`
- `famous_gates_app/lib/features/shared/presentation/room_bills_view.dart`
- `famous_gates_app/lib/features/cashier/presentation/cashier_dashboard.dart`

### Backend

- `backend/src/routes/booking.routes.ts`
- `backend/src/controllers/booking.controller.ts`
- `backend/src/controllers/room.controller.ts`
- `backend/src/routes/room.routes.ts`
- `backend/src/controllers/folio.controller.ts`
- `backend/src/routes/folio.routes.ts`
- `backend/src/controllers/room-charge.controller.ts`
- `backend/src/routes/room-charge.routes.ts`
- `backend/src/controllers/cashier.controller.ts`
- `backend/src/routes/cashier.routes.ts`
- `backend/src/controllers/guest.controller.ts`
- `backend/src/routes/guest.routes.ts`
- `backend/src/routes/housekeeping.routes.ts`
- `backend/src/routes/conference.routes.ts`
- `backend/src/routes/catering-booking.routes.ts`
- `backend/src/routes/payments.routes.ts`

## Reception Screen Inventory

The main reception shell in `reception_dashboard.dart` currently contains these surfaces:

- Overview
- Reservations
- Check In / Check Out
- Breakfast Pax
- Rooms
- Room Bills
- Cashier
- Guests
- Housekeeping
- Conference
- Catering
- History
- Email Automation

Key section widgets found:

- `_ReservationsSection`
- `_CheckInOutSection`
- `_RoomsSection`
- `_GuestsSection`
- `_HousekeepingSection`
- `_ConferenceSection`
- `_CateringSection`
- `_CashierSection`

The Reception repository calls these API groups:

- `/bookings`
- `/rooms`
- `/guests`
- `/cashier`
- `/folios`
- `/room-charge`
- `/housekeeping`
- `/conference`
- `/catering-bookings`
- `/payments-verification`

## High-Level Source of Truth

### 1. Reservations vs Bookings

The live system has both `bookings` and `reservations`.

Operationally, the Reception module currently behaves as if `reservations` is the live source of truth for accommodation workflow:

- reservation listing
- check-in
- check-out
- breakfast pax
- room occupancy resolution
- room bills linkage to folios

The `bookings` table still exists and contains live data, but the current backend reception controllers are centered on `reservations`.

### 2. Rooms

The `rooms` table holds room master data and a stored room status, but that status can drift away from the active reservation state.

The most reliable occupancy truth is:

- active reservation state in `reservations`
- then room master data in `rooms`
- then room status audit in `room_status_history`

### 3. Room Bills / Folios

Room billing is not driven by `unpaid_bills`.

The live room-bill chain is:

- `reservations`
- `folios`
- `folio_transactions`
- `transactions`
- `payments`

### 4. Cashier Shifts

Legacy `cashier_shifts` is empty.

The live cashier shift and reconciliation truth is:

- `cashier_shift_logs`
- `cashier_logbooks`
- `cashier_logbook_lines`
- `cashier_transactions`
- `shift_transactions`

### 5. Housekeeping

There are two housekeeping data families:

- legacy `housekeeping_*`
- active enhanced `hk_*`

The newer route/controller stack is built around the `hk_*` tables.

## Live Database Tables: Reception Core

Below are the live tables most directly tied to reception as of 2026-07-29.

### Branch and Setup

#### `branches`

Live row count: `10`

Purpose:

- branch master table
- branch isolation root for all reception data
- also still carries old central-store flags

Sample columns observed live:

`id, name, legal_name, email, phone, address, city, country, is_active, metadata, created_at, updated_at, code, location, manager_id, is_main_branch, status, is_central_warehouse, can_create_items, can_dispatch, warehouse_capacity, contact_person, branch_type, number_of_rooms, settings, timezone, currency, logo_url, opening_date, default_till_number`

#### `branch_features`

Live row count: `7`

Purpose:

- runtime feature toggles per branch
- room charging is gated here

Sample columns observed live:

`id, branch_id, feature_name, feature_key, category, is_enabled, config, updated_at, updated_by`

Reception-relevant feature found in code and live setup:

- `GUEST_ROOM_CHARGING`

## Live Database Tables: Accommodation

### `room_types`

Live row count: `6`

Purpose:

- room type master
- pricing and occupancy defaults

Sample columns observed live:

`id, branch_id, code, name, base_rate, max_occupancy, amenities, is_active, created_at, updated_at, price_per_night, rate, type_name`

### `rate_plans`

Live row count: `5`

Purpose:

- room pricing plans
- meal plan linkage

Sample columns observed live:

`id, branch_id, room_type_id, code, name, rate_per_night, meal_plan, min_stay, max_stay, is_active, valid_from, valid_to, metadata, created_at, updated_at`

### `rooms`

Live row count: `64`

Purpose:

- room master table
- room status display in the Rooms screen
- housekeeping integration point

Sample columns observed live:

`id, branch_id, room_type_id, room_number, floor, building, status, housekeeping_status, is_active, created_at, updated_at, amenities, image_url, price_override, max_occupancy, type_id, is_clean, room_type, notes, last_cleaned, current_guest, hk_status, cleaning_priority, is_vip, assigned_attendant_id, last_cleaned_at, expected_checkout, dnd_start_time, rate`

Important note:

- `rooms.status` is not always trustworthy by itself.
- It must be checked against current `reservations`.

### `room_status_history`

Live row count: `409`

Purpose:

- audit history of room status changes

Sample columns observed live:

`id, room_id, old_status, new_status, changed_by, reason, created_at`

Relevant DB-side behavior:

- backend migrations define `update_room_status_history()` trigger logic
- backend service `booking.service.ts` also writes room status history during booking operations

### `bookings`

Live row count: `82`

Purpose:

- older or parallel booking header table
- still contains accommodation records

Sample columns observed live:

`id, branch_id, booking_number, guest_id, room_id, booking_type, status, check_in_at, check_out_at, pax, subtotal, tax_amount, service_charge, discount_amount, total_amount, amount_paid, payment_status, created_by, metadata, created_at, updated_at, deposit_amount, deposit_paid, room_rate, meal_plan, booking_source, special_requests, adults, children, infants, internal_notes, payment_method, check_in_date, check_out_date, confirmation_number`

Current reception risk:

- this table overlaps heavily with `reservations`
- current reception APIs do not treat it as the primary screen source

### `reservations`

Live row count: `84`

Purpose:

- operational accommodation source of truth
- reservations list
- check-in / check-out workflow
- breakfast pax calculation
- room bill anchoring

Sample columns observed live:

`id, branch_id, booking_id, reservation_number, guest_id, room_id, status, reserved_from, reserved_to, created_by, created_at, updated_at, check_in_date, check_out_date, confirmation_number, total_amount, amount_paid, payment_status, payment_method, special_requests, adults, children, checked_in_at, checked_in_by, checked_out_at, checked_out_by, cancelled_at, cancelled_by, cancellation_reason, room_type_id, rate_plan_id, room_rate, subtotal, tax_amount, service_charge, discount_amount, deposit_amount, deposit_paid, deposit_paid_at, booking_source, channel_manager_ref, meal_plan, purpose, notes, internal_notes, short_code, infants`

Observed active statuses in code logic:

- `confirmed`
- `checked_in`
- `checked_out`
- `cancelled`

### `reservation_guests`

Live row count: `0`

Purpose:

- intended guest-to-reservation linking table for multiple occupants

Current reality:

- live table is empty
- most current reception screens appear to rely more on `reservations.guest_id` plus `guests`

### `guests`

Live row count: `61`

Purpose:

- guest master data
- guest profiles
- room occupants and booking guest names

Sample columns observed live:

`id, branch_id, first_name, last_name, phone, email, id_number, id_type, car_plate, loyalty_tier, loyalty_points, metadata, created_at, updated_at, is_vip, blacklist_status, blacklist_reason, nationality, date_of_birth, total_visits, address, preferences, car_number_plate, vip_tier, notes, city, country, blacklist_status_bool`

## Live Database Tables: Room Bills, Folios, and Charge to Room

### `folios`

Live row count: `84`

Purpose:

- one accommodation financial ledger per reservation/booking
- used by Room Bills screen
- used by Charge to Room

Sample columns observed live:

`id, branch_id, folio_number, booking_id, guest_id, status, total_charges, total_payments, balance_due, created_at, updated_at, room_charges, food_charges, beverage_charges, other_charges, settled, settled_at, notes, reservation_id, balance`

Important behavior:

- backend `folio.controller.ts` will create a folio automatically for a reservation if one is missing

### `folio_transactions`

Live row count: `7`

Purpose:

- detailed folio audit ledger
- charge-to-room postings
- reversals
- categorized guest charges

Sample columns observed live:

`id, folio_id, branch_id, transaction_type, category, description, amount, tax_amount, total_amount, reference, posted_by, posted_at, status, created_at`

### `transactions`

Live row count: `7`

Purpose:

- generic transaction ledger used by room-settlement code and some financial flows

Sample columns observed live:

`id, folio_id, type, category, amount, description, reference_number, performed_by, created_at`

### `payments`

Live row count: `2`

Purpose:

- payment records linked to reservation, invoice, POS, cashier shift, or room bill settlement

Sample columns observed live:

`id, branch_id, booking_id, restaurant_order_id, bar_order_id, pos_transaction_id, cashier_shift_id, amount, payment_method, reference_number, reference, customer_name, recorded_by, cashier_id, status, metadata, recorded_at, created_at, updated_at, reservation_id, invoice_id, payment_date`

### Charge-to-Room logic summary

The backend room-charge flow currently works like this:

1. Validate that the branch feature `GUEST_ROOM_CHARGING` is enabled.
2. Find eligible in-house guests from `reservations`, joined to `rooms`, `guests`, and `folios`.
3. Validate that the reservation is still an active stay.
4. Create a folio if missing.
5. Insert a generic row into `transactions`.
6. Update folio charge buckets:
   - `food_charges`
   - `beverage_charges`
   - `other_charges`
7. Insert a detailed audit row into `folio_transactions`.
8. Mark the source POS bill settled where applicable.

This means charge-to-room is not a simple payment action. It is a folio-posting workflow.

## Live Database Tables: Breakfast Pax

### `accommodation_breakfast_pax`

Live row count: `1`

Purpose:

- saved breakfast-pax snapshot and confirmation record for accommodation

Sample columns observed live:

`id, branch_id, breakfast_date, calculated_pax, confirmed_pax, status, adjustment_reason, source_snapshot, created_by, confirmed_by, confirmed_at, created_at, updated_at`

Current breakfast pax logic in code:

- calculated from `reservations`
- filtered by in-house stay on the breakfast date
- `checked_in` reservations are the key live source
- meal plan information is carried from the reservation

## Live Database Tables: Cashier, Station, and Shift Control

### `cashier_shifts`

Live row count: `0`

Purpose:

- legacy cashier shift table

Current reality:

- not the live source of truth

### `cashier_shift_logs`

Live row count: `173`

Purpose:

- canonical cashier shift lifecycle
- opening/closing float
- actual vs expected collections
- reconciliation status
- approval trail

Sample columns observed live:

`id, shift_id, action, actor_id, notes, created_at, branch_id, status, shift_number, cashier_id, cashier_name, shift_start, shift_end, opening_float, closing_float, expected_closing_float, variance, total_cash_sales, total_mpesa_sales, total_card_sales, total_sales, transaction_count, reconciled_by, reconciled_at, reconciliation_notes, verified_by, verified_at, verification_notes, submitted_at, submitted_by, approved_by, approved_at, swimming_pool_revenue, pool_token_revenue, conference_revenue, room_booking_revenue, restaurant_revenue, bar_revenue, other_revenue, credit_bills_taken, credit_bills_count, unpaid_bills_value, unpaid_bills_count, paid_bills_value, paid_bills_count, credit_bills_details, paid_bills_details, unpaid_bills_details, cash_at_hand, cash_deposited, bank_deposit_ref, pool_na, conference_na, rooms_na, updated_at, requested_at, opening_requested_by, opening_approved_by, opening_approved_at, opening_rejected_by, opening_rejected_at, opening_review_notes, expense_total, expense_details, actual_cash_counted, actual_mpesa_logged, actual_card_logged, mpesa_summary_ref, card_batch_ref, reconciliation_status, hard_closed_by, hard_closed_at, variance_reason_code, variance_comment`

Reception implication:

- this is the real shift table feeding cashier control and reconciliation

### `cashier_logbooks`

Live row count: `162`

Purpose:

- cashier logbook summary per shift or outlet shift
- review and audit workflow

Sample columns observed live:

`id, branch_id, shift_id, cashier_id, logbook_number, period_start, period_end, opening_float, closing_float, total_sales, status, created_at, updated_at, outlet_shift_id, outlet_id, total_cash, total_mpesa, total_card, total_credit_bill, type, log_date, total_swipe, sales_breakdown, notes, source, automation_run_id, submitted_at, approved_by, approved_at, auditor_id, audited_at, audit_notes, cashier_shift_id, accountant_reviewed_by, accountant_reviewed_at, accountant_notes`

### `cashier_logbook_lines`

Live row count: `19,753`

Purpose:

- detailed lines feeding cashier logbooks

Sample columns observed live:

`id, logbook_id, line_type, description, amount, reference, created_at, payment_method, order_id, section, customer_name, staff_id, source_table, source_id, outlet_shift_id, automation_run_id, metadata`

### `cashier_transactions`

Live row count: `18,493`

Purpose:

- granular cashier transactions
- payment and source-document ledger

Sample columns observed live:

`id, branch_id, cashier_shift_id, transaction_number, transaction_type, payment_method, amount, source_module, source_document_type, source_document_id, source_document_number, status, created_by, created_at, cashier_id, cashier_name, shift_id, cashier_shift_log_id, revenue_type, reference_type, reference_id, customer_name, customer_phone, payment_reference, reference_number, credit_bill_id, total_amount, amount_paid, amount_tendered, change_given, invoice_number, order_number, bill_number, confirmation_number, transaction_date, recorded_at, booking_date, booking_status, payment_status, approval_status, method, notes, metadata, updated_at`

### `shift_transactions`

Live row count: `18,168`

Purpose:

- shift-linked commercial transaction ledger

Sample columns observed live:

`id, shift_id, transaction_id, transaction_ref, payment_method, amount, transaction_time, source_table, source_id, branch_id, notes, is_voided, voided_at, voided_by, created_at, transaction_number, total_amount, service_category`

### `unpaid_bills`

Live row count: `0`

Purpose:

- generic unpaid-bill structure used by non-room cashier flows

Important reception note:

- room bills are not sourced from this table
- Reception room billing now sits in `reservations` + `folios`

### `pos_shift_orders`

Live row count observed earlier in this environment: `18,628`

Purpose:

- live POS order source
- relevant when restaurant/bar bills are later charged to room or cleared through cashier

Sample columns observed live:

`id, shift_id, outlet_id, source_type, source_id, order_number, customer_name, order_type, table_number, room_number, waiter_id, waiter_name, status, payment_status, kitchen_status, total_amount, amount_paid, balance_amount, items, void_request_status, is_split, split_parent_order_id, split_type, is_merged, merged_into, staff_credit_bill_id, migrated_to_credit_bill, inventory_posted_at, inventory_posted_by, inventory_reversed_at, inventory_reversed_by, kitchen_started_at, kitchen_ready_at, kitchen_served_at, voided_at, voided_by, void_reason, created_by, created_at, updated_at, short_code, branch_id, payment_method, captain_printed_at, bill_reprint_count, is_exchange, exchange_parent_order_id, exchange_request_id, original_bill_printed_at, last_bill_printed_at, master_bill_id, sub_bill_status`

### `pos_master_bills`

Live row count: `1`

Purpose:

- aggregated POS bill settlement structure

Sample columns observed live:

`id, master_bill_number, branch_id, origin_outlet_id, origin_outlet_name, table_number, customer_name, opening_waiter_id, opening_waiter_name, settlement_cashier_id, settlement_cashier_name, payment_method, status, total_amount, amount_paid, created_at, updated_at, bill_requested_at, paid_at, closed_at`

## Live Database Tables: Guests, Documents, and Loyalty

### `customer_invoices`

Live row count: `0`

Purpose:

- invoice records referenced during guest delete validation and finance flows

### `quotations`

Live row count: `0`

Purpose:

- commercial quotations, including guest-linked references

### `documents`

Live row count: `0`

Purpose:

- general document storage references

### `guest_documents`

Live row count: `0`

Purpose:

- guest document linkage

### `loyalty_transactions`

Live row count: `0`

Purpose:

- guest loyalty ledger

## Live Database Tables: Housekeeping

## Legacy housekeeping family

### `housekeeping_tasks`

Live row count: `0`

Schema known from legacy migration:

`id, room_id, task_type, priority, status, assigned_to, due_date, notes, created_by, created_at, updated_at, completed_at, completed_by, verification_required, verified_at, verified_by`

### `housekeeping_supplies`

Schema known from legacy migration:

`id, category_id, name, description, unit, minimum_stock, current_stock, status, last_ordered_at, created_at, updated_at`

### `housekeeping_supply_requests`

Schema known from legacy migration:

`id, supply_id, requested_by, quantity, status, urgency, notes, created_at, updated_at, approved_at, approved_by, fulfilled_at, fulfilled_by`

### `housekeeping_supply_transactions`

Schema known from legacy migration:

`id, supply_id, transaction_type, quantity, previous_stock, new_stock, notes, created_by, created_at`

## Active enhanced housekeeping family

### `hk_tasks`

Live row count: `0`

Schema confirmed from repo schema snapshots:

`id, task_number, room_number, priority, status, assigned_at, assigned_by, scheduled_start, due_by, started_at, paused_at, resumed_at, completed_at, actual_duration_minutes, completion_notes, inspection_id, is_vip, guest_preferences, special_instructions, created_at, updated_at, original_task_id, rework_count, branch_id, assigned_to`

### `hk_guest_requests`

Live row count: `0`

Schema confirmed from repo schema snapshots:

`id, request_number, room_number, guest_name, booking_id, preferred_date, is_vip, in_room, assigned_at, completed_by, completion_notes, guest_feedback, branch_id, created_at, updated_at, room_id, request_type, description, items_requested, preferred_time, priority, source, received_by, status, assigned_to, completed_at, guest_satisfied`

### `hk_inspections`

Live row count: `0`

Schema confirmed from repo schema snapshots:

`id, inspection_number, room_id, room_number, tidiness_score, bathroom_score, amenities_score, linens_score, maintenance_score, overall_score, inspected_at, rework_task_id, created_at, branch_id, inspected_by`

### `hk_room_status_history`

Live row count: `0`

Schema confirmed from repo schema snapshots:

`id, room_id, previous_status, new_status, changed_by, reason, metadata, created_at`

### `hk_maintenance_requests`

Live row count: `0`

Schema confirmed from repo schema snapshots:

`id, request_number, room_number, location_description, other, description, is_safety_issue, impacts_room_availability, reported_at, completed_at, completed_by, resolution_notes, verified_at, sla_breached, branch_id, created_at, updated_at, room_id, category, subcategory, priority, reported_by, status, assigned_to, assigned_at, started_at, verified_by, sla_due_at`

### Other enhanced housekeeping tables observed live with zero rows

- `hk_staff_profiles`
- `hk_daily_metrics`
- `hk_staff_daily_metrics`
- `hk_staff_schedules`
- `hk_shift_definitions`
- `hk_leave_requests`
- `hk_shift_swaps`

## Live Database Tables: Conference and Catering

### `conference_halls`

Live row count: `7`

Purpose:

- conference hall master data exposed inside the reception module

Sample columns observed live:

`id, branch_id, code, name, capacity, rate_per_day, amenities, is_active, created_at, updated_at, status, base_price_per_day, base_price_per_hour, description`

### `conference_hall_bookings`

Live row count: `0`

Purpose:

- conference event bookings

### `catering_bookings`

Live row count: `0`

Purpose:

- catering bookings surfaced in reception

Important note:

- conference and catering surfaces exist in the module and backend
- current live booking volume in those tables is zero

## Reception Functional Flow Analysis

## 1. Reservations screen

Primary read path:

- Flutter: `ReceptionRepository.getBookings()`
- API: `GET /bookings`
- Backend: `booking.controller.ts`

Current source of truth:

- `reservations`
- joined with `guests`
- joined with `rooms`

This means the Reservations screen is functionally a reservations view, not a raw `bookings` table view.

## 2. Check In / Check Out

Primary write path:

- `PUT /bookings/:id/check-in`
- `PUT /bookings/:id/check-out`

Operational behavior:

- update reservation status in `reservations`
- write check-in/check-out timestamps
- update room status
- write room status history
- create or finalize folio behavior during the stay lifecycle

## 3. Rooms screen

Primary read path:

- `GET /rooms`

Current truth model:

- room master from `rooms`
- effective occupancy should be reconciled against `reservations`
- room status history from `room_status_history`

Important live issue already identified during this audit:

- some Kyogong rooms had stale `rooms.status` values that did not match live reservations
- that mismatch is exactly why Reception pages can disagree when one screen trusts `rooms` and another trusts `reservations`

## 4. Room Bills screen

Primary read path:

- Flutter shared view: `room_bills_view.dart`
- API: `GET /room-charge/eligible-guests`

Current truth model:

- `reservations`
- `rooms`
- `guests`
- `folios`
- `folio_transactions`
- `transactions`

The Room Bills screen is built around in-house reservation folios, not around cashier generic unpaid bills.

## 5. Charge to Room

Primary write path:

- `POST /room-charge/post`

Eligibility logic:

- reservation must be active/in-house
- room-charging feature must be enabled for the branch

Financial write path:

- validate eligible stay
- create or fetch folio
- insert `transactions`
- update `folios`
- insert `folio_transactions`
- settle the source POS bill if appropriate

This is why Charge to Room must always be analyzed together with:

- Reservation state
- Folio existence
- Folio charge buckets
- POS source bill status

## 6. Guest Folio

Primary read path:

- `GET /folios/reservation/:bookingId`

Current folio behavior:

- auto-create folio if missing
- recalculate totals from folio transactions
- merge reservation charges and posted room charges
- compute running balance from charges vs payments

## 7. Breakfast Pax

Primary read/write path:

- `GET /bookings/breakfast-pax/daily`
- `POST /bookings/breakfast-pax/daily`

Current truth model:

- `reservations` with in-house stay overlap for the breakfast date
- saved confirmation snapshot in `accommodation_breakfast_pax`

## 8. Reception Cashier

Primary reception repository calls:

- `/cashier/stats`
- `/cashier/unpaid-bills`
- `/cashier/credit-bills`
- `/cashier/logbook/today`
- `/payments-verification`

Important separation:

- generic cashier desk uses cashier billing structures
- hotel room folio balances are handled through room-bill and folio workflows
- the shared room-bills view explicitly separates hotel room bills from cashier general unpaid bills

## 9. Guests

Primary truth model:

- `guests`
- guest-linked `reservations`
- folio/invoice/history lookups

Delete protection checks depend on:

- `reservations`
- `reservation_guests`
- `folios`
- `customer_invoices`
- `quotations`
- `documents`
- `guest_documents`
- `rooms.current_guest`

## 10. Housekeeping

Current system state:

- legacy tables exist
- enhanced `hk_*` system also exists
- routes and newer backend logic are aligned more with `hk_*`

This means future reception housekeeping alignment should standardize on one family only.

## 11. Conference and Catering

Reception exposes these modules, but live booking data is currently minimal:

- `conference_halls` contains live setup data
- `conference_hall_bookings` has zero rows
- `catering_bookings` has zero rows

## Mismatch and Drift Findings

## 1. Dual booking model

There is a real architecture split between:

- `bookings`
- `reservations`

The reception module currently behaves as reservation-first.

If any other screen still reads from `bookings` directly, data drift is likely.

## 2. Room status drift

`rooms.status` can be stale compared to active reservation state.

If one screen reads `rooms.status` directly while another derives status from `reservations`, users will see mismatching occupancy.

## 3. Room bills are not cashier unpaid bills

Room-bill data is coming from folio-backed accommodation tables, not from the general cashier unpaid-bill queue.

Any screen that tries to mix the two will misstate balances.

## 4. Folio writes are split across two ledgers

Current room-charge flow writes both:

- `transactions`
- `folio_transactions`

That means any room-bill summary must understand both ledgers or follow the backend folio controller aggregation.

## 5. Cashier canonical table is not `cashier_shifts`

The live system uses:

- `cashier_shift_logs`

Any feature still built on `cashier_shifts` is using the wrong foundation.

## 6. Housekeeping has two competing schemas

There is a legacy family and an enhanced family.

That makes housekeeping one of the highest-risk areas for future data mismatches unless the module is standardized.

## 7. Reservation guest occupancy detail is underused

`reservation_guests` is empty live.

That means multi-occupant or companion-guest logic may be under-modeled in active reception flows.

## 8. Conference and catering screens are structurally present but lightly populated

The UI and API are present, but live operational rows are currently near-zero in their booking tables.

## Most Important Current Reception Truths

If the goal is to stop reception mismatches, these are the operational truths to keep:

1. `reservations` is the live accommodation workflow source.
2. `rooms` is the room master table, not always the final occupancy truth.
3. `folios` is the anchor for room billing.
4. `folio_transactions` is the detailed room-charge audit trail.
5. `cashier_shift_logs` is the canonical cashier shift table.
6. `accommodation_breakfast_pax` is the saved breakfast-pax confirmation table.
7. `branch_features` controls whether room charging is allowed.

## Recommended Canonical Mapping for Reception Screens

To keep data aligned, these screens should map to these tables first:

- Reservations: `reservations`
- Check In / Check Out: `reservations`, `rooms`, `room_status_history`
- Rooms: `rooms` plus live reservation-derived occupancy
- Room Bills: `reservations`, `folios`, `folio_transactions`, `transactions`, `payments`
- Charge to Room: `reservations`, `folios`, `folio_transactions`, `transactions`
- Breakfast Pax: `reservations`, `accommodation_breakfast_pax`
- Guests: `guests`, `reservations`, `folios`
- Cashier: `cashier_shift_logs`, `cashier_logbooks`, `cashier_transactions`, `shift_transactions`
- Housekeeping: prefer `hk_*` family
- Conference: `conference_halls`, `conference_hall_bookings`
- Catering: `catering_bookings`

## Files Most Worth Reviewing Next

If you want a follow-up implementation pass after this audit, these are the highest-value files:

- `backend/src/controllers/booking.controller.ts`
- `backend/src/controllers/room.controller.ts`
- `backend/src/controllers/folio.controller.ts`
- `backend/src/controllers/room-charge.controller.ts`
- `backend/src/controllers/cashier.controller.ts`
- `famous_gates_app/lib/features/reception/presentation/reception_dashboard.dart`
- `famous_gates_app/lib/features/shared/presentation/room_bills_view.dart`
- `famous_gates_app/lib/features/cashier/presentation/cashier_dashboard.dart`

## Output File

This audit was written to:

- `docs/RECEPTION_MODULE_LIVE_AUDIT_2026-07-29.md`
