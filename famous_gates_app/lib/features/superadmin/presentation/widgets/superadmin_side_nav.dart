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
  static List<SuperAdminNavGroup> get groupedItems => [
        SuperAdminNavGroup(
          label: 'Command',
          items: [
            SuperAdminNavItem(
                section: SuperAdminSection.adminDashboard,
                label: 'Dashboard',
                icon: PhosphorIcons.house()),
            SuperAdminNavItem(
                section: SuperAdminSection.lina,
                label: 'Lina(Ai Service)',
                icon: PhosphorIcons.sparkle()),
            SuperAdminNavItem(
                section: SuperAdminSection.securityCenter,
                label: 'Security Center',
                icon: PhosphorIcons.shield()),
            SuperAdminNavItem(
                section: SuperAdminSection.systemHealth,
                label: 'System Health',
                icon: PhosphorIcons.chartLine()),
            SuperAdminNavItem(
                section: SuperAdminSection.globalSearch,
                label: 'Global Search',
                icon: PhosphorIcons.magnifyingGlass()),
          ],
        ),
        SuperAdminNavGroup(
          label: 'Access & Organization',
          items: [
            SuperAdminNavItem(
                section: SuperAdminSection.globalUsers,
                label: 'Users',
                icon: PhosphorIcons.users()),
            SuperAdminNavItem(
                section: SuperAdminSection.personnelRegistry,
                label: 'Personnel Registry',
                icon: PhosphorIcons.identificationBadge()),
            SuperAdminNavItem(
                section: SuperAdminSection.rolesPermissions,
                label: 'Roles & Permissions',
                icon: PhosphorIcons.key()),
            SuperAdminNavItem(
                section: SuperAdminSection.branches,
                label: 'Branches',
                icon: PhosphorIcons.buildings()),
            SuperAdminNavItem(
                section: SuperAdminSection.departments,
                label: 'Departments',
                icon: PhosphorIcons.buildings()),
          ],
        ),
        SuperAdminNavGroup(
          label: 'Hotel Setup',
          items: [
            SuperAdminNavItem(
                section: SuperAdminSection.rooms,
                label: 'Rooms',
                icon: PhosphorIcons.bed()),
            SuperAdminNavItem(
                section: SuperAdminSection.rates,
                label: 'Rate Plans',
                icon: PhosphorIcons.trendUp()),
            SuperAdminNavItem(
                section: SuperAdminSection.paymentBillingSettings,
                label: 'Payment & Billing',
                icon: PhosphorIcons.creditCard()),
            SuperAdminNavItem(
                section: SuperAdminSection.reportTemplates,
                label: 'Report Templates',
                icon: PhosphorIcons.fileText()),
            SuperAdminNavItem(
                section: SuperAdminSection.documentTemplates,
                label: 'Document Templates',
                icon: PhosphorIcons.notePencil()),
          ],
        ),
        SuperAdminNavGroup(
          label: 'POS & Sales Setup',
          items: [
            SuperAdminNavItem(
                section: SuperAdminSection.posConfiguration,
                label: 'Cashier Station POS',
                icon: PhosphorIcons.desktop()),
            SuperAdminNavItem(
                section: SuperAdminSection.cashierStationConfig,
                label: 'Station & Printer Config',
                icon: PhosphorIcons.printer()),
            SuperAdminNavItem(
                section: SuperAdminSection.restaurantMenu,
                label: 'Restaurant Menu',
                icon: PhosphorIcons.forkKnife()),
            SuperAdminNavItem(
                section: SuperAdminSection.barMenu,
                label: 'Bar Menu',
                icon: PhosphorIcons.wine()),
            SuperAdminNavItem(
                section: SuperAdminSection.menuPricing,
                label: 'Menu Pricing & Variants',
                icon: PhosphorIcons.tag()),
            SuperAdminNavItem(
                section: SuperAdminSection.kyogongServices,
                label: 'Kyogong POS Services',
                icon: PhosphorIcons.sparkle()),
            SuperAdminNavItem(
                section: SuperAdminSection.nonConsumablesCatalog,
                label: 'Non-Consumables POS',
                icon: PhosphorIcons.package()),
            const SuperAdminNavItem(
                section: SuperAdminSection.posOutletMenu,
                label: 'POS Outlet Menu',
                icon: Icons.storefront),
            SuperAdminNavItem(
                section: SuperAdminSection.tillNumbers,
                label: 'POS Till Numbers',
                icon: PhosphorIcons.identificationCard()),
          ],
        ),
        SuperAdminNavGroup(
          label: 'Finance & Inventory',
          items: [
            SuperAdminNavItem(
                section: SuperAdminSection.finance,
                label: 'Finance',
                icon: PhosphorIcons.currencyDollar()),
            SuperAdminNavItem(
                section: SuperAdminSection.inventory,
                label: 'Inventory',
                icon: PhosphorIcons.package()),
            SuperAdminNavItem(
                section: SuperAdminSection.storekeepingConfig,
                label: 'Storekeeping Config',
                icon: PhosphorIcons.warehouse()),
            SuperAdminNavItem(
                section: SuperAdminSection.kitchenLedgerItems,
                label: 'Kitchen Ledger Items',
                icon: PhosphorIcons.cookingPot()),
            SuperAdminNavItem(
                section: SuperAdminSection.suppliers,
                label: 'Suppliers',
                icon: PhosphorIcons.truck()),
            SuperAdminNavItem(
                section: SuperAdminSection.payrollSettings,
                label: 'Payroll Settings',
                icon: PhosphorIcons.money()),
          ],
        ),
        SuperAdminNavGroup(
          label: 'Logistics',
          items: [
            SuperAdminNavItem(
                section: SuperAdminSection.fleetOverview,
                label: 'Fleet Overview',
                icon: PhosphorIcons.car()),
            SuperAdminNavItem(
                section: SuperAdminSection.vehicles,
                label: 'Vehicles',
                icon: PhosphorIcons.car()),
            SuperAdminNavItem(
                section: SuperAdminSection.drivers,
                label: 'Drivers',
                icon: PhosphorIcons.user()),
          ],
        ),
        SuperAdminNavGroup(
          label: 'System',
          items: [
            SuperAdminNavItem(
                section: SuperAdminSection.auditLogs,
                label: 'Audit Logs',
                icon: PhosphorIcons.clipboardText()),
            SuperAdminNavItem(
                section: SuperAdminSection.reports,
                label: 'Reports',
                icon: PhosphorIcons.chartBar()),
            SuperAdminNavItem(
                section: SuperAdminSection.integrations,
                label: 'Integrations',
                icon: PhosphorIcons.globe()),
            SuperAdminNavItem(
                section: SuperAdminSection.settings,
                label: 'Settings',
                icon: PhosphorIcons.gear()),
          ],
        ),
        SuperAdminNavGroup(
          label: 'God Controls',
          items: [
            SuperAdminNavItem(
                section: SuperAdminSection.impersonation,
                label: 'Impersonation',
                icon: PhosphorIcons.userGear()),
            SuperAdminNavItem(
                section: SuperAdminSection.featureFlags,
                label: 'Feature Flags',
                icon: PhosphorIcons.slidersHorizontal()),
            SuperAdminNavItem(
                section: SuperAdminSection.toggleSettings,
                label: 'Toggle Settings',
                icon: PhosphorIcons.toggleRight()),
            SuperAdminNavItem(
                section: SuperAdminSection.announcements,
                label: 'Announcements',
                icon: PhosphorIcons.megaphone()),
            SuperAdminNavItem(
                section: SuperAdminSection.emergencyControls,
                label: 'Emergency Controls',
                icon: PhosphorIcons.warning()),
            SuperAdminNavItem(
                section: SuperAdminSection.dataOverrides,
                label: 'Data Overrides',
                icon: PhosphorIcons.pencilLine()),
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

    Future<void> handleLogout() async {
      await ref.read(authNotifierProvider.notifier).logout();
    }

    return Container(
      width: widget.width,
      color: Colors.white,
      child: Column(
        children: [
          // Brand header
          Container(
            padding: const EdgeInsets.all(20),
            child: widget.isCollapsed
                ? Container(
                    width: 40,
                    height: 40,
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
                          fontSize: 16,
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
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Center(
                          child: Text(
                            'FG',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
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
                              'FamousGate',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Text(
                              'SuperAdmin Console',
                              style: TextStyle(
                                fontSize: 11,
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

          // Nav items
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: groups.length,
              itemBuilder: (context, groupIdx) {
                final group = groups[groupIdx];
                final isGroupCollapsed = _collapsedGroups.contains(group.label);

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (!widget.isCollapsed)
                      InkWell(
                        onTap: () => setState(() {
                          if (isGroupCollapsed) {
                            _collapsedGroups.remove(group.label);
                          } else {
                            _collapsedGroups.add(group.label);
                          }
                        }),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 20,
                            vertical: 8,
                          ),
                          child: Row(
                            children: [
                              Text(
                                group.label.toUpperCase(),
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.grey,
                                  letterSpacing: 1.2,
                                ),
                              ),
                              const Spacer(),
                              Icon(
                                isGroupCollapsed
                                    ? PhosphorIcons.caretDown()
                                    : PhosphorIcons.caretUp(),
                                size: 12,
                                color: Colors.grey,
                              ),
                            ],
                          ),
                        ),
                      ),
                    if (!isGroupCollapsed || widget.isCollapsed)
                      ...group.items.map((item) {
                        final isSelected = currentSection == item.section;
                        return InkWell(
                          onTap: () => ref
                              .read(superAdminSectionProvider.notifier)
                              .state = item.section,
                          child: Container(
                            margin: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 2,
                            ),
                            padding: EdgeInsets.symmetric(
                              horizontal: widget.isCollapsed ? 12 : 16,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? AppColors.kPrimary.withValues(alpha: 0.1)
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  item.icon,
                                  size: 20,
                                  color: isSelected
                                      ? AppColors.kPrimary
                                      : Colors.grey.shade700,
                                ),
                                if (!widget.isCollapsed) ...[
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      item.label,
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: isSelected
                                            ? FontWeight.bold
                                            : FontWeight.normal,
                                        color: isSelected
                                            ? AppColors.kPrimary
                                            : Colors.grey.shade800,
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        );
                      }),
                    const SizedBox(height: 8),
                  ],
                );
              },
            ),
          ),

          const Divider(height: 1),
          // Footer / Logout
          Padding(
            padding: const EdgeInsets.all(12),
            child: InkWell(
              onTap: handleLogout,
              borderRadius: BorderRadius.circular(8),
              child: Container(
                padding: EdgeInsets.symmetric(
                  horizontal: widget.isCollapsed ? 12 : 16,
                  vertical: 10,
                ),
                child: Row(
                  children: [
                    Icon(
                      PhosphorIcons.signOut(),
                      size: 20,
                      color: Colors.red.shade600,
                    ),
                    if (!widget.isCollapsed) ...[
                      const SizedBox(width: 12),
                      Text(
                        'Sign Out',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Colors.red.shade600,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
