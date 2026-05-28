import 'package:freezed_annotation/freezed_annotation.dart';
part 'inventory_item.freezed.dart';

double _doubleValue(dynamic value) {
  if (value is num) return value.toDouble();
  return double.tryParse('$value') ?? 0;
}

int _intValue(dynamic value) {
  if (value is num) return value.toInt();
  return int.tryParse('$value') ?? 0;
}

@freezed
class InventoryItem with _$InventoryItem {
  const factory InventoryItem({
    @Default('') String id,
    @Default('') String name,
    @Default('') String sku,
    @Default('') String category,
    @Default('') String unit,
    @Default(0.0) double quantity,
    @Default(0) int reorderLevel,
    @Default('') String status,
    @Default('') String supplierId,
    @Default('') String supplierName,
    @Default('') String branchId,
    @Default(0.0) double unitCost,
    @Default(0.0) double totalValue,
  }) = _InventoryItem;

  factory InventoryItem.fromJson(Map<String, dynamic> json) {
    final quantity = _doubleValue(json['quantity'] ??
        json['current_stock'] ??
        json['stock_quantity'] ??
        json['currentStock']);
    final unitCost = _doubleValue(
        json['unitCost'] ?? json['unit_cost'] ?? json['cost_price']);
    final reorderLevel = _intValue(json['reorderLevel'] ??
        json['reorder_level'] ??
        json['min_stock_level'] ??
        json['minStock']);

    return InventoryItem(
      id: '${json['id'] ?? json['sku'] ?? json['item_code'] ?? ''}',
      name:
          '${json['name'] ?? json['item_name'] ?? json['description'] ?? ''}',
      sku: '${json['sku'] ?? json['item_code'] ?? json['code'] ?? ''}',
      category: '${json['category'] ?? ''}',
      unit: '${json['unit'] ?? json['unit_of_measure'] ?? 'units'}',
      quantity: quantity,
      reorderLevel: reorderLevel,
      status: '${json['status'] ?? ''}',
      supplierId: '${json['supplierId'] ?? json['supplier_id'] ?? ''}',
      supplierName:
          '${json['supplierName'] ?? json['supplier_name'] ?? json['supplier'] ?? ''}',
      branchId: '${json['branchId'] ?? json['branch_id'] ?? ''}',
      unitCost: unitCost,
      totalValue: _doubleValue(json['totalValue']) == 0
          ? quantity * unitCost
          : _doubleValue(json['totalValue']),
    );
  }
}
