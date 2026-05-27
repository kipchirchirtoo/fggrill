import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/repository.dart';

final branchAccountantOverviewProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final repo = ref.watch(branchAccountantRepositoryProvider);
  final today = DateTime.now();
  final start = DateTime(today.year, today.month, 1);
  final startText = _date(start);
  final endText = _date(today);
  final results = await Future.wait([
    repo.getCashierClearances(date: endText),
    repo.getBranchSalesAnalytics(startDate: startText, endDate: endText),
    repo.getBranchFinancials(startDate: startText, endDate: endText),
    repo.getDiscrepancies(),
    repo.getBudgetSummary(),
  ]);
  return {
    'clearances': results[0],
    'sales': results[1],
    'financials': results[2],
    'discrepancies': results[3],
    'budget_summary': results[4],
  };
});

final branchAccountantDirectorTasksProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.watch(branchAccountantRepositoryProvider).getDirectorTasks();
});

String _date(DateTime value) {
  final month = value.month.toString().padLeft(2, '0');
  final day = value.day.toString().padLeft(2, '0');
  return '${value.year}-$month-$day';
}
