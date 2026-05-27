import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../features/auth/domain/auth_notifier.dart';
import '../../domain/admin_providers.dart';

// ─── Main nav widget ──────────────────────────────────────────────────────

class AdminSideNav extends ConsumerWidget {
  final double width;
  final bool isCollapsed;
  final List<AdminSideNavGroup>? groups;
  final AdminSection? selectedSection;
  const AdminSideNav(
      {super.key,
      required this.width,
      required this.isCollapsed,
      this.groups,
      this.selectedSection});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AdminSection currentSection =
        selectedSection ?? ref.watch(adminSectionProvider);
    return Container(
      width: width,
      decoration: BoxDecoration(
        color: Colors.white,
        border: const Border(right: BorderSide(color: AppColors.kDivider)),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 4,
              offset: const Offset(2, 0))
        ],
      ),
      child: Column(children: [
        _LogoHeader(isCollapsed: isCollapsed),
        const Divider(height: 1),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.only(bottom: 16),
            children: _buildNavItems(context, ref, currentSection),
          ),
        ),
      ]),
    );
  }

  List<Widget> _buildNavItems(
      BuildContext context, WidgetRef ref, AdminSection current) {
    final items = <Widget>[];
    for (final group in groups ?? AdminSideNavGroup.groups) {
      if (group.title.isNotEmpty) {
        items.add(_GroupHeader(title: group.title, isCollapsed: isCollapsed));
      } else if (items.isNotEmpty) {
        items.add(const SizedBox(height: 4));
      }
      for (final item in group.items) {
        items.add(_NavItem(
          item: item,
          isActive: item.section == current,
          isCollapsed: isCollapsed,
          onTap: () => _handleItemTap(context, ref, item),
        ));
      }
    }
    return items;
  }

  void _handleItemTap(
      BuildContext context, WidgetRef ref, AdminSideNavItem item) {
    switch (item.action) {
      case AdminSideNavAction.logout:
        ref.read(authNotifierProvider.notifier).logout();
        return;
      case null:
        final section = item.section;
        if (section != null) {
          ref.read(adminSectionProvider.notifier).state = section;
          final routePath = item.routePath;
          if (routePath != null) {
            context.go(routePath);
          }
        }
        return;
    }
  }
}

// ─── Data models ──────────────────────────────────────────────────────────

enum AdminSideNavAction { logout }

class AdminSideNavItem {
  final AdminSection? section;
  final AdminSideNavAction? action;
  final IconData icon;
  final String label;
  final String? routePath;
  AdminSideNavItem(
      {required this.section,
      required this.icon,
      required this.label,
      this.routePath,
      this.action});
  AdminSideNavItem.action(
      {required this.action, required this.icon, required this.label})
      : section = null,
        routePath = null;
  static List<AdminSideNavItem> get allItems =>
      AdminSideNavGroup.groups.expand((g) => g.items).toList();
}

class AdminSideNavGroup {
  final String title;
  final List<AdminSideNavItem> items;
  AdminSideNavGroup({required this.title, required this.items});

  static List<AdminSideNavGroup> get centralStoreGroups => [
        AdminSideNavGroup(title: 'INVENTORY & LOGISTICS', items: [
          AdminSideNavItem(
              section: AdminSection.storekeeping,
              icon: PhosphorIcons.warehouse(),
              label: 'Central Store',
              routePath: '/central-store'),
          AdminSideNavItem(
              section: AdminSection.goodsReceiving,
              icon: PhosphorIcons.packageArrowUp(),
              label: 'Goods Receiving',
              routePath: '/central-store/receiving'),
          AdminSideNavItem(
              section: AdminSection.foodstuffs,
              icon: PhosphorIcons.cookingPot(),
              label: 'Foodstuffs',
              routePath: '/central-store/foodstuffs'),
          AdminSideNavItem(
              section: AdminSection.barBeverages,
              icon: PhosphorIcons.wine(),
              label: 'Bar & Beverages',
              routePath: '/central-store/bar-items'),
          AdminSideNavItem(
              section: AdminSection.stationeryItems,
              icon: PhosphorIcons.pencil(),
              label: 'Stationery Items',
              routePath: '/central-store/stationery'),
          AdminSideNavItem(
              section: AdminSection.inventory,
              icon: PhosphorIcons.package(),
              label: 'Master Inventory',
              routePath: '/central-store/inventory'),
          AdminSideNavItem(
              section: AdminSection.requisitions,
              icon: PhosphorIcons.clipboardText(),
              label: 'Requisitions',
              routePath: '/central-store/requests'),
          AdminSideNavItem(
              section: AdminSection.packing,
              icon: PhosphorIcons.package(),
              label: 'Packing',
              routePath: '/central-store/packing'),
          AdminSideNavItem(
              section: AdminSection.dispatchNotes,
              icon: PhosphorIcons.truck(),
              label: 'Dispatch & Notes',
              routePath: '/central-store/dispatch'),
          AdminSideNavItem(
              section: AdminSection.purchaseOrders,
              icon: PhosphorIcons.fileText(),
              label: 'Purchase Orders',
              routePath: '/central-store/suppliers/purchase-orders'),
          AdminSideNavItem(
              section: AdminSection.goodsReceiptGRN,
              icon: PhosphorIcons.clipboardText(),
              label: 'Goods Receipt (GRN)',
              routePath: '/central-store/procurement/grn'),
          AdminSideNavItem(
              section: AdminSection.centralStockTakes,
              icon: PhosphorIcons.clipboardText(),
              label: 'Stock Takes',
              routePath: '/central-store/stock-takes'),
          AdminSideNavItem(
              section: AdminSection.centralSpoilage,
              icon: PhosphorIcons.trash(),
              label: 'Spoilage Log',
              routePath: '/central-store/spoilage'),
          AdminSideNavItem(
              section: AdminSection.suppliers,
              icon: PhosphorIcons.users(),
              label: 'Supplier Database',
              routePath: '/central-store/suppliers'),
          AdminSideNavItem(
              section: AdminSection.supplierInvoices,
              icon: PhosphorIcons.receipt(),
              label: 'Supplier Invoices',
              routePath: '/central-store/suppliers/invoices'),
          AdminSideNavItem(
              section: AdminSection.procurementPayments,
              icon: PhosphorIcons.creditCard(),
              label: 'Supplier Payments',
              routePath: '/central-store/suppliers/payments'),
          AdminSideNavItem(
              section: AdminSection.vehicles,
              icon: PhosphorIcons.truck(),
              label: 'Vehicles',
              routePath: '/central-store/vehicles'),
          AdminSideNavItem(
              section: AdminSection.drivers,
              icon: PhosphorIcons.user(),
              label: 'Drivers',
              routePath: '/central-store/drivers'),
          AdminSideNavItem(
              section: AdminSection.centralReports,
              icon: PhosphorIcons.chartBar(),
              label: 'Central Reports',
              routePath: '/central-store/reports'),
          AdminSideNavItem(
              section: AdminSection.communications,
              icon: PhosphorIcons.chatCircle(),
              label: 'Communications',
              routePath: '/central-store/communications'),
        ]),
        AdminSideNavGroup(title: 'SYSTEM', items: [
          AdminSideNavItem(
              section: AdminSection.notifications,
              icon: PhosphorIcons.bell(),
              label: 'Notifications'),
          AdminSideNavItem.action(
              action: AdminSideNavAction.logout,
              icon: PhosphorIcons.signOut(),
              label: 'Logout'),
        ]),
      ];

  static List<AdminSideNavGroup> get auditorGroups => [
        AdminSideNavGroup(title: 'AUDIT COMMAND', items: [
          AdminSideNavItem(
              section: AdminSection.auditLogs,
              icon: PhosphorIcons.shield(),
              label: 'Auditor Overview'),
          AdminSideNavItem(
              section: AdminSection.auditSearch,
              icon: PhosphorIcons.magnifyingGlass(),
              label: 'Search'),
          AdminSideNavItem(
              section: AdminSection.financialVerification,
              icon: PhosphorIcons.currencyDollar(),
              label: 'Financial Verification'),
          AdminSideNavItem(
              section: AdminSection.shiftVerification,
              icon: PhosphorIcons.clockClockwise(),
              label: 'Shift Verification'),
          AdminSideNavItem(
              section: AdminSection.revenueOversight,
              icon: PhosphorIcons.trendUp(),
              label: 'Revenue Oversight'),
          AdminSideNavItem(
              section: AdminSection.auditorSales,
              icon: PhosphorIcons.receipt(),
              label: 'Sales Audit'),
          AdminSideNavItem(
              section: AdminSection.auditorBanking,
              icon: PhosphorIcons.bank(),
              label: 'Banking Logs'),
          AdminSideNavItem(
              section: AdminSection.auditorInvoices,
              icon: PhosphorIcons.receipt(),
              label: 'Invoices'),
          AdminSideNavItem(
              section: AdminSection.auditorDiscrepancies,
              icon: PhosphorIcons.warning(),
              label: 'Discrepancies'),
        ]),
        AdminSideNavGroup(title: 'STOCK & OPERATIONS', items: [
          AdminSideNavItem(
              section: AdminSection.auditorOrders,
              icon: PhosphorIcons.clipboardText(),
              label: 'Branch Orders'),
          AdminSideNavItem(
              section: AdminSection.soldItemsAnalysis,
              icon: PhosphorIcons.shoppingCart(),
              label: 'Sold Items'),
          AdminSideNavItem(
              section: AdminSection.auditorStock,
              icon: PhosphorIcons.package(),
              label: 'Stock Audit'),
          AdminSideNavItem(
              section: AdminSection.barStockAudits,
              icon: PhosphorIcons.wine(),
              label: 'Bar Stock'),
          AdminSideNavItem(
              section: AdminSection.purchaseAudits,
              icon: PhosphorIcons.shoppingBag(),
              label: 'Purchases'),
          AdminSideNavItem(
              section: AdminSection.auditorDeliveries,
              icon: PhosphorIcons.truck(),
              label: 'Deliveries'),
          AdminSideNavItem(
              section: AdminSection.auditorLedger,
              icon: PhosphorIcons.bookOpen(),
              label: 'Kitchen Ledger'),
        ]),
        AdminSideNavGroup(title: 'BRANCH RECONCILIATION', items: [
          AdminSideNavItem(
              section: AdminSection.auditorBusinessMpesa,
              icon: PhosphorIcons.phone(),
              label: 'Business & M-Pesa'),
          AdminSideNavItem(
              section: AdminSection.auditorCreditBills,
              icon: PhosphorIcons.creditCard(),
              label: 'Credit Bills'),
          AdminSideNavItem(
              section: AdminSection.auditorVoidBills,
              icon: PhosphorIcons.prohibit(),
              label: 'Void Bills'),
          AdminSideNavItem(
              section: AdminSection.auditorCashierLogbooks,
              icon: PhosphorIcons.notebook(),
              label: 'Cashier Logbooks'),
        ]),
        AdminSideNavGroup(title: 'PEOPLE & APPROVALS', items: [
          AdminSideNavItem(
              section: AdminSection.staffFinancials,
              icon: PhosphorIcons.wallet(),
              label: 'Staff Audit'),
          AdminSideNavItem(
              section: AdminSection.auditorPayrollApprovals,
              icon: PhosphorIcons.money(),
              label: 'Payroll Approvals'),
          AdminSideNavItem(
              section: AdminSection.stockRequestApprovals,
              icon: PhosphorIcons.checkCircle(),
              label: 'Approvals'),
          AdminSideNavItem(
              section: AdminSection.auditorKitchenRequisitions,
              icon: PhosphorIcons.chefHat(),
              label: 'Kitchen Requisitions'),
          AdminSideNavItem(
              section: AdminSection.auditorKitchenUsage,
              icon: PhosphorIcons.chartBar(),
              label: 'Kitchen Usage'),
          AdminSideNavItem(
              section: AdminSection.auditorKitchenWastage,
              icon: PhosphorIcons.trash(),
              label: 'Kitchen Wastage'),
        ]),
        AdminSideNavGroup(title: 'HR DASHBOARD', items: [
          AdminSideNavItem(
              section: AdminSection.hrPayroll,
              icon: PhosphorIcons.house(),
              label: 'HR Overview',
              routePath: '/auditor/hr'),
          AdminSideNavItem(
              section: AdminSection.staff,
              icon: PhosphorIcons.users(),
              label: 'Employees',
              routePath: '/auditor/hr/employees'),
          AdminSideNavItem(
              section: AdminSection.attendance,
              icon: PhosphorIcons.checkCircle(),
              label: 'Attendance',
              routePath: '/auditor/hr/attendance'),
          AdminSideNavItem(
              section: AdminSection.attendanceLogs,
              icon: PhosphorIcons.clockClockwise(),
              label: 'Attendance Logs',
              routePath: '/auditor/hr/staff-attendance'),
          AdminSideNavItem(
              section: AdminSection.leaveRequests,
              icon: PhosphorIcons.calendar(),
              label: 'Leave',
              routePath: '/auditor/hr/leave'),
          AdminSideNavItem(
              section: AdminSection.salaries,
              icon: PhosphorIcons.creditCard(),
              label: 'Salaries',
              routePath: '/auditor/hr/salaries'),
          AdminSideNavItem(
              section: AdminSection.payrollAdjustments,
              icon: PhosphorIcons.arrowsLeftRight(),
              label: 'Adjustments',
              routePath: '/auditor/hr/adjustments'),
          AdminSideNavItem(
              section: AdminSection.payrollPolicies,
              icon: PhosphorIcons.shieldCheck(),
              label: 'Policies',
              routePath: '/auditor/hr/policies'),
          AdminSideNavItem(
              section: AdminSection.performanceLeaderboard,
              icon: PhosphorIcons.trophy(),
              label: 'Performance',
              routePath: '/auditor/hr/performance'),
          AdminSideNavItem(
              section: AdminSection.hrTerminal,
              icon: PhosphorIcons.fingerprint(),
              label: 'HR Terminal',
              routePath: '/auditor/hr/terminal'),
        ]),
        AdminSideNavGroup(title: 'SYSTEM', items: [
          AdminSideNavItem(
              section: AdminSection.auditReports,
              icon: PhosphorIcons.fileSpreadsheet(),
              label: 'Audit Reports'),
          AdminSideNavItem(
              section: AdminSection.notifications,
              icon: PhosphorIcons.bell(),
              label: 'Notifications'),
          AdminSideNavItem.action(
              action: AdminSideNavAction.logout,
              icon: PhosphorIcons.signOut(),
              label: 'Logout'),
        ]),
      ];

  static List<AdminSideNavGroup> get groups => [
        // ── ADMIN (no header — mirrors web adminNav) ───────────────────
        AdminSideNavGroup(title: '', items: [
          AdminSideNavItem(
              section: AdminSection.overview,
              icon: PhosphorIcons.layoutDashboard(),
              label: 'Admin Dashboard'),
          AdminSideNavItem(
              section: AdminSection.security,
              icon: PhosphorIcons.shieldCheck(),
              label: 'Security Center'),
          AdminSideNavItem(
              section: AdminSection.aiAnalytics,
              icon: PhosphorIcons.brain(),
              label: 'AI Insights'),
          AdminSideNavItem(
              section: AdminSection.menu,
              icon: PhosphorIcons.fork(),
              label: 'Restaurant Menu'),
          AdminSideNavItem(
              section: AdminSection.barMenu,
              icon: PhosphorIcons.wine(),
              label: 'Bar Menu'),
          AdminSideNavItem(
              section: AdminSection.kyogongServices,
              icon: PhosphorIcons.slidersHorizontal(),
              label: 'Kyogong Services'),
          AdminSideNavItem(
              section: AdminSection.wastageAnalytics,
              icon: PhosphorIcons.trash(),
              label: 'Wastage Analytics'),
          AdminSideNavItem(
              section: AdminSection.roleMigration,
              icon: PhosphorIcons.arrowsCounterClockwise(),
              label: 'Role Migration'),
          AdminSideNavItem(
              section: AdminSection.idCards,
              icon: PhosphorIcons.identificationCard(),
              label: 'ID Cards'),
          AdminSideNavItem(
              section: AdminSection.cashierStation,
              icon: PhosphorIcons.creditCard(),
              label: 'Cashier Station'),
          AdminSideNavItem(
              section: AdminSection.bookingsInvoices,
              icon: PhosphorIcons.calendar(),
              label: 'Bookings & Invoices'),
          AdminSideNavItem(
              section: AdminSection.users,
              icon: PhosphorIcons.users(),
              label: 'Personnel Registry'),
          AdminSideNavItem(
              section: AdminSection.employeeDocs,
              icon: PhosphorIcons.bookOpen(),
              label: 'Employee Docs'),
          AdminSideNavItem(
              section: AdminSection.communications,
              icon: PhosphorIcons.chatCircle(),
              label: 'Communications'),
        ]),

        // ── OVERSIGHT & AUDIT ─────────────────────────────────────────
        AdminSideNavGroup(title: 'OVERSIGHT & AUDIT', items: [
          AdminSideNavItem(
              section: AdminSection.auditLogs,
              icon: PhosphorIcons.shield(),
              label: 'Auditor Overview'),
          AdminSideNavItem(
              section: AdminSection.auditSearch,
              icon: PhosphorIcons.magnifyingGlass(),
              label: 'SEARCH'),
          AdminSideNavItem(
              section: AdminSection.financialVerification,
              icon: PhosphorIcons.currencyDollar(),
              label: 'Financial Verification'),
          AdminSideNavItem(
              section: AdminSection.shiftVerification,
              icon: PhosphorIcons.clockClockwise(),
              label: 'Shift Verification'),
          AdminSideNavItem(
              section: AdminSection.revenueOversight,
              icon: PhosphorIcons.trendUp(),
              label: 'Revenue Oversight'),
          AdminSideNavItem(
              section: AdminSection.soldItemsAnalysis,
              icon: PhosphorIcons.shoppingCart(),
              label: 'Sold Items Analysis'),
          AdminSideNavItem(
              section: AdminSection.staffFinancials,
              icon: PhosphorIcons.wallet(),
              label: 'Staff Financials'),
          AdminSideNavItem(
              section: AdminSection.performanceLeaderboard,
              icon: PhosphorIcons.trophy(),
              label: 'Performance Leaderboard'),
          AdminSideNavItem(
              section: AdminSection.stockRequestApprovals,
              icon: PhosphorIcons.checkCircle(),
              label: 'Stock Request Approvals'),
          AdminSideNavItem(
              section: AdminSection.stockLevels,
              icon: PhosphorIcons.package(),
              label: 'Stock Levels'),
          AdminSideNavItem(
              section: AdminSection.barStockAudits,
              icon: PhosphorIcons.wine(),
              label: 'Bar Stock Audits'),
          AdminSideNavItem(
              section: AdminSection.purchaseAudits,
              icon: PhosphorIcons.shoppingBag(),
              label: 'Purchase Audits'),
          AdminSideNavItem(
              section: AdminSection.auditReports,
              icon: PhosphorIcons.fileSpreadsheet(),
              label: 'Audit Reports'),
        ]),

        // ── INVENTORY & LOGISTICS ─────────────────────────────────────
        AdminSideNavGroup(title: 'INVENTORY & LOGISTICS', items: [
          AdminSideNavItem(
              section: AdminSection.storekeeping,
              icon: PhosphorIcons.warehouse(),
              label: 'Central Store'),
          AdminSideNavItem(
              section: AdminSection.goodsReceiving,
              icon: PhosphorIcons.packageArrowUp(),
              label: 'Goods Receiving'),
          AdminSideNavItem(
              section: AdminSection.foodstuffs,
              icon: PhosphorIcons.cookingPot(),
              label: 'Foodstuffs'),
          AdminSideNavItem(
              section: AdminSection.barBeverages,
              icon: PhosphorIcons.wine(),
              label: 'Bar & Beverages'),
          AdminSideNavItem(
              section: AdminSection.stationeryItems,
              icon: PhosphorIcons.pencil(),
              label: 'Stationery Items'),
          AdminSideNavItem(
              section: AdminSection.inventory,
              icon: PhosphorIcons.package(),
              label: 'Master Inventory'),
          AdminSideNavItem(
              section: AdminSection.requisitions,
              icon: PhosphorIcons.clipboardText(),
              label: 'Requisitions'),
          AdminSideNavItem(
              section: AdminSection.packing,
              icon: PhosphorIcons.package(),
              label: 'Packing'),
          AdminSideNavItem(
              section: AdminSection.dispatchNotes,
              icon: PhosphorIcons.truck(),
              label: 'Dispatch & Notes'),
          AdminSideNavItem(
              section: AdminSection.purchaseOrders,
              icon: PhosphorIcons.fileText(),
              label: 'Purchase Orders'),
          AdminSideNavItem(
              section: AdminSection.goodsReceiptGRN,
              icon: PhosphorIcons.clipboardText(),
              label: 'Goods Receipt (GRN)'),
          AdminSideNavItem(
              section: AdminSection.suppliers,
              icon: PhosphorIcons.users(),
              label: 'Supplier Database'),
          AdminSideNavItem(
              section: AdminSection.vehicles,
              icon: PhosphorIcons.truck(),
              label: 'Vehicles'),
          AdminSideNavItem(
              section: AdminSection.drivers,
              icon: PhosphorIcons.user(),
              label: 'Drivers'),
          AdminSideNavItem(
              section: AdminSection.centralReports,
              icon: PhosphorIcons.chartBar(),
              label: 'Central Reports'),
        ]),

        // ── CORPORATE FUNCTIONS ───────────────────────────────────────
        AdminSideNavGroup(title: 'CORPORATE FUNCTIONS', items: [
          AdminSideNavItem(
              section: AdminSection.procurementOverview,
              icon: PhosphorIcons.shoppingCart(),
              label: 'Procurement Overview'),
          AdminSideNavItem(
              section: AdminSection.purchaseOrders,
              icon: PhosphorIcons.fileText(),
              label: 'Purchase Orders'),
          AdminSideNavItem(
              section: AdminSection.goodsReceiptGRN,
              icon: PhosphorIcons.clipboardText(),
              label: 'Goods Receipt (GRN)'),
          AdminSideNavItem(
              section: AdminSection.suppliers,
              icon: PhosphorIcons.users(),
              label: 'Supplier Database'),
          AdminSideNavItem(
              section: AdminSection.storekeeping,
              icon: PhosphorIcons.warehouse(),
              label: 'Central Store'),
          AdminSideNavItem(
              section: AdminSection.supplierInvoices,
              icon: PhosphorIcons.receipt(),
              label: 'Supplier Invoices'),
          AdminSideNavItem(
              section: AdminSection.procurementPayments,
              icon: PhosphorIcons.creditCard(),
              label: 'Payments'),
          AdminSideNavItem(
              section: AdminSection.dispatchNotes,
              icon: PhosphorIcons.truck(),
              label: 'Dispatch & Notes'),
          AdminSideNavItem(
              section: AdminSection.inventory,
              icon: PhosphorIcons.package(),
              label: 'Master Inventory'),
          AdminSideNavItem(
              section: AdminSection.vehicles,
              icon: PhosphorIcons.truck(),
              label: 'Fleet Management'),
          AdminSideNavItem(
              section: AdminSection.communications,
              icon: PhosphorIcons.chatCircle(),
              label: 'Communications'),
        ]),

        // ── HUMAN RESOURCES ───────────────────────────────────────────
        AdminSideNavGroup(title: 'HUMAN RESOURCES', items: [
          AdminSideNavItem(
              section: AdminSection.hrPayroll,
              icon: PhosphorIcons.house(),
              label: 'HR Overview'),
          AdminSideNavItem(
              section: AdminSection.staff,
              icon: PhosphorIcons.users(),
              label: 'All Employees'),
          AdminSideNavItem(
              section: AdminSection.attendance,
              icon: PhosphorIcons.checkCircle(),
              label: 'Staff Attendance'),
          AdminSideNavItem(
              section: AdminSection.attendanceLogs,
              icon: PhosphorIcons.clockClockwise(),
              label: 'Attendance Logs'),
          AdminSideNavItem(
              section: AdminSection.leaveRequests,
              icon: PhosphorIcons.calendar(),
              label: 'Leave Requests'),
          AdminSideNavItem(
              section: AdminSection.performanceLeaderboard,
              icon: PhosphorIcons.trophy(),
              label: 'Performance Leaderboard'),
          AdminSideNavItem(
              section: AdminSection.salaries,
              icon: PhosphorIcons.creditCard(),
              label: 'Salaries'),
          AdminSideNavItem(
              section: AdminSection.payrollProcessing,
              icon: PhosphorIcons.coins(),
              label: 'Payroll Processing'),
          AdminSideNavItem(
              section: AdminSection.payrollAdjustments,
              icon: PhosphorIcons.arrowsLeftRight(),
              label: 'Adjustments'),
          AdminSideNavItem(
              section: AdminSection.communications,
              icon: PhosphorIcons.chatCircle(),
              label: 'Communications'),
        ]),

        // ── BRANCH OPERATIONS ─────────────────────────────────────────
        AdminSideNavGroup(title: 'BRANCH OPERATIONS', items: [
          AdminSideNavItem(
              section: AdminSection.branchOpsOverview,
              icon: PhosphorIcons.buildings(),
              label: 'Overview'),
          AdminSideNavItem(
              section: AdminSection.stockLevels,
              icon: PhosphorIcons.package(),
              label: 'Stock Levels'),
          AdminSideNavItem(
              section: AdminSection.stockTakes,
              icon: PhosphorIcons.clipboardText(),
              label: 'Stock Takes'),
          AdminSideNavItem(
              section: AdminSection.staff,
              icon: PhosphorIcons.users(),
              label: 'All Staff'),
          AdminSideNavItem(
              section: AdminSection.branchScheduling,
              icon: PhosphorIcons.calendarBlank(),
              label: 'Scheduling'),
          AdminSideNavItem(
              section: AdminSection.attendance,
              icon: PhosphorIcons.checkCircle(),
              label: 'Attendance'),
          AdminSideNavItem(
              section: AdminSection.reservations,
              icon: PhosphorIcons.calendar(),
              label: 'Reservations'),
          AdminSideNavItem(
              section: AdminSection.rooms,
              icon: PhosphorIcons.bed(),
              label: 'Rooms'),
          AdminSideNavItem(
              section: AdminSection.finance,
              icon: PhosphorIcons.currencyDollar(),
              label: 'Budget'),
          AdminSideNavItem(
              section: AdminSection.finance,
              icon: PhosphorIcons.receipt(),
              label: 'Expenses'),
          AdminSideNavItem(
              section: AdminSection.reports,
              icon: PhosphorIcons.chartBar(),
              label: 'Reports'),
          AdminSideNavItem(
              section: AdminSection.communications,
              icon: PhosphorIcons.chatCircle(),
              label: 'Communications'),
        ]),

        // ── FACILITIES ────────────────────────────────────────────────
        AdminSideNavGroup(title: 'FACILITIES', items: [
          AdminSideNavItem(
              section: AdminSection.facilitiesOverview,
              icon: PhosphorIcons.buildings(),
              label: 'Overview'),
          AdminSideNavItem(
              section: AdminSection.housekeepingTasks,
              icon: PhosphorIcons.clipboardText(),
              label: 'Tasks'),
          AdminSideNavItem(
              section: AdminSection.housekeepingInspections,
              icon: PhosphorIcons.magnifyingGlass(),
              label: 'Inspections'),
          AdminSideNavItem(
              section: AdminSection.lostFound,
              icon: PhosphorIcons.question(),
              label: 'Lost & Found'),
          AdminSideNavItem(
              section: AdminSection.workOrders,
              icon: PhosphorIcons.wrench(),
              label: 'Work Orders'),
          AdminSideNavItem(
              section: AdminSection.assetManagement,
              icon: PhosphorIcons.warehouse(),
              label: 'Asset Management'),
          AdminSideNavItem(
              section: AdminSection.maintenanceSchedule,
              icon: PhosphorIcons.calendarBlank(),
              label: 'Schedule'),
          AdminSideNavItem(
              section: AdminSection.roomStatus,
              icon: PhosphorIcons.bed(),
              label: 'Room Status'),
          AdminSideNavItem(
              section: AdminSection.suppliesInventory,
              icon: PhosphorIcons.package(),
              label: 'Supplies & Inventory'),
          AdminSideNavItem(
              section: AdminSection.facilitiesStaff,
              icon: PhosphorIcons.users(),
              label: 'Staff Management'),
          AdminSideNavItem(
              section: AdminSection.qualityCompliance,
              icon: PhosphorIcons.shieldCheck(),
              label: 'Quality & Compliance'),
          AdminSideNavItem(
              section: AdminSection.communications,
              icon: PhosphorIcons.chatCircle(),
              label: 'Communications'),
        ]),

        // ── BRANCH STORE OPS ──────────────────────────────────────────
        AdminSideNavGroup(title: 'BRANCH STORE OPS', items: [
          AdminSideNavItem(
              section: AdminSection.branchStoreOverview,
              icon: PhosphorIcons.package(),
              label: 'Overview'),
          AdminSideNavItem(
              section: AdminSection.inventory,
              icon: PhosphorIcons.package(),
              label: 'Master Inventory'),
          AdminSideNavItem(
              section: AdminSection.receiveGoods,
              icon: PhosphorIcons.packageArrowUp(),
              label: 'Receive Goods'),
          AdminSideNavItem(
              section: AdminSection.branchSuppliers,
              icon: PhosphorIcons.users(),
              label: 'Branch Suppliers'),
          AdminSideNavItem(
              section: AdminSection.branchStockTakes,
              icon: PhosphorIcons.clipboardText(),
              label: 'Stock Takes'),
          AdminSideNavItem(
              section: AdminSection.branchPurchaseOrders,
              icon: PhosphorIcons.fileText(),
              label: 'Purchase Orders'),
          AdminSideNavItem(
              section: AdminSection.storeRequisitions,
              icon: PhosphorIcons.shoppingCart(),
              label: 'Store Requisitions'),
          AdminSideNavItem(
              section: AdminSection.kitchenUsage,
              icon: PhosphorIcons.cookingPot(),
              label: 'Kitchen Usage'),
          AdminSideNavItem(
              section: AdminSection.stockOut,
              icon: PhosphorIcons.arrowUpRight(),
              label: 'Stock Out'),
          AdminSideNavItem(
              section: AdminSection.communications,
              icon: PhosphorIcons.chatCircle(),
              label: 'Communications'),
        ]),

        // ── KITCHEN OPS ───────────────────────────────────────────────
        AdminSideNavGroup(title: 'KITCHEN OPS', items: [
          AdminSideNavItem(
              section: AdminSection.kitchenOpsOverview,
              icon: PhosphorIcons.chefHat(),
              label: 'Overview'),
          AdminSideNavItem(
              section: AdminSection.stockLedger,
              icon: PhosphorIcons.bookOpen(),
              label: 'Stock Ledger'),
          AdminSideNavItem(
              section: AdminSection.requestStock,
              icon: PhosphorIcons.shoppingCart(),
              label: 'Request Stock'),
          AdminSideNavItem(
              section: AdminSection.recipesBOM,
              icon: PhosphorIcons.chefHat(),
              label: 'Recipes & BOM'),
          AdminSideNavItem(
              section: AdminSection.usageTracking,
              icon: PhosphorIcons.clipboardText(),
              label: 'Usage Tracking'),
          AdminSideNavItem(
              section: AdminSection.recordWastage,
              icon: PhosphorIcons.trash(),
              label: 'Record Wastage'),
          AdminSideNavItem(
              section: AdminSection.communications,
              icon: PhosphorIcons.chatCircle(),
              label: 'Communications'),
        ]),

        // ── FINANCE ───────────────────────────────────────────────────
        AdminSideNavGroup(title: 'FINANCE', items: [
          AdminSideNavItem(
              section: AdminSection.finance,
              icon: PhosphorIcons.chartPie(),
              label: 'Finance'),
          AdminSideNavItem(
              section: AdminSection.reports,
              icon: PhosphorIcons.fileText(),
              label: 'Reports'),
        ]),

        // ── SYSTEM ────────────────────────────────────────────────────
        AdminSideNavGroup(title: 'SYSTEM', items: [
          AdminSideNavItem(
              section: AdminSection.settings,
              icon: PhosphorIcons.treeStructure(),
              label: 'Settings'),
          AdminSideNavItem(
              section: AdminSection.notifications,
              icon: PhosphorIcons.bell(),
              label: 'Notifications'),
        ]),
      ];
}

// ─── Logo header ──────────────────────────────────────────────────────────

class _LogoHeader extends StatelessWidget {
  final bool isCollapsed;
  const _LogoHeader({required this.isCollapsed});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 60,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
              color: AppColors.kPrimary,
              borderRadius: BorderRadius.circular(8)),
          child: const Center(
              child: Text('FG',
                  style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 12))),
        ),
        if (!isCollapsed) ...[
          const SizedBox(width: 12),
          const Expanded(
              child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Famous Gates Hotels',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              Text('Management System',
                  style:
                      TextStyle(fontSize: 10, color: AppColors.kTextSecondary)),
            ],
          )),
        ],
      ]),
    );
  }
}

// ─── Group header ─────────────────────────────────────────────────────────

class _GroupHeader extends StatelessWidget {
  final String title;
  final bool isCollapsed;
  const _GroupHeader({required this.title, required this.isCollapsed});

  @override
  Widget build(BuildContext context) {
    if (isCollapsed) return const SizedBox(height: 8);
    if (title.isEmpty) return const SizedBox(height: 6);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 4),
      child: Text(
        title,
        style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: AppColors.kTextSecondary,
            letterSpacing: 1.3),
      ),
    );
  }
}

// ─── Nav item ─────────────────────────────────────────────────────────────

class _NavItem extends StatelessWidget {
  final AdminSideNavItem item;
  final bool isActive;
  final bool isCollapsed;
  final VoidCallback onTap;
  const _NavItem(
      {required this.item,
      required this.isActive,
      required this.isCollapsed,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
      decoration: BoxDecoration(
        color: isActive ? AppColors.kPrimary.withValues(alpha: 0.08) : null,
        borderRadius: BorderRadius.circular(8),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Container(
          height: 38,
          padding: EdgeInsets.only(
              left: isActive && !isCollapsed ? 9 : 12, right: 12),
          decoration: BoxDecoration(
            border: isActive && !isCollapsed
                ? const Border(
                    left: BorderSide(color: AppColors.kPrimary, width: 3))
                : null,
          ),
          child: Row(children: [
            Icon(item.icon,
                size: 18,
                color:
                    isActive ? AppColors.kPrimary : AppColors.kTextSecondary),
            if (!isCollapsed) ...[
              const SizedBox(width: 10),
              Expanded(
                  child: Text(
                item.label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                  color:
                      isActive ? AppColors.kPrimary : AppColors.kTextSecondary,
                ),
                overflow: TextOverflow.ellipsis,
              )),
            ],
          ]),
        ),
      ),
    );
  }
}
