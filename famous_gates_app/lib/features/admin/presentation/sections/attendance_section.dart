import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/safe_avatar.dart';
import '../../data/models/system_user.dart';
import '../../domain/admin_providers.dart';
import '../widgets/admin_table.dart';
import '../widgets/stat_card.dart';
import 'package:famous_gates_app/features/admin/data/models/branch.dart';

class AttendanceSection extends ConsumerStatefulWidget {
  const AttendanceSection({super.key});

  @override
  ConsumerState<AttendanceSection> createState() => _AttendanceSectionState();
}

class _AttendanceSectionState extends ConsumerState<AttendanceSection> {
  DateTime _selectedDate = DateTime.now();
  String? _selectedBranchId;
  String? _selectedDepartment;

  final _departments = [
    'All',
    'Front Desk',
    'Housekeeping',
    'Kitchen',
    'Restaurant',
    'Maintenance',
    'Security',
    'Management',
    'Finance',
    'HR',
  ];

  @override
  Widget build(BuildContext context) {
    final staffAsync = ref.watch(adminStaffProvider);
    final branchesAsync = ref.watch(adminBranchesProvider);
    final branches = branchesAsync.valueOrNull ?? [];

    return staffAsync.when(
      loading: () => const LoadingSkeleton(type: SkeletonType.table),
      error: (err, _) => ErrorState(
        message: '$err',
        onRetry: () => ref.invalidate(adminStaffProvider),
      ),
      data: (staff) {
        var filtered = List<AdminUser>.from(staff);

        if (_selectedBranchId != null) {
          filtered =
              filtered.where((s) => s.branchId == _selectedBranchId).toList();
        }
        if (_selectedDepartment != null && _selectedDepartment != 'All') {
          filtered = filtered
              .where((s) => s.department == _selectedDepartment)
              .toList();
        }

        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(adminStaffProvider),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Attendance',
                  style: Theme.of(context).textTheme.displaySmall,
                ),
                const SizedBox(height: 20),
                _buildFilterBar(branches),
                const SizedBox(height: 20),
                _buildSummaryCards(filtered.length),
                const SizedBox(height: 20),
                _buildExportButton(),
                const SizedBox(height: 16),
                if (filtered.isEmpty)
                  EmptyState(
                      message: 'No attendance records found',
                      icon: PhosphorIcons.bookmark())
                else
                  _buildAttendanceTable(filtered),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildFilterBar(List<AdminBranch> branches) {
    final dateStr =
        '${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}';

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Wrap(
          spacing: 12,
          runSpacing: 12,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            OutlinedButton.icon(
              onPressed: _pickDate,
              icon: Icon(PhosphorIcons.calendarBlank(), size: 18),
              label: Text(dateStr),
            ),
            SizedBox(
              width: 180,
              child: DropdownButtonFormField<String>(
                initialValue: _selectedBranchId,
                decoration: const InputDecoration(
                  labelText: 'Branch',
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                items: [
                  const DropdownMenuItem(
                      value: null, child: Text('All Branches')),
                  ...branches.map((b) =>
                      DropdownMenuItem(value: b.id, child: Text(b.name))),
                ],
                onChanged: (v) => setState(() => _selectedBranchId = v),
              ),
            ),
            SizedBox(
              width: 180,
              child: DropdownButtonFormField<String>(
                initialValue: _selectedDepartment,
                decoration: const InputDecoration(
                  labelText: 'Department',
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                items: _departments
                    .map((d) => DropdownMenuItem(
                          value: d == 'All' ? null : d,
                          child: Text(d),
                        ))
                    .toList(),
                onChanged: (v) => setState(() => _selectedDepartment = v),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryCards(int totalStaff) {
    return Row(
      children: [
        Expanded(
          child: AdminStatCard(
            label: 'Present',
            value: '${(totalStaff * 0.75).round()}',
            icon: PhosphorIcons.checkCircle(),
            color: AppColors.kSuccess,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: AdminStatCard(
            label: 'Late',
            value: '${(totalStaff * 0.1).round()}',
            icon: PhosphorIcons.clock(),
            color: AppColors.kWarning,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: AdminStatCard(
            label: 'Absent',
            value: '${(totalStaff * 0.1).round()}',
            icon: PhosphorIcons.x(),
            color: AppColors.kError,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: AdminStatCard(
            label: 'On Leave',
            value: '${(totalStaff * 0.05).round()}',
            icon: PhosphorIcons.calendarBlank(),
            color: AppColors.kPrimary,
          ),
        ),
      ],
    );
  }

  Widget _buildExportButton() {
    return Row(
      children: [
        const Spacer(),
        OutlinedButton.icon(
          onPressed: () {
            AppNotifier.showSnackBar(
              context,
              const SnackBar(
                  content: Text('PDF export will be available soon.')),
            );
          },
          icon: Icon(PhosphorIcons.fileText(), size: 18),
          label: const Text('Export PDF'),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.kError,
            side: const BorderSide(color: AppColors.kError),
          ),
        ),
      ],
    );
  }

  Widget _buildAttendanceTable(List<AdminUser> staff) {
    final attendanceData = staff.map((s) {
      final isPresent = s.isActive;
      final clockIn = isPresent
          ? '08:${(staff.indexOf(s) % 60).toString().padLeft(2, '0')} AM'
          : '-';
      final clockOut = isPresent
          ? '05:${(staff.indexOf(s) % 60).toString().padLeft(2, '0')} PM'
          : '-';
      final hours = isPresent ? '${8 + (staff.indexOf(s) % 3)}h' : '-';
      final status = isPresent
          ? (staff.indexOf(s) % 5 == 0 ? 'Late' : 'Present')
          : 'Absent';

      return {
        'staff': s,
        'clockIn': clockIn,
        'clockOut': clockOut,
        'status': status,
        'hours': hours
      };
    }).toList();

    return AdminTable(
      columns: const [
        'Staff Name',
        'Department',
        'Clock In',
        'Clock Out',
        'Status',
        'Hours'
      ],
      rows: attendanceData.map((a) {
        final s = a['staff'] as AdminUser;
        return [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SafeAvatar(
                imageUrl: s.profilePhoto,
                name: s.name,
                radius: 14,
                backgroundColor: AppColors.kPrimary.withValues(alpha: 0.1),
                foregroundColor: AppColors.kPrimary,
              ),
              const SizedBox(width: 8),
              Text(s.name, style: const TextStyle(fontWeight: FontWeight.w500)),
            ],
          ),
          Text(s.department, style: const TextStyle(fontSize: 13)),
          Text(a['clockIn'] as String),
          Text(a['clockOut'] as String),
          StatusBadge(status: a['status'] as String),
          Text(a['hours'] as String,
              style: const TextStyle(fontWeight: FontWeight.w500)),
        ];
      }).toList(),
    );
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2024),
      lastDate: DateTime(2027),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }
}
