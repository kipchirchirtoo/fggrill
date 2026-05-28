import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/mobile_shell.dart';
import '../../../../core/widgets/adaptive_stat_grid.dart';
import '../../data/repository.dart';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

final _gmOverviewProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(gmRepositoryProvider).getOverview();
});

final _gmBranchesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(gmRepositoryProvider).getBranches();
});

final _gmLeaveProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(gmRepositoryProvider).getLeaveRequests(status: 'pending');
});

final _gmFinancialsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(gmRepositoryProvider).getBranchFinancials();
});

// ---------------------------------------------------------------------------
// Root screen
// ---------------------------------------------------------------------------

class MobileGmScreen extends ConsumerWidget {
  const MobileGmScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MobileShell(
      title: 'General Manager',
      tabs: const [
        MobileTab(
          label: 'Overview',
          icon: Icons.dashboard_outlined,
          activeIcon: Icons.dashboard,
          body: _GmOverviewTab(),
        ),
        MobileTab(
          label: 'Branches',
          icon: Icons.business_outlined,
          activeIcon: Icons.business,
          body: _GmBranchesTab(),
        ),
        MobileTab(
          label: 'Leave',
          icon: Icons.beach_access_outlined,
          activeIcon: Icons.beach_access,
          body: _GmLeaveTab(),
        ),
        MobileTab(
          label: 'Financials',
          icon: Icons.bar_chart,
          activeIcon: Icons.bar_chart,
          body: _GmFinancialsTab(),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Tab 1 — Overview
// ---------------------------------------------------------------------------

class _GmOverviewTab extends ConsumerWidget {
  const _GmOverviewTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_gmOverviewProvider);
    return async.when(
      loading: () => const MobileLoadingView(message: 'Loading overview…'),
      error: (e, _) => MobileEmptyState(
        icon: Icons.error_outline,
        title: 'Could not load overview',
        subtitle: e.toString(),
        action: TextButton(
          onPressed: () => ref.invalidate(_gmOverviewProvider),
          child: const Text('Retry'),
        ),
      ),
      data: (data) {
        final occupancy =
            '${data['occupancy_rate'] ?? data['occupancy'] ?? 0}%';
        final branchCount =
            '${data['branch_count'] ?? data['branches'] ?? 0}';
        final staffCount =
            '${data['staff_count'] ?? data['staff'] ?? 0}';
        final revenue = _fmt(data['total_revenue'] ??
            data['revenue'] ??
            0);

        return MobileTabBody(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AdaptiveStatGrid(
                stats: [
                  statDef(label: 'Occupancy Rate', value: occupancy,
                      icon: Icons.hotel, color: AppColors.kAccent),
                  statDef(label: 'Branch Count', value: branchCount,
                      icon: Icons.business, color: AppColors.kPrimary),
                  statDef(label: 'Staff Count', value: staffCount,
                      icon: Icons.people, color: const Color(0xFF7C3AED)),
                  statDef(label: 'Total Revenue', value: revenue,
                      icon: Icons.trending_up, color: AppColors.kSuccess),
                ],
              ),
              const SizedBox(height: 20),
              _GmQuickActions(),
            ],
          ),
        );
      },
    );
  }

  String _fmt(dynamic val) {
    if (val == null) return 'KES 0';
    final n = (val as num).toDouble();
    if (n >= 1000000) return 'KES ${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return 'KES ${(n / 1000).toStringAsFixed(1)}K';
    return 'KES ${n.toStringAsFixed(0)}';
  }
}

class _GmQuickActions extends ConsumerWidget {
  const _GmQuickActions();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Row(
      children: [
        Expanded(
          child: _Btn(
            icon: Icons.business,
            label: 'Branches',
            onTap: () =>
                ref.read(mobileShellTabProvider.notifier).state = 1,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _Btn(
            icon: Icons.beach_access,
            label: 'Leave',
            onTap: () =>
                ref.read(mobileShellTabProvider.notifier).state = 2,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _Btn(
            icon: Icons.bar_chart,
            label: 'Financials',
            onTap: () =>
                ref.read(mobileShellTabProvider.notifier).state = 3,
          ),
        ),
      ],
    );
  }
}

class _Btn extends StatelessWidget {
  const _Btn(
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
// Tab 2 — Branches
// ---------------------------------------------------------------------------

class _GmBranchesTab extends ConsumerWidget {
  const _GmBranchesTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_gmBranchesProvider);
    return async.when(
      loading: () =>
          const MobileLoadingView(message: 'Loading branches…'),
      error: (e, _) => MobileEmptyState(
        icon: Icons.error_outline,
        title: 'Could not load branches',
        subtitle: e.toString(),
        action: TextButton(
          onPressed: () => ref.invalidate(_gmBranchesProvider),
          child: const Text('Retry'),
        ),
      ),
      data: (branches) {
        if (branches.isEmpty) {
          return const MobileEmptyState(
            icon: Icons.business_outlined,
            title: 'No branches found',
            subtitle: 'No branch data available.',
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: branches.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, i) =>
              _BranchTile(branch: branches[i]),
        );
      },
    );
  }
}

class _BranchTile extends StatelessWidget {
  const _BranchTile({required this.branch});

  final Map<String, dynamic> branch;

  @override
  Widget build(BuildContext context) {
    final name = branch['name'] ?? branch['branch_name'] ?? '—';
    final location =
        branch['location'] ?? branch['address'] ?? '';
    final status =
        (branch['status'] ?? 'ACTIVE').toString().toUpperCase();
    final isActive = status == 'ACTIVE' || status == 'OPEN';

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
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.kPrimary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.business,
                color: AppColors.kPrimary, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name.toString(),
                  style: const TextStyle(
                    color: AppColors.kTextPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
                if (location.isNotEmpty)
                  Text(
                    location.toString(),
                    style: const TextStyle(
                      color: AppColors.kTextSecondary,
                      fontSize: 12,
                      fontFamily: 'SF Pro Display',
                    ),
                  ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(
                horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: (isActive
                      ? AppColors.kSuccess
                      : AppColors.kTextSecondary)
                  .withOpacity(0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              status,
              style: TextStyle(
                color: isActive
                    ? AppColors.kSuccess
                    : AppColors.kTextSecondary,
                fontSize: 10,
                fontWeight: FontWeight.w700,
                fontFamily: 'SF Pro Display',
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Tab 3 — Leave Approvals
// ---------------------------------------------------------------------------

class _GmLeaveTab extends ConsumerWidget {
  const _GmLeaveTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_gmLeaveProvider);
    return async.when(
      loading: () =>
          const MobileLoadingView(message: 'Loading leave requests…'),
      error: (e, _) => MobileEmptyState(
        icon: Icons.error_outline,
        title: 'Could not load',
        subtitle: e.toString(),
        action: TextButton(
          onPressed: () => ref.invalidate(_gmLeaveProvider),
          child: const Text('Retry'),
        ),
      ),
      data: (items) {
        if (items.isEmpty) {
          return const MobileEmptyState(
            icon: Icons.beach_access,
            title: 'No pending leave requests',
            subtitle: 'No leave requests awaiting GM approval.',
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: items.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, i) =>
              _GmLeaveTile(leave: items[i], ref: ref),
        );
      },
    );
  }
}

class _GmLeaveTile extends StatelessWidget {
  const _GmLeaveTile({required this.leave, required this.ref});

  final Map<String, dynamic> leave;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    final name = leave['staff_name'] ??
        leave['employee_name'] ?? '—';
    final type = leave['leave_type'] ?? leave['type'] ?? '—';
    final from = leave['start_date'] ?? leave['from_date'] ?? '';
    final to = leave['end_date'] ?? leave['to_date'] ?? '';
    final branch = leave['branch_name'] ?? leave['branch'] ?? '';

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
                  name.toString(),
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
                  color: AppColors.kPrimary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  type.toString(),
                  style: const TextStyle(
                    color: AppColors.kPrimary,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '$from → $to${branch.isNotEmpty ? ' • $branch' : ''}',
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
              TextButton.icon(
                onPressed: () => _approve(context),
                icon: const Icon(Icons.check, size: 16),
                label: const Text('Approve'),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.kSuccess,
                  textStyle: const TextStyle(fontSize: 12),
                ),
              ),
              const SizedBox(width: 4),
              TextButton.icon(
                onPressed: () => _reject(context),
                icon: const Icon(Icons.close, size: 16),
                label: const Text('Reject'),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.kError,
                  textStyle: const TextStyle(fontSize: 12),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _approve(BuildContext context) async {
    final id = '${leave['id']}';
    try {
      await ref.read(gmRepositoryProvider).approveLeave(id);
      ref.invalidate(_gmLeaveProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Leave approved'),
            backgroundColor: AppColors.kSuccess,
          ),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(e.toString()),
              backgroundColor: AppColors.kError),
        );
      }
    }
  }

  Future<void> _reject(BuildContext context) async {
    String reason = '';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject Leave'),
        content: TextField(
          onChanged: (v) => reason = v,
          decoration: const InputDecoration(
            labelText: 'Reason',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Reject')),
        ],
      ),
    );
    if (confirmed != true) return;
    final id = '${leave['id']}';
    try {
      await ref.read(gmRepositoryProvider).rejectLeave(id, reason: reason);
      ref.invalidate(_gmLeaveProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Leave rejected'),
            backgroundColor: AppColors.kWarning,
          ),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(e.toString()),
              backgroundColor: AppColors.kError),
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Tab 4 — Financials
// ---------------------------------------------------------------------------

class _GmFinancialsTab extends ConsumerWidget {
  const _GmFinancialsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_gmFinancialsProvider);
    return async.when(
      loading: () =>
          const MobileLoadingView(message: 'Loading financials…'),
      error: (e, _) => MobileEmptyState(
        icon: Icons.error_outline,
        title: 'Could not load financials',
        subtitle: e.toString(),
        action: TextButton(
          onPressed: () => ref.invalidate(_gmFinancialsProvider),
          child: const Text('Retry'),
        ),
      ),
      data: (items) {
        // Sort by revenue descending
        final sorted = [...items];
        sorted.sort((a, b) {
          final ra = (a['revenue'] ?? a['total_revenue'] ?? 0) as num;
          final rb = (b['revenue'] ?? b['total_revenue'] ?? 0) as num;
          return rb.compareTo(ra);
        });

        if (sorted.isEmpty) {
          return const MobileEmptyState(
            icon: Icons.bar_chart,
            title: 'No financial data',
            subtitle: 'No branch financial data available.',
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: sorted.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, i) =>
              _FinancialTile(item: sorted[i], rank: i + 1),
        );
      },
    );
  }
}

class _FinancialTile extends StatelessWidget {
  const _FinancialTile({required this.item, required this.rank});

  final Map<String, dynamic> item;
  final int rank;

  @override
  Widget build(BuildContext context) {
    final name = item['branch_name'] ?? item['name'] ?? '—';
    final revenue =
        (item['revenue'] ?? item['total_revenue'] ?? 0) as num;
    final expenses = (item['expenses'] ?? item['total_expenses'] ?? 0) as num;
    final net = (item['net_profit'] ?? item['profit'] ?? revenue - expenses) as num;

    final isProfit = net >= 0;

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
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: rank <= 3
                  ? AppColors.kAccent.withOpacity(0.15)
                  : AppColors.kPrimary.withOpacity(0.08),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Center(
              child: Text(
                '#$rank',
                style: TextStyle(
                  color: rank <= 3 ? AppColors.kAccent : AppColors.kPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  fontFamily: 'SF Pro Display',
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name.toString(),
                  style: const TextStyle(
                    color: AppColors.kTextPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
                Text(
                  'Revenue: ${_fmt(revenue)} • Expenses: ${_fmt(expenses)}',
                  style: const TextStyle(
                    color: AppColors.kTextSecondary,
                    fontSize: 11,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                _fmt(net),
                style: TextStyle(
                  color: isProfit ? AppColors.kSuccess : AppColors.kError,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  fontFamily: 'SF Pro Display',
                ),
              ),
              Text(
                isProfit ? 'Profit' : 'Loss',
                style: TextStyle(
                  color: isProfit
                      ? AppColors.kSuccess
                      : AppColors.kError,
                  fontSize: 10,
                  fontFamily: 'SF Pro Display',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _fmt(num val) {
    if (val.abs() >= 1000000) {
      return 'KES ${(val / 1000000).toStringAsFixed(1)}M';
    }
    if (val.abs() >= 1000) {
      return 'KES ${(val / 1000).toStringAsFixed(1)}K';
    }
    return 'KES ${val.toStringAsFixed(0)}';
  }
}
