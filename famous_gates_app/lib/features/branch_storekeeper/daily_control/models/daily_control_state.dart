import 'bom_control_item.dart';
import 'kitchen_vs_sales_item.dart';
import 'stock_ledger_item.dart';
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
    this.totalIssuedQty = 0,
    this.stockLedger = const [],
    this.stockLedgerLoading = false,
    this.snapshot,
    this.snapshotLoading = false,
  });

  final bool isLoading;
  final String? errorMessage;
  final String date;

  /// The previous CLOSED commercial day's frozen Daily Controls payload
  /// (daily_control_snapshots, via GET /kitchen/daily-control/snapshot) —
  /// null until loaded, or if this branch has no closed commercial day yet.
  /// Everything else on this page (bomControl, kitchenVsSales, etc. below)
  /// is always a live/provisional recomputation for whatever date/shift is
  /// selected — the two must never be merged into one view.
  final Map<String, dynamic>? snapshot;
  final bool snapshotLoading;

  /// Active shift filter: 'A', 'B', or null (full day).
  final String? shift;

  /// Whether at least one kitchen production session exists for this
  /// branch/date/shift. False means the BOM actual column is sourced
  /// from stock_history fallback and the UI should show a warning.
  final bool hasKitchenSession;

  /// Sum of all real, confirmed ingredient usage found across every actual-
  /// usage source (kitchen_shift_items.sold_quantity, kitchen_session_issues,
  /// kitchen_usage_records). Can be 0 even when [hasKitchenSession] is true —
  /// that means a kitchen shift was opened but no production yield has been
  /// confirmed yet, so every "Actual" figure below is genuinely unrecorded,
  /// not a confirmed zero.
  final num totalIssuedQty;

  final List<BomControlItem> bomControl;
  final List<NoRecipeItem> noRecipeItems;
  final List<KitchenVsSalesItem> kitchenVsSales;
  final StockVsSalesSummary stockVsSales;
  final DailyControlSummary summary;

  /// The physical stock ledger (paper-ledger-shaped) view — independent of
  /// bomControl above, which is the recipe-theoretical check. Loaded
  /// separately since it's sourced from kitchen_shift_items, not POS sales.
  final List<StockLedgerItem> stockLedger;
  final bool stockLedgerLoading;

  bool get hasAnyData =>
      bomControl.isNotEmpty || kitchenVsSales.isNotEmpty || summary.totalFoodQtySold > 0;

  factory DailyControlState.initial(String date) => DailyControlState(
        isLoading: false,
        date: date,
        shift: null,
        hasKitchenSession: false,
        totalIssuedQty: 0,
        bomControl: const [],
        noRecipeItems: const [],
        kitchenVsSales: const [],
        stockVsSales: StockVsSalesSummary.empty(),
        summary: DailyControlSummary.empty(),
        stockLedger: const [],
        stockLedgerLoading: false,
      );

  DailyControlState copyWith({
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
    String? date,
    Object? shift = _unset,
    bool? hasKitchenSession,
    num? totalIssuedQty,
    List<BomControlItem>? bomControl,
    List<NoRecipeItem>? noRecipeItems,
    List<KitchenVsSalesItem>? kitchenVsSales,
    StockVsSalesSummary? stockVsSales,
    DailyControlSummary? summary,
    List<StockLedgerItem>? stockLedger,
    bool? stockLedgerLoading,
    Object? snapshot = _unset,
    bool? snapshotLoading,
  }) {
    return DailyControlState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      date: date ?? this.date,
      shift: identical(shift, _unset) ? this.shift : shift as String?,
      hasKitchenSession: hasKitchenSession ?? this.hasKitchenSession,
      totalIssuedQty: totalIssuedQty ?? this.totalIssuedQty,
      bomControl: bomControl ?? this.bomControl,
      noRecipeItems: noRecipeItems ?? this.noRecipeItems,
      kitchenVsSales: kitchenVsSales ?? this.kitchenVsSales,
      stockVsSales: stockVsSales ?? this.stockVsSales,
      summary: summary ?? this.summary,
      stockLedger: stockLedger ?? this.stockLedger,
      stockLedgerLoading: stockLedgerLoading ?? this.stockLedgerLoading,
      snapshot: identical(snapshot, _unset)
          ? this.snapshot
          : snapshot as Map<String, dynamic>?,
      snapshotLoading: snapshotLoading ?? this.snapshotLoading,
    );
  }
}

/// Sentinel used to distinguish "not passed" from explicit null in copyWith.
const Object _unset = Object();
