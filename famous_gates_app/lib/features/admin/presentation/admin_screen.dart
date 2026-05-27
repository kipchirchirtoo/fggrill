import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/domain/auth_notifier.dart';
import '../domain/admin_providers.dart';
import 'widgets/admin_side_nav.dart';
import 'widgets/admin_top_bar.dart';
import 'sections/overview_section.dart';
import 'sections/branches_section.dart';
import 'sections/rooms_section.dart';
import 'sections/reservations_section.dart';
import 'sections/guests_section.dart';
import 'sections/users_section.dart';
import 'sections/staff_section.dart';
import 'sections/attendance_section.dart';
import 'sections/hr_payroll_section.dart';
import 'sections/restaurant_section.dart';
import 'sections/menu_section.dart';
import 'sections/bar_menu_section.dart';
import 'sections/kitchen_section.dart';
import 'sections/inventory_section.dart';
import 'sections/storekeeping_section.dart';
import 'sections/suppliers_section.dart';
import 'sections/finance_section.dart';
import 'sections/reports_section.dart';
import 'sections/housekeeping_section.dart';
import 'sections/maintenance_section.dart';
import 'sections/vehicles_section.dart';
import 'sections/audit_logs_section.dart';
import 'sections/security_section.dart';
import 'sections/ai_analytics_section.dart';
import 'sections/settings_section.dart';
import 'sections/notifications_section.dart';
import 'sections/misc_admin_sections.dart';
import 'sections/audit_subsections.dart';
import 'sections/central_store_subsections.dart';
import 'sections/procurement_hr_sections.dart';
import 'sections/branch_facilities_sections.dart';
import 'sections/branch_store_kitchen_sections.dart';
import '../../auditor/presentation/auditor_sections.dart';
import '../../hr/domain/providers.dart';
import '../../hr/presentation/hr_dashboard.dart';
import '../../hr_terminal/presentation/hr_terminal_screen.dart';

enum AdminConsoleMode { full, centralStore, auditor }

class AdminScreen extends ConsumerStatefulWidget {
  const AdminScreen({super.key, this.initialSection})
      : mode = AdminConsoleMode.full,
        openCreateEmployee = false;

  const AdminScreen.centralStore({super.key, this.initialSection})
      : mode = AdminConsoleMode.centralStore,
        openCreateEmployee = false;

  const AdminScreen.auditor({
    super.key,
    this.initialSection,
    this.openCreateEmployee = false,
  }) : mode = AdminConsoleMode.auditor;

  final AdminConsoleMode mode;
  final AdminSection? initialSection;
  final bool openCreateEmployee;

  @override
  ConsumerState<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends ConsumerState<AdminScreen> {
  bool _pendingInitialSectionSync = false;

  @override
  void initState() {
    super.initState();
    _pendingInitialSectionSync = widget.mode == AdminConsoleMode.centralStore ||
        widget.mode == AdminConsoleMode.auditor;
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncInitialSection());
  }

  @override
  void didUpdateWidget(covariant AdminScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.mode != widget.mode ||
        oldWidget.initialSection != widget.initialSection) {
      _pendingInitialSectionSync =
          widget.mode == AdminConsoleMode.centralStore ||
              widget.mode == AdminConsoleMode.auditor;
      WidgetsBinding.instance
          .addPostFrameCallback((_) => _syncInitialSection());
    }
  }

  List<AdminSideNavGroup>? get _navGroups => switch (widget.mode) {
        AdminConsoleMode.full => null,
        AdminConsoleMode.centralStore => AdminSideNavGroup.centralStoreGroups,
        AdminConsoleMode.auditor => AdminSideNavGroup.auditorGroups,
      };

  String get _consoleLabel => switch (widget.mode) {
        AdminConsoleMode.full => 'Admin Console',
        AdminConsoleMode.centralStore => 'Central Store Console',
        AdminConsoleMode.auditor => 'Auditor Console',
      };

  AdminSection get _initialSection => switch (widget.mode) {
        AdminConsoleMode.full => widget.initialSection ?? AdminSection.overview,
        AdminConsoleMode.centralStore =>
          widget.initialSection ?? AdminSection.storekeeping,
        AdminConsoleMode.auditor =>
          widget.initialSection ?? AdminSection.auditLogs,
      };

  Set<AdminSection>? get _allowedSections => _navGroups
      ?.expand((group) => group.items)
      .map((item) => item.section)
      .whereType<AdminSection>()
      .toSet();

  void _syncInitialSection() {
    if (!mounted) return;
    final allowedSections = _allowedSections;
    if (allowedSections == null) {
      if (_pendingInitialSectionSync) {
        setState(() => _pendingInitialSectionSync = false);
      }
      return;
    }
    final current = ref.read(adminSectionProvider);
    if (widget.mode == AdminConsoleMode.centralStore ||
        widget.mode == AdminConsoleMode.auditor ||
        !allowedSections.contains(current)) {
      ref.read(adminSectionProvider.notifier).state = _initialSection;
    }
    if (_pendingInitialSectionSync) {
      setState(() => _pendingInitialSectionSync = false);
    }
  }

  AdminSection _effectiveSection(AdminSection section) {
    if (_pendingInitialSectionSync) return _initialSection;
    final allowedSections = _allowedSections;
    if (allowedSections == null || allowedSections.contains(section)) {
      return section;
    }
    return _initialSection;
  }

  @override
  Widget build(BuildContext context) {
    final currentSection = _effectiveSection(ref.watch(adminSectionProvider));
    final unreadCount = ref.watch(unreadNotifCountProvider).valueOrNull ?? 0;
    final isMobile = MediaQuery.of(context).size.width < 768;
    final isTablet = MediaQuery.of(context).size.width >= 768 &&
        MediaQuery.of(context).size.width < 1024;
    final navWidth = isMobile ? 0.0 : (isTablet ? 64.0 : 220.0);
    final navGroups = _navGroups;

    return Scaffold(
      backgroundColor: AppColors.kSurface,
      body: Row(
        children: [
          if (!isMobile)
            AdminSideNav(
              width: navWidth,
              isCollapsed: isTablet,
              groups: navGroups,
              selectedSection: currentSection,
            ),
          Expanded(
            child: Column(
              children: [
                AdminTopBar(
                  unreadCount: unreadCount,
                  consoleLabel: _consoleLabel,
                  onMenuTap:
                      isMobile ? () => _showMobileNav(context, ref) : null,
                ),
                Expanded(
                  child: _buildSection(currentSection, ref),
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: isMobile
          ? _MobileBottomNav(
              currentSection: currentSection,
              groups: navGroups,
            )
          : null,
    );
  }

  Widget _buildSection(AdminSection section, WidgetRef ref) {
    final widgets = <AdminSection, Widget>{
      // ── ADMIN CORE ──────────────────────────────────────────────
      AdminSection.overview: const OverviewSection(),
      AdminSection.security: const SecuritySection(),
      AdminSection.aiAnalytics: const AiAnalyticsSection(),
      AdminSection.menu: const MenuSection(),
      AdminSection.barMenu: const BarMenuSection(),
      AdminSection.kyogongServices: const KyogongServicesSection(),
      AdminSection.wastageAnalytics: const WastageAnalyticsSection(),
      AdminSection.roleMigration: const RoleMigrationSection(),
      AdminSection.idCards: const IdCardsSection(),
      AdminSection.cashierStation: const CashierStationSection(),
      AdminSection.bookingsInvoices: const BookingsInvoicesSection(),
      AdminSection.users: const UsersSection(),
      AdminSection.employeeDocs: const EmployeeDocsSection(),
      AdminSection.communications: const CommunicationsSection(),

      // ── HOTEL OPERATIONS ────────────────────────────────────────
      AdminSection.branches: const BranchesSection(),
      AdminSection.rooms: const RoomsSection(),
      AdminSection.reservations: const ReservationsSection(),
      AdminSection.guests: const GuestsSection(),
      AdminSection.restaurant: const RestaurantSection(),
      AdminSection.kitchen: const KitchenSection(),

      // ── OVERSIGHT & AUDIT ───────────────────────────────────────
      AdminSection.auditLogs: widget.mode == AdminConsoleMode.auditor
          ? const AuditorOverviewSection()
          : const AuditLogsSection(),
      AdminSection.auditSearch: const AuditSearchSection(),
      AdminSection.financialVerification:
          widget.mode == AdminConsoleMode.auditor
              ? const AuditorFinancialVerificationSection()
              : const FinancialVerificationSection(),
      AdminSection.shiftVerification: widget.mode == AdminConsoleMode.auditor
          ? const AuditorShiftVerificationSection()
          : const ShiftVerificationSection(),
      AdminSection.revenueOversight: widget.mode == AdminConsoleMode.auditor
          ? const AuditorRevenueOversightSection()
          : const RevenueOversightSection(),
      AdminSection.auditorSales: const AuditorSalesAuditSection(),
      AdminSection.auditorBanking: const AuditorBankingLogsSection(),
      AdminSection.auditorInvoices: const AuditorInvoicesSection(),
      AdminSection.auditorOrders: const AuditorBranchOrdersSection(),
      AdminSection.soldItemsAnalysis: widget.mode == AdminConsoleMode.auditor
          ? const AuditorSoldItemsSection()
          : const SoldItemsAnalysisSection(),
      AdminSection.staffFinancials: widget.mode == AdminConsoleMode.auditor
          ? const AuditorStaffAuditSection()
          : const StaffFinancialsSection(),
      AdminSection.auditorStock: const AuditorStockAuditSection(),
      AdminSection.auditorKitchenRequisitions:
          const AuditorKitchenRequisitionsSection(),
      AdminSection.auditorKitchenUsage: const AuditorKitchenUsageSection(),
      AdminSection.auditorKitchenWastage: const AuditorKitchenWastageSection(),
      AdminSection.auditorDeliveries: const AuditorDeliveriesSection(),
      AdminSection.auditorLedger: const AuditorKitchenLedgerSection(),
      AdminSection.auditorPayrollApprovals:
          const AuditorPayrollApprovalsSection(),
      AdminSection.auditorDiscrepancies: const AuditorDiscrepanciesSection(),
      AdminSection.auditorVoidBills: const AuditorVoidBillsSection(),
      AdminSection.auditorBusinessMpesa: const AuditorBusinessMpesaSection(),
      AdminSection.auditorCreditBills: const AuditorCreditBillsSection(),
      AdminSection.auditorCashierLogbooks:
          const AuditorCashierLogbooksSection(),
      AdminSection.performanceLeaderboard:
          widget.mode == AdminConsoleMode.auditor
              ? const HRSectionView(initialTab: HrTab.performance)
              : const PerformanceLeaderboardSection(),
      AdminSection.stockRequestApprovals:
          widget.mode == AdminConsoleMode.auditor
              ? const AuditorApprovalsSection()
              : const StockRequestApprovalsSection(),
      AdminSection.barStockAudits: widget.mode == AdminConsoleMode.auditor
          ? const AuditorBarStockSection()
          : const BarStockAuditsSection(),
      AdminSection.purchaseAudits: widget.mode == AdminConsoleMode.auditor
          ? const AuditorPurchasesSection()
          : const PurchaseAuditsSection(),
      AdminSection.auditReports: widget.mode == AdminConsoleMode.auditor
          ? const AuditorReportExportsSection()
          : const AuditReportsSection(),

      // ── INVENTORY & LOGISTICS ───────────────────────────────────
      AdminSection.storekeeping: const StorekeepingSection(),
      AdminSection.goodsReceiving: const GoodsReceivingSection(),
      AdminSection.foodstuffs: const FoodstuffsSection(),
      AdminSection.barBeverages: const BarBeveragesStoreSection(),
      AdminSection.stationeryItems: const StationeryItemsSection(),
      AdminSection.inventory: widget.mode == AdminConsoleMode.centralStore
          ? const CentralMasterInventorySection()
          : const InventorySection(),
      AdminSection.requisitions: const RequisitionsSection(),
      AdminSection.packing: const PackingSection(),
      AdminSection.dispatchNotes: const DispatchNotesSection(),
      AdminSection.purchaseOrders: const PurchaseOrdersSection(),
      AdminSection.goodsReceiptGRN: const GoodsReceiptGRNSection(),
      AdminSection.centralStockTakes: const CentralStockTakesSection(),
      AdminSection.centralSpoilage: const CentralSpoilageSection(),
      AdminSection.suppliers: widget.mode == AdminConsoleMode.centralStore
          ? const CentralSuppliersSection()
          : const SuppliersSection(),
      AdminSection.vehicles: widget.mode == AdminConsoleMode.centralStore
          ? const CentralVehiclesSection()
          : const VehiclesSection(),
      AdminSection.drivers: const DriversSection(),
      AdminSection.centralReports: const CentralReportsSection(),

      // ── CORPORATE FUNCTIONS ─────────────────────────────────────
      AdminSection.procurementOverview: const ProcurementOverviewSection(),
      AdminSection.supplierInvoices:
          widget.mode == AdminConsoleMode.centralStore
              ? const CentralSupplierInvoicesSection()
              : const SupplierInvoicesSection(),
      AdminSection.procurementPayments:
          widget.mode == AdminConsoleMode.centralStore
              ? const CentralSupplierPaymentsSection()
              : const ProcurementPaymentsSection(),

      // ── HUMAN RESOURCES ─────────────────────────────────────────
      AdminSection.hrPayroll: widget.mode == AdminConsoleMode.auditor
          ? const HRSectionView(initialTab: HrTab.overview)
          : const HrPayrollSection(),
      AdminSection.staff: widget.mode == AdminConsoleMode.auditor
          ? HRSectionView(
              initialTab: HrTab.employees,
              openCreateEmployee: widget.openCreateEmployee,
            )
          : const StaffSection(),
      AdminSection.attendance: widget.mode == AdminConsoleMode.auditor
          ? const HRSectionView(initialTab: HrTab.attendance)
          : const AttendanceSection(),
      AdminSection.attendanceLogs: widget.mode == AdminConsoleMode.auditor
          ? const HRSectionView(initialTab: HrTab.attendanceLogs)
          : const AttendanceLogsSection(),
      AdminSection.leaveRequests: widget.mode == AdminConsoleMode.auditor
          ? const HRSectionView(initialTab: HrTab.leave)
          : const LeaveRequestsSection(),
      AdminSection.salaries: widget.mode == AdminConsoleMode.auditor
          ? const HRSectionView(initialTab: HrTab.salaries)
          : const SalariesSection(),
      AdminSection.payrollProcessing: widget.mode == AdminConsoleMode.auditor
          ? const AuditorPayrollApprovalsSection()
          : const PayrollProcessingSection(),
      AdminSection.payrollAdjustments: widget.mode == AdminConsoleMode.auditor
          ? const HRSectionView(initialTab: HrTab.salaryAdjustments)
          : const PayrollAdjustmentsSection(),
      AdminSection.payrollPolicies:
          const HRSectionView(initialTab: HrTab.policies),
      AdminSection.hrReports: const HRSectionView(initialTab: HrTab.reports),
      AdminSection.hrTerminal: const HRTerminalScreen(),

      // ── BRANCH OPERATIONS ───────────────────────────────────────
      AdminSection.branchOpsOverview: const BranchOpsOverviewSection(),
      AdminSection.stockLevels: const StockLevelsSection(),
      AdminSection.stockTakes: const StockTakesSection(),
      AdminSection.branchScheduling: const BranchSchedulingSection(),

      // ── FACILITIES ──────────────────────────────────────────────
      AdminSection.facilitiesOverview: const FacilitiesOverviewSection(),
      AdminSection.housekeepingTasks: const HousekeepingTasksSection(),
      AdminSection.housekeeping: const HousekeepingSection(),
      AdminSection.housekeepingInspections:
          const HousekeepingInspectionsSection(),
      AdminSection.lostFound: const LostFoundSection(),
      AdminSection.workOrders: const WorkOrdersSection(),
      AdminSection.assetManagement: const AssetManagementSection(),
      AdminSection.maintenanceSchedule: const MaintenanceScheduleSection(),
      AdminSection.maintenance: const MaintenanceSection(),
      AdminSection.roomStatus: const RoomStatusSection(),
      AdminSection.qualityCompliance: const QualityComplianceSection(),
      AdminSection.suppliesInventory: const SuppliesInventorySection(),
      AdminSection.facilitiesStaff: const FacilitiesStaffSection(),

      // ── BRANCH STORE OPS ────────────────────────────────────────
      AdminSection.branchStoreOverview: const BranchStoreOverviewSection(),
      AdminSection.receiveGoods: const ReceiveGoodsSection(),
      AdminSection.branchSuppliers: const BranchSuppliersSection(),
      AdminSection.branchStockTakes: const BranchStockTakesSection(),
      AdminSection.branchPurchaseOrders: const BranchPurchaseOrdersSection(),
      AdminSection.storeRequisitions: const StoreRequisitionsSection(),
      AdminSection.kitchenUsage: const KitchenUsageSection(),
      AdminSection.stockOut: const StockOutSection(),

      // ── KITCHEN OPS ─────────────────────────────────────────────
      AdminSection.kitchenOpsOverview: const KitchenOpsOverviewSection(),
      AdminSection.stockLedger: const StockLedgerSection(),
      AdminSection.requestStock: const RequestStockSection(),
      AdminSection.recipesBOM: const RecipesBOMSection(),
      AdminSection.usageTracking: const UsageTrackingSection(),
      AdminSection.recordWastage: const RecordWastageSection(),

      // ── FINANCE ─────────────────────────────────────────────────
      AdminSection.finance: const FinanceSection(),
      AdminSection.reports: const ReportsSection(),

      // ── SYSTEM ──────────────────────────────────────────────────
      AdminSection.settings: const SettingsSection(),
      AdminSection.notifications: const NotificationsSection(),
    };

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 200),
      // Use a custom layoutBuilder so short-content sections align to top-left
      // instead of floating in the vertical centre (AnimatedSwitcher's default).
      layoutBuilder: (currentChild, previousChildren) => Stack(
        alignment: Alignment.topLeft,
        children: <Widget>[
          ...previousChildren,
          if (currentChild != null) currentChild,
        ],
      ),
      child: widgets[section] ?? const OverviewSection(),
    );
  }

  void _showMobileNav(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => _MobileNavSheet(ref: ref, groups: _navGroups),
    );
  }
}

class _MobileNavSheet extends ConsumerWidget {
  final WidgetRef ref;
  final List<AdminSideNavGroup>? groups;
  const _MobileNavSheet({required this.ref, this.groups});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(adminSectionProvider);
    return Container(
      height: MediaQuery.of(context).size.height * 0.7,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: (groups ?? AdminSideNavGroup.groups)
            .expand((group) => group.items)
            .map((item) {
          final isActive = item.section == current;
          return ListTile(
            leading: Icon(item.icon,
                color:
                    isActive ? AppColors.kPrimary : AppColors.kTextSecondary),
            title: Text(item.label,
                style: TextStyle(
                  color:
                      isActive ? AppColors.kPrimary : AppColors.kTextSecondary,
                  fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
                )),
            selected: isActive,
            selectedTileColor: AppColors.kPrimary.withValues(alpha: 0.08),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            onTap: () {
              Navigator.pop(context);
              if (item.action == AdminSideNavAction.logout) {
                ref.read(authNotifierProvider.notifier).logout();
                return;
              }
              final section = item.section;
              if (section != null) {
                ref.read(adminSectionProvider.notifier).state = section;
              }
            },
          );
        }).toList(),
      ),
    );
  }
}

class _MobileBottomNav extends ConsumerWidget {
  final AdminSection currentSection;
  final List<AdminSideNavGroup>? groups;
  const _MobileBottomNav({required this.currentSection, this.groups});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = _bottomItems();
    return BottomNavigationBar(
      currentIndex: items.keys
          .toList()
          .indexOf(currentSection)
          .clamp(0, items.length - 1),
      onTap: (i) => ref.read(adminSectionProvider.notifier).state =
          items.keys.elementAt(i),
      selectedItemColor: AppColors.kPrimary,
      unselectedItemColor: AppColors.kTextSecondary,
      items: items.entries
          .map((e) => BottomNavigationBarItem(
                icon: Icon(e.value),
                label: e.key.name[0].toUpperCase() + e.key.name.substring(1),
              ))
          .toList(),
    );
  }

  Map<AdminSection, IconData> _bottomItems() {
    final customGroups = groups;
    if (customGroups == null) {
      return <AdminSection, IconData>{
        AdminSection.overview: PhosphorIcons.chartBar(),
        AdminSection.branches: PhosphorIcons.buildings(),
        AdminSection.users: PhosphorIcons.users(),
        AdminSection.auditLogs: PhosphorIcons.shield(),
        AdminSection.settings: PhosphorIcons.treeStructure(),
      };
    }

    final items = <AdminSection, IconData>{};
    for (final item in customGroups.expand((group) => group.items)) {
      final section = item.section;
      if (section == null) continue;
      items.putIfAbsent(section, () => item.icon);
      if (items.length == 5) break;
    }
    return items;
  }
}
