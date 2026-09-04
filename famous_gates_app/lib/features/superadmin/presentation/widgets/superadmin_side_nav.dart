import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/superadmin_providers.dart';
import '../../../../features/auth/domain/auth_notifier.dart';

// ─── Data models ─────────────────────────────────────────────────────────────

class SuperAdminNavItem {
  final SuperAdminSection section;
  final String label;
  final IconData icon;

  const SuperAdminNavItem({
    required this.section,
    required this.label,
    required this.icon,
  });

  // Flat list for mobile sheet / legacy usage
  static List<SuperAdminNavItem> get allItems =>
      groupedItems.expand((g) => g.items).toList();

  // Grouped nav — single source of truth
  // Re-ordered: Most-used first (Access & Org, POS & Sales), AI Service at the bottom
  static List<SuperAdminNavGroup> get groupedItems => [
        // 1. Overview / Home
        SuperAdminNavGroup(
          label: 'Overview',
          items: [
            SuperAdminNavItem(
              section: SuperAdminSection.adminDashboard,
              label: 'Dashboard',
              icon: PhosphorIcons.house(),
            ),
          ],
        ),

        // 2. Access & Organization (High Priority / Most Used)
        SuperAdminNavGroup(
          label: 'Access & Organization',
          items: [
            SuperAdminNavItem(
              section: SuperAdminSection.globalUsers,
              label: 'Users',
              icon: PhosphorIcons.users(),
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.personnelRegistry,
              label: 'Personnel Registry',
              icon: PhosphorIcons.identificationBadge(),
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.rolesPermissions,
              label: 'Roles & Permissions',
              icon: PhosphorIcons.key(),
            ),
            const SuperAdminNavItem(
              section: SuperAdminSection.branches,
              label: 'Branches',
              icon: Icons.business_outlined,
            ),
            const SuperAdminNavItem(
              section: SuperAdminSection.departments,
              label: 'Departments',
              icon: Icons.account_tree_outlined,
            ),
          ],
        ),

        // 3. POS & Sales Setup (High Priority / Most Used)
        SuperAdminNavGroup(
          label: 'POS & Sales Setup',
          items: [
            SuperAdminNavItem(
              section: SuperAdminSection.posConfiguration,
              label: 'Cashier Station POS',
              icon: PhosphorIcons.desktop(),
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.cashierStationConfig,
              label: 'Station & Printer Config',
              icon: PhosphorIcons.printer(),
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.restaurantMenu,
              label: 'Restaurant Menu',
              icon: PhosphorIcons.forkKnife(),
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.barMenu,
              label: 'Bar Menu',
              icon: PhosphorIcons.wine(),
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.menuPricing,
              label: 'Menu Pricing & Variants',
              icon: PhosphorIcons.tag(),
            ),
            const SuperAdminNavItem(
              section: SuperAdminSection.posOutletMenu,
              label: 'POS Outlet Menu',
              icon: Icons.storefront_outlined,
            ),
            const SuperAdminNavItem(
              section: SuperAdminSection.posTerminals,
              label: 'POS Terminals',
              icon: Icons.point_of_sale_outlined,
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.tillNumbers,
              label: 'POS Till Numbers',
              icon: PhosphorIcons.identificationCard(),
            ),
            const SuperAdminNavItem(
              section: SuperAdminSection.kyogongServices,
              label: 'Kyogong POS Services',
              icon: Icons.spa_outlined,
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.nonConsumablesCatalog,
              label: 'Non-Consumables POS',
              icon: PhosphorIcons.package(),
            ),
          ],
        ),

        // 4. Hotel Setup
        SuperAdminNavGroup(
          label: 'Hotel Setup',
          items: [
            SuperAdminNavItem(
              section: SuperAdminSection.rooms,
              label: 'Rooms',
              icon: PhosphorIcons.bed(),
            ),
            const SuperAdminNavItem(
              section: SuperAdminSection.rates,
              label: 'Rate Plans',
              icon: Icons.price_change_outlined,
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.paymentBillingSettings,
              label: 'Payment & Billing',
              icon: PhosphorIcons.creditCard(),
            ),
            const SuperAdminNavItem(
              section: SuperAdminSection.documentTemplates,
              label: 'Document Templates',
              icon: Icons.description_outlined,
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.reportTemplates,
              label: 'Report Templates',
              icon: PhosphorIcons.fileText(),
            ),
          ],
        ),

        // 5. Finance & Inventory
        SuperAdminNavGroup(
          label: 'Finance & Inventory',
          items: [
            SuperAdminNavItem(
              section: SuperAdminSection.finance,
              label: 'Finance',
              icon: PhosphorIcons.currencyDollar(),
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.inventory,
              label: 'Inventory',
              icon: PhosphorIcons.package(),
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.storekeepingConfig,
              label: 'Storekeeping Config',
              icon: PhosphorIcons.warehouse(),
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.kitchenLedgerItems,
              label: 'Kitchen Ledger Items',
              icon: PhosphorIcons.cookingPot(),
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.suppliers,
              label: 'Suppliers',
              icon: PhosphorIcons.truck(),
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.payrollSettings,
              label: 'Payroll Settings',
              icon: PhosphorIcons.money(),
            ),
          ],
        ),

        // 6. Logistics
        SuperAdminNavGroup(
          label: 'Logistics',
          items: [
            SuperAdminNavItem(
              section: SuperAdminSection.fleetOverview,
              label: 'Fleet Overview',
              icon: PhosphorIcons.car(),
            ),
            const SuperAdminNavItem(
              section: SuperAdminSection.vehicles,
              label: 'Vehicles',
              icon: Icons.commute_outlined,
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.drivers,
              label: 'Drivers',
              icon: PhosphorIcons.user(),
            ),
          ],
        ),

        // 7. System & Monitoring
        SuperAdminNavGroup(
          label: 'System & Monitoring',
          items: [
            SuperAdminNavItem(
              section: SuperAdminSection.securityCenter,
              label: 'Security Center',
              icon: PhosphorIcons.shieldCheck(),
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.systemHealth,
              label: 'System Health',
              icon: PhosphorIcons.activity(),
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.auditLogs,
              label: 'Audit Logs',
              icon: PhosphorIcons.clipboardText(),
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.reports,
              label: 'Reports',
              icon: PhosphorIcons.chartBar(),
            ),
            const SuperAdminNavItem(
              section: SuperAdminSection.integrations,
              label: 'Integrations',
              icon: Icons.cable_outlined,
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.globalSearch,
              label: 'Global Search',
              icon: PhosphorIcons.magnifyingGlass(),
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.settings,
              label: 'Settings',
              icon: PhosphorIcons.gear(),
            ),
          ],
        ),

        // 8. God Controls (Advanced Configuration)
        SuperAdminNavGroup(
          label: 'God Controls',
          items: [
            SuperAdminNavItem(
              section: SuperAdminSection.impersonation,
              label: 'Impersonation',
              icon: PhosphorIcons.userGear(),
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.featureFlags,
              label: 'Feature Flags',
              icon: PhosphorIcons.slidersHorizontal(),
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.toggleSettings,
              label: 'Toggle Settings',
              icon: PhosphorIcons.toggleLeft(),
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.announcements,
              label: 'Announcements',
              icon: PhosphorIcons.megaphone(),
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.emergencyControls,
              label: 'Emergency Controls',
              icon: PhosphorIcons.warning(),
            ),
            SuperAdminNavItem(
              section: SuperAdminSection.dataOverrides,
              label: 'Data Overrides',
              icon: PhosphorIcons.pencilLine(),
            ),
          ],
        ),

        // 9. AI Services (At the very bottom as requested)
        const SuperAdminNavGroup(
          label: 'AI Services',
          items: [
            SuperAdminNavItem(
              section: SuperAdminSection.lina,
              label: 'Lina (AI Service)',
              icon: Icons.auto_awesome,
            ),
          ],
        ),
      ];
}

class SuperAdminNavGroup {
  final String label;
  final List<SuperAdminNavItem> items;
  const SuperAdminNavGroup({required this.label, required this.items});
}

// ─── Side Nav widget ──────────────────────────────────────────────────────────

class SuperAdminSideNav extends ConsumerStatefulWidget {
  final double width;
  final bool isCollapsed;

  const SuperAdminSideNav({
    super.key,
    required this.width,
    required this.isCollapsed,
  });

  @override
  ConsumerState<SuperAdminSideNav> createState() => _SuperAdminSideNavState();
}

class _SuperAdminSideNavState extends ConsumerState<SuperAdminSideNav> {
  final Set<String> _collapsedGroups = {};

  @override
  Widget build(BuildContext context) {
    final currentSection = ref.watch(superAdminSectionProvider);
    final groups = SuperAdminNavItem.groupedItems;
    final borderColor = Colors.grey.shade200;
    final isCollapsed = widget.isCollapsed;

    Future<void> handleLogout() async {
      await ref.read(authNotifierProvider.notifier).logout();
    }

    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOutCubic,
      width: widget.width,
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(right: BorderSide(color: borderColor)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 4,
            offset: const Offset(1, 0),
          ),
        ],
      ),
      child: SafeArea(
        right: false,
        child: Column(
          children: [
            // Brand header matching MasterDashboardShell & Admin
            Container(
              height: 60,
              padding: EdgeInsets.symmetric(horizontal: isCollapsed ? 12 : 16),
              alignment: Alignment.centerLeft,
              child: isCollapsed
                  ? Center(
                      child: Container(
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
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ),
                    )
                  : Row(
                      children: [
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
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'FamousGate',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.kTextPrimary,
                                ),
                              ),
                              Text(
                                'SuperAdmin Console',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 11,
                                  color: AppColors.kTextSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
            ),
            Divider(height: 1, color: borderColor),

            // Scrollable Nav items with clean, unified UI/UX
            Expanded(
              child: ScrollConfiguration(
                behavior: ScrollConfiguration.of(context).copyWith(scrollbars: false),
                child: ListView.builder(
                  padding: const EdgeInsets.only(top: 6, bottom: 16),
                  itemCount: groups.length,
                  itemBuilder: (context, groupIdx) {
                    final group = groups[groupIdx];
                    final isGroupCollapsed = _collapsedGroups.contains(group.label);

                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (!isCollapsed)
                          InkWell(
                            onTap: () => setState(() {
                              if (isGroupCollapsed) {
                                _collapsedGroups.remove(group.label);
                              } else {
                                _collapsedGroups.add(group.label);
                              }
                            }),
                            borderRadius: BorderRadius.circular(4),
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
                              child: Row(
                                children: [
                                  Text(
                                    group.label.toUpperCase(),
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.grey.shade500,
                                      letterSpacing: 1.2,
                                    ),
                                  ),
                                  const Spacer(),
                                  Icon(
                                    isGroupCollapsed
                                        ? Icons.expand_more
                                        : Icons.expand_less,
                                    size: 14,
                                    color: Colors.grey.shade400,
                                  ),
                                ],
                              ),
                            ),
                          )
                        else if (groupIdx > 0)
                          const SizedBox(height: 6),
                        if (!isGroupCollapsed || isCollapsed)
                          ...group.items.map((item) {
                            final isActive = currentSection == item.section;
                            return _SuperAdminNavTile(
                              item: item,
                              isActive: isActive,
                              isCollapsed: isCollapsed,
                              onTap: () => ref
                                  .read(superAdminSectionProvider.notifier)
                                  .state = item.section,
                            );
                          }),
                      ],
                    );
                  },
                ),
              ),
            ),

            Divider(height: 1, color: borderColor),

            // Footer Sign Out button with unified module styling
            Padding(
              padding: EdgeInsets.all(isCollapsed ? 8 : 12),
              child: isCollapsed
                  ? Tooltip(
                      message: 'Sign Out',
                      child: IconButton(
                        onPressed: handleLogout,
                        icon: Icon(
                          PhosphorIcons.signOut(),
                          size: 20,
                          color: Colors.red.shade600,
                        ),
                      ),
                    )
                  : InkWell(
                      onTap: handleLogout,
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        height: 38,
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50.withValues(alpha: 0.6),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.red.shade100),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              PhosphorIcons.signOut(),
                              size: 18,
                              color: Colors.red.shade600,
                            ),
                            const SizedBox(width: 10),
                            Text(
                              'Sign Out',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: Colors.red.shade600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Individual Nav Tile matching MasterDashboardShell & AdminSideNav ────────

class _SuperAdminNavTile extends StatelessWidget {
  final SuperAdminNavItem item;
  final bool isActive;
  final bool isCollapsed;
  final VoidCallback onTap;

  const _SuperAdminNavTile({
    required this.item,
    required this.isActive,
    required this.isCollapsed,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    const accent = AppColors.kPrimary;
    const idleIconColor = AppColors.kTextSecondary;

    final tile = Container(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 1.5),
      decoration: BoxDecoration(
        color: isActive ? accent.withValues(alpha: 0.08) : Colors.transparent,
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
                ? const Border(left: BorderSide(color: accent, width: 3))
                : null,
          ),
          child: Row(
            mainAxisAlignment:
                isCollapsed ? MainAxisAlignment.center : MainAxisAlignment.start,
            children: [
              Icon(
                item.icon,
                size: 18,
                color: isActive ? accent : idleIconColor,
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
                      fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                      color: isActive ? accent : Colors.grey.shade800,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );

    if (isCollapsed) {
      return Tooltip(
        message: item.label,
        waitDuration: const Duration(milliseconds: 300),
        child: tile,
      );
    }

    return tile;
  }
}
