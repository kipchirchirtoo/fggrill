import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/services/services.dart';
import '../../../core/network/dio_client.dart';
import '../data/superadmin_god_repository.dart';

export '../data/superadmin_god_repository.dart';

// SuperAdmin Navigation Sections
enum SuperAdminSection {
  // Command
  adminDashboard,
  lina,
  securityCenter,
  systemHealth,
  globalSearch,

  // Access & Organization
  globalUsers,
  personnelRegistry,
  rolesPermissions,
  branches,
  departments,

  // Hotel Setup
  rooms,
  rates,
  paymentBillingSettings,
  reportTemplates,
  documentTemplates,

  // POS & Sales Setup
  posConfiguration,
  tillNumbers,
  restaurantMenu,
  barMenu,
  menuPricing,
  kyogongServices,
  cashierStationConfig,
  nonConsumablesCatalog,
  posOutletMenu,
  posTerminals,

  // Finance & Inventory
  finance,
  inventory,
  storekeepingConfig,
  kitchenLedgerItems,
  suppliers,
  payrollSettings,

  // Logistics
  fleetOverview,
  vehicles,
  drivers,

  // System
  auditLogs,
  reports,
  integrations,
  settings,

  // God Controls
  impersonation,
  featureFlags,
  toggleSettings,
  announcements,
  emergencyControls,
  dataOverrides,
  godAuditLog,
}

final superAdminSectionProvider =
    StateProvider<SuperAdminSection>((ref) => SuperAdminSection.adminDashboard);

// ── SuperAdmin God Repository Provider ─────────────────────────────────────
final superadminGodRepositoryProvider = Provider<SuperadminGodRepository>((ref) {
  return SuperadminGodRepository(ref.read(dioProvider));
});

// ── Impersonation Session Provider ──────────────────────────────────────────
final impersonationSessionProvider =
    StateProvider<Map<String, dynamic>?>((ref) => null);

// Helper wrapper to sanitize responses into Map<String, dynamic>
Map<String, dynamic> _toMap(dynamic val, String key) {
  if (val is Map<String, dynamic>) return val;
  if (val is Map) return Map<String, dynamic>.from(val);
  if (val is List) return {key: val, 'data': val};
  return {'data': val};
}

// ── Security Providers ──────────────────────────────────────────────────────
final securityLogsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final repo = ref.read(superadminGodRepositoryProvider);
  return _toMap(await repo.getSuperadminAuditLog(), 'logs');
});

final securityStatsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final repo = ref.read(superadminGodRepositoryProvider);
  return repo.getSecurityConfig();
});

final securityThreatsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.read(securityServiceProvider);
  return _toMap(await service.getAnomalies(), 'threats');
});

final blockedIPsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.read(securityServiceProvider);
  return _toMap(await service.getBlockedIPs(), 'ips');
});

final activeSessionsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.read(securityServiceProvider);
  return _toMap(await service.getActiveSessions(), 'sessions');
});

final rlsPoliciesProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final repo = ref.read(superadminGodRepositoryProvider);
  return _toMap(await repo.getSuperadminAuditLog(), 'policies');
});

final securityConfigProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final repo = ref.read(superadminGodRepositoryProvider);
  return repo.getSecurityConfig();
});

final apiSecurityLogsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final repo = ref.read(superadminGodRepositoryProvider);
  return _toMap(await repo.getSuperadminAuditLog(), 'logs');
});

final godSecurityConfigProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final repo = ref.read(superadminGodRepositoryProvider);
  return repo.getSecurityConfig();
});

// ── System Health Provider ──────────────────────────────────────────────────
final systemHealthProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final repo = ref.read(superadminGodRepositoryProvider);
  return repo.getSecurityConfig();
});

// ── Global Users Provider ───────────────────────────────────────────────────
final globalUsersProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.read(userServiceProvider);
  final response = await service.getUsers(page: 1, limit: 500);
  final mapped = _toMap(response, 'data');
  final rows = mapped['data'] is List
      ? List<dynamic>.from(mapped['data'] as List)
      : mapped['users'] is List
          ? List<dynamic>.from(mapped['users'] as List)
          : const <dynamic>[];
  return {
    ...mapped,
    'data': rows,
    'users': rows,
  };
});

// ── Branches Provider ───────────────────────────────────────────────────────
final allBranchesProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final repo = ref.read(superadminGodRepositoryProvider);
  final branches = await repo.getBranches();
  return {'branches': branches, 'data': branches};
});

// ── System Logs Provider ────────────────────────────────────────────────────
final systemLogsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final repo = ref.read(superadminGodRepositoryProvider);
  final logs = await repo.getSuperadminAuditLog();
  return {'logs': logs, 'data': logs};
});

// ── Feature Flags Provider ──────────────────────────────────────────────────
final featureFlagsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final repo = ref.read(superadminGodRepositoryProvider);
  return repo.getFeatureFlags();
});

// ── Announcements Provider ──────────────────────────────────────────────────
final announcementsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final repo = ref.read(superadminGodRepositoryProvider);
  return repo.getAnnouncements();
});

// ── God Audit Log Provider ──────────────────────────────────────────────────
final godAuditLogProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final repo = ref.read(superadminGodRepositoryProvider);
  return repo.getSuperadminAuditLog();
});

// ── AI Legacy Providers ─────────────────────────────────────────────────────
final aiAnomaliesProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.read(securityServiceProvider);
  return service.getAnomalies(limit: 100);
});

final aiInsightsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.read(securityServiceProvider);
  final response = await service.getAIInsights();
  return response['data'] is Map<String, dynamic>
      ? response['data'] as Map<String, dynamic>
      : response;
});

final aiStatsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.read(securityServiceProvider);
  return service.getAnomalies(limit: 10);
});
