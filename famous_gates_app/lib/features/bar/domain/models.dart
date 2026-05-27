class BarCategory {
  final String id;
  final String name;

  const BarCategory({required this.id, required this.name});

  factory BarCategory.fromJson(Map<String, dynamic> json) {
    return BarCategory(
      id: '${json['id']}',
      name: '${json['name'] ?? ''}',
    );
  }
}

class BarDrink {
  final String id;
  final String name;
  final String? categoryId;
  final String? categoryName;
  final double price;
  final String? unit;
  final bool isAvailable;
  final String? imageUrl;
  final double? stockQuantity;

  const BarDrink({
    required this.id,
    required this.name,
    this.categoryId,
    this.categoryName,
    required this.price,
    this.unit,
    this.isAvailable = true,
    this.imageUrl,
    this.stockQuantity,
  });

  factory BarDrink.fromJson(Map<String, dynamic> json) {
    return BarDrink(
      id: '${json['id']}',
      name: '${json['name'] ?? ''}',
      categoryId: json['category_id'] as String?,
      categoryName: json['category_name'] as String?,
      price: (json['price'] as num?)?.toDouble() ?? 0,
      unit: json['unit'] as String?,
      isAvailable:
          json['is_available'] != false && json['isAvailable'] != false,
      imageUrl: json['image_url'] as String?,
      stockQuantity: (json['stock_quantity'] as num?)?.toDouble(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'price': price,
        'unit': unit,
      };
}

class BarOrderItem {
  final String drinkId;
  final String name;
  final int quantity;
  final double unitPrice;

  const BarOrderItem({
    required this.drinkId,
    required this.name,
    required this.quantity,
    required this.unitPrice,
  });

  double get lineTotal => unitPrice * quantity;

  factory BarOrderItem.fromJson(Map<String, dynamic> json) {
    return BarOrderItem(
      drinkId: '${json['drink_id'] ?? json['drinkId'] ?? json['id']}',
      name: '${json['name'] ?? ''}',
      quantity: (json['quantity'] as num?)?.toInt() ??
          (json['qty'] as num?)?.toInt() ??
          1,
      unitPrice: (json['unit_price'] as num?)?.toDouble() ??
          (json['price'] as num?)?.toDouble() ??
          0,
    );
  }

  Map<String, dynamic> toJson() => {
        'drink_id': drinkId,
        'name': name,
        'quantity': quantity,
        'unit_price': unitPrice,
        'line_total': lineTotal,
      };
}

class BarOrder {
  final String id;
  final String? customerName;
  final List<BarOrderItem> items;
  final double totalAmount;
  final String status;
  final String? tabId;
  final DateTime createdAt;

  const BarOrder({
    required this.id,
    this.customerName,
    this.items = const [],
    this.totalAmount = 0,
    this.status = 'pending',
    this.tabId,
    required this.createdAt,
  });

  factory BarOrder.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List? ?? [];
    final items = rawItems
        .whereType<Map>()
        .map((item) => BarOrderItem.fromJson(Map<String, dynamic>.from(item)))
        .toList();
    return BarOrder(
      id: '${json['id']}',
      customerName: json['customer_name'] as String?,
      items: items,
      totalAmount: (json['total_amount'] as num?)?.toDouble() ??
          (json['total'] as num?)?.toDouble() ??
          0,
      status: '${json['status'] ?? 'pending'}',
      tabId: json['tab_id'] as String?,
      createdAt:
          DateTime.tryParse('${json['created_at'] ?? json['createdAt']}') ??
              DateTime.now(),
    );
  }

  String get statusLabel {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'preparing':
        return 'Preparing';
      case 'ready':
        return 'Ready';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  }
}

class BarTab {
  final String id;
  final String? customerName;
  final double runningTotal;
  final String status;
  final List<BarOrderItem>? items;
  final DateTime createdAt;

  const BarTab({
    required this.id,
    this.customerName,
    this.runningTotal = 0,
    this.status = 'open',
    this.items,
    required this.createdAt,
  });

  factory BarTab.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List?;
    return BarTab(
      id: '${json['id']}',
      customerName:
          json['customer_name'] as String? ?? json['customerName'] as String?,
      runningTotal: (json['running_total'] as num?)?.toDouble() ??
          (json['total'] as num?)?.toDouble() ??
          0,
      status: '${json['status'] ?? 'open'}',
      items: rawItems
          ?.whereType<Map>()
          .map((item) => BarOrderItem.fromJson(Map<String, dynamic>.from(item)))
          .toList(),
      createdAt:
          DateTime.tryParse('${json['created_at'] ?? json['createdAt']}') ??
              DateTime.now(),
    );
  }
}

class StockItem {
  final String id;
  final String drinkName;
  final double currentStock;
  final double parLevel;
  final String? unit;
  final bool lowStock;

  const StockItem({
    required this.id,
    required this.drinkName,
    this.currentStock = 0,
    this.parLevel = 0,
    this.unit,
    this.lowStock = false,
  });

  factory StockItem.fromJson(Map<String, dynamic> json) {
    return StockItem(
      id: '${json['id'] ?? json['drink_id']}',
      drinkName: '${json['drink_name'] ?? json['name'] ?? ''}',
      currentStock: (json['current_stock'] as num?)?.toDouble() ??
          (json['quantity'] as num?)?.toDouble() ??
          0,
      parLevel: (json['par_level'] as num?)?.toDouble() ?? 0,
      unit: json['unit'] as String?,
      lowStock: json['low_stock'] == true || json['is_low'] == true,
    );
  }
}

class MorningCountItem {
  final String drinkId;
  final String name;
  final String? category;
  final double systemQuantity;
  double physicalCount;

  MorningCountItem({
    required this.drinkId,
    required this.name,
    this.category,
    required this.systemQuantity,
    double? physicalCount,
  }) : physicalCount = physicalCount ?? systemQuantity;

  Map<String, dynamic> toJson() => {
        'drink_id': drinkId,
        'physical_count': physicalCount,
      };
}

class CreateBarOrderRequest {
  final List<BarOrderItem> items;
  final double totalAmount;
  final String? customerName;
  final String? tabId;

  const CreateBarOrderRequest({
    required this.items,
    required this.totalAmount,
    this.customerName,
    this.tabId,
  });

  Map<String, dynamic> toJson() => {
        'items': items.map((item) => item.toJson()).toList(),
        'total_amount': totalAmount,
        if (customerName != null) 'customer_name': customerName,
        if (tabId != null) 'tab_id': tabId,
      };
}

class CreateBarTabRequest {
  final String? customerName;

  const CreateBarTabRequest({this.customerName});

  Map<String, dynamic> toJson() => {
        if (customerName != null) 'customer_name': customerName,
      };
}

class CloseTabRequest {
  final String paymentMethod;

  const CloseTabRequest({required this.paymentMethod});

  Map<String, dynamic> toJson() => {
        'payment_method': paymentMethod,
      };
}

class StockTakeSubmission {
  final String countType;
  final List<MorningCountItem> items;

  const StockTakeSubmission({required this.countType, required this.items});

  Map<String, dynamic> toJson() => {
        'count_type': countType,
        'items': items.map((item) => item.toJson()).toList(),
      };
}
