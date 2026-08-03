class InventoryReservationView {
  const InventoryReservationView({
    required this.id,
    required this.itemSku,
    required this.quantity,
    required this.status,
  });

  final String id;
  final String itemSku;
  final num quantity;
  final String status;

  factory InventoryReservationView.fromMap(Map<String, dynamic> map) {
    num asNum(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;
    return InventoryReservationView(
      id: '${map['id'] ?? ''}',
      itemSku: '${map['item_sku'] ?? map['sku'] ?? ''}',
      quantity: asNum(map['quantity']),
      status: '${map['status'] ?? ''}',
    );
  }
}
