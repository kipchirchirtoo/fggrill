class AuditOverview {
  final int voidBills;
  final int priceOverrides;
  final int largeDiscounts;
  final int pendingApprovals;

  const AuditOverview({
    this.voidBills = 0,
    this.priceOverrides = 0,
    this.largeDiscounts = 0,
    this.pendingApprovals = 0,
  });

  factory AuditOverview.fromJson(Map<String, dynamic> json) {
    return AuditOverview(
      voidBills:
          (json['void_bills'] ?? json['voided_transactions'] ?? 0).toInt(),
      priceOverrides:
          (json['price_overrides'] ?? json['overrides'] ?? 0).toInt(),
      largeDiscounts:
          (json['large_discounts'] ?? json['discounts'] ?? 0).toInt(),
      pendingApprovals: (json['pending_approvals'] ?? 0).toInt(),
    );
  }
}

class AuditLogEntry {
  final String id;
  final String action;
  final String? description;
  final String? userName;
  final String? severity;
  final DateTime? createdAt;

  const AuditLogEntry({
    required this.id,
    required this.action,
    this.description,
    this.userName,
    this.severity,
    this.createdAt,
  });

  factory AuditLogEntry.fromJson(Map<String, dynamic> json) {
    return AuditLogEntry(
      id: '${json['id']}',
      action: '${json['action'] ?? json['type'] ?? ''}',
      description: json['description'] as String? ?? json['details'] as String?,
      userName: json['user_name'] as String? ?? json['user'] as String?,
      severity: json['severity'] as String? ?? json['level'] as String?,
      createdAt:
          DateTime.tryParse('${json['created_at'] ?? json['timestamp'] ?? ''}'),
    );
  }
}

class Discrepancy {
  final String id;
  final String type;
  final String description;
  final String? userName;
  final String? amount;
  final String status;
  final DateTime? date;

  const Discrepancy({
    required this.id,
    required this.type,
    required this.description,
    this.userName,
    this.amount,
    this.status = 'open',
    this.date,
  });

  factory Discrepancy.fromJson(Map<String, dynamic> json) {
    return Discrepancy(
      id: '${json['id']}',
      type: '${json['type'] ?? json['category'] ?? ''}',
      description: '${json['description'] ?? json['reason'] ?? ''}',
      userName: json['user_name'] as String? ?? json['cashier'] as String?,
      amount: json['amount'] != null ? 'KES ${json['amount']}' : null,
      status: '${json['status'] ?? 'open'}',
      date: DateTime.tryParse('${json['date'] ?? json['created_at'] ?? ''}'),
    );
  }
}
