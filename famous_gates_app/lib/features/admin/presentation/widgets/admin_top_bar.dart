import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/admin_providers.dart';
import 'notification_drawer.dart';
import '../../../../features/auth/domain/auth_notifier.dart';

const _allBranchesMenuValue = '__all_branches__';

class AdminTopBar extends ConsumerStatefulWidget {
  final int unreadCount;
  final VoidCallback? onMenuTap;
  final String consoleLabel;

  const AdminTopBar({
    super.key,
    required this.unreadCount,
    this.onMenuTap,
    this.consoleLabel = 'Admin Console',
  });

  @override
  ConsumerState<AdminTopBar> createState() => _AdminTopBarState();
}

class _AdminTopBarState extends ConsumerState<AdminTopBar> {
  @override
  Widget build(BuildContext context) {
    return Container(
      height: 60,
      decoration: BoxDecoration(
        color: Colors.white,
        border: const Border(bottom: BorderSide(color: AppColors.kDivider)),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 4)
        ],
      ),
      child: Row(
        children: [
          if (widget.onMenuTap != null)
            IconButton(
                icon: Icon(PhosphorIcons.listBullets()),
                onPressed: widget.onMenuTap),
          const SizedBox(width: 16),
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
                color: AppColors.kPrimary,
                borderRadius: BorderRadius.circular(6)),
            child: const Center(
                child: Text('FG',
                    style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 10))),
          ),
          const SizedBox(width: 10),
          // Flexible so the label shrinks before the right-side items overflow
          Flexible(
            child: Text(
              'Famous Gates — ${widget.consoleLabel}',
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
            ),
          ),
          const Spacer(),
          _SyncStatusDot(),
          const SizedBox(width: 16),
          _BranchChip(),
          const SizedBox(width: 12),
          _NotificationBell(unreadCount: widget.unreadCount),
          const SizedBox(width: 4),
          _UserAvatarMenu(),
          const SizedBox(width: 12),
        ],
      ),
    );
  }
}

class _SyncStatusDot extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
                color: AppColors.kSuccess, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        const Text('Live',
            style: TextStyle(
                color: AppColors.kSuccess,
                fontSize: 12,
                fontWeight: FontWeight.w500)),
      ],
    );
  }
}

class _BranchChip extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedBranchId = ref.watch(adminSelectedBranchProvider);
    final branchesAsync = ref.watch(adminBranchesProvider);
    return branchesAsync.when(
      data: (branches) {
        final selected =
            branches.where((b) => b.id == selectedBranchId).firstOrNull;
        return PopupMenuButton<String>(
          tooltip: 'Select audit branch',
          initialValue: selectedBranchId ?? _allBranchesMenuValue,
          onSelected: (value) => ref
              .read(adminSelectedBranchProvider.notifier)
              .state = value == _allBranchesMenuValue ? null : value,
          itemBuilder: (context) => [
            const PopupMenuItem<String>(
              value: _allBranchesMenuValue,
              child: Text('All Branches'),
            ),
            for (final branch in branches)
              PopupMenuItem<String>(
                value: branch.id,
                child: Text(branch.name),
              ),
          ],
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 190),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.kPrimary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(PhosphorIcons.buildings(),
                      size: 14, color: AppColors.kPrimary),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      selected?.name ?? 'All Branches',
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                      style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: AppColors.kPrimary),
                    ),
                  ),
                  const SizedBox(width: 4),
                  Icon(PhosphorIcons.caretDown(),
                      size: 12, color: AppColors.kPrimary),
                ],
              ),
            ),
          ),
        );
      },
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}

class _NotificationBell extends ConsumerStatefulWidget {
  final int unreadCount;
  const _NotificationBell({required this.unreadCount});

  @override
  ConsumerState<_NotificationBell> createState() => _NotificationBellState();
}

class _NotificationBellState extends ConsumerState<_NotificationBell> {
  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        IconButton(
          icon: Icon(PhosphorIcons.bell(), size: 22),
          onPressed: () => showDialog(
              context: context, builder: (_) => const NotificationDrawer()),
        ),
        if (widget.unreadCount > 0)
          Positioned(
            right: 6,
            top: 6,
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: const BoxDecoration(
                  color: AppColors.kError, shape: BoxShape.circle),
              constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
              child: Text('${widget.unreadCount}',
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center),
            ),
          ),
      ],
    );
  }
}

class _UserAvatarMenu extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authNotifierProvider).valueOrNull;
    final displayName = user?.name.isNotEmpty == true ? user!.name : 'User';
    final role = _roleLabel(user?.role ?? 'user');
    final initials = _initials(displayName);
    return PopupMenuButton<String>(
      offset: const Offset(0, 44),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      onSelected: (value) {
        if (value == 'logout') {
          ref.read(authNotifierProvider.notifier).logout();
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          color: AppColors.kSurface,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircleAvatar(
              radius: 14,
              backgroundColor: AppColors.kPrimary,
              child: Text(initials,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.bold)),
            ),
            const SizedBox(width: 8),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 120),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(displayName,
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                      style: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w600)),
                  Text(role,
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                      style: const TextStyle(
                          fontSize: 10, color: AppColors.kTextSecondary)),
                ],
              ),
            ),
            const SizedBox(width: 4),
            Icon(PhosphorIcons.trendDown(), size: 12),
          ],
        ),
      ),
      itemBuilder: (_) => [
        PopupMenuItem(
            value: 'logout',
            child: ListTile(
                leading: Icon(PhosphorIcons.signOut(), size: 18),
                title: const Text('Logout'),
                dense: true)),
      ],
    );
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    if (parts.isEmpty) return '?';
    return parts.take(2).map((part) => part[0].toUpperCase()).join();
  }

  String _roleLabel(String role) {
    return role
        .split('_')
        .where((part) => part.isNotEmpty)
        .map((part) => part[0].toUpperCase() + part.substring(1))
        .join(' ');
  }
}
