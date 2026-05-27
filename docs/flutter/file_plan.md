# File-by-File Implementation Plan

## Core Files

| File | Purpose | Dependencies | Inputs | Outputs | APIs | Navigation / State |
|---|---|---|---|---|---|---|
| `lib/core/router/app_router.dart` | Role routing and guards | auth notifier, role routes, dashboard screens | auth state, location | GoRouter config | none directly | redirects by role |
| `lib/core/theme/app_theme.dart` | Canonical theme tokens | Flutter Material | none | ThemeData, colors | none | global |
| `lib/core/widgets/data_table.dart` | Canonical table | theme | columns/rows/loading/error | table UI | none | local callbacks |
| `lib/core/widgets/stat_card.dart` | KPI card | theme | title/value/icon | card UI | none | none |
| `lib/core/widgets/dashboard_shell.dart` | Shared shell pattern | theme/auth | title/tabs/actions | shell UI | notifications via actions | optional tab state |
| `lib/core/widgets/permission_guard.dart` | Action/page access guard | auth role state | roles/child | child or denied state | none | reads auth |

## Auth

| File | Purpose | APIs |
|---|---|---|
| `features/auth/data/auth_repository.dart` | login/logout/me/token storage | `/auth/login`, `/auth/me`, `/auth/logout` |
| `features/auth/domain/auth_notifier.dart` | auth state and logout | auth repository |
| `features/auth/domain/role_routes.dart` | user role to Flutter route | none |

## Superadmin

| File | Purpose | Dependencies | Inputs / Outputs |
|---|---|---|---|
| `features/superadmin/presentation/superadmin_screen.dart` | canonical dashboard shell | superadmin nav/topbar | selected section -> content |
| `features/superadmin/presentation/widgets/superadmin_side_nav.dart` | canonical sidebar | theme, provider | nav item taps |
| `features/superadmin/presentation/widgets/superadmin_top_bar.dart` | canonical topbar | auth notifier | menu/logout/search |
| `features/superadmin/domain/superadmin_providers.dart` | section state | Riverpod | selected section |

Required change: route `/superadmin` should render `SuperAdminScreen`, not `AdminScreen`, before parity is declared.

## Auditor

| File | Purpose | APIs Used | Widgets | State |
|---|---|---|---|---|
| `features/auditor/data/repository.dart` | auditor API and exports | `/auditor/*`, `/audit/logs`, `/finance/*`, `/dispatch/auditor/*`, `/kitchen/*`, `/reports/auditor/export/*` | none | repository provider |
| `features/auditor/domain/models.dart` | auditor DTO parsing | none | none | immutable models |
| `features/auditor/presentation/auditor_sections.dart` | all auditor screen sections | repository | canonical cards/tables/dialogs | section providers/controllers |
| `features/admin/presentation/admin_screen.dart` | hosts `AdminScreen.auditor()` | admin providers | admin shell | section selection |
| `features/admin/presentation/widgets/admin_side_nav.dart` | auditor nav groups | admin providers | nav items | role nav state |
| `features/admin/presentation/widgets/admin_top_bar.dart` | auditor topbar | auth, notifications, branches | topbar | logout/notifications |

Auditor implementation checklist per page:

- overview: stats/logs/exceptions, investigation/clear actions.
- financial verification: filters, reconciliation table, actions.
- shift verification: no invalid branch IDs, P&L summary, review actions.
- revenue/sales/banking/invoices: tables, filters, export where web has it.
- stock/bar/purchases/deliveries/kitchen: review and approve/reject/flag actions.
- staff/payroll/approvals: approve/reject/details.
- reports: use existing backend report export route; no 404 aliases.

## HR

| File Group | Purpose | APIs |
|---|---|---|
| `features/hr/data/*` | staff/payroll/leave repositories | `/staff/*`, `/payroll/*`, `/payroll-adjustments`, `/payroll-policies`, `/shifts/*` |
| `features/hr/domain/*` | staff/payroll/attendance models/providers | none |
| `features/hr/presentation/*` | HR overview and pages | repository providers |
| `features/hr_terminal/presentation/*` | staff clock terminal | `/staff/attendance/clock-in`, `/clock-out` |

Required screens: employees CRUD, attendance approval, staff attendance reports, leave approvals, payroll draft/generate/approve, salaries, adjustments, policies, performance.

## Store / Central Store

| File Group | Purpose | APIs |
|---|---|---|
| `features/store/data/*` | branch and central store repositories | `/storekeeping/*`, `/inventory/*`, `/suppliers`, dispatch routes |
| `features/admin/presentation/sections/central_store_subsections.dart` | central-store sections | central store repositories |
| `features/store/presentation/*` | branch store dashboard | store repositories |

Required screens: item CRUD, SKU/barcode, stock movements, requisitions, approvals, packing, dispatch, delivery confirmation, GRN, PO, suppliers, stock takes, spoilage, reports, imports/exports.

## Finance / Branch Accounting

| File Group | Purpose | APIs |
|---|---|---|
| `features/finance/data/*` | finance repository | `/finance/*`, `/cashier/*`, `/payments-verification/*`, payroll credit bill routes |
| `features/finance/presentation/*` | accounting dashboard | finance repository |

Required screens: banking, record banking, payments, purchases, credit bills, logbooks, shift P&L, shift review, stock take, variance, cashier clearance, sold items.

## Operational Dashboards

| Feature | Required APIs |
|---|---|
| `branch_manager` | bookings, guests, rooms, staff, leave, housekeeping, maintenance, stock, reports |
| `gm` | branches, compare, finance, staff, leave, reservations, reports |
| `director` | director analytics, banking, discrepancies, payments, tasks |
| `reception` | bookings, rooms, guests, check-in/out, housekeeping |
| `bar` | `/bar/orders`, drinks/categories, tabs, stock, stock requests, reports |
| `kitchen` | KDS/order state APIs |
| `kitchen_operations` | recipes, food controls, requisitions, stock, usage, wastage |
| `housekeeping` | rooms, tasks, inspections, lost-found, inventory, reports, scheduling, staff |
| `maintenance` | work orders, assets, schedule |
| `facilities` | `/facilities/*` all submodules |
| `procurement` | suppliers, POs, procurement payment/request routes |
| `reports` | report data/export routes and Python report service where used |

## Validation Files / Commands

Before marking a dashboard complete:

- `dart format` changed Flutter files.
- `flutter analyze` changed Flutter files or app.
- `flutter build linux --debug` for shell/routing changes.
- Backend route changes require `cd backend && npm run build`.

Each dashboard must have a validation section in its migration notes for route/API/modal/permission/form/pagination/search/sort/filter/loading/error/notification/responsive/UI parity.
