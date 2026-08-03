import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../features/auth/domain/auth_notifier.dart';
import '../theme/app_theme.dart';
import 'app_update_button.dart';
import 'dashboard_horizontal_access.dart';
import 'notification_button.dart';
import 'printer_settings_dialog.dart';

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

class MasterDashboardShell<T> extends ConsumerStatefulWidget {
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
    this.initialSidebarCollapsed = false,
    this.allowSidebarCollapse = true,
    this.enableHorizontalAccess = false,
    this.sidebarTitle,
    this.sidebarSubtitle,
    this.sidebarInitials,
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
  final bool initialSidebarCollapsed;
  final bool allowSidebarCollapse;
  final bool enableHorizontalAccess;
  final String? sidebarTitle;
  final String? sidebarSubtitle;
  final String? sidebarInitials;

  @override
  ConsumerState<MasterDashboardShell<T>> createState() =>
      _MasterDashboardShellState<T>();
}

class _MasterDashboardShellState<T>
    extends ConsumerState<MasterDashboardShell<T>> {
  late bool _sidebarCollapsed;
  bool _sidebarOverrideActive = false;

  @override
  void initState() {
    super.initState();
    _sidebarCollapsed = widget.initialSidebarCollapsed;
  }

  @override
  void didUpdateWidget(covariant MasterDashboardShell<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialSidebarCollapsed != widget.initialSidebarCollapsed &&
        _sidebarCollapsed == oldWidget.initialSidebarCollapsed &&
        !_sidebarOverrideActive) {
      _sidebarCollapsed = widget.initialSidebarCollapsed;
    }
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    final isMobile = width < 768;
    final isTablet = width >= 768 && width <= 1024;
    final autoCollapsed = isTablet;
    final isCollapsed = _sidebarOverrideActive
        ? _sidebarCollapsed
        : (_sidebarCollapsed || autoCollapsed);
    final navWidth = isMobile ? 0.0 : (isCollapsed ? 72.0 : 240.0);

    return Scaffold(
      backgroundColor: widget.palette?.background ?? AppColors.kSurface,
      body: Row(
        children: [
          if (!isMobile)
            _MasterSideNav<T>(
              width: navWidth,
              isCollapsed: isCollapsed,
              canToggle: widget.allowSidebarCollapse,
              onToggleCollapsed: widget.allowSidebarCollapse
                  ? () => setState(() {
                        _sidebarOverrideActive = true;
                        _sidebarCollapsed = !isCollapsed;
                      })
                  : null,
              title: widget.title,
              subtitle: widget.subtitle,
              initials: widget.initials,
              sidebarTitle: widget.sidebarTitle,
              sidebarSubtitle: widget.sidebarSubtitle,
              sidebarInitials: widget.sidebarInitials,
              currentSection: widget.currentSection,
              items: widget.items,
              onSectionSelected: widget.onSectionSelected,
              palette: widget.palette,
            ),
          Expanded(
            child: Column(
              children: [
                _MasterTopBar(
                  title: widget.title,
                  breadcrumbRoot: widget.breadcrumbRoot ?? widget.title,
                  searchHint: widget.searchHint,
                  palette: widget.palette,
                  onMenuTap:
                      isMobile ? () => _showMobileNav(context, ref) : null,
                ),
                Expanded(
                  child: widget.enableHorizontalAccess
                      ? DashboardHorizontalAccess(
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
                            child: widget.child,
                          ),
                        )
                      : AnimatedSwitcher(
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
                          child: widget.child,
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: isMobile
          ? _MasterBottomNav<T>(
              currentSection: widget.currentSection,
              items: widget.items.take(5).toList(),
              onSectionSelected: widget.onSectionSelected,
            )
          : null,
    );
  }

  void _showMobileNav(BuildContext context, WidgetRef ref) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => _MasterMobileNavSheet<T>(
        title: widget.title,
        currentSection: widget.currentSection,
        items: widget.items,
        onSectionSelected: widget.onSectionSelected,
      ),
    );
  }
}

class _MasterSideNav<T> extends ConsumerWidget {
  const _MasterSideNav({
    required this.width,
    required this.isCollapsed,
    required this.canToggle,
    required this.title,
    required this.subtitle,
    required this.initials,
    required this.currentSection,
    required this.items,
    required this.onSectionSelected,
    this.palette,
    this.onToggleCollapsed,
    this.sidebarTitle,
    this.sidebarSubtitle,
    this.sidebarInitials,
  });

  final double width;
  final bool isCollapsed;
  final bool canToggle;
  final String title;
  final String subtitle;
  final String initials;
  final T currentSection;
  final List<MasterNavItem<T>> items;
  final ValueChanged<T> onSectionSelected;
  final ShellPalette? palette;
  final VoidCallback? onToggleCollapsed;
  final String? sidebarTitle;
  final String? sidebarSubtitle;
  final String? sidebarInitials;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final borderColor = palette?.border ?? Colors.grey.shade200;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOutCubic,
      width: width,
      decoration: BoxDecoration(
        color: palette?.surface ?? Colors.white,
        border: Border(right: BorderSide(color: borderColor)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 4,
            offset: const Offset(2, 0),
          ),
        ],
      ),
      child: SafeArea(
        right: false,
        child: Column(
          children: [
            SizedBox(
              height: 60,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final shouldUseCompactHeader =
                      isCollapsed || constraints.maxWidth < 180;

                  return Padding(
                    padding: EdgeInsets.symmetric(
                      horizontal: shouldUseCompactHeader ? 6 : 16,
                    ),
                    child: shouldUseCompactHeader
                        ? Column(
                            mainAxisSize: MainAxisSize.min,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              _Logo(initials: sidebarInitials ?? initials),
                              if (canToggle) ...[
                                const SizedBox(height: 4),
                                Tooltip(
                                  message: shouldUseCompactHeader &&
                                          !isCollapsed
                                      ? 'Collapse sidebar'
                                      : 'Expand sidebar',
                                  child: InkWell(
                                    onTap: onToggleCollapsed,
                                    borderRadius: BorderRadius.circular(10),
                                    child: Container(
                                      width: 20,
                                      height: 20,
                                      decoration: BoxDecoration(
                                        color: (palette?.surface ??
                                                Colors.white)
                                            .withValues(alpha: 0.96),
                                        borderRadius: BorderRadius.circular(6),
                                        border: Border.all(
                                          color: borderColor,
                                        ),
                                      ),
                                      child: Icon(
                                        shouldUseCompactHeader &&
                                                !isCollapsed
                                            ? Icons.keyboard_double_arrow_left
                                            : Icons.keyboard_double_arrow_right,
                                        size: 13,
                                        color: palette?.text ??
                                            AppColors.kTextPrimary,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          )
                        : Row(
                            children: [
                              _Logo(initials: sidebarInitials ?? initials),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      sidebarTitle ?? title,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                        color: palette?.text,
                                      ),
                                    ),
                                    Text(
                                      sidebarSubtitle ?? subtitle,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 10,
                                        color: palette?.mutedText ??
                                            AppColors.kTextSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              if (canToggle)
                                IconButton(
                                  tooltip: 'Collapse sidebar',
                                  onPressed: onToggleCollapsed,
                                  icon: const Icon(
                                    Icons.keyboard_double_arrow_left,
                                    size: 20,
                                  ),
                                ),
                            ],
                          ),
                  );
                },
              ),
            ),
            Divider(height: 1, color: borderColor),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.only(bottom: 16),
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
                          padding: const EdgeInsets.fromLTRB(16, 18, 16, 4),
                          child: Text(
                            item.group!.toUpperCase(),
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1.3,
                              color: palette?.mutedText ?? Colors.grey.shade500,
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
            Divider(height: 1, color: borderColor),
            Padding(
              padding: EdgeInsets.all(isCollapsed ? 10 : 16),
              child: isCollapsed
                  ? Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          tooltip: 'Printer Settings',
                          onPressed: () => showPrinterSettingsDialog(context),
                          icon: Icon(PhosphorIcons.printer(),
                              color:
                                  palette?.mutedText ?? Colors.grey.shade600),
                        ),
                        IconButton(
                          tooltip: 'Logout',
                          onPressed: () =>
                              ref.read(authNotifierProvider.notifier).logout(),
                          icon: Icon(PhosphorIcons.signOut(),
                              color:
                                  palette?.mutedText ?? Colors.grey.shade600),
                        ),
                      ],
                    )
                  : Column(
                      children: [
                        OutlinedButton.icon(
                          onPressed: () => showPrinterSettingsDialog(context),
                          icon: Icon(PhosphorIcons.printer(), size: 18),
                          label: const Text('Printer Settings'),
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size(double.infinity, 40),
                          ),
                        ),
                        const SizedBox(height: 8),
                        OutlinedButton.icon(
                          onPressed: () =>
                              ref.read(authNotifierProvider.notifier).logout(),
                          icon: Icon(PhosphorIcons.signOut(), size: 18),
                          label: const Text('Logout'),
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size(double.infinity, 44),
                          ),
                        ),
                      ],
                    ),
            ),
          ],
        ),
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
    final tile = Padding(
      padding: EdgeInsets.symmetric(
        horizontal: isCollapsed ? 8 : 8,
        vertical: 1,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: isActive ? accent.withValues(alpha: 0.08) : null,
          borderRadius: BorderRadius.circular(8),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: Container(
            height: 38,
            padding: EdgeInsets.only(
              left: isActive && !isCollapsed ? 9 : 12,
              right: 12,
            ),
            decoration: BoxDecoration(
              border: isActive && !isCollapsed
                  ? Border(left: BorderSide(color: accent, width: 3))
                  : null,
            ),
            child: Row(
              mainAxisAlignment: isCollapsed
                  ? MainAxisAlignment.center
                  : MainAxisAlignment.start,
              children: [
                Icon(
                  item.icon,
                  size: 18,
                  color: isActive ? accent : idle,
                ),
                if (!isCollapsed) ...[
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      item.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight:
                            isActive ? FontWeight.w600 : FontWeight.w400,
                        color: isActive
                            ? accent
                            : (palette?.text ?? AppColors.kTextSecondary),
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
    if (!isCollapsed) return tile;
    return Tooltip(message: item.label, child: tile);
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
                  color: palette?.mutedText ?? Colors.grey.shade700),
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
                    style: TextStyle(
                        fontSize: 14,
                        color: palette?.mutedText ?? Colors.grey.shade500),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Icon(Icons.chevron_right,
                      size: 14,
                      color: palette?.mutedText ?? Colors.grey.shade400),
                ),
                Text(
                  'Dashboard',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: palette?.text ?? Colors.grey.shade700,
                  ),
                ),
              ],
            ),
          ),
          const Spacer(),
          if (!isCompact) _SearchBox(hint: searchHint),
          if (!isCompact) const SizedBox(width: 16),
          AppUpdateButton(
              iconColor: palette?.mutedText ?? Colors.grey.shade700),
          AppNotificationButton(
              iconColor: palette?.mutedText ?? Colors.grey.shade700),
          const SizedBox(width: 12),
          PopupMenuButton<String>(
            tooltip: '',
            offset: const Offset(0, 42),
            onSelected: (value) {
              if (value == 'logout') {
                ref.read(authNotifierProvider.notifier).logout();
              } else if (value == 'printer') {
                showPrinterSettingsDialog(context);
              } else if (value == 'settings') {
                context.push('/settings');
              }
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                enabled: false,
                child: Text(email.isEmpty ? name : email),
              ),
              PopupMenuItem(
                value: 'settings',
                child: Row(
                  children: [
                    Icon(PhosphorIcons.gear(), size: 18),
                    const SizedBox(width: 12),
                    const Text('Settings'),
                  ],
                ),
              ),
              PopupMenuItem(
                value: 'printer',
                child: Row(
                  children: [
                    Icon(PhosphorIcons.printer(), size: 18),
                    const SizedBox(width: 12),
                    const Text('Printer Settings'),
                  ],
                ),
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
                border:
                    Border.all(color: palette?.border ?? Colors.grey.shade200),
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
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: palette?.text,
                            ),
                          ),
                          Text(
                            email,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11,
                              color: palette?.mutedText ?? Colors.grey.shade500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(width: 8),
                  Icon(Icons.expand_more,
                      size: 16,
                      color: palette?.mutedText ?? Colors.grey.shade500),
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
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: AppColors.kPrimary,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Center(
        child: Text(
          initials,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 12,
          ),
        ),
      ),
    );
  }
}
