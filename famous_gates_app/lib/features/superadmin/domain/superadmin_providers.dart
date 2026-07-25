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
  menuPricing,
  kyogongServices,
  cashierStationConfig,
  nonConsumablesCatalog,
  posOutletMenu,

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
  return service.getAnomalies(limit: 10);
});
