import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repository.dart';
import 'models.dart';

final auditOverviewProvider = FutureProvider<AuditOverview>((ref) async {
  final repo = ref.read(auditorRepositoryProvider);
  return repo.getAuditOverview();
});

final auditLogsProvider = FutureProvider<List<AuditLogEntry>>((ref) async {
  final repo = ref.read(auditorRepositoryProvider);
  return repo.getAuditLogs();
});

final discrepanciesProvider = FutureProvider<List<Discrepancy>>((ref) async {
  final repo = ref.read(auditorRepositoryProvider);
  return repo.getDiscrepancies();
});

final auditorCashierClearancesProvider =
    FutureProvider.family<List<Map<String, dynamic>>, Map<String, String?>>(
        (ref, filters) async {
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
  final repo = ref.read(auditorRepositoryProvider);
  return repo.getReconciliation(
    startDate: filters['start_date'],
    endDate: filters['end_date'],
  );
});

final auditLogsFilteredProvider =
    FutureProvider.family<List<AuditLogEntry>, Map<String, String?>>(
        (ref, filters) async {
  final repo = ref.read(auditorRepositoryProvider);
  return repo.getAuditLogsPaged(
    severity: filters['severity'],
    action: filters['action'],
    limit: 100,
  );
});
