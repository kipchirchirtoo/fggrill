# Cashier Module Audit

Generated from explorer-agent scans of Flutter, backend/API, and clean-db schema artifacts.

## Verdict

The new clean database does **not yet fully support the cashier module**.

The Flutter app and backend currently depend on a mixed cashier/POS stack made of:

- Cashier station flows under `/api/cashier`
- Outlet POS flows under `/api/pos`
- Payment gateway and verification flows under `/api/payments` and `/api/payments-verification`
- Receipts under `/api/receipts`
- Branch accountant outbound payments under `/api/branch-payments`

The clean-db migrations contain some canonical replacements, but several cashier runtime tables are missing, renamed, or shaped differently from the backend expectations. The largest risks are shift handling, POS outlet orders, payments, receipts, credit bills, and cashier logbooks.

## Flutter Screen Inventory

| Screen / Flow | Route / Entry | Purpose | Main APIs |
|---|---|---|---|
| Cashier Dashboard | `CashierDashboard` via app router cashier route | Main cashier station with payment, voids, paid credits, shifts, insights | `/cashier/stats`, `/cashier/bill/:id`, `/cashier/pay`, `/cashier/shifts`, `/cashier/paid-bills`, `/payments/mpesa/*` |
| Reception Embedded Cashier | Reception route with cashier section | Receptionist cashier handoff without leaving reception module | `/cashier/*`, `/reception/*`, `/reports/generate/checkout-bill` |
| Outlet POS Screen | `/pos`, `/pos/restaurant`, `/pos/main-bar`, outlet routes | Waiter/cashier POS order, print, pay, split/merge/void, close shift | `/pos/outlets/:id/shifts/active`, `/pos/shifts/:shiftId/orders`, `/pos/shifts/:shiftId/orders/:orderId/pay`, `/pos/shifts/:shiftId/close` |
| Paid Credits | Cashier dashboard tab | Shows paid staff/customer credit bills | `/cashier/paid-bills` |
| Voided Orders | Cashier dashboard tab | Review voided order evidence | `/cashier/voided-orders` style cashier/POS void APIs |
| Shift Management | Cashier dashboard tab | Open, close, reconcile cashier shifts | `/cashier/shifts`, `/cashier/shifts/start`, `/cashier/shifts/:id/close`, `/cashier/shifts/:id/reconcile` |
| Branch Accountant Cashier Views | Branch accountant dashboard sections | Cashier logs, shift approvals, credit bills, outbound payments | `/cashier/logbook/*`, `/cashier/shifts/*`, `/cashier/credit-bills`, `/branch-payments` |

Dormant but still present Flutter code:

- `_PosCartTab` posts cashier POS transactions but is not visible in current cashier tabs.
- `_UnpaidBillsTab` exists but is not currently wired into visible tabs.
- `core/services/cashier_service.dart` contains older `/cashier/shift`, `/payments`, `/receipts`, `/shifts` style calls.

## Backend Route Map

| Mount | Route File | Primary Controllers / Services | Purpose |
|---|---|---|---|
| `/api/cashier` | `backend/src/routes/cashier.routes.ts` | `cashier.controller.ts`, `cashier-shifts.controller.ts` | Cashier bills, payments, logbooks, shifts, credit/unpaid/paid bills |
| `/api/cashier` | `backend/src/routes/cashier-clearance.routes.ts` | cashier clearance controllers | Branch accountant/manager cashier clearance overlay |
| `/api/pos` | `backend/src/routes/outlet-pos.routes.ts` | `outlet-pos.controller.ts`, `cashier-automation.service.ts` | Outlet POS shifts, orders, payments, voids, stock counts |
| `/api/payments` | `backend/src/routes/payment.routes.ts` | `payment.controller.ts` | M-Pesa/Paystack/payment gateway initiation, callbacks, status |
| `/api/payments-verification` | `backend/src/routes/payments.routes.ts` | `payments.controller.ts` | Accountant/auditor payment verification |
| `/api/receipts` | `backend/src/routes/receipts.routes.ts` | `receipts.controller.ts` | Receipt creation, receipt items, receipt lookup |
| `/api/credit` | `backend/src/routes/credit.routes.ts` | `credit.controller.ts` | Generic credit confirmation |
| `/api/branch-payments` | `backend/src/routes/branch-payments.routes.ts` | `branch-payments.controller.ts` | Outbound supplier/vendor payments and receipts |
| `/api/finance/shift-pnl` | `backend/src/routes/shiftPnL.routes.ts` | shift P&L controller/service | Shift profit and loss reports |

## Critical Database Gaps

| Object | Clean DB Status | Required By | Impact |
|---|---|---|---|
| `pos_outlet_shifts` | Missing | Outlet POS open/active/close shift APIs | POS stations cannot manage active shifts correctly |
| `pos_shift_orders` | Missing | Outlet POS order create/update/pay/void | POS orders fail or cannot be reconciled |
| `pos_shift_payments` | Missing | Outlet POS payments and verification | Paid orders cannot be tracked reliably |
| `cashier_shift_logs` | Wrong shape | Current cashier shift controller | Shift open/close/reconcile will not match backend columns |
| `cashier_shift_transactions` | Missing | Payment-to-shift linking and summaries | Shift summaries and reconciliation break |
| `payments` | Missing or too minimal | Payment gateway, cashier payment, reconciliation | Payment recording and verification are incomplete |
| `receipts` | Missing | Receipt routes | Receipt generation/archive fails |
| `receipt_items` | Missing | Receipt routes | Itemized receipts fail |
| `cashier_transactions` | Too narrow | Cashier payments, bills, reports | Missing reference, amount, tender, bill, shift, and customer fields |
| `cashier_logbooks` | Wrong/incomplete shape | Reception/cashier logbook submission | Shift logbook submission and PDFs risk failure |
| `cashier_logbook_lines` | Wrong/incomplete shape | Logbook line details | Sales breakdown evidence is incomplete |
| `credit_bills` | Wrong business shape | Staff/customer credit flows | Staff/payroll credit bill logic cannot work as coded |
| `branch_payment_receipts` | Missing columns | Outbound payment receipt archive | Generated supplier receipts cannot be tracked by `document_status` |
| `audit_logs` | Missing compatibility | Backend audit references | Some legacy audit views expect `audit_logs`, while clean-db has `audit_events` |

## Contract Risks Found

- `CashierRepository._asList` only unwraps `data` or `items`; endpoints returning `bills`, `credit_bills`, `rows`, or `results` can render empty screens.
- `/cashier/pay` receives `bookingId`, but the Flutter UI uses it as a generic bill/order/reference ID. Backend must keep supporting that generic behavior or the UI needs a clearer payload.
- Shift routes are split across legacy and current names: `/cashier/shifts/start`, `/cashier/shifts/:id/close`, older `/cashier/shift/open`, and branch accountant approval routes.
- `/api/payments-verification` is protected but needs stricter role-level authorization for accountant/auditor actions.
- Route order may shadow `GET /api/cashier/unpaid-bills/outstanding/pdf` because `/unpaid-bills/:id/pdf` is registered earlier.
- Clean-db POS outlet enums/seeds do not fully match live outlet roles and station types used by the backend.

## Recommended Fix Sequence

1. Choose the cashier runtime table names for v1 cutover. The fastest safe path is to support the current backend names: `pos_outlet_shifts`, `pos_shift_orders`, `pos_shift_payments`, `cashier_shift_logs`, `cashier_shift_transactions`, `cashier_transactions`, `payments`, `receipts`, `receipt_items`, `credit_bills`, `cashier_logbooks`.
2. Add compatibility tables/views only where they are read-only or where canonical tables are already stable. Do not create duplicate write paths for payments or stock-affecting POS records.
3. Extend clean-db cashier tables to backend-required shapes, especially shift logs, shift transactions, payments, receipts, logbooks, and credit bills.
4. Seed only valid branch-specific POS outlets. Do not create Kyogong outlet names under non-Kyogong branches.
5. Normalize Flutter response parsing for cashier lists and M-Pesa casing.
6. Add strict role authorization to `/api/payments-verification` accountant/auditor mutation routes.
7. Fix route ordering for cashier unpaid-bill PDF routes.
8. Run the existing dual-db audit after repair scripts and confirm cashier missing table/column counts drop to zero for the clean DB.

## Files To Prioritize

- `backend/src/routes/cashier.routes.ts`
- `backend/src/routes/outlet-pos.routes.ts`
- `backend/src/controllers/cashier.controller.ts`
- `backend/src/controllers/cashier-shifts.controller.ts`
- `backend/src/controllers/outlet-pos.controller.ts`
- `backend/src/controllers/payments.controller.ts`
- `backend/src/controllers/receipts.controller.ts`
- `backend/src/controllers/branch-payments.controller.ts`
- `famous_gates_app/lib/features/cashier/presentation/cashier_dashboard.dart`
- `famous_gates_app/lib/features/cashier/data/cashier_repository.dart`
- `famous_gates_app/lib/features/pos/presentation/outlet_pos_screen.dart`
- `famous_gates_app/lib/features/pos/data/outlet_pos_repository.dart`
- `backend/supabase/clean-db/migrations/0001_clean_core_schema.sql`
- `backend/supabase/clean-db/migrations/0005d_maintenance_hk_system.sql`
- `backend/supabase/repair/001_critical_runtime_objects.sql`
- `backend/supabase/repair/002_missing_columns_and_constraints.sql`
- `backend/supabase/repair/003_missing_indexes.sql`

## Explorer Status

- Flutter explorer: complete.
- Backend/API explorer: complete.
- Clean-db/schema explorer: complete.

No files were edited by the explorers. This report is an integration artifact only.
