class KitchenOrder {
  final String id;
  final String orderNumber;
  final String orderType;
  final int? tableNumber;
  final String? waiterName;
  final String status;
  final double total;
  final List<KitchenOrderItem> items;
  final DateTime createdAt;
  final DateTime? bumpedAt;

  const KitchenOrder({
    required this.id,
    this.orderNumber = '',
    this.orderType = 'dine_in',
    this.tableNumber,
    this.waiterName,
    this.status = 'pending',
    this.total = 0,
    this.items = const [],
    required this.createdAt,
    this.bumpedAt,
  });

  factory KitchenOrder.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List? ?? [];
    return KitchenOrder(
      id: '${json['id']}',
      orderNumber:
          '${json['order_number'] ?? json['orderNumber'] ?? json['id']}',
      orderType: '${json['order_type'] ?? 'dine_in'}',
      tableNumber:
          int.tryParse('${json['table_number'] ?? json['table'] ?? ''}') ??
              (json['table_number'] as num?)?.toInt(),
      waiterName: json['waiter_name'] as String?,
      status: '${json['status'] ?? 'pending'}',
      total: (json['total'] as num?)?.toDouble() ?? 0,
      items: rawItems
          .whereType<Map<String, dynamic>>()
          .cast<Map<String, dynamic>>()
          .map((item) => KitchenOrderItem.fromJson(item))
          .toList(),
      createdAt:
          DateTime.tryParse('${json['created_at'] ?? json['createdAt']}') ??
              DateTime.now(),
      bumpedAt: DateTime.tryParse('${json['bumped_at'] ?? ''}'),
    );
  }

  String get locationLabel {
    if (tableNumber != null) return 'Table $tableNumber';
    if (orderType == 'room_service') return 'Room Service';
    if (orderType == 'takeaway') return 'Takeaway';
    return orderType.replaceAll('_', ' ');
  }

  Duration get elapsed => DateTime.now().difference(createdAt);
  bool get isUrgent => elapsed.inMinutes > 15;
}

class KitchenOrderItem {
  final String id;
  final String name;
  final int quantity;
  final String? notes;
  final bool isReady;

  const KitchenOrderItem({
    required this.id,
    required this.name,
    this.quantity = 1,
    this.notes,
    this.isReady = false,
  });

  factory KitchenOrderItem.fromJson(Map<String, dynamic> json) {
    return KitchenOrderItem(
      id: '${json['id'] ?? json['item_id']}',
      name:
          '${json['name'] ?? json['item_name'] ?? json['menu_item_name'] ?? ''}',
      quantity: (json['quantity'] as num?)?.toInt() ??
          (json['qty'] as num?)?.toInt() ??
          1,
      notes: (json['notes'] ?? json['special_instructions']) as String?,
      isReady: json['is_ready'] == true ||
          json['isReady'] == true ||
          '${json['status'] ?? ''}'.toLowerCase() == 'ready',
    );
  }
}
