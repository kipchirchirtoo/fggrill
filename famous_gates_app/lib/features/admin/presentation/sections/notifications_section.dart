import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../domain/admin_providers.dart';
import 'package:famous_gates_app/features/admin/data/admin_repository.dart';

class NotificationsSection extends ConsumerStatefulWidget {
  const NotificationsSection({super.key});

  @override
  ConsumerState<NotificationsSection> createState() =>
      _NotificationsSectionState();
}

class _NotificationsSectionState extends ConsumerState<NotificationsSection> {
  @override
  Widget build(BuildContext context) {
    final notificationsAsync = ref.watch(adminNotificationsProvider);
    final unreadCountAsync = ref.watch(unreadNotifCountProvider);

    return notificationsAsync.when(
      loading: () => const LoadingSkeleton(type: SkeletonType.list),
      error: (err, _) => ErrorState(
        message: '$err',
        onRetry: () {
          ref.invalidate(adminNotificationsProvider);
          ref.invalidate(unreadNotifCountProvider);
        },
      ),
      data: (notifications) {
        final unreadCount = unreadCountAsync.valueOrNull ??
            notifications.where((n) => !n.isRead).length;

        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(adminNotificationsProvider);
            ref.invalidate(unreadNotifCountProvider);
          },
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: _buildHeader(unreadCount),
                ),
              ),
              if (notifications.isEmpty)
                SliverFillRemaining(
                  child: EmptyState(
                    message: 'No notifications',
                    icon: PhosphorIcons.bell(),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  sliver: SliverList.separated(
                    itemCount: notifications.length,
                    separatorBuilder: (_, __) =>
                        const Divider(height: 1, indent: 72),
                    itemBuilder: (_, i) =>
                        _buildNotificationCard(notifications[i]),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildHeader(int unreadCount) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Notifications',
                style: Theme.of(context).textTheme.displaySmall,
              ),
              if (unreadCount > 0) ...[
                const SizedBox(height: 4),
                Text(
                  '$unreadCount unread notification${unreadCount != 1 ? 's' : ''}',
                  style: const TextStyle(color: AppColors.kTextSecondary),
                ),
              ],
            ],
          ),
        ),
        if (unreadCount > 0) ...[
          TextButton.icon(
            onPressed: () async {
              await ref
                  .read(adminRepositoryProvider)
                  .markAllNotificationsRead();
              if (mounted) {
                ref.invalidate(adminNotificationsProvider);
                ref.invalidate(unreadNotifCountProvider);
                AppNotifier.showSnackBar(
                  context,
                  const SnackBar(
                      content: Text('All notifications marked as read')),
                );
              }
            },
            icon: const Icon(Icons.done_all, size: 18),
            label: const Text('Mark All Read'),
          ),
        ],
      ],
    );
  }

  Widget _buildNotificationCard(dynamic notification) {
    Color iconColor;
    IconData icon;

    switch (notification.type) {
      case 'error':
      case 'alert':
        iconColor = AppColors.kError;
        icon = PhosphorIcons.warning();
        break;
      case 'warning':
        iconColor = AppColors.kWarning;
        icon = PhosphorIcons.warning();
        break;
      case 'success':
        iconColor = AppColors.kSuccess;
        icon = PhosphorIcons.checkCircle();
        break;
      default:
        iconColor = AppColors.kPrimary;
        icon = PhosphorIcons.bell();
    }

    return InkWell(
      onTap: () async {
        if (!notification.isRead) {
          await ref
              .read(adminRepositoryProvider)
              .markNotificationRead(notification.id);
          if (mounted) {
            ref.invalidate(adminNotificationsProvider);
            ref.invalidate(unreadNotifCountProvider);
          }
        }
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: notification.isRead
                        ? AppColors.kSurface
                        : iconColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    icon,
                    color: notification.isRead
                        ? AppColors.kTextSecondary
                        : iconColor,
                    size: 24,
                  ),
                ),
                if (!notification.isRead)
                  Positioned(
                    top: 0,
                    right: 0,
                    child: Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: AppColors.kPrimary,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.kCardBg, width: 2),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    notification.title,
                    style: TextStyle(
                      fontWeight: notification.isRead
                          ? FontWeight.normal
                          : FontWeight.bold,
                      color: notification.isRead
                          ? AppColors.kTextSecondary
                          : AppColors.kTextPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    notification.message,
                    style: const TextStyle(
                        color: AppColors.kTextSecondary, fontSize: 14),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _formatRelativeTime(notification.createdAt),
                    style: const TextStyle(
                        color: AppColors.kTextSecondary, fontSize: 12),
                  ),
                ],
              ),
            ),
            if (!notification.isRead)
              IconButton(
                icon: const Icon(Icons.check,
                    size: 18, color: AppColors.kPrimary),
                onPressed: () async {
                  await ref
                      .read(adminRepositoryProvider)
                      .markNotificationRead(notification.id);
                  if (mounted) {
                    ref.invalidate(adminNotificationsProvider);
                    ref.invalidate(unreadNotifCountProvider);
                  }
                },
                tooltip: 'Mark as read',
              ),
          ],
        ),
      ),
    );
  }

  String _formatRelativeTime(DateTime? time) {
    if (time == null) return 'Some time ago';

    final now = DateTime.now();
    final diff = now.difference(time);

    if (diff.inSeconds < 60) {
      return 'Just now';
    } else if (diff.inMinutes < 60) {
      return '${diff.inMinutes} min ago';
    } else if (diff.inHours < 24) {
      return '${diff.inHours} hour${diff.inHours != 1 ? 's' : ''} ago';
    } else if (diff.inDays < 7) {
      return '${diff.inDays} day${diff.inDays != 1 ? 's' : ''} ago';
    } else {
      return '${time.day}/${time.month}/${time.year} ${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
    }
  }
}
