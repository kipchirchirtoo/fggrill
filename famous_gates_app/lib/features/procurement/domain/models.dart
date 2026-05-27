class ProcurementItem {
  final String id;
  final String description;
  final int quantity;
  final String unit;
  final double estimatedCost;
  final String status;
  final String supplierId;
  final String createdAt;

  const ProcurementItem({
    required this.id,
    required this.description,
    this.quantity = 0,
    this.unit = '',
    this.estimatedCost = 0,
    this.status = '',
    this.supplierId = '',
    this.createdAt = '',
  });

  factory ProcurementItem.fromJson(Map<String, dynamic> json) {
    return ProcurementItem(
      id: '${json['id'] ?? ''}',
      description: '${json['description'] ?? json['name'] ?? ''}',
      quantity: (json['quantity'] ?? 0).toInt(),
      unit: '${json['unit'] ?? ''}',
      estimatedCost: (json['estimated_cost'] ?? json['cost'] ?? 0).toDouble(),
      status: '${json['status'] ?? ''}',
      supplierId: '${json['supplier_id'] ?? ''}',
      createdAt: '${json['created_at'] ?? ''}',
    );
  }
}

class PurchaseOrder {
  final String id;
  final String supplierId;
  final String supplierName;
  final List<Map<String, dynamic>> items;
  final double total;
  final String status;
  final String createdAt;

  const PurchaseOrder({
    required this.id,
    this.supplierId = '',
    this.supplierName = '',
    this.items = const [],
    this.total = 0,
    this.status = '',
    this.createdAt = '',
  });

  factory PurchaseOrder.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'];
    final parsedItems = rawItems is List
        ? rawItems
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList()
        : <Map<String, dynamic>>[];
    return PurchaseOrder(
      id: '${json['id'] ?? ''}',
      supplierId: '${json['supplier_id'] ?? ''}',
      supplierName: '${json['supplier_name'] ?? json['supplier'] ?? ''}',
      items: parsedItems,
      total: (json['total'] ?? json['total_amount'] ?? 0).toDouble(),
      status: '${json['status'] ?? ''}',
      createdAt: '${json['created_at'] ?? ''}',
    );
  }
}

class ProcurementSupplier {
  final String id;
  final String name;
  final String email;
  final String phone;
  final String category;

  const ProcurementSupplier({
    required this.id,
    required this.name,
    this.email = '',
    this.phone = '',
    this.category = '',
  });

  factory ProcurementSupplier.fromJson(Map<String, dynamic> json) {
    return ProcurementSupplier(
      id: '${json['id'] ?? ''}',
      name: '${json['name'] ?? ''}',
      email: '${json['email'] ?? ''}',
      phone: '${json['phone'] ?? json['phone_number'] ?? ''}',
      category: '${json['category'] ?? ''}',
    );
  }
}
