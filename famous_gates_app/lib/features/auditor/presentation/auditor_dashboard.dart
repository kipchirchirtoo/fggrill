import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/widgets.dart';
import '../domain/providers.dart';
import '../domain/models.dart';
import '../data/repository.dart';
import 'branch_orders_tab.dart';
import '../../lina/presentation/lina_screen.dart';
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
            content: _AuditorOverviewTab(onGoToApprovals: () => setState(() => _tab = 2))),
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
            content: const _CashierReportsTab()),
        DashboardTab(
            label: 'Reconciliation',
            icon: PhosphorIcons.arrowsClockwise(),
            content: const _ReconciliationTab()),
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
      padding: const EdgeInsets.all(24),
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
        padding: const EdgeInsets.all(24),
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
      padding: const EdgeInsets.all(24),
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

final _cashierReportFiltersProvider =
    StateProvider<Map<String, String?>>((ref) => const {});

class _CashierReportsTab extends ConsumerWidget {
  const _CashierReportsTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filters = ref.watch(_cashierReportFiltersProvider);
    final clearancesAsync =
        ref.watch(auditorCashierClearancesProvider(filters));
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Cashier Reports',
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
                    ref.read(_cashierReportFiltersProvider.notifier).state = {
                      ...filters,
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
                        .read(_cashierReportFiltersProvider.notifier)
                        .state = const {},
                    child: const Text('Clear')),
            ],
          ),
          const SizedBox(height: 12),
          Expanded(
            child: clearancesAsync.when(
              data: (rows) => rows.isEmpty
                  ? const EmptyState(message: 'No cashier clearances found')
                  : ListView.separated(
                      itemCount: rows.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (_, i) {
                        final c = rows[i];
                        final amount = (c['amount'] ?? c['total_amount'] ?? 0);
                        final status = (c['status'] ?? '').toString();
                        final statusColor = status == 'approved'
                            ? AppColors.kSuccess
                            : status == 'pending'
                                ? AppColors.kWarning
                                : AppColors.kTextSecondary;
                        return ListTile(
                          leading: CircleAvatar(
                            backgroundColor:
                                AppColors.kSuccess.withValues(alpha: 0.1),
                            child: Icon(PhosphorIcons.receipt(),
                                color: AppColors.kSuccess, size: 18),
                          ),
                          title: Text(
                              (c['cashier_name'] ?? c['staff_name'] ?? '—')
                                  .toString(),
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Text(
                              'Shift: ${c['shift'] ?? '—'}  •  Date: ${(c['date'] ?? c['created_at'] ?? '').toString().split('T').first}'),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                  'KES ${amount is num ? amount.toStringAsFixed(0) : amount}',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.kSuccess)),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                    color: statusColor.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(8)),
                                child: Text(status,
                                    style: TextStyle(
                                        fontSize: 11, color: statusColor)),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
              loading: () => const LoadingSkeleton(type: SkeletonType.list),
              error: (e, _) => ErrorState(
                  message: '$e',
                  onRetry: () => ref
                      .invalidate(auditorCashierClearancesProvider(filters))),
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
      padding: const EdgeInsets.all(24),
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
