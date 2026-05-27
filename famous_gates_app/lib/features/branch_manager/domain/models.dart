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
    return BranchManagerStats(
      todayRevenue: (json['today_revenue'] ?? json['revenue'] ?? 0).toDouble(),
      activeOrders: (json['active_orders'] ?? json['orders'] ?? 0).toInt(),
      occupancyRate:
          (json['occupancy_rate'] ?? json['occupancy'] ?? 0).toDouble(),
      lowStockItems:
          (json['low_stock_items'] ?? json['low_stock'] ?? 0).toInt(),
      totalRooms: (json['total_rooms'] ?? 0).toInt(),
      occupiedRooms: (json['occupied_rooms'] ?? 0).toInt(),
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
