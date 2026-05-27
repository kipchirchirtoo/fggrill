import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/repository.dart';
import '../domain/providers.dart';

class EmployeePortalScreen extends ConsumerStatefulWidget {
  const EmployeePortalScreen({super.key});
  @override
  ConsumerState<EmployeePortalScreen> createState() =>
      _EmployeePortalScreenState();
}

class _EmployeePortalScreenState extends ConsumerState<EmployeePortalScreen> {
  int _tab = 0;
  @override
  Widget build(BuildContext context) {
    return DashboardShell(
      title: 'Employee Portal',
      currentTab: _tab,
      onTabChanged: (i) => setState(() => _tab = i),
      tabs: [
        DashboardTab(
            label: 'Overview',
            icon: PhosphorIcons.house(),
            content: const _EmployeeOverviewTab()),
        DashboardTab(
            label: 'Profile',
            icon: PhosphorIcons.user(),
            content: const _EmployeeProfileTab()),
        DashboardTab(
            label: 'My Schedule',
            icon: PhosphorIcons.calendar(),
            content: const _EmployeeSchedulesTab()),
        DashboardTab(
            label: 'Time Clock',
            icon: PhosphorIcons.clock(),
            content: const _EmployeeTimeClockTab()),
        DashboardTab(
            label: 'Leave',
            icon: PhosphorIcons.paperPlaneTilt(),
            content: const _EmployeeLeaveTab()),
        const DashboardTab(
            label: 'Tasks', icon: Icons.task_alt, content: _EmployeeTasksTab()),
        const DashboardTab(
            label: 'Content',
            icon: Icons.folder_copy_outlined,
            content: _EmployeeContentTab()),
      ],
    );
  }
}

class _EmployeeProfileTab extends ConsumerWidget {
  const _EmployeeProfileTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(employeeProfileProvider);
    return profile.when(
      data: (p) {
        final data = p['data'] ?? p;
        return ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text('Profile', style: Theme.of(context).textTheme.displaySmall),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(children: [
                  _InfoRow(
                      'Name',
                      '${data['first_name'] ?? ''} ${data['last_name'] ?? ''}'
                          .trim()),
                  _InfoRow('Employee ID',
                      (data['employee_id'] ?? data['id'] ?? '').toString()),
                  _InfoRow('Email', (data['email'] ?? '').toString()),
                  _InfoRow('Phone', (data['phone'] ?? '').toString()),
                  _InfoRow('Department', (data['department'] ?? '').toString()),
                  _InfoRow('Position',
                      (data['position'] ?? data['role'] ?? '').toString()),
                ]),
              ),
            ),
          ],
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ErrorState(message: '$e'),
    );
  }
}

class _EmployeeTimeClockTab extends ConsumerWidget {
  const _EmployeeTimeClockTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final entries = ref.watch(employeeTimeClockProvider);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Time Clock', style: Theme.of(context).textTheme.displaySmall),
        const SizedBox(height: 16),
        Row(children: [
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(minimumSize: const Size(140, 44)),
            onPressed: () async {
              await ref
                  .read(employeePortalRepositoryProvider)
                  .clock('clock_in');
              ref.invalidate(employeeTimeClockProvider);
            },
            icon: const Icon(Icons.login, size: 16),
            label: const Text('Clock In'),
          ),
          const SizedBox(width: 12),
          OutlinedButton.icon(
            onPressed: () async {
              await ref
                  .read(employeePortalRepositoryProvider)
                  .clock('clock_out');
              ref.invalidate(employeeTimeClockProvider);
            },
            icon: const Icon(Icons.logout, size: 16),
            label: const Text('Clock Out'),
          ),
        ]),
        const SizedBox(height: 16),
        Expanded(
          child: entries.when(
            data: (rows) => _empList(
                rows,
                Icons.access_time,
                (r) => (r['action'] ?? 'Clock entry').toString(),
                (r) => (r['timestamp'] ?? r['created_at'] ?? '').toString()),
            loading: () => const LoadingSkeleton(type: SkeletonType.list),
            error: (e, _) => ErrorState(message: '$e'),
          ),
        ),
      ]),
    );
  }
}

class _EmployeeOverviewTab extends ConsumerWidget {
  const _EmployeeOverviewTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dash = ref.watch(employeeDashboardProvider);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          dash.when(
            data: (d) {
              final profile = d['data']?['profile'] ?? d['profile'] ?? {};
              final firstName = (profile['first_name'] ?? '').toString();
              final lastName = (profile['last_name'] ?? '').toString();
              final role =
                  (profile['role'] ?? d['data']?['role'] ?? '').toString();
              final dept = (profile['department'] ?? '').toString();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 32,
                        backgroundColor:
                            AppColors.kPrimary.withValues(alpha: 0.1),
                        child: Text(
                          firstName.isNotEmpty
                              ? firstName[0].toUpperCase()
                              : '?',
                          style: const TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              color: AppColors.kPrimary),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('$firstName $lastName',
                              style: Theme.of(context)
                                  .textTheme
                                  .headlineSmall
                                  ?.copyWith(fontWeight: FontWeight.bold)),
                          if (role.isNotEmpty)
                            Text(role,
                                style: const TextStyle(
                                    color: AppColors.kTextSecondary)),
                          if (dept.isNotEmpty)
                            Text(dept,
                                style: const TextStyle(
                                    color: AppColors.kTextSecondary,
                                    fontSize: 12)),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),
                  Wrap(
                    spacing: 16,
                    runSpacing: 16,
                    children: [
                      _EmpStatCard(
                          label: 'Shifts This Week',
                          value: '${d['data']?['shifts_this_week'] ?? '-'}',
                          icon: PhosphorIcons.calendar()),
                      _EmpStatCard(
                          label: 'Hours This Month',
                          value: '${d['data']?['hours_this_month'] ?? '-'}',
                          icon: PhosphorIcons.clock()),
                      _EmpStatCard(
                          label: 'Leave Days Left',
                          value: '${d['data']?['leave_days_remaining'] ?? '-'}',
                          icon: PhosphorIcons.paperPlaneTilt()),
                      _EmpStatCard(
                          label: 'Attendance Rate',
                          value: '${d['data']?['attendance_rate'] ?? '-'}%',
                          icon: PhosphorIcons.checkCircle()),
                    ],
                  ),
                ],
              );
            },
            loading: () => const LoadingSkeleton(type: SkeletonType.card),
            error: (e, _) => ErrorState(
                message: '$e',
                onRetry: () => ref.invalidate(employeeDashboardProvider)),
          ),
        ],
      ),
    );
  }
}

final _empScheduleFiltersProvider =
    StateProvider<Map<String, String?>>((ref) => const {});

class _EmployeeSchedulesTab extends ConsumerWidget {
  const _EmployeeSchedulesTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filters = ref.watch(_empScheduleFiltersProvider);
    final schedules = ref.watch(employeeSchedulesProvider(filters));
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('My Schedule', style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 16),
          Row(
            children: [
              OutlinedButton.icon(
                onPressed: () async {
                  final picked = await showDateRangePicker(
                    context: context,
                    firstDate: DateTime(2024),
                    lastDate: DateTime(2027),
                  );
                  if (picked != null) {
                    ref.read(_empScheduleFiltersProvider.notifier).state = {
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
                    : 'Select Date Range'),
              ),
              const SizedBox(width: 12),
              if (filters['start_date'] != null)
                TextButton(
                  onPressed: () => ref
                      .read(_empScheduleFiltersProvider.notifier)
                      .state = const {},
                  child: const Text('Clear'),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
            child: schedules.when(
              data: (rows) => rows.isEmpty
                  ? const EmptyState(
                      message: 'No schedules found for this period',
                      icon: Icons.calendar_today_outlined)
                  : ListView.separated(
                      itemCount: rows.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (_, i) {
                        final s = rows[i];
                        final date =
                            (s['date'] ?? s['shift_date'] ?? '').toString();
                        final startTime =
                            (s['start_time'] ?? s['clock_in'] ?? '').toString();
                        final endTime =
                            (s['end_time'] ?? s['clock_out'] ?? '').toString();
                        final status = (s['status'] ?? '').toString();
                        final statusColor = status == 'confirmed'
                            ? AppColors.kSuccess
                            : status == 'pending'
                                ? AppColors.kWarning
                                : AppColors.kTextSecondary;
                        return ListTile(
                          leading: CircleAvatar(
                            backgroundColor:
                                AppColors.kPrimary.withValues(alpha: 0.1),
                            child: Icon(PhosphorIcons.calendar(),
                                color: AppColors.kPrimary, size: 18),
                          ),
                          title: Text(date,
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Text(startTime.isNotEmpty
                              ? '$startTime – $endTime'
                              : (s['shift_name'] ?? '').toString()),
                          trailing: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: statusColor.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(status,
                                style: TextStyle(
                                    fontSize: 11, color: statusColor)),
                          ),
                        );
                      },
                    ),
              loading: () => const LoadingSkeleton(type: SkeletonType.list),
              error: (e, _) => ErrorState(
                  message: '$e',
                  onRetry: () =>
                      ref.invalidate(employeeSchedulesProvider(filters))),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmployeeLeaveTab extends ConsumerWidget {
  const _EmployeeLeaveTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Leave Requests',
              style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 16),
          Align(
            alignment: Alignment.centerLeft,
            child: ElevatedButton.icon(
              onPressed: () => _showLeaveRequestDialog(context, ref),
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Request Leave'),
            ),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: ref.watch(employeeLeaveRequestsProvider).when(
                  data: (rows) {
                    final leaves = rows;
                    if (leaves.isEmpty) {
                      return const EmptyState(
                          message: 'No leave requests',
                          icon: Icons.beach_access_outlined);
                    }
                    return ListView.separated(
                      itemCount: leaves.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (_, i) {
                        final l = leaves[i];
                        final status = (l['status'] ?? '').toString();
                        final color = status == 'approved'
                            ? AppColors.kSuccess
                            : status == 'rejected'
                                ? AppColors.kError
                                : AppColors.kWarning;
                        return ListTile(
                          title: Text(
                              '${l['leave_type'] ?? 'Leave'} — ${l['start_date'] ?? ''} to ${l['end_date'] ?? ''}'),
                          subtitle: Text((l['reason'] ?? '').toString()),
                          trailing: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(8)),
                            child: Text(status,
                                style: TextStyle(color: color, fontSize: 11)),
                          ),
                        );
                      },
                    );
                  },
                  loading: () => const LoadingSkeleton(type: SkeletonType.list),
                  error: (e, _) => ErrorState(message: '$e'),
                ),
          ),
        ],
      ),
    );
  }

  void _showLeaveRequestDialog(BuildContext context, WidgetRef ref) {
    final reasonCtrl = TextEditingController();
    DateTime? startDate;
    DateTime? endDate;
    String leaveType = 'annual';
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          title: const Text('Request Leave'),
          content: SizedBox(
            width: 420,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: leaveType,
                  decoration: const InputDecoration(labelText: 'Leave Type'),
                  items: const [
                    DropdownMenuItem(value: 'annual', child: Text('Annual')),
                    DropdownMenuItem(value: 'sick', child: Text('Sick')),
                    DropdownMenuItem(
                        value: 'emergency', child: Text('Emergency')),
                    DropdownMenuItem(value: 'unpaid', child: Text('Unpaid')),
                  ],
                  onChanged: (v) => setS(() => leaveType = v ?? 'annual'),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () async {
                          final d = await showDatePicker(
                              context: ctx,
                              initialDate: DateTime.now(),
                              firstDate: DateTime.now(),
                              lastDate: DateTime(2027));
                          if (d != null) setS(() => startDate = d);
                        },
                        child: Text(startDate != null
                            ? '${startDate!.day}/${startDate!.month}/${startDate!.year}'
                            : 'Start Date'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () async {
                          final d = await showDatePicker(
                              context: ctx,
                              initialDate: DateTime.now(),
                              firstDate: DateTime.now(),
                              lastDate: DateTime(2027));
                          if (d != null) setS(() => endDate = d);
                        },
                        child: Text(endDate != null
                            ? '${endDate!.day}/${endDate!.month}/${endDate!.year}'
                            : 'End Date'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                TextField(
                    controller: reasonCtrl,
                    decoration: const InputDecoration(labelText: 'Reason'),
                    maxLines: 2),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: startDate != null && endDate != null
                  ? () {
                      Navigator.pop(ctx);
                      AppNotifier.showSnackBar(
                          context,
                          const SnackBar(
                              content: Text('Leave request submitted')));
                    }
                  : null,
              child: const Text('Submit'),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmployeeTasksTab extends ConsumerWidget {
  const _EmployeeTasksTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tasks = ref.watch(employeeTasksProvider);
    return tasks.when(
      data: (rows) => _empList(
          rows,
          Icons.task_alt_outlined,
          (r) => (r['title'] ?? 'Task').toString(),
          (r) =>
              '${r['priority'] ?? ''} • ${r['status'] ?? ''} • Due: ${r['due_date'] ?? '-'}'),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ErrorState(message: '$e'),
    );
  }
}

class _EmployeeContentTab extends ConsumerWidget {
  const _EmployeeContentTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final content = ref.watch(employeeContentProvider);
    return content.when(
      data: (data) => ListView(
        padding: const EdgeInsets.all(24),
        children: data.entries
            .map((entry) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(entry.key[0].toUpperCase() + entry.key.substring(1),
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    _empList(
                        entry.value,
                        Icons.description_outlined,
                        (r) =>
                            (r['title'] ?? r['period'] ?? r['name'] ?? 'Item')
                                .toString(),
                        (r) => (r['posted_date'] ??
                                r['issue_date'] ??
                                r['description'] ??
                                '')
                            .toString()),
                    const SizedBox(height: 20),
                  ],
                ))
            .toList(),
      ),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ErrorState(message: '$e'),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(this.label, this.value);
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(children: [
          SizedBox(
              width: 140,
              child: Text(label,
                  style: const TextStyle(color: AppColors.kTextSecondary))),
          Expanded(
              child: Text(value.isEmpty ? '-' : value,
                  style: const TextStyle(fontWeight: FontWeight.w600))),
        ]),
      );
}

Widget _empList(
    List<Map<String, dynamic>> rows,
    IconData icon,
    String Function(Map<String, dynamic>) title,
    String Function(Map<String, dynamic>) subtitle) {
  if (rows.isEmpty) return const EmptyState(message: 'No records found');
  return ListView.separated(
    shrinkWrap: true,
    physics: const NeverScrollableScrollPhysics(),
    itemCount: rows.length,
    separatorBuilder: (_, __) => const Divider(height: 1),
    itemBuilder: (_, i) => ListTile(
      leading: Icon(icon),
      title: Text(title(rows[i])),
      subtitle: Text(subtitle(rows[i])),
    ),
  );
}

class _EmpStatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  const _EmpStatCard(
      {required this.label, required this.value, required this.icon});
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 180,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: AppColors.kPrimary, size: 24),
              const SizedBox(height: 8),
              Text(value,
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.bold)),
              Text(label,
                  style: const TextStyle(
                      color: AppColors.kTextSecondary, fontSize: 11)),
            ],
          ),
        ),
      ),
    );
  }
}
