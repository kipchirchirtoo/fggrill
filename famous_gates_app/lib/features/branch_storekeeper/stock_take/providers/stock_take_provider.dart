import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/storage/secure_storage_provider.dart';
import '../../data/branch_storekeeper_repository.dart';
import '../models/stock_take_item.dart';

enum StockTakeType { bar, store }

class StockTakeState {
  final List<StockTakeItem> items;
  final bool isLoading;
  final String? errorMessage;
  final bool isSubmitted;
  final String search;
  final String categoryFilter;
  final String locationFilter;
  final String dateFilter;
  final bool isSubmitting;
  final bool hasExecutiveBar;

  StockTakeState({
    required this.items,
    required this.isLoading,
    this.errorMessage,
    required this.isSubmitted,
    required this.search,
    required this.categoryFilter,
    required this.locationFilter,
    required this.dateFilter,
    required this.isSubmitting,
    required this.hasExecutiveBar,
  });

  StockTakeState copyWith({
    List<StockTakeItem>? items,
    bool? isLoading,
    String? errorMessage,
    bool? isSubmitted,
    String? search,
    String? categoryFilter,
    String? locationFilter,
    String? dateFilter,
    bool? isSubmitting,
    bool? hasExecutiveBar,
  }) {
    return StockTakeState(
      items: items ?? this.items,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage ?? this.errorMessage,
      isSubmitted: isSubmitted ?? this.isSubmitted,
      search: search ?? this.search,
      categoryFilter: categoryFilter ?? this.categoryFilter,
      locationFilter: locationFilter ?? this.locationFilter,
      dateFilter: dateFilter ?? this.dateFilter,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      hasExecutiveBar: hasExecutiveBar ?? this.hasExecutiveBar,
    );
  }
}

class StockTakeNotifier extends StateNotifier<StockTakeState> {
  final Ref _ref;
  final StockTakeType _type;

  StockTakeNotifier(this._ref, this._type)
      : super(StockTakeState(
          items: [],
          isLoading: false,
          isSubmitted: false,
          search: '',
          categoryFilter: 'all',
          locationFilter: _type == StockTakeType.bar ? 'main_bar' : 'branch_store',
          dateFilter: DateTime.now().toIso8601String().split('T')[0],
          isSubmitting: false,
          hasExecutiveBar: false,
        ));

  String get _draftKey =>
      'stock_take_draft_${_type.name}_${state.locationFilter}_${state.dateFilter}';

  Future<void> loadData({
    String? date,
    String? location,
  }) async {
    final targetDate = date ?? state.dateFilter;
    final targetLoc = location ?? state.locationFilter;

    state = state.copyWith(
      isLoading: true,
      errorMessage: null,
      dateFilter: targetDate,
      locationFilter: targetLoc,
    );

    try {
      final repo = _ref.read(branchStorekeeperRepositoryProvider);
      List<StockTakeItem> loadedItems = [];
      bool submitted = false;

      if (_type == StockTakeType.bar) {
        final records = await repo.barStocktakeRecords(
          barLocation: targetLoc,
          date: targetDate,
        );

        submitted = records.isNotEmpty && records.first['physical_quantity'] != null;

        loadedItems = records.map((r) {
          final isSubmittedRow = r['physical_quantity'] != null;
          final opening = _toInt(r['opening_stock'] ?? r['opening'] ?? 0);
          final sales = _toInt(r['sales'] ?? 0);
          // If additions is positive, we represent it as negative SDDS in order to satisfy the equation:
          // Expected Closing Stock = Opening Stock - Sales - SDDS = Opening - Sales - (-Additions) = Opening - Sales + Additions.
          final additions = _toInt(r['additions'] ?? 0);
          final sdds = -additions;

          return StockTakeItem(
            id: '${r['item_id'] ?? r['id']}',
            sku: '${r['item']?['sku'] ?? r['sku'] ?? ''}',
            productName: '${r['item_name'] ?? r['name'] ?? 'Item'}',
            imageUrl: '', // Backend doesn't return image, show placeholder
            openingStock: opening,
            sales: sales,
            sdds: sdds,
            physicalCount: isSubmittedRow
                ? _toInt(r['physical_quantity'])
                : null,
            reason: r['reason_for_variance'] ?? r['notes'],
            category: _getBarCategory('${r['item_name'] ?? r['name'] ?? 'Item'}'),
          );
        }).toList();
      } else {
        // Store Stocktake
        final records = await repo.storeStocktakeRecords(
          date: targetDate,
        );

        submitted = records.isNotEmpty && records.first['physical_quantity'] != null;

        loadedItems = records.map((r) {
          final isSubmittedRow = r['physical_quantity'] != null;
          final systemQty = _toInt(r['system_quantity'] ?? r['quantity'] ?? 0);

          return StockTakeItem(
            id: '${r['item_id'] ?? r['id']}',
            sku: '${r['item']?['sku'] ?? r['sku'] ?? ''}',
            productName: '${r['item_name'] ?? r['name'] ?? 'Item'}',
            imageUrl: '',
            openingStock: systemQty,
            sales: 0,
            sdds: 0,
            physicalCount: isSubmittedRow
                ? _toInt(r['physical_quantity'])
                : null,
            reason: r['notes'] ?? r['reason_for_variance'],
            category: '${r['category'] ?? 'Other'}',
          );
        }).toList();
      }

      // If not submitted, apply local draft values if they exist
      if (!submitted) {
        final storage = _ref.read(secureStorageProvider);
        final draftStr = await storage.read(key: _draftKey);
        if (draftStr != null && draftStr.isNotEmpty) {
          try {
            final Map<String, dynamic> draftMap = json.decode(draftStr);
            loadedItems = loadedItems.map((item) {
              if (draftMap.containsKey(item.id)) {
                final entry = draftMap[item.id] as Map<String, dynamic>;
                final physical = entry['physical'] as int?;
                final reason = entry['reason'] as String?;
                return item.copyWith(
                  physicalCount: physical,
                  reason: reason,
                );
              }
              return item;
            }).toList();
          } catch (e) {
            // Bad JSON or corrupt draft, ignore
          }
        }
      }

      final branchId = await repo.currentBranchId();
      final hasExec = branchId == 1;

      state = state.copyWith(
        items: loadedItems,
        isLoading: false,
        isSubmitted: submitted,
        hasExecutiveBar: hasExec,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Failed to load stocktake data: $e',
      );
    }
  }

  void updatePhysicalCount(String id, int? count) {
    if (state.isSubmitted) return;

    state = state.copyWith(
      items: state.items.map((item) {
        if (item.id == id) {
          final updated = item.copyWith(physicalCount: count);
          // If variance becomes 0, clear the reason
          if (updated.variance == 0) {
            return updated.copyWith(reason: null);
          }
          return updated;
        }
        return item;
      }).toList(),
    );
  }

  void updateReason(String id, String? reason) {
    if (state.isSubmitted) return;

    state = state.copyWith(
      items: state.items.map((item) {
        if (item.id == id) {
          return item.copyWith(reason: reason);
        }
        return item;
      }).toList(),
    );
  }

  void updateSearch(String query) {
    state = state.copyWith(search: query);
  }

  void updateCategoryFilter(String category) {
    state = state.copyWith(categoryFilter: category);
  }

  Future<void> saveDraft() async {
    if (state.isSubmitted) return;

    final draftMap = <String, Map<String, dynamic>>{};
    for (final item in state.items) {
      if (item.physicalCount != null || item.reason != null) {
        draftMap[item.id] = {
          'physical': item.physicalCount,
          'reason': item.reason,
        };
      }
    }

    final storage = _ref.read(secureStorageProvider);
    if (draftMap.isEmpty) {
      await storage.delete(key: _draftKey);
    } else {
      await storage.write(key: _draftKey, value: json.encode(draftMap));
    }
  }

  Future<bool> submitStockTake() async {
    if (state.isSubmitted) return false;

    // Validation
    final List<String> errors = [];
    final itemsToSubmit = <Map<String, dynamic>>[];

    for (final item in state.items) {
      if (item.physicalCount == null) {
        errors.add('${item.productName} has no physical count.');
        continue;
      }

      if (item.variance != 0 && (item.reason == null || item.reason!.isEmpty)) {
        errors.add('${item.productName} has a variance of ${item.variance >= 0 ? '+' : ''}${item.variance} but no explanation reason.');
        continue;
      }

      itemsToSubmit.add({
        'item_id': item.id,
        'physical_quantity': item.physicalCount!.toDouble(),
        if (item.variance != 0) 'reason_for_variance': item.reason,
        if (item.variance != 0) 'notes': item.reason, // For store stocktake compatibility
      });
    }

    if (errors.isNotEmpty) {
      state = state.copyWith(errorMessage: errors.join('\n'));
      return false;
    }

    if (itemsToSubmit.isEmpty) {
      state = state.copyWith(errorMessage: 'Please enter at least one count to submit.');
      return false;
    }

    state = state.copyWith(isSubmitting: true, errorMessage: null);

    try {
      final repo = _ref.read(branchStorekeeperRepositoryProvider);

      if (_type == StockTakeType.bar) {
        // Tag shift ID if any returned candidate has it
        final shiftId = state.items.isNotEmpty ? null : null; // Backend handles shift search based on location
        await repo.submitBarStocktake(
          barLocation: state.locationFilter,
          items: itemsToSubmit,
          stocktakeDate: state.dateFilter,
          shiftId: shiftId,
        );
      } else {
        await repo.submitStoreStocktake(
          items: itemsToSubmit,
          stocktakeDate: state.dateFilter,
        );
      }

      // Submission succeeded, clear draft local storage
      final storage = _ref.read(secureStorageProvider);
      await storage.delete(key: _draftKey);

      state = state.copyWith(isSubmitting: false, isSubmitted: true);
      // Reload state from server
      await loadData();
      return true;
    } catch (e) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: 'Submission failed: $e',
      );
      return false;
    }
  }

  void clearError() {
    state = state.copyWith(errorMessage: null);
  }

  String _getBarCategory(String name) {
    final lower = name.toLowerCase();
    if (lower.contains('beer') ||
        lower.contains('tusker') ||
        lower.contains('guinness') ||
        lower.contains('heineken') ||
        lower.contains('white cap') ||
        lower.contains('whitecap') ||
        lower.contains('balozi') ||
        lower.contains('pilsner') ||
        lower.contains('summit') ||
        lower.contains('windhoek') ||
        lower.contains('black ice') ||
        lower.contains('savanna') ||
        lower.contains('guiness')) {
      return 'BEERS';
    } else if (lower.contains('wine') ||
        lower.contains('sweet red') ||
        lower.contains('sweet white') ||
        lower.contains('four cousins') ||
        lower.contains('cellar cask') ||
        lower.contains('robertson') ||
        lower.contains('frontera') ||
        lower.contains('nederburg') ||
        lower.contains('caprice') ||
        lower.contains('drostdy') ||
        lower.contains('chamdor')) {
      return 'WINES';
    } else if (lower.contains('whisky') ||
        lower.contains('whiskey') ||
        lower.contains('johnnie walker') ||
        lower.contains('red label') ||
        lower.contains('black label') ||
        lower.contains('double black') ||
        lower.contains('jack daniel') ||
        lower.contains('jameson') ||
        lower.contains('glenfiddich') ||
        lower.contains('chivas') ||
        lower.contains('ballantines') ||
        lower.contains('vat 69') ||
        lower.contains('famous grouse') ||
        lower.contains('grants') ||
        lower.contains('viceroy') ||
        lower.contains('chrome') ||
        lower.contains('gordons') ||
        lower.contains('gilbeys') ||
        lower.contains('tanqueray') ||
        lower.contains('beefeater') ||
        lower.contains('hendricks') ||
        lower.contains('chrome vodka') ||
        lower.contains('smirnoff') ||
        lower.contains('absolut') ||
        lower.contains('captain morgan') ||
        lower.contains('bacardi') ||
        lower.contains('rum') ||
        lower.contains('vodka') ||
        lower.contains('gin') ||
        lower.contains('brandy') ||
        lower.contains('cognac') ||
        lower.contains('spirit') ||
        lower.contains('liquer') ||
        lower.contains('liqueur') ||
        lower.contains('baileys') ||
        lower.contains('sheridans') ||
        lower.contains('amarula') ||
        lower.contains('jagermeister') ||
        lower.contains('tequila')) {
      return 'SPIRITS & LIQUEURS';
    } else if (lower.contains('soda') ||
        lower.contains('coke') ||
        lower.contains('fanta') ||
        lower.contains('sprite') ||
        lower.contains('water') ||
        lower.contains('keringet') ||
        lower.contains('juice') ||
        lower.contains('tonic') ||
        lower.contains('ginger ale') ||
        lower.contains('soft drink') ||
        lower.contains('red bull') ||
        lower.contains('monster')) {
      return 'SOFT DRINKS & WATER';
    }
    return 'OTHER BEVERAGES';
  }

  int _toInt(dynamic v) {
    if (v is int) return v;
    if (v is double) return v.toInt();
    if (v is String) {
      return double.tryParse(v)?.toInt() ?? int.tryParse(v) ?? 0;
    }
    return 0;
  }
}

// Providers
final barStockTakeProvider =
    StateNotifierProvider.autoDispose<StockTakeNotifier, StockTakeState>((ref) {
  final notifier = StockTakeNotifier(ref, StockTakeType.bar);
  ref.onDispose(() {
    // Optionally auto-save draft on dispose
    notifier.saveDraft();
  });
  return notifier;
});

final storeStockTakeProvider =
    StateNotifierProvider.autoDispose<StockTakeNotifier, StockTakeState>((ref) {
  final notifier = StockTakeNotifier(ref, StockTakeType.store);
  ref.onDispose(() {
    notifier.saveDraft();
  });
  return notifier;
});
