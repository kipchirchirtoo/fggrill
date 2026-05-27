import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../domain/admin_providers.dart';
import '../widgets/admin_table.dart';
import '../../../../features/hr/domain/providers.dart';
import '../../../../features/hr/data/repository.dart';

class HrPayrollSection extends ConsumerStatefulWidget {
  const HrPayrollSection({super.key});

  @override
  ConsumerState<HrPayrollSection> createState() => _HrPayrollSectionState();
}

class _HrPayrollSectionState extends ConsumerState<HrPayrollSection> {
  int _subTab = 0;
  final _tabs = ['Payroll', 'Salaries', 'Leave', 'Loans', 'Advances'];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('HR & Payroll Management',
            style: Theme.of(context).textTheme.displaySmall),
        const SizedBox(height: 16),
        _subTabBar(),
        const SizedBox(height: 16),
        Expanded(child: _buildSubTab()),
      ],
    );
  }

  Widget _subTabBar() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: _tabs.asMap().entries.map((e) {
          final active = e.key == _subTab;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(e.value),
              selected: active,
              selectedColor: AppColors.kPrimary,
              labelStyle: TextStyle(
                  color: active ? Colors.white : AppColors.kTextPrimary),
              onSelected: (_) => setState(() => _subTab = e.key),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildSubTab() {
    switch (_subTab) {
      case 0:
        return _payrollView();
      case 1:
        return _salariesView();
      case 2:
        return _leaveView();
      case 3:
        return _loansView();
      case 4:
        return _advancesView();
      default:
        return const SizedBox();
    }
  }

  Widget _payrollView() {
    final payrollAsync = ref.watch(payrollProvider);
    return payrollAsync.when(
      loading: () => const LoadingSkeleton(),
      error: (e, _) => ErrorState(
          message: 'Error loading payroll',
          onRetry: () => ref.invalidate(payrollProvider)),
      data: (records) {
        final pending = records.where((r) => r.status == 'pending').length;
        final approved = records.where((r) => r.status == 'approved').length;
        final totalNet =
            records.fold<double>(0, (sum, r) => sum + (r.netSalary ?? 0));
        return Column(
          children: [
            Row(
              children: [
                _summaryCard('Pending', '$pending', PhosphorIcons.clock(),
                    AppColors.kWarning),
                const SizedBox(width: 12),
                _summaryCard('Last Run', 'May 2026', PhosphorIcons.calendar(),
                    AppColors.kSuccess),
                const SizedBox(width: 12),
                _summaryCard(
                    'Total Payroll',
                    'KES ${totalNet.toStringAsFixed(0)}',
                    PhosphorIcons.coins(),
                    AppColors.kPrimary),
                const SizedBox(width: 12),
                _summaryCard('Approved', '$approved',
                    PhosphorIcons.checkCircle(), AppColors.kSuccess),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                const Text('Payroll Records',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                const Spacer(),
                ElevatedButton.icon(
                  icon: const Icon(Icons.check, size: 16),
                  label: const Text('Approve All'),
                  style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.kSuccess),
                  onPressed:
                      records.isEmpty ? null : () => _approveAll(records),
                ),
              ],
            ),
            const SizedBox(height: 12),
            records.isEmpty
                ? _emptyState('No payroll records',
                    'Run payroll to generate records for staff.')
                : AdminTable(
                    columns: const [
                      'Employee',
                      'Pay Period',
                      'Gross',
                      'Net',
                      'Status',
                      'Actions'
                    ],
                    rows: records
                        .map((r) => [
                              Text(r.staffName ?? '—',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w500)),
                              Text(r.payPeriod ?? '—'),
                              Text(
                                  'KES ${r.grossSalary?.toStringAsFixed(0) ?? '0'}'),
                              Text(
                                  'KES ${r.netSalary?.toStringAsFixed(0) ?? '0'}'),
                              StatusBadge(status: r.status ?? 'pending'),
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  if ((r.status ?? 'pending') == 'pending')
                                    IconButton(
                                      icon: Icon(PhosphorIcons.checkCircle(),
                                          size: 18, color: AppColors.kSuccess),
                                      tooltip: 'Approve',
                                      onPressed: () => _approvePayroll(r.id),
                                    ),
                                  IconButton(
                                    icon: Icon(PhosphorIcons.magnifyingGlass(),
                                        size: 18),
                                    tooltip: 'View',
                                    onPressed: () => _showPayrollDetails(r),
                                  ),
                                ],
                              ),
                            ])
                        .toList(),
                    hasActions: true,
                  ),
          ],
        );
      },
    );
  }

  Future<void> _approveAll(List<dynamic> records) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Approve All Payroll'),
        content: Text('Approve ${records.length} payroll records?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style:
                ElevatedButton.styleFrom(backgroundColor: AppColors.kSuccess),
            child: const Text('Approve All'),
          ),
        ],
      ),
    );
    if (confirm != true || !mounted) return;
    final repo = ref.read(hrRepositoryProvider);
    final pending =
        records.where((r) => (r.status ?? 'pending') == 'pending').toList();
    for (final r in pending) {
      await repo.approvePayroll(r.id);
    }
    ref.invalidate(payrollProvider);
    if (mounted) {
      AppNotifier.showSnackBar(
        context,
        SnackBar(content: Text('${pending.length} payroll records approved')),
      );
    }
  }

  Future<void> _approvePayroll(String id) async {
    try {
      await ref.read(hrRepositoryProvider).approvePayroll(id);
      ref.invalidate(payrollProvider);
      if (mounted) {
        AppNotifier.showSnackBar(
            context, const SnackBar(content: Text('Payroll approved')));
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
                content: Text('Error: $e'), backgroundColor: AppColors.kError));
      }
    }
  }

  void _showPayrollDetails(dynamic r) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(r.staffName ?? 'Payroll Details'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _detailRow('Pay Period', r.payPeriod ?? '—'),
            _detailRow('Gross Salary',
                'KES ${r.grossSalary?.toStringAsFixed(2) ?? '0.00'}'),
            _detailRow('Deductions',
                'KES ${r.deductions?.toStringAsFixed(2) ?? '0.00'}'),
            _detailRow('Net Salary',
                'KES ${r.netSalary?.toStringAsFixed(2) ?? '0.00'}'),
            _detailRow('Status', r.status ?? 'pending'),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Close'))
        ],
      ),
    );
  }

  Widget _detailRow(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label,
                style: const TextStyle(
                    color: AppColors.kTextSecondary, fontSize: 13)),
            Text(value,
                style:
                    const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          ],
        ),
      );

  Widget _salariesView() {
    final staffAsync = ref.watch(adminStaffProvider);
    return staffAsync.when(
      loading: () => const LoadingSkeleton(),
      error: (e, _) => ErrorState(
          message: 'Error loading staff',
          onRetry: () => ref.invalidate(adminStaffProvider)),
      data: (staff) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Salary Records',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          staff.isEmpty
              ? _emptyState('No staff found', 'Add staff to manage salaries.')
              : AdminTable(
                  columns: const [
                    'Name',
                    'Role',
                    'Department',
                    'Salary',
                    'Actions'
                  ],
                  rows: staff
                      .map((s) => [
                            Text(s.name,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w500)),
                            Text(s.role),
                            Text(s.department.isEmpty ? '—' : s.department),
                            const Text('KES —'),
                            IconButton(
                              icon: Icon(PhosphorIcons.pencilLine(), size: 18),
                              tooltip: 'Edit Salary',
                              onPressed: () => _showEditSalaryDialog(s.name),
                            ),
                          ])
                      .toList(),
                  hasActions: true,
                ),
        ],
      ),
    );
  }

  void _showEditSalaryDialog(String name) {
    final salaryCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Update Salary — $name'),
        content: TextField(
          controller: salaryCtrl,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
              labelText: 'Gross Salary (KES)', prefixText: 'KES '),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              AppNotifier.showSnackBar(
                  context, const SnackBar(content: Text('Salary updated')));
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  Widget _leaveView() {
    final leaveAsync = ref.watch(leaveRequestsProvider(null));
    return leaveAsync.when(
      loading: () => const LoadingSkeleton(),
      error: (e, _) => ErrorState(
          message: 'Error loading leave requests',
          onRetry: () => ref.invalidate(leaveRequestsProvider(null))),
      data: (requests) {
        final onLeave = requests.where((r) => r.status == 'approved').length;
        final pending = requests.where((r) => r.status == 'pending').length;
        final rejected = requests.where((r) => r.status == 'rejected').length;
        return Column(
          children: [
            Row(
              children: [
                _summaryCard('On Leave', '$onLeave', PhosphorIcons.clock(),
                    AppColors.kWarning),
                const SizedBox(width: 12),
                _summaryCard('Approved', '$onLeave',
                    PhosphorIcons.checkCircle(), AppColors.kSuccess),
                const SizedBox(width: 12),
                _summaryCard('Pending', '$pending',
                    PhosphorIcons.clockCountdown(), AppColors.kWarning),
                const SizedBox(width: 12),
                _summaryCard('Rejected', '$rejected', PhosphorIcons.x(),
                    AppColors.kError),
              ],
            ),
            const SizedBox(height: 16),
            const Align(
              alignment: Alignment.centerLeft,
              child: Text('Leave Requests',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            ),
            const SizedBox(height: 12),
            requests.isEmpty
                ? _emptyState(
                    'No leave requests', 'No leave applications found.')
                : AdminTable(
                    columns: const [
                      'Employee',
                      'Type',
                      'From',
                      'To',
                      'Status',
                      'Actions'
                    ],
                    rows: requests
                        .map((r) => [
                              Text(r.staffName ?? '—'),
                              Text(r.leaveType ?? 'Annual'),
                              Text(r.startDate != null
                                  ? '${r.startDate!.day}/${r.startDate!.month}/${r.startDate!.year}'
                                  : '—'),
                              Text(r.endDate != null
                                  ? '${r.endDate!.day}/${r.endDate!.month}/${r.endDate!.year}'
                                  : '—'),
                              StatusBadge(status: r.status),
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  if (r.status == 'pending') ...[
                                    IconButton(
                                      icon: Icon(PhosphorIcons.checkCircle(),
                                          size: 18, color: AppColors.kSuccess),
                                      tooltip: 'Approve',
                                      onPressed: () => _approveLeave(r.id),
                                    ),
                                    IconButton(
                                      icon: Icon(PhosphorIcons.x(),
                                          size: 18, color: AppColors.kError),
                                      tooltip: 'Reject',
                                      onPressed: () => _rejectLeave(r.id),
                                    ),
                                  ],
                                ],
                              ),
                            ])
                        .toList(),
                    hasActions: true,
                  ),
          ],
        );
      },
    );
  }

  Future<void> _approveLeave(String id) async {
    try {
      await ref.read(hrRepositoryProvider).approveLeave(id);
      ref.invalidate(leaveRequestsProvider(null));
      if (mounted) {
        AppNotifier.showSnackBar(
            context, const SnackBar(content: Text('Leave approved')));
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
                content: Text('Error: $e'), backgroundColor: AppColors.kError));
      }
    }
  }

  Future<void> _rejectLeave(String id) async {
    try {
      await ref.read(hrRepositoryProvider).rejectLeave(id);
      ref.invalidate(leaveRequestsProvider(null));
      if (mounted) {
        AppNotifier.showSnackBar(
            context, const SnackBar(content: Text('Leave rejected')));
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
                content: Text('Error: $e'), backgroundColor: AppColors.kError));
      }
    }
  }

  Widget _loansView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text('Loan Records',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const Spacer(),
            ElevatedButton.icon(
              onPressed: () => _showLoanDialog(),
              icon: Icon(PhosphorIcons.plus(), size: 16),
              label: const Text('New Loan'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        _emptyState('No loan records', 'No active employee loans found.'),
      ],
    );
  }

  void _showLoanDialog() {
    final staffCtrl = TextEditingController();
    final amountCtrl = TextEditingController();
    final durationCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Loan Application'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
                controller: staffCtrl,
                decoration: const InputDecoration(labelText: 'Staff Name')),
            const SizedBox(height: 12),
            TextField(
                controller: amountCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                    labelText: 'Amount (KES)', prefixText: 'KES ')),
            const SizedBox(height: 12),
            TextField(
                controller: durationCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                    labelText: 'Duration (months)', suffixText: 'months')),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              AppNotifier.showSnackBar(context,
                  const SnackBar(content: Text('Loan application submitted')));
            },
            child: const Text('Submit'),
          ),
        ],
      ),
    );
  }

  Widget _advancesView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text('Salary Advances',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const Spacer(),
            ElevatedButton.icon(
              onPressed: () => _showAdvanceDialog(),
              icon: Icon(PhosphorIcons.plus(), size: 16),
              label: const Text('New Advance'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        _emptyState('No advance records', 'No salary advance requests found.'),
      ],
    );
  }

  void _showAdvanceDialog() {
    final staffCtrl = TextEditingController();
    final amountCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Salary Advance Request'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
                controller: staffCtrl,
                decoration: const InputDecoration(labelText: 'Staff Name')),
            const SizedBox(height: 12),
            TextField(
                controller: amountCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                    labelText: 'Amount (KES)', prefixText: 'KES ')),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              AppNotifier.showSnackBar(context,
                  const SnackBar(content: Text('Advance request submitted')));
            },
            child: const Text('Submit'),
          ),
        ],
      ),
    );
  }

  Widget _emptyState(String title, String subtitle) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(PhosphorIcons.fileText(),
                size: 48,
                color: AppColors.kTextSecondary.withValues(alpha: 0.3)),
            const SizedBox(height: 12),
            Text(title,
                style:
                    const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(subtitle,
                style: const TextStyle(
                    color: AppColors.kTextSecondary, fontSize: 13)),
          ],
        ),
      );

  Widget _summaryCard(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: color, size: 24),
              const SizedBox(height: 12),
              Text(value,
                  style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: AppColors.kPrimary)),
              Text(label,
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.kTextSecondary)),
            ],
          ),
        ),
      ),
    );
  }
}
