import 'dart:convert';
import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../stocktakes/data/store_stocktake_repository.dart';
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

  String _draftKeyFor(String locationFilter, String dateFilter) =>
      'stock_take_draft_${_type.name}_${locationFilter}_$dateFilter';

  StockTakeState? _safeState() {
    if (!mounted) return null;
    try {
      return state;
    } catch (_) {
      return null;
    }
  }

  void _replaceState(StockTakeState nextState) {
    if (!mounted) return;
    try {
      state = nextState;
    } catch (_) {}
  }

  void _updateState(StockTakeState Function(StockTakeState current) transform) {
    final current = _safeState();
    if (current == null) return;
    try {
      state = transform(current);
    } catch (_) {}
  }

  Future<File> _getDraftFileFor({
    required String locationFilter,
    required String dateFilter,
  }) async {
    final dir = await getApplicationDocumentsDirectory();
    final draftsDir = Directory('${dir.path}/fggrill_drafts');
    if (!draftsDir.existsSync()) {
      await draftsDir.create(recursive: true);
    }
    final draftKey = _draftKeyFor(locationFilter, dateFilter);
    return File('${draftsDir.path}/$draftKey.json');
  }

  Future<void> loadData({
    String? date,
    String? location,
  }) async {
    if (!mounted) return;
    final currentState = state;
    final targetDate = date ?? currentState.dateFilter;
    final targetLoc = location ?? currentState.locationFilter;

    _replaceState(currentState.copyWith(
      isLoading: true,
      errorMessage: null,
      dateFilter: targetDate,
      locationFilter: targetLoc,
    ));

    try {
      final repo = _ref.read(storeStocktakeRepositoryProvider);
      List<StockTakeItem> loadedItems = [];
      bool submitted = false;
      double largeVal = 3.0;
      double extremeVal = 10.0;

      if (_type == StockTakeType.bar) {
        final response = await repo.barStocktakeRecords(
          barLocation: targetLoc,
          date: targetDate,
        );
        if (!mounted) return;
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

        if (!mounted) return;
        _updateState((current) => current.copyWith(currentShift: shiftInfo));
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
        if (!mounted) return;
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

        if (!mounted) return;
        _updateState((current) => current.copyWith(currentShift: shiftInfo));
        submitted = records.isNotEmpty && records.first['physical_quantity'] != null;

        loadedItems = records
            .where((r) {
              final category =
                  '${r['category'] ?? r['item']?['category'] ?? 'Other'}';
              final sku = '${r['sku'] ?? r['item']?['sku'] ?? ''}';
              final name = '${r['item_name'] ?? r['name'] ?? 'Item'}';
              final storeType =
                  '${r['store_type'] ?? r['item']?['store_type'] ?? ''}';
              return isAllowedStoreStocktakeItem(
                category: category,
                sku: sku,
                name: name,
                storeType: storeType,
              );
            })
            .map((r) {
              final isSubmittedRow = r['physical_quantity'] != null;
              final opening = _toInt(
                r['opening_stock'] ?? r['system_quantity'] ?? r['quantity'] ?? 0,
              );
              final sales = _toInt(r['sales'] ?? 0);
              final additions = _toInt(r['additions'] ?? 0);
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
                physicalCount:
                    isSubmittedRow ? _toInt(r['physical_quantity']) : null,
                reason: r['notes'] ?? r['reason_for_variance'],
                explanation:
                    r['explanation'] ?? r['notes'] ?? r['reason_for_variance'],
                actionTaken: r['action_taken'],
                category: '${r['category'] ?? r['item']?['category'] ?? 'Other'}',
              );
            })
            .toList();
      }

      // If not submitted, apply local draft values if they exist
      if (!submitted) {
        try {
          final file = await _getDraftFileFor(
            locationFilter: targetLoc,
            dateFilter: targetDate,
          );
          if (!mounted) return;
          if (file.existsSync()) {
            final draftStr = await file.readAsString();
            if (!mounted) return;
            if (draftStr.isNotEmpty) {
              final Map<String, dynamic> draftMap = json.decode(draftStr);
              loadedItems = loadedItems.map((item) {
                if (draftMap.containsKey(item.id)) {
                  final entry = draftMap[item.id] as Map<String, dynamic>;
                  final rawPhysical = entry['physical'];
                  final physical = rawPhysical != null ? (rawPhysical as num).toInt() : null;
                  final reason = entry['reason'] as String?;
                  return item.copyWith(
                    physicalCount: physical,
                    reason: reason,
                  );
                }
                return item;
              }).toList();
            }
          }
        } catch (_) {
          // Corrupt draft file — ignore and continue with server data
        }
      }

      var hasExec = false;
      if (_type == StockTakeType.bar) {
        try {
          final outlets = await repo.posOutlets();
          if (!mounted) return;
          hasExec = outlets.any((outlet) {
            final type =
                '${outlet['outlet_type'] ?? outlet['type'] ?? ''}'.trim();
            return type == 'executive_bar' ||
                type == 'kyogong_executive_bar' ||
                type == 'sports_bar' ||
                type == 'kyogong_sports_bar';
          });
        } catch (_) {
          hasExec = false;
        }
      }

      if (!mounted) return;
      _updateState((current) => current.copyWith(
        items: loadedItems,
        isLoading: false,
        isSubmitted: submitted,
        hasExecutiveBar: hasExec,
        largePct: largeVal,
        extremePct: extremeVal,
      ));
    } catch (e) {
      if (!mounted) return;
      _updateState((current) => current.copyWith(
        isLoading: false,
        errorMessage: 'Failed to load stocktake data: $e',
      ));
    }
  }

  void updatePhysicalCount(String id, int? count) {
    if (!mounted) return;
    if (state.isSubmitted) return;

    _updateState((current) => current.copyWith(
      items: current.items.map((item) {
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
    ));
  }

  void updateReason(String id, String? reason) {
    if (!mounted) return;
    if (state.isSubmitted) return;

    _updateState((current) => current.copyWith(
      items: current.items.map((item) {
        if (item.id == id) {
          return item.copyWith(reason: reason);
        }
        return item;
      }).toList(),
    ));
  }

  void updateSearch(String query) {
    if (!mounted) return;
    _updateState((current) => current.copyWith(search: query));
  }

  void updateCategoryFilter(String category) {
    if (!mounted) return;
    _updateState((current) => current.copyWith(categoryFilter: category));
  }

  Future<void> saveDraft() async {
    if (!mounted) return;
    if (state.isSubmitted) return;
    final snapshot = state;

    final draftMap = <String, Map<String, dynamic>>{};
    for (final item in snapshot.items) {
      if (item.physicalCount != null || item.reason != null) {
        draftMap[item.id] = {
          'physical': item.physicalCount,
          'reason': item.reason,
        };
      }
    }

    try {
      final file = await _getDraftFileFor(
        locationFilter: snapshot.locationFilter,
        dateFilter: snapshot.dateFilter,
      );
      if (draftMap.isEmpty) {
        if (file.existsSync()) await file.delete();
      } else {
        await file.writeAsString(json.encode(draftMap));
      }
    } catch (_) {}
  }

  Future<bool> submitStockTake() async {
    if (!mounted) return false;
    if (state.isSubmitted) return false;
    final snapshot = state;

    // Validation
    final List<String> errors = [];
    final itemsToSubmit = <Map<String, dynamic>>[];

    for (final item in snapshot.items) {
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
      if (!mounted) return false;
      _updateState((current) => current.copyWith(errorMessage: errors.join('\n')));
      return false;
    }

    if (itemsToSubmit.isEmpty) {
      if (!mounted) return false;
      _updateState((current) => current.copyWith(
            errorMessage: 'Please enter at least one count to submit.',
          ));
      return false;
    }

    if (!mounted) return false;
    _updateState(
      (current) => current.copyWith(isSubmitting: true, errorMessage: null),
    );

    try {
      final repo = _ref.read(storeStocktakeRepositoryProvider);

      if (_type == StockTakeType.bar) {
        final shiftId = snapshot.currentShift?['shift_id'] as String?;
        await repo.submitBarStocktake(
          barLocation: snapshot.locationFilter,
          items: itemsToSubmit,
          stocktakeDate: snapshot.dateFilter,
          shiftId: shiftId,
        );
      } else {
        final shiftId = snapshot.currentShift?['shift_id'] as String?;
        await repo.submitStoreStocktake(
          items: itemsToSubmit,
          stocktakeDate: snapshot.dateFilter,
          shiftId: shiftId,
        );
      }
      if (!mounted) return false;

      // Submission succeeded, clear draft file
      try {
        final file = await _getDraftFileFor(
          locationFilter: snapshot.locationFilter,
          dateFilter: snapshot.dateFilter,
        );
        if (file.existsSync()) await file.delete();
      } catch (_) {}

      if (!mounted) return false;
      _updateState(
        (current) => current.copyWith(isSubmitting: false, isSubmitted: true),
      );
      // Reload state from server
      await loadData(
        date: snapshot.dateFilter,
        location: snapshot.locationFilter,
      );
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
      if (!mounted) return false;
      _updateState(
        (current) => current.copyWith(isSubmitting: false, errorMessage: msg),
      );
      return false;
    }
  }

  void clearError() {
    if (!mounted) return;
    _updateState((current) => current.copyWith(errorMessage: null));
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
  ref.keepAlive();
  final notifier = StockTakeNotifier(ref, StockTakeType.bar);
  ref.onDispose(() {
    // Optionally auto-save draft on dispose
    notifier.saveDraft();
  });
  return notifier;
});

final storeStockTakeProvider =
    StateNotifierProvider.autoDispose<StockTakeNotifier, StockTakeState>((ref) {
  ref.keepAlive();
  final notifier = StockTakeNotifier(ref, StockTakeType.store);
  ref.onDispose(() {
    notifier.saveDraft();
  });
  return notifier;
});
