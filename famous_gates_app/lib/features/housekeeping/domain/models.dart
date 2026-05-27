class HkRoom {
  final String id;
  final int number;
  final String status;
  final String? assignedTo;

  const HkRoom({
    required this.id,
    required this.number,
    this.status = 'dirty',
    this.assignedTo,
  });

  factory HkRoom.fromJson(Map<String, dynamic> json) {
    return HkRoom(
      id: '${json['id']}',
      number: (json['number'] as num?)?.toInt() ??
          (json['room_number'] as num?)?.toInt() ??
          0,
      status: '${json['status'] ?? 'dirty'}',
      assignedTo: json['assigned_to'] as String?,
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
    return HkTask(
      id: '${json['id']}',
      roomNumber:
          json['room_number'] as String? ?? json['roomNumber'] as String?,
      taskType: '${json['task_type'] ?? json['type'] ?? 'cleaning'}',
      status: '${json['status'] ?? 'pending'}',
      assignedTo: json['assigned_to'] as String?,
      priority: json['priority'] as String?,
      createdAt:
          DateTime.tryParse('${json['created_at'] ?? json['createdAt']}') ??
              DateTime.now(),
    );
  }
}
