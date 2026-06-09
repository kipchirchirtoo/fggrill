import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/services/services.dart';
import '../../../core/network/dio_client.dart';
import '../data/superadmin_god_repository.dart';

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
  kyogongServices,
  cashierStationConfig,
  nonConsumablesCatalog,

  // Finance & Inventory
  finance,
  inventory,
  storekeepingConfig,
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
  announcements,
  emergencyControls,
  dataOverrides,
  godAuditLog,
}

final superAdminSectionProvider =
    StateProvider<SuperAdminSection>((ref) => SuperAdminSection.adminDashboard);

// AI Anomalies Provider
final aiAnomaliesProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.read(securityServiceProvider);
  return service.getAnomalies(limit: 100);
});

// AI Insights Provider
final aiInsightsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.read(securityServiceProvider);
  final response = await service.getAIInsights();
  return response['data'] is Map<String, dynamic>
      ? response['data'] as Map<String, dynamic>
      : response;
});

// AI Stats Provider
final aiStatsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.read(securityServiceProvider);
  return service.getAnomalies(limit: 100);
});

// Security Logs Provider
final securityLogsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.read(securityServiceProvider);
  return service.getSecurityLogs(limit: 50);
});

// Security Stats Provider
final securityStatsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.read(securityServiceProvider);
  final overview = await service.getSecurityStats();
  final logs = await service.getSecurityLogs(limit: 50);
  final logRows = (logs['data'] as List<dynamic>? ?? const []);
  final suspicious =
      logRows.where((log) => log is Map && log['is_suspicious'] == true).length;
  final overviewData = overview['data'] is Map<String, dynamic>
      ? overview['data'] as Map<String, dynamic>
      : <String, dynamic>{};
  return {
    ...overviewData,
    'suspicious': suspicious,
  };
});

// Security Threats Provider
final securityThreatsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.read(securityServiceProvider);
  return service.getThreats(limit: 50);
});

// Blocked IPs Provider
final blockedIPsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.read(securityServiceProvider);
  return service.getBlockedIPs();
});

// RLS Policies Provider
final rlsPoliciesProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.read(securityServiceProvider);
  return service.getRLSPolicies();
});

// API Logs Provider
final apiSecurityLogsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.read(securityServiceProvider);
  return service.getAPILogs(limit: 50);
});

// Active Sessions Provider
final activeSessionsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.read(securityServiceProvider);
  return service.getActiveSessions();
});

// Security Config Provider
final securityConfigProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.read(securityServiceProvider);
  return service.getSecurityConfig();
});

// System Health Provider
final systemHealthProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.read(systemServiceProvider);
  return service.getSystemStatus();
});

// Global Users Provider
final globalUsersProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.read(userServiceProvider);
  return service.getUsers(limit: 200);
});

// All Branches Provider
final allBranchesProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.read(systemServiceProvider);
  return service.getBranches();
});

// System Logs Provider
final systemLogsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.read(systemServiceProvider);
  return service.getAdminLogs(category: 'security', limit: 50);
});

// SuperAdmin God Repository Provider
final superadminGodRepositoryProvider =
    Provider<SuperadminGodRepository>((ref) {
  final dio = ref.read(dioProvider);
  return SuperadminGodRepository(dio);
});

// Feature Flags Provider
final featureFlagsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(superadminGodRepositoryProvider).getFeatureFlags();
});

// Announcements Provider
final announcementsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(superadminGodRepositoryProvider).getAnnouncements();
});

// Security Config (God Mode) Provider
final godSecurityConfigProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(superadminGodRepositoryProvider).getSecurityConfig();
});

// Superadmin Audit Log Provider
final godAuditLogProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref
      .read(superadminGodRepositoryProvider)
      .getSuperadminAuditLog(limit: 50);
});

// Active impersonation session state
final impersonationSessionProvider =
    StateProvider<Map<String, dynamic>?>((ref) => null);
