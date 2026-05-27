import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repository.dart';
import 'models.dart';

final procurementProvider = FutureProvider<List<ProcurementItem>>((ref) async {
  final repo = ref.read(procurementRepositoryProvider);
  return repo.getProcurements();
});

final purchaseOrdersProvider =
    FutureProvider.autoDispose<List<PurchaseOrder>>((ref) async {
  final repo = ref.read(procurementRepositoryProvider);
  return repo.getPurchaseOrders();
});

final recentPurchaseOrdersProvider =
    FutureProvider.autoDispose<List<PurchaseOrder>>((ref) async {
  final repo = ref.read(procurementRepositoryProvider);
  return repo.getPurchaseOrders(limit: 5);
});

final procurementSuppliersProvider =
    FutureProvider.autoDispose<List<ProcurementSupplier>>((ref) async {
  final repo = ref.read(procurementRepositoryProvider);
  return repo.getSuppliers();
});

final procurementGrniProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(procurementRepositoryProvider).getGrni();
});

final pendingInvoicesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(procurementRepositoryProvider).getInvoices(status: 'pending');
});
