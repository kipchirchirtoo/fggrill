import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../features/auth/domain/auth_notifier.dart';
import '../theme/app_theme.dart';
import 'app_update_button.dart';
import 'notification_button.dart';

class MasterNavItem<T> {
  const MasterNavItem({
    required this.section,
    required this.label,
    required this.icon,
    this.group,
  });

  final T section;
  final String label;
  final IconData icon;
  final String? group;
}

/// Optional color override so a feature (e.g. the POS) can theme the whole
/// shell — sidebar, top bar, canvas and active highlight — without affecting
/// other dashboards. When null the shell keeps its default light styling.
class ShellPalette {
  const ShellPalette({
    required this.background,
    required this.surface,
    required this.accent,
    this.onAccent = Colors.white,
    this.border,
    this.text,
    this.mutedText,
  });

  final Color background; // scaffold canvas
  final Color surface; // sidebar + top bar + cards
  final Color accent; // active nav highlight
  final Color onAccent;
  final Color? border;
  final Color? text;
  final Color? mutedText;
}

class MasterDashboardShell<T> extends ConsumerWidget {
  const MasterDashboardShell({
    super.key,
    required this.title,
    required this.subtitle,
    required this.initials,
    required this.currentSection,
    required this.items,
    required this.onSectionSelected,
    required this.child,
    this.breadcrumbRoot,
    this.searchHint = 'Search...',
    this.palette,
  });

  final String title;
  final String subtitle;
  final String initials;
  final String? breadcrumbRoot;
  final String searchHint;
  final T currentSection;
  final List<MasterNavItem<T>> items;
  final ValueChanged<T> onSectionSelected;
  final Widget child;
  final ShellPalette? palette;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final width = MediaQuery.of(context).size.width;
    final isMobile = width < 768;
    final isTablet = width >= 768 && width < 1024;
    final navWidth = isMobile ? 0.0 : (isTablet ? 64.0 : 240.0);

    return Scaffold(
      backgroundColor: palette?.background ?? AppColors.kSurface,
      body: Row(
        children: [
          if (!isMobile)
            _MasterSideNav<T>(
              width: navWidth,
              isCollapsed: isTablet,
              title: title,
              subtitle: subtitle,
              initials: initials,
              currentSection: currentSection,
              items: items,
              onSectionSelected: onSectionSelected,
              palette: palette,
            ),
          Expanded(
            child: Column(
              children: [
                _MasterTopBar(
                  title: title,
                  breadcrumbRoot: breadcrumbRoot ?? title,
                  searchHint: searchHint,
                  palette: palette,
                  onMenuTap:
                      isMobile ? () => _showMobileNav(context, ref) : null,
                ),
                Expanded(
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 180),
                    layoutBuilder: (currentChild, previousChildren) {
                      return Stack(
                        alignment: Alignment.topLeft,
                        children: [
                          ...previousChildren,
                          if (currentChild != null) currentChild,
                        ],
                      );
                    },
                    child: child,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: isMobile
          ? _MasterBottomNav<T>(
              currentSection: currentSection,
              items: items.take(5).toList(),
              onSectionSelected: onSectionSelected,
            )
          : null,
    );
  }

  void _showMobileNav(BuildContext context, WidgetRef ref) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => _MasterMobileNavSheet<T>(
        title: title,
        currentSection: currentSection,
        items: items,
        onSectionSelected: onSectionSelected,
      ),
    );
  }
}

class _MasterSideNav<T> extends ConsumerWidget {
  const _MasterSideNav({
    required this.width,
    required this.isCollapsed,
    required this.title,
    required this.subtitle,
    required this.initials,
    required this.currentSection,
    required this.items,
    required this.onSectionSelected,
    this.palette,
  });

  final double width;
  final bool isCollapsed;
  final String title;
  final String subtitle;
  final String initials;
  final T currentSection;
  final List<MasterNavItem<T>> items;
  final ValueChanged<T> onSectionSelected;
  final ShellPalette? palette;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      width: width,
      color: palette?.surface ?? Colors.white,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(24),
            child: isCollapsed
                ? _Logo(initials: initials)
                : Row(
                    children: [
                      _Logo(initials: initials),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Text(
                              subtitle,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 12,
                                color: Colors.grey,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
          ),
          const Divider(height: 1),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 12),
              itemCount: items.length,
              itemBuilder: (context, index) {
                final item = items[index];
                final previousGroup =
                    index == 0 ? null : items[index - 1].group;
                final showGroup = item.group != null &&
                    item.group != previousGroup &&
                    !isCollapsed;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (showGroup)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(24, 14, 16, 6),
                        child: Text(
                          item.group!,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.8,
                            color: Colors.grey.shade500,
                          ),
                        ),
                      ),
                    _NavTile<T>(
                      item: item,
                      isActive: item.section == currentSection,
                      isCollapsed: isCollapsed,
                      onTap: () => onSectionSelected(item.section),
                      palette: palette,
                    ),
                  ],
                );
              },
            ),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(16),
            child: isCollapsed
                ? IconButton(
                    tooltip: 'Logout',
                    onPressed: () =>
                        ref.read(authNotifierProvider.notifier).logout(),
                    icon: Icon(PhosphorIcons.signOut(),
                        color: Colors.grey.shade600),
                  )
                : OutlinedButton.icon(
                    onPressed: () =>
                        ref.read(authNotifierProvider.notifier).logout(),
                    icon: Icon(PhosphorIcons.signOut(), size: 18),
                    label: const Text('Logout'),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(double.infinity, 44),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _NavTile<T> extends StatelessWidget {
  const _NavTile({
    required this.item,
    required this.isActive,
    required this.isCollapsed,
    required this.onTap,
    this.palette,
  });

  final MasterNavItem<T> item;
  final bool isActive;
  final bool isCollapsed;
  final VoidCallback onTap;
  final ShellPalette? palette;

  @override
  Widget build(BuildContext context) {
    final accent = palette?.accent ?? AppColors.kPrimary;
    final idle = palette?.mutedText ?? Colors.grey.shade600;
    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: isCollapsed ? 8 : 12,
        vertical: 2,
      ),
      child: Material(
        color: isActive
            ? accent.withValues(alpha: 0.12)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: Container(
            height: 44,
            padding: EdgeInsets.symmetric(horizontal: isCollapsed ? 0 : 12),
            child: Row(
              mainAxisAlignment: isCollapsed
                  ? MainAxisAlignment.center
                  : MainAxisAlignment.start,
              children: [
                Icon(
                  item.icon,
                  size: 20,
                  color: isActive ? accent : idle,
                ),
                if (!isCollapsed) ...[
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      item.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight:
                            isActive ? FontWeight.w600 : FontWeight.w500,
                        color: isActive
                            ? accent
                            : (palette?.text ?? Colors.grey.shade700),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MasterTopBar extends ConsumerWidget {
  const _MasterTopBar({
    required this.title,
    required this.breadcrumbRoot,
    required this.searchHint,
    this.onMenuTap,
    this.palette,
  });

  final String title;
  final String breadcrumbRoot;
  final String searchHint;
  final VoidCallback? onMenuTap;
  final ShellPalette? palette;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authNotifierProvider).valueOrNull;
    final name = user?.name ?? title;
    final email = user?.email ?? '';
    final initials = name.isNotEmpty ? name[0].toUpperCase() : 'U';
    final isCompact = MediaQuery.of(context).size.width < 900;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      decoration: BoxDecoration(
        color: palette?.surface ?? Colors.white,
        border: Border(
            bottom: BorderSide(color: palette?.border ?? Colors.grey.shade200)),
      ),
      child: Row(
        children: [
          if (onMenuTap != null) ...[
            IconButton(
              onPressed: onMenuTap,
              icon: Icon(PhosphorIcons.listBullets(),
                  color: Colors.grey.shade700),
            ),
            const SizedBox(width: 12),
          ],
          Flexible(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: Text(
                    breadcrumbRoot,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 14, color: Colors.grey.shade500),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Icon(Icons.chevron_right,
                      size: 14, color: Colors.grey.shade400),
                ),
                Text(
                  'Dashboard',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey.shade700,
                  ),
                ),
              ],
            ),
          ),
          const Spacer(),
          if (!isCompact) _SearchBox(hint: searchHint),
          if (!isCompact) const SizedBox(width: 16),
          AppUpdateButton(iconColor: Colors.grey.shade700),
          AppNotificationButton(iconColor: Colors.grey.shade700),
          const SizedBox(width: 12),
          PopupMenuButton<String>(
            offset: const Offset(0, 42),
            onSelected: (value) {
              if (value == 'logout') {
                ref.read(authNotifierProvider.notifier).logout();
              }
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                enabled: false,
                child: Text(email.isEmpty ? name : email),
              ),
              PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(PhosphorIcons.signOut(), size: 18),
                    const SizedBox(width: 12),
                    const Text('Logout'),
                  ],
                ),
              ),
            ],
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey.shade200),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircleAvatar(
                    radius: 16,
                    backgroundColor: AppColors.kPrimary.withValues(alpha: 0.1),
                    child: Text(
                      initials,
                      style: const TextStyle(
                        color: AppColors.kPrimary,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  if (!isCompact) ...[
                    const SizedBox(width: 12),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 180),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            email,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.grey.shade500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(width: 8),
                  Icon(Icons.expand_more,
                      size: 16, color: Colors.grey.shade500),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchBox extends StatelessWidget {
  const _SearchBox({required this.hint});

  final String hint;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 280,
      height: 40,
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: TextField(
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(fontSize: 14, color: Colors.grey.shade400),
          prefixIcon: Icon(
            PhosphorIcons.magnifyingGlass(),
            size: 18,
            color: Colors.grey.shade400,
          ),
          border: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
      ),
    );
  }
}

class _MasterMobileNavSheet<T> extends StatelessWidget {
  const _MasterMobileNavSheet({
    required this.title,
    required this.currentSection,
    required this.items,
    required this.onSectionSelected,
  });

  final String title;
  final T currentSection;
  final List<MasterNavItem<T>> items;
  final ValueChanged<T> onSectionSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.78,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: items.map((item) {
                final isActive = item.section == currentSection;
                return ListTile(
                  leading: Icon(item.icon,
                      color: isActive
                          ? AppColors.kPrimary
                          : AppColors.kTextSecondary),
                  title: Text(
                    item.label,
                    style: TextStyle(
                      color: isActive
                          ? AppColors.kPrimary
                          : AppColors.kTextSecondary,
                      fontWeight:
                          isActive ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                  selected: isActive,
                  selectedTileColor: AppColors.kPrimary.withValues(alpha: 0.08),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  onTap: () {
                    onSectionSelected(item.section);
                    Navigator.pop(context);
                  },
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _MasterBottomNav<T> extends StatelessWidget {
  const _MasterBottomNav({
    required this.currentSection,
    required this.items,
    required this.onSectionSelected,
  });

  final T currentSection;
  final List<MasterNavItem<T>> items;
  final ValueChanged<T> onSectionSelected;

  @override
  Widget build(BuildContext context) {
    final currentIndex = items
        .indexWhere((item) => item.section == currentSection)
        .clamp(0, items.length - 1);
    return BottomNavigationBar(
      type: BottomNavigationBarType.fixed,
      currentIndex: currentIndex,
      onTap: (index) => onSectionSelected(items[index].section),
      selectedItemColor: AppColors.kPrimary,
      unselectedItemColor: AppColors.kTextSecondary,
      items: items
          .map(
            (item) => BottomNavigationBarItem(
              icon: Icon(item.icon),
              label: item.label,
            ),
          )
          .toList(),
    );
  }
}

class _Logo extends StatelessWidget {
  const _Logo({required this.initials});

  final String initials;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: AppColors.kPrimary,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Center(
        child: Text(
          initials,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 20,
          ),
        ),
      ),
    );
  }
}
