import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:printing/printing.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import 'package:famous_gates_app/core/widgets/branch_sales_payments_view.dart';
import 'package:famous_gates_app/core/widgets/payment_method_breakdown_widget.dart';
import 'package:pdf/widgets.dart' as pw;

import '../../../core/state/app_refresh.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/readable_record.dart';
import '../../../core/utils/screen_size.dart';
import '../../../core/widgets/record_detail_screen.dart';
import '../../auth/domain/auth_notifier.dart';
import '../../branch_search/presentation/branch_search_screen.dart';
import '../data/repository.dart';
import '../domain/providers.dart';
import 'daily_close_screen.dart';
import 'bar_stocktake_review_screen.dart';
import 'branch_payroll_screen.dart';
import 'payroll_policies_screen.dart';
import 'payroll_adjustments_screen.dart';
import 'staff_pos_accounting_screen.dart';
import '../../pos/data/outlet_pos_repository.dart';

enum BranchAccountantSection {
  overview,
  search,
  cashierClearance,
  analytics,
  salesPayments,
  financialClose,
  branchPayroll,
  payrollPolicies,
  payrollAdjustments,
  discrepancies,
  profitLoss,
  revenueOversight,
  soldItems,
  staffAudit,
  shiftOpenings,
  shiftReview,
  cashierLogbooks,
  voidApprovals,
  exchangeHistory,
  banking,
  payments,
  outboundPayments,
  creditBills,
  staffPosAccounting,
  foodVariance,
  shiftPnl,
  bookingsInvoices,
  stockTake,
  inventoryJournals,
  supplierFinance,
  buffet,
  catering,
  budgets,
  kitchenVariance,
  barStocktakeReview,
}

class BranchAccountantDashboard extends ConsumerStatefulWidget {
  const BranchAccountantDashboard({super.key, this.initialSection});

  final BranchAccountantSection? initialSection;

  @override
  ConsumerState<BranchAccountantDashboard> createState() =>
      _BranchAccountantDashboardState();
}

class _BranchAccountantDashboardState
    extends ConsumerState<BranchAccountantDashboard> {
  late BranchAccountantSection _section =
      widget.initialSection ?? BranchAccountantSection.overview;

  /// Pre-fill data passed from Supplier Finance → Outbound Payments.
  Map<String, dynamic>? _outboundPreload;

  void _navigateToOutbound(Map<String, dynamic> preload) {
    setState(() {
      _outboundPreload = preload;
      _section = BranchAccountantSection.outboundPayments;
    });
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    final isMobile = width < 768;
    final isTablet = width >= 768 && width < 1024;
    // Ctrl+R / F5 → rebuild the active section so it reloads its data.
    final tick = ref.watch(globalRefreshTickProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF0F4F0),
      body: Row(
        children: [
          if (!isMobile)
            _BranchAccountantSideNav(
              width: isTablet ? 64 : 256,
              isCollapsed: isTablet,
              current: _section,
              onChanged: (section) => setState(() => _section = section),
            ),
          Expanded(
            child: Column(
              children: [
                _BranchAccountantTopBar(
                  section: _section,
                  onMenuTap: isMobile ? () => _showMobileNav(context) : null,
                ),
                Expanded(
                  child: KeyedSubtree(
                    key: ValueKey('ba_${_section}_$tick'),
                    child: _buildSection(),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: isMobile
          ? _BranchAccountantBottomNav(
              current: _section,
              onChanged: (section) => setState(() => _section = section),
            )
          : null,
    );
  }

  Widget _buildSection() {
    switch (_section) {
      case BranchAccountantSection.overview:
        return _OverviewSection(
          onNavigate: (section) => setState(() => _section = section),
        );
      case BranchAccountantSection.search:
        return const BranchSearchSection();
      case BranchAccountantSection.cashierClearance:
        return const _CashierClearanceSection();
      case BranchAccountantSection.analytics:
        return const _AnalyticsSection();
      case BranchAccountantSection.salesPayments:
        return const BranchSalesPaymentsView();
      case BranchAccountantSection.financialClose:
        return const DailyCloseScreen();
      case BranchAccountantSection.branchPayroll:
        return const BranchPayrollScreen();
      case BranchAccountantSection.payrollPolicies:
        return const PayrollPoliciesScreen();
      case BranchAccountantSection.payrollAdjustments:
        return const PayrollAdjustmentsScreen();
      case BranchAccountantSection.discrepancies:
        return const _DiscrepanciesSection();
      case BranchAccountantSection.profitLoss:
        return const _ProfitLossSection();
      case BranchAccountantSection.revenueOversight:
        return const _RevenueOversightSection();
      case BranchAccountantSection.soldItems:
        return const _SoldItemsSection();
      case BranchAccountantSection.staffAudit:
        return const _StaffAuditSection();
      case BranchAccountantSection.shiftOpenings:
        return const _ShiftOpeningApprovalsSection();
      case BranchAccountantSection.shiftReview:
        return const _ShiftReviewSection();
      case BranchAccountantSection.cashierLogbooks:
        return const _CashierLogbooksSection();
      case BranchAccountantSection.voidApprovals:
        return const _VoidApprovalsSection();
      case BranchAccountantSection.exchangeHistory:
        return const _ExchangeHistorySection();
      case BranchAccountantSection.banking:
        return const _BankingSection();
      case BranchAccountantSection.payments:
        return const _PaymentsInvoicesSection();
      case BranchAccountantSection.outboundPayments:
        return _OutboundPaymentsSection(
          preload: _outboundPreload,
          onPreloadConsumed: () => setState(() => _outboundPreload = null),
        );
      case BranchAccountantSection.creditBills:
        return const _CreditBillsSection();
      case BranchAccountantSection.staffPosAccounting:
        return const StaffPosAccountingScreen();
      case BranchAccountantSection.foodVariance:
        return const _FoodVarianceSection();
      case BranchAccountantSection.shiftPnl:
        return const _ShiftPnlSection();
      case BranchAccountantSection.bookingsInvoices:
        return const _BookingsInvoicesSection();
      case BranchAccountantSection.stockTake:
        return const _StockTakeSection();
      case BranchAccountantSection.inventoryJournals:
        return const _InventoryJournalsSection();
      case BranchAccountantSection.supplierFinance:
        return _PurchasesSection(onPay: _navigateToOutbound);
      case BranchAccountantSection.buffet:
        return const _BuffetSection();
      case BranchAccountantSection.catering:
        return const _CateringSection();
      case BranchAccountantSection.budgets:
        return const _BudgetsSection();
      case BranchAccountantSection.kitchenVariance:
        return const _KitchenVarianceSection();
      case BranchAccountantSection.barStocktakeReview:
        return const BarStocktakeReviewScreen();
    }
  }

  void _showMobileNav(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => _MobileNavSheet(
        current: _section,
        onChanged: (section) {
          setState(() => _section = section);
          Navigator.pop(context);
        },
      ),
    );
  }
}

class _NavItem {
  const _NavItem(this.section, this.label, this.icon);

  final BranchAccountantSection section;
  final String label;
  final IconData icon;
}

const _navItems = [
  _NavItem(BranchAccountantSection.overview, 'Overview', Icons.dashboard),
  _NavItem(BranchAccountantSection.search, 'Branch Search', Icons.search),
  // ── Daily cashier, shift & bill operations (most accessed) ──
  _NavItem(BranchAccountantSection.shiftReview, 'Shift Reconciliation',
      Icons.schedule),
  _NavItem(
      BranchAccountantSection.shiftOpenings, 'Shift Openings', Icons.lock_open),
  _NavItem(
      BranchAccountantSection.cashierLogbooks, 'Cashier Logbooks', Icons.book),
  _NavItem(
      BranchAccountantSection.creditBills, 'Credit Bills', Icons.credit_card),
  _NavItem(BranchAccountantSection.staffPosAccounting, 'Staff POS Accounting',
      Icons.receipt_long),
  _NavItem(BranchAccountantSection.payments, 'Payments & Invoices',
      Icons.receipt_long),
  _NavItem(BranchAccountantSection.bookingsInvoices, 'Bookings & Invoices',
      Icons.request_quote),
  _NavItem(BranchAccountantSection.outboundPayments, 'Outbound Payments',
      Icons.payments),
  _NavItem(BranchAccountantSection.salesPayments, 'Sales & Payments',
      Icons.point_of_sale),
  _NavItem(BranchAccountantSection.staffAudit, 'Staff Audit', Icons.shield),
  _NavItem(
      BranchAccountantSection.voidApprovals, 'Void Approvals', Icons.block),
  _NavItem(BranchAccountantSection.exchangeHistory, 'Item Exchanges',
      Icons.swap_horiz),
  _NavItem(
      BranchAccountantSection.discrepancies, 'Discrepancies', Icons.warning),
  // ── Finance & oversight ──
  _NavItem(
      BranchAccountantSection.financialClose, 'Daily Close', Icons.lock_clock),
  _NavItem(BranchAccountantSection.branchPayroll, 'Branch Payroll',
      Icons.people_alt),
  _NavItem(BranchAccountantSection.payrollPolicies, 'Payroll Policies',
      Icons.tune),
  _NavItem(BranchAccountantSection.payrollAdjustments, 'Payroll Adjustments',
      Icons.adjust),
  _NavItem(
      BranchAccountantSection.analytics, 'Branch Analytics', Icons.analytics),
  _NavItem(BranchAccountantSection.revenueOversight, 'Revenue Oversight',
      Icons.trending_up),
  _NavItem(
      BranchAccountantSection.profitLoss, 'Profit & Loss', Icons.bar_chart),
  // ── Inventory & operations ──
  _NavItem(BranchAccountantSection.soldItems, 'Sold Items', Icons.inventory_2),
  _NavItem(BranchAccountantSection.stockTake, 'Stock Takes', Icons.inventory),
  _NavItem(BranchAccountantSection.inventoryJournals, 'Inventory Journals',
      Icons.account_tree),
  _NavItem(BranchAccountantSection.supplierFinance, 'Supplier Finance',
      Icons.account_balance_wallet),
  _NavItem(BranchAccountantSection.kitchenVariance, 'Kitchen Variance',
      Icons.soup_kitchen),
  _NavItem(BranchAccountantSection.barStocktakeReview, 'Bar Stocktake Review',
      Icons.liquor),
];

class _BranchAccountantSideNav extends ConsumerWidget {
  const _BranchAccountantSideNav({
    required this.width,
    required this.isCollapsed,
    required this.current,
    required this.onChanged,
  });

  final double width;
  final bool isCollapsed;
  final BranchAccountantSection current;
  final ValueChanged<BranchAccountantSection> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      width: width,
      color: Colors.white,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.kPrimary,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Center(
                    child: Text('BA',
                        style: TextStyle(
                            color: Colors.white, fontWeight: FontWeight.w800)),
                  ),
                ),
                if (!isCollapsed) ...[
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Branch Accountant',
                            style: TextStyle(fontWeight: FontWeight.w800)),
                        Text('Famous Gates',
                            style: TextStyle(fontSize: 12, color: Colors.grey)),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 12),
              children: _navItems.map((item) {
                final active = item.section == current;
                return Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
                  child: Tooltip(
                    message: item.label,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(10),
                      onTap: () => onChanged(item.section),
                      child: Container(
                        padding: EdgeInsets.symmetric(
                          horizontal: isCollapsed ? 10 : 12,
                          vertical: 11,
                        ),
                        decoration: BoxDecoration(
                          color: active
                              ? AppColors.kPrimary.withValues(alpha: 0.09)
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            Icon(item.icon,
                                size: 20,
                                color: active
                                    ? AppColors.kPrimary
                                    : AppColors.kTextSecondary),
                            if (!isCollapsed) ...[
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  item.label,
                                  style: TextStyle(
                                    fontWeight: active
                                        ? FontWeight.w700
                                        : FontWeight.w500,
                                    color: active
                                        ? AppColors.kPrimary
                                        : AppColors.kTextPrimary,
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
              }).toList(),
            ),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(12),
            child: IconButton(
              tooltip: 'Sign out',
              onPressed: () => ref.read(authNotifierProvider.notifier).logout(),
              icon: const Icon(Icons.logout),
            ),
          ),
        ],
      ),
    );
  }
}

class _BranchAccountantTopBar extends ConsumerWidget {
  const _BranchAccountantTopBar({required this.section, this.onMenuTap});

  final BranchAccountantSection section;
  final VoidCallback? onMenuTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authNotifierProvider).valueOrNull;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
      ),
      child: Row(
        children: [
          if (onMenuTap != null)
            IconButton(onPressed: onMenuTap, icon: const Icon(Icons.menu)),
          Text('Branch Accountant',
              style: TextStyle(fontSize: 14, color: Colors.grey.shade500)),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 8),
            child: Icon(Icons.chevron_right, size: 16),
          ),
          Text(_label(section),
              style:
                  const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
          const Spacer(),
          if (MediaQuery.of(context).size.width > 900)
            SizedBox(
              width: 280,
              height: 40,
              child: TextField(
                decoration: InputDecoration(
                  hintText: 'Search module data...',
                  prefixIcon: const Icon(Icons.search, size: 18),
                  filled: true,
                  fillColor: Colors.grey.shade50,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: Colors.grey.shade200),
                  ),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
            ),
          const SizedBox(width: 16),
          CircleAvatar(
            radius: 17,
            backgroundColor: AppColors.kPrimary.withValues(alpha: 0.1),
            child: Text(
              (user?.name.isNotEmpty == true ? user!.name[0] : 'B')
                  .toUpperCase(),
              style: const TextStyle(
                  color: AppColors.kPrimary, fontWeight: FontWeight.w800),
            ),
          ),
          const SizedBox(width: 10),
          if (MediaQuery.of(context).size.width > 700)
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(user?.name ?? 'Branch Accountant',
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w700)),
                Text(user?.branchName ?? '',
                    style:
                        TextStyle(fontSize: 11, color: Colors.grey.shade500)),
              ],
            ),
        ],
      ),
    );
  }
}

class _MobileNavSheet extends StatelessWidget {
  const _MobileNavSheet({required this.current, required this.onChanged});

  final BranchAccountantSection current;
  final ValueChanged<BranchAccountantSection> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.72,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: _navItems
            .map((item) => ListTile(
                  leading: Icon(item.icon),
                  title: Text(item.label),
                  selected: item.section == current,
                  selectedTileColor: AppColors.kPrimary.withValues(alpha: 0.08),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                  onTap: () => onChanged(item.section),
                ))
            .toList(),
      ),
    );
  }
}

class _BranchAccountantBottomNav extends StatelessWidget {
  const _BranchAccountantBottomNav({
    required this.current,
    required this.onChanged,
  });

  final BranchAccountantSection current;
  final ValueChanged<BranchAccountantSection> onChanged;

  @override
  Widget build(BuildContext context) {
    const items = [
      BranchAccountantSection.overview,
      BranchAccountantSection.shiftReview,
      BranchAccountantSection.cashierLogbooks,
      BranchAccountantSection.creditBills,
      BranchAccountantSection.discrepancies,
    ];
    return BottomNavigationBar(
      currentIndex: items.indexOf(current).clamp(0, items.length - 1),
      type: BottomNavigationBarType.fixed,
      selectedItemColor: AppColors.kPrimary,
      unselectedItemColor: AppColors.kTextSecondary,
      onTap: (index) => onChanged(items[index]),
      items: items
          .map((section) => BottomNavigationBarItem(
                icon: Icon(_icon(section)),
                label: _shortLabel(section),
              ))
          .toList(),
    );
  }
}

class _OverviewSection extends ConsumerWidget {
  const _OverviewSection({required this.onNavigate});

  final ValueChanged<BranchAccountantSection> onNavigate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(branchAccountantOverviewProvider);
    final tasks = ref.watch(branchAccountantDirectorTasksProvider);
    return _AsyncPane(
      value: data,
      onRefresh: () {
        ref.invalidate(branchAccountantOverviewProvider);
        ref.invalidate(branchAccountantDirectorTasksProvider);
      },
      builder: (payload) {
        final clearance = _map(payload['clearances']);
        final summary = _map(clearance['summary']);
        final clearanceItems = _list(clearance['clearances']);
        // NOTE: daily_financial_records data must only be rendered on the
        // dedicated Daily Close screen (BranchAccountantSection.financialClose) —
        // it is intentionally not fetched/derived here.
        // Branch-sales analytics nests its totals under `summary`.
        final sales = _map(payload['sales']);
        final salesSummary = _map(sales['summary']);
        // Branch-financials nests aggregates under `summary` (revenue/expenses/netProfit).
        final financials = _map(payload['financials']);
        final finSummary = _map(financials['summary']);
        final discrepancies = _list(payload['discrepancies']);
        final openDiscrepancies =
            discrepancies.where(_isOpenDiscrepancy).toList();
        final budget = _map(payload['budget_summary']);

        final analyticsRevenue = _firstNonZeroNum([
          salesSummary['total_sales'],
          salesSummary['total_revenue'],
          salesSummary['totalSales'],
          sales['total_sales'],
          sales['total_revenue'],
          sales['totalSales'],
        ]);
        final profileRevenue = _firstNonZeroNum([
          finSummary['revenue'],
          finSummary['total_revenue'],
          finSummary['totalRevenue'],
          financials['total_revenue'],
          financials['totalRevenue'],
          financials['revenue'],
        ]);
        final profileExpenses = _firstNonZeroNum([
          finSummary['expenses'],
          finSummary['total_expenses'],
          finSummary['totalExpenses'],
          financials['total_expenses'],
          financials['totalExpenses'],
          financials['expenses'],
        ]);
        final profileNetProfit = _num(finSummary['netProfit'] ??
            finSummary['net_profit'] ??
            finSummary['net_income'] ??
            financials['net_profit'] ??
            financials['netProfit'] ??
            financials['net_income']);
        num receivables =
            _num(financials['receivables'] ?? finSummary['receivables']);
        num payables = _num(financials['payables'] ?? finSummary['payables']);
        num budgetUtil = _num(budget['utilization_percentage'] ??
            budget['usage_percentage'] ??
            budget['utilization'] ??
            budget['utilisation_percentage']);
        num pendingClear = _num(summary['pending'] ?? summary['pending_count']);
        if (pendingClear == 0 && clearanceItems.isNotEmpty) {
          pendingClear = clearanceItems.where(_isPendingClearance).length;
        }
        num variance = _num(summary['total_variance']);
        if (variance == 0 && clearanceItems.isNotEmpty) {
          variance = clearanceItems.fold<num>(
              0, (sum, c) => sum + _num(c['variance']));
        }
        final budgetBalance = _num(budget['remaining_budget'] ??
            budget['total_remaining'] ??
            budget['balance']);

        return _Page(
          title: 'Branch Accountant Overview',
          subtitle: 'Month-to-date branch accounting control center.',
          actions: [
            _RefreshButton(onPressed: () {
              ref.invalidate(branchAccountantOverviewProvider);
              ref.invalidate(branchAccountantDirectorTasksProvider);
            }),
          ],
          children: [
            tasks.maybeWhen(
              data: (items) => items.isEmpty
                  ? const SizedBox.shrink()
                  : _DirectorTasks(items: items),
              orElse: () => const SizedBox.shrink(),
            ),
            _OverviewControlBand(
              periodLabel: _overviewPeriodLabel(),
              capturedSales: analyticsRevenue,
              onOpenWorkspace: () =>
                  onNavigate(BranchAccountantSection.financialClose),
            ),
            _ResponsiveGrid(children: [
              _MetricCard('POS Sales Captured', _money(analyticsRevenue),
                  Icons.point_of_sale, Colors.blue),
              _MetricCard(
                  'Cashier Variance',
                  _money(variance),
                  Icons.fact_check,
                  variance.abs() > 0 ? Colors.red : Colors.green),
              _MetricCard('Pending Clearances', '${pendingClear.toInt()}',
                  Icons.hourglass_bottom, Colors.orange),
              _MetricCard('Open Discrepancies', '${openDiscrepancies.length}',
                  Icons.warning, Colors.red),
              _MetricCard(
                  'Budget Utilization',
                  '${budgetUtil.toStringAsFixed(1)}%',
                  Icons.account_balance,
                  Colors.purple),
            ]),
            const SizedBox(height: 8),
            _QuickActions(onNavigate: onNavigate),
            const SizedBox(height: 8),
            _SectionCard(
              title: 'Branch Financial Position',
              child: _KeyValueList({
                'POS Sales Captured': _money(analyticsRevenue),
                'Profile Revenue Reference': _money(profileRevenue),
                'Profile Expenses Reference': _money(profileExpenses),
                'Profile Net Reference': _money(profileNetProfit),
                'Receivables': _money(receivables),
                'Payables': _money(payables),
                'Budget Balance': _money(budgetBalance),
              }),
            ),
          ],
        );
      },
    );
  }
}

String _overviewPeriodLabel() {
  final now = DateTime.now();
  final start = DateTime(now.year, now.month, 1);
  return '${DateFormat('MMM d').format(start)} - ${DateFormat('MMM d, yyyy').format(now)}';
}

class _OverviewControlBand extends StatelessWidget {
  const _OverviewControlBand({
    required this.periodLabel,
    required this.capturedSales,
    required this.onOpenWorkspace,
  });

  final String periodLabel;
  final num capturedSales;
  final VoidCallback onOpenWorkspace;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.kDivider),
      ),
      child: LayoutBuilder(builder: (context, constraints) {
        final summary = Wrap(
          spacing: 18,
          runSpacing: 12,
          children: [
            _OverviewBandMetric(
              label: 'Period',
              value: periodLabel,
              icon: Icons.date_range,
              color: AppColors.kPrimary,
            ),
            _OverviewBandMetric(
              label: 'Captured POS Sales',
              value: _money(capturedSales),
              icon: Icons.point_of_sale,
              color: Colors.blue,
            ),
          ],
        );
        final action = FilledButton.icon(
          onPressed: onOpenWorkspace,
          icon: const Icon(Icons.calendar_month),
          label: const Text('Open Daily Workspace'),
        );
        if (constraints.maxWidth < 980) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              summary,
              const SizedBox(height: 14),
              action,
            ],
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(child: summary),
            const SizedBox(width: 14),
            action,
          ],
        );
      }),
    );
  }
}

class _OverviewBandMetric extends StatelessWidget {
  const _OverviewBandMetric({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 190,
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color.withValues(alpha: .1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 19),
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.kTextSecondary,
                    fontSize: 12,
                  ),
                ),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Quick action links on the overview ────────────────────────────────────────
class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.onNavigate});
  final ValueChanged<BranchAccountantSection> onNavigate;

  @override
  Widget build(BuildContext context) {
    final actions = <(String, IconData, BranchAccountantSection)>[
      (
        'Shift Reconciliation',
        Icons.schedule,
        BranchAccountantSection.shiftReview
      ),
      (
        'Shift Openings',
        Icons.lock_open,
        BranchAccountantSection.shiftOpenings
      ),
      (
        'Daily Close',
        Icons.lock_clock,
        BranchAccountantSection.financialClose
      ),
      ('Discrepancies', Icons.warning, BranchAccountantSection.discrepancies),
      ('Credit Bills', Icons.credit_card, BranchAccountantSection.creditBills),
      (
        'Supplier Finance',
        Icons.account_balance_wallet,
        BranchAccountantSection.supplierFinance
      ),
      ('Stock Takes', Icons.inventory, BranchAccountantSection.stockTake),
      ('Profit & Loss', Icons.bar_chart, BranchAccountantSection.profitLoss),
    ];
    return _SectionCard(
      title: 'Quick Actions',
      child: Wrap(
        spacing: 10,
        runSpacing: 10,
        children: actions
            .map((a) => OutlinedButton.icon(
                  onPressed: () => onNavigate(a.$3),
                  icon: Icon(a.$2, size: 18),
                  label: Text(a.$1),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.kPrimary,
                    side: BorderSide(color: Colors.grey.shade300),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                  ),
                ))
            .toList(),
      ),
    );
  }
}

class _CashierClearanceSection extends ConsumerStatefulWidget {
  const _CashierClearanceSection();

  @override
  ConsumerState<_CashierClearanceSection> createState() =>
      _CashierClearanceSectionState();
}

class _CashierClearanceSectionState
    extends ConsumerState<_CashierClearanceSection> {
  late String _date = _today();
  String _status = 'all';
  late Future<Map<String, dynamic>> _future = _load();

  Future<Map<String, dynamic>> _load() {
    return ref
        .read(branchAccountantRepositoryProvider)
        .getCashierClearances(date: _date, status: _status);
  }

  void _refresh() => setState(() {
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (payload) {
          final items = _list(payload['clearances'] ?? payload['data']);
          final summary = _map(payload['summary']);
          return _Page(
            title: 'Cashier Clearance',
            subtitle: 'Review, approve, and flag cashier shift closures.',
            actions: [
              _DateField(
                  value: _date, onChanged: (v) => setState(() => _date = v)),
              _Dropdown(
                value: _status,
                values: const ['all', 'open', 'pending', 'approved', 'flagged'],
                onChanged: (v) => setState(() => _status = v),
              ),
              _RefreshButton(onPressed: _refresh),
            ],
            children: [
              _ResponsiveGrid(children: [
                _MetricCard(
                    'Total Shifts',
                    '${summary['total_shifts'] ?? items.length}',
                    Icons.schedule,
                    Colors.blue),
                _MetricCard('Pending', '${summary['pending'] ?? 0}',
                    Icons.hourglass_top, Colors.orange),
                _MetricCard('Approved', '${summary['approved'] ?? 0}',
                    Icons.check_circle, Colors.green),
                _MetricCard(
                    'With Discrepancies',
                    '${summary['with_discrepancies'] ?? 0}',
                    Icons.warning,
                    Colors.red),
                _MetricCard(
                    'Expected Cash',
                    _money(_num(summary['total_expected'])),
                    Icons.payments,
                    Colors.teal),
                _MetricCard(
                    'Actual Cash',
                    _money(_num(summary['total_actual'])),
                    Icons.point_of_sale,
                    Colors.indigo),
                _MetricCard('Variance', _money(_num(summary['total_variance'])),
                    Icons.compare_arrows, Colors.purple),
              ]),
              _SectionCard(
                title: 'Clearance Queue',
                child: _SimpleTable(
                  columns: const [
                    'Cashier',
                    'Shift',
                    'Expected',
                    'Actual',
                    'Variance',
                    'Status',
                    'Actions'
                  ],
                  rows: items
                      .map((item) => [
                            _text(
                                item, ['cashier_name', 'cashier', 'user_name']),
                            _text(item, ['shift_time', 'shift_id', 'id']),
                            _money(_num(item['expected_cash'] ??
                                item['expected_amount'])),
                            _money(_num(
                                item['actual_cash'] ?? item['actual_amount'])),
                            '${_money(_num(item['variance']))}${item['variance_percentage'] != null ? ' (${_num(item['variance_percentage']).toStringAsFixed(1)}%)' : ''}',
                            _StatusPill(_text(item, ['status'])),
                            Wrap(
                              spacing: 8,
                              children: [
                                TextButton(
                                  onPressed: () => _showDetails(item),
                                  child: const Text('View'),
                                ),
                                if (_canAct(item))
                                  FilledButton.tonal(
                                    onPressed: () => _approve(item),
                                    child: const Text('Approve'),
                                  ),
                                if (_canAct(item))
                                  OutlinedButton(
                                    onPressed: () => _flag(item),
                                    child: const Text('Flag'),
                                  ),
                              ],
                            ),
                          ])
                      .toList(),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  bool _canAct(Map<String, dynamic> item) {
    final status = _text(item, ['status']).toLowerCase();
    return status == 'open' || status == 'pending';
  }

  Future<void> _approve(Map<String, dynamic> item) async {
    final result = await showDialog<String?>(
      context: context,
      builder: (_) => _ApproveClearanceDialog(clearance: item),
    );
    if (result == null) return;
    await ref
        .read(branchAccountantRepositoryProvider)
        .approveClearance('${item['id']}', notes: result);
    _toast('Clearance approved');
    _refresh();
  }

  Future<void> _flag(Map<String, dynamic> item) async {
    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (_) => const _FlagClearanceDialog(),
    );
    if (result == null) return;
    await ref.read(branchAccountantRepositoryProvider).flagClearance(
          '${item['id']}',
          reason: result['reason']!,
          notes: result['notes'],
        );
    _toast('Clearance flagged');
    _refresh();
  }

  void _showDetails(Map<String, dynamic> item) {
    openRecordDetailScreen(
      context,
      title: 'Cashier Clearance — ${_text(item, [
            'cashier_name',
            'cashier',
            'user_name'
          ])}',
      subtitle: 'Expected cash, actual cash, variance, and payment breakdown.',
      record: item,
    );
  }
}

class _ApproveClearanceDialog extends StatefulWidget {
  const _ApproveClearanceDialog({required this.clearance});
  final Map<String, dynamic> clearance;

  @override
  State<_ApproveClearanceDialog> createState() =>
      _ApproveClearanceDialogState();
}

class _ApproveClearanceDialogState extends State<_ApproveClearanceDialog> {
  final _notes = TextEditingController();

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.clearance;
    final expected = _num(c['expected_cash'] ?? c['expected_amount']);
    final actual = _num(c['actual_cash'] ?? c['actual_amount']);
    final variance = _num(c['variance']);
    final varColor = variance.abs() <= 0
        ? Colors.green
        : variance < 0
            ? Colors.red
            : Colors.orange;

    return AlertDialog(
      title: const Text('Approve Clearance'),
      content: SizedBox(
        width: 480,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(children: [
                _InfoRow('Cashier',
                    _text(c, ['cashier_name', 'cashier', 'user_name'])),
                _InfoRow('Shift', _text(c, ['shift_time', 'shift_id', 'id'])),
                _InfoRow('Expected Cash', _money(expected)),
                _InfoRow('Actual Cash', _money(actual)),
                Row(children: [
                  const Expanded(
                    child: Text('Variance',
                        style: TextStyle(color: AppColors.kTextSecondary)),
                  ),
                  Text(
                    _money(variance),
                    style:
                        TextStyle(color: varColor, fontWeight: FontWeight.w800),
                  ),
                ]),
              ]),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _notes,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(
                  labelText: 'Approval Notes (optional)',
                  hintText: 'Add any notes about this approval'),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        FilledButton(
          onPressed: () => Navigator.pop(context, _notes.text),
          child: const Text('Approve'),
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(children: [
        Expanded(
          child: Text(label,
              style: const TextStyle(color: AppColors.kTextSecondary)),
        ),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
      ]),
    );
  }
}

class _AnalyticsSection extends ConsumerStatefulWidget {
  const _AnalyticsSection();

  @override
  ConsumerState<_AnalyticsSection> createState() => _AnalyticsSectionState();
}

class _AnalyticsSectionState extends ConsumerState<_AnalyticsSection> {
  late String _start = _date(DateTime.now().subtract(const Duration(days: 30)));
  late String _end = _today();
  bool _showFilters = false;
  final Set<String> _paymentMethods = {};
  final Set<String> _orderTypes = {};
  final Set<String> _categories = {};
  late Future<Map<String, dynamic>> _future = _load();

  Future<Map<String, dynamic>> _load() async {
    final repo = ref.read(branchAccountantRepositoryProvider);
    final results = await Future.wait([
      repo.getBranchSalesAnalytics(
        startDate: _start,
        endDate: _end,
        filters: _filtersPayload,
      ),
      repo.getBranchFinancials(startDate: _start, endDate: _end),
      repo.getSoldItems(startDate: _start, endDate: _end),
    ]);
    return {
      'sales': results[0],
      'financials': results[1],
      'soldItems': results[2],
    };
  }

  void _refresh() => setState(() {
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (payload) {
          final sales = _map(payload['sales']);
          final salesSummary = _map(sales['summary']);
          final financials = _map(payload['financials']);
          final financialSummary = _map(financials['summary']).isNotEmpty
              ? _map(financials['summary'])
              : financials;
          final dailyBreakdown = _list(sales['daily_breakdown']);
          final paymentBreakdown = _list(sales['payment_method_breakdown']);
          final categoryBreakdown = _list(sales['category_breakdown']);
          final transactions = _list(sales['transactions']);
          final soldItemsPayload = _map(payload['soldItems']);
          final soldItemsData = _map(soldItemsPayload['data']).isNotEmpty
              ? _map(soldItemsPayload['data'])
              : soldItemsPayload;
          final soldItemsSummary = _map(soldItemsData['summary']);
          final outletBreakdown = _list(soldItemsSummary['outlet_breakdown']);
          final topSellingItems = ([..._list(soldItemsData['analysis'])]
                ..sort((a, b) => _num(b['quantity']).compareTo(_num(a['quantity']))))
              .take(10)
              .toList();
          final byMethodMap = paymentBreakdown.fold<Map<String, num>>(
            {'mpesa': 0, 'cash': 0, 'card': 0, 'credit': 0},
            (acc, m) {
              final key = _text(m, ['payment_method']).toLowerCase();
              final amount = _num(m['total_sales'] ?? m['amount']);
              if (key.contains('mpesa') || key.contains('mobile')) {
                acc['mpesa'] = (acc['mpesa'] ?? 0) + amount;
              } else if (key.contains('cash')) {
                acc['cash'] = (acc['cash'] ?? 0) + amount;
              } else if (key.contains('card') || key.contains('swipe')) {
                acc['card'] = (acc['card'] ?? 0) + amount;
              } else if (key.contains('credit')) {
                acc['credit'] = (acc['credit'] ?? 0) + amount;
              }
              return acc;
            },
          );
          return _Page(
            title: 'Branch Sales Analytics',
            subtitle:
                'Mirrors the web branch-sales analytics, filters, and PDF/CSV export actions.',
            actions: [
              _DateField(
                  value: _start, onChanged: (v) => setState(() => _start = v)),
              _DateField(
                  value: _end, onChanged: (v) => setState(() => _end = v)),
              OutlinedButton.icon(
                onPressed: () => setState(() => _showFilters = !_showFilters),
                icon: const Icon(Icons.filter_alt),
                label: Text(_showFilters ? 'Hide Filters' : 'Filters'),
              ),
              _RefreshButton(onPressed: _refresh),
              OutlinedButton.icon(
                onPressed: () => _export('pdf'),
                icon: const Icon(Icons.picture_as_pdf),
                label: const Text('Branded PDF'),
              ),
              OutlinedButton.icon(
                onPressed: () => _export('csv'),
                icon: const Icon(Icons.table_chart),
                label: const Text('CSV'),
              ),
            ],
            children: [
              if (_showFilters)
                _AnalyticsFilterPanel(
                  start: _start,
                  end: _end,
                  paymentMethods: _paymentMethods,
                  orderTypes: _orderTypes,
                  categories: _categories,
                  onPreset: _setPreset,
                  onStartChanged: (value) => setState(() => _start = value),
                  onEndChanged: (value) => setState(() => _end = value),
                  onToggle: (group, value, checked) {
                    setState(() {
                      final target = switch (group) {
                        'payment_methods' => _paymentMethods,
                        'order_types' => _orderTypes,
                        _ => _categories,
                      };
                      checked ? target.add(value) : target.remove(value);
                    });
                  },
                  onApply: _refresh,
                  onReset: () {
                    setState(() {
                      _paymentMethods.clear();
                      _orderTypes.clear();
                      _categories.clear();
                      _start = _date(
                          DateTime.now().subtract(const Duration(days: 30)));
                      _end = _today();
                    });
                    _refresh();
                  },
                ),
              _ResponsiveGrid(children: [
                _MetricCard(
                    'Total Sales',
                    _money(_num(
                        salesSummary['total_sales'] ?? sales['total_sales'])),
                    Icons.trending_up,
                    Colors.green),
                _MetricCard(
                    'Transactions',
                    '${salesSummary['transaction_count'] ?? sales['transaction_count'] ?? transactions.length}',
                    Icons.receipt,
                    Colors.blue),
                _MetricCard(
                    'Average Ticket',
                    _money(_num(salesSummary['avg_transaction_value'] ??
                        sales['avg_transaction_value'])),
                    Icons.speed,
                    Colors.purple),
                _MetricCard(
                    'Branch Revenue',
                    _money(_num(financialSummary['revenue'] ??
                        financialSummary['total_revenue'])),
                    Icons.account_balance,
                    Colors.teal),
                _MetricCard(
                    'Branch Expenses',
                    _money(_num(financialSummary['expenses'] ??
                        financialSummary['total_expenses'])),
                    Icons.trending_down,
                    Colors.red),
                _MetricCard(
                    'Net Profit',
                    _money(_num(financialSummary['netProfit'] ??
                        financialSummary['net_profit'])),
                    Icons.wallet,
                    Colors.indigo),
                _MetricCard(
                    'Net Position',
                    _money(_num(financials['receivables']) -
                        _num(financials['payables'])),
                    Icons.account_balance_wallet,
                    Colors.brown),
              ]),
              PaymentMethodBreakdownWidget(
                title: 'Payment Method Breakdown',
                mpesa: byMethodMap['mpesa'] ?? 0,
                cash: byMethodMap['cash'] ?? 0,
                card: byMethodMap['card'] ?? 0,
                credit: byMethodMap['credit'] ?? 0,
              ),
              const SizedBox(height: 12),
              _TwoColumn(
                left: _SalesTrendChart(data: dailyBreakdown),
                right: _PaymentMethodPieChart(data: paymentBreakdown),
              ),
              _CategoryBreakdownBarChart(data: categoryBreakdown),
              _TwoColumn(
                left: _RevenueByOutletChart(data: outletBreakdown),
                right: _DailyTransactionsBarChart(data: dailyBreakdown),
              ),
              _TwoColumn(
                left: _TopSellingItemsChart(data: topSellingItems),
                right: _HourlySalesBarChart(transactions: transactions),
              ),
              _CreditBillsTrendChart(transactions: transactions),
              _TwoColumn(
                left: _BreakdownCard(
                    title: 'Revenue Sources',
                    values: _map(financialSummary['revenueBySource'] ??
                        financialSummary['revenue_by_source'])),
                right: _BreakdownCard(
                    title: 'Expense Categories',
                    values: _map(financialSummary['expensesByCategory'] ??
                        financialSummary['expenses_by_category'])),
              ),
              _TwoColumn(
                left: _SectionCard(
                  title: 'Recent Finance Transactions',
                  child: _SimpleTable(
                    columns: const ['Description', 'Date', 'Type', 'Amount'],
                    rows: _list(financials['recentTransactions'])
                        .map((e) => [
                              _text(e, ['description', 'transaction_number'])
                                      .isEmpty
                                  ? 'Finance transaction'
                                  : _text(
                                      e, ['description', 'transaction_number']),
                              _shortDate(_text(e, ['created_at'])),
                              _title(_text(e, ['transaction_type']).isEmpty
                                  ? 'entry'
                                  : _text(e, ['transaction_type'])),
                              _money(_num(e['amount'])),
                            ])
                        .toList(),
                  ),
                ),
                right: _SectionCard(
                  title: 'Recent Payments & Logbooks',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Payments',
                          style: TextStyle(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 6),
                      _SimpleTable(
                        columns: const ['Reference', 'Date', 'Amount'],
                        rows: _list(financials['recentPayments'])
                            .take(5)
                            .map((e) => [
                                  _text(e,
                                      ['reference', 'payment_reference', 'id']),
                                  _shortDate(_text(e, ['created_at'])),
                                  _money(_num(e['amount'])),
                                ])
                            .toList(),
                      ),
                      const SizedBox(height: 16),
                      const Text('Cashier Logbooks',
                          style: TextStyle(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 6),
                      _SimpleTable(
                        columns: const ['Type', 'Date', 'Status'],
                        rows: _list(financials['logbooks'])
                            .map((e) => [
                                  _title(_text(e, ['type']).isEmpty
                                      ? 'logbook'
                                      : _text(e, ['type'])),
                                  _text(e, ['log_date']),
                                  _StatusPill(_text(e, ['status'])),
                                ])
                            .toList(),
                      ),
                    ],
                  ),
                ),
              ),
              _AnalyticsTransactionTable(transactions: transactions),
            ],
          );
        },
      ),
    );
  }

  Future<void> _export(String format) async {
    final file =
        await ref.read(branchAccountantRepositoryProvider).exportBranchSales(
              startDate: _start,
              endDate: _end,
              format: format,
              filters: _filtersPayload,
            );
    if (format.toLowerCase() == 'pdf') {
      await Printing.sharePdf(
        bytes: await file.readAsBytes(),
        filename: 'FG_Branch_Sales_${_start}_to_$_end.pdf',
      );
      if (mounted) _notify(context, 'Branded PDF prepared: ${file.path}');
      return;
    }
    if (mounted) _notify(context, 'CSV export saved to ${file.path}');
  }

  Map<String, dynamic> get _filtersPayload => {
        if (_paymentMethods.isNotEmpty)
          'payment_methods': _paymentMethods.toList(),
        if (_orderTypes.isNotEmpty) 'order_types': _orderTypes.toList(),
        if (_categories.isNotEmpty) 'categories': _categories.toList(),
      };

  void _setPreset(String preset) {
    final end = DateTime.now();
    final start = switch (preset) {
      'today' => DateTime(end.year, end.month, end.day),
      'week' => end.subtract(const Duration(days: 7)),
      'year' => DateTime(end.year - 1, end.month, end.day),
      _ => end.subtract(const Duration(days: 30)),
    };
    setState(() {
      _start = _date(start);
      _end = _date(end);
    });
  }
}

class _AnalyticsFilterPanel extends StatelessWidget {
  const _AnalyticsFilterPanel({
    required this.start,
    required this.end,
    required this.paymentMethods,
    required this.orderTypes,
    required this.categories,
    required this.onPreset,
    required this.onStartChanged,
    required this.onEndChanged,
    required this.onToggle,
    required this.onApply,
    required this.onReset,
  });

  final String start;
  final String end;
  final Set<String> paymentMethods;
  final Set<String> orderTypes;
  final Set<String> categories;
  final ValueChanged<String> onPreset;
  final ValueChanged<String> onStartChanged;
  final ValueChanged<String> onEndChanged;
  final void Function(String group, String value, bool checked) onToggle;
  final VoidCallback onApply;
  final VoidCallback onReset;

  static const _payments = {
    'cash': 'Cash',
    'card': 'Card',
    'mpesa': 'M-Pesa',
    'mixed': 'Mixed',
  };
  static const _orders = {
    'walk_in': 'Walk-in',
    'online': 'Online',
    'booking': 'Booking',
    'room_service': 'Room Service',
    'dine_in': 'Dine-in',
    'takeaway': 'Takeaway',
  };
  static const _categories = {
    'rooms': 'Rooms',
    'restaurant': 'Restaurant',
    'bar': 'Bar',
    'spa': 'Spa',
    'conference': 'Conference',
    'dynamic_services': 'Other Services',
  };

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: 'Filters',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton(
                  onPressed: () => onPreset('today'),
                  child: const Text('Today')),
              OutlinedButton(
                  onPressed: () => onPreset('week'),
                  child: const Text('Last 7 Days')),
              OutlinedButton(
                  onPressed: () => onPreset('month'),
                  child: const Text('Last 30 Days')),
              OutlinedButton(
                  onPressed: () => onPreset('year'),
                  child: const Text('Last Year')),
              _DateField(value: start, onChanged: onStartChanged),
              _DateField(value: end, onChanged: onEndChanged),
            ],
          ),
          const SizedBox(height: 16),
          _CheckboxGroup(
            title: 'Payment Methods',
            values: _payments,
            selected: paymentMethods,
            onChanged: (value, checked) =>
                onToggle('payment_methods', value, checked),
          ),
          _CheckboxGroup(
            title: 'Order Types',
            values: _orders,
            selected: orderTypes,
            onChanged: (value, checked) =>
                onToggle('order_types', value, checked),
          ),
          _CheckboxGroup(
            title: 'Categories',
            values: _categories,
            selected: categories,
            onChanged: (value, checked) =>
                onToggle('categories', value, checked),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            children: [
              FilledButton(
                  onPressed: onApply, child: const Text('Apply Filters')),
              OutlinedButton(onPressed: onReset, child: const Text('Reset')),
            ],
          ),
        ],
      ),
    );
  }
}

class _CheckboxGroup extends StatelessWidget {
  const _CheckboxGroup({
    required this.title,
    required this.values,
    required this.selected,
    required this.onChanged,
  });

  final String title;
  final Map<String, String> values;
  final Set<String> selected;
  final void Function(String value, bool checked) onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Wrap(
            spacing: 16,
            runSpacing: 4,
            children: values.entries
                .map((entry) => SizedBox(
                      width: 170,
                      child: CheckboxListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        value: selected.contains(entry.key),
                        onChanged: (checked) =>
                            onChanged(entry.key, checked == true),
                        title: Text(entry.value),
                        controlAffinity: ListTileControlAffinity.leading,
                      ),
                    ))
                .toList(),
          ),
        ],
      ),
    );
  }
}

class _SalesTrendChart extends StatelessWidget {
  const _SalesTrendChart({required this.data});
  final List<Map<String, dynamic>> data;

  @override
  Widget build(BuildContext context) {
    final points = data.asMap().entries.map((entry) {
      return FlSpot(
          entry.key.toDouble(), _num(entry.value['total_sales']).toDouble());
    }).toList();
    final txPoints = data.asMap().entries.map((entry) {
      return FlSpot(entry.key.toDouble(),
          _num(entry.value['transaction_count']).toDouble());
    }).toList();
    final maxSales =
        points.fold<double>(0, (max, spot) => spot.y > max ? spot.y : max);
    return _SectionCard(
      title: 'Sales Trend',
      child: SizedBox(
        height: 300,
        child: data.isEmpty
            ? const Center(
                child: Text('No sales data available for the selected period'))
            : LineChart(
                LineChartData(
                  minY: 0,
                  maxY: maxSales <= 0 ? 1 : maxSales * 1.15,
                  gridData: const FlGridData(show: true),
                  borderData: FlBorderData(show: false),
                  titlesData: FlTitlesData(
                    rightTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 48,
                        getTitlesWidget: (value, meta) => Text(
                            '${(value / 1000).toStringAsFixed(0)}K',
                            style: const TextStyle(fontSize: 10)),
                      ),
                    ),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        interval: (data.length / 5).ceilToDouble().clamp(1, 99),
                        getTitlesWidget: (value, meta) {
                          final index = value.round();
                          if (index < 0 || index >= data.length) {
                            return const SizedBox.shrink();
                          }
                          return Text(_shortDate(_text(data[index], ['date'])),
                              style: const TextStyle(fontSize: 10));
                        },
                      ),
                    ),
                  ),
                  lineBarsData: [
                    LineChartBarData(
                      spots: points,
                      isCurved: true,
                      color: const Color(0xFF10B981),
                      barWidth: 3,
                      dotData: const FlDotData(show: true),
                    ),
                    LineChartBarData(
                      spots: txPoints
                          .map((spot) => FlSpot(
                              spot.x,
                              maxSales <= 0
                                  ? spot.y
                                  : (spot.y / _maxTransactions(data)) *
                                      maxSales))
                          .toList(),
                      isCurved: true,
                      color: const Color(0xFF3B82F6),
                      barWidth: 2,
                      dotData: const FlDotData(show: true),
                    ),
                  ],
                  lineTouchData: LineTouchData(
                    touchTooltipData: LineTouchTooltipData(
                      getTooltipItems: (spots) => spots.map((spot) {
                        final index = spot.x.round().clamp(0, data.length - 1);
                        final row = data[index];
                        return LineTooltipItem(
                          '${_shortDate(_text(row, [
                                'date'
                              ]))}\nSales: ${_money(_num(row['total_sales']))}\nTransactions: ${_num(row['transaction_count']).toStringAsFixed(0)}',
                          const TextStyle(color: Colors.white, fontSize: 11),
                        );
                      }).toList(),
                    ),
                  ),
                ),
              ),
      ),
    );
  }
}

class _PaymentMethodPieChart extends StatelessWidget {
  const _PaymentMethodPieChart({required this.data});
  final List<Map<String, dynamic>> data;

  @override
  Widget build(BuildContext context) {
    final colors = {
      'cash': const Color(0xFF10B981),
      'card': const Color(0xFF3B82F6),
      'mpesa': const Color(0xFF8B5CF6),
      'mixed': const Color(0xFFF59E0B),
    };
    return _SectionCard(
      title: 'Payment Methods',
      child: SizedBox(
        height: 300,
        child: data.isEmpty
            ? const Center(child: Text('No payment data available'))
            : Column(
                children: [
                  Expanded(
                    child: PieChart(
                      PieChartData(
                        sections: data.map((item) {
                          final key = _text(item, ['payment_method']);
                          return PieChartSectionData(
                            value: _num(item['total_sales']).toDouble(),
                            color: colors[key] ?? Colors.blueGrey,
                            radius: 92,
                            title:
                                '${_num(item['percentage']).toStringAsFixed(1)}%',
                            titleStyle: const TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.w800),
                          );
                        }).toList(),
                        centerSpaceRadius: 28,
                        sectionsSpace: 2,
                      ),
                    ),
                  ),
                  Wrap(
                    spacing: 12,
                    runSpacing: 8,
                    children: data.map((item) {
                      final key = _text(item, ['payment_method']);
                      return _LegendItem(
                        color: colors[key] ?? Colors.blueGrey,
                        label:
                            '${_paymentLabel(key)} - ${_money(_num(item['total_sales']))}',
                      );
                    }).toList(),
                  ),
                ],
              ),
      ),
    );
  }
}

class _CategoryBreakdownBarChart extends StatelessWidget {
  const _CategoryBreakdownBarChart({required this.data});
  final List<Map<String, dynamic>> data;

  @override
  Widget build(BuildContext context) {
    final sorted = [
      ...data
    ]..sort((a, b) => _num(b['total_sales']).compareTo(_num(a['total_sales'])));
    final maxSales = sorted.fold<num>(
        0,
        (max, item) =>
            _num(item['total_sales']) > max ? _num(item['total_sales']) : max);
    return _SectionCard(
      title: 'Category Breakdown',
      child: sorted.isEmpty
          ? const SizedBox(
              height: 220,
              child: Center(child: Text('No category data available')),
            )
          : Column(
              children: [
                SizedBox(
                  height: 350,
                  child: BarChart(
                    BarChartData(
                      maxY: maxSales <= 0 ? 1 : maxSales.toDouble() * 1.15,
                      gridData: const FlGridData(show: true),
                      borderData: FlBorderData(show: false),
                      titlesData: FlTitlesData(
                        rightTitles: const AxisTitles(
                            sideTitles: SideTitles(showTitles: false)),
                        topTitles: const AxisTitles(
                            sideTitles: SideTitles(showTitles: false)),
                        leftTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            reservedSize: 48,
                            getTitlesWidget: (value, meta) => Text(
                                '${(value / 1000).toStringAsFixed(0)}K',
                                style: const TextStyle(fontSize: 10)),
                          ),
                        ),
                        bottomTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            getTitlesWidget: (value, meta) {
                              final index = value.round();
                              if (index < 0 || index >= sorted.length) {
                                return const SizedBox.shrink();
                              }
                              return Padding(
                                padding: const EdgeInsets.only(top: 8),
                                child: Text(
                                  _categoryLabel(
                                          _text(sorted[index], ['category']))
                                      .split(' ')
                                      .first,
                                  style: const TextStyle(fontSize: 10),
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                      barGroups: sorted.asMap().entries.map((entry) {
                        final key = _text(entry.value, ['category']);
                        return BarChartGroupData(
                          x: entry.key,
                          barRods: [
                            BarChartRodData(
                              toY: _num(entry.value['total_sales']).toDouble(),
                              color: _categoryColor(key),
                              width: 22,
                              borderRadius: const BorderRadius.vertical(
                                  top: Radius.circular(8)),
                            ),
                          ],
                        );
                      }).toList(),
                      barTouchData: BarTouchData(
                        touchTooltipData: BarTouchTooltipData(
                          getTooltipItem: (group, groupIndex, rod, rodIndex) {
                            final item = sorted[group.x];
                            return BarTooltipItem(
                              '${_categoryLabel(_text(item, [
                                    'category'
                                  ]))}\n${_money(_num(item['total_sales']))}\n${_num(item['transaction_count']).toStringAsFixed(0)} transactions\n${_num(item['percentage']).toStringAsFixed(1)}%',
                              const TextStyle(color: Colors.white),
                            );
                          },
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 16,
                  runSpacing: 8,
                  children: sorted
                      .map((item) => _LegendItem(
                            color: _categoryColor(_text(item, ['category'])),
                            label: '${_categoryLabel(_text(item, [
                                  'category'
                                ]))} ${_money(_num(item['total_sales']))}',
                          ))
                      .toList(),
                ),
              ],
            ),
    );
  }
}

class _RevenueByOutletChart extends StatelessWidget {
  const _RevenueByOutletChart({required this.data});
  final List<Map<String, dynamic>> data;

  @override
  Widget build(BuildContext context) {
    final sorted = [...data]
      ..sort((a, b) => _num(b['revenue']).compareTo(_num(a['revenue'])));
    final top = sorted.take(10).toList();
    final maxRevenue = top.fold<double>(
        0, (max, e) => _num(e['revenue']).toDouble() > max ? _num(e['revenue']).toDouble() : max);
    return _SectionCard(
      title: 'Revenue by Outlet',
      child: top.isEmpty
          ? const SizedBox(
              height: 200,
              child: Center(child: Text('No outlet revenue data available')))
          : SizedBox(
              height: 46.0 * top.length + 20,
              child: BarChart(
                BarChartData(
                  alignment: BarChartAlignment.spaceAround,
                  maxY: maxRevenue <= 0 ? 1 : maxRevenue * 1.2,
                  gridData: const FlGridData(show: true),
                  borderData: FlBorderData(show: false),
                  titlesData: FlTitlesData(
                    rightTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 90,
                        getTitlesWidget: (value, meta) {
                          final index = value.round();
                          if (index < 0 || index >= top.length) {
                            return const SizedBox.shrink();
                          }
                          return Text(
                              _text(top[index], ['label', 'key']),
                              style: const TextStyle(fontSize: 10));
                        },
                      ),
                    ),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        getTitlesWidget: (value, meta) => Text(
                            '${(value / 1000).toStringAsFixed(0)}K',
                            style: const TextStyle(fontSize: 10)),
                      ),
                    ),
                  ),
                  barGroups: top.asMap().entries.map((entry) {
                    return BarChartGroupData(
                      x: entry.key,
                      barRods: [
                        BarChartRodData(
                          toY: _num(entry.value['revenue']).toDouble(),
                          color: const Color(0xFF3B82F6),
                          width: 18,
                          borderRadius:
                              const BorderRadius.horizontal(right: Radius.circular(6)),
                        ),
                      ],
                    );
                  }).toList(),
                  barTouchData: BarTouchData(
                    touchTooltipData: BarTouchTooltipData(
                      getTooltipItem: (group, groupIndex, rod, rodIndex) {
                        final item = top[group.x];
                        return BarTooltipItem(
                          '${_text(item, [
                                'label',
                                'key'
                              ])}\n${_money(_num(item['revenue']))}',
                          const TextStyle(color: Colors.white),
                        );
                      },
                    ),
                  ),
                ),
              ),
            ),
    );
  }
}

class _DailyTransactionsBarChart extends StatelessWidget {
  const _DailyTransactionsBarChart({required this.data});
  final List<Map<String, dynamic>> data;

  @override
  Widget build(BuildContext context) {
    final maxCount = data.fold<double>(0,
        (max, e) => _num(e['transaction_count']).toDouble() > max ? _num(e['transaction_count']).toDouble() : max);
    return _SectionCard(
      title: 'Daily Transactions',
      child: SizedBox(
        height: 280,
        child: data.isEmpty
            ? const Center(child: Text('No transaction data available'))
            : BarChart(
                BarChartData(
                  maxY: maxCount <= 0 ? 1 : maxCount * 1.2,
                  gridData: const FlGridData(show: true),
                  borderData: FlBorderData(show: false),
                  titlesData: FlTitlesData(
                    rightTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 36,
                        getTitlesWidget: (value, meta) =>
                            Text('${value.toInt()}', style: const TextStyle(fontSize: 10)),
                      ),
                    ),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        interval: (data.length / 5).ceilToDouble().clamp(1, 99),
                        getTitlesWidget: (value, meta) {
                          final index = value.round();
                          if (index < 0 || index >= data.length) {
                            return const SizedBox.shrink();
                          }
                          return Text(_shortDate(_text(data[index], ['date'])),
                              style: const TextStyle(fontSize: 10));
                        },
                      ),
                    ),
                  ),
                  barGroups: data.asMap().entries.map((entry) {
                    return BarChartGroupData(
                      x: entry.key,
                      barRods: [
                        BarChartRodData(
                          toY: _num(entry.value['transaction_count']).toDouble(),
                          color: const Color(0xFF6366F1),
                          width: 10,
                          borderRadius:
                              const BorderRadius.vertical(top: Radius.circular(4)),
                        ),
                      ],
                    );
                  }).toList(),
                ),
              ),
      ),
    );
  }
}

class _TopSellingItemsChart extends StatelessWidget {
  const _TopSellingItemsChart({required this.data});
  final List<Map<String, dynamic>> data;

  @override
  Widget build(BuildContext context) {
    final maxQty = data.fold<double>(0,
        (max, e) => _num(e['quantity']).toDouble() > max ? _num(e['quantity']).toDouble() : max);
    return _SectionCard(
      title: 'Top 10 Selling Items',
      child: data.isEmpty
          ? const SizedBox(
              height: 200, child: Center(child: Text('No item sales data available')))
          : SizedBox(
              height: 46.0 * data.length + 20,
              child: BarChart(
                BarChartData(
                  alignment: BarChartAlignment.spaceAround,
                  maxY: maxQty <= 0 ? 1 : maxQty * 1.2,
                  gridData: const FlGridData(show: true),
                  borderData: FlBorderData(show: false),
                  titlesData: FlTitlesData(
                    rightTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 110,
                        getTitlesWidget: (value, meta) {
                          final index = value.round();
                          if (index < 0 || index >= data.length) {
                            return const SizedBox.shrink();
                          }
                          return Text(_text(data[index], ['name']),
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 10));
                        },
                      ),
                    ),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(showTitles: true),
                    ),
                  ),
                  barGroups: data.asMap().entries.map((entry) {
                    return BarChartGroupData(
                      x: entry.key,
                      barRods: [
                        BarChartRodData(
                          toY: _num(entry.value['quantity']).toDouble(),
                          color: const Color(0xFF10B981),
                          width: 18,
                          borderRadius:
                              const BorderRadius.horizontal(right: Radius.circular(6)),
                        ),
                      ],
                    );
                  }).toList(),
                  barTouchData: BarTouchData(
                    touchTooltipData: BarTouchTooltipData(
                      getTooltipItem: (group, groupIndex, rod, rodIndex) {
                        final item = data[group.x];
                        return BarTooltipItem(
                          '${_text(item, [
                                'name'
                              ])}\n${_num(item['quantity']).toStringAsFixed(0)} units\n${_money(_num(item['revenue']))}',
                          const TextStyle(color: Colors.white),
                        );
                      },
                    ),
                  ),
                ),
              ),
            ),
    );
  }
}

/// Buckets raw transactions by hour-of-day (0-23) from `transaction_date`.
class _HourlySalesBarChart extends StatelessWidget {
  const _HourlySalesBarChart({required this.transactions});
  final List<Map<String, dynamic>> transactions;

  @override
  Widget build(BuildContext context) {
    final hourly = List<double>.filled(24, 0);
    for (final t in transactions) {
      final raw = _text(t, ['transaction_date', 'created_at']);
      final parsed = DateTime.tryParse(raw);
      if (parsed == null) continue;
      hourly[parsed.hour] += _num(t['total_amount']).toDouble();
    }
    final maxVal = hourly.fold<double>(0, (max, v) => v > max ? v : max);
    return _SectionCard(
      title: 'Hourly Sales',
      child: SizedBox(
        height: 260,
        child: maxVal <= 0
            ? const Center(child: Text('No hourly sales data available'))
            : BarChart(
                BarChartData(
                  maxY: maxVal * 1.2,
                  gridData: const FlGridData(show: true),
                  borderData: FlBorderData(show: false),
                  titlesData: FlTitlesData(
                    rightTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 44,
                        getTitlesWidget: (value, meta) => Text(
                            '${(value / 1000).toStringAsFixed(0)}K',
                            style: const TextStyle(fontSize: 10)),
                      ),
                    ),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        interval: 3,
                        getTitlesWidget: (value, meta) =>
                            Text('${value.toInt()}h', style: const TextStyle(fontSize: 10)),
                      ),
                    ),
                  ),
                  barGroups: hourly.asMap().entries.map((entry) {
                    return BarChartGroupData(
                      x: entry.key,
                      barRods: [
                        BarChartRodData(
                          toY: entry.value,
                          color: const Color(0xFFF59E0B),
                          width: 8,
                        ),
                      ],
                    );
                  }).toList(),
                ),
              ),
      ),
    );
  }
}

/// Aggregates credit/credit_bill transactions by date for a daily trend line.
class _CreditBillsTrendChart extends StatelessWidget {
  const _CreditBillsTrendChart({required this.transactions});
  final List<Map<String, dynamic>> transactions;

  @override
  Widget build(BuildContext context) {
    final byDate = <String, double>{};
    for (final t in transactions) {
      final method = _text(t, ['payment_method']).toLowerCase();
      if (!method.contains('credit')) continue;
      final raw = _text(t, ['transaction_date', 'created_at']);
      final date = raw.length >= 10 ? raw.substring(0, 10) : raw;
      if (date.isEmpty) continue;
      byDate[date] = (byDate[date] ?? 0) + _num(t['total_amount']).toDouble();
    }
    final dates = byDate.keys.toList()..sort();
    final spots = dates.asMap().entries.map((entry) {
      return FlSpot(entry.key.toDouble(), byDate[entry.value] ?? 0);
    }).toList();
    final maxVal = spots.fold<double>(0, (max, s) => s.y > max ? s.y : max);
    return _SectionCard(
      title: 'Credit Bills Trend',
      child: SizedBox(
        height: 260,
        child: dates.isEmpty
            ? const Center(child: Text('No credit bills recorded for this period'))
            : LineChart(
                LineChartData(
                  minY: 0,
                  maxY: maxVal <= 0 ? 1 : maxVal * 1.2,
                  gridData: const FlGridData(show: true),
                  borderData: FlBorderData(show: false),
                  titlesData: FlTitlesData(
                    rightTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 48,
                        getTitlesWidget: (value, meta) => Text(
                            '${(value / 1000).toStringAsFixed(0)}K',
                            style: const TextStyle(fontSize: 10)),
                      ),
                    ),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        interval: (dates.length / 5).ceilToDouble().clamp(1, 99),
                        getTitlesWidget: (value, meta) {
                          final index = value.round();
                          if (index < 0 || index >= dates.length) {
                            return const SizedBox.shrink();
                          }
                          return Text(_shortDate(dates[index]),
                              style: const TextStyle(fontSize: 10));
                        },
                      ),
                    ),
                  ),
                  lineBarsData: [
                    LineChartBarData(
                      spots: spots,
                      isCurved: true,
                      color: const Color(0xFFDC2626),
                      barWidth: 3,
                      dotData: const FlDotData(show: true),
                    ),
                  ],
                  lineTouchData: LineTouchData(
                    touchTooltipData: LineTouchTooltipData(
                      getTooltipItems: (spots) => spots.map((spot) {
                        final index = spot.x.round().clamp(0, dates.length - 1);
                        return LineTooltipItem(
                          '${_shortDate(dates[index])}\n${_money(spot.y)}',
                          const TextStyle(color: Colors.white, fontSize: 11),
                        );
                      }).toList(),
                    ),
                  ),
                ),
              ),
      ),
    );
  }
}

class _LegendItem extends StatelessWidget {
  const _LegendItem({required this.color, required this.label});
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    );
  }
}

class _AnalyticsTransactionTable extends StatefulWidget {
  const _AnalyticsTransactionTable({required this.transactions});
  final List<Map<String, dynamic>> transactions;

  @override
  State<_AnalyticsTransactionTable> createState() =>
      _AnalyticsTransactionTableState();
}

class _AnalyticsTransactionTableState
    extends State<_AnalyticsTransactionTable> {
  int _page = 1;
  static const _perPage = 10;

  @override
  Widget build(BuildContext context) {
    final totalPages =
        (widget.transactions.length / _perPage).ceil().clamp(1, 999);
    final start = (_page - 1) * _perPage;
    final current =
        widget.transactions.skip(start).take(_perPage).toList(growable: false);
    return _SectionCard(
      title: 'Recent Transactions',
      child: Column(
        children: [
          _SimpleTable(
            columns: const [
              'Date',
              'Category',
              'Payment Method',
              'Order Type',
              'Amount',
              'Status',
              'Source'
            ],
            rows: current
                .map((item) => [
                      _shortDate(_text(
                          item, ['transaction_date', 'date', 'created_at'])),
                      _categoryLabel(_text(item, ['category'])),
                      _paymentLabel(_text(item, ['payment_method', 'method'])),
                      _title(_text(item, ['order_type']).isEmpty
                          ? '-'
                          : _text(item, ['order_type'])),
                      _money(_num(item['total_amount'] ??
                          item['amount'] ??
                          item['total'])),
                      _StatusPill(_text(item, ['status'])),
                      _title(_text(item, ['source'])),
                    ])
                .toList(),
          ),
          if (widget.transactions.length > _perPage) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Showing ${start + 1} to ${(start + current.length).clamp(0, widget.transactions.length)} of ${widget.transactions.length} transactions',
                    style: const TextStyle(color: AppColors.kTextSecondary),
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: _page == 1 ? null : () => setState(() => _page--),
                  icon: const Icon(Icons.chevron_left),
                  label: const Text('Previous'),
                ),
                const SizedBox(width: 8),
                Text('$_page / $totalPages'),
                const SizedBox(width: 8),
                OutlinedButton.icon(
                  onPressed: _page >= totalPages
                      ? null
                      : () => setState(() => _page++),
                  icon: const Icon(Icons.chevron_right),
                  label: const Text('Next'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _DiscrepanciesSection extends ConsumerStatefulWidget {
  const _DiscrepanciesSection();

  @override
  ConsumerState<_DiscrepanciesSection> createState() =>
      _DiscrepanciesSectionState();
}

class _DiscrepanciesSectionState extends ConsumerState<_DiscrepanciesSection> {
  late Future<List<Map<String, dynamic>>> _future =
      ref.read(branchAccountantRepositoryProvider).getDiscrepancies();

  void _refresh() {
    final nextFuture =
        ref.read(branchAccountantRepositoryProvider).getDiscrepancies();
    setState(() {
      _future = nextFuture;
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (items) => _Page(
          title: 'Discrepancies',
          subtitle:
              'Director and auditor flags requiring branch accountant responses.',
          actions: [_RefreshButton(onPressed: _refresh)],
          children: [
            _ResponsiveGrid(children: [
              _MetricCard(
                  'Pending',
                  '${items.where((e) {
                    final s = _text(e, ['status']).toLowerCase();
                    return s == 'pending' || s == 'open' || s == 'flagged';
                  }).length}',
                  Icons.hourglass_top,
                  Colors.orange),
              _MetricCard(
                  'Under Review',
                  '${items.where((e) {
                    final s = _text(e, ['status']).toLowerCase();
                    return s == 'under_review' || s == 'in_review';
                  }).length}',
                  Icons.manage_search,
                  Colors.blue),
              _MetricCard(
                  'Resolved',
                  '${items.where((e) {
                    final s = _text(e, ['status']).toLowerCase();
                    return s == 'resolved' || s == 'closed' || s == 'approved';
                  }).length}',
                  Icons.check_circle,
                  Colors.green),
            ]),
            if (items.isEmpty)
              _SectionCard(
                title: 'No Discrepancies',
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Row(children: [
                    Icon(Icons.check_circle_outline, color: Colors.green.shade400, size: 32),
                    const SizedBox(width: 12),
                    const Text('No flags from auditor or director require your attention.'),
                  ]),
                ),
              ),
            ...items.map((item) {
              final status = _text(item, ['status']).toLowerCase();
              final isPending = status == 'pending' || status == 'open' || status == 'flagged';
              final isUnderReview = status == 'under_review' || status == 'in_review';
              return _ActionCard(
                  title: _text(item, ['flag_type', 'type', 'title', 'subject']),
                  subtitle: _text(item, ['description', 'message', 'notes']),
                  trailing: _StatusPill(_text(item, ['status'])),
                  rows: {
                    'Severity': _text(item, ['severity', 'priority']),
                    'Flagged By': _text(item, ['flagged_by_name', 'raised_by', 'created_by']),
                    'Record Date': _text(item, ['record_date', 'flag_date', 'created_at']),
                    'Accountant Response': _text(item, ['accountant_response', 'response']),
                    'Director Decision': _text(item, ['director_final_decision', 'resolution']),
                  },
                  actions: [
                    OutlinedButton.icon(
                      onPressed: () => _showRecord(context, item),
                      icon: const Icon(Icons.visibility, size: 16),
                      label: const Text('View Details'),
                    ),
                    if (isPending)
                      FilledButton.icon(
                        onPressed: () => _respond(item),
                        icon: const Icon(Icons.reply, size: 16),
                        label: const Text('Respond'),
                      ),
                    if (isUnderReview && _text(item, ['accountant_response', 'response']).isNotEmpty)
                      OutlinedButton.icon(
                        onPressed: () => _respond(item),
                        icon: const Icon(Icons.edit_note, size: 16),
                        label: const Text('Update Response'),
                      ),
                  ],
              );
            }),
          ],
        ),
      ),
    );
  }

  Future<void> _respond(Map<String, dynamic> item) async {
    final response = await _textDialog(context, 'Respond to Flag',
        hint: 'Explain investigation, correction, or planned action',
        minLines: 5);
    if (response == null || response.trim().isEmpty) return;
    try {
      await ref
          .read(branchAccountantRepositoryProvider)
          .respondDiscrepancy('${item['id']}', response.trim());
      if (mounted) _notify(context, 'Response submitted successfully');
      _refresh();
    } catch (e) {
      if (mounted) {
        _notify(context,
            'Failed to submit response: ${e is DioException ? (e.response?.data is Map ? (e.response?.data['message'] ?? e.message) : e.message) : e}');
      }
    }
  }
}

class _ProfitLossSection extends ConsumerStatefulWidget {
  const _ProfitLossSection();

  @override
  ConsumerState<_ProfitLossSection> createState() => _ProfitLossSectionState();
}

class _ProfitLossSectionState extends ConsumerState<_ProfitLossSection> {
  late String _from =
      _date(DateTime(DateTime.now().year, DateTime.now().month));
  late String _to = _today();
  late Future<List<Map<String, dynamic>>> _future = _load();
  bool _exporting = false;

  // [0] = get_branch_profit_loss() RPC (system/verified revenue, expense
  // categories, COGS, bar stock variance). [1] = per-POS-outlet breakdown,
  // sourced from cashier transactions + sold items, used only for the
  // collapsible "P&L by POS Outlet" section and the unchanged PDF export.
  Future<List<Map<String, dynamic>>> _load() {
    final repo = ref.read(branchAccountantRepositoryProvider);
    return Future.wait([
      repo.getBranchProfitLoss(startDate: _from, endDate: _to),
      repo.getPosProfitLoss(fromDate: _from, toDate: _to),
    ]);
  }

  void _refresh() => setState(() {
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (results) {
          final pl = results[0];
          final posOutletData = results[1];
          final outlets = _list(posOutletData['outlets']);
          final byMethod = _map(pl['system_revenue_by_method']);
          final expenses = _map(pl['expenses_by_category']);
          final systemRevenue = _num(pl['system_revenue']);
          final verifiedRevenue = _num(pl['verified_revenue']);
          final revenueVariance = _num(pl['revenue_variance']);
          final totalExpenses = expenses.values
              .fold<num>(0, (sum, v) => sum + _num(v));

          return _Page(
            title: 'Profit & Loss Statement',
            subtitle:
                'System vs verified revenue, expense categories, COGS, and net margin.',
            actions: [
              _DateField(
                  value: _from, onChanged: (v) => setState(() => _from = v)),
              _DateField(value: _to, onChanged: (v) => setState(() => _to = v)),
              _RefreshButton(onPressed: _refresh),
              OutlinedButton.icon(
                onPressed: _exporting ? null : _exportBranded,
                icon: _exporting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.picture_as_pdf),
                label: Text(_exporting ? 'Generating…' : 'Export Branded PDF'),
              ),
            ],
            children: [
              PaymentMethodBreakdownWidget(
                title: 'Revenue by Payment Method',
                mpesa: _num(byMethod['mpesa']),
                cash: _num(byMethod['cash']),
                card: _num(byMethod['card']),
                credit: _num(byMethod['credit']),
              ),
              const SizedBox(height: 12),
              _ResponsiveGrid(children: [
                _MetricCard('System Revenue', _money(systemRevenue),
                    Icons.payments, Colors.teal),
                _MetricCard('Verified Revenue', _money(verifiedRevenue),
                    Icons.verified, Colors.indigo),
                _MetricCard(
                    'Variance',
                    _money(revenueVariance),
                    Icons.compare_arrows,
                    revenueVariance >= 0 ? Colors.green : Colors.red),
                _MetricCard('Cost of Goods', _money(_num(pl['cogs'])),
                    Icons.inventory_2, Colors.orange),
                _MetricCard('Gross Profit', _money(_num(pl['gross_profit'])),
                    Icons.trending_up, Colors.green),
                _MetricCard(
                    'Net Profit',
                    _money(_num(pl['net_profit'])),
                    Icons.wallet,
                    _num(pl['net_profit']) >= 0 ? Colors.green : Colors.red),
                _MetricCard(
                    'Net Margin',
                    '${_num(pl['net_margin']).toStringAsFixed(1)}%',
                    Icons.percent,
                    Colors.purple),
              ]),
              _SectionCard(
                title: 'Expenses Breakdown',
                child: _KeyValueList({
                  'Daily Purchases': _money(_num(expenses['daily_purchase'])),
                  'Petty Cash': _money(_num(expenses['petty_cash'])),
                  'Transaction Costs':
                      _money(_num(expenses['transaction_cost'])),
                  'Operational': _money(_num(expenses['operational'])),
                  if (_num(expenses['bar_stock_variance']) != 0)
                    'Bar Stock Variance':
                        _money(_num(expenses['bar_stock_variance'])),
                  'Total': _money(totalExpenses),
                }),
              ),
              _CollapsibleSectionCard(
                title: 'P&L by POS Outlet',
                initiallyExpanded: false,
                child: outlets.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.all(12),
                        child: Text(
                            'No POS outlet sales recorded for this period.'),
                      )
                    : _SimpleTable(
                        columns: const [
                          'POS Outlet',
                          'Revenue',
                          'COGS',
                          'Gross Profit',
                          'Margin',
                          'Units'
                        ],
                        rows: [
                          ...outlets.map((o) => [
                                _text(o, ['name']),
                                _money(_num(o['revenue'])),
                                _money(_num(o['cogs'])),
                                _money(_num(o['gross_profit'])),
                                '${_num(o['margin']).toStringAsFixed(1)}%',
                                '${_num(o['units']).toInt()}',
                              ]),
                          [
                            'TOTAL',
                            _money(_num(posOutletData['revenue'])),
                            _money(_num(posOutletData['costOfGoods'])),
                            _money(_num(posOutletData['grossProfit'])),
                            '${_num(posOutletData['grossMargin']).toStringAsFixed(1)}%',
                            '',
                          ],
                        ],
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _exportBranded() async {
    setState(() => _exporting = true);
    try {
      final file = await ref
          .read(branchAccountantRepositoryProvider)
          .exportPosProfitLossPdf(fromDate: _from, toDate: _to);
      final bytes = await file.readAsBytes();
      await Printing.sharePdf(
        bytes: bytes,
        filename: 'FG_Profit_Loss_${_from}_$_to.pdf',
      );
    } catch (e) {
      if (mounted) _notify(context, 'Export failed: $e');
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }
}

class _RevenueOversightSection extends ConsumerStatefulWidget {
  const _RevenueOversightSection();

  @override
  ConsumerState<_RevenueOversightSection> createState() =>
      _RevenueOversightSectionState();
}

class _RevenueOversightSectionState
    extends ConsumerState<_RevenueOversightSection> {
  int _period = 30;
  bool _isCustom = false;
  String _customFrom = _date(DateTime.now().subtract(const Duration(days: 30)));
  String _customTo = _today();
  late Future<List<Map<String, dynamic>>> _future = _load();

  String get _effectiveFrom => _isCustom
      ? _customFrom
      : _date(DateTime.now().subtract(Duration(days: _period)));
  String get _effectiveTo => _isCustom ? _customTo : _today();

  Future<List<Map<String, dynamic>>> _load() {
    final repo = ref.read(branchAccountantRepositoryProvider);
    return Future.wait([
      repo.getRevenueOversight(
          startDate: _effectiveFrom, endDate: _effectiveTo),
      repo.getBranchProfitLoss(
          startDate: _effectiveFrom, endDate: _effectiveTo),
    ]);
  }

  void _refresh() => setState(() {
        _future = _load();
      });

  void _selectQuickRange(int days) {
    setState(() {
      _isCustom = false;
      _period = days;
      _future = _load();
    });
  }

  void _selectCustom() {
    setState(() {
      _isCustom = true;
      _future = _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (results) {
          final data = results[0];
          final pl = results[1];
          final summary = _map(data['summary']);
          final categories = _list(data['category_breakdown']);
          final trend = _list(data['daily_trend']);
          final byMethod = _map(pl['system_revenue_by_method']);
          return _Page(
            title: 'Revenue Oversight',
            subtitle:
                'Targets, achievement, category performance, and daily trend.',
            actions: [
              _RefreshButton(onPressed: _refresh),
            ],
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  ChoiceChip(
                    label: const Text('Last 7 Days'),
                    selected: !_isCustom && _period == 7,
                    onSelected: (_) => _selectQuickRange(7),
                  ),
                  ChoiceChip(
                    label: const Text('Last 30 Days'),
                    selected: !_isCustom && _period == 30,
                    onSelected: (_) => _selectQuickRange(30),
                  ),
                  ChoiceChip(
                    label: const Text('Last 90 Days'),
                    selected: !_isCustom && _period == 90,
                    onSelected: (_) => _selectQuickRange(90),
                  ),
                  ChoiceChip(
                    label: const Text('Custom'),
                    selected: _isCustom,
                    onSelected: (_) => _selectCustom(),
                  ),
                ],
              ),
              if (_isCustom) ...[
                const SizedBox(height: 10),
                Wrap(
                  spacing: 12,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    _DateField(
                      value: _customFrom,
                      onChanged: (v) => setState(() => _customFrom = v),
                    ),
                    _DateField(
                      value: _customTo,
                      onChanged: (v) => setState(() => _customTo = v),
                    ),
                    _RefreshButton(onPressed: _refresh),
                  ],
                ),
              ],
              const SizedBox(height: 12),
              if (byMethod.isNotEmpty)
                PaymentMethodBreakdownWidget(
                  title: 'Payment Method Breakdown',
                  mpesa: _num(byMethod['mpesa']),
                  cash: _num(byMethod['cash']),
                  card: _num(byMethod['card']),
                  credit: _num(byMethod['credit']),
                ),
              const SizedBox(height: 12),
              _ResponsiveGrid(children: [
                _MetricCard(
                    'Total Revenue',
                    _money(_num(summary['total_revenue'])),
                    Icons.payments,
                    Colors.green),
                _MetricCard('Target', _money(_num(summary['target_revenue'])),
                    Icons.track_changes, Colors.blue),
                _MetricCard(
                    'Variance',
                    _money(_num(summary['variance'])),
                    Icons.compare_arrows,
                    _num(summary['variance']) >= 0 ? Colors.green : Colors.red),
                _MetricCard(
                    'Achievement',
                    '${_num(summary['achievement_rate']).toStringAsFixed(1)}%',
                    Icons.emoji_events,
                    Colors.purple),
                _MetricCard(
                    'Growth',
                    '${_num(summary['growth_rate']).toStringAsFixed(1)}%',
                    Icons.show_chart,
                    Colors.teal),
                _MetricCard(
                    'Days Tracked',
                    '${_num(summary['days_count'] ?? summary['period_days'] ?? _period)}',
                    Icons.calendar_month,
                    Colors.indigo),
              ]),
              _AchievementBar(
                achievement: _num(summary['achievement_rate']).toDouble(),
                categories: categories,
              ),
              _SectionCard(
                title: 'Daily Revenue Trend',
                child: _SimpleTable(
                  columns: const [
                    'Date',
                    'Rooms',
                    'Restaurant',
                    'Bar',
                    'Conference',
                    'Total'
                  ],
                  rows: trend
                      .take(20)
                      .map((e) => [
                            _text(e, ['date']),
                            _money(_num(e['rooms'])),
                            _money(_num(e['restaurant'])),
                            _money(_num(e['bar'])),
                            _money(_num(e['conference'])),
                            _money(_num(e['total'])),
                          ])
                      .toList(),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _SoldItemsSection extends ConsumerStatefulWidget {
  const _SoldItemsSection();

  @override
  ConsumerState<_SoldItemsSection> createState() => _SoldItemsSectionState();
}

class _SoldItemsSectionState extends ConsumerState<_SoldItemsSection> {
  late String _from = _date(DateTime.now().subtract(const Duration(days: 30)));
  late String _to = _today();
  String _period = 'last_30_days';
  String _search = '';
  String _outletGroup = 'all';
  String _movementMetric = 'quantity';
  int _topLimit = 10;
  bool _downloading = false;
  late Future<Map<String, dynamic>> _future = _load();
  Future<Map<String, dynamic>> _load() => ref
      .read(branchAccountantRepositoryProvider)
      .getSoldItems(startDate: _from, endDate: _to);
  void _refresh() => setState(() {
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (data) {
          final payload =
              _map(data['data']).isNotEmpty ? _map(data['data']) : data;
          final summary = _map(payload['summary']);
          final outletBreakdown = _list(summary['outlet_breakdown']);
          final dailyRevenue = _list(summary['daily_revenue']);
          final kds = _map(summary['kds_intelligence']);
          final allItems = _list(payload['analysis']);
          final cashierClearance = _map(payload['cashier_clearance']);
          final cashierShifts = _list(cashierClearance['shifts']);
          final cashierSummary = _map(cashierClearance['summary']);
          final items = allItems.where((item) {
            final q = _search.toLowerCase();
            final matchesSearch = q.isEmpty ||
                _text(item, ['name', 'item_name']).toLowerCase().contains(q) ||
                _text(item, ['item_id', 'sku']).toLowerCase().contains(q);
            final group = _text(item, ['outlet_group']);
            final matchesGroup = _outletGroup == 'all' || group == _outletGroup;
            return matchesSearch && matchesGroup;
          }).toList();
          final filteredOutletBreakdown =
              _outletBreakdownFromItems(items, outletBreakdown);
          final filteredDailyRevenue = _dailyRevenueFromItems(items);
          final chartDailyRevenue = filteredDailyRevenue.isNotEmpty ||
                  _search.isNotEmpty ||
                  _outletGroup != 'all'
              ? filteredDailyRevenue
              : dailyRevenue;
          final categoryBreakdown = _categoryBreakdown(items);
          final fastMoving = _rankedItems(items, metric: _movementMetric)
              .take(_topLimit)
              .toList();
          final slowMoving = _slowMovingItems(items).take(_topLimit).toList();
          final mostProfitable = [...items]..sort((a, b) =>
              _num(b['gross_profit']).compareTo(_num(a['gross_profit'])));
          final leastProfitable = [...items]..sort((a, b) =>
              _num(a['gross_profit']).compareTo(_num(b['gross_profit'])));
          final highestMargin = [...items]..sort((a, b) =>
              _num(b['profit_margin']).compareTo(_num(a['profit_margin'])));
          final lowestMargin = [...items]..sort((a, b) =>
              _num(a['profit_margin']).compareTo(_num(b['profit_margin'])));
          final filteredSummary = _soldItemsFilteredSummary(items);
          final bestOutlet =
              _bestOutlet(filteredOutletBreakdown, highest: true);
          final lowestOutlet =
              _bestOutlet(filteredOutletBreakdown, highest: false);
          final outletLabels = _outletLabels(outletBreakdown);
          final outletValues = outletLabels.keys.toList();
          final selectedOutlet =
              outletValues.contains(_outletGroup) ? _outletGroup : 'all';
          return _Page(
            title: 'Sold Items Analytics',
            subtitle:
                'Restaurant, bar, rooms, and non-consumables revenue, COGS, gross profit, movement velocity, and KDS timing.',
            actions: [
              _SoldItemsDropdown(
                value: _period,
                values: const [
                  'today',
                  'yesterday',
                  'last_7_days',
                  'this_week',
                  'last_week',
                  'this_month',
                  'last_month',
                  'this_quarter',
                  'this_year',
                  'last_30_days',
                  'custom',
                ],
                labels: const {
                  'today': 'Today',
                  'yesterday': 'Yesterday',
                  'last_7_days': 'Last 7 Days',
                  'this_week': 'This Week',
                  'last_week': 'Last Week',
                  'this_month': 'This Month',
                  'last_month': 'Last Month',
                  'this_quarter': 'This Quarter',
                  'this_year': 'This Year',
                  'last_30_days': 'Last 30 Days',
                  'custom': 'Custom Range',
                },
                onChanged: _applyPeriod,
              ),
              _SoldItemsDatePicker(
                value: _from,
                tooltip: 'Start date',
                onChanged: (v) => setState(() {
                  _period = 'custom';
                  _from = v;
                  _future = _load();
                }),
              ),
              _SoldItemsDatePicker(
                value: _to,
                tooltip: 'End date',
                onChanged: (v) => setState(() {
                  _period = 'custom';
                  _to = v;
                  _future = _load();
                }),
              ),
              _SoldItemsDropdown(
                value: selectedOutlet,
                values: outletValues,
                labels: outletLabels,
                onChanged: (v) => setState(() => _outletGroup = v),
              ),
              _SoldItemsDropdown(
                value: _movementMetric,
                values: const ['quantity', 'revenue', 'gross_profit'],
                labels: const {
                  'quantity': 'Rank by Qty',
                  'revenue': 'Rank by Revenue',
                  'gross_profit': 'Rank by Profit',
                },
                onChanged: (v) => setState(() => _movementMetric = v),
              ),
              _SoldItemsDropdown(
                value: '$_topLimit',
                values: const ['10', '20', '50'],
                labels: const {'10': 'Top 10', '20': 'Top 20', '50': 'Top 50'},
                onChanged: (v) => setState(() => _topLimit = int.parse(v)),
              ),
              SizedBox(
                width: 220,
                child: TextField(
                  decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search), hintText: 'Name or SKU'),
                  onChanged: (v) => setState(() => _search = v),
                ),
              ),
              _RefreshButton(onPressed: _refresh),
              OutlinedButton.icon(
                onPressed: _downloading ? null : _downloadBackendReport,
                icon: const Icon(Icons.download),
                label: Text(_downloading ? 'Preparing PDF' : 'Export PDF'),
              ),
              OutlinedButton.icon(
                onPressed: items.isEmpty ? null : () => _downloadCsv(items),
                icon: const Icon(Icons.table_view),
                label: const Text('Export CSV'),
              ),
            ],
            children: [
              _ResponsiveGrid(children: [
                _MetricCard(
                    'Gross Revenue',
                    _money(_num(filteredSummary['gross_revenue'])),
                    Icons.trending_up,
                    Colors.green),
                _MetricCard(
                    'Net Revenue',
                    _money(_num(filteredSummary['net_revenue'])),
                    Icons.payments,
                    Colors.teal),
                _MetricCard(
                    'Units Sold',
                    '${filteredSummary['total_quantity_sold'] ?? 0}',
                    Icons.inventory,
                    Colors.blue),
                _MetricCard(
                    'Transactions',
                    '${filteredSummary['total_transactions'] ?? 0}',
                    Icons.receipt_long,
                    Colors.indigo),
                _MetricCard('COGS', _money(_num(filteredSummary['total_cogs'])),
                    Icons.receipt_long, Colors.orange),
                _MetricCard(
                    'Gross Profit',
                    _money(_num(filteredSummary['gross_profit'])),
                    Icons.account_balance_wallet,
                    Colors.teal),
                _MetricCard(
                    'Profit Margin',
                    '${_num(filteredSummary['profit_margin']).toStringAsFixed(1)}%',
                    Icons.percent,
                    Colors.indigo),
                _MetricCard(
                    'Average Item Value',
                    _money(_num(filteredSummary['average_order_value'])),
                    Icons.analytics,
                    Colors.blueGrey),
                _MetricCard(
                    'Best Outlet',
                    _text(bestOutlet, ['label']).isEmpty
                        ? 'N/A'
                        : _text(bestOutlet, ['label']),
                    Icons.emoji_events,
                    Colors.green),
                _MetricCard(
                    'Lowest Outlet',
                    _text(lowestOutlet, ['label']).isEmpty
                        ? 'N/A'
                        : _text(lowestOutlet, ['label']),
                    Icons.trending_down,
                    Colors.red),
                _MetricCard(
                    'Fast / Slow',
                    '${filteredSummary['fast_moving_count'] ?? 0} / ${filteredSummary['slow_moving_count'] ?? 0}',
                    Icons.speed,
                    Colors.purple),
              ]),
              _SectionCard(
                title: 'Outlet Revenue Breakdown',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _outletFilters(filteredOutletBreakdown),
                    const SizedBox(height: 16),
                    _ResponsiveGrid(
                      children: filteredOutletBreakdown
                          .map((row) => _OutletSummaryTile(row: row))
                          .toList(),
                    ),
                  ],
                ),
              ),
              _SectionCard(
                title: 'Revenue, Profit & Mix Analysis',
                child: _SoldItemsCharts(
                  outletBreakdown: filteredOutletBreakdown,
                  dailyRevenue: chartDailyRevenue,
                ),
              ),
              _SectionCard(
                title: 'Product Mix & Category Contribution',
                child: _categoryMixTable(categoryBreakdown),
              ),
              _SectionCard(
                title: 'Profitability Analysis',
                child: _profitabilityTables(
                  mostProfitable: mostProfitable.take(_topLimit).toList(),
                  leastProfitable: leastProfitable.take(_topLimit).toList(),
                  highestMargin: highestMargin.take(_topLimit).toList(),
                  lowestMargin: lowestMargin.take(_topLimit).toList(),
                ),
              ),
              _SectionCard(
                title: 'Fast Moving Items',
                child: _movementTable(
                  fastMoving,
                  totalRevenue: _num(filteredSummary['net_revenue']),
                  empty: 'No fast movers found.',
                  includeRecommendation: false,
                ),
              ),
              _SectionCard(
                title: 'Slow Moving Items',
                child: _movementTable(slowMoving,
                    totalRevenue: _num(filteredSummary['net_revenue']),
                    empty: 'No slow moving items found.',
                    includeRecommendation: true),
              ),
              _SectionCard(
                title: 'KDS Order Intelligence',
                child: _kdsTable(_kdsFromItems(items, kds)),
              ),
              _SectionCard(
                title: 'Cashier Payment Clearance',
                child: _cashierClearanceSection(cashierShifts, cashierSummary),
              ),
              _SectionCard(
                title: 'Detailed Sold Items Ledger',
                child: _soldItemsTable(items),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _cashierClearanceSection(
    List<Map<String, dynamic>> shifts,
    Map<String, dynamic> summary,
  ) {
    if (shifts.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Row(
          children: [
            Icon(Icons.info_outline, color: Colors.grey.shade400, size: 18),
            const SizedBox(width: 8),
            Text('No cashier shifts found for this period.',
                style: TextStyle(color: Colors.grey.shade500)),
          ],
        ),
      );
    }

    final totalExpected = _num(summary['total_expected']);
    final totalActual = _num(summary['total_actual']);
    final totalVariance = _num(summary['total_variance']);
    final totalShifts = _num(summary['total_shifts']).toInt();
    final pending = _num(summary['pending']).toInt();
    final approved = _num(summary['approved']).toInt();
    final withDiscrepancy = _num(summary['with_discrepancy']).toInt();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Summary stats row
        _ResponsiveGrid(children: [
          _MetricCard('Expected Cash', _money(totalExpected), Icons.point_of_sale, Colors.indigo),
          _MetricCard('Actual Cash', _money(totalActual), Icons.payments, Colors.teal),
          _MetricCard(
            'Total Variance',
            '${totalVariance >= 0 ? '+' : ''}${_money(totalVariance)}',
            totalVariance >= 0 ? Icons.trending_up : Icons.trending_down,
            totalVariance == 0 ? Colors.green : totalVariance > 0 ? Colors.orange : Colors.red,
          ),
          _MetricCard('Shifts', '$totalShifts', Icons.access_time, Colors.blue),
          _MetricCard('Pending', '$pending', Icons.hourglass_empty, Colors.orange),
          _MetricCard('Approved', '$approved', Icons.verified, Colors.green),
          _MetricCard('With Discrepancy', '$withDiscrepancy', Icons.warning_amber, Colors.red),
        ]),
        const SizedBox(height: 16),

        // Cross-check banner
        Builder(builder: (_) {
          final salesRevenue = totalExpected;
          final collected = totalActual;
          final gap = collected - salesRevenue;
          final gapAbs = gap.abs();
          if (salesRevenue == 0) return const SizedBox.shrink();
          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: gapAbs < 100 ? Colors.green.shade50 : Colors.red.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: gapAbs < 100 ? Colors.green.shade200 : Colors.red.shade200),
            ),
            child: Row(
              children: [
                Icon(gapAbs < 100 ? Icons.check_circle : Icons.warning,
                    color: gapAbs < 100 ? Colors.green.shade700 : Colors.red.shade700, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: RichText(
                    text: TextSpan(
                      style: TextStyle(fontSize: 13, color: gapAbs < 100 ? Colors.green.shade800 : Colors.red.shade800),
                      children: [
                        TextSpan(
                          text: gapAbs < 100
                              ? 'Cash collection reconciles with POS sales.  '
                              : 'Cash gap of ${_money(gapAbs)} detected.  ',
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        TextSpan(
                          text: 'POS Expected: ${_money(salesRevenue)}  •  Cash Collected: ${_money(collected)}',
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        }),

        // Per-shift table
        Container(
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey.shade200),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            children: [
              // Header
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.indigo.shade700,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(7)),
                ),
                child: const Row(children: [
                  Expanded(flex: 2, child: Text('Cashier', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12))),
                  Expanded(child: Text('Shift Start', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12))),
                  Expanded(child: Text('Shift End', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12))),
                  SizedBox(width: 110, child: Text('Expected', textAlign: TextAlign.right, style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12))),
                  SizedBox(width: 110, child: Text('Collected', textAlign: TextAlign.right, style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12))),
                  SizedBox(width: 100, child: Text('Variance', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12))),
                  SizedBox(width: 110, child: Text('Status', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12))),
                ]),
              ),
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: shifts.length,
                separatorBuilder: (_, __) => Divider(height: 1, color: Colors.grey.shade100),
                itemBuilder: (ctx, i) {
                  final shift = shifts[i];
                  final expected = _num(shift['expected_cash']);
                  final actual = _num(shift['actual_cash']);
                  final variance = _num(shift['variance']);
                  final hasDiscrepancy = variance.abs() > 10;
                  final status = '${shift['status'] ?? ''}';
                  final isApproved = status == 'closed' || status == 'approved';
                  final isPending = status == 'open' || status == 'pending';

                  String _fmtTime(dynamic v) {
                    if (v == null) return '—';
                    try {
                      final dt = _toKenyaTime(DateTime.parse('$v'));
                      return '${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}';
                    } catch (_) { return '$v'; }
                  }

                  return Container(
                    color: hasDiscrepancy
                        ? (i.isEven ? Colors.red.shade50 : Colors.red.shade50.withAlpha(180))
                        : (i.isEven ? Colors.white : Colors.grey.shade50),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    child: Row(children: [
                      Expanded(
                        flex: 2,
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${shift['cashier_name'] ?? 'Unknown'}',
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                          if ((shift['approved_by_name'] ?? '').toString().isNotEmpty)
                            Text('Approved by: ${shift['approved_by_name']}',
                                style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
                        ]),
                      ),
                      Expanded(child: Text(_fmtTime(shift['start_time']), style: const TextStyle(fontSize: 12))),
                      Expanded(child: Text(_fmtTime(shift['end_time']), style: const TextStyle(fontSize: 12))),
                      SizedBox(
                        width: 110,
                        child: Text(_money(expected),
                            textAlign: TextAlign.right,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                      ),
                      SizedBox(
                        width: 110,
                        child: Text(_money(actual),
                            textAlign: TextAlign.right,
                            style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: hasDiscrepancy ? Colors.red.shade700 : Colors.teal.shade700)),
                      ),
                      SizedBox(
                        width: 100,
                        child: Center(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                            decoration: BoxDecoration(
                              color: variance == 0
                                  ? Colors.green.shade50
                                  : variance > 0
                                      ? Colors.orange.shade50
                                      : Colors.red.shade100,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              '${variance >= 0 ? '+' : ''}${_money(variance)}',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: variance == 0
                                    ? Colors.green.shade700
                                    : variance > 0
                                        ? Colors.orange.shade700
                                        : Colors.red.shade700,
                              ),
                            ),
                          ),
                        ),
                      ),
                      SizedBox(
                        width: 110,
                        child: Center(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: isApproved
                                  ? Colors.green.shade100
                                  : isPending
                                      ? Colors.orange.shade100
                                      : Colors.grey.shade100,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              status.toUpperCase(),
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w700,
                                color: isApproved
                                    ? Colors.green.shade800
                                    : isPending
                                        ? Colors.orange.shade800
                                        : Colors.grey.shade700,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ]),
                  );
                },
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _outletFilters(List<Map<String, dynamic>> outletBreakdown) {
    final labels = {
      'all': 'All Outlets',
      for (final row in outletBreakdown)
        _text(row, ['key']): _text(row, ['label'])
    };
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: labels.entries
          .map((entry) => FilterChip(
                label: Text(entry.value),
                selected: _outletGroup == entry.key,
                onSelected: (_) => setState(() => _outletGroup = entry.key),
              ))
          .toList(),
    );
  }

  Widget _movementTable(
    List<Map<String, dynamic>> rows, {
    required String empty,
    required num totalRevenue,
    required bool includeRecommendation,
  }) {
    if (rows.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(18),
        child: Text(empty,
            style: const TextStyle(color: AppColors.kTextSecondary)),
      );
    }
    return _SimpleTable(
      columns: [
        'Rank',
        'Item',
        'Outlet',
        'Category',
        'Qty',
        'Velocity/day',
        'Revenue',
        'Profit',
        'Contribution',
        'Last Sold',
        if (includeRecommendation) 'Recommendation',
      ],
      rows: rows.asMap().entries.map((entry) {
        final item = entry.value;
        final contribution =
            totalRevenue > 0 ? (_num(item['revenue']) / totalRevenue) * 100 : 0;
        return [
          '#${entry.key + 1}',
          _text(item, ['name', 'item_name']),
          _text(item, ['outlet_label', 'category']),
          _text(item, ['category']),
          _num(item['quantity']).toStringAsFixed(0),
          _num(item['velocity_per_day']).toStringAsFixed(2),
          _money(_num(item['revenue'])),
          _money(_num(item['gross_profit'])),
          '${contribution.toStringAsFixed(1)}%',
          _shortDate(_lastSoldDate(item)),
          if (includeRecommendation) _slowRecommendation(item),
        ];
      }).toList(),
    );
  }

  Widget _categoryMixTable(List<Map<String, dynamic>> rows) {
    final totalRevenue =
        rows.fold<num>(0, (sum, row) => sum + _num(row['revenue']));
    final totalProfit =
        rows.fold<num>(0, (sum, row) => sum + _num(row['gross_profit']));
    final totalQuantity =
        rows.fold<num>(0, (sum, row) => sum + _num(row['quantity']));
    return _SimpleTable(
      columns: const [
        'Category',
        'Items',
        'Qty',
        'Revenue',
        'Revenue Mix',
        'Profit',
        'Profit Mix',
        'Sales Mix',
        'Margin'
      ],
      rows: rows
          .map((row) => [
                _text(row, ['category']),
                '${row['item_count'] ?? 0}',
                _num(row['quantity']).toStringAsFixed(0),
                _money(_num(row['revenue'])),
                totalRevenue > 0
                    ? '${((_num(row['revenue']) / totalRevenue) * 100).toStringAsFixed(1)}%'
                    : '0.0%',
                _money(_num(row['gross_profit'])),
                totalProfit > 0
                    ? '${((_num(row['gross_profit']) / totalProfit) * 100).toStringAsFixed(1)}%'
                    : '0.0%',
                totalQuantity > 0
                    ? '${((_num(row['quantity']) / totalQuantity) * 100).toStringAsFixed(1)}%'
                    : '0.0%',
                '${_num(row['profit_margin']).toStringAsFixed(1)}%',
              ])
          .toList(),
    );
  }

  Widget _profitabilityTables({
    required List<Map<String, dynamic>> mostProfitable,
    required List<Map<String, dynamic>> leastProfitable,
    required List<Map<String, dynamic>> highestMargin,
    required List<Map<String, dynamic>> lowestMargin,
  }) {
    final panels = [
      _profitTable('Most Profitable Items', mostProfitable),
      _profitTable('Least Profitable Items', leastProfitable),
      _profitTable('Highest Margin Products', highestMargin),
      _profitTable('Lowest Margin Products', lowestMargin),
    ];
    return LayoutBuilder(builder: (context, constraints) {
      if (constraints.maxWidth < 980) {
        return Column(
          children: panels
              .expand((panel) => [panel, const SizedBox(height: 14)])
              .toList(),
        );
      }
      return Wrap(
        spacing: 14,
        runSpacing: 14,
        children: panels
            .map((panel) => SizedBox(
                  width: (constraints.maxWidth - 14) / 2,
                  child: panel,
                ))
            .toList(),
      );
    });
  }

  Widget _profitTable(String title, List<Map<String, dynamic>> rows) {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.kDivider),
        borderRadius: BorderRadius.circular(8),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
        const SizedBox(height: 8),
        _SimpleTable(
          columns: const ['Item', 'Outlet', 'Revenue', 'Profit', 'Margin'],
          rows: rows
              .map((item) => [
                    _text(item, ['name', 'item_name']),
                    _text(item, ['outlet_label', 'category']),
                    _money(_num(item['revenue'])),
                    _money(_num(item['gross_profit'])),
                    '${_num(item['profit_margin']).toStringAsFixed(1)}%',
                  ])
              .toList(),
        ),
      ]),
    );
  }

  void _applyPeriod(String value) {
    final now = DateTime.now();
    DateTime start;
    DateTime end = now;
    switch (value) {
      case 'today':
        start = now;
        break;
      case 'yesterday':
        start = now.subtract(const Duration(days: 1));
        end = start;
        break;
      case 'last_7_days':
        start = now.subtract(const Duration(days: 6));
        break;
      case 'this_week':
        start = now.subtract(Duration(days: now.weekday - DateTime.monday));
        break;
      case 'last_week':
        final thisWeek =
            now.subtract(Duration(days: now.weekday - DateTime.monday));
        start = thisWeek.subtract(const Duration(days: 7));
        end = thisWeek.subtract(const Duration(days: 1));
        break;
      case 'this_month':
        start = DateTime(now.year, now.month, 1);
        break;
      case 'last_month':
        final thisMonth = DateTime(now.year, now.month, 1);
        start = DateTime(thisMonth.year, thisMonth.month - 1, 1);
        end = thisMonth.subtract(const Duration(days: 1));
        break;
      case 'this_quarter':
        final quarterMonth = ((now.month - 1) ~/ 3) * 3 + 1;
        start = DateTime(now.year, quarterMonth, 1);
        break;
      case 'this_year':
        start = DateTime(now.year, 1, 1);
        break;
      case 'custom':
        setState(() => _period = value);
        return;
      case 'last_30_days':
      default:
        start = now.subtract(const Duration(days: 30));
        break;
    }
    setState(() {
      _period = value;
      _from = _date(start);
      _to = _date(end);
      _future = _load();
    });
  }

  Map<String, String> _outletLabels(List<Map<String, dynamic>> rows) {
    return {
      'all': 'All Outlets',
      for (final row in rows)
        if (_text(row, ['key']).isNotEmpty)
          _text(row, ['key']): _text(row, ['label']).isEmpty
              ? _title(_text(row, ['key']))
              : _text(row, ['label'])
    };
  }

  List<Map<String, dynamic>> _outletBreakdownFromItems(
    List<Map<String, dynamic>> items,
    List<Map<String, dynamic>> sourceRows,
  ) {
    final keys = <String>{
      for (final row in sourceRows)
        if (_text(row, ['key']).isNotEmpty) _text(row, ['key']),
      for (final item in items)
        if (_text(item, ['outlet_group']).isNotEmpty)
          _text(item, ['outlet_group']),
    };
    if (keys.isEmpty) {
      keys.addAll(const ['restaurant', 'bar', 'rooms', 'non_consumables']);
    }
    final useOriginal =
        items.isEmpty && _search.trim().isEmpty && _outletGroup == 'all';
    return keys.map((key) {
      final rows =
          items.where((item) => _text(item, ['outlet_group']) == key).toList();
      final original = sourceRows.firstWhere(
        (row) => _text(row, ['key']) == key,
        orElse: () => <String, dynamic>{},
      );
      final revenue = _sum(rows, 'revenue');
      final cogs = _sum(rows, 'cost_of_goods_sold');
      final quantity = _sum(rows, 'quantity');
      final sourceRevenue =
          useOriginal && rows.isEmpty ? _num(original['revenue']) : revenue;
      final sourceProfit = useOriginal && rows.isEmpty
          ? _num(original['gross_profit'])
          : revenue - cogs;
      return {
        'key': key,
        'label': _text(original, ['label']).isNotEmpty
            ? _text(original, ['label'])
            : soldOutletLabel(key),
        'item_count': useOriginal && rows.isEmpty
            ? _num(original['item_count'])
            : rows.length,
        'quantity':
            useOriginal && rows.isEmpty ? _num(original['quantity']) : quantity,
        'revenue': sourceRevenue,
        'cost_of_goods_sold': useOriginal && rows.isEmpty
            ? _num(original['cost_of_goods_sold'])
            : cogs,
        'gross_profit': sourceProfit,
        'profit_margin':
            sourceRevenue > 0 ? (sourceProfit / sourceRevenue) * 100 : 0,
      };
    }).toList();
  }

  List<Map<String, dynamic>> _dailyRevenueFromItems(
      List<Map<String, dynamic>> items) {
    final daily = <String, Map<String, dynamic>>{};
    for (final item in items) {
      for (final row in _list(item['daily'])) {
        final date = _text(row, ['date']);
        if (date.isEmpty) continue;
        final target = daily.putIfAbsent(date, () {
          return {
            'date': date,
            'revenue': 0,
            'cost_of_goods_sold': 0,
            'gross_profit': 0,
            'quantity': 0,
          };
        });
        target['revenue'] = _num(target['revenue']) + _num(row['revenue']);
        target['cost_of_goods_sold'] = _num(target['cost_of_goods_sold']) +
            _num(row['cost_of_goods_sold']);
        target['gross_profit'] =
            _num(target['revenue']) - _num(target['cost_of_goods_sold']);
        target['quantity'] = _num(target['quantity']) + _num(row['quantity']);
      }
    }
    final rows = daily.values.toList();
    rows.sort((a, b) => _text(a, ['date']).compareTo(_text(b, ['date'])));
    return rows;
  }

  List<Map<String, dynamic>> _categoryBreakdown(
      List<Map<String, dynamic>> items) {
    final categories = <String, Map<String, dynamic>>{};
    for (final item in items) {
      final key = _text(item, ['category']).isEmpty
          ? 'Uncategorised'
          : _text(item, ['category']);
      final row = categories.putIfAbsent(key, () {
        return {
          'category': key,
          'item_count': 0,
          'quantity': 0,
          'revenue': 0,
          'cost_of_goods_sold': 0,
          'gross_profit': 0,
          'profit_margin': 0,
        };
      });
      row['item_count'] = _num(row['item_count']) + 1;
      row['quantity'] = _num(row['quantity']) + _num(item['quantity']);
      row['revenue'] = _num(row['revenue']) + _num(item['revenue']);
      row['cost_of_goods_sold'] =
          _num(row['cost_of_goods_sold']) + _num(item['cost_of_goods_sold']);
      row['gross_profit'] =
          _num(row['revenue']) - _num(row['cost_of_goods_sold']);
      row['profit_margin'] = _num(row['revenue']) > 0
          ? (_num(row['gross_profit']) / _num(row['revenue'])) * 100
          : 0;
    }
    final rows = categories.values.toList();
    rows.sort((a, b) => _num(b['revenue']).compareTo(_num(a['revenue'])));
    return rows;
  }

  List<Map<String, dynamic>> _rankedItems(
    List<Map<String, dynamic>> items, {
    required String metric,
  }) {
    final rows = [...items];
    rows.sort((a, b) => _num(b[metric]).compareTo(_num(a[metric])));
    return rows;
  }

  List<Map<String, dynamic>> _slowMovingItems(
      List<Map<String, dynamic>> items) {
    final rows = [...items];
    rows.sort((a, b) {
      final velocity =
          _num(a['velocity_per_day']).compareTo(_num(b['velocity_per_day']));
      if (velocity != 0) return velocity;
      return _num(a['quantity']).compareTo(_num(b['quantity']));
    });
    return rows;
  }

  Map<String, dynamic> _soldItemsFilteredSummary(
      List<Map<String, dynamic>> items) {
    final quantity = _sum(items, 'quantity');
    final revenue = _sum(items, 'revenue');
    final grossRevenue = items.fold<num>(
        0, (sum, item) => sum + _num(item['gross_revenue'] ?? item['revenue']));
    final netRevenue = items.fold<num>(
        0, (sum, item) => sum + _num(item['net_revenue'] ?? item['revenue']));
    final cogs = _sum(items, 'cost_of_goods_sold');
    final profit = netRevenue - cogs;
    final transactions =
        items.fold<num>(0, (sum, item) => sum + _transactionCount(item));
    return {
      'total_items_sold': items.length,
      'total_quantity_sold': quantity.toStringAsFixed(0),
      'total_transactions': transactions.toStringAsFixed(0),
      'gross_revenue': grossRevenue,
      'net_revenue': netRevenue,
      'total_revenue': revenue,
      'total_cogs': cogs,
      'gross_profit': profit,
      'profit_margin': netRevenue > 0 ? (profit / netRevenue) * 100 : 0,
      'average_order_value': quantity > 0 ? netRevenue / quantity : 0,
      'fast_moving_count': items
          .where((item) => _text(item, ['movement_tier']) == 'fast')
          .length,
      'slow_moving_count': items
          .where((item) => _text(item, ['movement_tier']) == 'slow')
          .length,
    };
  }

  Map<String, dynamic> _bestOutlet(
    List<Map<String, dynamic>> rows, {
    required bool highest,
  }) {
    final candidates =
        rows.where((row) => _num(row['revenue']) > 0).toList(growable: false);
    if (candidates.isEmpty) return {};
    candidates.sort((a, b) => highest
        ? _num(b['revenue']).compareTo(_num(a['revenue']))
        : _num(a['revenue']).compareTo(_num(b['revenue'])));
    return candidates.first;
  }

  String _lastSoldDate(Map<String, dynamic> item) {
    final direct = _text(item, ['last_sold_at', 'last_sold_date']);
    if (direct.isNotEmpty) return direct;
    final dates = _list(item['daily'])
        .map((row) => _text(row, ['date']))
        .where((date) => date.isNotEmpty)
        .toList();
    if (dates.isEmpty) return '';
    dates.sort();
    return dates.last;
  }

  num _averageSellingPrice(Map<String, dynamic> item) {
    final explicit = _num(item['average_selling_price']);
    if (explicit > 0) return explicit;
    final quantity = _num(item['quantity']);
    return quantity > 0 ? _num(item['revenue']) / quantity : 0;
  }

  int _transactionCount(Map<String, dynamic> item) {
    final explicit = _num(item['transaction_count']).toInt();
    if (explicit > 0) return explicit;
    final refs = item['references'];
    if (refs is List && refs.isNotEmpty) return refs.length;
    return _num(item['transaction_count']).toInt();
  }

  String _slowRecommendation(Map<String, dynamic> item) {
    final velocity = _num(item['velocity_per_day']);
    final quantity = _num(item['quantity']);
    final stockRequested = _num(item['stock_requested']);
    final revenue = _num(item['revenue']);
    if (quantity <= 0 || revenue <= 0) return 'Remove Item';
    if (velocity < .15 && stockRequested > quantity) return 'Restock Less';
    if (_num(item['profit_margin']) < 15) return 'Discount';
    return 'Promote';
  }

  Future<void> _downloadCsv(List<Map<String, dynamic>> items) async {
    try {
      final headers = [
        'Date',
        'Item Name',
        'SKU',
        'Category',
        'Quantity',
        'Revenue',
        'COGS',
        'Profit',
        'Profit Margin',
        'Transactions',
        'Outlet',
        'Branch',
        'Average Selling Price',
        'Movement',
      ];
      final buffer = StringBuffer()..writeln(headers.map(_csvCell).join(','));
      for (final item in items) {
        buffer.writeln([
          _lastSoldDate(item),
          _text(item, ['name', 'item_name']),
          _text(item, ['sku', 'item_id']),
          _text(item, ['category']),
          _num(item['quantity']).toStringAsFixed(0),
          _num(item['revenue']).toStringAsFixed(2),
          _num(item['cost_of_goods_sold']).toStringAsFixed(2),
          _num(item['gross_profit']).toStringAsFixed(2),
          _num(item['profit_margin']).toStringAsFixed(2),
          '${_transactionCount(item)}',
          _text(item, ['outlet_label']),
          _text(item, ['branch_name']),
          _averageSellingPrice(item).toStringAsFixed(2),
          _text(item, ['movement_tier']).toUpperCase(),
        ].map(_csvCell).join(','));
      }
      final directory = await getDownloadsDirectory() ??
          await getApplicationDocumentsDirectory();
      final file = File('${directory.path}/FG_Sold_Items_${_from}_to_$_to.csv');
      await file.writeAsString(buffer.toString(), flush: true);
      if (mounted) _notify(context, 'Sold items CSV prepared: ${file.path}');
    } catch (e) {
      if (mounted) _notify(context, 'Failed to export sold items CSV: $e');
    }
  }

  String _csvCell(Object? value) {
    var text = '${value ?? ''}'.replaceAll('\r', ' ').replaceAll('\n', ' ');
    if (text.startsWith('=') ||
        text.startsWith('+') ||
        text.startsWith('-') ||
        text.startsWith('@')) {
      text = "'$text";
    }
    return '"${text.replaceAll('"', '""')}"';
  }

  Map<String, dynamic> _kdsFromItems(
    List<Map<String, dynamic>> items,
    Map<String, dynamic> fallback,
  ) {
    final kdsItems =
        items.where((item) => _num(item['average_kds_minutes']) > 0).toList();
    if (kdsItems.isEmpty) {
      if (_search.trim().isEmpty && _outletGroup == 'all') return fallback;
      return {
        'average_prep_minutes': null,
        'slowest_items': <Map<String, dynamic>>[],
        'fastest_items': <Map<String, dynamic>>[],
      };
    }
    final average = kdsItems.fold<num>(
            0, (sum, item) => sum + _num(item['average_kds_minutes'])) /
        kdsItems.length;
    final slowest = [...kdsItems]..sort((a, b) => _num(b['average_kds_minutes'])
        .compareTo(_num(a['average_kds_minutes'])));
    final fastest = [...kdsItems]..sort((a, b) => _num(a['average_kds_minutes'])
        .compareTo(_num(b['average_kds_minutes'])));
    return {
      'average_prep_minutes': average,
      'slowest_items': slowest.take(10).toList(),
      'fastest_items': fastest.take(10).toList(),
    };
  }

  Widget _kdsTable(Map<String, dynamic> kds) {
    final slowest = _list(kds['slowest_items']);
    final fastest = _list(kds['fastest_items']);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _MetricCard(
          'Average Prep Time',
          _num(kds['average_prep_minutes']) > 0
              ? '${_num(kds['average_prep_minutes']).toStringAsFixed(1)} min'
              : 'No KDS timing',
          Icons.timer,
          Colors.blueGrey,
        ),
        const SizedBox(height: 16),
        LayoutBuilder(
          builder: (context, constraints) {
            final slow = _SimpleTable(
              columns: const ['Slowest Item', 'Outlet', 'Avg Prep'],
              rows: slowest
                  .map((item) => [
                        _text(item, ['name']),
                        _text(item, ['outlet_label']),
                        '${_num(item['average_kds_minutes']).toStringAsFixed(1)} min',
                      ])
                  .toList(),
            );
            final fast = _SimpleTable(
              columns: const ['Fastest Item', 'Outlet', 'Avg Prep'],
              rows: fastest
                  .map((item) => [
                        _text(item, ['name']),
                        _text(item, ['outlet_label']),
                        '${_num(item['average_kds_minutes']).toStringAsFixed(1)} min',
                      ])
                  .toList(),
            );
            if (constraints.maxWidth < 900) {
              return Column(children: [slow, const SizedBox(height: 16), fast]);
            }
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: slow),
                const SizedBox(width: 16),
                Expanded(child: fast),
              ],
            );
          },
        ),
      ],
    );
  }

  Widget _soldItemsTable(List<Map<String, dynamic>> items) {
    return _SimpleTable(
      columns: const [
        'Last Sold',
        'Product',
        'SKU',
        'Category',
        'Outlet',
        'Branch',
        'Qty',
        'Transactions',
        'Avg Price',
        'Revenue',
        'COGS',
        'Gross Profit',
        'Margin',
        'Movement',
        'KDS Avg'
      ],
      rows: items
          .map((item) => [
                _shortDate(_lastSoldDate(item)),
                _text(item, ['name', 'item_name']),
                _text(item, ['sku', 'item_id']),
                _text(item, ['category']),
                _text(item, ['outlet_label', 'category']),
                _text(item, ['branch_name']),
                _num(item['quantity']).toStringAsFixed(0),
                '${_transactionCount(item)}',
                _money(_averageSellingPrice(item)),
                _money(_num(item['revenue'])),
                _money(_num(item['cost_of_goods_sold'])),
                _money(_num(item['gross_profit'])),
                '${_num(item['profit_margin']).toStringAsFixed(1)}%',
                _text(item, ['movement_tier']).toUpperCase(),
                _num(item['average_kds_minutes']) > 0
                    ? '${_num(item['average_kds_minutes']).toStringAsFixed(1)} min'
                    : 'N/A',
              ])
          .toList(),
    );
  }

  Future<void> _downloadBackendReport() async {
    setState(() => _downloading = true);
    try {
      final file = await ref
          .read(branchAccountantRepositoryProvider)
          .downloadSoldItemsReport(startDate: _from, endDate: _to);
      await Printing.sharePdf(
        bytes: await file.readAsBytes(),
        filename: 'FG_Sold_Items_${_from}_to_$_to.pdf',
      );
      if (mounted) _notify(context, 'Sold items PDF prepared: ${file.path}');
    } catch (e) {
      if (mounted) _notify(context, 'Failed to export sold items PDF: $e');
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }
}

class _SoldItemsDatePicker extends StatelessWidget {
  const _SoldItemsDatePicker({
    required this.value,
    required this.tooltip,
    required this.onChanged,
  });

  final String value;
  final String tooltip;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: OutlinedButton.icon(
        onPressed: () async {
          final initial = DateTime.tryParse(value) ?? DateTime.now();
          final selected = await showDatePicker(
            context: context,
            initialDate: initial,
            firstDate: DateTime(2020),
            lastDate: DateTime.now().add(const Duration(days: 366)),
          );
          if (selected != null) onChanged(_date(selected));
        },
        icon: const Icon(Icons.calendar_today, size: 18),
        label: Text(value),
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(150, 44),
          alignment: Alignment.centerLeft,
        ),
      ),
    );
  }
}

class _SoldItemsDropdown extends StatelessWidget {
  const _SoldItemsDropdown({
    required this.value,
    required this.values,
    required this.onChanged,
    this.labels = const {},
  });

  final String value;
  final List<String> values;
  final ValueChanged<String> onChanged;
  final Map<String, String> labels;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 138, maxWidth: 210),
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.kDivider),
        borderRadius: BorderRadius.circular(8),
        color: Colors.white,
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: values.contains(value)
              ? value
              : (values.isNotEmpty ? values.first : null),
          isExpanded: true,
          items: values
              .map((item) => DropdownMenuItem(
                    value: item,
                    child: Text(
                      labels[item] ?? _title(item),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ))
              .toList(),
          onChanged: (v) {
            if (v != null) onChanged(v);
          },
        ),
      ),
    );
  }
}

class _OutletSummaryTile extends StatelessWidget {
  const _OutletSummaryTile({required this.row});

  final Map<String, dynamic> row;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.kDivider),
        borderRadius: BorderRadius.circular(8),
        color: Colors.white,
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color:
                  _soldChartColor(_text(row, ['key'])).withValues(alpha: .12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              _soldOutletIcon(_text(row, ['key'])),
              color: _soldChartColor(_text(row, ['key'])),
              size: 20,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _text(row, ['label']),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                Text(
                  '${_num(row['quantity']).toStringAsFixed(0)} units • ${_money(_num(row['gross_profit']))} profit',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.kTextSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          Text(
            _money(_num(row['revenue'])),
            style: const TextStyle(fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }
}

class _SoldItemsCharts extends StatelessWidget {
  const _SoldItemsCharts({
    required this.outletBreakdown,
    required this.dailyRevenue,
  });

  final List<Map<String, dynamic>> outletBreakdown;
  final List<Map<String, dynamic>> dailyRevenue;

  @override
  Widget build(BuildContext context) {
    final outletRows =
        outletBreakdown.where((row) => _num(row['revenue']) > 0).toList();
    final dailyRows = dailyRevenue.length > 14
        ? dailyRevenue.sublist(dailyRevenue.length - 14)
        : dailyRevenue;
    return LayoutBuilder(
      builder: (context, constraints) {
        final pie = _chartPanel(
          title: 'Revenue Mix',
          child: outletRows.isEmpty
              ? const Center(child: Text('No revenue mix yet'))
              : PieChart(
                  PieChartData(
                    centerSpaceRadius: 42,
                    sectionsSpace: 2,
                    sections: outletRows.map((row) {
                      final key = _text(row, ['key']);
                      return PieChartSectionData(
                        value: _num(row['revenue']).toDouble(),
                        title: _text(row, ['label']),
                        radius: 72,
                        color: _soldChartColor(key),
                        titleStyle: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      );
                    }).toList(),
                  ),
                ),
        );
        final bars = _chartPanel(
          title: 'Daily Revenue vs Profit',
          child: dailyRows.isEmpty
              ? const Center(child: Text('No daily trend yet'))
              : BarChart(
                  BarChartData(
                    gridData: const FlGridData(show: true),
                    borderData: FlBorderData(show: false),
                    titlesData: FlTitlesData(
                      leftTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false)),
                      topTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false)),
                      rightTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false)),
                      bottomTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          reservedSize: 28,
                          getTitlesWidget: (value, meta) {
                            final index = value.toInt();
                            if (index < 0 || index >= dailyRows.length) {
                              return const SizedBox.shrink();
                            }
                            final date = _text(dailyRows[index], ['date']);
                            return Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Text(
                                date.length >= 10 ? date.substring(5) : date,
                                style: const TextStyle(fontSize: 10),
                              ),
                            );
                          },
                        ),
                      ),
                    ),
                    barGroups: dailyRows.asMap().entries.map((entry) {
                      final row = entry.value;
                      return BarChartGroupData(
                        x: entry.key,
                        barsSpace: 3,
                        barRods: [
                          BarChartRodData(
                            toY: _num(row['revenue']).toDouble(),
                            color: Colors.green,
                            width: 8,
                            borderRadius: BorderRadius.circular(2),
                          ),
                          BarChartRodData(
                            toY: _num(row['gross_profit']).toDouble(),
                            color: AppColors.kPrimary,
                            width: 8,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ],
                      );
                    }).toList(),
                  ),
                ),
        );
        if (constraints.maxWidth < 1000) {
          return Column(children: [pie, const SizedBox(height: 16), bars]);
        }
        return Row(
          children: [
            Expanded(child: pie),
            const SizedBox(width: 16),
            Expanded(child: bars),
          ],
        );
      },
    );
  }

  Widget _chartPanel({required String title, required Widget child}) {
    return Container(
      height: 320,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.kDivider),
        borderRadius: BorderRadius.circular(8),
        color: Colors.white,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          Expanded(child: child),
        ],
      ),
    );
  }
}

Color _soldChartColor(String key) {
  switch (key) {
    case 'bar':
      return Colors.indigo;
    case 'rooms':
      return Colors.teal;
    case 'non_consumables':
      return Colors.deepOrange;
    case 'restaurant':
      return Colors.green;
    default:
      return AppColors.kPrimary;
  }
}

String soldOutletLabel(String key) {
  switch (key) {
    case 'restaurant':
      return 'Restaurant';
    case 'bar':
      return 'Bar';
    case 'rooms':
      return 'Rooms';
    case 'room_service':
      return 'Room Service';
    case 'coffee_shop':
      return 'Coffee Shop';
    case 'bakery':
      return 'Bakery';
    case 'fast_food':
      return 'Fast Food';
    case 'non_consumables':
      return 'Non-consumables';
    default:
      return _title(key);
  }
}

IconData _soldOutletIcon(String key) {
  switch (key) {
    case 'bar':
      return Icons.local_bar;
    case 'rooms':
      return Icons.bed;
    case 'non_consumables':
      return Icons.shopping_bag;
    case 'restaurant':
      return Icons.restaurant;
    default:
      return Icons.point_of_sale;
  }
}

class _StaffAuditSection extends ConsumerStatefulWidget {
  const _StaffAuditSection();

  @override
  ConsumerState<_StaffAuditSection> createState() => _StaffAuditSectionState();
}

class _StaffAuditSectionState extends ConsumerState<_StaffAuditSection> {
  late String _from = _date(DateTime.now().subtract(const Duration(days: 30)));
  late String _to = _today();
  String _query = '';
  String _type = 'all';
  String _staffFilter = 'all';
  bool _summaryMode = true;
  late Future<Map<String, dynamic>> _future = _load();

  Future<Map<String, dynamic>> _load() => ref
      .read(branchAccountantRepositoryProvider)
      .getStaffAudit(startDate: _from, endDate: _to);
  void _refresh() => setState(() {
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (data) {
          final records = _list(data['data'] ?? data['records']);
          final summary = _list(data['summary']);
          final lower = _query.toLowerCase();

          // Build staff name list from summary for dropdown
          final staffNames = <String>{
            for (final e in summary)
              if (_text(e, ['staff_name']).isNotEmpty) _text(e, ['staff_name']),
          }.toList()
            ..sort();

          // Validate _staffFilter against available names
          final validStaff =
              _staffFilter == 'all' || staffNames.contains(_staffFilter);
          if (!validStaff && mounted) {
            Future.microtask(() => setState(() => _staffFilter = 'all'));
          }

          final filteredRecords = records.where((e) {
            final matchesType = _type == 'all' || _text(e, ['type']) == _type;
            final matchesStaff = _staffFilter == 'all' ||
                _text(e, ['staff_name']) == _staffFilter;
            final haystack = '${_text(e, ['staff_name'])} ${_text(e, [
                  'reference'
                ])} ${_text(e, ['description'])}'
                .toLowerCase();
            return matchesType &&
                matchesStaff &&
                (lower.isEmpty || haystack.contains(lower));
          }).toList();
          final filteredSummary = summary.where((e) {
            final matchesStaff = _staffFilter == 'all' ||
                _text(e, ['staff_name']) == _staffFilter;
            final haystack = '${_text(e, ['staff_name'])} ${_text(e, [
                  'department'
                ])} ${_text(e, ['branch_name'])} ${_text(e, [
                  'employee_id'
                ])} ${_text(e, ['national_id'])} ${_text(e, ['role'])}'
                .toLowerCase();
            return matchesStaff && (lower.isEmpty || haystack.contains(lower));
          }).toList();
          return _Page(
            title: 'Staff Financial Audit',
            subtitle:
                'Payroll-style staff deductions, outstanding balances, and net payable after deductions.',
            actions: [
              SegmentedButton<bool>(
                segments: const [
                  ButtonSegment(value: true, label: Text('Summary')),
                  ButtonSegment(value: false, label: Text('Transactions')),
                ],
                selected: {_summaryMode},
                onSelectionChanged: (v) =>
                    setState(() => _summaryMode = v.first),
              ),
              _DateField(
                  value: _from, onChanged: (v) => setState(() => _from = v)),
              _DateField(value: _to, onChanged: (v) => setState(() => _to = v)),
              _Dropdown(
                value: _type,
                values: const [
                  'all',
                  'Credit Bill',
                  'Advance',
                  'Loan',
                  'Unpaid Bill'
                ],
                onChanged: (v) => setState(() => _type = v),
              ),
              // Staff dropdown filter
              if (staffNames.isNotEmpty)
                DropdownButton<String>(
                  value: validStaff ? _staffFilter : 'all',
                  hint: const Text('All Staff'),
                  items: [
                    const DropdownMenuItem(
                        value: 'all', child: Text('All Staff')),
                    ...staffNames.map((name) => DropdownMenuItem(
                          value: name,
                          child: Text(name),
                        )),
                  ],
                  onChanged: (v) => setState(() => _staffFilter = v ?? 'all'),
                ),
              SizedBox(
                width: 200,
                child: TextField(
                  decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search), hintText: 'Search staff'),
                  onChanged: (v) => setState(() => _query = v),
                ),
              ),
              _RefreshButton(onPressed: _refresh),
              OutlinedButton.icon(
                onPressed: () => _export(filteredSummary, filteredRecords),
                icon: const Icon(Icons.picture_as_pdf),
                label: const Text('Export PDF'),
              ),
            ],
            children: [
              _ResponsiveGrid(children: [
                _MetricCard('Staff in Scope', '${filteredSummary.length}',
                    Icons.people, Colors.blue),
                _MetricCard(
                    'Outstanding Credit Bills',
                    _money(filteredSummary.fold<num>(
                        0, (sum, e) => sum + _staffOutstandingCreditBills(e))),
                    Icons.credit_card,
                    Colors.orange),
                _MetricCard(
                    'Salary Advances',
                    _money(filteredSummary.fold<num>(
                        0, (sum, e) => sum + _staffOutstandingAdvances(e))),
                    Icons.payments,
                    Colors.indigo),
                _MetricCard(
                    'Staff Loans',
                    _money(filteredSummary.fold<num>(
                        0, (sum, e) => sum + _staffOutstandingLoans(e))),
                    Icons.account_balance,
                    Colors.green),
                _MetricCard(
                    'Outstanding',
                    _money(_sum(filteredSummary, 'outstanding_balance')),
                    Icons.warning,
                    Colors.red),
                _MetricCard(
                    'Net Payable',
                    _money(filteredSummary.fold<num>(
                        0, (sum, e) => sum + _staffNetPayable(e))),
                    Icons.account_balance_wallet,
                    Colors.teal),
              ]),
              _SectionCard(
                title: _summaryMode ? 'Staff Summary' : 'Transactions',
                child: _summaryMode
                    ? _SimpleTable(
                        columns: const [
                          'Staff Name',
                          'Employee ID',
                          'National ID',
                          'Branch',
                          'Department',
                          'Salary',
                          'Outstanding Credit Bills',
                          'Salary Advances',
                          'Staff Loans',
                          'Net Payable'
                        ],
                        rows: filteredSummary
                            .map((e) => [
                                  _text(e, ['staff_name']),
                                  _staffEmployeeId(e),
                                  _staffNationalId(e),
                                  _text(e, ['branch_name']),
                                  _text(e, ['department']),
                                  _money(_staffSalary(e)),
                                  _money(_staffOutstandingCreditBills(e)),
                                  _money(_staffOutstandingAdvances(e)),
                                  _money(_staffOutstandingLoans(e)),
                                  _money(_staffNetPayable(e)),
                                ])
                            .toList(),
                      )
                    : _SimpleTable(
                        columns: const [
                          'Date',
                          'Type',
                          'Staff',
                          'Description',
                          'Status',
                          'Amount',
                          'Outstanding'
                        ],
                        rows: filteredRecords
                            .map((e) => [
                                  _text(e, ['date', 'created_at']),
                                  _text(e, ['type']),
                                  _text(e, ['staff_name']),
                                  _text(e, ['description']),
                                  _StatusPill(_text(e, ['status'])),
                                  _money(_num(e['amount'])),
                                  _money(_num(e['outstanding_amount'])),
                                ])
                            .toList(),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _export(
    List<Map<String, dynamic>> summary,
    List<Map<String, dynamic>> records,
  ) async {
    final file = await _exportPdf(
      filename: _summaryMode
          ? 'staff-financial-summary-$_from-to-$_to.pdf'
          : 'staff-financial-transactions-$_from-to-$_to.pdf',
      title: _summaryMode ? 'Staff Financial Summary' : 'Staff Audit Report',
      subtitle: 'Period: $_from to $_to',
      metrics: {
        'Staff in Scope': '${summary.length}',
        'Outstanding Credit Bills': _money(summary.fold<num>(
            0, (sum, e) => sum + _staffOutstandingCreditBills(e))),
        'Salary Advances': _money(summary.fold<num>(
            0, (sum, e) => sum + _staffOutstandingAdvances(e))),
        'Staff Loans': _money(
            summary.fold<num>(0, (sum, e) => sum + _staffOutstandingLoans(e))),
        'Outstanding': _money(_sum(summary, 'outstanding_balance')),
        'Net Payable':
            _money(summary.fold<num>(0, (sum, e) => sum + _staffNetPayable(e))),
      },
      tableHeaders: _summaryMode
          ? const [
              'Staff Name',
              'Employee ID',
              'National ID',
              'Branch',
              'Department',
              'Salary',
              'Outstanding Credit Bills',
              'Salary Advances',
              'Staff Loans',
              'Net Payable'
            ]
          : const [
              'Date',
              'Type',
              'Staff',
              'Description',
              'Status',
              'Amount',
              'Outstanding'
            ],
      tableRows: _summaryMode
          ? summary
              .map((e) => [
                    _text(e, ['staff_name']),
                    _staffEmployeeId(e),
                    _staffNationalId(e),
                    _text(e, ['branch_name']),
                    _text(e, ['department']),
                    _money(_staffSalary(e)),
                    _money(_staffOutstandingCreditBills(e)),
                    _money(_staffOutstandingAdvances(e)),
                    _money(_staffOutstandingLoans(e)),
                    _money(_staffNetPayable(e)),
                  ])
              .toList()
          : records
              .map((e) => [
                    _text(e, ['date', 'created_at']),
                    _text(e, ['type']),
                    _text(e, ['staff_name']),
                    _text(e, ['description']),
                    _text(e, ['status']),
                    _money(_num(e['amount'])),
                    _money(_num(e['outstanding_amount'])),
                  ])
              .toList(),
    );
    if (mounted) _notify(context, 'Staff audit PDF saved to ${file.path}');
  }
}

class _ShiftOpeningApprovalsSection extends ConsumerStatefulWidget {
  const _ShiftOpeningApprovalsSection();

  @override
  ConsumerState<_ShiftOpeningApprovalsSection> createState() =>
      _ShiftOpeningApprovalsSectionState();
}

class _ShiftOpeningApprovalsSectionState
    extends ConsumerState<_ShiftOpeningApprovalsSection> {
  late Future<List<Map<String, dynamic>>> _future = _load();
  final Set<String> _busyIds = {};

  Future<List<Map<String, dynamic>>> _load() {
    return ref
        .read(branchAccountantRepositoryProvider)
        .getShiftLogs(status: 'pending_open');
  }

  void _refresh() {
    setState(() {
      _future = _load();
    });
  }

  Future<void> _approve(Map<String, dynamic> shift) async {
    final id = '${shift['id'] ?? ''}';
    if (id.isEmpty || _busyIds.contains(id)) return;
    final repo = ref.read(branchAccountantRepositoryProvider);
    setState(() => _busyIds.add(id));
    try {
      final gate = await repo.getOpeningStockStatus(id);
      final gateData = _map(gate['data']).isNotEmpty ? _map(gate['data']) : gate;
      if (gateData['gate_open'] != true) {
        if (mounted) {
          await _showOpeningStockGateDialog(_map(gateData['status']));
        }
        return;
      }
    } catch (_) {
      // If the gate status itself can't be loaded, fail safe by blocking.
      if (mounted) {
        _notify(context, 'Could not verify opening stock status. Try again.');
      }
      return;
    } finally {
      if (mounted) setState(() => _busyIds.remove(id));
    }
    setState(() => _busyIds.add(id));
    try {
      await repo.approveShiftOpening(
            id,
            notes: 'Approved from Shift Openings queue',
          );
      if (!mounted) return;
      _notify(
        context,
        'Shift opened for ${_firstTextFrom(shift, [
              'cashier_name',
              'cashier',
              'user_name'
            ], fallback: 'cashier')}',
      );
      _refresh();
    } catch (error) {
      if (mounted) _notify(context, 'Could not approve shift: $error');
    } finally {
      if (mounted) setState(() => _busyIds.remove(id));
    }
  }

  Future<void> _reject(Map<String, dynamic> shift) async {
    final id = '${shift['id'] ?? ''}';
    if (id.isEmpty || _busyIds.contains(id)) return;
    final notes = await _askForRejectionNote();
    if (notes == null) return;

    setState(() => _busyIds.add(id));
    try {
      await ref.read(branchAccountantRepositoryProvider).rejectShiftOpening(
            id,
            notes:
                notes.trim().isEmpty ? 'Rejected by branch accountant' : notes,
          );
      if (!mounted) return;
      _notify(context, 'Shift opening request rejected');
      _refresh();
    } catch (error) {
      if (mounted) _notify(context, 'Could not reject shift: $error');
    } finally {
      if (mounted) setState(() => _busyIds.remove(id));
    }
  }

  Future<void> _showOpeningStockGateDialog(Map<String, dynamic> status) async {
    final locations = const [
      ('Branch Store', 'branch_store_complete'),
      ('Main Bar', 'main_bar_complete'),
      ('Executive Bar', 'executive_bar_complete'),
    ];
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('Opening Stock Incomplete'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
                'The shift cannot be opened until all stock counts are submitted.'),
            const SizedBox(height: 14),
            for (final (label, key) in locations)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Icon(
                      status[key] == true
                          ? Icons.check_circle
                          : Icons.cancel,
                      color: status[key] == true ? Colors.green : Colors.red,
                      size: 20,
                    ),
                    const SizedBox(width: 10),
                    Text(label),
                  ],
                ),
              ),
          ],
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Dismiss'),
          ),
        ],
      ),
    );
  }

  Future<String?> _askForRejectionNote() async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Reject Shift Opening'),
        content: TextField(
          controller: controller,
          minLines: 3,
          maxLines: 5,
          decoration: const InputDecoration(
            hintText: 'Reason or notes for the cashier',
            alignLabelWithHint: true,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
    controller.dispose();
    return result;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (items) {
          return _Page(
            title: 'Shift Opening Approvals',
            subtitle:
                'Approve cashier shift-opening requests before POS access begins.',
            actions: [
              _RefreshButton(onPressed: _refresh),
            ],
            children: [
              _ResponsiveGrid(
                children: [
                  _MetricCard('Pending Requests', '${items.length}',
                      Icons.lock_open, Colors.orange),
                  _MetricCard(
                    'Cashiers Waiting',
                    '${items.map((item) => '${item['cashier_id'] ?? item['cashier_name']}').toSet().length}',
                    Icons.point_of_sale,
                    AppColors.kPrimary,
                  ),
                  _MetricCard(
                    'Opening Float',
                    _money(items.fold<num>(
                        0, (sum, item) => sum + _num(item['opening_float']))),
                    Icons.payments,
                    Colors.green,
                  ),
                ],
              ),
              _SectionCard(
                title: 'Pending Shift Opening Queue',
                child: items.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.symmetric(vertical: 46),
                        child: Center(
                          child: Column(
                            children: [
                              Icon(Icons.check_circle_outline,
                                  color: Colors.green, size: 46),
                              SizedBox(height: 10),
                              Text(
                                'No shift opening requests',
                                style:
                                    TextStyle(color: AppColors.kTextSecondary),
                              ),
                            ],
                          ),
                        ),
                      )
                    : Column(
                        children: items
                            .map(
                              (shift) => _ShiftOpeningRequestRow(
                                shift: shift,
                                busy: _busyIds.contains('${shift['id']}'),
                                onApprove: () => _approve(shift),
                                onReject: () => _reject(shift),
                              ),
                            )
                            .toList(),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ShiftOpeningRequestRow extends StatelessWidget {
  const _ShiftOpeningRequestRow({
    required this.shift,
    required this.busy,
    required this.onApprove,
    required this.onReject,
  });

  final Map<String, dynamic> shift;
  final bool busy;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    final cashier = _firstTextFrom(
      shift,
      ['cashier_name', 'cashier', 'user_name'],
      fallback: 'Cashier',
    );
    final shiftNumber = _firstTextFrom(
      shift,
      ['shift_number', 'id'],
      fallback: 'Shift request',
    );
    final requestedAt =
        _firstTextFrom(shift, ['requested_at', 'created_at', 'shift_start']);
    final openingFloat = _firstNumFrom(shift, ['opening_float']);
    final notes = _firstTextFrom(shift, ['notes', 'opening_review_notes']);

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.kDivider)),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final details = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 6,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(
                    shiftNumber,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const _MiniBadge('PENDING OPEN'),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                cashier,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 18,
                runSpacing: 6,
                children: [
                  Text('Requested ${_shortDate(requestedAt)}',
                      style: const TextStyle(color: AppColors.kTextSecondary)),
                  Text('Opening float ${_money(openingFloat)}',
                      style: const TextStyle(color: AppColors.kTextSecondary)),
                  if (notes.isNotEmpty)
                    Text('Notes: $notes',
                        style:
                            const TextStyle(color: AppColors.kTextSecondary)),
                ],
              ),
            ],
          );

          final actions = Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              OutlinedButton.icon(
                onPressed: busy ? null : onReject,
                icon: const Icon(Icons.cancel_outlined),
                label: const Text('Reject'),
              ),
              const SizedBox(width: 10),
              FilledButton.icon(
                onPressed: busy ? null : onApprove,
                icon: busy
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.check_circle_outline),
                label: const Text('Approve & Open'),
              ),
            ],
          );

          if (constraints.maxWidth < 760) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                details,
                const SizedBox(height: 12),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: actions,
                ),
              ],
            );
          }

          return Row(
            children: [
              Expanded(child: details),
              const SizedBox(width: 16),
              actions,
            ],
          );
        },
      ),
    );
  }
}

class _ShiftReviewSection extends ConsumerStatefulWidget {
  const _ShiftReviewSection();

  @override
  ConsumerState<_ShiftReviewSection> createState() =>
      _ShiftReviewSectionState();
}

class _ShiftReviewSectionState extends ConsumerState<_ShiftReviewSection> {
  final TextEditingController _notesController = TextEditingController();
  String? _selectedShiftId;
  Map<String, dynamic>? _selectedShift;
  Map<String, dynamic>? _selectedDetail;
  bool _loadingDetail = false;

  late Future<List<Map<String, dynamic>>> _future = _load();

  Future<List<Map<String, dynamic>>> _load() async {
    final repo = ref.read(branchAccountantRepositoryProvider);
    final results = await Future.wait([
      repo.getShiftLogs(status: 'pending_open'),
      repo.getPendingCashierLogbooks(),
      repo.getShiftLogs(status: 'closed'),
    ]);
    final pendingOpenings = results[0]
        .map((shift) => {...shift, '_shift_record_type': 'opening'})
        .toList();
    final pendingLogbooks = results[1]
        .map((logbook) => {...logbook, '_shift_record_type': 'logbook_review'})
        .toList();
    final linkedShiftIds = pendingLogbooks
        .expand((logbook) => [
              '${logbook['cashier_shift_id'] ?? ''}',
              '${logbook['outlet_shift_id'] ?? ''}',
            ])
        .where((id) => id.trim().isNotEmpty)
        .toSet();
    final closedShifts = results[2]
        .where((shift) => !linkedShiftIds.contains('${shift['id'] ?? ''}'))
        .map((shift) => {...shift, '_shift_record_type': 'closed_shift'})
        .toList();
    return [
      ...pendingOpenings,
      ...pendingLogbooks,
      ...closedShifts,
    ];
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  void _refresh() => setState(() {
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (items) {
          if (items.isNotEmpty && _selectedShiftId == null) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted && _selectedShiftId == null) {
                _selectShift(items.first, clearNotes: false);
              }
            });
          }

          final selected = _currentSelected(items);

          return _Page(
            title: 'Shift Reconciliation',
            subtitle:
                'Approve cashier shift openings and reconcile closed shifts',
            actions: [
              _RefreshButton(onPressed: _refresh),
            ],
            children: [
              LayoutBuilder(
                builder: (context, constraints) {
                  final shiftList = _ShiftReconciliationList(
                    shifts: items,
                    selectedId: _selectedShiftId,
                    onSelect: _selectShift,
                  );
                  final detailPanel = _ShiftReconciliationPanel(
                    shift: selected,
                    loading: _loadingDetail,
                    notesController: _notesController,
                    onApproveOpening: selected == null
                        ? null
                        : () => _approveOpening(selected),
                    onRejectOpening: selected == null
                        ? null
                        : () => _rejectOpening(selected),
                    onReconcile: selected == null
                        ? null
                        : () => _reconcileSelected(selected),
                  );

                  if (constraints.maxWidth < 980) {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        shiftList,
                        const SizedBox(height: 18),
                        detailPanel,
                      ],
                    );
                  }

                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: shiftList),
                      const SizedBox(width: 24),
                      Expanded(child: detailPanel),
                    ],
                  );
                },
              ),
            ],
          );
        },
      ),
    );
  }

  Map<String, dynamic>? _currentSelected(List<Map<String, dynamic>> items) {
    if (_selectedDetail != null) return _selectedDetail;
    if (_selectedShift != null) return _selectedShift;
    if (items.isEmpty) return null;
    if (_selectedShiftId == null) return items.first;
    return items.firstWhere(
      (shift) => '${shift['id']}' == _selectedShiftId,
      orElse: () => items.first,
    );
  }

  void _selectShift(
    Map<String, dynamic> shift, {
    bool clearNotes = true,
  }) {
    final id = '${shift['id'] ?? ''}'.trim();
    setState(() {
      _selectedShiftId = id.isEmpty ? null : id;
      _selectedShift = shift;
      _selectedDetail = null;
      _loadingDetail = id.isNotEmpty;
      if (clearNotes) _notesController.clear();
    });

    if (id.isEmpty) return;

    final detailRequest = _isShiftLogbookReview(shift)
        ? ref
            .read(branchAccountantRepositoryProvider)
            .getCashierLogbookDetail(id)
        : ref.read(branchAccountantRepositoryProvider).getShiftLog(id);

    detailRequest.then((detail) {
      if (!mounted) return;
      if (_selectedShiftId != id) return;
      setState(() {
        _selectedDetail = {
          ...shift,
          ...detail,
          '_shift_record_type': shift['_shift_record_type'],
          '_queue_id': id,
        };
        _loadingDetail = false;
      });
    }).catchError((_) {
      if (!mounted) return;
      if (_selectedShiftId != id) return;
      setState(() => _loadingDetail = false);
      _notify(context,
          'Could not load full shift details. Showing available shift summary.');
    });
  }

  Future<void> _reconcileSelected(Map<String, dynamic> shift) async {
    final repo = ref.read(branchAccountantRepositoryProvider);
    if (_isShiftLogbookReview(shift)) {
      await repo.auditCashierLogbook(
        '${shift['_queue_id'] ?? shift['id']}',
        approve: true,
        notes: _notesController.text.trim(),
      );
      _toast('Lina shift logbook approved');
    } else {
      await repo.reconcileShift('${shift['id']}', _notesController.text.trim());
      _toast('Shift reconciled');
    }
    _notesController.clear();
    _selectedShiftId = null;
    _selectedShift = null;
    _selectedDetail = null;
    _refresh();
  }

  Future<void> _approveOpening(Map<String, dynamic> shift) async {
    await ref
        .read(branchAccountantRepositoryProvider)
        .approveShiftOpening('${shift['id']}', notes: _notesController.text);
    _toast('Cashier shift opened');
    _notesController.clear();
    _selectedShiftId = null;
    _selectedShift = null;
    _selectedDetail = null;
    _refresh();
  }

  Future<void> _rejectOpening(Map<String, dynamic> shift) async {
    await ref
        .read(branchAccountantRepositoryProvider)
        .rejectShiftOpening('${shift['id']}', notes: _notesController.text);
    _toast('Shift opening request rejected');
    _notesController.clear();
    _selectedShiftId = null;
    _selectedShift = null;
    _selectedDetail = null;
    _refresh();
  }
}

class _ShiftReconciliationList extends StatelessWidget {
  const _ShiftReconciliationList({
    required this.shifts,
    required this.selectedId,
    required this.onSelect,
  });

  final List<Map<String, dynamic>> shifts;
  final String? selectedId;
  final ValueChanged<Map<String, dynamic>> onSelect;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Shift Opening & Reconciliation Queue',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 14),
        if (shifts.isEmpty)
          const _SectionCard(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 34),
              child: Column(
                children: [
                  Icon(Icons.check_circle_outline,
                      color: Colors.green, size: 48),
                  SizedBox(height: 10),
                  Text(
                    'All shifts processed',
                    style: TextStyle(color: AppColors.kTextSecondary),
                  ),
                ],
              ),
            ),
          )
        else
          ...shifts.map(
            (shift) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _ShiftReconciliationCard(
                shift: shift,
                selected: '${shift['id']}' == selectedId,
                onTap: () => onSelect(shift),
              ),
            ),
          ),
      ],
    );
  }
}

class _ShiftReconciliationCard extends StatelessWidget {
  const _ShiftReconciliationCard({
    required this.shift,
    required this.selected,
    required this.onTap,
  });

  final Map<String, dynamic> shift;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final variance = _shiftVariance(shift);
    final status = _firstTextFrom(shift, ['status']).toLowerCase();
    final isOpeningRequest = status == 'pending_open';
    final isLogbook = _isShiftLogbookReview(shift);
    final varianceColor = variance == 0
        ? Colors.green.shade700
        : variance.abs() < 100
            ? Colors.orange.shade700
            : Colors.red.shade700;
    final module = _firstTextFrom(shift, ['module'], fallback: 'standard');

    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? Colors.orange : AppColors.kDivider,
            width: selected ? 2 : 1,
          ),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.06),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Wrap(
                    spacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        _firstTextFrom(shift, ['shift_number', 'id'],
                            fallback: 'Shift'),
                        style: const TextStyle(
                            fontSize: 18, fontWeight: FontWeight.w900),
                      ),
                      _MiniBadge(
                        isOpeningRequest
                            ? 'PENDING OPEN'
                            : isLogbook
                                ? 'LINA LOGBOOK'
                                : module.toLowerCase() == 'kyogong'
                                    ? 'KYOGONG'
                                    : 'FAMOUS GATE',
                      ),
                    ],
                  ),
                ),
                Text(
                  _shortDate(_firstTextFrom(
                      shift, ['shift_start', 'created_at', 'opened_at'])),
                  style: const TextStyle(color: AppColors.kTextSecondary),
                ),
              ],
            ),
            const SizedBox(height: 18),
            LayoutBuilder(
              builder: (context, constraints) {
                final narrow = constraints.maxWidth < 420;
                final children = [
                  _ShiftCardField(
                    label: 'Cashier',
                    value: _firstTextFrom(
                      shift,
                      ['cashier_name', 'cashier', 'user_name'],
                      fallback: _shiftCashierName(shift),
                    ),
                  ),
                  _ShiftCardField(
                    label: isOpeningRequest ? 'Opening Float' : 'Sales',
                    value: _money(isOpeningRequest
                        ? _firstNumFrom(shift, ['opening_float'])
                        : _shiftTotalSales(shift)),
                    valueColor: isOpeningRequest
                        ? Colors.orange.shade700
                        : Colors.green.shade700,
                  ),
                  _ShiftCardField(
                    label: isOpeningRequest ? 'Requested' : 'Variance',
                    value: isOpeningRequest
                        ? _shortDate(_firstTextFrom(
                            shift, ['requested_at', 'created_at']))
                        : variance > 0
                            ? '+${_money(variance)}'
                            : _money(variance),
                    valueColor: isOpeningRequest
                        ? AppColors.kTextPrimary
                        : varianceColor,
                  ),
                ];

                if (narrow) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: children
                        .map((child) => Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: child,
                            ))
                        .toList(),
                  );
                }

                return Row(
                  children: children
                      .map((child) => Expanded(child: child))
                      .toList(growable: false),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _ShiftCardField extends StatelessWidget {
  const _ShiftCardField({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: AppColors.kTextSecondary,
            fontSize: 12,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          value,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: valueColor ?? AppColors.kTextPrimary,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }
}

class _MiniBadge extends StatelessWidget {
  const _MiniBadge(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.kSurface,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.kDivider),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w900,
          color: AppColors.kTextSecondary,
        ),
      ),
    );
  }
}

class _ShiftReconciliationPanel extends StatelessWidget {
  const _ShiftReconciliationPanel({
    required this.shift,
    required this.loading,
    required this.notesController,
    required this.onApproveOpening,
    required this.onRejectOpening,
    required this.onReconcile,
  });

  final Map<String, dynamic>? shift;
  final bool loading;
  final TextEditingController notesController;
  final VoidCallback? onApproveOpening;
  final VoidCallback? onRejectOpening;
  final VoidCallback? onReconcile;

  @override
  Widget build(BuildContext context) {
    if (shift == null) {
      return Container(
        constraints: const BoxConstraints(minHeight: 420),
        alignment: Alignment.center,
        child: const Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.warning_amber_rounded,
                color: AppColors.kTextSecondary, size: 46),
            SizedBox(height: 10),
            Text(
              'Select a shift to review',
              style: TextStyle(color: AppColors.kTextSecondary),
            ),
          ],
        ),
      );
    }

    final status = _firstTextFrom(shift!, ['status']).toLowerCase();
    final openingRequest = status == 'pending_open';
    final shiftTitle =
        _firstTextFrom(shift!, ['shift_number', 'id'], fallback: 'Shift');

    if (openingRequest) {
      return _SectionCard(
        title: 'Shift Opening Request — $shiftTitle',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (loading) ...[
              const LinearProgressIndicator(minHeight: 2),
              const SizedBox(height: 12),
            ],
            _ShiftReportSection(
              number: '1.',
              title: 'Opening Approval',
              rows: [
                _ShiftReportRow(
                  'Cashier',
                  _firstTextFrom(
                    shift!,
                    ['cashier_name', 'cashier', 'user_name'],
                    fallback: 'N/A',
                  ),
                  emphasized: true,
                ),
                _ShiftReportRow(
                  'Opening Float',
                  _money(_firstNumFrom(shift!, ['opening_float'])),
                  emphasized: true,
                ),
                _ShiftReportRow(
                  'Requested At',
                  _shortDate(_firstTextFrom(
                    shift!,
                    ['requested_at', 'created_at'],
                  )),
                ),
                const _ShiftReportRow(
                  'Status',
                  'Pending branch accountant approval',
                  emphasized: true,
                ),
              ],
            ),
            const SizedBox(height: 18),
            const Text(
              'Review Notes',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: notesController,
              minLines: 4,
              maxLines: 6,
              decoration: const InputDecoration(
                hintText: 'Add notes for the cashier...',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 14),
            LayoutBuilder(
              builder: (context, constraints) {
                final buttons = [
                  OutlinedButton.icon(
                    onPressed: onRejectOpening,
                    icon: const Icon(Icons.cancel_outlined),
                    label: const Text('Reject Request'),
                  ),
                  FilledButton.icon(
                    onPressed: onApproveOpening,
                    icon: const Icon(Icons.check_circle_outline),
                    label: const Text('Approve & Open Shift'),
                  ),
                ];

                if (constraints.maxWidth < 520) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SizedBox(height: 50, child: buttons[0]),
                      const SizedBox(height: 10),
                      SizedBox(height: 50, child: buttons[1]),
                    ],
                  );
                }

                return Row(
                  children: [
                    Expanded(child: SizedBox(height: 50, child: buttons[0])),
                    const SizedBox(width: 12),
                    Expanded(child: SizedBox(height: 50, child: buttons[1])),
                  ],
                );
              },
            ),
          ],
        ),
      );
    }

    final reconciliation = _shiftCashReconciliation(shift!);
    final summary = _map(shift!['summary']);
    final payments = _shiftPaymentRows(shift!);
    final revenue = _shiftRevenueRows(shift!);
    final lines = _shiftTransactionLines(shift!);
    final creditBills = _shiftCreditBills(shift!);
    final paidBills = _shiftPaidBills(shift!);
    final totalSales = _shiftTotalSales(shift!);
    final transactionCount = _shiftTransactionCount(shift!);
    final creditBillsTotal = _creditBillsCreated(shift!);
    final paidBillsTotal = _creditBillsPaid(shift!);
    final changeGiven = _num(reconciliation['change_given']);
    final titlePrefix =
        _isShiftLogbookReview(shift!) ? 'Lina Shift Logbook' : 'Shift Details';

    return _SectionCard(
      title: '$titlePrefix — $shiftTitle',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (loading) ...[
            const LinearProgressIndicator(minHeight: 2),
            const SizedBox(height: 12),
          ],
          _ResponsiveGrid(
            children: [
              _MetricCard(
                'Total Sales',
                _money(totalSales),
                Icons.point_of_sale,
                Colors.green,
              ),
              _MetricCard(
                'Orders / POS Bills',
                '${transactionCount.toInt()}',
                Icons.receipt_long,
                AppColors.kPrimary,
              ),
              _MetricCard(
                'Cash Change Given',
                _money(changeGiven),
                Icons.currency_exchange,
                Colors.orange,
              ),
              _MetricCard(
                'Credit Bills',
                _money(creditBillsTotal),
                Icons.badge_outlined,
                Colors.red,
              ),
              _MetricCard(
                'Paid Credit Bills',
                _money(paidBillsTotal),
                Icons.account_balance_wallet,
                Colors.teal,
              ),
              _MetricCard(
                'Variance',
                _money(_varianceAmount(shift!)),
                Icons.warning_amber,
                _varianceAmount(shift!).abs() < 0.01
                    ? Colors.green
                    : Colors.red,
              ),
            ],
          ),
          const SizedBox(height: 14),
          _ShiftReportSection(
            number: '1.',
            title: 'Cash Drawer & Change Trace',
            rows: [
              _ShiftReportRow('Opening Float', _money(_openingFloat(shift!))),
              _ShiftReportRow('+ Cash Sales', _money(_cashSales(shift!))),
              _ShiftReportRow(
                'Cash Tendered by Customers',
                _money(_num(reconciliation['cash_tendered'])),
              ),
              _ShiftReportRow(
                '- Change Given',
                _money(changeGiven),
                emphasized: changeGiven > 0,
              ),
              _ShiftReportRow(
                '= Net Drawer Cash From Sales',
                _money(_num(reconciliation['drawer_cash_in'])),
                emphasized: true,
              ),
              _ShiftReportRow('+ Credit Payments Received',
                  _money(_creditPaymentsReceived(shift!))),
              _ShiftReportRow(
                  '- Cash Drops', _money(_num(reconciliation['cash_drops']))),
              _ShiftReportRow(
                  '- Payouts', _money(_num(reconciliation['payouts']))),
              _ShiftReportRow(
                '= Expected Closing Amount',
                _money(_expectedClosingAmount(shift!)),
                emphasized: true,
              ),
              _ShiftReportRow(
                'Actual Cash Counted',
                _money(_actualCashCounted(shift!)),
                emphasized: true,
              ),
            ],
          ),
          const SizedBox(height: 14),
          _TwoColumn(
            left: _SectionCard(
              title: 'Sales by Payment Method',
              child: _LogbookBreakdownList(
                rows: payments,
                labelKey: 'method',
                amountKey: 'amount',
                countKey: 'count',
                emptyText: 'No payment methods captured',
              ),
            ),
            right: _SectionCard(
              title: 'Sales by Revenue System / Outlet',
              child: _LogbookBreakdownList(
                rows: revenue,
                labelKey: 'label',
                amountKey: 'amount',
                emptyText: 'No outlet or revenue stream captured',
              ),
            ),
          ),
          const SizedBox(height: 14),
          _ShiftPaymentEvidenceGroups(lines: lines),
          const SizedBox(height: 14),
          _ShiftOutletEvidenceGroups(shift: shift!, lines: lines),
          const SizedBox(height: 14),
          _TwoColumn(
            left: _SectionCard(
              title: 'Credit Bill Summary',
              child: _ShiftCreditBillSummary(
                creditBills: creditBills,
                total: creditBillsTotal,
                outstanding: _outstandingCredit(shift!),
              ),
            ),
            right: _SectionCard(
              title: 'Paid Credits Pending Application',
              child: _ShiftPaidBillsSummary(
                paidBills: paidBills,
                total: paidBillsTotal,
                fallbackCount: _num(summary['paid_bills_count']).toInt(),
              ),
            ),
          ),
          const SizedBox(height: 14),
          _VarianceAnalysisBox(shift: shift!),
          const SizedBox(height: 14),
          _SectionCard(
            title: 'Full POS Bill & Order Evidence',
            child: _LogbookEvidenceTable(lines: lines),
          ),
          const SizedBox(height: 14),
          if (!_isShiftLogbookReview(shift!))
            _ShiftCollectionsAndExpensesSection(
              shiftId: _firstTextFrom(shift!, ['id']),
              systemAmounts: {
                'mpesa': _num(payments.firstWhere(
                    (p) => '${p['method']}'.toLowerCase().contains('mpesa'),
                    orElse: () => const {})['amount']),
                'cash': _num(payments.firstWhere(
                    (p) => '${p['method']}'.toLowerCase().contains('cash'),
                    orElse: () => const {})['amount']),
                'card': _num(payments.firstWhere(
                    (p) => '${p['method']}'.toLowerCase().contains('card'),
                    orElse: () => const {})['amount']),
                'credit': creditBillsTotal,
              },
            ),
          const SizedBox(height: 18),
          const Text(
            'Reconciliation Notes',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: notesController,
            minLines: 4,
            maxLines: 6,
            decoration: const InputDecoration(
              hintText: 'Add notes or comments...',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 56,
            child: FilledButton.icon(
              onPressed: status == 'closed' ? onReconcile : null,
              icon: const Icon(Icons.check_circle_outline),
              label: const Text('Reconcile Shift'),
            ),
          ),
        ],
      ),
    );
  }
}

const _reconciliationMethodLabels = {
  'mpesa': 'Mpesa',
  'cash': 'Cash',
  'card': 'Card',
  'credit': 'Credit',
};
const _reconciliationExpenseCategoryLabels = {
  'petty_cash': 'Petty Cash',
  'transaction_cost': 'Transaction Cost',
  'other': 'Other',
};

/// Section A (actual collections vs system amounts) and Section B (shift
/// expenses) for a closed cashier shift being reconciled. Self-contained —
/// fetches and submits independently of the parent panel.
class _ShiftCollectionsAndExpensesSection extends ConsumerStatefulWidget {
  const _ShiftCollectionsAndExpensesSection({
    required this.shiftId,
    required this.systemAmounts,
  });

  final String shiftId;
  final Map<String, num> systemAmounts;

  @override
  ConsumerState<_ShiftCollectionsAndExpensesSection> createState() =>
      _ShiftCollectionsAndExpensesSectionState();
}

class _ShiftCollectionsAndExpensesSectionState
    extends ConsumerState<_ShiftCollectionsAndExpensesSection> {
  late Future<Map<String, dynamic>> _future = _load();
  final Map<String, TextEditingController> _actualCtrls = {
    'mpesa': TextEditingController(),
    'cash': TextEditingController(),
    'card': TextEditingController(),
    'credit': TextEditingController(),
  };
  bool _submittingCollections = false;
  bool _showExpenseForm = false;
  String _expenseCategory = 'petty_cash';
  final _expenseAmountCtrl = TextEditingController();
  final _expenseDescriptionCtrl = TextEditingController();
  bool _submittingExpense = false;

  Future<Map<String, dynamic>> _load() => ref
      .read(branchAccountantRepositoryProvider)
      .getShiftReconciliation(widget.shiftId);

  @override
  void didUpdateWidget(covariant _ShiftCollectionsAndExpensesSection old) {
    super.didUpdateWidget(old);
    if (old.shiftId != widget.shiftId) {
      setState(() => _future = _load());
    }
  }

  @override
  void dispose() {
    for (final c in _actualCtrls.values) {
      c.dispose();
    }
    _expenseAmountCtrl.dispose();
    _expenseDescriptionCtrl.dispose();
    super.dispose();
  }

  void _refresh() => setState(() => _future = _load());

  Future<void> _submitCollections() async {
    setState(() => _submittingCollections = true);
    try {
      final repo = ref.read(branchAccountantRepositoryProvider);
      for (final method in const ['mpesa', 'cash', 'card', 'credit']) {
        final actual = double.tryParse(_actualCtrls[method]!.text.trim());
        if (actual == null) continue;
        await repo.addShiftActualCollection(
          widget.shiftId,
          paymentMethod: method,
          systemAmount: widget.systemAmounts[method] ?? 0,
          actualAmount: actual,
        );
      }
      if (mounted) {
        _notify(context, 'Collections submitted');
        _refresh();
      }
    } catch (e) {
      if (mounted) _notify(context, 'Failed to submit collections: $e');
    } finally {
      if (mounted) setState(() => _submittingCollections = false);
    }
  }

  Future<void> _submitExpense() async {
    final amount = double.tryParse(_expenseAmountCtrl.text.trim()) ?? 0;
    if (amount <= 0) {
      _notify(context, 'Enter a valid expense amount');
      return;
    }
    setState(() => _submittingExpense = true);
    try {
      await ref
          .read(branchAccountantRepositoryProvider)
          .addShiftReconciliationExpense(
            widget.shiftId,
            category: _expenseCategory,
            amount: amount,
            description: _expenseDescriptionCtrl.text.trim(),
          );
      _expenseAmountCtrl.clear();
      _expenseDescriptionCtrl.clear();
      if (mounted) {
        setState(() => _showExpenseForm = false);
        _notify(context, 'Expense recorded');
        _refresh();
      }
    } catch (e) {
      if (mounted) _notify(context, 'Failed to record expense: $e');
    } finally {
      if (mounted) setState(() => _submittingExpense = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: LinearProgressIndicator(minHeight: 2),
          );
        }
        final data = _map(snap.data?['data']).isNotEmpty
            ? _map(snap.data?['data'])
            : _map(snap.data);
        final collections = _list(data['actual_collections']);
        final expenses = _list(data['reconciliation_expenses']);
        final collectedByMethod = {
          for (final c in collections) _text(c, ['payment_method']): c,
        };

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _SectionCard(
              title: 'Section A — Actual Collections',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Table(
                    columnWidths: const {
                      0: FlexColumnWidth(2),
                      1: FlexColumnWidth(2),
                      2: FlexColumnWidth(2),
                      3: FlexColumnWidth(2),
                    },
                    children: [
                      const TableRow(children: [
                        Padding(
                          padding: EdgeInsets.symmetric(vertical: 8),
                          child: Text('Method',
                              style: TextStyle(fontWeight: FontWeight.w800)),
                        ),
                        Padding(
                          padding: EdgeInsets.symmetric(vertical: 8),
                          child: Text('System Amount',
                              style: TextStyle(fontWeight: FontWeight.w800)),
                        ),
                        Padding(
                          padding: EdgeInsets.symmetric(vertical: 8),
                          child: Text('Actual Amount',
                              style: TextStyle(fontWeight: FontWeight.w800)),
                        ),
                        Padding(
                          padding: EdgeInsets.symmetric(vertical: 8),
                          child: Text('Variance',
                              style: TextStyle(fontWeight: FontWeight.w800)),
                        ),
                      ]),
                      for (final method in const [
                        'mpesa',
                        'cash',
                        'card',
                        'credit'
                      ])
                        _buildCollectionRow(method, collectedByMethod),
                    ],
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    height: 44,
                    child: FilledButton.icon(
                      onPressed:
                          _submittingCollections ? null : _submitCollections,
                      icon: const Icon(Icons.check_circle_outline),
                      label: Text(_submittingCollections
                          ? 'Submitting…'
                          : 'Submit Collections'),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            _SectionCard(
              title: 'Section B — Shift Expenses',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (expenses.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: Text('No expenses recorded for this shift.'),
                    )
                  else
                    ...expenses.map((e) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(
                            children: [
                              _CashFlowCategoryBadge(
                                  category: _text(e, ['category'])),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  _text(e, ['description']).isEmpty
                                      ? (_reconciliationExpenseCategoryLabels[
                                              _text(e, ['category'])] ??
                                          _text(e, ['category']))
                                      : _text(e, ['description']),
                                ),
                              ),
                              Text(_money(_num(e['amount'])),
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w800)),
                            ],
                          ),
                        )),
                  const SizedBox(height: 8),
                  if (_showExpenseForm) ...[
                    Row(children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: _expenseCategory,
                          decoration:
                              const InputDecoration(labelText: 'Category'),
                          items: const ['petty_cash', 'transaction_cost']
                              .map((k) => DropdownMenuItem(
                                    value: k,
                                    child: Text(
                                        _reconciliationExpenseCategoryLabels[
                                                k] ??
                                            k),
                                  ))
                              .toList(),
                          onChanged: (v) =>
                              setState(() => _expenseCategory = v!),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: _expenseAmountCtrl,
                          keyboardType: const TextInputType.numberWithOptions(
                              decimal: true),
                          decoration:
                              const InputDecoration(labelText: 'Amount'),
                        ),
                      ),
                    ]),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _expenseDescriptionCtrl,
                      decoration:
                          const InputDecoration(labelText: 'Description'),
                    ),
                    const SizedBox(height: 10),
                    Row(children: [
                      OutlinedButton(
                        onPressed: () =>
                            setState(() => _showExpenseForm = false),
                        child: const Text('Cancel'),
                      ),
                      const SizedBox(width: 10),
                      FilledButton(
                        onPressed:
                            _submittingExpense ? null : _submitExpense,
                        child: Text(
                            _submittingExpense ? 'Saving…' : 'Save Expense'),
                      ),
                    ]),
                  ] else
                    OutlinedButton.icon(
                      onPressed: () => setState(() => _showExpenseForm = true),
                      icon: const Icon(Icons.add),
                      label: const Text('Add Expense'),
                    ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  TableRow _buildCollectionRow(
      String method, Map<String, Map<String, dynamic>> collectedByMethod) {
    final existing = collectedByMethod[method];
    final systemAmount = widget.systemAmounts[method] ?? 0;
    if (existing != null) {
      final actual = _num(existing['actual_amount']);
      final variance = actual - _num(existing['system_amount']);
      return TableRow(children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text(_reconciliationMethodLabels[method] ?? method),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text(_money(_num(existing['system_amount']))),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text(_money(actual)),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text(_money(variance),
              style: TextStyle(
                  color: variance.abs() < 0.01 ? Colors.green : Colors.red,
                  fontWeight: FontWeight.w700)),
        ),
      ]);
    }
    final ctrl = _actualCtrls[method]!;
    return TableRow(children: [
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Text(_reconciliationMethodLabels[method] ?? method),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Text(_money(systemAmount)),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: TextField(
          controller: ctrl,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(isDense: true, hintText: '0.00'),
          onChanged: (_) => setState(() {}),
        ),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Builder(builder: (context) {
          final actual = double.tryParse(ctrl.text.trim());
          if (actual == null) return const Text('—');
          final variance = actual - systemAmount;
          return Text(_money(variance),
              style: TextStyle(
                  color: variance.abs() < 0.01 ? Colors.green : Colors.red,
                  fontWeight: FontWeight.w700));
        }),
      ),
    ]);
  }
}

class _ShiftReportSection extends StatelessWidget {
  const _ShiftReportSection({
    required this.number,
    required this.title,
    required this.rows,
  });

  final String number;
  final String title;
  final List<_ShiftReportRow> rows;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.kDivider),
      ),
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            decoration: const BoxDecoration(
              color: AppColors.kSurface,
              borderRadius: BorderRadius.vertical(top: Radius.circular(14)),
            ),
            child: Text(
              '$number  ${title.toUpperCase()}',
              style: const TextStyle(
                color: AppColors.kTextSecondary,
                fontSize: 12,
                letterSpacing: 1.4,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          ...rows,
        ],
      ),
    );
  }
}

class _ShiftReportRow extends StatelessWidget {
  const _ShiftReportRow(
    this.label,
    this.value, {
    this.emphasized = false,
  });

  final String label;
  final String value;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(
      fontWeight: emphasized ? FontWeight.w900 : FontWeight.w700,
      color: emphasized ? AppColors.kTextPrimary : AppColors.kTextSecondary,
    );
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.kDivider)),
      ),
      child: Row(
        children: [
          Expanded(child: Text(label, style: style)),
          Text(value, textAlign: TextAlign.right, style: style),
        ],
      ),
    );
  }
}

class _VarianceAnalysisBox extends StatelessWidget {
  const _VarianceAnalysisBox({required this.shift});

  final Map<String, dynamic> shift;

  @override
  Widget build(BuildContext context) {
    final expected = _expectedClosingAmount(shift);
    final actual = _actualCashCounted(shift);
    final variance = _varianceAmount(shift);
    final balanced = variance.abs() < 0.01;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: balanced ? Colors.green.shade50 : Colors.orange.shade50,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: balanced ? Colors.green.shade200 : Colors.orange.shade200,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '5.  VARIANCE ANALYSIS',
            style: TextStyle(
              color: AppColors.kTextSecondary,
              fontSize: 12,
              letterSpacing: 1.4,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            'Opening Float (${_money(_openingFloat(shift))}) + Cash Sales (${_money(_cashSales(shift))}) + Credit Paid (${_money(_creditPaymentsReceived(shift))}) = Expected (${_money(expected)})\n'
            'Actual (${_money(actual)}) - Expected (${_money(expected)}) = Variance',
            style: const TextStyle(color: AppColors.kTextSecondary),
          ),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.72),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(
                  balanced
                      ? Icons.check_circle_outline
                      : Icons.warning_amber_rounded,
                  color: balanced ? Colors.green.shade700 : Colors.orange,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    balanced ? 'BALANCED' : 'VARIANCE FOUND',
                    style: TextStyle(
                      color: balanced ? Colors.green.shade700 : Colors.orange,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                Text(
                  '${variance >= 0 ? '+' : '-'}${_money(variance.abs())}',
                  style: TextStyle(
                    color: balanced ? Colors.green.shade700 : Colors.orange,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
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

class _ShiftPaymentEvidenceGroups extends StatelessWidget {
  const _ShiftPaymentEvidenceGroups({required this.lines});

  final List<Map<String, dynamic>> lines;

  @override
  Widget build(BuildContext context) {
    final groups = _groupShiftLines(lines, (line) {
      final method = _text(line, ['payment_method']);
      return method.isEmpty ? 'other' : method;
    });
    return _ShiftEvidenceGroups(
      title: 'POS Bills & Orders Aligned to Payment Method',
      emptyText: 'No POS bills or order lines were attached to this shift.',
      groups: groups,
      labelBuilder: (key) => _title(key),
    );
  }
}

class _ShiftOutletEvidenceGroups extends StatelessWidget {
  const _ShiftOutletEvidenceGroups({
    required this.shift,
    required this.lines,
  });

  final Map<String, dynamic> shift;
  final List<Map<String, dynamic>> lines;

  @override
  Widget build(BuildContext context) {
    final groups = _groupShiftLines(
      lines,
      (line) => _shiftRevenueSystemLabel(shift, line),
    );
    return _ShiftEvidenceGroups(
      title: 'Sales by POS Outlet / Revenue System',
      emptyText: 'No POS outlet evidence was attached to this shift.',
      groups: groups,
      labelBuilder: (key) => key,
    );
  }
}

class _ShiftEvidenceGroups extends StatelessWidget {
  const _ShiftEvidenceGroups({
    required this.title,
    required this.emptyText,
    required this.groups,
    required this.labelBuilder,
  });

  final String title;
  final String emptyText;
  final Map<String, List<Map<String, dynamic>>> groups;
  final String Function(String key) labelBuilder;

  @override
  Widget build(BuildContext context) {
    if (groups.isEmpty) {
      return _SectionCard(
        title: title,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Text(
            emptyText,
            style: const TextStyle(color: AppColors.kTextSecondary),
          ),
        ),
      );
    }

    return _SectionCard(
      title: title,
      child: Column(
        children: groups.entries.map((entry) {
          final total = entry.value.fold<num>(
            0,
            (sum, line) => sum + _num(line['amount']),
          );
          return Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppColors.kSurface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.kDivider),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          labelBuilder(entry.key),
                          style: const TextStyle(fontWeight: FontWeight.w900),
                        ),
                      ),
                      Text(
                        '${entry.value.length} line${entry.value.length == 1 ? '' : 's'}',
                        style: const TextStyle(
                          color: AppColors.kTextSecondary,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Text(
                        _money(total),
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                _SimpleTable(
                  columns: const [
                    'Time',
                    'Reference',
                    'Customer / Staff',
                    'Source',
                    'Tendered',
                    'Change',
                    'Amount',
                  ],
                  rows: entry.value.map<List<Object>>((line) {
                    return [
                      _formatCompactDateTime(_text(line, ['created_at'])),
                      _text(line, ['reference']).isEmpty
                          ? '-'
                          : _text(line, ['reference']),
                      _text(line, ['customer_name']).isEmpty
                          ? '-'
                          : _text(line, ['customer_name']),
                      _title(_text(line, ['section', 'source_table'])),
                      _num(line['amount_tendered']) > 0
                          ? _money(_num(line['amount_tendered']))
                          : '-',
                      _num(line['change_given']) > 0
                          ? _money(_num(line['change_given']))
                          : '-',
                      _money(_num(line['amount'])),
                    ];
                  }).toList(),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _ShiftCreditBillSummary extends StatelessWidget {
  const _ShiftCreditBillSummary({
    required this.creditBills,
    required this.total,
    required this.outstanding,
  });

  final List<Map<String, dynamic>> creditBills;
  final num total;
  final num outstanding;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _KeyValueList({
          'credit_bills_created': total,
          'credit_bill_count': creditBills.length,
          'outstanding_credit': outstanding,
        }),
        const SizedBox(height: 12),
        _SimpleTable(
          columns: const [
            'Staff',
            'Reference',
            'Department',
            'Status',
            'Amount'
          ],
          rows: creditBills.map<List<Object>>((bill) {
            return [
              _text(bill, ['staff_name', 'customer_name', 'name']).isEmpty
                  ? 'Staff'
                  : _text(bill, ['staff_name', 'customer_name', 'name']),
              _text(bill, ['credit_number', 'reference']).isEmpty
                  ? '-'
                  : _text(bill, ['credit_number', 'reference']),
              _text(bill, ['department']).isEmpty
                  ? '-'
                  : _text(bill, ['department']),
              _text(bill, ['status']).isEmpty ? '-' : _text(bill, ['status']),
              _money(_num(bill['amount'])),
            ];
          }).toList(),
        ),
      ],
    );
  }
}

class _ShiftPaidBillsSummary extends StatelessWidget {
  const _ShiftPaidBillsSummary({
    required this.paidBills,
    required this.total,
    required this.fallbackCount,
  });

  final List<Map<String, dynamic>> paidBills;
  final num total;
  final int fallbackCount;

  @override
  Widget build(BuildContext context) {
    final count = paidBills.isNotEmpty ? paidBills.length : fallbackCount;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _KeyValueList({
          'paid_credit_bills': total,
          'paid_bill_count': count,
          'accounting_status': 'Pending branch accountant application',
        }),
        const SizedBox(height: 12),
        _SimpleTable(
          columns: const [
            'Staff',
            'Method',
            'Reference',
            'Application Status',
            'Amount'
          ],
          rows: paidBills.map<List<Object>>((bill) {
            return [
              _text(bill, ['name', 'staff_name', 'customer_name']).isEmpty
                  ? 'Staff'
                  : _text(bill, ['name', 'staff_name', 'customer_name']),
              _title(_text(bill, ['payment_method'])),
              _text(bill, ['reference']).isEmpty
                  ? '-'
                  : _text(bill, ['reference']),
              _text(bill, ['review_status']).isEmpty
                  ? 'Pending application'
                  : _title(_text(bill, ['review_status'])),
              _money(_num(bill['amount'])),
            ];
          }).toList(),
        ),
      ],
    );
  }
}

String _shiftRecordKind(Map<String, dynamic> shift) =>
    _text(shift, ['_shift_record_type']);

bool _isShiftLogbookReview(Map<String, dynamic> shift) =>
    _shiftRecordKind(shift) == 'logbook_review' ||
    (_text(shift, ['source']).contains('shift') &&
        _text(shift, ['status']) == 'pending_accountant_review');

String _shiftCashierName(Map<String, dynamic> shift) {
  final cashier = _map(shift['cashier']);
  final name =
      '${_text(cashier, ['first_name'])} ${_text(cashier, ['last_name'])}'
          .trim();
  if (name.isNotEmpty) return name;
  return _text(shift, ['cashier_name', 'cashier', 'user_name']);
}

Map<String, dynamic> _shiftSalesBreakdown(Map<String, dynamic> shift) =>
    _map(shift['sales_breakdown']);

Map<String, dynamic> _shiftCashReconciliation(Map<String, dynamic> shift) =>
    _map(shift['cash_reconciliation']);

List<Map<String, dynamic>> _shiftPaymentRows(Map<String, dynamic> shift) {
  final rows = _list(shift['payment_breakdown']);
  if (rows.isNotEmpty) return rows;
  return [
    {'method': 'cash', 'amount': _cashSales(shift), 'count': 0},
    {'method': 'mpesa', 'amount': _mpesaSales(shift), 'count': 0},
    {'method': 'card', 'amount': _cardSales(shift), 'count': 0},
    {'method': 'credit_bill', 'amount': _creditBillsCreated(shift), 'count': 0},
    {'method': 'other', 'amount': _otherSales(shift), 'count': 0},
  ].where((row) => _num(row['amount']) > 0).toList();
}

List<Map<String, dynamic>> _shiftRevenueRows(Map<String, dynamic> shift) {
  final rows = _list(shift['revenue_breakdown'])
      .where((row) => _num(row['amount']) > 0)
      .toList();
  if (rows.isNotEmpty) return rows;
  return [
    {'label': 'Restaurant', 'amount': _restaurantRevenue(shift)},
    {'label': 'Bar', 'amount': _barRevenue(shift)},
    {'label': 'Rooms', 'amount': _roomRevenue(shift)},
    {'label': 'Other', 'amount': _otherRevenue(shift)},
  ].where((row) => _num(row['amount']) > 0).toList();
}

List<Map<String, dynamic>> _shiftTransactionLines(Map<String, dynamic> shift) {
  final history = _list(shift['transaction_history']);
  if (history.isNotEmpty) return history;
  return _list(shift['lines']);
}

List<Map<String, dynamic>> _shiftCreditBills(Map<String, dynamic> shift) {
  final direct = _list(shift['credit_bills']);
  if (direct.isNotEmpty) return direct;
  final breakdown = _shiftSalesBreakdown(shift);
  final details = _list(breakdown['credit_bills_details']);
  if (details.isNotEmpty) return details;
  return _shiftTransactionLines(shift)
      .where((line) => _text(line, ['section']) == 'credit_bill')
      .toList();
}

List<Map<String, dynamic>> _shiftPaidBills(Map<String, dynamic> shift) {
  final direct = _list(shift['paid_bills']);
  if (direct.isNotEmpty) return direct;
  final breakdown = _shiftSalesBreakdown(shift);
  final details = _list(breakdown['paid_bills_details']);
  if (details.isNotEmpty) return details;
  return _shiftTransactionLines(shift).where((line) {
    final section = _text(line, ['section']);
    final source = _text(line, ['source_table']);
    return section == 'paid_bill' && source != 'pos_shift_payments';
  }).toList();
}

Map<String, List<Map<String, dynamic>>> _groupShiftLines(
  List<Map<String, dynamic>> lines,
  String Function(Map<String, dynamic> line) keyBuilder,
) {
  final groups = <String, List<Map<String, dynamic>>>{};
  for (final line in lines) {
    if (_num(line['amount']) <= 0) continue;
    final key = keyBuilder(line).trim().isEmpty ? 'Other' : keyBuilder(line);
    groups.putIfAbsent(key, () => []).add(line);
  }
  return groups;
}

num _firstNonZero(List<num> values) {
  for (final value in values) {
    if (value != 0) return value;
  }
  return 0;
}

num _paymentBreakdownAmount(Map<String, dynamic> shift, String method) {
  final rows = _list(shift['payment_breakdown']);
  for (final row in rows) {
    if (_text(row, ['method']).toLowerCase() == method.toLowerCase()) {
      return _num(row['amount']);
    }
  }
  return 0;
}

String _shiftRevenueSystemLabel(
  Map<String, dynamic> shift,
  Map<String, dynamic> line,
) {
  final section = _text(line, ['section']).toLowerCase();
  final source = _text(line, ['source_table']).toLowerCase();
  final outlet = _text(_shiftSalesBreakdown(shift), ['outlet']);
  if (section.contains('restaurant') || source.contains('restaurant')) {
    return 'Restaurant POS';
  }
  if (section.contains('bar') || source.contains('bar')) return 'Bar POS';
  if (section.contains('room') || source.contains('booking')) return 'Rooms';
  if (section.contains('non_consum') || outlet.toLowerCase().contains('non')) {
    return 'Non-Consumables POS';
  }
  if (section.contains('outlet') || source.contains('pos_shift')) {
    return outlet.isEmpty ? 'Unified POS Outlet' : outlet;
  }
  if (section.contains('credit')) return 'Staff Credit Bills';
  if (section.contains('paid')) return 'Paid Credit Bills';
  return 'Cashier Clearance';
}

num _openingFloat(Map<String, dynamic> shift) {
  final reconciliation = _shiftCashReconciliation(shift);
  final fromReconciliation = _num(reconciliation['opening_float']);
  if (fromReconciliation != 0) return fromReconciliation;
  return _firstNumFrom(shift, ['opening_float', 'float_opening']);
}

num _cashSales(Map<String, dynamic> shift) {
  final reconciliation = _shiftCashReconciliation(shift);
  final fromReconciliation = _num(reconciliation['cash_sales']);
  if (fromReconciliation != 0) return fromReconciliation;
  final breakdown = _shiftSalesBreakdown(shift);
  return _firstNonZero([
    _firstNumFrom(shift, ['total_cash_sales', 'cash_sales', 'cash_collected']),
    _paymentBreakdownAmount(shift, 'cash'),
    _num(breakdown['total_cash']),
  ]);
}

num _mpesaSales(Map<String, dynamic> shift) {
  final breakdown = _shiftSalesBreakdown(shift);
  return _firstNonZero([
    _paymentBreakdownAmount(shift, 'mpesa'),
    _firstNumFrom(shift, ['total_mpesa_sales', 'mpesa_sales']),
    _num(breakdown['total_mpesa']),
  ]);
}

num _cardSales(Map<String, dynamic> shift) {
  final breakdown = _shiftSalesBreakdown(shift);
  return _firstNonZero([
    _paymentBreakdownAmount(shift, 'card'),
    _firstNumFrom(shift, ['total_card_sales', 'card_sales']),
    _num(breakdown['total_card']),
  ]);
}

num _otherSales(Map<String, dynamic> shift) {
  final breakdown = _shiftSalesBreakdown(shift);
  return _firstNonZero([
    _paymentBreakdownAmount(shift, 'other'),
    _firstNumFrom(shift, ['total_other_sales', 'other_sales']),
    _num(breakdown['total_other']),
  ]);
}

num _shiftTotalSales(Map<String, dynamic> shift) {
  final summary = _map(shift['summary']);
  final breakdown = _shiftSalesBreakdown(shift);
  final direct =
      _firstNumFrom(shift, ['total_sales', 'total_revenue', 'sales']);
  if (direct != 0) return direct;
  final fromSummary = _num(summary['total_sales']);
  if (fromSummary != 0) return fromSummary;
  final fromBreakdown = _num(breakdown['total_sales']);
  if (fromBreakdown != 0) return fromBreakdown;
  return _shiftPaymentRows(shift).fold<num>(
    0,
    (sum, row) => sum + _num(row['amount']),
  );
}

num _shiftTransactionCount(Map<String, dynamic> shift) {
  final summary = _map(shift['summary']);
  final breakdown = _shiftSalesBreakdown(shift);
  final direct = _firstNumFrom(shift, ['transaction_count', 'order_count']);
  if (direct != 0) return direct;
  final fromSummary = _num(summary['transaction_count']);
  if (fromSummary != 0) return fromSummary;
  final fromBreakdown =
      _num(breakdown['transaction_count'] ?? breakdown['order_count']);
  if (fromBreakdown != 0) return fromBreakdown;
  return _shiftTransactionLines(shift).length;
}

num _shiftVariance(Map<String, dynamic> shift) {
  final reconciliation = _shiftCashReconciliation(shift);
  final fromReconciliation = _num(reconciliation['variance']);
  if (fromReconciliation != 0) return fromReconciliation;
  final breakdown = _shiftSalesBreakdown(shift);
  final fromBreakdown = _num(breakdown['variance']);
  if (fromBreakdown != 0) return fromBreakdown;
  return _firstNumFrom(shift, ['variance', 'variance_amount']);
}

num _creditPaymentsReceived(Map<String, dynamic> shift) {
  final reconciliation = _shiftCashReconciliation(shift);
  final fromReconciliation = _num(reconciliation['credit_payments_received']);
  if (fromReconciliation != 0) return fromReconciliation;
  final summary = _map(shift['summary']);
  final breakdown = _shiftSalesBreakdown(shift);
  return _firstNonZero([
    _firstNumFrom(shift,
        ['credit_payments_received', 'credit_bills_paid', 'paid_bills_value']),
    _num(summary['paid_bills_value']),
    _num(breakdown['paid_bills_value']),
  ]);
}

num _expectedClosingAmount(Map<String, dynamic> shift) {
  final reconciliation = _shiftCashReconciliation(shift);
  final fromReconciliation = _num(reconciliation['expected_closing']);
  if (fromReconciliation != 0) return fromReconciliation;
  final stored = _firstNumFrom(
      shift, ['expected_closing_float', 'expected_closing_amount']);
  if (stored != 0) return stored;
  return _openingFloat(shift) +
      _cashSales(shift) +
      _creditPaymentsReceived(shift) -
      _num(reconciliation['cash_drops']) -
      _num(reconciliation['payouts']);
}

num _actualCashCounted(Map<String, dynamic> shift) {
  final reconciliation = _shiftCashReconciliation(shift);
  final fromReconciliation = _num(reconciliation['actual_closing']);
  if (fromReconciliation != 0) return fromReconciliation;
  final actual = _firstNumFrom(
      shift, ['actual_cash_counted', 'closing_float', 'cash_at_hand']);
  if (actual != 0) return actual;
  return _firstNumFrom(shift, ['cash_deposited']);
}

num _varianceAmount(Map<String, dynamic> shift) {
  final stored = _shiftVariance(shift);
  if (stored != 0) return stored;
  return _actualCashCounted(shift) - _expectedClosingAmount(shift);
}

num _revenueBreakdownAmount(Map<String, dynamic> shift, String label) {
  for (final row in _list(shift['revenue_breakdown'])) {
    if (_text(row, ['label']).toLowerCase() == label.toLowerCase()) {
      return _num(row['amount']);
    }
  }
  return 0;
}

num _roomRevenue(Map<String, dynamic> shift) {
  final breakdown = _shiftSalesBreakdown(shift);
  return _firstNonZero([
    _revenueBreakdownAmount(shift, 'Rooms'),
    _firstNumFrom(shift,
        ['room_booking_revenue', 'rooms_revenue', 'accommodation_revenue']),
    _num(breakdown['room_booking_revenue']),
  ]);
}

num _restaurantRevenue(Map<String, dynamic> shift) {
  final breakdown = _shiftSalesBreakdown(shift);
  return _firstNonZero([
    _revenueBreakdownAmount(shift, 'Restaurant'),
    _firstNumFrom(shift, ['restaurant_revenue']),
    _num(breakdown['restaurant_revenue']),
  ]);
}

num _barRevenue(Map<String, dynamic> shift) {
  final breakdown = _shiftSalesBreakdown(shift);
  return _firstNonZero([
    _revenueBreakdownAmount(shift, 'Bar'),
    _firstNumFrom(shift, ['bar_revenue']),
    _num(breakdown['bar_revenue']),
  ]);
}

num _otherRevenue(Map<String, dynamic> shift) {
  final breakdown = _shiftSalesBreakdown(shift);
  return _firstNonZero([
    _revenueBreakdownAmount(shift, 'Other'),
    _firstNumFrom(shift, ['other_revenue']),
    _num(breakdown['other_revenue']),
  ]);
}

num _creditBillsCreated(Map<String, dynamic> shift) {
  final breakdown = _shiftSalesBreakdown(shift);
  final creditBills = _shiftCreditBills(shift);
  return _firstNonZero([
    _num(shift['credit_bills_total']),
    _firstNumFrom(shift, ['credit_bills_taken', 'credit_bills_value']),
    _num(breakdown['total_credit_bills'] ?? breakdown['total_credit_bill']),
    creditBills.fold<num>(0, (sum, bill) => sum + _num(bill['amount'])),
  ]);
}

num _creditBillsPaid(Map<String, dynamic> shift) {
  final summary = _map(shift['summary']);
  final breakdown = _shiftSalesBreakdown(shift);
  final paidBills = _shiftPaidBills(shift);
  return _firstNonZero([
    _num(shift['paid_bills_total']),
    _firstNumFrom(shift, ['credit_bills_paid', 'paid_bills_value']),
    _num(summary['paid_bills_value']),
    _num(breakdown['paid_bills_value']),
    paidBills.fold<num>(0, (sum, bill) => sum + _num(bill['amount'])),
  ]);
}

num _outstandingCredit(Map<String, dynamic> shift) {
  final stored =
      _firstNumFrom(shift, ['outstanding_credit', 'outstanding_credit_value']);
  if (stored != 0) return stored;
  final unpaid = _firstNumFrom(shift, ['unpaid_bills_value']);
  return unpaid > 0 ? unpaid : _creditBillsCreated(shift);
}

class _CashierLogbooksSection extends ConsumerStatefulWidget {
  const _CashierLogbooksSection();

  @override
  ConsumerState<_CashierLogbooksSection> createState() =>
      _CashierLogbooksSectionState();
}

class _CashierLogbooksSectionState extends ConsumerState<_CashierLogbooksSection>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController =
      TabController(length: 2, vsync: this);
  late Future<List<Map<String, dynamic>>> _future =
      ref.read(branchAccountantRepositoryProvider).getPendingCashierLogbooks();
  late Future<List<Map<String, dynamic>>> _historyFuture = _loadHistory();
  String _historySearch = '';
  String _historyFrom = _date(DateTime.now().subtract(const Duration(days: 30)));
  String _historyTo = _today();
  Map<String, dynamic>? _selectedLogbook;
  Future<Map<String, dynamic>>? _detailFuture;
  bool _downloadingReport = false;

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<List<Map<String, dynamic>>> _loadHistory() =>
      ref.read(branchAccountantRepositoryProvider).getPendingCashierLogbooks(
            status: 'all',
            dateFrom: _historyFrom,
            dateTo: _historyTo,
          );

  void _refreshHistory() => setState(() => _historyFuture = _loadHistory());

  void _refresh() {
    final nextFuture = ref
        .read(branchAccountantRepositoryProvider)
        .getPendingCashierLogbooks();
    setState(() {
      _future = nextFuture;
    });
  }

  void _openDetail(Map<String, dynamic> logbook) {
    final id = '${logbook['id'] ?? ''}';
    if (id.isEmpty) {
      _toast('Logbook ID is missing');
      return;
    }
    setState(() {
      _selectedLogbook = logbook;
      _detailFuture = ref
          .read(branchAccountantRepositoryProvider)
          .getCashierLogbookDetail(id);
    });
  }

  void _refreshDetail() {
    final id = '${_selectedLogbook?['id'] ?? ''}';
    if (id.isEmpty) return;
    final nextFuture = ref
        .read(branchAccountantRepositoryProvider)
        .getCashierLogbookDetail(id);
    setState(() {
      _detailFuture = nextFuture;
    });
  }

  Future<void> _downloadReport(Map<String, dynamic> detail) async {
    final id = '${detail['id'] ?? _selectedLogbook?['id'] ?? ''}';
    if (id.isEmpty || _downloadingReport) return;
    setState(() => _downloadingReport = true);
    try {
      final file = await ref
          .read(branchAccountantRepositoryProvider)
          .downloadCashierLogbookReport(id);
      _toast('Shift report saved to ${file.path}');
    } finally {
      if (mounted) setState(() => _downloadingReport = false);
    }
  }

  void _backToList() {
    setState(() {
      _selectedLogbook = null;
      _detailFuture = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final detailFuture = _detailFuture;
    if (_selectedLogbook != null && detailFuture != null) {
      return _CashierLogbookDetailScreen(
        future: detailFuture,
        onBack: _backToList,
        onRefresh: _refreshDetail,
        onDownloadReport: _downloadReport,
        downloadingReport: _downloadingReport,
      );
    }

    return _Page(
      title: 'Cashier Logbooks',
      subtitle: 'Audit submitted daily cashier logbooks and bill line entries.',
      actions: [
        _RefreshButton(
          onPressed: () {
            _refresh();
            _refreshHistory();
          },
        ),
      ],
      children: [
        TabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: const [Tab(text: 'Pending Audit'), Tab(text: 'History')],
        ),
        const Divider(height: 1),
        SizedBox(
          height: 600,
          child: TabBarView(
            controller: _tabController,
            children: [_pendingTab(), _historyTab()],
          ),
        ),
      ],
    );
  }

  Widget _pendingTab() {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (items) => ListView(
          children: [
            _SectionCard(
              title: 'Pending Audit',
              child: _CashierLogbooksTable(
                items: items,
                onView: _openDetail,
                onApprove: (logbook) => _audit(logbook, true),
                onReject: (logbook) => _audit(logbook, false),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _historyTab() {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _historyFuture,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refreshHistory,
        builder: (items) {
          final filtered = items.where((logbook) {
            if (_historySearch.trim().isEmpty) return true;
            final name = _text(logbook, ['cashier_name', 'cashier']);
            return name.toLowerCase().contains(_historySearch.toLowerCase());
          }).toList();
          return ListView(
            children: [
              Wrap(
                spacing: 12,
                runSpacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  SizedBox(
                    width: 240,
                    child: TextField(
                      decoration: const InputDecoration(
                        labelText: 'Search cashier name',
                        prefixIcon: Icon(Icons.search),
                      ),
                      onChanged: (v) => setState(() => _historySearch = v),
                    ),
                  ),
                  _DateField(
                    value: _historyFrom,
                    onChanged: (v) {
                      setState(() => _historyFrom = v);
                      _refreshHistory();
                    },
                  ),
                  _DateField(
                    value: _historyTo,
                    onChanged: (v) {
                      setState(() => _historyTo = v);
                      _refreshHistory();
                    },
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _SectionCard(
                title: 'Shift History (${filtered.length})',
                child: filtered.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.all(16),
                        child: Text('No past shifts match your filters.'),
                      )
                    : Column(
                        children: filtered
                            .map((logbook) => InkWell(
                                  onTap: () => _openDetail(logbook),
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(
                                        vertical: 10),
                                    child: Row(
                                      children: [
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                _text(logbook,
                                                    ['cashier_name', 'cashier'],
                                                ).isEmpty
                                                    ? 'Cashier'
                                                    : _text(logbook, [
                                                        'cashier_name',
                                                        'cashier'
                                                      ]),
                                                style: const TextStyle(
                                                    fontWeight:
                                                        FontWeight.w700),
                                              ),
                                              Text(
                                                _shortDate(_text(
                                                    logbook, ['log_date'])),
                                                style: TextStyle(
                                                    fontSize: 12,
                                                    color: Colors
                                                        .grey.shade600),
                                              ),
                                            ],
                                          ),
                                        ),
                                        Text(
                                            _money(_num(
                                                logbook['closing_amount'] ??
                                                    logbook['total'])),
                                            style: const TextStyle(
                                                fontWeight: FontWeight.w800)),
                                        const SizedBox(width: 10),
                                        _StatusPill(_text(
                                            logbook, ['status'],
                                            )),
                                      ],
                                    ),
                                  ),
                                ))
                            .toList(),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _audit(Map<String, dynamic> logbook, bool approve) async {
    final notes = await _textDialog(
      context,
      approve ? 'Approve Logbook' : 'Reject Logbook',
      hint: approve ? 'Optional approval notes' : 'Reason for rejection',
      minLines: 4,
    );
    if (notes == null) return;
    await ref.read(branchAccountantRepositoryProvider).auditCashierLogbook(
          '${logbook['id']}',
          approve: approve,
          notes: notes,
        );
    _toast(approve ? 'Logbook approved' : 'Logbook rejected');
    _refresh();
  }
}

class _CashierLogbooksTable extends StatelessWidget {
  const _CashierLogbooksTable({
    required this.items,
    required this.onView,
    required this.onApprove,
    required this.onReject,
  });

  final List<Map<String, dynamic>> items;
  final void Function(Map<String, dynamic> logbook) onView;
  final void Function(Map<String, dynamic> logbook) onApprove;
  final void Function(Map<String, dynamic> logbook) onReject;

  static const _columns = <_LogbookColumn>[
    _LogbookColumn('Date', 130),
    _LogbookColumn('Type', 120),
    _LogbookColumn('Cashier', 220),
    _LogbookColumn('Branch', 180),
    _LogbookColumn('Closing', 120),
    _LogbookColumn('Variance', 120),
    _LogbookColumn('Actions', 270),
  ];

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return Padding(
        padding: ScreenSize.p(context),
        child: Center(
          child: Text(
            'No pending cashier logbooks',
            style: TextStyle(color: AppColors.kTextSecondary),
          ),
        ),
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final contentWidth = _columns.fold<double>(
          0,
          (total, column) => total + column.width,
        );
        final tableWidth = constraints.maxWidth > contentWidth
            ? constraints.maxWidth
            : contentWidth;

        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: SizedBox(
            width: tableWidth,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const _CashierLogbooksHeader(columns: _columns),
                ...items.map(
                  (logbook) => _CashierLogbooksRow(
                    logbook: logbook,
                    columns: _columns,
                    onView: () => onView(logbook),
                    onApprove: () => onApprove(logbook),
                    onReject: () => onReject(logbook),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _LogbookColumn {
  const _LogbookColumn(this.label, this.width);
  final String label;
  final double width;
}

class _CashierLogbooksHeader extends StatelessWidget {
  const _CashierLogbooksHeader({required this.columns});

  final List<_LogbookColumn> columns;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 56,
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.kDivider)),
      ),
      child: Row(
        children: columns
            .map(
              (column) => SizedBox(
                width: column.width,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  child: Text(
                    column.label,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      color: AppColors.kTextPrimary,
                    ),
                  ),
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

class _CashierLogbooksRow extends StatelessWidget {
  const _CashierLogbooksRow({
    required this.logbook,
    required this.columns,
    required this.onView,
    required this.onApprove,
    required this.onReject,
  });

  final Map<String, dynamic> logbook;
  final List<_LogbookColumn> columns;
  final VoidCallback onView;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    final cashier = _map(logbook['cashier']);
    final cashierName = '${_text(cashier, ['first_name'])} '
            '${_text(cashier, ['last_name'])}'
        .trim();
    final cells = <Widget>[
      _LogbookText(_text(logbook, ['log_date', 'date'])),
      _LogbookText(_text(logbook, ['type'])),
      _LogbookText(
          cashierName.isEmpty ? _text(logbook, ['cashier_name']) : cashierName),
      _LogbookText(_text(_map(logbook['branch']), ['name', 'branch_name'])),
      _LogbookText(_money(_num(logbook['closing_float']))),
      _LogbookText(_money(_num(logbook['variance']))),
      _CashierLogbookActions(
        onView: onView,
        onApprove: onApprove,
        onReject: onReject,
      ),
    ];

    return Container(
      height: 64,
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.kDivider)),
      ),
      child: Row(
        children: List.generate(
          columns.length,
          (index) => SizedBox(
            width: columns[index].width,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: Align(
                alignment: Alignment.centerLeft,
                child: cells[index],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _LogbookText extends StatelessWidget {
  const _LogbookText(this.value);

  final String value;

  @override
  Widget build(BuildContext context) {
    return Text(
      value.isEmpty ? '-' : value,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: const TextStyle(color: AppColors.kTextPrimary),
    );
  }
}

class _CashierLogbookActions extends StatelessWidget {
  const _CashierLogbookActions({
    required this.onView,
    required this.onApprove,
    required this.onReject,
  });

  final VoidCallback onView;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        TextButton(
          onPressed: onView,
          style: TextButton.styleFrom(
            minimumSize: const Size(0, 36),
            padding: const EdgeInsets.symmetric(horizontal: 10),
          ),
          child: const Text('View'),
        ),
        const SizedBox(width: 6),
        FilledButton.tonal(
          onPressed: onApprove,
          style: FilledButton.styleFrom(
            minimumSize: const Size(0, 36),
            padding: const EdgeInsets.symmetric(horizontal: 14),
          ),
          child: const Text('Approve'),
        ),
        const SizedBox(width: 6),
        OutlinedButton(
          onPressed: onReject,
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(0, 36),
            padding: const EdgeInsets.symmetric(horizontal: 12),
          ),
          child: const Text('Reject'),
        ),
      ],
    );
  }
}

class _CashierLogbookDetailScreen extends StatelessWidget {
  const _CashierLogbookDetailScreen({
    required this.future,
    required this.onBack,
    required this.onRefresh,
    required this.onDownloadReport,
    required this.downloadingReport,
  });

  final Future<Map<String, dynamic>> future;
  final VoidCallback onBack;
  final VoidCallback onRefresh;
  final Future<void> Function(Map<String, dynamic> detail) onDownloadReport;
  final bool downloadingReport;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: future,
      builder: (context, snapshot) => _FuturePage(
        snapshot: snapshot,
        onRefresh: onRefresh,
        builder: (detail) {
          final branch = _map(detail['branch']);
          final cashier = _map(detail['cashier']);
          final shift = _map(detail['shift']);
          final summary = _map(detail['summary']);
          final reconciliation = _map(detail['cash_reconciliation']);
          final payments = _list(detail['payment_breakdown']);
          final revenue = _list(detail['revenue_breakdown']);
          final flags = _list(detail['compliance_flags']);
          final lines = _list(detail['lines']);
          final creditBills = _list(detail['credit_bills']);
          final transactionHistory = _list(detail['transaction_history']);
          final clearedTransactions =
              transactionHistory.isEmpty ? lines : transactionHistory;
          final cashierName = _logbookPersonName(cashier);
          final subtitleParts = [
            _text(branch, ['name']),
            cashierName,
            _text(detail, ['log_date']),
          ].where((value) => value.isNotEmpty).join(' • ');

          return _Page(
            title: 'Cashier Shift Logbook',
            subtitle: subtitleParts.isEmpty
                ? 'Automated shift compliance and sales evidence'
                : subtitleParts,
            actions: [
              OutlinedButton.icon(
                onPressed: onBack,
                icon: const Icon(Icons.arrow_back),
                label: const Text('Back'),
              ),
              _RefreshButton(onPressed: onRefresh),
              FilledButton.icon(
                onPressed:
                    downloadingReport ? null : () => onDownloadReport(detail),
                icon: downloadingReport
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.picture_as_pdf),
                label:
                    Text(downloadingReport ? 'Preparing PDF' : 'Download PDF'),
              ),
            ],
            children: [
              _ResponsiveGrid(
                children: [
                  _MetricCard(
                    'Total Sales',
                    _money(_num(summary['total_sales'])),
                    Icons.point_of_sale,
                    Colors.green,
                  ),
                  _MetricCard(
                    'Transactions',
                    '${_num(summary['transaction_count']).toInt()}',
                    Icons.receipt_long,
                    AppColors.kPrimary,
                  ),
                  _MetricCard(
                    'Expected Cash',
                    _money(_num(reconciliation['expected_closing'])),
                    Icons.account_balance_wallet,
                    Colors.blue,
                  ),
                  _MetricCard(
                    'Actual Cash',
                    _money(_num(reconciliation['actual_closing'])),
                    Icons.payments,
                    Colors.teal,
                  ),
                  _MetricCard(
                    'Variance',
                    _money(_num(reconciliation['variance'])),
                    Icons.warning_amber,
                    _num(reconciliation['variance']).abs() < 0.01
                        ? Colors.green
                        : Colors.red,
                  ),
                  _MetricCard(
                    'Cleared Lines',
                    '${clearedTransactions.length}',
                    Icons.fact_check,
                    Colors.orange,
                  ),
                ],
              ),
              _TwoColumn(
                left: _SectionCard(
                  title: 'Shift Identity',
                  child: _KeyValueList({
                    'shift_number': _text(shift, ['shift_number']).isEmpty
                        ? '-'
                        : _text(shift, ['shift_number']),
                    'branch': _text(branch, ['name']).isEmpty
                        ? '-'
                        : _text(branch, ['name']),
                    'cashier': cashierName.isEmpty ? '-' : cashierName,
                    'log_date': _text(detail, ['log_date']).isEmpty
                        ? '-'
                        : _text(detail, ['log_date']),
                    'shift_start': _text(shift, ['shift_start']).isEmpty
                        ? '-'
                        : _text(shift, ['shift_start']),
                    'shift_end': _text(shift, ['shift_end']).isEmpty
                        ? '-'
                        : _text(shift, ['shift_end']),
                    'status': _text(detail, ['status']).isEmpty
                        ? '-'
                        : _text(detail, ['status']),
                  }),
                ),
                right: _SectionCard(
                  title: 'Cash Reconciliation',
                  child: _KeyValueList({
                    'opening_float': _num(reconciliation['opening_float']),
                    'cash_sales': _num(reconciliation['cash_sales']),
                    'credit_payments_received':
                        _num(reconciliation['credit_payments_received']),
                    'cash_drops': _num(reconciliation['cash_drops']),
                    'payouts': _num(reconciliation['payouts']),
                    'expected_closing':
                        _num(reconciliation['expected_closing']),
                    'actual_closing': _num(reconciliation['actual_closing']),
                    'variance': _num(reconciliation['variance']),
                  }),
                ),
              ),
              _TwoColumn(
                left: _SectionCard(
                  title: 'Sales By Payment Method',
                  child: _LogbookBreakdownList(
                    rows: payments,
                    labelKey: 'method',
                    amountKey: 'amount',
                    countKey: 'count',
                    emptyText: 'No payment methods captured',
                  ),
                ),
                right: _SectionCard(
                  title: 'Revenue Streams',
                  child: _LogbookBreakdownList(
                    rows: revenue,
                    labelKey: 'label',
                    amountKey: 'amount',
                    emptyText: 'No revenue stream data captured',
                  ),
                ),
              ),
              Builder(builder: (context) {
                final total = creditBills.isNotEmpty
                    ? (_num(detail['credit_bills_total']) > 0
                        ? _num(detail['credit_bills_total'])
                        : creditBills.fold<num>(
                            0, (s, c) => s + _num(c['amount'])))
                    : _num(detail['credit_bills_total']);
                return _SectionCard(
                  title: 'Credit Bills — Who For (${_money(total)})',
                  child: creditBills.isEmpty
                      ? const Padding(
                          padding: EdgeInsets.all(8),
                          child: Text('No staff credit bills this shift',
                              style:
                                  TextStyle(color: AppColors.kTextSecondary)),
                        )
                      : Column(
                          children: [
                            for (final c in creditBills)
                              Padding(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 5),
                                child: Row(
                                  children: [
                                    const Icon(Icons.badge_outlined,
                                        size: 16,
                                        color: AppColors.kTextSecondary),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            _text(c, [
                                              'staff_name',
                                              'customer_name',
                                              'name'
                                            ]),
                                            style: const TextStyle(
                                                fontWeight: FontWeight.w600),
                                          ),
                                          if (_text(c, ['department'])
                                                  .isNotEmpty ||
                                              _text(c, ['bill_type'])
                                                  .isNotEmpty)
                                            Text(
                                              [
                                                _text(c, ['bill_type'])
                                                    .replaceAll('_', ' '),
                                                _text(c, ['department']),
                                              ]
                                                  .where((v) => v.isNotEmpty)
                                                  .join(' · '),
                                              style: const TextStyle(
                                                  fontSize: 11,
                                                  color:
                                                      AppColors.kTextSecondary),
                                            ),
                                        ],
                                      ),
                                    ),
                                    if (_text(c, ['credit_number', 'reference'])
                                        .isNotEmpty) ...[
                                      Text(
                                          _text(c,
                                              ['credit_number', 'reference']),
                                          style: const TextStyle(
                                              fontSize: 12,
                                              color: AppColors.kTextSecondary)),
                                      const SizedBox(width: 12),
                                    ],
                                    _StatusPill(_text(c, ['status'])),
                                    const SizedBox(width: 12),
                                    Text(_money(_num(c['amount'])),
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w700)),
                                  ],
                                ),
                              ),
                          ],
                        ),
                );
              }),
              _SectionCard(
                title: 'Compliance Checks',
                child: _ComplianceFlagList(flags: flags),
              ),
              _SectionCard(
                title: 'Cleared Transaction History',
                child: _LogbookEvidenceTable(lines: clearedTransactions),
              ),
            ],
          );
        },
      ),
    );
  }
}

String _logbookPersonName(Map<String, dynamic> person) {
  final name =
      '${_text(person, ['first_name'])} ${_text(person, ['last_name'])}'.trim();
  if (name.isNotEmpty) return name;
  return _text(person, ['name', 'email']);
}

class _LogbookBreakdownList extends StatelessWidget {
  const _LogbookBreakdownList({
    required this.rows,
    required this.labelKey,
    required this.amountKey,
    this.countKey,
    required this.emptyText,
  });

  final List<dynamic> rows;
  final String labelKey;
  final String amountKey;
  final String? countKey;
  final String emptyText;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(12),
        child: Text(
          emptyText,
          style: const TextStyle(color: AppColors.kTextSecondary),
        ),
      );
    }

    return Column(
      children: rows.map((row) {
        final item = _map(row);
        final count = countKey == null ? 0 : _num(item[countKey]).toInt();
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  _title('${item[labelKey] ?? 'other'}'),
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              if (countKey != null) ...[
                Text(
                  '$count line${count == 1 ? '' : 's'}',
                  style: const TextStyle(color: AppColors.kTextSecondary),
                ),
                const SizedBox(width: 18),
              ],
              Text(
                _money(_num(item[amountKey])),
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _ComplianceFlagList extends StatelessWidget {
  const _ComplianceFlagList({required this.flags});

  final List<dynamic> flags;

  @override
  Widget build(BuildContext context) {
    if (flags.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(12),
        child: Text(
          'No compliance checks were returned',
          style: TextStyle(color: AppColors.kTextSecondary),
        ),
      );
    }

    return Column(
      children: flags.map((flag) {
        final item = _map(flag);
        final status = '${item['status'] ?? 'Review'}';
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _StatusPill(status),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${item['label'] ?? 'Compliance check'}',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${item['detail'] ?? '-'}',
                      style: const TextStyle(color: AppColors.kTextSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _LogbookEvidenceTable extends StatelessWidget {
  const _LogbookEvidenceTable({required this.lines});

  final List<dynamic> lines;

  @override
  Widget build(BuildContext context) {
    final rows = lines.map<List<Object>>((line) {
      final item = _map(line);
      return <Object>[
        _formatCompactDateTime('${item['created_at'] ?? ''}'),
        '${item['reference'] ?? '-'}',
        '${item['customer_name'] ?? '-'}',
        _title('${item['section'] ?? 'transaction'}'),
        _title('${item['payment_method'] ?? 'other'}'),
        _money(_num(item['amount'])),
        '${item['status'] ?? '-'}',
      ];
    }).toList();

    return _SimpleTable(
      columns: const [
        'Time',
        'Reference',
        'Customer',
        'Source',
        'Payment',
        'Amount',
        'Status',
      ],
      rows: rows,
    );
  }
}

// ── Void Approvals (merged: whole-bill + item-level, tabbed) ──────────────

class _VoidApprovalsSection extends ConsumerStatefulWidget {
  const _VoidApprovalsSection();

  @override
  ConsumerState<_VoidApprovalsSection> createState() =>
      _VoidApprovalsSectionState();
}

class _VoidApprovalsSectionState extends ConsumerState<_VoidApprovalsSection>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController =
      TabController(length: 2, vsync: this);
  late Future<List<Map<String, dynamic>>> _wholeBillFuture = _loadWholeBill();
  late Future<List<ItemVoidRequest>> _itemFuture = _loadItemVoids();
  bool _actioning = false;

  Future<List<Map<String, dynamic>>> _loadWholeBill() =>
      ref.read(branchAccountantRepositoryProvider).getPendingPosVoidRequests();

  Future<List<ItemVoidRequest>> _loadItemVoids() =>
      ref.read(outletPosRepositoryProvider).getPendingVoidsManager();

  void _refreshWholeBill() =>
      setState(() => _wholeBillFuture = _loadWholeBill());

  void _refreshItemVoids() => setState(() => _itemFuture = _loadItemVoids());

  String _fmt(double v) => NumberFormat('#,##0.00', 'en_KE').format(v);

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(
              ScreenSize.p(context).horizontal / 2,
              ScreenSize.p(context).vertical / 2,
              ScreenSize.p(context).horizontal / 2,
              0),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Void Approvals',
                        style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 4),
                    const Text(
                      'Review whole-bill void requests and cashier-acknowledged item voids.',
                      style: TextStyle(color: AppColors.kTextSecondary),
                    ),
                  ],
                ),
              ),
              _RefreshButton(
                onPressed: () {
                  _refreshWholeBill();
                  _refreshItemVoids();
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        TabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: [
            FutureBuilder<List<Map<String, dynamic>>>(
              future: _wholeBillFuture,
              builder: (context, snap) =>
                  Tab(text: 'Whole Bill (${snap.data?.length ?? '…'})'),
            ),
            FutureBuilder<List<ItemVoidRequest>>(
              future: _itemFuture,
              builder: (context, snap) =>
                  Tab(text: 'Item Voids (${snap.data?.length ?? '…'})'),
            ),
          ],
        ),
        const Divider(height: 1),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [_wholeBillTab(), _itemVoidTab()],
          ),
        ),
      ],
    );
  }

  Widget _wholeBillTab() {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _wholeBillFuture,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refreshWholeBill,
        builder: (items) => ListView(
          padding: ScreenSize.p(context),
          children: [
            _ResponsiveGrid(children: [
              _MetricCard('Pending Requests', '${items.length}', Icons.block,
                  Colors.orange),
              _MetricCard(
                'Total Amount',
                _money(_sum(items, 'total_amount')),
                Icons.payments,
                Colors.red,
              ),
            ]),
            const SizedBox(height: 16),
            if (items.isEmpty)
              Padding(
                padding: ScreenSize.p(context),
                child: Center(
                  child: Text(
                    'No pending whole-bill void approvals',
                    style: TextStyle(color: AppColors.kTextSecondary),
                  ),
                ),
              )
            else
              ...items.map((item) => _ActionCard(
                    title: _text(item, ['order_number', 'bill_number'])
                            .isEmpty
                        ? 'POS bill'
                        : _text(item, ['order_number', 'bill_number']),
                    subtitle: _text(item, ['outlet_name', 'reason']),
                    trailing: Wrap(
                      spacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        const _VoidTypeBadge(isWholeBill: true),
                        _StatusPill(_text(item, ['status']).isEmpty
                            ? 'pending'
                            : _text(item, ['status'])),
                      ],
                    ),
                    rows: {
                      'Amount': _money(_num(item['total_amount'])),
                      'Requested by': _text(
                          item, ['requested_by_name', 'requested_by_email']),
                      'Branch': _text(item, ['branch_name']),
                      'Reason': _text(item, ['reason']),
                      'Requested at': _text(item, ['created_at']),
                    },
                    extra: _VoidItemsExpandable(
                        items: _list(item['void_items'])),
                    actions: [
                      TextButton(
                        onPressed: () => _showRecord(context, item),
                        child: const Text('View'),
                      ),
                      FilledButton.tonal(
                        onPressed: () => _reviewWholeBill(item, true),
                        child: const Text('Approve'),
                      ),
                      OutlinedButton(
                        onPressed: () => _reviewWholeBill(item, false),
                        child: const Text('Reject'),
                      ),
                    ],
                  )),
          ],
        ),
      ),
    );
  }

  Widget _itemVoidTab() {
    return FutureBuilder<List<ItemVoidRequest>>(
      future: _itemFuture,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refreshItemVoids,
        builder: (items) => ListView(
          padding: ScreenSize.p(context),
          children: [
            _ResponsiveGrid(children: [
              _MetricCard('Awaiting Approval', '${items.length}',
                  Icons.remove_circle_outline, Colors.orange),
              _MetricCard(
                'Total Amount at Risk',
                'KES ${_fmt(items.fold(0.0, (s, r) => s + r.amount))}',
                Icons.payments,
                Colors.red,
              ),
            ]),
            const SizedBox(height: 16),
            if (items.isEmpty)
              Padding(
                padding: ScreenSize.p(context),
                child: Center(
                  child: Text(
                    'No item voids awaiting approval',
                    style: TextStyle(color: AppColors.kTextSecondary),
                  ),
                ),
              )
            else
              ...items.map((r) => _ActionCard(
                    title: r.itemName,
                    subtitle: [
                      if ((r.orderNumber ?? '').isNotEmpty) r.orderNumber!,
                      r.reason,
                    ].join(' • '),
                    trailing: Wrap(
                      spacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        const _VoidTypeBadge(isWholeBill: false),
                        _StatusPill('void_acknowledged'),
                      ],
                    ),
                    rows: {
                      'Bill': r.orderNumber ?? '—',
                      'Qty to void': r.qtyToVoid.toStringAsFixed(
                          r.qtyToVoid.truncateToDouble() == r.qtyToVoid
                              ? 0
                              : 2),
                      'Amount': 'KES ${_fmt(r.amount)}',
                      'Reason': r.reason,
                      'Requested by':
                          r.requestedByName ?? r.requestedBy ?? '—',
                      'Cashier': r.cashierName ?? '—',
                      'Acknowledged at': r.cashierAcknowledgedAt
                              ?.toLocal()
                              .toString()
                              .substring(0, 16) ??
                          '—',
                      'Manager reviewed at': r.managerReviewedAt
                              ?.toLocal()
                              .toString()
                              .substring(0, 16) ??
                          '—',
                    },
                    actions: [
                      FilledButton.tonal(
                        onPressed: _actioning ? null : () => _approveItem(r),
                        child: const Text('Approve'),
                      ),
                      OutlinedButton(
                        onPressed: _actioning ? null : () => _rejectItem(r),
                        child: const Text('Reject'),
                      ),
                    ],
                  )),
          ],
        ),
      ),
    );
  }

  Future<void> _reviewWholeBill(
      Map<String, dynamic> request, bool approve) async {
    String reason = '';
    if (approve) {
      final confirmed = await _confirm(
        context,
        'Approve this void request and cancel the POS bill?',
      );
      if (!confirmed) return;
    } else {
      final text = await _textDialog(
        context,
        'Reject Void Request',
        hint: 'Reason for rejecting this void request',
        minLines: 4,
      );
      if (text == null || text.trim().isEmpty) return;
      reason = text.trim();
    }
    await ref.read(branchAccountantRepositoryProvider).reviewPosVoidRequest(
          '${request['id']}',
          approve: approve,
          reason: reason,
        );
    if (!mounted) return;
    _notify(
      context,
      approve ? 'Void request approved' : 'Void request rejected',
    );
    _refreshWholeBill();
  }

  Future<void> _approveItem(ItemVoidRequest request) async {
    final confirmed = await _confirm(
      context,
      'Approve void of ${request.qtyToVoid.toStringAsFixed(0)}× "${request.itemName}" '
      'on bill ${request.orderNumber ?? request.orderId}?',
    );
    if (!confirmed) return;
    setState(() => _actioning = true);
    try {
      await ref.read(outletPosRepositoryProvider).approveItemVoid(request.id);
      if (mounted) _notify(context, 'Item void approved');
      _refreshItemVoids();
    } on StateError catch (e) {
      if (mounted) _notify(context, e.message);
    } finally {
      if (mounted) setState(() => _actioning = false);
    }
  }

  Future<void> _rejectItem(ItemVoidRequest request) async {
    final reason = await _textDialog(
      context,
      'Reject Item Void',
      hint: 'Reason for rejecting this void request',
      minLines: 3,
    );
    if (reason == null || reason.trim().isEmpty) return;
    setState(() => _actioning = true);
    try {
      await ref.read(outletPosRepositoryProvider).rejectItemVoid(
            request.id,
            rejectionReason: reason.trim(),
          );
      if (mounted) _notify(context, 'Item void rejected');
      _refreshItemVoids();
    } on StateError catch (e) {
      if (mounted) _notify(context, e.message);
    } finally {
      if (mounted) setState(() => _actioning = false);
    }
  }
}

class _VoidTypeBadge extends StatelessWidget {
  const _VoidTypeBadge({required this.isWholeBill});
  final bool isWholeBill;

  @override
  Widget build(BuildContext context) {
    final color = isWholeBill ? Colors.indigo : Colors.deepPurple;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Text(
        isWholeBill ? 'WHOLE BILL' : 'ITEM VOID',
        style:
            TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w800),
      ),
    );
  }
}

/// Read-only history of post-payment item exchanges. The cashier is the sole
/// approver/rejecter for these (see outlet_pos_repository.dart) -- the
/// accountant and branch manager only ever view this list, never act on it.
class _ExchangeHistorySection extends ConsumerStatefulWidget {
  const _ExchangeHistorySection();

  @override
  ConsumerState<_ExchangeHistorySection> createState() =>
      _ExchangeHistorySectionState();
}

class _ExchangeHistorySectionState
    extends ConsumerState<_ExchangeHistorySection> {
  String _status = 'all';
  String _direction = 'all';
  late Future<List<ItemExchangeRequest>> _future = _load();

  Future<List<ItemExchangeRequest>> _load() {
    return ref.read(outletPosRepositoryProvider).getExchangeHistory(
          status: _status == 'all' ? null : _status,
          direction: _direction == 'all' ? null : _direction,
        );
  }

  void _refresh() => setState(() => _future = _load());

  String _fmt(double v) => NumberFormat('#,##0.00', 'en_KE').format(v);

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(
              ScreenSize.p(context).horizontal / 2,
              ScreenSize.p(context).vertical / 2,
              ScreenSize.p(context).horizontal / 2,
              0),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Item Exchanges',
                        style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 4),
                    const Text(
                      'Post-payment item exchanges. The cashier approves, '
                      'rejects, and issues refunds directly -- this is a '
                      'view-only history.',
                      style: TextStyle(color: AppColors.kTextSecondary),
                    ),
                  ],
                ),
              ),
              _RefreshButton(onPressed: _refresh),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Padding(
          padding: EdgeInsets.symmetric(
              horizontal: ScreenSize.p(context).horizontal / 2),
          child: Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              DropdownButton<String>(
                value: _status,
                items: const [
                  DropdownMenuItem(value: 'all', child: Text('All statuses')),
                  DropdownMenuItem(value: 'pending', child: Text('Pending')),
                  DropdownMenuItem(
                      value: 'approved', child: Text('Approved')),
                  DropdownMenuItem(
                      value: 'rejected', child: Text('Rejected')),
                ],
                onChanged: (value) {
                  if (value == null) return;
                  setState(() => _status = value);
                  _refresh();
                },
              ),
              DropdownButton<String>(
                value: _direction,
                items: const [
                  DropdownMenuItem(
                      value: 'all', child: Text('All directions')),
                  DropdownMenuItem(value: 'top_up', child: Text('Top-up')),
                  DropdownMenuItem(value: 'refund', child: Text('Refund')),
                  DropdownMenuItem(value: 'even', child: Text('Even')),
                ],
                onChanged: (value) {
                  if (value == null) return;
                  setState(() => _direction = value);
                  _refresh();
                },
              ),
            ],
          ),
        ),
        const Divider(height: 24),
        Expanded(
          child: FutureBuilder<List<ItemExchangeRequest>>(
            future: _future,
            builder: (context, snap) => _FuturePage(
              snapshot: snap,
              onRefresh: _refresh,
              builder: (rows) => ListView(
                padding: ScreenSize.p(context),
                children: [
                  _ResponsiveGrid(children: [
                    _MetricCard('Total Exchanges', '${rows.length}',
                        Icons.swap_horiz, Colors.indigo),
                    _MetricCard(
                      'Pending Approval',
                      '${rows.where((r) => r.isPending).length}',
                      Icons.hourglass_empty,
                      Colors.orange,
                    ),
                    _MetricCard(
                      'Refunds Outstanding',
                      '${rows.where((r) => r.isApproved && r.isRefund && !r.refundIssued).length}',
                      Icons.payments,
                      Colors.red,
                    ),
                  ]),
                  const SizedBox(height: 16),
                  if (rows.isEmpty)
                    Padding(
                      padding: ScreenSize.p(context),
                      child: Center(
                        child: Text(
                          'No exchange requests found',
                          style: TextStyle(color: AppColors.kTextSecondary),
                        ),
                      ),
                    )
                  else
                    ...rows.map((r) => _ActionCard(
                          title: (r.orderNumber ?? '').isEmpty
                              ? 'Exchange request'
                              : 'Order ${r.orderNumber}',
                          subtitle: r.reason ?? '',
                          trailing: Wrap(
                            spacing: 6,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              _StatusPill(r.status),
                            ],
                          ),
                          rows: {
                            'Returned': _exchangeItemsSummary(r.oldItems),
                            'Replaced with': _exchangeItemsSummary(r.newItems),
                            'Old total': 'KES ${_fmt(r.oldTotal)}',
                            'New total': 'KES ${_fmt(r.newTotal)}',
                            'Direction': r.direction,
                            'Price difference':
                                'KES ${_fmt(r.priceDifference)}',
                            'Requested by': r.requestedByName ?? '—',
                            'Cashier': r.cashierName ?? '—',
                            'Actioned at': r.actionedAt
                                    ?.toLocal()
                                    .toString()
                                    .substring(0, 16) ??
                                '—',
                            if (r.isRejected)
                              'Rejection reason': r.rejectionReason ?? '—',
                            if (r.isRefund)
                              'Refund issued': r.refundIssued
                                  ? '${r.refundIssuedByName ?? '—'} at ${r.refundIssuedAt?.toLocal().toString().substring(0, 16) ?? '—'}'
                                  : 'Not yet issued',
                          },
                        )),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

String _exchangeItemsSummary(List<dynamic> items) {
  return items
      .whereType<Map>()
      .map((item) => '${item['name'] ?? ''} ×${item['quantity'] ?? ''}')
      .join(', ');
}

class _BankingSection extends ConsumerStatefulWidget {
  const _BankingSection();

  @override
  ConsumerState<_BankingSection> createState() => _BankingSectionState();
}

class _BankingSectionState extends ConsumerState<_BankingSection> {
  String _status = 'all';
  late Future<Map<String, dynamic>> _future = _load();

  Future<Map<String, dynamic>> _load() async {
    final repo = ref.read(branchAccountantRepositoryProvider);
    final results = await Future.wait([
      repo.getBankingSummary(),
      repo.getBankingTransactions(status: _status),
      repo.getBankAccounts(),
      repo.getBankReconciliations(),
    ]);
    return {
      'summary': results[0],
      'transactions': results[1],
      'accounts': results[2],
      'reconciliations': results[3],
    };
  }

  void _refresh() => setState(() {
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (data) {
          final summary = _map(data['summary']);
          final summaryTotals = _map(summary['summary']);
          final txns = _list(data['transactions']);
          final accounts = _list(data['accounts']);
          final reconciliations = _list(data['reconciliations']);
          return _Page(
            title: 'Banking Transactions',
            subtitle:
                'Record bank deposits and withdrawals. New records are saved as pending for auditor review.',
            actions: [
              _Dropdown(
                value: _status,
                values: const ['all', 'PENDING', 'APPROVED', 'REJECTED'],
                labels: const {
                  'all': 'All',
                  'PENDING': 'Pending Auditor',
                  'APPROVED': 'Approved',
                  'REJECTED': 'Rejected',
                },
                onChanged: (v) => setState(() {
                  _status = v;
                  _future = _load();
                }),
              ),
              FilledButton.icon(
                onPressed: _recordTransaction,
                icon: const Icon(Icons.add),
                label: const Text('Record Transaction'),
              ),
              _RefreshButton(onPressed: _refresh),
            ],
            children: [
              _ResponsiveGrid(children: [
                _MetricCard(
                    'Total Balance',
                    _money(_num(summaryTotals['total_balance'])),
                    Icons.account_balance,
                    Colors.blue),
                _MetricCard('Deposits', _money(_num(summaryTotals['deposits'])),
                    Icons.trending_up, Colors.green),
                _MetricCard(
                    'Withdrawals',
                    _money(_num(summaryTotals['withdrawals'])),
                    Icons.trending_down,
                    Colors.red),
                _MetricCard(
                    'Pending Auditor',
                    '${_num(summaryTotals['pending_transactions']).toInt()}',
                    Icons.hourglass_top,
                    Colors.orange),
                _MetricCard('Accounts', '${accounts.length}', Icons.savings,
                    Colors.indigo),
                _MetricCard('Transactions', '${txns.length}', Icons.receipt,
                    Colors.purple),
                _MetricCard('Reconciliations', '${reconciliations.length}',
                    Icons.fact_check, Colors.deepPurple),
              ]),
              _SectionCard(
                title: 'Banking Transactions',
                child: _SimpleTable(
                  columns: const [
                    'Date',
                    'Type',
                    'Bank',
                    'Reference',
                    'Purpose',
                    'Amount',
                    'Status',
                    'Recorded By',
                    'Actions',
                  ],
                  rows: txns
                      .map((e) => [
                            _shortDate(
                                _text(e, ['transaction_date', 'created_at'])),
                            _bankingTypeLabel(_text(e, ['transaction_type'])),
                            _text(e, ['bank_name']),
                            _text(e, ['reference_number']).isEmpty
                                ? '-'
                                : _text(e, ['reference_number']),
                            _text(e, ['purpose_description']).isEmpty
                                ? '-'
                                : _text(e, ['purpose_description']),
                            _money(_num(e['amount'])),
                            _StatusPill(_text(e, ['status'])),
                            _text(_map(e['recorded_by_user']),
                                    ['full_name', 'name']).isEmpty
                                ? '-'
                                : _text(_map(e['recorded_by_user']), [
                                    'full_name',
                                    'name',
                                  ]),
                            Wrap(spacing: 8, children: [
                              TextButton(
                                  onPressed: () => _showRecord(context, e),
                                  child: const Text('View')),
                            ]),
                          ])
                      .toList(),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _recordTransaction() async {
    final data = await showDialog<Map<String, dynamic>>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const _BankingTransactionDialog(),
    );
    if (data == null) return;
    await ref
        .read(branchAccountantRepositoryProvider)
        .recordBankingTransaction(data);
    _toast('Banking transaction recorded and sent for auditor review');
    _refresh();
  }
}

String _bankingTypeLabel(String type) {
  switch (type.toUpperCase()) {
    case 'DEPOSIT':
      return 'Deposit';
    case 'WITHDRAWAL':
      return 'Withdrawal';
    case 'TRANSFER':
      return 'Transfer';
    default:
      return type.isEmpty ? '-' : _title(type);
  }
}

class _BankingTransactionDialog extends StatefulWidget {
  const _BankingTransactionDialog();

  @override
  State<_BankingTransactionDialog> createState() =>
      _BankingTransactionDialogState();
}

class _BankingTransactionDialogState extends State<_BankingTransactionDialog> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _bankController = TextEditingController();
  final _accountController = TextEditingController();
  final _referenceController = TextEditingController();
  final _purposeController = TextEditingController();
  final _notesController = TextEditingController();

  String _transactionType = 'DEPOSIT';
  String _paymentMethod = 'cash';
  late DateTime _transactionDate = DateTime.now();

  @override
  void dispose() {
    _amountController.dispose();
    _bankController.dispose();
    _accountController.dispose();
    _referenceController.dispose();
    _purposeController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Record Banking Transaction'),
      content: SizedBox(
        width: 560,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(
                      value: 'DEPOSIT',
                      label: Text('Deposit'),
                      icon: Icon(Icons.trending_up),
                    ),
                    ButtonSegment(
                      value: 'WITHDRAWAL',
                      label: Text('Withdrawal'),
                      icon: Icon(Icons.trending_down),
                    ),
                  ],
                  selected: {_transactionType},
                  onSelectionChanged: (value) =>
                      setState(() => _transactionType = value.first),
                ),
                const SizedBox(height: 14),
                InkWell(
                  onTap: _pickDate,
                  borderRadius: BorderRadius.circular(10),
                  child: InputDecorator(
                    decoration: const InputDecoration(
                      labelText: 'Transaction Date',
                      prefixIcon: Icon(Icons.calendar_today),
                    ),
                    child: Text(_date(_transactionDate)),
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _amountController,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    labelText: 'Amount',
                    prefixText: 'KES ',
                    prefixIcon: Icon(Icons.payments),
                  ),
                  validator: (value) {
                    final amount = num.tryParse((value ?? '').trim());
                    if (amount == null || amount <= 0) {
                      return 'Enter a valid amount';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _bankController,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Bank Name',
                    prefixIcon: Icon(Icons.account_balance),
                  ),
                  validator: (value) =>
                      (value ?? '').trim().isEmpty ? 'Bank is required' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _accountController,
                  decoration: const InputDecoration(
                    labelText: 'Account Number',
                    prefixIcon: Icon(Icons.numbers),
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _paymentMethod,
                  decoration: const InputDecoration(
                    labelText: 'Payment Method',
                    prefixIcon: Icon(Icons.credit_card),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'cash', child: Text('Cash')),
                    DropdownMenuItem(value: 'mpesa', child: Text('M-Pesa')),
                    DropdownMenuItem(value: 'card', child: Text('Card')),
                    DropdownMenuItem(
                      value: 'bank_transfer',
                      child: Text('Bank Transfer'),
                    ),
                    DropdownMenuItem(value: 'other', child: Text('Other')),
                  ],
                  onChanged: (value) =>
                      setState(() => _paymentMethod = value ?? 'cash'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _referenceController,
                  decoration: const InputDecoration(
                    labelText: 'Reference Number',
                    prefixIcon: Icon(Icons.tag),
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _purposeController,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(
                    labelText: 'Purpose / Description',
                    prefixIcon: Icon(Icons.description),
                  ),
                  validator: (value) => (value ?? '').trim().isEmpty
                      ? 'Purpose is required'
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _notesController,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    labelText: 'Notes',
                    alignLabelWithHint: true,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton.icon(
          onPressed: _submit,
          icon: const Icon(Icons.send),
          label: const Text('Send to Auditor'),
        ),
      ],
    );
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _transactionDate,
      firstDate: DateTime(2023),
      lastDate: DateTime.now().add(const Duration(days: 1)),
    );
    if (picked != null) {
      setState(() => _transactionDate = picked);
    }
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    Navigator.pop(context, {
      'transaction_date': _date(_transactionDate),
      'transaction_type': _transactionType,
      'amount': num.parse(_amountController.text.trim()),
      'bank_name': _bankController.text.trim(),
      if (_accountController.text.trim().isNotEmpty)
        'account_number': _accountController.text.trim(),
      if (_referenceController.text.trim().isNotEmpty)
        'reference_number': _referenceController.text.trim(),
      'purpose_description': _purposeController.text.trim(),
      'payment_method': _paymentMethod,
      'purpose_category':
          _transactionType == 'DEPOSIT' ? 'deposit' : 'withdrawal',
      if (_notesController.text.trim().isNotEmpty)
        'notes': _notesController.text.trim(),
    });
  }
}

class _PaymentsInvoicesSection extends ConsumerStatefulWidget {
  const _PaymentsInvoicesSection();

  @override
  ConsumerState<_PaymentsInvoicesSection> createState() =>
      _PaymentsInvoicesSectionState();
}

class _PaymentsInvoicesSectionState
    extends ConsumerState<_PaymentsInvoicesSection> {
  String _status = 'all';
  late String _from =
      _date(DateTime(DateTime.now().year, DateTime.now().month, 1));
  late String _to = _today();
  late Future<Map<String, dynamic>> _future = _load();

  Future<Map<String, dynamic>> _load() async {
    final repo = ref.read(branchAccountantRepositoryProvider);
    final results = await Future.wait([
      repo.getBranchPayments(status: _status, startDate: _from, endDate: _to),
      repo.getBranchPaymentStats(startDate: _from, endDate: _to),
    ]);
    return {'payments': results[0], 'stats': results[1]};
  }

  void _refresh() => setState(() {
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (data) {
          final payments = _list(data['payments']);
          final stats = _map(data['stats']);
          return _Page(
            title: 'Payments Dashboard',
            subtitle:
                'All branch payments from banking, cashier payments, POS, and manual verification records.',
            actions: [
              _DateField(
                  value: _from, onChanged: (v) => setState(() => _from = v)),
              _DateField(value: _to, onChanged: (v) => setState(() => _to = v)),
              _Dropdown(
                value: _status,
                values: const [
                  'all',
                  'pending',
                  'accountant_verified',
                  'auditor_verified',
                  'flagged',
                ],
                labels: const {
                  'all': 'All',
                  'pending': 'Pending',
                  'accountant_verified': 'Awaiting Auditor',
                  'auditor_verified': 'Approved',
                  'flagged': 'Flagged',
                },
                onChanged: (v) => setState(() {
                  _status = v;
                  _future = _load();
                }),
              ),
              _RefreshButton(onPressed: _refresh),
            ],
            children: [
              _ResponsiveGrid(children: [
                _MetricCard(
                    'Total Payments',
                    '${_num(stats['total_payments']).toInt()}',
                    Icons.receipt,
                    Colors.blue),
                _MetricCard('Total Amount', _money(_num(stats['total_amount'])),
                    Icons.payments, Colors.green),
                _MetricCard('Pending', '${_num(stats['pending']).toInt()}',
                    Icons.hourglass_top, Colors.orange),
                _MetricCard(
                    'Approved',
                    '${_num(stats['auditor_verified']).toInt()}',
                    Icons.check_circle,
                    Colors.green),
                _MetricCard('Banking', _money(_num(stats['banking_total'])),
                    Icons.account_balance, Colors.teal),
                _MetricCard(
                    'POS / Cashier',
                    _money(_num(stats['pos_total']) +
                        _num(stats['payments_total'])),
                    Icons.point_of_sale,
                    Colors.purple),
              ]),
              _SectionCard(
                title: 'Branch Payments',
                child: _SimpleTable(
                  columns: const [
                    'Date',
                    'Source',
                    'Description',
                    'Method',
                    'Reference',
                    'Amount',
                    'Recorded By',
                    'Status',
                  ],
                  rows: payments
                      .map((payment) => [
                            _shortDate(_text(payment, [
                              '_transaction_date',
                              'recorded_at',
                              'created_at',
                              'transaction_date',
                            ])),
                            _paymentSourceLabel(payment),
                            _paymentDescription(payment),
                            _title(_text(payment, ['payment_method'])),
                            _paymentReference(payment),
                            _money(_num(payment['amount'])),
                            _paymentRecordedBy(payment),
                            _StatusPill(_paymentStatusLabel(
                                _text(payment, ['status']))),
                          ])
                      .toList(),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _CreditBillsSection extends ConsumerStatefulWidget {
  const _CreditBillsSection();

  @override
  ConsumerState<_CreditBillsSection> createState() =>
      _CreditBillsSectionState();
}

class _CreditBillsSectionState extends ConsumerState<_CreditBillsSection> {
  String _status = 'all';
  String _staffTab = 'credit';
  String _query = '';
  bool _customerMode = false;
  late Future<Map<String, dynamic>> _future = _load();

  Future<Map<String, dynamic>> _load() async {
    final repo = ref.read(branchAccountantRepositoryProvider);
    if (_customerMode) {
      return {'customer_bills': await repo.getCustomerUnpaidBills()};
    }
    Future<List<Map<String, dynamic>>> safe(
      Future<List<Map<String, dynamic>>> request,
    ) async {
      try {
        return await request;
      } catch (_) {
        return <Map<String, dynamic>>[];
      }
    }

    final results = await Future.wait<List<Map<String, dynamic>>>([
      safe(repo.getPayrollCreditBills(status: _status)),
      safe(repo.getPayrollCreditBills(status: 'pending')),
      safe(repo.getCashierPaidCreditEntries(status: 'pending')),
      safe(repo.getPayrollAdvances(status: _status)),
      safe(repo.getPayrollLoans(status: _status)),
      safe(repo.getBranchStaff()),
    ]);
    final creditBills = _status == 'all'
        ? results[0].where(_isOutstandingCreditBill).toList()
        : results[0];
    return {
      'credit_bills': creditBills,
      'pending_credit_bills': results[1],
      'paid_credit_entries': results[2],
      'advances': results[3],
      'loans': results[4],
      'staff': results[5],
    };
  }

  void _refresh() => setState(() {
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    if (_customerMode) return _buildCustomer();
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: _buildStaffLedger,
      ),
    );
  }

  Widget _buildStaffLedger(Map<String, dynamic> data) {
    final creditBills = _list(data['credit_bills']);
    final pendingCreditBills = _list(data['pending_credit_bills']);
    final paidCreditEntries = _list(data['paid_credit_entries']);
    final advances = _list(data['advances']);
    final loans = _list(data['loans']);
    final staff = _list(data['staff']);
    final lower = _query.trim().toLowerCase();
    final selectedItems = switch (_staffTab) {
      'approval' => pendingCreditBills,
      'paid_entries' => paidCreditEntries,
      'advance' => advances,
      'loan' => loans,
      _ => creditBills,
    }
        .where((item) =>
            lower.isEmpty || _staffLedgerHaystack(item).contains(lower))
        .toList();

    return _Page(
      title: 'Staff Credit, Advances & Loans',
      subtitle:
          'Branch-strict payroll ledger for cashier credit bills, paid credits, salary advances, and staff loans.',
      actions: [
        SegmentedButton<bool>(
          segments: const [
            ButtonSegment(value: false, label: Text('Staff')),
            ButtonSegment(value: true, label: Text('Customer')),
          ],
          selected: {_customerMode},
          onSelectionChanged: (v) => setState(() {
            _customerMode = v.first;
            _future = _load();
          }),
        ),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'approval', label: Text('Pending Approval')),
            ButtonSegment(value: 'credit', label: Text('Outstanding')),
            ButtonSegment(value: 'paid_entries', label: Text('Paid Entries')),
            ButtonSegment(value: 'advance', label: Text('Advances')),
            ButtonSegment(value: 'loan', label: Text('Loans')),
          ],
          selected: {_staffTab},
          onSelectionChanged: (v) => setState(() => _staffTab = v.first),
        ),
        _Dropdown(
          value: _status,
          values: const [
            'all',
            'pending',
            'paid_cash',
            'deducted',
            'cancelled',
            'accountant_confirmed',
            'auditor_confirmed'
          ],
          onChanged: (v) => setState(() {
            _status = v;
            _future = _load();
          }),
        ),
        SizedBox(
          width: 220,
          child: TextField(
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Search staff, ID, ref',
            ),
            onChanged: (v) => setState(() => _query = v),
          ),
        ),
        _RefreshButton(onPressed: _refresh),
        FilledButton.icon(
          onPressed: _staffTab == 'approval' || _staffTab == 'paid_entries'
              ? null
              : () => _createStaffLedgerEntry(staff),
          icon: const Icon(Icons.add),
          label: Text(switch (_staffTab) {
            'advance' => 'New Advance',
            'loan' => 'New Loan',
            _ => 'New Credit Bill',
          }),
        ),
      ],
      children: [
        _ResponsiveGrid(children: [
          _MetricCard('Pending Approval', '${pendingCreditBills.length}',
              Icons.fact_check, Colors.amber),
          _MetricCard('Outstanding Bills', '${creditBills.length}',
              Icons.credit_card, Colors.blue),
          _MetricCard(
              'Credit Outstanding',
              _money(creditBills.fold<num>(
                  0, (sum, e) => sum + _staffCreditBalance(e))),
              Icons.warning,
              Colors.orange),
          _MetricCard(
              'Paid Entries To Apply',
              _money(paidCreditEntries.fold<num>(
                  0, (sum, e) => sum + _num(e['remaining_amount']))),
              Icons.payments,
              Colors.green),
          _MetricCard(
              'Salary Advances',
              _money(advances.fold<num>(
                  0, (sum, e) => sum + _staffAdvanceBalance(e))),
              Icons.account_balance_wallet,
              Colors.indigo),
          _MetricCard(
              'Staff Loans',
              _money(
                  loans.fold<num>(0, (sum, e) => sum + _staffLoanBalance(e))),
              Icons.account_balance,
              Colors.purple),
        ]),
        _SectionCard(
          title: switch (_staffTab) {
            'approval' => 'Pending Staff Credit Approval',
            'paid_entries' => 'Cashier Paid Credits Pending Application',
            'advance' => 'Salary Advances',
            'loan' => 'Staff Loans',
            _ => 'Outstanding Staff Credit Bills',
          },
          child: switch (_staffTab) {
            'approval' => _buildPendingCreditBillsTable(selectedItems),
            'paid_entries' =>
              _buildPaidCreditEntriesTable(selectedItems, creditBills),
            'advance' => _buildAdvancesTable(selectedItems),
            'loan' => _buildLoansTable(selectedItems),
            _ => _buildCreditBillsTable(selectedItems),
          },
        ),
      ],
    );
  }

  Widget _buildCreditBillsTable(List<Map<String, dynamic>> items) {
    return _SimpleTable(
      columns: const [
        'Staff',
        'Employee ID',
        'Department',
        'Description',
        'Amount',
        'Paid',
        'Balance',
        'Status',
        'Date',
        'Actions'
      ],
      rows: items
          .map((e) => [
                _staffName(e),
                _text(e, ['employee_id', 'staff_code']),
                _text(e, ['department']),
                _text(e, ['description', 'credit_number']),
                _money(_num(e['amount'] ?? e['total_amount'])),
                _money(_num(e['paid_amount'])),
                _money(_staffCreditBalance(e)),
                _StatusPill(_text(e, ['status'])),
                _text(e, ['bill_date', 'created_at']),
                Row(mainAxisSize: MainAxisSize.min, children: [
                  _CompactAction(
                    label: 'View',
                    icon: Icons.visibility_outlined,
                    onPressed: () => _showRecord(context, e),
                  ),
                  const SizedBox(width: 6),
                  _CompactAction(
                    label: 'History',
                    icon: Icons.history,
                    onPressed: () => _showCreditPaymentHistory(e),
                  ),
                  const SizedBox(width: 6),
                  if (_staffCreditBalance(e) > 0)
                    _CompactAction(
                      label: 'Pay',
                      icon: Icons.payments_outlined,
                      filled: true,
                      onPressed: () => _recordPayrollCreditPayment(e),
                    ),
                ]),
              ])
          .toList(),
    );
  }

  Widget _buildPendingCreditBillsTable(List<Map<String, dynamic>> items) {
    return _SimpleTable(
      columns: const [
        'Staff',
        'Employee ID',
        'Department',
        'Description',
        'Amount',
        'Source',
        'Date',
        'Actions'
      ],
      rows: items
          .map((e) => [
                _staffName(e),
                _text(e, ['employee_id', 'staff_code']),
                _text(e, ['department']),
                _text(e, ['description', 'credit_number']),
                _money(_num(e['amount'] ?? e['total_amount'])),
                _text(e, ['source_type', 'reference_type']).isEmpty
                    ? 'Cashier / Branch'
                    : _text(e, ['source_type', 'reference_type']),
                _text(e, ['bill_date', 'created_at']),
                Row(mainAxisSize: MainAxisSize.min, children: [
                  _CompactAction(
                    label: 'View',
                    icon: Icons.visibility_outlined,
                    onPressed: () => _showRecord(context, e),
                  ),
                  const SizedBox(width: 6),
                  _CompactAction(
                    label: 'Approve',
                    icon: Icons.check_circle_outline,
                    filled: true,
                    onPressed: () => _approvePayrollCreditBill(e),
                  ),
                ]),
              ])
          .toList(),
    );
  }

  Widget _buildPaidCreditEntriesTable(
    List<Map<String, dynamic>> items,
    List<Map<String, dynamic>> outstandingBills,
  ) {
    return _SimpleTable(
      columns: const [
        'Staff',
        'Cashier',
        'Shift',
        'Amount',
        'Applied',
        'Remaining',
        'Method',
        'Status',
        'Date',
        'Actions'
      ],
      rows: items
          .map((e) => [
                _text(e, ['staff_name', 'employee_name', 'name']),
                _text(e, ['cashier_name']),
                _text(e, ['shift_number']),
                _money(_num(e['amount'])),
                _money(_num(e['applied_amount'])),
                _money(_num(e['remaining_amount'])),
                _text(e, ['payment_method']),
                _StatusPill(_text(e, ['review_status'])),
                _text(e, ['recorded_at', 'shift_end', 'shift_start']),
                Row(mainAxisSize: MainAxisSize.min, children: [
                  _CompactAction(
                    label: 'View',
                    icon: Icons.visibility_outlined,
                    onPressed: () => _showRecord(context, e),
                  ),
                  const SizedBox(width: 6),
                  if (_num(e['remaining_amount']) > 0)
                    _CompactAction(
                      label: 'Apply',
                      icon: Icons.call_merge,
                      filled: true,
                      onPressed: () =>
                          _applyPaidCreditEntry(e, outstandingBills),
                    ),
                ]),
              ])
          .toList(),
    );
  }

  Widget _buildAdvancesTable(List<Map<String, dynamic>> items) {
    return _SimpleTable(
      columns: const [
        'Staff',
        'Employee ID',
        'Department',
        'Amount',
        'Deduct Month',
        'Status',
        'Reason',
        'Date',
        'Actions'
      ],
      rows: items
          .map((e) => [
                _staffName(e),
                _text(e, ['employee_id', 'staff_code']),
                _text(e, ['department']),
                _money(_num(e['amount'])),
                '${e['month_to_deduct'] ?? '-'} / ${e['year_to_deduct'] ?? '-'}',
                _StatusPill(_text(e, ['status'])),
                _text(e, ['reason', 'description']),
                _text(e, ['advance_date', 'created_at']),
                Row(mainAxisSize: MainAxisSize.min, children: [
                  _CompactAction(
                    label: 'View',
                    icon: Icons.visibility_outlined,
                    onPressed: () => _showRecord(context, e),
                  ),
                  if (_isPendingApproval(e)) ...[
                    const SizedBox(width: 6),
                    _CompactAction(
                      label: 'Approve',
                      icon: Icons.check_circle_outline,
                      filled: true,
                      onPressed: () => _approveAdvance(e),
                    ),
                    const SizedBox(width: 6),
                    _CompactAction(
                      label: 'Reject',
                      icon: Icons.cancel_outlined,
                      onPressed: () => _rejectAdvance(e),
                    ),
                  ],
                ]),
              ])
          .toList(),
    );
  }

  Widget _buildLoansTable(List<Map<String, dynamic>> items) {
    return _SimpleTable(
      columns: const [
        'Staff',
        'Employee ID',
        'Department',
        'Principal',
        'Installment',
        'Balance',
        'Status',
        'Reason',
        'Actions'
      ],
      rows: items
          .map((e) => [
                _staffName(e),
                _text(e, ['employee_id', 'staff_code']),
                _text(e, ['department']),
                _money(_num(e['total_amount'] ?? e['amount'])),
                _money(_num(e['installment_amount'])),
                _money(_staffLoanBalance(e)),
                _StatusPill(_text(e, ['status'])),
                _text(e, ['reason', 'description']),
                Row(mainAxisSize: MainAxisSize.min, children: [
                  _CompactAction(
                    label: 'View',
                    icon: Icons.visibility_outlined,
                    onPressed: () => _showRecord(context, e),
                  ),
                  if (_isPendingApproval(e)) ...[
                    const SizedBox(width: 6),
                    _CompactAction(
                      label: 'Approve',
                      icon: Icons.check_circle_outline,
                      filled: true,
                      onPressed: () => _approveLoan(e),
                    ),
                    const SizedBox(width: 6),
                    _CompactAction(
                      label: 'Reject',
                      icon: Icons.cancel_outlined,
                      onPressed: () => _rejectLoan(e),
                    ),
                  ],
                  const SizedBox(width: 6),
                  if (_staffLoanBalance(e) > 0 && !_isPendingApproval(e))
                    _CompactAction(
                      label: 'Pay',
                      icon: Icons.payments_outlined,
                      filled: true,
                      onPressed: () => _recordLoanPayment(e),
                    ),
                ]),
              ])
          .toList(),
    );
  }

  String _staffName(Map<String, dynamic> row) {
    final staff = _map(row['staff']);
    final nestedName =
        '${staff['first_name'] ?? ''} ${staff['last_name'] ?? ''}'.trim();
    return _text(row, ['staff_name', 'employee_name', 'name']).isNotEmpty
        ? _text(row, ['staff_name', 'employee_name', 'name'])
        : nestedName;
  }

  String _staffLedgerHaystack(Map<String, dynamic> row) {
    return [
      _staffName(row),
      _text(row, ['employee_id', 'staff_code']),
      _text(row, ['department']),
      _text(row, ['description', 'reason', 'credit_number', 'reference']),
      _text(row, ['cashier_name', 'shift_number', 'review_status']),
      _text(row, ['status']),
    ].join(' ').toLowerCase();
  }

  num _staffCreditBalance(Map<String, dynamic> row) {
    final explicit = row['balance'];
    if (explicit != null) return _num(explicit);
    final cashierBalance = row['balance_amount'];
    if (cashierBalance != null) return _num(cashierBalance);
    return (_num(row['amount'] ?? row['total_amount']) -
            _num(row['paid_amount']))
        .clamp(0, double.infinity);
  }

  bool _isOutstandingCreditBill(Map<String, dynamic> row) {
    final status = _text(row, ['status']).toLowerCase();
    return ['accountant_confirmed', 'auditor_confirmed'].contains(status) &&
        _staffCreditBalance(row) > 0;
  }

  bool _isPendingApproval(Map<String, dynamic> row) {
    final status = _text(row, ['status']).toLowerCase();
    return status.isEmpty ||
        ['pending', 'pending_approval', 'requested'].contains(status);
  }

  num _staffAdvanceBalance(Map<String, dynamic> row) {
    final status = _text(row, ['status']).toLowerCase();
    if (['deducted', 'paid', 'paid_cash', 'cancelled', 'rejected']
        .contains(status)) {
      return 0;
    }
    return _num(row['balance'] ?? row['balance_amount'] ?? row['amount']);
  }

  num _staffLoanBalance(Map<String, dynamic> row) {
    final status = _text(row, ['status']).toLowerCase();
    if (['paid', 'closed', 'deducted', 'cancelled', 'rejected']
        .contains(status)) {
      return 0;
    }
    return _num(
        row['remaining_balance'] ?? row['balance'] ?? row['total_amount']);
  }

  Future<Map<String, dynamic>?> _pickStaff(
      List<Map<String, dynamic>> seedStaff) {
    var search = '';
    Future<List<Map<String, dynamic>>> load(String q) => ref
        .read(branchAccountantRepositoryProvider)
        .getBranchStaff(search: q.trim());

    return showDialog<Map<String, dynamic>>(
      context: context,
      builder: (dialogContext) {
        Future<List<Map<String, dynamic>>> future =
            Future.value(seedStaff.take(40).toList());
        return StatefulBuilder(builder: (context, setDialogState) {
          return AlertDialog(
            title: const Text('Select Branch Staff'),
            content: SizedBox(
              width: 620,
              height: 520,
              child: Column(
                children: [
                  TextField(
                    autofocus: true,
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search),
                      hintText: 'Search staff name, employee ID, department',
                    ),
                    onChanged: (value) {
                      search = value;
                      setDialogState(() {
                        future = load(search);
                      });
                    },
                  ),
                  const SizedBox(height: 12),
                  Expanded(
                    child: FutureBuilder<List<Map<String, dynamic>>>(
                      future: future,
                      builder: (context, snap) {
                        final items = snap.data ?? const [];
                        if (snap.connectionState == ConnectionState.waiting) {
                          return const Center(
                              child: CircularProgressIndicator());
                        }
                        if (items.isEmpty) {
                          return const Center(child: Text('No staff found'));
                        }
                        return ListView.separated(
                          itemCount: items.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, index) {
                            final staff = items[index];
                            final name =
                                '${staff['first_name'] ?? ''} ${staff['last_name'] ?? ''}'
                                    .trim();
                            return ListTile(
                              leading: const Icon(Icons.person),
                              title: Text(name.isEmpty
                                  ? _text(staff, ['name', 'email'])
                                  : name),
                              subtitle: Text([
                                _text(staff, ['employee_id', 'id_number']),
                                _text(staff, ['department']),
                                _text(staff, ['role', 'position']),
                              ].where((v) => v.isNotEmpty).join(' • ')),
                              onTap: () => Navigator.pop(dialogContext, staff),
                            );
                          },
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Cancel'),
              ),
            ],
          );
        });
      },
    );
  }

  Future<void> _createStaffLedgerEntry(
      List<Map<String, dynamic>> staffList) async {
    final staff = await _pickStaff(staffList);
    if (staff == null) return;
    switch (_staffTab) {
      case 'advance':
        await _createAdvance(staff);
        break;
      case 'loan':
        await _createLoan(staff);
        break;
      default:
        await _createPayrollCreditBill(staff);
    }
  }

  Future<void> _createPayrollCreditBill(Map<String, dynamic> staff) async {
    final data = await _formDialog(
      context,
      'Record Staff Credit Bill',
      const ['amount', 'description', 'bill_date'],
      initial: {
        'bill_date': _today(),
        'description': 'Branch accountant staff credit bill',
      },
    );
    if (data == null) return;
    if (!mounted) return;
    final amount = _num(data['amount']);
    if (amount <= 0) {
      _notify(context, 'Enter an amount greater than zero');
      return;
    }
    await ref.read(branchAccountantRepositoryProvider).createPayrollCreditBill({
      'staff_id': staff['id'],
      'amount': amount,
      'description': '${data['description'] ?? ''}'.trim(),
      'date': '${data['bill_date'] ?? _today()}',
    });
    if (mounted) _notify(context, 'Staff credit bill recorded');
    _refresh();
  }

  Future<void> _createAdvance(Map<String, dynamic> staff) async {
    final now = DateTime.now();
    final data = await _formDialog(
      context,
      'Record Salary Advance',
      const [
        'amount',
        'reason',
        'advance_date',
        'month_to_deduct',
        'year_to_deduct'
      ],
      initial: {
        'advance_date': _today(),
        'month_to_deduct': '${now.month}',
        'year_to_deduct': '${now.year}',
      },
    );
    if (data == null) return;
    if (!mounted) return;
    final amount = _num(data['amount']);
    if (amount <= 0) {
      _notify(context, 'Enter an amount greater than zero');
      return;
    }
    await ref.read(branchAccountantRepositoryProvider).createPayrollAdvance({
      'staff_id': staff['id'],
      'amount': amount,
      'reason': '${data['reason'] ?? ''}'.trim(),
      'advance_date': '${data['advance_date'] ?? _today()}',
      'month_to_deduct':
          int.tryParse('${data['month_to_deduct']}') ?? now.month,
      'year_to_deduct': int.tryParse('${data['year_to_deduct']}') ?? now.year,
    });
    if (mounted) _notify(context, 'Salary advance recorded');
    _refresh();
  }

  Future<void> _approveAdvance(Map<String, dynamic> advance) async {
    await ref
        .read(branchAccountantRepositoryProvider)
        .approvePayrollAdvance('${advance['id']}');
    if (mounted) _notify(context, 'Salary advance approved');
    _refresh();
  }

  Future<void> _rejectAdvance(Map<String, dynamic> advance) async {
    await ref
        .read(branchAccountantRepositoryProvider)
        .rejectPayrollAdvance('${advance['id']}');
    if (mounted) _notify(context, 'Salary advance rejected');
    _refresh();
  }

  Future<void> _createLoan(Map<String, dynamic> staff) async {
    final now = DateTime.now();
    final data = await _formDialog(
      context,
      'Record Staff Loan',
      const [
        'total_amount',
        'installment_amount',
        'reason',
        'loan_date',
        'start_deduction_month',
        'start_deduction_year'
      ],
      initial: {
        'loan_date': _today(),
        'start_deduction_month': '${now.month}',
        'start_deduction_year': '${now.year}',
      },
    );
    if (data == null) return;
    if (!mounted) return;
    final total = _num(data['total_amount']);
    final installment = _num(data['installment_amount']);
    if (total <= 0 || installment <= 0) {
      _notify(context, 'Enter valid loan and installment amounts');
      return;
    }
    await ref.read(branchAccountantRepositoryProvider).createPayrollLoan({
      'staff_id': staff['id'],
      'total_amount': total,
      'installment_amount': installment,
      'reason': '${data['reason'] ?? ''}'.trim(),
      'loan_date': '${data['loan_date'] ?? _today()}',
      'start_deduction_month':
          int.tryParse('${data['start_deduction_month']}') ?? now.month,
      'start_deduction_year':
          int.tryParse('${data['start_deduction_year']}') ?? now.year,
    });
    if (mounted) _notify(context, 'Staff loan recorded');
    _refresh();
  }

  Future<void> _approveLoan(Map<String, dynamic> loan) async {
    await ref
        .read(branchAccountantRepositoryProvider)
        .approvePayrollLoan('${loan['id']}');
    if (mounted) _notify(context, 'Staff loan approved');
    _refresh();
  }

  Future<void> _rejectLoan(Map<String, dynamic> loan) async {
    await ref
        .read(branchAccountantRepositoryProvider)
        .rejectPayrollLoan('${loan['id']}');
    if (mounted) _notify(context, 'Staff loan rejected');
    _refresh();
  }

  Future<void> _recordPayrollCreditPayment(Map<String, dynamic> bill) async {
    final balance = _staffCreditBalance(bill);
    final data = await _formDialog(
      context,
      'Record Credit Bill Payment',
      const ['amount', 'payment_method', 'reference', 'notes'],
      initial: {
        'amount': balance.toStringAsFixed(0),
        'payment_method': 'cash',
      },
    );
    if (data == null) return;
    if (!mounted) return;
    final amount = _num(data['amount']);
    if (amount <= 0) {
      _notify(context, 'Enter a payment amount');
      return;
    }
    await ref
        .read(branchAccountantRepositoryProvider)
        .recordPayrollCreditBillPayment('${bill['id']}', {
      'amount': amount,
      'payment_method': '${data['payment_method'] ?? 'cash'}'.trim(),
      if ('${data['reference'] ?? ''}'.trim().isNotEmpty)
        'reference': '${data['reference']}'.trim(),
      if ('${data['notes'] ?? ''}'.trim().isNotEmpty)
        'notes': '${data['notes']}'.trim(),
    });
    if (mounted) _notify(context, 'Credit bill payment recorded');
    _refresh();
  }

  Future<void> _approvePayrollCreditBill(Map<String, dynamic> bill) async {
    final data = await _formDialog(
      context,
      'Approve Staff Credit Bill',
      const ['notes'],
      initial: {'notes': ''},
    );
    if (data == null || !mounted) return;
    await ref.read(branchAccountantRepositoryProvider).approvePayrollCreditBill(
        '${bill['id']}',
        notes: '${data['notes'] ?? ''}');
    if (mounted) _notify(context, 'Credit bill approved');
    _refresh();
  }

  Future<void> _applyPaidCreditEntry(
    Map<String, dynamic> entry,
    List<Map<String, dynamic>> seedOutstandingBills,
  ) async {
    final staffId = _text(entry, ['staff_id']);
    final repo = ref.read(branchAccountantRepositoryProvider);
    final bills = staffId.isNotEmpty
        ? await repo
            .getPayrollCreditBills(
              status: 'all',
              staffId: staffId,
            )
            .then(
              (rows) => rows.where(_isOutstandingCreditBill).toList(),
            )
        : seedOutstandingBills;
    if (!mounted) return;
    if (bills.isEmpty) {
      _notify(context, 'No approved outstanding credit bill for this staff');
      return;
    }
    final selected = await _selectCreditBillForPaidEntry(entry, bills);
    if (selected == null || !mounted) return;
    await repo
        .applyCashierPaidCreditEntry('${entry['entry_id'] ?? entry['id']}', {
      'staff_credit_bill_id': selected['bill']['id'],
      'amount': selected['amount'],
      if (_text(entry, ['source_table']).isNotEmpty)
        'source_table': _text(entry, ['source_table']),
      if ('${selected['notes'] ?? ''}'.trim().isNotEmpty)
        'notes': '${selected['notes']}'.trim(),
    });
    if (mounted) _notify(context, 'Cashier paid credit applied');
    _refresh();
  }

  Future<Map<String, dynamic>?> _selectCreditBillForPaidEntry(
    Map<String, dynamic> entry,
    List<Map<String, dynamic>> bills,
  ) {
    Map<String, dynamic>? selected = bills.first;
    final amountController = TextEditingController(
      text: _num(entry['remaining_amount']).toStringAsFixed(0),
    );
    final notesController = TextEditingController();
    return showDialog<Map<String, dynamic>>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) {
          final balance = selected == null ? 0 : _staffCreditBalance(selected!);
          return AlertDialog(
            title: const Text('Apply Cashier Paid Credit'),
            content: SizedBox(
              width: 680,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    '${_text(entry, [
                          'staff_name'
                        ])} paid ${_money(_num(entry['remaining_amount']))} via ${_text(entry, [
                          'payment_method'
                        ])}',
                  ),
                  const SizedBox(height: 12),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 260),
                    child: ListView.separated(
                      shrinkWrap: true,
                      itemCount: bills.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final bill = bills[index];
                        final isSelected = selected?['id'] == bill['id'];
                        return ListTile(
                          selected: isSelected,
                          leading: Icon(isSelected
                              ? Icons.radio_button_checked
                              : Icons.radio_button_unchecked),
                          title: Text(_text(bill, ['description']).isNotEmpty
                              ? _text(bill, ['description'])
                              : 'Staff credit bill'),
                          subtitle: Text(
                            '${_text(bill, [
                                  'bill_date',
                                  'created_at'
                                ])} • Balance ${_money(_staffCreditBalance(bill))}',
                          ),
                          onTap: () => setDialogState(() => selected = bill),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: amountController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: 'Amount to apply',
                      helperText: 'Selected bill balance: ${_money(balance)}',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: notesController,
                    decoration: const InputDecoration(
                      labelText: 'Notes (optional)',
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: selected == null
                    ? null
                    : () {
                        final amount = _num(amountController.text);
                        if (amount <= 0) return;
                        Navigator.pop(dialogContext, {
                          'bill': selected,
                          'amount': amount,
                          'notes': notesController.text,
                        });
                      },
                child: const Text('Apply'),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _showCreditPaymentHistory(Map<String, dynamic> bill) async {
    final rows = await ref
        .read(branchAccountantRepositoryProvider)
        .getPayrollCreditBillPayments('${bill['id']}');
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Credit Bill Payment History'),
        content: SizedBox(
          width: 780,
          child: rows.isEmpty
              ? Padding(
                  padding: ScreenSize.p(context),
                  child: Text('No payment history recorded yet'),
                )
              : _SimpleTable(
                  columns: const [
                    'Date',
                    'Amount',
                    'Method',
                    'Reference',
                    'Recorded By',
                    'Notes'
                  ],
                  rows: rows
                      .map((row) => [
                            _text(row, ['payment_date', 'created_at']),
                            _money(_num(row['amount'])),
                            _text(row, ['payment_method']),
                            _text(row, ['reference']),
                            _recordedByName(row),
                            _text(row, ['notes']),
                          ])
                      .toList(),
                ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  String _recordedByName(Map<String, dynamic> row) {
    final user = _map(row['recorded_by_user']);
    final name =
        '${user['first_name'] ?? ''} ${user['last_name'] ?? ''}'.trim();
    return name.isEmpty ? _text(row, ['recorded_by']) : name;
  }

  Future<void> _recordLoanPayment(Map<String, dynamic> loan) async {
    final balance = _staffLoanBalance(loan);
    final data = await _formDialog(
      context,
      'Record Staff Loan Payment',
      const ['amount', 'payment_method', 'reference', 'notes'],
      initial: {
        'amount': balance.toStringAsFixed(0),
        'payment_method': 'cash',
      },
    );
    if (data == null) return;
    if (!mounted) return;
    final amount = _num(data['amount']);
    if (amount <= 0) {
      _notify(context, 'Enter a payment amount');
      return;
    }
    await ref
        .read(branchAccountantRepositoryProvider)
        .recordPayrollLoanPayment('${loan['id']}', {
      'amount': amount,
      'payment_method': '${data['payment_method'] ?? 'cash'}'.trim(),
      if ('${data['reference'] ?? ''}'.trim().isNotEmpty)
        'reference': '${data['reference']}'.trim(),
      if ('${data['notes'] ?? ''}'.trim().isNotEmpty)
        'notes': '${data['notes']}'.trim(),
    });
    if (mounted) _notify(context, 'Loan payment recorded');
    _refresh();
  }

  // ── Customer credit bills view ──────────────────────────────────────────────
  Widget _buildCustomer() {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (payload) {
          final items = _list(payload['customer_bills']);
          num outstanding(Map<String, dynamic> b) =>
              _num(b['balance_amount'] ?? b['outstanding_amount']) != 0
                  ? _num(b['balance_amount'] ?? b['outstanding_amount'])
                  : _num(b['total_amount'] ?? b['amount']) -
                      _num(b['paid_amount']);
          return _Page(
            title: 'Credit Bills',
            subtitle:
                'Customer credit bills (unpaid bills) — record, settle, and print.',
            actions: [
              SegmentedButton<bool>(
                segments: const [
                  ButtonSegment(value: false, label: Text('Staff')),
                  ButtonSegment(value: true, label: Text('Customer')),
                ],
                selected: {_customerMode},
                onSelectionChanged: (v) => setState(() {
                  _customerMode = v.first;
                  _future = _load();
                }),
              ),
              OutlinedButton.icon(
                onPressed: _downloadOutstanding,
                icon: const Icon(Icons.download, size: 16),
                label: const Text('Outstanding PDF'),
              ),
              _RefreshButton(onPressed: _refresh),
              FilledButton.icon(
                onPressed: _createCustomerBill,
                icon: const Icon(Icons.add),
                label: const Text('New Customer Bill'),
              ),
            ],
            children: [
              _ResponsiveGrid(children: [
                _MetricCard('Customer Bills', '${items.length}',
                    Icons.receipt_long, Colors.blue),
                _MetricCard('Total', _money(_sum(items, 'total_amount')),
                    Icons.payments, Colors.green),
                _MetricCard(
                    'Outstanding',
                    _money(items.fold<num>(0, (s, b) => s + outstanding(b))),
                    Icons.warning,
                    Colors.orange),
              ]),
              _SectionCard(
                title: 'Customer Credit Bills',
                child: _SimpleTable(
                  columns: const [
                    'Customer',
                    'Reference',
                    'Total',
                    'Outstanding',
                    'Status',
                    'Date',
                    'Actions'
                  ],
                  rows: items
                      .map((e) => [
                            _text(e, ['customer_name']),
                            _text(e, ['bill_number', 'reference', 'id']),
                            _money(_num(e['total_amount'] ?? e['amount'])),
                            _money(outstanding(e)),
                            _StatusPill(_text(e, ['status'])),
                            _text(e, ['created_at', 'bill_date', 'due_date']),
                            Wrap(spacing: 6, children: [
                              TextButton(
                                  onPressed: () => _showRecord(context, e),
                                  child: const Text('View')),
                              if (outstanding(e) > 0)
                                FilledButton.tonal(
                                    onPressed: () => _payCustomerBill(e),
                                    child: const Text('Record Payment')),
                              IconButton(
                                tooltip: 'Invoice PDF',
                                icon: const Icon(Icons.download, size: 18),
                                onPressed: () => _downloadInvoice(e),
                              ),
                            ]),
                          ])
                      .toList(),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _createCustomerBill() async {
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => const _CustomerCreditBillDialog(),
    );
    if (result == true && mounted) {
      _notify(context, 'Customer credit bill recorded');
      _refresh();
    }
  }

  Future<void> _payCustomerBill(Map<String, dynamic> bill) async {
    final balance = _num(bill['balance_amount'] ??
        bill['outstanding_amount'] ??
        bill['total_amount'] ??
        bill['amount']);
    final data = await _formDialog(
      context,
      'Record Customer Payment',
      const ['amount', 'payment_method', 'reference', 'notes'],
      initial: {
        if (balance > 0) 'amount': balance.toStringAsFixed(0),
        'payment_method': 'cash',
      },
    );
    if (data == null) return;
    final amount = num.tryParse('${data['amount']}'.trim()) ?? 0;
    if (amount <= 0) {
      if (mounted) _notify(context, 'Enter a payment amount greater than zero');
      return;
    }
    final method = '${data['payment_method'] ?? ''}'.trim();
    try {
      await ref
          .read(branchAccountantRepositoryProvider)
          .recordUnpaidBillPayment(
        '${bill['id']}',
        {
          'payment_amount': amount,
          'payment_method': method.isEmpty ? 'cash' : method,
          if ('${data['reference'] ?? ''}'.trim().isNotEmpty)
            'payment_reference': '${data['reference']}'.trim(),
          if ('${data['notes'] ?? ''}'.trim().isNotEmpty)
            'notes': '${data['notes']}'.trim(),
        },
      );
      if (mounted) _notify(context, 'Payment recorded');
      _refresh();
    } catch (e) {
      if (mounted) {
        _notify(context,
            'Failed to record payment: ${e is DioException ? (e.response?.data is Map ? (e.response?.data['message'] ?? e.message) : e.message) : e}');
      }
    }
  }

  Future<void> _downloadInvoice(Map<String, dynamic> bill) async {
    try {
      final file = await ref
          .read(branchAccountantRepositoryProvider)
          .downloadUnpaidBillInvoice('${bill['id']}');
      if (mounted) _notify(context, 'Invoice saved to ${file.path}');
    } catch (e) {
      if (mounted) _notify(context, 'Failed to download invoice: $e');
    }
  }

  Future<void> _downloadOutstanding() async {
    try {
      final file = await ref
          .read(branchAccountantRepositoryProvider)
          .downloadOutstandingCustomerCredits();
      if (mounted) _notify(context, 'Report saved to ${file.path}');
    } catch (e) {
      if (mounted) _notify(context, 'Failed to download report: $e');
    }
  }
}

// ── Customer Credit Bill create dialog ────────────────────────────────────────
class _CustomerCreditBillDialog extends ConsumerStatefulWidget {
  const _CustomerCreditBillDialog();

  @override
  ConsumerState<_CustomerCreditBillDialog> createState() =>
      _CustomerCreditBillDialogState();
}

class _CustomerCreditBillDialogState
    extends ConsumerState<_CustomerCreditBillDialog> {
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  String _customerType = 'corporate';
  final _dueDateCtrl = TextEditingController(text: _today());
  final _termsCtrl = TextEditingController();
  final _remarksCtrl = TextEditingController();
  final List<Map<String, dynamic>> _lines = [
    {'description': '', 'quantity': 1.0, 'unitPrice': 0.0},
  ];
  bool _saving = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _dueDateCtrl.dispose();
    _termsCtrl.dispose();
    _remarksCtrl.dispose();
    super.dispose();
  }

  num get _total => _lines.fold<num>(
      0, (s, l) => s + _num(l['quantity']) * _num(l['unitPrice']));

  Future<void> _save() async {
    if (_nameCtrl.text.trim().isEmpty) {
      _notify(context, 'Customer name is required');
      return;
    }
    final validLines = _lines
        .where((l) =>
            _text(l, ['description']).isNotEmpty && _num(l['quantity']) > 0)
        .toList();
    if (validLines.isEmpty) {
      _notify(context, 'Add at least one valid item');
      return;
    }
    if (_total <= 0) {
      _notify(context, 'Total must be greater than zero');
      return;
    }
    setState(() => _saving = true);
    try {
      await ref
          .read(branchAccountantRepositoryProvider)
          .createCustomerUnpaidBill({
        'bill_type': 'customer_credit',
        'reference_type': 'branch_customer_credit',
        'customer_type': _customerType,
        'customer_name': _nameCtrl.text.trim(),
        if (_phoneCtrl.text.trim().isNotEmpty)
          'customer_phone': _phoneCtrl.text.trim(),
        'total_amount': num.parse(_total.toStringAsFixed(2)),
        if (_termsCtrl.text.trim().isNotEmpty)
          'payment_terms': _termsCtrl.text.trim(),
        'due_date': _dueDateCtrl.text.trim(),
        if (_remarksCtrl.text.trim().isNotEmpty)
          'remarks': _remarksCtrl.text.trim(),
        'items': validLines
            .map((l) => {
                  'description': l['description'],
                  'quantity': _num(l['quantity']),
                  'unitPrice': _num(l['unitPrice']),
                })
            .toList(),
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        _notify(context,
            'Failed: ${e is DioException ? (e.response?.data is Map ? (e.response?.data['message'] ?? e.message) : e.message) : e}');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('New Customer Credit Bill'),
      content: SizedBox(
        width: 680,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(children: [
                Expanded(
                  child: TextField(
                    controller: _nameCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Customer Name *'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _phoneCtrl,
                    decoration: const InputDecoration(labelText: 'Phone'),
                  ),
                ),
              ]),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _customerType,
                    decoration:
                        const InputDecoration(labelText: 'Customer Type'),
                    items: const [
                      DropdownMenuItem(
                          value: 'corporate', child: Text('Corporate')),
                      DropdownMenuItem(
                          value: 'individual', child: Text('Individual')),
                      DropdownMenuItem(
                          value: 'walk_in', child: Text('Walk-in')),
                    ],
                    onChanged: (v) =>
                        setState(() => _customerType = v ?? 'corporate'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _dueDateCtrl,
                    decoration: const InputDecoration(
                        labelText: 'Due Date (YYYY-MM-DD)'),
                  ),
                ),
              ]),
              const SizedBox(height: 10),
              TextField(
                controller: _termsCtrl,
                decoration: const InputDecoration(labelText: 'Payment Terms'),
              ),
              const SizedBox(height: 14),
              Row(children: [
                const Expanded(
                    child: Text('Items',
                        style: TextStyle(fontWeight: FontWeight.w800))),
                OutlinedButton.icon(
                  onPressed: () => setState(() => _lines.add(
                      {'description': '', 'quantity': 1.0, 'unitPrice': 0.0})),
                  icon: const Icon(Icons.add, size: 16),
                  label: const Text('Add Item'),
                ),
              ]),
              const SizedBox(height: 8),
              ..._lines.asMap().entries.map((entry) {
                final i = entry.key;
                final line = entry.value;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(children: [
                    Expanded(
                      flex: 4,
                      child: TextField(
                        decoration:
                            const InputDecoration(labelText: 'Description'),
                        controller: TextEditingController(
                            text: '${line['description']}'),
                        onChanged: (v) => line['description'] = v,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Qty'),
                        controller: TextEditingController(
                            text: '${_num(line['quantity'])}'),
                        onChanged: (v) {
                          line['quantity'] = num.tryParse(v) ?? 0;
                          setState(() {});
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Price'),
                        controller: TextEditingController(
                            text: '${_num(line['unitPrice'])}'),
                        onChanged: (v) {
                          line['unitPrice'] = num.tryParse(v) ?? 0;
                          setState(() {});
                        },
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 18),
                      onPressed: _lines.length > 1
                          ? () => setState(() => _lines.removeAt(i))
                          : null,
                    ),
                  ]),
                );
              }),
              const Divider(),
              Align(
                alignment: Alignment.centerRight,
                child: Text('Total: ${_money(_total)}',
                    style: const TextStyle(fontWeight: FontWeight.w800)),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel')),
        FilledButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Record Bill'),
        ),
      ],
    );
  }
}

class _FoodVarianceSection extends ConsumerStatefulWidget {
  const _FoodVarianceSection();

  @override
  ConsumerState<_FoodVarianceSection> createState() =>
      _FoodVarianceSectionState();
}

class _FoodVarianceSectionState extends ConsumerState<_FoodVarianceSection> {
  late Future<List<Map<String, dynamic>>> _future =
      ref.read(branchAccountantRepositoryProvider).getPendingFoodVariances();

  void _refresh() {
    final nextFuture =
        ref.read(branchAccountantRepositoryProvider).getPendingFoodVariances();
    setState(() {
      _future = nextFuture;
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (items) => _Page(
          title: 'Food Control Variance',
          subtitle:
              'Review variance explanations from kitchen, buffet, and catering food control.',
          actions: [_RefreshButton(onPressed: _refresh)],
          children: [
            _SectionCard(
              title: 'Pending Variances',
              child: _SimpleTable(
                columns: const [
                  'Item',
                  'Expected',
                  'Actual',
                  'Variance',
                  'Reason',
                  'Status',
                  'Actions'
                ],
                rows: items
                    .map((e) => [
                          _text(e, ['item_name', 'name']),
                          _num(e['expected_quantity']).toStringAsFixed(2),
                          _num(e['actual_quantity']).toStringAsFixed(2),
                          _num(e['variance_quantity'] ?? e['variance'])
                              .toStringAsFixed(2),
                          _text(e, ['variance_reason', 'reason']),
                          _StatusPill(_text(e, ['status'])),
                          Wrap(spacing: 8, children: [
                            TextButton(
                                onPressed: () => _showRecord(context, e),
                                child: const Text('View')),
                            FilledButton.tonal(
                                onPressed: () => _approve(e),
                                child: const Text('Approve')),
                            OutlinedButton(
                                onPressed: () => _flag(e),
                                child: const Text('Flag')),
                          ]),
                        ])
                    .toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _approve(Map<String, dynamic> item) async {
    await ref
        .read(branchAccountantRepositoryProvider)
        .approveFoodVariance('${item['id']}');
    _toast('Variance approved');
    _refresh();
  }

  Future<void> _flag(Map<String, dynamic> item) async {
    final notes = await _textDialog(context, 'Flag Variance', hint: 'Notes');
    if (notes == null) return;
    await ref
        .read(branchAccountantRepositoryProvider)
        .flagFoodVariance('${item['id']}', notes);
    _toast('Variance flagged');
    _refresh();
  }
}

class _ShiftPnlSection extends ConsumerStatefulWidget {
  const _ShiftPnlSection();

  @override
  ConsumerState<_ShiftPnlSection> createState() => _ShiftPnlSectionState();
}

class _ShiftPnlSectionState extends ConsumerState<_ShiftPnlSection> {
  String _status = 'all';
  late Future<Map<String, dynamic>> _future = _load();

  Future<Map<String, dynamic>> _load() async {
    final repo = ref.read(branchAccountantRepositoryProvider);
    final results = await Future.wait([
      repo.getShiftPnLs(status: _status),
      repo.getShiftPnLSummary(),
    ]);
    return {'items': results[0], 'summary': results[1]};
  }

  void _refresh() => setState(() {
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (data) {
          final items = _list(data['items']);
          final summary = _map(data['summary']);
          return _Page(
            title: 'Shift Profit & Loss',
            subtitle:
                'Review shift sales, food cost, COGS, gross profit, and margin.',
            actions: [
              _Dropdown(
                value: _status,
                values: const ['all', 'draft', 'submitted', 'reviewed'],
                onChanged: (v) => setState(() {
                  _status = v;
                  _future = _load();
                }),
              ),
              _RefreshButton(onPressed: _refresh),
            ],
            children: [
              _ResponsiveGrid(children: [
                _MetricCard(
                    'Shifts', '${items.length}', Icons.schedule, Colors.blue),
                _MetricCard('Sales', _money(_num(summary['total_sales'])),
                    Icons.payments, Colors.green),
                _MetricCard('COGS', _money(_num(summary['total_cogs'])),
                    Icons.inventory, Colors.orange),
                _MetricCard(
                    'Gross Profit',
                    _money(_num(summary['gross_profit'])),
                    Icons.insights,
                    Colors.purple),
              ]),
              _SectionCard(
                title: 'Shift P&L Records',
                child: _SimpleTable(
                  columns: const [
                    'Shift',
                    'Sales',
                    'COGS',
                    'Gross Profit',
                    'Margin',
                    'Status',
                    'Actions'
                  ],
                  rows: items
                      .map((e) => [
                            _text(e, ['shift_number', 'shift_id', 'id']),
                            _money(_num(e['total_sales'])),
                            _money(_num(e['total_cogs'])),
                            _money(_num(e['gross_profit'])),
                            '${_num(e['profit_margin']).toStringAsFixed(1)}%',
                            _StatusPill(_text(e, ['status'])),
                            Wrap(spacing: 8, children: [
                              TextButton(
                                  onPressed: () => _showRecord(context, e),
                                  child: const Text('View')),
                              FilledButton.tonal(
                                  onPressed: () => _review(e),
                                  child: const Text('Review')),
                            ]),
                          ])
                      .toList(),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _review(Map<String, dynamic> pnl) async {
    final notes =
        await _textDialog(context, 'Review Shift P&L', hint: 'Review notes');
    if (notes == null) return;
    await ref
        .read(branchAccountantRepositoryProvider)
        .reviewShiftPnL('${pnl['shift_id'] ?? pnl['id']}', notes);
    _toast('Shift P&L reviewed');
    _refresh();
  }
}

class _BookingsInvoicesSection extends ConsumerStatefulWidget {
  const _BookingsInvoicesSection();

  @override
  ConsumerState<_BookingsInvoicesSection> createState() =>
      _BookingsInvoicesSectionState();
}

class _BookingsInvoicesSectionState
    extends ConsumerState<_BookingsInvoicesSection> {
  String _sourceType = 'all';
  String _status = 'all';
  late Future<Map<String, dynamic>> _future = ref
      .read(branchAccountantRepositoryProvider)
      .getBookingInvoiceQueue(sourceType: _sourceType, status: _status);

  void _refresh() {
    final nextFuture = ref
        .read(branchAccountantRepositoryProvider)
        .getBookingInvoiceQueue(sourceType: _sourceType, status: _status);
    setState(() {
      _future = nextFuture;
    });
  }

  Future<void> _generateInvoice(Map<String, dynamic> source) async {
    final sourceType = _text(source, ['source_type']);
    final sourceId = _text(source, ['id']);
    if (sourceType.isEmpty || sourceId.isEmpty) return;
    try {
      _notify(context, 'Generating invoice...');
      await ref
          .read(branchAccountantRepositoryProvider)
          .createBookingSourceInvoice(sourceType, sourceId);
      if (mounted) _notify(context, 'Invoice generated');
      _refresh();
    } catch (e) {
      if (mounted) _notify(context, 'Failed to generate invoice: $e');
    }
  }

  Future<void> _downloadInvoice(Map<String, dynamic> row) async {
    final invoiceId = _text(row, ['invoice_id', 'id']);
    if (invoiceId.isEmpty) return;
    try {
      _notify(context, 'Preparing branded invoice PDF...');
      final file = await ref
          .read(branchAccountantRepositoryProvider)
          .downloadArInvoicePdf(
            invoiceId,
            invoiceNumber: _text(row, ['invoice_number']),
          );
      if (mounted) _notify(context, 'Invoice PDF saved to ${file.path}');
    } catch (e) {
      if (mounted) _notify(context, 'Failed to download invoice: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (payload) {
          final items = _list(payload);
          final summary = _map(payload['summary']);
          final uninvoiced = items
              .where((e) =>
                  _text(e, ['source_type']) != 'invoice' &&
                  _text(e, ['invoice_id']).isEmpty)
              .length;
          final invoiced = items.where((e) {
            return _text(e, ['invoice_id']).isNotEmpty ||
                _text(e, ['source_type']) == 'invoice';
          }).length;
          final outstanding = summary.isEmpty
              ? items.fold<num>(0, (sum, e) => sum + _num(e['balance']))
              : _num(summary['outstanding_amount']);
          return _Page(
            title: 'Bookings & Invoices',
            subtitle:
                'Invoice room bookings, conference bookings, and outside catering from one branch queue.',
            actions: [
              SizedBox(
                width: 190,
                child: DropdownButtonFormField<String>(
                  initialValue: _sourceType,
                  decoration: const InputDecoration(labelText: 'Source'),
                  items: const [
                    DropdownMenuItem(value: 'all', child: Text('All sources')),
                    DropdownMenuItem(value: 'room', child: Text('Rooms')),
                    DropdownMenuItem(
                        value: 'conference', child: Text('Conference')),
                    DropdownMenuItem(
                        value: 'outside_catering',
                        child: Text('Outside Catering')),
                  ],
                  onChanged: (value) {
                    setState(() => _sourceType = value ?? 'all');
                    _refresh();
                  },
                ),
              ),
              SizedBox(
                width: 170,
                child: DropdownButtonFormField<String>(
                  initialValue: _status,
                  decoration: const InputDecoration(labelText: 'Status'),
                  items: const [
                    DropdownMenuItem(value: 'all', child: Text('All')),
                    DropdownMenuItem(value: 'pending', child: Text('Pending')),
                    DropdownMenuItem(value: 'unpaid', child: Text('Unpaid')),
                    DropdownMenuItem(value: 'partial', child: Text('Partial')),
                    DropdownMenuItem(value: 'paid', child: Text('Paid')),
                  ],
                  onChanged: (value) {
                    setState(() => _status = value ?? 'all');
                    _refresh();
                  },
                ),
              ),
              _RefreshButton(onPressed: _refresh),
            ],
            children: [
              _ResponsiveGrid(children: [
                _MetricCard('Total Records', '${items.length}',
                    Icons.request_quote, Colors.blue),
                _MetricCard('Need Invoice', '$uninvoiced',
                    Icons.pending_actions, Colors.orange),
                _MetricCard(
                    'Invoiced', '$invoiced', Icons.receipt_long, Colors.green),
                _MetricCard('Outstanding', _money(outstanding),
                    Icons.account_balance_wallet, Colors.purple),
              ]),
              _SectionCard(
                title: 'Booking Invoice Queue',
                child: _SimpleTable(
                  columns: const [
                    'Source',
                    'Reference',
                    'Customer',
                    'Date',
                    'Total',
                    'Balance',
                    'Invoice',
                    'Status',
                    'Actions'
                  ],
                  rows: items
                      .map((e) => [
                            _text(e, ['source_label', 'source_type']),
                            _text(e, ['reference', 'invoice_number', 'id']),
                            _text(e, ['customer_name', 'guest_name']),
                            _shortDate(
                                _text(e, ['service_date', 'created_at'])),
                            _money(_num(e['total_amount'])),
                            _money(_num(e['balance'])),
                            _text(e, ['invoice_number']).isEmpty
                                ? 'Not generated'
                                : _text(e, ['invoice_number']),
                            _StatusPill(_text(e, [
                              'invoice_status',
                              'payment_status',
                              'status'
                            ])),
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              children: [
                                if (_text(e, ['invoice_id']).isEmpty &&
                                    _text(e, ['source_type']) != 'invoice')
                                  _CompactAction(
                                    label: 'Generate',
                                    icon: Icons.add,
                                    filled: true,
                                    onPressed: () => _generateInvoice(e),
                                  ),
                                if (_text(e, ['invoice_id']).isNotEmpty ||
                                    _text(e, ['source_type']) == 'invoice')
                                  _CompactAction(
                                    label: 'PDF',
                                    icon: Icons.picture_as_pdf,
                                    onPressed: () => _downloadInvoice(e),
                                  ),
                              ],
                            ),
                          ])
                      .toList(),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _StockTakeSection extends ConsumerStatefulWidget {
  const _StockTakeSection();

  @override
  ConsumerState<_StockTakeSection> createState() => _StockTakeSectionState();
}

class _StockTakeSectionState extends ConsumerState<_StockTakeSection> {
  late Future<List<Map<String, dynamic>>> _future =
      ref.read(branchAccountantRepositoryProvider).getStockTakes();

  void _refresh() {
    final nextFuture =
        ref.read(branchAccountantRepositoryProvider).getStockTakes();
    setState(() {
      _future = nextFuture;
    });
  }

  Future<void> _downloadWorksheet() async {
    try {
      if (mounted) _notify(context, 'Preparing worksheet…');
      final file = await ref
          .read(branchAccountantRepositoryProvider)
          .downloadStockTakeWorksheet();
      if (mounted) _notify(context, 'Worksheet saved to ${file.path}');
    } catch (e) {
      if (mounted) {
        _notify(context,
            'Failed to download worksheet: ${e is DioException ? (e.message ?? 'network error') : e}');
      }
    }
  }

  Future<void> _downloadStockTakeReport(Map<String, dynamic> record) async {
    final id = '${record['id'] ?? ''}';
    if (id.isEmpty) return;
    try {
      if (mounted) _notify(context, 'Preparing stock take report…');
      final file = await ref
          .read(branchAccountantRepositoryProvider)
          .downloadStockTakeReviewReport(id);
      if (mounted) _notify(context, 'Report saved to ${file.path}');
    } catch (e) {
      if (mounted) {
        _notify(context,
            'Failed to download report: ${e is DioException ? (e.message ?? 'network error') : e}');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (items) => _Page(
          title: 'Stock Take Review',
          subtitle:
              'Review storekeeper-submitted counts, variance explanations, missing stock takes, and approval history.',
          actions: [
            OutlinedButton.icon(
              onPressed: _downloadWorksheet,
              icon: const Icon(Icons.download, size: 16),
              label: const Text('Download Worksheet'),
            ),
            _RefreshButton(onPressed: _refresh),
          ],
          children: [
            _ResponsiveGrid(children: [
              _MetricCard(
                  'Sessions', '${items.length}', Icons.inventory, Colors.blue),
              _MetricCard(
                  'Pending Review',
                  '${items.where((e) => _text(e, ['status']).toLowerCase() == 'submitted' || _text(e, [
                            'status'
                          ]).toLowerCase() == 'submitted_to_accountant').length}',
                  Icons.rate_review,
                  Colors.orange),
              _MetricCard(
                  'Accountant Approved',
                  '${items.where((e) => _text(e, [
                            'status'
                          ]).toLowerCase() == 'accountant_approved').length}',
                  Icons.verified,
                  Colors.green),
              _MetricCard(
                  'Rejected / Clarification',
                  '${items.where((e) {
                    final status = _text(e, ['status']).toLowerCase();
                    return status == 'accountant_rejected' ||
                        status == 'under_review';
                  }).length}',
                  Icons.report_problem,
                  Colors.red),
            ]),
            _SectionCard(
              title: 'Review Queue and Approval History',
              child: _SimpleTable(
                columns: const [
                  'Date',
                  'Type',
                  'Store',
                  'Branch',
                  'Status',
                  'Items',
                  'Actions'
                ],
                rows: items
                    .map((e) => [
                          _text(e, ['count_date', 'created_at']),
                          _text(e, ['count_type', 'take_type']),
                          _text(e, ['store_type', 'outlet_code']),
                          _text(_map(e['branch']), ['name']),
                          _StatusPill(_text(e, ['status'])),
                          '${e['total_items_counted'] ?? e['items_count'] ?? e['item_count'] ?? '—'}',
                          Row(mainAxisSize: MainAxisSize.min, children: [
                            TextButton(
                                onPressed: () => _showStockTakeReview(context, e),
                                child: const Text('Review')),
                            TextButton(
                                onPressed: () => _downloadStockTakeReport(e),
                                child: const Text('Report')),
                            if (_isApprovableStockTake(e))
                              FilledButton(
                                style: FilledButton.styleFrom(
                                    visualDensity: VisualDensity.compact),
                                onPressed: () => _approveStockTake(e),
                                child: const Text('Approve'),
                              ),
                            if (_isApprovableStockTake(e))
                              OutlinedButton(
                                style: OutlinedButton.styleFrom(
                                    visualDensity: VisualDensity.compact),
                                onPressed: () => _requestClarification(e),
                                child: const Text('Clarify'),
                              ),
                            if (_isApprovableStockTake(e))
                              TextButton(
                                onPressed: () => _rejectStockTake(e),
                                child: const Text('Reject'),
                              ),
                          ]),
                        ])
                    .toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  bool _isApprovableStockTake(Map<String, dynamic> e) {
    final status = _text(e, ['status']).toLowerCase();
    return status == 'submitted' || status == 'submitted_to_accountant';
  }

  Future<void> _approveStockTake(Map<String, dynamic> e) async {
    final notes =
        await _textDialog(context, 'Approve Stock Take', hint: 'Review notes');
    if (notes == null) return;
    if (!mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Approve Stock Take'),
        content: const Text(
            'This approves the storekeeper count and sends it to auditor final review. Stock is not rolled forward until auditor approval.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Approve')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      final res = await ref
          .read(branchAccountantRepositoryProvider)
          .approveStockTake('${e['id']}', notes: notes);
      final summary = _map(_map(res['data'])['posting_summary']);
      if (mounted) {
        _notify(
            context,
            summary.isEmpty
                ? 'Stock take approved and submitted to auditor'
                : 'Submitted to auditor: ${summary['adjustments'] ?? 0} adjustment(s), '
                    '${summary['write_offs'] ?? 0} write-off(s)');
      }
      _refresh();
    } catch (err) {
      if (mounted) {
        _notify(context,
            'Approve failed: ${err is DioException ? (err.response?.data is Map ? (err.response?.data['message'] ?? err.message) : err.message) : err}');
      }
    }
  }

  Future<void> _rejectStockTake(Map<String, dynamic> e) async {
    final notes = await _textDialog(context, 'Reject Stock Take',
        hint: 'Reason required');
    if (notes == null || notes.trim().isEmpty) return;
    await ref
        .read(branchAccountantRepositoryProvider)
        .rejectStockTake('${e['id']}', notes);
    _toast('Stock take rejected');
    _refresh();
  }

  Future<void> _requestClarification(Map<String, dynamic> e) async {
    final notes = await _textDialog(context, 'Request Clarification',
        hint: 'Clarification required');
    if (notes == null || notes.trim().isEmpty) return;
    await ref
        .read(branchAccountantRepositoryProvider)
        .requestStockTakeClarification('${e['id']}', notes);
    _toast('Clarification requested');
    _refresh();
  }

  void _showStockTakeReview(BuildContext context, Map<String, dynamic> stockTake) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (_) => _StockTakeReviewDialog(
        stockTake: stockTake,
        isApprovable: _isApprovableStockTake(stockTake),
        onApprove: () { Navigator.pop(context); _approveStockTake(stockTake); },
        onClarify: () { Navigator.pop(context); _requestClarification(stockTake); },
        onReject: () { Navigator.pop(context); _rejectStockTake(stockTake); },
        onReport: () => _downloadStockTakeReport(stockTake),
        repo: ref.read(branchAccountantRepositoryProvider),
      ),
    );
  }
}

class _InventoryJournalsSection extends ConsumerStatefulWidget {
  const _InventoryJournalsSection();

  @override
  ConsumerState<_InventoryJournalsSection> createState() =>
      _InventoryJournalsSectionState();
}

class _InventoryJournalsSectionState
    extends ConsumerState<_InventoryJournalsSection> {
  late String _startDate =
      _date(DateTime.now().subtract(const Duration(days: 30)));
  late String _endDate = _today();
  String _departmentCode = 'all';
  late Future<Map<String, dynamic>> _future = _load();

  Future<Map<String, dynamic>> _load() async {
    final repo = ref.read(branchAccountantRepositoryProvider);
    final rows = await repo.getDepartmentIssueJournals(
      startDate: _startDate,
      endDate: _endDate,
      departmentCode: _departmentCode,
    );
    var accounts = <Map<String, dynamic>>[];
    try {
      accounts = await repo.getDepartmentAccounts();
    } catch (_) {}
    return {'rows': rows, 'accounts': accounts};
  }

  void _refresh() {
    setState(() => _future = _load());
  }

  Future<void> _openDetail(Map<String, dynamic> row) async {
    final ledger = _map(row['ledger']);
    final ledgerId = _text(ledger, const ['id']);
    var detail = row;
    try {
      if (ledgerId.isNotEmpty) {
        detail = await ref
            .read(branchAccountantRepositoryProvider)
            .getDepartmentIssueJournalDetail(ledgerId);
      }
    } catch (e) {
      if (mounted) _notify(context, 'Could not load full detail: $e');
    }
    if (!mounted) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => _DepartmentIssueJournalDetailScreen(record: detail),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (data) {
          final rows = _list(data['rows']);
          final accounts = _list(data['accounts']);
          final departmentValues = [
            'all',
            ...accounts
                .map((e) => _text(e, const ['department_code']))
                .where((code) => code.isNotEmpty)
          ];
          final departmentLabels = {
            for (final account in accounts)
              _text(account, const ['department_code']):
                  _text(account, const ['department_name']),
            'all': 'All Departments',
          };
          final totalCost =
              rows.fold<num>(0, (sum, row) => sum + _num(row['total_cost']));
          final inventoryCost = rows
              .where((row) =>
                  _text(row, const ['accounting_treatment']) == 'inventory')
              .fold<num>(0, (sum, row) => sum + _num(row['total_cost']));
          final expenseCost = rows
              .where((row) =>
                  _text(row, const ['accounting_treatment']) == 'expense')
              .fold<num>(0, (sum, row) => sum + _num(row['total_cost']));
          final postedCount =
              rows.where((row) => _map(row['journal']).isNotEmpty).length;

          return _Page(
            title: 'Inventory Journals',
            subtitle:
                'Department stock issues posted from branch store into accounting journals, stock movements and audit trail.',
            actions: [
              _DateField(
                value: _startDate,
                onChanged: (value) {
                  _startDate = value.trim();
                  _refresh();
                },
              ),
              _DateField(
                value: _endDate,
                onChanged: (value) {
                  _endDate = value.trim();
                  _refresh();
                },
              ),
              if (departmentValues.length > 1)
                _Dropdown(
                  value: departmentValues.contains(_departmentCode)
                      ? _departmentCode
                      : 'all',
                  values: departmentValues.toSet().toList(),
                  labels: departmentLabels,
                  onChanged: (value) {
                    _departmentCode = value;
                    _refresh();
                  },
                ),
              _RefreshButton(onPressed: _refresh),
            ],
            children: [
              _ResponsiveGrid(children: [
                _MetricCard('Issue Journals', '${rows.length}',
                    Icons.receipt_long, Colors.blue),
                _MetricCard('Posted Journals', '$postedCount',
                    Icons.account_balance, Colors.green),
                _MetricCard('Total Cost', _money(totalCost),
                    Icons.payments_outlined, Colors.indigo),
                _MetricCard('Department Inventory', _money(inventoryCost),
                    Icons.inventory_2, Colors.teal),
                _MetricCard('Department Expense', _money(expenseCost),
                    Icons.trending_down, Colors.orange),
              ]),
              _SectionCard(
                title: 'Department Issue Movement Register',
                child: _SimpleTable(
                  columns: const [
                    'Date',
                    'Department',
                    'Item',
                    'Qty',
                    'Value',
                    'Treatment',
                    'Journal',
                    'Stock Move',
                    'Action',
                  ],
                  rows: rows.map((row) {
                    final ledger = _map(row['ledger']);
                    final account = _map(row['account']).isNotEmpty
                        ? _map(row['account'])
                        : _map(ledger['account']);
                    final journal = _map(row['journal']);
                    final movement = _map(row['stock_movement']);
                    final treatment =
                        _text(row, const ['accounting_treatment']);
                    return [
                      _formatCompactDateTime(_text(row, const ['created_at'])),
                      _text(account, const ['department_name']).isEmpty
                          ? _text(account, const ['department_code'])
                          : _text(account, const ['department_name']),
                      _text(ledger, const ['item_sku']),
                      _num(ledger['quantity']).toStringAsFixed(2),
                      _money(_num(row['total_cost'])),
                      _StatusPill(treatment.isEmpty
                          ? 'UNKNOWN'
                          : treatment.toUpperCase()),
                      journal.isEmpty
                          ? 'Not posted'
                          : _text(journal,
                              const ['journal_number', 'reference', 'id']),
                      movement.isEmpty
                          ? 'No stock move'
                          : '${_num(movement['previous_stock'])} → ${_num(movement['new_stock'])}',
                      _CompactAction(
                        label: 'View',
                        icon: Icons.open_in_new,
                        onPressed: () => _openDetail(row),
                      ),
                    ];
                  }).toList(),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _DepartmentIssueJournalDetailScreen extends StatelessWidget {
  const _DepartmentIssueJournalDetailScreen({required this.record});

  final Map<String, dynamic> record;

  @override
  Widget build(BuildContext context) {
    final ledger = _map(record['ledger']);
    final account = _map(record['account']).isNotEmpty
        ? _map(record['account'])
        : _map(ledger['account']);
    final journal = _map(record['journal']);
    final movement = _map(record['stock_movement']);
    final audit = _map(record['audit_log']);
    final metadata = _map(audit['metadata']);
    final lines = _list(journal['lines']);
    final departmentName = _text(account, const ['department_name']).isEmpty
        ? _text(account, const ['department_code'])
        : _text(account, const ['department_name']);
    final title = departmentName.isEmpty
        ? 'Inventory Journal Detail'
        : 'Inventory Journal - $departmentName';

    return Scaffold(
      backgroundColor: AppColors.kSurface,
      appBar: AppBar(title: Text(title)),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: ScreenSize.p(context),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _ResponsiveGrid(children: [
                _MetricCard(
                  'Total Cost',
                  _money(_num(record['total_cost'])),
                  Icons.payments_outlined,
                  Colors.indigo,
                ),
                _MetricCard(
                  'Quantity',
                  _num(ledger['quantity']).toStringAsFixed(2),
                  Icons.scale,
                  Colors.blueGrey,
                ),
                _MetricCard(
                  'Debit Account',
                  _text(record, const ['debit_account_code']).isEmpty
                      ? _text(metadata, const ['debit_account_code'])
                      : _text(record, const ['debit_account_code']),
                  Icons.call_received,
                  Colors.green,
                ),
                _MetricCard(
                  'Credit Account',
                  _text(record, const ['credit_account_code']).isEmpty
                      ? _text(metadata, const ['credit_account_code'])
                      : _text(record, const ['credit_account_code']),
                  Icons.call_made,
                  Colors.orange,
                ),
              ]),
              const SizedBox(height: 16),
              _TwoColumn(
                left: _SectionCard(
                  title: 'Department Ledger',
                  child: _KeyValueList({
                    'Department': departmentName,
                    'Treatment':
                        _text(record, const ['accounting_treatment']).isEmpty
                            ? _text(account, const ['accounting_treatment'])
                            : _text(record, const ['accounting_treatment']),
                    'Item SKU': _text(ledger, const ['item_sku']),
                    'Movement Type': _text(ledger, const ['movement_type']),
                    'Quantity': _num(ledger['quantity']),
                    'Unit Cost': _money(_num(ledger['unit_cost'])),
                    'Total Cost': _money(_num(ledger['total_cost'])),
                    'Posted At': _formatCompactDateTime(
                        _text(ledger, const ['created_at'])),
                  }),
                ),
                right: _SectionCard(
                  title: 'Accounting Journal',
                  child: _KeyValueList(journal.isEmpty
                      ? const {'Status': 'No journal linked'}
                      : {
                          'Journal Number': _text(journal,
                              const ['journal_number', 'reference', 'id']),
                          'Status': _text(journal, const ['status']),
                          'Reference Type':
                              _text(journal, const ['reference_type']),
                          'Reference ID':
                              _text(journal, const ['reference_id']),
                          'Total Debit': _money(_num(journal['total_debit'])),
                          'Total Credit': _money(_num(journal['total_credit'])),
                          'Posted At': _formatCompactDateTime(_text(
                              journal, const ['entry_date', 'created_at'])),
                        }),
                ),
              ),
              const SizedBox(height: 16),
              _SectionCard(
                title: 'Journal Lines',
                child: _SimpleTable(
                  columns: const ['Account', 'Debit', 'Credit', 'Memo'],
                  rows: lines.map((line) {
                    final coa = _map(line['account']);
                    final code = _text(coa, const ['account_code']).isEmpty
                        ? _text(line, const ['account_code'])
                        : _text(coa, const ['account_code']);
                    final name = _text(coa, const ['account_name']).isEmpty
                        ? _text(line, const ['account_name'])
                        : _text(coa, const ['account_name']);
                    return [
                      [code, name].where((part) => part.isNotEmpty).join(' - '),
                      _money(_num(line['debit'] ?? line['debit_amount'])),
                      _money(_num(line['credit'] ?? line['credit_amount'])),
                      _text(line, const ['memo', 'description', 'notes']),
                    ];
                  }).toList(),
                ),
              ),
              const SizedBox(height: 16),
              _TwoColumn(
                left: _SectionCard(
                  title: 'Branch Stock Movement',
                  child: _KeyValueList(movement.isEmpty
                      ? const {'Status': 'No stock movement linked'}
                      : {
                          'Movement Type':
                              _text(movement, const ['movement_type']),
                          'Item SKU': _text(movement, const ['item_sku']),
                          'Quantity': _num(movement['quantity']),
                          'Previous Stock': _num(movement['previous_stock']),
                          'New Stock': _num(movement['new_stock']),
                          'Reference': _text(movement,
                              const ['reference_id', 'reference', 'source_id']),
                          'Created At': _formatCompactDateTime(
                              _text(movement, const ['created_at'])),
                        }),
                ),
                right: _SectionCard(
                  title: 'Audit Trail',
                  child: _KeyValueList(audit.isEmpty
                      ? const {'Status': 'No audit entry linked'}
                      : {
                          'Action': _text(audit, const ['action']),
                          'Entity': _text(audit, const ['entity_type']),
                          'Entity ID': _text(audit, const ['entity_id']),
                          'Actor': _text(audit,
                              const ['actor_id', 'user_id', 'created_by']),
                          'Device': _text(audit, const ['device']),
                          'Timestamp': _formatCompactDateTime(
                              _text(audit, const ['created_at'])),
                        }),
                ),
              ),
              const SizedBox(height: 16),
              _SectionCard(
                title: 'Audit Metadata',
                child: _KeyValueList(metadata),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PurchasesSection extends ConsumerStatefulWidget {
  const _PurchasesSection({this.onPay});

  /// Called with preload data when any Pay button is pressed.
  /// Parent should switch to Outbound Payments and pre-fill the dialog.
  final void Function(Map<String, dynamic>)? onPay;

  @override
  ConsumerState<_PurchasesSection> createState() => _PurchasesSectionState();
}

class _PurchasesSectionState extends ConsumerState<_PurchasesSection> {
  int _tab = 0;
  String _status = 'all';
  String _search = '';
  String? _selectedSupplierId;
  final _searchCtrl = TextEditingController();
  late Future<Map<String, dynamic>> _future = _load();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<Map<String, dynamic>> _load() async {
    final repo = ref.read(branchAccountantRepositoryProvider);
    final suppliers = await repo.getSuppliers();
    final supplierIds = suppliers.map((e) => _text(e, ['id'])).toSet();
    final pos = await repo.getPurchaseOrders();
    final readyToBill = await repo.getReadyToBillGRNs();
    final ids = supplierIds.where((id) => id.isNotEmpty).toList();
    final results = await Future.wait([
      for (final supplierId in ids) repo.getSupplierInvoices(supplierId: supplierId),
      for (final supplierId in ids) repo.getSupplierPayments(supplierId: supplierId),
      for (final supplierId in ids) repo.getSupplierGRNs(supplierId: supplierId),
    ]);
    final invoices = results.take(ids.length).expand((e) => e).toList();
    final payments =
        results.skip(ids.length).take(ids.length).expand((e) => e).toList();
    final grns = results.skip(ids.length * 2).expand((e) => e).toList();

    Map<String, dynamic> aging = {};
    try {
      aging = await repo.getSupplierAging();
    } catch (_) {}

    final ledger = _selectedSupplierId == null || _selectedSupplierId!.isEmpty
        ? <Map<String, dynamic>>[]
        : await repo.getSupplierLedger(_selectedSupplierId!);
    return {
      'suppliers': suppliers,
      'pos': pos,
      'ready_to_bill': readyToBill,
      'grns': grns,
      'invoices': invoices,
      'payments': payments,
      'aging': aging,
      'ledger': ledger,
    };
  }

  void _refresh() {
    final nextFuture = _load();
    setState(() {
      _future = nextFuture;
    });
  }

  /// Build preload data for Outbound Payments from a supplier + optional invoice.
  void _payViaOutbound({
    Map<String, dynamic>? supplier,
    Map<String, dynamic>? invoice,
    List<Map<String, dynamic>> suppliers = const [],
    List<Map<String, dynamic>> invoices = const [],
  }) {
    // Resolve supplier from invoice if not provided directly
    final resolvedSupplier = supplier ??
        (invoice == null
            ? null
            : suppliers.firstWhere(
                (s) => _text(s, ['id']) == _recordSupplierId(invoice),
                orElse: () => {},
              ));

    final supplierId = resolvedSupplier == null
        ? ''
        : _text(resolvedSupplier, ['id']);
    final supplierName = resolvedSupplier == null || resolvedSupplier.isEmpty
        ? ''
        : _supplierName(resolvedSupplier);

    final amount = invoice == null
        ? 0
        : _num(invoice['balance_due'] ??
            invoice['outstanding_amount'] ??
            invoice['total_amount']);

    final ref = invoice == null
        ? ''
        : _text(invoice, ['invoice_number', 'reference_number', 'id']);

    final invoiceId = invoice == null ? null : _text(invoice, ['id']);

    widget.onPay?.call({
      'payee_name': supplierName,
      'supplier_id': supplierId,
      'supplier_name': supplierName,
      if (invoiceId != null && invoiceId.isNotEmpty) 'invoice_id': invoiceId,
      if (amount > 0) 'amount': amount,
      if (ref.isNotEmpty) 'reference': ref,
      'category': 'vendor',
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (data) {
          final pos = _list(data['pos']);
          final readyToBill = _list(data['ready_to_bill']);
          final grns = _list(data['grns']);
          final invoices = _list(data['invoices']);
          final payments = _list(data['payments']);
          final suppliers = _list(data['suppliers']);
          final agingRows = _agingRows(data['aging']);
          final ledger = _list(data['ledger']);
          final filteredSuppliers = _filterSuppliers(suppliers);
          final filteredPos = _filterRecords(pos, type: 'po');
          final filteredReadyToBill = _filterRecords(readyToBill, type: 'grn');
          final filteredInvoices = _filterRecords(invoices, type: 'invoice');
          final filteredPayments = _filterRecords(payments, type: 'payment');
          final payableInvoices =
              invoices.where(_isPayableSupplierInvoice).toList();
          final openPoAmount = pos
              .where((e) => !['received', 'closed', 'cancelled']
                  .contains(_text(e, ['status']).toLowerCase()))
              .fold<num>(
                  0, (sum, e) => sum + _num(e['total_amount'] ?? e['total']));
          final invoiceOutstanding = invoices.fold<num>(
              0,
              (sum, e) =>
                  sum +
                  _num(e['balance_due'] ??
                      e['outstanding_amount'] ??
                      e['total_amount']));
          final paidTotal = payments.fold<num>(
              0, (sum, e) => sum + _num(e['payment_amount'] ?? e['amount']));
          final overdueCount = invoices.where(_isOverdue).length;
          return _Page(
            title: 'Supplier Finance Workspace',
            subtitle:
                'Branch-strict supplier accounts, purchase orders, invoice clearing, payments, aging, and ledger review.',
            actions: [
              _RefreshButton(onPressed: _refresh),
              OutlinedButton.icon(
                onPressed: _createSupplier,
                icon: const Icon(Icons.person_add_alt_1, size: 18),
                label: const Text('New Supplier'),
              ),
              OutlinedButton.icon(
                onPressed: _createPurchaseOrder,
                icon: const Icon(Icons.add_shopping_cart, size: 18),
                label: const Text('New PO'),
              ),
              OutlinedButton.icon(
                onPressed: _createInvoice,
                icon: const Icon(Icons.receipt_long, size: 18),
                label: const Text('Record Invoice'),
              ),
              OutlinedButton.icon(
                onPressed: () => _downloadSupplierFinanceReportPdf(
                  suppliers: filteredSuppliers,
                  pos: filteredPos,
                  invoices: filteredInvoices,
                  payments: filteredPayments,
                ),
                icon: const Icon(Icons.picture_as_pdf, size: 18),
                label: const Text('Print Report'),
              ),
              FilledButton.icon(
                onPressed: () => _payViaOutbound(
                  suppliers: suppliers,
                  invoices: payableInvoices,
                ),
                icon: const Icon(Icons.payments),
                label: const Text('Make Payment'),
              ),
            ],
            children: [
              _ResponsiveGrid(children: [
                _MetricCard('Branch Suppliers', '${suppliers.length}',
                    Icons.storefront, Colors.blueGrey),
                _MetricCard('Open PO Value', _money(openPoAmount),
                    Icons.shopping_cart, Colors.blue),
                _MetricCard('Supplier Invoices', '${invoices.length}',
                    Icons.receipt_long, Colors.orange),
                _MetricCard('Ready to Bill', '${readyToBill.length}',
                    Icons.assignment_turned_in, Colors.teal),
                _MetricCard('Outstanding Payables', _money(invoiceOutstanding),
                    Icons.warning_amber, Colors.red),
                _MetricCard('Supplier Payments', _money(paidTotal),
                    Icons.payments, Colors.green),
                _MetricCard('Overdue Invoices', '$overdueCount',
                    Icons.event_busy, Colors.deepPurple),
              ]),
              _SectionCard(
                child: Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    SizedBox(
                      width: 360,
                      child: TextField(
                        controller: _searchCtrl,
                        decoration: const InputDecoration(
                          prefixIcon: Icon(Icons.search),
                          labelText: 'Search supplier, PO, invoice, reference',
                        ),
                        onChanged: (v) => setState(() => _search = v),
                      ),
                    ),
                    SizedBox(
                      width: 190,
                      child: DropdownButtonFormField<String>(
                        initialValue: _status,
                        decoration: const InputDecoration(labelText: 'Status'),
                        items: const [
                          DropdownMenuItem(value: 'all', child: Text('All')),
                          DropdownMenuItem(
                              value: 'draft', child: Text('Draft')),
                          DropdownMenuItem(
                              value: 'pending', child: Text('Pending')),
                          DropdownMenuItem(
                              value: 'approved', child: Text('Approved')),
                          DropdownMenuItem(value: 'paid', child: Text('Paid')),
                          DropdownMenuItem(
                              value: 'partially_paid',
                              child: Text('Partially paid')),
                          DropdownMenuItem(
                              value: 'overdue', child: Text('Overdue')),
                        ],
                        onChanged: (v) => setState(() => _status = v ?? 'all'),
                      ),
                    ),
                    SizedBox(
                      width: 260,
                      child: DropdownButtonFormField<String>(
                        initialValue: _selectedSupplierId,
                        isExpanded: true,
                        decoration:
                            const InputDecoration(labelText: 'Ledger supplier'),
                        items: [
                          const DropdownMenuItem<String>(
                              value: null, child: Text('Select supplier')),
                          ...suppliers.map((s) => DropdownMenuItem(
                                value: _text(s, ['id']),
                                child: Text(_supplierName(s),
                                    overflow: TextOverflow.ellipsis),
                              )),
                        ],
                        onChanged: (v) {
                          setState(() {
                            _selectedSupplierId = v;
                            _tab = v == null
                                ? _tab
                                : _tab == 7
                                    ? 7
                                    : 6;
                            _future = _load();
                          });
                        },
                      ),
                    ),
                  ],
                ),
              ),
              SegmentedButton<int>(
                segments: const [
                  ButtonSegment(value: 0, label: Text('Overview')),
                  ButtonSegment(value: 1, label: Text('Suppliers')),
                  ButtonSegment(value: 2, label: Text('Orders')),
                  ButtonSegment(value: 3, label: Text('Ready to Bill')),
                  ButtonSegment(value: 4, label: Text('Invoices')),
                  ButtonSegment(value: 5, label: Text('Payments')),
                  ButtonSegment(value: 6, label: Text('Ledger')),
                  ButtonSegment(value: 7, label: Text('Folio')),
                ],
                selected: {_tab},
                onSelectionChanged: (v) => setState(() => _tab = v.first),
              ),
              if (_tab == 0)
                _SectionCard(
                  title: 'Supplier Finance Position',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _SimpleTable(
                        columns: const [
                          'Supplier',
                          'Open POs',
                          'Invoice Balance',
                          'Paid',
                          'Overdue',
                          'Action'
                        ],
                        rows: filteredSuppliers.map((supplier) {
                          final supplierId = _text(supplier, ['id']);
                          final supplierPos = pos
                              .where((e) => _recordSupplierId(e) == supplierId)
                              .toList();
                          final supplierInvoices = invoices
                              .where((e) => _recordSupplierId(e) == supplierId)
                              .toList();
                          final supplierPayments = payments
                              .where((e) => _recordSupplierId(e) == supplierId)
                              .toList();
                          return [
                            _supplierName(supplier),
                            _money(supplierPos.fold<num>(
                                0,
                                (sum, e) =>
                                    sum +
                                    _num(e['total_amount'] ?? e['total']))),
                            _money(supplierInvoices.fold<num>(
                                0,
                                (sum, e) =>
                                    sum +
                                    _num(e['balance_due'] ??
                                        e['outstanding_amount'] ??
                                        e['total_amount']))),
                            _money(supplierPayments.fold<num>(
                                0,
                                (sum, e) =>
                                    sum +
                                    _num(e['payment_amount'] ?? e['amount']))),
                            supplierInvoices.where(_isOverdue).length,
                            Wrap(spacing: 6, runSpacing: 4, children: [
                              _CompactAction(
                                label: 'PO',
                                icon: Icons.add_shopping_cart,
                                onPressed: () => _createPurchaseOrder(
                                    supplierId: supplierId),
                              ),
                              _CompactAction(
                                label: 'History',
                                icon: Icons.history,
                                onPressed: () => _openPoHistory(
                                  supplierId,
                                  _supplierName(supplier),
                                ),
                              ),
                              _CompactAction(
                                label: 'Folio',
                                icon: Icons.article,
                                onPressed: () => _openFolio(supplierId),
                              ),
                              _CompactAction(
                                label: 'Ledger',
                                icon: Icons.account_balance,
                                onPressed: () => _openLedger(supplierId),
                              ),
                              _CompactAction(
                                label: 'Pay',
                                icon: Icons.payments,
                                filled: true,
                                onPressed: () => _payViaOutbound(
                                  supplier: supplier,
                                  suppliers: suppliers,
                                  invoices: payableInvoices,
                                ),
                              ),
                            ]),
                          ];
                        }).toList(),
                      ),
                      if (agingRows.isNotEmpty) ...[
                        const SizedBox(height: 18),
                        const Text('Aging Snapshot',
                            style: TextStyle(fontWeight: FontWeight.w800)),
                        const SizedBox(height: 8),
                        _SimpleTable(
                          columns: const [
                            'Supplier',
                            'Current',
                            '1-30',
                            '31-60',
                            '61-90',
                            '90+',
                            'Total'
                          ],
                          rows: agingRows
                              .where((e) => filteredSuppliers.any((s) =>
                                  _text(s, ['id']) == _recordSupplierId(e)))
                              .map((e) => [
                                    _supplierName(e),
                                    _money(_num(e['current'])),
                                    _money(_num(e['days_1_30'] ?? e['d30'])),
                                    _money(_num(e['days_31_60'] ?? e['d60'])),
                                    _money(_num(e['days_61_90'] ?? e['d90'])),
                                    _money(
                                        _num(e['days_90_plus'] ?? e['d90p'])),
                                    _money(_num(e['total_balance'] ??
                                        e['balance'] ??
                                        e['outstanding_amount'])),
                                  ])
                              .toList(),
                        ),
                      ],
                    ],
                  ),
                ),
              if (_tab == 1)
                _SectionCard(
                  title: 'Branch Suppliers',
                  child: _SimpleTable(
                    columns: const [
                      'Supplier',
                      'Code',
                      'Contact',
                      'Phone',
                      'Terms',
                      'Status',
                      'Actions'
                    ],
                    rows: filteredSuppliers
                        .map((e) => [
                              _supplierName(e),
                              _text(e, ['supplier_code', 'code']),
                              _text(e, ['contact_person', 'contact_name']),
                              _text(e, ['phone', 'contact_phone']),
                              _text(e, ['payment_terms', 'terms']),
                              _StatusPill(_text(e, ['status', 'is_active'])),
                              Wrap(spacing: 6, runSpacing: 4, children: [
                                _CompactAction(
                                  label: 'New PO',
                                  icon: Icons.add_shopping_cart,
                                  onPressed: () => _createPurchaseOrder(
                                    supplierId: _text(e, ['id']),
                                  ),
                                ),
                                _CompactAction(
                                  label: 'POs',
                                  icon: Icons.history,
                                  onPressed: () => _openPoHistory(
                                    _text(e, ['id']),
                                    _supplierName(e),
                                  ),
                                ),
                                _CompactAction(
                                  label: 'Folio',
                                  icon: Icons.article,
                                  onPressed: () => _openFolio(_text(e, ['id'])),
                                ),
                                _CompactAction(
                                  label: 'Ledger',
                                  icon: Icons.account_balance,
                                  onPressed: () =>
                                      _openLedger(_text(e, ['id'])),
                                ),
                                _CompactAction(
                                  label: 'Pay',
                                  icon: Icons.payments,
                                  filled: true,
                                  onPressed: () => _payViaOutbound(
                                    supplier: e,
                                    suppliers: suppliers,
                                    invoices: payableInvoices,
                                  ),
                                ),
                              ]),
                            ])
                        .toList(),
                  ),
                ),
              if (_tab == 2)
                _SectionCard(
                  title: 'Purchase Orders',
                  child: _SimpleTable(
                    columns: const [
                      'PO',
                      'Supplier',
                      'Items',
                      'Total',
                      'Status',
                      'Expected',
                      'Actions'
                    ],
                    rows: filteredPos
                        .map((e) => [
                              _text(e,
                                  ['po_number', 'purchase_order_number', 'id']),
                              _recordSupplierName(e),
                              '${_list(e['items']).length}',
                              _money(_num(e['total_amount'])),
                              _StatusPill(_text(e, ['status'])),
                              _text(e, [
                                'expected_delivery_date',
                                'delivery_date',
                                'created_at'
                              ]),
                              Wrap(spacing: 6, children: [
                                TextButton(
                                    onPressed: () =>
                                        _showPurchaseOrderDetail(e),
                                    child: const Text('View')),
                                IconButton(
                                  tooltip: 'Print PO',
                                  icon: const Icon(Icons.print, size: 18),
                                  onPressed: () => _printPoPdf(e),
                                ),
                                IconButton(
                                  tooltip: 'Download PO PDF',
                                  icon: const Icon(Icons.download, size: 18),
                                  onPressed: () => _downloadPoPdf(e),
                                ),
                              ]),
                            ])
                        .toList(),
                  ),
                ),
              if (_tab == 3)
                _SectionCard(
                  title: 'Ready to Bill GRNs',
                  child: _SimpleTable(
                    columns: const [
                      'GRN',
                      'PO',
                      'Supplier',
                      'Received',
                      'Items',
                      'Value',
                      'Delivery Note',
                      'Actions'
                    ],
                    rows: filteredReadyToBill
                        .map((e) => [
                              _text(e, ['grn_number', 'id']),
                              _text(e, ['po_number', 'purchase_order_number']),
                              _recordSupplierName(e),
                              _text(e,
                                  ['received_date', 'grn_date', 'created_at']),
                              '${_num(e['item_count'] ?? _list(e['items']).length)}',
                              _money(_num(e['total_value'])),
                              _text(e, ['delivery_note_number']),
                              Wrap(spacing: 6, children: [
                                TextButton(
                                  onPressed: () => _viewGRN(e),
                                  child: const Text('View GRN'),
                                ),
                                FilledButton(
                                  onPressed: () => _recordInvoiceFromGRN(
                                    e,
                                    suppliers: suppliers,
                                  ),
                                  child: const Text('Record Invoice'),
                                ),
                              ]),
                            ])
                        .toList(),
                  ),
                ),
              if (_tab == 4)
                _SectionCard(
                  title: 'Supplier Invoices',
                  child: _SimpleTable(
                    columns: const [
                      'Invoice',
                      'Supplier',
                      'Total',
                      'Paid',
                      'Balance',
                      'Status',
                      'Due',
                      'Actions'
                    ],
                    rows: filteredInvoices
                        .map((e) => [
                              _text(e, ['invoice_number', 'id']),
                              _recordSupplierName(e),
                              _money(_num(e['total_amount'])),
                              _money(_num(e['paid_amount'])),
                              _money(_num(e['balance_due'] ??
                                  e['outstanding_amount'] ??
                                  e['total_amount'])),
                              _StatusPill(_text(e, ['status'])),
                              _text(e, ['due_date', 'invoice_date']),
                              Wrap(spacing: 6, children: [
                                TextButton(
                                    onPressed: () => _viewInvoice(e),
                                    child: const Text('View')),
                                if (_isPayableSupplierInvoice(e))
                                  TextButton(
                                      onPressed: () => _payViaOutbound(
                                            invoice: e,
                                            suppliers: suppliers,
                                            invoices: payableInvoices,
                                          ),
                                      child: const Text('Pay')),
                                IconButton(
                                  tooltip: 'Download PDF',
                                  icon: const Icon(Icons.download, size: 18),
                                  onPressed: () => _downloadInvoicePdf(e),
                                ),
                              ]),
                            ])
                        .toList(),
                  ),
                ),
              if (_tab == 5)
                _SectionCard(
                  title: 'Supplier Payments',
                  child: _SimpleTable(
                    columns: const [
                      'Payment',
                      'Supplier',
                      'Method',
                      'Reference',
                      'Amount',
                      'Status',
                      'Date'
                    ],
                    rows: filteredPayments
                        .map((e) => [
                              _text(e, ['payment_number', 'id']),
                              _recordSupplierName(e),
                              _title(_text(e, ['payment_method', 'method'])),
                              _text(e, ['reference_number', 'reference']),
                              _money(_num(e['payment_amount'] ?? e['amount'])),
                              _StatusPill(_text(e, ['status'])),
                              _text(e, ['payment_date', 'created_at']),
                            ])
                        .toList(),
                  ),
                ),
              if (_tab == 6)
                _SectionCard(
                  title: _selectedSupplierId == null
                      ? 'Supplier Ledger'
                      : 'Supplier Ledger - ${_supplierNameById(suppliers, _selectedSupplierId!)}',
                  child: _selectedSupplierId == null
                      ? Padding(
                          padding: ScreenSize.p(context),
                          child: Text('Select a supplier to load the ledger.',
                              style:
                                  TextStyle(color: AppColors.kTextSecondary)),
                        )
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Wrap(spacing: 8, runSpacing: 8, children: [
                              OutlinedButton.icon(
                                onPressed: () => _downloadSupplierLedgerPdf(
                                  supplier: _supplierById(
                                      suppliers, _selectedSupplierId!),
                                  ledger: ledger,
                                ),
                                icon:
                                    const Icon(Icons.picture_as_pdf, size: 18),
                                label: const Text('Print Ledger'),
                              ),
                              OutlinedButton.icon(
                                onPressed: () =>
                                    _openFolio(_selectedSupplierId!),
                                icon: const Icon(Icons.article, size: 18),
                                label: const Text('Open Folio'),
                              ),
                            ]),
                            const SizedBox(height: 12),
                            _SimpleTable(
                              columns: const [
                                'Date',
                                'Type',
                                'Reference',
                                'Debit',
                                'Credit',
                                'Balance',
                                'Narration'
                              ],
                              rows: ledger
                                  .map((e) => [
                                        _text(e,
                                            ['transaction_date', 'created_at']),
                                        _title(_text(e, [
                                          'transaction_type',
                                          'entry_type',
                                          'type'
                                        ])),
                                        _text(e, [
                                          'reference_number',
                                          'invoice_number',
                                          'payment_number'
                                        ]),
                                        _money(_num(
                                            e['debit_amount'] ?? e['debit'])),
                                        _money(_num(
                                            e['credit_amount'] ?? e['credit'])),
                                        _money(_num(e['balance_after'] ??
                                            e['running_balance'] ??
                                            e['balance'])),
                                        _text(e, ['description', 'notes']),
                                      ])
                                  .toList(),
                            ),
                          ],
                        ),
                ),
              if (_tab == 7)
                _buildSupplierFolio(
                  suppliers: suppliers,
                  pos: pos,
                  grns: grns,
                  invoices: invoices,
                  payments: payments,
                  ledger: ledger,
                  outstandingInvoices: payableInvoices,
                ),
            ],
          );
        },
      ),
    );
  }

  List<Map<String, dynamic>> _agingRows(dynamic value) {
    final map = _map(value);
    if (map.isNotEmpty) {
      for (final key in ['aging', 'balances', 'suppliers', 'rows', 'data']) {
        final rows = _list(map[key]);
        if (rows.isNotEmpty) return rows;
      }
    }
    return _list(value);
  }

  List<Map<String, dynamic>> _filterSuppliers(
      List<Map<String, dynamic>> suppliers) {
    final q = _search.trim().toLowerCase();
    if (q.isEmpty) return suppliers;
    return suppliers.where((e) {
      return [
        _supplierName(e),
        _text(e, ['supplier_code', 'code']),
        _text(e, ['contact_person', 'phone', 'email'])
      ].join(' ').toLowerCase().contains(q);
    }).toList();
  }

  List<Map<String, dynamic>> _filterRecords(List<Map<String, dynamic>> records,
      {required String type}) {
    final q = _search.trim().toLowerCase();
    final status = _status.toLowerCase();
    return records.where((e) {
      final currentStatus = _text(e, ['status']).toLowerCase();
      final matchesStatus = status == 'all' ||
          currentStatus == status ||
          (status == 'overdue' && _isOverdue(e));
      if (!matchesStatus) return false;
      if (q.isEmpty) return true;
      final haystack = [
        _recordSupplierName(e),
        _text(e, ['po_number', 'purchase_order_number']),
        _text(e, ['invoice_number']),
        _text(e, ['payment_number']),
        _text(e, ['reference_number', 'id']),
      ].join(' ').toLowerCase();
      return haystack.contains(q);
    }).toList();
  }

  bool _isOverdue(Map<String, dynamic> e) {
    final status = _text(e, ['status']).toLowerCase();
    if (status == 'paid' || status == 'cancelled') return false;
    final due = DateTime.tryParse(_text(e, ['due_date']));
    return due != null && due.isBefore(DateTime.now());
  }

  bool _isPayableSupplierInvoice(Map<String, dynamic> e) {
    final status = _text(e, ['status']).toLowerCase();
    final balance =
        _num(e['balance_due'] ?? e['outstanding_amount'] ?? e['total_amount']);
    return balance > 0 &&
        const {'approved', 'open', 'partially_paid', 'overdue'}
            .contains(status);
  }

  String _supplierName(Map<String, dynamic> supplier) {
    final direct = _text(supplier, ['name', 'supplier_name']);
    if (direct.isNotEmpty) return direct;
    return _text(_map(supplier['supplier']), ['name', 'supplier_name']);
  }

  String _recordSupplierName(Map<String, dynamic> record) {
    final direct = _text(record, ['supplier_name', 'other_supplier_name']);
    if (direct.isNotEmpty) return direct;
    return _supplierName(_map(record['supplier']));
  }

  String _recordSupplierId(Map<String, dynamic> record) {
    final direct = _text(record, ['supplier_id']);
    if (direct.isNotEmpty) return direct;
    return _text(_map(record['supplier']), ['id']);
  }

  String _supplierNameById(
      List<Map<String, dynamic>> suppliers, String supplierId) {
    final found = suppliers.firstWhere(
      (e) => _text(e, ['id']) == supplierId,
      orElse: () => {},
    );
    return found.isEmpty ? supplierId : _supplierName(found);
  }

  Map<String, dynamic> _supplierById(
      List<Map<String, dynamic>> suppliers, String supplierId) {
    return suppliers.firstWhere(
      (e) => _text(e, ['id']) == supplierId,
      orElse: () => {'id': supplierId, 'name': supplierId},
    );
  }

  void _openLedger(String supplierId) {
    if (supplierId.isEmpty) return;
    setState(() {
      _selectedSupplierId = supplierId;
      _tab = 6;
      _future = _load();
    });
  }

  void _openFolio(String supplierId) {
    if (supplierId.isEmpty) return;
    setState(() {
      _selectedSupplierId = supplierId;
      _tab = 7;
      _future = _load();
    });
  }

  Widget _buildSupplierFolio({
    required List<Map<String, dynamic>> suppliers,
    required List<Map<String, dynamic>> pos,
    required List<Map<String, dynamic>> grns,
    required List<Map<String, dynamic>> invoices,
    required List<Map<String, dynamic>> payments,
    required List<Map<String, dynamic>> ledger,
    required List<Map<String, dynamic>> outstandingInvoices,
  }) {
    final supplierId = _selectedSupplierId;
    if (supplierId == null || supplierId.isEmpty) {
      return _SectionCard(
        title: 'Supplier Folio',
        child: Padding(
          padding: ScreenSize.p(context),
          child: Text(
            'Select a supplier to open the detailed supplier folio.',
            style: TextStyle(color: AppColors.kTextSecondary),
          ),
        ),
      );
    }

    final supplier = _supplierById(suppliers, supplierId);
    final supplierName = _supplierName(supplier);
    final supplierPos =
        pos.where((row) => _recordSupplierId(row) == supplierId).toList();
    final supplierGrns =
        grns.where((row) => _recordSupplierId(row) == supplierId).toList();
    final supplierInvoices =
        invoices.where((row) => _recordSupplierId(row) == supplierId).toList();
    final supplierPayments =
        payments.where((row) => _recordSupplierId(row) == supplierId).toList();
    final openPoValue = supplierPos
        .where((e) => !['received', 'closed', 'cancelled']
            .contains(_text(e, ['status']).toLowerCase()))
        .fold<num>(0, (sum, e) => sum + _num(e['total_amount'] ?? e['total']));
    final invoiceBalance = supplierInvoices.fold<num>(
      0,
      (sum, e) =>
          sum +
          _num(
              e['balance_due'] ?? e['outstanding_amount'] ?? e['total_amount']),
    );
    final paid = supplierPayments.fold<num>(
      0,
      (sum, e) => sum + _num(e['payment_amount'] ?? e['amount']),
    );
    final overdue = supplierInvoices.where(_isOverdue).length;
    final lastActivity = _supplierLastActivity(
      pos: supplierPos,
      grns: supplierGrns,
      invoices: supplierInvoices,
      payments: supplierPayments,
      ledger: ledger,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionCard(
          title: 'Supplier Folio - $supplierName',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  OutlinedButton.icon(
                    onPressed: () => _downloadSupplierFolioPdf(
                      supplier: supplier,
                      pos: supplierPos,
                      invoices: supplierInvoices,
                      payments: supplierPayments,
                      ledger: ledger,
                    ),
                    icon: const Icon(Icons.print, size: 18),
                    label: const Text('Print Folio'),
                  ),
                  OutlinedButton.icon(
                    onPressed: () => _downloadSupplierLedgerPdf(
                      supplier: supplier,
                      ledger: ledger,
                    ),
                    icon: const Icon(Icons.account_balance, size: 18),
                    label: const Text('Print Ledger'),
                  ),
                  FilledButton.icon(
                    onPressed: () => _payViaOutbound(
                      supplier: supplier,
                      suppliers: suppliers,
                      invoices: outstandingInvoices,
                    ),
                    icon: const Icon(Icons.payments, size: 18),
                    label: const Text('Make Payment'),
                  ),
                  OutlinedButton.icon(
                    onPressed: () =>
                        _createPurchaseOrder(supplierId: supplierId),
                    icon: const Icon(Icons.add_shopping_cart, size: 18),
                    label: const Text('New PO'),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _ResponsiveGrid(children: [
                _MetricCard('All Purchase Orders', '${supplierPos.length}',
                    Icons.shopping_cart, Colors.blue),
                _MetricCard('Open PO Value', _money(openPoValue),
                    Icons.pending_actions, Colors.orange),
                _MetricCard('Invoices', '${supplierInvoices.length}',
                    Icons.receipt_long, Colors.deepPurple),
                _MetricCard('GRNs', '${supplierGrns.length}',
                    Icons.assignment_turned_in, Colors.teal),
                _MetricCard('Outstanding Payable', _money(invoiceBalance),
                    Icons.warning_amber, Colors.red),
                _MetricCard('Payments Made', _money(paid), Icons.payments,
                    Colors.green),
                _MetricCard(
                    'Last Activity',
                    lastActivity.isEmpty ? '-' : lastActivity,
                    Icons.history,
                    Colors.blueGrey),
              ]),
              const SizedBox(height: 14),
              _TwoColumn(
                left: _BreakdownCard(
                  title: 'Supplier Profile',
                  values: {
                    'Supplier': supplierName,
                    'Supplier Code': _text(supplier, ['supplier_code', 'code']),
                    'Contact':
                        _text(supplier, ['contact_person', 'contact_name']),
                    'Phone': _text(supplier, ['phone', 'contact_phone']),
                    'Email': _text(supplier, ['email']),
                    'KRA PIN / Tax ID': _text(
                        supplier, ['tax_id', 'kra_pin', 'pin', 'vat_number']),
                    'Payment Terms':
                        _text(supplier, ['payment_terms', 'terms']),
                    'Status': _text(supplier, ['status', 'is_active']),
                  },
                ),
                right: _BreakdownCard(
                  title: 'Account Position',
                  values: {
                    'Open PO Value': openPoValue,
                    'Invoice Balance': invoiceBalance,
                    'Total Paid': paid,
                    'Overdue Invoices': overdue,
                    'Ledger Entries': ledger.length,
                  },
                ),
              ),
            ],
          ),
        ),
        _SectionCard(
          title: 'Complete Supply History',
          child: _SimpleTable(
            columns: const [
              'Date',
              'Document',
              'Reference',
              'Status',
              'Amount',
              'Due / Method',
              'Details'
            ],
            rows: _supplierFolioRows(
              pos: supplierPos,
              grns: supplierGrns,
              invoices: supplierInvoices,
              payments: supplierPayments,
            ),
          ),
        ),
        _SectionCard(
          title: 'Purchase Orders Supplied',
          child: _SimpleTable(
            columns: const [
              'PO',
              'Date',
              'Expected',
              'Items',
              'Total',
              'Status',
              'Action'
            ],
            rows: supplierPos
                .map((po) => [
                      _text(po, ['po_number', 'purchase_order_number', 'id']),
                      _text(po, ['created_at', 'order_date', 'po_date']),
                      _text(po, ['expected_delivery_date', 'delivery_date']),
                      _poItemsSummary(po),
                      _money(_num(po['total_amount'] ?? po['total'])),
                      _StatusPill(_text(po, ['status'])),
                      Wrap(spacing: 6, runSpacing: 4, children: [
                        TextButton(
                            onPressed: () => _showPurchaseOrderDetail(po),
                            child: const Text('View')),
                        IconButton(
                          tooltip: 'Print PO',
                          icon: const Icon(Icons.print, size: 18),
                          onPressed: () => _printPoPdf(po),
                        ),
                      ]),
                    ])
                .toList(),
          ),
        ),
        _TwoColumn(
          left: _SectionCard(
            title: 'Supplier Invoices',
            child: _SimpleTable(
              columns: const [
                'Invoice',
                'Date',
                'Due',
                'Total',
                'Paid',
                'Balance',
                'Status'
              ],
              rows: supplierInvoices
                  .map((invoice) => [
                        _text(invoice, ['invoice_number', 'id']),
                        _text(invoice, ['invoice_date', 'created_at']),
                        _text(invoice, ['due_date']),
                        _money(_num(invoice['total_amount'])),
                        _money(_num(invoice['paid_amount'])),
                        _money(_num(invoice['balance_due'] ??
                            invoice['outstanding_amount'] ??
                            invoice['total_amount'])),
                        _StatusPill(_text(invoice, ['status'])),
                      ])
                  .toList(),
            ),
          ),
          right: _SectionCard(
            title: 'Supplier Payments',
            child: _SimpleTable(
              columns: const [
                'Date',
                'Method',
                'Reference',
                'Amount',
                'Status'
              ],
              rows: supplierPayments
                  .map((payment) => [
                        _text(payment, ['payment_date', 'created_at']),
                        _title(_text(payment, ['payment_method', 'method'])),
                        _text(payment,
                            ['reference_number', 'payment_number', 'id']),
                        _money(_num(
                            payment['payment_amount'] ?? payment['amount'])),
                        _StatusPill(_text(payment, ['status'])),
                      ])
                  .toList(),
            ),
          ),
        ),
        _SectionCard(
          title: 'Ledger Trail',
          child: _SimpleTable(
            columns: const [
              'Date',
              'Type',
              'Reference',
              'Debit',
              'Credit',
              'Balance',
              'Narration'
            ],
            rows: ledger
                .map((entry) => [
                      _text(entry, ['transaction_date', 'created_at']),
                      _title(_text(
                          entry, ['transaction_type', 'entry_type', 'type'])),
                      _text(entry, [
                        'reference_number',
                        'invoice_number',
                        'payment_number'
                      ]),
                      _money(_num(entry['debit_amount'] ?? entry['debit'])),
                      _money(_num(entry['credit_amount'] ?? entry['credit'])),
                      _money(_num(entry['balance_after'] ??
                          entry['running_balance'] ??
                          entry['balance'])),
                      _text(entry, ['description', 'notes']),
                    ])
                .toList(),
          ),
        ),
      ],
    );
  }

  String _supplierLastActivity({
    required List<Map<String, dynamic>> pos,
    required List<Map<String, dynamic>> grns,
    required List<Map<String, dynamic>> invoices,
    required List<Map<String, dynamic>> payments,
    required List<Map<String, dynamic>> ledger,
  }) {
    final dates = <String>[
      ...pos.map((e) => _text(e, ['created_at', 'order_date', 'po_date'])),
      ...grns.map((e) => _text(e, ['grn_date', 'received_date', 'created_at'])),
      ...invoices.map((e) => _text(e, ['invoice_date', 'created_at'])),
      ...payments.map((e) => _text(e, ['payment_date', 'created_at'])),
      ...ledger.map((e) => _text(e, ['transaction_date', 'created_at'])),
    ].where((date) => date.isNotEmpty).toList();
    dates.sort((a, b) {
      final ad = DateTime.tryParse(a);
      final bd = DateTime.tryParse(b);
      if (ad == null && bd == null) return b.compareTo(a);
      if (ad == null) return 1;
      if (bd == null) return -1;
      return bd.compareTo(ad);
    });
    if (dates.isEmpty) return '';
    final parsed = DateTime.tryParse(dates.first);
    return parsed == null
        ? dates.first
        : DateFormat('yyyy-MM-dd').format(parsed);
  }

  List<List<Object>> _supplierFolioRows({
    required List<Map<String, dynamic>> pos,
    required List<Map<String, dynamic>> grns,
    required List<Map<String, dynamic>> invoices,
    required List<Map<String, dynamic>> payments,
  }) {
    final rows = <Map<String, String>>[
      ...pos.map((e) => {
            'date': _text(e, ['created_at', 'order_date', 'po_date']),
            'document': 'Purchase Order',
            'reference': _text(e, ['po_number', 'purchase_order_number', 'id']),
            'status': _text(e, ['status']),
            'amount': _money(_num(e['total_amount'] ?? e['total'])),
            'due': _text(e, ['expected_delivery_date', 'delivery_date']),
            'details': _poItemsSummary(e),
          }),
      ...grns.map((e) => {
            'date': _text(e, ['grn_date', 'received_date', 'created_at']),
            'document': 'Goods Received Note',
            'reference': _text(e, ['grn_number', 'id']),
            'status': _text(e, ['finance_status', 'status']).isEmpty
                ? 'Ready to Bill'
                : _text(e, ['finance_status', 'status']),
            'amount': _money(_num(e['total_value'])),
            'due': _text(e, ['delivery_note_number']),
            'details': _grnItemsSummary(e),
          }),
      ...invoices.map((e) => {
            'date': _text(e, ['invoice_date', 'created_at']),
            'document': 'Invoice',
            'reference': _text(e, ['invoice_number', 'id']),
            'status': _text(e, ['status']),
            'amount': _money(_num(e['balance_due'] ??
                e['outstanding_amount'] ??
                e['total_amount'])),
            'due': _text(e, ['due_date']),
            'details': _text(e, ['notes', 'description']),
          }),
      ...payments.map((e) => {
            'date': _text(e, ['payment_date', 'created_at']),
            'document': 'Payment',
            'reference': _text(e, ['payment_number', 'reference_number', 'id']),
            'status': _text(e, ['status']),
            'amount': _money(_num(e['payment_amount'] ?? e['amount'])),
            'due': _title(_text(e, ['payment_method', 'method'])),
            'details': _text(e, ['notes', 'description']),
          }),
    ];
    rows.sort((a, b) {
      final ad = DateTime.tryParse(a['date'] ?? '');
      final bd = DateTime.tryParse(b['date'] ?? '');
      if (ad == null && bd == null) {
        return (b['date'] ?? '').compareTo(a['date'] ?? '');
      }
      if (ad == null) return 1;
      if (bd == null) return -1;
      return bd.compareTo(ad);
    });
    return rows
        .map((row) => [
              row['date'] ?? '',
              row['document'] ?? '',
              row['reference'] ?? '',
              row['status'] ?? '',
              row['amount'] ?? '',
              row['due'] ?? '',
              row['details'] ?? '',
            ])
        .toList();
  }

  String _poItemsSummary(Map<String, dynamic> po) {
    final items = _list(po['items']);
    if (items.isEmpty) return '-';
    return items
        .map((item) {
          final name = _text(item, ['item_name', 'description']);
          final nestedName = _text(_map(item['item']), ['name', 'item_name']);
          final label = name.isEmpty ? nestedName : name;
          final qty = _num(item['quantity']);
          return label.isEmpty ? '${qty}x item' : '${qty}x $label';
        })
        .where((item) => item.trim().isNotEmpty)
        .join(', ');
  }

  String _grnItemsSummary(Map<String, dynamic> grn) {
    final items = _list(grn['items']);
    if (items.isEmpty) return '-';
    return items
        .map((item) {
          final name = _text(item, ['item_name', 'description']);
          final sku = _text(item, ['item_id', 'sku']);
          final label = name.isEmpty ? sku : name;
          final qty = _num(item['quantity'] ??
              item['quantity_accepted'] ??
              item['quantity_received']);
          return label.isEmpty ? '${qty}x item' : '${qty}x $label';
        })
        .where((item) => item.trim().isNotEmpty)
        .join(', ');
  }

  void _showPurchaseOrderDetail(Map<String, dynamic> po) {
    final poNumber = _text(po, ['po_number', 'purchase_order_number', 'id']);
    final supplierName = _recordSupplierName(po);
    openRecordDetailScreen(
      context,
      title: 'Purchase Order $poNumber',
      subtitle: supplierName.isEmpty ? 'Purchase Order' : supplierName,
      record: po,
      actions: [
        IconButton(
          tooltip: 'Download PDF',
          icon: const Icon(Icons.download),
          onPressed: () => _downloadPoPdf(po),
        ),
        IconButton(
          tooltip: 'Print PO',
          icon: const Icon(Icons.print),
          onPressed: () => _printPoPdf(po),
        ),
      ],
    );
  }

  String _cleanDate(String value) {
    if (value.isEmpty) return '-';
    final parsed = DateTime.tryParse(value);
    return parsed == null ? value : DateFormat('yyyy-MM-dd').format(parsed);
  }

  void _openPoHistory(String supplierId, String supplierName) {
    if (supplierId.isEmpty && supplierName.isEmpty) return;
    setState(() {
      _selectedSupplierId =
          supplierId.isEmpty ? _selectedSupplierId : supplierId;
      _search = supplierName.isEmpty ? supplierId : supplierName;
      _searchCtrl.text = _search;
      _status = 'all';
      _tab = 2;
    });
  }

  Future<void> _createSupplier() async {
    final nameCtrl = TextEditingController();
    final codeCtrl = TextEditingController();
    final contactCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final termsCtrl = TextEditingController(text: '30');
    final pinCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    var saving = false;
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('New Branch Supplier'),
          content: SizedBox(
            width: 620,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: nameCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Supplier name *'),
                  ),
                  const SizedBox(height: 10),
                  Row(children: [
                    Expanded(
                      child: TextField(
                        controller: codeCtrl,
                        decoration:
                            const InputDecoration(labelText: 'Supplier code'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: pinCtrl,
                        decoration: const InputDecoration(
                            labelText: 'KRA PIN / Tax ID'),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 10),
                  Row(children: [
                    Expanded(
                      child: TextField(
                        controller: contactCtrl,
                        decoration:
                            const InputDecoration(labelText: 'Contact person'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: termsCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                            labelText: 'Payment terms (days)'),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 10),
                  Row(children: [
                    Expanded(
                      child: TextField(
                        controller: phoneCtrl,
                        decoration: const InputDecoration(labelText: 'Phone'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: emailCtrl,
                        decoration: const InputDecoration(labelText: 'Email'),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 10),
                  TextField(
                    controller: notesCtrl,
                    decoration: const InputDecoration(labelText: 'Notes'),
                    minLines: 1,
                    maxLines: 3,
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: saving ? null : () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: saving
                  ? null
                  : () async {
                      if (nameCtrl.text.trim().isEmpty) {
                        _notify(context, 'Supplier name is required');
                        return;
                      }
                      setDialogState(() => saving = true);
                      try {
                        await ref
                            .read(branchAccountantRepositoryProvider)
                            .createStoreSupplier({
                          'name': nameCtrl.text.trim(),
                          if (codeCtrl.text.trim().isNotEmpty)
                            'supplier_code': codeCtrl.text.trim(),
                          if (contactCtrl.text.trim().isNotEmpty)
                            'contact_person': contactCtrl.text.trim(),
                          if (phoneCtrl.text.trim().isNotEmpty)
                            'phone': phoneCtrl.text.trim(),
                          if (emailCtrl.text.trim().isNotEmpty)
                            'email': emailCtrl.text.trim(),
                          if (pinCtrl.text.trim().isNotEmpty)
                            'tax_id': pinCtrl.text.trim(),
                          if (termsCtrl.text.trim().isNotEmpty)
                            'payment_terms':
                                int.tryParse(termsCtrl.text.trim()) ??
                                    termsCtrl.text.trim(),
                          if (notesCtrl.text.trim().isNotEmpty)
                            'notes': notesCtrl.text.trim(),
                        });
                        if (context.mounted) Navigator.pop(context, true);
                      } catch (e) {
                        setDialogState(() => saving = false);
                        if (context.mounted) _notify(context, 'Failed: $e');
                      }
                    },
              child: saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Create'),
            ),
          ],
        ),
      ),
    );
    nameCtrl.dispose();
    codeCtrl.dispose();
    contactCtrl.dispose();
    phoneCtrl.dispose();
    emailCtrl.dispose();
    termsCtrl.dispose();
    pinCtrl.dispose();
    notesCtrl.dispose();
    if (result == true && mounted) {
      _notify(context, 'Supplier created');
      _refresh();
    }
  }

  Future<void> _recordPayment({
    required List<Map<String, dynamic>> suppliers,
    required List<Map<String, dynamic>> invoices,
    Map<String, dynamic>? supplier,
    Map<String, dynamic>? invoice,
  }) async {
    String? supplierId = supplier == null
        ? _recordSupplierId(invoice ?? {})
        : _text(supplier, ['id']);
    if (supplierId.isEmpty) supplierId = null;
    String? invoiceId = invoice == null ? null : _text(invoice, ['id']);
    final amountCtrl = TextEditingController(
      text: invoice == null
          ? ''
          : '${_num(invoice['balance_due'] ?? invoice['outstanding_amount'] ?? invoice['total_amount'])}',
    );
    final referenceCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    var method = 'cash';
    var saving = false;
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) {
          final supplierInvoices = supplierId == null
              ? <Map<String, dynamic>>[]
              : invoices
                  .where((e) => _recordSupplierId(e) == supplierId)
                  .toList();
          final selectedInvoice = supplierInvoices.firstWhere(
            (e) => _text(e, ['id']) == invoiceId,
            orElse: () => {},
          );
          final selectedBalance = selectedInvoice.isEmpty
              ? 0
              : _num(selectedInvoice['balance_due'] ??
                  selectedInvoice['outstanding_amount'] ??
                  selectedInvoice['total_amount']);
          return AlertDialog(
            title: const Text('Make Supplier Payment'),
            content: SizedBox(
              width: 640,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    DropdownButtonFormField<String>(
                      initialValue: supplierId,
                      isExpanded: true,
                      decoration:
                          const InputDecoration(labelText: 'Supplier *'),
                      items: suppliers
                          .map((s) => DropdownMenuItem(
                                value: _text(s, ['id']),
                                child: Text(_supplierName(s),
                                    overflow: TextOverflow.ellipsis),
                              ))
                          .toList(),
                      onChanged: (v) {
                        setDialogState(() {
                          supplierId = v;
                          invoiceId = null;
                        });
                      },
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      initialValue: invoiceId,
                      isExpanded: true,
                      decoration: const InputDecoration(
                          labelText: 'Approved invoice allocation *'),
                      items: supplierInvoices.map((inv) {
                        final balance = _num(inv['balance_due'] ??
                            inv['outstanding_amount'] ??
                            inv['total_amount']);
                        return DropdownMenuItem(
                          value: _text(inv, ['id']),
                          child: Text(
                            '${_text(inv, [
                                  'invoice_number',
                                  'id'
                                ])} - ${_money(balance)}',
                            overflow: TextOverflow.ellipsis,
                          ),
                        );
                      }).toList(),
                      onChanged: (v) {
                        setDialogState(() {
                          invoiceId = v;
                          final selected = supplierInvoices.firstWhere(
                            (e) => _text(e, ['id']) == v,
                            orElse: () => {},
                          );
                          if (selected.isNotEmpty) {
                            amountCtrl.text =
                                '${_num(selected['balance_due'] ?? selected['outstanding_amount'] ?? selected['total_amount'])}';
                          }
                        });
                      },
                    ),
                    if (supplierId != null && supplierInvoices.isEmpty)
                      const Padding(
                        padding: EdgeInsets.only(top: 8),
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: Text(
                            'No auditor-approved/open invoices for this supplier.',
                            style: TextStyle(
                                color: AppColors.kTextSecondary, fontSize: 12),
                          ),
                        ),
                      ),
                    const SizedBox(height: 10),
                    Row(children: [
                      Expanded(
                        child: TextField(
                          controller: amountCtrl,
                          keyboardType: TextInputType.number,
                          decoration:
                              const InputDecoration(labelText: 'Amount *'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: method,
                          decoration:
                              const InputDecoration(labelText: 'Method *'),
                          items: const [
                            DropdownMenuItem(
                                value: 'cash', child: Text('Cash')),
                            DropdownMenuItem(
                                value: 'mobile_money', child: Text('M-Pesa')),
                            DropdownMenuItem(
                                value: 'bank_transfer',
                                child: Text('Bank transfer')),
                            DropdownMenuItem(
                                value: 'card', child: Text('Card')),
                            DropdownMenuItem(
                                value: 'cheque', child: Text('Cheque')),
                          ],
                          onChanged: (v) =>
                              setDialogState(() => method = v ?? 'cash'),
                        ),
                      ),
                    ]),
                    const SizedBox(height: 10),
                    TextField(
                      controller: referenceCtrl,
                      decoration: const InputDecoration(
                          labelText: 'Reference / evidence code'),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: notesCtrl,
                      decoration: const InputDecoration(labelText: 'Notes'),
                      minLines: 1,
                      maxLines: 3,
                    ),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: saving ? null : () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: saving
                    ? null
                    : () async {
                        final amount =
                            num.tryParse(amountCtrl.text.trim()) ?? 0;
                        if (supplierId == null || supplierId!.isEmpty) {
                          _notify(context, 'Select a supplier');
                          return;
                        }
                        if (amount <= 0) {
                          _notify(context, 'Enter a valid payment amount');
                          return;
                        }
                        if (invoiceId == null || invoiceId!.isEmpty) {
                          _notify(context,
                              'Select an approved invoice to allocate payment');
                          return;
                        }
                        if (selectedBalance > 0 && amount > selectedBalance) {
                          _notify(context,
                              'Payment cannot exceed invoice balance ${_money(selectedBalance)}');
                          return;
                        }
                        setDialogState(() => saving = true);
                        try {
                          final repo =
                              ref.read(branchAccountantRepositoryProvider);
                          final payment = await repo.createSupplierPayment({
                            'supplier_id': supplierId,
                            'payment_date': _today(),
                            'payment_method': method,
                            'payment_amount': amount,
                            if (referenceCtrl.text.trim().isNotEmpty)
                              'reference_number': referenceCtrl.text.trim(),
                            if (notesCtrl.text.trim().isNotEmpty)
                              'notes': notesCtrl.text.trim(),
                            'allocations': [
                              {'invoice_id': invoiceId, 'amount': amount}
                            ],
                          });
                          final paymentId = _text(payment, ['id']);
                          if (paymentId.isNotEmpty) {
                            await repo.processSupplierPayment(paymentId);
                          }
                          if (context.mounted) Navigator.pop(context, true);
                        } catch (e) {
                          setDialogState(() => saving = false);
                          if (context.mounted) _notify(context, 'Failed: $e');
                        }
                      },
                child: saving
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Post Payment'),
              ),
            ],
          );
        },
      ),
    );
    amountCtrl.dispose();
    referenceCtrl.dispose();
    notesCtrl.dispose();
    if (result == true && mounted) {
      _notify(context, 'Supplier payment posted');
      _refresh();
    }
  }

  Future<void> _createPurchaseOrder({String? supplierId}) async {
    final repo = ref.read(branchAccountantRepositoryProvider);
    final suppliers = await repo.getSuppliers();
    final items = await repo.getStoreItems();
    if (!mounted) return;
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => _PurchaseOrderDialog(
        suppliers: suppliers,
        items: items,
        initialSupplierId: supplierId,
      ),
    );
    if (result == true && mounted) {
      _notify(context, 'Purchase order created');
      _refresh();
    }
  }

  Future<void> _createInvoice() async {
    final repo = ref.read(branchAccountantRepositoryProvider);
    final suppliers = await repo.getSuppliers();
    if (!mounted) return;
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => _SupplierInvoiceDialog(suppliers: suppliers),
    );
    if (result == true && mounted) {
      _notify(context, 'Invoice recorded');
      _refresh();
    }
  }

  Future<void> _recordInvoiceFromGRN(
    Map<String, dynamic> grn, {
    required List<Map<String, dynamic>> suppliers,
  }) async {
    final repo = ref.read(branchAccountantRepositoryProvider);
    var source = grn;
    final grnId = _text(grn, ['id']);
    if (grnId.isNotEmpty) {
      try {
        final full = await repo.getGRNDetail(grnId);
        if (full.isNotEmpty) source = {...grn, ...full};
      } catch (_) {}
    }
    if (!mounted) return;
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => _SupplierInvoiceDialog(
        suppliers: suppliers,
        initialGrn: source,
      ),
    );
    if (result == true && mounted) {
      _notify(context, 'Invoice linked to GRN');
      _refresh();
    }
  }

  Future<void> _viewGRN(Map<String, dynamic> grn) async {
    try {
      final full = await ref
          .read(branchAccountantRepositoryProvider)
          .getGRNDetail('${grn['id']}');
      if (mounted) _showRecord(context, full.isEmpty ? grn : {...grn, ...full});
    } catch (_) {
      if (mounted) _showRecord(context, grn);
    }
  }

  Future<void> _viewInvoice(Map<String, dynamic> inv) async {
    try {
      final full = await ref
          .read(branchAccountantRepositoryProvider)
          .getInvoiceDetail('${inv['id']}');
      if (mounted) _showRecord(context, full.isEmpty ? inv : full);
    } catch (_) {
      if (mounted) _showRecord(context, inv);
    }
  }

  Future<void> _downloadPoPdf(Map<String, dynamic> po) async {
    try {
      final file = await _buildPoPdf(po);
      if (mounted) _notify(context, 'PO PDF saved to ${file.path}');
    } catch (e) {
      if (mounted) _notify(context, 'Failed to generate PDF: $e');
    }
  }

  Future<void> _printPoPdf(Map<String, dynamic> po) async {
    final file = await _buildPoPdf(po);
    await _printFile(file);
  }

  Future<File> _buildPoPdf(Map<String, dynamic> po) async {
    return _exportPurchaseOrderPdf(po);
  }

  Future<File> _exportPurchaseOrderPdf(Map<String, dynamic> po) async {
    final doc = pw.Document();
    final logo = await _loadPdfLogo();
    final poNumber = _text(po, ['po_number', 'purchase_order_number', 'id']);
    final supplier = _map(po['supplier']);
    final branch = _map(po['branch']);
    final supplierName = _recordSupplierName(po).isEmpty
        ? _text(supplier, ['name', 'supplier_name'])
        : _recordSupplierName(po);
    final createdAt =
        _cleanDate(_text(po, ['created_at', 'order_date', 'po_date']));
    final expectedDelivery = _cleanDate(_text(
        po, ['expected_delivery', 'expected_delivery_date', 'delivery_date']));
    final notes = _text(po, ['notes', 'special_instructions']);
    final items = _list(po['items']);
    final total = _num(po['total_amount'] ?? po['total']);
    final subtotal = _num(po['subtotal'] ?? po['sub_total']);
    final tax = _num(po['tax_amount'] ?? po['vat_amount']);
    const primary = PdfColor.fromInt(0xFF2C3E50);
    const muted = PdfColor.fromInt(0xFF666666);
    const border = PdfColor.fromInt(0xFFC8C8C8);
    const lightRow = PdfColor.fromInt(0xFFF6F7F8);

    pw.Widget totalLine(String label, String value,
        {bool grand = false, double top = 0}) {
      return pw.Padding(
        padding: pw.EdgeInsets.only(top: top),
        child: pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text(label,
                style: pw.TextStyle(
                    fontSize: grand ? 13 : 10,
                    fontWeight:
                        grand ? pw.FontWeight.bold : pw.FontWeight.normal)),
            pw.Text(value,
                style: pw.TextStyle(
                    fontSize: grand ? 13 : 10,
                    fontWeight:
                        grand ? pw.FontWeight.bold : pw.FontWeight.normal)),
          ],
        ),
      );
    }

    final tableRows = items.map((item) {
      final nested = _map(item['item']);
      final qty = _num(item['quantity_ordered'] ?? item['quantity']);
      final price = _num(item['unit_price']);
      final lineTotal = _num(item['total_price'] ?? item['total']);
      final itemName = _text(item, ['item_name', 'description']).isEmpty
          ? _text(nested, ['name', 'item_name'])
          : _text(item, ['item_name', 'description']);
      return [
        itemName.isEmpty ? 'Item #${_text(item, ['item_id', 'id'])}' : itemName,
        _formatQty(qty),
        _poMoney(price),
        _poMoney(lineTotal == 0 ? qty * price : lineTotal),
      ];
    }).toList();

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.fromLTRB(42, 40, 42, 42),
        build: (context) => [
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              if (logo != null)
                pw.Image(logo, width: 86, height: 86, fit: pw.BoxFit.contain)
              else
                pw.Container(
                  width: 86,
                  height: 86,
                  alignment: pw.Alignment.center,
                  decoration: pw.BoxDecoration(
                    border: pw.Border.all(color: border),
                    borderRadius: pw.BorderRadius.circular(4),
                  ),
                  child: pw.Text('FG',
                      style: pw.TextStyle(
                          fontSize: 24, fontWeight: pw.FontWeight.bold)),
                ),
              pw.Spacer(),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text('PURCHASE ORDER',
                      style: pw.TextStyle(
                          fontSize: 20,
                          color: primary,
                          fontWeight: pw.FontWeight.bold)),
                  pw.SizedBox(height: 12),
                  pw.Text(
                    _text(branch, ['name']).isEmpty
                        ? 'FamousGate Hotels'
                        : _text(branch, ['name']),
                    style: const pw.TextStyle(fontSize: 10, color: muted),
                  ),
                  pw.Text(
                    _text(branch, ['address']).isEmpty
                        ? 'Bomet, Kenya'
                        : _text(branch, ['address']),
                    style: const pw.TextStyle(fontSize: 10, color: muted),
                  ),
                  pw.Text(
                    _text(branch, ['phone']).isEmpty
                        ? '0706782828'
                        : _text(branch, ['phone']),
                    style: const pw.TextStyle(fontSize: 10, color: muted),
                  ),
                  pw.Text(
                    _text(branch, ['email']).isEmpty
                        ? 'famousgatesbmt@gmail.com'
                        : _text(branch, ['email']),
                    style: const pw.TextStyle(fontSize: 10, color: muted),
                  ),
                ],
              ),
            ],
          ),
          pw.SizedBox(height: 18),
          pw.Container(height: 1, color: border),
          pw.SizedBox(height: 18),
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('VENDOR / SUPPLIER:',
                        style: pw.TextStyle(
                            fontSize: 12,
                            color: primary,
                            fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 8),
                    pw.Text(
                        supplierName.isEmpty ? 'Local Supplier' : supplierName,
                        style: const pw.TextStyle(fontSize: 10)),
                    pw.SizedBox(height: 4),
                    pw.Text(_text(supplier, ['contact_person', 'contact_name']),
                        style: const pw.TextStyle(fontSize: 10)),
                    pw.SizedBox(height: 4),
                    pw.Text(_text(supplier, ['phone', 'contact_phone']),
                        style: const pw.TextStyle(fontSize: 10)),
                    if (_text(supplier, ['address', 'address_line1'])
                        .isNotEmpty) ...[
                      pw.SizedBox(height: 4),
                      pw.Text(_text(supplier, ['address', 'address_line1']),
                          style: const pw.TextStyle(fontSize: 10)),
                    ],
                  ],
                ),
              ),
              pw.SizedBox(width: 36),
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('PO DETAILS:',
                        style: pw.TextStyle(
                            fontSize: 12,
                            color: primary,
                            fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 8),
                    pw.Text('PO Number: $poNumber',
                        style: const pw.TextStyle(fontSize: 10)),
                    pw.SizedBox(height: 4),
                    pw.Text('Date: $createdAt',
                        style: const pw.TextStyle(fontSize: 10)),
                    if (expectedDelivery != '-') ...[
                      pw.SizedBox(height: 4),
                      pw.Text('Expected Delivery: $expectedDelivery',
                          style: const pw.TextStyle(fontSize: 10)),
                    ],
                  ],
                ),
              ),
            ],
          ),
          pw.SizedBox(height: 24),
          pw.TableHelper.fromTextArray(
            headers: const ['Item Description', 'Qty', 'Unit Price', 'Total'],
            data: tableRows,
            headerStyle: pw.TextStyle(
                color: PdfColors.white,
                fontWeight: pw.FontWeight.bold,
                fontSize: 9),
            headerDecoration: const pw.BoxDecoration(color: primary),
            oddRowDecoration: const pw.BoxDecoration(color: lightRow),
            cellStyle: const pw.TextStyle(fontSize: 9),
            cellPadding:
                const pw.EdgeInsets.symmetric(horizontal: 7, vertical: 7),
            columnWidths: {
              0: const pw.FlexColumnWidth(4.5),
              1: const pw.FlexColumnWidth(1),
              2: const pw.FlexColumnWidth(1.5),
              3: const pw.FlexColumnWidth(1.5),
            },
            cellAlignments: {
              0: pw.Alignment.centerLeft,
              1: pw.Alignment.centerRight,
              2: pw.Alignment.centerRight,
              3: pw.Alignment.centerRight,
            },
          ),
          pw.SizedBox(height: 18),
          pw.Align(
            alignment: pw.Alignment.centerRight,
            child: pw.Container(
              width: 240,
              child: pw.Column(
                children: [
                  totalLine(
                      'Subtotal:', _poMoney(subtotal == 0 ? total : subtotal)),
                  totalLine('Tax:', _poMoney(tax), top: 10),
                  totalLine('GRAND TOTAL:', _poMoney(total),
                      grand: true, top: 14),
                ],
              ),
            ),
          ),
          if (notes.isNotEmpty) ...[
            pw.SizedBox(height: 22),
            pw.Text('Notes:',
                style:
                    pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 5),
            pw.Text(notes,
                style: const pw.TextStyle(fontSize: 10, color: muted),
                maxLines: 5),
          ],
          pw.SizedBox(height: 24),
          pw.Text('Issued by: FamousGate Hotels',
              style: pw.TextStyle(
                  fontSize: 9, color: muted, fontStyle: pw.FontStyle.italic)),
          pw.SizedBox(height: 34),
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              _poSignatureBlock('Prepared By / Branch Accountant'),
              _poSignatureBlock('Authorized By / Internal Auditor'),
            ],
          ),
        ],
        footer: (context) => pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Expanded(
              child: pw.Text('FamousGate Hotels - Procurement System',
                  textAlign: pw.TextAlign.center,
                  style: const pw.TextStyle(
                      fontSize: 8, color: PdfColors.grey600)),
            ),
            pw.Text('Page ${context.pageNumber} of ${context.pagesCount}',
                style:
                    const pw.TextStyle(fontSize: 8, color: PdfColors.grey600)),
          ],
        ),
      ),
    );

    final directory = await getDownloadsDirectory() ??
        await getApplicationDocumentsDirectory();
    final safeName =
        'PO_$poNumber.pdf'.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
    final file = File('${directory.path}/$safeName');
    await file.writeAsBytes(await doc.save(), flush: true);
    return file;
  }

  pw.Widget _poSignatureBlock(String label) {
    return pw.Container(
      width: 190,
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Container(height: 1, color: PdfColors.black),
          pw.SizedBox(height: 6),
          pw.Text(label, style: const pw.TextStyle(fontSize: 10)),
        ],
      ),
    );
  }

  String _poMoney(num value) {
    final formatted = NumberFormat.currency(
      locale: 'en_KE',
      symbol: 'Ksh ',
      decimalDigits: 0,
    ).format(value);
    return formatted.replaceAll('.00', '');
  }

  String _formatQty(num value) {
    if (value % 1 == 0) return value.toInt().toString();
    return value.toStringAsFixed(2).replaceFirst(RegExp(r'\.?0+$'), '');
  }

  Future<void> _downloadInvoicePdf(Map<String, dynamic> inv) async {
    try {
      Map<String, dynamic> full = inv;
      try {
        final detail = await ref
            .read(branchAccountantRepositoryProvider)
            .getInvoiceDetail('${inv['id']}');
        if (detail.isNotEmpty) full = detail;
      } catch (_) {}
      final lineItems = _list(full['items']);
      final file = await _exportPdf(
        filename: 'Invoice_${_text(full, ['invoice_number', 'id'])}.pdf',
        title: 'SUPPLIER INVOICE',
        subtitle: _text(full, ['invoice_number', 'id']),
        metrics: {
          'Supplier': _text(full, ['supplier_name']),
          'Invoice Date': _text(full, ['invoice_date']),
          'Due Date': _text(full, ['due_date']),
          'Status': _text(full, ['status']),
          'Sub Total': _money(_num(full['sub_total'])),
          'VAT': _money(_num(full['vat_amount'])),
          'Total': _money(_num(full['total_amount'])),
        },
        tableHeaders: const [
          'Description',
          'Qty',
          'Unit Price',
          'VAT',
          'Total'
        ],
        tableRows: lineItems
            .map((it) => [
                  _text(it, ['description', 'item_name']),
                  '${_num(it['quantity'])}',
                  _money(_num(it['unit_price'])),
                  _money(_num(it['vat_amount'])),
                  _money(_num(it['total_price'])),
                ])
            .toList(),
      );
      if (mounted) _notify(context, 'Invoice PDF saved to ${file.path}');
    } catch (e) {
      if (mounted) _notify(context, 'Failed to generate PDF: $e');
    }
  }

  Future<void> _downloadSupplierLedgerPdf({
    required Map<String, dynamic> supplier,
    required List<Map<String, dynamic>> ledger,
  }) async {
    try {
      final file = await _buildSupplierLedgerPdf(
        supplier: supplier,
        ledger: ledger,
      );
      await _printFile(file);
      if (mounted) _notify(context, 'Ledger PDF prepared: ${file.path}');
    } catch (e) {
      if (mounted) _notify(context, 'Failed to generate ledger: $e');
    }
  }

  Future<File> _buildSupplierLedgerPdf({
    required Map<String, dynamic> supplier,
    required List<Map<String, dynamic>> ledger,
  }) {
    final supplierName = _supplierName(supplier);
    return _exportPdf(
      filename: 'Supplier_Ledger_$supplierName.pdf',
      title: 'SUPPLIER LEDGER',
      subtitle: supplierName,
      metrics: {
        'Supplier': supplierName,
        'Supplier Code': _text(supplier, ['supplier_code', 'code']),
        'Contact': _text(supplier, ['contact_person', 'contact_name']),
        'Phone': _text(supplier, ['phone', 'contact_phone']),
        'Entries': '${ledger.length}',
        'Closing Balance': ledger.isEmpty
            ? _money(0)
            : _money(_num(ledger.last['balance_after'] ??
                ledger.last['running_balance'] ??
                ledger.last['balance'])),
      },
      tableHeaders: const [
        'Date',
        'Type',
        'Reference',
        'Debit',
        'Credit',
        'Balance',
        'Narration'
      ],
      tableRows: ledger
          .map((e) => [
                _text(e, ['transaction_date', 'created_at']),
                _title(_text(e, ['transaction_type', 'entry_type', 'type'])),
                _text(e,
                    ['reference_number', 'invoice_number', 'payment_number']),
                _money(_num(e['debit_amount'] ?? e['debit'])),
                _money(_num(e['credit_amount'] ?? e['credit'])),
                _money(_num(e['balance_after'] ??
                    e['running_balance'] ??
                    e['balance'])),
                _text(e, ['description', 'notes']),
              ])
          .toList(),
    );
  }

  Future<void> _downloadSupplierFolioPdf({
    required Map<String, dynamic> supplier,
    required List<Map<String, dynamic>> pos,
    required List<Map<String, dynamic>> invoices,
    required List<Map<String, dynamic>> payments,
    List<Map<String, dynamic>> ledger = const [],
  }) async {
    try {
      final file = await _buildSupplierFolioPdf(
        supplier: supplier,
        pos: pos,
        invoices: invoices,
        payments: payments,
        ledger: ledger,
      );
      await _printFile(file);
      if (mounted) _notify(context, 'Supplier folio prepared: ${file.path}');
    } catch (e) {
      if (mounted) _notify(context, 'Failed to generate supplier folio: $e');
    }
  }

  Future<File> _buildSupplierFolioPdf({
    required Map<String, dynamic> supplier,
    required List<Map<String, dynamic>> pos,
    required List<Map<String, dynamic>> invoices,
    required List<Map<String, dynamic>> payments,
    List<Map<String, dynamic>> ledger = const [],
  }) {
    final supplierName = _supplierName(supplier);
    final openPoValue = pos
        .where((e) => !['received', 'closed', 'cancelled']
            .contains(_text(e, ['status']).toLowerCase()))
        .fold<num>(0, (sum, e) => sum + _num(e['total_amount'] ?? e['total']));
    final invoiceBalance = invoices.fold<num>(
      0,
      (sum, e) =>
          sum +
          _num(
              e['balance_due'] ?? e['outstanding_amount'] ?? e['total_amount']),
    );
    final paid = payments.fold<num>(
      0,
      (sum, e) => sum + _num(e['payment_amount'] ?? e['amount']),
    );
    final overdue = invoices.where(_isOverdue).length;
    final rows = <List<String>>[
      ...pos.map((e) => [
            _text(e, ['created_at', 'order_date', 'po_date']),
            'PO',
            _text(e, ['po_number', 'purchase_order_number', 'id']),
            _text(e, ['status']),
            _money(_num(e['total_amount'] ?? e['total'])),
            _text(e, ['expected_delivery_date', 'delivery_date']),
          ]),
      ...invoices.map((e) => [
            _text(e, ['invoice_date', 'created_at']),
            'Invoice',
            _text(e, ['invoice_number', 'id']),
            _text(e, ['status']),
            _money(_num(e['balance_due'] ??
                e['outstanding_amount'] ??
                e['total_amount'])),
            _text(e, ['due_date']),
          ]),
      ...payments.map((e) => [
            _text(e, ['payment_date', 'created_at']),
            'Payment',
            _text(e, ['payment_number', 'reference_number', 'id']),
            _text(e, ['status']),
            _money(_num(e['payment_amount'] ?? e['amount'])),
            _title(_text(e, ['payment_method', 'method'])),
          ]),
    ];
    return _exportPdf(
      filename: 'Supplier_Folio_$supplierName.pdf',
      title: 'SUPPLIER FOLIO',
      subtitle: supplierName,
      metrics: {
        'Supplier': supplierName,
        'Supplier Code': _text(supplier, ['supplier_code', 'code']),
        'Open PO Value': _money(openPoValue),
        'Invoice Balance': _money(invoiceBalance),
        'Payments': _money(paid),
        'Overdue Invoices': '$overdue',
        'Ledger Entries': '${ledger.length}',
      },
      sections: {
        'Supplier Details': {
          'Contact': _text(supplier, ['contact_person', 'contact_name']),
          'Phone': _text(supplier, ['phone', 'contact_phone']),
          'Email': _text(supplier, ['email']),
          'Payment Terms': _text(supplier, ['payment_terms', 'terms']),
          'Status': _text(supplier, ['status', 'is_active']),
        },
      },
      tableHeaders: const [
        'Date',
        'Document',
        'Reference',
        'Status',
        'Amount',
        'Due/Method'
      ],
      tableRows: rows,
    );
  }

  Future<void> _downloadSupplierFinanceReportPdf({
    required List<Map<String, dynamic>> suppliers,
    required List<Map<String, dynamic>> pos,
    required List<Map<String, dynamic>> invoices,
    required List<Map<String, dynamic>> payments,
  }) async {
    try {
      final openPoValue = pos.fold<num>(
          0, (sum, e) => sum + _num(e['total_amount'] ?? e['total']));
      final invoiceBalance = invoices.fold<num>(
        0,
        (sum, e) =>
            sum +
            _num(e['balance_due'] ??
                e['outstanding_amount'] ??
                e['total_amount']),
      );
      final paid = payments.fold<num>(
          0, (sum, e) => sum + _num(e['payment_amount'] ?? e['amount']));
      final file = await _exportPdf(
        filename: 'Supplier_Finance_Report_${_today()}.pdf',
        title: 'SUPPLIER FINANCE REPORT',
        subtitle:
            'Branch supplier purchase orders, invoices, payments, and balances',
        metrics: {
          'Suppliers': '${suppliers.length}',
          'Purchase Orders': '${pos.length}',
          'Open PO Value': _money(openPoValue),
          'Invoices': '${invoices.length}',
          'Outstanding': _money(invoiceBalance),
          'Payments': _money(paid),
        },
        tableHeaders: const [
          'Supplier',
          'Open PO Value',
          'Invoice Balance',
          'Paid',
          'Overdue'
        ],
        tableRows: suppliers.map((supplier) {
          final id = _text(supplier, ['id']);
          final supplierPos =
              pos.where((e) => _recordSupplierId(e) == id).toList();
          final supplierInvoices =
              invoices.where((e) => _recordSupplierId(e) == id).toList();
          final supplierPayments =
              payments.where((e) => _recordSupplierId(e) == id).toList();
          return [
            _supplierName(supplier),
            _money(supplierPos.fold<num>(
                0, (sum, e) => sum + _num(e['total_amount'] ?? e['total']))),
            _money(supplierInvoices.fold<num>(
              0,
              (sum, e) =>
                  sum +
                  _num(e['balance_due'] ??
                      e['outstanding_amount'] ??
                      e['total_amount']),
            )),
            _money(supplierPayments.fold<num>(
                0, (sum, e) => sum + _num(e['payment_amount'] ?? e['amount']))),
            '${supplierInvoices.where(_isOverdue).length}',
          ];
        }).toList(),
      );
      await _printFile(file);
      if (mounted) {
        _notify(context, 'Supplier finance report prepared: ${file.path}');
      }
    } catch (e) {
      if (mounted) _notify(context, 'Failed to generate supplier report: $e');
    }
  }

  Future<void> _printFile(File file) async {
    final bytes = await file.readAsBytes();
    await Printing.layoutPdf(
      name: file.uri.pathSegments.isEmpty
          ? 'document.pdf'
          : file.uri.pathSegments.last,
      onLayout: (_) async => bytes,
    );
  }
}

// ── Purchase Order create dialog ──────────────────────────────────────────────
class _PurchaseOrderDialog extends ConsumerStatefulWidget {
  const _PurchaseOrderDialog({
    required this.suppliers,
    required this.items,
    this.initialSupplierId,
  });
  final List<Map<String, dynamic>> suppliers;
  final List<Map<String, dynamic>> items;
  final String? initialSupplierId;

  @override
  ConsumerState<_PurchaseOrderDialog> createState() =>
      _PurchaseOrderDialogState();
}

class _PurchaseOrderDialogState extends ConsumerState<_PurchaseOrderDialog> {
  String? _supplierId;
  final _deliveryCtrl = TextEditingController(text: _today());
  final _notesCtrl = TextEditingController();
  final List<Map<String, dynamic>> _lines = [
    {'item_id': null, 'quantity': 1.0, 'unit_price': 0.0, 'vat_rate': 16.0},
  ];
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    if (widget.initialSupplierId != null &&
        widget.initialSupplierId!.isNotEmpty) {
      _supplierId = widget.initialSupplierId;
    }
  }

  @override
  void dispose() {
    _deliveryCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  String _itemId(Map<String, dynamic> it) => _purchaseOrderItemId(it);

  Future<void> _save() async {
    if (_supplierId == null) {
      _notify(context, 'Please select a supplier');
      return;
    }
    final validLines = _lines
        .where((l) => l['item_id'] != null && _num(l['quantity']) > 0)
        .toList();
    if (validLines.isEmpty) {
      _notify(context, 'Add at least one valid item');
      return;
    }
    setState(() => _saving = true);
    try {
      await ref.read(branchAccountantRepositoryProvider).createPurchaseOrder({
        'supplier_id': _supplierId,
        'expected_delivery_date': _deliveryCtrl.text.trim(),
        'special_instructions': _notesCtrl.text.trim(),
        'items': validLines
            .map((l) => {
                  'item_id': l['item_id'],
                  'quantity': _num(l['quantity']),
                  'unit_price': 0,
                  'vat_rate': _num(l['vat_rate']),
                })
            .toList(),
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        _notify(context,
            'Failed: ${e is DioException ? (e.response?.data is Map ? (e.response?.data['message'] ?? e.response?.data['error'] ?? e.message) : e.message) : e}');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('New Purchase Order'),
      content: SizedBox(
        width: 720,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: _supplierId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Supplier *'),
                items: widget.suppliers
                    .map((s) => DropdownMenuItem(
                          value: _text(s, ['id']),
                          child: Text(_text(s, ['name']),
                              overflow: TextOverflow.ellipsis),
                        ))
                    .toList(),
                onChanged: (v) => setState(() => _supplierId = v),
              ),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(
                  child: TextField(
                    controller: _deliveryCtrl,
                    decoration: const InputDecoration(
                        labelText: 'Expected Delivery (YYYY-MM-DD)'),
                  ),
                ),
              ]),
              const SizedBox(height: 10),
              TextField(
                controller: _notesCtrl,
                decoration: const InputDecoration(labelText: 'Notes'),
                minLines: 1,
                maxLines: 3,
              ),
              const SizedBox(height: 14),
              Row(children: [
                const Expanded(
                    child: Text('Items',
                        style: TextStyle(fontWeight: FontWeight.w800))),
                OutlinedButton.icon(
                  onPressed: () => setState(() => _lines.add({
                        'item_id': null,
                        'quantity': 1.0,
                        'unit_price': 0.0,
                        'vat_rate': 16.0
                      })),
                  icon: const Icon(Icons.add, size: 16),
                  label: const Text('Add Item'),
                ),
              ]),
              const SizedBox(height: 8),
              ..._lines.asMap().entries.map((entry) {
                final i = entry.key;
                final line = entry.value;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(children: [
                    Expanded(
                      flex: 4,
                      child: _PurchaseOrderItemSearchField(
                        items: widget.items,
                        selectedItemId: line['item_id'] as String?,
                        onSelected: (item) {
                          setState(() {
                            line['item_id'] = _itemId(item);
                          });
                        },
                        onCleared: () {
                          setState(() => line['item_id'] = null);
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Qty'),
                        controller: TextEditingController(
                            text: '${_num(line['quantity'])}'),
                        onChanged: (v) =>
                            line['quantity'] = num.tryParse(v) ?? 0,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 18),
                      onPressed: _lines.length > 1
                          ? () => setState(() => _lines.removeAt(i))
                          : null,
                    ),
                  ]),
                );
              }),
              const Divider(),
              Align(
                alignment: Alignment.centerRight,
                child: Text('${_lines.length} line item(s)',
                    style: const TextStyle(fontWeight: FontWeight.w800)),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel')),
        FilledButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Create'),
        ),
      ],
    );
  }
}

class _PurchaseOrderItemSearchField extends StatefulWidget {
  const _PurchaseOrderItemSearchField({
    required this.items,
    required this.selectedItemId,
    required this.onSelected,
    required this.onCleared,
  });

  final List<Map<String, dynamic>> items;
  final String? selectedItemId;
  final ValueChanged<Map<String, dynamic>> onSelected;
  final VoidCallback onCleared;

  @override
  State<_PurchaseOrderItemSearchField> createState() =>
      _PurchaseOrderItemSearchFieldState();
}

class _PurchaseOrderItemSearchFieldState
    extends State<_PurchaseOrderItemSearchField> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _syncSelectedText();
  }

  @override
  void didUpdateWidget(covariant _PurchaseOrderItemSearchField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selectedItemId != widget.selectedItemId ||
        oldWidget.items.length != widget.items.length) {
      _syncSelectedText();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Map<String, dynamic>? get _selectedItem {
    final selectedId = widget.selectedItemId;
    if (selectedId == null || selectedId.isEmpty) return null;
    for (final item in widget.items) {
      if (_purchaseOrderItemId(item) == selectedId) return item;
    }
    return null;
  }

  void _syncSelectedText() {
    final item = _selectedItem;
    final next = item == null ? '' : _itemSearchLabel(item);
    if (_controller.text != next) {
      _controller.value = TextEditingValue(
        text: next,
        selection: TextSelection.collapsed(offset: next.length),
      );
    }
  }

  Iterable<Map<String, dynamic>> _optionsFor(TextEditingValue value) {
    final query = value.text.trim().toLowerCase();
    final source =
        widget.items.where((item) => _purchaseOrderItemId(item).isNotEmpty);
    if (query.isEmpty) return source.take(30);
    return source.where((item) {
      final haystack = [
        _itemSearchLabel(item),
        _text(item, ['sku', 'item_code', 'code']),
        _text(item, ['category', 'category_name']),
        _text(item, ['unit', 'unit_of_measure']),
      ].join(' ').toLowerCase();
      return haystack.contains(query);
    }).take(40);
  }

  @override
  Widget build(BuildContext context) {
    return RawAutocomplete<Map<String, dynamic>>(
      textEditingController: _controller,
      focusNode: _focusNode,
      displayStringForOption: _itemSearchLabel,
      optionsBuilder: _optionsFor,
      onSelected: (item) {
        _controller.text = _itemSearchLabel(item);
        widget.onSelected(item);
      },
      fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) {
        return TextField(
          controller: controller,
          focusNode: focusNode,
          decoration: InputDecoration(
            labelText: 'Search item *',
            hintText: widget.items.isEmpty
                ? 'No branch items available'
                : 'Type item name, SKU, code, or category',
            prefixIcon: const Icon(Icons.search, size: 18),
            suffixIcon: widget.selectedItemId == null
                ? null
                : IconButton(
                    tooltip: 'Clear item',
                    icon: const Icon(Icons.close, size: 18),
                    onPressed: () {
                      controller.clear();
                      widget.onCleared();
                      focusNode.requestFocus();
                    },
                  ),
          ),
          onChanged: (_) {
            if (widget.selectedItemId != null) widget.onCleared();
          },
        );
      },
      optionsViewBuilder: (context, onSelected, options) {
        final rows = options.toList(growable: false);
        return Align(
          alignment: Alignment.topLeft,
          child: Material(
            elevation: 8,
            color: Theme.of(context).cardColor,
            borderRadius: BorderRadius.circular(8),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 280, maxWidth: 460),
              child: rows.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.all(14),
                      child: Text('No matching item found'),
                    )
                  : ListView.separated(
                      padding: EdgeInsets.zero,
                      shrinkWrap: true,
                      itemCount: rows.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final item = rows[index];
                        final name = _purchaseOrderItemName(item);
                        final sku = _text(item, ['sku', 'item_code', 'code']);
                        final category =
                            _text(item, ['category', 'category_name']);
                        final price = _num(item['last_purchase_price'] ??
                            item['average_cost'] ??
                            item['cost_price'] ??
                            item['unit_cost'] ??
                            item['retail_price'] ??
                            item['unit_price']);
                        return ListTile(
                          dense: true,
                          title: Text(
                            name.isEmpty ? 'Unnamed item' : name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: Text(
                            [
                              if (sku.isNotEmpty) sku,
                              if (category.isNotEmpty) category,
                              if (price > 0) _money(price),
                            ].join('  |  '),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          onTap: () => onSelected(item),
                        );
                      },
                    ),
            ),
          ),
        );
      },
    );
  }
}

String _itemSearchLabel(Map<String, dynamic> item) {
  final name = _purchaseOrderItemName(item);
  final sku = _text(item, ['sku', 'item_code', 'code']);
  if (name.isEmpty) return sku;
  if (sku.isEmpty) return name;
  return '$name ($sku)';
}

String _purchaseOrderItemId(Map<String, dynamic> item) =>
    _text(item, ['id', 'sku', 'item_code']);

String _purchaseOrderItemName(Map<String, dynamic> item) =>
    _text(item, ['name', 'description', 'item_name']);

// ── Supplier Invoice create dialog ────────────────────────────────────────────
class _SupplierInvoiceDialog extends ConsumerStatefulWidget {
  const _SupplierInvoiceDialog({
    required this.suppliers,
    this.initialGrn,
  });
  final List<Map<String, dynamic>> suppliers;
  final Map<String, dynamic>? initialGrn;

  @override
  ConsumerState<_SupplierInvoiceDialog> createState() =>
      _SupplierInvoiceDialogState();
}

class _SupplierInvoiceDialogState
    extends ConsumerState<_SupplierInvoiceDialog> {
  String? _supplierId;
  final _otherSupplierCtrl = TextEditingController();
  final _pinCtrl = TextEditingController();
  final _invoiceNumberCtrl = TextEditingController();
  final _invoiceDateCtrl = TextEditingController(text: _today());
  final _dueDateCtrl = TextEditingController(
      text: _date(DateTime.now().add(const Duration(days: 30))));
  final _notesCtrl = TextEditingController();
  final List<Map<String, dynamic>> _lines = [
    {'description': '', 'quantity': 1.0, 'unit_price': 0.0, 'vat_rate': 16.0},
  ];
  String? _poId;
  String? _grnId;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final grn = widget.initialGrn;
    if (grn == null) return;

    _supplierId = _text(grn, ['supplier_id']).isEmpty
        ? null
        : _text(grn, ['supplier_id']);
    _poId = _text(grn, ['po_id']);
    _grnId = _text(grn, ['id']);
    _notesCtrl.text =
        'Invoice recorded against GRN ${_text(grn, ['grn_number', 'id'])}'
        '${_text(grn, [
          'po_number'
        ]).isEmpty ? '' : ' / PO ${_text(grn, ['po_number'])}'}';
    final items = _list(grn['items']);
    if (items.isNotEmpty) {
      _lines
        ..clear()
        ..addAll(items.map((item) {
          final qty = _num(item['quantity'] ??
              item['quantity_accepted'] ??
              item['accepted_quantity'] ??
              item['quantity_received']);
          return {
            'item_id': _text(item, ['item_id', 'sku']),
            'grn_item_id': _text(item, ['id']),
            'po_item_id': _text(item, ['po_item_id']),
            'description': _text(item, ['item_name', 'description', 'item_id']),
            'quantity': qty <= 0 ? 1 : qty,
            'unit_price': _num(item['unit_price']),
            'vat_rate': _num(item['vat_rate']),
          };
        }));
    }
  }

  @override
  void dispose() {
    _otherSupplierCtrl.dispose();
    _pinCtrl.dispose();
    _invoiceNumberCtrl.dispose();
    _invoiceDateCtrl.dispose();
    _dueDateCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  num get _subTotal => _lines.fold<num>(
      0, (sum, l) => sum + _num(l['quantity']) * _num(l['unit_price']));
  num get _vat => _lines.fold<num>(
      0,
      (sum, l) =>
          sum +
          _num(l['quantity']) *
              _num(l['unit_price']) *
              _num(l['vat_rate']) /
              100);

  Future<void> _save() async {
    if (_supplierId == null && _otherSupplierCtrl.text.trim().isEmpty) {
      _notify(context, 'Select a supplier or enter a supplier name');
      return;
    }
    if (_invoiceNumberCtrl.text.trim().isEmpty) {
      _notify(context, 'Invoice number is required');
      return;
    }
    final validLines = _lines
        .where((l) =>
            _text(l, ['description']).isNotEmpty && _num(l['unit_price']) > 0)
        .toList();
    if (validLines.isEmpty) {
      _notify(context, 'Add at least one valid item');
      return;
    }
    setState(() => _saving = true);
    try {
      await ref.read(branchAccountantRepositoryProvider).createSupplierInvoice({
        if (_supplierId != null) 'supplier_id': _supplierId,
        if (_poId != null && _poId!.isNotEmpty) 'po_id': _poId,
        if (_grnId != null && _grnId!.isNotEmpty) 'grn_id': _grnId,
        'other_supplier_name': _otherSupplierCtrl.text.trim(),
        'manual_supplier_pin': _pinCtrl.text.trim(),
        'invoice_number': _invoiceNumberCtrl.text.trim(),
        'invoice_date': _invoiceDateCtrl.text.trim(),
        'due_date': _dueDateCtrl.text.trim(),
        'notes': _notesCtrl.text.trim(),
        'items': validLines.map((l) {
          final base = _num(l['quantity']) * _num(l['unit_price']);
          final vat = base * _num(l['vat_rate']) / 100;
          return {
            'description': l['description'],
            if (_text(l, ['item_id']).isNotEmpty)
              'item_id': _text(l, ['item_id']),
            if (_text(l, ['grn_item_id']).isNotEmpty)
              'grn_item_id': _text(l, ['grn_item_id']),
            if (_text(l, ['po_item_id']).isNotEmpty)
              'po_item_id': _text(l, ['po_item_id']),
            'quantity': _num(l['quantity']),
            'unit_price': _num(l['unit_price']),
            'vat_rate': _num(l['vat_rate']),
            'vat_amount': vat,
            'total_price': base + vat,
          };
        }).toList(),
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        _notify(context,
            'Failed: ${e is DioException ? (e.response?.data is Map ? (e.response?.data['message'] ?? e.message) : e.message) : e}');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Record Supplier Invoice'),
      content: SizedBox(
        width: 720,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (widget.initialGrn != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.kPrimary.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: AppColors.kPrimary.withValues(alpha: 0.16),
                    ),
                  ),
                  child: Text(
                    'Linked GRN ${_text(widget.initialGrn!, const [
                          'grn_number',
                          'id'
                        ])}${_text(widget.initialGrn!, const [
                          'po_number'
                        ]).isEmpty ? '' : ' • PO ${_text(widget.initialGrn!, const [
                            'po_number'
                          ])}'}',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
                const SizedBox(height: 10),
              ],
              DropdownButtonFormField<String>(
                initialValue: _supplierId,
                isExpanded: true,
                decoration: const InputDecoration(
                    labelText: 'Supplier (or enter name below)'),
                items: widget.suppliers
                    .map((s) => DropdownMenuItem(
                          value: _text(s, ['id']),
                          child: Text(_text(s, ['name']),
                              overflow: TextOverflow.ellipsis),
                        ))
                    .toList(),
                onChanged: (v) => setState(() => _supplierId = v),
              ),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(
                  child: TextField(
                    controller: _otherSupplierCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Other Supplier Name'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _pinCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Supplier PIN'),
                  ),
                ),
              ]),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(
                  child: TextField(
                    controller: _invoiceNumberCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Invoice Number *'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _invoiceDateCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Invoice Date'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _dueDateCtrl,
                    decoration: const InputDecoration(labelText: 'Due Date'),
                  ),
                ),
              ]),
              const SizedBox(height: 14),
              Row(children: [
                const Expanded(
                    child: Text('Items',
                        style: TextStyle(fontWeight: FontWeight.w800))),
                OutlinedButton.icon(
                  onPressed: () => setState(() => _lines.add({
                        'description': '',
                        'quantity': 1.0,
                        'unit_price': 0.0,
                        'vat_rate': 16.0
                      })),
                  icon: const Icon(Icons.add, size: 16),
                  label: const Text('Add Item'),
                ),
              ]),
              const SizedBox(height: 8),
              ..._lines.asMap().entries.map((entry) {
                final i = entry.key;
                final line = entry.value;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(children: [
                    Expanded(
                      flex: 4,
                      child: TextField(
                        decoration:
                            const InputDecoration(labelText: 'Description'),
                        controller: TextEditingController(
                            text: '${line['description']}'),
                        onChanged: (v) => line['description'] = v,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Qty'),
                        controller: TextEditingController(
                            text: '${_num(line['quantity'])}'),
                        onChanged: (v) {
                          line['quantity'] = num.tryParse(v) ?? 0;
                          setState(() {});
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Price'),
                        controller: TextEditingController(
                            text: '${_num(line['unit_price'])}'),
                        onChanged: (v) {
                          line['unit_price'] = num.tryParse(v) ?? 0;
                          setState(() {});
                        },
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 18),
                      onPressed: _lines.length > 1
                          ? () => setState(() => _lines.removeAt(i))
                          : null,
                    ),
                  ]),
                );
              }),
              const Divider(),
              Align(
                alignment: Alignment.centerRight,
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('Sub Total: ${_money(_subTotal)}'),
                      Text('VAT: ${_money(_vat)}'),
                      Text('Total: ${_money(_subTotal + _vat)}',
                          style: const TextStyle(fontWeight: FontWeight.w800)),
                    ]),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel')),
        FilledButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Record Invoice'),
        ),
      ],
    );
  }
}

class _BuffetSection extends ConsumerStatefulWidget {
  const _BuffetSection();

  @override
  ConsumerState<_BuffetSection> createState() => _BuffetSectionState();
}

class _BuffetSectionState extends ConsumerState<_BuffetSection> {
  late Future<List<Map<String, dynamic>>> _future =
      ref.read(branchAccountantRepositoryProvider).getBuffets();

  void _refresh() {
    final nextFuture =
        ref.read(branchAccountantRepositoryProvider).getBuffets();
    setState(() {
      _future = nextFuture;
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (items) => _Page(
          title: 'Buffet Control',
          subtitle:
              'Review buffet food-control status, opening, closing, and variance risk.',
          actions: [_RefreshButton(onPressed: _refresh)],
          children: [
            _SectionCard(
              title: 'Buffets',
              child: _SimpleTable(
                columns: const [
                  'Buffet',
                  'Date',
                  'Expected',
                  'Actual',
                  'Status',
                  'Actions'
                ],
                rows: items
                    .map((e) => [
                          _text(e, ['name', 'buffet_name', 'id']),
                          _text(e, ['service_date', 'date']),
                          _money(_num(e['expected_revenue'])),
                          _money(_num(e['actual_revenue'])),
                          _StatusPill(_text(e, ['status'])),
                          Wrap(spacing: 8, children: [
                            TextButton(
                                onPressed: () => _showRecord(context, e),
                                child: const Text('View')),
                            if (_text(e, ['status']).toLowerCase() == 'draft')
                              FilledButton.tonal(
                                  onPressed: () => _open(e),
                                  child: const Text('Open')),
                            OutlinedButton(
                                onPressed: () => _close(e),
                                child: const Text('Close')),
                          ]),
                        ])
                    .toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _open(Map<String, dynamic> buffet) async {
    await ref
        .read(branchAccountantRepositoryProvider)
        .openBuffet('${buffet['id']}');
    _toast('Buffet opened');
    _refresh();
  }

  Future<void> _close(Map<String, dynamic> buffet) async {
    final data = await _formDialog(context, 'Close Buffet', const [
      'actual_revenue',
      'actual_guests',
      'notes',
    ]);
    if (data == null) return;
    await ref
        .read(branchAccountantRepositoryProvider)
        .closeBuffet('${buffet['id']}', data);
    _toast('Buffet closed');
    _refresh();
  }
}

class _CateringSection extends ConsumerStatefulWidget {
  const _CateringSection();

  @override
  ConsumerState<_CateringSection> createState() => _CateringSectionState();
}

class _CateringSectionState extends ConsumerState<_CateringSection> {
  late Future<List<Map<String, dynamic>>> _future =
      ref.read(branchAccountantRepositoryProvider).getCateringEvents();

  void _refresh() {
    final nextFuture =
        ref.read(branchAccountantRepositoryProvider).getCateringEvents();
    setState(() {
      _future = nextFuture;
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (items) => _Page(
          title: 'Catering Control',
          subtitle:
              'Catering event food-control ledger, actuals, and completion review.',
          actions: [_RefreshButton(onPressed: _refresh)],
          children: [
            _SectionCard(
              title: 'Catering Events',
              child: _SimpleTable(
                columns: const [
                  'Event',
                  'Date',
                  'Customer',
                  'Expected',
                  'Actual',
                  'Status',
                  'Actions'
                ],
                rows: items
                    .map((e) => [
                          _text(e, ['event_name', 'name', 'id']),
                          _text(e, ['event_date', 'date']),
                          _text(e, ['customer_name', 'client_name']),
                          _money(_num(e['expected_revenue'])),
                          _money(_num(e['actual_revenue'])),
                          _StatusPill(_text(e, ['status'])),
                          Wrap(spacing: 8, children: [
                            TextButton(
                                onPressed: () => _showRecord(context, e),
                                child: const Text('View')),
                            FilledButton.tonal(
                                onPressed: () => _complete(e),
                                child: const Text('Complete')),
                            OutlinedButton(
                                onPressed: () => _cancel(e),
                                child: const Text('Cancel')),
                          ]),
                        ])
                    .toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _complete(Map<String, dynamic> event) async {
    await ref
        .read(branchAccountantRepositoryProvider)
        .completeCateringEvent('${event['id']}');
    _toast('Catering event completed');
    _refresh();
  }

  Future<void> _cancel(Map<String, dynamic> event) async {
    final reason =
        await _textDialog(context, 'Cancel Catering Event', hint: 'Reason');
    if (reason == null) return;
    await ref
        .read(branchAccountantRepositoryProvider)
        .cancelCateringEvent('${event['id']}', reason);
    _toast('Catering event cancelled');
    _refresh();
  }
}

// ── Kitchen Variance / Credit Bill Approval ──────────────────────────────────

class _KitchenVarianceSection extends ConsumerStatefulWidget {
  const _KitchenVarianceSection();

  @override
  ConsumerState<_KitchenVarianceSection> createState() =>
      _KitchenVarianceSectionState();
}

class _KitchenVarianceSectionState
    extends ConsumerState<_KitchenVarianceSection> {
  late Future<List<Map<String, dynamic>>> _future = _load();

  Future<List<Map<String, dynamic>>> _load() => ref
      .read(branchAccountantRepositoryProvider)
      .getPendingKitchenShiftReviews();

  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (shifts) {
          final totalExposure = shifts.fold<num>(
              0, (s, e) => s + _num(e['total_variance_cost']).abs());
          return _Page(
            title: 'Kitchen Variance Review',
            subtitle:
                'Closed kitchen shifts confirmed by the chef, awaiting your approval and liability decision.',
            actions: [_RefreshButton(onPressed: _refresh)],
            children: [
              _ResponsiveGrid(children: [
                _MetricCard('Pending Review', '${shifts.length}',
                    Icons.pending_actions, Colors.orange),
                _MetricCard('Total Variance Exposure', _money(totalExposure),
                    Icons.warning_amber, Colors.red),
              ]),
              if (shifts.isEmpty)
                _SectionCard(
                  title: 'All Clear',
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Row(children: [
                      Icon(Icons.check_circle_outline,
                          color: Colors.green.shade400, size: 32),
                      const SizedBox(width: 12),
                      const Text(
                          'No kitchen shifts pending variance review.'),
                    ]),
                  ),
                ),
              ...shifts.map((s) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _ActionCard(
                      title:
                          '${s['shift_number'] ?? 'Shift'} — ${_text(s, ['shift_date'])}',
                      subtitle:
                          'Store keeper: ${s['store_keeper']?['first_name'] ?? '—'}',
                      trailing: _StatusPill(
                          'Variance ${_money(_num(s['total_variance_cost']).abs())}'),
                      rows: {
                        'Revenue': _money(_num(s['total_revenue'])),
                        'COGS': _money(_num(s['total_cogs'])),
                        'Spoilage Cost':
                            _money(_num(s['total_spoilage_cost'])),
                        'Variance Cost':
                            _money(_num(s['total_variance_cost']).abs()),
                      },
                      actions: [
                        FilledButton.icon(
                          onPressed: () => _review(s),
                          icon: const Icon(Icons.fact_check_outlined,
                              size: 16),
                          label: const Text('Review & Decide'),
                        ),
                      ],
                    ),
                  )),
            ],
          );
        },
      ),
    );
  }

  Future<void> _review(Map<String, dynamic> shiftRow) async {
    final repo = ref.read(branchAccountantRepositoryProvider);
    Map<String, dynamic> detail;
    try {
      detail = await repo.getKitchenShiftReviewDetail('${shiftRow['id']}');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Failed to load shift: $e'),
            backgroundColor: Colors.red));
      }
      return;
    }
    if (!mounted) return;
    final acted = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _KitchenVarianceReviewDialog(detail: detail),
    );
    if (acted == true) _refresh();
  }
}

class _KitchenVarianceReviewDialog extends ConsumerStatefulWidget {
  const _KitchenVarianceReviewDialog({required this.detail});
  final Map<String, dynamic> detail;

  @override
  ConsumerState<_KitchenVarianceReviewDialog> createState() =>
      _KitchenVarianceReviewDialogState();
}

class _KitchenVarianceReviewDialogState
    extends ConsumerState<_KitchenVarianceReviewDialog> {
  String _liabilityAction = 'approve_only';
  String? _selectedStaffId;
  final Map<String, TextEditingController> _splitCtrls = {};
  final _writeOffReasonCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  bool _posting = false;

  List<Map<String, dynamic>> get _staff =>
      (widget.detail['shift_staff'] as List?)?.cast<Map<String, dynamic>>() ??
      [];

  num get _totalVariance =>
      _num((widget.detail['shift'] as Map?)?['total_variance_cost']).abs();

  @override
  void initState() {
    super.initState();
    for (final st in _staff) {
      _splitCtrls['${st['user_id']}'] = TextEditingController();
    }
  }

  @override
  void dispose() {
    for (final c in _splitCtrls.values) {
      c.dispose();
    }
    _writeOffReasonCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final shift =
        (widget.detail['shift'] as Map?)?.cast<String, dynamic>() ?? {};
    final stockTake =
        (widget.detail['stock_take'] as List?)?.cast<Map<String, dynamic>>() ??
            [];

    return Dialog(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 680, maxHeight: 720),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('${shift['shift_number'] ?? 'Shift'}',
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w700)),
              Text(
                  '${shift['shift_date'] ?? ''}  •  Variance cost ${_money(_totalVariance)}',
                  style: const TextStyle(color: Colors.grey)),
              const SizedBox(height: 12),
              if (stockTake.isNotEmpty)
                Flexible(
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Variance Breakdown',
                            style: TextStyle(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 6),
                        ...stockTake.map((st) {
                          final variance = _num(st['variance']);
                          if (variance == 0) return const SizedBox.shrink();
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 2),
                            child: Row(
                              children: [
                                Expanded(
                                    child: Text(
                                        '${st['item_name'] ?? st['item_sku']}',
                                        style: const TextStyle(fontSize: 13))),
                                Text(
                                  '${variance >= 0 ? '+' : ''}${variance.toStringAsFixed(2)}  (${_money(_num(st['variance_value']).abs())})',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: variance > 0
                                        ? Colors.green
                                        : Colors.red,
                                  ),
                                ),
                              ],
                            ),
                          );
                        }),
                        const Divider(height: 20),
                        const Text('Liability Decision',
                            style: TextStyle(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 8),
                        _liabilityRadio('approve_only',
                            'Approve only (no charge to staff)'),
                        _liabilityRadio(
                            'single_staff', 'Charge a single staff member'),
                        if (_liabilityAction == 'single_staff')
                          _singleStaffPicker(),
                        _liabilityRadio(
                            'custom_split', 'Split liability (custom amounts)'),
                        if (_liabilityAction == 'custom_split')
                          _customSplitInputs(),
                        _liabilityRadio(
                            'split_shift', 'Split equally across whole shift'),
                        if (_liabilityAction == 'split_shift')
                          _splitShiftPreview(),
                        _liabilityRadio('write_off', 'Write off (no recovery)'),
                        if (_liabilityAction == 'write_off')
                          Padding(
                            padding: const EdgeInsets.only(left: 32, top: 4, bottom: 8),
                            child: TextField(
                              controller: _writeOffReasonCtrl,
                              decoration: const InputDecoration(
                                labelText: 'Write-off reason (required)',
                                border: OutlineInputBorder(),
                                isDense: true,
                              ),
                              maxLines: 2,
                            ),
                          ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _notesCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Notes (optional)',
                            border: OutlineInputBorder(),
                            isDense: true,
                          ),
                          maxLines: 2,
                        ),
                      ],
                    ),
                  ),
                ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _posting ? null : () => _submit(approved: false),
                      icon: const Icon(Icons.cancel_outlined, color: Colors.red),
                      label: const Text('Reject Shift'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: _posting ? null : () => _submit(approved: true),
                      icon: _posting
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.check),
                      label: Text(_posting ? 'Submitting...' : 'Approve'),
                      style: FilledButton.styleFrom(backgroundColor: Colors.green),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _liabilityRadio(String value, String label) {
    return RadioListTile<String>(
      value: value,
      groupValue: _liabilityAction,
      dense: true,
      contentPadding: EdgeInsets.zero,
      title: Text(label, style: const TextStyle(fontSize: 13)),
      onChanged: (v) => setState(() => _liabilityAction = v ?? _liabilityAction),
    );
  }

  Widget _singleStaffPicker() {
    return Padding(
      padding: const EdgeInsets.only(left: 32, bottom: 8),
      child: DropdownButtonFormField<String>(
        initialValue: _selectedStaffId,
        isExpanded: true,
        decoration: const InputDecoration(
            labelText: 'Staff member', isDense: true, border: OutlineInputBorder()),
        items: _staff
            .map((st) => DropdownMenuItem(
                  value: '${st['user_id']}',
                  child: Text('${st['name']} (${st['role']})',
                      overflow: TextOverflow.ellipsis),
                ))
            .toList(),
        onChanged: (v) => setState(() => _selectedStaffId = v),
      ),
    );
  }

  Widget _customSplitInputs() {
    if (_staff.isEmpty) {
      return const Padding(
        padding: EdgeInsets.only(left: 32, bottom: 8),
        child: Text('No shift staff found to split liability across.',
            style: TextStyle(color: Colors.grey, fontSize: 12)),
      );
    }
    return Padding(
      padding: const EdgeInsets.only(left: 32, bottom: 8),
      child: Column(
        children: _staff.map((st) {
          final id = '${st['user_id']}';
          return Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              children: [
                Expanded(
                    child: Text('${st['name']} (${st['role']})',
                        style: const TextStyle(fontSize: 13))),
                SizedBox(
                  width: 120,
                  child: TextField(
                    controller: _splitCtrls[id],
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                        prefixText: 'KES ', isDense: true, border: OutlineInputBorder()),
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _splitShiftPreview() {
    if (_staff.isEmpty) {
      return const Padding(
        padding: EdgeInsets.only(left: 32, bottom: 8),
        child: Text('No shift staff found to split liability across.',
            style: TextStyle(color: Colors.grey, fontSize: 12)),
      );
    }
    final each = _totalVariance / _staff.length;
    return Padding(
      padding: const EdgeInsets.only(left: 32, bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: _staff
            .map((st) => Text('${st['name']} (${st['role']}) — ${_money(each)}',
                style: const TextStyle(fontSize: 13)))
            .toList(),
      ),
    );
  }

  Future<void> _submit({required bool approved}) async {
    final shiftId = '${(widget.detail['shift'] as Map?)?['id']}';
    List<Map<String, dynamic>> allocations = [];
    String? writeOffReason;
    String liabilityAction = approved ? _liabilityAction : 'rejected';

    if (approved) {
      switch (_liabilityAction) {
        case 'single_staff':
          if (_selectedStaffId == null) {
            _showError('Select a staff member to charge.');
            return;
          }
          allocations = [
            {
              'user_id': _selectedStaffId,
              'amount': _totalVariance,
              'description': 'Kitchen variance — ${(widget.detail['shift'] as Map?)?['shift_number']}',
            }
          ];
          break;
        case 'custom_split':
          allocations = _staff
              .map((st) {
                final id = '${st['user_id']}';
                final amount = double.tryParse(_splitCtrls[id]?.text.trim() ?? '') ?? 0;
                return {'user_id': id, 'amount': amount, 'description': 'Kitchen variance split'};
              })
              .where((a) => (a['amount'] as double) > 0)
              .toList();
          if (allocations.isEmpty) {
            _showError('Enter at least one staff amount to split.');
            return;
          }
          break;
        case 'split_shift':
          if (_staff.isEmpty) {
            _showError('No shift staff found to split liability across.');
            return;
          }
          final each = _totalVariance / _staff.length;
          allocations = _staff
              .map((st) => {
                    'user_id': '${st['user_id']}',
                    'amount': each,
                    'description': 'Kitchen variance — equal shift split',
                  })
              .toList();
          break;
        case 'write_off':
          writeOffReason = _writeOffReasonCtrl.text.trim();
          if (writeOffReason.isEmpty) {
            _showError('A write-off reason is required.');
            return;
          }
          break;
      }
    }

    setState(() => _posting = true);
    try {
      final repo = ref.read(branchAccountantRepositoryProvider);
      await repo.reviewKitchenShiftVariance(
        shiftId: shiftId,
        approved: approved,
        liabilityAction: liabilityAction,
        allocations: allocations,
        notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
        writeOffReason: writeOffReason,
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      _showError('Failed to submit: $e');
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }
}

class _BudgetsSection extends ConsumerStatefulWidget {
  const _BudgetsSection();

  @override
  ConsumerState<_BudgetsSection> createState() => _BudgetsSectionState();
}

class _BudgetsSectionState extends ConsumerState<_BudgetsSection> {
  late Future<Map<String, dynamic>> _future = _load();

  Future<Map<String, dynamic>> _load() async {
    final repo = ref.read(branchAccountantRepositoryProvider);
    final results = await Future.wait([
      repo.getBudgets(),
      repo.getBudgetSummary(),
      repo.getBudgetAnalysis(),
    ]);
    return {
      'budgets': results[0],
      'summary': results[1],
      'analysis': results[2]
    };
  }

  void _refresh() => setState(() {
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (data) {
          final budgets = _list(data['budgets']);
          final summary = _map(data['summary']);
          final analysis = _map(data['analysis']);
          return _Page(
            title: 'Budget Control',
            subtitle:
                'CRUD, expense linking, summary, and analysis from branch operations finance routes.',
            actions: [
              FilledButton.icon(
                onPressed: () => _editBudget(null),
                icon: const Icon(Icons.add),
                label: const Text('New Budget'),
              ),
              _RefreshButton(onPressed: _refresh),
            ],
            children: [
              _ResponsiveGrid(children: [
                _MetricCard(
                    'Total Budget',
                    _money(_num(
                        summary['total_allocated'] ?? summary['total_budget'])),
                    Icons.account_balance,
                    Colors.blue),
                _MetricCard(
                    'Spent',
                    _money(_num(
                        summary['total_spent'] ?? summary['spent_amount'])),
                    Icons.trending_down,
                    Colors.red),
                _MetricCard(
                    'Remaining',
                    _money(_num(summary['total_remaining'] ??
                        summary['remaining_budget'])),
                    Icons.savings,
                    Colors.green),
                _MetricCard(
                    'Utilization',
                    '${_num(summary['usage_percentage'] ?? summary['utilization_percentage']).toStringAsFixed(1)}%',
                    Icons.percent,
                    Colors.purple),
              ]),
              if (analysis.isNotEmpty)
                _SectionCard(
                    title: 'Budget Analysis', child: _KeyValueList(analysis)),
              _SectionCard(
                title: 'Budgets',
                child: _SimpleTable(
                  columns: const [
                    'Name',
                    'Category',
                    'Period',
                    'Budget',
                    'Spent',
                    'Status',
                    'Actions'
                  ],
                  rows: budgets
                      .map((budget) => [
                            _text(budget, ['name', 'title']),
                            _text(budget, ['category']),
                            _text(budget, ['period', 'fiscal_period']),
                            _money(_num(budget['allocated_amount'] ??
                                budget['amount'] ??
                                budget['budget_amount'])),
                            _money(_num(
                                budget['spent_amount'] ?? budget['spent'])),
                            _StatusPill(_text(budget, ['status'])),
                            Wrap(
                              spacing: 8,
                              children: [
                                TextButton(
                                    onPressed: () => _editBudget(budget),
                                    child: const Text('Edit')),
                                TextButton(
                                    onPressed: () => _linkExpense(budget),
                                    child: const Text('Link Expense')),
                                TextButton(
                                    onPressed: () => _deleteBudget(budget),
                                    child: const Text('Delete')),
                              ],
                            ),
                          ])
                      .toList(),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _editBudget(Map<String, dynamic>? budget) async {
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _BudgetDialog(existing: budget),
    );
    if (result == null) return;
    final repo = ref.read(branchAccountantRepositoryProvider);
    if (budget == null) {
      await repo.createBudget(result);
      _toast('Budget created');
    } else {
      await repo.updateBudget('${budget['id']}', result);
      _toast('Budget updated');
    }
    _refresh();
  }

  Future<void> _linkExpense(Map<String, dynamic> budget) async {
    final result = await _formDialog(
      context,
      'Link Expense to Budget',
      const ['expense_id', 'amount', 'description'],
    );
    if (result == null) return;
    await ref
        .read(branchAccountantRepositoryProvider)
        .linkBudgetExpense('${budget['id']}', result);
    _toast('Expense linked');
    _refresh();
  }

  Future<void> _deleteBudget(Map<String, dynamic> budget) async {
    final ok = await _confirm(context, 'Delete this budget?');
    if (!ok) return;
    await ref
        .read(branchAccountantRepositoryProvider)
        .deleteBudget('${budget['id']}');
    _toast('Budget deleted');
    _refresh();
  }
}

class _DailyEntryDialog extends ConsumerStatefulWidget {
  const _DailyEntryDialog({
    required this.existing,
    this.isReadOnly = false,
    this.autoFill = false,
  });
  final Map<String, dynamic> existing;
  final bool isReadOnly;
  final bool autoFill;

  @override
  ConsumerState<_DailyEntryDialog> createState() => _DailyEntryDialogState();
}

class _DailyEntryDialogState extends ConsumerState<_DailyEntryDialog> {
  int _tab = 0;
  bool _autofilling = false;
  // After Lina auto-fills, the figures are locked: the accountant reviews and
  // submits to the Director but cannot edit the numbers.
  bool _linaLocked = false;
  List<Map<String, dynamic>> _linaAnomalies = const [];
  late final String _recordDate =
      _text(widget.existing, ['record_date']).isEmpty
          ? _today()
          : _text(widget.existing, ['record_date']);
  late final Map<String, TextEditingController> _controllers = {
    for (final field in [
      ..._revenueFields,
      'cash',
      'mpesa',
      'swipe',
      'credit_bills',
      'banked',
      'opening_balance',
      'central_store_receipts',
      'weekly_supplier_receipts',
      'closing_balance',
      'petty_cash_total',
      'transaction_costs_total',
      'direct_suppliers_total',
      'wastage_total',
      'shorts_total',
      'other_expenses_total',
      'notes',
    ])
      field: TextEditingController(text: _initial(field)),
  };
  late List<Map<String, dynamic>> _bankingEntries = _entriesFrom(
      _map(widget.existing['banking_data'])['entries'] ??
          _map(widget.existing['banking_data'])['history']);
  late final Map<String, List<Map<String, dynamic>>> _expenseEntries = {
    'petty_cash_entries': _entriesFrom(
        _map(widget.existing['expense_data'])['petty_cash_entries']),
    'transaction_cost_entries': _entriesFrom(
        _map(widget.existing['expense_data'])['transaction_cost_entries']),
    'direct_supplier_entries': _entriesFrom(
        _map(widget.existing['expense_data'])['direct_supplier_entries']),
    'wastage_entries':
        _entriesFrom(_map(widget.existing['expense_data'])['wastage_entries']),
    'shorts_entries':
        _entriesFrom(_map(widget.existing['expense_data'])['shorts_entries']),
    'other_entries':
        _entriesFrom(_map(widget.existing['expense_data'])['other_entries']),
  };

  static const _revenueFields = [
    'restaurant',
    'bar',
    'executive_bar',
    'sports_bar',
    'pool_table',
    'spa_sauna',
    'carwash',
    'conferences',
    'outside_catering',
    'rooms',
    'non_consumables',
    'swimming_pool',
    'other',
  ];

  String _initial(String field) {
    final data = widget.existing;
    return '${_map(data['revenue_data'])[field] ?? _map(data['payment_data'])[field] ?? _map(data['banking_data'])[field] ?? _map(data['cogs_data'])[field] ?? _map(data['expense_data'])[field] ?? data[field] ?? ''}';
  }

  // Field label overrides for the workspace (otherwise falls back to _title)
  static const _fieldLabels = {
    'other': 'Paid Bills',
    'credit_bills': 'Credit Bills',
    'swipe': 'Swipe (Card)',
    'mpesa': 'Mpesa',
  };

  String _fieldLabel(String field) => _fieldLabels[field] ?? _title(field);

  @override
  void initState() {
    super.initState();
    if (widget.autoFill) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _autofillWithLina();
      });
    }
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const tabs = ['Revenue', 'Payments', 'Banking', 'COGS', 'Expenses'];
    final isReadOnly = widget.isReadOnly;
    final fieldsReadOnly = isReadOnly || _linaLocked;
    final statusText = _text(widget.existing, ['status']).toUpperCase();
    return AlertDialog(
      title: Row(children: [
        Expanded(child: Text('Financial Entry — $_recordDate')),
        if (isReadOnly)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.blue.shade50,
              border: Border.all(color: Colors.blue.shade200),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              statusText,
              style: TextStyle(
                color: Colors.blue.shade700,
                fontSize: 11,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
      ]),
      content: SizedBox(
        width: 820,
        height: 560,
        child: Column(
          children: [
            SegmentedButton<int>(
              segments: [
                for (var i = 0; i < tabs.length; i++)
                  ButtonSegment(value: i, label: Text(tabs[i])),
              ],
              selected: {_tab},
              onSelectionChanged: (v) => setState(() => _tab = v.first),
            ),
            if (isReadOnly)
              Container(
                margin: const EdgeInsets.only(top: 8),
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(children: [
                  Icon(Icons.lock_outline,
                      size: 14, color: Colors.blue.shade700),
                  const SizedBox(width: 6),
                  Text(
                    'Read-only: This record has been $statusText and cannot be edited.',
                    style: TextStyle(color: Colors.blue.shade700, fontSize: 12),
                  ),
                ]),
              ),
            if (_linaLocked) _linaBanner(),
            const SizedBox(height: 8),
            Expanded(
                child: SingleChildScrollView(child: _tabBody(fieldsReadOnly))),
            const Divider(),
            _KeyValueList({
              'Total Revenue': _money(_total(_revenueFields)),
              'Total Payments': _money(
                  _total(const ['cash', 'mpesa', 'swipe', 'credit_bills'])),
              'Payment Variance': _money(
                  _total(const ['cash', 'mpesa', 'swipe', 'credit_bills']) -
                      _total(_revenueFields)),
              'Expected Cash':
                  _money(_numText('cash') - _numText('petty_cash_total')),
              'Unbanked Cash': _money(
                  (_numText('cash') - _numText('petty_cash_total')) -
                      _numText('banked')),
              'Net Profit': _money(_netProfit),
            }),
          ],
        ),
      ),
      actions: isReadOnly
          ? [
              FilledButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('Close')),
            ]
          : _linaLocked
              ? [
                  TextButton(
                      onPressed: () => Navigator.pop(context, false),
                      child: const Text('Cancel')),
                  FilledButton.tonal(
                      onPressed: () => _save('DRAFT'),
                      child: const Text('Save Draft')),
                  FilledButton.icon(
                    onPressed: () => _save('SUBMITTED'),
                    icon: const Icon(Icons.send, size: 16),
                    label: const Text('Send to Auditor'),
                  ),
                ]
              : [
                  OutlinedButton.icon(
                    onPressed: _autofilling ? null : _autofillWithLina,
                    icon: _autofilling
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.auto_awesome, size: 16),
                    label: Text(_autofilling
                        ? 'Lina is collecting…'
                        : 'Autofill with Lina AI'),
                  ),
                  TextButton(
                      onPressed: () => Navigator.pop(context, false),
                      child: const Text('Cancel')),
                  FilledButton.tonal(
                      onPressed: () => _save('DRAFT'),
                      child: const Text('Save Draft')),
                  FilledButton(
                      onPressed: () => _save('SUBMITTED'),
                      child: const Text('Submit')),
                ],
    );
  }

  Widget _tabBody(bool readOnly) {
    switch (_tab) {
      case 0:
        return _fieldGrid(_revenueFields, readOnly);
      case 1:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _fieldGrid(
                const ['cash', 'mpesa', 'swipe', 'credit_bills'], readOnly),
            const SizedBox(height: 8),
            Builder(builder: (_) {
              final totalPay =
                  _total(const ['cash', 'mpesa', 'swipe', 'credit_bills']);
              final totalRev = _total(_revenueFields);
              final variance = totalPay - totalRev;
              final isOk = variance.abs() <= 1;
              return Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: isOk ? Colors.green.shade50 : Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                      color:
                          isOk ? Colors.green.shade200 : Colors.red.shade200),
                ),
                child: Row(children: [
                  Icon(
                    isOk ? Icons.check_circle : Icons.warning,
                    size: 16,
                    color: isOk ? Colors.green.shade700 : Colors.red.shade700,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    isOk
                        ? 'Payments balanced — Variance: ${_money(variance)}'
                        : 'Variance: ${_money(variance)} — Must be KES 0 to submit',
                    style: TextStyle(
                      color: isOk ? Colors.green.shade700 : Colors.red.shade700,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                ]),
              );
            }),
          ],
        );
      case 2:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _fieldGrid(const ['banked'], readOnly),
            const SizedBox(height: 14),
            _LineItemEditor(
              title: 'Banking Entries',
              entries: _bankingEntries,
              columns: const [
                'method',
                'amount',
                'account',
                'reference',
                'time',
                'notes'
              ],
              readOnly: readOnly,
              onChanged: (entries) {
                setState(() {
                  _bankingEntries = entries;
                  if (entries.isNotEmpty) {
                    _controllers['banked']?.text =
                        _lineItemsTotal(entries).toStringAsFixed(0);
                  }
                });
              },
            ),
            if (!readOnly && _numText('cash') > _numText('banked'))
              Container(
                margin: const EdgeInsets.only(top: 8),
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.orange.shade200),
                ),
                child: Row(children: [
                  Icon(Icons.account_balance_wallet,
                      size: 16, color: Colors.orange.shade700),
                  const SizedBox(width: 8),
                  Text(
                    'Unbanked cash: ${_money(_numText('cash') - _numText('banked'))}',
                    style: TextStyle(
                        color: Colors.orange.shade800,
                        fontWeight: FontWeight.w700,
                        fontSize: 12),
                  ),
                ]),
              ),
          ],
        );
      case 3:
        return _fieldGrid(const [
          'opening_balance',
          'central_store_receipts',
          'weekly_supplier_receipts',
          'closing_balance'
        ], readOnly);
      default:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _fieldGrid(const [
              'petty_cash_total',
              'transaction_costs_total',
              'direct_suppliers_total',
              'wastage_total',
              'shorts_total',
              'other_expenses_total'
            ], readOnly),
            const SizedBox(height: 14),
            ...[
              ('Petty Cash', 'petty_cash_entries', 'petty_cash_total'),
              (
                'Direct Suppliers',
                'direct_supplier_entries',
                'direct_suppliers_total'
              ),
              ('Spoilt Items (Wastage)', 'wastage_entries', 'wastage_total'),
              ('Lost Items (Shorts)', 'shorts_entries', 'shorts_total'),
              (
                'Transaction Cost',
                'transaction_cost_entries',
                'transaction_costs_total'
              ),
              ('Other Expenses', 'other_entries', 'other_expenses_total'),
            ].map(
              (config) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _LineItemEditor(
                  title: config.$1,
                  entries: _expenseEntries[config.$2]!,
                  columns: const ['description', 'amount'],
                  readOnly: readOnly,
                  onChanged: (entries) {
                    setState(() {
                      _expenseEntries[config.$2] = entries;
                      _controllers[config.$3]?.text =
                          _lineItemsTotal(entries).toStringAsFixed(0);
                    });
                  },
                ),
              ),
            ),
            TextField(
              controller: _controllers['notes'],
              minLines: 3,
              maxLines: 5,
              enabled: !readOnly,
              decoration: const InputDecoration(labelText: 'Notes & Remarks'),
            ),
          ],
        );
    }
  }

  Widget _fieldGrid(List<String> fields, bool readOnly) {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: fields
          .map((field) => SizedBox(
                width: 240,
                child: TextField(
                  controller: _controllers[field],
                  keyboardType: TextInputType.number,
                  enabled: !readOnly,
                  decoration: InputDecoration(labelText: _fieldLabel(field)),
                ),
              ))
          .toList(),
    );
  }

  num get _netProfit {
    final cogs = _numText('opening_balance') +
        _numText('central_store_receipts') +
        _numText('weekly_supplier_receipts') -
        _numText('closing_balance');
    final expenses = _total(const [
          'petty_cash_total',
          'transaction_costs_total',
          'direct_suppliers_total',
          'wastage_total',
          'shorts_total',
          'other_expenses_total'
        ]) +
        _entryDelta('petty_cash_entries', 'petty_cash_total') +
        _entryDelta('transaction_cost_entries', 'transaction_costs_total') +
        _entryDelta('direct_supplier_entries', 'direct_suppliers_total') +
        _entryDelta('wastage_entries', 'wastage_total') +
        _entryDelta('shorts_entries', 'shorts_total') +
        _entryDelta('other_entries', 'other_expenses_total');
    return _total(_revenueFields) - cogs - expenses;
  }

  num _total(List<String> fields) =>
      fields.fold<num>(0, (sum, f) => sum + _numText(f));
  num _numText(String field) =>
      num.tryParse(_controllers[field]?.text ?? '') ?? 0;
  num _lineItemsTotal(List<Map<String, dynamic>> entries) =>
      entries.fold<num>(0, (sum, entry) => sum + _num(entry['amount']));
  num _entryDelta(String entriesKey, String totalField) {
    final entries =
        _expenseEntries[entriesKey] ?? const <Map<String, dynamic>>[];
    if (entries.isEmpty) return 0;
    return _lineItemsTotal(entries) - _numText(totalField);
  }

  /// Ask Lina AI to collect every system figure for the day and fill the form.
  Future<void> _autofillWithLina() async {
    setState(() => _autofilling = true);
    try {
      final data = await ref
          .read(branchAccountantRepositoryProvider)
          .getDailyAutofill(_recordDate);
      final revenue = _map(data['revenue_data']);
      final payments = _map(data['payment_data']);
      final banking = _map(data['banking_data']);
      final cogs = _map(data['cogs_data']);
      final expense = _map(data['expense_data']);

      int filledCount = 0;
      void set(String field, dynamic value) {
        final c = _controllers[field];
        if (c == null) return;
        final num v = _num(value);
        if (v != 0) {
          c.text = v.toStringAsFixed(0);
          filledCount++;
        }
      }

      for (final f in _revenueFields) {
        set(f, revenue[f]);
      }
      for (final f in const ['cash', 'mpesa', 'swipe', 'credit_bills']) {
        set(f, payments[f]);
      }
      set('banked', banking['banked']);
      for (final f in const [
        'opening_balance',
        'central_store_receipts',
        'weekly_supplier_receipts',
        'closing_balance'
      ]) {
        set(f, cogs[f]);
      }
      for (final f in const [
        'petty_cash_total',
        'transaction_costs_total',
        'direct_suppliers_total',
        'wastage_total',
        'shorts_total',
        'other_expenses_total'
      ]) {
        set(f, expense[f]);
      }
      final notes = _text(data, ['notes']);
      if (notes.isNotEmpty) {
        _controllers['notes']?.text = notes;
      }
      final anomalies = _list(data['anomalies'])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();

      if (!mounted) return;

      // No data found for this date — don't lock the form so the user can
      // still enter figures manually.
      if (filledCount == 0) {
        AppNotifier.show(
          context,
          'Lina found no recorded transactions for $_recordDate. Enter figures manually.',
          isError: false,
        );
        return;
      }

      setState(() {
        _linaLocked = true;
        _linaAnomalies = anomalies;
      });
      AppNotifier.show(
        context,
        anomalies.isEmpty
            ? 'Lina filled & locked this entry. Review and Submit to the Director.'
            : 'Lina filled & locked this entry and flagged ${anomalies.length} anomaly(ies). Review and Submit to the Director.',
      );
    } catch (e) {
      if (mounted) {
        AppNotifier.show(
          context,
          'Lina autofill failed: $e',
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => _autofilling = false);
    }
  }

  Widget _linaBanner() {
    final hasAnomalies = _linaAnomalies.isNotEmpty;
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: hasAnomalies ? Colors.orange.shade50 : Colors.green.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
            color:
                hasAnomalies ? Colors.orange.shade200 : Colors.green.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.auto_awesome,
                size: 16,
                color: hasAnomalies
                    ? Colors.orange.shade800
                    : Colors.green.shade700),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                'Filled & locked by Lina AI — review and Submit to the Director. Figures cannot be edited.',
                style: TextStyle(
                  color: hasAnomalies
                      ? Colors.orange.shade900
                      : Colors.green.shade800,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ]),
          if (hasAnomalies) ...[
            const SizedBox(height: 8),
            Text('Anomalies for the Director (${_linaAnomalies.length}):',
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: Colors.orange.shade900)),
            const SizedBox(height: 4),
            ..._linaAnomalies.map((a) => Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        _text(a, ['severity']) == 'high'
                            ? Icons.error
                            : Icons.warning_amber,
                        size: 13,
                        color: _text(a, ['severity']) == 'high'
                            ? Colors.red.shade700
                            : Colors.orange.shade700,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          '${_text(a, ['title'])} — ${_text(a, ['detail'])}',
                          style: const TextStyle(fontSize: 11),
                        ),
                      ),
                    ],
                  ),
                )),
          ],
        ],
      ),
    );
  }

  Future<void> _save(String status) async {
    final totalRevenue = _total(_revenueFields);
    final totalPayments =
        _total(const ['cash', 'mpesa', 'swipe', 'credit_bills']);
    if (status == 'SUBMITTED' && (totalPayments - totalRevenue).abs() > 1) {
      _toast('Cannot submit with payment variance');
      return;
    }
    final totalBanked = _bankingEntries.isNotEmpty
        ? _lineItemsTotal(_bankingEntries)
        : _numText('banked');
    final pettyCashTotal = _expenseEntries['petty_cash_entries']!.isNotEmpty
        ? _lineItemsTotal(_expenseEntries['petty_cash_entries']!)
        : _numText('petty_cash_total');
    final expectedCash = _numText('cash') - pettyCashTotal;
    final totalCogs = _numText('opening_balance') +
        _numText('central_store_receipts') +
        _numText('weekly_supplier_receipts') -
        _numText('closing_balance');
    final transactionCostTotal =
        _expenseEntries['transaction_cost_entries']!.isNotEmpty
            ? _lineItemsTotal(_expenseEntries['transaction_cost_entries']!)
            : _numText('transaction_costs_total');
    final directSuppliersTotal =
        _expenseEntries['direct_supplier_entries']!.isNotEmpty
            ? _lineItemsTotal(_expenseEntries['direct_supplier_entries']!)
            : _numText('direct_suppliers_total');
    final wastageTotal = _expenseEntries['wastage_entries']!.isNotEmpty
        ? _lineItemsTotal(_expenseEntries['wastage_entries']!)
        : _numText('wastage_total');
    final shortsTotal = _expenseEntries['shorts_entries']!.isNotEmpty
        ? _lineItemsTotal(_expenseEntries['shorts_entries']!)
        : _numText('shorts_total');
    final otherExpensesTotal = _expenseEntries['other_entries']!.isNotEmpty
        ? _lineItemsTotal(_expenseEntries['other_entries']!)
        : _numText('other_expenses_total');
    final totalExpenses = pettyCashTotal +
        transactionCostTotal +
        directSuppliersTotal +
        wastageTotal +
        shortsTotal +
        otherExpensesTotal;
    final netProfit = totalRevenue - totalCogs - totalExpenses;

    final repo = ref.read(branchAccountantRepositoryProvider);

    // Save (or update) the daily financial record first
    await repo.saveDailyRecord({
      'record_date': _recordDate,
      'status': status,
      'revenue_data': {for (final f in _revenueFields) f: _numText(f)},
      'total_revenue': totalRevenue,
      'payment_data': {
        'cash': _numText('cash'),
        'mpesa': _numText('mpesa'),
        'swipe': _numText('swipe'),
        'credit_bills': _numText('credit_bills'),
      },
      'total_payments': totalPayments,
      'banking_data': {
        'banked': totalBanked,
        'entries': _bankingEntries,
      },
      'expected_cash': expectedCash,
      'unbanked_cash': expectedCash - totalBanked,
      'cogs_data': {
        'opening_balance': _numText('opening_balance'),
        'central_store_receipts': _numText('central_store_receipts'),
        'weekly_supplier_receipts': _numText('weekly_supplier_receipts'),
        'closing_balance': _numText('closing_balance'),
      },
      'total_cogs': totalCogs,
      'expense_data': {
        'petty_cash_total': pettyCashTotal,
        'petty_cash_entries': _expenseEntries['petty_cash_entries'],
        'transaction_costs_total': transactionCostTotal,
        'transaction_cost_entries': _expenseEntries['transaction_cost_entries'],
        'direct_suppliers_total': directSuppliersTotal,
        'direct_supplier_entries': _expenseEntries['direct_supplier_entries'],
        'wastage_total': wastageTotal,
        'wastage_entries': _expenseEntries['wastage_entries'],
        'shorts_total': shortsTotal,
        'shorts_entries': _expenseEntries['shorts_entries'],
        'other_expenses_total': otherExpensesTotal,
        'other_entries': _expenseEntries['other_entries'],
      },
      'total_expenses': totalExpenses,
      'net_profit': netProfit,
      'notes': _controllers['notes']?.text,
    });

    // For DRAFT, just close — no variance engine
    if (status != 'SUBMITTED') {
      if (mounted) Navigator.pop(context, true);
      return;
    }

    // ── SUBMITTED path ────────────────────────────────────────────────────────
    // System generates its own financial workspace on-demand and returns
    // the variance to the accountant for review before posting.
    if (!mounted) return;
    Map<String, dynamic> closeResult = {};
    try {
      closeResult = await repo.submitWorkspaceClose({
        'record_date': _recordDate,
        'submitted_revenue': totalRevenue,
        'submitted_cogs': totalCogs,
        'submitted_expenses': totalExpenses,
        'submitted_net_profit': netProfit,
        'submitted_cash': _numText('cash'),
        'submitted_banked': totalBanked,
        'submitted_unbanked': expectedCash - totalBanked,
      });
    } catch (e) {
      if (mounted) _toast('Could not generate system comparison: $e');
      return;
    }

    if (!mounted) return;
    final data = closeResult['data'] as Map<String, dynamic>? ?? {};
    final submission = data['submission'] as Map<String, dynamic>? ?? {};
    final varianceData = data['variance'] as Map<String, dynamic>? ?? {};
    final requiresExplanation = data['requires_explanation'] == true;
    final submissionId = submission['id']?.toString() ?? '';
    final overallVariance = (varianceData['overall'] as num?)?.toDouble() ?? 0;
    final smartAnalysis = (varianceData['smart_analysis'] as List?)
            ?.cast<Map<String, dynamic>>() ??
        [];

    // Show the variance panel inline — accountant reviews then clicks Post
    if (mounted) {
      await showDialog(
        context: context,
        barrierDismissible: false,
        builder: (_) => _VarianceReviewDialog(
          recordDate: _recordDate,
          submissionId: submissionId,
          overallVariance: overallVariance,
          smartAnalysis: smartAnalysis,
          requiresExplanation: requiresExplanation,
          repo: repo,
          onPosted: () {
            Navigator.of(context).pop(); // close variance dialog
            Navigator.of(context).pop(true); // close entry dialog
          },
        ),
      );
    }
  }
}

// ── Variance Review Dialog ────────────────────────────────────────────────────
// Shown to the Branch Accountant immediately after they click Submit.
// Displays the system-generated variance and — if negative — requires a reason.
// The "Post" button sends to BOTH Auditor AND Director.
class _VarianceReviewDialog extends ConsumerStatefulWidget {
  const _VarianceReviewDialog({
    required this.recordDate,
    required this.submissionId,
    required this.overallVariance,
    required this.smartAnalysis,
    required this.requiresExplanation,
    required this.repo,
    required this.onPosted,
  });

  final String recordDate;
  final String submissionId;
  final double overallVariance;
  final List<Map<String, dynamic>> smartAnalysis;
  final bool requiresExplanation;
  final BranchAccountantRepository repo;
  final VoidCallback onPosted;

  @override
  ConsumerState<_VarianceReviewDialog> createState() =>
      _VarianceReviewDialogState();
}

class _VarianceReviewDialogState extends ConsumerState<_VarianceReviewDialog> {
  bool _posting = false;
  String? _selectedReason;
  final _notesCtrl = TextEditingController();

  static const _reasons = [
    ('cash_shortage', 'Cash Shortage'),
    ('banking_delay', 'Banking Delay'),
    ('inventory_loss', 'Inventory Loss'),
    ('revenue_leakage', 'Revenue Leakage'),
    ('posting_error', 'Posting / Data Entry Error'),
    ('fraud_suspected', 'Suspected Fraud (report to management)'),
    ('supplier_error', 'Supplier Invoice Error'),
    ('payroll_error', 'Payroll Error'),
    ('other', 'Other (explain in notes)'),
  ];

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  String _money(double v) {
    final sign = v >= 0 ? '+' : '';
    return '$sign${v.toStringAsFixed(2)}';
  }

  Future<void> _post() async {
    if (widget.requiresExplanation) {
      if (_selectedReason == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Please select a reason for the variance')),
        );
        return;
      }
      if (_notesCtrl.text.trim().length < 20) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content:
                  Text('Explanation notes must be at least 20 characters')),
        );
        return;
      }
    }
    setState(() => _posting = true);
    try {
      await widget.repo.postWorkspace(
        widget.submissionId,
        explanationReason: _selectedReason,
        explanationNotes:
            _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      );
      if (mounted) widget.onPosted();
    } catch (e) {
      if (mounted) {
        setState(() => _posting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Post failed: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isNegative = widget.overallVariance < 0;
    final varianceColor =
        isNegative ? Colors.red.shade700 : Colors.green.shade700;
    final varianceBg = isNegative ? Colors.red.shade50 : Colors.green.shade50;

    return AlertDialog(
      title: Row(children: [
        Icon(
          isNegative ? Icons.warning_amber_rounded : Icons.check_circle_outline,
          color: varianceColor,
        ),
        const SizedBox(width: 8),
        const Expanded(child: Text('System Variance Analysis')),
      ]),
      content: SizedBox(
        width: 520,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Date: ${widget.recordDate}',
                style: const TextStyle(fontSize: 12, color: Colors.black54),
              ),
              const SizedBox(height: 12),

              // Overall variance banner
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: varianceBg,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: varianceColor.withOpacity(0.3)),
                ),
                child: Column(children: [
                  Text(
                    'Overall Variance',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: varianceColor,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'KES ${_money(widget.overallVariance)}',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: varianceColor,
                    ),
                  ),
                  if (widget.requiresExplanation)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                        'Variance exceeds threshold — explanation required',
                        style: TextStyle(fontSize: 11, color: varianceColor),
                        textAlign: TextAlign.center,
                      ),
                    ),
                ]),
              ),

              // Smart analysis causes
              if (widget.smartAnalysis.isNotEmpty) ...[
                const SizedBox(height: 16),
                const Text(
                  'System Analysis — Likely Causes',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                ),
                const SizedBox(height: 8),
                ...widget.smartAnalysis.map((item) {
                  final confidence = (item['confidence'] as num?)?.toInt() ?? 0;
                  final cause = item['cause']?.toString() ?? '';
                  final detail = item['detail']?.toString() ?? '';
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 38,
                          height: 38,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: confidence >= 70
                                ? Colors.orange.shade100
                                : Colors.grey.shade100,
                          ),
                          child: Text(
                            '$confidence%',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: confidence >= 70
                                  ? Colors.orange.shade800
                                  : Colors.grey.shade700,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                cause,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13,
                                ),
                              ),
                              if (detail.isNotEmpty)
                                Text(
                                  detail,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: Colors.black54,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                }),
              ],

              // Mandatory explanation form (only when requires_explanation)
              if (widget.requiresExplanation) ...[
                const SizedBox(height: 16),
                const Divider(),
                const SizedBox(height: 8),
                const Text(
                  'Variance Explanation (Required)',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  decoration: const InputDecoration(
                    labelText: 'Reason *',
                    border: OutlineInputBorder(),
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                  value: _selectedReason,
                  items: _reasons
                      .map((r) => DropdownMenuItem(
                            value: r.$1,
                            child: Text(r.$2, overflow: TextOverflow.ellipsis),
                          ))
                      .toList(),
                  onChanged: (v) => setState(() => _selectedReason = v),
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _notesCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Explanation Notes *',
                    hintText:
                        'Describe what caused the variance (min 20 chars)',
                    border: OutlineInputBorder(),
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    alignLabelWithHint: true,
                  ),
                  maxLines: 3,
                  maxLength: 500,
                ),
              ],

              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(children: [
                  Icon(Icons.info_outline,
                      size: 16, color: Colors.blue.shade700),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Clicking "Post" will send this workspace to both the Auditor and Director simultaneously.',
                      style:
                          TextStyle(fontSize: 11, color: Colors.blue.shade700),
                    ),
                  ),
                ]),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _posting ? null : () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton.icon(
          onPressed: _posting ? null : _post,
          icon: _posting
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.send_rounded, size: 18),
          label: const Text('Post to Auditor & Director'),
        ),
      ],
    );
  }
}

class _LineItemEditor extends StatelessWidget {
  const _LineItemEditor({
    required this.title,
    required this.entries,
    required this.columns,
    required this.onChanged,
    this.readOnly = false,
  });

  final String title;
  final List<Map<String, dynamic>> entries;
  final List<String> columns;
  final ValueChanged<List<Map<String, dynamic>>> onChanged;
  final bool readOnly;

  @override
  Widget build(BuildContext context) {
    // method dropdown options for banking entries
    const bankingMethods = [
      'Cash Deposit',
      'Paybill',
      'Card Swipe',
      'Bank Transfer',
      'Other',
    ];

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        border: Border.all(color: Colors.grey.shade200),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(title,
                    style: const TextStyle(fontWeight: FontWeight.w800)),
              ),
              if (!readOnly)
                OutlinedButton.icon(
                  onPressed: () => onChanged([
                    ...entries,
                    {
                      for (final column in columns)
                        column: column == 'amount' ? 0 : ''
                    }
                  ]),
                  icon: const Icon(Icons.add, size: 16),
                  label: const Text('Add Entry'),
                ),
            ],
          ),
          const SizedBox(height: 8),
          if (entries.isEmpty)
            Text(
              readOnly ? 'No entries recorded.' : 'No entries added.',
              style: const TextStyle(color: AppColors.kTextSecondary),
            )
          else
            ...entries.asMap().entries.map((entry) {
              final index = entry.key;
              final item = entry.value;
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    ...columns.map((column) {
                      // Use dropdown for 'method' column in banking entries
                      if (column == 'method' && !readOnly) {
                        final currentVal = '${item[column] ?? ''}';
                        final dropVal = bankingMethods.contains(currentVal)
                            ? currentVal
                            : bankingMethods.first;
                        return SizedBox(
                          width: 160,
                          child: DropdownButtonFormField<String>(
                            key: ValueKey('$title-$index-$column'),
                            initialValue: dropVal,
                            decoration:
                                const InputDecoration(labelText: 'Method'),
                            items: bankingMethods
                                .map((m) =>
                                    DropdownMenuItem(value: m, child: Text(m)))
                                .toList(),
                            onChanged: (value) {
                              if (value == null) return;
                              final next = entries
                                  .map((row) => Map<String, dynamic>.from(row))
                                  .toList();
                              next[index][column] = value;
                              onChanged(next);
                            },
                          ),
                        );
                      }
                      return SizedBox(
                        width: column == 'amount' ? 130 : 180,
                        child: TextFormField(
                          key: ValueKey('$title-$index-$column'),
                          initialValue: '${item[column] ?? ''}',
                          keyboardType: column == 'amount'
                              ? TextInputType.number
                              : TextInputType.text,
                          enabled: !readOnly,
                          decoration:
                              InputDecoration(labelText: _title(column)),
                          onChanged: (value) {
                            final next = entries
                                .map((row) => Map<String, dynamic>.from(row))
                                .toList();
                            next[index][column] = column == 'amount'
                                ? (num.tryParse(value) ?? 0)
                                : value;
                            onChanged(next);
                          },
                        ),
                      );
                    }),
                    if (!readOnly)
                      IconButton(
                        tooltip: 'Remove entry',
                        onPressed: () => onChanged([
                          for (var i = 0; i < entries.length; i++)
                            if (i != index)
                              Map<String, dynamic>.from(entries[i])
                        ]),
                        icon: const Icon(Icons.close, color: Colors.red),
                      ),
                  ],
                ),
              );
            }),
          const Divider(),
          Align(
            alignment: Alignment.centerRight,
            child: Text(
              'Total: ${_money(entries.fold<num>(0, (sum, item) => sum + _num(item['amount'])))}',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Calendar Grid for Financial Workspace ────────────────────────────────────

class _MonthCalendarGrid extends StatelessWidget {
  const _MonthCalendarGrid({
    required this.month,
    required this.records,
    required this.onDayTapped,
    required this.onNewEntry,
  });

  final DateTime month;
  final List<Map<String, dynamic>> records;
  final ValueChanged<Map<String, dynamic>> onDayTapped;
  final VoidCallback onNewEntry;

  @override
  Widget build(BuildContext context) {
    final recordByDate = <String, Map<String, dynamic>>{
      for (final r in records) _text(r, ['record_date']): r,
    };
    final firstDay = DateTime(month.year, month.month, 1);
    final lastDay = DateTime(month.year, month.month + 1, 0);
    // weekday is 1=Mon .. 7=Sun, we want 0-indexed offset from Mon
    final startOffset = firstDay.weekday - 1;
    final totalCells = startOffset + lastDay.day;
    final rows = (totalCells / 7).ceil();
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    final todayStr = _today();

    return _SectionCard(
      title: 'Daily Records — ${DateFormat('MMMM yyyy').format(month)}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Weekday header
          Row(
            children: weekdays
                .map((d) => Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        alignment: Alignment.center,
                        child: Text(
                          d,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: Colors.grey.shade500,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ))
                .toList(),
          ),
          const Divider(height: 1),
          // Calendar rows
          for (int row = 0; row < rows; row++)
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: List.generate(7, (col) {
                  final idx = row * 7 + col;
                  final day = idx - startOffset + 1;
                  if (day < 1 || day > lastDay.day) {
                    return Expanded(
                      child: Container(
                        constraints: const BoxConstraints(minHeight: 70),
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.grey.shade100),
                          color: Colors.grey.shade50,
                        ),
                      ),
                    );
                  }
                  final dateStr = _date(DateTime(month.year, month.month, day));
                  final record = recordByDate[dateStr];
                  final status = record != null
                      ? _text(record, ['status']).toUpperCase()
                      : '';
                  final isToday = dateStr == todayStr;

                  Color bg;
                  Color accent;
                  if (status == 'REVIEWED') {
                    bg = Colors.green.shade50;
                    accent = Colors.green.shade400;
                  } else if (status == 'SUBMITTED') {
                    bg = Colors.blue.shade50;
                    accent = Colors.blue.shade400;
                  } else if (status == 'FLAGGED') {
                    bg = Colors.red.shade50;
                    accent = Colors.red.shade400;
                  } else if (status == 'DRAFT') {
                    bg = Colors.amber.shade50;
                    accent = Colors.amber.shade600;
                  } else {
                    bg = Colors.white;
                    accent = Colors.grey.shade200;
                  }

                  return Expanded(
                    child: GestureDetector(
                      onTap: () => onDayTapped(
                        record ?? {'record_date': dateStr, 'status': 'DRAFT'},
                      ),
                      child: Container(
                        constraints: const BoxConstraints(minHeight: 70),
                        padding: const EdgeInsets.all(5),
                        decoration: BoxDecoration(
                          color: bg,
                          border:
                              Border.all(color: accent.withValues(alpha: 0.5)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(children: [
                              Container(
                                width: 20,
                                height: 20,
                                decoration: BoxDecoration(
                                  color: isToday
                                      ? AppColors.kPrimary
                                      : Colors.transparent,
                                  shape: BoxShape.circle,
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  '$day',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: isToday
                                        ? Colors.white
                                        : Colors.grey.shade700,
                                  ),
                                ),
                              ),
                              const Spacer(),
                              if (record != null)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 3, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: accent.withValues(alpha: 0.2),
                                    borderRadius: BorderRadius.circular(3),
                                  ),
                                  child: Text(
                                    status.length > 3
                                        ? status.substring(0, 3)
                                        : status,
                                    style: TextStyle(
                                        fontSize: 7,
                                        fontWeight: FontWeight.w900,
                                        color: accent),
                                  ),
                                ),
                            ]),
                            if (record != null) ...[
                              const SizedBox(height: 2),
                              Text(
                                _money(_num(record['total_revenue'])),
                                style: const TextStyle(
                                    fontSize: 9, fontWeight: FontWeight.w700),
                                overflow: TextOverflow.ellipsis,
                                maxLines: 1,
                              ),
                              Text(
                                'P: ${_money(_num(record['net_profit']))}',
                                style: TextStyle(
                                  fontSize: 8,
                                  color: _num(record['net_profit']) >= 0
                                      ? Colors.green.shade700
                                      : Colors.red.shade700,
                                ),
                                overflow: TextOverflow.ellipsis,
                                maxLines: 1,
                              ),
                              if (_num(record['unbanked_cash']) > 0)
                                Container(
                                  margin: const EdgeInsets.only(top: 2),
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 3, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: Colors.red.shade100,
                                    borderRadius: BorderRadius.circular(3),
                                  ),
                                  child: Text(
                                    '⚠ Unbanked',
                                    style: TextStyle(
                                        fontSize: 7,
                                        color: Colors.red.shade800,
                                        fontWeight: FontWeight.w700),
                                  ),
                                ),
                            ] else ...[
                              const SizedBox(height: 4),
                              Text(
                                '+ tap to add',
                                style: TextStyle(
                                    fontSize: 8, color: Colors.grey.shade400),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ),
          const SizedBox(height: 14),
          // Legend
          Wrap(
            spacing: 16,
            runSpacing: 8,
            children: [
              _CalLegend(Colors.white, Colors.grey.shade300, 'No entry'),
              _CalLegend(Colors.amber.shade50, Colors.amber.shade400, 'Draft'),
              _CalLegend(
                  Colors.blue.shade50, Colors.blue.shade400, 'Submitted'),
              _CalLegend(
                  Colors.green.shade50, Colors.green.shade400, 'Reviewed'),
              _CalLegend(Colors.red.shade50, Colors.red.shade400, 'Flagged'),
            ],
          ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: onNewEntry,
            icon: const Icon(Icons.add),
            label: const Text("Add Today's Entry"),
          ),
        ],
      ),
    );
  }
}

class _CalLegend extends StatelessWidget {
  const _CalLegend(this.bg, this.accent, this.label);
  final Color bg;
  final Color accent;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 14,
          height: 14,
          decoration: BoxDecoration(
            color: bg,
            border: Border.all(color: accent.withValues(alpha: 0.6)),
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: 5),
        Text(label,
            style:
                const TextStyle(fontSize: 11, color: AppColors.kTextSecondary)),
      ],
    );
  }
}

// ─── Achievement Progress Bar for Revenue Oversight ───────────────────────────

class _AchievementBar extends StatelessWidget {
  const _AchievementBar({
    required this.achievement,
    required this.categories,
  });

  final double achievement;
  final List<Map<String, dynamic>> categories;

  @override
  Widget build(BuildContext context) {
    final pct = achievement;
    final color = pct >= 100
        ? Colors.green
        : pct >= 80
            ? Colors.blue
            : Colors.amber;
    final label = pct >= 100
        ? '✓ Target Met'
        : pct >= 80
            ? 'On Track'
            : 'Below Target';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SectionCard(
          title: 'Revenue Achievement',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Expanded(
                  child: Text(
                    '${pct.toStringAsFixed(1)}% of revenue target achieved',
                    style: TextStyle(
                      color: color,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    label,
                    style: TextStyle(
                        color: color,
                        fontWeight: FontWeight.w700,
                        fontSize: 12),
                  ),
                ),
              ]),
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: LinearProgressIndicator(
                  value: (pct / 100).clamp(0.0, 1.0),
                  minHeight: 14,
                  backgroundColor: Colors.grey.shade200,
                  valueColor: AlwaysStoppedAnimation<Color>(color),
                ),
              ),
            ],
          ),
        ),
        if (categories.isNotEmpty) ...[
          const SizedBox(height: 16),
          _SectionCard(
            title: 'Category Performance',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: categories.map((item) {
                final cat = _text(item, ['category', 'name']);
                final rev = _num(item['revenue']);
                final tgt = _num(item['target'] ?? item['target_revenue'] ?? 0);
                final catPct = tgt > 0 ? (rev / tgt * 100).toDouble() : 0.0;
                final catColor = catPct >= 100
                    ? Colors.green
                    : catPct >= 80
                        ? Colors.blue
                        : Colors.amber;
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Container(
                          width: 8,
                          height: 8,
                          margin: const EdgeInsets.only(right: 8),
                          decoration: BoxDecoration(
                            color: _categoryColor(cat),
                            shape: BoxShape.circle,
                          ),
                        ),
                        Expanded(
                          child: Text(
                            _categoryLabel(cat),
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ),
                        Text(
                          _money(rev),
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        if (tgt > 0)
                          Padding(
                            padding: const EdgeInsets.only(left: 8),
                            child: Text(
                              '${catPct.toStringAsFixed(0)}%',
                              style: TextStyle(
                                  color: catColor,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12),
                            ),
                          ),
                      ]),
                      if (tgt > 0) ...[
                        const SizedBox(height: 4),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: (catPct / 100).clamp(0.0, 1.0),
                            minHeight: 6,
                            backgroundColor: Colors.grey.shade200,
                            valueColor: AlwaysStoppedAnimation<Color>(catColor),
                          ),
                        ),
                      ],
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _MonthlyAdjustmentsDialog extends ConsumerStatefulWidget {
  const _MonthlyAdjustmentsDialog({required this.year, required this.month});
  final int year;
  final int month;

  @override
  ConsumerState<_MonthlyAdjustmentsDialog> createState() =>
      _MonthlyAdjustmentsDialogState();
}

class _MonthlyAdjustmentsDialogState
    extends ConsumerState<_MonthlyAdjustmentsDialog>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);

  final fields = const [
    'salaries',
    'rent',
    'electricity',
    'water',
    'nssf',
    'shif',
    'tax',
    'levy',
    'licenses',
    'subscriptions_total',
  ];
  late final Map<String, TextEditingController> controllers = {
    for (final f in fields) f: TextEditingController()
  };
  final cashFlow = TextEditingController();
  final balanceSheet = TextEditingController();
  List<Map<String, dynamic>> _subscriptionEntries = [];
  List<Map<String, dynamic>> _cashFlowEntries = [];
  List<Map<String, dynamic>> _balanceSheetEntries = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = await ref
        .read(branchAccountantRepositoryProvider)
        .getMonthlyAdjustments(year: widget.year, month: widget.month);
    if (data.isEmpty || !mounted) return;
    final first = data.first;
    for (final f in fields) {
      controllers[f]?.text = '${first[f] ?? ''}';
    }
    cashFlow.text = '${_map(first['cash_flow_data'])['notes'] ?? ''}';
    balanceSheet.text = '${_map(first['balance_sheet_data'])['notes'] ?? ''}';
    setState(() {
      _subscriptionEntries =
          _entriesFrom(_map(first['subscriptions'])['entries']);
      _cashFlowEntries = _entriesFrom(_map(first['cash_flow_data'])['entries']);
      _balanceSheetEntries =
          _entriesFrom(_map(first['balance_sheet_data'])['entries']);
      if (_subscriptionEntries.isNotEmpty) {
        controllers['subscriptions_total']?.text = _subscriptionEntries
            .fold<num>(0, (sum, item) => sum + _num(item['amount']))
            .toStringAsFixed(0);
      }
    });
  }

  @override
  void dispose() {
    _tabs.dispose();
    for (final c in controllers.values) {
      c.dispose();
    }
    cashFlow.dispose();
    balanceSheet.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final monthName =
        DateFormat('MMMM yyyy').format(DateTime(widget.year, widget.month));
    return AlertDialog(
      title: Text('Monthly Adjustments — $monthName'),
      content: SizedBox(
        width: 720,
        height: 540,
        child: Column(
          children: [
            TabBar(
              controller: _tabs,
              tabs: const [
                Tab(text: 'Fixed & Recurring Expenses'),
                Tab(text: 'Financial Statements'),
              ],
            ),
            const SizedBox(height: 12),
            Expanded(
              child: TabBarView(
                controller: _tabs,
                children: [
                  // ── Tab 1: Fixed Expenses ──────────────────────────
                  SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Wrap(
                          spacing: 12,
                          runSpacing: 12,
                          children: fields
                              .where((f) => f != 'subscriptions_total')
                              .map((field) => SizedBox(
                                    width: 200,
                                    child: TextField(
                                      controller: controllers[field],
                                      keyboardType: TextInputType.number,
                                      decoration: InputDecoration(
                                          labelText: _title(field)),
                                    ),
                                  ))
                              .toList(),
                        ),
                        const SizedBox(height: 16),
                        _LineItemEditor(
                          title: 'Subscriptions & Other Recurring',
                          entries: _subscriptionEntries,
                          columns: const ['description', 'amount'],
                          onChanged: (entries) => setState(() {
                            _subscriptionEntries = entries;
                            controllers['subscriptions_total']?.text = entries
                                .fold<num>(0,
                                    (sum, item) => sum + _num(item['amount']))
                                .toStringAsFixed(0);
                          }),
                        ),
                        const SizedBox(height: 8),
                        // Fixed expenses total
                        Builder(builder: (_) {
                          final fixedTotal = fields
                              .fold<num>(
                                  0,
                                  (sum, f) =>
                                      sum +
                                      (num.tryParse(
                                              controllers[f]?.text ?? '') ??
                                          0))
                              .toStringAsFixed(0);
                          return Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: Colors.grey.shade100,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(children: [
                              const Text('Total Fixed Expenses',
                                  style:
                                      TextStyle(fontWeight: FontWeight.w700)),
                              const Spacer(),
                              Text(
                                _money(num.tryParse(fixedTotal) ?? 0),
                                style: const TextStyle(
                                    fontWeight: FontWeight.w800, fontSize: 15),
                              ),
                            ]),
                          );
                        }),
                      ],
                    ),
                  ),

                  // ── Tab 2: Financial Statements ────────────────────
                  SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Cash Flow Statement',
                            style: TextStyle(
                                fontWeight: FontWeight.w800, fontSize: 13)),
                        const SizedBox(height: 8),
                        _LineItemEditor(
                          title: 'Cash Flow Entries',
                          entries: _cashFlowEntries,
                          columns: const ['description', 'amount'],
                          onChanged: (entries) =>
                              setState(() => _cashFlowEntries = entries),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: cashFlow,
                          minLines: 2,
                          maxLines: 4,
                          decoration: const InputDecoration(
                              labelText: 'Cash Flow Notes'),
                        ),
                        const SizedBox(height: 20),
                        const Text('Balance Sheet',
                            style: TextStyle(
                                fontWeight: FontWeight.w800, fontSize: 13)),
                        const SizedBox(height: 8),
                        _LineItemEditor(
                          title: 'Balance Sheet Entries',
                          entries: _balanceSheetEntries,
                          columns: const ['description', 'amount'],
                          onChanged: (entries) =>
                              setState(() => _balanceSheetEntries = entries),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: balanceSheet,
                          minLines: 2,
                          maxLines: 4,
                          decoration: const InputDecoration(
                              labelText: 'Balance Sheet Notes'),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel')),
        FilledButton(onPressed: _save, child: const Text('Save Adjustments')),
      ],
    );
  }

  Future<void> _save() async {
    final total = fields.fold<num>(
        0, (sum, f) => sum + (num.tryParse(controllers[f]?.text ?? '') ?? 0));
    await ref.read(branchAccountantRepositoryProvider).saveMonthlyAdjustment({
      'fiscal_year': widget.year,
      'fiscal_month': widget.month,
      for (final f in fields) f: num.tryParse(controllers[f]?.text ?? '') ?? 0,
      'subscriptions': {
        'entries': _subscriptionEntries,
        'total': _subscriptionEntries.isNotEmpty
            ? _subscriptionEntries.fold<num>(
                0, (sum, item) => sum + _num(item['amount']))
            : num.tryParse(controllers['subscriptions_total']?.text ?? '') ?? 0,
      },
      'cash_flow_data': {'entries': _cashFlowEntries, 'notes': cashFlow.text},
      'balance_sheet_data': {
        'entries': _balanceSheetEntries,
        'notes': balanceSheet.text
      },
      'total_monthly_expenses': total,
    });
    if (mounted) Navigator.pop(context, true);
  }
}

class _FlagClearanceDialog extends StatefulWidget {
  const _FlagClearanceDialog();

  @override
  State<_FlagClearanceDialog> createState() => _FlagClearanceDialogState();
}

class _FlagClearanceDialogState extends State<_FlagClearanceDialog> {
  String reason = 'cash_shortage';
  final notes = TextEditingController();
  @override
  void dispose() {
    notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Flag Clearance'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _Dropdown(
            value: reason,
            values: const [
              'cash_shortage',
              'cash_overage',
              'missing_receipts',
              'suspicious_activity',
              'other'
            ],
            onChanged: (v) => setState(() => reason = v),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: notes,
            minLines: 3,
            maxLines: 5,
            decoration: const InputDecoration(labelText: 'Notes'),
          ),
        ],
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        FilledButton(
          onPressed: () => Navigator.pop(context, {
            'reason': reason,
            'notes': notes.text,
          }),
          child: const Text('Flag'),
        ),
      ],
    );
  }
}

class _BudgetDialog extends StatefulWidget {
  const _BudgetDialog({this.existing});
  final Map<String, dynamic>? existing;

  @override
  State<_BudgetDialog> createState() => _BudgetDialogState();
}

class _BudgetDialogState extends State<_BudgetDialog> {
  // Maps field key → TextEditingController with default from existing budget
  late final Map<String, TextEditingController> controllers = {
    'name': TextEditingController(text: '${widget.existing?['name'] ?? ''}'),
    'category':
        TextEditingController(text: '${widget.existing?['category'] ?? ''}'),
    'period': TextEditingController(
        text: '${widget.existing?['period'] ?? 'monthly'}'),
    'allocated_amount': TextEditingController(
        text:
            '${widget.existing?['allocated_amount'] ?? widget.existing?['amount'] ?? ''}'),
    'start_date': TextEditingController(
        text:
            '${widget.existing?['start_date'] ?? _date(DateTime(DateTime.now().year, DateTime.now().month, 1))}'),
    'end_date': TextEditingController(
        text:
            '${widget.existing?['end_date'] ?? _date(DateTime(DateTime.now().year, DateTime.now().month + 1, 0))}'),
    'fiscal_year': TextEditingController(
        text: '${widget.existing?['fiscal_year'] ?? DateTime.now().year}'),
    'fiscal_month': TextEditingController(
        text: '${widget.existing?['fiscal_month'] ?? DateTime.now().month}'),
    'description':
        TextEditingController(text: '${widget.existing?['description'] ?? ''}'),
  };

  static const _numericFields = {
    'allocated_amount',
    'fiscal_year',
    'fiscal_month',
  };

  @override
  void dispose() {
    for (final c in controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.existing == null ? 'New Budget' : 'Edit Budget'),
      content: SizedBox(
        width: 560,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: controllers.entries
                .map((entry) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: TextField(
                        controller: entry.value,
                        keyboardType: _numericFields.contains(entry.key)
                            ? TextInputType.number
                            : TextInputType.text,
                        decoration:
                            InputDecoration(labelText: _title(entry.key)),
                      ),
                    ))
                .toList(),
          ),
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        FilledButton(
          onPressed: () => Navigator.pop(context, {
            for (final entry in controllers.entries)
              entry.key: _numericFields.contains(entry.key)
                  ? (num.tryParse(entry.value.text) ?? 0)
                  : entry.value.text,
          }),
          child: const Text('Save'),
        ),
      ],
    );
  }
}

class _DirectorTasks extends ConsumerWidget {
  const _DirectorTasks({required this.items});
  final List<Map<String, dynamic>> items;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: Colors.red.shade200),
        borderRadius: BorderRadius.circular(12),
        color: Colors.red.shade50,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(children: [
              Icon(Icons.assignment_late, color: Colors.red.shade600, size: 18),
              const SizedBox(width: 8),
              Text(
                'Director Review Tasks',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                  color: Colors.red.shade700,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.red.shade100,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '${items.length} pending',
                  style: TextStyle(
                    color: Colors.red.shade700,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ]),
          ),
          Divider(height: 1, color: Colors.red.shade200),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              children: items
                  .map((task) => _ActionCard(
                        title: _text(task, ['title']),
                        subtitle: _text(task, ['description']),
                        trailing: _StatusPill(_text(task, ['priority'])),
                        rows: {
                          'Due Date': _text(task, ['due_date']),
                          'Record Date': _text(task, ['related_record_date']),
                        },
                        actions: [
                          FilledButton(
                            onPressed: () async {
                              final notes = await _textDialog(
                                  context, 'Respond to Task',
                                  hint: 'Type your response to the Director',
                                  minLines: 4);
                              if (notes == null || notes.trim().isEmpty) {
                                return;
                              }
                              await ref
                                  .read(branchAccountantRepositoryProvider)
                                  .respondDirectorTask(
                                      '${task['id']}', notes.trim());
                              ref.invalidate(
                                  branchAccountantDirectorTasksProvider);
                              _toast('Task response submitted');
                            },
                            child: const Text('Respond'),
                          ),
                        ],
                      ))
                  .toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _Page extends StatelessWidget {
  const _Page({
    required this.title,
    required this.subtitle,
    required this.children,
    this.actions = const [],
  });

  final String title;
  final String subtitle;
  final List<Widget> actions;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async {},
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: ScreenSize.p(context),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 12,
              runSpacing: 12,
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                SizedBox(
                  width: MediaQuery.of(context).size.width < 900
                      ? double.infinity
                      : 460,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: Theme.of(context).textTheme.headlineSmall),
                      const SizedBox(height: 4),
                      Text(subtitle,
                          style:
                              const TextStyle(color: AppColors.kTextSecondary)),
                    ],
                  ),
                ),
                Wrap(spacing: 8, runSpacing: 8, children: actions),
              ],
            ),
            const SizedBox(height: 20),
            ...children.expand((w) => [w, const SizedBox(height: 16)]),
          ],
        ),
      ),
    );
  }
}

class _AsyncPane<T> extends StatelessWidget {
  const _AsyncPane({
    required this.value,
    required this.builder,
    required this.onRefresh,
  });
  final AsyncValue<T> value;
  final Widget Function(T data) builder;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return value.when(
      data: builder,
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => _ErrorPane(error: error, onRefresh: onRefresh),
    );
  }
}

class _FuturePage<T> extends StatelessWidget {
  const _FuturePage({
    required this.snapshot,
    required this.builder,
    required this.onRefresh,
  });
  final AsyncSnapshot<T> snapshot;
  final Widget Function(T data) builder;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    if (snapshot.connectionState == ConnectionState.waiting) {
      return const Center(child: CircularProgressIndicator());
    }
    if (snapshot.hasError) {
      return _ErrorPane(error: snapshot.error!, onRefresh: onRefresh);
    }
    return builder(snapshot.data as T);
  }
}

class _ErrorPane extends StatelessWidget {
  const _ErrorPane({required this.error, required this.onRefresh});
  final Object error;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Card(
        child: Padding(
          padding: ScreenSize.p(context),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 42, color: Colors.red),
              const SizedBox(height: 12),
              Text('$error', textAlign: TextAlign.center),
              const SizedBox(height: 12),
              FilledButton(onPressed: onRefresh, child: const Text('Retry')),
            ],
          ),
        ),
      ),
    );
  }
}

class _ResponsiveGrid extends StatelessWidget {
  const _ResponsiveGrid({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final fallbackWidth = MediaQuery.sizeOf(context).width;
        final width = constraints.maxWidth.isFinite
            ? constraints.maxWidth
            : fallbackWidth;
        final count = width >= 1320
            ? 6
            : width >= 1040
                ? 4
                : width >= 900
                    ? 3
                    : width >= 620
                        ? 2
                        : 1;
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: count,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            mainAxisExtent: 82,
          ),
          itemCount: children.length,
          itemBuilder: (context, index) => children[index],
        );
      },
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard(this.label, this.value, this.icon, this.color);
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(label,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: AppColors.kTextSecondary, fontSize: 12)),
                  const SizedBox(height: 2),
                  Text(value,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 17, fontWeight: FontWeight.w800)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({this.title, required this.child});
  final String? title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final hasTitle = title != null && title!.isNotEmpty;
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (hasTitle) ...[
              Text(title!,
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w800)),
              const SizedBox(height: 12),
            ],
            child,
          ],
        ),
      ),
    );
  }
}

class _CollapsibleSectionCard extends StatelessWidget {
  const _CollapsibleSectionCard({
    required this.title,
    required this.child,
    this.initiallyExpanded = false,
    this.trailing,
  });
  final String title;
  final Widget child;
  final bool initiallyExpanded;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: initiallyExpanded,
          tilePadding: const EdgeInsets.symmetric(horizontal: 18),
          childrenPadding:
              const EdgeInsets.fromLTRB(18, 0, 18, 18),
          title: Text(title,
              style:
                  const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          trailing: trailing,
          children: [
            Align(alignment: Alignment.centerLeft, child: child),
          ],
        ),
      ),
    );
  }
}

class _TwoColumn extends StatelessWidget {
  const _TwoColumn({required this.left, required this.right});
  final Widget left;
  final Widget right;

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.of(context).size.width < 900) {
      return Column(children: [left, const SizedBox(height: 16), right]);
    }
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Expanded(child: left),
      const SizedBox(width: 16),
      Expanded(child: right),
    ]);
  }
}

class _BreakdownCard extends StatelessWidget {
  const _BreakdownCard({required this.title, required this.values});
  final String title;
  final Map<String, dynamic> values;

  @override
  Widget build(BuildContext context) {
    return _SectionCard(title: title, child: _KeyValueList(values));
  }
}

class _KeyValueList extends StatelessWidget {
  const _KeyValueList(this.values);
  final Map<String, dynamic> values;

  @override
  Widget build(BuildContext context) {
    if (values.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(12),
        child: Text('No data available',
            style: TextStyle(color: AppColors.kTextSecondary)),
      );
    }
    return Column(
      children: values.entries
          .map((entry) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 7),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 3,
                      child: Text(
                        _title(entry.key),
                        softWrap: true,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Flexible(
                      flex: 4,
                      child: Text(
                        entry.value is num
                            ? _money(_num(entry.value))
                            : readableRecordValue(
                                values,
                                entry.key,
                                entry.value,
                              ),
                        textAlign: TextAlign.right,
                        softWrap: true,
                        overflow: TextOverflow.visible,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                  ],
                ),
              ))
          .toList(),
    );
  }
}

/// Compact, single-line action button for dense table action cells so several
/// buttons fit on one row without wrapping/overlapping.
class _CompactAction extends StatelessWidget {
  const _CompactAction({
    required this.label,
    required this.icon,
    required this.onPressed,
    this.filled = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    const style = ButtonStyle(
      padding: WidgetStatePropertyAll(
        EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      ),
      minimumSize: WidgetStatePropertyAll(Size(0, 34)),
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      visualDensity: VisualDensity.compact,
      textStyle: WidgetStatePropertyAll(
          TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
    );
    final child = Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 14),
      const SizedBox(width: 4),
      Text(label),
    ]);
    if (filled) {
      return FilledButton(onPressed: onPressed, style: style, child: child);
    }
    return TextButton(onPressed: onPressed, style: style, child: child);
  }
}

class _SimpleTable extends StatelessWidget {
  const _SimpleTable({required this.columns, required this.rows});
  final List<String> columns;
  final List<List<Object>> rows;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) {
      return Padding(
        padding: ScreenSize.p(context),
        child: Center(
          child: Text('No records found',
              style: TextStyle(color: AppColors.kTextSecondary)),
        ),
      );
    }
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        // Allow rows to grow so multi-button action cells don't overlap the
        // next row (default DataTable row height is too short for them).
        dataRowMinHeight: 52,
        dataRowMaxHeight: 88,
        columnSpacing: 24,
        columns: columns
            .map((column) => DataColumn(
                  label: Text(column,
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                ))
            .toList(),
        rows: rows
            .map((row) => DataRow(
                  cells: row
                      .map((cell) => DataCell(cell is Widget
                          ? cell
                          : Text('$cell',
                              overflow: TextOverflow.ellipsis, maxLines: 2)))
                      .toList(),
                ))
            .toList(),
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.title,
    required this.subtitle,
    required this.rows,
    this.trailing,
    this.actions = const [],
    this.extra,
  });
  final String title;
  final String subtitle;
  final Map<String, String> rows;
  final Widget? trailing;
  final List<Widget> actions;
  final Widget? extra;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(
            children: [
              Expanded(
                child: Text(title,
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w800)),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          if (subtitle.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(subtitle,
                style: const TextStyle(color: AppColors.kTextSecondary)),
          ],
          const SizedBox(height: 10),
          _KeyValueList(rows),
          if (extra != null) ...[
            const SizedBox(height: 10),
            extra!,
          ],
          if (actions.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(spacing: 8, children: actions),
          ],
        ]),
      ),
    );
  }
}

/// Expandable items table for a whole-bill void's `void_items` JSONB array.
/// Collapsed by default; header shows an item-count badge.
class _VoidItemsExpandable extends StatefulWidget {
  const _VoidItemsExpandable({required this.items});
  final List<Map<String, dynamic>> items;

  @override
  State<_VoidItemsExpandable> createState() => _VoidItemsExpandableState();
}

class _VoidItemsExpandableState extends State<_VoidItemsExpandable> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: () => setState(() => _expanded = !_expanded),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              children: [
                Icon(_expanded ? Icons.expand_less : Icons.expand_more,
                    size: 18, color: AppColors.kPrimary),
                const SizedBox(width: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.kPrimary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '${widget.items.length} item${widget.items.length == 1 ? '' : 's'}',
                    style: const TextStyle(
                        color: AppColors.kPrimary,
                        fontSize: 11,
                        fontWeight: FontWeight.w800),
                  ),
                ),
              ],
            ),
          ),
        ),
        if (_expanded)
          _SimpleTable(
            columns: const ['Item Name', 'Qty', 'Unit Price', 'Total'],
            rows: widget.items.map((item) {
              final qty = _num(item['quantity']);
              final unitPrice = _num(item['unit_price']);
              final total = _num(item['total_price']) > 0
                  ? _num(item['total_price'])
                  : qty * unitPrice;
              return [
                _text(item, ['name']).isEmpty
                    ? 'Item'
                    : _text(item, ['name']),
                '$qty',
                _money(unitPrice),
                _money(total),
              ];
            }).toList(),
          ),
      ],
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill(this.status);
  final String status;

  @override
  Widget build(BuildContext context) {
    final normalized = status.toUpperCase();
    final color = normalized.contains('APPROV') ||
            normalized.contains('REVIEW') ||
            normalized.contains('RESOLVED')
        ? Colors.green
        : normalized.contains('PENDING') || normalized.contains('DRAFT')
            ? Colors.orange
            : normalized.contains('FLAG') ||
                    normalized.contains('REJECT') ||
                    normalized.contains('CRITICAL')
                ? Colors.red
                : Colors.blueGrey;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Text(
        status.isEmpty ? 'UNKNOWN' : status.toUpperCase(),
        style:
            TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w800),
      ),
    );
  }
}

class _RefreshButton extends StatelessWidget {
  const _RefreshButton({required this.onPressed});
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: const Icon(Icons.refresh),
      label: const Text('Refresh'),
    );
  }
}

class _DateField extends StatelessWidget {
  const _DateField({required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 160,
      child: TextFormField(
        initialValue: value,
        decoration: const InputDecoration(
          prefixIcon: Icon(Icons.calendar_today, size: 18),
          hintText: 'YYYY-MM-DD',
        ),
        onFieldSubmitted: onChanged,
      ),
    );
  }
}

class _Dropdown extends StatelessWidget {
  const _Dropdown({
    required this.value,
    required this.values,
    required this.onChanged,
    this.labels = const {},
  });
  final String value;
  final List<String> values;
  final ValueChanged<String> onChanged;
  final Map<String, String> labels;

  @override
  Widget build(BuildContext context) {
    return DropdownButton<String>(
      value: value,
      items: values
          .map((v) => DropdownMenuItem(
                value: v,
                child: Text(labels[v] ?? _title(v)),
              ))
          .toList(),
      onChanged: (v) {
        if (v != null) onChanged(v);
      },
    );
  }
}

Future<String?> _textDialog(
  BuildContext context,
  String title, {
  String hint = '',
  int minLines = 3,
}) {
  final controller = TextEditingController();
  return showDialog<String>(
    context: context,
    builder: (_) => AlertDialog(
      title: Text(title),
      content: TextField(
        controller: controller,
        minLines: minLines,
        maxLines: minLines + 2,
        decoration: InputDecoration(hintText: hint),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        FilledButton(
          onPressed: () => Navigator.pop(context, controller.text),
          child: const Text('Submit'),
        ),
      ],
    ),
  ).whenComplete(controller.dispose);
}

Future<Map<String, dynamic>?> _formDialog(
  BuildContext context,
  String title,
  List<String> fields, {
  Map<String, String> initial = const {},
}) {
  final controllers = {
    for (final f in fields) f: TextEditingController(text: initial[f] ?? ''),
  };
  return showDialog<Map<String, dynamic>>(
    context: context,
    builder: (_) => AlertDialog(
      title: Text(title),
      content: SizedBox(
        width: 520,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: fields
              .map((f) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: TextField(
                      controller: controllers[f],
                      keyboardType:
                          f.contains('amount') ? TextInputType.number : null,
                      decoration: InputDecoration(labelText: _title(f)),
                    ),
                  ))
              .toList(),
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        FilledButton(
          onPressed: () => Navigator.pop(context, {
            for (final f in fields)
              f: f.contains('amount')
                  ? (num.tryParse(controllers[f]!.text) ?? 0)
                  : controllers[f]!.text,
          }),
          child: const Text('Save'),
        ),
      ],
    ),
  ).whenComplete(() {
    for (final c in controllers.values) {
      c.dispose();
    }
  });
}

Future<bool> _confirm(BuildContext context, String message) async {
  return await showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Confirm'),
          content: Text(message),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel')),
            FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Confirm')),
          ],
        ),
      ) ??
      false;
}

// ─────────────────── STOCK TAKE REVIEW DIALOG ────────────────────────────────

class _StockTakeReviewDialog extends StatefulWidget {
  const _StockTakeReviewDialog({
    required this.stockTake,
    required this.isApprovable,
    required this.onApprove,
    required this.onClarify,
    required this.onReject,
    required this.onReport,
    required this.repo,
  });
  final Map<String, dynamic> stockTake;
  final bool isApprovable;
  final VoidCallback onApprove;
  final VoidCallback onClarify;
  final VoidCallback onReject;
  final VoidCallback onReport;
  final dynamic repo;

  @override
  State<_StockTakeReviewDialog> createState() => _StockTakeReviewDialogState();
}

class _StockTakeReviewDialogState extends State<_StockTakeReviewDialog> {
  late Future<List<Map<String, dynamic>>> _itemsFuture;
  String _search = '';

  @override
  void initState() {
    super.initState();
    final id = '${widget.stockTake['id'] ?? ''}';
    _itemsFuture = id.isNotEmpty
        ? widget.repo.getStockTakeItems(id) as Future<List<Map<String, dynamic>>>
        : Future.value(<Map<String, dynamic>>[]);
  }

  Color _varianceColor(num v) {
    if (v == 0) return Colors.green.shade700;
    if (v < 0) return Colors.red.shade700;
    return Colors.orange.shade700;
  }

  String _fmt(dynamic v) {
    if (v == null) return '—';
    final n = num.tryParse('$v');
    if (n == null) return '$v';
    return n == n.truncate() ? n.toInt().toString() : n.toStringAsFixed(2);
  }

  @override
  Widget build(BuildContext context) {
    final st = widget.stockTake;
    final status = '${st['status'] ?? ''}';
    final date = '${st['count_date'] ?? st['created_at'] ?? ''}';
    final storeType = '${st['store_type'] ?? ''}';
    final branchName = _text(_map(st['branch']), ['name']);
    final countType = '${st['count_type'] ?? st['take_type'] ?? 'daily'}';

    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      child: SizedBox(
        width: 1100,
        height: MediaQuery.of(context).size.height * 0.88,
        child: Column(
          children: [
            // ── Header bar ──
            Container(
              padding: const EdgeInsets.fromLTRB(24, 20, 16, 20),
              decoration: BoxDecoration(
                color: Colors.indigo.shade700,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.inventory_2, color: Colors.white, size: 22),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Stock Take Review',
                            style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
                        Text('$branchName  •  $date  •  ${countType.toUpperCase()}  •  ${storeType.toUpperCase()}',
                            style: TextStyle(color: Colors.white.withAlpha(200), fontSize: 12)),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _statusColor(status).withAlpha(60),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: _statusColor(status)),
                    ),
                    child: Text(
                      status.toUpperCase().replaceAll('_', ' '),
                      style: TextStyle(color: _statusColor(status), fontSize: 11, fontWeight: FontWeight.w700),
                    ),
                  ),
                  const SizedBox(width: 12),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close, color: Colors.white),
                  ),
                ],
              ),
            ),

            // ── Summary chips ──
            FutureBuilder<List<Map<String, dynamic>>>(
              future: _itemsFuture,
              builder: (_, snap) {
                final loaded = snap.data ?? [];
                final total = loaded.length;
                final counted = loaded.where((i) => i['physical_quantity'] != null).length;
                final withVariance = loaded.where((i) {
                  final v = num.tryParse('${i['variance'] ?? ''}') ?? 0;
                  return v != 0;
                }).length;
                final totalVariance = loaded.fold<num>(0, (s, i) {
                  return s + (num.tryParse('${i['variance_value'] ?? i['variance'] ?? ''}') ?? 0);
                });
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
                  color: Colors.indigo.shade50,
                  child: Row(
                    children: [
                      _ReviewStat('Total Items', '$total', Icons.list_alt, Colors.indigo),
                      const SizedBox(width: 16),
                      _ReviewStat('Counted', '$counted', Icons.check_circle_outline, Colors.teal),
                      const SizedBox(width: 16),
                      _ReviewStat('With Variance', '$withVariance', Icons.swap_vert, Colors.orange),
                      const SizedBox(width: 16),
                      _ReviewStat('Variance Value', 'KES ${totalVariance.toStringAsFixed(0)}',
                          Icons.trending_down, totalVariance < 0 ? Colors.red : Colors.green),
                      const Spacer(),
                      SizedBox(
                        width: 220,
                        height: 36,
                        child: TextField(
                          decoration: InputDecoration(
                            hintText: 'Search items…',
                            prefixIcon: const Icon(Icons.search, size: 18),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 0),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                            isDense: true,
                          ),
                          onChanged: (v) => setState(() => _search = v.toLowerCase()),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),

            // ── Items table ──
            Expanded(
              child: FutureBuilder<List<Map<String, dynamic>>>(
                future: _itemsFuture,
                builder: (_, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snap.hasError) {
                    return Center(child: Text('Error loading items: ${snap.error}',
                        style: const TextStyle(color: Colors.red)));
                  }
                  final all = snap.data ?? [];
                  final filtered = _search.isEmpty
                      ? all
                      : all.where((i) {
                          final name = '${i['item_name'] ?? i['name'] ?? i['item_sku'] ?? ''}'.toLowerCase();
                          final sku = '${i['item_sku'] ?? ''}'.toLowerCase();
                          return name.contains(_search) || sku.contains(_search);
                        }).toList();

                  if (filtered.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.inbox, size: 48, color: Colors.grey.shade300),
                          const SizedBox(height: 8),
                          Text(all.isEmpty ? 'No items in this stock take.' : 'No items match search.',
                              style: TextStyle(color: Colors.grey.shade500)),
                        ],
                      ),
                    );
                  }

                  return SingleChildScrollView(
                    child: Column(
                      children: [
                        // Table header
                        Container(
                          color: Colors.grey.shade100,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          child: Row(
                            children: const [
                              Expanded(flex: 3, child: Text('Item', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12))),
                              SizedBox(width: 130, child: Text('SKU', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12))),
                              SizedBox(width: 80, child: Text('Unit', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12))),
                              SizedBox(width: 90, child: Text('System Qty', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12))),
                              SizedBox(width: 90, child: Text('Counted', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12))),
                              SizedBox(width: 80, child: Text('Variance', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12))),
                              Expanded(flex: 2, child: Text('Reason / Notes', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12))),
                            ],
                          ),
                        ),
                        const Divider(height: 1),
                        ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) => Divider(height: 1, color: Colors.grey.shade100),
                          itemBuilder: (_, i) {
                            final item = filtered[i];
                            final systemQty = num.tryParse('${item['system_quantity'] ?? item['system_closing_stock'] ?? ''}') ?? 0;
                            final countedQty = item['physical_quantity'] ?? item['counted_quantity'];
                            final variance = num.tryParse('${item['variance'] ?? ''}');
                            final varianceCalc = countedQty != null
                                ? (num.tryParse('$countedQty') ?? 0) - systemQty
                                : null;
                            final effectiveVariance = variance ?? varianceCalc;
                            final reason = '${item['variance_reason'] ?? item['reason'] ?? item['notes'] ?? ''}';

                            final isMissing = countedQty == null;
                            final isVariance = effectiveVariance != null && effectiveVariance != 0;

                            return Container(
                              color: isMissing
                                  ? Colors.grey.shade50
                                  : isVariance
                                      ? (effectiveVariance < 0 ? Colors.red.shade50 : Colors.orange.shade50)
                                      : (i.isEven ? Colors.white : Colors.grey.shade50),
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                              child: Row(
                                children: [
                                  Expanded(
                                    flex: 3,
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          '${item['item_name'] ?? item['name'] ?? item['item_sku'] ?? ''}',
                                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                        ),
                                        if ((item['category'] ?? '').toString().isNotEmpty)
                                          Text('${item['category']}',
                                              style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
                                      ],
                                    ),
                                  ),
                                  SizedBox(
                                    width: 130,
                                    child: Text('${item['item_sku'] ?? ''}',
                                        style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                  ),
                                  SizedBox(
                                    width: 80,
                                    child: Text(
                                        '${item['unit_of_measure'] ?? item['unit'] ?? ''}',
                                        style: const TextStyle(fontSize: 12)),
                                  ),
                                  SizedBox(
                                    width: 90,
                                    child: Text(_fmt(systemQty),
                                        textAlign: TextAlign.center,
                                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                                  ),
                                  SizedBox(
                                    width: 90,
                                    child: isMissing
                                        ? Center(
                                            child: Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                  color: Colors.grey.shade200,
                                                  borderRadius: BorderRadius.circular(4)),
                                              child: const Text('NOT YET',
                                                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Colors.grey)),
                                            ),
                                          )
                                        : Text(_fmt(countedQty),
                                            textAlign: TextAlign.center,
                                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                                  ),
                                  SizedBox(
                                    width: 80,
                                    child: effectiveVariance == null
                                        ? const SizedBox.shrink()
                                        : Center(
                                            child: Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                                              decoration: BoxDecoration(
                                                color: effectiveVariance == 0
                                                    ? Colors.green.shade50
                                                    : effectiveVariance < 0
                                                        ? Colors.red.shade100
                                                        : Colors.orange.shade100,
                                                borderRadius: BorderRadius.circular(4),
                                              ),
                                              child: Text(
                                                effectiveVariance == 0
                                                    ? '✓ 0'
                                                    : '${effectiveVariance > 0 ? '+' : ''}${_fmt(effectiveVariance)}',
                                                textAlign: TextAlign.center,
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w700,
                                                  color: _varianceColor(effectiveVariance),
                                                ),
                                              ),
                                            ),
                                          ),
                                  ),
                                  Expanded(
                                    flex: 2,
                                    child: reason.isNotEmpty
                                        ? Text(reason,
                                            style: const TextStyle(fontSize: 12, color: Colors.black87),
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis)
                                        : (isVariance
                                            ? Text('No reason provided',
                                                style: TextStyle(fontSize: 11, color: Colors.red.shade400, fontStyle: FontStyle.italic))
                                            : const SizedBox.shrink()),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),

            // ── Action bar ──
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: Colors.grey.shade200)),
                color: Colors.grey.shade50,
              ),
              child: Row(
                children: [
                  OutlinedButton.icon(
                    onPressed: widget.onReport,
                    icon: const Icon(Icons.download, size: 16),
                    label: const Text('Download Report'),
                  ),
                  const Spacer(),
                  if (widget.isApprovable) ...[
                    TextButton(
                      onPressed: widget.onReject,
                      style: TextButton.styleFrom(foregroundColor: Colors.red.shade700),
                      child: const Text('Reject'),
                    ),
                    const SizedBox(width: 8),
                    OutlinedButton(
                      onPressed: widget.onClarify,
                      child: const Text('Request Clarification'),
                    ),
                    const SizedBox(width: 8),
                    FilledButton.icon(
                      onPressed: widget.onApprove,
                      icon: const Icon(Icons.verified, size: 16),
                      label: const Text('Approve & Forward to Auditor'),
                      style: FilledButton.styleFrom(backgroundColor: Colors.green.shade600),
                    ),
                  ] else
                    Text(
                      status.toLowerCase() == 'accountant_approved'
                          ? 'Approved — awaiting auditor final review'
                          : status.toLowerCase() == 'draft'
                              ? 'Draft — storekeeper has not yet submitted'
                              : 'No actions available for status: ${status.replaceAll('_', ' ')}',
                      style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'submitted':
      case 'submitted_to_accountant':
        return Colors.orange;
      case 'accountant_approved':
        return Colors.green;
      case 'accountant_rejected':
        return Colors.red;
      case 'draft':
        return Colors.grey;
      default:
        return Colors.blue;
    }
  }
}

class _ReviewStat extends StatelessWidget {
  const _ReviewStat(this.label, this.value, this.icon, this.color);
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 6),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(fontSize: 10, color: Colors.grey.shade600)),
            Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color)),
          ],
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

void _showRecord(BuildContext context, Map<String, dynamic> record,
    {String title = 'Record Details'}) {
  openRecordDetailScreen(
    context,
    title: title,
    record: record,
  );
}

dynamic _firstRaw(Map<String, dynamic> row, List<String> keys) {
  for (final key in keys) {
    final value = row[key];
    if (value != null && '$value'.trim().isNotEmpty && '$value' != 'null') {
      return value;
    }
  }
  return null;
}

String _firstTextFrom(
  Map<String, dynamic> row,
  List<String> keys, {
  String fallback = '',
}) {
  final value = _firstRaw(row, keys);
  if (value == null) return fallback;
  if (value is Map) return readableMapName(value) ?? fallback;
  if (value is List) return value.isEmpty ? fallback : readableListValue(value);
  return '$value'.trim().isEmpty ? fallback : '$value';
}

num _firstNumFrom(Map<String, dynamic> row, List<String> keys) {
  for (final key in keys) {
    final value = row[key];
    final parsed = _num(value);
    if (parsed != 0 || value == 0 || value == '0') return parsed;
  }
  return 0;
}

num _firstNonZeroNum(Iterable<dynamic> values) {
  for (final value in values) {
    final parsed = _num(value);
    if (parsed != 0) return parsed;
  }
  return 0;
}

bool _isPendingClearance(Map<String, dynamic> row) {
  final status = _text(row, ['status', 'clearance_status']).toLowerCase();
  return status.isEmpty ||
      status.contains('pending') ||
      status.contains('open') ||
      status.contains('review') ||
      status.contains('submitted');
}

bool _isOpenDiscrepancy(Map<String, dynamic> row) {
  final status = _text(row, [
    'status',
    'resolution_status',
    'approval_status',
    'audit_status',
  ]).toLowerCase();
  if (status.isEmpty) return true;
  const closedStatuses = {
    'approved',
    'closed',
    'cleared',
    'completed',
    'rejected',
    'resolved',
    'reviewed',
    'voided',
  };
  return !closedStatuses.contains(status);
}

String _paymentSourceLabel(Map<String, dynamic> payment) {
  switch (_text(payment, ['_source', 'source']).toLowerCase()) {
    case 'banking':
      return 'Banking';
    case 'pos':
      return 'POS';
    case 'payment':
      return 'Cashier';
    case 'payment_verification':
      return 'Verified';
    default:
      return 'Manual';
  }
}

String _paymentStatusLabel(String status) {
  switch (status.toLowerCase()) {
    case 'pending':
      return 'Pending';
    case 'accountant_verified':
      return 'Awaiting Auditor';
    case 'auditor_verified':
      return 'Approved';
    case 'flagged':
      return 'Flagged';
    default:
      return status.isEmpty ? 'Pending' : _title(status);
  }
}

String _paymentDescription(Map<String, dynamic> payment) {
  if (_text(payment, ['_source']) == 'banking') {
    final type = _text(payment, ['_banking_type', 'transaction_type']);
    final bank = _text(payment, ['_bank_name', 'bank_name']);
    final text = [type, bank].where((part) => part.isNotEmpty).join(' - ');
    if (text.isNotEmpty) return text;
  }
  return _text(payment, [
    'customer_name',
    'description',
    'notes',
    'recorder_notes',
    'bill_reference',
  ]).isEmpty
      ? 'N/A'
      : _text(payment, [
          'customer_name',
          'description',
          'notes',
          'recorder_notes',
          'bill_reference',
        ]);
}

String _paymentRecordedBy(Map<String, dynamic> payment) {
  final user = _map(payment['recorded_by_user']);
  final name = _text(user, ['full_name', 'name']);
  if (name.isNotEmpty) return name;
  return _text(payment, ['recorded_by']).isEmpty
      ? '-'
      : _text(payment, ['recorded_by']);
}

String _paymentReference(Map<String, dynamic> payment) {
  // Prefer structured order/bill reference over raw IDs
  final billRef = _text(payment, ['bill_reference']);
  if (billRef.isNotEmpty) return billRef;

  final ref = _text(payment, ['reference_number', 'reference']);
  if (ref.isEmpty) return '-';

  // UUID → show first 8 hex chars uppercase (e.g. "C09D5CF7")
  final uuidRe = RegExp(
      r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
      caseSensitive: false);
  if (uuidRe.hasMatch(ref)) return ref.substring(0, 8).toUpperCase();

  // cash-<epoch ms> → "CASH-<date>" e.g. "CASH-20260615"
  final cashRe = RegExp(r'^cash-(\d{10,13})$', caseSensitive: false);
  final cashMatch = cashRe.firstMatch(ref);
  if (cashMatch != null) {
    final ms = int.tryParse(cashMatch.group(1)!);
    if (ms != null) {
      final epoch = ms > 9999999999 ? ms : ms * 1000;
      final dt = DateTime.fromMillisecondsSinceEpoch(epoch);
      final dateStr =
          '${dt.year}${dt.month.toString().padLeft(2, '0')}${dt.day.toString().padLeft(2, '0')}';
      return 'CASH-$dateStr';
    }
  }

  return ref;
}

IconData _icon(BranchAccountantSection section) =>
    _navItems.firstWhere((item) => item.section == section).icon;

String _label(BranchAccountantSection section) =>
    _navItems.firstWhere((item) => item.section == section).label;

String _shortLabel(BranchAccountantSection section) {
  switch (section) {
    case BranchAccountantSection.cashierClearance:
      return 'Cashier';
    case BranchAccountantSection.discrepancies:
      return 'Flags';
    case BranchAccountantSection.shiftOpenings:
      return 'Openings';
    case BranchAccountantSection.shiftReview:
      return 'Shifts';
    case BranchAccountantSection.cashierLogbooks:
      return 'Logs';
    case BranchAccountantSection.voidApprovals:
      return 'Voids';
    case BranchAccountantSection.creditBills:
      return 'Credit';
    case BranchAccountantSection.foodVariance:
      return 'Variance';
    case BranchAccountantSection.shiftPnl:
      return 'P&L';
    case BranchAccountantSection.inventoryJournals:
      return 'Journals';
    case BranchAccountantSection.supplierFinance:
      return 'Suppliers';
    case BranchAccountantSection.payrollPolicies:
      return 'Policies';
    case BranchAccountantSection.payrollAdjustments:
      return 'Adjustments';
    case BranchAccountantSection.budgets:
      return 'Budgets';
    default:
      return _label(section);
  }
}

Map<String, dynamic> _map(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return {};
}

List<Map<String, dynamic>> _entriesFrom(dynamic value) {
  if (value is List) {
    return value
        .whereType<Map>()
        .map((entry) => Map<String, dynamic>.from(entry))
        .toList();
  }
  return [];
}

List<Map<String, dynamic>> _list(dynamic value) {
  var data = value is Map
      ? value['data'] ?? value['items'] ?? value['records'] ?? value['analysis']
      : value;
  if (data is Map) {
    data = data['data'] ??
        data['items'] ??
        data['records'] ??
        data['rows'] ??
        data['results'] ??
        data['clearances'] ??
        data['logbooks'] ??
        data['transactions'] ??
        data['invoices'] ??
        data['payments'] ??
        data['purchase_orders'] ??
        data['purchaseOrders'] ??
        data['stock_takes'] ??
        data['stockTakes'];
  }
  if (data is List) {
    return data
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }
  return [];
}

String _text(Map<String, dynamic> item, List<String> keys) {
  for (final key in keys) {
    final value = item[key];
    if (value != null && '$value'.trim().isNotEmpty && '$value' != 'null') {
      return '$value';
    }
  }
  return '';
}

num _num(dynamic value) {
  if (value is num) return value;
  return num.tryParse('$value') ?? 0;
}

num _sum(List<Map<String, dynamic>> items, String key) =>
    items.fold<num>(0, (sum, item) => sum + _num(item[key]));

num _staffOutstandingCreditBills(Map<String, dynamic> row) {
  final explicit = row['outstanding_credit_bills'];
  if (explicit != null) return _num(explicit);
  return _num(row['total_credit_bills']);
}

num _staffOutstandingAdvances(Map<String, dynamic> row) {
  final explicit = row['outstanding_advances'];
  if (explicit != null) return _num(explicit);
  return _num(row['total_advances']);
}

num _staffOutstandingLoans(Map<String, dynamic> row) {
  final explicit = row['outstanding_loans'];
  if (explicit != null) return _num(explicit);
  return _num(row['total_loans']);
}

num _staffSalary(Map<String, dynamic> row) {
  for (final key in const [
    'salary',
    'basic_salary',
    'base_salary',
    'monthly_salary',
    'gross_salary',
    'gross_pay',
    'payroll_basic_salary',
    'net_pay',
    'net_salary',
  ]) {
    final value = _num(row[key]);
    if (value > 0) return value;
  }
  final staff = row['staff'];
  if (staff is Map) {
    return _staffSalary(Map<String, dynamic>.from(staff));
  }
  final original = row['original_record'];
  if (original is Map) {
    return _staffSalary(Map<String, dynamic>.from(original));
  }
  return 0;
}

String _staffNationalId(Map<String, dynamic> row) {
  final direct = _text(row, const [
    'national_id',
    'staff_national_id',
    'id_number',
    'identity_number',
    'nationalId',
  ]);
  if (direct.isNotEmpty && direct.toLowerCase() != 'pending') return direct;
  final staff = row['staff'];
  if (staff is Map) {
    final nested = _staffNationalId(Map<String, dynamic>.from(staff));
    if (nested.isNotEmpty) return nested;
  }
  final original = row['original_record'];
  if (original is Map) {
    final nested = _staffNationalId(Map<String, dynamic>.from(original));
    if (nested.isNotEmpty) return nested;
  }
  return direct;
}

String _staffEmployeeId(Map<String, dynamic> row) {
  // employee_number / employee_id / staff_code = Employee Number (EMP001, etc.)
  // id_number and national_id are the National ID — never use them here.
  final direct = _text(row, const [
    'employee_number',
    'employee_id',
    'staff_code',
    'employee_code',
  ]);
  if (direct.isNotEmpty) return direct;
  final staff = row['staff'];
  if (staff is Map) {
    return _staffEmployeeId(Map<String, dynamic>.from(staff));
  }
  final original = row['original_record'];
  if (original is Map) {
    return _staffEmployeeId(Map<String, dynamic>.from(original));
  }
  return '';
}

num _staffNetPayable(Map<String, dynamic> row) {
  final explicit = row['net_payable'];
  if (explicit != null) return _num(explicit);
  final deductions = _num(row['outstanding_balance']) > 0
      ? _num(row['outstanding_balance'])
      : _staffOutstandingCreditBills(row) +
          _staffOutstandingAdvances(row) +
          _staffOutstandingLoans(row) +
          _num(row['total_unpaid_bills']);
  return (_staffSalary(row) - deductions).clamp(0, double.infinity);
}

String _money(num value) => NumberFormat.currency(
      locale: 'en_KE',
      symbol: 'KES ',
      decimalDigits: 0,
    ).format(value);

String _date(DateTime value) =>
    '${value.year}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';

String _today() => _date(DateTime.now());

String _shortDate(String value) {
  final parsed = DateTime.tryParse(value);
  if (parsed == null) return value;
  return DateFormat('MMM d').format(parsed);
}

// Kenya has a fixed UTC+3 offset with no DST, so bill/credit timestamps are
// converted with a plain offset rather than DateTime.toLocal() — the
// device's own timezone can't be trusted to be Kenya time.
DateTime _toKenyaTime(DateTime value) =>
    value.toUtc().add(const Duration(hours: 3));

String _formatCompactDateTime(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty || trimmed == 'null') return '-';
  final parsed = DateTime.tryParse(trimmed);
  if (parsed == null) return trimmed;
  return DateFormat('MMM d HH:mm').format(_toKenyaTime(parsed));
}

String _title(String value) => value
    .replaceAll('_', ' ')
    .split(' ')
    .where((part) => part.isNotEmpty)
    .map((part) => part[0].toUpperCase() + part.substring(1))
    .join(' ');

double _maxTransactions(List<Map<String, dynamic>> rows) {
  final max = rows.fold<num>(0, (value, row) {
    final tx = _num(row['transaction_count']);
    return tx > value ? tx : value;
  });
  return max <= 0 ? 1 : max.toDouble();
}

String _paymentLabel(String value) {
  const labels = {
    'cash': 'Cash',
    'card': 'Card',
    'mpesa': 'M-Pesa',
    'mixed': 'Mixed',
    'credit_bill': 'Credit Bill',
  };
  return labels[value.toLowerCase()] ?? _title(value);
}

String _categoryLabel(String value) {
  const labels = {
    'rooms': 'Rooms',
    'restaurant': 'Restaurant',
    'bar': 'Bar',
    'spa': 'Spa',
    'conference': 'Conference',
    'dynamic_services': 'Other Services',
    'carwash': 'Car Wash',
  };
  return labels[value.toLowerCase()] ?? _title(value);
}

Color _categoryColor(String value) {
  const colors = {
    'rooms': Color(0xFF3B82F6),
    'restaurant': Color(0xFF10B981),
    'bar': Color(0xFFF59E0B),
    'spa': Color(0xFF8B5CF6),
    'conference': Color(0xFFEC4899),
    'dynamic_services': Color(0xFF6B7280),
    'carwash': Color(0xFF14B8A6),
  };
  return colors[value.toLowerCase()] ?? Colors.blueGrey;
}

String _pdfSafe(Object? value) {
  if (value == null) return '';
  return '$value'
      .replaceAll('\u2013', '-')
      .replaceAll('\u2014', '-')
      .replaceAll('\u2212', '-')
      .replaceAll('\u2026', '...')
      .replaceAll('\u2022', '-')
      .replaceAll('\u00a0', ' ')
      .replaceAll('\u00a9', '(c)')
      .replaceAll('\u2018', "'")
      .replaceAll('\u2019', "'")
      .replaceAll('\u201c', '"')
      .replaceAll('\u201d', '"')
      .replaceAll(RegExp(r'[^\x09\x0A\x0D\x20-\x7E]'), '?');
}

Future<File> _exportPdf({
  required String filename,
  required String title,
  required String subtitle,
  Map<String, String> metrics = const {},
  Map<String, Map<String, dynamic>> sections = const {},
  List<String> tableHeaders = const [],
  List<List<String>> tableRows = const [],
}) async {
  final doc = pw.Document();
  final generated = DateFormat('MMM d, yyyy HH:mm').format(DateTime.now());
  final safeTitle = _pdfSafe(title);
  final safeSubtitle = _pdfSafe(subtitle);
  final safeMetrics = metrics.map(
    (key, value) => MapEntry(_pdfSafe(key), _pdfSafe(value)),
  );
  final safeSections = sections.map(
    (section, values) => MapEntry(
      _pdfSafe(section),
      values.map((key, value) => MapEntry(_pdfSafe(key), value)),
    ),
  );
  final safeTableHeaders = tableHeaders.map(_pdfSafe).toList();
  final safeTableRows = tableRows
      .map((row) => row.map(_pdfSafe).toList(growable: false))
      .toList(growable: false);
  final logo = await _loadPdfLogo();
  const primary = PdfColor.fromInt(0xFF1A1A1A);
  const secondary = PdfColor.fromInt(0xFF555555);
  const border = PdfColor.fromInt(0xFFE0E0E0);
  const rowBg = PdfColor.fromInt(0xFFF9F9F9);
  const headerBg = PdfColor.fromInt(0xFF333333);
  const gold = PdfColor.fromInt(0xFFC8A84B);

  doc.addPage(
    pw.MultiPage(
      pageFormat: PdfPageFormat.a4.landscape,
      margin: const pw.EdgeInsets.fromLTRB(32, 28, 32, 30),
      build: (context) => [
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Container(
              width: 58,
              height: 58,
              alignment: pw.Alignment.center,
              decoration: pw.BoxDecoration(
                border: pw.Border.all(color: border),
                borderRadius: pw.BorderRadius.circular(4),
              ),
              child: logo == null
                  ? pw.Text(
                      'FG',
                      style: pw.TextStyle(
                        color: primary,
                        fontSize: 18,
                        fontWeight: pw.FontWeight.bold,
                      ),
                    )
                  : pw.Image(logo, fit: pw.BoxFit.contain),
            ),
            pw.SizedBox(width: 14),
            pw.Expanded(
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    'FamousGateHotels',
                    style: pw.TextStyle(
                      color: primary,
                      fontSize: 16,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                  pw.SizedBox(height: 4),
                  pw.Text('Bomet, Kenya',
                      style: const pw.TextStyle(color: secondary, fontSize: 9)),
                  pw.Text('Email: famousgateshotelsbmt@gmail.com',
                      style: const pw.TextStyle(color: secondary, fontSize: 9)),
                  pw.Text('Tel: 0706 782 828',
                      style: const pw.TextStyle(color: secondary, fontSize: 9)),
                ],
              ),
            ),
            pw.SizedBox(width: 18),
            pw.Container(
              width: 310,
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text(
                    safeTitle,
                    textAlign: pw.TextAlign.right,
                    style: pw.TextStyle(
                      color: primary,
                      fontSize: 18,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                  pw.SizedBox(height: 5),
                  pw.Text(safeSubtitle,
                      textAlign: pw.TextAlign.right,
                      style: const pw.TextStyle(color: secondary, fontSize: 9)),
                  pw.Text('Generated: $generated',
                      style: const pw.TextStyle(color: secondary, fontSize: 8)),
                ],
              ),
            ),
          ],
        ),
        pw.SizedBox(height: 12),
        pw.Container(height: 1, color: border),
        pw.Container(height: 3, color: gold),
        if (safeMetrics.isNotEmpty) ...[
          pw.SizedBox(height: 12),
          pw.Wrap(
            spacing: 10,
            runSpacing: 10,
            children: safeMetrics.entries
                .map(
                  (entry) => pw.Container(
                    width: 170,
                    padding: const pw.EdgeInsets.symmetric(
                        horizontal: 9, vertical: 8),
                    decoration: pw.BoxDecoration(
                      color: PdfColors.white,
                      border: pw.Border.all(color: border),
                      borderRadius: pw.BorderRadius.circular(4),
                    ),
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text(entry.key,
                            style: const pw.TextStyle(
                                fontSize: 8, color: secondary)),
                        pw.SizedBox(height: 3),
                        pw.Text(entry.value,
                            style: pw.TextStyle(
                                color: primary,
                                fontSize: 11,
                                fontWeight: pw.FontWeight.bold)),
                      ],
                    ),
                  ),
                )
                .toList(),
          ),
        ],
        for (final section in safeSections.entries) ...[
          pw.SizedBox(height: 16),
          pw.Text(section.key,
              style: pw.TextStyle(
                  color: primary,
                  fontSize: 13,
                  fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 6),
          pw.TableHelper.fromTextArray(
            headers: const ['Item', 'Value'],
            data: section.value.entries
                .map((entry) => [
                      _title(entry.key),
                      entry.value is num
                          ? _money(_num(entry.value))
                          : _pdfSafe(entry.value)
                    ])
                .toList(),
            headerStyle: pw.TextStyle(
                color: PdfColors.white,
                fontSize: 8,
                fontWeight: pw.FontWeight.bold),
            headerDecoration: const pw.BoxDecoration(color: headerBg),
            oddRowDecoration: const pw.BoxDecoration(color: rowBg),
            cellStyle: const pw.TextStyle(fontSize: 8.5, color: primary),
            border: const pw.TableBorder(
              horizontalInside: pw.BorderSide(color: border, width: .35),
              bottom: pw.BorderSide(color: border, width: .5),
            ),
          ),
        ],
        if (safeTableHeaders.isNotEmpty) ...[
          pw.SizedBox(height: 16),
          pw.TableHelper.fromTextArray(
            headers: safeTableHeaders,
            data: safeTableRows,
            headerStyle: pw.TextStyle(
                color: PdfColors.white,
                fontSize: 7.5,
                fontWeight: pw.FontWeight.bold),
            headerDecoration: const pw.BoxDecoration(color: headerBg),
            oddRowDecoration: const pw.BoxDecoration(color: rowBg),
            cellStyle: const pw.TextStyle(fontSize: 7.5, color: primary),
            cellAlignment: pw.Alignment.centerLeft,
            border: const pw.TableBorder(
              horizontalInside: pw.BorderSide(color: border, width: .3),
              bottom: pw.BorderSide(color: border, width: .5),
            ),
          ),
        ],
      ],
      footer: (context) => pw.Column(
        mainAxisSize: pw.MainAxisSize.min,
        children: [
          pw.Container(height: .5, color: border),
          pw.SizedBox(height: 6),
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text(
                'Generated: $generated | FamousGateHotels - Confidential',
                style: const pw.TextStyle(fontSize: 7.5, color: secondary),
              ),
              pw.Text(
                'Page ${context.pageNumber} of ${context.pagesCount}',
                style: const pw.TextStyle(fontSize: 7.5, color: secondary),
              ),
            ],
          ),
        ],
      ),
    ),
  );

  final directory =
      await getDownloadsDirectory() ?? await getApplicationDocumentsDirectory();
  final safeName = filename.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
  final file = File('${directory.path}/$safeName');
  await file.writeAsBytes(await doc.save(), flush: true);
  return file;
}

Future<pw.MemoryImage?> _loadPdfLogo() async {
  try {
    final data = await rootBundle.load('assets/frontend_public/fglogo.png');
    return pw.MemoryImage(data.buffer.asUint8List());
  } catch (_) {
    return null;
  }
}

void _notify(BuildContext context, String message) {
  Clipboard.setData(ClipboardData(text: message));
  AppNotifier.showSnackBar(
    context,
    SnackBar(content: Text(message)),
  );
}

void _toast(String message) {
  Clipboard.setData(ClipboardData(text: message));
}

// ── Outbound branch payments (essentials / vendors / payouts) ────────────────
String _txt(Map<String, dynamic> m, List<String> keys, [String fallback = '']) {
  final v = _text(m, keys);
  return v.isEmpty ? fallback : v;
}

const _payCategories = {
  'vendor': 'Vendor / Supplier',
  'petty_cash': 'Petty Cash',
  'inter_branch': 'Inter-Branch Transfer',
  'staff_payout': 'Staff Payout',
  'utility': 'Utilities',
  'other': 'Other',
};
const _payMethods = {
  'eft': 'EFT',
  'rtgs': 'RTGS',
  'cheque': 'Cheque',
  'mpesa': 'M-Pesa',
  'bank': 'Bank Transfer',
  'cash': 'Cash',
  'wallet': 'Digital Wallet',
};

class _OutboundPaymentsSection extends ConsumerStatefulWidget {
  const _OutboundPaymentsSection({this.preload, this.onPreloadConsumed});

  /// Pre-filled data from Supplier Finance Pay button.
  final Map<String, dynamic>? preload;

  /// Called once the preload dialog has been opened so the parent can clear it.
  final VoidCallback? onPreloadConsumed;

  @override
  ConsumerState<_OutboundPaymentsSection> createState() =>
      _OutboundPaymentsSectionState();
}

class _OutboundPaymentsSectionState
    extends ConsumerState<_OutboundPaymentsSection> {
  String _status = 'all';
  String _search = '';
  String _sourceTab = 'all'; // 'all' | 'po_auto' | 'manual'
  final _searchCtrl = TextEditingController();
  late Future<Map<String, dynamic>> _future = _load();

  // GRN ids paid in this session — removed optimistically before refresh completes
  final Set<String> _paidGrnIds = {};

  @override
  void initState() {
    super.initState();
    // If preload was passed, auto-open the payment dialog after first frame.
    if (widget.preload != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _openPreloadedPayment();
      });
    }
  }

  Future<void> _openPreloadedPayment() async {
    final preload = widget.preload;
    if (preload == null) return;
    widget.onPreloadConsumed?.call();
    final grnId = preload['grn_id']?.toString();
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _NewPaymentDialog(
        initialPayee: preload['payee_name']?.toString() ?? '',
        initialAmount: (preload['amount'] as num?) ?? 0,
        reference: preload['reference']?.toString() ?? '',
        grnId: grnId,
        poId: preload['po_id']?.toString(),
        supplierName: preload['supplier_name']?.toString() ?? '',
        supplierId: preload['supplier_id']?.toString() ?? '',
        invoiceId: preload['invoice_id']?.toString(),
      ),
    );
    if (saved == true) {
      if (grnId != null && grnId.isNotEmpty) {
        setState(() => _paidGrnIds.add(grnId));
      }
      _refresh();
    }
  }

  Future<Map<String, dynamic>> _load() async {
    final repo = ref.read(branchAccountantRepositoryProvider);
    final res = await repo.getOutboundPayments(status: _status);
    try {
      if (_status == 'all' || _status == 'pending') {
        res['unbilled_grns'] = await repo.getReadyToBillGRNs();
      } else {
        res['unbilled_grns'] = [];
      }
    } catch (_) {
      res['unbilled_grns'] = [];
    }
    return res;
  }

  void _refresh() {
    final next = _load();
    // Once the fresh data arrives, optimistic removals are no longer needed.
    next.then((_) { if (mounted) setState(() => _paidGrnIds.clear()); },
        onError: (_) {});
    setState(() => _future = next);
  }

  String get _role =>
      (ref.read(authNotifierProvider).valueOrNull?.role ?? '').toLowerCase();
  String get _uid => ref.read(authNotifierProvider).valueOrNull?.id ?? '';
  bool get _canApprove => const [
        'branch_manager',
        'general_manager',
        'finance_manager',
        'director',
        'super_admin'
      ].contains(_role);
  bool get _canDirector => const ['director', 'super_admin'].contains(_role);
  bool get _canRelease => const [
        'finance_manager',
        'director',
        'general_manager',
        'super_admin'
      ].contains(_role);
  bool get _canInitiate =>
      const ['branch_accountant', 'accountant', 'super_admin'].contains(_role);

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (data) {
          final summary = _map(data['summary']);
          final payments = _list(data['data']);
          // Filter out GRNs already paid in this session (optimistic removal).
          final unbilledGrns = _list(data['unbilled_grns'])
              .where((g) => !_paidGrnIds.contains('${g['id']}'))
              .toList();
          final filteredPayments = payments
              .where((p) => _matchesOutboundSearch(Map<String, dynamic>.from(p),
                  isGrn: false))
              .where((p) => _sourceTab == 'all' ||
                  _txt(Map<String, dynamic>.from(p), ['source']) == _sourceTab)
              .toList();
          final filteredGrns = unbilledGrns
              .where((g) => _matchesOutboundSearch(Map<String, dynamic>.from(g),
                  isGrn: true))
              .toList();
          final settledTotal = filteredPayments
              .where((p) => _txt(Map<String, dynamic>.from(p),
                      ['settlement_status']) ==
                  'settled')
              .fold<num>(0, (sum, p) => sum + _num(p['amount']));
          final pendingTotal = filteredPayments
              .where((p) => _txt(Map<String, dynamic>.from(p),
                      ['settlement_status']) !=
                  'settled')
              .fold<num>(0, (sum, p) => sum + _num(p['amount']));
          return _Page(
            title: 'Outbound Payments',
            subtitle:
                'Pay vendors, essentials and payouts — initiate, approve and release with a full audit trail.',
            actions: [
              _Dropdown(
                value: _status,
                values: const ['all', 'released', 'rejected'],
                labels: const {
                  'all': 'All',
                  'released': 'Released',
                  'rejected': 'Rejected',
                },
                onChanged: (v) => setState(() {
                  _status = v;
                  _future = _load();
                }),
              ),
              _RefreshButton(onPressed: _refresh),
              if (_canInitiate)
                FilledButton.icon(
                  onPressed: _newPayment,
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('New Payment'),
                ),
              if (_canInitiate)
                OutlinedButton.icon(
                  onPressed: _addExpense,
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Add Expense'),
                ),
            ],
            children: [
              Wrap(
                spacing: 8,
                children: [
                  ChoiceChip(
                    label: const Text('All'),
                    selected: _sourceTab == 'all',
                    onSelected: (_) => setState(() => _sourceTab = 'all'),
                  ),
                  ChoiceChip(
                    label: const Text('Auto (PO)'),
                    selected: _sourceTab == 'po_auto',
                    onSelected: (_) => setState(() => _sourceTab = 'po_auto'),
                  ),
                  ChoiceChip(
                    label: const Text('Manual'),
                    selected: _sourceTab == 'manual',
                    onSelected: (_) => setState(() => _sourceTab = 'manual'),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _ResponsiveGrid(children: [
                _MetricCard(
                    'Total',
                    _money(settledTotal + pendingTotal),
                    Icons.account_balance_wallet,
                    Colors.blueGrey),
                _MetricCard('Settled', _money(settledTotal),
                    Icons.check_circle, Colors.green),
                _MetricCard('Pending', _money(pendingTotal),
                    Icons.hourglass_bottom, Colors.amber.shade800),
              ]),
              const SizedBox(height: 12),
              // ── Supplier Finance redirect banner ──────────────────────
              if (widget.preload != null && (widget.preload!['supplier_name'] ?? '').toString().isNotEmpty)
                Container(
                  margin: const EdgeInsets.only(bottom: 4),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1A3C5E).withValues(alpha: 0.07),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFF1A3C5E).withValues(alpha: 0.2)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.link, size: 16, color: Color(0xFF1A3C5E)),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Redirected from Supplier Finance · ${widget.preload!['supplier_name']} · '
                          'Payment dialog opening…',
                          style: const TextStyle(
                            color: Color(0xFF1A3C5E),
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              _ResponsiveGrid(children: [
                _MetricCard(
                    'Total Outflow',
                    _money(_num(summary['total_outflow'])),
                    Icons.trending_down,
                    Colors.red),
                _MetricCard(
                    'Payments Released',
                    '${_num(summary['released']).toInt()}',
                    Icons.check_circle_outline,
                    Colors.green),
                _MetricCard(
                    'GRNs to Pay',
                    '${unbilledGrns.length}',
                    Icons.receipt_long,
                    Colors.orange),
                _MetricCard(
                    'Total Payments',
                    '${payments.length}',
                    Icons.payments_outlined,
                    Colors.blueGrey),
              ]),
              _outboundSearchCard(
                visibleBills: filteredGrns.length,
                visiblePayments: filteredPayments.length,
                totalBills: unbilledGrns.length,
                totalPayments: payments.length,
              ),
              const SizedBox(height: 16),
              if (unbilledGrns.isNotEmpty || _search.trim().isNotEmpty) ...[
                _SectionCard(
                  title: 'Unbilled GRNs (Ready to Pay)',
                  child: filteredGrns.isEmpty
                      ? Padding(
                          padding: const EdgeInsets.all(16),
                          child: Text(_search.trim().isEmpty
                              ? 'No GRNs ready to pay.'
                              : 'No ready-to-pay GRNs match your search.'),
                        )
                      : Column(
                          children: filteredGrns
                              .map((g) =>
                                  _unbilledGrnRow(Map<String, dynamic>.from(g)))
                              .toList(),
                        ),
                ),
                const SizedBox(height: 16),
              ],
              _SectionCard(
                title: 'Payments',
                child: filteredPayments.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.all(16),
                        child: Text('No outbound payments found.'))
                    : Column(
                        children: filteredPayments
                            .map((p) =>
                                _paymentRow(Map<String, dynamic>.from(p)))
                            .toList(),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _outboundSearchCard({
    required int visibleBills,
    required int visiblePayments,
    required int totalBills,
    required int totalPayments,
  }) {
    final hasSearch = _search.trim().isNotEmpty;
    return _SectionCard(
      title: 'Find supplier bill or GRN',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _searchCtrl,
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search),
              suffixIcon: hasSearch
                  ? IconButton(
                      tooltip: 'Clear search',
                      icon: const Icon(Icons.close),
                      onPressed: () => setState(() {
                        _searchCtrl.clear();
                        _search = '';
                      }),
                    )
                  : null,
              hintText:
                  'Search supplier, GRN number, PO number, payment number, reference or amount',
            ),
            onChanged: (value) => setState(() => _search = value),
          ),
          const SizedBox(height: 10),
          Text(
            hasSearch
                ? '$visibleBills of $totalBills GRN bills • $visiblePayments of $totalPayments payments'
                : '$totalBills GRN bills ready to pay • $totalPayments outbound payments',
            style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
          ),
        ],
      ),
    );
  }

  bool _matchesOutboundSearch(Map<String, dynamic> row, {required bool isGrn}) {
    final needle = _search.trim().toLowerCase();
    if (needle.isEmpty) return true;
    return _outboundHaystack(row, isGrn: isGrn).contains(needle);
  }

  String _outboundHaystack(Map<String, dynamic> row, {required bool isGrn}) {
    final keys = isGrn
        ? const [
            'grn_number',
            'grn_no',
            'po_number',
            'supplier_name',
            'supplier',
            'delivery_note_number',
            'invoice_number',
            'status',
            'finance_status',
            'total_value',
            'total_amount',
            'created_at',
            'grn_date',
          ]
        : const [
            'payment_number',
            'payee_name',
            'payee_account',
            'category',
            'payment_method',
            'reference',
            'description',
            'status',
            'amount',
            'currency',
            'created_by_name',
            'created_at',
          ];
    final itemWords = _list(row['items'])
        .map((item) => [
              _txt(item, ['item_name', 'description', 'name']),
              _txt(item, ['item_id', 'sku', 'item_sku']),
              '${item['quantity'] ?? item['quantity_received'] ?? ''}',
            ].where((part) => part.trim().isNotEmpty).join(' '))
        .join(' ');
    return [
      ...keys.map((key) => '${row[key] ?? ''}'),
      itemWords,
    ].join(' ').toLowerCase();
  }

  Widget _unbilledGrnRow(Map<String, dynamic> g) {
    final grnNumber = _txt(g, ['grn_number', 'grn_no'], 'GRN');
    final supplierName = _txt(g, ['supplier_name', 'supplier'], 'Supplier');
    final amount = _num(g['total_value'] ?? g['total_amount']);
    final date = _txt(g, ['grn_date', 'created_at']);
    final when = DateTime.tryParse(date);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: Colors.orange.withValues(alpha: 0.1),
            child: const Icon(Icons.receipt, size: 18, color: Colors.orange),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(supplierName,
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                Text(
                  '$grnNumber${when != null ? ' · ${DateFormat('MMM d').format(when)}' : ''}',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(_money(amount),
              style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(width: 10),
          OutlinedButton.icon(
            onPressed: () => _viewGrnForVerification(g),
            icon: const Icon(Icons.visibility_outlined, size: 14),
            label: const Text('View GRN'),
            style: OutlinedButton.styleFrom(
              visualDensity: VisualDensity.compact,
            ),
          ),
          if (_canInitiate) ...[
            const SizedBox(width: 10),
            FilledButton.icon(
              onPressed: () => _billGrn(g),
              icon: const Icon(Icons.payment, size: 14),
              label: const Text('Pay'),
              style:
                  FilledButton.styleFrom(visualDensity: VisualDensity.compact),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _billGrn(Map<String, dynamic> g) async {
    final grnId = '${g['id']}';
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _NewPaymentDialog(
        initialPayee: _txt(g, ['supplier_name', 'supplier']),
        initialAmount: _num(g['total_value'] ?? g['total_amount']),
        grnId: grnId,
        poId: g['po_id'] != null ? '${g['po_id']}' : null,
        reference: _txt(g, ['grn_number', 'grn_no']),
      ),
    );
    if (saved == true) {
      // Optimistically remove from list immediately, then sync with backend.
      setState(() => _paidGrnIds.add(grnId));
      _refresh();
    }
  }

  Future<void> _viewGrnForVerification(Map<String, dynamic> source) async {
    var grn = Map<String, dynamic>.from(source);
    final grnId = _txt(grn, ['id', 'grn_id']);
    if (grnId.isNotEmpty) {
      try {
        final full = await ref
            .read(branchAccountantRepositoryProvider)
            .getGRNDetail(grnId);
        if (full.isNotEmpty) grn = {...grn, ...full};
      } catch (_) {}
    }
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Row(
          children: [
            CircleAvatar(
              backgroundColor: Colors.teal.withValues(alpha: 0.12),
              child: const Icon(Icons.assignment_turned_in, color: Colors.teal),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'GRN Verification • ${_txt(grn, [
                      'grn_number',
                      'grn_no',
                      'id'
                    ], 'GRN')}',
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        content: SizedBox(
          width: 820,
          child: SingleChildScrollView(child: _grnVerificationBody(grn)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Close'),
          ),
          if (_canInitiate)
            FilledButton.icon(
              onPressed: () {
                Navigator.pop(dialogContext);
                _billGrn(grn);
              },
              icon: const Icon(Icons.payment, size: 18),
              label: const Text('Pay this GRN'),
            ),
        ],
      ),
    );
  }

  Widget _grnVerificationBody(Map<String, dynamic> grn) {
    final items = _list(grn['items'] ?? grn['grn_items'] ?? grn['lines']);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _TwoColumn(
          left: _SectionCard(
            title: 'Supplier',
            child: _KeyValueList({
              'supplier_name': _txt(grn, ['supplier_name', 'supplier']),
              'supplier_code': _txt(grn, ['supplier_code']),
              'phone': _txt(grn, ['supplier_phone', 'phone']),
              'email': _txt(grn, ['supplier_email', 'email']),
            }),
          ),
          right: _SectionCard(
            title: 'Receiving Details',
            child: _KeyValueList({
              'grn_number': _txt(grn, ['grn_number', 'grn_no', 'id']),
              'po_number': _txt(grn, ['po_number', 'purchase_order_number']),
              'delivery_note': _txt(grn, ['delivery_note_number']),
              'invoice_number': _txt(grn, ['invoice_number']),
              'received_date':
                  _txt(grn, ['grn_date', 'received_date', 'created_at']),
              'status':
                  _txt(grn, ['finance_status', 'status'], 'Ready to Bill'),
            }),
          ),
        ),
        const SizedBox(height: 14),
        _ResponsiveGrid(children: [
          _MetricCard(
              'GRN Value',
              _money(_num(grn['total_value'] ?? grn['total_amount'])),
              Icons.payments,
              Colors.green),
          _MetricCard('Line Items', '${items.length}',
              Icons.format_list_numbered, Colors.blueGrey),
          _MetricCard(
              'Quantity',
              '${items.fold<num>(0, (sum, item) => sum + _num(item['quantity'] ?? item['quantity_received'] ?? item['quantity_accepted']))}',
              Icons.inventory_2,
              Colors.orange),
        ]),
        const SizedBox(height: 14),
        _SectionCard(
          title: 'Received Items',
          child: items.isEmpty
              ? const Padding(
                  padding: EdgeInsets.all(12),
                  child: Text('No item lines were returned for this GRN.'),
                )
              : SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: DataTable(
                    columns: const [
                      DataColumn(label: Text('#')),
                      DataColumn(label: Text('Item')),
                      DataColumn(label: Text('SKU')),
                      DataColumn(label: Text('Received')),
                      DataColumn(label: Text('Accepted')),
                      DataColumn(label: Text('Unit Price')),
                      DataColumn(label: Text('Total')),
                    ],
                    rows: items.asMap().entries.map((entry) {
                      final item = entry.value;
                      final qty = _num(item['quantity'] ??
                          item['quantity_received'] ??
                          item['quantity_accepted']);
                      final accepted = _num(item['quantity_accepted'] ?? qty);
                      final price = _num(item['unit_price']);
                      return DataRow(cells: [
                        DataCell(Text('${entry.key + 1}')),
                        DataCell(Text(
                          _txt(item, ['item_name', 'description', 'name'],
                              'Item'),
                        )),
                        DataCell(
                            Text(_txt(item, ['item_id', 'sku', 'item_sku']))),
                        DataCell(Text('$qty')),
                        DataCell(Text('$accepted')),
                        DataCell(Text(_money(price))),
                        DataCell(Text(_money(_num(item['total_value']) > 0
                            ? _num(item['total_value'])
                            : accepted * price))),
                      ]);
                    }).toList(),
                  ),
                ),
        ),
      ],
    );
  }

  Widget _paymentRow(Map<String, dynamic> p) {
    final status = _txt(p, ['status'], 'pending');
    final amount = _num(p['amount']);
    final requiresDirector = p['requires_director'] == true;
    final isCreator = _txt(p, ['created_by']) == _uid;
    final created = _txt(p, ['created_at']);
    final when = DateTime.tryParse(created);
    final cashFlowCategory = _txt(p, ['cash_flow_category']);
    final settlementStatus = _txt(p, ['settlement_status'], 'pending');

    final actions = <Widget>[];
    if (_txt(p, ['grn_id']).isNotEmpty) {
      actions.add(_act(
          'View GRN',
          Colors.teal,
          () => _viewGrnForVerification({
                'id': _txt(p, ['grn_id']),
                'po_id': _txt(p, ['po_id']),
                'supplier_name': _txt(p, ['payee_name']),
                'total_value': p['amount'],
                'reference': _txt(p, ['reference']),
              }),
          outlined: true));
    }
    final isFinal = status == 'released' || status == 'rejected';
    if (!isFinal && !isCreator) {
      if (status == 'pending' && _canApprove) {
        actions.add(_act(
            'Approve',
            Colors.green,
            () => _do(() => ref
                .read(branchAccountantRepositoryProvider)
                .approveBranchPayment('${p['id']}'))));
      }
      if (status == 'manager_approved' && requiresDirector && _canDirector) {
        actions.add(_act(
            'Director sign-off',
            Colors.purple,
            () => _do(() => ref
                .read(branchAccountantRepositoryProvider)
                .approveBranchPayment('${p['id']}', asDirector: true))));
      }
      final readyToRelease = requiresDirector
          ? status == 'director_approved'
          : status == 'manager_approved';
      if (readyToRelease && _canRelease) {
        actions.add(_act(
            'Release', AppColors.kPrimary, () => _releasePaymentAndReceipt(p)));
      }
      if (_canApprove) {
        actions.add(_act('Reject', Colors.red, () => _reject('${p['id']}'),
            outlined: true));
      }
    }
    if (status == 'released') {
      actions.add(_act(
          'Receipt', AppColors.kPrimary, () => _downloadPaymentReceipt(p),
          outlined: true));
      actions.add(_act('Print', Colors.blueGrey, () => _printPaymentReceipt(p),
          outlined: true));
    }

    return InkWell(
      onTap: () => _showRecord(context, p,
          title: _txt(p, ['payment_number'], 'Payment')),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: AppColors.kPrimary.withValues(alpha: 0.1),
              child: const Icon(Icons.payments,
                  size: 18, color: AppColors.kPrimary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_txt(p, ['payee_name'], 'Payee'),
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text(
                    '${_payCategories[_txt(p, ['category'])] ?? _txt(p, [
                              'category'
                            ])}'
                    ' · ${_payMethods[_txt(p, ['payment_method'])] ?? _txt(p, [
                              'payment_method'
                            ])}'
                    '${when != null ? ' · ${DateFormat('MMM d').format(when)}' : ''}',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(_money(amount),
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                if (cashFlowCategory.isNotEmpty)
                  _CashFlowCategoryBadge(category: cashFlowCategory),
                _SettlementStatusPill(status: settlementStatus),
                _PayStatusPill(status: status),
              ],
            ),
            if (actions.isNotEmpty) ...[
              const SizedBox(width: 10),
              Wrap(spacing: 6, children: actions),
            ],
          ],
        ),
      ),
    );
  }

  Widget _act(String label, Color color, VoidCallback onTap,
          {bool outlined = false}) =>
      outlined
          ? OutlinedButton(
              onPressed: onTap,
              style: OutlinedButton.styleFrom(
                  foregroundColor: color, visualDensity: VisualDensity.compact),
              child: Text(label))
          : FilledButton(
              onPressed: onTap,
              style: FilledButton.styleFrom(
                  backgroundColor: color, visualDensity: VisualDensity.compact),
              child: Text(label));

  Future<void> _do(Future<void> Function() action) async {
    try {
      await action();
      if (mounted) {
        _notify(context, 'Payment updated');
        _refresh();
      }
    } catch (e) {
      if (mounted) _notify(context, 'Action failed: $e');
    }
  }

  Future<void> _reject(String id) async {
    final ctrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject payment'),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(labelText: 'Reason'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
              child: const Text('Reject')),
        ],
      ),
    );
    if (reason == null) return;
    await _do(() => ref
        .read(branchAccountantRepositoryProvider)
        .rejectBranchPayment(id, reason));
  }

  Future<File> _receiptFileFor(Map<String, dynamic> payment) {
    return ref
        .read(branchAccountantRepositoryProvider)
        .downloadBranchPaymentReceipt(
          '${payment['id']}',
          paymentNumber: _txt(payment, ['payment_number']),
        );
  }

  Future<void> _releasePaymentAndReceipt(Map<String, dynamic> payment) async {
    try {
      await ref
          .read(branchAccountantRepositoryProvider)
          .releaseBranchPayment('${payment['id']}');
      final file = await _receiptFileFor(payment);
      if (mounted) {
        _notify(
            context, 'Payment released. Supplier receipt saved: ${file.path}');
        _refresh();
      }
    } catch (e) {
      if (mounted) _notify(context, 'Release failed: $e');
    }
  }

  Future<void> _downloadPaymentReceipt(Map<String, dynamic> payment) async {
    try {
      final file = await _receiptFileFor(payment);
      if (mounted) _notify(context, 'Supplier receipt saved: ${file.path}');
    } catch (e) {
      if (mounted) _notify(context, 'Receipt download failed: $e');
    }
  }

  Future<void> _printPaymentReceipt(Map<String, dynamic> payment) async {
    try {
      final file = await _receiptFileFor(payment);
      final bytes = await file.readAsBytes();
      await Printing.layoutPdf(
        name: file.uri.pathSegments.isEmpty
            ? 'supplier-receipt.pdf'
            : file.uri.pathSegments.last,
        onLayout: (_) async => bytes,
      );
      if (mounted) _notify(context, 'Supplier receipt ready to print');
    } catch (e) {
      if (mounted) _notify(context, 'Receipt print failed: $e');
    }
  }

  Future<void> _newPayment() async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => const _NewPaymentDialog(),
    );
    if (saved == true) _refresh();
  }

  Future<void> _addExpense() async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _AddExpenseSheet(),
    );
    if (saved == true) _refresh();
  }
}

const _expenseCategoryLabels = {
  'petty_cash': 'Petty Cash',
  'transaction_cost': 'Transaction Cost',
};

class _AddExpenseSheet extends ConsumerStatefulWidget {
  const _AddExpenseSheet();

  @override
  ConsumerState<_AddExpenseSheet> createState() => _AddExpenseSheetState();
}

class _AddExpenseSheetState extends ConsumerState<_AddExpenseSheet> {
  String _category = 'petty_cash';
  final _amountCtrl = TextEditingController();
  final _descriptionCtrl = TextEditingController();
  late String _date = _today();
  bool _saving = false;

  @override
  void dispose() {
    _amountCtrl.dispose();
    _descriptionCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final amount = double.tryParse(_amountCtrl.text.trim()) ?? 0;
    if (amount <= 0) {
      _notify(context, 'Enter a valid amount');
      return;
    }
    setState(() => _saving = true);
    try {
      await ref.read(branchAccountantRepositoryProvider).createBranchPayment({
        'category': _category,
        'cash_flow_category': _category,
        'payment_method': 'cash',
        'payee_name': _descriptionCtrl.text.trim().isEmpty
            ? _expenseCategoryLabels[_category]!
            : _descriptionCtrl.text.trim(),
        'description': _descriptionCtrl.text.trim(),
        'amount': amount,
        'source': 'manual',
        'created_at': _date,
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) _notify(context, 'Failed to add expense: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: 20 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Add Expense',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            initialValue: _category,
            decoration: const InputDecoration(labelText: 'Category'),
            items: _expenseCategoryLabels.entries
                .map((e) =>
                    DropdownMenuItem(value: e.key, child: Text(e.value)))
                .toList(),
            onChanged: (v) => setState(() => _category = v!),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _amountCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Amount (KES)'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _descriptionCtrl,
            decoration: const InputDecoration(labelText: 'Description'),
          ),
          const SizedBox(height: 12),
          _DateField(value: _date, onChanged: (v) => setState(() => _date = v)),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _saving ? null : _submit,
              child: Text(_saving ? 'Submitting…' : 'Submit'),
            ),
          ),
        ],
      ),
    );
  }
}

class _NewPaymentDialog extends ConsumerStatefulWidget {
  const _NewPaymentDialog({
    this.initialPayee = '',
    this.initialAmount = 0,
    this.grnId,
    this.poId,
    this.reference = '',
    this.supplierName = '',
    this.supplierId = '',
    this.invoiceId,
  });

  final String initialPayee;
  final num initialAmount;
  final String? grnId;
  final String? poId;
  final String reference;
  final String supplierName;
  final String supplierId;
  final String? invoiceId;

  @override
  ConsumerState<_NewPaymentDialog> createState() => _NewPaymentDialogState();
}

class _NewPaymentDialogState extends ConsumerState<_NewPaymentDialog> {
  final _payee = TextEditingController();
  final _account = TextEditingController();
  final _amount = TextEditingController();
  final _desc = TextEditingController();
  final _ref = TextEditingController();
  final _receipt = TextEditingController();
  String _category = 'vendor';
  String _method = 'eft';
  String _currency = 'KES';
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _payee.text = widget.initialPayee;
    if (widget.initialAmount > 0) {
      _amount.text = widget.initialAmount.toString();
    }
    _ref.text = widget.reference;
  }

  @override
  void dispose() {
    _payee.dispose();
    _account.dispose();
    _amount.dispose();
    _desc.dispose();
    _ref.dispose();
    _receipt.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final amt = num.tryParse(_amount.text.trim()) ?? 0;
    if (_payee.text.trim().isEmpty || amt <= 0) {
      _toast('Enter a payee and a valid amount');
      return;
    }
    setState(() => _saving = true);
    try {
      await ref.read(branchAccountantRepositoryProvider).createBranchPayment({
        'category': _category,
        'payment_method': _method,
        'payee_name': _payee.text.trim(),
        if (_account.text.trim().isNotEmpty)
          'payee_account': _account.text.trim(),
        'amount': amt,
        'currency': _currency,
        if (_desc.text.trim().isNotEmpty) 'description': _desc.text.trim(),
        if (_ref.text.trim().isNotEmpty) 'reference': _ref.text.trim(),
        if (_receipt.text.trim().isNotEmpty)
          'receipt_url': _receipt.text.trim(),
        if (widget.grnId != null) 'grn_id': widget.grnId,
        if (widget.poId != null) 'po_id': widget.poId,
        if (widget.supplierId.isNotEmpty) 'supplier_id': widget.supplierId,
        if (widget.invoiceId != null && widget.invoiceId!.isNotEmpty)
          'invoice_id': widget.invoiceId,
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        _toast('Could not create payment: $e');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasContext = widget.supplierName.isNotEmpty || widget.invoiceId != null;
    return AlertDialog(
      title: const Text('New Outbound Payment'),
      content: SizedBox(
        width: 460,
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            // ── Supplier Finance context banner ──────────────────────────
            if (hasContext) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFF1A3C5E).withValues(alpha: 0.07),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFF1A3C5E).withValues(alpha: 0.18)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.link, size: 16, color: Color(0xFF1A3C5E)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'From Supplier Finance',
                            style: TextStyle(
                              fontSize: 11,
                              color: const Color(0xFF1A3C5E).withValues(alpha: 0.7),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          if (widget.supplierName.isNotEmpty)
                            Text(
                              widget.supplierName,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 13,
                                color: Color(0xFF1A3C5E),
                              ),
                            ),
                          if (widget.invoiceId != null && widget.invoiceId!.isNotEmpty)
                            Text(
                              'Invoice: ${widget.reference.isNotEmpty ? widget.reference : widget.invoiceId}',
                              style: const TextStyle(fontSize: 12),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],
            TextField(
                controller: _payee,
                decoration:
                    const InputDecoration(labelText: 'Payee / Vendor name')),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _category,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Category'),
                  items: _payCategories.entries
                      .map((e) =>
                          DropdownMenuItem(value: e.key, child: Text(e.value)))
                      .toList(),
                  onChanged: (v) => setState(() => _category = v!),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _method,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Method'),
                  items: _payMethods.entries
                      .map((e) =>
                          DropdownMenuItem(value: e.key, child: Text(e.value)))
                      .toList(),
                  onChanged: (v) => setState(() => _method = v!),
                ),
              ),
            ]),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(
                flex: 2,
                child: TextField(
                  controller: _amount,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Amount'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _currency,
                  decoration: const InputDecoration(labelText: 'Currency'),
                  items: const ['KES', 'USD', 'EUR', 'GBP']
                      .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (v) => setState(() => _currency = v!),
                ),
              ),
            ]),
            const SizedBox(height: 10),
            TextField(
                controller: _account,
                decoration: const InputDecoration(
                    labelText: 'Payee account / phone (optional)')),
            const SizedBox(height: 10),
            TextField(
                controller: _ref,
                decoration:
                    const InputDecoration(labelText: 'Reference (optional)')),
            const SizedBox(height: 10),
            TextField(
                controller: _receipt,
                decoration: const InputDecoration(
                    labelText: 'Receipt / invoice document URL (optional)')),
            const SizedBox(height: 10),
            TextField(
                controller: _desc,
                minLines: 2,
                maxLines: 4,
                decoration: const InputDecoration(labelText: 'Description')),
          ]),
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel')),
        FilledButton(
          onPressed: _saving ? null : _submit,
          child: Text(_saving ? 'Submitting…' : 'Submit for approval'),
        ),
      ],
    );
  }
}

class _PayStatusPill extends StatelessWidget {
  const _PayStatusPill({required this.status});
  final String status;
  @override
  Widget build(BuildContext context) {
    final s = status.toLowerCase();
    Color c = Colors.blueGrey;
    if (s.contains('pending')) c = Colors.orange.shade800;
    if (s.contains('manager')) c = Colors.blue.shade700;
    if (s.contains('director')) c = Colors.purple.shade700;
    if (s.contains('released')) c = Colors.green.shade700;
    if (s.contains('rejected')) c = Colors.red.shade700;
    return Container(
      margin: const EdgeInsets.only(top: 2),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(status.replaceAll('_', ' ').toUpperCase(),
          style:
              TextStyle(color: c, fontSize: 10, fontWeight: FontWeight.w700)),
    );
  }
}

class _SettlementStatusPill extends StatelessWidget {
  const _SettlementStatusPill({required this.status});
  final String status;
  @override
  Widget build(BuildContext context) {
    final settled = status.toLowerCase() == 'settled';
    final c = settled ? Colors.green.shade700 : Colors.amber.shade800;
    return Container(
      margin: const EdgeInsets.only(top: 2),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(settled ? 'SETTLED' : 'PENDING',
          style:
              TextStyle(color: c, fontSize: 10, fontWeight: FontWeight.w700)),
    );
  }
}

const _cashFlowCategoryLabels = {
  'daily_purchase': 'Daily Purchase',
  'petty_cash': 'Petty Cash',
  'transaction_cost': 'Transaction Cost',
};
const _cashFlowCategoryColors = {
  'daily_purchase': Colors.blue,
  'petty_cash': Colors.orange,
  'transaction_cost': Colors.purple,
};

class _CashFlowCategoryBadge extends StatelessWidget {
  const _CashFlowCategoryBadge({required this.category});
  final String category;
  @override
  Widget build(BuildContext context) {
    final c = _cashFlowCategoryColors[category] ?? Colors.blueGrey;
    return Container(
      margin: const EdgeInsets.only(top: 2),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
          (_cashFlowCategoryLabels[category] ?? category).toUpperCase(),
          style:
              TextStyle(color: c, fontSize: 10, fontWeight: FontWeight.w700)),
    );
  }
}
