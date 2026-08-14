import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/notification_icon.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../data/admin_repository.dart';
import '../../data/models/notification.dart';
import '../../domain/admin_providers.dart';

class NotificationDrawer extends ConsumerStatefulWidget {
  const NotificationDrawer({super.key});

  @override
  ConsumerState<NotificationDrawer> createState() => _NotificationDrawerState();
}

class _NotificationDrawerState extends ConsumerState<NotificationDrawer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 250),
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(1, 0),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic));
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _markAllRead() async {
    try {
      await ref.read(adminRepositoryProvider).markAllNotificationsRead();
      ref.invalidate(adminNotificationsProvider);
      ref.invalidate(unreadNotifCountProvider);
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          SnackBar(content: Text('Failed to mark all as read: $e')),
        );
      }
    }
  }

  String _timeAgo(DateTime? dateTime) {
    if (dateTime == null) return '';
    final now = DateTime.now();
    final diff = now.difference(dateTime);
    if (diff.inSeconds < 60) return '${diff.inSeconds}s ago';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 30) return '${diff.inDays}d ago';
    return '${(diff.inDays / 30).floor()}mo ago';
  }

  // Icon/color now come from notificationIconStyle() (see
  // lib/core/utils/notification_icon.dart) instead of a local type-only
  // switch — this used to render the same generic icon for nearly every
  // notification because the backend sends type: 'info' for most events
  // (void acknowledgment, recall, etc); category disambiguates them.

  void _dismiss() {
    _controller.reverse().then((_) {
      if (mounted) Navigator.of(context).pop();
    });
  }

  @override
  Widget build(BuildContext context) {
    final notificationsAsync = ref.watch(adminNotificationsProvider);
    final screenHeight = MediaQuery.of(context).size.height;

    return GestureDetector(
      onTap: _dismiss,
      child: Container(
        color: Colors.black.withValues(alpha: 0.3),
        child: Align(
          alignment: Alignment.centerRight,
          child: GestureDetector(
            onTap: () {},
            child: SlideTransition(
              position: _slideAnimation,
              child: Material(
                elevation: 8,
                child: Container(
                  width: 300,
                  height: screenHeight,
                  color: Colors.white,
                  child: Column(
                    children: [
                      _buildHeader(),
                      const Divider(height: 1, color: AppColors.kDivider),
                      Expanded(
                        child: notificationsAsync.when(
                          loading: () =>
                              const LoadingSkeleton(type: SkeletonType.list),
                          error: (error, stack) => ErrorState(
                            message: '$error',
                            onRetry: () =>
                                ref.invalidate(adminNotificationsProvider),
                          ),
                          data: (notifications) {
                            if (notifications.isEmpty) {
                              return Center(
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(PhosphorIcons.bell(),
                                        size: 48, color: AppColors.kDivider),
                                    const SizedBox(height: 12),
                                    const Text('No notifications',
                                        style: TextStyle(
                                            color: AppColors.kTextSecondary)),
                                  ],
                                ),
                              );
                            }
                            return ListView.separated(
                              padding: EdgeInsets.zero,
                              itemCount: notifications.length,
                              separatorBuilder: (_, __) => const Divider(
                                  height: 1,
                                  indent: 56,
                                  color: AppColors.kDivider),
                              itemBuilder: (context, index) {
                                final notif = notifications[index];
                                final style = notificationIconStyle(
                                  category: notif.category,
                                  type: notif.type,
                                );
                                return _NotificationItem(
                                  notification: notif,
                                  icon: style.icon,
                                  color: style.color,
                                  timeAgo: _timeAgo(notif.createdAt),
                                  onTap: () async {
                                    if (!notif.isRead) {
                                      await ref
                                          .read(adminRepositoryProvider)
                                          .markNotificationRead(notif.id);
                                      ref.invalidate(
                                          adminNotificationsProvider);
                                      ref.invalidate(unreadNotifCountProvider);
                                    }
                                  },
                                );
                              },
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          const Text('Notifications',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppColors.kTextPrimary)),
          const Spacer(),
          Consumer(
            builder: (context, ref, _) {
              final countAsync = ref.watch(unreadNotifCountProvider);
              return countAsync.when(
                data: (count) => Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                      color: AppColors.kPrimary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10)),
                  child: Text('$count',
                      style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.kPrimary)),
                ),
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
              );
            },
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: _markAllRead,
            child: const Text('Mark all read',
                style: TextStyle(
                    fontSize: 12,
                    color: AppColors.kPrimary,
                    fontWeight: FontWeight.w500)),
          ),
          const SizedBox(width: 4),
          GestureDetector(
            onTap: _dismiss,
            child: Icon(PhosphorIcons.x(),
                size: 18, color: AppColors.kTextSecondary),
          ),
        ],
      ),
    );
  }
}

class _NotificationItem extends StatelessWidget {
  final AdminNotification notification;
  final IconData icon;
  final Color color;
  final String timeAgo;
  final VoidCallback? onTap;

  const _NotificationItem({
    required this.notification,
    required this.icon,
    required this.color,
    required this.timeAgo,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 16),
            child: Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8)),
              child: Icon(icon, size: 16, color: color),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(0, 12, 16, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          notification.title,
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: AppColors.kTextPrimary),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (!notification.isRead)
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                              color: AppColors.kPrimary,
                              shape: BoxShape.circle),
                        ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    notification.message,
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.kTextSecondary),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(timeAgo,
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.kDivider)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
