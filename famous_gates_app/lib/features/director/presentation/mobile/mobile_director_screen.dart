import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/mobile_shell.dart';
import '../../../../core/widgets/adaptive_stat_grid.dart';
import '../../data/repository.dart';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

final _directorDashboardProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(directorRepositoryProvider).getComprehensiveDashboard();
});

final _directorDiscrepanciesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(directorRepositoryProvider).getDiscrepancies();
});

final _directorTasksProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(directorRepositoryProvider).getTasks();
});

final _directorBankingProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(directorRepositoryProvider).getBankingReconciliation();
});

// ---------------------------------------------------------------------------
// Root screen
// ---------------------------------------------------------------------------

class MobileDirectorScreen extends ConsumerWidget {
  const MobileDirectorScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MobileShell(
      title: 'Director',
      tabs: const [
        MobileTab(
          label: 'Overview',
          icon: Icons.dashboard_outlined,
          activeIcon: Icons.dashboard,
          body: _OverviewTab(),
        ),
        MobileTab(
          label: 'Discrepancies',
          icon: Icons.flag_outlined,
          activeIcon: Icons.flag,
          body: _DiscrepanciesTab(),
        ),
        MobileTab(
          label: 'Tasks',
          icon: Icons.task_alt,
          activeIcon: Icons.task_alt,
          body: _TasksTab(),
        ),
        MobileTab(
          label: 'Finance',
          icon: Icons.account_balance_outlined,
          activeIcon: Icons.account_balance,
          body: _FinanceTab(),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Tab 1 — Overview
// ---------------------------------------------------------------------------

class _OverviewTab extends ConsumerWidget {
  const _OverviewTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_directorDashboardProvider);
    return async.when(
      loading: () => const MobileLoadingView(message: 'Loading overview…'),
      error: (e, _) => MobileEmptyState(
        icon: Icons.error_outline,
        title: 'Could not load overview',
        subtitle: e.toString(),
        action: TextButton(
          onPressed: () => ref.invalidate(_directorDashboardProvider),
          child: const Text('Retry'),
        ),
      ),
      data: (data) {
        final revenue = _fmt(data['total_revenue'] ??
            data['revenue'] ??
            data['gross_revenue'] ??
            0);
        final netProfit = _fmt(data['net_profit'] ??
            data['net_income'] ??
            0);
        final occupancy =
            '${data['occupancy_rate'] ?? data['occupancy'] ?? 0}%';
        final activeStaff =
            '${data['active_staff'] ?? data['staff_count'] ?? 0}';
        final pendingFlags =
            '${data['pending_flags'] ?? data['audit_flags'] ?? 0}';
        final lowStock = '${data['low_stock_count'] ?? data['low_stock'] ?? 0}';

        // AdaptiveStatGrid (skill: flutter-build-responsive-layout) —
        // automatically adjusts column count via LayoutBuilder constraints.
        return MobileTabBody(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AdaptiveStatGrid(
                stats: [
                  statDef(label: 'Total Revenue', value: revenue,
                      icon: Icons.trending_up, color: AppColors.kSuccess),
                  statDef(label: 'Net Profit', value: netProfit,
                      icon: Icons.account_balance_wallet, color: AppColors.kPrimary),
                  statDef(label: 'Occupancy', value: occupancy,
                      icon: Icons.hotel, color: AppColors.kAccent),
                  statDef(label: 'Active Staff', value: activeStaff,
                      icon: Icons.people, color: const Color(0xFF7C3AED)),
                  statDef(label: 'Audit Flags', value: pendingFlags,
                      icon: Icons.flag, color: AppColors.kError),
                  statDef(label: 'Low Stock', value: lowStock,
                      icon: Icons.inventory_2, color: AppColors.kWarning),
                ],
              ),
              const SizedBox(height: 20),
              const _QuickActionsRow(),
            ],
          ),
        );
      },
    );
  }

  String _fmt(dynamic val) {
    if (val == null) return 'KES 0';
    final n = (val as num).toDouble();
    if (n >= 1000000) {
      return 'KES ${(n / 1000000).toStringAsFixed(1)}M';
    }
    if (n >= 1000) {
      return 'KES ${(n / 1000).toStringAsFixed(1)}K';
    }
    return 'KES ${n.toStringAsFixed(0)}';
  }
}

class _QuickActionsRow extends ConsumerWidget {
  const _QuickActionsRow();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Row(
      children: [
        Expanded(
          child: _QuickBtn(
            icon: Icons.flag,
            label: 'Discrepancies',
            onTap: () => ref.read(mobileShellTabProvider.notifier).state = 1,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _QuickBtn(
            icon: Icons.task_alt,
            label: 'Tasks',
            onTap: () => ref.read(mobileShellTabProvider.notifier).state = 2,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _QuickBtn(
            icon: Icons.account_balance,
            label: 'Finance',
            onTap: () => ref.read(mobileShellTabProvider.notifier).state = 3,
          ),
        ),
      ],
    );
  }
}

class _QuickBtn extends StatelessWidget {
  const _QuickBtn(
      {required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.kPrimary.withOpacity(0.07),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(icon, color: AppColors.kPrimary, size: 22),
            const SizedBox(height: 6),
            Text(
              label,
              style: const TextStyle(
                color: AppColors.kPrimary,
                fontSize: 11,
                fontWeight: FontWeight.w600,
                fontFamily: 'SF Pro Display',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Tab 2 — Discrepancies
// ---------------------------------------------------------------------------

class _DiscrepanciesTab extends ConsumerWidget {
  const _DiscrepanciesTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_directorDiscrepanciesProvider);
    return async.when(
      loading: () =>
          const MobileLoadingView(message: 'Loading discrepancies…'),
      error: (e, _) => MobileEmptyState(
        icon: Icons.error_outline,
        title: 'Could not load',
        subtitle: e.toString(),
        action: TextButton(
          onPressed: () => ref.invalidate(_directorDiscrepanciesProvider),
          child: const Text('Retry'),
        ),
      ),
      data: (items) {
        if (items.isEmpty) {
          return const MobileEmptyState(
            icon: Icons.flag_outlined,
            title: 'No discrepancies',
            subtitle: 'No audit flags require your attention.',
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: items.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, i) =>
              _DiscrepancyTile(item: items[i], ref: ref),
        );
      },
    );
  }
}

class _DiscrepancyTile extends StatelessWidget {
  const _DiscrepancyTile({required this.item, required this.ref});

  final Map<String, dynamic> item;
  final WidgetRef ref;

  static const _severityColors = {
    'LOW': Color(0xFF7C3AED),
    'MEDIUM': AppColors.kWarning,
    'HIGH': AppColors.kError,
    'CRITICAL': Color(0xFF7F0000),
  };

  @override
  Widget build(BuildContext context) {
    final branch = item['branch_name'] ?? item['branch'] ?? '—';
    final amount = item['amount'] ?? item['discrepancy_amount'] ?? 0;
    final severity =
        (item['severity'] ?? 'LOW').toString().toUpperCase();
    final type = item['flag_type'] ?? item['type'] ?? '—';
    final status = (item['status'] ?? 'OPEN').toString().toUpperCase();
    final severityColor =
        _severityColors[severity] ?? AppColors.kWarning;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.kCardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: severityColor.withOpacity(0.25)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.flag, color: severityColor, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  branch.toString(),
                  style: const TextStyle(
                    color: AppColors.kTextPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: severityColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  severity,
                  style: TextStyle(
                    color: severityColor,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Type: $type • KES ${_fmt(amount)} • $status',
            style: const TextStyle(
              color: AppColors.kTextSecondary,
              fontSize: 12,
              fontFamily: 'SF Pro Display',
            ),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: () =>
                    _finalize(context, 'RESOLVED'),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.kSuccess,
                  textStyle:
                      const TextStyle(fontSize: 12),
                ),
                child: const Text('Resolve'),
              ),
              const SizedBox(width: 4),
              TextButton(
                onPressed: () =>
                    _finalize(context, 'ESCALATED'),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.kError,
                  textStyle:
                      const TextStyle(fontSize: 12),
                ),
                child: const Text('Escalate'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _finalize(BuildContext context, String decision) async {
    final id = '${item['id']}';
    try {
      await ref
          .read(directorRepositoryProvider)
          .finalizeDiscrepancy(id, decision, decision);
      ref.invalidate(_directorDiscrepanciesProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Discrepancy $decision'),
            backgroundColor: decision == 'RESOLVED'
                ? AppColors.kSuccess
                : AppColors.kError,
          ),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: AppColors.kError,
          ),
        );
      }
    }
  }

  String _fmt(dynamic val) {
    if (val == null) return '0';
    return (val as num).toStringAsFixed(0);
  }
}

// ---------------------------------------------------------------------------
// Tab 3 — Tasks
// ---------------------------------------------------------------------------

class _TasksTab extends ConsumerStatefulWidget {
  const _TasksTab();

  @override
  ConsumerState<_TasksTab> createState() => _TasksTabState();
}

class _TasksTabState extends ConsumerState<_TasksTab> {
  String _filter = 'OPEN';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_directorTasksProvider);
    return Column(
      children: [
        // Filter chips
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: Row(
            children: ['OPEN', 'COMPLETED', 'DISMISSED'].map((f) {
              final selected = _filter == f;
              return GestureDetector(
                onTap: () => setState(() => _filter = f),
                child: Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: selected
                        ? AppColors.kPrimary
                        : AppColors.kPrimary.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    f,
                    style: TextStyle(
                      color: selected
                          ? Colors.white
                          : AppColors.kPrimary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      fontFamily: 'SF Pro Display',
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
        Expanded(
          child: async.when(
            loading: () =>
                const MobileLoadingView(message: 'Loading tasks…'),
            error: (e, _) => MobileEmptyState(
              icon: Icons.error_outline,
              title: 'Could not load tasks',
              subtitle: e.toString(),
              action: TextButton(
                onPressed: () =>
                    ref.invalidate(_directorTasksProvider),
                child: const Text('Retry'),
              ),
            ),
            data: (tasks) {
              final filtered = tasks
                  .where((t) =>
                      (t['status'] ?? 'OPEN').toString().toUpperCase() ==
                      _filter)
                  .toList();
              if (filtered.isEmpty) {
                return MobileEmptyState(
                  icon: Icons.task_alt,
                  title: 'No $_filter tasks',
                  subtitle: 'No tasks with this status.',
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: filtered.length,
                separatorBuilder: (_, __) =>
                    const SizedBox(height: 10),
                itemBuilder: (context, i) =>
                    _TaskTile(task: filtered[i], ref: ref),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _TaskTile extends StatelessWidget {
  const _TaskTile({required this.task, required this.ref});

  final Map<String, dynamic> task;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    final title = task['title'] ?? task['task_title'] ?? '—';
    final role = task['assigned_to_role'] ?? task['role'] ?? '';
    final priority =
        (task['priority'] ?? 'NORMAL').toString().toUpperCase();
    final dueDate = task['due_date'] ?? task['deadline'] ?? '';
    final priorityColor = priority == 'HIGH' || priority == 'URGENT'
        ? AppColors.kError
        : priority == 'MEDIUM'
            ? AppColors.kWarning
            : AppColors.kTextSecondary;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.kCardBg,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title.toString(),
                  style: const TextStyle(
                    color: AppColors.kTextPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: priorityColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  priority,
                  style: TextStyle(
                    color: priorityColor,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              if (role.isNotEmpty) ...[
                const Icon(Icons.person_outline,
                    size: 13, color: AppColors.kTextSecondary),
                const SizedBox(width: 4),
                Text(
                  role.toString(),
                  style: const TextStyle(
                    color: AppColors.kTextSecondary,
                    fontSize: 11,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
              ],
              if (dueDate.isNotEmpty) ...[
                const SizedBox(width: 12),
                const Icon(Icons.schedule,
                    size: 13, color: AppColors.kTextSecondary),
                const SizedBox(width: 4),
                Text(
                  dueDate.toString(),
                  style: const TextStyle(
                    color: AppColors.kTextSecondary,
                    fontSize: 11,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: () => _closeTask(context),
              icon: const Icon(Icons.check_circle_outline, size: 16),
              label: const Text('Close'),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.kSuccess,
                textStyle: const TextStyle(fontSize: 12),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _closeTask(BuildContext context) async {
    final id = '${task['id']}';
    try {
      await ref
          .read(directorRepositoryProvider)
          .closeTask(id, 'COMPLETED', '');
      ref.invalidate(_directorTasksProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Task closed'),
            backgroundColor: AppColors.kSuccess,
          ),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: AppColors.kError,
          ),
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Tab 4 — Finance / Banking
// ---------------------------------------------------------------------------

class _FinanceTab extends ConsumerWidget {
  const _FinanceTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_directorBankingProvider);
    return async.when(
      loading: () => const MobileLoadingView(message: 'Loading finance…'),
      error: (e, _) => MobileEmptyState(
        icon: Icons.error_outline,
        title: 'Could not load finance',
        subtitle: e.toString(),
        action: TextButton(
          onPressed: () => ref.invalidate(_directorBankingProvider),
          child: const Text('Retry'),
        ),
      ),
      data: (data) {
        final expected = _fmt(data['expected_cash'] ??
            data['total_expected'] ??
            0);
        final banked = _fmt(data['total_banked'] ??
            data['banked'] ??
            0);
        final variance =
            _fmt(data['variance'] ?? data['total_variance'] ?? 0);
        final unbanked = data['unbanked_branches'] ??
            data['unbanked_count'] ??
            0;
        final branches =
            data['branches'] as List? ?? [];

        return MobileTabBody(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AdaptiveStatGrid(
                stats: [
                  statDef(label: 'Expected Cash', value: expected,
                      icon: Icons.attach_money, color: AppColors.kPrimary),
                  statDef(label: 'Total Banked', value: banked,
                      icon: Icons.account_balance, color: AppColors.kSuccess),
                  statDef(label: 'Variance', value: variance,
                      icon: Icons.compare_arrows, color: AppColors.kWarning),
                  statDef(label: 'Unbanked', value: '$unbanked branches',
                      icon: Icons.warning_amber, color: AppColors.kError),
                ],
              ),
              if (branches.isNotEmpty) ...[
                const SizedBox(height: 20),
                const Text(
                  'Branch Banking Status',
                  style: TextStyle(
                    color: AppColors.kTextPrimary,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
                const SizedBox(height: 10),
                ...branches.map((b) {
                  final bMap = Map<String, dynamic>.from(b as Map);
                  final name = bMap['branch_name'] ??
                      bMap['name'] ??
                      '—';
                  final bankedStatus = bMap['banking_status'] ??
                      bMap['status'] ??
                      '';
                  final isBanked =
                      bankedStatus.toString().toUpperCase() == 'BANKED' ||
                          (bMap['is_banked'] == true);
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.kCardBg,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: isBanked
                            ? AppColors.kSuccess.withOpacity(0.3)
                            : AppColors.kError.withOpacity(0.3),
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          isBanked
                              ? Icons.check_circle
                              : Icons.cancel_outlined,
                          color: isBanked
                              ? AppColors.kSuccess
                              : AppColors.kError,
                          size: 18,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            name.toString(),
                            style: const TextStyle(
                              color: AppColors.kTextPrimary,
                              fontSize: 13,
                              fontFamily: 'SF Pro Display',
                            ),
                          ),
                        ),
                        Text(
                          isBanked ? 'BANKED' : 'PENDING',
                          style: TextStyle(
                            color: isBanked
                                ? AppColors.kSuccess
                                : AppColors.kError,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            fontFamily: 'SF Pro Display',
                          ),
                        ),
                      ],
                    ),
                  );
                }),
              ],
            ],
          ),
        );
      },
    );
  }

  String _fmt(dynamic val) {
    if (val == null) return 'KES 0';
    final n = (val as num).toDouble();
    if (n >= 1000000) {
      return 'KES ${(n / 1000000).toStringAsFixed(1)}M';
    }
    if (n >= 1000) {
      return 'KES ${(n / 1000).toStringAsFixed(1)}K';
    }
    return 'KES ${n.toStringAsFixed(0)}';
  }
}
