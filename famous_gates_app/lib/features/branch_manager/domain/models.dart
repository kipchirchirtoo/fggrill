class BranchManagerStats {
  final double todayRevenue;
  final int activeOrders;
  final double occupancyRate;
  final int lowStockItems;
  final int totalRooms;
  final int occupiedRooms;

  const BranchManagerStats({
    this.todayRevenue = 0,
    this.activeOrders = 0,
    this.occupancyRate = 0,
    this.lowStockItems = 0,
    this.totalRooms = 0,
    this.occupiedRooms = 0,
  });

  factory BranchManagerStats.fromJson(Map<String, dynamic> json) {
    num asNum(List<String> keys) {
      for (final key in keys) {
        final value = json[key];
        if (value is num) return value;
        if (value is String) return num.tryParse(value) ?? 0;
      }
      return 0;
    }

    return BranchManagerStats(
      todayRevenue:
          asNum(['today_revenue', 'todayRevenue', 'revenue']).toDouble(),
      activeOrders:
          asNum(['active_orders', 'activeOrders', 'orders', 'todayOrders'])
              .toInt(),
      occupancyRate:
          asNum(['occupancy_rate', 'occupancyRate', 'occupancy']).toDouble(),
      lowStockItems:
          asNum(['low_stock_items', 'lowStockItems', 'low_stock']).toInt(),
      totalRooms: asNum(['total_rooms', 'totalRooms']).toInt(),
      occupiedRooms: asNum(['occupied_rooms', 'occupiedRooms']).toInt(),
    );
  }
}

class RecentActivity {
  final String id;
  final String description;
  final String? userName;
  final String? amount;
  final String timeAgo;

  const RecentActivity({
    required this.id,
    required this.description,
    this.userName,
    this.amount,
    this.timeAgo = '',
  });

  factory RecentActivity.fromJson(Map<String, dynamic> json) {
    return RecentActivity(
      id: '${json['id']}',
      description: '${json['description'] ?? json['action'] ?? ''}',
      userName: json['user_name'] as String? ?? json['cashier'] as String?,
      amount: json['amount'] != null ? 'KES ${json['amount']}' : null,
      timeAgo: '${json['time_ago'] ?? json['created_at'] ?? ''}',
    );
  }
}
