import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/admin/presentation/admin_screen.dart';
import '../../features/finance/presentation/finance_dashboard.dart';
import '../../features/branch_accountant/presentation/branch_accountant_dashboard.dart';
import '../../features/auth/domain/auth_notifier.dart';
import '../../features/auth/domain/models.dart';
import '../../features/auth/domain/role_routes.dart';
import '../../features/auth/presentation/license_screen.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/splash_screen.dart';
import '../../features/auth/presentation/terminal_screen.dart';
import '../../features/bar/presentation/bar_screen.dart';
import '../../features/branch_health/presentation/branch_health_screen.dart';
import '../../features/branch_manager/presentation/branch_manager_dashboard.dart';
import '../../features/cashier/presentation/cashier_dashboard.dart';
import '../../features/hr/presentation/hr_dashboard.dart';
import '../../features/hr/domain/providers.dart';
import '../../features/kitchen/presentation/kds_screen.dart';
import '../../features/kitchen/domain/display_scope.dart';
import '../../features/maintenance/presentation/maintenance_dashboard.dart';
import '../../features/pos/presentation/outlet_pos_screen.dart';
import '../../features/reception/presentation/reception_dashboard.dart';
import '../../features/reports/presentation/reports_dashboard.dart';
import '../../features/restaurant/presentation/table_map_view.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/settings/presentation/settings_screen.dart';
import '../../features/branch_storekeeper/presentation/branch_storekeeper_dashboard.dart';
import '../../features/superadmin/presentation/superadmin_screen.dart';
import '../../features/superadmin/domain/superadmin_providers.dart';
import '../../features/housekeeping/presentation/housekeeping_screen.dart';
import '../../features/hr_terminal/presentation/hr_terminal_screen.dart';
import '../../features/lock/presentation/lock_screen.dart';
import '../../features/search/presentation/search_screen.dart';
import '../../features/diagnostics/presentation/diagnostics_screen.dart';
import '../../features/procurement/presentation/procurement_dashboard.dart';
import '../../features/kyogong/presentation/kyogong_spa_dashboard.dart';
import '../../features/branch_operations/presentation/branch_operations_dashboard.dart';
import '../../features/facilities/presentation/facilities_dashboard.dart';
import '../../features/kitchen_operations/presentation/kitchen_operations_dashboard.dart';
import '../../features/employee/presentation/employee_portal_screen.dart';
import '../../features/driver/presentation/driver_dashboard.dart';
import '../../features/gm/presentation/gm_dashboard.dart';
import '../../features/director/presentation/director_dashboard.dart';
import '../../features/system/presentation/crud_module_screen.dart';
import '../../features/admin/domain/admin_providers.dart';
import '../../features/auditor/presentation/auditor_sections.dart';
import 'auditor_route_sections.dart';
import '../../features/store/presentation/mobile/mobile_receiving_barcode_screen.dart';
import '../../features/store/presentation/mobile/mobile_branch_store_screen.dart';
import '../../features/driver/presentation/mobile/mobile_driver_screen.dart';
import '../../features/director/presentation/mobile/mobile_director_screen.dart';
import '../../features/branch_manager/presentation/mobile/mobile_manager_screen.dart';
import '../../features/gm/presentation/mobile/mobile_gm_screen.dart';
import '../../features/superadmin/presentation/mobile/mobile_superadmin_screen.dart';
import '../utils/platform_utils.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final refreshNotifier = _RouterRefreshNotifier();
  ref.onDispose(refreshNotifier.dispose);
  ref.listen(authNotifierProvider, (_, __) => refreshNotifier.notify());

  return GoRouter(
    initialLocation: '/terminal',
    refreshListenable: refreshNotifier,
    redirect: (context, state) {
      final location = state.matchedLocation;
      final auth = ref.read(authNotifierProvider);
      if (_publicRoutes.contains(location)) {
        // Explicit hub navigation (Back button → /terminal?hub=1) lets a
        // logged-in user sit on the terminal hub to switch user / log out,
        // instead of being force-forwarded to their default module.
        final wantsHub = state.uri.queryParameters['hub'] == '1';
        return auth.maybeWhen(
          data: (user) {
            if (user == null) return null;
            if (!wantsHub && _authEntryRoutes.contains(location)) {
              return _defaultRouteForUser(user);
            }
            return null;
          },
          orElse: () => null,
        );
      }

      return auth.when(
        loading: () => null,
        // Auth errors on a protected route → the PIN terminal, same as a
        // plain logout (see below). The back-office login is reachable from
        // there via the "BACKOFFICE" link, never the automatic default.
        error: (_, __) => '/terminal',
        data: (user) {
          // Null user on a protected route means *some* session just ended —
          // PIN/POS, cashier, kitchen, or back-office alike. The terminal PIN
          // screen is the system's main/default screen, so every logout
          // lands there, not on the back-office login page. Back-office
          // staff can still reach /login explicitly via the terminal's
          // "BACKOFFICE" button.
          if (user == null) return '/terminal';
          if (user.role == 'super_admin' ||
              user.roles.contains('super_admin')) {
            return null;
          }
          if (_isCentralStoreRoute(location) &&
              user.contextType != 'warehouse' &&
              !_isCentralStoreUser(user)) {
            return _defaultRouteForUser(user);
          }
          if (_isBranchStoreRoute(location) &&
              (user.contextType == 'warehouse' || _isCentralStoreUser(user))) {
            return _defaultRouteForUser(user);
          }
          final allowedRoles = _rolesForLocation(location);
          // Allow the route if ANY of the account's roles is permitted — a staff
          // member with two roles (e.g. cashier + restaurant waiter) must be
          // able to reach either dashboard without being bounced back.
          if (allowedRoles.isEmpty || allowedRoles.contains(user.role)) {
            return null;
          }
          return _defaultRouteForUser(user);
        },
      );
    },
    routes: [
      GoRoute(
          path: '/splash', builder: (context, state) => const SplashScreen()),
      GoRoute(
          path: '/terminal',
          builder: (context, state) => const TerminalScreen()),
      GoRoute(
          path: '/hr-terminal',
          builder: (context, state) => const HRTerminalScreen()),
      GoRoute(
          path: '/license', builder: (context, state) => const LicenseScreen()),
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(
        path: '/pos',
        builder: (context, state) => const OutletPOSScreen(
          outletType: 'restaurant',
          title: 'Unified POS',
          initials: 'UP',
          unifiedStations: true,
        ),
      ),
      GoRoute(
        path: '/pos/restaurant',
        builder: (context, state) => const OutletPOSScreen(
          outletType: 'restaurant',
          title: 'Unified POS',
          initials: 'UP',
          unifiedStations: true,
        ),
      ),
      GoRoute(
        path: '/pos/main-bar',
        builder: (context, state) => const OutletPOSScreen(
          outletType: 'main_bar',
          title: 'Unified POS',
          initials: 'UP',
          unifiedStations: true,
        ),
      ),
      GoRoute(
        path: '/pos/executive-bar',
        builder: (context, state) => const OutletPOSScreen(
          outletType: 'executive_bar',
          title: 'Unified POS',
          initials: 'UP',
          unifiedStations: true,
        ),
      ),
      GoRoute(
        path: '/pos/non-consumables',
        builder: (context, state) => const OutletPOSScreen(
          outletType: 'non_consumables',
          title: 'Unified POS',
          initials: 'UP',
          unifiedStations: true,
        ),
      ),
      GoRoute(
        path: '/pos/choma-zone',
        builder: (context, state) => const OutletPOSScreen(
          outletType: 'choma_zone',
          title: 'Unified POS',
          initials: 'UP',
          unifiedStations: true,
        ),
      ),
      GoRoute(
        path: '/pos/kyogong-reception',
        builder: (context, state) => const OutletPOSScreen(
          outletType: 'kyogong_reception',
          title: 'Kyogong Reception POS',
          initials: 'KR',
        ),
      ),
      GoRoute(
        path: '/pos/kyogong-spa',
        builder: (context, state) => const OutletPOSScreen(
          outletType: 'kyogong_spa',
          title: 'Kyogong Spa POS',
          initials: 'KS',
        ),
      ),
      GoRoute(
        path: '/pos/kyogong-executive-bar',
        builder: (context, state) => const OutletPOSScreen(
          outletType: 'kyogong_executive_bar',
          title: 'Kyogong Executive Bar POS',
          initials: 'KX',
        ),
      ),
      GoRoute(
        path: '/pos/kyogong-sports-bar',
        builder: (context, state) => const OutletPOSScreen(
          outletType: 'kyogong_sports_bar',
          title: 'Kyogong Sports Bar POS',
          initials: 'KY',
        ),
      ),
      GoRoute(
        path: '/pos/outlet-stock',
        builder: (context, state) => const BranchStorekeeperDashboard(
          initialSection: BranchStorekeeperSection.inventoryControl,
        ),
      ),
      GoRoute(
        path: '/pos/production-assembly',
        builder: (context, state) => const BranchStorekeeperDashboard(
          initialSection: BranchStorekeeperSection.inventoryControl,
        ),
      ),
      GoRoute(
        path: '/pos/shift-opening-closing',
        builder: (context, state) => const BranchStorekeeperDashboard(
          initialSection: BranchStorekeeperSection.inventoryControl,
        ),
      ),
      GoRoute(
        path: '/pos/variance',
        builder: (context, state) => const BranchStorekeeperDashboard(
          initialSection: BranchStorekeeperSection.inventoryLedger,
        ),
      ),
      GoRoute(
          path: '/bar-pos', builder: (context, state) => const BarPOSScreen()),
      GoRoute(
          path: '/restaurant',
          builder: (context, state) => const TableMapView()),
      GoRoute(path: '/kitchen', builder: (context, state) => const KDSScreen()),
      GoRoute(
        path: '/kitchen/orders',
        builder: (context, state) =>
            const KDSScreen(initialSection: KitchenKdsSection.orders),
      ),
      GoRoute(
        path: '/kitchen/void-requests',
        builder: (context, state) =>
            const KDSScreen(initialSection: KitchenKdsSection.voidRequests),
      ),
      GoRoute(
        path: '/kitchen/history',
        builder: (context, state) =>
            const KDSScreen(initialSection: KitchenKdsSection.history),
      ),
      GoRoute(
        path: '/kitchen/analytics',
        builder: (context, state) =>
            const KDSScreen(initialSection: KitchenKdsSection.analytics),
      ),
      GoRoute(
        path: '/kitchen/notifications',
        builder: (context, state) =>
            const KDSScreen(initialSection: KitchenKdsSection.notifications),
      ),
      GoRoute(
        path: '/kitchen/choma-zone',
        builder: (context, state) => const KDSScreen(
          scope: KitchenDisplayScope.chomaZone,
        ),
      ),
      GoRoute(
        path: '/kitchen/choma-zone/orders',
        builder: (context, state) => const KDSScreen(
          scope: KitchenDisplayScope.chomaZone,
          initialSection: KitchenKdsSection.orders,
        ),
      ),
      GoRoute(
        path: '/kitchen/choma-zone/void-requests',
        builder: (context, state) => const KDSScreen(
          scope: KitchenDisplayScope.chomaZone,
          initialSection: KitchenKdsSection.voidRequests,
        ),
      ),
      GoRoute(
        path: '/kitchen/choma-zone/history',
        builder: (context, state) => const KDSScreen(
          scope: KitchenDisplayScope.chomaZone,
          initialSection: KitchenKdsSection.history,
        ),
      ),
      GoRoute(
        path: '/kitchen/choma-zone/analytics',
        builder: (context, state) => const KDSScreen(
          scope: KitchenDisplayScope.chomaZone,
          initialSection: KitchenKdsSection.analytics,
        ),
      ),
      GoRoute(
        path: '/kitchen/choma-zone/notifications',
        builder: (context, state) => const KDSScreen(
          scope: KitchenDisplayScope.chomaZone,
          initialSection: KitchenKdsSection.notifications,
        ),
      ),
      GoRoute(
          path: '/cashier',
          builder: (context, state) {
            final q = state.uri.queryParameters;
            return CashierDashboard(
              initialBillRef: q['billId'] ?? q['billRef'] ?? q['invoice'],
              initialAmount: q['amount'],
              initialMethod: q['method'],
            );
          }),
      GoRoute(
          path: '/cashier/barcode-scan',
          // Barcode scanning now lives inside the Station tab.
          builder: (context, state) =>
              const CashierDashboard(initialTab: CashierTab.station)),
      GoRoute(
          path: '/branch-manager',
          builder: (context, state) => AppPlatform.isMobile
              ? const MobileManagerScreen()
              : const BranchManagerDashboard()),
      ..._branchManagerSectionRoutes,
      GoRoute(
          path: '/reception',
          builder: (context, state) => const ReceptionDashboard()),
      ..._receptionSectionRoutes,
      GoRoute(
          path: '/store',
          builder: (context, state) => const BranchStorekeeperDashboard()),
      GoRoute(
          path: '/branch-store',
          builder: (context, state) => const BranchStorekeeperDashboard()),
      ..._branchStorekeeperSectionRoutes,
      GoRoute(
          path: '/central-store',
          builder: (context, state) => const AdminScreen.centralStore()),
      ..._centralStoreSectionRoutes,
      GoRoute(
          path: '/auditor',
          builder: (context, state) => const AdminScreen.auditor()),
      GoRoute(
          path: '/director',
          builder: (context, state) => AppPlatform.isMobile
              ? const MobileDirectorScreen()
              : const DirectorDashboard()),
      ..._directorSectionRoutes,
      GoRoute(path: '/admin', builder: (context, state) => const AdminScreen()),
      GoRoute(
          path: '/superadmin',
          builder: (context, state) => AppPlatform.isMobile
              ? const MobileSuperAdminScreen()
              : const SuperAdminScreen()),
      ..._superAdminSectionRoutes,
      GoRoute(
          path: '/accounting',
          builder: (context, state) => const FinanceDashboard()),
      GoRoute(
          path: '/branch-accountant',
          builder: (context, state) => const BranchAccountantDashboard()),
      ..._branchAccountantSectionRoutes,
      GoRoute(path: '/hr', builder: (context, state) => const HRDashboard()),
      ..._hrSectionRoutes,
      GoRoute(
          path: '/housekeeping',
          builder: (context, state) => const HousekeepingScreen()),
      GoRoute(
          path: '/maintenance',
          builder: (context, state) => const MaintenanceDashboard()),
      GoRoute(
          path: '/reports',
          builder: (context, state) => const ReportsDashboard()),
      GoRoute(
          path: '/notifications',
          builder: (context, state) => const NotificationsScreen()),
      GoRoute(
          path: '/settings',
          builder: (context, state) => const SettingsScreen()),
      GoRoute(
          path: '/search', builder: (context, state) => const SearchScreen()),
      GoRoute(
          path: '/diagnostics',
          builder: (context, state) => const DiagnosticsScreen()),
      GoRoute(
          path: '/branch-health',
          builder: (context, state) => const BranchHealthScreen()),
      GoRoute(path: '/lock', builder: (context, state) => const LockScreen()),
      GoRoute(
          path: '/procurement',
          builder: (context, state) => const ProcurementDashboard()),
      GoRoute(
          path: '/branch-operations',
          builder: (context, state) => const BranchOperationsDashboard()),
      GoRoute(
          path: '/facilities',
          builder: (context, state) => const FacilitiesDashboard()),
      GoRoute(
          path: '/kitchen-operations',
          builder: (context, state) => const KitchenOperationsDashboard()),
      ..._kitchenOperationsSectionRoutes,
      GoRoute(
          path: '/kyogong-spa',
          builder: (context, state) =>
              const KyogongSpaDashboard(initialSection: KyogongSection.spa)),
      GoRoute(
          path: '/kyogong',
          builder: (context, state) => const KyogongSpaDashboard()),
      GoRoute(
          path: '/kyogong/reception',
          builder: (context, state) => const KyogongSpaDashboard(
              initialSection: KyogongSection.reception)),
      GoRoute(
          path: '/kyogong/spa',
          builder: (context, state) =>
              const KyogongSpaDashboard(initialSection: KyogongSection.spa)),
      GoRoute(
          path: '/kyogong/executive-bar',
          builder: (context, state) => const KyogongSpaDashboard(
              initialSection: KyogongSection.executiveBar)),
      GoRoute(
          path: '/kyogong/sports-bar',
          builder: (context, state) => const KyogongSpaDashboard(
              initialSection: KyogongSection.sportsBar)),
      GoRoute(
          path: '/employee',
          builder: (context, state) => const EmployeePortalScreen()),
      GoRoute(
          path: '/driver',
          builder: (context, state) => AppPlatform.isMobile
              ? const MobileDriverScreen()
              : const DriverDashboard()),
      GoRoute(
          path: '/gm',
          builder: (context, state) => AppPlatform.isMobile
              ? const MobileGmScreen()
              : const GMDashboard()),
      ..._auditorSectionRoutes,
      ..._auditorDetailRoutes,
      ..._moduleRoutes,
    ],
  );
});

List<GoRoute> get _auditorSectionRoutes => auditorSectionRouteSpecs
    .map(
      (entry) => GoRoute(
        path: entry.key,
        builder: (context, state) =>
            AdminScreen.auditor(initialSection: entry.value),
      ),
    )
    .toList();

List<GoRoute> get _auditorDetailRoutes => [
      GoRoute(
        path: '/auditor/deliveries/:id',
        builder: (context, state) =>
            AuditorDetailScreen.delivery(id: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/auditor/financial-verification/:branchId',
        builder: (context, state) => AuditorDetailScreen.branchFinancial(
          branchId: state.pathParameters['branchId']!,
        ),
      ),
      GoRoute(
        path: '/auditor/financial-verification/logs/:logId',
        builder: (context, state) => AuditorDetailScreen.transactionLog(
          logId: state.pathParameters['logId']!,
          queryParameters: state.uri.queryParameters,
        ),
      ),
      GoRoute(
        path: '/auditor/invoices/:id',
        builder: (context, state) =>
            AuditorDetailScreen.invoice(id: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/auditor/revenue-oversight/details/:id',
        builder: (context, state) => AuditorDetailScreen.revenueDetail(
          id: state.pathParameters['id']!,
          queryParameters: state.uri.queryParameters,
        ),
      ),
      GoRoute(
        path: '/auditor/sales/:branchId',
        builder: (context, state) => AuditorDetailScreen.branchSales(
          branchId: state.pathParameters['branchId']!,
          queryParameters: state.uri.queryParameters,
        ),
      ),
      GoRoute(
        path: '/auditor/hr/employees/add',
        builder: (context, state) => const AdminScreen.auditor(
          initialSection: AdminSection.staff,
          openCreateEmployee: true,
        ),
      ),
      GoRoute(
        path: '/auditor/hr/attendance/:id',
        builder: (context, state) =>
            HRStaffAttendanceDetailScreen(staffId: state.pathParameters['id']!),
      ),
    ];

List<GoRoute> get _directorSectionRoutes => _directorSectionRouteSpecs
    .map(
      (entry) => GoRoute(
        path: entry.key,
        builder: (context, state) =>
            DirectorDashboard(initialSection: entry.value),
      ),
    )
    .toList();

List<GoRoute> get _branchManagerSectionRoutes => [
      ..._branchManagerSectionRouteSpecs.map(
        (entry) => GoRoute(
          path: entry.key,
          builder: (context, state) =>
              BranchManagerDashboard(initialSection: entry.value),
        ),
      ),
      GoRoute(
        path: '/branch-manager/reservations/:id',
        builder: (context, state) => BranchManagerDashboard(
          initialSection: BranchManagerSection.reservationDetail,
          recordId: state.pathParameters['id'],
        ),
      ),
      GoRoute(
        path: '/branch-manager/checkin/:id',
        builder: (context, state) => BranchManagerDashboard(
          initialSection: BranchManagerSection.reservationDetail,
          recordId: state.pathParameters['id'],
        ),
      ),
      GoRoute(
        path: '/branch-manager/arrivals/:id',
        builder: (context, state) => BranchManagerDashboard(
          initialSection: BranchManagerSection.reservationDetail,
          recordId: state.pathParameters['id'],
        ),
      ),
      GoRoute(
        path: '/branch-manager/departures/:id',
        builder: (context, state) => BranchManagerDashboard(
          initialSection: BranchManagerSection.reservationDetail,
          recordId: state.pathParameters['id'],
        ),
      ),
      GoRoute(
        path: '/branch-manager/guests/:id',
        builder: (context, state) => BranchManagerDashboard(
          initialSection: BranchManagerSection.guestDetail,
          recordId: state.pathParameters['id'],
        ),
      ),
      GoRoute(
        path: '/branch-manager/staff/:id/attendance',
        builder: (context, state) => BranchManagerDashboard(
          initialSection: BranchManagerSection.staffAttendance,
          recordId: state.pathParameters['id'],
        ),
      ),
      GoRoute(
        path: '/branch-manager/staff/:id/leave',
        builder: (context, state) => BranchManagerDashboard(
          initialSection: BranchManagerSection.staffLeave,
          recordId: state.pathParameters['id'],
        ),
      ),
      GoRoute(
        path: '/branch-manager/staff/:id/performance',
        builder: (context, state) => BranchManagerDashboard(
          initialSection: BranchManagerSection.staffKpis,
          recordId: state.pathParameters['id'],
        ),
      ),
      GoRoute(
        path: '/branch-manager/staff/:id/documents',
        builder: (context, state) => BranchManagerDashboard(
          initialSection: BranchManagerSection.staffDocuments,
          recordId: state.pathParameters['id'],
        ),
      ),
      GoRoute(
        path: '/branch-manager/staff/:id',
        builder: (context, state) => BranchManagerDashboard(
          initialSection: BranchManagerSection.staffDetail,
          recordId: state.pathParameters['id'],
        ),
      ),
    ];

List<GoRoute> get _hrSectionRoutes => [
      GoRoute(
        path: '/hr/employees',
        builder: (context, state) =>
            const HRDashboard(initialTab: HrTab.employees),
      ),
      GoRoute(
        path: '/hr/employees/add',
        builder: (context, state) => const HRDashboard(
          initialTab: HrTab.employees,
          openCreateEmployee: true,
        ),
      ),
      GoRoute(
        path: '/hr/attendance',
        builder: (context, state) =>
            const HRDashboard(initialTab: HrTab.attendance),
      ),
      GoRoute(
        path: '/hr/attendance/:id',
        builder: (context, state) =>
            HRStaffAttendanceDetailScreen(staffId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/hr/staff-attendance',
        builder: (context, state) =>
            const HRDashboard(initialTab: HrTab.staffAttendance),
      ),
      GoRoute(
        path: '/hr/leave',
        builder: (context, state) => const HRDashboard(initialTab: HrTab.leave),
      ),
      GoRoute(
        path: '/hr/payroll',
        builder: (context, state) =>
            const HRDashboard(initialTab: HrTab.payroll),
      ),
      GoRoute(
        path: '/hr/salaries',
        builder: (context, state) =>
            const HRDashboard(initialTab: HrTab.salaries),
      ),
      GoRoute(
        path: '/hr/adjustments',
        builder: (context, state) =>
            const HRDashboard(initialTab: HrTab.salaryAdjustments),
      ),
      GoRoute(
        path: '/hr/policies',
        builder: (context, state) =>
            const HRDashboard(initialTab: HrTab.policies),
      ),
      GoRoute(
        path: '/hr/performance',
        builder: (context, state) =>
            const HRDashboard(initialTab: HrTab.performance),
      ),
      GoRoute(
        path: '/hr/terminal',
        builder: (context, state) => const HRTerminalScreen(),
      ),
      GoRoute(
        path: '/hr/reports',
        builder: (context, state) =>
            const HRDashboard(initialTab: HrTab.overview),
      ),
    ];

List<GoRoute> get _receptionSectionRoutes => [
      GoRoute(
        path: '/reception/reservations',
        builder: (context, state) => const ReceptionDashboard(
          initialSection: ReceptionSection.reservations,
        ),
      ),
      GoRoute(
        path: '/reception/checkin',
        builder: (context, state) => const ReceptionDashboard(
          initialSection: ReceptionSection.checkInOut,
        ),
      ),
      GoRoute(
        path: '/reception/rooms',
        builder: (context, state) => const ReceptionDashboard(
          initialSection: ReceptionSection.rooms,
        ),
      ),
      GoRoute(
        path: '/reception/guests',
        builder: (context, state) => const ReceptionDashboard(
          initialSection: ReceptionSection.guests,
        ),
      ),
      GoRoute(
        path: '/reception/guests/:id',
        builder: (context, state) => ReceptionDashboard(
          initialSection: ReceptionSection.guestProfile,
          guestId: state.pathParameters['id'],
        ),
      ),
      GoRoute(
        path: '/reception/housekeeping',
        builder: (context, state) => const ReceptionDashboard(
          initialSection: ReceptionSection.housekeeping,
        ),
      ),
      GoRoute(
        path: '/reception/conference',
        builder: (context, state) => const ReceptionDashboard(
          initialSection: ReceptionSection.conference,
        ),
      ),
      GoRoute(
        path: '/reception/catering',
        builder: (context, state) => const ReceptionDashboard(
          initialSection: ReceptionSection.catering,
        ),
      ),
      GoRoute(
        path: '/reception/cashier',
        builder: (context, state) {
          final q = state.uri.queryParameters;
          return ReceptionDashboard(
            initialSection: ReceptionSection.cashier,
            cashierBillRef: q['billId'] ?? q['billRef'] ?? q['invoice'],
            cashierAmount: q['amount'],
            cashierMethod: q['method'],
          );
        },
      ),
      GoRoute(
        path: '/reception/logbook',
        builder: (context, state) => const ReceptionDashboard(
          initialSection: ReceptionSection.logbook,
        ),
      ),
      GoRoute(
        path: '/reception/history',
        builder: (context, state) => const ReceptionDashboard(
          initialSection: ReceptionSection.history,
        ),
      ),
    ];

List<GoRoute> get _branchAccountantSectionRoutes =>
    _branchAccountantSectionRouteSpecs
        .map(
          (entry) => GoRoute(
            path: entry.key,
            builder: (context, state) =>
                BranchAccountantDashboard(initialSection: entry.value),
          ),
        )
        .toList();

List<GoRoute> get _branchStorekeeperSectionRoutes => [
      ..._branchStorekeeperSectionRouteSpecs.map(
        (entry) => GoRoute(
          path: entry.key,
          builder: (context, state) {
            // On mobile, the receive-delivery route opens the branch store hub
            if (entry.key == '/branch-store/receive-delivery' &&
                AppPlatform.isMobile) {
              return const MobileBranchStoreScreen();
            }
            return BranchStorekeeperDashboard(initialSection: entry.value);
          },
        ),
      ),
      GoRoute(
        path: '/branch-store/requests/:id',
        builder: (context, state) => BranchStorekeeperDashboard(
          initialSection: BranchStorekeeperSection.requests,
          requestId: state.pathParameters['id'],
        ),
      ),
      GoRoute(
        path: '/store/requests/:id',
        builder: (context, state) => BranchStorekeeperDashboard(
          initialSection: BranchStorekeeperSection.requests,
          requestId: state.pathParameters['id'],
        ),
      ),
    ];

List<GoRoute> get _kitchenOperationsSectionRoutes => [
      GoRoute(
        path: '/kitchen-operations/stock',
        builder: (context, state) => const KitchenOperationsDashboard(
          initialSection: KitchenOperationsSection.stock,
        ),
      ),
      GoRoute(
        path: '/kitchen-operations/stock-ledger',
        builder: (context, state) => const KitchenOperationsDashboard(
          initialSection: KitchenOperationsSection.stock,
        ),
      ),
      GoRoute(
        path: '/kitchen-operations/stock/:sku',
        builder: (context, state) => KitchenOperationsDashboard(
          initialSection: KitchenOperationsSection.stock,
          stockSku: state.pathParameters['sku'],
        ),
      ),
      GoRoute(
        path: '/kitchen-operations/requisitions',
        builder: (context, state) => const KitchenOperationsDashboard(
          initialSection: KitchenOperationsSection.requisitions,
        ),
      ),
      GoRoute(
        path: '/kitchen-operations/request-stock',
        builder: (context, state) => const KitchenOperationsDashboard(
          initialSection: KitchenOperationsSection.requisitions,
        ),
      ),
      GoRoute(
        path: '/kitchen-operations/recipes',
        builder: (context, state) => const KitchenOperationsDashboard(
          initialSection: KitchenOperationsSection.recipes,
        ),
      ),
      GoRoute(
        path: '/kitchen-operations/recipes-bom',
        builder: (context, state) => const KitchenOperationsDashboard(
          initialSection: KitchenOperationsSection.recipes,
        ),
      ),
      GoRoute(
        path: '/kitchen-operations/usage',
        builder: (context, state) => const KitchenOperationsDashboard(
          initialSection: KitchenOperationsSection.usage,
        ),
      ),
      GoRoute(
        path: '/kitchen-operations/usage-tracking',
        builder: (context, state) => const KitchenOperationsDashboard(
          initialSection: KitchenOperationsSection.usage,
        ),
      ),
      GoRoute(
        path: '/kitchen-operations/wastage',
        builder: (context, state) => const KitchenOperationsDashboard(
          initialSection: KitchenOperationsSection.wastage,
        ),
      ),
      GoRoute(
        path: '/kitchen-operations/record-wastage',
        builder: (context, state) => const KitchenOperationsDashboard(
          initialSection: KitchenOperationsSection.wastage,
        ),
      ),
      GoRoute(
        path: '/kitchen-operations/food-controls',
        builder: (context, state) => KitchenOperationsDashboard(
          initialSection: KitchenOperationsSection.foodControls,
          initialFoodTab: _foodTabFromQuery(state.uri.queryParameters['tab']),
        ),
      ),
      GoRoute(
        path: '/kitchen-operations/food-controls/portions',
        builder: (context, state) => const KitchenOperationsDashboard(
          initialSection: KitchenOperationsSection.foodControls,
          initialFoodTab: KitchenFoodTab.portions,
        ),
      ),
      GoRoute(
        path: '/kitchen-operations/food-controls/variance',
        builder: (context, state) => const KitchenOperationsDashboard(
          initialSection: KitchenOperationsSection.foodControls,
          initialFoodTab: KitchenFoodTab.variance,
        ),
      ),
      GoRoute(
        path: '/kitchen-operations/food-controls/reports',
        builder: (context, state) => const KitchenOperationsDashboard(
          initialSection: KitchenOperationsSection.foodControls,
          initialFoodTab: KitchenFoodTab.reports,
        ),
      ),
      GoRoute(
        path: '/kitchen-operations/sessions',
        builder: (context, state) => const KitchenOperationsDashboard(
          initialSection: KitchenOperationsSection.sessions,
        ),
      ),
      GoRoute(
        path: '/kitchen-operations/spoilage',
        builder: (context, state) => const KitchenOperationsDashboard(
          initialSection: KitchenOperationsSection.spoilage,
        ),
      ),
      GoRoute(
        path: '/kitchen-operations/shift-confirmations',
        builder: (context, state) => const KitchenOperationsDashboard(
          initialSection: KitchenOperationsSection.shiftConfirmations,
        ),
      ),
    ];

KitchenFoodTab _foodTabFromQuery(String? value) {
  return KitchenFoodTab.values.firstWhere(
    (tab) => tab.name == value,
    orElse: () => KitchenFoodTab.rules,
  );
}

List<GoRoute> get _centralStoreSectionRoutes => _centralStoreSectionRouteSpecs
    .map(
      (entry) => GoRoute(
        path: entry.key,
        builder: (context, state) {
          // On mobile, the receiving-barcode route opens the full mobile
          // barcode scanner hub instead of the desktop goods-receiving screen.
          if (entry.key == '/central-store/receiving-barcode' &&
              AppPlatform.isMobile) {
            return const MobileReceivingBarcodeScreen();
          }
          return AdminScreen.centralStore(initialSection: entry.value);
        },
      ),
    )
    .toList();

List<GoRoute> get _superAdminSectionRoutes => _superAdminSectionRouteSpecs
    .map(
      (entry) => GoRoute(
        path: entry.key,
        builder: (context, state) =>
            SuperAdminScreen(initialSection: entry.value),
      ),
    )
    .toList();

List<GoRoute> get _moduleRoutes => _moduleRouteSpecs
    .map(
      (spec) => GoRoute(
        path: spec.path,
        builder: (context, state) => CrudModuleScreen(
          title: spec.title,
          endpoint: spec.endpoint,
          fields: spec.fields,
          createLabel: spec.createLabel,
          createEnabled: spec.createEnabled,
          updateEnabled: spec.updateEnabled,
          deleteEnabled: spec.deleteEnabled,
        ),
      ),
    )
    .toList();

class _ModuleRouteSpec {
  const _ModuleRouteSpec(
    this.path,
    this.title,
    this.endpoint, {
    this.fields = const ['name', 'description'],
    this.createLabel,
    this.createEnabled = true,
    this.updateEnabled = true,
    this.deleteEnabled = true,
  });

  final String path;
  final String title;
  final String endpoint;
  final List<String> fields;
  final String? createLabel;
  final bool createEnabled;
  final bool updateEnabled;
  final bool deleteEnabled;
}

class _RouterRefreshNotifier extends ChangeNotifier {
  void notify() => notifyListeners();
}

String _defaultRouteForUser(User user) {
  return getUserHomeRoute(user);
}

bool _isCentralStoreRoute(String location) =>
    location == '/central-store' || location.startsWith('/central-store/');

bool _isBranchStoreRoute(String location) =>
    location == '/store' ||
    location.startsWith('/store/') ||
    location == '/branch-store' ||
    location.startsWith('/branch-store/');

bool _isCentralStoreUser(User user) =>
    user.role == 'central_storekeeper' ||
    user.role == 'central_operations_manager' ||
    user.roles.contains('central_storekeeper') ||
    user.roles.contains('central_operations_manager');

const _publicRoutes = {
  '/splash',
  '/terminal',
  '/hr-terminal',
  '/license',
  '/login'
};
const _authEntryRoutes = {'/terminal', '/login'};

const _cashierRoles = {
  'cashier',
  'restaurant_cashier',
  'main_bar_cashier',
  'executive_bar_cashier',
  'non_consumables_cashier',
  'kyogong_reception_cashier',
  'choma_zone_cashier',
};
const _barRoles = {
  'bartender',
  'bar_manager',
  'barman',
  'barmaid',
  'kyogong_executive_bar_cashier',
  'kyogong_sports_bar_cashier',
};
const _restaurantRoles = {
  'waiter',
  'waitress',
  'head_waiter',
  'food_runner',
  'host_hostess',
  'restaurant',
};
const _kitchenRoles = {
  'kitchen',
  'head_chef',
  'sous_chef',
  'chef',
  'cook',
  'pos_kitchen',
  'choma_zone_kds',
};
const _receptionRoles = {
  'receptionist',
  'branch_receptionist',
  'front_desk_supervisor',
  'concierge',
};
const _receptionDashboardRoles = {
  ..._receptionRoles,
  'branch_manager',
  'super_admin',
  'general_manager',
};
const _storeRoles = {'branch_storekeeper', 'storekeeper', 'inventory_clerk'};
const _branchStorekeeperRoles = {
  ..._storeRoles,
  'branch_manager',
  'branch_accountant',
  'super_admin',
  'general_manager',
  'auditor',
};
const _centralStoreRoles = {
  'central_storekeeper',
  'central_operations_manager'
};
const _accountingRoles = {'finance_manager', 'branch_accountant', 'accountant'};
const _housekeepingRoles = {
  'housekeeping',
  'housekeeping_supervisor',
  'room_attendant',
  'laundry_attendant',
};
const _maintenanceRoles = {
  'maintenance',
  'maintenance_supervisor',
  'electrician',
  'plumber',
};
const _adminRoles = {'super_admin', 'general_manager'};
const _allAuthenticatedRoles = {
  ..._cashierRoles,
  ..._barRoles,
  ..._restaurantRoles,
  ..._kitchenRoles,
  ..._receptionRoles,
  ..._storeRoles,
  ..._centralStoreRoles,
  ..._accountingRoles,
  ..._housekeepingRoles,
  ..._maintenanceRoles,
  ..._adminRoles,
  'director',
  'auditor',
  'night_auditor',
  'hr_manager',
  'branch_manager',
  'branch_operations_manager',
  'facilities_manager',
  'procurement_manager',
  'procurement',
  'purchasing_manager',
  'kitchen_operations',
  'kyogong_spa_staff',
  'kyogong_spa_cashier',
  'employee',
  'driver',
};

const _routeRoles = <String, Set<String>>{
  '/pos': {
    ..._cashierRoles,
    ..._restaurantRoles,
    ..._barRoles,
    ..._storeRoles,
    'pos_kitchen',
    ..._accountingRoles,
    'kyogong_spa_cashier',
    'branch_manager',
    'super_admin',
    'general_manager',
    'auditor',
    'night_auditor',
    'director',
  },
  '/bar-pos': _barRoles,
  '/restaurant': _restaurantRoles,
  '/kitchen': _kitchenRoles,
  '/kitchen/sessions': {
    'kitchen_operations',
    'branch_storekeeper',
    'storekeeper',
    'super_admin',
    'branch_manager',
    'branch_accountant',
    'accountant',
  },
  '/branch-manager': {'branch_manager'},
  '/reception': _receptionDashboardRoles,
  '/store': _branchStorekeeperRoles,
  '/branch-store': _branchStorekeeperRoles,
  '/central-store': _centralStoreRoles,
  '/auditor': {'auditor', 'night_auditor', 'director'},
  '/director': {'director', 'super_admin', 'auditor'},
  '/admin': _adminRoles,
  '/admin/users': {'super_admin'},
  '/admin/id-cards': {'super_admin'},
  '/admin/restaurant/menu': {'super_admin', 'general_manager'},
  '/admin/bar/menu': {'super_admin', 'general_manager'},
  '/admin/kyogong/services': {'super_admin', 'general_manager'},
  '/admin/wastage': {'super_admin', 'general_manager'},
  '/admin/system/roles/migration': {'super_admin'},
  '/admin/staff': {'super_admin', 'general_manager'},
  '/admin/docs': {'super_admin', 'general_manager'},
  '/cashier': {
    ..._cashierRoles,
    ..._accountingRoles,
    ..._receptionRoles,
    ..._barRoles,
    'kyogong_spa_cashier',
    'super_admin',
    'general_manager',
    'branch_manager',
    'auditor',
    'night_auditor',
    'director',
  },
  '/cashier/barcode-scan': {
    ..._cashierRoles,
    ..._accountingRoles,
    ..._receptionRoles,
    ..._barRoles,
    'kyogong_spa_cashier',
    'super_admin',
    'general_manager',
    'branch_manager',
    'auditor',
    'night_auditor',
    'director',
  },
  '/branch-accounting/bookings-invoices': {'super_admin', 'general_manager'},
  '/communications': _allAuthenticatedRoles,
  '/superadmin': {'super_admin'},
  '/super': {'super_admin'},
  '/accounting': _accountingRoles,
  '/branch-accountant': {
    'branch_accountant',
    'accountant',
    'finance_manager',
    'branch_manager',
    'auditor',
    'super_admin',
    'general_manager',
    'director',
  },
  '/hr': {'hr_manager', 'auditor', 'night_auditor'},
  '/housekeeping': _housekeepingRoles,
  '/maintenance': _maintenanceRoles,
  '/reports': _allAuthenticatedRoles,
  '/notifications': _allAuthenticatedRoles,
  '/settings': _allAuthenticatedRoles,
  '/search': _allAuthenticatedRoles,
  '/diagnostics': {'super_admin', 'general_manager', 'director'},
  '/lock': _allAuthenticatedRoles,
  '/procurement': {
    'procurement_manager',
    'central_storekeeper',
    'super_admin',
    'procurement',
    'purchasing_manager',
    'director'
  },
  '/branch-operations': {
    'branch_operations_manager',
    'branch_manager',
    'branch_storekeeper',
    'super_admin',
    'general_manager',
    'auditor'
  },
  '/facilities': {
    'facilities_manager',
    'branch_manager',
    'housekeeping',
    'maintenance',
    'super_admin',
    'general_manager'
  },
  '/kitchen-operations': {
    'kitchen_operations',
    'branch_storekeeper',
    'storekeeper',
    'super_admin',
    'branch_manager',
    'branch_accountant',
    'accountant',
  },
  '/kyogong-spa': {
    'kyogong_spa_staff',
    'receptionist',
    'super_admin',
    'general_manager',
    'branch_manager',
    'kyogong_spa_cashier'
  },
  '/kyogong': {
    'kyogong_spa_staff',
    'kyogong_spa_cashier',
    'kyogong_reception_cashier',
    'kyogong_executive_bar_cashier',
    'kyogong_sports_bar_cashier',
    'receptionist',
    'cashier',
    'super_admin',
    'general_manager',
    'branch_manager',
    'branch_accountant',
    'accountant',
    'auditor',
  },
  '/kyogong/reception': {
    'kyogong_reception_cashier',
    'receptionist',
    'cashier',
    'super_admin',
    'general_manager',
    'branch_manager',
  },
  '/kyogong/spa': {
    'kyogong_spa_cashier',
    'kyogong_spa_staff',
    'super_admin',
    'general_manager',
    'branch_manager',
  },
  '/kyogong/executive-bar': {
    'kyogong_executive_bar_cashier',
    'super_admin',
    'general_manager',
    'branch_manager',
  },
  '/kyogong/sports-bar': {
    'kyogong_sports_bar_cashier',
    'super_admin',
    'general_manager',
    'branch_manager',
  },
  '/employee': _allAuthenticatedRoles,
  '/driver': {'driver'},
  '/gm': {'general_manager', 'super_admin'},
};

const _directorSectionRouteSpecs = <MapEntry<String, DirectorSection>>[
  MapEntry('/director/payments', DirectorSection.payments),
  MapEntry('/director/financial-intelligence', DirectorSection.payments),
  MapEntry('/director/banking', DirectorSection.banking),
  MapEntry('/director/banking-control', DirectorSection.banking),
  MapEntry('/director/discrepancies', DirectorSection.discrepancies),
  MapEntry('/director/discrepancy-control', DirectorSection.discrepancies),
  MapEntry('/director/drill-down', DirectorSection.drillDown),
  MapEntry('/director/deep-drill-down', DirectorSection.drillDown),
  MapEntry('/director/tasks', DirectorSection.tasks),
  MapEntry('/director/review-tasks', DirectorSection.tasks),
];

const _branchManagerSectionRouteSpecs =
    <MapEntry<String, BranchManagerSection>>[
  MapEntry('/branch-manager/analytics', BranchManagerSection.analytics),
  MapEntry('/branch-manager/sales-analytics', BranchManagerSection.analytics),
  MapEntry('/branch-manager/cashier-clearance',
      BranchManagerSection.cashierClearance),
  MapEntry('/branch-manager/sold-items', BranchManagerSection.soldItems),
  MapEntry('/branch-manager/restaurant/waiter-sales',
      BranchManagerSection.waiterSales),
  MapEntry(
      '/branch-manager/waiter-performance', BranchManagerSection.waiterSales),
  MapEntry('/branch-manager/reservations', BranchManagerSection.reservations),
  MapEntry(
      '/branch-manager/reservations/new', BranchManagerSection.newReservation),
  MapEntry('/branch-manager/checkin', BranchManagerSection.checkin),
  MapEntry('/branch-manager/check-in-check-out', BranchManagerSection.checkin),
  MapEntry('/branch-manager/arrivals', BranchManagerSection.arrivals),
  MapEntry('/branch-manager/departures', BranchManagerSection.departures),
  MapEntry('/branch-manager/rooms', BranchManagerSection.rooms),
  MapEntry('/branch-manager/guests', BranchManagerSection.guests),
  MapEntry('/branch-manager/guest-directory', BranchManagerSection.guests),
  MapEntry('/branch-manager/staff', BranchManagerSection.staff),
  MapEntry('/branch-manager/staff-directory', BranchManagerSection.staff),
  MapEntry('/branch-manager/staff/performance',
      BranchManagerSection.staffPerformance),
  MapEntry('/branch-manager/attendance', BranchManagerSection.attendance),
  MapEntry('/branch-manager/leave', BranchManagerSection.leave),
  MapEntry('/branch-manager/stock', BranchManagerSection.stock),
  MapEntry('/branch-manager/stock-requests', BranchManagerSection.stock),
  MapEntry(
      '/branch-manager/stock/analytics', BranchManagerSection.stockAnalytics),
  MapEntry('/branch-manager/stock-out', BranchManagerSection.stockOut),
  MapEntry('/branch-manager/restaurant', BranchManagerSection.restaurant),
  MapEntry(
      '/branch-manager/restaurant-overview', BranchManagerSection.restaurant),
  MapEntry('/branch-manager/order-intelligence',
      BranchManagerSection.orderIntelligence),
  MapEntry('/branch-manager/restaurant/order-intelligence',
      BranchManagerSection.orderIntelligence),
  MapEntry('/branch-manager/menu', BranchManagerSection.menu),
  MapEntry('/branch-manager/bar-menu', BranchManagerSection.barMenu),
  MapEntry('/branch-manager/data-health', BranchManagerSection.dataHealth),
  MapEntry('/branch-manager/housekeeping', BranchManagerSection.housekeeping),
  MapEntry('/branch-manager/maintenance', BranchManagerSection.maintenance),
  MapEntry('/branch-manager/wastage', BranchManagerSection.wastage),
  MapEntry('/branch-manager/reports', BranchManagerSection.reports),
  MapEntry('/branch-manager/kitchen/stock', BranchManagerSection.kitchenStock),
  MapEntry('/branch-manager/kitchen/requisitions',
      BranchManagerSection.kitchenRequisitions),
  MapEntry(
      '/branch-manager/kitchen/recipes', BranchManagerSection.kitchenRecipes),
  MapEntry('/branch-manager/kitchen/usage', BranchManagerSection.kitchenUsage),
  MapEntry(
      '/branch-manager/kitchen/wastage', BranchManagerSection.kitchenWastage),
];

const _branchAccountantSectionRouteSpecs =
    <MapEntry<String, BranchAccountantSection>>[
  MapEntry('/branch-accountant/analytics', BranchAccountantSection.analytics),
  MapEntry('/branch-accountant/financial-close',
      BranchAccountantSection.financialClose),
  MapEntry('/branch-accountant/supplier-finance',
      BranchAccountantSection.supplierFinance),
  MapEntry('/branch-accountant/discrepancies',
      BranchAccountantSection.discrepancies),
  MapEntry('/branch-accountant/reports/profit-loss',
      BranchAccountantSection.profitLoss),
  MapEntry('/branch-accountant/sold-items', BranchAccountantSection.soldItems),
  MapEntry(
      '/branch-accountant/staff/audit', BranchAccountantSection.staffAudit),
  MapEntry('/branch-accountant/budgets', BranchAccountantSection.budgets),
];

const _branchStorekeeperSectionRouteSpecs =
    <MapEntry<String, BranchStorekeeperSection>>[
  MapEntry('/branch-store/stock', BranchStorekeeperSection.stock),
  MapEntry('/store/stock', BranchStorekeeperSection.stock),
  MapEntry('/branch-store/inventory-ledger',
      BranchStorekeeperSection.inventoryLedger),
  MapEntry('/store/inventory-ledger', BranchStorekeeperSection.inventoryLedger),
  MapEntry('/branch-store/control-centre',
      BranchStorekeeperSection.inventoryControl),
  MapEntry('/branch-store/outlet-production',
      BranchStorekeeperSection.inventoryControl),
  MapEntry(
      '/store/outlet-production', BranchStorekeeperSection.inventoryControl),
  MapEntry('/branch-store/receive', BranchStorekeeperSection.receive),
  MapEntry('/branch-store/receive-delivery', BranchStorekeeperSection.receive),
  MapEntry('/branch-store/receipt-verification',
      BranchStorekeeperSection.receiptVerification),
  MapEntry('/store/receipt-verification',
      BranchStorekeeperSection.receiptVerification),
  MapEntry(
      '/branch-store/food-stuffs-stock', BranchStorekeeperSection.foodStuffsStock),
  MapEntry('/store/food-stuffs-stock', BranchStorekeeperSection.foodStuffsStock),
  MapEntry('/store/receive', BranchStorekeeperSection.receive),
  MapEntry('/store/receive-goods', BranchStorekeeperSection.receive),
  MapEntry('/branch-store/transfers', BranchStorekeeperSection.internalTransfers),
  MapEntry('/store/transfers', BranchStorekeeperSection.internalTransfers),
  MapEntry('/branch-store/suppliers', BranchStorekeeperSection.suppliers),
  MapEntry('/store/branch-suppliers', BranchStorekeeperSection.suppliers),
  MapEntry(
      '/branch-store/purchase-orders', BranchStorekeeperSection.purchaseOrders),
  MapEntry('/store/purchase-orders', BranchStorekeeperSection.purchaseOrders),
  MapEntry('/branch-store/requests', BranchStorekeeperSection.requests),
  MapEntry(
      '/branch-store/branch-requisition', BranchStorekeeperSection.requests),
  MapEntry('/store/branch-requisition', BranchStorekeeperSection.requests),
  MapEntry('/store/store-requisitions', BranchStorekeeperSection.requests),
  MapEntry('/store/requests', BranchStorekeeperSection.requests),
  MapEntry('/branch-store/department-requests',
      BranchStorekeeperSection.departmentRequestLogging),
  MapEntry('/store/department-requests',
      BranchStorekeeperSection.departmentRequestLogging),
  MapEntry('/branch-store/kitchen-requisitions',
      BranchStorekeeperSection.kitchenRequisitions),
  MapEntry('/store/kitchen-requisitions',
      BranchStorekeeperSection.kitchenRequisitions),
  MapEntry(
      '/branch-store/kitchen-usage', BranchStorekeeperSection.kitchenUsage),
  MapEntry('/store/kitchen-usage', BranchStorekeeperSection.kitchenUsage),
  MapEntry('/branch-store/stock-out', BranchStorekeeperSection.stockOut),
  MapEntry('/store/stock-out', BranchStorekeeperSection.stockOut),
  MapEntry('/branch-store/pos-outlet-assembly',
      BranchStorekeeperSection.inventoryControl),
  MapEntry(
      '/store/pos-outlet-assembly', BranchStorekeeperSection.inventoryControl),
  MapEntry('/branch-store/reports', BranchStorekeeperSection.reports),
  MapEntry('/store/reports', BranchStorekeeperSection.reports),
  MapEntry(
      '/branch-store/notifications', BranchStorekeeperSection.notifications),
  MapEntry('/store/notifications', BranchStorekeeperSection.notifications),
];

const _centralStoreSectionRouteSpecs = <MapEntry<String, AdminSection>>[
  MapEntry('/central-store/receiving', AdminSection.goodsReceiving),
  MapEntry('/central-store/goods-receiving', AdminSection.goodsReceiving),
  MapEntry('/central-store/receiving-barcode', AdminSection.goodsReceiving),
  MapEntry('/central-store/foodstuffs', AdminSection.foodstuffs),
  MapEntry('/central-store/bar-items', AdminSection.barBeverages),
  MapEntry('/central-store/bar-beverages', AdminSection.barBeverages),
  MapEntry('/central-store/stationery', AdminSection.stationeryItems),
  MapEntry('/central-store/stationery-items', AdminSection.stationeryItems),
  MapEntry('/central-store/inventory', AdminSection.inventory),
  MapEntry('/central-store/master-inventory', AdminSection.inventory),
  MapEntry('/central-store/requests', AdminSection.requisitions),
  MapEntry('/central-store/requests/:id', AdminSection.requisitions),
  MapEntry('/central-store/packing', AdminSection.packing),
  MapEntry('/central-store/packing-queue', AdminSection.packing),
  MapEntry('/central-store/dispatch', AdminSection.dispatchNotes),
  MapEntry('/central-store/dispatch-notes', AdminSection.dispatchNotes),
  MapEntry('/central-store/dispatch-document', AdminSection.dispatchNotes),
  MapEntry('/central-store/dispatch/new', AdminSection.dispatchNotes),
  MapEntry('/central-store/zero-stock-queue', AdminSection.requisitions),
  MapEntry(
      '/central-store/partially-fulfilled-requests', AdminSection.requisitions),
  MapEntry(
      '/central-store/suppliers/purchase-orders', AdminSection.purchaseOrders),
  MapEntry('/central-store/purchase-orders', AdminSection.purchaseOrders),
  MapEntry('/central-store/procurement', AdminSection.purchaseOrders),
  MapEntry('/central-store/procurement/grn', AdminSection.goodsReceiptGRN),
  MapEntry('/central-store/goods-receipt-grn', AdminSection.goodsReceiptGRN),
  MapEntry('/central-store/procurement/grn/new', AdminSection.goodsReceiving),
  MapEntry('/central-store/suppliers', AdminSection.suppliers),
  MapEntry('/central-store/supplier-database', AdminSection.suppliers),
  MapEntry('/central-store/suppliers/:id', AdminSection.suppliers),
  MapEntry('/central-store/suppliers/grn', AdminSection.goodsReceiptGRN),
  MapEntry('/central-store/suppliers/invoices', AdminSection.supplierInvoices),
  MapEntry(
      '/central-store/suppliers/payments', AdminSection.procurementPayments),
  MapEntry('/central-store/suppliers/reports', AdminSection.centralReports),
  MapEntry('/central-store/stock-takes', AdminSection.centralStockTakes),
  MapEntry('/central-store/spoilage', AdminSection.centralSpoilage),
  MapEntry('/central-store/vehicles', AdminSection.vehicles),
  MapEntry('/central-store/drivers', AdminSection.drivers),
  MapEntry('/central-store/reports', AdminSection.centralReports),
  MapEntry('/central-store/communications', AdminSection.communications),
];

const _superAdminSectionRouteSpecs = <MapEntry<String, SuperAdminSection>>[
  MapEntry('/superadmin/lina', SuperAdminSection.lina),
  MapEntry('/superadmin/admin-dashboard', SuperAdminSection.adminDashboard),
  MapEntry('/superadmin/audit-logs', SuperAdminSection.securityCenter),
  MapEntry('/super/admin/security', SuperAdminSection.securityCenter),
  MapEntry('/superadmin/security', SuperAdminSection.securityCenter),
  MapEntry('/superadmin/system-health', SuperAdminSection.systemHealth),
  MapEntry('/superadmin/global-users', SuperAdminSection.globalUsers),
  MapEntry('/superadmin/users', SuperAdminSection.globalUsers),
  MapEntry('/admin/users', SuperAdminSection.globalUsers),
  MapEntry('/superadmin/global-search', SuperAdminSection.globalSearch),
  MapEntry('/admin/id-cards', SuperAdminSection.personnelRegistry),
  MapEntry('/superadmin/roles', SuperAdminSection.rolesPermissions),
  MapEntry('/admin/restaurant/menu', SuperAdminSection.restaurantMenu),
  MapEntry('/admin/bar/menu', SuperAdminSection.barMenu),
  MapEntry('/admin/kyogong/services', SuperAdminSection.kyogongServices),
  MapEntry('/admin/wastage', SuperAdminSection.inventory),
  MapEntry('/admin/system/roles/migration', SuperAdminSection.rolesPermissions),
  MapEntry('/cashier', SuperAdminSection.cashierStationConfig),
  MapEntry('/branch-accounting/bookings-invoices',
      SuperAdminSection.paymentBillingSettings),
  MapEntry('/admin/staff', SuperAdminSection.personnelRegistry),
  MapEntry('/admin/docs', SuperAdminSection.personnelRegistry),
  MapEntry('/communications', SuperAdminSection.integrations),
  MapEntry('/superadmin/branches', SuperAdminSection.branches),
  MapEntry('/superadmin/settings', SuperAdminSection.settings),
];

Set<String> _rolesForLocation(String location) {
  final exact = _routeRoles[location];
  if (exact != null) return exact;
  final firstSegment =
      location.split('/').where((part) => part.isNotEmpty).firstOrNull;
  if (firstSegment == null) return const <String>{};
  return _routeRoles['/$firstSegment'] ?? const <String>{};
}

const _moduleRouteSpecs = <_ModuleRouteSpec>[
  // Director
  _ModuleRouteSpec('/director/financial-intelligence', 'Financial Intelligence',
      '/finance/director/payments',
      createEnabled: false, updateEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec('/director/banking-control', 'Banking Control',
      '/finance/director/banking',
      createEnabled: false, updateEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec('/director/discrepancy-control', 'Discrepancy Control',
      '/finance/director/discrepancies',
      fields: ['status', 'resolution_notes'],
      createEnabled: false,
      deleteEnabled: false),
  _ModuleRouteSpec('/director/deep-drill-down', 'Deep Drill-Down',
      '/finance/director/drill-down',
      createEnabled: false, updateEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec(
      '/director/review-tasks', 'Review Tasks', '/finance/director/tasks',
      fields: ['status', 'notes'], createEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec(
      '/director/communications', 'Communications', '/communications',
      fields: ['title', 'message', 'priority'], createLabel: 'New Message'),

  // General manager
  _ModuleRouteSpec(
      '/gm/compare-branches', 'Compare Branches', '/reports/branch-comparison',
      createEnabled: false, updateEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec('/gm/reservations', 'Reservations', '/reservations',
      fields: [
        'guest_name',
        'room_id',
        'check_in_date',
        'check_out_date',
        'status'
      ]),
  _ModuleRouteSpec('/gm/all-staff', 'All Staff', '/staff', fields: [
    'first_name',
    'last_name',
    'email',
    'phone',
    'role',
    'department',
    'status'
  ]),
  _ModuleRouteSpec(
      '/gm/leave-requests', 'Leave Requests', '/staff/leave-requests',
      fields: ['status', 'notes'], createEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec('/gm/performance-leaderboard', 'Performance Leaderboard',
      '/staff-performance/leaderboard',
      createEnabled: false, updateEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec(
      '/gm/cashier-station', 'Cashier Station', '/cashier-clearance',
      fields: ['cashier_id', 'shift_id', 'status', 'notes']),
  _ModuleRouteSpec('/gm/communications', 'Communications', '/communications',
      fields: ['title', 'message', 'priority'], createLabel: 'New Message'),

  // Branch operations
  _ModuleRouteSpec('/branch-operations/inventory', 'Inventory',
      '/branch-operations/inventory',
      fields: ['name', 'sku', 'quantity', 'unit']),
  _ModuleRouteSpec('/branch-operations/stock-levels', 'Stock Levels',
      '/branch-operations/inventory',
      createEnabled: false, updateEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec('/branch-operations/stock-takes', 'Stock Takes',
      '/branch-operations/inventory/stock-takes',
      fields: ['name', 'status', 'notes']),
  _ModuleRouteSpec(
      '/branch-operations/staff', 'All Staff', '/branch-operations/staff',
      fields: ['name', 'role', 'department', 'status']),
  _ModuleRouteSpec('/branch-operations/scheduling', 'Scheduling',
      '/branch-operations/staff/shifts',
      fields: ['staff_id', 'shift_date', 'start_time', 'end_time', 'status']),
  _ModuleRouteSpec('/branch-operations/attendance', 'Attendance',
      '/branch-operations/staff/attendance',
      createEnabled: false, updateEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec('/branch-operations/reservations', 'Reservations',
      '/branch-operations/reservations', fields: [
    'guest_name',
    'room_id',
    'check_in_date',
    'check_out_date',
    'status'
  ]),
  _ModuleRouteSpec(
      '/branch-operations/rooms', 'Rooms', '/branch-operations/rooms',
      fields: ['room_number', 'room_type', 'status']),
  _ModuleRouteSpec('/branch-operations/budget', 'Budget',
      '/branch-operations/finance/budget',
      fields: ['name', 'amount', 'period', 'status']),
  _ModuleRouteSpec('/branch-operations/expenses', 'Expenses',
      '/branch-operations/finance/expenses',
      fields: ['category', 'amount', 'description', 'status']),
  _ModuleRouteSpec('/branch-operations/reports', 'Reports',
      '/branch-operations/finance/reports',
      createEnabled: false, updateEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec('/branch-operations/communications', 'Communications',
      '/branch-operations/communications',
      fields: ['title', 'message', 'priority'], createLabel: 'New Message'),

  // Auditor
  _ModuleRouteSpec('/auditor/search', 'Search', '/search',
      createEnabled: false, updateEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec('/auditor/financial-verification', 'Financial Verification',
      '/auditor/financial-verification',
      fields: ['status', 'notes'], createEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec('/auditor/shift-verification', 'Shift Verification',
      '/auditor/shift-verification',
      fields: ['status', 'notes'], createEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec(
      '/auditor/revenue-oversight', 'Revenue Oversight', '/revenue-oversight',
      createEnabled: false, updateEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec('/auditor/sold-items-analysis', 'Sold Items Analysis',
      '/auditor/sold-items',
      createEnabled: false, updateEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec('/auditor/staff-financials', 'Staff Financials',
      '/auditor/staff-financials',
      createEnabled: false, updateEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec('/auditor/stock-request-approvals',
      'Stock Request Approvals', '/stock-requests',
      fields: ['status', 'approval_notes'],
      createEnabled: false,
      deleteEnabled: false),
  _ModuleRouteSpec('/auditor/stock-levels', 'Stock Levels', '/inventory',
      createEnabled: false, updateEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec(
      '/auditor/bar-stock-audits', 'Bar Stock Audits', '/bar-stock-requests',
      fields: ['status', 'audit_notes'],
      createEnabled: false,
      deleteEnabled: false),
  _ModuleRouteSpec(
      '/auditor/purchase-audits', 'Purchase Audits', '/purchase-orders',
      fields: ['status', 'audit_notes'],
      createEnabled: false,
      deleteEnabled: false),
  _ModuleRouteSpec(
      '/auditor/audit-reports', 'Audit Reports', '/auditor-reports',
      fields: ['title', 'report_type', 'notes']),
  _ModuleRouteSpec(
      '/auditor/communications', 'Communications', '/communications',
      fields: ['title', 'message', 'priority'], createLabel: 'New Message'),

  // Branch accountant / finance
  _ModuleRouteSpec('/accounting/financial-workspace', 'Financial Workspace',
      '/finance/dashboard',
      createEnabled: false, updateEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec('/accounting/shift-reconciliation', 'Shift Reconciliation',
      '/finance/shift-pnl',
      fields: ['status', 'notes'], createEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec('/accounting/stock-takes', 'Stock Takes', '/stock-take',
      fields: ['name', 'status', 'notes']),
  _ModuleRouteSpec(
      '/accounting/credit-paid-bills', 'Credit & Paid Bills', '/credit',
      fields: ['customer_name', 'amount', 'status']),
  _ModuleRouteSpec('/accounting/customer-credit-bills', 'Customer Credit Bills',
      '/credit/customer-bills',
      fields: ['customer_name', 'amount', 'status']),
  _ModuleRouteSpec('/accounting/record-banking', 'Record Banking', '/banking',
      fields: ['amount', 'reference', 'bank_name', 'banked_at'],
      createLabel: 'Record Banking'),
  _ModuleRouteSpec('/accounting/purchases', 'Purchases', '/purchase-orders',
      fields: ['supplier_id', 'status', 'notes']),
  _ModuleRouteSpec('/accounting/discrepancies', 'Discrepancies',
      '/finance/director/discrepancies',
      fields: ['status', 'resolution_notes'],
      createEnabled: false,
      deleteEnabled: false),
  _ModuleRouteSpec(
      '/accounting/communications', 'Communications', '/communications',
      fields: ['title', 'message', 'priority'], createLabel: 'New Message'),

  // Branch store
  _ModuleRouteSpec('/store/receive-goods', 'Receive Goods',
      '/branch-operations/inventory/incoming',
      fields: ['dispatch_id', 'status', 'notes'],
      createEnabled: false,
      deleteEnabled: false),
  _ModuleRouteSpec('/store/branch-suppliers', 'Branch Suppliers', '/suppliers',
      fields: ['name', 'email', 'phone', 'category']),
  _ModuleRouteSpec('/store/stock-takes', 'Stock Takes',
      '/branch-operations/inventory/stock-takes',
      fields: ['name', 'status', 'notes']),
  _ModuleRouteSpec(
      '/store/store-requisitions', 'Store Requisitions', '/stock-requests',
      fields: ['item_id', 'quantity', 'priority', 'notes']),
  _ModuleRouteSpec('/store/kitchen-usage', 'Kitchen Usage', '/kitchen/usage',
      fields: ['sku', 'quantity', 'unit', 'notes']),
  _ModuleRouteSpec('/store/stock-out', 'Stock Out', '/inventory/stock-out',
      fields: ['item_id', 'quantity', 'reason', 'notes']),
  _ModuleRouteSpec('/store/communications', 'Communications', '/communications',
      fields: ['title', 'message', 'priority'], createLabel: 'New Message'),

  // Procurement
  _ModuleRouteSpec('/procurement/goods-receipt-grn', 'Goods Receipt (GRN)',
      '/procurement/grn',
      fields: ['po_id', 'supplier_id', 'status', 'notes']),
  _ModuleRouteSpec('/procurement/supplier-database', 'Supplier Database',
      '/procurement/suppliers',
      fields: ['name', 'email', 'phone', 'category', 'kra_pin']),
  _ModuleRouteSpec('/procurement/supplier-invoices', 'Supplier Invoices',
      '/procurement/invoices',
      fields: ['supplier_id', 'invoice_number', 'total', 'status']),
  _ModuleRouteSpec('/procurement/payments', 'Payments', '/procurement/payments',
      fields: ['supplier_id', 'amount', 'payment_method', 'reference']),
  _ModuleRouteSpec(
      '/procurement/fleet-management', 'Fleet Management', '/fleet/vehicles',
      fields: ['registration_number', 'make', 'model', 'status']),
  _ModuleRouteSpec(
      '/procurement/communications', 'Communications', '/communications',
      fields: ['title', 'message', 'priority'], createLabel: 'New Message'),

  // HR
  _ModuleRouteSpec('/hr/all-employees', 'All Employees', '/staff', fields: [
    'first_name',
    'last_name',
    'email',
    'phone',
    'role',
    'department',
    'status'
  ]),
  _ModuleRouteSpec('/hr/staff-attendance', 'Staff Attendance', '/attendance',
      fields: ['staff_id', 'status', 'notes']),
  _ModuleRouteSpec('/hr/attendance-logs', 'Attendance Logs', '/attendance/logs',
      createEnabled: false, updateEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec(
      '/hr/leave-requests', 'Leave Requests', '/staff/leave-requests',
      fields: ['status', 'notes'], createEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec('/hr/salaries', 'Salaries', '/payroll/salaries',
      fields: ['staff_id', 'base_salary', 'status']),
  _ModuleRouteSpec(
      '/hr/payroll-processing', 'Payroll Processing', '/payroll/process',
      fields: ['pay_period', 'status', 'notes']),
  _ModuleRouteSpec('/hr/adjustments', 'Adjustments', '/payroll-adjustments',
      fields: ['staff_id', 'amount', 'reason', 'status']),
  _ModuleRouteSpec('/hr/communications', 'Communications', '/communications',
      fields: ['title', 'message', 'priority'], createLabel: 'New Message'),

  // Facilities
  _ModuleRouteSpec('/facilities/housekeeping/tasks', 'Tasks',
      '/facilities/housekeeping/tasks',
      fields: ['room_id', 'task_type', 'priority', 'assigned_to', 'notes']),
  _ModuleRouteSpec('/facilities/housekeeping/inspections', 'Inspections',
      '/facilities/housekeeping/inspections', fields: [
    'room_id',
    'cleanliness_score',
    'maintenance_score',
    'amenities_score',
    'notes'
  ]),
  _ModuleRouteSpec('/facilities/housekeeping/lost-found', 'Lost & Found',
      '/facilities/housekeeping/lost-found',
      fields: ['item_name', 'location_found', 'status', 'notes']),
  _ModuleRouteSpec('/facilities/maintenance/work-orders', 'Work Orders',
      '/facilities/maintenance/work-orders',
      fields: ['location', 'issue_description', 'priority', 'assigned_to']),
  _ModuleRouteSpec('/facilities/maintenance/assets', 'Asset Management',
      '/facilities/maintenance/assets',
      fields: ['asset_tag', 'name', 'category', 'location', 'status']),
  _ModuleRouteSpec('/facilities/maintenance/schedule', 'Schedule',
      '/facilities/maintenance/schedule',
      fields: ['asset_id', 'scheduled_date', 'maintenance_type', 'status']),
  _ModuleRouteSpec(
      '/facilities/room-status', 'Room Status', '/facilities/rooms',
      fields: ['room_number', 'status', 'notes']),
  _ModuleRouteSpec('/facilities/supplies-inventory', 'Supplies & Inventory',
      '/facilities/inventory',
      fields: ['name', 'quantity', 'unit', 'status']),
  _ModuleRouteSpec(
      '/facilities/staff-management', 'Staff Management', '/facilities/staff',
      fields: ['name', 'department', 'role', 'status']),
  _ModuleRouteSpec('/facilities/quality-compliance', 'Quality & Compliance',
      '/facilities/quality-compliance',
      createEnabled: false, updateEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec(
      '/facilities/communications', 'Communications', '/communications',
      fields: ['title', 'message', 'priority'], createLabel: 'New Message'),

  // Kitchen operations
  _ModuleRouteSpec('/kitchen-operations/stock-ledger', 'Stock Ledger',
      '/kitchen/stock/ledger',
      fields: ['sku', 'quantity', 'transaction_type', 'notes']),
  _ModuleRouteSpec('/kitchen-operations/request-stock', 'Request Stock',
      '/kitchen/requisitions',
      fields: ['priority', 'notes'], createLabel: 'New Requisition'),
  _ModuleRouteSpec(
      '/kitchen-operations/recipes-bom', 'Recipes & BOM', '/kitchen/recipes',
      fields: ['name', 'category', 'yield_quantity', 'yield_unit']),
  _ModuleRouteSpec(
      '/kitchen-operations/usage-tracking', 'Usage Tracking', '/kitchen/usage',
      fields: ['sku', 'quantity', 'unit', 'notes']),
  _ModuleRouteSpec('/kitchen-operations/record-wastage', 'Record Wastage',
      '/kitchen/wastage',
      fields: ['sku', 'quantity', 'unit', 'reason', 'notes'],
      createLabel: 'Record Wastage'),
  _ModuleRouteSpec(
      '/kitchen-operations/communications', 'Communications', '/communications',
      fields: ['title', 'message', 'priority'], createLabel: 'New Message'),

  // Reception / restaurant / bar
  _ModuleRouteSpec('/reception/reservations', 'Reservations', '/reservations',
      fields: [
        'guest_name',
        'room_id',
        'check_in_date',
        'check_out_date',
        'status'
      ]),
  _ModuleRouteSpec('/reception/guests', 'Guests', '/guests',
      fields: ['first_name', 'last_name', 'email', 'phone']),
  _ModuleRouteSpec('/reception/bookings-invoices', 'Bookings & Invoices',
      '/booking/invoices',
      fields: ['booking_id', 'amount', 'status']),
  _ModuleRouteSpec(
      '/reception/communications', 'Communications', '/communications',
      fields: ['title', 'message', 'priority'], createLabel: 'New Message'),
  _ModuleRouteSpec(
      '/restaurant/communications', 'Communications', '/communications',
      fields: ['title', 'message', 'priority'], createLabel: 'New Message'),
  _ModuleRouteSpec('/bar/order-history', 'Order History', '/bar/orders',
      createEnabled: false, updateEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec('/bar-pos/order-history', 'Order History', '/bar/orders',
      createEnabled: false, updateEnabled: false, deleteEnabled: false),
  _ModuleRouteSpec('/bar/customer-tabs', 'Customer Tabs', '/bar/tabs',
      fields: ['customer_name', 'status', 'notes']),
  _ModuleRouteSpec('/bar-pos/customer-tabs', 'Customer Tabs', '/bar/tabs',
      fields: ['customer_name', 'status', 'notes']),
  _ModuleRouteSpec(
      '/bar/bar-cashier-log', 'Bar Cashier Log', '/bar/cashier-log',
      fields: ['shift_id', 'amount', 'notes']),
  _ModuleRouteSpec(
      '/bar-pos/bar-cashier-log', 'Bar Cashier Log', '/bar/cashier-log',
      fields: ['shift_id', 'amount', 'notes']),
  _ModuleRouteSpec('/bar/beverage-requisitions', 'Beverage Requisitions',
      '/bar-stock-requests',
      fields: ['item_id', 'quantity', 'priority', 'notes']),
  _ModuleRouteSpec('/bar-pos/beverage-requisitions', 'Beverage Requisitions',
      '/bar-stock-requests',
      fields: ['item_id', 'quantity', 'priority', 'notes']),
  _ModuleRouteSpec('/bar/communications', 'Communications', '/communications',
      fields: ['title', 'message', 'priority'], createLabel: 'New Message'),
  _ModuleRouteSpec(
      '/bar-pos/communications', 'Communications', '/communications',
      fields: ['title', 'message', 'priority'], createLabel: 'New Message'),
];
