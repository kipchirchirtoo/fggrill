import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/admin/domain/admin_providers.dart';
import '../../features/admin/presentation/widgets/notification_drawer.dart';
import '../theme/app_theme.dart';

class AppNotificationButton extends ConsumerWidget {
  const AppNotificationButton({super.key, this.iconColor});

  final Color? iconColor;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final countAsync = ref.watch(unreadNotifCountProvider);
    final count = countAsync.valueOrNull ?? 0;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        IconButton(
          onPressed: () => showAppNotificationPanel(context, ref),
          tooltip: 'Notifications',
          // Uses Flutter's own Icons.notifications constant directly rather
          // than routing through the hand-rolled phosphor_flutter_compat
          // shim (packages/phosphor_flutter_compat) — that shim maps every
          // icon to a raw MaterialIcons codepoint by hand, and a
          // mismapped/mis-rendering entry there was indistinguishable from
          // a real bell at a glance. This constant is verified by the SDK
          // itself, removing that whole class of doubt.
          icon: Icon(
            count > 0 ? Icons.notifications_active : Icons.notifications_none,
            color: count > 0 ? AppColors.kAccent : iconColor,
            size: 22,
          ),
        ),
        if (count > 0)
          Positioned(
            right: 6,
            top: 6,
            child: Container(
              constraints: const BoxConstraints(minWidth: 17, minHeight: 17),
              padding: const EdgeInsets.symmetric(horizontal: 4),
              decoration: const BoxDecoration(
                color: AppColors.kError,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Text(
                count > 99 ? '99+' : '$count',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 9,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

Future<void> showAppNotificationPanel(BuildContext context, WidgetRef ref) {
  ref.invalidate(adminNotificationsProvider);
  ref.invalidate(unreadNotifCountProvider);
  return showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Notifications',
    barrierColor: Colors.transparent,
    transitionDuration: const Duration(milliseconds: 160),
    pageBuilder: (_, __, ___) => const NotificationDrawer(),
  );
}
