import 'package:intl/intl.dart';

final kesFormat = NumberFormat('#,##0.00', 'en_KE');

String formatKes(num value) => 'KES ${kesFormat.format(value)}';

class Product {
  const Product({
    required this.id,
    required this.name,
    required this.category,
    required this.price,
    this.unit,
    this.isActive = true,
  });

  final String id;
  final String name;
  final String category;
  final double price;
  final String? unit;
  final bool isActive;

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: '${json['id']}',
      name: '${json['name'] ?? ''}',
      category: _parseCategory(json),
      price: (json['price'] as num?)?.toDouble() ??
          (json['selling_price'] as num?)?.toDouble() ??
          0,
      unit: json['unit'] as String?,
      isActive: json['is_active'] != false &&
          json['isActive'] != false &&
          json['is_available'] != false,
    );
  }

  static String _parseCategory(Map<String, dynamic> json) {
    final raw =
        json['category_name'] ?? json['category'] ?? json['category_id'];
    if (raw is Map) {
      return '${raw['name'] ?? ''}';
    }
    return '$raw';
  }
}

class CartItem {
  const CartItem({
    required this.productId,
    required this.name,
    required this.unitPrice,
    required this.qty,
  });

  final String productId;
  final String name;
  final double unitPrice;
  final int qty;

  double get lineTotal => unitPrice * qty;

  CartItem copyWith({int? qty}) {
    return CartItem(
      productId: productId,
      name: name,
      unitPrice: unitPrice,
      qty: qty ?? this.qty,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': productId,
      'name': name,
      'unit_price': unitPrice,
      'quantity': qty,
      'line_total': lineTotal,
    };
  }

  factory CartItem.fromJson(Map<String, dynamic> json) {
    return CartItem(
      productId: '${json['product_id'] ?? json['productId'] ?? json['id']}',
      name: '${json['name'] ?? ''}',
      unitPrice: (json['unit_price'] as num?)?.toDouble() ??
          (json['price'] as num?)?.toDouble() ??
          0,
      qty: (json['quantity'] as num?)?.toInt() ??
          (json['qty'] as num?)?.toInt() ??
          1,
    );
  }
}

class CartState {
  const CartState({
    this.items = const [],
    this.paymentMethod = 'cash',
    this.discountPercent = 0,
    this.isComplimentary = false,
  });

  final List<CartItem> items;
  final String paymentMethod;
  final double discountPercent;
  final bool isComplimentary;

  double get subtotal => items.fold(0, (sum, item) => sum + item.lineTotal);
  double get vatAmount => subtotal * 0.16;
  double get discountAmount => subtotal * (discountPercent / 100);
  double get total =>
      isComplimentary ? 0 : subtotal + vatAmount - discountAmount;

  CartState copyWith({
    List<CartItem>? items,
    String? paymentMethod,
    double? discountPercent,
    bool? isComplimentary,
  }) {
    return CartState(
      items: items ?? this.items,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      discountPercent: discountPercent ?? this.discountPercent,
      isComplimentary: isComplimentary ?? this.isComplimentary,
    );
  }
}

class CreateSaleRequest {
  const CreateSaleRequest({
    required this.items,
    required this.totalAmount,
    this.customerName,
    this.customerPhone,
  });

  final List<CartItem> items;
  final double totalAmount;
  final String? customerName;
  final String? customerPhone;

  Map<String, dynamic> toJson() {
    return {
      'items': items.map((item) => item.toJson()).toList(),
      if (customerName != null) 'customer_name': customerName,
      if (customerPhone != null) 'customer_phone': customerPhone,
      'total_amount': totalAmount,
    };
  }
}

class SaleResult {
  const SaleResult({
    required this.transactionId,
    required this.createdAt,
    this.receiptNumber,
    this.cashierName,
    this.total = 0,
    this.paymentMethod = 'cash',
    this.offlineQueued = false,
  });

  final String transactionId;
  final DateTime createdAt;
  final String? receiptNumber;
  final String? cashierName;
  final double total;
  final String paymentMethod;
  final bool offlineQueued;

  factory SaleResult.fromJson(Map<String, dynamic> json) {
    return SaleResult(
      transactionId: '${json['transaction_id'] ?? json['transactionId'] ?? ''}',
      createdAt:
          DateTime.tryParse('${json['created_at'] ?? json['createdAt']}') ??
              DateTime.now(),
      receiptNumber: json['reference'] as String?,
      cashierName:
          json['cashier_name'] as String? ?? json['cashierName'] as String?,
      total: (json['total_amount'] as num?)?.toDouble() ??
          (json['total'] as num?)?.toDouble() ??
          0,
      paymentMethod:
          '${json['payment_method'] ?? json['paymentMethod'] ?? 'cash'}',
    );
  }
}

class HeldOrder {
  const HeldOrder({
    required this.id,
    required this.label,
    required this.items,
    required this.subtotal,
    required this.createdAt,
  });

  final String id;
  final String? label;
  final List<CartItem> items;
  final double subtotal;
  final DateTime createdAt;
}

class SyncStatus {
  const SyncStatus({
    required this.pendingCount,
    required this.isOffline,
    this.isSyncing = false,
    this.lastSyncedAt,
  });

  final int pendingCount;
  final bool isSyncing;
  final DateTime? lastSyncedAt;
  final bool isOffline;
}

class PayTransactionRequest {
  const PayTransactionRequest({
    required this.method,
    this.phoneNumber,
  });

  final String method;
  final String? phoneNumber;

  Map<String, dynamic> toJson() {
    return {
      'method': method,
      if (phoneNumber != null) 'phone_number': phoneNumber,
    };
  }
}

class PayTransactionResult {
  const PayTransactionResult({
    required this.success,
    this.checkoutRequestId,
    this.message,
  });

  final bool success;
  final String? checkoutRequestId;
  final String? message;

  factory PayTransactionResult.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>?;
    return PayTransactionResult(
      success: (json['success'] as bool?) ?? true,
      checkoutRequestId: data?['checkout_request_id'] as String? ??
          data?['checkoutRequestId'] as String?,
      message: json['message'] as String?,
    );
  }
}

class MpesaInitiateRequest {
  const MpesaInitiateRequest({
    required this.phoneNumber,
    required this.amount,
    required this.accountReference,
  });

  final String phoneNumber;
  final double amount;
  final String accountReference;

  Map<String, dynamic> toJson() {
    return {
      'phoneNumber': phoneNumber,
      'amount': amount,
      'accountReference': accountReference,
    };
  }
}

class MpesaStatus {
  const MpesaStatus(
      {required this.status, this.mpesaReceiptNumber, this.failureReason});

  final String status;
  final String? mpesaReceiptNumber;
  final String? failureReason;

  bool get isComplete => status == 'completed';
  bool get isFailed => status == 'failed';

  factory MpesaStatus.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? json;
    return MpesaStatus(
      status: '${data['status'] ?? 'pending'}',
      mpesaReceiptNumber: data['mpesa_receipt_number'] as String? ??
          data['mpesaReceiptNumber'] as String?,
      failureReason:
          data['failure_reason'] as String? ?? data['failureReason'] as String?,
    );
  }
}
