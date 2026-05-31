class KitchenOrder {
  final String id;
  final String orderNumber;
  final String orderType;
  final int? tableNumber;
  final String? waiterName;
  final String? customerName;
  final String? shortCode;
  final String? source;
  final String? paymentStatus;
  final String? voidRequestStatus;
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
    this.customerName,
    this.shortCode,
    this.source,
    this.paymentStatus,
    this.voidRequestStatus,
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
      tableNumber: _intValue(json['table_number'] ?? json['table']),
      waiterName: _optionalString(json['waiter_name']),
      customerName: _optionalString(json['customer_name']),
      shortCode: json['short_code'] == null ? null : '${json['short_code']}',
      source: json['source'] == null ? null : '${json['source']}',
      paymentStatus:
          json['payment_status'] == null ? null : '${json['payment_status']}',
      voidRequestStatus: json['void_request_status'] == null
          ? null
          : '${json['void_request_status']}',
      status: '${json['status'] ?? 'pending'}',
      total: _doubleValue(json['total'] ?? json['total_amount']),
      items: rawItems
          .whereType<Map>()
          .map((item) =>
              KitchenOrderItem.fromJson(Map<String, dynamic>.from(item)))
          .toList(),
      createdAt:
          DateTime.tryParse('${json['created_at'] ?? json['createdAt']}') ??
              DateTime.now(),
      bumpedAt: DateTime.tryParse('${json['bumped_at'] ?? ''}'),
    );
  }

  bool get isCaptainOrder =>
      source == 'pos_shift_order' || id.startsWith('pos:');

  bool get hasPendingVoidRequest =>
      voidRequestStatus?.toLowerCase() == 'pending' ||
      status.toLowerCase() == 'void_requested';

  String get locationLabel {
    if (tableNumber != null) return 'Table $tableNumber';
    if (orderType == 'room_service') return 'Room Service';
    if (orderType == 'takeaway') return 'Takeaway';
    return orderType.replaceAll('_', ' ');
  }

  Duration get elapsed => DateTime.now().difference(createdAt);
  bool get isUrgent => elapsed.inMinutes > 15;

  static String? _optionalString(dynamic value) {
    if (value == null) return null;
    final text = '$value'.trim();
    return text.isEmpty ? null : text;
  }

  static int? _intValue(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toInt();
    return int.tryParse('$value');
  }

  static double _doubleValue(dynamic value) {
    if (value == null) return 0;
    if (value is num) return value.toDouble();
    return double.tryParse('$value') ?? 0;
  }
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
      quantity: KitchenOrder._intValue(json['quantity'] ?? json['qty']) ?? 1,
      notes: KitchenOrder._optionalString(
          json['notes'] ?? json['special_instructions']),
      isReady: json['is_ready'] == true ||
          json['isReady'] == true ||
          '${json['status'] ?? ''}'.toLowerCase() == 'ready',
    );
  }
}
