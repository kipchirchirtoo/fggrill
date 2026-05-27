import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repository.dart';

final facilitiesDashboardProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final repo = ref.read(facilitiesRepositoryProvider);
  return repo.getDashboard();
});

final facilitiesRoomsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final repo = ref.read(facilitiesRepositoryProvider);
  return repo.getRooms();
});

final housekeepingTasksProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final repo = ref.read(facilitiesRepositoryProvider);
  return repo.getHousekeepingTasks();
});

final facilitiesInspectionsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(facilitiesRepositoryProvider).getInspections();
});

final facilitiesLostFoundProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(facilitiesRepositoryProvider).getLostFound();
});

final facilitiesWorkOrdersProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(facilitiesRepositoryProvider).getWorkOrders();
});

final facilitiesAssetsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(facilitiesRepositoryProvider).getAssets();
});

final facilitiesScheduleProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(facilitiesRepositoryProvider).getSchedule();
});

final facilitiesStaffProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(facilitiesRepositoryProvider).getStaff();
});

final facilitiesInventoryProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(facilitiesRepositoryProvider).getInventory();
});
