import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/domain/auth_notifier.dart';
import '../../features/auth/domain/models.dart';
import '../realtime/realtime_service.dart';
import '../theme/app_theme.dart';
import '../utils/notification_icon.dart';

/// Wraps the whole app (mounted once in main.dart) to surface real-time
/// notification cards — order ready, bill recalled, item voided — as
/// stacked cards in the top-right corner, on top of whatever screen is
/// active (including the Unified POS station).
///
/// Only ever shows events received live through
/// RealtimeService.watchNotifications() *after* this widget subscribes —
/// it never replays the existing unread backlog from GET /notifications
/// (that's what the bell/drawer/inbox are for). The toast queue is reset
/// whenever the logged-in user changes (fresh login, or switching accounts
/// on a shared terminal), so nothing from a previous session lingers.
class NotificationToastOverlay extends ConsumerStatefulWidget {
  const NotificationToastOverlay({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<NotificationToastOverlay> createState() =>
      _NotificationToastOverlayState();
}

class _ToastEntry {
  _ToastEntry(this.event);
  final NotificationRealtimeEvent event;
}

class _NotificationToastOverlayState
    extends ConsumerState<NotificationToastOverlay> {
  final List<_ToastEntry> _toasts = [];
  StreamSubscription<NotificationRealtimeEvent>? _subscription;
  String? _subscribedUserId;

  static const _maxVisible = 4;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authNotifierProvider).valueOrNull;

    // Re-subscribes whenever the signed-in user changes. Cheap to check on
    // every build (only actually resubscribes on an id change) and is what
    // makes the toast queue reset on login/logout/account-switch without
    // needing a separate lifecycle hook.
    if (user?.id != _subscribedUserId) {
      debugPrint('🍞 NotificationToastOverlay: build() sees user.id=${user?.id} '
          '!= _subscribedUserId=$_subscribedUserId, resubscribing');
      _resubscribe(user);
    }

    return Stack(
      children: [
        widget.child,
        if (_toasts.isNotEmpty)
          Positioned(
            top: 0,
            right: 0,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 380),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: _toasts
                        .take(_maxVisible)
                        .map(
                          (t) => _ToastCard(
                            key: ValueKey(
                              t.event.id.isEmpty
                                  ? t.hashCode.toString()
                                  : t.event.id,
                            ),
                            event: t.event,
                            onDismiss: () => _dismiss(t),
                          ),
                        )
                        .toList(),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  void _resubscribe(User? user) {
    _subscription?.cancel();
    _subscription = null;
    _subscribedUserId = user?.id;
    _toasts.clear();

    if (user == null || user.id.isEmpty) return;

    final branchId = int.tryParse(user.branchId);
    debugPrint('🍞 NotificationToastOverlay: subscribing for userId=${user.id} '
        'role=${user.role} branchId=$branchId');
    final stream = ref.read(realtimeServiceProvider).watchNotifications(
          userId: user.id,
          role: user.role,
          branchId: branchId,
        );
    _subscription = stream.listen(
      (event) {
        debugPrint('🍞 NotificationToastOverlay: received event "${event.title}", '
            'mounted=$mounted, showing toast');
        if (!mounted) return;
        // Stays until the waiter dismisses it (tap the X) or logs
        // in/out — no auto-dismiss timer. These are actionable alerts
        // (order ready, recall, void), not transient snackbar-style toasts.
        setState(() => _toasts.insert(0, _ToastEntry(event)));
      },
      onError: (Object error) {
        debugPrint('🍞 NotificationToastOverlay: stream error: $error');
      },
    );
  }

  void _dismiss(_ToastEntry entry) {
    setState(() => _toasts.remove(entry));
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}

class _ToastCard extends StatelessWidget {
  const _ToastCard({super.key, required this.event, required this.onDismiss});

  final NotificationRealtimeEvent event;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final style = notificationIconStyle(
      category: event.category,
      type: event.type,
    );

    // This card lives in a Positioned inside NotificationToastOverlay's own
    // Stack — a sibling of the routed page content, not a descendant of
    // whatever Scaffold that page happens to have. InkWell (the dismiss
    // button below) requires a Material ancestor to paint its splash/ink
    // response; without wrapping here it throws "No Material widget found"
    // the moment a card is built. `transparency` keeps this invisible —
    // the actual card chrome still comes from the DecoratedBox below.
    return Material(
      type: MaterialType.transparency,
      child: Container(
      margin: const EdgeInsets.only(top: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border(left: BorderSide(color: style.color, width: 4)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 14,
            offset: Offset(0, 6),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: style.color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(style.icon, color: style.color, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  event.title,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                    color: style.color,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  event.message,
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: AppColors.kTextPrimary,
                  ),
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          InkWell(
            onTap: onDismiss,
            borderRadius: BorderRadius.circular(12),
            child: const Padding(
              padding: EdgeInsets.all(4),
              child: Icon(Icons.close, size: 16, color: AppColors.kTextSecondary),
            ),
          ),
        ],
      ),
      ),
    );
  }
}
