import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../admin/domain/admin_providers.dart';
import '../data/repository.dart';
import 'models.dart';

final auditOverviewProvider = FutureProvider<AuditOverview>((ref) async {
  ref.watch(adminSelectedBranchProvider);
  final repo = ref.read(auditorRepositoryProvider);
  return repo.getAuditOverview();
});

final auditLogsProvider = FutureProvider<List<AuditLogEntry>>((ref) async {
  ref.watch(adminSelectedBranchProvider);
  final repo = ref.read(auditorRepositoryProvider);
  return repo.getAuditLogs();
});

final discrepanciesProvider = FutureProvider<List<Discrepancy>>((ref) async {
  ref.watch(adminSelectedBranchProvider);
  final repo = ref.read(auditorRepositoryProvider);
  return repo.getDiscrepancies();
});

final auditorCashierClearancesProvider =
    FutureProvider.family<List<Map<String, dynamic>>, Map<String, String?>>(
        (ref, filters) async {
  ref.watch(adminSelectedBranchProvider);
  final repo = ref.read(auditorRepositoryProvider);
  return repo.getCashierClearances(
    startDate: filters['start_date'],
    endDate: filters['end_date'],
    status: filters['status'],
  );
});

final auditorReconciliationProvider =
    FutureProvider.family<List<Map<String, dynamic>>, Map<String, String?>>(
        (ref, filters) async {
  ref.watch(adminSelectedBranchProvider);
  final repo = ref.read(auditorRepositoryProvider);
  return repo.getReconciliation(
    startDate: filters['start_date'],
    endDate: filters['end_date'],
  );
});

final branchOrdersFiltersProvider = StateProvider<Map<String, String?>>((ref) {
  final now = DateTime.now();
  final from = now.subtract(const Duration(days: 30));
  String fmt(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  return {'start_date': fmt(from), 'end_date': fmt(now)};
});

final branchOrdersProvider =
    FutureProvider.family<BranchOrdersData, Map<String, String?>>(
        (ref, filters) {
  ref.watch(adminSelectedBranchProvider);
  return ref.read(auditorRepositoryProvider).getBranchOrders(
        startDate: filters['start_date'],
        endDate: filters['end_date'],
      );
});

/// Counts PENDING_AUDIT stock requests — used for the tab badge.
final pendingStockRequestCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final repo = ref.read(auditorRepositoryProvider);
  try {
    final orders = await repo.getBranchOrders();
    return orders.summary.pending;
  } catch (_) {
    return 0;
  }
});

final auditLogsFilteredProvider =
    FutureProvider.family<List<AuditLogEntry>, Map<String, String?>>(
        (ref, filters) async {
  ref.watch(adminSelectedBranchProvider);
  final repo = ref.read(auditorRepositoryProvider);
  return repo.getAuditLogsPaged(
    severity: filters['severity'],
    action: filters['action'],
    limit: 100,
  );
});
