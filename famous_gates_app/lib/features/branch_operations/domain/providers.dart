import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repository.dart';

final branchDashboardProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(branchOperationsRepositoryProvider).getDashboard();
});

final branchReservationsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, Map<String, String?>>(
        (ref, filters) async {
  final repo = ref.read(branchOperationsRepositoryProvider);
  return repo.getReservations(
    status: filters['status'],
    from: filters['from'],
    to: filters['to'],
  );
});

final branchInventoryProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final repo = ref.read(branchOperationsRepositoryProvider);
  return repo.getInventory();
});

final incomingDispatchesProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final repo = ref.read(branchOperationsRepositoryProvider);
  return repo.getIncomingDispatches();
});

final stockTakesProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String?>(
        (ref, status) async {
  final repo = ref.read(branchOperationsRepositoryProvider);
  return repo.getStockTakes(status: status);
});

final branchStaffProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final repo = ref.read(branchOperationsRepositoryProvider);
  return repo.getStaff();
});

final branchRoomsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(branchOperationsRepositoryProvider).getRooms();
});

final branchCommunicationsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(branchOperationsRepositoryProvider).getCommunications();
});
