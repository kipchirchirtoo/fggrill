import 'bom_control_item.dart';
import 'kitchen_vs_sales_item.dart';
import 'stock_vs_sales_summary.dart';

/// Layer 4 — the unified daily summary dashboard.
class DailyControlSummary {
  DailyControlSummary({
    required this.totalFoodQtySold,
    required this.totalFoodRevenue,
    required this.theoreticalIngredientCost,
    required this.actualIngredientCost,
    required this.bomVarianceCost,
    required this.bomVariancePercent,
    required this.foodCostPercent,
    required this.targetFoodCostPercent,
    required this.topVarianceItems,
  });

  final num totalFoodQtySold;
  final num totalFoodRevenue;
  final num theoreticalIngredientCost;
  final num actualIngredientCost;
  final num bomVarianceCost;
  final num? bomVariancePercent;
  final num? foodCostPercent;
  final num targetFoodCostPercent;
  final List<BomControlItem> topVarianceItems;

  factory DailyControlSummary.fromJson(Map<String, dynamic> json) {
    num asNum(dynamic v) => v is num ? v : num.tryParse('$v') ?? 0;
    final topRaw = json['top_variance_items'];
    return DailyControlSummary(
      totalFoodQtySold: asNum(json['total_food_qty_sold']),
      totalFoodRevenue: asNum(json['total_food_revenue']),
      theoreticalIngredientCost: asNum(json['theoretical_ingredient_cost']),
      actualIngredientCost: asNum(json['actual_ingredient_cost']),
      bomVarianceCost: asNum(json['bom_variance_cost']),
      bomVariancePercent:
          json['bom_variance_percent'] == null ? null : asNum(json['bom_variance_percent']),
      foodCostPercent:
          json['food_cost_percent'] == null ? null : asNum(json['food_cost_percent']),
      targetFoodCostPercent: asNum(json['target_food_cost_percent']),
      topVarianceItems: topRaw is List
          ? topRaw
              .whereType<Map>()
              .map((e) => BomControlItem.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : <BomControlItem>[],
    );
  }

  factory DailyControlSummary.empty() => DailyControlSummary(
        totalFoodQtySold: 0,
        totalFoodRevenue: 0,
        theoreticalIngredientCost: 0,
        actualIngredientCost: 0,
        bomVarianceCost: 0,
        bomVariancePercent: null,
        foodCostPercent: null,
        targetFoodCostPercent: 30,
        topVarianceItems: const [],
      );
}

class DailyControlState {
  DailyControlState({
    required this.isLoading,
    this.errorMessage,
    required this.date,
    required this.shift,
    required this.bomControl,
    required this.noRecipeItems,
    required this.kitchenVsSales,
    required this.stockVsSales,
    required this.summary,
    required this.hasKitchenSession,
  });

  final bool isLoading;
  final String? errorMessage;
  final String date;

  /// Active shift filter: 'A', 'B', or null (full day).
  final String? shift;

  /// Whether at least one kitchen production session exists for this
  /// branch/date/shift. False means the BOM actual column is sourced
  /// from stock_history fallback and the UI should show a warning.
  final bool hasKitchenSession;

  final List<BomControlItem> bomControl;
  final List<NoRecipeItem> noRecipeItems;
  final List<KitchenVsSalesItem> kitchenVsSales;
  final StockVsSalesSummary stockVsSales;
  final DailyControlSummary summary;

  bool get hasAnyData =>
      bomControl.isNotEmpty || kitchenVsSales.isNotEmpty || summary.totalFoodQtySold > 0;

  factory DailyControlState.initial(String date) => DailyControlState(
        isLoading: false,
        date: date,
        shift: null,
        hasKitchenSession: false,
        bomControl: const [],
        noRecipeItems: const [],
        kitchenVsSales: const [],
        stockVsSales: StockVsSalesSummary.empty(),
        summary: DailyControlSummary.empty(),
      );

  DailyControlState copyWith({
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
    String? date,
    Object? shift = _unset,
    bool? hasKitchenSession,
    List<BomControlItem>? bomControl,
    List<NoRecipeItem>? noRecipeItems,
    List<KitchenVsSalesItem>? kitchenVsSales,
    StockVsSalesSummary? stockVsSales,
    DailyControlSummary? summary,
  }) {
    return DailyControlState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      date: date ?? this.date,
      shift: identical(shift, _unset) ? this.shift : shift as String?,
      hasKitchenSession: hasKitchenSession ?? this.hasKitchenSession,
      bomControl: bomControl ?? this.bomControl,
      noRecipeItems: noRecipeItems ?? this.noRecipeItems,
      kitchenVsSales: kitchenVsSales ?? this.kitchenVsSales,
      stockVsSales: stockVsSales ?? this.stockVsSales,
      summary: summary ?? this.summary,
    );
  }
}

/// Sentinel used to distinguish "not passed" from explicit null in copyWith.
const Object _unset = Object();
