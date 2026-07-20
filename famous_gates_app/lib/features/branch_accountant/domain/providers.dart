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
    repo.getDailyRecords(startDate: startText, endDate: endText),
    repo.getBranchSalesAnalytics(startDate: startText, endDate: endText),
    repo.getBranchFinancials(startDate: startText, endDate: endText),
    repo.getDiscrepancies(),
    repo.getBudgetSummary(),
  ]);
  return {
    'clearances': results[0],
    'daily_records': results[1],
    'sales': results[2],
    'financials': results[3],
    'discrepancies': results[4],
    'budget_summary': results[5],
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

final kitchenRecipesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.watch(branchAccountantRepositoryProvider).getKitchenRecipes();
});

final directFoodControlItemsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref
      .watch(branchAccountantRepositoryProvider)
      .getDirectFoodControlItems();
});

final channelFoodStandardsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref
      .watch(branchAccountantRepositoryProvider)
      .getChannelFoodStandards();
});

final channelPackageMenuItemsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref
      .watch(branchAccountantRepositoryProvider)
      .getChannelPackageMenuItems();
});

final linkableMenuItemsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.watch(branchAccountantRepositoryProvider).getLinkableMenuItems();
});

final rawStockCandidatesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.watch(branchAccountantRepositoryProvider).getRawStockCandidates();
});

final ingredientInputCandidatesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final rawCandidates = await ref.watch(rawStockCandidatesProvider.future);
  final recipes = await ref.watch(kitchenRecipesProvider.future);

  final combined = <Map<String, dynamic>>[
    ...rawCandidates.map((row) => {
          ...row,
          'source_type': row['source_type'] ?? 'RAW_STOCK',
        }),
  ];

  for (final recipe in recipes) {
    final yieldType =
        (recipe['yield_type_code'] ?? '').toString().trim().toUpperCase();
    if (yieldType != 'SUB_ASSEMBLY') continue;

    final itemName = (recipe['produced_item_name'] ?? '').toString().trim();
    final sku = (recipe['produced_inventory_item_sku'] ??
            recipe['produced_item_sku'] ??
            '')
        .toString()
        .trim();
    final unit = (recipe['produced_unit'] ?? 'portion').toString().trim();

    if (itemName.isEmpty || sku.isEmpty) continue;

    combined.add({
      'id': recipe['produced_inventory_item_id'] ?? recipe['id'],
      'item_id': recipe['produced_inventory_item_id'] ?? recipe['id'],
      'sku': sku,
      'item_name': itemName,
      'name': itemName,
      'unit': unit,
      'unit_of_measure': unit,
      'source_type': 'SUB_ASSEMBLY',
      'recipe_id': recipe['id'],
      'yield_type_code': yieldType,
    });
  }

  final deduped = <String, Map<String, dynamic>>{};
  for (final item in combined) {
    final sku = (item['sku'] ?? item['item_id'] ?? item['id'] ?? '')
        .toString()
        .trim();
    if (sku.isEmpty) continue;
    deduped[sku] = item;
  }

  final values = deduped.values.toList()
    ..sort((a, b) => (a['item_name'] ?? '')
        .toString()
        .toLowerCase()
        .compareTo((b['item_name'] ?? '').toString().toLowerCase()));
  return values;
});

final activeEventOrdersProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String?>((ref, eventType) {
  return ref.watch(branchAccountantRepositoryProvider).getEventOrders(
        activeOnly: true,
        eventType: eventType,
      );
});

/// Derives all distinct unit values from the inventory, sorted alphabetically.
/// Derived from rawStockCandidates so no extra API call is needed.
final inventoryUnitsProvider =
    FutureProvider.autoDispose<List<String>>((ref) async {
  final candidates = await ref.watch(rawStockCandidatesProvider.future);
  final units = candidates
      .map((i) => (i['unit'] ?? i['unit_of_measure'] ?? '').toString().trim())
      .where((u) => u.isNotEmpty)
      .toSet()
      .toList()
    ..sort();
  return units;
});
