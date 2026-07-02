import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../branch_storekeeper/daily_control/models/bom_control_item.dart';
import '../../branch_storekeeper/daily_control/models/daily_control_state.dart';
import '../../branch_storekeeper/daily_control/models/kitchen_vs_sales_item.dart';
import '../../branch_storekeeper/daily_control/models/stock_ledger_item.dart';
import '../../branch_storekeeper/daily_control/models/stock_vs_sales_summary.dart';
import '../data/lina_daily_controls_repository.dart';

String _todayIso() => DateTime.now().toIso8601String().split('T').first;

// ── Briefing model ──────────────────────────────────────────────────────────

class LinaBriefingConcern {
  const LinaBriefingConcern({
    required this.severity,
    required this.title,
    required this.explanation,
    required this.action,
  });

  final String severity; // critical | high | medium | low
  final String title;
  final String explanation;
  final String action;

  factory LinaBriefingConcern.fromJson(Map<String, dynamic> json) {
    return LinaBriefingConcern(
      severity: '${json['severity'] ?? 'low'}',
      title: '${json['title'] ?? ''}',
      explanation: '${json['explanation'] ?? ''}',
      action: '${json['action'] ?? ''}',
    );
  }
}

class LinaDailyBriefing {
  const LinaDailyBriefing({
    required this.headline,
    required this.foodCostAssessment,
    required this.concerns,
    required this.wins,
    required this.dataQualityNotes,
    required this.isAiInterpreted,
    required this.structuralScore,
    required this.generatedAt,
  });

  final String headline;
  final String foodCostAssessment;
  final List<LinaBriefingConcern> concerns;
  final List<String> wins;
  final List<String> dataQualityNotes;
  final bool isAiInterpreted;
  final int structuralScore;
  final DateTime generatedAt;

  factory LinaDailyBriefing.fromJson(Map<String, dynamic> json) {
    final briefing = json['briefing'] is Map
        ? Map<String, dynamic>.from(json['briefing'] as Map)
        : <String, dynamic>{};
    final structural = json['structural_health'] is Map
        ? Map<String, dynamic>.from(json['structural_health'] as Map)
        : <String, dynamic>{};
    return LinaDailyBriefing(
      headline: '${briefing['headline'] ?? ''}',
      foodCostAssessment: '${briefing['food_cost_assessment'] ?? ''}',
      concerns: ((briefing['top_concerns'] as List?) ?? const [])
          .whereType<Map>()
          .map((c) =>
              LinaBriefingConcern.fromJson(Map<String, dynamic>.from(c)))
          .toList(),
      wins: ((briefing['wins'] as List?) ?? const []).map((e) => '$e').toList(),
      dataQualityNotes: ((briefing['data_quality_notes'] as List?) ?? const [])
          .map((e) => '$e')
          .toList(),
      isAiInterpreted: json['is_ai_interpreted'] == true,
      structuralScore: (structural['health_score'] as num?)?.toInt() ?? 0,
      generatedAt:
          DateTime.tryParse('${json['generated_at']}')?.toLocal() ??
              DateTime.now(),
    );
  }
}

// ── State ───────────────────────────────────────────────────────────────────

class LinaDailyControlsState {
  const LinaDailyControlsState({
    required this.date,
    this.shift,
    this.branchId,
    this.isLoading = false,
    this.errorMessage,
    this.briefing,
    this.briefingLoading = false,
    this.briefingError,
    this.stockLedger = const [],
    this.stockLedgerLoading = false,
    this.bomControl = const [],
    this.noRecipeItems = const [],
    this.kitchenVsSales = const [],
    this.parentChildSales = const [],
    required this.stockVsSales,
    required this.summary,
    this.hasKitchenSession = false,
    this.totalIssuedQty = 0,
  });

  final String date;
  final String? shift; // 'A' | 'B' | null (full day)
  final int? branchId; // null = own branch
  final bool isLoading;
  final String? errorMessage;
  final LinaDailyBriefing? briefing;
  final bool briefingLoading;
  final String? briefingError;
  final List<StockLedgerItem> stockLedger;
  final bool stockLedgerLoading;
  final List<BomControlItem> bomControl;
  final List<NoRecipeItem> noRecipeItems;
  final List<KitchenVsSalesItem> kitchenVsSales;
  final List<ParentChildSalesItem> parentChildSales;
  final StockVsSalesSummary stockVsSales;
  final DailyControlSummary summary;
  final bool hasKitchenSession;
  final num totalIssuedQty;

  bool get hasAnyData =>
      bomControl.isNotEmpty ||
      kitchenVsSales.isNotEmpty ||
      summary.totalFoodQtySold > 0;

  factory LinaDailyControlsState.initial(String date, {int? branchId}) =>
      LinaDailyControlsState(
        date: date,
        branchId: branchId,
        stockVsSales: StockVsSalesSummary.empty(),
        summary: DailyControlSummary.empty(),
      );

  LinaDailyControlsState copyWith({
    String? date,
    Object? shift = _unset,
    Object? branchId = _unset,
    bool? isLoading,
    Object? errorMessage = _unset,
    Object? briefing = _unset,
    bool? briefingLoading,
    Object? briefingError = _unset,
    List<StockLedgerItem>? stockLedger,
    bool? stockLedgerLoading,
    List<BomControlItem>? bomControl,
    List<NoRecipeItem>? noRecipeItems,
    List<KitchenVsSalesItem>? kitchenVsSales,
    List<ParentChildSalesItem>? parentChildSales,
    StockVsSalesSummary? stockVsSales,
    DailyControlSummary? summary,
    bool? hasKitchenSession,
    num? totalIssuedQty,
  }) {
    return LinaDailyControlsState(
      date: date ?? this.date,
      shift: identical(shift, _unset) ? this.shift : shift as String?,
      branchId: identical(branchId, _unset) ? this.branchId : branchId as int?,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: identical(errorMessage, _unset)
          ? this.errorMessage
          : errorMessage as String?,
      briefing: identical(briefing, _unset)
          ? this.briefing
          : briefing as LinaDailyBriefing?,
      briefingLoading: briefingLoading ?? this.briefingLoading,
      briefingError: identical(briefingError, _unset)
          ? this.briefingError
          : briefingError as String?,
      stockLedger: stockLedger ?? this.stockLedger,
      stockLedgerLoading: stockLedgerLoading ?? this.stockLedgerLoading,
      bomControl: bomControl ?? this.bomControl,
      noRecipeItems: noRecipeItems ?? this.noRecipeItems,
      kitchenVsSales: kitchenVsSales ?? this.kitchenVsSales,
      parentChildSales: parentChildSales ?? this.parentChildSales,
      stockVsSales: stockVsSales ?? this.stockVsSales,
      summary: summary ?? this.summary,
      hasKitchenSession: hasKitchenSession ?? this.hasKitchenSession,
      totalIssuedQty: totalIssuedQty ?? this.totalIssuedQty,
    );
  }
}

const Object _unset = Object();

// ── Notifier ────────────────────────────────────────────────────────────────

class LinaDailyControlsNotifier
    extends StateNotifier<LinaDailyControlsState> {
  LinaDailyControlsNotifier(this._ref, int? initialBranchId)
      : super(LinaDailyControlsState.initial(_todayIso(),
            branchId: initialBranchId));

  final Ref _ref;
  int _loadGeneration = 0;

  LinaDailyControlsRepository get _repo =>
      _ref.read(linaDailyControlsRepositoryProvider);

  /// Loads the tabs data (fast) and kicks off the Lina briefing (slow, AI)
  /// in parallel without blocking the tabs on it.
  Future<void> loadAll() async {
    final generation = ++_loadGeneration;
    final date = state.date;
    final shift = state.shift;
    final branchId = state.branchId;

    state = state.copyWith(isLoading: true, errorMessage: null);
    unawaited(_loadStockLedger(generation, date, shift, branchId));
    unawaited(loadBriefing());

    try {
      final json = await _repo.dailyControlData(
          branchId: branchId, date: date, shift: shift);
      if (!mounted || generation != _loadGeneration) return;

      final bomControlRaw = json['bom_control'];
      final noRecipeRaw = json['no_recipe_items'];
      final kitchenVsSalesRaw = json['kitchen_vs_sales'];
      final parentChildSalesRaw = json['parent_child_sales'];
      final issueSummaryRaw = json['kitchen_issue_summary'];

      state = state.copyWith(
        isLoading: false,
        hasKitchenSession: json['has_kitchen_session'] == true,
        totalIssuedQty: issueSummaryRaw is Map
            ? (num.tryParse('${issueSummaryRaw['total_issued_qty']}') ?? 0)
            : 0,
        bomControl: bomControlRaw is List
            ? bomControlRaw
                .whereType<Map>()
                .map((e) =>
                    BomControlItem.fromJson(Map<String, dynamic>.from(e)))
                .toList()
            : <BomControlItem>[],
        noRecipeItems: noRecipeRaw is List
            ? noRecipeRaw
                .whereType<Map>()
                .map(
                    (e) => NoRecipeItem.fromJson(Map<String, dynamic>.from(e)))
                .toList()
            : <NoRecipeItem>[],
        kitchenVsSales: kitchenVsSalesRaw is List
            ? kitchenVsSalesRaw
                .whereType<Map>()
                .map((e) =>
                    KitchenVsSalesItem.fromJson(Map<String, dynamic>.from(e)))
                .toList()
            : <KitchenVsSalesItem>[],
        parentChildSales: parentChildSalesRaw is List
            ? parentChildSalesRaw
                .whereType<Map>()
                .map((e) =>
                    ParentChildSalesItem.fromJson(Map<String, dynamic>.from(e)))
                .toList()
            : <ParentChildSalesItem>[],
        stockVsSales: json['stock_vs_sales'] is Map
            ? StockVsSalesSummary.fromJson(
                Map<String, dynamic>.from(json['stock_vs_sales'] as Map))
            : StockVsSalesSummary.empty(),
        summary: json['summary'] is Map
            ? DailyControlSummary.fromJson(
                Map<String, dynamic>.from(json['summary'] as Map))
            : DailyControlSummary.empty(),
      );
    } catch (e) {
      if (!mounted || generation != _loadGeneration) return;
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Failed to load daily control data: $e',
      );
    }
  }

  Future<void> _loadStockLedger(
      int generation, String date, String? shift, int? branchId) async {
    if (!mounted) return;
    state = state.copyWith(stockLedgerLoading: true);
    try {
      final rows = await _repo.stockLedger(
          branchId: branchId, date: date, shift: shift);
      if (!mounted || generation != _loadGeneration) return;
      state = state.copyWith(
        stockLedger: rows.map((r) => StockLedgerItem.fromJson(r)).toList(),
        stockLedgerLoading: false,
      );
    } catch (_) {
      if (!mounted || generation != _loadGeneration) return;
      state = state.copyWith(stockLedgerLoading: false);
    }
  }

  Future<void> loadBriefing({bool force = false}) async {
    final generation = _loadGeneration;
    if (!mounted) return;
    state = state.copyWith(briefingLoading: true, briefingError: null);
    try {
      final json = await _repo.briefing(
        branchId: state.branchId,
        date: state.date,
        shift: state.shift,
        forceRefresh: force,
      );
      if (!mounted || generation != _loadGeneration) return;
      state = state.copyWith(
        briefing: LinaDailyBriefing.fromJson(json),
        briefingLoading: false,
      );
    } catch (e) {
      if (!mounted || generation != _loadGeneration) return;
      state = state.copyWith(
        briefingLoading: false,
        briefingError: 'Lina briefing unavailable: $e',
      );
    }
  }

  void changeDate(String date) {
    if (date == state.date) return;
    state = state.copyWith(date: date, briefing: null);
    loadAll();
  }

  void changeShift(String? shift) {
    if (shift == state.shift) return;
    state = state.copyWith(shift: shift, briefing: null);
    loadAll();
  }

  void changeBranch(int? branchId) {
    if (branchId == state.branchId) return;
    state = state.copyWith(branchId: branchId, briefing: null);
    loadAll();
  }

  Future<void> refresh() {
    unawaited(loadBriefing(force: true));
    return loadAll();
  }
}

/// Family key: true = central mode (superadmin — branch chosen in the page),
/// false = the signed-in user's own branch (branch accountant).
final linaDailyControlsProvider = StateNotifierProvider.autoDispose
    .family<LinaDailyControlsNotifier, LinaDailyControlsState, bool>(
  (ref, centralMode) => LinaDailyControlsNotifier(ref, null),
);

// ── Parent & Child Sales Models ─────────────────────────────────────────────

class ParentChildSalesItem {
  const ParentChildSalesItem({
    required this.parentSku,
    required this.parentName,
    required this.children,
    required this.totalRawSold,
  });

  final String parentSku;
  final String parentName;
  final List<ChildSalesItem> children;
  final double totalRawSold;

  factory ParentChildSalesItem.fromJson(Map<String, dynamic> json) {
    return ParentChildSalesItem(
      parentSku: '${json['parent_sku'] ?? ''}',
      parentName: '${json['parent_name'] ?? ''}',
      children: ((json['children'] as List?) ?? const [])
          .whereType<Map>()
          .map((c) => ChildSalesItem.fromJson(Map<String, dynamic>.from(c)))
          .toList(),
      totalRawSold: (json['total_raw_sold'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class ChildSalesItem {
  const ChildSalesItem({
    required this.childName,
    required this.soldQty,
    required this.rawQtyUsed,
    required this.unit,
    required this.rawUnit,
  });

  final String childName;
  final double soldQty;
  final double rawQtyUsed;
  final String unit;
  final String rawUnit;

  factory ChildSalesItem.fromJson(Map<String, dynamic> json) {
    return ChildSalesItem(
      childName: '${json['child_name'] ?? ''}',
      soldQty: (json['sold_qty'] as num?)?.toDouble() ?? 0.0,
      rawQtyUsed: (json['raw_qty_used'] as num?)?.toDouble() ?? 0.0,
      unit: '${json['unit'] ?? ''}',
      rawUnit: '${json['raw_unit'] ?? ''}',
    );
  }
}
