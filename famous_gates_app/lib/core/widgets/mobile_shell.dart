import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/app_theme.dart';

/// Holds the current selected bottom tab index for the mobile shell.
final mobileShellTabProvider = StateProvider<int>((ref) => 0);

/// A tab descriptor for MobileShell.
class MobileTab {
  const MobileTab({
    required this.label,
    required this.icon,
    required this.activeIcon,
    required this.body,
  });

  final String label;
  final IconData icon;
  final IconData activeIcon;
  final Widget body;
}

/// Mobile-first shell that uses a BottomNavigationBar instead of the
/// desktop sidebar. Used for all mobile role dashboards.
class MobileShell extends ConsumerStatefulWidget {
  const MobileShell({
    super.key,
    required this.title,
    required this.tabs,
    this.onTabChanged,
    this.actions,
  });

  final String title;
  final List<MobileTab> tabs;
  final ValueChanged<int>? onTabChanged;
  final List<Widget>? actions;

  @override
  ConsumerState<MobileShell> createState() => _MobileShellState();
}

class _MobileShellState extends ConsumerState<MobileShell> {
  @override
  Widget build(BuildContext context) {
    final selectedIndex = ref.watch(mobileShellTabProvider);
    final tab = widget.tabs[selectedIndex.clamp(0, widget.tabs.length - 1)];

    return Scaffold(
      backgroundColor: AppColors.kSurface,
      appBar: AppBar(
        backgroundColor: AppColors.kPrimary,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w700,
                fontFamily: 'SF Pro Display',
              ),
            ),
            Text(
              tab.label,
              style: TextStyle(
                color: Colors.white.withOpacity(0.75),
                fontSize: 11,
                fontFamily: 'SF Pro Display',
              ),
            ),
          ],
        ),
        actions: widget.actions,
      ),
      body: IndexedStack(
        index: selectedIndex.clamp(0, widget.tabs.length - 1),
        children: widget.tabs.map((t) => t.body).toList(),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: selectedIndex.clamp(0, widget.tabs.length - 1),
        onTap: (i) {
          ref.read(mobileShellTabProvider.notifier).state = i;
          widget.onTabChanged?.call(i);
        },
        type: BottomNavigationBarType.fixed,
        backgroundColor: AppColors.kPrimary,
        selectedItemColor: AppColors.kAccent,
        unselectedItemColor: Colors.white.withOpacity(0.6),
        selectedFontSize: 11,
        unselectedFontSize: 10,
        items: widget.tabs
            .asMap()
            .entries
            .map((e) => BottomNavigationBarItem(
                  icon: Icon(e.value.icon, size: 22),
                  activeIcon: Icon(e.value.activeIcon, size: 22),
                  label: e.value.label,
                ))
            .toList(),
      ),
    );
  }
}

/// A thin scrollable body wrapper used inside mobile tab bodies.
class MobileTabBody extends StatelessWidget {
  const MobileTabBody({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
  });

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: padding,
      child: child,
    );
  }
}

/// Reusable card for mobile metric stats.
class MobileStatCard extends StatelessWidget {
  const MobileStatCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.color,
    this.subtitle,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color? color;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.kPrimary;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.kCardBg,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: c.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: c, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    color: AppColors.kTextSecondary,
                    fontSize: 11,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(
                    color: c,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
                if (subtitle != null)
                  Text(
                    subtitle!,
                    style: const TextStyle(
                      color: AppColors.kTextSecondary,
                      fontSize: 10,
                      fontFamily: 'SF Pro Display',
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Fullscreen loading overlay (used while scanner is initialising).
class MobileLoadingView extends StatelessWidget {
  const MobileLoadingView({super.key, this.message = 'Loading…'});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(color: AppColors.kPrimary),
          const SizedBox(height: 16),
          Text(
            message,
            style: const TextStyle(
              color: AppColors.kTextSecondary,
              fontFamily: 'SF Pro Display',
            ),
          ),
        ],
      ),
    );
  }
}

/// Empty state used in mobile lists.
class MobileEmptyState extends StatelessWidget {
  const MobileEmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.action,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 56, color: AppColors.kTextSecondary.withOpacity(0.4)),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.kTextPrimary,
                fontFamily: 'SF Pro Display',
              ),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 6),
              Text(
                subtitle!,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.kTextSecondary,
                  fontFamily: 'SF Pro Display',
                ),
              ),
            ],
            if (action != null) ...[
              const SizedBox(height: 20),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}
