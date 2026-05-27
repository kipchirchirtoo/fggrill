# Auditor Dashboard Next.js to Flutter Migration

## 1. Current Module Audit

The Next.js auditor module lives under `frontend/src/app/dashboard/auditor` and contains 11,053 lines across 54 route files. It is not a single dashboard page; it is a role-scoped workspace with overview, search, verification, reconciliation, approvals, stock, kitchen, payroll, dispatch, branch-audit, reports, and drill-down detail routes.

Shared frontend dependencies:

- Layout/auth: `DashboardLayout`, `ProtectedRoute`, `UserRole.AUDITOR`, branch context selectors.
- API clients: `auditAPI`, `auditorReportsAPI`, `storeAPI`, `financeAPI`, `accountingAPI`, `bankingAPI`, `kitchenAPI`, `cashierAPI`, `simplePayrollAPI`, `searchAPI`.
- UI primitives: `IOSCard`, `IOSButton`, `IOSBadge`, `Dialog`, `Input`, `Select`, table markup, toast notifications via `sonner`.
- Auditor widgets: `DailyLogVerification`, `CashierLogbookVerification`, `OrderDetailsModal`, `VoidBillsContent`.
- Shared widgets used by auditor routes: `AuditorApprovalPanel`, `StockCountForm`, `ShiftReviewPanel`, branch content widgets for business M-Pesa, invoices, credit bills, stock take.

The Flutter conversion now lives under `famous_gates_app/lib/features/auditor` and uses Riverpod, Dio, Material widgets, the shared admin shell, and backend-backed action flows.

## 2. Page Inventory And Flutter Mapping

| Next.js route | Primary behavior | Backend/API usage | Flutter equivalent |
| --- | --- | --- | --- |
| `/dashboard/auditor` | Overview cards, audit command navigation, KPIs, recent activity | `/audit/logs`, auditor verification APIs | `AuditorOverviewSection` |
| `/dashboard/auditor/search` | Global search, selected result, route to inspection view | `GET /search?q=` | `AuditorSearch` target: add dedicated screen; current shell has menu route placeholder |
| `/dashboard/auditor/financial-verification` | Branch/date financial reconciliation summary | `GET /auditor/verify/finances` | `AuditorFinancialVerificationSection` |
| `/dashboard/auditor/financial-verification/[branchId]` | Branch drill-down, cashier cards, export | `/auditor/verify/finances`, `/reports/generate/async` | Data-section detail/investigation dialog; branch drill-down still needs dedicated route |
| `/dashboard/auditor/financial-verification/logs` | Daily logs table, filter/review | `GET /auditor/daily-logs`, `POST /auditor/daily-logs/:id/verify` | `AuditorBankingLogsSection` plus daily-log actions |
| `/dashboard/auditor/financial-verification/logs/[logId]` | Single daily log detail | `GET /auditor/daily-logs` and record filtering | Investigation/detail dialog; dedicated route pending |
| `/dashboard/auditor/shift-verification` | Shift review list and verify/reconcile action | `/cashier/shifts`, Kyogong shift APIs | `AuditorShiftVerificationSection`; exact `ShiftReviewPanel` parity pending |
| `/dashboard/auditor/revenue-oversight` | Revenue analytics by branch/source, anomaly drill-down, cashier logbooks | `GET /auditor/verify/revenue`, logbook APIs, reports | `AuditorRevenueOversightSection`, `AuditorCashierLogbooksSection` |
| `/dashboard/auditor/revenue-oversight/details/[id]` | Anomaly detail, clear/flag | `GET /auditor/anomalies/:id`, `POST /auditor/anomalies/:id/clear`, watchlist | Investigation dialog and `Verify`/`Flag` actions |
| `/dashboard/auditor/sales` | Sales audit totals and branch drill-down | `GET /auditor/verify/sales` | `AuditorSalesAuditSection` |
| `/dashboard/auditor/sales/[branchId]` | Restaurant/bar/POS/payments tabs and order modal | `GET /auditor/verify/sales`, report export | Generic table plus `OrderDetails` style detail dialog; tab parity pending |
| `/dashboard/auditor/sold-items` | Sold-item analytics, search, item modal, export | `GET /auditor/verify/sold-items`, `/reports/generate/async` | `AuditorSoldItemsSection` |
| `/dashboard/auditor/staff-audit` | Staff transactions/summary views, filters, approve/reject advance/loan, PDF/CSV export | `GET /auditor/staff-audit`, `/staff`, payroll approve/reject | `AuditorStaffAuditSection`; summary/export parity pending |
| `/dashboard/auditor/approvals` | Stock request approvals with quantity editing, branch performance, bulk approve | `GET /store/stock-requests`, `PUT approve/reject`, bulk approve | `AuditorApprovalsSection`; exact quantity edit/bulk modal pending |
| `/dashboard/auditor/stock` | Stock variance cards, search, detail modal, export, flag discrepancies | `GET /auditor/verify/stock-levels`, `POST /auditor/exceptions`, export | `AuditorStockAuditSection` |
| `/dashboard/auditor/bar-stock` | Bar stock take review and verify modal | `GET /auditor/bar/stock-audits`, `POST /auditor/bar/stock-audits/:id/verify` | `AuditorBarStockSection` |
| `/dashboard/auditor/purchases` | Expenditure/procurement audit | `GET /auditor/verify/expenditure`, reports | `AuditorPurchasesSection` |
| `/dashboard/auditor/orders` | Branch order/requisition audit | `GET /auditor/verify/branch-orders` | `AuditorBranchOrdersSection` |
| `/dashboard/auditor/deliveries` | Delivery list, status filter, detail navigation | `GET /dispatch/auditor/deliveries` | `AuditorDeliveriesSection` |
| `/dashboard/auditor/deliveries/[id]` | Delivery detail, document/image modal, approve/flag | `GET /dispatch/auditor/deliveries/:id`, `POST /review` | Detail dialog plus delivery action; document preview route pending |
| `/dashboard/auditor/discrepancies` | Create flag modal, detail modal, filters, PDF export | `GET/POST /finance/discrepancies`, export route | `AuditorDiscrepanciesSection` mapped to `/auditor/exceptions`; finance discrepancy route mismatch noted |
| `/dashboard/auditor/invoices` | Invoice list, search/status filter, detail modal, verify/flag/clear, PDF download | `GET /accounting/invoices`, `/auditor/verify/clear`, watchlist | `AuditorInvoicesSection` |
| `/dashboard/auditor/invoices/[id]` | Supplier invoice detail | `GET /finance/supplier-invoices/:id` | Detail dialog; dedicated route pending |
| `/dashboard/auditor/kitchen-requisitions` | Kitchen requisition review/approve/reject | `/kitchen/requisitions`, `/auditor/approvals/pending` | `AuditorKitchenRequisitionsSection` |
| `/dashboard/auditor/kitchen-usage` | Usage table, search/type filter, branch filter, export | `GET /kitchen/usage`, report export | `AuditorKitchenUsageSection` with audit/reject |
| `/dashboard/auditor/kitchen-wastage` | Wastage table, filters, audit/reject | `GET /kitchen/wastage`, `PUT /audit` | `AuditorKitchenWastageSection` |
| `/dashboard/auditor/ledger` | Kitchen stock ledger, search/status, verify, export | `GET /kitchen/stock/ledger`, `PATCH /kitchen/stock/ledger/:id/status` | `AuditorKitchenLedgerSection`; verify action pending |
| `/dashboard/auditor/payroll-approvals` | Credit bills, loans, advances pending approval | `GET /staff/simple-payroll/pending-approvals`, approve/reject by type | `AuditorPayrollApprovalsSection` |
| `/dashboard/auditor/audit-reports` | Multi-branch/date report exports to Excel | `GET /reports/auditor/export/:reportId` | `AuditorReportExportsSection`, now saves `.xlsx` bytes |
| `/dashboard/auditor/branch-audit/*` | Branch selector wrappers around business M-Pesa, credit bills, invoices, stock-take, void bills | branch-scoped APIs | Mapped as direct auditor side-nav entries |

## 3. Component And Lifecycle Mapping

| React pattern | Flutter equivalent |
| --- | --- |
| `useState` for selected record, notes, loading, filters | `ConsumerStatefulWidget` local state or Riverpod `StateNotifier` where shared |
| `useEffect(fetch, deps)` | `FutureProvider.family`, `ref.invalidate`, or `initState` with async repository calls |
| `useCallback(fetchX)` | Repository methods plus provider invalidation |
| `useMemo(filteredRows)` | Derived provider/selectors or local computed rows in `build` |
| `ProtectedRoute` | Flutter router role guard using auth state and `UserRole.auditor` |
| `DashboardLayout` | Admin/auditor shell with sidebar/topbar |
| `BranchSelector` / `MultiBranchSelector` | Riverpod branch state + dropdown/segmented selector widgets |
| `sonner` toast | `ScaffoldMessenger` snackbars |
| `Dialog` modals | `AlertDialog`, `Dialog`, or desktop-width modal widgets |
| Blob download | Dio `ResponseType.bytes` + `path_provider` save file |
| Table filters/search/sort | Reusable `AuditorDataTable` state and repository query params |
| Optimistic action refresh | Submit action, snackbar, provider invalidation |

## 4. Backend Endpoint Inventory

Main auditor backend routes:

- `/auditor/night-audit/start`, `/auditor/night-audit/:id/complete`, `/auditor/night-audit`
- `/auditor/exceptions`, `/auditor/exceptions/:id/resolve`
- `/auditor/trail`, `/auditor/plans`, `/auditor/findings`
- `/auditor/consumption/configs`, `/auditor/consumption/variances`
- `/auditor/approvals`, `/auditor/approvals/pending`, `/auditor/approvals/handle`, `/approve`, `/reject`
- `/auditor/payroll/variances`
- `/auditor/verify/sales`, `/finances`, `/revenue`, `/expenditure`, `/stock-levels`, `/branch-orders`, `/sold-items`, `/bar-stock`
- `/auditor/verify/clear`, `/auditor/anomalies/:id`, `/auditor/anomalies/:id/clear`
- `/auditor/daily-logs`, `/auditor/daily-logs/:id/verify`
- `/auditor/staff-audit`
- `/auditor/watchlist`, `/auditor/watchlist/:id`
- `/auditor/void-bills`, `/auditor/void-bills/:id/review`
- `/reports/auditor/export/:reportId`
- `/dispatch/auditor/deliveries`, `/dispatch/auditor/deliveries/:id`, `/dispatch/auditor/deliveries/:id/review`
- `/payments-verification/:id/verify-auditor`
- `/cashier/logbook/pending`, `/cashier/logbook/:id/audit`
- `/staff/simple-payroll/pending-approvals`, `/:type/:id/approve`, `/:type/:id/reject`
- `/kitchen/usage`, `/kitchen/usage/:id/audit`, `/kitchen/wastage`, `/kitchen/wastage/:id/audit`, `/kitchen/stock/ledger`
- `/banking/transactions`, `/banking/transactions/:id/approve`
- `/search`

Python/analytics dependencies:

- `python-services/reports/branded_pdf_generator.py` handles branded PDF report aliases including auditor report aliases.
- `python-services/reports/database_fetcher.py` has auditor-oriented data fetchers for sales, branch orders, and financial verification.
- `analytics-service/maa_analytics.py` has auditor analytics endpoints for fraud detection and exception patterns, but the inspected Next.js auditor pages do not directly call them.

## 5. Broken Or Inconsistent Dependencies Found

- Next.js `auditorReportsAPI` still exposes `/auditor-reports/export/...`; backend mounted reports under `/reports/auditor/export/...`. Flutter now uses `/reports/auditor/export/...`; backend has a compatibility alias.
- Frontend `auditAPI.flagItem` points to `/auditor/flag`; backend route is `/auditor/watchlist`. Flutter uses `/auditor/watchlist`.
- `finance/discrepancies` pages exist in frontend, while backend auditor workflow routes use `/auditor/exceptions`. Flutter maps discrepancies to `/auditor/exceptions`.
- `kitchenAPI.reviewWastage` in frontend points to `/kitchen/usage/:id/review`; backend has `/kitchen/wastage/:id/review` and `/audit`. Flutter uses `/kitchen/wastage/:id/audit`.
- Some drill-down pages depend on dynamic Next.js route params; Flutter currently uses investigation/detail dialogs for several of these and should add dedicated nested routes where exact route parity is required.
- Live API can return `success: true, data: []`; this is an empty state, not a frontend error.

## 6. Flutter Folder Structure

Current and target structure:

```text
famous_gates_app/lib/features/auditor/
├── data/
│   └── repository.dart
├── domain/
│   ├── models.dart
│   └── providers.dart
└── presentation/
    ├── auditor_dashboard.dart
    ├── auditor_sections.dart
    ├── widgets/
    │   ├── auditor_data_table.dart
    │   ├── auditor_filter_bar.dart
    │   ├── auditor_action_menu.dart
    │   ├── auditor_detail_dialog.dart
    │   ├── auditor_notes_dialog.dart
    │   └── auditor_report_tile.dart
    └── screens/
        ├── auditor_search_screen.dart
        ├── auditor_delivery_detail_screen.dart
        ├── auditor_invoice_detail_screen.dart
        ├── auditor_sales_branch_detail_screen.dart
        └── auditor_revenue_anomaly_screen.dart
```

## 7. Step-By-Step Migration Plan

1. Freeze route inventory and backend contract list from this document.
2. Split the current generic Flutter section into reusable widgets: header, filters, table, action menu, detail dialog, notes dialog, report tile.
3. Add `AuditorRepository` methods for every named API in the web app instead of relying only on generic `getRaw`.
4. Add typed models for common rows: `AuditException`, `ApprovalRequest`, `DailyLog`, `DeliveryAudit`, `KitchenUsage`, `KitchenWastage`, `PayrollApproval`, `ReportExport`.
5. Replace each generic table page with a typed Riverpod provider where the web page has custom behavior.
6. Add missing dedicated drill-down routes: search, delivery detail, invoice detail, sales branch detail, revenue anomaly detail, financial branch detail, financial log detail.
7. Preserve exact action flows: approve/reject requires notes where web requires notes; flag requires reason; audit success invalidates providers.
8. Preserve exports: byte response saved through desktop/mobile file abstractions.
9. Add responsive layout: desktop side-by-side detail/table, tablet two-column cards, mobile stacked lists.
10. Run `flutter analyze`, `flutter test`, `flutter build linux --debug`, and backend `npm run build`.

## 8. File-By-File Implementation Plan

- `repository.dart`: add typed methods for audit, reports, banking, delivery, kitchen, payroll, cashier logbooks, search, and downloads.
- `models.dart`: add DTOs with tolerant parsing for backend snake_case and nested branch/staff/item objects.
- `providers.dart`: add `FutureProvider.family` providers keyed by filter objects.
- `auditor_dashboard.dart`: keep shell parity with central store layout and register all route IDs.
- `auditor_sections.dart`: temporary unified implementation; continue extracting into widgets/screens.
- `app_router.dart`: add nested auditor route guards and detail routes.
- Backend `routes/index.ts`: keep `/auditor-reports` alias until frontend and all clients are migrated to `/reports/auditor`.

## 9. Current Flutter Code Status

Implemented in Flutter:

- Auditor shell/sidebar/topbar alignment.
- Overview, verification, revenue, sales, stock, sold items, bar stock, purchases, branch orders, deliveries, kitchen usage/wastage/ledger, payroll approvals, discrepancies, void bills, business M-Pesa, credit bills, cashier logbooks, and report exports.
- Row action menus with view, investigate, verify, approve, reject, flag, audit, resolve/review.
- Notes dialogs and required-note validation.
- Investigation detail dialog backed by `/auditor/anomalies/:id`.
- Audit exception creation backed by `/auditor/exceptions`.
- Backend-backed report file download to Downloads.
- Mixed response parsing for combined payroll lists.

Remaining exact-parity work:

- Dedicated detail routes for dynamic Next.js pages.
- Exact web filter bars for every page, including server-side pagination and sort where present.
- Exact `AuditorApprovalPanel` quantity edit and bulk approval modal.
- Exact `ShiftReviewPanel` branch/status behavior.
- Exact staff audit PDF/CSV local export behavior.
- Document/image preview for delivery evidence.
- Search result deep-dive screen.

