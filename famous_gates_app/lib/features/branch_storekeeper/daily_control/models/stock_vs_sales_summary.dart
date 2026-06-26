/// Layer 3 — cost of stock issued to the kitchen vs food revenue, for the
/// selected branch/date.
class StockVsSalesSummary {
  StockVsSalesSummary({
    required this.stockIssuedCost,
    required this.foodRevenue,
    required this.foodCostPercent,
    required this.targetPercent,
    required this.exceedsTarget,
  });

  final num stockIssuedCost;
  final num foodRevenue;
  final num? foodCostPercent; // null when foodRevenue is 0 — show "N/A"
  final num targetPercent;
  final bool exceedsTarget;

  factory StockVsSalesSummary.fromJson(Map<String, dynamic> json) {
    num asNum(dynamic v) => v is num ? v : num.tryParse('$v') ?? 0;
    return StockVsSalesSummary(
      stockIssuedCost: asNum(json['stock_issued_cost']),
      foodRevenue: asNum(json['food_revenue']),
      foodCostPercent:
          json['food_cost_percent'] == null ? null : asNum(json['food_cost_percent']),
      targetPercent: asNum(json['target_percent']),
      exceedsTarget: json['exceeds_target'] == true,
    );
  }

  factory StockVsSalesSummary.empty() => StockVsSalesSummary(
        stockIssuedCost: 0,
        foodRevenue: 0,
        foodCostPercent: null,
        targetPercent: 30,
        exceedsTarget: false,
      );
}
