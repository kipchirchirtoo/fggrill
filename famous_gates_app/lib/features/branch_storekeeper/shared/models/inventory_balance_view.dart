class InventoryBalanceView {
  const InventoryBalanceView({
    required this.itemSku,
    required this.itemName,
    required this.currentQuantity,
    required this.availableQuantity,
    this.reservedQuantity = 0,
  });

  final String itemSku;
  final String itemName;
  final num currentQuantity;
  final num availableQuantity;
  final num reservedQuantity;

  factory InventoryBalanceView.fromMap(Map<String, dynamic> map) {
    num asNum(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;
    return InventoryBalanceView(
      itemSku: '${map['item_sku'] ?? map['sku'] ?? ''}',
      itemName: '${map['item_name'] ?? map['name'] ?? map['sku'] ?? ''}',
      currentQuantity: asNum(map['current_quantity'] ?? map['quantity']),
      availableQuantity: asNum(map['available_quantity'] ?? map['quantity']),
      reservedQuantity: asNum(map['reserved_quantity']),
    );
  }
}
