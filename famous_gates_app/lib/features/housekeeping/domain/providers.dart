import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repository.dart';
import 'models.dart';

final hkRoomsProvider = FutureProvider<List<HkRoom>>((ref) async {
  final repo = ref.read(housekeepingRepositoryProvider);
  return repo.getRooms();
});

final hkTasksProvider =
    FutureProvider.family<List<HkTask>, String?>((ref, status) async {
  final repo = ref.read(housekeepingRepositoryProvider);
  return repo.getTasks(status: status);
});

final hkInspectionsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(housekeepingRepositoryProvider).getInspections();
});

final hkLostFoundProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(housekeepingRepositoryProvider).getLostFound();
});

final hkSuppliesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(housekeepingRepositoryProvider).getSuppliesInventory();
});

final hkScheduleProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(housekeepingRepositoryProvider).getSchedule();
});

final hkStaffProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(housekeepingRepositoryProvider).getStaff();
});

final hkShiftDefinitionsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(housekeepingRepositoryProvider).getShiftDefinitions();
});
