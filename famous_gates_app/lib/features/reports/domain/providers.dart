import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repository.dart';
import 'models.dart';

final reportsListProvider = FutureProvider<List<ReportTemplate>>((ref) async {
  final repo = ref.read(reportsRepositoryProvider);
  return repo.getReports();
});

final reportStatsProvider = FutureProvider<ReportStats>((ref) async {
  final repo = ref.read(reportsRepositoryProvider);
  return repo.getReportStats();
});
