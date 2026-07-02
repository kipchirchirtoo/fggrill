import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_notifier.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/safe_avatar.dart';
import '../../data/models/system_user.dart';
import '../../domain/admin_providers.dart';
import '../widgets/admin_table.dart';
import '../widgets/admin_dialogs.dart';
import 'package:famous_gates_app/features/admin/data/models/branch.dart';
import 'package:famous_gates_app/features/admin/data/admin_repository.dart';

class StaffSection extends ConsumerStatefulWidget {
  const StaffSection({super.key});

  @override
  ConsumerState<StaffSection> createState() => _StaffSectionState();
}

class _StaffSectionState extends ConsumerState<StaffSection> {
  final _searchController = TextEditingController();
  String? _selectedBranchId;
  String? _selectedDepartment;
  String? _selectedStaffId;

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
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final staffAsync = ref.watch(adminStaffProvider);
    final branchesAsync = ref.watch(adminBranchesProvider);
    final branches = branchesAsync.valueOrNull ?? [];
    final branchNames = {
      for (final branch in branches) branch.id: branch.name,
    };

    return staffAsync.when(
      loading: () => const LoadingSkeleton(type: SkeletonType.table),
      error: (err, _) => ErrorState(
        message: '$err',
        onRetry: () => ref.invalidate(adminStaffProvider),
      ),
      data: (staff) {
        var filtered = List<AdminUser>.from(staff);

        if (_searchController.text.isNotEmpty) {
          final q = _searchController.text.toLowerCase();
          filtered = filtered
              .where((s) =>
                  s.name.toLowerCase().contains(q) ||
                  s.email.toLowerCase().contains(q) ||
                  s.department.toLowerCase().contains(q) ||
                  s.position.toLowerCase().contains(q))
              .toList();
        }
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
          onRefresh: () async {
            ref.invalidate(adminBranchesProvider);
            ref.invalidate(adminStaffProvider);
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Staff',
                  style: Theme.of(context).textTheme.displaySmall,
                ),
                const SizedBox(height: 20),
                _buildFilterBar(branches),
                const SizedBox(height: 20),
                if (filtered.isEmpty)
                  EmptyState(
                      message: 'No staff found', icon: PhosphorIcons.users())
                else
                  _buildStaffTable(filtered, branchNames),
                const SizedBox(height: 20),
                if (_selectedStaffId != null)
                  _buildStaffDetail(
                    staff.firstWhere((s) => s.id == _selectedStaffId,
                        orElse: () => staff.first),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildFilterBar(List<AdminBranch> branches) {
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
            SizedBox(
              width: 220,
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Search staff...',
                  prefixIcon: Icon(PhosphorIcons.magnifyingGlass(), size: 20),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                ),
                onChanged: (_) => setState(() {}),
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
            const SizedBox.shrink(),
            ElevatedButton.icon(
              onPressed: () async {
                await showUserDialog(context, isStaffMode: true);
                // Provider invalidation is handled inside _UserDialog._submit();
                // no additional work needed here, but awaiting keeps the call
                // site honest and prevents any future handler from running
                // before the dialog is fully dismissed.
              },
              icon: Icon(PhosphorIcons.plus(), size: 20),
              label: const Text('Add Staff'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStaffTable(
    List<AdminUser> staff,
    Map<String, String> branchNames,
  ) {
    return AdminTable(
      columns: const [
        'Name',
        'Email',
        'Department',
        'Position',
        'Branch',
        'Salary',
        'Status',
        ''
      ],
      rows: staff.map<List<Widget>>((s) {
        return [
          GestureDetector(
            onTap: () => setState(() {
              _selectedStaffId = _selectedStaffId == s.id ? null : s.id;
            }),
            child: Row(
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
                Text(s.name,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        color: AppColors.kPrimary,
                        decoration: TextDecoration.underline,
                        decorationColor: AppColors.kPrimary)),
              ],
            ),
          ),
          Text(s.email, style: const TextStyle(fontSize: 13)),
          Text(s.department.isNotEmpty ? s.department : '-',
              style: const TextStyle(fontSize: 13)),
          Text(s.position.isNotEmpty ? s.position : '-',
              style: const TextStyle(fontSize: 13)),
          Text(
            s.branchName.isNotEmpty
                ? s.branchName
                : (branchNames[s.branchId] ?? '-'),
            style: const TextStyle(fontSize: 13),
          ),
          Text('\$${s.salary.toStringAsFixed(0)}',
              style:
                  const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: s.isActive ? AppColors.kSuccess : AppColors.kError,
                ),
              ),
              const SizedBox(width: 6),
              Text(s.isActive ? 'Active' : 'Inactive',
                  style: const TextStyle(fontSize: 13)),
            ],
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                icon: Icon(PhosphorIcons.pencilLine(), size: 18),
                onPressed: () async =>
                    showUserDialog(context, user: s, isStaffMode: true),
                tooltip: 'Edit',
              ),
              IconButton(
                icon: Icon(PhosphorIcons.prohibit(),
                    size: 18, color: AppColors.kError),
                onPressed: () => _confirmDelete(s),
                tooltip: 'Delete',
              ),
            ],
          ),
        ];
      }).toList(),
      hasActions: true,
    );
  }

  Widget _buildStaffDetail(AdminUser staff) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                SafeAvatar(
                  imageUrl: staff.profilePhoto,
                  name: staff.name,
                  radius: 32,
                  backgroundColor: AppColors.kPrimary.withValues(alpha: 0.1),
                  foregroundColor: AppColors.kPrimary,
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(staff.name,
                          style: const TextStyle(
                              fontSize: 18, fontWeight: FontWeight.w600)),
                      Text('${staff.position} - ${staff.department}',
                          style:
                              const TextStyle(color: AppColors.kTextSecondary)),
                    ],
                  ),
                ),
                IconButton(
                  icon: Icon(PhosphorIcons.x(), size: 18),
                  onPressed: () => setState(() => _selectedStaffId = null),
                ),
              ],
            ),
            const SizedBox(height: 20),
            const Divider(),
            const SizedBox(height: 16),
            const Text('Attendance Summary',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                    child: _summaryCard('Present', '18',
                        PhosphorIcons.checkCircle(), AppColors.kSuccess)),
                const SizedBox(width: 8),
                Expanded(
                    child: _summaryCard('Late', '2', PhosphorIcons.clock(),
                        AppColors.kWarning)),
                const SizedBox(width: 8),
                Expanded(
                    child: _summaryCard(
                        'Absent', '1', PhosphorIcons.x(), AppColors.kError)),
                const SizedBox(width: 8),
                Expanded(
                    child: _summaryCard('Leave', '3',
                        PhosphorIcons.calendarBlank(), AppColors.kPrimary)),
              ],
            ),
            const SizedBox(height: 20),
            const Text('Payroll History',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.kSurface,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'Payroll history will appear here.',
                style: TextStyle(color: AppColors.kTextSecondary),
              ),
            ),
            const SizedBox(height: 16),
            const Text('Leave Balance',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: _leaveChip('Annual', '12 days')),
                const SizedBox(width: 8),
                Expanded(child: _leaveChip('Sick', '8 days')),
                const SizedBox(width: 8),
                Expanded(child: _leaveChip('Personal', '4 days')),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _summaryCard(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 4),
          Text(value,
              style: TextStyle(
                  fontWeight: FontWeight.bold, color: color, fontSize: 16)),
          Text(label,
              style: const TextStyle(
                  fontSize: 11, color: AppColors.kTextSecondary)),
        ],
      ),
    );
  }

  Widget _leaveChip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.kSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 12, color: AppColors.kTextSecondary)),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Future<void> _confirmDelete(AdminUser staff) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Staff'),
        content: Text('Are you sure you want to delete "${staff.name}"?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child:
                const Text('Delete', style: TextStyle(color: AppColors.kError)),
          ),
        ],
      ),
    );

    if (confirm != true || !mounted) return;

    try {
      await ref.read(adminRepositoryProvider).deleteStaff(staff.id);
      if (!mounted) return;
      ref.invalidate(adminStaffProvider);
      // Clear detail panel if the deleted staff was selected.
      if (_selectedStaffId == staff.id) {
        setState(() => _selectedStaffId = null);
      }
      AppNotifier.showSnackBar(
        context,
        const SnackBar(
          content: Text('Staff member deleted'),
          backgroundColor: AppColors.kSuccess,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      AppNotifier.showSnackBar(
        context,
        SnackBar(
          content: Text('Failed to delete staff: $e'),
          backgroundColor: AppColors.kError,
        ),
      );
    }
  }
}
