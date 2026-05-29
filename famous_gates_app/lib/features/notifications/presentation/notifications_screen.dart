import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../admin/data/admin_repository.dart';
import '../../admin/data/models/notification.dart';
import '../../admin/domain/admin_providers.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  String _status = 'ALL';
  String _priority = 'ALL';
  String _category = 'ALL';
  late Future<List<AdminNotification>> _future = _load();

  Future<List<AdminNotification>> _load() {
    return ref.read(adminRepositoryProvider).getNotifications(
          status: _status,
          priority: _priority,
          category: _category,
        );
  }

  void _refresh() {
    setState(() => _future = _load());
    ref.invalidate(unreadNotifCountProvider);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
        actions: [
          TextButton.icon(
            onPressed: () async {
              await ref
                  .read(adminRepositoryProvider)
                  .markAllNotificationsRead();
              _refresh();
            },
            icon: const Icon(Icons.done_all, size: 16, color: Colors.white),
            label: const Text('Mark All Read',
                style: TextStyle(color: Colors.white)),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _FilterChips(
                  value: _status,
                  values: const {
                    'ALL': 'All',
                    'unread': 'Unread',
                    'read': 'Read',
                  },
                  onChanged: (value) {
                    _status = value;
                    _refresh();
                  },
                ),
                _FilterChips(
                  value: _priority,
                  values: const {
                    'ALL': 'All priority',
                    'urgent': 'Urgent',
                    'high': 'High',
                    'medium': 'Medium',
                    'low': 'Low',
                  },
                  onChanged: (value) {
                    _priority = value;
                    _refresh();
                  },
                ),
                _FilterChips(
                  value: _category,
                  values: const {
                    'ALL': 'All categories',
                    'restaurant_order': 'Restaurant Orders',
                    'system': 'System',
                    'general': 'General',
                  },
                  onChanged: (value) {
                    _category = value;
                    _refresh();
                  },
                ),
              ],
            ),
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 10, 16, 0),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Notifications are filtered by the backend for your user, role, and branch.',
                style: TextStyle(color: AppColors.kTextSecondary),
              ),
            ),
          ),
          Expanded(
            child: FutureBuilder<List<AdminNotification>>(
              future: _future,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting &&
                    !snapshot.hasData) {
                  return const LoadingSkeleton();
                }
                if (snapshot.hasError) {
                  return ErrorState(
                      message: '${snapshot.error}', onRetry: _refresh);
                }
                final notifications = snapshot.data ?? const [];
                if (notifications.isEmpty) {
                  return const Center(
                    child: Text('No notifications',
                        style: TextStyle(color: AppColors.kTextSecondary)),
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: notifications.length,
                  separatorBuilder: (_, __) => const Divider(),
                  itemBuilder: (context, index) {
                    final n = notifications[index];
                    return Card(
                      margin: EdgeInsets.zero,
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: n.isRead
                              ? AppColors.kSurface
                              : AppColors.kPrimary.withValues(alpha: 0.1),
                          child: Icon(
                            n.type == 'update' ||
                                    n.type == 'app_update' ||
                                    n.type == 'desktop_update'
                                ? PhosphorIcons.downloadSimple()
                                : n.type == 'alert' || n.type == 'warning'
                                    ? PhosphorIcons.warning()
                                    : PhosphorIcons.bellRinging(),
                            color: n.isRead
                                ? AppColors.kTextSecondary
                                : AppColors.kPrimary,
                            size: 20,
                          ),
                        ),
                        title: Text(n.title,
                            style: TextStyle(
                                fontWeight: n.isRead
                                    ? FontWeight.normal
                                    : FontWeight.bold)),
                        subtitle: Text(n.message,
                            maxLines: 2, overflow: TextOverflow.ellipsis),
                        trailing: n.isRead
                            ? null
                            : IconButton(
                                icon: const Icon(Icons.check, size: 18),
                                onPressed: () async {
                                  await ref
                                      .read(adminRepositoryProvider)
                                      .markNotificationRead(n.id);
                                  _refresh();
                                },
                              ),
                        onTap: n.isRead
                            ? null
                            : () async {
                                await ref
                                    .read(adminRepositoryProvider)
                                    .markNotificationRead(n.id);
                                _refresh();
                              },
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterChips extends StatelessWidget {
  const _FilterChips({
    required this.value,
    required this.values,
    required this.onChanged,
  });

  final String value;
  final Map<String, String> values;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 6,
      children: values.entries
          .map(
            (entry) => ChoiceChip(
              label: Text(entry.value),
              selected: value == entry.key,
              onSelected: (_) => onChanged(entry.key),
            ),
          )
          .toList(),
    );
  }
}
