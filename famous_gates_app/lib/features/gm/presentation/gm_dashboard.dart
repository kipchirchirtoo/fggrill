import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/widgets.dart';
import '../domain/providers.dart';
import '../../reports/domain/providers.dart';
import '../../reports/data/repository.dart';

class GMDashboard extends ConsumerStatefulWidget {
  const GMDashboard({super.key});

  @override
  ConsumerState<GMDashboard> createState() => _GMDashboardState();
}

class _OverviewTab extends ConsumerWidget {
  const _OverviewTab();

  String _fmt(dynamic val) {
    final n = (val is num) ? val.toDouble() : double.tryParse('$val') ?? 0;
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return n.toStringAsFixed(0);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final over = ref.watch(gmOverviewProvider);
    final branches = ref.watch(gmBranchesProvider);
    final staff = ref.watch(gmStaffProvider);
    final leave = ref.watch(gmLeaveRequestsProvider);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('System Overview',
              style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 24),
          over.when(
            data: (d) {
              final stats = d['data'] ?? d;
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 16,
                    runSpacing: 16,
                    children: [
                      _KpiCard(
                          label: 'Occupancy',
                          value:
                              '${_fmt(stats['occupancy_rate'] ?? stats['occupancy'])}%',
                          icon: PhosphorIcons.bed(),
                          color: AppColors.kWarning),
                      _KpiCard(
                          label: 'Branches',
                          value: branches.maybeWhen(
                              data: (d) => '${d.length}',
                              orElse: () => '${stats['branches'] ?? '-'}'),
                          icon: PhosphorIcons.buildings(),
                          color: AppColors.kPrimary),
                      _KpiCard(
                          label: 'Staff',
                          value: staff.maybeWhen(
                              data: (d) => '${d.length}',
                              orElse: () =>
                                  '${stats['active_staff'] ?? stats['staff'] ?? '-'}'),
                          icon: PhosphorIcons.users(),
                          color: AppColors.kTextSecondary),
                      _KpiCard(
                          label: 'Leave Requests',
                          value: leave.maybeWhen(
                              data: (d) => '${d.length}', orElse: () => '-'),
                          icon: PhosphorIcons.paperPlaneTilt(),
                          color: AppColors.kError),
                      _KpiCard(
                          label: 'Total Revenue',
                          value:
                              'KES ${_fmt(stats['total_revenue'] ?? stats['revenue'])}',
                          icon: PhosphorIcons.trendUp(),
                          color: AppColors.kSuccess),
                      _KpiCard(
                          label: 'Total Bookings',
                          value:
                              '${stats['total_bookings'] ?? stats['bookings'] ?? '-'}',
                          icon: PhosphorIcons.calendarCheck(),
                          color: AppColors.kPrimary),
                    ],
                  ),
                  const SizedBox(height: 24),
                  _quickAccess(),
                  const SizedBox(height: 24),
                  _pendingActions(
                      leave.maybeWhen(data: (d) => d, orElse: () => const [])),
                ],
              );
            },
            loading: () => const Wrap(
              spacing: 16,
              runSpacing: 16,
              children: [
                SizedBox(
                    width: 200,
                    height: 100,
                    child: LoadingSkeleton(type: SkeletonType.card)),
                SizedBox(
                    width: 200,
                    height: 100,
                    child: LoadingSkeleton(type: SkeletonType.card)),
                SizedBox(
                    width: 200,
                    height: 100,
                    child: LoadingSkeleton(type: SkeletonType.card)),
                SizedBox(
                    width: 200,
                    height: 100,
                    child: LoadingSkeleton(type: SkeletonType.card)),
              ],
            ),
            error: (e, _) => ErrorState(
                message: '$e',
                onRetry: () => ref.invalidate(gmOverviewProvider)),
          ),
        ],
      ),
    );
  }

  Widget _quickAccess() {
    const labels = [
      'Branches',
      'Finance',
      'Staff',
      'Reports',
      'Leave',
      'Compare'
    ];
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: labels
          .map((l) => SizedBox(
                width: 160,
                child: Card(
                    child: ListTile(
                        leading: const Icon(Icons.open_in_new, size: 18),
                        title: Text(l))),
              ))
          .toList(),
    );
  }

  Widget _pendingActions(List<Map<String, dynamic>> leaveRequests) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Pending Actions',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 8),
          if (leaveRequests.isEmpty)
            const Text('No pending actions',
                style: TextStyle(color: AppColors.kTextSecondary)),
          ...leaveRequests.take(5).map((r) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(PhosphorIcons.warningCircle(),
                    color: AppColors.kWarning),
                title: Text(
                    (r['title'] ?? r['employee_name'] ?? 'Leave approval')
                        .toString()),
                subtitle: Text(
                    (r['created_at'] ?? r['requested_date'] ?? '').toString()),
              )),
        ]),
      ),
    );
  }
}

class _BranchesTab extends ConsumerWidget {
  const _BranchesTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final branches = ref.watch(gmBranchesProvider);
    return branches.when(
      data: (rows) => rows.isEmpty
          ? const EmptyState(message: 'No branches found')
          : ListView.separated(
              padding: const EdgeInsets.all(24),
              itemCount: rows.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (_, i) {
                final b = rows[i];
                final isActive =
                    (b['is_active'] ?? b['status'] ?? 'active').toString() ==
                            'active' ||
                        (b['is_active'] == true);
                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: isActive
                        ? AppColors.kSuccess.withValues(alpha: 0.1)
                        : AppColors.kTextSecondary.withValues(alpha: 0.1),
                    child: Icon(Icons.apartment,
                        color: isActive
                            ? AppColors.kSuccess
                            : AppColors.kTextSecondary,
                        size: 18),
                  ),
                  title: Text(
                      (b['name'] ?? b['branch_name'] ?? 'Branch').toString(),
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(
                      '${b['location'] ?? b['address'] ?? '—'} • ID: ${(b['id'] ?? '').toString()}'),
                  trailing: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: isActive
                          ? AppColors.kSuccess.withValues(alpha: 0.1)
                          : AppColors.kTextSecondary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(isActive ? 'Active' : 'Inactive',
                        style: TextStyle(
                            fontSize: 11,
                            color: isActive
                                ? AppColors.kSuccess
                                : AppColors.kTextSecondary)),
                  ),
                  isThreeLine: true,
                  dense: false,
                );
              },
            ),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ErrorState(
          message: '$e', onRetry: () => ref.invalidate(gmBranchesProvider)),
    );
  }
}

class _FinanceTab extends ConsumerWidget {
  const _FinanceTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final finances = ref.watch(gmBranchFinancialsProvider);
    return finances.when(
      data: (rows) => rows.isEmpty
          ? const EmptyState(message: 'No financial records found')
          : ListView.separated(
              padding: const EdgeInsets.all(24),
              itemCount: rows.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (_, i) => ListTile(
                leading: Icon(PhosphorIcons.currencyDollar(),
                    color: AppColors.kSuccess),
                title: Text(
                    (rows[i]['branch_name'] ?? rows[i]['name'] ?? 'Branch')
                        .toString()),
                subtitle: Text(
                    'Revenue: KES ${rows[i]['revenue'] ?? '-'} • Expenses: KES ${rows[i]['expenses'] ?? '-'}'),
                trailing: Text(
                    'KES ${rows[i]['profit'] ?? rows[i]['net_profit'] ?? '-'}'),
              ),
            ),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ErrorState(message: '$e'),
    );
  }
}

class _GMReportsTab extends ConsumerWidget {
  const _GMReportsTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reportsAsync = ref.watch(reportsListProvider);
    return reportsAsync.when(
      data: (reports) => GridView.builder(
        padding: const EdgeInsets.all(24),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
          childAspectRatio: 1.5,
        ),
        itemCount: reports.isEmpty ? 6 : reports.length,
        itemBuilder: (_, i) => reports.isEmpty
            ? _defaultReportCard(context, ref, i)
            : Card(
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () async {
                    try {
                      await ref.read(reportsRepositoryProvider).exportPdf(
                          reports[i].name.toLowerCase().replaceAll(' ', '-'));
                      if (context.mounted) {
                        AppNotifier.showSnackBar(
                            context,
                            const SnackBar(
                                content: Text('Report export started')));
                      }
                    } catch (e) {
                      if (context.mounted) {
                        AppNotifier.showSnackBar(
                            context, SnackBar(content: Text('Error: $e')));
                      }
                    }
                  },
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(PhosphorIcons.fileText(),
                            color: AppColors.kPrimary),
                        const SizedBox(height: 8),
                        Text(reports[i].name,
                            style:
                                const TextStyle(fontWeight: FontWeight.bold)),
                        const Spacer(),
                        const Align(
                            alignment: Alignment.bottomRight,
                            child: TextButton(
                                onPressed: null, child: Text('Export PDF'))),
                      ],
                    ),
                  ),
                ),
              ),
      ),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ErrorState(message: '$e'),
    );
  }

  static const _defaultTitles = [
    'Daily Sales',
    'Occupancy',
    'Staff Performance',
    'Inventory',
    'P&L Summary',
    'Expense Audit'
  ];
  static const _defaultTypes = [
    'daily-sales',
    'occupancy',
    'staff-performance',
    'inventory',
    'pnl',
    'expense-audit'
  ];

  Widget _defaultReportCard(BuildContext context, WidgetRef ref, int i) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () async {
          try {
            await ref
                .read(reportsRepositoryProvider)
                .exportPdf(_defaultTypes[i]);
            if (context.mounted) {
              AppNotifier.showSnackBar(context,
                  const SnackBar(content: Text('Report export started')));
            }
          } catch (e) {
            if (context.mounted) {
              AppNotifier.showSnackBar(
                  context, SnackBar(content: Text('Error: $e')));
            }
          }
        },
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(PhosphorIcons.fileText(), color: AppColors.kPrimary),
              const SizedBox(height: 8),
              Text(_defaultTitles[i],
                  style: const TextStyle(fontWeight: FontWeight.bold)),
              const Spacer(),
              const Align(
                  alignment: Alignment.bottomRight,
                  child:
                      TextButton(onPressed: null, child: Text('Export PDF'))),
            ],
          ),
        ),
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  const _KpiCard(
      {required this.label,
      required this.value,
      required this.icon,
      required this.color});
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 200,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: color, size: 28),
              const SizedBox(height: 12),
              Text(value,
                  style: const TextStyle(
                      fontSize: 22, fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text(label,
                  style: const TextStyle(
                      color: AppColors.kTextSecondary, fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }
}

class _GMDashboardState extends ConsumerState<GMDashboard> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final tabs = [
      const DashboardTab(label: 'Overview', content: _OverviewTab()),
      const DashboardTab(label: 'Branches', content: _BranchesTab()),
      const DashboardTab(label: 'Finance', content: _FinanceTab()),
      const DashboardTab(label: 'Reports', content: _GMReportsTab()),
    ];

    return DashboardShell(
      title: 'General Manager',
      tabs: tabs,
      currentTab: _tab,
      onTabChanged: (i) => setState(() => _tab = i),
    );
  }
}
