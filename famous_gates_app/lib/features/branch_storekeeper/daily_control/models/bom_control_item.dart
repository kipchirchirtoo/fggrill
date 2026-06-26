/// Layer 1 — theoretical (BOM-based) vs actual ingredient consumption for
/// one raw ingredient SKU, for the selected branch/date.
class BomControlItem {
  BomControlItem({
    required this.itemSku,
    required this.itemName,
    required this.unit,
    required this.theoreticalQty,
    required this.actualQty,
    required this.unitCost,
    required this.hasCost,
    required this.theoreticalCost,
    required this.actualCost,
    required this.varianceQty,
    required this.varianceCost,
    required this.variancePercent,
    required this.flag,
  });

  final String itemSku;
  final String itemName;
  final String unit;
  final num theoreticalQty;
  final num actualQty;
  final num unitCost;
  final bool hasCost;
  final num theoreticalCost;
  final num actualCost;
  final num varianceQty;
  final num varianceCost;
  final num? variancePercent;
  final String flag; // 'green' | 'orange' | 'red'

  factory BomControlItem.fromJson(Map<String, dynamic> json) {
    num asNum(dynamic v) => v is num ? v : num.tryParse('$v') ?? 0;
    return BomControlItem(
      itemSku: '${json['item_sku'] ?? ''}',
      itemName: '${json['item_name'] ?? json['item_sku'] ?? 'Unknown item'}',
      unit: '${json['unit'] ?? ''}',
      theoreticalQty: asNum(json['theoretical_qty']),
      actualQty: asNum(json['actual_qty']),
      unitCost: asNum(json['unit_cost']),
      hasCost: json['has_cost'] == true,
      theoreticalCost: asNum(json['theoretical_cost']),
      actualCost: asNum(json['actual_cost']),
      varianceQty: asNum(json['variance_qty']),
      varianceCost: asNum(json['variance_cost']),
      variancePercent:
          json['variance_percent'] == null ? null : asNum(json['variance_percent']),
      flag: '${json['flag'] ?? 'green'}',
    );
  }
}

/// A sold menu item that has no matching recipe/BOM registered — flagged
/// rather than silently dropped or crashing the BOM tab.
class NoRecipeItem {
  NoRecipeItem({required this.itemName, required this.qtySold});

  final String itemName;
  final num qtySold;

  factory NoRecipeItem.fromJson(Map<String, dynamic> json) {
    num asNum(dynamic v) => v is num ? v : num.tryParse('$v') ?? 0;
    return NoRecipeItem(
      itemName: '${json['item_name'] ?? 'Unknown item'}',
      qtySold: asNum(json['qty_sold']),
    );
  }
}
