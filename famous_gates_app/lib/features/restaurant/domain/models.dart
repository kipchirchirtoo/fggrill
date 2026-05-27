class CreateRestaurantOrderRequest {
  final String orderType;
  final String tableNumber;
  final String roomNumber;
  final String customerName;
  final String paymentMethod;
  final String? waiterId;
  final String? waiterName;
  final List<RestaurantOrderItem> items;
  final double total;

  const CreateRestaurantOrderRequest({
    required this.orderType,
    this.tableNumber = '',
    this.roomNumber = '',
    this.customerName = '',
    this.paymentMethod = 'cash',
    this.waiterId,
    this.waiterName,
    required this.items,
    required this.total,
  });

  int get subtotal => (total / 1.16).round();
  double get tax => total - subtotal;

  Map<String, dynamic> toJson() => {
        'order_type': orderType,
        if (orderType == 'dine_in') 'table_number': tableNumber,
        if (orderType == 'room_service') 'room_number': roomNumber,
        if (customerName.isNotEmpty) 'customer_name': customerName,
        'payment_method': paymentMethod,
        if (waiterId != null && waiterId!.isNotEmpty) 'waiter_id': waiterId,
        if (waiterName != null && waiterName!.isNotEmpty)
          'waiter_name': waiterName,
        'items': items.map((i) => i.toJson()).toList(),
        'subtotal': subtotal,
        'tax': tax,
        'total': total,
        'status': 'pending',
      };
}

class RestaurantOrderItem {
  final String id;
  final String name;
  final int quantity;
  final double unitPrice;

  const RestaurantOrderItem({
    required this.id,
    required this.name,
    this.quantity = 1,
    this.unitPrice = 0,
  });

  Map<String, dynamic> toJson() => {
        'menu_item_id': id,
        'name': name,
        'quantity': quantity,
        'unit_price': unitPrice,
        'total_amount': unitPrice * quantity,
      };
}

class RestaurantOrder {
  final String id;
  final String orderNumber;
  final String orderType;
  final String status;
  final String? tableNumber;
  final String? roomNumber;
  final String? waiterName;
  final double total;
  final DateTime createdAt;

  const RestaurantOrder({
    required this.id,
    required this.orderNumber,
    required this.orderType,
    required this.status,
    this.tableNumber,
    this.roomNumber,
    this.waiterName,
    this.total = 0,
    required this.createdAt,
  });

  factory RestaurantOrder.fromJson(Map<String, dynamic> json) {
    return RestaurantOrder(
      id: '${json['id']}',
      orderNumber:
          '${json['order_number'] ?? json['orderNumber'] ?? json['id']}',
      orderType: '${json['order_type'] ?? 'dine_in'}',
      status: '${json['status'] ?? 'pending'}',
      tableNumber: json['table_number']?.toString(),
      roomNumber: json['room_number']?.toString(),
      waiterName: json['waiter_name'] as String?,
      total: (json['total'] as num?)?.toDouble() ??
          (json['total_amount'] as num?)?.toDouble() ??
          0,
      createdAt:
          DateTime.tryParse('${json['created_at'] ?? json['createdAt']}') ??
              DateTime.now(),
    );
  }
}
