import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../services/connectivity_service.dart';
import '../database/app_database.dart';
import '../theme/app_theme.dart';

final syncStatusBadgeProvider = Provider<SyncStatusBadgeData>((ref) {
  final online = ref.watch(isOnlineProvider).valueOrNull ?? true;
  final pending = ref.watch(pendingSyncCountProvider).valueOrNull ?? 0;
  return SyncStatusBadgeData(isOnline: online, pendingCount: pending);
});

final pendingSyncCountProvider = StreamProvider<int>((ref) {
  return ref.watch(appDatabaseProvider).offlineSalesDao.watchPendingCount();
});

class SyncStatusBadgeData {
  const SyncStatusBadgeData({
    required this.isOnline,
    required this.pendingCount,
  });

  final bool isOnline;
  final int pendingCount;
}

class SyncStatusBadge extends ConsumerWidget {
  const SyncStatusBadge({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(syncStatusBadgeProvider);

    Color color;
    String text;
    IconData icon;

    if (!status.isOnline) {
      color = AppColors.kError;
      text = 'Offline';
      icon = PhosphorIcons.wifiSlash();
    } else if (status.pendingCount > 0) {
      color = AppColors.kWarning;
      text = '${status.pendingCount} pending';
      icon = PhosphorIcons.arrowsClockwise();
    } else {
      color = AppColors.kSuccess;
      text = 'Synced';
      icon = PhosphorIcons.wifiHigh();
    }

    if (compact) {
      return Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      );
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 6),
        Text(
          text,
          style: TextStyle(
            color: color,
            fontWeight: FontWeight.bold,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}
