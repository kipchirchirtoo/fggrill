import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repository.dart';

final gmOverviewProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final repo = ref.read(gmRepositoryProvider);
  return repo.getOverview();
});

final gmBranchesProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final repo = ref.read(gmRepositoryProvider);
  return repo.getBranches();
});

final gmStaffProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(gmRepositoryProvider).getStaff();
});

final gmLeaveRequestsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(gmRepositoryProvider).getLeaveRequests();
});

final gmBranchFinancialsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(gmRepositoryProvider).getBranchFinancials();
});
