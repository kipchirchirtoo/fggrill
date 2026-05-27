import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repository.dart';
import 'models.dart';

final workOrdersProvider =
    FutureProvider.family<List<WorkOrder>, String?>((ref, status) async {
  final repo = ref.read(maintenanceRepositoryProvider);
  return repo.getWorkOrders(status: status);
});

final assetsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String?>((ref, status) async {
  return ref.read(maintenanceRepositoryProvider).getAssets(status: status);
});

final maintenanceScheduleProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String?>((ref, date) async {
  return ref
      .read(maintenanceRepositoryProvider)
      .getMaintenanceSchedule(date: date);
});
