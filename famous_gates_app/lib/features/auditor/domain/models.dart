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

// ─────────────────────────────────────────────────────────────────────────────
// Branch-orders / Stock-requests models
// ─────────────────────────────────────────────────────────────────────────────

class StockRequestItem {
  final String id;
  final String requestId;
  final String itemSku;
  final String itemName;
  final String itemUnit;
  final String itemCategory;
  final int requestedQuantity;
  final int approvedQuantity;
  final int currentBranchStock;
  final String status;
  final String? rejectionReason;

  const StockRequestItem({
    required this.id,
    required this.requestId,
    required this.itemSku,
    required this.itemName,
    this.itemUnit = 'units',
    this.itemCategory = '',
    required this.requestedQuantity,
    this.approvedQuantity = 0,
    this.currentBranchStock = 0,
    this.status = 'PENDING_AUDIT',
    this.rejectionReason,
  });

  factory StockRequestItem.fromJson(Map<String, dynamic> json) {
    return StockRequestItem(
      id: '${json['id']}',
      requestId: '${json['request_id'] ?? ''}',
      itemSku: '${json['item_sku'] ?? ''}',
      itemName: '${json['item_name'] ?? json['name'] ?? ''}',
      itemUnit: '${json['item_unit'] ?? json['unit'] ?? 'units'}',
      itemCategory: '${json['item_category'] ?? json['category'] ?? ''}',
      requestedQuantity: _int(json['quantity_requested'] ?? json['requested_quantity'] ?? json['quantity'] ?? 0),
      approvedQuantity: _int(json['quantity_approved'] ?? json['approved_quantity'] ?? 0),
      currentBranchStock: _int(json['current_branch_stock'] ?? 0),
      status: '${json['status'] ?? 'PENDING_AUDIT'}',
      rejectionReason: json['rejection_reason'] as String?,
    );
  }

  static int _int(dynamic v) => v is int ? v : int.tryParse('$v') ?? 0;
}

class StockRequest {
  final String id;
  final String requestNumber;
  final int requestingBranchId;
  final String requestingBranchName;
  final String requestType;
  final String priority;
  final String reason;
  final String status;
  final String? reviewedBy;
  final String? reviewedByName;
  final DateTime? reviewedAt;
  final String? reviewNotes;
  final DateTime createdAt;
  final DateTime? neededByDate;
  final String? auditorId;
  final DateTime? auditedAt;
  final String? auditNotes;
  final List<StockRequestItem> items;

  const StockRequest({
    required this.id,
    required this.requestNumber,
    required this.requestingBranchId,
    this.requestingBranchName = '',
    this.requestType = 'ROUTINE',
    this.priority = 'NORMAL',
    this.reason = '',
    required this.status,
    this.reviewedBy,
    this.reviewedByName,
    this.reviewedAt,
    this.reviewNotes,
    required this.createdAt,
    this.neededByDate,
    this.auditorId,
    this.auditedAt,
    this.auditNotes,
    this.items = const [],
  });

  bool get isPendingAudit =>
      status == 'PENDING_AUDIT' || status == 'PENDING' || status == 'UNDER_REVIEW';
  bool get isApproved => status == 'APPROVED' || status == 'PARTIALLY_APPROVED';
  bool get isRejected => status == 'REJECTED';
  bool get isDispatched =>
      status == 'DISPATCHED' || status == 'SHIPPED' || status == 'IN_TRANSIT';
  bool get isDelivered =>
      status == 'DELIVERED' || status == 'RECEIVED' || status == 'CONFIRMED';

  factory StockRequest.fromJson(Map<String, dynamic> json) {
    final branch = json['requesting_branch'];
    final branchName = (branch is Map ? '${branch['name'] ?? ''}' : '');
    final reviewUser = json['reviewed_by_user'];
    String? reviewedByName;
    if (reviewUser is Map) {
      final first = reviewUser['first_name'] ?? '';
      final last = reviewUser['last_name'] ?? '';
      reviewedByName = '$first $last'.trim();
    }
    final rawItems = json['items'];
    final items = (rawItems is List)
        ? rawItems
            .whereType<Map>()
            .map((e) => StockRequestItem.fromJson(Map<String, dynamic>.from(e)))
            .toList()
        : <StockRequestItem>[];

    return StockRequest(
      id: '${json['id']}',
      requestNumber: '${json['request_number'] ?? ''}',
      requestingBranchId: _int(json['requesting_branch_id'] ?? (branch is Map ? branch['id'] : 0)),
      requestingBranchName: branchName,
      requestType: '${json['request_type'] ?? 'ROUTINE'}',
      priority: '${json['priority'] ?? 'NORMAL'}',
      reason: '${json['reason'] ?? ''}',
      status: '${json['status'] ?? 'PENDING_AUDIT'}',
      reviewedBy: json['reviewed_by'] as String?,
      reviewedByName: reviewedByName,
      reviewedAt: DateTime.tryParse('${json['reviewed_at'] ?? ''}'),
      reviewNotes: json['review_notes'] as String?,
      createdAt: DateTime.tryParse('${json['created_at'] ?? ''}') ?? DateTime.now(),
      neededByDate: DateTime.tryParse('${json['needed_by_date'] ?? ''}'),
      auditorId: json['auditor_id'] as String?,
      auditedAt: DateTime.tryParse('${json['audited_at'] ?? ''}'),
      auditNotes: json['audit_notes'] as String?,
      items: items,
    );
  }

  static int _int(dynamic v) => v is int ? v : int.tryParse('$v') ?? 0;
}

class BranchOrderBranchSummary {
  final int branchId;
  final String branchName;
  final int totalRequests;
  final int pending;
  final int approved;
  final int rejected;
  final int dispatched;
  final int totalItems;

  const BranchOrderBranchSummary({
    required this.branchId,
    required this.branchName,
    this.totalRequests = 0,
    this.pending = 0,
    this.approved = 0,
    this.rejected = 0,
    this.dispatched = 0,
    this.totalItems = 0,
  });

  factory BranchOrderBranchSummary.fromJson(Map<String, dynamic> json) {
    return BranchOrderBranchSummary(
      branchId: _int(json['branch_id'] ?? 0),
      branchName: '${json['branch_name'] ?? ''}',
      totalRequests: _int(json['total_requests'] ?? 0),
      pending: _int(json['pending'] ?? 0),
      approved: _int(json['approved'] ?? 0),
      rejected: _int(json['rejected'] ?? 0),
      dispatched: _int(json['dispatched'] ?? 0),
      totalItems: _int(json['total_items'] ?? 0),
    );
  }

  static int _int(dynamic v) => v is int ? v : int.tryParse('$v') ?? 0;
}

class BranchOrdersSummary {
  final int totalRequests;
  final int pending;
  final int approved;
  final int rejected;
  final int dispatched;
  final int totalItemsRequested;
  final List<BranchOrderBranchSummary> branchSummaries;

  const BranchOrdersSummary({
    this.totalRequests = 0,
    this.pending = 0,
    this.approved = 0,
    this.rejected = 0,
    this.dispatched = 0,
    this.totalItemsRequested = 0,
    this.branchSummaries = const [],
  });

  factory BranchOrdersSummary.fromJson(Map<String, dynamic> json) {
    final list = json['branch_summaries'];
    final summaries = (list is List)
        ? list
            .whereType<Map>()
            .map((e) => BranchOrderBranchSummary.fromJson(Map<String, dynamic>.from(e)))
            .toList()
        : <BranchOrderBranchSummary>[];
    return BranchOrdersSummary(
      totalRequests: _int(json['total_requests'] ?? 0),
      pending: _int(json['pending'] ?? 0),
      approved: _int(json['approved'] ?? 0),
      rejected: _int(json['rejected'] ?? 0),
      dispatched: _int(json['dispatched'] ?? 0),
      totalItemsRequested: _int(json['total_items_requested'] ?? 0),
      branchSummaries: summaries,
    );
  }

  static int _int(dynamic v) => v is int ? v : int.tryParse('$v') ?? 0;
}

class BranchOrdersData {
  final BranchOrdersSummary summary;
  final List<StockRequest> requests;

  const BranchOrdersData({
    required this.summary,
    required this.requests,
  });

  factory BranchOrdersData.fromJson(Map<String, dynamic> json) {
    final summaryRaw = json['summary'];
    final requestsRaw = json['requests'];
    return BranchOrdersData(
      summary: summaryRaw is Map
          ? BranchOrdersSummary.fromJson(Map<String, dynamic>.from(summaryRaw))
          : const BranchOrdersSummary(),
      requests: (requestsRaw is List)
          ? requestsRaw
              .whereType<Map>()
              .map((e) => StockRequest.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : [],
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
