/// One row of the physical stock ledger — matches the storekeeper's paper
/// ledger columns exactly: Opening | Added | Totals | Closing | Rejects |
/// Quantity Sold | System Sold | Shorts. Closing Stock is the only manually
/// entered number anywhere upstream (physical count at shift handover);
/// everything else is read off kitchen_shift_items. See GET
/// /kitchen/daily-control/stock-ledger.
class StockLedgerItem {
  StockLedgerItem({
    required this.itemSku,
    required this.itemName,
    required this.unit,
    required this.openingStock,
    required this.addedStock,
    required this.totals,
    required this.closingStock,
    required this.rejects,
    required this.quantitySold,
    required this.systemSold,
    required this.shorts,
    required this.dataQuality,
  });

  final String itemSku;
  final String itemName;
  final String unit;
  final num openingStock;
  final num addedStock;
  final num totals;

  /// Null until the shift has been physically closed (manual count entered
  /// at handover) — see [dataQuality] == 'PENDING_HANDOVER'.
  final num? closingStock;
  final num rejects;

  /// Derived: totals - closingStock - rejects. Null while closingStock is.
  final num? quantitySold;
  final num systemSold;

  /// Derived: quantitySold - systemSold. Positive = stock left the store
  /// with no matching recorded sale (leakage signal). Null while
  /// quantitySold is. Null until physically closed.
  final num? shorts;

  /// 'OK' | 'PENDING_HANDOVER' | 'NO_MOVEMENT'.
  final String dataQuality;

  factory StockLedgerItem.fromJson(Map<String, dynamic> json) {
    num asNum(dynamic v) => v is num ? v : num.tryParse('$v') ?? 0;
    num? asNumOrNull(dynamic v) => v == null ? null : asNum(v);
    return StockLedgerItem(
      itemSku: '${json['item_sku'] ?? ''}',
      itemName: '${json['item_name'] ?? json['item_sku'] ?? ''}',
      unit: '${json['unit'] ?? ''}',
      openingStock: asNum(json['opening_stock']),
      addedStock: asNum(json['added_stock']),
      totals: asNum(json['totals']),
      closingStock: asNumOrNull(json['closing_stock']),
      rejects: asNum(json['rejects']),
      quantitySold: asNumOrNull(json['quantity_sold']),
      systemSold: asNum(json['system_sold']),
      shorts: asNumOrNull(json['shorts']),
      dataQuality: '${json['data_quality'] ?? 'OK'}',
    );
  }
}
