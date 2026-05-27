class WorkOrder {
  final String id;
  final String title;
  final String? description;
  final String? roomNumber;
  final String status;
  final String? priority;
  final String? requestedBy;
  final DateTime createdAt;

  const WorkOrder({
    required this.id,
    required this.title,
    this.description,
    this.roomNumber,
    this.status = 'pending',
    this.priority,
    this.requestedBy,
    required this.createdAt,
  });

  factory WorkOrder.fromJson(Map<String, dynamic> json) {
    return WorkOrder(
      id: '${json['id']}',
      title: '${json['title'] ?? json['name'] ?? json['description'] ?? ''}',
      description: json['description'] as String? ?? json['notes'] as String?,
      roomNumber:
          json['room_number'] as String? ?? json['roomNumber'] as String?,
      status: '${json['status'] ?? 'pending'}',
      priority: json['priority'] as String?,
      requestedBy: json['requested_by'] as String?,
      createdAt:
          DateTime.tryParse('${json['created_at'] ?? json['createdAt']}') ??
              DateTime.now(),
    );
  }
}
