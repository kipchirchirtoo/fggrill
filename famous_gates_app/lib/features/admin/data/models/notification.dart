/// Plain hand-written model (not freezed/json_serializable) — this used to
/// be a @freezed class, but regenerating its .freezed.dart/.g.dart after
/// adding category/priority hit a build_runner/analyzer crash
/// (`Missing implementation of visitDotShorthandPropertyAccess`) that only
/// clears by majoring riverpod_generator -> riverpod_annotation -> riverpod
/// -> flutter_riverpod (a Riverpod 2->3 migration touching the whole app's
/// state management, far outside this change's scope). A plain class needs
/// no codegen at all, so it sidesteps the broken toolchain entirely.
class AdminNotification {
  final String id;
  final String title;
  final String message;
  final String type;
  // Backend always sends this (backend/src/services/notification.service.ts)
  // but it was previously dropped here, which is why every notification
  // rendered with the same generic type-only icon regardless of what
  // actually happened — see lib/core/utils/notification_icon.dart, which
  // maps icons/colors from this field first.
  final String category;
  final String priority;
  final bool isRead;
  final String link;
  final DateTime? createdAt;

  const AdminNotification({
    this.id = '',
    this.title = '',
    this.message = '',
    this.type = 'info',
    this.category = '',
    this.priority = 'medium',
    this.isRead = false,
    this.link = '',
    this.createdAt,
  });

  factory AdminNotification.fromJson(Map<String, dynamic> json) {
    return AdminNotification(
      id: '${json['id'] ?? ''}',
      title: '${json['title'] ?? ''}',
      message: '${json['message'] ?? ''}',
      type: (json['type'] as String?)?.isNotEmpty == true
          ? json['type'] as String
          : 'info',
      category: '${json['category'] ?? ''}',
      priority: (json['priority'] as String?)?.isNotEmpty == true
          ? json['priority'] as String
          : 'medium',
      isRead: json['isRead'] == true,
      link: '${json['link'] ?? ''}',
      createdAt: json['createdAt'] == null
          ? null
          : DateTime.tryParse('${json['createdAt']}'),
    );
  }
}
