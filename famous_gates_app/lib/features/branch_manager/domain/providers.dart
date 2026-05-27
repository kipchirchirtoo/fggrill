import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repository.dart';
import 'models.dart';

final branchManagerStatsProvider =
    FutureProvider<BranchManagerStats>((ref) async {
  final repo = ref.read(branchManagerRepositoryProvider);
  return repo.getDashboardStats();
});

final recentActivityProvider =
    FutureProvider<List<RecentActivity>>((ref) async {
  final repo = ref.read(branchManagerRepositoryProvider);
  return repo.getRecentActivity();
});

final bmCashierClearancesProvider =
    FutureProvider.family<List<Map<String, dynamic>>, Map<String, String?>>(
        (ref, filters) async {
  final repo = ref.read(branchManagerRepositoryProvider);
  return repo.getCashierClearances(
    date: filters['date'] ?? filters['start_date'],
    status: filters['status'],
  );
});
