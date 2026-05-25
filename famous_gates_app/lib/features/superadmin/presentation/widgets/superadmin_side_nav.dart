import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/superadmin_providers.dart';
import '../../../../features/auth/domain/auth_notifier.dart';

class SuperAdminNavItem {
  final SuperAdminSection section;
  final String label;
  final IconData icon;

  const SuperAdminNavItem({
    required this.section,
    required this.label,
    required this.icon,
  });

  static List<SuperAdminNavItem> get allItems => [
    SuperAdminNavItem(
      section: SuperAdminSection.behavioralIntelligence,
      label: 'Behavioral Intelligence',
      icon: PhosphorIcons.cube(),
    ),
    SuperAdminNavItem(
      section: SuperAdminSection.securityCenter,
      label: 'Security Center',
      icon: PhosphorIcons.shield(),
    ),
    SuperAdminNavItem(
      section: SuperAdminSection.systemHealth,
      label: 'System Health',
      icon: PhosphorIcons.chartLine(),
    ),
    SuperAdminNavItem(
      section: SuperAdminSection.globalUsers,
      label: 'Global Users',
      icon: PhosphorIcons.users(),
    ),
    SuperAdminNavItem(
      section: SuperAdminSection.branches,
      label: 'Branches',
      icon: PhosphorIcons.buildings(),
    ),
    SuperAdminNavItem(
      section: SuperAdminSection.auditLogs,
      label: 'Audit Logs',
      icon: PhosphorIcons.fileText(),
    ),
    SuperAdminNavItem(
      section: SuperAdminSection.settings,
      label: 'Settings',
      icon: PhosphorIcons.treeStructure(),
    ),
  ];
}

class SuperAdminSideNav extends ConsumerWidget {
  final double width;
  final bool isCollapsed;

  const SuperAdminSideNav({
    super.key,
    required this.width,
    required this.isCollapsed,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentSection = ref.watch(superAdminSectionProvider);

    Future<void> handleLogout() async {
      await ref.read(authNotifierProvider.notifier).logout();
    }

    return Container(
      width: width,
      color: Colors.white,
      child: Column(
        children: [
          // Logo Area
          Container(
            padding: const EdgeInsets.all(24),
            child: isCollapsed
              ? Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.kPrimary,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Center(
                    child: Text(
                      'S',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 20,
                      ),
                    ),
                  ),
                )
              : Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.kPrimary,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Center(
                        child: Text(
                          'S',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 20,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'SuperAdmin',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                            ),
                          ),
                          Text(
                            'Famous Gates',
                            style: TextStyle(
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
          
          // Navigation Items
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 12),
              itemCount: SuperAdminNavItem.allItems.length,
              itemBuilder: (context, index) {
                final item = SuperAdminNavItem.allItems[index];
                final isActive = item.section == currentSection;
                
                return _buildNavItem(
                  item: item,
                  isActive: isActive,
                  isCollapsed: isCollapsed,
                  onTap: () => ref.read(superAdminSectionProvider.notifier).state = item.section,
                );
              },
            ),
          ),
          
          const Divider(height: 1),
          
          // Bottom Actions
          Padding(
            padding: const EdgeInsets.all(16),
            child: isCollapsed
              ? IconButton(
                  onPressed: handleLogout,
                  icon: Icon(PhosphorIcons.signOut(), color: Colors.grey.shade600),
                  tooltip: 'Logout',
                )
              : OutlinedButton.icon(
                  onPressed: handleLogout,
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

  Widget _buildNavItem({
    required SuperAdminNavItem item,
    required bool isActive,
    required bool isCollapsed,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: EdgeInsets.symmetric(
            horizontal: isCollapsed ? 0 : 16,
            vertical: 12,
          ),
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
          decoration: BoxDecoration(
            color: isActive ? AppColors.kPrimary.withValues(alpha: 0.1) : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: isCollapsed
            ? Center(
                child: Icon(
                  item.icon,
                  color: isActive ? AppColors.kPrimary : Colors.grey.shade500,
                  size: 24,
                ),
              )
            : Row(
                children: [
                  Icon(
                    item.icon,
                    color: isActive ? AppColors.kPrimary : Colors.grey.shade500,
                    size: 22,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      item.label,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
                        color: isActive ? AppColors.kPrimary : Colors.grey.shade700,
                      ),
                    ),
                  ),
                  if (isActive)
                    Container(
                      width: 4,
                      height: 4,
                      decoration: BoxDecoration(
                        color: AppColors.kPrimary,
                        shape: BoxShape.circle,
                      ),
                    ),
                ],
              ),
        ),
      ),
    );
  }
}
