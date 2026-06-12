import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'dart:io';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/widgets.dart' hide Badge, DataColumn, DataRow;
import '../../../core/widgets/permission_guard.dart';
import '../../../core/widgets/record_detail_screen.dart';
import '../../../core/config/permissions.dart';
import '../../../core/config/user_roles.dart';
import '../../auth/domain/auth_notifier.dart';
import '../domain/providers.dart';
import '../domain/models.dart';
import '../data/repository.dart';

class HRDashboard extends ConsumerStatefulWidget {
  const HRDashboard({
    super.key,
    this.initialTab = HrTab.overview,
    this.openCreateEmployee = false,
  });

  final HrTab initialTab;
  final bool openCreateEmployee;

  @override
  ConsumerState<HRDashboard> createState() => _HRDashboardState();
}

class HRSectionView extends ConsumerStatefulWidget {
  const HRSectionView({
    super.key,
    required this.initialTab,
    this.openCreateEmployee = false,
  });

  final HrTab initialTab;
  final bool openCreateEmployee;

  @override
  ConsumerState<HRSectionView> createState() => _HRSectionViewState();
}

class _HRSectionViewState extends ConsumerState<HRSectionView> {
  bool _syncedInitialTab = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncInitialTab());
  }

  @override
  void didUpdateWidget(covariant HRSectionView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialTab != widget.initialTab ||
        oldWidget.openCreateEmployee != widget.openCreateEmployee) {
      _syncedInitialTab = false;
      WidgetsBinding.instance.addPostFrameCallback((_) => _syncInitialTab());
    }
  }

  void _syncInitialTab() {
    if (!mounted || _syncedInitialTab) return;
    ref.read(hrTabProvider.notifier).state = widget.initialTab;
    setState(() => _syncedInitialTab = true);
  }

  @override
  Widget build(BuildContext context) {
    return _hrContentForTab(
      context,
      ref,
      widget.initialTab,
      openCreateEmployee: widget.openCreateEmployee,
    );
  }
}

class _HRDashboardState extends ConsumerState<HRDashboard> {
  bool _syncedInitialTab = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncInitialTab());
  }

  @override
  void didUpdateWidget(covariant HRDashboard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialTab != widget.initialTab) {
      _syncedInitialTab = false;
      WidgetsBinding.instance.addPostFrameCallback((_) => _syncInitialTab());
    }
  }

  void _syncInitialTab() {
    if (!mounted || _syncedInitialTab) return;
    ref.read(hrTabProvider.notifier).state = widget.initialTab;
    setState(() => _syncedInitialTab = true);
  }

  @override
  Widget build(BuildContext context) {
    final currentTab = ref.watch(hrTabProvider);
    return DashboardShell(
      title: 'Human Resources',
      tabs: [
        DashboardTab(
          label: 'HR',
          content: Row(
            children: [
              _buildNav(context, ref, currentTab),
              const VerticalDivider(width: 1),
              Expanded(child: _buildContent(context, ref, currentTab)),
            ],
          ),
        )
      ],
    );
  }

  Widget _buildNav(BuildContext context, WidgetRef ref, HrTab current) {
    return Container(
      width: 200,
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(right: BorderSide(color: AppColors.kDivider)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 16),
          _NavItem(
            label: 'HR Overview',
            icon: PhosphorIcons.layoutDashboard(),
            selected: current == HrTab.overview,
            onTap: () =>
                ref.read(hrTabProvider.notifier).state = HrTab.overview,
          ),
          _NavItem(
            label: 'Employees',
            icon: PhosphorIcons.users(),
            selected: current == HrTab.employees,
            onTap: () =>
                ref.read(hrTabProvider.notifier).state = HrTab.employees,
          ),
          _NavItem(
            label: 'Attendance',
            icon: PhosphorIcons.clock(),
            selected: current == HrTab.attendance,
            onTap: () =>
                ref.read(hrTabProvider.notifier).state = HrTab.attendance,
          ),
          _NavItem(
            label: 'Attendance Logs',
            icon: PhosphorIcons.clockClockwise(),
            selected: current == HrTab.attendanceLogs,
            onTap: () =>
                ref.read(hrTabProvider.notifier).state = HrTab.attendanceLogs,
          ),
          _NavItem(
            label: 'Staff Attendance',
            icon: PhosphorIcons.identificationBadge(),
            selected: current == HrTab.staffAttendance,
            onTap: () =>
                ref.read(hrTabProvider.notifier).state = HrTab.staffAttendance,
          ),
          _NavItem(
            label: 'Leave',
            icon: PhosphorIcons.calendar(),
            selected: current == HrTab.leave,
            onTap: () => ref.read(hrTabProvider.notifier).state = HrTab.leave,
          ),
          _NavItem(
            label: 'Shifts',
            icon: PhosphorIcons.calendarBlank(),
            selected: current == HrTab.shifts,
            onTap: () => ref.read(hrTabProvider.notifier).state = HrTab.shifts,
          ),
          _NavItem(
            label: 'Payroll',
            icon: PhosphorIcons.bank(),
            selected: current == HrTab.payroll,
            onTap: () => ref.read(hrTabProvider.notifier).state = HrTab.payroll,
          ),
          _NavItem(
            label: 'Salaries',
            icon: PhosphorIcons.money(),
            selected: current == HrTab.salaries,
            onTap: () =>
                ref.read(hrTabProvider.notifier).state = HrTab.salaries,
          ),
          _NavItem(
            label: 'Adjustments',
            icon: PhosphorIcons.wallet(),
            selected: current == HrTab.salaryAdjustments,
            onTap: () => ref.read(hrTabProvider.notifier).state =
                HrTab.salaryAdjustments,
          ),
          _NavItem(
            label: 'Policies',
            icon: PhosphorIcons.shield(),
            selected: current == HrTab.policies,
            onTap: () =>
                ref.read(hrTabProvider.notifier).state = HrTab.policies,
          ),
          _NavItem(
            label: 'Performance',
            icon: PhosphorIcons.chartLine(),
            selected: current == HrTab.performance,
            onTap: () =>
                ref.read(hrTabProvider.notifier).state = HrTab.performance,
          ),
          _NavItem(
            label: 'Terminal',
            icon: PhosphorIcons.fingerprint(),
            selected: current == HrTab.terminal,
            onTap: () =>
                ref.read(hrTabProvider.notifier).state = HrTab.terminal,
          ),
        ],
      ),
    );
  }

  Widget _buildContent(BuildContext context, WidgetRef ref, HrTab tab) {
    return _hrContentForTab(
      context,
      ref,
      tab,
      openCreateEmployee: widget.openCreateEmployee,
    );
  }
}

Widget _hrContentForTab(
  BuildContext context,
  WidgetRef ref,
  HrTab tab, {
  bool openCreateEmployee = false,
}) {
  switch (tab) {
    case HrTab.overview:
      return const _HROverviewView();
    case HrTab.employees:
      return _StaffDirectoryView(autoOpenCreate: openCreateEmployee);
    case HrTab.attendance:
      return const _AttendanceView();
    case HrTab.attendanceLogs:
      return const _AttendanceView(showLogs: true);
    case HrTab.staffAttendance:
      return const _StaffAttendanceView();
    case HrTab.leave:
      return _LeaveRequestsView();
    case HrTab.shifts:
      return _ShiftsView();
    case HrTab.payroll:
      return _PayrollView();
    case HrTab.salaries:
      return const _SalariesView();
    case HrTab.performance:
      return const _PerformanceView();
    case HrTab.salaryAdjustments:
      return const _SalaryAdjustmentsView();
    case HrTab.reports:
      return const _HRReportsView();
    case HrTab.policies:
      return const _PoliciesView();
    case HrTab.terminal:
      return const _TerminalView();
  }
}

class _NavItem extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _NavItem(
      {required this.label,
      required this.icon,
      required this.selected,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon,
          size: 20,
          color: selected ? AppColors.kPrimary : AppColors.kTextSecondary),
      title: Text(label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: selected ? FontWeight.bold : FontWeight.normal,
            color: selected ? AppColors.kPrimary : AppColors.kTextPrimary,
          )),
      selected: selected,
      onTap: onTap,
    );
  }
}

class _HROverviewView extends ConsumerWidget {
  const _HROverviewView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final staffAsync = ref.watch(staffListProvider(null));
    final attendanceAsync = ref.watch(attendanceProvider);
    final leaveAsync = ref.watch(leaveRequestsProvider('pending'));
    final payrollAsync = ref.watch(payrollProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('HR Overview', style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 20),
          LayoutBuilder(
            builder: (context, constraints) {
              final width = constraints.maxWidth;
              final columns = width < 560 ? 1 : (width < 980 ? 2 : 4);
              final cardWidth = (width - ((columns - 1) * 12)) / columns;
              final cards = [
                _OverviewCard(
                  title: 'Employees',
                  value: staffAsync.maybeWhen(
                      data: (items) => '${items.length}', orElse: () => '—'),
                  icon: PhosphorIcons.users(),
                  color: AppColors.kPrimary,
                ),
                _OverviewCard(
                  title: 'Attendance Today',
                  value: attendanceAsync.maybeWhen(
                      data: (items) => '${items.length}', orElse: () => '—'),
                  icon: PhosphorIcons.clock(),
                  color: AppColors.kSuccess,
                ),
                _OverviewCard(
                  title: 'Pending Leave',
                  value: leaveAsync.maybeWhen(
                      data: (items) => '${items.length}', orElse: () => '—'),
                  icon: PhosphorIcons.calendar(),
                  color: AppColors.kWarning,
                ),
                _OverviewCard(
                  title: 'Payroll Records',
                  value: payrollAsync.maybeWhen(
                      data: (items) => '${items.length}', orElse: () => '—'),
                  icon: PhosphorIcons.bank(),
                  color: Colors.indigo,
                ),
              ];
              return Wrap(
                spacing: 12,
                runSpacing: 12,
                children: cards
                    .map((card) => SizedBox(
                          width: cardWidth,
                          height: 104,
                          child: card,
                        ))
                    .toList(),
              );
            },
          ),
          const SizedBox(height: 20),
          Card(
            child: ListView(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                ListTile(
                  leading:
                      Icon(PhosphorIcons.users(), color: AppColors.kPrimary),
                  title: const Text('Employees'),
                  subtitle: const Text(
                      'Onboard, edit, archive and delete staff profiles'),
                  onTap: () =>
                      ref.read(hrTabProvider.notifier).state = HrTab.employees,
                ),
                ListTile(
                  leading:
                      Icon(PhosphorIcons.clock(), color: AppColors.kPrimary),
                  title: const Text('Attendance'),
                  subtitle:
                      const Text('Review, approve and reject staff attendance'),
                  onTap: () =>
                      ref.read(hrTabProvider.notifier).state = HrTab.attendance,
                ),
                ListTile(
                  leading:
                      Icon(PhosphorIcons.money(), color: AppColors.kPrimary),
                  title: const Text('Payroll & Salaries'),
                  subtitle: const Text(
                      'Process payroll, update salaries and manage adjustments'),
                  onTap: () =>
                      ref.read(hrTabProvider.notifier).state = HrTab.salaries,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _OverviewCard extends StatelessWidget {
  const _OverviewCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String title;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 22, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.kTextSecondary)),
              ],
            ),
          ),
        ]),
      ),
    );
  }
}

class _StaffDirectoryView extends ConsumerStatefulWidget {
  const _StaffDirectoryView({this.autoOpenCreate = false});

  final bool autoOpenCreate;

  @override
  ConsumerState<_StaffDirectoryView> createState() =>
      _StaffDirectoryViewState();
}

class _StaffDirectoryViewState extends ConsumerState<_StaffDirectoryView> {
  bool _openedCreate = false;

  @override
  void initState() {
    super.initState();
    if (widget.autoOpenCreate) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !_openedCreate) {
          _openedCreate = true;
          _showAddStaffDialog(context, ref);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final staffAsync = ref.watch(staffListProvider(null));
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Staff Directory',
                  style: Theme.of(context).textTheme.displaySmall),
              ElevatedButton.icon(
                onPressed: () => _showAddStaffDialog(context, ref),
                icon: const Icon(Icons.person_add),
                label: const Text('Add Staff'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: 300,
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search staff...',
                prefixIcon: Icon(PhosphorIcons.magnifyingGlass()),
                contentPadding: EdgeInsets.zero,
              ),
              onChanged: (value) =>
                  ref.refresh(staffListProvider(value.isEmpty ? null : value)),
            ),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: staffAsync.when(
              data: (staff) => Card(
                child: staff.isEmpty
                    ? const Center(
                        child: Text('No staff members found',
                            style: TextStyle(color: AppColors.kTextSecondary)))
                    : ListView.separated(
                        itemCount: staff.length,
                        separatorBuilder: (_, index) => const Divider(),
                        itemBuilder: (context, index) {
                          final member = staff[index];
                          return ListTile(
                            leading: SafeAvatar(
                              imageUrl: member.photoUrl,
                              name: member.name,
                              radius: 20,
                            ),
                            title: Text(member.name,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600)),
                            subtitle: Text(
                                '${member.role ?? 'No role'} • ${member.branchName ?? ''}'),
                            trailing: PopupMenuButton<String>(
                              onSelected: (value) async {
                                if (value == 'view') {
                                  _showStaffDetailDialog(context, member);
                                } else if (value == 'edit') {
                                  _showEditStaffDialog(context, ref, member);
                                } else if (value == 'photo') {
                                  await _showUploadPhotoDialog(
                                      context, ref, member);
                                } else if (value == 'document') {
                                  await _showUploadDocumentDialog(
                                      context, ref, member);
                                } else if (value == 'archive') {
                                  final notes =
                                      await _archiveNotes(context, member.name);
                                  if (notes != null) {
                                    await ref
                                        .read(hrRepositoryProvider)
                                        .archiveStaff(member.id, notes: notes);
                                    ref.invalidate(staffListProvider(null));
                                  }
                                } else if (value == 'delete') {
                                  final ok = await showDialog<bool>(
                                    context: context,
                                    builder: (ctx) => AlertDialog(
                                      title: const Text('Delete staff member'),
                                      content: Text('Delete ${member.name}?'),
                                      actions: [
                                        TextButton(
                                            onPressed: () =>
                                                Navigator.pop(ctx, false),
                                            child: const Text('Cancel')),
                                        ElevatedButton(
                                            onPressed: () =>
                                                Navigator.pop(ctx, true),
                                            child: const Text('Delete')),
                                      ],
                                    ),
                                  );
                                  if (ok == true) {
                                    await ref
                                        .read(hrRepositoryProvider)
                                        .deleteStaff(member.id);
                                    ref.invalidate(staffListProvider(null));
                                  }
                                }
                              },
                              itemBuilder: (_) => const [
                                PopupMenuItem(
                                    value: 'view', child: Text('View')),
                                PopupMenuItem(
                                    value: 'edit', child: Text('Edit')),
                                PopupMenuItem(
                                    value: 'photo',
                                    child: Text('Upload Photo')),
                                PopupMenuItem(
                                    value: 'document',
                                    child: Text('Upload Document')),
                                PopupMenuItem(
                                    value: 'archive', child: Text('Archive')),
                                PopupMenuItem(
                                    value: 'delete', child: Text('Delete')),
                              ],
                            ),
                          );
                        },
                      ),
              ),
              loading: () =>
                  const Card(child: LoadingSkeleton(type: SkeletonType.list)),
              error: (e, _) => ErrorState(
                  message: '$e',
                  onRetry: () => ref.refresh(staffListProvider(null))),
            ),
          ),
        ],
      ),
    );
  }

  void _showStaffDetailDialog(BuildContext context, StaffMember member) {
    openRecordDetailScreen(
      context,
      title: member.name,
      subtitle: 'Staff Member',
      record: {
        'role': member.role,
        'department': member.department,
        'position': member.position ?? member.role,
        'branch': member.branchName,
        'email': member.email,
        'phone': member.phone,
        'national_id': member.nationalId,
        'employee_id': member.employeeId,
        'shift': member.shift,
        'basic_salary': member.basicSalary,
        'statutory_deductions': [
          if (member.nssfEnabled) 'NSSF',
          if (member.shifEnabled) 'SHIF',
          if (member.housingFundEnabled) 'Housing'
        ].join(', '),
        'status': member.isActive ? 'Active' : 'Inactive',
      },
    );
  }

  Future<String?> _archiveNotes(BuildContext context, String staffName) {
    final notesCtrl = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Archive $staffName'),
        content: TextField(
          controller: notesCtrl,
          decoration: const InputDecoration(labelText: 'Archive notes'),
          maxLines: 3,
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, notesCtrl.text.trim()),
            child: const Text('Archive'),
          ),
        ],
      ),
    );
  }

  Future<void> _showUploadPhotoDialog(
      BuildContext context, WidgetRef ref, StaffMember member) async {
    final pathCtrl = TextEditingController();
    final uploaded = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Upload photo for ${member.name}'),
        content: TextField(
          controller: pathCtrl,
          decoration: const InputDecoration(
            labelText: 'Local image path',
            hintText: '/home/user/Pictures/staff-photo.jpg',
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Upload'),
          ),
        ],
      ),
    );
    if (uploaded != true || pathCtrl.text.trim().isEmpty) return;
    try {
      await ref
          .read(hrRepositoryProvider)
          .uploadStaffPhoto(member.id, pathCtrl.text.trim());
      ref.invalidate(staffListProvider(null));
      if (context.mounted) {
        AppNotifier.showSnackBar(
            context, const SnackBar(content: Text('Photo uploaded')));
      }
    } catch (error) {
      if (context.mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text('Upload failed: $error')));
      }
    }
  }

  Future<void> _showUploadDocumentDialog(
      BuildContext context, WidgetRef ref, StaffMember member) async {
    final pathCtrl = TextEditingController();
    final typeCtrl = TextEditingController(text: 'contract');
    final uploaded = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Upload document for ${member.name}'),
        content: SizedBox(
          width: 420,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(
              controller: typeCtrl,
              decoration: const InputDecoration(labelText: 'Document type'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: pathCtrl,
              decoration: const InputDecoration(
                labelText: 'Local file path',
                hintText: '/home/user/Documents/contract.pdf',
              ),
            ),
          ]),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Upload'),
          ),
        ],
      ),
    );
    if (uploaded != true ||
        pathCtrl.text.trim().isEmpty ||
        typeCtrl.text.trim().isEmpty) {
      return;
    }
    try {
      await ref.read(hrRepositoryProvider).uploadStaffDocument(
            member.id,
            filePath: pathCtrl.text.trim(),
            documentType: typeCtrl.text.trim(),
          );
      if (context.mounted) {
        AppNotifier.showSnackBar(
            context, const SnackBar(content: Text('Document uploaded')));
      }
    } catch (error) {
      if (context.mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text('Upload failed: $error')));
      }
    }
  }

  void _showEditStaffDialog(
      BuildContext context, WidgetRef ref, StaffMember member) {
    final firstCtrl = TextEditingController(
        text: member.firstName ??
            (member.name.trim().contains(' ')
                ? member.name.trim().split(' ').first
                : member.name));
    final lastCtrl = TextEditingController(
        text: member.lastName ??
            (member.name.trim().contains(' ')
                ? member.name.trim().split(' ').skip(1).join(' ')
                : ''));
    final emailCtrl = TextEditingController(text: member.email ?? '');
    final phoneCtrl = TextEditingController(text: member.phone ?? '');
    final nationalCtrl = TextEditingController(text: member.nationalId ?? '');
    final departmentCtrl = TextEditingController(text: member.department ?? '');
    final positionCtrl =
        TextEditingController(text: member.position ?? member.role ?? '');
    final salaryCtrl =
        TextEditingController(text: '${member.basicSalary ?? ''}');
    String shift = member.shift ?? 'morning';
    bool isActive = member.isActive;
    bool nssfEnabled = member.nssfEnabled;
    bool shifEnabled = member.shifEnabled;
    bool housingEnabled = member.housingFundEnabled;
    showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('Edit Staff Member'),
          content: SizedBox(
            width: 520,
            child: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Row(children: [
                  Expanded(
                    child: TextField(
                        controller: firstCtrl,
                        decoration:
                            const InputDecoration(labelText: 'First Name *')),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                        controller: lastCtrl,
                        decoration:
                            const InputDecoration(labelText: 'Last Name *')),
                  ),
                ]),
                const SizedBox(height: 12),
                TextField(
                    controller: emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(labelText: 'Email')),
                const SizedBox(height: 12),
                TextField(
                    controller: phoneCtrl,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(labelText: 'Phone')),
                const SizedBox(height: 12),
                TextField(
                    controller: nationalCtrl,
                    decoration:
                        const InputDecoration(labelText: 'National ID *')),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(
                    child: TextField(
                        controller: departmentCtrl,
                        decoration:
                            const InputDecoration(labelText: 'Department *')),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                        controller: positionCtrl,
                        decoration:
                            const InputDecoration(labelText: 'Position')),
                  ),
                ]),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(
                    child: TextField(
                        controller: salaryCtrl,
                        keyboardType: TextInputType.number,
                        decoration:
                            const InputDecoration(labelText: 'Basic Salary')),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: shift,
                      decoration: const InputDecoration(labelText: 'Shift'),
                      items: const [
                        DropdownMenuItem(
                            value: 'morning', child: Text('Morning')),
                        DropdownMenuItem(
                            value: 'afternoon', child: Text('Afternoon')),
                        DropdownMenuItem(value: 'night', child: Text('Night')),
                        DropdownMenuItem(value: 'day', child: Text('Day')),
                      ],
                      onChanged: (value) =>
                          setState(() => shift = value ?? shift),
                    ),
                  ),
                ]),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Active'),
                  value: isActive,
                  onChanged: (value) => setState(() => isActive = value),
                ),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: nssfEnabled,
                  onChanged: (value) =>
                      setState(() => nssfEnabled = value ?? true),
                  title: const Text('NSSF enabled'),
                ),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: shifEnabled,
                  onChanged: (value) =>
                      setState(() => shifEnabled = value ?? true),
                  title: const Text('SHIF enabled'),
                ),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: housingEnabled,
                  onChanged: (value) =>
                      setState(() => housingEnabled = value ?? true),
                  title: const Text('Housing levy enabled'),
                ),
              ]),
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                await ref.read(hrRepositoryProvider).updateStaff(member.id, {
                  'first_name': firstCtrl.text.trim(),
                  'last_name': lastCtrl.text.trim(),
                  'email': emailCtrl.text.trim(),
                  'phone': phoneCtrl.text.trim(),
                  'national_id': nationalCtrl.text.trim(),
                  'department': departmentCtrl.text.trim(),
                  'position': positionCtrl.text.trim(),
                  'role': positionCtrl.text.trim(),
                  'shift': shift,
                  'basic_salary': num.tryParse(salaryCtrl.text.trim()) ?? 0,
                  'status': isActive ? 'active' : 'inactive',
                  'nssf_enabled': nssfEnabled,
                  'shif_enabled': shifEnabled,
                  'housing_fund_enabled': housingEnabled,
                });
                ref.invalidate(staffListProvider(null));
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  void _showAddStaffDialog(BuildContext context, WidgetRef ref) {
    final firstCtrl = TextEditingController();
    final lastCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final nationalCtrl = TextEditingController();
    final departmentCtrl = TextEditingController();
    final positionCtrl = TextEditingController();
    final branchCtrl = TextEditingController();
    final salaryCtrl = TextEditingController();
    final kraCtrl = TextEditingController();
    final nssfCtrl = TextEditingController();
    final shifCtrl = TextEditingController();
    final bankCtrl = TextEditingController();
    final accountCtrl = TextEditingController();
    final kinNameCtrl = TextEditingController();
    final kinPhoneCtrl = TextEditingController();
    String shift = 'morning';
    String employmentType = 'permanent';
    bool nssfEnabled = true;
    bool shifEnabled = true;
    bool housingEnabled = true;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('Add Staff Member'),
          content: SizedBox(
            width: 560,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(children: [
                    Expanded(
                      child: TextField(
                        controller: firstCtrl,
                        decoration:
                            const InputDecoration(labelText: 'First Name *'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: lastCtrl,
                        decoration:
                            const InputDecoration(labelText: 'Last Name *'),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                      child: TextField(
                        controller: emailCtrl,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(labelText: 'Email'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: phoneCtrl,
                        keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(labelText: 'Phone'),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  TextField(
                    controller: nationalCtrl,
                    decoration:
                        const InputDecoration(labelText: 'National ID *'),
                  ),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                      child: TextField(
                        controller: departmentCtrl,
                        decoration:
                            const InputDecoration(labelText: 'Department *'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: positionCtrl,
                        decoration:
                            const InputDecoration(labelText: 'Position'),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                      child: TextField(
                        controller: branchCtrl,
                        keyboardType: TextInputType.number,
                        decoration:
                            const InputDecoration(labelText: 'Branch ID'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: salaryCtrl,
                        keyboardType: TextInputType.number,
                        decoration:
                            const InputDecoration(labelText: 'Basic Salary'),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: shift,
                        decoration: const InputDecoration(labelText: 'Shift'),
                        items: const [
                          DropdownMenuItem(
                              value: 'morning', child: Text('Morning')),
                          DropdownMenuItem(
                              value: 'afternoon', child: Text('Afternoon')),
                          DropdownMenuItem(
                              value: 'night', child: Text('Night')),
                          DropdownMenuItem(value: 'day', child: Text('Day')),
                        ],
                        onChanged: (value) =>
                            setState(() => shift = value ?? shift),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: employmentType,
                        decoration:
                            const InputDecoration(labelText: 'Employment'),
                        items: const [
                          DropdownMenuItem(
                              value: 'permanent', child: Text('Permanent')),
                          DropdownMenuItem(
                              value: 'contract', child: Text('Contract')),
                          DropdownMenuItem(
                              value: 'casual', child: Text('Casual')),
                          DropdownMenuItem(
                              value: 'intern', child: Text('Intern')),
                        ],
                        onChanged: (value) => setState(
                            () => employmentType = value ?? employmentType),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                      child: TextField(
                        controller: kraCtrl,
                        decoration: const InputDecoration(labelText: 'KRA PIN'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: nssfCtrl,
                        decoration:
                            const InputDecoration(labelText: 'NSSF Number'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: shifCtrl,
                        decoration:
                            const InputDecoration(labelText: 'SHIF Number'),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                      child: TextField(
                        controller: bankCtrl,
                        decoration:
                            const InputDecoration(labelText: 'Bank Name'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: accountCtrl,
                        decoration:
                            const InputDecoration(labelText: 'Account Number'),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                      child: TextField(
                        controller: kinNameCtrl,
                        decoration: const InputDecoration(
                            labelText: 'Next of Kin Name'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: kinPhoneCtrl,
                        decoration: const InputDecoration(
                            labelText: 'Next of Kin Phone'),
                      ),
                    ),
                  ]),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: nssfEnabled,
                    onChanged: (value) =>
                        setState(() => nssfEnabled = value ?? true),
                    title: const Text('NSSF enabled'),
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: shifEnabled,
                    onChanged: (value) =>
                        setState(() => shifEnabled = value ?? true),
                    title: const Text('SHIF enabled'),
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: housingEnabled,
                    onChanged: (value) =>
                        setState(() => housingEnabled = value ?? true),
                    title: const Text('Housing levy enabled'),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                if (firstCtrl.text.trim().isEmpty ||
                    lastCtrl.text.trim().isEmpty ||
                    nationalCtrl.text.trim().isEmpty ||
                    departmentCtrl.text.trim().isEmpty) {
                  AppNotifier.showSnackBar(
                      context,
                      const SnackBar(
                          content: Text(
                              'First name, last name, national ID, and department are required')));
                  return;
                }
                Navigator.pop(ctx);
                try {
                  await ref.read(hrRepositoryProvider).createStaff({
                    'first_name': firstCtrl.text.trim(),
                    'last_name': lastCtrl.text.trim(),
                    'email': emailCtrl.text.trim(),
                    'phone': phoneCtrl.text.trim(),
                    'national_id': nationalCtrl.text.trim(),
                    'department': departmentCtrl.text.trim(),
                    'position': positionCtrl.text.trim(),
                    'branch_id': branchCtrl.text.trim(),
                    'basic_salary': num.tryParse(salaryCtrl.text.trim()) ?? 0,
                    'shift': shift,
                    'employment_type': employmentType,
                    'kra_pin': kraCtrl.text.trim(),
                    'nssf_number': nssfCtrl.text.trim(),
                    'shif_number': shifCtrl.text.trim(),
                    'bank_name': bankCtrl.text.trim(),
                    'account_number': accountCtrl.text.trim(),
                    'next_of_kin_name': kinNameCtrl.text.trim(),
                    'next_of_kin_phone': kinPhoneCtrl.text.trim(),
                    'nssf_enabled': nssfEnabled,
                    'shif_enabled': shifEnabled,
                    'housing_fund_enabled': housingEnabled,
                  });
                  ref.invalidate(staffListProvider(null));
                  if (context.mounted) {
                    AppNotifier.showSnackBar(
                      context,
                      const SnackBar(content: Text('Staff member added')),
                    );
                  }
                } catch (e) {
                  if (context.mounted) {
                    AppNotifier.showSnackBar(
                      context,
                      SnackBar(content: Text('Error: $e')),
                    );
                  }
                }
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }
}

class _AttendanceView extends ConsumerStatefulWidget {
  const _AttendanceView({this.showLogs = false});

  final bool showLogs;

  @override
  ConsumerState<_AttendanceView> createState() => _AttendanceViewState();
}

class _AttendanceViewState extends ConsumerState<_AttendanceView> {
  late DateTime _selectedDate;
  late Future<List<Map<String, dynamic>>> _future;
  final _searchCtrl = TextEditingController();
  bool _onDutyOnly = false;

  @override
  void initState() {
    super.initState();
    _selectedDate = DateTime.now();
    _future = _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<List<Map<String, dynamic>>> _load() {
    return ref.read(hrRepositoryProvider).getAttendanceReports(
          date: _date(_selectedDate),
        );
  }

  void _refresh() => setState(() {
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Expanded(
              child: Text(widget.showLogs ? 'Attendance Logs' : 'Attendance',
                  style: Theme.of(context).textTheme.displaySmall),
            ),
            OutlinedButton.icon(
              onPressed: _exportCsv,
              icon: const Icon(Icons.download, size: 16),
              label: const Text('Export Audit'),
            ),
            const SizedBox(width: 8),
            ElevatedButton.icon(
              onPressed: _refresh,
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Refresh'),
            ),
          ]),
          const SizedBox(height: 12),
          Wrap(
              spacing: 12,
              runSpacing: 12,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                IconButton(
                  tooltip: 'Previous day',
                  onPressed: () {
                    setState(() {
                      _selectedDate =
                          _selectedDate.subtract(const Duration(days: 1));
                      _future = _load();
                    });
                  },
                  icon: const Icon(Icons.chevron_left),
                ),
                OutlinedButton.icon(
                  onPressed: () async {
                    final picked = await showDatePicker(
                      context: context,
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2030),
                      initialDate: _selectedDate,
                    );
                    if (picked == null) return;
                    setState(() {
                      _selectedDate = picked;
                      _future = _load();
                    });
                  },
                  icon: const Icon(Icons.calendar_today, size: 16),
                  label: Text(_date(_selectedDate)),
                ),
                IconButton(
                  tooltip: 'Next day',
                  onPressed: () {
                    setState(() {
                      _selectedDate =
                          _selectedDate.add(const Duration(days: 1));
                      _future = _load();
                    });
                  },
                  icon: const Icon(Icons.chevron_right),
                ),
                SizedBox(
                  width: 280,
                  child: TextField(
                    controller: _searchCtrl,
                    decoration: InputDecoration(
                      hintText: 'Search staff or department',
                      prefixIcon: Icon(PhosphorIcons.magnifyingGlass()),
                      contentPadding: EdgeInsets.zero,
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
                FilterChip(
                  selected: _onDutyOnly,
                  label: const Text('On duty'),
                  onSelected: (value) => setState(() => _onDutyOnly = value),
                ),
              ]),
          const SizedBox(height: 16),
          Expanded(
            child: FutureBuilder<List<Map<String, dynamic>>>(
              future: _future,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Card(
                      child: LoadingSkeleton(type: SkeletonType.list));
                }
                if (snapshot.hasError) {
                  return ErrorState(
                      message: '${snapshot.error}', onRetry: _refresh);
                }
                final records = _filtered(snapshot.data ?? const []);
                return Card(
                  child: records.isEmpty
                      ? const Center(
                          child: Text('No attendance records',
                              style:
                                  TextStyle(color: AppColors.kTextSecondary)))
                      : SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: DataTable(
                            headingRowColor:
                                WidgetStateProperty.all(AppColors.kSurface),
                            columns: const [
                              DataColumn(label: Text('Staff')),
                              DataColumn(label: Text('Department')),
                              DataColumn(label: Text('Clock In')),
                              DataColumn(label: Text('Clock Out')),
                              DataColumn(label: Text('Normal')),
                              DataColumn(label: Text('OT')),
                              DataColumn(label: Text('Night')),
                              DataColumn(label: Text('Status')),
                              DataColumn(label: Text('Actions')),
                            ],
                            rows: records
                                .map((r) => DataRow(cells: [
                                      DataCell(SizedBox(
                                          width: 170,
                                          child: Text(_staffName(r)))),
                                      DataCell(SizedBox(
                                          width: 140,
                                          child: Text(_department(r)))),
                                      DataCell(Text('${r['clock_in'] ?? '—'}')),
                                      DataCell(
                                          Text('${r['clock_out'] ?? '—'}')),
                                      DataCell(Text(
                                          '${r['hours_normal'] ?? r['hours_worked'] ?? 0}')),
                                      DataCell(
                                          Text(_otHours(r).toStringAsFixed(1))),
                                      DataCell(
                                          Text('${r['hours_night'] ?? 0}')),
                                      DataCell(_StatusChip(_approved(r)
                                          ? 'approved'
                                          : 'pending')),
                                      DataCell(Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            IconButton(
                                              tooltip: 'Approve',
                                              onPressed: () =>
                                                  _approve('${r['id']}', true),
                                              icon: const Icon(
                                                  Icons.check_circle,
                                                  color: AppColors.kSuccess),
                                            ),
                                            IconButton(
                                              tooltip: 'Reject',
                                              onPressed: () =>
                                                  _approve('${r['id']}', false),
                                              icon: const Icon(Icons.cancel,
                                                  color: AppColors.kError),
                                            ),
                                          ])),
                                    ]))
                                .toList(),
                          ),
                        ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  List<Map<String, dynamic>> _filtered(List<Map<String, dynamic>> records) {
    final query = _searchCtrl.text.trim().toLowerCase();
    return records.where((row) {
      final text = '${_staffName(row)} ${_department(row)}'.toLowerCase();
      final searchMatch = query.isEmpty || text.contains(query);
      final dutyMatch = !_onDutyOnly ||
          row['clock_out'] == null ||
          '${row['clock_out']}'.isEmpty;
      return searchMatch && dutyMatch;
    }).toList();
  }

  Future<void> _approve(String id, bool approved) async {
    await ref.read(hrRepositoryProvider).approveAttendance(
          id,
          approved: approved,
          reason: approved ? null : 'Unverified',
        );
    _refresh();
    if (mounted) {
      AppNotifier.showSnackBar(
          context,
          SnackBar(
            content:
                Text(approved ? 'Attendance approved' : 'Attendance rejected'),
          ));
    }
  }

  Future<void> _exportCsv() async {
    final records = _filtered(await _future);
    if (records.isEmpty) return;
    final lines = <String>[
      'Staff Name,Department,Clock In,Clock Out,Normal Hours,OT Hours,Night Hours,Status',
      for (final row in records)
        [
          _staffName(row),
          _department(row),
          row['clock_in'] ?? '',
          row['clock_out'] ?? '',
          row['hours_normal'] ?? row['hours_worked'] ?? 0,
          _otHours(row).toStringAsFixed(1),
          row['hours_night'] ?? 0,
          _approved(row) ? 'Approved' : 'Pending',
        ].map((value) => '"${'$value'.replaceAll('"', '""')}"').join(','),
    ];
    final dir = await getDownloadsDirectory() ??
        await getApplicationDocumentsDirectory();
    final file =
        File('${dir.path}/attendance_report_${_date(_selectedDate)}.csv');
    await file.writeAsString(lines.join('\n'), flush: true);
    if (mounted) {
      AppNotifier.showSnackBar(
        context,
        SnackBar(content: Text('Attendance report saved to ${file.path}')),
      );
    }
  }

  String _date(DateTime value) =>
      '${value.year}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';

  String _staffName(Map<String, dynamic> row) {
    final staff = row['staff'];
    if (staff is Map) {
      final name = [
        staff['first_name'],
        staff['last_name'],
      ].where((part) => part != null && '$part'.trim().isNotEmpty).join(' ');
      if (name.isNotEmpty) return name;
      return '${staff['name'] ?? staff['full_name'] ?? 'Unknown'}';
    }
    return '${row['staff_name'] ?? row['name'] ?? 'Unknown'}';
  }

  String _department(Map<String, dynamic> row) {
    final staff = row['staff'];
    if (staff is Map) {
      return '${staff['department'] ?? staff['user']?['department'] ?? ''}';
    }
    return '${row['department'] ?? ''}';
  }

  bool _approved(Map<String, dynamic> row) {
    final value = row['is_approved'] ?? row['approved'] ?? row['status'];
    return value == true || '$value'.toLowerCase() == 'approved';
  }

  double _otHours(Map<String, dynamic> row) {
    double val(String key) {
      final raw = row[key];
      if (raw is num) return raw.toDouble();
      return double.tryParse('$raw') ?? 0;
    }

    return val('hours_ot_weekday') +
        val('hours_ot_rest') +
        val('hours_ot_holiday');
  }
}

class _LeaveRequestsView extends ConsumerStatefulWidget {
  @override
  ConsumerState<_LeaveRequestsView> createState() => _LeaveRequestsViewState();
}

class _LeaveRequestsViewState extends ConsumerState<_LeaveRequestsView> {
  String _status = 'all';

  @override
  Widget build(BuildContext context) {
    final filter = _status == 'all' ? null : _status;
    final leaveAsync = ref.watch(leaveRequestsProvider(filter));
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Leave Requests',
                  style: Theme.of(context).textTheme.displaySmall),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'all', label: Text('All')),
                  ButtonSegment(value: 'pending', label: Text('Pending')),
                  ButtonSegment(value: 'approved', label: Text('Approved')),
                  ButtonSegment(value: 'rejected', label: Text('Rejected')),
                ],
                selected: {_status},
                onSelectionChanged: (v) => setState(() => _status = v.first),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Expanded(
            child: leaveAsync.when(
              data: (requests) => Card(
                child: requests.isEmpty
                    ? const Center(
                        child: Text('No leave requests',
                            style: TextStyle(color: AppColors.kTextSecondary)))
                    : ListView.separated(
                        itemCount: requests.length,
                        separatorBuilder: (_, index) => const Divider(),
                        itemBuilder: (context, index) {
                          final lr = requests[index];
                          return ListTile(
                            leading: Badge(
                              smallSize: 12,
                              backgroundColor: lr.status == 'approved'
                                  ? AppColors.kSuccess
                                  : lr.status == 'rejected'
                                      ? AppColors.kError
                                      : AppColors.kWarning,
                              child: CircleAvatar(
                                  child: Icon(PhosphorIcons.calendar())),
                            ),
                            title: Text(lr.staffName ?? 'Leave request'),
                            subtitle: Text(
                                '${lr.leaveType ?? 'Leave'} • ${_fmtDate(lr.startDate)} - ${_fmtDate(lr.endDate)}'
                                '${lr.employeeId == null ? '' : ' • ${lr.employeeId}'}'),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                _StatusChip(lr.status),
                                if (lr.status == 'pending') ...[
                                  const SizedBox(width: 8),
                                  PermissionGuard(
                                    permission:
                                        Permission.canApproveLeaveRequests,
                                    child: IconButton(
                                      icon: const Icon(Icons.check_circle,
                                          color: AppColors.kSuccess),
                                      onPressed: () async {
                                        await ref
                                            .read(hrRepositoryProvider)
                                            .approveLeave(lr.id);
                                        ref.invalidate(
                                            leaveRequestsProvider(filter));
                                      },
                                    ),
                                  ),
                                  PermissionGuard(
                                    permission:
                                        Permission.canApproveLeaveRequests,
                                    child: IconButton(
                                      icon: const Icon(Icons.cancel,
                                          color: AppColors.kError),
                                      onPressed: () async {
                                        final reason = await _notes(
                                            context, 'Reject Leave Request');
                                        if (reason == null) return;
                                        await ref
                                            .read(hrRepositoryProvider)
                                            .rejectLeave(lr.id);
                                        ref.invalidate(
                                            leaveRequestsProvider(filter));
                                      },
                                    ),
                                  ),
                                ],
                                if (lr.status == 'approved' &&
                                    !lr.reportedToDuty) ...[
                                  const SizedBox(width: 8),
                                  TextButton(
                                    onPressed: () async {
                                      try {
                                        await ref
                                            .read(hrRepositoryProvider)
                                            .reportToDuty(lr.id, {
                                          'actual_return_date': DateTime.now()
                                              .toIso8601String()
                                              .split('T')
                                              .first,
                                          'report_notes':
                                              'Reported from HR leave dashboard',
                                        });
                                        ref.invalidate(
                                            leaveRequestsProvider(filter));
                                        if (context.mounted) {
                                          AppNotifier.showSnackBar(
                                              context,
                                              SnackBar(
                                                  content: Text(
                                                      '${lr.staffName ?? 'Staff'} marked as reported to duty')));
                                        }
                                      } catch (error) {
                                        if (context.mounted) {
                                          AppNotifier.showSnackBar(
                                              context,
                                              SnackBar(
                                                  content: Text(
                                                      'Report duty failed: $error')));
                                        }
                                      }
                                    },
                                    child: const Text('Report duty'),
                                  ),
                                ],
                                if (lr.reportedToDuty) ...[
                                  const SizedBox(width: 8),
                                  const _StatusChip('reported'),
                                ],
                              ],
                            ),
                          );
                        },
                      ),
              ),
              loading: () =>
                  const Card(child: LoadingSkeleton(type: SkeletonType.list)),
              error: (e, _) => ErrorState(
                  message: '$e',
                  onRetry: () => ref.refresh(leaveRequestsProvider(filter))),
            ),
          ),
        ],
      ),
    );
  }

  String _fmtDate(DateTime? dt) {
    if (dt == null) return '--';
    return '${dt.day}/${dt.month}';
  }

  Future<String?> _notes(BuildContext context, String title) async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          minLines: 3,
          maxLines: 5,
          decoration: const InputDecoration(
            labelText: 'Reason',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          ElevatedButton(
              onPressed: () => Navigator.pop(context, controller.text.trim()),
              child: const Text('Submit')),
        ],
      ),
    );
    controller.dispose();
    if (result == null || result.isEmpty) return null;
    return result;
  }
}

class _StatusChip extends StatelessWidget {
  final String status;
  const _StatusChip(this.status);

  @override
  Widget build(BuildContext context) {
    final normalized = status.toLowerCase();
    final color = normalized == 'approved' ||
            normalized == 'active' ||
            normalized == 'bank' ||
            normalized == 'paid' ||
            normalized == 'applied'
        ? AppColors.kSuccess
        : normalized == 'rejected' ||
                normalized == 'inactive' ||
                normalized == 'cancelled'
            ? AppColors.kError
            : AppColors.kWarning;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(normalized.toUpperCase(),
          style: TextStyle(
              fontSize: 10, fontWeight: FontWeight.bold, color: color)),
    );
  }
}

class _ShiftsView extends ConsumerStatefulWidget {
  @override
  ConsumerState<_ShiftsView> createState() => _ShiftsViewState();
}

class _ShiftsViewState extends ConsumerState<_ShiftsView> {
  void _showCreateShiftDialog() {
    final staffCtrl = TextEditingController();
    final startCtrl = TextEditingController(text: '08:00');
    final endCtrl = TextEditingController(text: '16:00');
    String shiftType = 'Morning';
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          title: const Text('Create Shift'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                  controller: staffCtrl,
                  decoration: const InputDecoration(labelText: 'Staff ID')),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: shiftType,
                decoration: const InputDecoration(labelText: 'Shift Type'),
                items: ['Morning', 'Afternoon', 'Evening', 'Night']
                    .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                    .toList(),
                onChanged: (v) => setS(() {
                  shiftType = v ?? shiftType;
                  startCtrl.text = {
                        'Morning': '06:00',
                        'Afternoon': '14:00',
                        'Evening': '18:00',
                        'Night': '22:00'
                      }[shiftType] ??
                      '08:00';
                  endCtrl.text = {
                        'Morning': '14:00',
                        'Afternoon': '22:00',
                        'Evening': '02:00',
                        'Night': '06:00'
                      }[shiftType] ??
                      '16:00';
                }),
              ),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                    child: TextField(
                        controller: startCtrl,
                        decoration:
                            const InputDecoration(labelText: 'Start Time'))),
                const SizedBox(width: 12),
                Expanded(
                    child: TextField(
                        controller: endCtrl,
                        decoration:
                            const InputDecoration(labelText: 'End Time'))),
              ]),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                try {
                  await ref.read(hrRepositoryProvider).createShift({
                    'staff_id': staffCtrl.text.trim(),
                    'shift_type': shiftType,
                    'start_time': startCtrl.text,
                    'end_time': endCtrl.text,
                  });
                  ref.invalidate(shiftSchedulesProvider);
                  if (mounted) {
                    AppNotifier.showSnackBar(context,
                        const SnackBar(content: Text('Shift created')));
                  }
                } catch (e) {
                  if (mounted) {
                    AppNotifier.showSnackBar(
                        context,
                        SnackBar(
                            content: Text('Error: $e'),
                            backgroundColor: Colors.red));
                  }
                }
              },
              child: const Text('Create'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final shiftsAsync = ref.watch(shiftSchedulesProvider);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Shift Schedules',
                  style: Theme.of(context).textTheme.displaySmall),
              ElevatedButton.icon(
                onPressed: _showCreateShiftDialog,
                icon: const Icon(Icons.add),
                label: const Text('Create Shift'),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Expanded(
            child: shiftsAsync.when(
              data: (shifts) => Card(
                child: shifts.isEmpty
                    ? const Center(
                        child: Text('No shifts scheduled',
                            style: TextStyle(color: AppColors.kTextSecondary)))
                    : ListView.separated(
                        itemCount: shifts.length,
                        separatorBuilder: (_, index) => const Divider(),
                        itemBuilder: (context, index) {
                          final s = shifts[index];
                          return ListTile(
                            leading: CircleAvatar(
                                child: Icon(PhosphorIcons.calendarBlank())),
                            title: Text(s.staffName ?? 'Shift #${s.id}'),
                            subtitle: Text(
                                '${s.shiftType ?? 'Regular'} • ${s.startTime ?? '--'} - ${s.endTime ?? '--'}'),
                          );
                        },
                      ),
              ),
              loading: () =>
                  const Card(child: LoadingSkeleton(type: SkeletonType.list)),
              error: (e, _) => ErrorState(
                  message: '$e',
                  onRetry: () => ref.refresh(shiftSchedulesProvider)),
            ),
          ),
        ],
      ),
    );
  }
}

class _PayrollView extends ConsumerStatefulWidget {
  @override
  ConsumerState<_PayrollView> createState() => _PayrollViewState();
}

class _PayrollViewState extends ConsumerState<_PayrollView> {
  late int _month;
  late int _year;
  late Future<Map<String, dynamic>> _future;
  bool _busy = false;

  static const _months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = now.month;
    _year = now.year;
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() {
    return ref
        .read(hrRepositoryProvider)
        .getPayrollDraft(month: _month, year: _year);
  }

  void _refresh() => setState(() {
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Payroll', style: Theme.of(context).textTheme.displaySmall),
              Wrap(spacing: 8, runSpacing: 8, children: [
                DropdownButton<int>(
                  value: _month,
                  items: [
                    for (var i = 0; i < _months.length; i++)
                      DropdownMenuItem(value: i + 1, child: Text(_months[i])),
                  ],
                  onChanged: (value) {
                    if (value == null) return;
                    setState(() {
                      _month = value;
                      _future = _load();
                    });
                  },
                ),
                DropdownButton<int>(
                  value: _year,
                  items: [
                    for (var year = DateTime.now().year - 2;
                        year <= DateTime.now().year + 1;
                        year++)
                      DropdownMenuItem(value: year, child: Text('$year')),
                  ],
                  onChanged: (value) {
                    if (value == null) return;
                    setState(() {
                      _year = value;
                      _future = _load();
                    });
                  },
                ),
                OutlinedButton.icon(
                  onPressed: _busy ? null : _refresh,
                  icon: const Icon(Icons.refresh, size: 16),
                  label: const Text('Refresh'),
                ),
                OutlinedButton.icon(
                  onPressed: () =>
                      ref.read(hrTabProvider.notifier).state = HrTab.policies,
                  icon: const Icon(Icons.settings, size: 16),
                  label: const Text('Policies'),
                ),
                OutlinedButton.icon(
                  onPressed: () => ref.read(hrTabProvider.notifier).state =
                      HrTab.salaryAdjustments,
                  icon: const Icon(Icons.add, size: 16),
                  label: const Text('Adjustment'),
                ),
              ]),
            ],
          ),
          const SizedBox(height: 24),
          Expanded(
            child: FutureBuilder<Map<String, dynamic>>(
              future: _future,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Card(
                      child: LoadingSkeleton(type: SkeletonType.list));
                }
                if (snapshot.hasError) {
                  return ErrorState(
                      message: '${snapshot.error}', onRetry: _refresh);
                }
                return _payrollBody(snapshot.data ?? {});
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _payrollBody(Map<String, dynamic> data) {
    final run = _asMap(data['run'] ?? data['summary']);
    final records = _asList(data['records']);
    final totals = _totals(records);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      LayoutBuilder(builder: (context, constraints) {
        final width = constraints.maxWidth;
        final columns = width < 560 ? 1 : (width < 980 ? 2 : 4);
        final cardWidth = (width - ((columns - 1) * 12)) / columns;
        final cards = [
          _OverviewCard(
            title: 'Gross Pay',
            value: _money(totals['gross'] ?? 0),
            icon: PhosphorIcons.currencyDollar(),
            color: AppColors.kPrimary,
          ),
          _OverviewCard(
            title: 'Deductions',
            value: _money(totals['deductions'] ?? 0),
            icon: PhosphorIcons.warning(),
            color: AppColors.kError,
          ),
          _OverviewCard(
            title: 'Net Payable',
            value: _money(totals['net'] ?? 0),
            icon: PhosphorIcons.checkCircle(),
            color: AppColors.kSuccess,
          ),
          _OverviewCard(
            title: 'Run Status',
            value: '${run['status'] ?? 'draft'}',
            icon: PhosphorIcons.users(),
            color: AppColors.kWarning,
          ),
        ];
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: cards
              .map((card) => SizedBox(
                    width: cardWidth,
                    height: 104,
                    child: card,
                  ))
              .toList(),
        );
      }),
      const SizedBox(height: 12),
      Row(children: [
        PermissionGuard(
          permission: Permission.canProcessPayroll,
          child: ElevatedButton.icon(
            onPressed: _busy ? null : _generatePayroll,
            icon: const Icon(Icons.calculate, size: 16),
            label: const Text('Generate Draft'),
          ),
        ),
        const SizedBox(width: 8),
        if ((run['status'] ?? 'draft') == 'draft')
          PermissionGuard(
            permission: Permission.canProcessPayroll,
            child: OutlinedButton.icon(
              onPressed: _busy ? null : () => _approvePayroll(run),
              icon: const Icon(Icons.check_circle_outline, size: 16),
              label: const Text('Approve Payroll'),
            ),
          ),
        const Spacer(),
        if ((run['id'] ?? '').toString().isNotEmpty) ...[
          OutlinedButton.icon(
            onPressed: _busy ? null : () => _download(run, 'summary'),
            icon: const Icon(Icons.picture_as_pdf, size: 16),
            label: const Text('Summary PDF'),
          ),
          const SizedBox(width: 8),
          OutlinedButton.icon(
            onPressed: _busy ? null : () => _download(run, 'zip'),
            icon: const Icon(Icons.archive, size: 16),
            label: const Text('Payslips ZIP'),
          ),
        ],
      ]),
      const SizedBox(height: 12),
      Expanded(
        child: Card(
          child: records.isEmpty
              ? Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    const Text('No payroll records found',
                        style: TextStyle(color: AppColors.kTextSecondary)),
                    const SizedBox(height: 12),
                    ElevatedButton.icon(
                      onPressed: _busy ? null : _generatePayroll,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Generate Payroll Run'),
                    ),
                  ]),
                )
              : SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: DataTable(
                    headingRowColor:
                        WidgetStateProperty.all(AppColors.kSurface),
                    columns: const [
                      DataColumn(label: Text('Staff')),
                      DataColumn(label: Text('Basic Salary')),
                      DataColumn(label: Text('Additions')),
                      DataColumn(label: Text('Deductions')),
                      DataColumn(label: Text('SHIF/NSSF')),
                      DataColumn(label: Text('Gross')),
                      DataColumn(label: Text('Net')),
                    ],
                    rows: records.map((row) {
                      final name = row['employee_name'] ??
                          row['staff_name'] ??
                          row['name'] ??
                          'Staff';
                      return DataRow(cells: [
                        DataCell(SizedBox(width: 180, child: Text('$name'))),
                        DataCell(Text(_money(row['basic_salary']))),
                        DataCell(Text(_money(row['additions']))),
                        DataCell(Text(_money(
                            row['total_deductions'] ?? row['deductions']))),
                        DataCell(Text(
                            '${_money(row['shif'])} / ${_money(row['nssf'])}')),
                        DataCell(Text(_money(row['gross_pay'] ??
                            row['gross_salary'] ??
                            row['gross']))),
                        DataCell(Text(_money(row['net_pay'] ??
                            row['net_salary'] ??
                            row['net']))),
                      ]);
                    }).toList(),
                  ),
                ),
        ),
      ),
    ]);
  }

  Future<void> _generatePayroll() async {
    setState(() => _busy = true);
    try {
      await ref.read(hrRepositoryProvider).processPayroll(
          period: '$_year-${_month.toString().padLeft(2, '0')}');
      _refresh();
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          const SnackBar(content: Text('Payroll draft generated')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _approvePayroll(Map<String, dynamic> run) async {
    final id = '${run['id'] ?? ''}';
    if (id.isEmpty) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Approve Payroll'),
        content: Text('Approve ${_months[_month - 1]} $_year payroll?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Approve')),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      await ref.read(hrRepositoryProvider).approvePayroll(id);
      _refresh();
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          const SnackBar(content: Text('Payroll approved')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _download(Map<String, dynamic> run, String type) async {
    final id = '${run['id'] ?? ''}';
    if (id.isEmpty) return;
    setState(() => _busy = true);
    try {
      final file = await ref.read(hrRepositoryProvider).downloadPayrollRunFile(
            id,
            type,
            type == 'summary'
                ? 'Payroll_Summary_${_months[_month - 1]}_$_year.pdf'
                : 'Payslips_${_months[_month - 1]}_$_year.zip',
          );
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          SnackBar(content: Text('Downloaded to ${file.path}')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  List<Map<String, dynamic>> _asList(dynamic value) {
    if (value is List) {
      return value
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }
    return const [];
  }

  Map<String, dynamic> _asMap(dynamic value) {
    if (value is Map) return Map<String, dynamic>.from(value);
    return {};
  }

  Map<String, num> _totals(List<Map<String, dynamic>> records) {
    num value(Map<String, dynamic> row, List<String> keys) {
      for (final key in keys) {
        final raw = row[key];
        if (raw is num) return raw;
        final parsed = num.tryParse('$raw');
        if (parsed != null) return parsed;
      }
      return 0;
    }

    return {
      'basic':
          records.fold<num>(0, (sum, r) => sum + value(r, ['basic_salary'])),
      'gross': records.fold<num>(0,
          (sum, r) => sum + value(r, ['gross_pay', 'gross_salary', 'gross'])),
      'deductions': records.fold<num>(
          0, (sum, r) => sum + value(r, ['total_deductions', 'deductions'])),
      'net': records.fold<num>(
          0, (sum, r) => sum + value(r, ['net_pay', 'net_salary', 'net'])),
    };
  }

  String _money(dynamic value) {
    final amount = value is num ? value : num.tryParse('$value') ?? 0;
    return 'KES ${_wholeMoneyNumber(amount)}';
  }
}

class _StaffAttendanceView extends ConsumerWidget {
  const _StaffAttendanceView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final staffAsync = ref.watch(staffListProvider(null));
    final attendanceAsync = ref.watch(attendanceProvider);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Staff Attendance',
            style: Theme.of(context).textTheme.displaySmall),
        const SizedBox(height: 16),
        Expanded(
          child: staffAsync.when(
            data: (staff) => attendanceAsync.when(
              data: (records) => Card(
                child: ListView.separated(
                  itemCount: staff.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final member = staff[index];
                    final memberRecords = records
                        .where((r) => r.staffName == member.name)
                        .toList();
                    return ListTile(
                      leading: const CircleAvatar(child: Icon(Icons.person)),
                      title: Text(member.name),
                      subtitle: Text(
                          '${member.role ?? 'Staff'} • ${memberRecords.length} attendance logs'),
                      trailing: TextButton(
                        onPressed: () => _showStaffAttendanceDialog(
                            context, member.name, memberRecords),
                        child: const Text('View'),
                      ),
                    );
                  },
                ),
              ),
              loading: () =>
                  const Card(child: LoadingSkeleton(type: SkeletonType.list)),
              error: (e, _) => ErrorState(
                  message: '$e',
                  onRetry: () => ref.invalidate(attendanceProvider)),
            ),
            loading: () =>
                const Card(child: LoadingSkeleton(type: SkeletonType.list)),
            error: (e, _) => ErrorState(
                message: '$e',
                onRetry: () => ref.invalidate(staffListProvider(null))),
          ),
        ),
      ]),
    );
  }

  void _showStaffAttendanceDialog(
      BuildContext context, String name, List<AttendanceRecord> records) {
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(name),
        content: SizedBox(
          width: 520,
          child: records.isEmpty
              ? const Text('No attendance logs found')
              : ListView.separated(
                  shrinkWrap: true,
                  itemCount: records.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final r = records[index];
                    return ListTile(
                      title: Text(r.status ?? 'present'),
                      subtitle: Text(
                          'In: ${r.clockIn ?? '—'} • Out: ${r.clockOut ?? '—'}'),
                      trailing: r.hoursWorked == null
                          ? null
                          : Text('${r.hoursWorked!.toStringAsFixed(1)}h'),
                    );
                  },
                ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Close')),
        ],
      ),
    );
  }
}

class _SalariesView extends ConsumerStatefulWidget {
  const _SalariesView();

  @override
  ConsumerState<_SalariesView> createState() => _SalariesViewState();
}

class _SalariesViewState extends ConsumerState<_SalariesView> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final staffAsync = ref.watch(staffListProvider(null));
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Payroll Baseline',
                style: Theme.of(context).textTheme.displaySmall),
            const SizedBox(height: 4),
            const Text('Manage staff salaries, roles and settlement status',
                style: TextStyle(color: AppColors.kTextSecondary)),
          ]),
          OutlinedButton.icon(
            onPressed: () => ref.invalidate(staffListProvider(null)),
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Sync Ledger'),
          ),
        ]),
        const SizedBox(height: 16),
        Expanded(
          child: staffAsync.when(
            data: (staff) => _salaryBody(context, ref, staff),
            loading: () =>
                const Card(child: LoadingSkeleton(type: SkeletonType.list)),
            error: (e, _) => ErrorState(
                message: '$e',
                onRetry: () => ref.invalidate(staffListProvider(null))),
          ),
        ),
      ]),
    );
  }

  Widget _salaryBody(
      BuildContext context, WidgetRef ref, List<StaffMember> staff) {
    final filtered = staff.where((member) {
      final haystack = [
        member.name,
        member.role,
        member.department,
        member.position,
        member.employeeId,
      ].whereType<String>().join(' ').toLowerCase();
      return haystack.contains(_query.trim().toLowerCase());
    }).toList();
    final total =
        staff.fold<num>(0, (sum, member) => sum + (member.basicSalary ?? 0));
    final average = staff.isEmpty ? 0 : total / staff.length;

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      LayoutBuilder(builder: (context, constraints) {
        final width = constraints.maxWidth;
        final columns = width < 720 ? 1 : 3;
        final cardWidth = (width - ((columns - 1) * 12)) / columns;
        final cards = [
          _OverviewCard(
              title: 'Monthly Payroll Budget',
              value: _formatMoney(total),
              icon: PhosphorIcons.wallet(),
              color: AppColors.kPrimary),
          _OverviewCard(
              title: 'Average Salary',
              value: _formatMoney(average),
              icon: PhosphorIcons.trendUp(),
              color: AppColors.kSuccess),
          _OverviewCard(
              title: 'Staff Profiles',
              value: '${staff.length}',
              icon: PhosphorIcons.users(),
              color: Colors.indigo),
        ];
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: cards
              .map((card) => SizedBox(
                    width: cardWidth,
                    height: 104,
                    child: card,
                  ))
              .toList(),
        );
      }),
      const SizedBox(height: 16),
      TextField(
        decoration: InputDecoration(
          hintText: 'Search by name, role or department...',
          prefixIcon: Icon(PhosphorIcons.magnifyingGlass()),
        ),
        onChanged: (value) => setState(() => _query = value),
      ),
      const SizedBox(height: 16),
      Expanded(
        child: Card(
          clipBehavior: Clip.antiAlias,
          child: filtered.isEmpty
              ? const EmptyState(message: 'No salary records found')
              : SingleChildScrollView(
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: DataTable(
                      headingRowColor:
                          WidgetStateProperty.all(AppColors.kSurface),
                      columns: const [
                        DataColumn(label: Text('Personnel')),
                        DataColumn(label: Text('Post / Unit')),
                        DataColumn(label: Text('Contract Rate')),
                        DataColumn(label: Text('Settlement')),
                        DataColumn(label: Text('Action')),
                      ],
                      rows: filtered.map((member) {
                        return DataRow(cells: [
                          DataCell(SizedBox(
                            width: 240,
                            child: Row(children: [
                              CircleAvatar(child: Text(_initials(member.name))),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(_staffName(member),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w700)),
                                    Text(member.employeeId ?? member.id,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                            fontSize: 11,
                                            color: AppColors.kTextSecondary)),
                                  ],
                                ),
                              ),
                            ]),
                          )),
                          DataCell(SizedBox(
                            width: 180,
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(_staffRole(member),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis),
                                Text(member.department ?? 'general',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                        fontSize: 11,
                                        color: AppColors.kTextSecondary)),
                              ],
                            ),
                          )),
                          DataCell(Text(_formatMoney(member.basicSalary ?? 0),
                              style: const TextStyle(
                                  fontWeight: FontWeight.w800))),
                          DataCell(SizedBox(
                            width: 160,
                            child: Row(children: [
                              _StatusChip((member.bankName ?? '').isNotEmpty
                                  ? 'bank'
                                  : 'unset'),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(member.bankName ?? 'Unset',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.kTextSecondary)),
                              ),
                            ]),
                          )),
                          DataCell(TextButton.icon(
                            onPressed: () =>
                                _showSalaryDialog(context, ref, member),
                            icon: const Icon(Icons.edit, size: 16),
                            label: const Text('Adjust'),
                          )),
                        ]);
                      }).toList(),
                    ),
                  ),
                ),
        ),
      ),
    ]);
  }

  void _showSalaryDialog(
      BuildContext context, WidgetRef ref, StaffMember member) {
    final controller =
        TextEditingController(text: '${member.basicSalary ?? 0}');
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Contract Adjustment'),
        content: SizedBox(
          width: 360,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            CircleAvatar(child: Text(_initials(member.name))),
            const SizedBox(height: 12),
            Text(_staffName(member),
                textAlign: TextAlign.center,
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            Text(_staffRole(member),
                style: const TextStyle(color: AppColors.kTextSecondary)),
            const SizedBox(height: 18),
            TextField(
              controller: controller,
              keyboardType: TextInputType.number,
              decoration:
                  const InputDecoration(labelText: 'Monthly baseline (KES)'),
              autofocus: true,
            ),
          ]),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              final salary = num.tryParse(controller.text.trim());
              if (salary == null) return;
              Navigator.pop(context);
              await ref
                  .read(hrRepositoryProvider)
                  .updateSalary(member.id, salary);
              ref.invalidate(staffListProvider(null));
              if (context.mounted) {
                AppNotifier.showSnackBar(
                    context,
                    SnackBar(
                        content: Text('Salary updated for ${member.name}')));
              }
            },
            child: const Text('Confirm Rate Change'),
          ),
        ],
      ),
    );
  }
}

String _staffName(StaffMember member) {
  final name = member.name.trim();
  if (name.isNotEmpty) return name;
  final composed = '${member.firstName ?? ''} ${member.lastName ?? ''}'.trim();
  if (composed.isNotEmpty) return composed;
  return member.email ?? 'Staff';
}

String _staffRole(StaffMember member) {
  final value = (member.role?.trim().isNotEmpty ?? false)
      ? member.role!
      : (member.position?.trim().isNotEmpty ?? false)
          ? member.position!
          : 'Staff';
  return value.replaceAll('_', ' ');
}

String _initials(String value) {
  final parts = value
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .toList();
  if (parts.isEmpty) return '?';
  return parts.take(2).map((part) => part[0].toUpperCase()).join();
}

String _formatMoney(num value) {
  return 'KES ${_wholeMoneyNumber(value)}';
}

String _wholeMoneyNumber(num value) {
  final rounded = value.round().toString();
  return rounded.replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => ',',
  );
}

class _TerminalView extends StatelessWidget {
  const _TerminalView();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('HR Terminal', style: Theme.of(context).textTheme.displaySmall),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(PhosphorIcons.fingerprint(),
                    color: AppColors.kPrimary, size: 32),
                const SizedBox(height: 12),
                const Text('Staff clock-in terminal',
                    style:
                        TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                const Text(
                    'Open the dedicated HR terminal from the login terminal or the /hr-terminal route.'),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: () => AppNotifier.showSnackBar(
                      context,
                      const SnackBar(
                        content: Text('Use /hr-terminal to open terminal mode'),
                      )),
                  icon: const Icon(Icons.fingerprint),
                  label: const Text('Terminal Ready'),
                ),
              ],
            ),
          ),
        ),
      ]),
    );
  }
}

// ─── Performance View ───────────────────────────────────────────────────────

class _PerformanceView extends ConsumerStatefulWidget {
  const _PerformanceView();

  @override
  ConsumerState<_PerformanceView> createState() => _PerformanceViewState();
}

class _PerformanceViewState extends ConsumerState<_PerformanceView> {
  late int _month;
  late int _year;
  String _query = '';
  late Future<Map<String, dynamic>> _future;

  static const _months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = now.month;
    _year = now.year;
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() {
    return ref
        .read(hrRepositoryProvider)
        .getStaffPerformanceMetrics(month: _month, year: _year);
  }

  void _refresh() => setState(() {
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Performance Reviews',
                style: Theme.of(context).textTheme.displaySmall),
            const SizedBox(height: 4),
            const Text('Sales, tips, attendance and rating leaderboard',
                style: TextStyle(color: AppColors.kTextSecondary)),
          ]),
          Wrap(spacing: 8, runSpacing: 8, children: [
            SizedBox(
              width: 150,
              child: DropdownButtonFormField<int>(
                initialValue: _month,
                decoration: const InputDecoration(labelText: 'Month'),
                items: List.generate(
                  12,
                  (index) => DropdownMenuItem(
                      value: index + 1, child: Text(_months[index])),
                ),
                onChanged: (value) {
                  if (value == null) return;
                  setState(() {
                    _month = value;
                    _future = _load();
                  });
                },
              ),
            ),
            SizedBox(
              width: 115,
              child: DropdownButtonFormField<int>(
                initialValue: _year,
                decoration: const InputDecoration(labelText: 'Year'),
                items: [
                  for (var year = DateTime.now().year - 2;
                      year <= DateTime.now().year + 1;
                      year++)
                    DropdownMenuItem(value: year, child: Text('$year')),
                ],
                onChanged: (value) {
                  if (value == null) return;
                  setState(() {
                    _year = value;
                    _future = _load();
                  });
                },
              ),
            ),
            OutlinedButton.icon(
              onPressed: _refresh,
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Refresh'),
            ),
          ]),
        ]),
        const SizedBox(height: 16),
        TextField(
          decoration: InputDecoration(
            hintText: 'Search staff or role...',
            prefixIcon: Icon(PhosphorIcons.magnifyingGlass()),
          ),
          onChanged: (value) => setState(() => _query = value),
        ),
        const SizedBox(height: 16),
        Expanded(
          child: FutureBuilder<Map<String, dynamic>>(
            future: _future,
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const Card(
                    child: LoadingSkeleton(type: SkeletonType.list));
              }
              if (snapshot.hasError) {
                return ErrorState(
                    message: '${snapshot.error}', onRetry: _refresh);
              }
              return _performanceBody(snapshot.data ?? const {});
            },
          ),
        ),
      ]),
    );
  }

  Widget _performanceBody(Map<String, dynamic> data) {
    final rows = _performanceRows(data).where((row) {
      final search = _query.trim().toLowerCase();
      if (search.isEmpty) return true;
      return [
        _perfName(row),
        row['role'],
        row['department'],
      ].whereType<Object>().join(' ').toLowerCase().contains(search);
    }).toList();
    final totalSales =
        rows.fold<num>(0, (sum, row) => sum + _perfMetric(row, 'totalSales'));
    final totalTips =
        rows.fold<num>(0, (sum, row) => sum + _perfMetric(row, 'totalTips'));
    final avgAttendance = rows.isEmpty
        ? 0
        : rows.fold<num>(
                0, (sum, row) => sum + _perfMetric(row, 'presentDays')) /
            rows.length;

    return ListView(children: [
      LayoutBuilder(builder: (context, constraints) {
        final width = constraints.maxWidth;
        final columns = width < 760 ? 1 : 4;
        final cardWidth = (width - ((columns - 1) * 12)) / columns;
        final cards = [
          _OverviewCard(
              title: 'Staff Ranked',
              value: '${rows.length}',
              icon: PhosphorIcons.users(),
              color: AppColors.kPrimary),
          _OverviewCard(
              title: 'Total Sales',
              value: _formatMoney(totalSales),
              icon: PhosphorIcons.currencyDollar(),
              color: AppColors.kSuccess),
          _OverviewCard(
              title: 'Total Tips',
              value: _formatMoney(totalTips),
              icon: PhosphorIcons.trendUp(),
              color: Colors.indigo),
          _OverviewCard(
              title: 'Avg Attendance',
              value: avgAttendance.toStringAsFixed(1),
              icon: PhosphorIcons.calendarCheck(),
              color: AppColors.kWarning),
        ];
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: cards
              .map((card) =>
                  SizedBox(width: cardWidth, height: 104, child: card))
              .toList(),
        );
      }),
      const SizedBox(height: 18),
      if (rows.length >= 3) _podium(rows.take(3).toList()),
      if (rows.length >= 3) const SizedBox(height: 18),
      _performanceTable(rows),
    ]);
  }

  List<Map<String, dynamic>> _performanceRows(Map<String, dynamic> data) {
    final raw = data['performance'] ?? data['records'] ?? data['items'] ?? data;
    if (raw is List) {
      return raw
          .whereType<Map>()
          .map((row) => Map<String, dynamic>.from(row))
          .toList();
    }
    return const [];
  }

  Widget _podium(List<Map<String, dynamic>> top) {
    final order = [
      if (top.length > 1) top[1],
      top[0],
      if (top.length > 2) top[2]
    ];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: order.asMap().entries.map((entry) {
            final actualRank = entry.key == 0 ? 2 : (entry.key == 1 ? 1 : 3);
            final row = entry.value;
            final color = actualRank == 1
                ? AppColors.kWarning
                : actualRank == 2
                    ? Colors.blueGrey
                    : Colors.deepOrange;
            return Expanded(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                CircleAvatar(
                  radius: actualRank == 1 ? 34 : 28,
                  backgroundColor: color.withValues(alpha: 0.14),
                  child: actualRank == 1
                      ? Icon(PhosphorIcons.trophy(), color: color, size: 30)
                      : Text('$actualRank',
                          style: TextStyle(
                              color: color, fontWeight: FontWeight.w900)),
                ),
                const SizedBox(height: 10),
                Text(_perfName(row),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                Text('${row['role'] ?? 'Staff'}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.kTextSecondary)),
                const SizedBox(height: 6),
                Text(_formatMoney(_perfMetric(row, 'totalSales')),
                    style:
                        TextStyle(color: color, fontWeight: FontWeight.w900)),
              ]),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _performanceTable(List<Map<String, dynamic>> rows) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: rows.isEmpty
          ? const Padding(
              padding: EdgeInsets.all(32),
              child: EmptyState(message: 'No performance records found'),
            )
          : SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                headingRowColor: WidgetStateProperty.all(AppColors.kSurface),
                columns: const [
                  DataColumn(label: Text('Rank')),
                  DataColumn(label: Text('Staff Member')),
                  DataColumn(label: Text('Sales')),
                  DataColumn(label: Text('Tips')),
                  DataColumn(label: Text('Attendance')),
                  DataColumn(label: Text('Rating')),
                  DataColumn(label: Text('Actions')),
                ],
                rows: rows.asMap().entries.map((entry) {
                  final index = entry.key;
                  final row = entry.value;
                  return DataRow(cells: [
                    DataCell(CircleAvatar(
                      radius: 14,
                      child: Text('${index + 1}',
                          style: const TextStyle(fontSize: 11)),
                    )),
                    DataCell(SizedBox(
                      width: 220,
                      child: Row(children: [
                        CircleAvatar(child: Text(_initials(_perfName(row)))),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(_perfName(row),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w800)),
                              Text(
                                  '${row['role'] ?? row['department'] ?? 'Staff'}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      fontSize: 11,
                                      color: AppColors.kTextSecondary)),
                            ],
                          ),
                        ),
                      ]),
                    )),
                    DataCell(Text(_formatMoney(_perfMetric(row, 'totalSales')),
                        style: const TextStyle(fontWeight: FontWeight.w800))),
                    DataCell(Text(_formatMoney(_perfMetric(row, 'totalTips')))),
                    DataCell(SizedBox(
                      width: 120,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                              '${_perfMetric(row, 'presentDays').toStringAsFixed(0)} days',
                              style:
                                  const TextStyle(fontWeight: FontWeight.w700)),
                          LinearProgressIndicator(
                            value: (_perfMetric(row, 'presentDays') / 26)
                                .clamp(0, 1)
                                .toDouble(),
                            minHeight: 4,
                          ),
                        ],
                      ),
                    )),
                    DataCell(Row(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.star,
                          size: 16, color: AppColors.kWarning),
                      const SizedBox(width: 4),
                      Text(_perfMetric(row, 'avgRating').toStringAsFixed(1)),
                    ])),
                    DataCell(TextButton.icon(
                      onPressed: () => _reward(row),
                      icon: const Icon(Icons.emoji_events, size: 16),
                      label: const Text('Reward'),
                    )),
                  ]);
                }).toList(),
              ),
            ),
    );
  }

  Future<void> _reward(Map<String, dynamic> row) async {
    final amountCtrl = TextEditingController();
    final amount = await showDialog<num>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Reward ${_perfName(row)}'),
        content: TextField(
          controller: amountCtrl,
          autofocus: true,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Allowance amount'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
              onPressed: () =>
                  Navigator.pop(ctx, num.tryParse(amountCtrl.text.trim()) ?? 0),
              child: const Text('Create Reward')),
        ],
      ),
    );
    if (amount == null || amount <= 0) return;
    try {
      await ref.read(hrRepositoryProvider).createSalaryAdjustment({
        'staff_id': row['staff_id'],
        'type': 'addition',
        'category': 'allowance',
        'amount': amount,
        'description': 'Good performance - ${_months[_month - 1]} $_year',
        'month': _month,
        'year': _year,
        'status': 'approved',
      });
      if (mounted) {
        AppNotifier.showSnackBar(context,
            const SnackBar(content: Text('Reward adjustment created')));
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(context, SnackBar(content: Text('Error: $e')));
      }
    }
  }

  String _perfName(Map<String, dynamic> row) =>
      '${row['name'] ?? row['staff_name'] ?? row['employee_name'] ?? 'Staff'}';

  num _perfMetric(Map<String, dynamic> row, String key) {
    final metrics = row['metrics'];
    final raw = metrics is Map ? metrics[key] : row[key];
    if (raw is num) return raw;
    return num.tryParse('$raw') ?? 0;
  }
}

// ─── Salary Adjustments View ──────────────────────────────────────────────────

class _SalaryAdjustmentsView extends ConsumerStatefulWidget {
  const _SalaryAdjustmentsView();

  @override
  ConsumerState<_SalaryAdjustmentsView> createState() =>
      _SalaryAdjustmentsViewState();
}

class _SalaryAdjustmentsViewState
    extends ConsumerState<_SalaryAdjustmentsView> {
  static const _monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];
  static const _deductionCategories = <String, String>{
    'credit_bills': 'Credit Bills',
    'absenteeism': 'Absenteeism Deduction',
    'loan': 'Loans',
    'advance': 'Advances',
    'shif': 'SHIF',
    'nssf': 'NSSF',
    'uniform': 'Uniform',
    'other': 'Other Deductions',
  };
  static const _additionCategories = <String, String>{
    'bonus': 'Performance Bonus',
    'overtime': 'Overtime',
    'allowance': 'Allowance',
    'extra_day': 'Extra Day',
    'other': 'Other Addition',
  };

  late int _month;
  late int _year;
  String _staffSearch = '';
  String? _selectedStaffId;
  bool _showForm = false;
  bool _submitting = false;
  bool _updatingStatutory = false;
  String _formType = 'deduction';
  String _formCategory = 'other';
  final _amountCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  Future<List<Map<String, dynamic>>>? _folioFuture;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = now.month;
    _year = now.year;
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  void _loadFolio() {
    final id = _selectedStaffId;
    _folioFuture = id == null
        ? null
        : ref
            .read(hrRepositoryProvider)
            .getSalaryAdjustments(staffId: id, month: _month, year: _year);
  }

  void _selectStaff(StaffMember staff) {
    setState(() {
      _selectedStaffId = staff.id;
      _showForm = false;
      _formType = 'deduction';
      _formCategory = 'other';
      _amountCtrl.clear();
      _descCtrl.clear();
      _loadFolio();
    });
  }

  void _refresh() => setState(_loadFolio);

  /// Mirrors the web/backend authorize list for managing adjustments.
  static const _managerRoles = {
    UserRole.hrManager,
    UserRole.superAdmin,
    UserRole.generalManager,
    UserRole.branchManager,
    UserRole.auditor,
    UserRole.nightAuditor,
  };

  bool get _canManage {
    final role = ref.watch(authNotifierProvider).valueOrNull?.role ?? '';
    return _managerRoles.contains(UserRole.fromString(role));
  }

  String _money(num value) {
    final whole = value.abs().round().toString();
    final buffer = StringBuffer();
    for (var i = 0; i < whole.length; i++) {
      if (i > 0 && (whole.length - i) % 3 == 0) buffer.write(',');
      buffer.write(whole[i]);
    }
    return 'KES ${value < 0 ? '-' : ''}$buffer';
  }

  String _categoryLabel(String category) =>
      _deductionCategories[category] ??
      _additionCategories[category] ??
      category;

  String _shortDate(dynamic value) {
    final parsed = DateTime.tryParse('$value');
    if (parsed == null) return '$value'.split('T').first;
    return '${parsed.year}-${parsed.month.toString().padLeft(2, '0')}-${parsed.day.toString().padLeft(2, '0')}';
  }

  Future<void> _addAdjustment() async {
    final amount = num.tryParse(_amountCtrl.text.trim()) ?? 0;
    if (amount <= 0) {
      AppNotifier.showSnackBar(
          context, const SnackBar(content: Text('Enter a valid amount')));
      return;
    }
    setState(() => _submitting = true);
    try {
      await ref.read(hrRepositoryProvider).createSalaryAdjustment({
        'staff_id': _selectedStaffId,
        'type': _formType,
        'category': _formCategory,
        'amount': amount,
        'description': _descCtrl.text.trim(),
        'month': _month,
        'year': _year,
        'status': 'approved',
      });
      if (!mounted) return;
      AppNotifier.showSnackBar(
          context, const SnackBar(content: Text('Adjustment added')));
      setState(() {
        _showForm = false;
        _amountCtrl.clear();
        _descCtrl.clear();
        _formType = 'deduction';
        _formCategory = 'other';
        _loadFolio();
      });
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(context, SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _voidAdjustment(String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Void Adjustment'),
        content: const Text('Void this adjustment? This cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: FilledButton.styleFrom(backgroundColor: AppColors.kError),
              child: const Text('Void')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(hrRepositoryProvider).voidSalaryAdjustment(id);
      if (!mounted) return;
      AppNotifier.showSnackBar(
          context, const SnackBar(content: Text('Adjustment voided')));
      setState(_loadFolio);
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(context, SnackBar(content: Text('Error: $e')));
      }
    }
  }

  Future<void> _toggleStatutory(
      StaffMember staff, String field, bool current) async {
    setState(() => _updatingStatutory = true);
    try {
      await ref
          .read(hrRepositoryProvider)
          .updateStaff(staff.id, {field: !current});
      if (!mounted) return;
      AppNotifier.showSnackBar(
          context, const SnackBar(content: Text('Enrollment updated')));
      ref.invalidate(staffListProvider(null));
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(context, SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _updatingStatutory = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final staffAsync = ref.watch(staffListProvider(null));
    final staff = staffAsync.maybeWhen(
        data: (items) => items, orElse: () => const <StaffMember>[]);
    StaffMember? selectedStaff;
    for (final s in staff) {
      if (s.id == _selectedStaffId) {
        selectedStaff = s;
        break;
      }
    }
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          const Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Payroll Adjustments',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              Text('Select a staff member to open their folio',
                  style:
                      TextStyle(fontSize: 13, color: AppColors.kTextSecondary)),
            ]),
          ),
          SizedBox(
            width: 150,
            child: DropdownButtonFormField<int>(
              initialValue: _month,
              decoration:
                  const InputDecoration(labelText: 'Month', isDense: true),
              items: List.generate(
                12,
                (i) =>
                    DropdownMenuItem(value: i + 1, child: Text(_monthNames[i])),
              ),
              onChanged: (v) {
                if (v == null) return;
                setState(() {
                  _month = v;
                  _loadFolio();
                });
              },
            ),
          ),
          const SizedBox(width: 10),
          SizedBox(
            width: 110,
            child: DropdownButtonFormField<int>(
              initialValue: _year,
              decoration:
                  const InputDecoration(labelText: 'Year', isDense: true),
              items: const [2024, 2025, 2026, 2027]
                  .map((y) => DropdownMenuItem(value: y, child: Text('$y')))
                  .toList(),
              onChanged: (v) {
                if (v == null) return;
                setState(() {
                  _year = v;
                  _loadFolio();
                });
              },
            ),
          ),
        ]),
        const SizedBox(height: 16),
        Expanded(
          child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            SizedBox(
                width: 280, child: _staffPanel(staff, staffAsync.isLoading)),
            const SizedBox(width: 16),
            Expanded(child: _folioPanel(selectedStaff)),
          ]),
        ),
      ]),
    );
  }

  BoxDecoration _panelDecoration() => BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.kDivider.withValues(alpha: 0.5)),
      );

  Widget _staffPanel(List<StaffMember> staff, bool loading) {
    final query = _staffSearch.trim().toLowerCase();
    final filtered = query.isEmpty
        ? staff
        : staff
            .where((s) => _staffName(s).toLowerCase().contains(query))
            .toList();
    return Container(
      decoration: _panelDecoration(),
      clipBehavior: Clip.antiAlias,
      child: Material(
        type: MaterialType.transparency,
        child: Column(children: [
        Padding(
          padding: const EdgeInsets.all(10),
          child: TextField(
            decoration: const InputDecoration(
              hintText: 'Search staff...',
              prefixIcon: Icon(Icons.search, size: 18),
              isDense: true,
            ),
            onChanged: (v) => setState(() => _staffSearch = v),
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: loading
              ? const Center(child: CircularProgressIndicator())
              : filtered.isEmpty
                  ? const Center(
                      child: Text('No staff found',
                          style: TextStyle(color: AppColors.kTextSecondary)))
                  : ListView.separated(
                      itemCount: filtered.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (_, i) {
                        final s = filtered[i];
                        final selected = s.id == _selectedStaffId;
                        return ListTile(
                          dense: true,
                          selected: selected,
                          selectedTileColor:
                              AppColors.kPrimary.withValues(alpha: 0.08),
                          leading: CircleAvatar(
                            radius: 16,
                            backgroundColor: selected
                                ? AppColors.kPrimary
                                : AppColors.kSurface,
                            child: Text(_initials(_staffName(s)),
                                style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: selected
                                        ? Colors.white
                                        : AppColors.kTextSecondary)),
                          ),
                          title: Text(_staffName(s),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w600, fontSize: 13)),
                          subtitle: Text(
                              (s.role ?? s.department ?? '').toUpperCase(),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 10)),
                          trailing: const Icon(Icons.chevron_right, size: 16),
                          onTap: () => _selectStaff(s),
                        );
                      },
                    ),
        ),
        const Divider(height: 1),
        Padding(
          padding: const EdgeInsets.all(10),
          child: Text('${filtered.length} STAFF',
              style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: AppColors.kTextSecondary)),
        ),
        ]),
      ),
    );
  }

  Widget _folioPanel(StaffMember? staff) {
    if (staff == null) {
      return Container(
        decoration: _panelDecoration(),
        child: const Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.person_outline,
                size: 48, color: AppColors.kTextSecondary),
            SizedBox(height: 8),
            Text('Select a staff member',
                style: TextStyle(color: AppColors.kTextSecondary)),
          ]),
        ),
      );
    }
    return Container(
      decoration: _panelDecoration(),
      clipBehavior: Clip.antiAlias,
      child: FutureBuilder<List<Map<String, dynamic>>>(
        future: _folioFuture,
        builder: (context, snap) {
          final adjustments = snap.data ?? const <Map<String, dynamic>>[];
          final active =
              adjustments.where((a) => '${a['status']}' != 'cancelled');
          final deductions = active
              .where((a) => a['type'] == 'deduction')
              .fold<num>(
                  0, (s, a) => s + (num.tryParse('${a['amount'] ?? 0}') ?? 0));
          final additions = active
              .where((a) => a['type'] == 'addition')
              .fold<num>(
                  0, (s, a) => s + (num.tryParse('${a['amount'] ?? 0}') ?? 0));
          final pending =
              adjustments.where((a) => '${a['status']}' == 'pending').length;
          final loading = snap.connectionState == ConnectionState.waiting;
          return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _folioHeader(staff, additions - deductions),
                if (_canManage) _statutoryRow(staff),
                if (_canManage && _showForm) _adjustmentForm(),
                _summaryPills(deductions, additions, pending, loading),
                Expanded(
                  child: loading
                      ? const Center(child: CircularProgressIndicator())
                      : adjustments.isEmpty
                          ? _emptyFolio()
                          : _adjustmentsTable(adjustments),
                ),
              ]);
        },
      ),
    );
  }

  Widget _folioHeader(StaffMember staff, num net) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.kDivider))),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        runSpacing: 12,
        spacing: 12,
        children: [
          Row(mainAxisSize: MainAxisSize.min, children: [
            CircleAvatar(
                radius: 22,
                backgroundColor: AppColors.kSurface,
                child: Text(_initials(_staffName(staff)),
                    style: const TextStyle(fontWeight: FontWeight.bold))),
            const SizedBox(width: 12),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 240),
              child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_staffName(staff),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold)),
                    Text(
                        '${(staff.role ?? staff.department ?? 'Staff').toUpperCase()} · ${_monthNames[_month - 1]} $_year',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.kTextSecondary,
                            fontWeight: FontWeight.w600)),
                  ]),
            ),
          ]),
          Row(mainAxisSize: MainAxisSize.min, children: [
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              const Text('NET ADJUSTMENT',
                  style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.bold,
                      color: AppColors.kTextSecondary)),
              Text('${net >= 0 ? '+' : '-'} ${_money(net.abs())}',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color:
                          net >= 0 ? AppColors.kSuccess : AppColors.kError)),
            ]),
            if (_canManage) ...[
              const SizedBox(width: 12),
              FilledButton.icon(
                onPressed: () => setState(() => _showForm = !_showForm),
                icon: Icon(_showForm ? Icons.close : Icons.add, size: 16),
                label: Text(_showForm ? 'Cancel' : 'Add Adjustment'),
              ),
            ],
          ]),
        ],
      ),
    );
  }

  Widget _statutoryRow(StaffMember staff) {
    final items = [
      ('shif_enabled', 'SHIF/SHA', staff.shifEnabled),
      ('nssf_enabled', 'NSSF', staff.nssfEnabled),
      ('uniform_enabled', 'Uniform', staff.uniformEnabled),
    ];
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.kDivider))),
      child: Row(children: [
        const Text('STATUTORY (OPT-IN):',
            style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: AppColors.kTextSecondary)),
        const SizedBox(width: 12),
        Expanded(
          child: Wrap(spacing: 8, runSpacing: 8, children: [
            for (final item in items)
              ChoiceChip(
                label: Text(item.$2,
                    style: const TextStyle(
                        fontSize: 10, fontWeight: FontWeight.bold)),
                selected: item.$3,
                onSelected: _updatingStatutory
                    ? null
                    : (_) => _toggleStatutory(staff, item.$1, item.$3),
              ),
          ]),
        ),
      ]),
    );
  }

  Widget _adjustmentForm() {
    final categories =
        _formType == 'deduction' ? _deductionCategories : _additionCategories;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
          color: AppColors.kSurface,
          border: Border(bottom: BorderSide(color: AppColors.kDivider))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('NEW ADJUSTMENT',
            style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: AppColors.kTextSecondary)),
        const SizedBox(height: 10),
        Wrap(
            spacing: 12,
            runSpacing: 12,
            crossAxisAlignment: WrapCrossAlignment.end,
            children: [
              SizedBox(
                width: 220,
                child: SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'deduction', label: Text('Deduction')),
                    ButtonSegment(value: 'addition', label: Text('Addition')),
                  ],
                  selected: {_formType},
                  onSelectionChanged: (v) => setState(() {
                    _formType = v.first;
                    _formCategory = _formType == 'addition' ? 'bonus' : 'other';
                  }),
                ),
              ),
              SizedBox(
                width: 200,
                child: DropdownButtonFormField<String>(
                  initialValue: _formCategory,
                  decoration: const InputDecoration(
                      labelText: 'Category', isDense: true),
                  items: categories.entries
                      .map((e) =>
                          DropdownMenuItem(value: e.key, child: Text(e.value)))
                      .toList(),
                  onChanged: (v) =>
                      setState(() => _formCategory = v ?? _formCategory),
                ),
              ),
              SizedBox(
                width: 160,
                child: TextField(
                  controller: _amountCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                      labelText: 'Amount (KES)', isDense: true),
                ),
              ),
              SizedBox(
                width: 240,
                child: TextField(
                  controller: _descCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Remarks', isDense: true),
                ),
              ),
            ]),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton.icon(
            onPressed: _submitting ? null : _addAdjustment,
            icon: _submitting
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.check_circle, size: 16),
            label: const Text('Save Adjustment'),
          ),
        ),
      ]),
    );
  }

  Widget _summaryPills(
      num deductions, num additions, int pending, bool loading) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.kDivider))),
      child: Row(children: [
        Expanded(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: [
              _pill('- ${_money(deductions)}', AppColors.kError,
                  Icons.arrow_circle_down),
              const SizedBox(width: 8),
              _pill('+ ${_money(additions)}', AppColors.kSuccess,
                  Icons.arrow_circle_up),
              const SizedBox(width: 8),
              _pill('$pending pending', AppColors.kWarning, Icons.schedule),
            ]),
          ),
        ),
        IconButton(
          tooltip: 'Refresh',
          onPressed: _refresh,
          icon: Icon(Icons.refresh,
              size: 18,
              color: loading ? AppColors.kPrimary : AppColors.kTextSecondary),
        ),
      ]),
    );
  }

  Widget _pill(String text, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 6),
        Text(text,
            style: TextStyle(
                fontSize: 12, fontWeight: FontWeight.bold, color: color)),
      ]),
    );
  }

  Widget _emptyFolio() {
    return const Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.schedule, size: 40, color: AppColors.kTextSecondary),
        SizedBox(height: 8),
        Text('No adjustments for this period',
            style: TextStyle(
                color: AppColors.kTextSecondary, fontWeight: FontWeight.bold)),
      ]),
    );
  }

  Widget _adjustmentsTable(List<Map<String, dynamic>> adjustments) {
    return SingleChildScrollView(
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          columns: const [
            DataColumn(label: Text('Category')),
            DataColumn(label: Text('Description')),
            DataColumn(label: Text('Amount')),
            DataColumn(label: Text('Status')),
            DataColumn(label: Text('Date')),
            DataColumn(label: Text('')),
          ],
          rows: adjustments.map((a) {
            final type = '${a['type']}';
            final status = '${a['status']}';
            final amount = num.tryParse('${a['amount'] ?? 0}') ?? 0;
            final canVoid = status != 'applied' && status != 'cancelled';
            return DataRow(cells: [
              DataCell(
                  _categoryBadge(type, _categoryLabel('${a['category']}'))),
              DataCell(ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 240),
                child: Text('${a['description'] ?? '—'}',
                    maxLines: 2, overflow: TextOverflow.ellipsis),
              )),
              DataCell(Text(
                  '${type == 'deduction' ? '-' : '+'} ${_money(amount)}',
                  style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: type == 'deduction'
                          ? AppColors.kError
                          : AppColors.kSuccess))),
              DataCell(_StatusChip(status)),
              DataCell(Text(_shortDate(a['created_at']),
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.kTextSecondary))),
              DataCell(canVoid && _canManage
                  ? IconButton(
                      tooltip: 'Void adjustment',
                      onPressed: () => _voidAdjustment('${a['id']}'),
                      icon: const Icon(Icons.cancel_outlined,
                          size: 18, color: AppColors.kError),
                    )
                  : const SizedBox.shrink()),
            ]);
          }).toList(),
        ),
      ),
    );
  }

  Widget _categoryBadge(String type, String label) {
    final color = type == 'deduction' ? AppColors.kError : AppColors.kSuccess;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8)),
      child: Text(label,
          style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.bold, color: color)),
    );
  }
}

// ─── HR Reports View ─────────────────────────────────────────────────────────────

class _HRReportsView extends ConsumerWidget {
  const _HRReportsView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reportsAsync = ref.watch(hrReportsProvider);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('HR Reports',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        Expanded(
          child: AsyncValueWidget(
            value: reportsAsync,
            data: (reports) {
              if (reports.isEmpty) {
                return const EmptyState(message: 'No HR reports available');
              }
              return ListView.builder(
                itemCount: reports.length,
                itemBuilder: (_, i) {
                  final r = reports[i];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading: Icon(PhosphorIcons.fileText(),
                          color: AppColors.kPrimary),
                      title: Text(
                          (r['name'] ?? r['title'] ?? 'Report').toString(),
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(
                          'Generated: ${(r['created_at'] ?? r['date'] ?? '').toString().split('T').first}'),
                      trailing: const Icon(Icons.download,
                          size: 18, color: AppColors.kTextSecondary),
                    ),
                  );
                },
              );
            },
          ),
        ),
      ]),
    );
  }
}

// ─── Policies View ───────────────────────────────────────────────────────────────

class _PoliciesView extends ConsumerWidget {
  const _PoliciesView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final policiesAsync = ref.watch(payrollPoliciesProvider);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Payroll Policies',
                style: Theme.of(context).textTheme.displaySmall),
            const SizedBox(height: 4),
            const Text(
                'Configure statutory rates, deductions and payroll rules',
                style: TextStyle(color: AppColors.kTextSecondary)),
          ]),
          Wrap(spacing: 8, runSpacing: 8, children: [
            OutlinedButton.icon(
              onPressed: () => ref.invalidate(payrollPoliciesProvider),
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Refresh'),
            ),
            ElevatedButton.icon(
              onPressed: () => _showPolicyDialog(context, ref),
              icon: const Icon(Icons.add, size: 16),
              label: const Text('New Policy'),
            ),
          ]),
        ]),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.kPrimary.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(16),
            border:
                Border.all(color: AppColors.kPrimary.withValues(alpha: 0.12)),
          ),
          child: const Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline, color: AppColors.kPrimary),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Policy changes are used by future payroll drafts and should remain traceable for audit review.',
                    style: TextStyle(color: AppColors.kTextSecondary),
                  ),
                ),
              ]),
        ),
        const SizedBox(height: 16),
        Expanded(
          child: AsyncValueWidget(
            value: policiesAsync,
            data: (policies) {
              if (policies.isEmpty) {
                return Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        color: AppColors.kSurface,
                        borderRadius: BorderRadius.circular(40),
                      ),
                      child: const Icon(Icons.settings_outlined,
                          color: AppColors.kTextSecondary, size: 36),
                    ),
                    const SizedBox(height: 16),
                    const Text('No Policies Configured',
                        style: TextStyle(
                            fontSize: 20, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    const Text(
                        'Create your first policy to start automated payroll calculations.',
                        style: TextStyle(color: AppColors.kTextSecondary)),
                    const SizedBox(height: 18),
                    ElevatedButton.icon(
                      onPressed: () => _showPolicyDialog(context, ref),
                      icon: const Icon(Icons.add, size: 16),
                      label: const Text('New Policy'),
                    ),
                  ]),
                );
              }
              return LayoutBuilder(builder: (context, constraints) {
                final width = constraints.maxWidth;
                final columns = width < 760 ? 1 : (width < 1180 ? 2 : 3);
                final cardWidth = (width - ((columns - 1) * 12)) / columns;
                return SingleChildScrollView(
                  child: Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: policies
                        .map((p) => SizedBox(
                              width: cardWidth,
                              child: _PolicyCard(
                                policy: p,
                                onEdit: () =>
                                    _showPolicyDialog(context, ref, policy: p),
                                onDelete: () => _deletePolicy(context, ref, p),
                              ),
                            ))
                        .toList(),
                  ),
                );
              });
            },
          ),
        ),
      ]),
    );
  }

  Future<void> _deletePolicy(
      BuildContext context, WidgetRef ref, Map<String, dynamic> policy) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete policy'),
        content: Text(
            'Delete ${(policy['name'] ?? policy['title'] ?? 'this policy')}?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Delete')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref
          .read(hrRepositoryProvider)
          .deletePayrollPolicy((policy['id'] ?? '').toString());
      ref.invalidate(payrollPoliciesProvider);
      if (context.mounted) {
        AppNotifier.showSnackBar(
            context, const SnackBar(content: Text('Policy deleted')));
      }
    } catch (e) {
      if (context.mounted) {
        AppNotifier.showSnackBar(context, SnackBar(content: Text('Error: $e')));
      }
    }
  }
}

class _PolicyCard extends StatelessWidget {
  const _PolicyCard({
    required this.policy,
    required this.onEdit,
    required this.onDelete,
  });

  final Map<String, dynamic> policy;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final name = (policy['name'] ?? policy['title'] ?? 'Policy').toString();
    final category = (policy['category'] ?? 'other').toString();
    final formula =
        (policy['formula_type'] ?? policy['calculation_type'] ?? 'flat')
            .toString();
    final rate = policy['rate'] ?? policy['value'] ?? 0;
    final isActive = policy['is_active'] != false;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.kPrimary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child:
                  Icon(PhosphorIcons.shieldCheck(), color: AppColors.kPrimary),
            ),
            const Spacer(),
            Row(mainAxisSize: MainAxisSize.min, children: [
              IconButton(
                  tooltip: 'Edit policy',
                  onPressed: onEdit,
                  icon: const Icon(Icons.edit_outlined, size: 18)),
              IconButton(
                  tooltip: 'Delete policy',
                  onPressed: onDelete,
                  icon: const Icon(Icons.delete_outline, size: 18)),
            ]),
          ]),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(
              child: Text(name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 17, fontWeight: FontWeight.w800)),
            ),
            const SizedBox(width: 8),
            _StatusChip(isActive ? 'active' : 'inactive'),
          ]),
          const SizedBox(height: 6),
          Text(category.replaceAll('_', ' ').toUpperCase(),
              style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppColors.kTextSecondary)),
          const SizedBox(height: 18),
          Row(children: [
            Expanded(
              child: _PolicyMetric(label: 'Formula', value: formula),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _PolicyMetric(label: 'Rate', value: '$rate'),
            ),
          ]),
        ]),
      ),
    );
  }
}

class _PolicyMetric extends StatelessWidget {
  const _PolicyMetric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.kSurface,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label,
            style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: AppColors.kTextSecondary)),
        const SizedBox(height: 3),
        Text(value.replaceAll('_', ' '),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w800)),
      ]),
    );
  }
}

void _showPolicyDialog(BuildContext context, WidgetRef ref,
    {Map<String, dynamic>? policy}) {
  final nameCtrl = TextEditingController(
      text: (policy?['name'] ?? policy?['title'] ?? '').toString());
  final descCtrl = TextEditingController(
      text: (policy?['description'] ?? policy?['summary'] ?? '').toString());
  final rateCtrl = TextEditingController(
      text: '${policy?['rate'] ?? policy?['value'] ?? 0}');
  String category = '${policy?['category'] ?? 'other'}';
  String formulaType =
      '${policy?['formula_type'] ?? policy?['calculation_type'] ?? 'flat'}';
  bool isActive = policy?['is_active'] != false;
  showDialog(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setState) => AlertDialog(
        title: Text(policy == null ? 'New Policy' : 'Edit Policy'),
        content: SizedBox(
          width: 460,
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Name')),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: category,
                decoration: const InputDecoration(labelText: 'Category'),
                items: const [
                  DropdownMenuItem(value: 'addition', child: Text('Addition')),
                  DropdownMenuItem(
                      value: 'deduction', child: Text('Deduction')),
                  DropdownMenuItem(value: 'tax', child: Text('Tax')),
                  DropdownMenuItem(value: 'nssf', child: Text('NSSF')),
                  DropdownMenuItem(value: 'shif', child: Text('SHIF')),
                  DropdownMenuItem(
                      value: 'housing_levy', child: Text('Housing Levy')),
                  DropdownMenuItem(value: 'other', child: Text('Other')),
                ],
                onChanged: (value) =>
                    setState(() => category = value ?? category),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: formulaType,
                decoration: const InputDecoration(labelText: 'Formula Type'),
                items: const [
                  DropdownMenuItem(
                      value: 'percentage', child: Text('Percentage')),
                  DropdownMenuItem(value: 'flat', child: Text('Flat')),
                  DropdownMenuItem(value: 'range', child: Text('Range')),
                  DropdownMenuItem(
                      value: 'attendance_based',
                      child: Text('Attendance Based')),
                ],
                onChanged: (value) =>
                    setState(() => formulaType = value ?? formulaType),
              ),
              const SizedBox(height: 12),
              TextField(
                  controller: rateCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Rate')),
              const SizedBox(height: 12),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Active'),
                value: isActive,
                onChanged: (value) => setState(() => isActive = value),
              ),
              const SizedBox(height: 12),
              TextField(
                  controller: descCtrl,
                  decoration: const InputDecoration(labelText: 'Description'),
                  maxLines: 3),
            ]),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                final data = {
                  'name': nameCtrl.text.trim(),
                  'category': category,
                  'formula_type': formulaType,
                  'rate': num.tryParse(rateCtrl.text.trim()) ?? 0,
                  'is_active': isActive,
                  'description': descCtrl.text.trim(),
                };
                if (policy == null) {
                  await ref
                      .read(hrRepositoryProvider)
                      .createPayrollPolicy(data);
                } else {
                  final id = (policy['id'] ?? '').toString();
                  await ref
                      .read(hrRepositoryProvider)
                      .updatePayrollPolicy(id, data);
                }
                ref.invalidate(payrollPoliciesProvider);
                if (context.mounted) {
                  AppNotifier.showSnackBar(
                      context,
                      SnackBar(
                          content: Text(policy == null
                              ? 'Policy created'
                              : 'Policy updated')));
                }
              } catch (e) {
                if (context.mounted) {
                  AppNotifier.showSnackBar(
                      context, SnackBar(content: Text('Error: $e')));
                }
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    ),
  );
}

class HRStaffAttendanceDetailScreen extends ConsumerStatefulWidget {
  const HRStaffAttendanceDetailScreen({super.key, required this.staffId});

  final String staffId;

  @override
  ConsumerState<HRStaffAttendanceDetailScreen> createState() =>
      _HRStaffAttendanceDetailScreenState();
}

class _HRStaffAttendanceDetailScreenState
    extends ConsumerState<HRStaffAttendanceDetailScreen> {
  late Future<_StaffAttendanceDetail> _future;
  int _selectedYear = DateTime.now().year;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_StaffAttendanceDetail> _load() async {
    final repo = ref.read(hrRepositoryProvider);
    final values = await Future.wait<dynamic>([
      repo.getStaffMember(widget.staffId),
      repo.getAttendance(staffId: widget.staffId, limit: 1000),
      repo.getAttendanceSummary(staffId: widget.staffId),
      repo.getLeaveRequests(staffId: widget.staffId),
      repo.getStaffHistory(widget.staffId),
      repo.getStaffDocuments(widget.staffId),
    ]);
    return _StaffAttendanceDetail(
      staff: values[0] as StaffMember,
      attendance: values[1] as List<AttendanceRecord>,
      summary: values[2] as Map<String, dynamic>,
      leave: values[3] as List<LeaveRequest>,
      history: values[4] as List<Map<String, dynamic>>,
      documents: values[5] as List<Map<String, dynamic>>,
    );
  }

  void _refresh() => setState(() {
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.kSurface,
      appBar: AppBar(
        title: const Text('Staff Attendance Audit'),
        leading: IconButton(
          tooltip: 'Back',
          onPressed: () {
            if (Navigator.canPop(context)) Navigator.pop(context);
          },
          icon: const Icon(Icons.arrow_back),
        ),
        actions: [
          DropdownButtonHideUnderline(
            child: DropdownButton<int>(
              value: _selectedYear,
              items: [
                for (final year
                    in List.generate(5, (i) => DateTime.now().year - i))
                  DropdownMenuItem(value: year, child: Text('$year')),
              ],
              onChanged: (value) {
                if (value != null) setState(() => _selectedYear = value);
              },
            ),
          ),
          IconButton(
            tooltip: 'Refresh',
            onPressed: _refresh,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: FutureBuilder<_StaffAttendanceDetail>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: ErrorState(
                message: '${snapshot.error}',
                onRetry: _refresh,
              ),
            );
          }
          return _body(snapshot.data!);
        },
      ),
    );
  }

  Widget _body(_StaffAttendanceDetail detail) {
    final yearlyRecords = detail.attendance.where((record) {
      final date = record.clockIn ?? record.clockOut;
      return date == null || date.year == _selectedYear;
    }).toList();
    final totalHours = yearlyRecords.fold<double>(
      0,
      (sum, record) => sum + (record.hoursWorked ?? 0),
    );
    final approvedLeaveDays = detail.leave
        .where((leave) => leave.status == 'approved')
        .fold<int>(0, (sum, leave) {
      if (leave.startDate == null || leave.endDate == null) return sum;
      return sum + leave.endDate!.difference(leave.startDate!).inDays + 1;
    });

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _profileHeader(detail.staff),
        const SizedBox(height: 16),
        LayoutBuilder(builder: (context, constraints) {
          final narrow = constraints.maxWidth < 900;
          return GridView.count(
            crossAxisCount: narrow ? 2 : 4,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            childAspectRatio: narrow ? 1.7 : 2.4,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            children: [
              _OverviewCard(
                title: 'Present Days',
                value: '${yearlyRecords.length}',
                icon: PhosphorIcons.calendarCheck(),
                color: AppColors.kSuccess,
              ),
              _OverviewCard(
                title: 'Total Hours',
                value: totalHours.toStringAsFixed(1),
                icon: PhosphorIcons.clock(),
                color: AppColors.kPrimary,
              ),
              _OverviewCard(
                title: 'Leave Days',
                value: '$approvedLeaveDays',
                icon: PhosphorIcons.calendar(),
                color: AppColors.kWarning,
              ),
              _OverviewCard(
                title: 'Pending Leave',
                value:
                    '${detail.leave.where((l) => l.status == 'pending').length}',
                icon: PhosphorIcons.spinner(),
                color: Colors.indigo,
              ),
            ],
          );
        }),
        const SizedBox(height: 16),
        _summaryBlock(detail.summary),
        const SizedBox(height: 16),
        _attendanceHeatmap(yearlyRecords),
        const SizedBox(height: 16),
        _attendanceTable(yearlyRecords),
        const SizedBox(height: 16),
        _leaveTable(detail.leave),
        const SizedBox(height: 16),
        _rawRows('Staff History', detail.history),
        const SizedBox(height: 16),
        _rawRows('Documents', detail.documents),
      ]),
    );
  }

  Widget _profileHeader(StaffMember staff) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(children: [
          SafeAvatar(
            imageUrl: staff.photoUrl,
            name: staff.name,
            radius: 28,
          ),
          const SizedBox(width: 14),
          Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(staff.name,
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text('${staff.role ?? 'Staff'} • ${staff.branchName ?? '—'}',
                  style: const TextStyle(color: AppColors.kTextSecondary)),
              const SizedBox(height: 8),
              Wrap(spacing: 12, runSpacing: 6, children: [
                if (staff.email != null) Text(staff.email!),
                if (staff.phone != null) Text(staff.phone!),
              ]),
            ]),
          ),
          _StatusChip(staff.isActive ? 'active' : 'archived'),
        ]),
      ),
    );
  }

  Widget _summaryBlock(Map<String, dynamic> summary) {
    if (summary.isEmpty) return const SizedBox.shrink();
    return _rawRows('Attendance Summary', [summary]);
  }

  Widget _attendanceHeatmap(List<AttendanceRecord> records) {
    final activeDays = <String>{};
    for (final record in records) {
      final date = record.clockIn ?? record.clockOut;
      if (date != null) {
        activeDays.add('${date.year}-${date.month}-${date.day}');
      }
    }
    final first = DateTime(_selectedYear, 1, 1);
    final days = DateTime(_selectedYear + 1, 1, 1).difference(first).inDays;
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Yearly Attendance Heatmap',
              style: TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 3,
            runSpacing: 3,
            children: [
              for (var i = 0; i < days; i++)
                Builder(builder: (_) {
                  final day = first.add(Duration(days: i));
                  final present = activeDays
                      .contains('${day.year}-${day.month}-${day.day}');
                  return Tooltip(
                    message:
                        '${day.day}/${day.month}/${day.year}${present ? ' present' : ''}',
                    child: Container(
                      width: 9,
                      height: 9,
                      decoration: BoxDecoration(
                        color: present
                            ? AppColors.kSuccess
                            : AppColors.kDivider.withValues(alpha: 0.7),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  );
                }),
            ],
          ),
        ]),
      ),
    );
  }

  Widget _attendanceTable(List<AttendanceRecord> records) {
    return _cardTable(
      title: 'Recent Attendance',
      columns: const ['Date', 'Clock In', 'Clock Out', 'Hours', 'Status'],
      rows: records.take(50).map((record) {
        final date = record.clockIn ?? record.clockOut;
        return [
          _fmtDate(date),
          _fmtTime(record.clockIn),
          _fmtTime(record.clockOut),
          record.hoursWorked?.toStringAsFixed(1) ?? '—',
          record.status ?? 'present',
        ];
      }).toList(),
      empty: 'No attendance records found for this year',
    );
  }

  Widget _leaveTable(List<LeaveRequest> leave) {
    return _cardTable(
      title: 'Leave Requests',
      columns: const ['Type', 'Start', 'End', 'Status', 'Reason'],
      rows: leave
          .map((request) => [
                request.leaveType ?? 'Leave',
                _fmtDate(request.startDate),
                _fmtDate(request.endDate),
                request.status,
                request.reason ?? '—',
              ])
          .toList(),
      empty: 'No leave requests found',
    );
  }

  Widget _rawRows(String title, List<Map<String, dynamic>> rows) {
    final keys = <String>{};
    for (final row in rows) {
      keys.addAll(row.keys.take(8));
    }
    return _cardTable(
      title: title,
      columns: keys.take(6).map(_label).toList(),
      rows: rows
          .map((row) => keys.take(6).map((key) => _format(row[key])).toList())
          .toList(),
      empty: 'No records found',
    );
  }

  Widget _cardTable({
    required String title,
    required List<String> columns,
    required List<List<String>> rows,
    required String empty,
  }) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
          child: Text(title,
              style:
                  const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
        ),
        const Divider(height: 1),
        if (rows.isEmpty || columns.isEmpty)
          Padding(
            padding: const EdgeInsets.all(24),
            child: Center(
                child: Text(empty,
                    style: const TextStyle(color: AppColors.kTextSecondary))),
          )
        else
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingRowColor: WidgetStateProperty.all(AppColors.kSurface),
              columns: columns
                  .map((column) => DataColumn(
                      label: Text(column,
                          style: const TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w800))))
                  .toList(),
              rows: rows
                  .map((row) => DataRow(
                        cells: row
                            .map((cell) => DataCell(SizedBox(
                                  width: 140,
                                  child: Text(cell,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontSize: 12)),
                                )))
                            .toList(),
                      ))
                  .toList(),
            ),
          ),
      ]),
    );
  }

  String _fmtDate(DateTime? value) {
    if (value == null) return '—';
    return '${value.day.toString().padLeft(2, '0')}/${value.month.toString().padLeft(2, '0')}/${value.year}';
  }

  String _fmtTime(DateTime? value) {
    if (value == null) return '—';
    return '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
  }

  String _label(String value) => value
      .replaceAll('_', ' ')
      .split(' ')
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1))
      .join(' ');

  String _format(dynamic value) {
    if (value == null || '$value'.isEmpty) return '—';
    if (value is Map) {
      return '${value['name'] ?? value['title'] ?? value['full_name'] ?? value['id'] ?? '—'}';
    }
    if (value is List) return '${value.length} items';
    return '$value';
  }
}

class _StaffAttendanceDetail {
  const _StaffAttendanceDetail({
    required this.staff,
    required this.attendance,
    required this.summary,
    required this.leave,
    required this.history,
    required this.documents,
  });

  final StaffMember staff;
  final List<AttendanceRecord> attendance;
  final Map<String, dynamic> summary;
  final List<LeaveRequest> leave;
  final List<Map<String, dynamic>> history;
  final List<Map<String, dynamic>> documents;
}
