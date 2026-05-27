import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repository.dart';

final kyogongSalesPointsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final repo = ref.read(kyogongRepositoryProvider);
  return repo.getSalesPoints(isActive: true);
});

final kyogongCurrentShiftProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final repo = ref.read(kyogongRepositoryProvider);
  return repo.getCurrentShift();
});

final kyogongShiftsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, Map<String, String?>>(
        (ref, filters) async {
  final repo = ref.read(kyogongRepositoryProvider);
  return repo.getShifts(
    status: filters['status'],
    salesPointId: filters['sales_point_id'],
    startDate: filters['start_date'],
    endDate: filters['end_date'],
  );
});

final kyogongPettyCashProvider =
    FutureProvider.family<List<Map<String, dynamic>>, Map<String, String?>>(
        (ref, filters) async {
  final repo = ref.read(kyogongRepositoryProvider);
  return repo.getPettyCashEntries(
    shiftId: filters['shift_id'],
    startDate: filters['start_date'],
    endDate: filters['end_date'],
    category: filters['purpose_category'],
  );
});

final kyogongFloatCurrentProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, shiftId) async {
  final repo = ref.read(kyogongRepositoryProvider);
  return repo.getCurrentFloat(shiftId);
});

final kyogongFloatHistoryProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>(
        (ref, shiftId) async {
  final repo = ref.read(kyogongRepositoryProvider);
  return repo.getFloatHistory(shiftId);
});

final kyogongSpaServicesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(kyogongRepositoryProvider).getSpaServices();
});

final kyogongServiceCategoriesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(kyogongRepositoryProvider).getServiceCategories();
});

final kyogongDynamicServicesProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String?>((ref, serviceType) {
  return ref
      .read(kyogongRepositoryProvider)
      .getDynamicServices(serviceType: serviceType, isActive: true);
});

final kyogongShiftTransactionsProvider = FutureProvider.family
    .autoDispose<List<Map<String, dynamic>>, String>((ref, shiftId) {
  return ref.read(kyogongRepositoryProvider).getShiftTransactions(shiftId);
});
