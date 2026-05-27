import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repository.dart';

final kitchenStatsProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final repo = ref.read(kitchenOpsRepositoryProvider);
  return repo.getDashboardStats();
});

final recipesProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final repo = ref.read(kitchenOpsRepositoryProvider);
  return repo.getRecipes();
});

final kitchenStockProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(kitchenOpsRepositoryProvider).getStock();
});

final kitchenLedgerProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(kitchenOpsRepositoryProvider).getLedger();
});

final requisitionsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(kitchenOpsRepositoryProvider).getRequisitions();
});

final usageProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final repo = ref.read(kitchenOpsRepositoryProvider);
  return repo.getUsage();
});

final wastageProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final repo = ref.read(kitchenOpsRepositoryProvider);
  return repo.getWastage();
});

final foodControlsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(kitchenOpsRepositoryProvider).getFoodControls();
});

final expectedPortionsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(kitchenOpsRepositoryProvider).getExpectedPortions();
});

final kitchenVarianceProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(kitchenOpsRepositoryProvider).getVariance();
});
