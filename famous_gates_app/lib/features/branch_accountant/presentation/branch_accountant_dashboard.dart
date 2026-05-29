import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import 'package:pdf/widgets.dart' as pw;

import '../../../core/theme/app_theme.dart';
import '../../auth/domain/auth_notifier.dart';
import '../data/repository.dart';
import '../domain/providers.dart';

enum BranchAccountantSection {
  overview,
  cashierClearance,
  analytics,
  financialWorkspace,
  discrepancies,
  profitLoss,
  revenueOversight,
  soldItems,
  staffAudit,
  shiftReview,
  cashierLogbooks,
  voidApprovals,
  banking,
  payments,
  creditBills,
  foodVariance,
  shiftPnl,
  bookingsInvoices,
  stockTake,
  purchases,
  buffet,
  catering,
  budgets,
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

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    final isMobile = width < 768;
    final isTablet = width >= 768 && width < 1024;

    return Scaffold(
      backgroundColor: AppColors.kSurface,
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
                Expanded(child: _buildSection()),
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
        return const _OverviewSection();
      case BranchAccountantSection.cashierClearance:
        return const _CashierClearanceSection();
      case BranchAccountantSection.analytics:
        return const _AnalyticsSection();
      case BranchAccountantSection.financialWorkspace:
        return const _FinancialWorkspaceSection();
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
      case BranchAccountantSection.shiftReview:
        return const _ShiftReviewSection();
      case BranchAccountantSection.cashierLogbooks:
        return const _CashierLogbooksSection();
      case BranchAccountantSection.voidApprovals:
        return const _PosVoidApprovalsSection();
      case BranchAccountantSection.banking:
        return const _BankingSection();
      case BranchAccountantSection.payments:
        return const _PaymentsInvoicesSection();
      case BranchAccountantSection.creditBills:
        return const _CreditBillsSection();
      case BranchAccountantSection.foodVariance:
        return const _FoodVarianceSection();
      case BranchAccountantSection.shiftPnl:
        return const _ShiftPnlSection();
      case BranchAccountantSection.bookingsInvoices:
        return const _BookingsInvoicesSection();
      case BranchAccountantSection.stockTake:
        return const _StockTakeSection();
      case BranchAccountantSection.purchases:
        return const _PurchasesSection();
      case BranchAccountantSection.buffet:
        return const _BuffetSection();
      case BranchAccountantSection.catering:
        return const _CateringSection();
      case BranchAccountantSection.budgets:
        return const _BudgetsSection();
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
  _NavItem(BranchAccountantSection.cashierClearance, 'Cashier Clearance',
      Icons.fact_check),
  _NavItem(
      BranchAccountantSection.analytics, 'Branch Analytics', Icons.analytics),
  _NavItem(BranchAccountantSection.financialWorkspace, 'Financial Workspace',
      Icons.calendar_month),
  _NavItem(
      BranchAccountantSection.discrepancies, 'Discrepancies', Icons.warning),
  _NavItem(
      BranchAccountantSection.profitLoss, 'Profit & Loss', Icons.bar_chart),
  _NavItem(BranchAccountantSection.revenueOversight, 'Revenue Oversight',
      Icons.trending_up),
  _NavItem(BranchAccountantSection.soldItems, 'Sold Items', Icons.inventory_2),
  _NavItem(BranchAccountantSection.staffAudit, 'Staff Audit', Icons.shield),
  _NavItem(BranchAccountantSection.shiftReview, 'Shift Review', Icons.schedule),
  _NavItem(
      BranchAccountantSection.cashierLogbooks, 'Cashier Logbooks', Icons.book),
  _NavItem(
      BranchAccountantSection.voidApprovals, 'Void Approvals', Icons.block),
  _NavItem(BranchAccountantSection.banking, 'Banking', Icons.account_balance),
  _NavItem(BranchAccountantSection.payments, 'Payments & Invoices',
      Icons.receipt_long),
  _NavItem(
      BranchAccountantSection.creditBills, 'Credit Bills', Icons.credit_card),
  _NavItem(
      BranchAccountantSection.foodVariance, 'Food Variance', Icons.warning),
  _NavItem(BranchAccountantSection.shiftPnl, 'Shift P&L', Icons.insights),
  _NavItem(BranchAccountantSection.bookingsInvoices, 'Bookings Invoices',
      Icons.hotel),
  _NavItem(BranchAccountantSection.stockTake, 'Stock Takes', Icons.inventory),
  _NavItem(BranchAccountantSection.purchases, 'Purchases', Icons.shopping_cart),
  _NavItem(BranchAccountantSection.buffet, 'Buffet Control', Icons.restaurant),
  _NavItem(
      BranchAccountantSection.catering, 'Catering Control', Icons.room_service),
  _NavItem(BranchAccountantSection.budgets, 'Budgets', Icons.account_balance),
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
      BranchAccountantSection.cashierClearance,
      BranchAccountantSection.financialWorkspace,
      BranchAccountantSection.discrepancies,
      BranchAccountantSection.budgets,
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
  const _OverviewSection();

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
        final sales = _map(payload['sales']);
        final financials = _map(payload['financials']);
        final discrepancies = _list(payload['discrepancies']);
        final budget = _map(payload['budget_summary']);
        return _Page(
          title: 'Branch Accountant Overview',
          subtitle:
              'Cashier clearance, branch sales, discrepancies, budgets, and daily finance status.',
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
            _ResponsiveGrid(children: [
              _MetricCard('Total Revenue', _money(_num(sales['total_sales'])),
                  Icons.trending_up, Colors.green),
              _MetricCard(
                  'Cashier Variance',
                  _money(_num(summary['total_variance'])),
                  Icons.fact_check,
                  _num(summary['total_variance']).abs() > 0
                      ? Colors.red
                      : Colors.green),
              _MetricCard('Pending Clearances', '${summary['pending'] ?? 0}',
                  Icons.hourglass_bottom, Colors.orange),
              _MetricCard('Open Discrepancies', '${discrepancies.length}',
                  Icons.warning, Colors.red),
              _MetricCard(
                  'Net Profit',
                  _money(_num(
                      financials['net_profit'] ?? financials['netProfit'])),
                  Icons.account_balance_wallet,
                  Colors.blue),
              _MetricCard(
                  'Budget Utilization',
                  '${_num(budget['utilization_percentage']).toStringAsFixed(1)}%',
                  Icons.account_balance,
                  Colors.purple),
            ]),
            _SectionCard(
              title: 'Recent Financial Position',
              child: _KeyValueList({
                'Revenue': _money(_num(financials['total_revenue'])),
                'Expenses': _money(_num(financials['total_expenses'])),
                'Receivables': _money(_num(financials['receivables'])),
                'Payables': _money(_num(financials['payables'])),
                'Budget Balance': _money(
                    _num(budget['remaining_budget'] ?? budget['balance'])),
              }),
            ),
          ],
        );
      },
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

  void _refresh() => setState(() => _future = _load());

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
                            _money(_num(item['variance'])),
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
    showDialog(
      context: context,
      builder: (_) => _ClearanceDetailsDialog(clearance: item),
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

class _ClearanceDetailsDialog extends StatelessWidget {
  const _ClearanceDetailsDialog({required this.clearance});
  final Map<String, dynamic> clearance;

  @override
  Widget build(BuildContext context) {
    final c = clearance;
    return AlertDialog(
      title: Text(
          'Clearance — ${_text(c, ['cashier_name', 'cashier', 'user_name'])}'),
      content: SizedBox(
        width: 560,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _InfoRow('Shift', _text(c, ['shift_time', 'shift_id', 'id'])),
              _InfoRow('Date', _text(c, ['created_at', 'date'])),
              _InfoRow('Expected Cash',
                  _money(_num(c['expected_cash'] ?? c['expected_amount']))),
              _InfoRow('Actual Cash',
                  _money(_num(c['actual_cash'] ?? c['actual_amount']))),
              _InfoRow('Variance', _money(_num(c['variance']))),
              _InfoRow('Status', _text(c, ['status'])),
              if (c['notes'] != null && '${c['notes']}'.isNotEmpty)
                _InfoRow('Notes', '${c['notes']}'),
              if (c['flag_reason'] != null)
                _InfoRow('Flag Reason', '${c['flag_reason']}'),
              const Divider(height: 24),
              if (c['payment_breakdown'] != null) ...[
                const Text('Payment Breakdown',
                    style: TextStyle(fontWeight: FontWeight.w800)),
                const SizedBox(height: 6),
                _KeyValueList(_map(c['payment_breakdown'])),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close')),
      ],
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
    final sales = await repo.getBranchSalesAnalytics(
      startDate: _start,
      endDate: _end,
      filters: _filtersPayload,
    );
    final financials =
        await repo.getBranchFinancials(startDate: _start, endDate: _end);
    return {'sales': sales, 'financials': financials};
  }

  void _refresh() => setState(() => _future = _load());

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
                label: const Text('PDF'),
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
              ]),
              _TwoColumn(
                left: _SalesTrendChart(data: dailyBreakdown),
                right: _PaymentMethodPieChart(data: paymentBreakdown),
              ),
              _CategoryBreakdownBarChart(data: categoryBreakdown),
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
    _toast('Export saved to ${file.path}');
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

class _FinancialWorkspaceSection extends ConsumerStatefulWidget {
  const _FinancialWorkspaceSection();

  @override
  ConsumerState<_FinancialWorkspaceSection> createState() =>
      _FinancialWorkspaceSectionState();
}

class _FinancialWorkspaceSectionState
    extends ConsumerState<_FinancialWorkspaceSection> {
  DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);
  late Future<List<Map<String, dynamic>>> _future = _load();

  Future<List<Map<String, dynamic>>> _load() {
    final start = DateTime(_month.year, _month.month, 1);
    final end = DateTime(_month.year, _month.month + 1, 0);
    return ref
        .read(branchAccountantRepositoryProvider)
        .getDailyRecords(startDate: _date(start), endDate: _date(end));
  }

  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    final tasks = ref.watch(branchAccountantDirectorTasksProvider);
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (items) {
          final totalRevenue =
              items.fold<num>(0, (sum, e) => sum + _num(e['total_revenue']));
          final totalProfit =
              items.fold<num>(0, (sum, e) => sum + _num(e['net_profit']));
          final unbanked =
              items.fold<num>(0, (sum, e) => sum + _num(e['unbanked_cash']));
          return _Page(
            title: 'Financial Workspace',
            subtitle:
                'Daily revenue, payments, banking, COGS, expenses, monthly adjustments, and director tasks.',
            actions: [
              OutlinedButton.icon(
                onPressed: () => _moveMonth(-1),
                icon: const Icon(Icons.chevron_left),
                label: const Text('Previous'),
              ),
              Text(DateFormat('MMMM yyyy').format(_month),
                  style: const TextStyle(fontWeight: FontWeight.w800)),
              OutlinedButton.icon(
                onPressed: () => _moveMonth(1),
                icon: const Icon(Icons.chevron_right),
                label: const Text('Next'),
              ),
              _RefreshButton(onPressed: _refresh),
              FilledButton.tonalIcon(
                onPressed: _monthlyAdjustments,
                icon: const Icon(Icons.account_balance),
                label: const Text('Monthly Adjustments'),
              ),
              FilledButton.icon(
                onPressed: _exportMonth,
                icon: const Icon(Icons.download),
                label: const Text('Export Month'),
              ),
            ],
            children: [
              tasks.maybeWhen(
                data: (items) => items.isEmpty
                    ? const SizedBox.shrink()
                    : _DirectorTasks(items: items),
                orElse: () => const SizedBox.shrink(),
              ),
              _ResponsiveGrid(children: [
                _MetricCard('Recorded Days', '${items.length}',
                    Icons.event_note, Colors.blue),
                _MetricCard('Revenue', _money(totalRevenue), Icons.trending_up,
                    Colors.green),
                _MetricCard('Net Profit', _money(totalProfit), Icons.wallet,
                    totalProfit >= 0 ? Colors.green : Colors.red),
                _MetricCard('Unbanked Cash', _money(unbanked), Icons.warning,
                    unbanked > 0 ? Colors.red : Colors.green),
              ]),
              _MonthCalendarGrid(
                month: _month,
                records: items,
                onDayTapped: _dailyEntry,
                onNewEntry: () => _dailyEntry({
                  'record_date': _today(),
                  'status': 'DRAFT',
                }),
              ),
            ],
          );
        },
      ),
    );
  }

  void _moveMonth(int delta) {
    setState(() {
      _month = DateTime(_month.year, _month.month + delta);
      _future = _load();
    });
  }

  Future<void> _dailyEntry(Map<String, dynamic> record) async {
    final status = _text(record, ['status']).toUpperCase();
    final isReadOnly = status == 'SUBMITTED' || status == 'REVIEWED';
    final saved = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) =>
          _DailyEntryDialog(existing: record, isReadOnly: isReadOnly),
    );
    if (saved == true) _refresh();
  }

  Future<void> _monthlyAdjustments() async {
    final saved = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) =>
          _MonthlyAdjustmentsDialog(year: _month.year, month: _month.month),
    );
    if (saved == true) _refresh();
  }

  Future<void> _exportMonth() async {
    final file = await ref
        .read(branchAccountantRepositoryProvider)
        .exportMonthlyStatement(year: _month.year, month: _month.month);
    _toast('Monthly statement saved to ${file.path}');
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

  void _refresh() => setState(() => _future =
      ref.read(branchAccountantRepositoryProvider).getDiscrepancies());

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
                  '${items.where((e) => _text(e, [
                            'status'
                          ]) == 'PENDING').length}',
                  Icons.hourglass_top,
                  Colors.orange),
              _MetricCard(
                  'Under Review',
                  '${items.where((e) => _text(e, [
                            'status'
                          ]) == 'UNDER_REVIEW').length}',
                  Icons.manage_search,
                  Colors.blue),
              _MetricCard(
                  'Resolved',
                  '${items.where((e) => _text(e, [
                            'status'
                          ]) == 'RESOLVED').length}',
                  Icons.check_circle,
                  Colors.green),
            ]),
            ...items.map((item) => _ActionCard(
                  title: _text(item, ['flag_type', 'title']),
                  subtitle: _text(item, ['description']),
                  trailing: _StatusPill(_text(item, ['status'])),
                  rows: {
                    'Severity': _text(item, ['severity']),
                    'Record Date': _text(item, ['record_date']),
                    'Created': _text(item, ['created_at']),
                    'Accountant Response': _text(item, ['accountant_response']),
                    'Director Decision':
                        _text(item, ['director_final_decision']),
                  },
                  actions: [
                    if (_text(item, ['status']) == 'PENDING')
                      FilledButton(
                        onPressed: () => _respond(item),
                        child: const Text('Respond'),
                      ),
                  ],
                )),
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
    await ref
        .read(branchAccountantRepositoryProvider)
        .respondDiscrepancy('${item['id']}', response.trim());
    _toast('Response submitted');
    _refresh();
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
  late Future<Map<String, dynamic>> _future = _load();

  Future<Map<String, dynamic>> _load() => ref
      .read(branchAccountantRepositoryProvider)
      .getProfitLoss(fromDate: _from, toDate: _to);
  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (pl) => _Page(
          title: 'Profit & Loss Statement',
          subtitle:
              'Revenue, COGS, expenses, operating income, and net margin.',
          actions: [
            _DateField(
                value: _from, onChanged: (v) => setState(() => _from = v)),
            _DateField(value: _to, onChanged: (v) => setState(() => _to = v)),
            _RefreshButton(onPressed: _refresh),
            OutlinedButton.icon(
              onPressed: () => _export(pl),
              icon: const Icon(Icons.picture_as_pdf),
              label: const Text('Export PDF'),
            ),
          ],
          children: [
            _ResponsiveGrid(children: [
              _MetricCard('Gross Profit', _money(_num(pl['grossProfit'])),
                  Icons.trending_up, Colors.green),
              _MetricCard(
                  'Operating Income',
                  _money(_num(pl['operatingIncome'])),
                  Icons.savings,
                  Colors.blue),
              _MetricCard(
                  'Net Profit',
                  _money(_num(pl['netProfit'])),
                  Icons.wallet,
                  _num(pl['netProfit']) >= 0 ? Colors.green : Colors.red),
              _MetricCard('Margin', '${_num(pl['margin']).toStringAsFixed(2)}%',
                  Icons.percent, Colors.purple),
            ]),
            _TwoColumn(
              left: _BreakdownCard(
                title: 'Revenue Breakdown',
                values: _map(pl['revenueBySource']).isNotEmpty
                    ? _map(pl['revenueBySource'])
                    : {'Total Revenue': pl['revenue']},
              ),
              right: _BreakdownCard(
                title: 'Expense Breakdown',
                values: {
                  'Cost of Goods Sold': pl['costOfGoods'],
                  'Operating Expenses': pl['operatingExpenses'],
                  'Other Expenses': pl['otherExpenses'],
                  ..._map(pl['expensesByCategory']),
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _export(Map<String, dynamic> pl) async {
    final file = await _exportPdf(
      filename: 'profit-loss-$_from-to-$_to.pdf',
      title: 'Profit & Loss Statement',
      subtitle: 'Period: $_from to $_to',
      metrics: {
        'Revenue': _money(_num(pl['revenue'])),
        'Cost of Goods': _money(_num(pl['costOfGoods'])),
        'Gross Profit': _money(_num(pl['grossProfit'])),
        'Operating Expenses': _money(_num(pl['operatingExpenses'])),
        'Operating Income': _money(_num(pl['operatingIncome'])),
        'Other Expenses': _money(_num(pl['otherExpenses'])),
        'Net Profit': _money(_num(pl['netProfit'])),
        'Margin': '${_num(pl['margin']).toStringAsFixed(2)}%',
      },
      sections: {
        'Revenue Breakdown': _map(pl['revenueBySource']).isNotEmpty
            ? _map(pl['revenueBySource'])
            : {'Total Revenue': pl['revenue']},
        'Expenses Breakdown': {
          'Cost of Goods Sold': pl['costOfGoods'],
          'Operating Expenses': pl['operatingExpenses'],
          'Other Expenses': pl['otherExpenses'],
          ..._map(pl['expensesByCategory']),
        },
      },
    );
    if (mounted) _notify(context, 'P&L PDF saved to ${file.path}');
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
  late Future<Map<String, dynamic>> _future = _load();
  Future<Map<String, dynamic>> _load() => ref
      .read(branchAccountantRepositoryProvider)
      .getRevenueOversight(period: _period);
  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (data) {
          final summary = _map(data['summary']);
          final categories = _list(data['category_breakdown']);
          final trend = _list(data['daily_trend']);
          return _Page(
            title: 'Revenue Oversight',
            subtitle:
                'Targets, achievement, category performance, and daily trend.',
            actions: [
              _Dropdown(
                value: '$_period',
                values: const ['7', '30', '90'],
                labels: const {
                  '7': 'Last 7 Days',
                  '30': 'Last 30 Days',
                  '90': 'Last 90 Days'
                },
                onChanged: (v) => setState(() => _period = int.parse(v)),
              ),
              _RefreshButton(onPressed: _refresh),
            ],
            children: [
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
  String _search = '';
  late Future<Map<String, dynamic>> _future = _load();
  Future<Map<String, dynamic>> _load() => ref
      .read(branchAccountantRepositoryProvider)
      .getSoldItems(startDate: _from, endDate: _to);
  void _refresh() => setState(() => _future = _load());

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
          final items = _list(payload['analysis']).where((item) {
            final q = _search.toLowerCase();
            return q.isEmpty ||
                _text(item, ['name', 'item_name']).toLowerCase().contains(q) ||
                _text(item, ['item_id', 'sku']).toLowerCase().contains(q);
          }).toList();
          return _Page(
            title: 'Sold Items Analytics',
            subtitle:
                'Product revenue, stock requested, and consumption efficiency.',
            actions: [
              _DateField(
                  value: _from, onChanged: (v) => setState(() => _from = v)),
              _DateField(value: _to, onChanged: (v) => setState(() => _to = v)),
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
                onPressed: () => _export(items, summary),
                icon: const Icon(Icons.download),
                label: const Text('Export Report'),
              ),
            ],
            children: [
              _ResponsiveGrid(children: [
                _MetricCard(
                    'Total Revenue',
                    _money(_num(summary['total_revenue'])),
                    Icons.trending_up,
                    Colors.green),
                _MetricCard(
                    'Units Sold',
                    '${summary['total_quantity_sold'] ?? 0}',
                    Icons.inventory,
                    Colors.blue),
                _MetricCard(
                    'Unique Items',
                    '${summary['total_items_sold'] ?? items.length}',
                    Icons.category,
                    Colors.purple),
              ]),
              _SectionCard(
                title: 'Sold Items Inventory',
                child: _SimpleTable(
                  columns: const [
                    'Product',
                    'Category',
                    'Branch',
                    'Qty',
                    'Revenue',
                    'Requested',
                    'Efficiency'
                  ],
                  rows: items
                      .map((item) => [
                            _text(item, ['name', 'item_name']),
                            _text(item, ['category']),
                            _text(item, ['branch_name']),
                            _num(item['quantity']).toStringAsFixed(0),
                            _money(_num(item['revenue'])),
                            _num(item['stock_requested']).toStringAsFixed(0),
                            _num(item['stock_requested']) > 0
                                ? '${(_num(item['consumption_ratio']) * 100).toStringAsFixed(1)}%'
                                : 'N/A',
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
    List<Map<String, dynamic>> items,
    Map<String, dynamic> summary,
  ) async {
    final file = await _exportPdf(
      filename: 'sold-items-$_from-to-$_to.pdf',
      title: 'Sold Items Report',
      subtitle: 'Period: $_from to $_to',
      metrics: {
        'Total Revenue': _money(_num(summary['total_revenue'])),
        'Units Sold': '${summary['total_quantity_sold'] ?? 0}',
        'Unique Items': '${summary['total_items_sold'] ?? items.length}',
      },
      tableHeaders: const [
        'Product',
        'Category',
        'Branch',
        'Qty Sold',
        'Revenue',
        'Requested',
        'Efficiency'
      ],
      tableRows: items
          .map((item) => [
                _text(item, ['name', 'item_name']),
                _categoryLabel(_text(item, ['category'])),
                _text(item, ['branch_name']),
                _num(item['quantity']).toStringAsFixed(0),
                _money(_num(item['revenue'])),
                _num(item['stock_requested']).toStringAsFixed(0),
                _num(item['stock_requested']) > 0
                    ? '${(_num(item['consumption_ratio']) * 100).toStringAsFixed(1)}%'
                    : 'N/A',
              ])
          .toList(),
    );
    if (mounted) _notify(context, 'Sold items PDF saved to ${file.path}');
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
  void _refresh() => setState(() => _future = _load());

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
                ])} ${_text(e, ['role'])}'
                .toLowerCase();
            return matchesStaff && (lower.isEmpty || haystack.contains(lower));
          }).toList();
          return _Page(
            title: 'Staff Financial Audit',
            subtitle:
                'Credit bills, advances, loans, unpaid bills, and outstanding staff balances.',
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
                    'Credit Bills',
                    _money(_sum(filteredSummary, 'total_credit_bills')),
                    Icons.credit_card,
                    Colors.orange),
                _MetricCard(
                    'Advances',
                    _money(_sum(filteredSummary, 'total_advances')),
                    Icons.payments,
                    Colors.indigo),
                _MetricCard(
                    'Loans',
                    _money(_sum(filteredSummary, 'total_loans')),
                    Icons.account_balance,
                    Colors.green),
                _MetricCard(
                    'Outstanding',
                    _money(_sum(filteredSummary, 'outstanding_balance')),
                    Icons.warning,
                    Colors.red),
              ]),
              _SectionCard(
                title: _summaryMode ? 'Staff Summary' : 'Transactions',
                child: _summaryMode
                    ? _SimpleTable(
                        columns: const [
                          'Staff',
                          'Department',
                          'Role',
                          'Credit Bills',
                          'Advances',
                          'Loans',
                          'Unpaid',
                          'Outstanding'
                        ],
                        rows: filteredSummary
                            .map((e) => [
                                  _text(e, ['staff_name']),
                                  _text(e, ['department']),
                                  _text(e, ['role']),
                                  _money(_num(e['total_credit_bills'])),
                                  _money(_num(e['total_advances'])),
                                  _money(_num(e['total_loans'])),
                                  _money(_num(e['total_unpaid_bills'])),
                                  _money(_num(e['outstanding_balance'])),
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
        'Credit Bills': _money(_sum(summary, 'total_credit_bills')),
        'Advances': _money(_sum(summary, 'total_advances')),
        'Loans': _money(_sum(summary, 'total_loans')),
        'Unpaid Bills': _money(_sum(summary, 'total_unpaid_bills')),
        'Outstanding': _money(_sum(summary, 'outstanding_balance')),
      },
      tableHeaders: _summaryMode
          ? const [
              'Staff',
              'Department',
              'Role',
              'Credit Bills',
              'Advances',
              'Loans',
              'Unpaid',
              'Outstanding'
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
                    _text(e, ['department']),
                    _text(e, ['role']),
                    _money(_num(e['total_credit_bills'])),
                    _money(_num(e['total_advances'])),
                    _money(_num(e['total_loans'])),
                    _money(_num(e['total_unpaid_bills'])),
                    _money(_num(e['outstanding_balance'])),
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

class _ShiftReviewSection extends ConsumerStatefulWidget {
  const _ShiftReviewSection();

  @override
  ConsumerState<_ShiftReviewSection> createState() =>
      _ShiftReviewSectionState();
}

class _ShiftReviewSectionState extends ConsumerState<_ShiftReviewSection> {
  String _status = 'closed';
  late Future<List<Map<String, dynamic>>> _future = _load();

  Future<List<Map<String, dynamic>>> _load() => ref
      .read(branchAccountantRepositoryProvider)
      .getShiftLogs(status: _status);

  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (items) => _Page(
          title: 'Shift Review',
          subtitle:
              'Reconcile closed cashier shifts before auditor verification.',
          actions: [
            _Dropdown(
              value: _status,
              values: const ['closed', 'reconciled', 'verified', 'all'],
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
              _MetricCard('Sales', _money(_sum(items, 'total_sales')),
                  Icons.payments, Colors.green),
              _MetricCard('Variance', _money(_sum(items, 'variance')),
                  Icons.compare_arrows, Colors.orange),
              _MetricCard(
                  'Credit Bills',
                  _money(_sum(items, 'credit_bills_taken')),
                  Icons.credit_card,
                  Colors.purple),
            ]),
            _SectionCard(
              title: 'Shift Queue',
              child: _SimpleTable(
                columns: const [
                  'Shift',
                  'Cashier',
                  'Started',
                  'Sales',
                  'Cash',
                  'Variance',
                  'Status',
                  'Actions'
                ],
                rows: items
                    .map((e) => [
                          _text(e, ['shift_number', 'id']),
                          _text(e, ['cashier_name']),
                          _shortDate(_text(e, ['shift_start', 'created_at'])),
                          _money(_num(e['total_sales'])),
                          _money(_num(e['closing_float'])),
                          _money(_num(e['variance'])),
                          _StatusPill(_text(e, ['status'])),
                          Wrap(spacing: 8, children: [
                            TextButton(
                              onPressed: () => _showRecord(context, e),
                              child: const Text('View'),
                            ),
                            if (_text(e, ['status']).toLowerCase() == 'closed')
                              FilledButton.tonal(
                                onPressed: () => _reconcile(e),
                                child: const Text('Reconcile'),
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

  Future<void> _reconcile(Map<String, dynamic> shift) async {
    final notes = await _textDialog(context, 'Reconcile Shift',
        hint: 'Reconciliation notes', minLines: 4);
    if (notes == null) return;
    await ref
        .read(branchAccountantRepositoryProvider)
        .reconcileShift('${shift['id']}', notes);
    _toast('Shift reconciled');
    _refresh();
  }
}

class _CashierLogbooksSection extends ConsumerStatefulWidget {
  const _CashierLogbooksSection();

  @override
  ConsumerState<_CashierLogbooksSection> createState() =>
      _CashierLogbooksSectionState();
}

class _CashierLogbooksSectionState
    extends ConsumerState<_CashierLogbooksSection> {
  late Future<List<Map<String, dynamic>>> _future =
      ref.read(branchAccountantRepositoryProvider).getPendingCashierLogbooks();

  void _refresh() => setState(() => _future =
      ref.read(branchAccountantRepositoryProvider).getPendingCashierLogbooks());

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (items) => _Page(
          title: 'Cashier Logbooks',
          subtitle:
              'Audit submitted daily cashier logbooks and bill line entries.',
          actions: [_RefreshButton(onPressed: _refresh)],
          children: [
            _SectionCard(
              title: 'Pending Audit',
              child: _SimpleTable(
                columns: const [
                  'Date',
                  'Type',
                  'Cashier',
                  'Branch',
                  'Closing',
                  'Variance',
                  'Actions'
                ],
                rows: items
                    .map((e) => [
                          _text(e, ['log_date', 'date']),
                          _text(e, ['type']),
                          '${_text(_map(e['cashier']), [
                                'first_name'
                              ])} ${_text(_map(e['cashier']), ['last_name'])}'
                              .trim(),
                          _text(_map(e['branch']), ['name']),
                          _money(_num(e['closing_float'])),
                          _money(_num(e['variance'])),
                          Wrap(spacing: 8, children: [
                            TextButton(
                                onPressed: () => _showRecord(context, e),
                                child: const Text('View')),
                            FilledButton.tonal(
                                onPressed: () => _audit(e, true),
                                child: const Text('Approve')),
                            OutlinedButton(
                                onPressed: () => _audit(e, false),
                                child: const Text('Reject')),
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

class _PosVoidApprovalsSection extends ConsumerStatefulWidget {
  const _PosVoidApprovalsSection();

  @override
  ConsumerState<_PosVoidApprovalsSection> createState() =>
      _PosVoidApprovalsSectionState();
}

class _PosVoidApprovalsSectionState
    extends ConsumerState<_PosVoidApprovalsSection> {
  late Future<List<Map<String, dynamic>>> _future = _load();

  Future<List<Map<String, dynamic>>> _load() =>
      ref.read(branchAccountantRepositoryProvider).getPendingPosVoidRequests();

  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (items) => _Page(
          title: 'Void Approvals',
          subtitle:
              'Review waiter void requests before POS bills are cancelled.',
          actions: [_RefreshButton(onPressed: _refresh)],
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
            _SectionCard(
              title: 'Pending POS Voids',
              child: items.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.all(24),
                      child: Center(
                        child: Text(
                          'No pending void approvals',
                          style: TextStyle(color: AppColors.kTextSecondary),
                        ),
                      ),
                    )
                  : Column(
                      children: items
                          .map((item) => _ActionCard(
                                title:
                                    _text(item, ['order_number', 'bill_number'])
                                            .isEmpty
                                        ? 'POS bill'
                                        : _text(item,
                                            ['order_number', 'bill_number']),
                                subtitle:
                                    _text(item, ['outlet_name', 'reason']),
                                trailing: _StatusPill(
                                    _text(item, ['status']).isEmpty
                                        ? 'pending'
                                        : _text(item, ['status'])),
                                rows: {
                                  'Amount': _money(_num(item['total_amount'])),
                                  'Requested by': _text(item, [
                                    'requested_by_name',
                                    'requested_by_email'
                                  ]),
                                  'Branch': _text(item, ['branch_name']),
                                  'Reason': _text(item, ['reason']),
                                  'Requested at': _text(item, ['created_at']),
                                },
                                actions: [
                                  TextButton(
                                    onPressed: () => _showRecord(context, item),
                                    child: const Text('View'),
                                  ),
                                  FilledButton.tonal(
                                    onPressed: () => _review(item, true),
                                    child: const Text('Approve'),
                                  ),
                                  OutlinedButton(
                                    onPressed: () => _review(item, false),
                                    child: const Text('Reject'),
                                  ),
                                ],
                              ))
                          .toList(),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _review(Map<String, dynamic> request, bool approve) async {
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
    _refresh();
  }
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

  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (data) {
          final summary = _map(data['summary']);
          final txns = _list(data['transactions']);
          final accounts = _list(data['accounts']);
          final reconciliations = _list(data['reconciliations']);
          return _Page(
            title: 'Banking',
            subtitle:
                'Record deposits, approve banking transactions, and review bank reconciliations.',
            actions: [
              _Dropdown(
                value: _status,
                values: const ['all', 'PENDING', 'APPROVED', 'REJECTED'],
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
                _MetricCard('Transactions', '${txns.length}', Icons.receipt,
                    Colors.blue),
                _MetricCard(
                    'Total Amount',
                    _money(summary.containsKey('total_amount')
                        ? _num(summary['total_amount'])
                        : _sum(txns, 'amount')),
                    Icons.payments,
                    Colors.green),
                _MetricCard('Accounts', '${accounts.length}',
                    Icons.account_balance, Colors.indigo),
                _MetricCard('Reconciliations', '${reconciliations.length}',
                    Icons.fact_check, Colors.purple),
              ]),
              _SectionCard(
                title: 'Banking Transactions',
                child: _SimpleTable(
                  columns: const [
                    'Date',
                    'Type',
                    'Bank',
                    'Reference',
                    'Amount',
                    'Status',
                    'Actions'
                  ],
                  rows: txns
                      .map((e) => [
                            _text(e, ['transaction_date', 'created_at']),
                            _text(e, ['transaction_type']),
                            _text(e, ['bank_name']),
                            _text(e, ['reference_number']),
                            _money(_num(e['amount'])),
                            _StatusPill(_text(e, ['status'])),
                            Wrap(spacing: 8, children: [
                              TextButton(
                                  onPressed: () => _showRecord(context, e),
                                  child: const Text('View')),
                              if (_text(e, ['status']).toUpperCase() ==
                                  'PENDING')
                                FilledButton.tonal(
                                    onPressed: () => _approveTxn(e, true),
                                    child: const Text('Approve')),
                              if (_text(e, ['status']).toUpperCase() ==
                                  'PENDING')
                                OutlinedButton(
                                    onPressed: () => _approveTxn(e, false),
                                    child: const Text('Reject')),
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
    final data =
        await _formDialog(context, 'Record Banking Transaction', const [
      'transaction_date',
      'transaction_type',
      'bank_name',
      'account_number',
      'amount',
      'purpose_description',
      'reference_number',
      'notes',
    ]);
    if (data == null) return;
    await ref
        .read(branchAccountantRepositoryProvider)
        .recordBankingTransaction(data);
    _toast('Banking transaction recorded');
    _refresh();
  }

  Future<void> _approveTxn(Map<String, dynamic> txn, bool approve) async {
    final notes = await _textDialog(
      context,
      approve ? 'Approve Transaction' : 'Reject Transaction',
      hint: 'Notes',
    );
    if (notes == null) return;
    await ref
        .read(branchAccountantRepositoryProvider)
        .approveBankingTransaction(
          '${txn['id']}',
          approve: approve,
          notes: notes,
        );
    _toast(approve ? 'Transaction approved' : 'Transaction rejected');
    _refresh();
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
  late Future<Map<String, dynamic>> _future = _load();

  Future<Map<String, dynamic>> _load() async {
    final repo = ref.read(branchAccountantRepositoryProvider);
    final results = await Future.wait([
      repo.getFinanceInvoices(),
      repo.getFinanceTransactions(),
    ]);
    return {'invoices': results[0], 'transactions': results[1]};
  }

  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (data) {
          final invoices = _list(data['invoices']);
          final transactions = _list(data['transactions']);
          return _Page(
            title: 'Payments & Invoices',
            subtitle:
                'Accounts receivable invoices, balances, and finance transactions.',
            actions: [_RefreshButton(onPressed: _refresh)],
            children: [
              _ResponsiveGrid(children: [
                _MetricCard('Invoices', '${invoices.length}', Icons.receipt,
                    Colors.blue),
                _MetricCard(
                    'Invoice Total',
                    _money(_sum(invoices, 'total_amount')),
                    Icons.payments,
                    Colors.green),
                _MetricCard('Outstanding', _money(_sum(invoices, 'balance')),
                    Icons.warning, Colors.orange),
                _MetricCard('Transactions', '${transactions.length}',
                    Icons.sync_alt, Colors.purple),
              ]),
              _SectionCard(
                title: 'Invoices',
                child: _SimpleTable(
                  columns: const [
                    'Invoice',
                    'Customer',
                    'Short Code',
                    'Total',
                    'Paid',
                    'Balance',
                    'Status'
                  ],
                  rows: invoices
                      .map((e) => [
                            _text(e, ['invoice_number', 'id']),
                            _text(e, ['customer_name', 'customer']),
                            _text(e, ['short_code']),
                            _money(_num(e['total_amount'])),
                            _money(_num(e['paid_amount'])),
                            _money(_num(e['balance'])),
                            _StatusPill(_text(e, ['status'])),
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
  late Future<List<Map<String, dynamic>>> _future = _load();

  Future<List<Map<String, dynamic>>> _load() => ref
      .read(branchAccountantRepositoryProvider)
      .getCreditBills(status: _status);

  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (items) => _Page(
          title: 'Credit Bills',
          subtitle:
              'Review staff credit bills from cashier clearance and payroll deductions.',
          actions: [
            _Dropdown(
              value: _status,
              values: const ['all', 'pending', 'paid_cash', 'approved'],
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
                  'Bills', '${items.length}', Icons.credit_card, Colors.blue),
              _MetricCard('Total', _money(_sum(items, 'amount')),
                  Icons.payments, Colors.green),
              _MetricCard('Outstanding', _money(_sum(items, 'balance_amount')),
                  Icons.warning, Colors.orange),
            ]),
            _SectionCard(
              title: 'Credit Bill Ledger',
              child: _SimpleTable(
                columns: const [
                  'Staff',
                  'Description',
                  'Amount',
                  'Status',
                  'Date',
                  'Actions'
                ],
                rows: items
                    .map((e) => [
                          _text(e, ['staff_name', 'employee_name']),
                          _text(e, ['description', 'credit_number']),
                          _money(_num(e['amount'] ?? e['total_amount'])),
                          _StatusPill(_text(e, ['status'])),
                          _text(e, ['bill_date', 'created_at']),
                          Wrap(spacing: 8, children: [
                            TextButton(
                                onPressed: () => _showRecord(context, e),
                                child: const Text('View')),
                            FilledButton.tonal(
                                onPressed: () => _confirmBill(e),
                                child: const Text('Confirm')),
                            OutlinedButton(
                                onPressed: () => _recordPayment(e),
                                child: const Text('Paid Bill')),
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

  Future<void> _confirmBill(Map<String, dynamic> bill) async {
    final notes =
        await _textDialog(context, 'Confirm Credit Bill', hint: 'Notes');
    if (notes == null) return;
    await ref
        .read(branchAccountantRepositoryProvider)
        .confirmCreditBill('${bill['id']}', notes);
    _toast('Credit bill confirmed');
    _refresh();
  }

  Future<void> _recordPayment(Map<String, dynamic> bill) async {
    final data = await _formDialog(context, 'Record Paid Bill', const [
      'amount',
      'payment_method',
      'reference',
      'notes',
    ]);
    if (data == null) return;
    await ref
        .read(branchAccountantRepositoryProvider)
        .recordCreditBillPayment('${bill['id']}', data);
    _toast('Paid bill recorded');
    _refresh();
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

  void _refresh() => setState(() => _future =
      ref.read(branchAccountantRepositoryProvider).getPendingFoodVariances());

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

  void _refresh() => setState(() => _future = _load());

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
  late Future<List<Map<String, dynamic>>> _future =
      ref.read(branchAccountantRepositoryProvider).getFinanceInvoices();

  void _refresh() => setState(() => _future =
      ref.read(branchAccountantRepositoryProvider).getFinanceInvoices());

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: _refresh,
        builder: (items) => _Page(
          title: 'Bookings & Invoices',
          subtitle:
              'Branch invoice queue for hotel bookings, restaurant bills, catering, and conference revenue.',
          actions: [_RefreshButton(onPressed: _refresh)],
          children: [
            _SectionCard(
              title: 'Invoice Register',
              child: _SimpleTable(
                columns: const [
                  'Invoice',
                  'Customer',
                  'Source',
                  'Total',
                  'Balance',
                  'Status'
                ],
                rows: items
                    .map((e) => [
                          _text(e,
                              ['invoice_number', 'confirmation_number', 'id']),
                          _text(e, ['customer_name', 'guest_name']),
                          _text(e, ['source', 'invoice_type']),
                          _money(_num(e['total_amount'])),
                          _money(_num(e['balance'])),
                          _StatusPill(_text(e, ['status'])),
                        ])
                    .toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StockTakeSection extends ConsumerWidget {
  const _StockTakeSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: ref.read(branchAccountantRepositoryProvider).getStockTakes(),
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: () {},
        builder: (items) => _Page(
          title: 'Stock Takes',
          subtitle:
              'Daily branch stock takes submitted by storekeepers for accountant review and auditor flow.',
          actions: const [],
          children: [
            _ResponsiveGrid(children: [
              _MetricCard(
                  'Sessions', '${items.length}', Icons.inventory, Colors.blue),
              _MetricCard(
                  'Draft',
                  '${items.where((e) => _text(e, [
                            'status'
                          ]).toLowerCase() == 'draft').length}',
                  Icons.edit_note,
                  Colors.orange),
              _MetricCard(
                  'Submitted',
                  '${items.where((e) => _text(e, [
                            'status'
                          ]).toLowerCase().contains('submit')).length}',
                  Icons.send,
                  Colors.green),
            ]),
            _SectionCard(
              title: 'Stock Take Register',
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
                          '${e['items_count'] ?? e['item_count'] ?? 0}',
                          TextButton(
                              onPressed: () => _showRecord(context, e),
                              child: const Text('Review')),
                        ])
                    .toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PurchasesSection extends ConsumerWidget {
  const _PurchasesSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repo = ref.read(branchAccountantRepositoryProvider);
    return FutureBuilder<Map<String, dynamic>>(
      future: Future.wait([
        repo.getPurchaseOrders(),
        repo.getSupplierInvoices(),
        repo.getSupplierPayments(),
      ]).then((r) => {'pos': r[0], 'invoices': r[1], 'payments': r[2]}),
      builder: (context, snap) => _FuturePage(
        snapshot: snap,
        onRefresh: () {},
        builder: (data) {
          final pos = _list(data['pos']);
          final invoices = _list(data['invoices']);
          final payments = _list(data['payments']);
          return _Page(
            title: 'Purchases',
            subtitle:
                'Purchase orders, supplier invoices, and supplier payments for branch accounting.',
            actions: const [],
            children: [
              _ResponsiveGrid(children: [
                _MetricCard('Purchase Orders', '${pos.length}',
                    Icons.shopping_cart, Colors.blue),
                _MetricCard('Supplier Invoices', '${invoices.length}',
                    Icons.receipt_long, Colors.orange),
                _MetricCard('Supplier Payments', '${payments.length}',
                    Icons.payments, Colors.green),
              ]),
              _SectionCard(
                title: 'Purchase Orders',
                child: _SimpleTable(
                  columns: const ['PO', 'Supplier', 'Total', 'Status', 'Date'],
                  rows: pos
                      .map((e) => [
                            _text(e,
                                ['po_number', 'purchase_order_number', 'id']),
                            _text(e, ['supplier_name']),
                            _money(_num(e['total_amount'])),
                            _StatusPill(_text(e, ['status'])),
                            _text(e, ['created_at', 'order_date']),
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

class _BuffetSection extends ConsumerStatefulWidget {
  const _BuffetSection();

  @override
  ConsumerState<_BuffetSection> createState() => _BuffetSectionState();
}

class _BuffetSectionState extends ConsumerState<_BuffetSection> {
  late Future<List<Map<String, dynamic>>> _future =
      ref.read(branchAccountantRepositoryProvider).getBuffets();

  void _refresh() => setState(() =>
      _future = ref.read(branchAccountantRepositoryProvider).getBuffets());

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

  void _refresh() => setState(() => _future =
      ref.read(branchAccountantRepositoryProvider).getCateringEvents());

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

  void _refresh() => setState(() => _future = _load());

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
  const _DailyEntryDialog({required this.existing, this.isReadOnly = false});
  final Map<String, dynamic> existing;
  final bool isReadOnly;

  @override
  ConsumerState<_DailyEntryDialog> createState() => _DailyEntryDialogState();
}

class _DailyEntryDialogState extends ConsumerState<_DailyEntryDialog> {
  int _tab = 0;
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
            const SizedBox(height: 8),
            Expanded(child: SingleChildScrollView(child: _tabBody(isReadOnly))),
            const Divider(),
            _KeyValueList({
              'Total Revenue': _money(_total(_revenueFields)),
              'Total Payments':
                  _money(_total(const ['cash', 'mpesa', 'swipe'])),
              'Payment Variance': _money(
                  _total(const ['cash', 'mpesa', 'swipe']) -
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
          : [
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
            _fieldGrid(const ['cash', 'mpesa', 'swipe'], readOnly),
            const SizedBox(height: 8),
            Builder(builder: (_) {
              final totalPay = _total(const ['cash', 'mpesa', 'swipe']);
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
                  decoration: InputDecoration(labelText: _title(field)),
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

  Future<void> _save(String status) async {
    final totalRevenue = _total(_revenueFields);
    final totalPayments = _total(const ['cash', 'mpesa', 'swipe']);
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
    await ref.read(branchAccountantRepositoryProvider).saveDailyRecord({
      'record_date': _recordDate,
      'status': status,
      'revenue_data': {for (final f in _revenueFields) f: _numText(f)},
      'total_revenue': totalRevenue,
      'payment_data': {
        'cash': _numText('cash'),
        'mpesa': _numText('mpesa'),
        'swipe': _numText('swipe'),
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
      'net_profit': totalRevenue - totalCogs - totalExpenses,
      'notes': _controllers['notes']?.text,
    });
    if (mounted) Navigator.pop(context, true);
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
        padding: const EdgeInsets.all(24),
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
          padding: const EdgeInsets.all(24),
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
    final width = MediaQuery.of(context).size.width;
    final count = width > 1400
        ? 6
        : width > 1000
            ? 3
            : width > 650
                ? 2
                : 1;
    return GridView.count(
      crossAxisCount: count,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: width < 650 ? 4.5 : 2.6,
      children: children,
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
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
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
                children: [
                  Text(label,
                      style: const TextStyle(
                          color: AppColors.kTextSecondary, fontSize: 12)),
                  const SizedBox(height: 4),
                  Text(value,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.w800)),
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
  const _SectionCard({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
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
            Text(title,
                style:
                    const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            child,
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
                  children: [
                    Expanded(child: Text(_title(entry.key))),
                    const SizedBox(width: 12),
                    Text(
                      entry.value is num
                          ? _money(_num(entry.value))
                          : '${entry.value}',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
              ))
          .toList(),
    );
  }
}

class _SimpleTable extends StatelessWidget {
  const _SimpleTable({required this.columns, required this.rows});
  final List<String> columns;
  final List<List<Object>> rows;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: Center(
          child: Text('No records found',
              style: TextStyle(color: AppColors.kTextSecondary)),
        ),
      );
    }
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
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
  });
  final String title;
  final String subtitle;
  final Map<String, String> rows;
  final Widget? trailing;
  final List<Widget> actions;

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
          if (actions.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(spacing: 8, children: actions),
          ],
        ]),
      ),
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
  List<String> fields,
) {
  final controllers = {
    for (final f in fields) f: TextEditingController(),
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

void _showRecord(BuildContext context, Map<String, dynamic> record) {
  showDialog(
    context: context,
    builder: (_) => AlertDialog(
      title: const Text('Record Details'),
      content: SizedBox(
        width: 680,
        child: SingleChildScrollView(child: _KeyValueList(_flatten(record))),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Close'),
        ),
      ],
    ),
  );
}

Map<String, String> _flatten(Map<String, dynamic> record) {
  final out = <String, String>{};
  for (final entry in record.entries) {
    final value = entry.value;
    if (value == null || '$value' == 'null') continue;
    if (value is Map) {
      for (final child in value.entries) {
        final childValue = child.value;
        if (childValue != null && '$childValue' != 'null') {
          out['${_title(entry.key)} ${_title('${child.key}')}'] = '$childValue';
        }
      }
    } else if (value is List) {
      out[_title(entry.key)] = '${value.length} records';
    } else {
      out[_title(entry.key)] = '$value';
    }
  }
  return out;
}

IconData _icon(BranchAccountantSection section) =>
    _navItems.firstWhere((item) => item.section == section).icon;

String _label(BranchAccountantSection section) =>
    _navItems.firstWhere((item) => item.section == section).label;

String _shortLabel(BranchAccountantSection section) {
  switch (section) {
    case BranchAccountantSection.cashierClearance:
      return 'Cashier';
    case BranchAccountantSection.financialWorkspace:
      return 'Workspace';
    case BranchAccountantSection.discrepancies:
      return 'Flags';
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

  doc.addPage(
    pw.MultiPage(
      pageFormat: PdfPageFormat.a4.landscape,
      margin: const pw.EdgeInsets.all(24),
      build: (context) => [
        pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text('FAMOUS GATES HOTELS',
                    style: pw.TextStyle(
                        fontSize: 16, fontWeight: pw.FontWeight.bold)),
                pw.SizedBox(height: 4),
                pw.Text('Bomet, Kenya | 0706782828'),
              ],
            ),
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.end,
              children: [
                pw.Text(title,
                    style: pw.TextStyle(
                        fontSize: 22, fontWeight: pw.FontWeight.bold)),
                pw.SizedBox(height: 4),
                pw.Text(subtitle),
                pw.Text('Generated: $generated'),
              ],
            ),
          ],
        ),
        pw.SizedBox(height: 16),
        pw.Divider(),
        if (metrics.isNotEmpty) ...[
          pw.SizedBox(height: 10),
          pw.Wrap(
            spacing: 8,
            runSpacing: 8,
            children: metrics.entries
                .map(
                  (entry) => pw.Container(
                    width: 170,
                    padding: const pw.EdgeInsets.all(8),
                    decoration: pw.BoxDecoration(
                      color: PdfColors.grey100,
                      border: pw.Border.all(color: PdfColors.grey300),
                    ),
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text(entry.key,
                            style: const pw.TextStyle(
                                fontSize: 9, color: PdfColors.grey700)),
                        pw.SizedBox(height: 3),
                        pw.Text(entry.value,
                            style: pw.TextStyle(
                                fontSize: 11, fontWeight: pw.FontWeight.bold)),
                      ],
                    ),
                  ),
                )
                .toList(),
          ),
        ],
        for (final section in sections.entries) ...[
          pw.SizedBox(height: 16),
          pw.Text(section.key,
              style:
                  pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 6),
          pw.TableHelper.fromTextArray(
            headers: const ['Item', 'Value'],
            data: section.value.entries
                .map((entry) => [
                      _title(entry.key),
                      entry.value is num
                          ? _money(_num(entry.value))
                          : '${entry.value}'
                    ])
                .toList(),
            headerStyle: pw.TextStyle(fontWeight: pw.FontWeight.bold),
            headerDecoration: const pw.BoxDecoration(color: PdfColors.grey300),
            cellStyle: const pw.TextStyle(fontSize: 9),
          ),
        ],
        if (tableHeaders.isNotEmpty) ...[
          pw.SizedBox(height: 16),
          pw.TableHelper.fromTextArray(
            headers: tableHeaders,
            data: tableRows,
            headerStyle:
                pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold),
            headerDecoration: const pw.BoxDecoration(color: PdfColors.grey300),
            cellStyle: const pw.TextStyle(fontSize: 8),
            cellAlignment: pw.Alignment.centerLeft,
          ),
        ],
      ],
      footer: (context) => pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text('Famous Gates Hotels - Branch Accountant',
              style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600)),
          pw.Text('Page ${context.pageNumber} of ${context.pagesCount}',
              style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600)),
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
