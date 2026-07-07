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
  /// The cashier shift this stocktake is being recorded for.
  /// Populated from the backend response's `shift_id` field and
  /// joined shift_number / cashier_name. Null until first load completes.
  final Map<String, dynamic>? currentShift;
  final double largePct;
  final double extremePct;

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
    this.currentShift,
    this.largePct = 3.0,
    this.extremePct = 10.0,
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
    Map<String, dynamic>? currentShift,
    bool clearShift = false,
    double? largePct,
    double? extremePct,
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
      currentShift: clearShift ? null : (currentShift ?? this.currentShift),
      largePct: largePct ?? this.largePct,
      extremePct: extremePct ?? this.extremePct,
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
          largePct: 3.0,
          extremePct: 10.0,
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
      double largeVal = 3.0;
      double extremeVal = 10.0;

      if (_type == StockTakeType.bar) {
        final response = await repo.barStocktakeRecords(
          barLocation: targetLoc,
          date: targetDate,
        );
        largeVal = double.tryParse((response['stocktake_variance_large_pct'] ?? '').toString()) ?? 3.0;
        extremeVal = double.tryParse((response['stocktake_variance_extreme_pct'] ?? '').toString()) ?? 10.0;
        final records = _unwrapResponseList(response);
        final responseShiftId = response['shift_id'] as String?;

        submitted = records.isNotEmpty && records.first['physical_quantity'] != null;

        // Capture shift info from any record that has it, or from the top-level shift_id
        Map<String, dynamic>? shiftInfo;
        if (records.isNotEmpty) {
          final firstWithShift = records.firstWhere(
            (r) => r['shift_id'] != null,
            orElse: () => <String, dynamic>{},
          );
          if (firstWithShift.isNotEmpty) {
            shiftInfo = {
              'shift_id': firstWithShift['shift_id'],
              'shift_number': firstWithShift['shift_number'],
              'cashier_name': firstWithShift['cashier_name'],
              'shift_opened_at': firstWithShift['shift_opened_at'],
              'shift_closed_at': firstWithShift['shift_closed_at'],
            };
          }
        }
        if (shiftInfo == null && responseShiftId != null) {
          shiftInfo = {'shift_id': responseShiftId};
        }

        state = state.copyWith(currentShift: shiftInfo);
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
            explanation: r['explanation'] ?? r['reason_for_variance'] ?? r['notes'],
            actionTaken: r['action_taken'],
            category: getBarCategory('${r['item_name'] ?? r['name'] ?? 'Item'}'),
          );
        }).toList();
      } else {
        // Store Stocktake
        final response = await repo.storeStocktakeRecords(
          date: targetDate,
        );
        largeVal = double.tryParse((response['stocktake_variance_large_pct'] ?? '').toString()) ?? 3.0;
        extremeVal = double.tryParse((response['stocktake_variance_extreme_pct'] ?? '').toString()) ?? 10.0;
        final records = _unwrapResponseList(response);
        final responseShiftId = response['shift_id'] as String?;

        // Capture shift info
        Map<String, dynamic>? shiftInfo;
        if (records.isNotEmpty) {
          final firstWithShift = records.firstWhere(
            (r) => r['shift_id'] != null,
            orElse: () => <String, dynamic>{},
          );
          if (firstWithShift.isNotEmpty) {
            shiftInfo = {
              'shift_id': firstWithShift['shift_id'],
              'shift_number': firstWithShift['shift_number'],
              'cashier_name': firstWithShift['cashier_name'],
              'shift_opened_at': firstWithShift['shift_opened_at'],
              'shift_closed_at': firstWithShift['shift_closed_at'],
            };
          }
        }
        if (shiftInfo == null && responseShiftId != null) {
          shiftInfo = {'shift_id': responseShiftId};
        }

        state = state.copyWith(currentShift: shiftInfo);
        submitted = records.isNotEmpty && records.first['physical_quantity'] != null;

        loadedItems = records.map((r) {
          final isSubmittedRow = r['physical_quantity'] != null;
          // Use opening_stock when available (new backend), fall back to system_quantity/quantity
          final opening  = _toInt(r['opening_stock']  ?? r['system_quantity'] ?? r['quantity'] ?? 0);
          final sales    = _toInt(r['sales']           ?? 0);
          final additions = _toInt(r['additions']      ?? 0);
          // SDDS = negative additions (same convention as bar stocktake)
          final sdds = _toInt(r['sdds'] ?? 0) != 0
              ? _toInt(r['sdds'])
              : -additions;

          return StockTakeItem(
            id: '${r['item_id'] ?? r['id']}',
            sku: '${r['sku'] ?? r['item']?['sku'] ?? ''}',
            productName: '${r['item_name'] ?? r['name'] ?? 'Item'}',
            imageUrl: '',
            openingStock: opening,
            sales: sales,
            sdds: sdds,
            physicalCount: isSubmittedRow
                ? _toInt(r['physical_quantity'])
                : null,
            reason: r['notes'] ?? r['reason_for_variance'],
            explanation: r['explanation'] ?? r['notes'] ?? r['reason_for_variance'],
            actionTaken: r['action_taken'],
            category: '${r['category'] ?? r['item']?['category'] ?? 'Other'}',
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
        largePct: largeVal,
        extremePct: extremeVal,
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

      itemsToSubmit.add({
        'item_id': item.id,
        'physical_quantity': item.physicalCount!.toDouble(),
        if (item.reason != null) 'reason_for_variance': item.reason,
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
        final shiftId = state.currentShift?['shift_id'] as String?;
        await repo.submitBarStocktake(
          barLocation: state.locationFilter,
          items: itemsToSubmit,
          stocktakeDate: state.dateFilter,
          shiftId: shiftId,
        );
      } else {
        final shiftId = state.currentShift?['shift_id'] as String?;
        await repo.submitStoreStocktake(
          items: itemsToSubmit,
          stocktakeDate: state.dateFilter,
          shiftId: shiftId,
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
      // Extract the server error message from Dio response body if available.
      String msg = 'Submission failed: $e';
      try {
        final dynamic data = (e as dynamic).response?.data;
        if (data is Map && data['message'] != null) {
          msg = 'Submission failed: ${data['message']}';
        }
      } catch (_) {}
      state = state.copyWith(isSubmitting: false, errorMessage: msg);
      return false;
    }
  }

  void clearError() {
    state = state.copyWith(errorMessage: null);
  }

  int _toInt(dynamic v) {
    if (v is int) return v;
    if (v is double) return v.toInt();
    if (v is String) {
      return double.tryParse(v)?.toInt() ?? int.tryParse(v) ?? 0;
    }
    return 0;
  }

  /// Safely unwrap the data list from a full API response map.
  List<Map<String, dynamic>> _unwrapResponseList(Map<String, dynamic> response) {
    final raw = response['data'];
    if (raw is List) {
      return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
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
