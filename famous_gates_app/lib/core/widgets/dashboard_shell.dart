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
import 'app_update_button.dart';
import 'notification_button.dart';
import 'safe_avatar.dart';
import 'sync_status_badge.dart';

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

class DashboardNavData {
  const DashboardNavData({required this.user, required this.branchName});
  final User? user;
  final String branchName;
}

class DashboardShell extends ConsumerWidget {
  const DashboardShell({
    super.key,
    required this.title,
    required this.tabs,
    this.actions,
    this.currentTab,
    this.onTabChanged,
  });

  final String title;
  final List<DashboardTab> tabs;
  final List<Widget>? actions;
  final int? currentTab;
  final ValueChanged<int>? onTabChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final nav = ref.watch(dashboardNavProvider);
    // Ctrl+R / F5 bumps this; re-keying the content forces the active tab to
    // rebuild and reload its data.
    final tick = ref.watch(globalRefreshTickProvider);

    final content = tabs.length > 1 && currentTab != null
        ? tabs[currentTab!].content
        : tabs.isEmpty
            ? const SizedBox.shrink()
            : tabs.first.content;

    return Scaffold(
      body: Column(
        children: [
          _TopBar(title: title, nav: nav, actions: actions),
          if (tabs.length > 1)
            _TabBar(
                tabs: tabs, currentTab: currentTab, onTabChanged: onTabChanged),
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

class _TopBar extends StatelessWidget {
  const _TopBar({required this.title, required this.nav, this.actions});

  final String title;
  final DashboardNavData nav;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 24),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.kDivider)),
      ),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Back',
            onPressed: () => _goBack(context),
            icon: const Icon(Icons.arrow_back),
            color: AppColors.kPrimary,
            style: IconButton.styleFrom(
              backgroundColor: AppColors.kSurface,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.kPrimary,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Center(
              child: Text(
                'FG',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 11,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          const Text(
            'Famous Gates',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 16,
              color: AppColors.kPrimary,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '- $title',
            style: const TextStyle(
              color: AppColors.kTextSecondary,
              fontSize: 14,
            ),
          ),
          const Spacer(),
          if (actions != null) ...actions!,
          if (actions != null) const SizedBox(width: 16),
          const AppUpdateButton(),
          const SizedBox(width: 4),
          const AppNotificationButton(),
          const SizedBox(width: 12),
          const SyncStatusBadge(compact: true),
          const SizedBox(width: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.kSurface,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  PhosphorIcons.buildings(),
                  size: 14,
                  color: AppColors.kTextSecondary,
                ),
                const SizedBox(width: 6),
                Text(
                  nav.branchName,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          if (nav.user != null)
            InkWell(
              onTap: () => context.push('/settings'),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _avatarWidget(nav.user!.avatar, nav.user!.name, radius: 14),
                  const SizedBox(width: 6),
                  Text(
                    nav.user!.name.split(' ').first,
                    style: const TextStyle(
                      color: AppColors.kTextSecondary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  void _goBack(BuildContext context) {
    final router = GoRouter.of(context);
    if (router.canPop()) {
      router.pop();
      return;
    }
    // Land on the terminal hub (to switch user / log out) instead of being
    // auto-forwarded to the default module (which could be POS).
    context.go('/terminal?hub=1');
  }
}

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
    return Container(
      height: 48,
      color: Colors.white,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: tabs.length,
        itemBuilder: (context, index) {
          final isSelected = index == selected;
          final tab = tabs[index];
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
            child: InkWell(
              onTap: onTabChanged != null ? () => onTabChanged!(index) : null,
              borderRadius: BorderRadius.circular(8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.kPrimary : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (tab.icon != null) ...[
                      Icon(
                        tab.icon,
                        size: 16,
                        color: isSelected
                            ? Colors.white
                            : AppColors.kTextSecondary,
                      ),
                      const SizedBox(width: 6),
                    ],
                    Text(
                      tab.label,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: isSelected
                            ? Colors.white
                            : AppColors.kTextSecondary,
                      ),
                    ),
                    if (tab.badgeCount > 0) ...[
                      const SizedBox(width: 6),
                      Container(
                        constraints:
                            const BoxConstraints(minWidth: 18, minHeight: 18),
                        padding: const EdgeInsets.symmetric(horizontal: 5),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? Colors.white
                              : AppColors.kError,
                          borderRadius: BorderRadius.circular(9),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          tab.badgeCount > 99
                              ? '99+'
                              : '${tab.badgeCount}',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            color: isSelected
                                ? AppColors.kError
                                : Colors.white,
                          ),
                        ),
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

    return Scaffold(
      body: Row(
        children: [
          _Sidebar(
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

class _Sidebar extends StatelessWidget {
  const _Sidebar({
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
                color:
                    isSelected ? AppColors.kPrimary : AppColors.kTextSecondary,
              ),
              title: Text(
                item.label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  color:
                      isSelected ? AppColors.kPrimary : AppColors.kTextPrimary,
                ),
              ),
              selected: isSelected,
              selectedTileColor: AppColors.kPrimary.withValues(alpha: 0.05),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(0),
              ),
              onTap:
                  onItemSelected != null ? () => onItemSelected!(index) : null,
              trailing: item.badge != null
                  ? Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
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
          if (context.mounted) context.go('/login');
        }
      },
      child: const ListTile(
        dense: true,
        leading: Icon(
          Icons.logout,
          size: 20,
          color: AppColors.kError,
        ),
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

Widget _avatarWidget(String? avatar, String name, {double radius = 14}) {
  return SafeAvatar(imageUrl: avatar, name: name, radius: radius);
}
