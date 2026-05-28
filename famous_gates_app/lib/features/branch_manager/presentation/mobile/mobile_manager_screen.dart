import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/mobile_shell.dart';
import '../../data/repository.dart';
import '../../domain/models.dart';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

final _managerStatsProvider =
    FutureProvider.autoDispose<BranchManagerStats>((ref) async {
  return ref.read(branchManagerRepositoryProvider).getDashboardStats();
});

final _managerClearancesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(branchManagerRepositoryProvider).getCashierClearances();
});

final _managerLeaveProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(branchManagerRepositoryProvider).leaveRequests(status: 'pending');
});

final _managerAttendanceProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(branchManagerRepositoryProvider).staffAttendance();
});

final _managerStockProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(branchManagerRepositoryProvider).branchStock(status: 'low');
});

final _managerBookingsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(branchManagerRepositoryProvider).bookings(status: 'active');
});

// ---------------------------------------------------------------------------
// Root screen
// ---------------------------------------------------------------------------

class MobileManagerScreen extends ConsumerWidget {
  const MobileManagerScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MobileShell(
      title: 'Branch Manager',
      tabs: const [
        MobileTab(
          label: 'Overview',
          icon: Icons.dashboard_outlined,
          activeIcon: Icons.dashboard,
          body: _OverviewTab(),
        ),
        MobileTab(
          label: 'Clearances',
          icon: Icons.point_of_sale_outlined,
          activeIcon: Icons.point_of_sale,
          body: _ClearancesTab(),
        ),
        MobileTab(
          label: 'Staff',
          icon: Icons.people_outline,
          activeIcon: Icons.people,
          body: _StaffTab(),
        ),
        MobileTab(
          label: 'Stock',
          icon: Icons.inventory_2_outlined,
          activeIcon: Icons.inventory_2,
          body: _StockTab(),
        ),
        MobileTab(
          label: 'Reservations',
          icon: Icons.bed_outlined,
          activeIcon: Icons.bed,
          body: _ReservationsTab(),
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
    final async = ref.watch(_managerStatsProvider);
    return async.when(
      loading: () => const MobileLoadingView(message: 'Loading stats…'),
      error: (e, _) => MobileEmptyState(
        icon: Icons.error_outline,
        title: 'Could not load overview',
        subtitle: e.toString(),
        action: TextButton(
          onPressed: () => ref.invalidate(_managerStatsProvider),
          child: const Text('Retry'),
        ),
      ),
      data: (stats) {
        return MobileTabBody(
          child: GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.3,
            children: [
              MobileStatCard(
                label: 'Occupancy',
                value: '${stats.occupancyRate.toStringAsFixed(0)}%',
                icon: Icons.hotel,
                color: AppColors.kAccent,
              ),
              MobileStatCard(
                label: 'Today Revenue',
                value: _fmt(stats.todayRevenue),
                icon: Icons.attach_money,
                color: AppColors.kSuccess,
              ),
              MobileStatCard(
                label: 'Active Orders',
                value: '${stats.activeOrders}',
                icon: Icons.receipt_long,
                color: AppColors.kPrimary,
              ),
              MobileStatCard(
                label: 'Low Stock Items',
                value: '${stats.lowStockItems}',
                icon: Icons.inventory_2,
                color: AppColors.kWarning,
              ),
            ],
          ),
        );
      },
    );
  }

  String _fmt(double val) {
    if (val >= 1000000) return 'KES ${(val / 1000000).toStringAsFixed(1)}M';
    if (val >= 1000) return 'KES ${(val / 1000).toStringAsFixed(1)}K';
    return 'KES ${val.toStringAsFixed(0)}';
  }
}

// ---------------------------------------------------------------------------
// Tab 2 — Cashier Clearances
// ---------------------------------------------------------------------------

class _ClearancesTab extends ConsumerWidget {
  const _ClearancesTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_managerClearancesProvider);
    return async.when(
      loading: () =>
          const MobileLoadingView(message: 'Loading clearances…'),
      error: (e, _) => MobileEmptyState(
        icon: Icons.error_outline,
        title: 'Could not load clearances',
        subtitle: e.toString(),
        action: TextButton(
          onPressed: () => ref.invalidate(_managerClearancesProvider),
          child: const Text('Retry'),
        ),
      ),
      data: (items) {
        if (items.isEmpty) {
          return const MobileEmptyState(
            icon: Icons.point_of_sale_outlined,
            title: 'No pending clearances',
            subtitle: 'All cashier shifts have been cleared.',
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: items.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, i) =>
              _ClearanceTile(clearance: items[i], ref: ref),
        );
      },
    );
  }
}

class _ClearanceTile extends StatelessWidget {
  const _ClearanceTile(
      {required this.clearance, required this.ref});

  final Map<String, dynamic> clearance;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    final cashier = clearance['cashier_name'] ??
        clearance['staff_name'] ?? '—';
    final shift = clearance['shift'] ??
        clearance['shift_name'] ?? '—';
    final cash = clearance['cash_collected'] ??
        clearance['amount'] ?? 0;
    final status =
        (clearance['status'] ?? 'PENDING').toString().toUpperCase();
    final isPending = status == 'PENDING';

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
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      cashier.toString(),
                      style: const TextStyle(
                        color: AppColors.kTextPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        fontFamily: 'SF Pro Display',
                      ),
                    ),
                    Text(
                      'Shift: $shift • KES ${(cash as num).toStringAsFixed(0)}',
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
                    horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: (isPending
                          ? AppColors.kWarning
                          : AppColors.kSuccess)
                      .withOpacity(0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  status,
                  style: TextStyle(
                    color: isPending
                        ? AppColors.kWarning
                        : AppColors.kSuccess,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
              ),
            ],
          ),
          if (isPending) ...[
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: () => _approve(context),
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.kSuccess,
                    textStyle: const TextStyle(fontSize: 12),
                  ),
                  child: const Text('✓ Approve'),
                ),
                const SizedBox(width: 4),
                TextButton(
                  onPressed: () => _flag(context),
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.kError,
                    textStyle: const TextStyle(fontSize: 12),
                  ),
                  child: const Text('⚑ Flag'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _approve(BuildContext context) async {
    final id = '${clearance['id']}';
    try {
      await ref
          .read(branchManagerRepositoryProvider)
          .approveClearance(id);
      ref.invalidate(_managerClearancesProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Clearance approved'),
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

  Future<void> _flag(BuildContext context) async {
    String reason = '';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Flag Clearance'),
        content: TextField(
          onChanged: (v) => reason = v,
          decoration: const InputDecoration(
            labelText: 'Reason',
            border: OutlineInputBorder(),
          ),
          maxLines: 2,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Flag'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    final id = '${clearance['id']}';
    try {
      await ref
          .read(branchManagerRepositoryProvider)
          .flagClearance(id, reason: reason);
      ref.invalidate(_managerClearancesProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Clearance flagged'),
            backgroundColor: AppColors.kWarning,
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
// Tab 3 — Staff (Leave + Attendance sub-tabs)
// ---------------------------------------------------------------------------

class _StaffTab extends ConsumerStatefulWidget {
  const _StaffTab();

  @override
  ConsumerState<_StaffTab> createState() => _StaffTabState();
}

class _StaffTabState extends ConsumerState<_StaffTab>
    with SingleTickerProviderStateMixin {
  late TabController _tc;

  @override
  void initState() {
    super.initState();
    _tc = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tc.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TabBar(
          controller: _tc,
          labelColor: AppColors.kPrimary,
          unselectedLabelColor: AppColors.kTextSecondary,
          indicatorColor: AppColors.kPrimary,
          tabs: const [
            Tab(text: 'Leave Requests'),
            Tab(text: 'Attendance'),
          ],
        ),
        Expanded(
          child: TabBarView(
            controller: _tc,
            children: const [
              _LeaveList(),
              _AttendanceList(),
            ],
          ),
        ),
      ],
    );
  }
}

class _LeaveList extends ConsumerWidget {
  const _LeaveList();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_managerLeaveProvider);
    return async.when(
      loading: () =>
          const MobileLoadingView(message: 'Loading leave requests…'),
      error: (e, _) => MobileEmptyState(
        icon: Icons.error_outline,
        title: 'Could not load',
        subtitle: e.toString(),
        action: TextButton(
          onPressed: () => ref.invalidate(_managerLeaveProvider),
          child: const Text('Retry'),
        ),
      ),
      data: (items) {
        if (items.isEmpty) {
          return const MobileEmptyState(
            icon: Icons.beach_access,
            title: 'No pending leave requests',
            subtitle: 'No leave requests awaiting your approval.',
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: items.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, i) =>
              _LeaveTile(leave: items[i], ref: ref),
        );
      },
    );
  }
}

class _LeaveTile extends StatelessWidget {
  const _LeaveTile({required this.leave, required this.ref});

  final Map<String, dynamic> leave;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    final name = leave['staff_name'] ?? leave['employee_name'] ?? '—';
    final type = leave['leave_type'] ?? leave['type'] ?? '—';
    final from = leave['start_date'] ?? leave['from_date'] ?? '';
    final to = leave['end_date'] ?? leave['to_date'] ?? '';
    final reason = leave['reason'] ?? '';

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
              const Icon(Icons.person, color: AppColors.kPrimary, size: 18),
              const SizedBox(width: 8),
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
            '$from → $to',
            style: const TextStyle(
              color: AppColors.kTextSecondary,
              fontSize: 12,
              fontFamily: 'SF Pro Display',
            ),
          ),
          if (reason.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              reason.toString(),
              style: const TextStyle(
                color: AppColors.kTextSecondary,
                fontSize: 11,
                fontStyle: FontStyle.italic,
                fontFamily: 'SF Pro Display',
              ),
            ),
          ],
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
      await ref
          .read(branchManagerRepositoryProvider)
          .approveLeave(id);
      ref.invalidate(_managerLeaveProvider);
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
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    final id = '${leave['id']}';
    try {
      await ref
          .read(branchManagerRepositoryProvider)
          .rejectLeave(id, reason: reason);
      ref.invalidate(_managerLeaveProvider);
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

class _AttendanceList extends ConsumerWidget {
  const _AttendanceList();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_managerAttendanceProvider);
    return async.when(
      loading: () =>
          const MobileLoadingView(message: 'Loading attendance…'),
      error: (e, _) => MobileEmptyState(
        icon: Icons.error_outline,
        title: 'Could not load',
        subtitle: e.toString(),
        action: TextButton(
          onPressed: () => ref.invalidate(_managerAttendanceProvider),
          child: const Text('Retry'),
        ),
      ),
      data: (items) {
        if (items.isEmpty) {
          return const MobileEmptyState(
            icon: Icons.access_time,
            title: 'No attendance data',
            subtitle: 'No attendance records found for today.',
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: items.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (context, i) {
            final a = items[i];
            final name =
                a['staff_name'] ?? a['employee_name'] ?? '—';
            final status =
                (a['status'] ?? 'ABSENT').toString().toUpperCase();
            final time = a['clock_in'] ?? a['check_in'] ?? '';
            final isPresent =
                status == 'PRESENT' || status == 'CLOCKED_IN';

            return Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.kCardBg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: isPresent
                          ? AppColors.kSuccess
                          : AppColors.kError,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 12),
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
                    time.isNotEmpty ? time.toString() : status,
                    style: TextStyle(
                      color: isPresent
                          ? AppColors.kSuccess
                          : AppColors.kTextSecondary,
                      fontSize: 12,
                      fontFamily: 'SF Pro Display',
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Tab 4 — Stock
// ---------------------------------------------------------------------------

class _StockTab extends ConsumerWidget {
  const _StockTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_managerStockProvider);
    return async.when(
      loading: () =>
          const MobileLoadingView(message: 'Loading stock…'),
      error: (e, _) => MobileEmptyState(
        icon: Icons.error_outline,
        title: 'Could not load stock',
        subtitle: e.toString(),
        action: TextButton(
          onPressed: () => ref.invalidate(_managerStockProvider),
          child: const Text('Retry'),
        ),
      ),
      data: (items) {
        if (items.isEmpty) {
          return const MobileEmptyState(
            icon: Icons.check_circle_outline,
            title: 'All stock levels OK',
            subtitle: 'No items below reorder level.',
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: items.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, i) => _ManagerStockTile(item: items[i]),
        );
      },
    );
  }
}

class _ManagerStockTile extends StatelessWidget {
  const _ManagerStockTile({required this.item});

  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final name = item['name'] ?? item['item_name'] ?? '—';
    final qty = item['current_quantity'] ?? item['quantity'] ?? 0;
    final reorder = item['reorder_level'] ?? item['min_stock'] ?? 0;
    final unit = item['unit'] ?? '';
    final category = item['category'] ?? '';

    final pct = reorder > 0 ? (qty as num) / (reorder as num) : 1.0;
    final color = pct < 0.5
        ? AppColors.kError
        : pct < 1.0
            ? AppColors.kWarning
            : AppColors.kSuccess;

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
                  category.toString(),
                  style: const TextStyle(
                    color: AppColors.kTextSecondary,
                    fontSize: 11,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
                const SizedBox(height: 6),
                LinearProgressIndicator(
                  value: pct.clamp(0.0, 1.0).toDouble(),
                  backgroundColor: Colors.grey.shade200,
                  color: color,
                  minHeight: 4,
                  borderRadius: BorderRadius.circular(2),
                ),
              ],
            ),
          ),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '$qty $unit',
                style: TextStyle(
                  color: color,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  fontFamily: 'SF Pro Display',
                ),
              ),
              Text(
                'min: $reorder',
                style: const TextStyle(
                  color: AppColors.kTextSecondary,
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
}

// ---------------------------------------------------------------------------
// Tab 5 — Reservations
// ---------------------------------------------------------------------------

class _ReservationsTab extends ConsumerWidget {
  const _ReservationsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_managerBookingsProvider);
    return async.when(
      loading: () =>
          const MobileLoadingView(message: 'Loading reservations…'),
      error: (e, _) => MobileEmptyState(
        icon: Icons.error_outline,
        title: 'Could not load',
        subtitle: e.toString(),
        action: TextButton(
          onPressed: () => ref.invalidate(_managerBookingsProvider),
          child: const Text('Retry'),
        ),
      ),
      data: (bookings) {
        if (bookings.isEmpty) {
          return const MobileEmptyState(
            icon: Icons.bed_outlined,
            title: 'No active reservations',
            subtitle: 'No bookings currently active.',
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: bookings.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, i) => _BookingTile(booking: bookings[i]),
        );
      },
    );
  }
}

class _BookingTile extends StatelessWidget {
  const _BookingTile({required this.booking});

  final Map<String, dynamic> booking;

  @override
  Widget build(BuildContext context) {
    final guest =
        booking['guest_name'] ?? booking['customer_name'] ?? '—';
    final room = booking['room_number'] ??
        booking['room'] ??
        booking['room_id'] ??
        '—';
    final checkIn = booking['check_in_date'] ??
        booking['check_in'] ??
        '';
    final checkOut = booking['check_out_date'] ??
        booking['check_out'] ??
        '';
    final status =
        (booking['status'] ?? 'ACTIVE').toString().toUpperCase();

    final statusColor = status == 'CHECKED_IN'
        ? AppColors.kSuccess
        : status == 'PENDING'
            ? AppColors.kWarning
            : AppColors.kPrimary;

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
            child: const Icon(Icons.bed,
                color: AppColors.kPrimary, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  guest.toString(),
                  style: const TextStyle(
                    color: AppColors.kTextPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
                Text(
                  'Room $room • $checkIn → $checkOut',
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
              color: statusColor.withOpacity(0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              status,
              style: TextStyle(
                color: statusColor,
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
