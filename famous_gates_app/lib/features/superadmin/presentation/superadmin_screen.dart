import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../core/theme/app_theme.dart';
import '../domain/superadmin_providers.dart';
import 'widgets/superadmin_side_nav.dart'
    show SuperAdminSideNav, SuperAdminNavItem;
import 'widgets/superadmin_top_bar.dart';

// Superadmin-specific sections
import '../../lina/presentation/lina_screen.dart';
import 'sections/security_center_section.dart';
import 'sections/system_health_section.dart';
import 'sections/global_users_section.dart';
import 'sections/branches_section.dart';
import 'sections/audit_logs_section.dart';
import 'sections/settings_section.dart';
import 'sections/admin_menu_sections.dart';
import 'sections/operations_sections.dart';
import 'sections/configuration_sections.dart';
import 'sections/impersonation_section.dart';
import 'sections/feature_flags_section.dart';
import 'sections/toggle_settings_section.dart';
import 'sections/non_consumables_catalog_section.dart';
import 'sections/kitchen_ledger_items_section.dart';
import 'sections/pos_outlet_menu_section.dart';
import 'sections/announcements_section.dart';
import 'sections/emergency_controls_section.dart';
import 'sections/data_override_section.dart';
import 'sections/document_templates_section.dart';
import 'sections/till_numbers_section.dart';
import 'sections/menu_pricing_section.dart';

// Admin sections reused in superadmin
import '../../admin/presentation/sections/misc_admin_sections.dart';
import '../../admin/presentation/sections/staff_section.dart';
import '../../admin/presentation/sections/overview_section.dart';
import '../../admin/presentation/sections/finance_section.dart';
import '../../admin/presentation/sections/inventory_section.dart';
import '../../admin/presentation/sections/reports_section.dart';
import '../../admin/presentation/sections/rooms_section.dart';
import '../../admin/presentation/sections/suppliers_section.dart';
import '../../admin/presentation/sections/vehicles_section.dart';
import '../../admin/presentation/sections/central_store_subsections.dart';

class SuperAdminScreen extends ConsumerStatefulWidget {
  final SuperAdminSection? initialSection;

  const SuperAdminScreen({super.key, this.initialSection});

  @override
  ConsumerState<SuperAdminScreen> createState() => _SuperAdminScreenState();
}

class _SuperAdminScreenState extends ConsumerState<SuperAdminScreen> {
  bool _sidebarCollapsed = false;
  bool _sidebarOverrideActive = false;

  @override
  Widget build(BuildContext context) {
    final initialSection = widget.initialSection;
    if (initialSection != null) {
      final selected = ref.read(superAdminSectionProvider);
      if (selected != initialSection) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!context.mounted) return;
          ref.read(superAdminSectionProvider.notifier).state = initialSection;
        });
      }
    }
    final currentSection = ref.watch(superAdminSectionProvider);
    final isMobile = MediaQuery.of(context).size.width < 768;
    final isTablet = MediaQuery.of(context).size.width >= 768 &&
        MediaQuery.of(context).size.width < 1024;
    final effectiveSidebarCollapsed = _sidebarOverrideActive
        ? _sidebarCollapsed
        : (_sidebarCollapsed || isTablet);
    final navWidth =
        isMobile ? 0.0 : (effectiveSidebarCollapsed ? 64.0 : 240.0);

    return Scaffold(
      backgroundColor: AppColors.kSurface,
      body: Row(
        children: [
          if (!isMobile)
            SuperAdminSideNav(
              width: navWidth,
              isCollapsed: effectiveSidebarCollapsed,
            ),
          Expanded(
            child: Column(
              children: [
                SuperAdminTopBar(
                  onMenuTap:
                      isMobile ? () => _showMobileNav(context, ref) : null,
                  onToggleSidebar: !isMobile
                      ? () => setState(() {
                            _sidebarOverrideActive = true;
                            _sidebarCollapsed = !effectiveSidebarCollapsed;
                          })
                      : null,
                  sidebarCollapsed: effectiveSidebarCollapsed,
                ),
                Expanded(
                  child: _buildSection(currentSection, ref),
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar:
          isMobile ? _MobileBottomNav(currentSection: currentSection) : null,
    );
  }

  Widget _buildSection(SuperAdminSection section, WidgetRef ref) {
    final widgets = <SuperAdminSection, Widget>{
      // Command
      SuperAdminSection.adminDashboard: const OverviewSection(),
      SuperAdminSection.lina: const LinaScreen(),
      SuperAdminSection.securityCenter: const SecurityCenterSection(),
      SuperAdminSection.systemHealth: const SystemHealthSection(),
      SuperAdminSection.globalSearch: const SuperAdminSearchSection(),

      // Access & Organization
      SuperAdminSection.globalUsers: const GlobalUsersSection(),
      SuperAdminSection.personnelRegistry: const StaffSection(),
      SuperAdminSection.rolesPermissions: const RolesPermissionsSection(),
      SuperAdminSection.branches: const BranchesSection(),
      SuperAdminSection.departments: const DepartmentsSection(),

      // Hotel Setup
      SuperAdminSection.rooms: const RoomsSection(),
      SuperAdminSection.rates: const RatePlansSection(),
      SuperAdminSection.paymentBillingSettings:
          const PaymentBillingSettingsSection(),
      SuperAdminSection.reportTemplates: const ReportTemplatesSection(),
      SuperAdminSection.documentTemplates: const DocumentTemplatesSection(),

      // POS & Sales Setup
      SuperAdminSection.posConfiguration: const CashierStationSection(),
      SuperAdminSection.tillNumbers: const TillNumbersSection(),
      SuperAdminSection.restaurantMenu: const RestaurantMenuAdminSection(),
      SuperAdminSection.barMenu: const BarMenuAdminSection(),
      SuperAdminSection.menuPricing: const MenuPricingSection(),
      SuperAdminSection.kyogongServices: const KyogongServicesAdminSection(),
      SuperAdminSection.cashierStationConfig:
          const CashierStationConfigSection(),
      SuperAdminSection.nonConsumablesCatalog:
          const NonConsumablesCatalogSection(),
      SuperAdminSection.posOutletMenu: const PosOutletMenuSection(),

      // Finance & Inventory
      SuperAdminSection.finance: const FinanceSection(),
      SuperAdminSection.inventory: const InventorySection(),
      SuperAdminSection.storekeepingConfig: const StorekeepingConfigSection(),
      SuperAdminSection.kitchenLedgerItems: const KitchenLedgerItemsSection(),
      SuperAdminSection.suppliers: const SuppliersSection(),
      SuperAdminSection.payrollSettings: const PayrollSettingsSection(),

      // Logistics
      SuperAdminSection.fleetOverview: const FleetOverviewSection(),
      SuperAdminSection.vehicles: const VehiclesSection(),
      SuperAdminSection.drivers: const DriversSection(),

      // System
      SuperAdminSection.auditLogs: const SuperAdminAuditLogsSection(),
      SuperAdminSection.reports: const ReportsSection(),
      SuperAdminSection.integrations: const SystemIntegrationsSection(),
      SuperAdminSection.settings: const SuperAdminSettingsSection(),

      // God Controls
      SuperAdminSection.impersonation: const ImpersonationSection(),
      SuperAdminSection.featureFlags: const FeatureFlagsSection(),
      SuperAdminSection.toggleSettings: const ToggleSettingsSection(),
      SuperAdminSection.announcements: const AnnouncementsSection(),
      SuperAdminSection.emergencyControls: const EmergencyControlsSection(),
      SuperAdminSection.dataOverrides: const DataOverrideSection(),
      SuperAdminSection.godAuditLog: const SuperAdminAuditLogsSection(),
    };

    // KeyedSubtree gives the AnimatedSwitcher a stable, section-specific key
    // for each child.  Without it, all section widgets of the same runtimeType
    // (e.g. LinaScreen) share the same implicit key, so when the user navigates
    // A → B → A within the 200 ms crossfade, the fading-out instance of A and
    // the newly-shown instance of A have the same key.  Flutter then tries to
    // reparent the widget via its GlobalKey; the stale _Theater (Overlay) has
    // the old OverlayEntry widgets forcibly removed but never re-rendered,
    // causing "Duplicate GlobalKeys detected" and "_dependents.isEmpty" crashes.
    // With ValueKey(section), AnimatedSwitcher recognises the re-entry and
    // reverses the outgoing animation rather than adding a duplicate child.
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 200),
      layoutBuilder: (currentChild, previousChildren) => Stack(
        alignment: Alignment.topLeft,
        children: <Widget>[
          ...previousChildren,
          if (currentChild != null) currentChild,
        ],
      ),
      child: KeyedSubtree(
        key: ValueKey(section),
        child: widgets[section] ?? const LinaScreen(),
      ),
    );
  }

  void _showMobileNav(BuildContext context, WidgetRef ref) {
    if (!context.mounted) return;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => const _MobileNavSheet(),
    );
  }
}

class _MobileNavSheet extends ConsumerWidget {
  const _MobileNavSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(superAdminSectionProvider);
    final groups = SuperAdminNavItem.groupedItems;
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          for (final group in groups) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
              child: Text(
                group.label.toUpperCase(),
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey.shade400,
                  letterSpacing: 1.2,
                ),
              ),
            ),
            ...group.items.map((item) {
              final isActive = item.section == current;
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
                    fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
                  ),
                ),
                selected: isActive,
                selectedTileColor: AppColors.kPrimary.withValues(alpha: 0.08),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8)),
                onTap: () {
                  ref.read(superAdminSectionProvider.notifier).state =
                      item.section;
                  Navigator.pop(context);
                },
              );
            }),
          ],
        ],
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
      SuperAdminSection.adminDashboard: PhosphorIcons.house(),
      SuperAdminSection.lina: PhosphorIcons.sparkle(),
      SuperAdminSection.securityCenter: PhosphorIcons.shield(),
      SuperAdminSection.globalUsers: PhosphorIcons.users(),
      SuperAdminSection.settings: PhosphorIcons.gear(),
    };
    final keys = items.keys.toList();
    final idx = keys.indexOf(currentSection).clamp(0, items.length - 1);
    return BottomNavigationBar(
      currentIndex: idx,
      onTap: (i) =>
          ref.read(superAdminSectionProvider.notifier).state = keys[i],
      selectedItemColor: AppColors.kPrimary,
      unselectedItemColor: AppColors.kTextSecondary,
      type: BottomNavigationBarType.fixed,
      items: items.entries
          .map((e) => BottomNavigationBarItem(
                icon: Icon(e.value),
                label: _getLabel(e.key),
              ))
          .toList(),
    );
  }

  String _getLabel(SuperAdminSection section) {
    switch (section) {
      case SuperAdminSection.adminDashboard:
        return 'Home';
      case SuperAdminSection.lina:
        return 'Lina';
      case SuperAdminSection.securityCenter:
        return 'Security';
      case SuperAdminSection.globalUsers:
        return 'Users';
      case SuperAdminSection.settings:
        return 'Settings';
      default:
        return '';
    }
  }
}
