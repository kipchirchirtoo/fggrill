import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../core/theme/app_theme.dart';
import '../domain/superadmin_providers.dart';
import 'widgets/superadmin_side_nav.dart';
import 'widgets/superadmin_top_bar.dart';
import 'sections/behavioral_intelligence_section.dart';
import 'sections/security_center_section.dart';
import 'sections/system_health_section.dart';
import 'sections/global_users_section.dart';
import 'sections/branches_section.dart';
import 'sections/audit_logs_section.dart';
import 'sections/settings_section.dart';

class SuperAdminScreen extends ConsumerWidget {
  const SuperAdminScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentSection = ref.watch(superAdminSectionProvider);
    final isMobile = MediaQuery.of(context).size.width < 768;
    final isTablet = MediaQuery.of(context).size.width >= 768 && MediaQuery.of(context).size.width < 1024;
    final navWidth = isMobile ? 0.0 : (isTablet ? 64.0 : 240.0);

    return Scaffold(
      backgroundColor: AppColors.kSurface,
      body: Row(
        children: [
          if (!isMobile) SuperAdminSideNav(width: navWidth, isCollapsed: isTablet),
          Expanded(
            child: Column(
              children: [
                SuperAdminTopBar(
                  onMenuTap: isMobile ? () => _showMobileNav(context, ref) : null,
                ),
                Expanded(
                  child: _buildSection(currentSection, ref),
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: isMobile ? _MobileBottomNav(currentSection: currentSection) : null,
    );
  }

  Widget _buildSection(SuperAdminSection section, WidgetRef ref) {
    final widgets = <SuperAdminSection, Widget>{
      SuperAdminSection.behavioralIntelligence: const BehavioralIntelligenceSection(),
      SuperAdminSection.securityCenter: const SecurityCenterSection(),
      SuperAdminSection.systemHealth: const SystemHealthSection(),
      SuperAdminSection.globalUsers: const GlobalUsersSection(),
      SuperAdminSection.branches: const BranchesSection(),
      SuperAdminSection.auditLogs: const SuperAdminAuditLogsSection(),
      SuperAdminSection.settings: const SuperAdminSettingsSection(),
    };

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 200),
      child: widgets[section] ?? const BehavioralIntelligenceSection(),
    );
  }

  void _showMobileNav(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => _MobileNavSheet(ref: ref),
    );
  }
}

class _MobileNavSheet extends ConsumerWidget {
  final WidgetRef ref;
  const _MobileNavSheet({required this.ref});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(superAdminSectionProvider);
    return Container(
      height: MediaQuery.of(context).size.height * 0.7,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: SuperAdminNavItem.allItems.map((item) {
          final isActive = item.section == current;
          return ListTile(
            leading: Icon(item.icon, color: isActive ? AppColors.kPrimary : AppColors.kTextSecondary),
            title: Text(
              item.label,
              style: TextStyle(
                color: isActive ? AppColors.kPrimary : AppColors.kTextSecondary,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
            selected: isActive,
            selectedTileColor: AppColors.kPrimary.withValues(alpha: 0.08),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            onTap: () {
              ref.read(superAdminSectionProvider.notifier).state = item.section;
              Navigator.pop(context);
            },
          );
        }).toList(),
      ),
    );
  }
}

class _MobileBottomNav extends ConsumerWidget {
  final SuperAdminSection currentSection;
  const _MobileBottomNav({required this.currentSection});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = <SuperAdminSection, IconData>{
      SuperAdminSection.behavioralIntelligence: PhosphorIcons.cube(),
      SuperAdminSection.securityCenter: PhosphorIcons.shield(),
      SuperAdminSection.systemHealth: PhosphorIcons.chartLine(),
      SuperAdminSection.globalUsers: PhosphorIcons.users(),
      SuperAdminSection.settings: PhosphorIcons.treeStructure(),
    };
    return BottomNavigationBar(
      currentIndex: items.keys.toList().indexOf(currentSection).clamp(0, items.length - 1),
      onTap: (i) => ref.read(superAdminSectionProvider.notifier).state = items.keys.elementAt(i),
      selectedItemColor: AppColors.kPrimary,
      unselectedItemColor: AppColors.kTextSecondary,
      items: items.entries.map((e) => BottomNavigationBarItem(
        icon: Icon(e.value),
        label: _getLabel(e.key),
      )).toList(),
    );
  }

  String _getLabel(SuperAdminSection section) {
    switch (section) {
      case SuperAdminSection.behavioralIntelligence:
        return 'AI';
      case SuperAdminSection.securityCenter:
        return 'Security';
      case SuperAdminSection.systemHealth:
        return 'Health';
      case SuperAdminSection.globalUsers:
        return 'Users';
      case SuperAdminSection.settings:
        return 'Settings';
      default:
        return '';
    }
  }
}
