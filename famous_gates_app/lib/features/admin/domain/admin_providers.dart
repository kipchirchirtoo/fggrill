import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/services/maintenance_service.dart';
import '../../../core/services/booking_service.dart';
import '../data/admin_repository.dart';
import '../data/models/admin_dashboard.dart';
import '../data/models/branch.dart';
import '../data/models/system_user.dart';
import '../data/models/room.dart';
import '../data/models/guest.dart';
import '../data/models/menu_item.dart';
import '../data/models/inventory_item.dart';
import '../data/models/supplier.dart';
import '../data/models/vehicle.dart';
import '../data/models/audit_log.dart';
import '../data/models/notification.dart';
import '../data/models/system_config.dart';
import '../data/models/ai_analytics.dart';

enum AdminSection {
  // ── ADMIN CORE (no group header) ──
  overview,
  security,
  aiAnalytics,
  menu,
  barMenu,
  kyogongServices,
  wastageAnalytics,
  roleMigration,
  idCards,
  cashierStation,
  bookingsInvoices,
  users,
  employeeDocs,
  communications,

  // ── OPERATIONS (Hotel) ──
  branches,
  rooms,
  reservations,
  guests,
  restaurant,
  kitchen,

  // ── OVERSIGHT & AUDIT ──
  auditLogs,
  auditSearch,
  financialVerification,
  shiftVerification,
  revenueOversight,
  auditorSales,
  auditorBanking,
  auditorInvoices,
  auditorOrders,
  soldItemsAnalysis,
  staffFinancials,
  auditorStock,
  auditorKitchenRequisitions,
  auditorKitchenUsage,
  auditorKitchenWastage,
  auditorDeliveries,
  auditorLedger,
  auditorPayrollApprovals,
  auditorDiscrepancies,
  auditorVoidBills,
  auditorBusinessMpesa,
  auditorCreditBills,
  auditorCashierLogbooks,
  performanceLeaderboard,
  stockRequestApprovals,
  barStockAudits,
  purchaseAudits,
  auditReports,

  // ── INVENTORY & LOGISTICS ──
  storekeeping,
  goodsReceiving,
  foodstuffs,
  barBeverages,
  stationeryItems,
  inventory,
  requisitions,
  packing,
  dispatchNotes,
  directIssue,
  pendingBackorders,
  purchaseOrders,
  goodsReceiptGRN,
  centralStockTakes,
  centralSpoilage,
  suppliers,
  vehicles,
  drivers,
  centralReports,

  // ── CORPORATE FUNCTIONS (Procurement) ──
  procurementOverview,
  supplierInvoices,
  procurementPayments,

  // ── HUMAN RESOURCES ──
  hrPayroll,
  staff,
  attendance,
  attendanceLogs,
  leaveRequests,
  salaries,
  payrollProcessing,
  payrollAdjustments,
  payrollPolicies,
  hrReports,
  hrTerminal,

  // ── BRANCH OPERATIONS ──
  branchOpsOverview,
  stockLevels,
  stockTakes,
  branchScheduling,

  // ── FACILITIES ──
  facilitiesOverview,
  housekeepingTasks,
  housekeeping,
  housekeepingInspections,
  lostFound,
  workOrders,
  assetManagement,
  maintenanceSchedule,
  maintenance,
  roomStatus,
  qualityCompliance,
  suppliesInventory,
  facilitiesStaff,

  // ── BRANCH STORE OPS ──
  branchStoreOverview,
  receiveGoods,
  branchSuppliers,
  branchStockTakes,
  branchPurchaseOrders,
  storeRequisitions,
  kitchenUsage,
  stockOut,

  // ── KITCHEN OPS ──
  kitchenOpsOverview,
  stockLedger,
  requestStock,
  recipesBOM,
  usageTracking,
  recordWastage,

  // ── FINANCE ──
  finance,
  reports,

  // ── SYSTEM ──
  settings,
  notifications,
}

final adminSectionProvider =
    StateProvider<AdminSection>((ref) => AdminSection.overview);

/// PO ID to pre-load when navigating to the GRN / Goods Receiving screen.
final grnPreloadPoIdProvider = StateProvider<String?>((ref) => null);

final adminDashboardProvider =
    FutureProvider.autoDispose<AdminDashboard>((ref) async {
  final repo = ref.read(adminRepositoryProvider);
  return repo.getDashboard();
});

final adminBranchesProvider =
    FutureProvider.autoDispose<List<AdminBranch>>((ref) async {
  final repo = ref.read(adminRepositoryProvider);
  return repo.getBranches();
});

final adminSelectedBranchProvider = StateProvider<String?>((ref) => null);

final adminUsersProvider =
    FutureProvider.autoDispose<List<AdminUser>>((ref) async {
  final repo = ref.read(adminRepositoryProvider);
  return repo.getUsers();
});

final adminStaffProvider =
    FutureProvider.autoDispose<List<AdminUser>>((ref) async {
  final repo = ref.read(adminRepositoryProvider);
  return repo.getStaff();
});

final adminRoomsProvider =
    FutureProvider.autoDispose<List<AdminRoom>>((ref) async {
  final repo = ref.read(adminRepositoryProvider);
  return repo.getRooms();
});

final adminGuestsProvider =
    FutureProvider.autoDispose<List<AdminGuest>>((ref) async {
  final repo = ref.read(adminRepositoryProvider);
  return repo.getGuests();
});

final adminMenuItemsProvider =
    FutureProvider.autoDispose<List<AdminMenuItem>>((ref) async {
  final repo = ref.read(adminRepositoryProvider);
  return repo.getMenuItems();
});

final adminBarMenuItemsProvider =
    FutureProvider.autoDispose<List<AdminMenuItem>>((ref) async {
  final repo = ref.read(adminRepositoryProvider);
  return repo.getMenuItems(menuType: 'bar');
});

final adminInventoryProvider =
    FutureProvider.autoDispose<List<InventoryItem>>((ref) async {
  final repo = ref.read(adminRepositoryProvider);
  return repo.getInventory();
});

final centralStoreDashboardProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(adminRepositoryProvider).getCentralStoreDashboard();
});

final centralStoreValuationProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(adminRepositoryProvider).getCentralStoreValuation();
});

final centralStoreItemsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(adminRepositoryProvider).getStoreItems(limit: 500);
});

final centralFoodstuffsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref
      .read(adminRepositoryProvider)
      .getStoreItems(storeType: 'foodstuffs', limit: 500);
});

final centralBarItemsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref
      .read(adminRepositoryProvider)
      .getStoreItems(storeType: 'bar_store', limit: 500);
});

final centralStationeryProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref
      .read(adminRepositoryProvider)
      .getStoreItems(storeType: 'stationery', limit: 500);
});

final centralStoreSuppliersProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(adminRepositoryProvider).getStoreSuppliers(scope: 'global');
});

final centralStoreBranchesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(adminRepositoryProvider).getStoreBranches();
});

final centralStoreVehiclesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(adminRepositoryProvider).getStoreVehicles();
});

final centralStoreDriversProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(adminRepositoryProvider).getStoreDrivers();
});

final centralStoreRequestsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(adminRepositoryProvider).getStoreStockRequests();
});

final centralApprovedStoreRequestsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(adminRepositoryProvider).getApprovedStoreStockRequests();
});

final centralStoreDispatchesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(adminRepositoryProvider).getStoreDispatchNotes();
});

final centralPurchaseOrdersProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(adminRepositoryProvider).getPurchaseOrders();
});

final centralGrnsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(adminRepositoryProvider).getGRNs();
});

final centralStockTakesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(adminRepositoryProvider).getCentralStockTakes();
});

final centralSpoilageProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(adminRepositoryProvider).getCentralSpoilageRecords();
});

final centralSpoilageItemsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(adminRepositoryProvider).getCentralSpoilageItems();
});

final centralSupplierInvoicesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(adminRepositoryProvider).getSupplierInvoices();
});

final centralSupplierPaymentsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(adminRepositoryProvider).getSupplierPayments();
});

final centralVatReportProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final now = DateTime.now();
  final from =
      DateTime(now.year, now.month, 1).toIso8601String().split('T').first;
  final to = now.toIso8601String().split('T').first;
  return ref.read(adminRepositoryProvider).getProcurementReport('vat', {
    'from_date': from,
    'to_date': to,
  });
});

final centralGrniReportProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(adminRepositoryProvider).getProcurementReport('grni', {});
});

final centralAgingReportProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(adminRepositoryProvider).getProcurementReport('aging', {});
});

final adminSuppliersProvider =
    FutureProvider.autoDispose<List<AdminSupplier>>((ref) async {
  final repo = ref.read(adminRepositoryProvider);
  return repo.getSuppliers();
});

final adminVehiclesProvider =
    FutureProvider.autoDispose<List<AdminVehicle>>((ref) async {
  final repo = ref.read(adminRepositoryProvider);
  return repo.getVehicles();
});

final adminAuditLogsProvider =
    FutureProvider.autoDispose<List<AdminAuditLog>>((ref) async {
  final repo = ref.read(adminRepositoryProvider);
  return repo.getAuditLogs();
});

final adminSecurityLogsProvider =
    FutureProvider.autoDispose<List<AdminAuditLog>>((ref) async {
  final repo = ref.read(adminRepositoryProvider);
  return repo.getSecurityLogs();
});

final adminNotificationsProvider =
    FutureProvider.autoDispose<List<AdminNotification>>((ref) async {
  final repo = ref.read(adminRepositoryProvider);
  return repo.getNotifications();
});

final unreadNotifCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final repo = ref.read(adminRepositoryProvider);
  return repo.getUnreadNotificationCount();
});

final systemConfigProvider =
    FutureProvider.autoDispose<SystemConfig>((ref) async {
  final repo = ref.read(adminRepositoryProvider);
  return repo.getSystemConfig();
});

final aiAnalyticsProvider =
    FutureProvider.autoDispose<AiAnalytics>((ref) async {
  final repo = ref.read(adminRepositoryProvider);
  return repo.getAiAnalytics();
});

final demandForecastProvider =
    FutureProvider.autoDispose<List<ForecastPoint>>((ref) async {
  final repo = ref.read(adminRepositoryProvider);
  return repo.getDemandForecast();
});

final revenueForecastProvider =
    FutureProvider.autoDispose<List<ForecastPoint>>((ref) async {
  final repo = ref.read(adminRepositoryProvider);
  return repo.getRevenueForecast();
});

// Maintenance work orders from real API
final adminMaintenanceRequestsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, Map<String, String?>>(
        (ref, filters) async {
  final service = ref.read(maintenanceServiceProvider);
  final result = await service.getRequests(
    status: filters['status'],
    priority: filters['priority'],
  );
  final data = result['data'];
  if (data is List) {
    return data
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
  return [];
});

// Bookings from real API for admin reservations section
final adminReservationsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, Map<String, String?>>(
        (ref, filters) async {
  final service = ref.read(bookingServiceProvider);
  final result = await service.getBookings(
    status: filters['status'],
    search: filters['search'],
    checkInFrom: filters['checkInFrom'],
    checkInTo: filters['checkInTo'],
  );
  final data = result['data'];
  if (data is List) {
    return data
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
  return [];
});

// Active login sessions from real API
final adminActiveSessionsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final repo = ref.read(adminRepositoryProvider);
  return repo.getActiveSessions();
});

// AI-detected anomalies for behavior intelligence
final adminAnomaliesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final repo = ref.read(adminRepositoryProvider);
  return repo.getSuspiciousActivity();
});

// Wastage records across all outlets
final adminWastageProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(adminRepositoryProvider).getWastageRecords();
});

// Cashier clearances for financial verification
final adminCashierClearancesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final branchId = ref.watch(adminSelectedBranchProvider);
  return ref.read(adminRepositoryProvider).getCashierClearances(
        branchId: branchId,
      );
});

// Shift summaries for shift verification
final adminShiftSummariesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final branchId = ref.watch(adminSelectedBranchProvider);
  return ref.read(adminRepositoryProvider).getShiftSummaries(
        branchId: branchId,
      );
});

// Sold items analysis
final adminSoldItemsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final branchId = ref.watch(adminSelectedBranchProvider);
  return ref.read(adminRepositoryProvider).getSoldItemsAnalysis(
        branchId: branchId,
      );
});

// Stock request approvals (pending)
final adminStockRequestApprovalsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final branchId = ref.watch(adminSelectedBranchProvider);
  return ref.read(adminRepositoryProvider).getStockRequestApprovals(
        status: 'pending',
        branchId: branchId,
      );
});

// Bar stock audits
final adminBarStockAuditsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final branchId = ref.watch(adminSelectedBranchProvider);
  return ref.read(adminRepositoryProvider).getBarStockAudits(
        branchId: branchId,
      );
});

// Purchase audit orders
final adminPurchaseAuditOrdersProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final branchId = ref.watch(adminSelectedBranchProvider);
  return ref.read(adminRepositoryProvider).getPurchaseAuditOrders(
        branchId: branchId,
      );
});
