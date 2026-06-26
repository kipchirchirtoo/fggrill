/// Layer 2 — kitchen production vs POS sales for one menu item, for the
/// selected branch/date.
class KitchenVsSalesItem {
  KitchenVsSalesItem({
    required this.itemName,
    required this.producedQty,
    required this.soldQty,
    required this.variance,
    required this.status,
  });

  final String itemName;
  final num producedQty;
  final num soldQty;
  final num variance;
  final String status; // 'overproduction' | 'underproduction' | 'balanced'

  bool get isOverproduction => status == 'overproduction';
  bool get isUnderproduction => status == 'underproduction';

  factory KitchenVsSalesItem.fromJson(Map<String, dynamic> json) {
    num asNum(dynamic v) => v is num ? v : num.tryParse('$v') ?? 0;
    return KitchenVsSalesItem(
      itemName: '${json['item_name'] ?? 'Unknown item'}',
      producedQty: asNum(json['produced_qty']),
      soldQty: asNum(json['sold_qty']),
      variance: asNum(json['variance']),
      status: '${json['status'] ?? 'balanced'}',
    );
  }
}
