import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repository.dart';

final directorDateRangeProvider = StateProvider<DateTimeRangeValue>((ref) {
  final now = DateTime.now();
  return DateTimeRangeValue(DateTime(now.year, now.month, 1), now);
});

final directorBranchIdProvider = StateProvider<String?>((ref) => null);

final directorDashboardProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  final range = ref.watch(directorDateRangeProvider);
  final branchId = ref.watch(directorBranchIdProvider);
  return ref.read(directorRepositoryProvider).getComprehensiveDashboard(
        startDate: range.start,
        endDate: range.end,
        branchId: branchId,
      );
});

final directorBranchesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(directorRepositoryProvider).getBranches();
});

final directorBankingProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.read(directorRepositoryProvider).getBanking();
});

final directorPaymentsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(directorRepositoryProvider).getPayments();
});

final directorDiscrepanciesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(directorRepositoryProvider).getDiscrepancies();
});

final directorTasksProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(directorRepositoryProvider).getTasks();
});

class DateTimeRangeValue {
  const DateTimeRangeValue(this.start, this.end);
  final DateTime start;
  final DateTime end;
}
