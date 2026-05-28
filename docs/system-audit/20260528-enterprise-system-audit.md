# Famous Gates Enterprise System Audit

Date: 2026-05-28  
Scope: `/home/allansamuel/Desktop/fggrill`  
Mode: evidence-first discovery; no feature assumptions.

## 1. Full Project Structure Analysis

The repository is a multi-client hotel ERP:

- `backend`: Express/TypeScript API, mounted from `backend/src/routes/index.ts`.
- `frontend`: Next.js App Router dashboard reference implementation.
- `famous_gates_app`: Flutter application used for role dashboards and POS surfaces.
- `python-services`: Flask/reporting and branded document generation services.
- `database/migrations`, `backend/src/database/migrations`, `backend/supabase/migrations`: SQL schema evolution.
- Other clients: `landing-page`, `famous-gates-desktop`, `famousgate-mobile`, analytics service, legacy Electron.

Measured current footprint:

- Backend route/controller/service files inspected by inventory command: 356 files.
- Next.js dashboard files under `frontend/src/app/dashboard`: 615 files.
- Flutter feature files under `famous_gates_app/lib/features`: 238 files.
- SQL migrations across known migration roots: 251 files.
- Live public database base tables: 488.

The worktree was already dirty before this audit. Notable dirty files include backend route/service files, Flutter branch/kitchen/cashier/store/accountant/manager files, and an untracked migration `database/migrations/20260528_kitchen_display_prep_status.sql`. These must be preserved and reviewed before any broad refactor.

## 2. Full Functionality Inventory

### Backend

`backend/src/routes/index.ts` mounts 93 API route groups under `/api`. The route scan found 1,148 Express route declarations. Major mounted domains include:

- Auth/users/security/admin/system/search/admin-logs/admin-ai.
- Bookings, rooms, guests, rate plans, pricing, channel manager, documents.
- Restaurant, restaurant reservations/tables, waiter sales, bar, kyogong, cashier, POS outlets.
- Payments, receipts, folios, banking, finance, accounting, revenue oversight, profit/loss.
- Staff, attendance, leave, performance, payroll, payroll-simple, payroll-enhanced, payroll-adjustments, payroll-policies, statutory deductions.
- Store/storekeeping, stock analytics, stock takes, dispatch, procurement, suppliers, kitchen ledger, kitchen.
- Auditor, auditor reports, audit, void bills, verification, branch operations.
- Conference, catering, buffet, food-control, catering food-control, wastage, facilities, maintenance, fleet.

Largest route files by route count include housekeeping, storekeeping, finance, branch-operations, kitchen, auditor, bar, kyogong, restaurant, staff, dispatch, accounting, payroll-simple, cashier.

### Frontend

Next.js dashboards exist for admin, auditor, branch-accountant, branch-accounting, branch-manager, branch-store, central-store, cashier, hr, kitchen, kitchen-operations, kyogong, storekeeping, and many operational modules.

Central-store reference pages include inventory, foodstuffs, bar-items, stock-takes, spoilage, requests, packing, dispatch, receiving, receiving-barcode, procurement/GRN, suppliers, supplier invoices/payments/purchase-orders/reports, vehicles and drivers.

Auditor reference pages include financial verification, shift verification, revenue oversight, sales audit, banking, invoices, discrepancies, branch orders, sold items, stock audit, bar stock, purchases, deliveries, kitchen ledger/requisitions/usage/wastage, business/M-Pesa, credit bills, void bills, cashier logbooks, staff audit, payroll approvals and approvals.

HR reference pages include employees, attendance, attendance logs, leave, payroll, salaries, adjustments, policies, performance and terminal.

### Flutter

Flutter feature modules exist for admin, auditor, auth, bar, branch accountant, branch manager, branch operations, branch storekeeper, cashier, diagnostics, director, driver, employee, facilities, finance, GM, housekeeping, HR, HR terminal, kitchen, kitchen operations, kyogong, maintenance, POS, procurement, reception, reports, restaurant, search, settings, shared, store, superadmin and system.

Evidence shows Flutter still has parity gaps with the Next.js reference: several screens are generic API resource renderers and some services call stale or wrong endpoints.

### Database

Live DB discovery found 245 module-related tables among 488 base tables. Relevant tables exist for payroll, leave, credit/unpaid bills, audit, inventory/stock/requisitions, booking, billing, payments, PO/GRN, POS/cashier, restaurant/bar/kitchen and store workflows.

Live functions include order/bill/payment numbering, shift calculations, stock/requisition/GRN/PO processing, stock take submission, bill status/payment updates, credit/settlement helpers and audit helpers.

## 3. System Architecture Report

Backend architecture:

- `server.ts` delegates to a central router.
- Route modules apply `protect`/`authorize` middleware and call controllers.
- Controllers use Supabase query builder for most CRUD and `db`/Pool for complex SQL.
- Multi-branch isolation is inconsistently centralized: some controllers use shared helpers, others pass query params directly.
- Python services provide report/barcode/PDF integrations used by web and some APIs.

Frontend architecture:

- Next.js is the most complete workflow reference and uses `frontend/src/lib/api/*` fetch clients.
- Flutter is a separate implementation using Dio repositories and Riverpod providers.
- Flutter frequently reimplements Next.js flows instead of sharing typed contracts, causing route drift.

Database architecture:

- PostgreSQL/Supabase is the source of truth.
- It contains mature domains but also overlapping historical schemas. Inventory and payroll are the clearest examples of parallel tables and APIs.
- Number generation and lifecycle transitions live partly in database functions and partly in controllers.

## 4. Module Discovery Report

The following requested modules exist in the implementation:

- Payroll: found in backend payroll route families, `staff_profiles`, `payroll_runs`, `payroll_records`, `staff_payroll*`, `payroll_policies`, `payroll_deduction_rates`, `staff_credit_bills`, staff advances/loans.
- Leave: found under staff routes/controllers and `staff_leave`.
- Credit/unpaid bills: found under cashier, payroll-simple, credit routes and `staff_credit_bills`, `staff_credit_bill_payments`, `unpaid_bills`, `credit_bills`, `employee_credit_bills`.
- Audit: found under auditor/audit/auditor-reports/admin-logs/security routes and audit tables.
- Stock/inventory/requisition: found under storekeeping, stock-takes, dispatch, procurement, kitchen and many store/stock tables.
- Booking: found under bookings, rooms, guests, rate-plans, channel manager, payments.
- Billing: found under cashier, payments, restaurant bills, receipts, folios, customer invoice tables.
- Purchase orders and GRN: found under procurement and storekeeping routes/tables.

## 5. Payroll System Report

Evidence:

- Backend mounts `/api/payroll`, `/api/payroll/simple`, `/api/payroll-enhanced`, `/api/payroll-adjustments`, `/api/payroll-statutory`, `/api/payroll-policies`, and `/api/staff/simple-payroll`.
- `payroll-simple.routes.ts` supports credit bill migration, credit bill partial payment, advances, loans, payroll generation/history/summary, payslip email/zip, pending approvals and approve/reject actions.
- `payroll-adjustments.routes.ts` supports adjustment CRUD lifecycle: create, approve, reject, void.
- `payroll-enhanced.routes.ts` supports deduction rates, payroll calculation, processing, bulk processing and payslips.
- Live DB has `payroll_runs` with `draft` status, `payroll_records`, payroll policies/deduction tables and staff payroll tables.

Flow:

Staff profiles feed payroll generation. Advances, loans and credit bills become deductions. Draft payroll runs produce records and payslips. Auditor/super admin approval endpoints exist for pending payroll items.

Risks:

- Multiple payroll APIs overlap. Without a single canonical payroll orchestration layer, Flutter/Next screens can drift.
- Credit bill data exists in multiple tables (`staff_credit_bills`, `employee_credit_bills`, `credit_bills`) and must be normalized at service boundaries.
- Payroll staff identity must use `staff_profiles.id`, not `users.id`, except where system login account data is explicitly needed.

## 6. Leave Management System Report

Evidence:

- `staff.routes.ts` includes leave update, approve, reject and report-to-duty routes.
- Live DB contains `staff_leave` with status data.
- HR dashboard pages exist in Next and Flutter.

Flow:

Leave is staff-profile based, approved/rejected by authorized staff routes, and appears in HR/auditor style dashboards.

Risks:

- Leave and attendance screens are split across HR, auditor and branch operation modules; duplicate display logic can cause inconsistent counts.

## 7. Credit Bills / Unpaid Bills System Report

Evidence:

- `cashier.routes.ts` includes `/cashier/unpaid-orders`, `/cashier/unpaid-orders/:source/:id/pay`, `/cashier/unpaid-bills/:id/pdf`, `/cashier/pay`, `/cashier/bill/:bookingId`.
- `payroll-simple.routes.ts` includes credit bill migration and partial payment endpoints.
- `credit.routes.ts` exposes `/credit/pending/:role` and `/:type/:id/confirm`.
- Current `credit.controller.ts` avoids embedded Supabase joins for `staff_credit_bills` and manually enriches `staff_profiles` and `users`, which addresses the schema-cache relationship error seen earlier.
- Live DB status counts show `staff_credit_bills`: pending 1, paid_cash 3.

Flow:

Cashier can record staff credit bills and unpaid bills. Accountant/auditor confirmation endpoints exist. Payroll-simple migration routes can move pending bills into payroll deductions.

Risks:

- Earlier runtime logs showed `/api/credit/pending/auditor` failing against `employee_credit_bills` to `staff_profiles`. Current source now queries `staff_credit_bills`; deployed backend may not match current repo.
- Business identity must be `staff_profiles`; `users` is only login/account metadata.

## 8. Audit System Report

Evidence:

- Backend mounts `/auditor`, `/audit`, `/auditor-reports`, `/reports/auditor`, `/admin-logs`, `/security`.
- Auditor Flutter screen calls `/auditor/anomalies/:id`, `/dispatch/auditor/deliveries`, `/credit/pending/auditor`.
- Live DB has audit logs/trails/exceptions/findings/plans/reviews/watchlist plus admin/security logs.

Flow:

Auditor reviews financial, shift, stock, dispatch, payroll and exception queues.

Risks:

- Runtime logs showed `/auditor/anomalies/:id?type=record` returns “Invalid entity type”. Flutter sends generic `record`; backend expects typed anomaly domains. The UI should pass the backend-supported entity type or suppress anomaly lookup for generic records.
- Auditor Flutter has broad generic table rendering and lacks several Next.js action flows.

## 9. Stock & Inventory/Requisition Report

Evidence:

- `storekeeping.routes.ts` contains item CRUD, categories, SKU/barcode, branch stock, stock movement, stock requests, auditor review/approve/reject, dispatch-notes, incoming dispatch receipt, dashboards, stock takes, central stock takes, central spoilage and kitchen usage.
- `stock-take.routes.ts` contains stock take worksheet, items, submit and categorized worksheet endpoints.
- `dispatch.routes.ts` contains central dispatch creation, OTP verification, document upload, GPS tracking, auditor delivery review and POS barcode integration.
- Live DB shows `stock_request_items` status `PENDING_AUDIT` and `stock_requests` statuses `PENDING_AUDIT`, `DISPATCHED`, `DELIVERED`.

Flow:

Branch storekeeper raises requests. Auditor approves/rejects requests. Approved requests go to central storekeeper packing and dispatch. Branch confirms delivery. Auditor can review completed deliveries. Stock takes and spoilage are separate audit flows.

Risks:

- Flutter central store currently uses `StoreDashboard` generic tabs for many workflows, whereas Next.js has dedicated pages and actions.
- Several inventory schemas overlap (`simple_items`, `store_items`, `inventory_items`, `branch_stock`, `stock_levels`, `stock_counts`, `central_stock_take_*`). Services need one canonical workflow per role.

## 10. Booking System Report

Evidence:

- `booking.routes.ts` supports availability, quotes, confirmation lookup, create/list/detail/update, check-in, check-out, cancel and modify.
- Live DB includes `bookings`, `booking_history`, `booking_payments`, status history and many specialized booking tables.

Flow:

Bookings connect to rooms/guests/rate plans/payments. Payment status updates also exist in DB functions.

Risks:

- Runtime logs showed repeated `/api/bookings` calls and loading loops. That is likely Flutter state/request retry logic rather than missing backend route because backend returned valid data.

## 11. Billing System Report

Evidence:

- DB functions include `generate_bill_number`, `update_bill_paid_amount`, `update_bill_status_on_payment`, `generate_payment_number`, receipt/payment functions.
- Backend exposes cashier payment, cashier bills, restaurant bills, payments, receipts and folios.
- Restaurant bill routes support open bills, payments, payment reversal, split bills, merge, void requests and audit log.

Flow:

Orders/bookings generate bills or searchable cashier references. Payments update bill status and cashier shift transactions.

Risks:

- Runtime error `invalid input syntax for type uuid: "POS-..."` proves some payment path still treats synthetic POS references as UUIDs. POS references and UUID primary keys must be separated at API boundaries.

## 12. Purchase Orders Report

Evidence:

- `procurement.routes.ts` supports purchase order approve/cancel/send plus supplier ledger/performance and reports.
- `storekeeping.routes.ts` also exposes purchase order approve/receive/cancel aliases.
- Live DB has `store_purchase_orders` statuses draft/approved.

Flow:

Purchase orders are supplier-linked, approved, sent/received and feed GRN/inventory.

Risks:

- PO flows exist in both procurement and storekeeping route groups. This should be documented as aliases or consolidated behind one service.

## 13. GRN System Report

Evidence:

- `procurement.routes.ts` has GRN approve/cancel.
- `storekeeping.routes.ts` exposes purchase order receive endpoints.
- DB functions include `process_grn_receipt`, `create_grni_on_grn_approval`, `update_inventory_from_approved_grn`.
- Live DB has `store_grn` draft records.

Flow:

GRN approval updates inventory and GRNI control accounting.

Risks:

- Flutter generic GRN forms do not yet reflect all Next.js receiving workflows, barcode printing and supplier document actions.

## 14. Flow Maps

### POS Order to Cashier Clearance

Waiter/POS user places order  
-> backend restaurant/POS order route assigns order number/short code  
-> kitchen display receives pending/preparing/ready state  
-> cashier sees uncleared/captain order  
-> cashier clears by short code/order number with one or more payment records  
-> bill status becomes cleared/paid  
-> shift transaction records cash/M-Pesa/card/credit sale  
-> uncleared order becomes unpaid waiter bill  
-> unpaid bill migrates into payroll deduction.

The individual pieces exist, but the Flutter POS/cashier integration must be verified against deployed endpoints before relying on it.

### Branch Store Request to Central Dispatch

Branch storekeeper creates stock request  
-> request enters `PENDING_AUDIT`  
-> auditor reviews and approves/rejects via storekeeping routes  
-> approved request appears to central storekeeper for packing  
-> central creates dispatch note  
-> driver/branch OTP or confirmation changes dispatch status  
-> branch receives stock  
-> auditor reviews completed delivery.

### Payroll

Staff profile  
-> salary/policy/attendance/leave/advance/loan/credit bill inputs  
-> payroll draft generation  
-> records and payslips  
-> accountant/auditor/super admin approval depending route  
-> finalized payroll and deductions.

## 15. Database Schema Report

Live schema evidence:

- 488 public base tables.
- 245 module-related tables.
- 1,599 indexes.
- DB functions exist for business number generation, stock/requisition/GRN/PO processing, stock take submission, payment and bill state updates, shift calculations and audit helpers.

Observed live status counts:

- `cashier_shift_logs`: open 2.
- `central_stock_take_sessions`: in_progress 3.
- `payments`: completed 2, pending 1.
- `payroll_runs`: draft 1.
- `pos_outlet_shifts`: open 2.
- `pos_shift_orders`: open 1, paid 1.
- `restaurant_orders`: cancelled 2, delivered 2, pending 2, preparing 4, ready 9, served 1.
- `staff_profiles`: active 363.
- `stock_requests`: pending audit/dispatched/delivered states present.
- `store_grn`: draft 8.
- `store_purchase_orders`: draft 4, approved 4.

## 16. Audit Findings

### Critical

1. Flutter/backend route drift causes runtime 404/500s.  
   Evidence: `famous_gates_app/lib/core/services/reports_service.dart` calls `/ml-forecasting/*`, but backend mounts forecasting under `/api/forecasting/*`. It calls `/stock-analytics`, while backend mounts stock analytics under `/api/store/*`.

2. POS synthetic references are being handled as UUIDs.  
   Evidence: runtime payment error: `invalid input syntax for type uuid: "POS-1779909755580"`.  
   Impact: cashier payment can fail even when bill lookup succeeds.

3. Flutter auditor anomaly lookup uses invalid generic entity type.  
   Evidence: runtime `/api/auditor/anomalies/:id?type=record` returns `Invalid entity type`; Flutter sends `type=record`.

### High

4. Multiple canonical systems overlap without a clear contract.  
   Evidence: payroll route families, inventory table families and central-store/procurement aliases.

5. Next.js is richer than Flutter for central-store, auditor and HR workflows.  
   Evidence: Next.js central-store has dedicated pages/actions; Flutter store dashboard uses `_StoreResourceTab` for many screens.

6. Deployment may not match current repo.  
   Evidence: current `credit.controller.ts` no longer queries `employee_credit_bills` joins, but runtime logs showed that deployed behavior.

7. Staff identity is sometimes confused with user identity.  
   Evidence: DB and controllers rely on `staff_profiles`; user-facing screens previously showed missing branch/name when using `users`.

### Medium

8. Branch isolation is uneven. Some repos pass `branch_id` from secure storage, while many backend routes rely on role checks and query params.

9. Report/PDF/barcode logic is split between Python, Node and Flutter without a typed contract.

10. Generic Flutter CRUD screens hide important domain actions such as audit approval, reject reasons, dispatch OTP, stock take variance explanations, supplier invoice/payment lifecycle.

### Low

11. Naming inconsistency: `grn`, `GRN`, `goods receipt`, `dispatch`, `dispatch-notes`, and `deliveries` are used across modules for related concepts.

12. Multiple migration roots make schema history difficult to audit.

## 17. Enhancement Recommendations

1. Define a single API contract inventory generated from backend routes and consumed by Flutter/Next.
2. Treat `staff_profiles.id` as the enterprise staff identity; use `users.id` only for login/session/account owner.
3. Consolidate POS bill identifiers: separate `id` UUID from `reference`, `order_number`, `short_code`, and `pos_reference`.
4. Build Flutter parity by workflow, not generic table: cashier, auditor, central store, branch store, branch accountant, branch manager, kitchen operations.
5. Add smoke tests for every high-value Flutter endpoint used by active dashboards.
6. Add DB constraints/indexes where workflows depend on unique short codes, order numbers and staff payroll mappings.
7. Move report/PDF branding into a shared service/contract so Flutter triggers generation instead of copying divergent formatting logic.

## 18. Implementation Plan

Phase A: Stabilize contracts

- Generate backend route inventory.
- Build Flutter endpoint inventory.
- Fix confirmed route mismatches: forecasting, stock analytics, anomaly type, POS UUID/reference separation.
- Add smoke scripts for deployed API endpoints.

Phase B: Canonicalize identities and money flows

- Audit every payroll/credit/cashier path for `staff_id` vs `user_id`.
- Ensure credit/unpaid bills flow into payroll-simple consistently.
- Ensure partial payments write separate payment rows and update bill status atomically.

Phase C: Role workflow parity

- Rebuild Flutter central store from Next.js central-store workflows.
- Rebuild Flutter auditor action screens from Next.js auditor pages and backend routes.
- Rebuild Flutter HR/payroll screens from Next.js HR pages and payroll APIs.

Phase D: Inventory and stock take integrity

- Standardize stock take session/item creation from actual branch/central stock.
- Enforce variance explanation before submit.
- Submit branch storekeeper -> accountant/auditor and central storekeeper -> auditor flows.

Phase E: Validation

- Backend build/lint.
- Flutter analyze/test.
- API smoke script against staging/deployed API.
- Manual role workflow tests for cashier, POS, central store, branch store, auditor, HR/payroll.

## 19. Changelog of Modifications

This audit pass created:

- `docs/system-audit/20260528-enterprise-system-audit.md`
- `scripts/generate-api-contract-inventories.mjs`
- `docs/system-audit/generated/api-contract-inventory.json`

Application stabilization applied:

- `famous_gates_app/lib/core/services/reports_service.dart`: moved stale `/ml-forecasting/*` and `/stock-analytics*` client calls to the mounted backend route families discovered in `backend/src/routes/index.ts`: `/forecasting/*` and `/store/*`.
- `famous_gates_app/lib/features/admin/data/admin_repository.dart`: moved AI forecast calls from non-mounted `/forecasting/demand` and `/forecasting/revenue` to the mounted `/forecasting/inventory` and `/forecasting/sales` endpoints.
- `famous_gates_app/lib/features/branch_manager/data/repository.dart`: moved branch manager stock analytics from stale `/store/stock-analytics` to `/store/consumption-trends`, preserving the existing branch-scoped query wrapper.
- `backend/src/controllers/cashier.controller.ts`: hardened cashier POS captain-order clearance so shortcode resolution carries the actual `pos_shift_orders.id`, POS payments look up by UUID when available, and the hotel fallback rejects non-UUID references before inserting into `payments.booking_id`.
- `backend/src/controllers/cashier.controller.ts`: canonicalized cashier credit bill staff identity through `staff_profiles.id`, including POS credit-bill payment paths; cashier-entered `users.id` values are now resolved to the linked staff profile before creating `credit_bills` or `staff_credit_bills`.
- `backend/src/controllers/cashier.controller.ts`: linked cashier credit-bill repayments back to payroll credit bills by updating `staff_credit_bills.paid_amount`, `balance`, `status`, and inserting `staff_credit_bill_payments` rows.
- `backend/src/controllers/payroll-simple.controller.ts`: changed payroll credit-bill deductions from original amount-only pending bills to pending/partial bills using remaining balance, so partially paid credit bills only deduct the unsettled amount.
- `backend/src/controllers/cashier.controller.ts`: canonicalized manually created unpaid bills to `staff_profiles.id` when a waiter is selected and records partial unpaid-bill payments with `status='partial'`.
- `backend/src/controllers/cashier.controller.ts`: separated cashier credit-bill clearance from unpaid-bill migration so selecting credit bill creates a payroll credit bill without also creating an unpaid bill duplicate.
- `backend/src/jobs/migrate-pending-bills.job.ts`: changed automatic uncleared-order migration to create `unpaid_bills` only, preventing future double deductions through both `staff_credit_bills` and `unpaid_bills`.
- `backend/src/controllers/payroll-simple.controller.ts`: changed unpaid-bill deductions to include `partial` unpaid bills and use `balance_amount`, while ignoring legacy auto-created `staff_credit_bills` that were duplicated from uncleared-order migration.
- `famous_gates_app/lib/features/auditor/presentation/auditor_sections.dart`: stopped generic auditor actions from sending unsupported `type=record` verification/anomaly requests, added supported backend entity-type guards, and normalizes entity type values before action submission.
- `scripts/generate-api-contract-inventories.mjs`: added a repeatable contract drift inventory script that scans backend route mounts/declarations and Flutter endpoint references, writing `docs/system-audit/generated/api-contract-inventory.json`.
- `famous_gates_app/lib/features/superadmin/data/mobile_repository.dart`: moved mobile superadmin health, audit-log and branch calls from stale `/system/health`, `/audit-logs` and `/branches` paths to the discovered backend routes `/system/status`, `/admin-logs` and `/system/branches`.
- `famous_gates_app/lib/features/gm/data/repository.dart`: moved GM branch loading from stale `/branches` to `/system/branches`.
- `scripts/generate-api-contract-inventories.mjs`: added direct root-route discovery from `backend/src/routes/index.ts`, so valid root routes such as `/api/health` are not reported as missing mounts.
- `backend/src/controllers/storekeeping/resources.controller.ts`: hardened branch stock-take worksheet seeding so a new stock count no longer returns an empty item sheet when the branch has no materialized `branch_stock` rows yet; it now falls back to active branch-scoped catalog items, then active shared catalog items.
- `famous_gates_app/lib/features/store/presentation/store_dashboard.dart`: replaced stale central/branch store tab endpoints that only shared a valid top-level prefix with mounted workflow routes: GRN via `/procurement/grn`, packing via `/store/stock-requests/approved`, vehicles/drivers via `/store/*`, branch stock takes via `/stock-takes`, branch purchase orders via `/store/purchase-orders`, kitchen usage via `/store/kitchen-usage`, and stock-out via `/store/branch-stock/out`.
- `scripts/generate-api-contract-inventories.mjs`: upgraded the contract scanner to recursively follow mounted child routers from `backend/src/routes/index.ts`, distinguish Node API references from Python-service Dio calls, and wildcard Flutter interpolation placeholders during route matching.
- `backend/src/controllers/system.controller.ts`, `backend/src/routes/system.routes.ts`, `database/migrations/20260528_system_config_values.sql`: added implemented `/api/system/stats` and `/api/system/config` GET/PUT contracts with persisted system configuration values, history logging, and safe defaults.
- `famous_gates_app/lib/core/services/user_service.dart`: aligned profile photo upload to the mounted backend contract `POST /api/users/:id/photo`.
- `famous_gates_app/lib/features/admin/data/admin_repository.dart`, `famous_gates_app/lib/features/admin/presentation/sections/users_section.dart`: replaced the missing reset-password endpoint with the mounted user update contract and added explicit new-password/confirm-password validation in the reset modal.
- `famous_gates_app/lib/features/admin/data/admin_repository.dart`: aligned sold-item analysis and bar-stock audit reads to `/api/auditor/verify/sold-items` and `/api/auditor/bar/stock-audits`.
- `famous_gates_app/lib/features/store/data/repository.dart`, `famous_gates_app/lib/features/driver/data/repository.dart`, `famous_gates_app/lib/features/store/presentation/store_dashboard.dart`: aligned dispatch OTP/status, central GRN, and store tab resource calls to mounted `/api/dispatch/*`, `/api/storekeeping/*`, and `/api/procurement/grn` contracts.
- `famous_gates_app/lib/features/reception/data/repository.dart`: aligned folio lookup to the mounted `/api/folios/reservation/:bookingId` contract.
- `famous_gates_app/lib/features/housekeeping/data/repository.dart`, `famous_gates_app/lib/features/maintenance/data/repository.dart`: aligned scheduling and maintenance calls to mounted `/api/housekeeping/scheduling/schedules`, `/api/maintenance/schedule`, and `/api/maintenance/tasks`.
- `backend/src/controllers/room.controller.ts`, `backend/src/routes/room.routes.ts`: added `GET /api/rooms/:id/bookings` with branch-aware room ownership validation so the Flutter reception room-booking history call has an implemented backend contract.
- `famous_gates_app/lib/features/store/data/repository.dart`, `famous_gates_app/lib/features/store/domain/providers.dart`, `famous_gates_app/lib/features/store/presentation/store_dashboard.dart`: removed dead central-store trip calls to non-existent `/api/fleet/trips` endpoints and removed the generic `/api/communications` resource tab that did not match the implemented channel/message communications API.
- `backend/src/controllers/auth.controller.ts`, `backend/src/routes/auth.routes.ts`: added `POST /api/auth/license/validate` so the Flutter license screen validates a branch code against the real `branches` table and optional persisted/environment license configuration.
- `backend/src/controllers/housekeeping/supplies.controller.ts`, `backend/src/routes/housekeeping.routes.ts`: added `GET /api/housekeeping/supplies` and `POST /api/housekeeping/supplies/request` over the existing housekeeping supply tables, including `staff_profiles.id` resolution for request ownership.
- `backend/src/controllers/hrReports.controller.ts`, `backend/src/routes/hr-reports.routes.ts`: added `GET /api/hr-reports` as an index for the implemented KRA P10, NSSF, SHIF, and Housing Levy report export endpoints.

## 20. Final Validation Report

Completed:

- Repository structure inventory.
- Backend route mount and route-count discovery.
- Next.js dashboard surface inventory.
- Flutter feature surface inventory.
- Live DB read-only schema and status sampling.
- Priority module trace for payroll, leave, credit/unpaid bills, audit, inventory/requisition, booking, billing, purchase orders and GRN.
- Concrete issue list with source/runtime evidence.
- Phase A route-contract fixes for reports, admin forecasting, branch-manager stock analytics and cashier POS payment lookup.
- Phase A auditor anomaly entity-type guard for the runtime `/auditor/anomalies/:id?type=record` failure.
- Phase A route/endpoint inventory generation; after the mobile superadmin/GM fixes and root-route scanner update, no unmatched Flutter top-level prefixes are currently reported against backend mounts.
- Phase B credit-bill/unpaid-bill payroll identity fixes, partial repayment balances, and double-deduction prevention.
- Phase D branch stock-take empty-sheet fix for `/api/stock-takes/:id/items`.
- Phase C central/branch store tab route alignment for common storekeeping actions.
- Workstream A/B contract scanner now reports 0 unmatched Flutter endpoint patterns against mounted backend routes after adding the remaining license, housekeeping supplies, and HR report index contracts.
- Backend validation: `cd backend && npm run build` passed.
- Focused Flutter validation: `flutter analyze` on the touched contract files passed with no issues.

Not completed in this pass:

- Full line-by-line audit of all 1,148 backend routes.
- Full migration-by-migration schema reconstruction.
- Full implementation of Phase C-E workflow rebuilds.

Next safe implementation step:

- Move into Phase C role workflow parity for the highest-risk Flutter dashboards.
