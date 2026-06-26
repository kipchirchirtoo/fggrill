class ReconciliationAuditEvent {
  final String id;
  final String eventType;
  final String description;
  final String? userId;
  final String? userName;
  final DateTime timestamp;

  ReconciliationAuditEvent({
    required this.id,
    required this.eventType,
    required this.description,
    this.userId,
    this.userName,
    required this.timestamp,
  });

  factory ReconciliationAuditEvent.fromJson(Map<String, dynamic> json) {
    return ReconciliationAuditEvent(
      id: json['id'] ?? '',
      eventType: json['event_type'] ?? '',
      description: json['description'] ?? '',
      userId: json['user_id'],
      userName: json['user_name'],
      timestamp: json['timestamp'] != null
          ? DateTime.parse(json['timestamp'])
          : DateTime.now(),
    );
  }
}
