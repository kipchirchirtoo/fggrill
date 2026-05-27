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
          label: 'Superadmin',
          items: [
            SuperAdminNavItem(
                section: SuperAdminSection.adminDashboard,
                label: 'Dashboard',
                icon: PhosphorIcons.house()),
            SuperAdminNavItem(
                section: SuperAdminSection.behavioralIntelligence,
                label: 'AI Intelligence',
                icon: PhosphorIcons.cube()),
            SuperAdminNavItem(
                section: SuperAdminSection.securityCenter,
                label: 'Security Center',
                icon: PhosphorIcons.shield()),
            SuperAdminNavItem(
                section: SuperAdminSection.systemHealth,
                label: 'System Health',
                icon: PhosphorIcons.chartLine()),
            SuperAdminNavItem(
                section: SuperAdminSection.roleMigration,
                label: 'Role Migration',
                icon: PhosphorIcons.arrowsCounterClockwise()),
          ],
        ),
        SuperAdminNavGroup(
          label: 'Users & Access',
          items: [
            SuperAdminNavItem(
                section: SuperAdminSection.globalUsers,
                label: 'Users',
                icon: PhosphorIcons.users()),
            SuperAdminNavItem(
                section: SuperAdminSection.departments,
                label: 'Departments',
                icon: PhosphorIcons.buildings()),
          ],
        ),
        SuperAdminNavGroup(
          label: 'Hotel Operations',
          items: [
            SuperAdminNavItem(
                section: SuperAdminSection.reservations,
                label: 'Reservations',
                icon: PhosphorIcons.calendarBlank()),
            SuperAdminNavItem(
                section: SuperAdminSection.checkin,
                label: 'Check-In',
                icon: PhosphorIcons.checkCircle()),
            SuperAdminNavItem(
                section: SuperAdminSection.rooms,
                label: 'Rooms',
                icon: PhosphorIcons.bed()),
            SuperAdminNavItem(
                section: SuperAdminSection.rates,
                label: 'Rate Plans',
                icon: PhosphorIcons.trendUp()),
            SuperAdminNavItem(
                section: SuperAdminSection.guests,
                label: 'Guests',
                icon: PhosphorIcons.userCircle()),
            SuperAdminNavItem(
                section: SuperAdminSection.housekeeping,
                label: 'Housekeeping',
                icon: PhosphorIcons.sparkle()),
            SuperAdminNavItem(
                section: SuperAdminSection.maintenance,
                label: 'Maintenance',
                icon: PhosphorIcons.wrench()),
            SuperAdminNavItem(
                section: SuperAdminSection.channelManager,
                label: 'Channel Manager',
                icon: PhosphorIcons.globe()),
          ],
        ),
        SuperAdminNavGroup(
          label: 'Food & Beverage',
          items: [
            SuperAdminNavItem(
                section: SuperAdminSection.restaurant,
                label: 'Restaurant',
                icon: PhosphorIcons.forkKnife()),
            SuperAdminNavItem(
                section: SuperAdminSection.restaurantMenu,
                label: 'Restaurant Menu',
                icon: PhosphorIcons.bookOpen()),
            SuperAdminNavItem(
                section: SuperAdminSection.barMenu,
                label: 'Bar Menu',
                icon: PhosphorIcons.wine()),
            SuperAdminNavItem(
                section: SuperAdminSection.kyogongServices,
                label: 'Kyogong Services',
                icon: PhosphorIcons.sparkle()),
            SuperAdminNavItem(
                section: SuperAdminSection.wastageAnalytics,
                label: 'Wastage Analytics',
                icon: PhosphorIcons.trash()),
          ],
        ),
        SuperAdminNavGroup(
          label: 'People & HR',
          items: [
            SuperAdminNavItem(
                section: SuperAdminSection.personnelRegistry,
                label: 'Personnel Registry',
                icon: PhosphorIcons.users()),
            SuperAdminNavItem(
                section: SuperAdminSection.hrPayroll,
                label: 'HR & Payroll',
                icon: PhosphorIcons.money()),
            SuperAdminNavItem(
                section: SuperAdminSection.idCards,
                label: 'ID Cards',
                icon: PhosphorIcons.identificationCard()),
            SuperAdminNavItem(
                section: SuperAdminSection.employeeDocs,
                label: 'Employee Docs',
                icon: PhosphorIcons.fileText()),
            SuperAdminNavItem(
                section: SuperAdminSection.cashierStation,
                label: 'Cashier Station',
                icon: PhosphorIcons.creditCard()),
          ],
        ),
        SuperAdminNavGroup(
          label: 'Finance & Store',
          items: [
            SuperAdminNavItem(
                section: SuperAdminSection.finance,
                label: 'Finance',
                icon: PhosphorIcons.currencyDollar()),
            SuperAdminNavItem(
                section: SuperAdminSection.storekeeping,
                label: 'Storekeeping',
                icon: PhosphorIcons.warehouse()),
            SuperAdminNavItem(
                section: SuperAdminSection.inventory,
                label: 'Inventory',
                icon: PhosphorIcons.package()),
            SuperAdminNavItem(
                section: SuperAdminSection.suppliers,
                label: 'Suppliers',
                icon: PhosphorIcons.truck()),
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
          label: 'System & Config',
          items: [
            SuperAdminNavItem(
                section: SuperAdminSection.branches,
                label: 'Branches',
                icon: PhosphorIcons.buildings()),
            SuperAdminNavItem(
                section: SuperAdminSection.auditLogs,
                label: 'Audit Logs',
                icon: PhosphorIcons.clipboardText()),
            SuperAdminNavItem(
                section: SuperAdminSection.reports,
                label: 'Reports',
                icon: PhosphorIcons.chartBar()),
            SuperAdminNavItem(
                section: SuperAdminSection.communications,
                label: 'Communications',
                icon: PhosphorIcons.chatCircle()),
            SuperAdminNavItem(
                section: SuperAdminSection.bookingsInvoices,
                label: 'Bookings & Invoices',
                icon: PhosphorIcons.receipt()),
            SuperAdminNavItem(
                section: SuperAdminSection.settings,
                label: 'Settings',
                icon: PhosphorIcons.gear()),
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
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Center(
                      child: Text('S',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 20)),
                    ),
                  )
                : Row(children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: const BoxDecoration(
                          color: AppColors.kPrimary,
                          borderRadius:
                              BorderRadius.all(Radius.circular(10))),
                      child: const Center(
                        child: Text('S',
                            style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 20)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('SuperAdmin',
                              style: TextStyle(
                                  fontWeight: FontWeight.bold, fontSize: 15)),
                          Text('Famous Gates',
                              style: TextStyle(
                                  fontSize: 11, color: Colors.grey)),
                        ],
                      ),
                    ),
                  ]),
          ),
          const Divider(height: 1),

          // Nav items
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: groups.length,
              itemBuilder: (_, gi) {
                final group = groups[gi];
                final isGroupCollapsed =
                    _collapsedGroups.contains(group.label);

                if (widget.isCollapsed) {
                  // Icon-only mode
                  return Column(children: [
                    ...group.items.map((item) {
                      final isActive = item.section == currentSection;
                      return Tooltip(
                        message: item.label,
                        preferBelow: false,
                        child: Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: () => ref
                                .read(superAdminSectionProvider.notifier)
                                .state = item.section,
                            child: Container(
                              margin: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 2),
                              padding:
                                  const EdgeInsets.symmetric(vertical: 10),
                              decoration: BoxDecoration(
                                color: isActive
                                    ? AppColors.kPrimary
                                        .withValues(alpha: 0.1)
                                    : Colors.transparent,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Center(
                                child: Icon(item.icon,
                                    color: isActive
                                        ? AppColors.kPrimary
                                        : Colors.grey.shade500,
                                    size: 20),
                              ),
                            ),
                          ),
                        ),
                      );
                    }),
                    if (gi < groups.length - 1)
                      const Divider(
                          height: 1, indent: 12, endIndent: 12),
                  ]);
                }

                // Expanded mode with group header
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    InkWell(
                      onTap: () => setState(() {
                        if (isGroupCollapsed) {
                          _collapsedGroups.remove(group.label);
                        } else {
                          _collapsedGroups.add(group.label);
                        }
                      }),
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 10, 12, 4),
                        child: Row(children: [
                          Expanded(
                            child: Text(
                              group.label.toUpperCase(),
                              style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.grey.shade400,
                                  letterSpacing: 1.2),
                            ),
                          ),
                          Icon(
                            isGroupCollapsed
                                ? PhosphorIcons.caretRight()
                                : PhosphorIcons.caretDown(),
                            size: 11,
                            color: Colors.grey.shade400,
                          ),
                        ]),
                      ),
                    ),
                    if (!isGroupCollapsed)
                      ...group.items.map((item) {
                        final isActive = item.section == currentSection;
                        return Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: () => ref
                                .read(superAdminSectionProvider.notifier)
                                .state = item.section,
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 8),
                              margin: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 1),
                              decoration: BoxDecoration(
                                color: isActive
                                    ? AppColors.kPrimary
                                        .withValues(alpha: 0.1)
                                    : Colors.transparent,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(children: [
                                Icon(item.icon,
                                    color: isActive
                                        ? AppColors.kPrimary
                                        : Colors.grey.shade500,
                                    size: 17),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    item.label,
                                    style: TextStyle(
                                        fontSize: 12.5,
                                        fontWeight: isActive
                                            ? FontWeight.w600
                                            : FontWeight.w500,
                                        color: isActive
                                            ? AppColors.kPrimary
                                            : Colors.grey.shade700),
                                  ),
                                ),
                                if (isActive)
                                  Container(
                                    width: 5,
                                    height: 5,
                                    decoration: const BoxDecoration(
                                        color: AppColors.kPrimary,
                                        shape: BoxShape.circle),
                                  ),
                              ]),
                            ),
                          ),
                        );
                      }),
                    const SizedBox(height: 2),
                  ],
                );
              },
            ),
          ),

          const Divider(height: 1),

          // Logout
          Padding(
            padding: const EdgeInsets.all(12),
            child: widget.isCollapsed
                ? IconButton(
                    onPressed: handleLogout,
                    icon: Icon(PhosphorIcons.signOut(),
                        color: Colors.grey.shade600),
                    tooltip: 'Logout',
                  )
                : OutlinedButton.icon(
                    onPressed: handleLogout,
                    icon: Icon(PhosphorIcons.signOut(), size: 16),
                    label: const Text('Logout'),
                    style: OutlinedButton.styleFrom(
                        minimumSize: const Size(double.infinity, 40)),
                  ),
          ),
        ],
      ),
    );
  }
}
