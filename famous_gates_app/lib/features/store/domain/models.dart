class InventoryItem {
  final String id;
  final String name;
  final String? sku;
  final String? category;
  final String? unit;
  final double currentStock;
  final double? minStock;
  final double? maxStock;
  final String? storeType;

  const InventoryItem({
    required this.id,
    required this.name,
    this.sku,
    this.category,
    this.unit,
    this.currentStock = 0,
    this.minStock,
    this.maxStock,
    this.storeType,
  });

  bool get isLowStock => minStock != null && currentStock < minStock!;

  /// Serialize to a plain JSON map (skill: flutter-implement-json-serialization).
  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'sku': sku,
        'category': category,
        'unit': unit,
        'current_stock': currentStock,
        'min_stock': minStock,
        'max_stock': maxStock,
        'store_type': storeType,
      };

  factory InventoryItem.fromJson(Map<String, dynamic> json) {
    double? toDouble(dynamic value) {
      if (value is num) return value.toDouble();
      return double.tryParse('$value');
    }

    return InventoryItem(
      id: '${json['id'] ?? json['item_id'] ?? json['sku'] ?? ''}',
      name: '${json['name'] ?? json['item_name'] ?? json['description'] ?? ''}',
      sku: json['sku'] as String? ?? json['item_sku'] as String?,
      category: json['category'] as String? ?? json['category_name'] as String?,
      unit: json['unit'] as String? ?? json['unit_of_measure'] as String?,
      currentStock: toDouble(json['current_stock'] ??
              json['stock_quantity'] ??
              json['quantity']) ??
          0,
      minStock: toDouble(json['min_stock'] ?? json['reorder_level']),
      maxStock: toDouble(json['max_stock'] ?? json['max_order_quantity']),
      storeType: json['store_type'] as String?,
    );
  }
}

class StockRequest {
  final String id;
  final String? requestingBranch;
  final String? status;
  final String? priority;
  final int itemCount;
  final DateTime? createdAt;
  final String? itemName;
  final double? quantity;
  final String? unit;
  final String? requestedBy;

  const StockRequest({
    required this.id,
    this.requestingBranch,
    this.status,
    this.priority,
    this.itemCount = 0,
    this.createdAt,
    this.itemName,
    this.quantity,
    this.unit,
    this.requestedBy,
  });

  /// Serialize to a plain JSON map (skill: flutter-implement-json-serialization).
  Map<String, dynamic> toJson() => {
        'id': id,
        'request_number': id,
        'requesting_branch': requestingBranch,
        'status': status,
        'priority': priority,
        'items_count': itemCount,
        'created_at': createdAt?.toIso8601String(),
        'item_name': itemName,
        'quantity': quantity,
        'unit': unit,
        'requested_by': requestedBy,
      };

  factory StockRequest.fromJson(Map<String, dynamic> json) {
    final items =
        json['items'] as List? ?? json['request_items'] as List? ?? [];
    return StockRequest(
      id: '${json['id']}',
      requestingBranch: json['branch_name'] as String? ??
          json['requesting_branch'] as String?,
      status: '${json['status']}',
      priority: json['priority'] as String?,
      itemCount: items.length,
      createdAt: DateTime.tryParse('${json['created_at'] ?? ''}'),
      itemName: json['item_name'] as String? ?? json['name'] as String?,
      quantity:
          (json['quantity'] ?? json['requested_quantity'] as num?)?.toDouble(),
      unit: json['unit'] as String? ?? json['unit_of_measure'] as String?,
      requestedBy:
          json['requested_by'] as String? ?? json['staff_name'] as String?,
    );
  }
}

class Supplier {
  final String id;
  final String name;
  final String? contactPerson;
  final String? phone;
  final String? email;
  final String? status;

  const Supplier({
    required this.id,
    required this.name,
    this.contactPerson,
    this.phone,
    this.email,
    this.status,
  });

  factory Supplier.fromJson(Map<String, dynamic> json) {
    return Supplier(
      id: '${json['id'] ?? json['supplier_id'] ?? ''}',
      name: '${json['name'] ?? json['supplier_name'] ?? ''}',
      contactPerson: json['contact_person'] as String?,
      phone: json['phone'] as String? ?? json['phone_number'] as String?,
      email: json['email'] as String?,
      status: json['status'] as String?,
    );
  }
}
