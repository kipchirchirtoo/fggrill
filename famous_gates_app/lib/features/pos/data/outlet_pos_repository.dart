import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';

final outletPosRepositoryProvider = Provider<OutletPosRepository>((ref) {
  return OutletPosRepository(ref.read(dioProvider));
});

class OutletPosRepository {
  OutletPosRepository(this._dio);

  final Dio _dio;

  Future<List<PosOutlet>> getOutlets(
      {String? outletType, int? branchId}) async {
    final response = await _dio.get('/pos/outlets', queryParameters: {
      if (outletType != null) 'outlet_type': outletType,
      if (branchId != null) 'branch_id': branchId,
    });
    return _list(response.data)
        .map((item) => PosOutlet.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<List<OutletPosItem>> getItems(
    String outletId, {
    bool includeRelated = false,
    PosOutlet? fallbackOutlet,
  }) async {
    final response =
        await _dio.get('/pos/outlets/$outletId/items', queryParameters: {
      if (includeRelated) 'include_related': true,
    });
    return _list(response.data)
        .map((item) => OutletPosItem.fromJson(
              Map<String, dynamic>.from(item),
              fallbackOutlet: fallbackOutlet,
            ))
        .toList();
  }

  Future<List<OutletPosItem>> getUnifiedFoodAndBarItems(
    PosOutlet primaryOutlet,
  ) async {
    final relatedItems = await getItems(
      primaryOutlet.id,
      includeRelated: true,
      fallbackOutlet: primaryOutlet,
    );
    final relatedGroups = relatedItems.map((item) => item.itemGroup).toSet();
    if (relatedGroups.contains('restaurant') && relatedGroups.contains('bar')) {
      return _sortItems(relatedItems);
    }

    final outletById = <String, PosOutlet>{primaryOutlet.id: primaryOutlet};
    for (final outlet in await getOutlets(branchId: primaryOutlet.branchId)) {
      if (outlet.isFoodOrBar) outletById[outlet.id] = outlet;
    }

    final items = <OutletPosItem>[];
    for (final outlet in outletById.values) {
      if (!outlet.isFoodOrBar) continue;
      final outletItems = await getItems(outlet.id, fallbackOutlet: outlet);
      items.addAll(outletItems);
    }

    return _sortItems(items);
  }

  List<OutletPosItem> _sortItems(List<OutletPosItem> items) {
    return [...items]..sort((a, b) {
        final group = a.itemGroupLabel.compareTo(b.itemGroupLabel);
        if (group != 0) return group;
        final category = a.category.compareTo(b.category);
        if (category != 0) return category;
        return a.name.compareTo(b.name);
      });
  }

  Future<List<OutletStaffMember>> getStaff({String? search}) async {
    final response = await _dio.get('/pos/staff', queryParameters: {
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
    });
    return _list(response.data)
        .map((item) =>
            OutletStaffMember.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<OutletShift?> getActiveShift(String outletId) async {
    final response = await _dio.get('/pos/outlets/$outletId/shifts/active');
    final data = _data(response.data);
    if (data == null) return null;
    return OutletShift.fromJson(Map<String, dynamic>.from(data as Map));
  }

  Future<OutletShift> openShift(String outletId, double openingFloat) async {
    final response = await _dio.post('/pos/outlets/$outletId/shifts/open',
        data: {'opening_float': openingFloat});
    return OutletShift.fromJson(
        Map<String, dynamic>.from(_data(response.data) as Map));
  }

  Future<List<OutletShiftOrder>> getOrders(String shiftId) async {
    final response = await _dio.get('/pos/shifts/$shiftId/orders');
    return _list(response.data)
        .map((item) =>
            OutletShiftOrder.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<OutletShiftOrder> createOrder({
    required String shiftId,
    required List<OutletCartItem> items,
    String? customerName,
    String? orderType,
    String? tableNumber,
    String? roomNumber,
  }) async {
    final total = items.fold<double>(0, (sum, item) => sum + item.lineTotal);
    final response = await _dio.post('/pos/shifts/$shiftId/orders', data: {
      'customer_name':
          customerName?.trim().isEmpty == true ? null : customerName,
      if (orderType != null && orderType.trim().isNotEmpty)
        'order_type': orderType.trim(),
      if (tableNumber != null && tableNumber.trim().isNotEmpty)
        'table_number': tableNumber.trim(),
      if (roomNumber != null && roomNumber.trim().isNotEmpty)
        'room_number': roomNumber.trim(),
      'items': items.map((item) => item.toJson()).toList(),
      'total_amount': total,
    });
    return OutletShiftOrder.fromJson(
        Map<String, dynamic>.from(_data(response.data) as Map));
  }

  Future<OutletShiftOrder> updateOrder({
    required String shiftId,
    required String orderId,
    required List<OutletCartItem> items,
    String? customerName,
    String? orderType,
    String? tableNumber,
    String? roomNumber,
    bool appendItems = false,
  }) async {
    final total = items.fold<double>(0, (sum, item) => sum + item.lineTotal);
    final response =
        await _dio.patch('/pos/shifts/$shiftId/orders/$orderId', data: {
      if (customerName != null && customerName.trim().isNotEmpty)
        'customer_name': customerName.trim(),
      if (orderType != null && orderType.trim().isNotEmpty)
        'order_type': orderType.trim(),
      if (tableNumber != null && tableNumber.trim().isNotEmpty)
        'table_number': tableNumber.trim(),
      if (roomNumber != null && roomNumber.trim().isNotEmpty)
        'room_number': roomNumber.trim(),
      if (appendItems) 'append_items': true,
      'items': items.map((item) => item.toJson()).toList(),
      'total_amount': total,
    });
    return OutletShiftOrder.fromJson(
        Map<String, dynamic>.from(_data(response.data) as Map));
  }

  Future<List<OutletShiftOrder>> splitOrder({
    required String shiftId,
    required String orderId,
    required List<Map<String, dynamic>> splits,
  }) async {
    final response =
        await _dio.post('/pos/shifts/$shiftId/orders/$orderId/split', data: {
      'splits': splits,
    });
    return _list(response.data)
        .map((item) =>
            OutletShiftOrder.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<OutletShiftOrder> mergeOrders({
    required String shiftId,
    required List<String> orderIds,
    String? customerName,
  }) async {
    final response =
        await _dio.post('/pos/shifts/$shiftId/orders/merge', data: {
      'order_ids': orderIds,
      if (customerName != null && customerName.trim().isNotEmpty)
        'customer_name': customerName.trim(),
    });
    return OutletShiftOrder.fromJson(
        Map<String, dynamic>.from(_data(response.data) as Map));
  }

  Future<void> requestVoidOrder({
    required String shiftId,
    required String orderId,
    required String reason,
  }) async {
    await _dio.post('/pos/shifts/$shiftId/orders/$orderId/void-request', data: {
      'reason': reason,
    });
  }

  Future<OutletShiftOrder> getOrder({
    required String shiftId,
    required String orderId,
  }) async {
    final response = await _dio.get('/pos/shifts/$shiftId/orders/$orderId');
    return OutletShiftOrder.fromJson(
        Map<String, dynamic>.from(_data(response.data) as Map));
  }

  // ── Two-stage item void ────────────────────────────────────────────────────

  /// Item-level void request -- voids a quantity within a single line item
  /// on an open bill, leaving the rest of the bill untouched. Stage 1 requires
  /// cashier acknowledgment; Stage 2 requires manager/accountant approval.
  Future<ItemVoidRequest> requestItemVoid({
    required String shiftId,
    required String orderId,
    required int itemIndex,
    required double qtyToVoid,
    required String reasonCategory,
    String? note,
  }) async {
    final response = await _dio.post('/pos/voids/request', data: {
      'shift_id': shiftId,
      'order_id': orderId,
      'item_index': itemIndex,
      'qty_to_void': qtyToVoid,
      'reason_category': reasonCategory,
      'reason': (note != null && note.trim().isNotEmpty)
          ? note.trim()
          : itemVoidReasonLabel(reasonCategory),
      if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
    });
    return ItemVoidRequest.fromJson(
        Map<String, dynamic>.from(_data(response.data) as Map));
  }

  Future<List<ItemVoidRequest>> getItemVoidRequestsForShift(
      String shiftId) async {
    final response = await _dio.get('/pos/voids/shift/$shiftId');
    return _list(response.data)
        .map((item) =>
            ItemVoidRequest.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  /// Approves the pending request and atomically reduces the bill. Throws a
  /// [StateError] with the server's message (e.g. "Already actioned by
  /// Jane") if another reviewer already actioned it first.
  Future<OutletShiftOrder> approveItemVoid(String requestId) async {
    try {
      final response = await _dio.patch('/pos/voids/$requestId/approve');
      return OutletShiftOrder.fromJson(
          Map<String, dynamic>.from(_data(response.data) as Map));
    } on DioException catch (error) {
      throw StateError(_errorMessage(error, 'This void request could not be approved.'));
    }
  }

  Future<ItemVoidRequest> rejectItemVoid(
    String requestId, {
    String? rejectionReason,
  }) async {
    try {
      final response =
          await _dio.patch('/pos/voids/$requestId/reject', data: {
        if (rejectionReason != null && rejectionReason.trim().isNotEmpty)
          'rejection_reason': rejectionReason.trim(),
      });
      return ItemVoidRequest.fromJson(
          Map<String, dynamic>.from(_data(response.data) as Map));
    } on DioException catch (error) {
      throw StateError(_errorMessage(error, 'This void request could not be rejected.'));
    }
  }

  /// Stage 1: cashier acknowledges the void. Returns the updated request and
  /// updated order so the caller can immediately print the void receipt + bill.
  Future<Map<String, dynamic>> cashierAcknowledgeVoid(String requestId) async {
    try {
      final response =
          await _dio.patch('/pos/voids/$requestId/cashier-acknowledge');
      return Map<String, dynamic>.from(_data(response.data) as Map);
    } on DioException catch (error) {
      throw StateError(_errorMessage(error, 'Could not acknowledge void request.'));
    }
  }

  /// Stage 1: cashier declines the void. Flow ends here.
  Future<void> cashierDeclineVoid(String requestId) async {
    try {
      await _dio.patch('/pos/voids/$requestId/cashier-decline');
    } on DioException catch (error) {
      throw StateError(_errorMessage(error, 'Could not decline void request.'));
    }
  }

  /// Cashier Stage 1 queue — pending void requests for the caller's open shifts.
  Future<List<ItemVoidRequest>> getPendingVoidsCashier() async {
    final response = await _dio.get('/pos/voids/pending/cashier');
    return _list(response.data)
        .map((item) =>
            ItemVoidRequest.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  /// Manager Stage 2 queue — void_acknowledged requests awaiting approval.
  Future<List<ItemVoidRequest>> getPendingVoidsManager() async {
    final response = await _dio.get('/pos/voids/pending/manager');
    return _list(response.data)
        .map((item) =>
            ItemVoidRequest.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  /// Full void history for accountant audit screen.
  Future<List<ItemVoidRequest>> getVoidHistory({
    String? status,
    String? from,
    String? to,
    String? requestedBy,
    String? cashierId,
  }) async {
    final response = await _dio.get('/pos/voids/history', queryParameters: {
      if (status != null && status.isNotEmpty) 'status': status,
      if (from != null && from.isNotEmpty) 'from': from,
      if (to != null && to.isNotEmpty) 'to': to,
      if (requestedBy != null && requestedBy.isNotEmpty) 'requested_by': requestedBy,
      if (cashierId != null && cashierId.isNotEmpty) 'cashier_id': cashierId,
    });
    return _list(response.data)
        .map((item) =>
            ItemVoidRequest.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  String _errorMessage(DioException error, String fallback) {
    final data = error.response?.data;
    return data is Map && data['message'] is String
        ? data['message'] as String
        : fallback;
  }

  /// Checks-and-consumes this order's one allowed duplicate bill print.
  /// Throws a [StateError] with the exact backend message (e.g. "Reprint
  /// limit reached. Only one duplicate bill is allowed.") if the duplicate
  /// has already been used — callers should show that message verbatim
  /// and must NOT print when this throws.
  Future<void> reprintBill({
    required String shiftId,
    required String orderId,
  }) async {
    try {
      await _dio.post('/pos/shifts/$shiftId/orders/$orderId/reprint-bill');
    } on DioException catch (error) {
      final data = error.response?.data;
      final message = data is Map && data['message'] is String
          ? data['message'] as String
          : 'Reprint limit reached. Only one duplicate bill is allowed.';
      throw StateError(message);
    }
  }

  Future<void> payOrder({
    required String shiftId,
    required String orderId,
    required String paymentMethod,
    double? amount,
    String? reference,
    String? staffCreditBillId,
    Map<String, dynamic>? creditBill,
  }) async {
    await _dio.post('/pos/shifts/$shiftId/orders/$orderId/pay', data: {
      'payment_method': paymentMethod,
      if (amount != null) 'amount': amount,
      if (reference != null && reference.trim().isNotEmpty)
        'reference': reference,
      if (staffCreditBillId != null && staffCreditBillId.trim().isNotEmpty)
        'staff_credit_bill_id': staffCreditBillId,
      if (creditBill != null) 'credit_bill': creditBill,
    });
  }

  Future<List<OutletStockCount>> getStockCount(String shiftId) async {
    final response = await _dio.get('/pos/shifts/$shiftId/stock-count');
    return _list(response.data)
        .map((item) =>
            OutletStockCount.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<List<OutletStockCount>> updateStockCount(
      String shiftId, List<OutletStockCount> counts) async {
    final response = await _dio.put('/pos/shifts/$shiftId/stock-count', data: {
      'counts': counts.map((count) => count.toJson()).toList(),
    });
    return _list(response.data)
        .map((item) =>
            OutletStockCount.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<OutletShift> closeShift(
    String shiftId, {
    double? closingCashCounted,
    String? varianceReason,
  }) async {
    final response = await _dio.post('/pos/shifts/$shiftId/close', data: {
      if (closingCashCounted != null)
        'closing_cash_counted': closingCashCounted,
      if (varianceReason != null && varianceReason.trim().isNotEmpty)
        'cash_variance_reason': varianceReason.trim(),
    });
    return OutletShift.fromJson(
        Map<String, dynamic>.from(_data(response.data) as Map));
  }

  Future<OutletShift> submitShift(String shiftId) async {
    final response = await _dio.post('/pos/shifts/$shiftId/submit');
    return OutletShift.fromJson(
        Map<String, dynamic>.from(_data(response.data) as Map));
  }

  Future<Map<String, dynamic>> getSummary(String shiftId) async {
    final response = await _dio.get('/pos/shifts/$shiftId/summary');
    final data = _data(response.data);
    return data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
  }

  Object? _data(Object? responseData) {
    if (responseData is Map) {
      final data = Map<String, dynamic>.from(responseData);
      return data['data'];
    }
    return null;
  }

  List<dynamic> _list(Object? responseData) {
    final data = _data(responseData);
    return data is List ? data : const [];
  }
}

class OutletStaffMember {
  const OutletStaffMember({
    required this.id,
    required this.name,
    this.idNumber,
    this.employeeId,
    this.role,
    this.department,
  });

  final String id;
  final String name;
  final String? idNumber;
  final String? employeeId;
  final String? role;
  final String? department;

  factory OutletStaffMember.fromJson(Map<String, dynamic> json) {
    return OutletStaffMember(
      id: '${json['id']}',
      name: '${json['name'] ?? ''}',
      idNumber: json['id_number'] as String?,
      employeeId: json['employee_id'] as String?,
      role: json['role'] as String?,
      department: json['department'] as String?,
    );
  }
}

class PosOutlet {
  const PosOutlet({
    required this.id,
    required this.name,
    required this.outletType,
    required this.pinPrefix,
    this.branchId,
  });

  final String id;
  final String name;
  final String outletType;
  final String pinPrefix;
  final int? branchId;

  bool get isFoodOrBar => itemGroup == 'restaurant' || itemGroup == 'bar';

  String get itemGroup {
    final type = outletType.toLowerCase();
    if (type == 'restaurant') return 'restaurant';
    if (type.contains('bar')) return 'bar';
    return 'other';
  }

  String get itemGroupLabel {
    if (itemGroup == 'restaurant') return 'Restaurant';
    if (itemGroup == 'bar') return 'Bar';
    return 'Other';
  }

  factory PosOutlet.fromJson(Map<String, dynamic> json) {
    return PosOutlet(
      id: '${json['id']}',
      name: '${json['name'] ?? ''}',
      outletType: '${json['outlet_type'] ?? ''}',
      pinPrefix: '${json['pin_prefix'] ?? ''}',
      branchId: _intOrNull(json['branch_id']),
    );
  }
}

class OutletPosItem {
  const OutletPosItem({
    required this.id,
    required this.name,
    required this.category,
    required this.costPrice,
    required this.sellingPrice,
    required this.currentStock,
    required this.unit,
    required this.itemGroup,
    required this.itemGroupLabel,
    required this.outletName,
    required this.outletType,
    this.trackStock = true,
  });

  final String id;
  final String name;
  final String category;
  final double costPrice;
  final double sellingPrice;
  final double currentStock;
  final String unit;
  final String itemGroup;
  final String itemGroupLabel;
  final String outletName;
  final String outletType;
  final bool trackStock;

  factory OutletPosItem.fromJson(
    Map<String, dynamic> json, {
    PosOutlet? fallbackOutlet,
  }) {
    final outlet = json['outlet'];
    final outletMap =
        outlet is Map ? Map<String, dynamic>.from(outlet) : const {};
    final outletType =
        '${json['outlet_type'] ?? outletMap['outlet_type'] ?? fallbackOutlet?.outletType ?? ''}';
    final rawGroup = '${json['item_group'] ?? ''}';
    final itemGroup = rawGroup.trim().isNotEmpty
        ? rawGroup
        : fallbackOutlet?.itemGroup ??
            (outletType == 'restaurant'
                ? 'restaurant'
                : outletType.contains('bar')
                    ? 'bar'
                    : 'other');
    final groupLabel = '${json['item_group_label'] ?? ''}'.trim();
    return OutletPosItem(
      id: '${json['id']}',
      name: '${json['name'] ?? ''}',
      category: _normalisedCategory(_categoryValue(json), itemGroup),
      costPrice: _num(json['cost_price']),
      sellingPrice: _num(json['selling_price']),
      currentStock: _num(json['current_stock']),
      unit: '${json['unit'] ?? 'each'}',
      itemGroup: itemGroup,
      itemGroupLabel: groupLabel.isNotEmpty
          ? groupLabel
          : itemGroup == 'restaurant'
              ? 'Restaurant'
              : itemGroup == 'bar'
                  ? 'Bar'
                  : 'Other',
      outletName:
          '${json['outlet_name'] ?? outletMap['name'] ?? fallbackOutlet?.name ?? ''}',
      outletType: outletType,
      trackStock: json['track_stock'] != false,
    );
  }
}

class OutletShift {
  const OutletShift({
    required this.id,
    required this.outletId,
    required this.status,
    required this.openedAt,
    this.closedAt,
    this.summary = const {},
  });

  final String id;
  final String outletId;
  final String status;
  final DateTime openedAt;
  final DateTime? closedAt;
  final Map<String, dynamic> summary;

  factory OutletShift.fromJson(Map<String, dynamic> json) {
    final summary = json['summary'];
    return OutletShift(
      id: '${json['id']}',
      outletId: '${json['outlet_id'] ?? ''}',
      status: '${json['status'] ?? ''}',
      openedAt: DateTime.tryParse('${json['opened_at']}') ?? DateTime.now(),
      closedAt: DateTime.tryParse('${json['closed_at']}'),
      summary: summary is Map ? Map<String, dynamic>.from(summary) : const {},
    );
  }
}

class OutletCartItem {
  const OutletCartItem({
    required this.item,
    required this.quantity,
  });

  final OutletPosItem item;
  final int quantity;

  double get lineTotal => item.sellingPrice * quantity;

  OutletCartItem copyWith({int? quantity}) {
    return OutletCartItem(item: item, quantity: quantity ?? this.quantity);
  }

  Map<String, dynamic> toJson() {
    return {
      'outlet_item_id': item.id,
      'name': item.name,
      'category': item.category,
      'item_group': item.itemGroup,
      'item_group_label': item.itemGroupLabel,
      'outlet_name': item.outletName,
      'outlet_type': item.outletType,
      'quantity': quantity,
      'unit_price': item.sellingPrice,
      'line_total': lineTotal,
    };
  }
}

class OutletShiftOrder {
  const OutletShiftOrder({
    required this.id,
    required this.orderNumber,
    this.shortCode,
    required this.customerName,
    required this.paymentStatus,
    required this.status,
    required this.totalAmount,
    this.orderType,
    this.tableNumber,
    this.roomNumber,
    this.amountPaid = 0,
    this.balanceAmount = 0,
    this.waiterName,
    this.isSplit = false,
    this.isMerged = false,
    this.voidRequestStatus,
    this.createdAt,
    this.items = const [],
    this.billReprintCount = 0,
  });

  final String id;
  final String orderNumber;
  final String? shortCode;
  final String customerName;
  final String paymentStatus;
  final String status;
  final double totalAmount;
  final String? orderType;
  final String? tableNumber;
  final String? roomNumber;
  final double amountPaid;
  final double balanceAmount;
  final String? waiterName;
  final bool isSplit;
  final bool isMerged;
  final String? voidRequestStatus;
  final DateTime? createdAt;
  final List<dynamic> items;
  // How many times the explicit "Reprint bill" action has been used for
  // this order's current state. Only one duplicate is allowed, so the
  // reprint action is exhausted once this reaches 1 (server-enforced; this
  // is only used to proactively disable the menu item in the UI).
  final int billReprintCount;

  bool get canReprintBill => billReprintCount < 1;

  /// Items that should be shown on the customer bill — excludes any item that
  /// has void_pending_approval=true (cashier acknowledged, awaiting manager).
  /// Those items are hidden from the customer view until the manager decides.
  List<dynamic> get visibleItems => items
      .whereType<Map>()
      .where((item) => item['void_pending_approval'] != true)
      .toList();

  factory OutletShiftOrder.fromJson(Map<String, dynamic> json) {
    final items = json['items'];
    return OutletShiftOrder(
      id: '${json['id']}',
      orderNumber: '${json['order_number'] ?? ''}',
      shortCode: json['short_code'] as String?,
      customerName: '${json['customer_name'] ?? 'Walk-in'}',
      paymentStatus: '${json['payment_status'] ?? 'unpaid'}',
      status: '${json['status'] ?? 'open'}',
      totalAmount: _num(json['total_amount']),
      orderType: json['order_type'] == null ? null : '${json['order_type']}',
      tableNumber:
          json['table_number'] == null ? null : '${json['table_number']}',
      roomNumber: json['room_number'] == null ? null : '${json['room_number']}',
      amountPaid: _num(json['amount_paid']),
      balanceAmount: _num(json['balance_amount'] ?? json['balance']),
      waiterName: json['waiter_name'] as String?,
      isSplit: json['is_split'] == true,
      isMerged: json['is_merged'] == true,
      voidRequestStatus: json['void_request_status'] as String?,
      createdAt: DateTime.tryParse('${json['created_at'] ?? ''}'),
      items: items is List ? items : const [],
      billReprintCount: json['bill_reprint_count'] is num
          ? (json['bill_reprint_count'] as num).toInt()
          : int.tryParse('${json['bill_reprint_count'] ?? 0}') ?? 0,
    );
  }
}

const Map<String, String> itemVoidReasonCategories = {
  'wrong_order': 'Wrong order',
  'duplicate_entry': 'Duplicate entry',
  'customer_changed_mind': 'Customer changed mind',
  'pricing_error': 'Pricing error',
  'other': 'Other',
};

String itemVoidReasonLabel(String category) =>
    itemVoidReasonCategories[category] ?? 'Other';

class ItemVoidRequest {
  const ItemVoidRequest({
    required this.id,
    required this.shiftId,
    required this.orderId,
    required this.itemIndex,
    required this.itemName,
    required this.unitPrice,
    required this.qtyToVoid,
    required this.qtyBeforeVoid,
    required this.reasonCategory,
    required this.reason,
    required this.status,
    this.orderNumber,
    this.branchId,
    this.note,
    this.requestedBy,
    this.requestedByName,
    this.actionedBy,
    this.actionedByName,
    this.cashierId,
    this.cashierName,
    this.cashierAcknowledgedAt,
    this.cashierAction,
    this.managerId,
    this.managerName,
    this.managerReviewedAt,
    this.rejectionReason,
    this.createdAt,
  });

  final String id;
  final String shiftId;
  final String orderId;
  final int itemIndex;
  final String itemName;
  final double unitPrice;
  final double qtyToVoid;
  final double qtyBeforeVoid;
  final String reasonCategory;
  final String reason;
  final String status;
  final String? orderNumber;
  final int? branchId;
  final String? note;
  final String? requestedBy;
  final String? requestedByName;
  final String? actionedBy;
  final String? actionedByName;
  // Stage 1
  final String? cashierId;
  final String? cashierName;
  final DateTime? cashierAcknowledgedAt;
  final String? cashierAction;
  // Stage 2
  final String? managerId;
  final String? managerName;
  final DateTime? managerReviewedAt;
  final String? rejectionReason;
  final DateTime? createdAt;

  double get amount => qtyToVoid * unitPrice;
  bool get isPending => status == 'pending';
  bool get isAcknowledged => status == 'void_acknowledged';
  bool get isCashierDeclined => status == 'void_cashier_declined';
  bool get isApproved => status == 'approved';
  bool get isRejected => status == 'rejected';
  bool get isTerminal => isApproved || isRejected || isCashierDeclined;

  factory ItemVoidRequest.fromJson(Map<String, dynamic> json) {
    return ItemVoidRequest(
      id: '${json['id']}',
      shiftId: '${json['shift_id'] ?? ''}',
      orderId: '${json['order_id'] ?? ''}',
      itemIndex: json['item_index'] is num
          ? (json['item_index'] as num).toInt()
          : int.tryParse('${json['item_index']}') ?? -1,
      itemName: '${json['item_name'] ?? ''}',
      unitPrice: _num(json['unit_price']),
      qtyToVoid: _num(json['qty_to_void']),
      qtyBeforeVoid: _num(json['qty_before_void']),
      reasonCategory: '${json['reason_category'] ?? 'other'}',
      reason: '${json['reason'] ?? ''}',
      status: '${json['status'] ?? 'pending'}',
      orderNumber: json['order_number'] as String?,
      branchId: json['branch_id'] is num ? (json['branch_id'] as num).toInt() : null,
      note: json['note'] as String?,
      requestedBy: json['requested_by'] as String?,
      requestedByName: json['requested_by_name'] as String?,
      actionedBy: json['actioned_by'] as String?,
      actionedByName: json['actioned_by_name'] as String?,
      cashierId: json['cashier_id'] as String?,
      cashierName: json['cashier_name'] as String?,
      cashierAcknowledgedAt: DateTime.tryParse('${json['cashier_acknowledged_at'] ?? ''}'),
      cashierAction: json['cashier_action'] as String?,
      managerId: json['manager_id'] as String?,
      managerName: json['manager_name'] as String?,
      managerReviewedAt: DateTime.tryParse('${json['manager_reviewed_at'] ?? ''}'),
      rejectionReason: json['rejection_reason'] as String?,
      createdAt: DateTime.tryParse('${json['created_at'] ?? ''}'),
    );
  }
}

class OutletStockCount {
  const OutletStockCount({
    required this.id,
    required this.itemName,
    required this.unit,
    required this.openingStock,
    required this.additions,
    required this.soldQuantity,
    required this.systemClosingStock,
    required this.variance,
    this.trackStock = true,
    this.physicalCount,
    this.varianceReason,
  });

  final String id;
  final String itemName;
  final String unit;
  final double openingStock;
  final double additions;
  final double soldQuantity;
  final double systemClosingStock;
  final double? physicalCount;
  final double variance;
  final bool trackStock;
  final String? varianceReason;

  factory OutletStockCount.fromJson(Map<String, dynamic> json) {
    return OutletStockCount(
      id: '${json['id']}',
      itemName: '${json['item_name'] ?? ''}',
      unit: '${json['unit'] ?? 'each'}',
      openingStock: _num(json['opening_stock']),
      additions: _num(json['additions']),
      soldQuantity: _num(json['sold_quantity']),
      systemClosingStock: _num(json['system_closing_stock']),
      physicalCount:
          json['physical_count'] == null ? null : _num(json['physical_count']),
      variance: _num(json['variance']),
      trackStock: json['track_stock'] != false,
      varianceReason: json['variance_reason'] as String?,
    );
  }

  OutletStockCount copyWith({
    double? additions,
    double? soldQuantity,
    double? physicalCount,
    String? varianceReason,
    bool? trackStock,
  }) {
    final newAdditions = additions ?? this.additions;
    final newSold = soldQuantity ?? this.soldQuantity;
    final system = openingStock + newAdditions - newSold;
    final physical = physicalCount ?? this.physicalCount;
    return OutletStockCount(
      id: id,
      itemName: itemName,
      unit: unit,
      openingStock: openingStock,
      additions: newAdditions,
      soldQuantity: newSold,
      systemClosingStock: system,
      physicalCount: physical,
      variance: physical == null ? 0 : physical - system,
      trackStock: trackStock ?? this.trackStock,
      varianceReason: varianceReason ?? this.varianceReason,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'opening_stock': openingStock,
      'additions': additions,
      'sold_quantity': soldQuantity,
      'physical_count': physicalCount,
      'track_stock': trackStock,
      'variance_reason': varianceReason,
    };
  }
}

double _num(Object? value) {
  final parsed = value is num ? value.toDouble() : double.tryParse('$value');
  return parsed ?? 0;
}

int? _intOrNull(Object? value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse('$value');
}

Object? _categoryValue(Map<String, dynamic> json) {
  for (final key in [
    'category_name',
    'categoryName',
    'category_label',
    'categoryLabel',
    'menu_category_name',
    'drink_category_name',
    'category',
  ]) {
    final text = _categoryText(json[key]);
    if (text.isNotEmpty) return text;
  }

  for (final key in [
    'menu_category',
    'drink_category',
    'restaurant_category',
    'bar_category',
  ]) {
    final text = _categoryText(json[key]);
    if (text.isNotEmpty) return text;
  }

  return null;
}

String _categoryText(Object? value) {
  if (value == null) return '';
  if (value is Map) {
    for (final key in ['name', 'category_name', 'label', 'title']) {
      final text = '${value[key] ?? ''}'.trim();
      if (text.isNotEmpty && text != 'null') return text;
    }
    return '';
  }
  final text = '$value'.trim();
  if (text.isEmpty || text == 'null' || text == 'undefined') return '';
  return text;
}

String _normalisedCategory(Object? value, String itemGroup) {
  final category = _categoryText(value);
  if (category.isEmpty) return 'Other';
  final lower = category.toLowerCase();
  final isGenericRestaurant =
      itemGroup == 'restaurant' && lower == 'restaurant';
  final isGenericBar = itemGroup == 'bar' &&
      {
        'bar',
        'main bar',
        'executive bar',
        'kyogong executive bar',
        'kyogong sports bar',
      }.contains(lower);
  if (isGenericRestaurant || isGenericBar) return 'Other';
  return category;
}
