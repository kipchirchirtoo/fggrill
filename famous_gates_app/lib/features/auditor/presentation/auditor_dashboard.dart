import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/screen_size.dart';
import '../../../core/widgets/widgets.dart';
import '../domain/providers.dart';
import '../domain/models.dart';
import '../data/repository.dart';
import 'branch_orders_tab.dart';
import 'auditor_sections.dart';
import 'daily_close_review_screen.dart';
import '../../lina/presentation/lina_screen.dart';
import '../../shared/widgets/inventory_control_center_screen.dart';
import '../../../core/widgets/branch_sales_payments_view.dart';

class AuditorDashboard extends ConsumerStatefulWidget {
  const AuditorDashboard({super.key});
  @override
  ConsumerState<AuditorDashboard> createState() => _AuditorDashboardState();
}

class _AuditorDashboardState extends ConsumerState<AuditorDashboard> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final pendingCount =
        ref.watch(pendingStockRequestCountProvider).valueOrNull ?? 0;

    return DashboardShell(
      title: 'Audit Control',
      currentTab: _tab,
      onTabChanged: (i) => setState(() => _tab = i),
      tabs: [
        DashboardTab(
            label: 'Audit Control',
            icon: PhosphorIcons.shieldCheck(),
            content: _AuditorOverviewTab(
                onGoToApprovals: () => setState(() => _tab = 2))),
        DashboardTab(
            label: 'Daily Close Review',
            icon: PhosphorIcons.clipboardText(),
            content: const DailyCloseReviewScreen()),
        DashboardTab(
            label: 'Sales & Payments',
            icon: PhosphorIcons.creditCard(),
            content: const BranchSalesPaymentsView()),
        DashboardTab(
            label: 'Branch Approvals',
            icon: PhosphorIcons.clipboardText(),
            content: const BranchOrdersTab(),
            badgeCount: pendingCount),
        DashboardTab(
            label: 'Audit Logs',
            icon: PhosphorIcons.listBullets(),
            content: const _AuditLogsTab()),
        DashboardTab(
            label: 'Financial Sync',
            icon: PhosphorIcons.creditCard(),
            content: const AuditorFinancialVerificationSection()),
        DashboardTab(
            label: 'Reconciliation',
            icon: PhosphorIcons.arrowsClockwise(),
            content: const _ReconciliationTab()),
        DashboardTab(
            label: 'Revenue Audit',
            icon: PhosphorIcons.chartLine(),
            content: const AuditorSalesAuditSection()),
        DashboardTab(
            label: 'Revenue Oversight',
            icon: PhosphorIcons.chartPie(),
            content: const AuditorRevenueOversightSection()),
        DashboardTab(
            label: 'Invoices',
            icon: PhosphorIcons.receipt(),
            content: const AuditorInvoicesSection()),
        DashboardTab(
            label: 'Credit Bills',
            icon: PhosphorIcons.creditCard(),
            content: const AuditorCreditBillsSection()),
        DashboardTab(
            label: 'Cashier Logbooks',
            icon: PhosphorIcons.notebook(),
            content: const AuditorCashierLogbooksSection()),
        DashboardTab(
            label: 'Void Bills',
            icon: PhosphorIcons.prohibit(),
            content: const AuditorVoidBillsSection()),
        DashboardTab(
            label: 'Stock Audit',
            icon: PhosphorIcons.warehouse(),
            content: const AuditorStockAuditSection()),
        DashboardTab(
            label: 'Sold Items',
            icon: PhosphorIcons.shoppingCart(),
            content: const AuditorSoldItemsSection()),
        DashboardTab(
            label: 'Purchases',
            icon: PhosphorIcons.shoppingBag(),
            content: const AuditorPurchasesSection()),
        DashboardTab(
            label: 'Deliveries',
            icon: PhosphorIcons.truck(),
            content: const AuditorDeliveriesSection()),
        DashboardTab(
            label: 'Staff Audit',
            icon: PhosphorIcons.users(),
            content: const AuditorStaffAuditSection()),
        DashboardTab(
            label: 'Payroll Audit',
            icon: PhosphorIcons.money(),
            content: const AuditorPayrollApprovalsSection()),
        DashboardTab(
            label: 'Auditor Approvals',
            icon: PhosphorIcons.checkCircle(),
            content: const AuditorApprovalsSection()),
        DashboardTab(
            label: 'Kitchen Usage',
            icon: PhosphorIcons.cookingPot(),
            content: const AuditorKitchenUsageSection()),
        DashboardTab(
            label: 'Kitchen Wastage',
            icon: PhosphorIcons.trash(),
            content: const AuditorKitchenWastageSection()),
        DashboardTab(
            label: 'Kitchen Ledger',
            icon: PhosphorIcons.listChecks(),
            content: const AuditorKitchenLedgerSection()),
        DashboardTab(
            label: 'Banking Review',
            icon: PhosphorIcons.bank(),
            content: const AuditorBankingLogsSection()),
        DashboardTab(
            label: 'Discrepancies',
            icon: PhosphorIcons.warning(),
            content: const AuditorDiscrepanciesSection()),
        const DashboardTab(
            label: 'Outlet & Production',
            icon: Icons.fact_check_outlined,
            content: InventoryControlCenterScreen(
              title: 'Outlet & Production',
              subtitle:
                  'Audit outlet stock, production output, consumption movement and variance controls.',
              role: 'auditor',
              initialTab: InventoryControlInitialTab.outletProduction,
              allowGovernanceReview: true,
            )),
        DashboardTab(
            label: 'Central Store',
            icon: PhosphorIcons.warehouse(),
            content: const _CentralStoreInventoryTab()),
        DashboardTab(
            label: 'Reports',
            icon: PhosphorIcons.fileArrowDown(),
            content: const AuditorReportExportsSection()),
        DashboardTab(
            label: 'Lina AI',
            icon: PhosphorIcons.sparkle(),
            content: const LinaScreen()),
      ],
    );
  }
}

class _AuditorOverviewTab extends ConsumerWidget {
  const _AuditorOverviewTab({this.onGoToApprovals});
  final VoidCallback? onGoToApprovals;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overviewAsync = ref.watch(auditOverviewProvider);
    final discrepanciesAsync = ref.watch(discrepanciesProvider);
    final pendingCount =
        ref.watch(pendingStockRequestCountProvider).valueOrNull ?? 0;

    return SingleChildScrollView(
      padding: ScreenSize.p(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Pending stock approvals banner ─────────────────────────────
          if (pendingCount > 0)
            GestureDetector(
              onTap: onGoToApprovals,
              child: Container(
                margin: const EdgeInsets.only(bottom: 20),
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                decoration: BoxDecoration(
                  color: AppColors.kWarning.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                      color: AppColors.kWarning.withValues(alpha: 0.4)),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.kWarning.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(PhosphorIcons.clipboardText(),
                          color: AppColors.kWarning, size: 20),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '$pendingCount Branch Stock Request${pendingCount == 1 ? '' : 's'} Awaiting Approval',
                            style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                                color: AppColors.kTextPrimary),
                          ),
                          const SizedBox(height: 2),
                          const Text(
                            'Tap to review and approve or reject branch orders.',
                            style: TextStyle(
                                fontSize: 12, color: AppColors.kTextSecondary),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.arrow_forward_ios_rounded,
                        size: 14, color: AppColors.kWarning),
                  ],
                ),
              ),
            ),

          // ── Stat cards ────────────────────────────────────────────────
          overviewAsync.when(
            data: (stats) => Row(
              children: [
                _AuditStatCard(
                    label: 'Voided Orders',
                    value: '${stats.voidBills}',
                    icon: PhosphorIcons.prohibit(),
                    color: AppColors.kError),
                const SizedBox(width: 16),
                _AuditStatCard(
                    label: 'High Risk Findings',
                    value: '${stats.priceOverrides}',
                    icon: PhosphorIcons.pencilLine(),
                    color: AppColors.kWarning),
                const SizedBox(width: 16),
                _AuditStatCard(
                    label: 'Pending Reviews',
                    value: '${stats.largeDiscounts}',
                    icon: PhosphorIcons.tag(),
                    color: AppColors.kWarning),
              ],
            ),
            loading: () => const Row(children: [
              Expanded(child: LoadingSkeleton(type: SkeletonType.card)),
              SizedBox(width: 16),
              Expanded(child: LoadingSkeleton(type: SkeletonType.card)),
              SizedBox(width: 16),
              Expanded(child: LoadingSkeleton(type: SkeletonType.card)),
            ]),
            error: (e, _) => ErrorState(
                message: '$e',
                onRetry: () => ref.invalidate(auditOverviewProvider)),
          ),
          const SizedBox(height: 32),
          _ExceptionsList(discrepanciesAsync: discrepanciesAsync),
        ],
      ),
    );
  }
}

class _ExceptionsList extends ConsumerWidget {
  final AsyncValue<List<Discrepancy>> discrepanciesAsync;
  const _ExceptionsList({required this.discrepanciesAsync});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      child: Padding(
        padding: ScreenSize.p(context),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Recent Exceptions',
                    style:
                        TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                ElevatedButton.icon(
                  onPressed: () async {
                    try {
                      await ref
                          .read(auditorRepositoryProvider)
                          .exportAuditReport('exceptions');
                      if (context.mounted) {
                        AppNotifier.showSnackBar(
                            context,
                            const SnackBar(
                                content: Text('Audit report export started')));
                      }
                    } catch (e) {
                      if (context.mounted) {
                        AppNotifier.showSnackBar(
                            context, SnackBar(content: Text('Error: $e')));
                      }
                    }
                  },
                  icon: const Icon(Icons.download),
                  label: const Text('Export Report'),
                ),
              ],
            ),
            const SizedBox(height: 24),
            discrepanciesAsync.when(
              data: (items) => items.isEmpty
                  ? const EmptyState(
                      message:
                          'No critical findings. The system is currently operating within normal parameters.')
                  : ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: items.length,
                      separatorBuilder: (_, __) => const Divider(),
                      itemBuilder: (ctx, i) {
                        final d = items[i];
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(
                              d.type == 'void'
                                  ? Icons.cancel
                                  : Icons.warning_amber_rounded,
                              color: d.type == 'void'
                                  ? AppColors.kError
                                  : AppColors.kWarning),
                          title: Text(d.description),
                          subtitle:
                              Text('${d.userName ?? ''} • ${d.amount ?? ''}'),
                          trailing: TextButton(
                            onPressed: () =>
                                _showInvestigateDialog(context, ref, d),
                            child: const Text('Investigate'),
                          ),
                        );
                      },
                    ),
              loading: () => const LoadingSkeleton(type: SkeletonType.list),
              error: (e, _) => ErrorState(message: '$e'),
            ),
          ],
        ),
      ),
    );
  }

  void _showInvestigateDialog(
      BuildContext context, WidgetRef ref, Discrepancy d) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Investigate Exception'),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Type: ${d.type}'),
              Text('Description: ${d.description}'),
              if (d.amount != null) Text('Amount: ${d.amount}'),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: () {
                  ref
                      .read(auditorRepositoryProvider)
                      .clearAnomaly(d.id, 'Reviewed');
                  Navigator.pop(ctx);
                },
                icon: const Icon(Icons.check_circle, color: AppColors.kSuccess),
                label: const Text('Clear & Approve'),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () {
                  ref
                      .read(auditorRepositoryProvider)
                      .flagItem(d.type, d.id, 'Flagged for review');
                  Navigator.pop(ctx);
                },
                icon: const Icon(Icons.flag, color: AppColors.kError),
                label: const Text('Flag as Issue'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Close'))
        ],
      ),
    );
  }
}

final _auditLogFiltersProvider =
    StateProvider<Map<String, String?>>((ref) => const {});

class _AuditLogsTab extends ConsumerWidget {
  const _AuditLogsTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filters = ref.watch(_auditLogFiltersProvider);
    final logsAsync = ref.watch(auditLogsFilteredProvider(filters));
    return Padding(
      padding: ScreenSize.p(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Audit Logs', style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 16),
          Row(
            children: [
              DropdownButton<String?>(
                value: filters['severity'],
                hint: const Text('Severity'),
                items: const [
                  DropdownMenuItem(value: null, child: Text('All')),
                  DropdownMenuItem(value: 'critical', child: Text('Critical')),
                  DropdownMenuItem(value: 'high', child: Text('High')),
                  DropdownMenuItem(value: 'medium', child: Text('Medium')),
                  DropdownMenuItem(value: 'low', child: Text('Low')),
                ],
                onChanged: (v) => ref
                    .read(_auditLogFiltersProvider.notifier)
                    .state = {...filters, 'severity': v},
              ),
              const SizedBox(width: 12),
              if (filters['severity'] != null)
                TextButton(
                    onPressed: () => ref
                        .read(_auditLogFiltersProvider.notifier)
                        .state = const {},
                    child: const Text('Clear')),
            ],
          ),
          const SizedBox(height: 12),
          Expanded(
            child: logsAsync.when(
              data: (logs) => logs.isEmpty
                  ? const EmptyState(message: 'No audit logs found')
                  : ListView.separated(
                      itemCount: logs.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (_, i) {
                        final log = logs[i];
                        final isCritical = log.severity == 'critical' ||
                            log.severity == 'high';
                        return ListTile(
                          dense: true,
                          leading: Icon(
                              isCritical ? Icons.error : Icons.info_outline,
                              size: 18,
                              color: isCritical
                                  ? AppColors.kError
                                  : AppColors.kTextSecondary),
                          title: Text(log.action,
                              style: const TextStyle(fontSize: 14)),
                          subtitle: Text(
                            '${log.userName ?? ''}${log.createdAt != null ? ' • ${log.createdAt!.day}/${log.createdAt!.month} ${log.createdAt!.hour.toString().padLeft(2, '0')}:${log.createdAt!.minute.toString().padLeft(2, '0')}' : ''}'
                            '${log.severity != null ? ' • ${log.severity}' : ''}',
                            style: const TextStyle(fontSize: 12),
                          ),
                        );
                      },
                    ),
              loading: () => const LoadingSkeleton(type: SkeletonType.list),
              error: (e, _) => ErrorState(
                  message: '$e',
                  onRetry: () =>
                      ref.invalidate(auditLogsFilteredProvider(filters))),
            ),
          ),
        ],
      ),
    );
  }
}

final _reconciliationFiltersProvider =
    StateProvider<Map<String, String?>>((ref) => const {});

class _ReconciliationTab extends ConsumerWidget {
  const _ReconciliationTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filters = ref.watch(_reconciliationFiltersProvider);
    final recoAsync = ref.watch(auditorReconciliationProvider(filters));
    return Padding(
      padding: ScreenSize.p(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Reconciliation',
              style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 16),
          Row(
            children: [
              OutlinedButton.icon(
                onPressed: () async {
                  final picked = await showDateRangePicker(
                      context: context,
                      firstDate: DateTime(2024),
                      lastDate: DateTime(2027));
                  if (picked != null) {
                    ref.read(_reconciliationFiltersProvider.notifier).state = {
                      'start_date':
                          '${picked.start.year}-${picked.start.month.toString().padLeft(2, '0')}-${picked.start.day.toString().padLeft(2, '0')}',
                      'end_date':
                          '${picked.end.year}-${picked.end.month.toString().padLeft(2, '0')}-${picked.end.day.toString().padLeft(2, '0')}',
                    };
                  }
                },
                icon: const Icon(Icons.date_range, size: 16),
                label: Text(filters['start_date'] != null
                    ? '${filters['start_date']} → ${filters['end_date']}'
                    : 'Date Range'),
              ),
              const SizedBox(width: 12),
              if (filters['start_date'] != null)
                TextButton(
                    onPressed: () => ref
                        .read(_reconciliationFiltersProvider.notifier)
                        .state = const {},
                    child: const Text('Clear')),
            ],
          ),
          const SizedBox(height: 12),
          Expanded(
            child: recoAsync.when(
              data: (rows) => rows.isEmpty
                  ? const EmptyState(message: 'No reconciliation records found')
                  : ListView.separated(
                      itemCount: rows.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (_, i) {
                        final r = rows[i];
                        final variance =
                            (r['variance'] ?? r['difference'] ?? 0);
                        final varianceNum = variance is num
                            ? variance.toDouble()
                            : double.tryParse('$variance') ?? 0;
                        return ListTile(
                          leading: CircleAvatar(
                            backgroundColor: (varianceNum != 0
                                    ? AppColors.kError
                                    : AppColors.kSuccess)
                                .withValues(alpha: 0.1),
                            child: Icon(
                                varianceNum != 0
                                    ? Icons.warning_amber
                                    : Icons.check_circle,
                                color: varianceNum != 0
                                    ? AppColors.kError
                                    : AppColors.kSuccess,
                                size: 18),
                          ),
                          title: Text(
                              (r['period'] ??
                                      r['date'] ??
                                      r['description'] ??
                                      '—')
                                  .toString(),
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Text(
                              'Expected: KES ${(r['expected'] ?? 0)}  •  Actual: KES ${(r['actual'] ?? 0)}'),
                          trailing: Text(
                            '${varianceNum >= 0 ? '+' : ''}${varianceNum.toStringAsFixed(0)}',
                            style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: varianceNum != 0
                                    ? AppColors.kError
                                    : AppColors.kSuccess),
                          ),
                        );
                      },
                    ),
              loading: () => const LoadingSkeleton(type: SkeletonType.list),
              error: (e, _) => ErrorState(
                  message: '$e',
                  onRetry: () =>
                      ref.invalidate(auditorReconciliationProvider(filters))),
            ),
          ),
        ],
      ),
    );
  }
}

class _AuditStatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _AuditStatCard(
      {required this.label,
      required this.value,
      required this.icon,
      required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 16),
            Text(value,
                style: TextStyle(
                    fontSize: 28, fontWeight: FontWeight.bold, color: color)),
            Text(label,
                style: TextStyle(
                    color: color.withValues(alpha: 0.8),
                    fontSize: 12,
                    fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────── CENTRAL STORE INVENTORY TAB ────────────────────────

class _CentralStoreInventoryTab extends ConsumerStatefulWidget {
  const _CentralStoreInventoryTab();

  @override
  ConsumerState<_CentralStoreInventoryTab> createState() =>
      _CentralStoreInventoryTabState();
}

class _CentralStoreInventoryTabState
    extends ConsumerState<_CentralStoreInventoryTab> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = false;
  String _error = '';
  String _search = '';
  String _categoryFilter = 'all';

  static const _categories = [
    'all',
    'Foodstuffs',
    'Beverages',
    'Perishable goods',
    'Vegetables',
    'Fruits',
    'Cleaning',
    'Stationery',
    'Gas',
    'Other',
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final repo = ref.read(auditorRepositoryProvider);
      final data = await repo.getCentralStoreInventory();
      if (mounted) setState(() => _items = data);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  num _toNum(dynamic v) {
    if (v is num) return v;
    return num.tryParse('$v') ?? 0;
  }

  List<Map<String, dynamic>> get _filtered {
    final q = _search.toLowerCase();
    return _items.where((item) {
      final cat = '${item['category'] ?? ''}';
      if (_categoryFilter != 'all' && cat != _categoryFilter) return false;
      if (q.isEmpty) return true;
      return '${item['item_name'] ?? item['name'] ?? ''}'.toLowerCase().contains(q) ||
          '${item['sku'] ?? ''}'.toLowerCase().contains(q) ||
          cat.toLowerCase().contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    final total = _items.length;
    final outOfStock = _items.where((i) => _toNum(i['quantity']) <= 0).length;
    final lowStock = _items
        .where((i) =>
            _toNum(i['quantity']) > 0 &&
            _toNum(i['quantity']) <=
                _toNum(i['reorder_level'] ?? i['min_quantity'] ?? 0))
        .length;
    final inStock = total - outOfStock - lowStock;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              const Icon(Icons.warehouse_outlined,
                  color: AppColors.kPrimary, size: 24),
              const SizedBox(width: 10),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Central Store Inventory',
                        style: TextStyle(
                            fontSize: 18, fontWeight: FontWeight.w800)),
                    Text(
                      'Read-only view of central warehouse stock levels. '
                      'Branch requests are fulfilled from this store.',
                      style: TextStyle(
                          fontSize: 12, color: AppColors.kTextSecondary),
                    ),
                  ],
                ),
              ),
              IconButton.filled(
                onPressed: _load,
                icon: _loading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.refresh),
                tooltip: 'Refresh',
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (_error.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.red.shade200),
              ),
              child: Text(_error,
                  style: TextStyle(color: Colors.red.shade800)),
            ),
          // Stats row
          Row(
            children: [
              _CentralStat(
                  label: 'Total SKUs',
                  value: '$total',
                  icon: Icons.inventory_2_outlined,
                  color: AppColors.kPrimary),
              const SizedBox(width: 8),
              _CentralStat(
                  label: 'In Stock',
                  value: '$inStock',
                  icon: Icons.check_circle_outline,
                  color: Colors.green),
              const SizedBox(width: 8),
              _CentralStat(
                  label: 'Low Stock',
                  value: '$lowStock',
                  icon: Icons.warning_amber_outlined,
                  color: Colors.orange),
              const SizedBox(width: 8),
              _CentralStat(
                  label: 'Out of Stock',
                  value: '$outOfStock',
                  icon: Icons.cancel_outlined,
                  color: Colors.red),
            ],
          ),
          const SizedBox(height: 14),
          // Search + filter
          Row(
            children: [
              Expanded(
                child: TextField(
                  onChanged: (v) => setState(() => _search = v),
                  decoration: const InputDecoration(
                    hintText: 'Search by name, SKU or category…',
                    prefixIcon: Icon(Icons.search),
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              SizedBox(
                width: 200,
                child: DropdownButtonFormField<String>(
                  isExpanded: true,
                  value: _categoryFilter,
                  decoration: const InputDecoration(
                      isDense: true,
                      border: OutlineInputBorder(),
                      labelText: 'Category'),
                  items: _categories
                      .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (v) =>
                      v != null ? setState(() => _categoryFilter = v) : null,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Table
          if (_loading && _items.isEmpty)
            const Center(
                child: Padding(
                    padding: EdgeInsets.all(32),
                    child: CircularProgressIndicator()))
          else
            Container(
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey.shade200),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                children: [
                  // Table header
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: AppColors.kPrimary,
                      borderRadius:
                          const BorderRadius.vertical(top: Radius.circular(8)),
                    ),
                    child: const Row(
                      children: [
                        Expanded(
                            flex: 3,
                            child: Text('Item',
                                style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 12))),
                        Expanded(
                            flex: 2,
                            child: Text('SKU',
                                style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 12))),
                        Expanded(
                            child: Text('Category',
                                style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 12))),
                        Expanded(
                            child: Text('Unit',
                                style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 12))),
                        SizedBox(
                            width: 110,
                            child: Text('In Stock',
                                textAlign: TextAlign.right,
                                style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 12))),
                        SizedBox(
                            width: 90,
                            child: Text('Cost Price',
                                textAlign: TextAlign.right,
                                style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 12))),
                        SizedBox(
                            width: 80,
                            child: Text('Status',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 12))),
                      ],
                    ),
                  ),
                  if (filtered.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(24),
                      child: Center(
                          child: Text('No items found',
                              style: TextStyle(color: Colors.grey))),
                    )
                  else
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: filtered.length,
                      separatorBuilder: (_, __) =>
                          Divider(height: 1, color: Colors.grey.shade100),
                      itemBuilder: (ctx, i) {
                        final item = filtered[i];
                        final qty = _toNum(item['quantity'] ?? 0);
                        final reorder = _toNum(
                            item['reorder_level'] ?? item['min_quantity'] ?? 0);
                        final isZero = qty <= 0;
                        final isLow = !isZero && qty <= reorder;
                        final cost = _toNum(
                            item['cost_price'] ?? item['unit_cost'] ?? 0);
                        final unit = item['unit_of_measure'] ??
                            item['unit'] ??
                            'units';
                        return Container(
                          color: isZero
                              ? Colors.red.shade50
                              : isLow
                                  ? Colors.orange.shade50
                                  : (i.isEven
                                      ? Colors.white
                                      : Colors.grey.shade50),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 10),
                          child: Row(
                            children: [
                              Expanded(
                                flex: 3,
                                child: Text(
                                  '${item['item_name'] ?? item['name'] ?? item['sku']}',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13),
                                ),
                              ),
                              Expanded(
                                flex: 2,
                                child: Text(
                                  '${item['sku'] ?? '—'}',
                                  style: const TextStyle(
                                      fontSize: 11, color: Colors.grey),
                                ),
                              ),
                              Expanded(
                                child: Text(
                                  '${item['category'] ?? '—'}',
                                  style: const TextStyle(fontSize: 12),
                                ),
                              ),
                              Expanded(
                                child: Text(
                                  unit,
                                  style: const TextStyle(fontSize: 12),
                                ),
                              ),
                              SizedBox(
                                width: 110,
                                child: Text(
                                  '${qty.toStringAsFixed(qty % 1 == 0 ? 0 : 2)} $unit',
                                  textAlign: TextAlign.right,
                                  style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 13,
                                    color: isZero
                                        ? Colors.red
                                        : isLow
                                            ? Colors.orange
                                            : AppColors.kPrimary,
                                  ),
                                ),
                              ),
                              SizedBox(
                                width: 90,
                                child: Text(
                                  cost > 0
                                      ? 'KES ${cost.toStringAsFixed(0)}'
                                      : '—',
                                  textAlign: TextAlign.right,
                                  style: TextStyle(
                                      fontSize: 11,
                                      color: Colors.teal.shade700),
                                ),
                              ),
                              SizedBox(
                                width: 80,
                                child: Center(
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 5, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: isZero
                                          ? Colors.red.shade100
                                          : isLow
                                              ? Colors.orange.shade100
                                              : Colors.green.shade100,
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      isZero
                                          ? 'ZERO'
                                          : isLow
                                              ? 'LOW'
                                              : 'OK',
                                      style: TextStyle(
                                        fontSize: 9,
                                        fontWeight: FontWeight.w700,
                                        color: isZero
                                            ? Colors.red.shade800
                                            : isLow
                                                ? Colors.orange.shade800
                                                : Colors.green.shade800,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _CentralStat extends StatelessWidget {
  const _CentralStat({
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
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value,
                    style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                        color: color)),
                Text(label,
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.kTextSecondary)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
