class HkRoom {
  final String id;
  final int number;
  final String status;
  final String? assignedTo;

  const HkRoom({
    required this.id,
    required this.number,
    this.status = 'vacant_dirty',
    this.assignedTo,
  });

  factory HkRoom.fromJson(Map<String, dynamic> json) {
    return HkRoom(
      id: '${json['id']}',
      number: _intValue(json['number'] ?? json['room_number']),
      status: '${json['hk_status'] ?? json['status'] ?? 'vacant_dirty'}',
      assignedTo: json['assigned_to'] as String? ??
          json['assigned_attendant_id'] as String?,
    );
  }
}

class HkTask {
  final String id;
  final String? roomNumber;
  final String taskType;
  final String status;
  final String? assignedTo;
  final String? priority;
  final DateTime createdAt;

  const HkTask({
    required this.id,
    this.roomNumber,
    this.taskType = 'cleaning',
    this.status = 'pending',
    this.assignedTo,
    this.priority,
    required this.createdAt,
  });

  factory HkTask.fromJson(Map<String, dynamic> json) {
    final assignee = json['assignee'];
    return HkTask(
      id: '${json['id']}',
      roomNumber: json['room_number'] == null && json['roomNumber'] == null
          ? null
          : '${json['room_number'] ?? json['roomNumber']}',
      taskType: '${json['task_type'] ?? json['type'] ?? 'cleaning'}',
      status: '${json['status'] ?? 'pending'}',
      assignedTo: json['assigned_to'] as String? ??
          (assignee is Map ? assignee['staff_code'] as String? : null),
      priority: json['priority'] as String?,
      createdAt:
          DateTime.tryParse('${json['created_at'] ?? json['createdAt']}') ??
              DateTime.now(),
    );
  }
}

int _intValue(dynamic value) {
  if (value is num) return value.toInt();
  return int.tryParse('$value') ?? 0;
}
