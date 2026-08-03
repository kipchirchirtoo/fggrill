class InventoryDocumentLine {
  const InventoryDocumentLine({
    required this.itemSku,
    required this.quantity,
    this.movementId,
    this.previousSourceQuantity,
    this.newSourceQuantity,
    this.previousDestinationQuantity,
    this.newDestinationQuantity,
  });

  final String itemSku;
  final num quantity;
  final String? movementId;
  final num? previousSourceQuantity;
  final num? newSourceQuantity;
  final num? previousDestinationQuantity;
  final num? newDestinationQuantity;

  factory InventoryDocumentLine.fromMap(Map<String, dynamic> map) {
    num? asNum(dynamic value) => value is num ? value : num.tryParse('$value');
    return InventoryDocumentLine(
      itemSku: '${map['item_sku'] ?? map['sku'] ?? ''}',
      quantity: asNum(map['quantity']) ?? 0,
      movementId: map['movement_id']?.toString(),
      previousSourceQuantity: asNum(map['previous_source_quantity']),
      newSourceQuantity: asNum(map['new_source_quantity']),
      previousDestinationQuantity: asNum(map['previous_destination_quantity']),
      newDestinationQuantity: asNum(map['new_destination_quantity']),
    );
  }
}
