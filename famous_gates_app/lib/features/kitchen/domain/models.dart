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
  /// Exact time the captain ticket was last (re)printed, if known. Shown in
  /// Kenyan time for accountability — including recalled orders.
  final DateTime? captainPrintedAt;
  final String? shiftId;
  final String? outletType;
  final bool isExchangeOrder;
  final String? exchangeParentOrderId;

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
    this.captainPrintedAt,
    this.shiftId,
    this.outletType,
    this.isExchangeOrder = false,
    this.exchangeParentOrderId,
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
      captainPrintedAt:
          DateTime.tryParse('${json['captain_printed_at'] ?? ''}'),
      shiftId: _optionalString(json['shift_id']),
      outletType: _optionalString(json['outlet_type']),
      isExchangeOrder: json['is_exchange'] == true,
      exchangeParentOrderId: _optionalString(json['exchange_parent_order_id']),
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
  // Only the most recent recall batch — not every item ever recalled over
  // the order's lifetime. Without this, a second/third recall on the same
  // bill reprints already-served items from earlier rounds alongside the
  // new ones, wasting thermal paper (and on long-running tabs, can make the
  // ticket look like the full bill again).
  List<KitchenOrderItem> get recalledItems {
    final flagged = items.where((item) => item.isRecalledItem).toList();
    if (flagged.isEmpty) return flagged;
    DateTime? latestRecalledAt;
    for (final item in flagged) {
      final recalledAt = item.recalledAt;
      if (recalledAt == null) continue;
      if (latestRecalledAt == null || recalledAt.isAfter(latestRecalledAt)) {
        latestRecalledAt = recalledAt;
      }
    }
    if (latestRecalledAt == null) return flagged;
    return flagged
        .where((item) =>
            item.recalledAt != null &&
            item.recalledAt!.isAtSameMomentAs(latestRecalledAt!))
        .toList();
  }

  bool get hasRecalledItems => recalledItems.isNotEmpty;

  /// The original order time, unless the order has been recalled — then the
  /// time the most recent recall was triggered. Printed tickets must show
  /// when the recall actually happened, not the stale original order time.
  DateTime get effectiveCreatedAt =>
      recalledItems.isEmpty ? createdAt : (recalledItems.first.recalledAt ?? createdAt);

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
  final KitchenItemVoidRequest? voidRequest;

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
    this.voidRequest,
  });

  factory KitchenOrderItem.fromJson(Map<String, dynamic> json) {
    final voidRequestJson = json['void_request'];
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
      voidRequest: voidRequestJson is Map
          ? KitchenItemVoidRequest.fromJson(
              Map<String, dynamic>.from(voidRequestJson))
          : null,
    );
  }
}

/// Item-level void state surfaced on the KDS so kitchen staff know to stop
/// (or continue) preparing a specific item while its void request works
/// through the kitchen-then-cashier-then-manager flow. `status` is one of:
/// pending, kitchen_acknowledged, void_kitchen_declined, void_acknowledged,
/// approved, rejected, void_cashier_declined.
class KitchenItemVoidRequest {
  final String status;
  final String label;
  final String? reason;
  final double qtyToVoid;

  const KitchenItemVoidRequest({
    required this.status,
    required this.label,
    this.reason,
    this.qtyToVoid = 0,
  });

  bool get isPending => status == 'pending';
  bool get isKitchenAcknowledged => status == 'kitchen_acknowledged';
  bool get isKitchenDeclined => status == 'void_kitchen_declined';
  bool get isAcknowledged => status == 'void_acknowledged';
  bool get isApproved => status == 'approved';
  bool get isRejected => status == 'rejected';
  bool get isCashierDeclined => status == 'void_cashier_declined';
  // Non-terminal: the kitchen should still stop work on this item.
  bool get isActive => isPending || isKitchenAcknowledged || isAcknowledged;

  factory KitchenItemVoidRequest.fromJson(Map<String, dynamic> json) {
    return KitchenItemVoidRequest(
      status: '${json['status'] ?? 'pending'}'.toLowerCase(),
      label: '${json['label'] ?? 'PENDING'}',
      reason: KitchenOrder._optionalString(json['reason']),
      qtyToVoid: KitchenOrder._doubleValue(json['qty_to_void']),
    );
  }
}
