import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';

final outletPosRepositoryProvider = Provider<OutletPosRepository>((ref) {
  return OutletPosRepository(ref.read(dioProvider));
});

class OutletPosRepository {
  OutletPosRepository(this._dio);

  final Dio _dio;

  Future<List<PosOutlet>> getOutlets({String? outletType}) async {
    final response = await _dio.get('/pos/outlets', queryParameters: {
      if (outletType != null) 'outlet_type': outletType,
    });
    return _list(response.data)
        .map((item) => PosOutlet.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<List<OutletPosItem>> getItems(String outletId) async {
    final response = await _dio.get('/pos/outlets/$outletId/items');
    return _list(response.data)
        .map((item) => OutletPosItem.fromJson(Map<String, dynamic>.from(item)))
        .toList();
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
  }) async {
    final total = items.fold<double>(0, (sum, item) => sum + item.lineTotal);
    final response =
        await _dio.patch('/pos/shifts/$shiftId/orders/$orderId', data: {
      if (customerName != null && customerName.trim().isNotEmpty)
        'customer_name': customerName.trim(),
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
    required double closingCashCounted,
    String? varianceReason,
  }) async {
    final response = await _dio.post('/pos/shifts/$shiftId/close', data: {
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
  });

  final String id;
  final String name;
  final String outletType;
  final String pinPrefix;

  factory PosOutlet.fromJson(Map<String, dynamic> json) {
    return PosOutlet(
      id: '${json['id']}',
      name: '${json['name'] ?? ''}',
      outletType: '${json['outlet_type'] ?? ''}',
      pinPrefix: '${json['pin_prefix'] ?? ''}',
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
  });

  final String id;
  final String name;
  final String category;
  final double costPrice;
  final double sellingPrice;
  final double currentStock;
  final String unit;

  factory OutletPosItem.fromJson(Map<String, dynamic> json) {
    return OutletPosItem(
      id: '${json['id']}',
      name: '${json['name'] ?? ''}',
      category: '${json['category'] ?? 'Uncategorised'}',
      costPrice: _num(json['cost_price']),
      sellingPrice: _num(json['selling_price']),
      currentStock: _num(json['current_stock']),
      unit: '${json['unit'] ?? 'each'}',
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
    this.amountPaid = 0,
    this.balanceAmount = 0,
    this.waiterName,
    this.isSplit = false,
    this.isMerged = false,
    this.voidRequestStatus,
    this.createdAt,
    this.items = const [],
  });

  final String id;
  final String orderNumber;
  final String? shortCode;
  final String customerName;
  final String paymentStatus;
  final String status;
  final double totalAmount;
  final double amountPaid;
  final double balanceAmount;
  final String? waiterName;
  final bool isSplit;
  final bool isMerged;
  final String? voidRequestStatus;
  final DateTime? createdAt;
  final List<dynamic> items;

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
      amountPaid: _num(json['amount_paid']),
      balanceAmount: _num(json['balance_amount'] ?? json['balance']),
      waiterName: json['waiter_name'] as String?,
      isSplit: json['is_split'] == true,
      isMerged: json['is_merged'] == true,
      voidRequestStatus: json['void_request_status'] as String?,
      createdAt: DateTime.tryParse('${json['created_at'] ?? ''}'),
      items: items is List ? items : const [],
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
