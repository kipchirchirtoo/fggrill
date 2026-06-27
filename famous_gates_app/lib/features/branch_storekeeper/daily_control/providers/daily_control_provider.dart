import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/branch_storekeeper_repository.dart';
import '../models/bom_control_item.dart';
import '../models/daily_control_state.dart';
import '../models/kitchen_vs_sales_item.dart';
import '../models/stock_vs_sales_summary.dart';

String _todayIso() => DateTime.now().toIso8601String().split('T').first;

/// Sentinel used to distinguish "not passed" from explicit null in loadAll.
const Object _unset = Object();

class DailyControlNotifier extends StateNotifier<DailyControlState> {
  DailyControlNotifier(this._ref) : super(DailyControlState.initial(_todayIso()));

  final Ref _ref;

  /// Single round trip that feeds all four control layers.
  /// [shift] is 'A', 'B', or null (full day).
  Future<void> loadAll({String? date, Object? shift = _unset}) async {
    final targetDate = date ?? state.date;
    final targetShift = identical(shift, _unset) ? state.shift : shift as String?;

    state = state.copyWith(
      isLoading: true,
      clearError: true,
      date: targetDate,
      shift: targetShift,
    );
    try {
      final repo = _ref.read(branchStorekeeperRepositoryProvider);
      final json = await repo.dailyControlData(date: targetDate, shift: targetShift);

      final bomControlRaw = json['bom_control'];
      final bomControl = bomControlRaw is List
          ? bomControlRaw
              .whereType<Map>()
              .map((e) => BomControlItem.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : <BomControlItem>[];

      final noRecipeRaw = json['no_recipe_items'];
      final noRecipeItems = noRecipeRaw is List
          ? noRecipeRaw
              .whereType<Map>()
              .map((e) => NoRecipeItem.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : <NoRecipeItem>[];

      final kitchenVsSalesRaw = json['kitchen_vs_sales'];
      final kitchenVsSales = kitchenVsSalesRaw is List
          ? kitchenVsSalesRaw
              .whereType<Map>()
              .map((e) => KitchenVsSalesItem.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : <KitchenVsSalesItem>[];

      final stockVsSales = json['stock_vs_sales'] is Map
          ? StockVsSalesSummary.fromJson(
              Map<String, dynamic>.from(json['stock_vs_sales'] as Map))
          : StockVsSalesSummary.empty();

      final summary = json['summary'] is Map
          ? DailyControlSummary.fromJson(Map<String, dynamic>.from(json['summary'] as Map))
          : DailyControlSummary.empty();

      final hasKitchenSession = json['has_kitchen_session'] == true;

      state = state.copyWith(
        isLoading: false,
        hasKitchenSession: hasKitchenSession,
        bomControl: bomControl,
        noRecipeItems: noRecipeItems,
        kitchenVsSales: kitchenVsSales,
        stockVsSales: stockVsSales,
        summary: summary,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Failed to load daily control data: $e',
      );
    }
  }

  Future<void> fetchBOMControlData() => loadAll(date: state.date);
  Future<void> fetchKitchenVsSales() => loadAll(date: state.date);
  Future<void> fetchStockVsSales() => loadAll(date: state.date);

  num? calculateFoodCostPercent() => state.stockVsSales.foodCostPercent;

  List<BomControlItem> getTopVarianceItems({int limit = 5}) {
    final sorted = [...state.bomControl]
      ..sort((a, b) => b.varianceCost.abs().compareTo(a.varianceCost.abs()));
    return sorted.take(limit).toList();
  }

  void changeDate(String date) {
    if (date == state.date) return;
    loadAll(date: date);
  }

  void changeShift(String? shift) {
    if (shift == state.shift) return;
    loadAll(shift: shift);
  }

  Future<void> refresh() => loadAll(date: state.date, shift: state.shift);

  List<Map<String, dynamic>> rowsForExport(int tabIndex) {
    switch (tabIndex) {
      case 0:
        return state.bomControl
            .map((i) => {
                  'item_sku': i.itemSku,
                  'item_name': i.itemName,
                  'unit': i.unit,
                  'theoretical_qty': i.theoreticalQty,
                  'actual_qty': i.actualQty,
                  'variance_qty': i.varianceQty,
                  'theoretical_cost': i.theoreticalCost,
                  'actual_cost': i.actualCost,
                  'variance_cost': i.varianceCost,
                  'variance_percent': i.variancePercent ?? '',
                  'variance_type': i.varianceType,
                  'flag': i.flag,
                })
            .toList();
      case 1:
        return state.kitchenVsSales
            .map((i) => {
                  'item_name': i.itemName,
                  'produced_qty': i.producedQty,
                  'sold_qty': i.soldQty,
                  'variance': i.variance,
                  'status': i.status,
                })
            .toList();
      case 2:
        return [
          {
            'stock_issued_cost': state.stockVsSales.stockIssuedCost,
            'food_revenue': state.stockVsSales.foodRevenue,
            'food_cost_percent': state.stockVsSales.foodCostPercent ?? 'N/A',
            'target_percent': state.stockVsSales.targetPercent,
            'exceeds_target': state.stockVsSales.exceedsTarget,
          }
        ];
      default:
        return [
          {
            'total_food_qty_sold': state.summary.totalFoodQtySold,
            'total_food_revenue': state.summary.totalFoodRevenue,
            'theoretical_ingredient_cost': state.summary.theoreticalIngredientCost,
            'actual_ingredient_cost': state.summary.actualIngredientCost,
            'bom_variance_cost': state.summary.bomVarianceCost,
            'bom_variance_percent': state.summary.bomVariancePercent ?? 'N/A',
            'food_cost_percent': state.summary.foodCostPercent ?? 'N/A',
            'target_food_cost_percent': state.summary.targetFoodCostPercent,
          }
        ];
    }
  }

  Future<String> exportToCSV(int tabIndex, {required String tabName}) async {
    final repo = _ref.read(branchStorekeeperRepositoryProvider);
    final rows = rowsForExport(tabIndex);
    if (rows.isEmpty) {
      throw StateError('No data to export for $tabName');
    }
    final file = await repo.exportRowsToCsv(
      name: 'daily_control_${tabName}_${state.date}',
      rows: rows,
    );
    return file.path;
  }
}

final dailyControlProvider =
    StateNotifierProvider.autoDispose<DailyControlNotifier, DailyControlState>(
  (ref) => DailyControlNotifier(ref),
);
