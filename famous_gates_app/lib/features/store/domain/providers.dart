import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repository.dart';
import 'models.dart';

final storeDashboardProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final repo = ref.read(storeRepositoryProvider);
  return repo.getDashboard();
});

final centralStoreDashboardProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final repo = ref.read(storeRepositoryProvider);
  return repo.getDashboard(central: true);
});

final inventoryItemsProvider =
    FutureProvider.family<List<InventoryItem>, String?>((ref, search) async {
  final repo = ref.read(storeRepositoryProvider);
  return repo.getItems(search: search);
});

final branchStockProvider = FutureProvider<List<InventoryItem>>((ref) async {
  final repo = ref.read(storeRepositoryProvider);
  return repo.getBranchStock();
});

final lowStockItemsProvider = FutureProvider<List<InventoryItem>>((ref) async {
  final repo = ref.read(storeRepositoryProvider);
  return repo.getLowStockItems();
});

final stockRequestsProvider =
    FutureProvider.family<List<StockRequest>, String?>((ref, status) async {
  final repo = ref.read(storeRepositoryProvider);
  return repo.getStockRequests(status: status);
});

final suppliersProvider = FutureProvider<List<Supplier>>((ref) async {
  final repo = ref.read(storeRepositoryProvider);
  return repo.getSuppliers();
});

final dispatchOrdersProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String?>((ref, status) async {
  return ref.read(storeRepositoryProvider).getDispatchOrders(status: status);
});

final receivingRecordsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(storeRepositoryProvider).getReceivingRecords();
});

final spoilageRecordsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(storeRepositoryProvider).getSpoilageRecords();
});

final packingRecordsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(storeRepositoryProvider).getPackingRecords();
});

final fleetVehiclesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(storeRepositoryProvider).getFleetVehicles();
});

final fleetDriversProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(storeRepositoryProvider).getFleetDrivers();
});

final storeResourceProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, path) async {
  return ref.read(storeRepositoryProvider).getResource(path);
});
