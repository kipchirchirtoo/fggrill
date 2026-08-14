import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../theme/app_theme.dart';

/// Icon + color for a notification. Single source of truth so the drawer,
/// full-screen inbox, admin section, and the real-time toast overlay all
/// render the same event the same way instead of each guessing separately.
class NotificationIconStyle {
  final IconData icon;
  final Color color;
  const NotificationIconStyle(this.icon, this.color);
}

/// Resolves icon/color for a notification. Prefers [category] — the
/// specific thing that happened (an item was voided, a bill recalled, an
/// order came up ready) — falling back to the generic [type]
/// (info/success/warning/error) only when there's no category, or it's one
/// this app doesn't have a dedicated icon for yet.
///
/// Before this existed, every notification UI switched on `type` alone.
/// Almost everything the backend sends is `type: 'info'` (see
/// backend/src/services/notification.service.ts's callers), so in practice
/// every notification rendered with the exact same generic bell icon
/// regardless of what actually happened — this is what "use correct
/// notification icon" was reporting.
NotificationIconStyle notificationIconStyle({
  required String category,
  required String type,
}) {
  switch (category) {
    // Kitchen finished the order — see notifyWaiterCaptainOrderReady /
    // notifyDineInOrderReady in backend/src/routes/restaurant.routes.ts.
    // 'restaurant_order' is the older category value notifyWaiterCaptainOrderReady
    // already used before 'kds_ready' was introduced — same event, kept for
    // notifications created before this change.
    case 'kds_ready':
    case 'restaurant_order':
      return NotificationIconStyle(
        PhosphorIcons.bellRinging(PhosphorIconsStyle.fill),
        AppColors.kSuccess,
      );

    // A waiter recalled a bill — kitchen needs to re-prepare changed items.
    // See updateShiftOrder in backend/src/controllers/outlet-pos.controller.ts.
    case 'kds_recall':
      return NotificationIconStyle(
        PhosphorIcons.arrowsCounterClockwise(),
        AppColors.kWarning,
      );

    // Item/whole-bill void request lifecycle (requested/acknowledged/
    // approved/rejected) — see KITCHEN_VOID_NOTIFY_ROLES call sites and
    // cashierAcknowledgeItemVoid/approveItemVoidRequest/rejectItemVoidRequest
    // in backend/src/controllers/outlet-pos.controller.ts.
    case 'pos_item_void_request':
    case 'pos_void_request':
      return NotificationIconStyle(PhosphorIcons.prohibit(), AppColors.kError);

    case 'pos_item_exchange_request':
      return NotificationIconStyle(
        PhosphorIcons.arrowsClockwise(),
        AppColors.kAccent,
      );

    case 'update':
    case 'app_update':
    case 'desktop_update':
      return NotificationIconStyle(
        PhosphorIcons.downloadSimple(),
        AppColors.kAccent,
      );
  }

  switch (type) {
    case 'success':
      return NotificationIconStyle(PhosphorIcons.checkCircle(), AppColors.kSuccess);
    case 'warning':
      return NotificationIconStyle(PhosphorIcons.warning(), AppColors.kWarning);
    case 'error':
      return NotificationIconStyle(PhosphorIcons.warningCircle(), AppColors.kError);
    default:
      return NotificationIconStyle(PhosphorIcons.bellRinging(), AppColors.kPrimary);
  }
}
