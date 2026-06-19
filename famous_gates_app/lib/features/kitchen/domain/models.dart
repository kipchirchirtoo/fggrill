class KitchenOrder {
  final String id;
  final String orderNumber;
  final String orderType;
  final int? tableNumber;
  final String? roomNumber;
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
  final bool captainOrderAlreadyPrinted;
  final String? shiftId;
  final String? outletType;

  const KitchenOrder({
    required this.id,
    this.orderNumber = '',
    this.orderType = 'dine_in',
    this.tableNumber,
    this.roomNumber,
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
    this.captainOrderAlreadyPrinted = false,
    this.shiftId,
    this.outletType,
  });

  factory KitchenOrder.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List? ?? [];
    return KitchenOrder(
      id: '${json['id']}',
      orderNumber:
          '${json['order_number'] ?? json['orderNumber'] ?? json['id']}',
      orderType: '${json['order_type'] ?? 'dine_in'}',
      tableNumber: _intValue(json['table_number'] ?? json['table']),
      roomNumber: _optionalString(json['room_number']),
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
      captainOrderAlreadyPrinted: json['captain_order_already_printed'] == true,
      shiftId: _optionalString(json['shift_id']),
      outletType: _optionalString(json['outlet_type']),
    );
  }

  bool get isCaptainOrder =>
      source == 'pos_shift_order' || id.startsWith('pos:');

  bool get hasPendingVoidRequest =>
      voidRequestStatus?.toLowerCase() == 'pending' ||
      status.toLowerCase() == 'void_requested';

  bool get isVoided {
    final normalizedStatus = status.toLowerCase();
    final normalizedPayment = paymentStatus?.toLowerCase();
    final normalizedVoidRequest = voidRequestStatus?.toLowerCase();
    return normalizedStatus == 'cancelled' ||
        normalizedStatus == 'voided' ||
        normalizedPayment == 'voided' ||
        normalizedVoidRequest == 'approved';
  }

  String get locationLabel {
    if (tableNumber != null) return 'Table $tableNumber';
    if (orderType == 'room_service') {
      return roomNumber == null ? 'Room service' : 'Room $roomNumber';
    }
    if (orderType == 'takeaway') return 'Takeaway';
    return orderType.replaceAll('_', ' ');
  }

  String get orderTypeLabel {
    if (orderType == 'dine_in') return 'Dine in';
    if (orderType == 'room_service') return 'Room service';
    if (orderType == 'takeaway') return 'Takeaway';
    return orderType
        .split('_')
        .where((part) => part.isNotEmpty)
        .map((part) => part[0].toUpperCase() + part.substring(1))
        .join(' ');
  }

  Duration get elapsed => DateTime.now().difference(createdAt);
  bool get isUrgent => elapsed.inMinutes > 15;
  List<KitchenOrderItem> get recalledItems =>
      items.where((item) => item.isRecalledItem).toList();
  bool get hasRecalledItems => recalledItems.isNotEmpty;

  String get kdsPrintKey {
    final batches = recalledItems
        .map((item) => item.recallBatchId ?? item.recalledAt?.toIso8601String())
        .whereType<String>()
        .where((value) => value.trim().isNotEmpty)
        .toSet()
        .toList()
      ..sort();
    if (batches.isEmpty) return id;
    return '$id:recall:${batches.join('|')}';
  }

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
  final double unitPrice;
  final bool isReady;
  final bool isRecalledItem;
  final String? recallBatchId;
  final DateTime? recalledAt;
  final String? recallNote;

  const KitchenOrderItem({
    required this.id,
    required this.name,
    this.quantity = 1,
    this.notes,
    this.unitPrice = 0,
    this.isReady = false,
    this.isRecalledItem = false,
    this.recallBatchId,
    this.recalledAt,
    this.recallNote,
  });

  factory KitchenOrderItem.fromJson(Map<String, dynamic> json) {
    return KitchenOrderItem(
      id: '${json['id'] ?? json['item_id']}',
      name:
          '${json['name'] ?? json['item_name'] ?? json['menu_item_name'] ?? ''}',
      quantity: KitchenOrder._intValue(json['quantity'] ?? json['qty']) ?? 1,
      unitPrice: KitchenOrder._doubleValue(json['unit_price'] ?? json['price']),
      notes: KitchenOrder._optionalString(
          json['notes'] ?? json['special_instructions']),
      isRecalledItem:
          json['is_recalled_item'] == true || json['isRecalledItem'] == true,
      recallBatchId: KitchenOrder._optionalString(
          json['recall_batch_id'] ?? json['recallBatchId']),
      recalledAt: DateTime.tryParse('${json['recalled_at'] ?? ''}'),
      recallNote: KitchenOrder._optionalString(
          json['recall_note'] ?? json['recallNote']),
      isReady: json['is_ready'] == true ||
          json['isReady'] == true ||
          '${json['status'] ?? ''}'.toLowerCase() == 'ready',
    );
  }
}
