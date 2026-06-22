import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../features/auth/data/auth_repository.dart';
import '../../features/auth/domain/auth_notifier.dart';
import '../../features/auth/domain/models.dart';
import '../network/dio_client.dart';
import '../state/app_refresh.dart';
import '../storage/secure_storage_provider.dart';
import '../theme/app_theme.dart';
import '../utils/screen_size.dart';
import 'app_update_button.dart';
import 'notification_button.dart';
import 'safe_avatar.dart';
import 'sync_status_badge.dart';

// ─── Providers ───────────────────────────────────────────────────────────────

final dashboardNavProvider = Provider<DashboardNavData>((ref) {
  final user = ref.watch(authNotifierProvider).valueOrNull;
  final storedBranchName = ref.watch(branchNameProvider).valueOrNull;
  final branchName = _cleanBranchName(user?.branchName) ??
      _cleanBranchName(storedBranchName) ??
      'Branch';
  return DashboardNavData(user: user, branchName: branchName);
});

final branchNameProvider = FutureProvider<String>((ref) async {
  final storage = ref.watch(secureStorageProvider);
  final cached = _cleanBranchName(
    await storage.read(key: AuthRepository.branchNameKey),
  );
  if (cached != null && cached.toLowerCase() != 'branch') {
    return cached;
  }

  try {
    final response = await ref.watch(dioProvider).get('/auth/me');
    final root = response.data is Map
        ? Map<String, dynamic>.from(response.data as Map)
        : const <String, dynamic>{};
    final data = root['data'] is Map
        ? Map<String, dynamic>.from(root['data'] as Map)
        : root;
    final branch = data['branch'] is Map
        ? Map<String, dynamic>.from(data['branch'] as Map)
        : const <String, dynamic>{};
    final fetched = _cleanBranchName(
          '${data['branch_name'] ?? data['branchName'] ?? branch['name'] ?? ''}',
        ) ??
        cached;
    if (fetched != null && fetched.toLowerCase() != 'branch') {
      await storage.write(key: AuthRepository.branchNameKey, value: fetched);
      return fetched;
    }
  } catch (_) {
    // Keep the shell usable even if branch metadata is unavailable.
  }

  return cached ?? '';
});

String? _cleanBranchName(String? value) {
  final text = value?.trim() ?? '';
  final lowered = text.toLowerCase();
  if (text.isEmpty || lowered == 'null' || lowered == 'branch') return null;
  return text;
}

// ─── Data models ─────────────────────────────────────────────────────────────

class DashboardNavData {
  const DashboardNavData({required this.user, required this.branchName});
  final User? user;
  final String branchName;
}

class DashboardTab {
  const DashboardTab({
    required this.label,
    required this.content,
    this.icon,
    this.badgeCount = 0,
  });

  final String label;
  final Widget content;
  final IconData? icon;
  final int badgeCount;
}

// ─── DashboardShell ──────────────────────────────────────────────────────────

/// Desktop-first tabbed shell. On phones (< 600px) the top bar and tab bar
/// shrink automatically; desktop layout is completely unchanged.
class DashboardShell extends ConsumerWidget {
  const DashboardShell({
    super.key,
    required this.title,
    required this.tabs,
    this.actions,
    this.currentTab,
    this.onTabChanged,
    this.showBackButton = true,
    this.backgroundColor,
  });

  final String title;
  final List<DashboardTab> tabs;
  final List<Widget>? actions;
  final int? currentTab;
  final ValueChanged<int>? onTabChanged;
  final bool showBackButton;
  final Color? backgroundColor;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final nav = ref.watch(dashboardNavProvider);
    final tick = ref.watch(globalRefreshTickProvider);

    final content = tabs.length > 1 && currentTab != null
        ? tabs[currentTab!].content
        : tabs.isEmpty
            ? const SizedBox.shrink()
            : tabs.first.content;

    return Scaffold(
      backgroundColor: backgroundColor,
      body: Column(
        children: [
          _TopBar(title: title, nav: nav, actions: actions, showBackButton: showBackButton),
          if (tabs.length > 1)
            _TabBar(
              tabs: tabs,
              currentTab: currentTab,
              onTabChanged: onTabChanged,
            ),
          Expanded(
            child: KeyedSubtree(
              key: ValueKey('shell_${currentTab ?? 0}_$tick'),
              child: content,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Top bar ─────────────────────────────────────────────────────────────────

class _TopBar extends StatelessWidget {
  const _TopBar({required this.title, required this.nav, this.actions, this.showBackButton = true});

  final String title;
  final DashboardNavData nav;
  final List<Widget>? actions;
  final bool showBackButton;

  @override
  Widget build(BuildContext context) {
    final mobile = ScreenSize.isMobile(context);
    final compact = ScreenSize.isCompact(context); // phone or narrow tablet

    // Heights: 52px on phone, 58px on tablet, 64px on desktop
    final barHeight = mobile ? 52.0 : (compact ? 58.0 : 64.0);
    final hPad = mobile ? 10.0 : 24.0;

    return Container(
      height: barHeight,
      padding: EdgeInsets.symmetric(horizontal: hPad),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.kDivider)),
      ),
      child: Row(
        children: [
          // ── Back button ───────────────────────────────────────────────
          if (showBackButton) ...[
            _BackButton(mobile: mobile),
            SizedBox(width: mobile ? 6 : 10),
          ],

          // ── FG Logo ───────────────────────────────────────────────────
          _FGLogo(size: mobile ? 28.0 : 36.0, fontSize: mobile ? 9.0 : 11.0),

          // ── "Famous Gates" text — hidden on phone ─────────────────────
          if (!mobile) ...[
            const SizedBox(width: 12),
            const Text(
              'Famous Gates',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
                color: AppColors.kPrimary,
              ),
            ),
          ],

          // ── Screen title ──────────────────────────────────────────────
          SizedBox(width: mobile ? 6 : 8),
          Flexible(
            child: Text(
              mobile ? title : '- $title',
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
              style: TextStyle(
                color: mobile ? AppColors.kPrimary : AppColors.kTextSecondary,
                fontSize: mobile ? 13 : 14,
                fontWeight: mobile ? FontWeight.w700 : FontWeight.normal,
              ),
            ),
          ),

          const Spacer(),

          // ── Custom actions ────────────────────────────────────────────
          if (actions != null && !mobile) ...actions!,
          if (actions != null && !mobile) const SizedBox(width: 8),

          // ── Notification bell — always visible ────────────────────────
          const AppNotificationButton(),

          // ── Sync badge — hidden on phone ──────────────────────────────
          if (!mobile) ...[
            const SizedBox(width: 12),
            const SyncStatusBadge(compact: true),
          ],

          // ── Branch name — hidden on phone ─────────────────────────────
          if (!mobile && nav.branchName.isNotEmpty) ...[
            const SizedBox(width: 16),
            _BranchBadge(name: nav.branchName),
          ],

          // ── Avatar ────────────────────────────────────────────────────
          if (nav.user != null) ...[
            SizedBox(width: mobile ? 4 : 16),
            _UserAvatar(user: nav.user!, mobile: mobile),
          ],
        ],
      ),
    );
  }
}

class _BackButton extends StatelessWidget {
  const _BackButton({required this.mobile});
  final bool mobile;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Back',
      onPressed: () => _goBack(context),
      icon: Icon(Icons.arrow_back, size: mobile ? 18 : 22),
      color: AppColors.kPrimary,
      padding: mobile ? const EdgeInsets.all(6) : null,
      constraints: mobile
          ? const BoxConstraints(minWidth: 32, minHeight: 32)
          : null,
      style: IconButton.styleFrom(
        backgroundColor: AppColors.kSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(mobile ? 6 : 8),
        ),
      ),
    );
  }

  void _goBack(BuildContext context) {
    final router = GoRouter.of(context);
    if (router.canPop()) {
      router.pop();
      return;
    }
    context.go('/terminal?hub=1');
  }
}

class _FGLogo extends StatelessWidget {
  const _FGLogo({required this.size, required this.fontSize});
  final double size;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.kPrimary,
        borderRadius: BorderRadius.circular(size * 0.22),
      ),
      child: Center(
        child: Text(
          'FG',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: fontSize,
          ),
        ),
      ),
    );
  }
}

class _BranchBadge extends StatelessWidget {
  const _BranchBadge({required this.name});
  final String name;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.kSurface,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(PhosphorIcons.buildings(),
              size: 14, color: AppColors.kTextSecondary),
          const SizedBox(width: 6),
          Text(
            name,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }
}

class _UserAvatar extends StatelessWidget {
  const _UserAvatar({required this.user, required this.mobile});
  final User user;
  final bool mobile;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: () => context.push('/settings'),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SafeAvatar(
              imageUrl: user.avatar, name: user.name, radius: mobile ? 12 : 14),
          if (!mobile) ...[
            const SizedBox(width: 6),
            Text(
              user.name.split(' ').first,
              style: const TextStyle(
                color: AppColors.kTextSecondary,
                fontSize: 13,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────

class _TabBar extends StatelessWidget {
  const _TabBar({
    required this.tabs,
    required this.currentTab,
    required this.onTabChanged,
  });

  final List<DashboardTab> tabs;
  final int? currentTab;
  final ValueChanged<int>? onTabChanged;

  @override
  Widget build(BuildContext context) {
    final selected = currentTab ?? 0;
    final mobile = ScreenSize.isMobile(context);
    final compact = ScreenSize.isCompact(context);

    // Heights: 36px phone, 42px tablet, 48px desktop
    final barHeight = mobile ? 36.0 : (compact ? 42.0 : 48.0);
    // Horizontal padding per tab: 8 phone, 12 tablet, 16 desktop
    final tabPadH = mobile ? 8.0 : (compact ? 12.0 : 16.0);
    // Tab label font: 10 phone, 11 tablet, 13 desktop
    final labelSize = mobile ? 10.0 : (compact ? 11.0 : 13.0);
    // On phone with > 5 tabs, hide label and show icon only
    final iconOnly = mobile && tabs.length > 5;

    return Container(
      height: barHeight,
      color: Colors.white,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: EdgeInsets.symmetric(
          horizontal: mobile ? 4 : 8,
          vertical: mobile ? 4 : 6,
        ),
        itemCount: tabs.length,
        itemBuilder: (context, index) {
          final isSelected = index == selected;
          final tab = tabs[index];
          return Padding(
            padding: EdgeInsets.only(right: mobile ? 3 : 4),
            child: InkWell(
              onTap: onTabChanged != null ? () => onTabChanged!(index) : null,
              borderRadius: BorderRadius.circular(mobile ? 6 : 8),
              child: Container(
                padding: EdgeInsets.symmetric(horizontal: tabPadH),
                decoration: BoxDecoration(
                  color:
                      isSelected ? AppColors.kPrimary : Colors.transparent,
                  borderRadius: BorderRadius.circular(mobile ? 6 : 8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (tab.icon != null) ...[
                      Icon(
                        tab.icon,
                        size: mobile ? 13 : 16,
                        color: isSelected
                            ? Colors.white
                            : AppColors.kTextSecondary,
                      ),
                      if (!iconOnly) SizedBox(width: mobile ? 4 : 6),
                    ],
                    if (!iconOnly)
                      Text(
                        tab.label,
                        style: TextStyle(
                          fontSize: labelSize,
                          fontWeight: FontWeight.bold,
                          color: isSelected
                              ? Colors.white
                              : AppColors.kTextSecondary,
                        ),
                      ),
                    if (tab.badgeCount > 0) ...[
                      SizedBox(width: mobile ? 3 : 6),
                      _Badge(
                        count: tab.badgeCount,
                        onSelected: isSelected,
                        mobile: mobile,
                      ),
                    ],
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({
    required this.count,
    required this.onSelected,
    required this.mobile,
  });
  final int count;
  final bool onSelected;
  final bool mobile;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        minWidth: mobile ? 14 : 18,
        minHeight: mobile ? 14 : 18,
      ),
      padding: EdgeInsets.symmetric(horizontal: mobile ? 3 : 5),
      decoration: BoxDecoration(
        color: onSelected ? Colors.white : AppColors.kError,
        borderRadius: BorderRadius.circular(mobile ? 7 : 9),
      ),
      alignment: Alignment.center,
      child: Text(
        count > 99 ? '99+' : '$count',
        style: TextStyle(
          fontSize: mobile ? 7 : 9,
          fontWeight: FontWeight.w800,
          color: onSelected ? AppColors.kError : Colors.white,
        ),
      ),
    );
  }
}

// ─── SidebarLayout ───────────────────────────────────────────────────────────

/// Sidebar layout: on desktop shows a 220px permanent sidebar. On mobile
/// the sidebar becomes a Drawer accessed via a hamburger menu.
class SidebarLayout extends ConsumerWidget {
  const SidebarLayout({
    super.key,
    required this.title,
    required this.navItems,
    this.selectedIndex = 0,
    this.onItemSelected,
    required this.body,
    this.actions,
  });

  final String title;
  final List<SidebarNavItem> navItems;
  final int selectedIndex;
  final ValueChanged<int>? onItemSelected;
  final Widget body;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final nav = ref.watch(dashboardNavProvider);
    final mobile = ScreenSize.isMobile(context);

    if (mobile) {
      return Scaffold(
        drawer: Drawer(
          width: 240,
          child: _SidebarContent(
            navItems: navItems,
            selectedIndex: selectedIndex,
            onItemSelected: (i) {
              Navigator.of(context).pop();
              onItemSelected?.call(i);
            },
          ),
        ),
        body: Column(
          children: [
            _TopBar(title: title, nav: nav, actions: actions),
            Expanded(child: body),
          ],
        ),
      );
    }

    return Scaffold(
      body: Row(
        children: [
          _SidebarContent(
            navItems: navItems,
            selectedIndex: selectedIndex,
            onItemSelected: onItemSelected,
          ),
          Expanded(
            child: Column(
              children: [
                _TopBar(title: title, nav: nav, actions: actions),
                Expanded(child: body),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class SidebarNavItem {
  const SidebarNavItem({
    required this.label,
    required this.icon,
    this.badge,
  });

  final String label;
  final IconData icon;
  final String? badge;
}

class _SidebarContent extends StatelessWidget {
  const _SidebarContent({
    required this.navItems,
    required this.selectedIndex,
    required this.onItemSelected,
  });

  final List<SidebarNavItem> navItems;
  final int selectedIndex;
  final ValueChanged<int>? onItemSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 220,
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(right: BorderSide(color: AppColors.kDivider)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 16),
          ...navItems.asMap().entries.map((entry) {
            final index = entry.key;
            final item = entry.value;
            final isSelected = index == selectedIndex;
            return ListTile(
              dense: true,
              leading: Icon(
                item.icon,
                size: 20,
                color: isSelected
                    ? AppColors.kPrimary
                    : AppColors.kTextSecondary,
              ),
              title: Text(
                item.label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight:
                      isSelected ? FontWeight.bold : FontWeight.normal,
                  color: isSelected
                      ? AppColors.kPrimary
                      : AppColors.kTextPrimary,
                ),
              ),
              selected: isSelected,
              selectedTileColor: AppColors.kPrimary.withValues(alpha: 0.05),
              shape: const RoundedRectangleBorder(),
              onTap: onItemSelected != null
                  ? () => onItemSelected!(index)
                  : null,
              trailing: item.badge != null
                  ? Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.kError,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        item.badge!,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    )
                  : null,
            );
          }),
          const Spacer(),
          const _LogoutButton(),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

class _LogoutButton extends ConsumerWidget {
  const _LogoutButton();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return InkWell(
      onTap: () async {
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Logout?'),
            content: const Text('Are you sure you want to logout?'),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Logout'),
              ),
            ],
          ),
        );
        if (confirmed == true && context.mounted) {
          await ref.read(authNotifierProvider.notifier).logout();
          if (context.mounted) context.go('/terminal');
        }
      },
      child: const ListTile(
        dense: true,
        leading: Icon(Icons.logout, size: 20, color: AppColors.kError),
        title: Text(
          'Logout',
          style: TextStyle(
            fontSize: 13,
            color: AppColors.kError,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}
