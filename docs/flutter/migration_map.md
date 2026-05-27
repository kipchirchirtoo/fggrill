# Migration Map

## Page to Screen Map

| Next.js Page Family | Flutter Screen / Section | State | Repository / Service |
|---|---|---|---|
| `/dashboard/superadmin/*`, `/dashboard/super/admin/security`, and Superadmin-exposed admin navigation (`/dashboard/admin`, `/dashboard/admin/users`, `/dashboard/admin/id-cards`, `/dashboard/admin/restaurant/menu`, `/dashboard/admin/bar/menu`, `/dashboard/admin/kyogong/services`, `/dashboard/admin/wastage`, `/dashboard/admin/system/roles/migration`, `/dashboard/cashier`, `/dashboard/branch-accounting/bookings-invoices`, `/dashboard/admin/staff`, `/dashboard/admin/docs`, `/dashboard/communications`) | `features/superadmin/presentation/SuperAdminScreen` sections: admin dashboard, behavioral intelligence, security center, users, ID cards, restaurant menu, bar menu, Kyogong services, wastage analytics, role migration, cashier station, bookings/invoices, personnel registry, employee docs, communications, branches, audit logs, settings | `superAdminSectionProvider` + screen-local filters/dialog state | `SecurityService`, `UserService`, `StaffService`, `IdCardsService`, `RestaurantService`, `BarService`, `KyogongService`, `SystemService`, existing admin section providers |
| `/dashboard/admin/*` | `features/admin/presentation/AdminScreen` sections | `adminSectionProvider` | `features/admin/data` repositories |
| `/dashboard/auditor/*` | `AdminScreen.auditor()` + `features/auditor/presentation/auditor_sections.dart` | Auditor Riverpod providers | `AuditorRepository` |
| `/dashboard/central-store/*` | `AdminScreen.centralStore()` + central store sections for receiving, foodstuffs, bar items, stationery, inventory, requisitions, packing, dispatch, purchase orders, GRN, suppliers, invoices, payments, stock takes, spoilage, fleet, reports, communications; direct route aliases are registered in `app_router.dart` | `adminSectionProvider`, central store `FutureProvider`s, dialog-local form state | `AdminRepository` methods backed by `/store/*`, `/storekeeping/*`, `/procurement/*`, and `/dispatch/*` |
| `/dashboard/storekeeping/*` | `features/store` and admin storekeeping sections | store providers | storekeeping repositories |
| `/dashboard/branch-store/*` | `features/store/StoreDashboard(isCentral:false)` | store providers | storekeeping repositories |
| `/dashboard/hr/*` | `features/hr/presentation/HRDashboard` and subpages | HR providers/controllers | staff/payroll repositories |
| `/dashboard/branch-manager/*` | `features/branch_manager/presentation/BranchManagerDashboard` | branch manager providers | booking/staff/inventory repositories |
| `/dashboard/branch-accounting/*` | `features/finance/presentation/FinanceDashboard` | finance providers | finance/cashier/payroll repositories |
| `/dashboard/branch-accountant/*` | finance/auditor sections | finance providers | finance/auditor repositories |
| `/dashboard/gm/*` | `features/gm/presentation/GMDashboard` | GM providers | GM/report/staff repositories |
| `/dashboard/director/*` | `features/director/presentation/DirectorDashboard` | director providers | director/report repositories |
| `/dashboard/reception/*` | `features/reception/presentation/ReceptionDashboard` | reception providers | rooms/bookings/guests repositories |
| `/dashboard/cashier/*` | `features/cashier/presentation/CashierDashboard` tabs: station, POS cart, unpaid bills, credit bills, shifts, barcode scan, insights | `cashierStatsProvider`, cashier bill/shift providers, screen-local filters/dialog state | `CashierRepository` over `/cashier/*`, `/payments/mpesa/*`, `/dispatch/pos/scan`, and Python POS analytics |
| `/dashboard/kyogong/reception`, `/dashboard/kyogong/spa`, `/dashboard/kyogong/executive-bar`, `/dashboard/kyogong/sports-bar` | `features/kyogong/presentation/KyogongSpaDashboard` sidebar sections: reception/car wash POS, spa POS, executive bar POS, sports bar POS, transactions, shifts, services, petty cash, float | screen-local station, cart, modal, and filter state plus Kyogong providers | `KyogongRepository` over `/kyogong/sales-points`, `/kyogong/shifts/*`, `/kyogong/dynamic-services`, `/kyogong/petty-cash`, `/kyogong/pool-tokens` |
| `/dashboard/bar/*` | `features/bar/presentation/BarPOSScreen` and modules | bar providers | bar repositories |
| `/dashboard/kitchen/*` | `features/kitchen/presentation/KDSScreen` | kitchen providers | kitchen/order repositories |
| `/dashboard/kitchen-operations/*` | `features/kitchen_operations/presentation/KitchenOperationsDashboard` | kitchen ops providers | kitchen/storekeeping repositories |
| `/dashboard/housekeeping/*` | `features/housekeeping/presentation/HousekeepingScreen` | housekeeping providers | housekeeping/facilities repositories |
| `/dashboard/maintenance/*` | `features/maintenance/presentation/MaintenanceDashboard` | maintenance providers | maintenance/facilities repositories |
| `/dashboard/facilities/*` | `features/facilities/presentation/FacilitiesDashboard` | facilities providers | facilities repositories |
| `/dashboard/procurement/*` | `features/procurement/presentation/ProcurementDashboard` | procurement providers | procurement/storekeeping repositories |
| `/dashboard/reports/*` | `features/reports/presentation/ReportsDashboard` | reports providers | reports repositories |
| `/dashboard/profile`, `/settings`, `/communications`, `/notifications`, `/search` | shared Flutter features/sections | shared providers | auth/settings/notifications/search repositories |

## Component to Widget Map

| React Component / Pattern | Flutter Widget |
|---|---|
| Dashboard layout/sidebar/topbar | Canonical role dashboard shell based on Superadmin shell |
| Shadcn `Button` | Themed `ElevatedButton`/`OutlinedButton` wrappers |
| Shadcn `Card` | Canonical `Card`/`StatCard` |
| Shadcn `Dialog` | `showDialog` + custom form dialogs |
| Shadcn `Table` | `DataTableWidget` and paginated variants |
| Select/dropdown | `DropdownButtonFormField` or popup menu |
| Input/Textarea | `TextFormField` |
| Tabs | `TabController`, segmented controls, or section nav |
| Toast | `ScaffoldMessenger`/notification service |
| Export dropdown | popup export menu + repository bytes download |
| Branch/date filters | reusable filter bar widgets |
| Action menu | popup menu with role-aware actions |

## Hook to Flutter Map

| React Hook / Logic | Flutter Equivalent |
|---|---|
| `useState` | local `StatefulWidget` state or Riverpod `StateProvider` |
| `useEffect(fetch)` | `FutureProvider`, `AsyncNotifier.build`, or `initState` for local one-off |
| `useEffect(polling)` | provider-owned `Timer` with dispose |
| `useMemo(filteredRows)` | derived provider or computed getter |
| `useCallback(action)` | controller method on notifier or private widget method |
| React Context auth | `authNotifierProvider` |
| Protected route | GoRouter redirect with `_routeRoles` |
| Query params | `GoRouterState.uri.queryParameters` |
| React Hook Form/manual validation | `Form` and field validators |

## API Layer Map

| Web API Module | Flutter Repository |
|---|---|
| `lib/api/core.ts` | `core/network/dio_client.dart` |
| `lib/api/staff.ts` | `features/hr/data`, staff/payroll repositories |
| `lib/api/rooms.ts` | reception/rooms/guests repositories |
| `lib/api/operations.ts` | operations/facilities/housekeeping repositories |
| auditor page-local calls | `features/auditor/data/repository.dart` |
| storekeeping page-local calls | store/admin repositories |
| report/export helpers | report repositories with Dio bytes and desktop file save |

## Modal Map

| Web Modal | Flutter Dialog / Sheet |
|---|---|
| Add/edit forms | form dialog, desktop max-width 420-720 |
| Detail drawer/modal | read-only dialog or right drawer if shell supports it |
| Approval/reject modal | confirmation dialog with notes/reason field |
| Investigation/anomaly modal | larger detail dialog with metadata and action buttons |
| Export modal/dropdown | popup menu; long report options in dialog |
| Upload modal | file picker dialog + upload progress |
| Mobile long form | modal bottom sheet |
