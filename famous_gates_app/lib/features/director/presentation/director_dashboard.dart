import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path_provider/path_provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/master_dashboard_shell.dart';
import '../../../core/widgets/widgets.dart' hide DataColumn, DataRow;
import '../data/repository.dart';

enum DirectorSection {
  overview,
  payments,
  banking,
  discrepancies,
  drillDown,
  tasks,
  auditor,
  hr,
  branchAccounting,
  procurement,
}

class DirectorDashboard extends ConsumerStatefulWidget {
  const DirectorDashboard({
    super.key,
    this.initialSection = DirectorSection.overview,
  });

  final DirectorSection initialSection;

  @override
  ConsumerState<DirectorDashboard> createState() => _DirectorDashboardState();
}

class _DirectorDashboardState extends ConsumerState<DirectorDashboard> {
  late DirectorSection _section;
  late Future<_DirectorSnapshot> _future;
  late DateTime _startDate;
  late DateTime _endDate;

  String? _branchId;
  String _reportType = 'comprehensive';
  String _discrepancyStatus = '';
  String _discrepancySeverity = '';
  String _taskStatus = '';
  String _taskPriority = '';
  String _taskRole = '';
  String _search = '';

  Map<String, dynamic>? _selectedBranch;
  DateTime? _selectedDate;
  String? _selectedStream;
  int _dateRangeDays = 30;
  Future<Map<String, dynamic>>? _drillFuture;

  static const _streams = [
    'Revenue Streams',
    'Payment Methods',
    'Expense Categories',
    'Audit Logs',
    'Banking',
  ];

  @override
  void initState() {
    super.initState();
    _section = widget.initialSection;
    final now = DateTime.now();
    _endDate = DateTime(now.year, now.month, now.day);
    _startDate = _endDate.subtract(const Duration(days: 30));
    _future = _load();
  }

  Future<_DirectorSnapshot> _load() async {
    final repo = ref.read(directorRepositoryProvider);
    final results = await Future.wait<dynamic>([
      repo.getComprehensiveDashboard(
        startDate: _startDate,
        endDate: _endDate,
        branchId: _branchId,
      ),
      repo.getBranches(),
      repo.getPaymentBreakdown(
        startDate: _startDate,
        endDate: _endDate,
        branchId: _branchId,
      ),
      repo.getBankingReconciliation(
        startDate: _startDate,
        endDate: _endDate,
        branchId: _branchId,
      ),
      repo.getDiscrepancies(
        status: _discrepancyStatus,
        severity: _discrepancySeverity,
        branchId: _branchId,
      ),
      repo.getTasks(
        status: _taskStatus,
        priority: _taskPriority,
        assignedToRole: _taskRole,
      ),
    ]);
    return _DirectorSnapshot(
      dashboard: _payload(results[0]),
      branches: _rows(results[1]),
      payments: _payload(results[2]),
      banking: _payload(results[3]),
      discrepancies: _rows(results[4]),
      tasks: _rows(results[5]),
    );
  }

  void _refresh() {
    setState(() => _future = _load());
  }

  void _selectSection(DirectorSection section) {
    switch (section) {
      case DirectorSection.auditor:
        context.go('/auditor');
      case DirectorSection.hr:
        context.go('/auditor/hr');
      case DirectorSection.branchAccounting:
        context.go('/branch-accountant/financial-workspace');
      case DirectorSection.procurement:
        context.go('/procurement');
      default:
        setState(() => _section = section);
    }
  }

  @override
  Widget build(BuildContext context) {
    return MasterDashboardShell<DirectorSection>(
      title: 'Director',
      subtitle: 'Executive control',
      initials: 'DR',
      breadcrumbRoot: 'Director',
      searchHint: 'Search branch, task, flag...',
      currentSection: _section,
      items: const [
        MasterNavItem(
          section: DirectorSection.overview,
          label: 'Overview',
          icon: Icons.dashboard_outlined,
          group: 'Executive',
        ),
        MasterNavItem(
          section: DirectorSection.payments,
          label: 'Payment Intelligence',
          icon: Icons.payments_outlined,
          group: 'Executive',
        ),
        MasterNavItem(
          section: DirectorSection.banking,
          label: 'Banking Control',
          icon: Icons.account_balance_outlined,
          group: 'Executive',
        ),
        MasterNavItem(
          section: DirectorSection.discrepancies,
          label: 'Discrepancies',
          icon: Icons.report_problem_outlined,
          group: 'Controls',
        ),
        MasterNavItem(
          section: DirectorSection.drillDown,
          label: 'Deep Drill-Down',
          icon: Icons.account_tree_outlined,
          group: 'Controls',
        ),
        MasterNavItem(
          section: DirectorSection.tasks,
          label: 'Review Tasks',
          icon: Icons.task_alt_outlined,
          group: 'Controls',
        ),
        MasterNavItem(
          section: DirectorSection.auditor,
          label: 'Auditor Portal',
          icon: Icons.verified_user_outlined,
          group: 'Departments',
        ),
        MasterNavItem(
          section: DirectorSection.hr,
          label: 'HR Dashboard',
          icon: Icons.groups_2_outlined,
          group: 'Departments',
        ),
        MasterNavItem(
          section: DirectorSection.branchAccounting,
          label: 'Branch Accounting',
          icon: Icons.request_quote_outlined,
          group: 'Departments',
        ),
        MasterNavItem(
          section: DirectorSection.procurement,
          label: 'Procurement',
          icon: Icons.shopping_cart_outlined,
          group: 'Departments',
        ),
      ],
      onSectionSelected: _selectSection,
      child: FutureBuilder<_DirectorSnapshot>(
        key: ValueKey(
            '${_section.name}-$_branchId-$_startDate-$_endDate-$_discrepancyStatus-$_discrepancySeverity-$_taskStatus-$_taskPriority-$_taskRole'),
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting &&
              !snapshot.hasData) {
            return const Padding(
              padding: EdgeInsets.all(24),
              child: LoadingSkeleton(type: SkeletonType.list),
            );
          }
          if (snapshot.hasError) {
            return ErrorState(message: '${snapshot.error}', onRetry: _refresh);
          }
          final data = snapshot.data ?? _DirectorSnapshot.empty();
          return _sectionChild(data);
        },
      ),
    );
  }

  Widget _sectionChild(_DirectorSnapshot data) {
    switch (_section) {
      case DirectorSection.overview:
        return _OverviewSection(
          data: data,
          startDate: _startDate,
          endDate: _endDate,
          branchId: _branchId,
          reportType: _reportType,
          onDateChanged: _setDates,
          onBranchChanged: (value) {
            setState(() => _branchId = value?.isEmpty == true ? null : value);
            _refresh();
          },
          onReportTypeChanged: (value) => setState(() => _reportType = value),
          onExport: _exportDirectorPdf,
          onRefresh: _refresh,
          onNavigate: _selectSection,
        );
      case DirectorSection.payments:
        return _PaymentSection(
          data: data,
          startDate: _startDate,
          endDate: _endDate,
          onDateChanged: _setDates,
          onRefresh: _refresh,
        );
      case DirectorSection.banking:
        return _BankingSection(
          data: data,
          startDate: _startDate,
          endDate: _endDate,
          onDateChanged: _setDates,
          onRefresh: _refresh,
          onDrill: (branch) {
            setState(() {
              _selectedBranch = branch;
              _selectedDate = DateTime.now();
              _section = DirectorSection.drillDown;
            });
          },
        );
      case DirectorSection.discrepancies:
        return _DiscrepanciesSection(
          data: data,
          status: _discrepancyStatus,
          severity: _discrepancySeverity,
          onStatusChanged: (value) {
            setState(() => _discrepancyStatus = value);
            _refresh();
          },
          onSeverityChanged: (value) {
            setState(() => _discrepancySeverity = value);
            _refresh();
          },
          onCreate: () => _showCreateFlagDialog(data.branches),
          onOpen: _showFlagDetail,
          onExport: _exportDiscrepancies,
          onRefresh: _refresh,
        );
      case DirectorSection.drillDown:
        return _DrillDownSection(
          branches: data.branches,
          selectedBranch: _selectedBranch,
          selectedDate: _selectedDate,
          selectedStream: _selectedStream,
          dateRangeDays: _dateRangeDays,
          search: _search,
          drillFuture: _drillFuture,
          streams: _streams,
          onSearchChanged: (value) => setState(() => _search = value),
          onDateRangeChanged: (value) => setState(() => _dateRangeDays = value),
          onBranchSelected: (branch) => setState(() {
            _selectedBranch = branch;
            _selectedDate = null;
            _selectedStream = null;
            _drillFuture = null;
            _search = '';
          }),
          onDateSelected: (date) => setState(() {
            _selectedDate = date;
            _selectedStream = null;
            _drillFuture = null;
            _search = '';
          }),
          onStreamSelected: (stream) {
            setState(() {
              _selectedStream = stream;
              _drillFuture = ref
                  .read(directorRepositoryProvider)
                  .getDrillDownData(
                    branchId: _id(_selectedBranch),
                    date: _selectedDate ?? DateTime.now(),
                    stream: stream,
                  )
                  .then(_payload);
            });
          },
          onReset: (level) => _resetDrillDown(level),
          onRefresh: _refreshDrillDown,
          onExportCsv: _exportCurrentStreamCsv,
          onAssignTask: _showTaskDialog,
        );
      case DirectorSection.tasks:
        return _TasksSection(
          data: data,
          status: _taskStatus,
          priority: _taskPriority,
          assignedRole: _taskRole,
          onStatusChanged: (value) {
            setState(() => _taskStatus = value);
            _refresh();
          },
          onPriorityChanged: (value) {
            setState(() => _taskPriority = value);
            _refresh();
          },
          onRoleChanged: (value) {
            setState(() => _taskRole = value);
            _refresh();
          },
          onOpen: _showTaskDetail,
          onRefresh: _refresh,
        );
      case DirectorSection.auditor:
      case DirectorSection.hr:
      case DirectorSection.branchAccounting:
      case DirectorSection.procurement:
        return const SizedBox.shrink();
    }
  }

  void _setDates(DateTime start, DateTime end) {
    setState(() {
      _startDate = start;
      _endDate = end;
    });
    _refresh();
  }

  void _resetDrillDown(String level) {
    setState(() {
      _search = '';
      if (level == 'company') {
        _selectedBranch = null;
        _selectedDate = null;
        _selectedStream = null;
      } else if (level == 'branch') {
        _selectedDate = null;
        _selectedStream = null;
      } else if (level == 'date') {
        _selectedStream = null;
      }
      _drillFuture = null;
    });
  }

  void _refreshDrillDown() {
    if (_selectedBranch == null ||
        _selectedDate == null ||
        _selectedStream == null) {
      return;
    }
    setState(() {
      _drillFuture = ref
          .read(directorRepositoryProvider)
          .getDrillDownData(
            branchId: _id(_selectedBranch),
            date: _selectedDate!,
            stream: _selectedStream!,
          )
          .then(_payload);
    });
  }

  Future<void> _exportDirectorPdf() async {
    try {
      final file = await ref.read(directorRepositoryProvider).exportDirectorPdf(
            startDate: _startDate,
            endDate: _endDate,
            reportType: _reportType,
            branchId: _branchId,
          );
      _snack('Director report downloaded: ${file.path}');
    } catch (error) {
      _snack('Director export failed: $error', error: true);
    }
  }

  Future<void> _exportDiscrepancies() async {
    try {
      final file =
          await ref.read(directorRepositoryProvider).exportDiscrepancyAudit(
                status: _discrepancyStatus,
                severity: _discrepancySeverity,
                branchId: _branchId,
              );
      _snack('Discrepancy audit report downloaded: ${file.path}');
    } catch (error) {
      _snack('Discrepancy export failed: $error', error: true);
    }
  }

  Future<void> _exportCurrentStreamCsv() async {
    final data = await _drillFuture;
    final rows = _rows(data?['rows'] ?? []);
    if (rows.isEmpty) {
      _snack('No stream data to export', error: true);
      return;
    }
    final headers = rows.first.keys.toList();
    final lines = [
      headers.join(','),
      ...rows.map((row) => headers
          .map((key) => '"${('${row[key] ?? ''}').replaceAll('"', '""')}"')
          .join(',')),
    ];
    final directory = await getDownloadsDirectory() ??
        await getApplicationDocumentsDirectory();
    final safeStream = (_selectedStream ?? 'stream').replaceAll(' ', '_');
    final safeBranch = _text(_selectedBranch, ['name']).replaceAll(' ', '_');
    final file = File(
        '${directory.path}/director_${safeStream}_${safeBranch}_${_date(_selectedDate ?? DateTime.now())}.csv');
    await file.writeAsString(lines.join('\n'));
    _snack('CSV exported: ${file.path}');
  }

  Future<void> _showCreateFlagDialog(
      List<Map<String, dynamic>> branches) async {
    final branchController = TextEditingController();
    final description = TextEditingController();
    String flagType = 'MISSING_DOCUMENTATION';
    String severity = 'MEDIUM';
    DateTime recordDate = DateTime.now();

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(builder: (context, setDialogState) {
          return AlertDialog(
            title: const Text('Create Discrepancy Flag'),
            content: SizedBox(
              width: 520,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _selectField(
                      label: 'Branch',
                      value: branchController.text,
                      options: branches
                          .map((b) => MapEntry(_id(b), _text(b, ['name'])))
                          .toList(),
                      onChanged: (value) =>
                          setDialogState(() => branchController.text = value),
                    ),
                    _selectField(
                      label: 'Flag Type',
                      value: flagType,
                      options: const [
                        MapEntry(
                            'MISSING_DOCUMENTATION', 'Missing Documentation'),
                        MapEntry('AMOUNT_MISMATCH', 'Amount Mismatch'),
                        MapEntry('UNAUTHORIZED_TRANSACTION',
                            'Unauthorized Transaction'),
                        MapEntry('POLICY_VIOLATION', 'Policy Violation'),
                        MapEntry('SUSPICIOUS_ACTIVITY', 'Suspicious Activity'),
                        MapEntry('OTHER', 'Other'),
                      ],
                      onChanged: (value) =>
                          setDialogState(() => flagType = value),
                    ),
                    _selectField(
                      label: 'Severity',
                      value: severity,
                      options: const [
                        MapEntry('LOW', 'Low'),
                        MapEntry('MEDIUM', 'Medium'),
                        MapEntry('HIGH', 'High'),
                        MapEntry('CRITICAL', 'Critical'),
                      ],
                      onChanged: (value) =>
                          setDialogState(() => severity = value),
                    ),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Record Date'),
                      subtitle: Text(_date(recordDate)),
                      trailing: const Icon(Icons.calendar_month_outlined),
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: recordDate,
                          firstDate: DateTime(2020),
                          lastDate: DateTime.now().add(
                            const Duration(days: 365),
                          ),
                        );
                        if (picked != null) {
                          setDialogState(() => recordDate = picked);
                        }
                      },
                    ),
                    TextField(
                      controller: description,
                      minLines: 4,
                      maxLines: 6,
                      decoration: const InputDecoration(
                        labelText: 'Description',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: const Text('Cancel')),
              FilledButton(
                onPressed: () async {
                  if (branchController.text.isEmpty ||
                      description.text.trim().isEmpty) {
                    _snack('Branch and description are required', error: true);
                    return;
                  }
                  try {
                    await ref
                        .read(directorRepositoryProvider)
                        .createDiscrepancyFlag({
                      'branch_id': branchController.text,
                      'flag_type': flagType,
                      'severity': severity,
                      'record_date': _date(recordDate),
                      'description': description.text.trim(),
                    });
                    if (!dialogContext.mounted) return;
                    Navigator.pop(dialogContext);
                    _refresh();
                    _snack('Discrepancy flag created');
                  } catch (error) {
                    _snack('Create flag failed: $error', error: true);
                  }
                },
                child: const Text('Create Flag'),
              ),
            ],
          );
        });
      },
    );
  }

  Future<void> _showFlagDetail(Map<String, dynamic> flag) async {
    final response = TextEditingController();
    final resolution = TextEditingController();
    String finalStatus = 'RESOLVED';

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(builder: (context, setDialogState) {
          return AlertDialog(
            title: Text(_pretty(_text(flag, ['flag_type'], fallback: 'Flag'))),
            content: SizedBox(
              width: 620,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _detailGrid({
                      'Branch': _nestedText(flag, 'branches', 'name'),
                      'Severity': _text(flag, ['severity']),
                      'Status': _pretty(_text(flag, ['status'])),
                      'Record Date': _text(flag, ['record_date']),
                      'Created': _text(flag, ['created_at']),
                    }),
                    const SizedBox(height: 12),
                    _noteBlock('Description',
                        _text(flag, ['description'], fallback: '-')),
                    if (_text(flag, ['accountant_response']).isNotEmpty)
                      _noteBlock('Accountant Response',
                          _text(flag, ['accountant_response'])),
                    if (_text(flag, ['director_final_decision']).isNotEmpty)
                      _noteBlock('Director Final Decision',
                          _text(flag, ['director_final_decision'])),
                    const SizedBox(height: 16),
                    TextField(
                      controller: response,
                      minLines: 2,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        labelText: 'Accountant response',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: resolution,
                            minLines: 2,
                            maxLines: 4,
                            decoration: const InputDecoration(
                              labelText: 'Director resolution',
                              border: OutlineInputBorder(),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        DropdownButton<String>(
                          value: finalStatus,
                          items: const [
                            DropdownMenuItem(
                                value: 'RESOLVED', child: Text('Resolved')),
                            DropdownMenuItem(
                                value: 'ESCALATED', child: Text('Escalated')),
                          ],
                          onChanged: (value) => setDialogState(
                              () => finalStatus = value ?? 'RESOLVED'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: const Text('Close')),
              OutlinedButton(
                onPressed: response.text.trim().isEmpty
                    ? null
                    : () async {
                        await ref
                            .read(directorRepositoryProvider)
                            .respondToDiscrepancy(
                              _id(flag),
                              response.text.trim(),
                            );
                        if (!dialogContext.mounted) return;
                        Navigator.pop(dialogContext);
                        _refresh();
                      },
                child: const Text('Submit Response'),
              ),
              FilledButton(
                onPressed: resolution.text.trim().isEmpty
                    ? null
                    : () async {
                        await ref
                            .read(directorRepositoryProvider)
                            .finalizeDiscrepancy(
                              _id(flag),
                              resolution.text.trim(),
                              finalStatus,
                            );
                        if (!dialogContext.mounted) return;
                        Navigator.pop(dialogContext);
                        _refresh();
                      },
                child: const Text('Finalize'),
              ),
            ],
          );
        });
      },
    );
  }

  Future<void> _showTaskDialog(Map<String, dynamic> contextData) async {
    final title = TextEditingController(
      text:
          'Review: ${contextData['stream']} - ${_nestedText(contextData, 'branch', 'name')}',
    );
    final description = TextEditingController(
      text:
          'Please review ${contextData['stream']} for ${_nestedText(contextData, 'branch', 'name')} on ${_date(contextData['date'] as DateTime)} and provide a detailed response.',
    );
    final notes = TextEditingController();
    String role = 'branch_accountant';
    String priority = 'HIGH';
    DateTime? dueDate;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(builder: (context, setDialogState) {
          return AlertDialog(
            title: const Text('Assign Review Task'),
            content: SizedBox(
              width: 520,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: title,
                      decoration: const InputDecoration(labelText: 'Title'),
                    ),
                    _selectField(
                      label: 'Assign to Role',
                      value: role,
                      options: const [
                        MapEntry('branch_accountant', 'Branch Accountant'),
                        MapEntry('auditor', 'Auditor'),
                        MapEntry('hr_manager', 'HR Manager'),
                        MapEntry('branch_manager', 'Branch Manager'),
                        MapEntry('general_manager', 'General Manager'),
                      ],
                      onChanged: (value) => setDialogState(() => role = value),
                    ),
                    _selectField(
                      label: 'Priority',
                      value: priority,
                      options: const [
                        MapEntry('LOW', 'Low'),
                        MapEntry('MEDIUM', 'Medium'),
                        MapEntry('HIGH', 'High'),
                        MapEntry('CRITICAL', 'Critical'),
                      ],
                      onChanged: (value) =>
                          setDialogState(() => priority = value),
                    ),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Due Date'),
                      subtitle:
                          Text(dueDate == null ? 'Not set' : _date(dueDate!)),
                      trailing: const Icon(Icons.calendar_month_outlined),
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: DateTime.now(),
                          firstDate: DateTime.now(),
                          lastDate:
                              DateTime.now().add(const Duration(days: 365)),
                        );
                        if (picked != null) {
                          setDialogState(() => dueDate = picked);
                        }
                      },
                    ),
                    TextField(
                      controller: description,
                      minLines: 3,
                      maxLines: 5,
                      decoration:
                          const InputDecoration(labelText: 'Instructions'),
                    ),
                    TextField(
                      controller: notes,
                      minLines: 2,
                      maxLines: 4,
                      decoration: const InputDecoration(
                          labelText: 'Director notes (internal)'),
                    ),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: const Text('Cancel')),
              FilledButton(
                onPressed: () async {
                  try {
                    await ref.read(directorRepositoryProvider).createTask({
                      'title': title.text.trim(),
                      'description': description.text.trim(),
                      'assigned_to_role': role,
                      'priority': priority,
                      'branch_id': _id(contextData['branch']),
                      'related_record_date':
                          _date(contextData['date'] as DateTime),
                      'related_stream': contextData['stream'],
                      'director_notes': notes.text.trim(),
                      if (dueDate != null) 'due_date': _date(dueDate!),
                    });
                    if (!dialogContext.mounted) return;
                    Navigator.pop(dialogContext);
                    _refresh();
                    _snack('Review task assigned');
                  } catch (error) {
                    _snack('Assign task failed: $error', error: true);
                  }
                },
                child: const Text('Assign Task'),
              ),
            ],
          );
        });
      },
    );
  }

  Future<void> _showTaskDetail(Map<String, dynamic> task) async {
    final response = TextEditingController();
    final closeNote = TextEditingController();
    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: Text(_text(task, ['title'], fallback: 'Review task')),
          content: SizedBox(
            width: 600,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _detailGrid({
                    'Branch': _nestedText(task, 'branches', 'name'),
                    'Assigned Role': _pretty(_text(task, ['assigned_to_role'])),
                    'Priority': _text(task, ['priority']),
                    'Status': _pretty(_text(task, ['status'])),
                    'Due Date': _text(task, ['due_date']),
                    'Stream': _text(task, ['related_stream']),
                  }),
                  const SizedBox(height: 12),
                  _noteBlock('Instructions',
                      _text(task, ['description'], fallback: '-')),
                  if (_text(task, ['director_notes']).isNotEmpty)
                    _noteBlock(
                        'Director Notes', _text(task, ['director_notes'])),
                  if (_text(task, ['response_notes']).isNotEmpty)
                    _noteBlock(
                        'Staff Response', _text(task, ['response_notes'])),
                  const SizedBox(height: 12),
                  TextField(
                    controller: response,
                    minLines: 2,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Response notes',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: closeNote,
                    minLines: 2,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Director close notes',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Close')),
            OutlinedButton(
              onPressed: () async {
                if (response.text.trim().isEmpty) {
                  return;
                }
                await ref
                    .read(directorRepositoryProvider)
                    .respondToTask(_id(task), response.text.trim());
                if (!dialogContext.mounted) return;
                Navigator.pop(dialogContext);
                _refresh();
              },
              child: const Text('Submit Response'),
            ),
            FilledButton(
              onPressed: () async {
                await ref
                    .read(directorRepositoryProvider)
                    .closeTask(_id(task), 'COMPLETED', closeNote.text.trim());
                if (!dialogContext.mounted) return;
                Navigator.pop(dialogContext);
                _refresh();
              },
              child: const Text('Mark Completed'),
            ),
            FilledButton.tonal(
              onPressed: () async {
                await ref
                    .read(directorRepositoryProvider)
                    .closeTask(_id(task), 'DISMISSED', closeNote.text.trim());
                if (!dialogContext.mounted) return;
                Navigator.pop(dialogContext);
                _refresh();
              },
              child: const Text('Dismiss'),
            ),
          ],
        );
      },
    );
  }

  void _snack(String message, {bool error = false}) {
    if (!mounted) return;
    AppNotifier.showSnackBar(
        context,
        SnackBar(
          content: Text(message),
          backgroundColor: error ? AppColors.kError : AppColors.kSuccess,
        ));
  }
}

class _OverviewSection extends StatelessWidget {
  const _OverviewSection({
    required this.data,
    required this.startDate,
    required this.endDate,
    required this.branchId,
    required this.reportType,
    required this.onDateChanged,
    required this.onBranchChanged,
    required this.onReportTypeChanged,
    required this.onExport,
    required this.onRefresh,
    required this.onNavigate,
  });

  final _DirectorSnapshot data;
  final DateTime startDate;
  final DateTime endDate;
  final String? branchId;
  final String reportType;
  final void Function(DateTime, DateTime) onDateChanged;
  final ValueChanged<String?> onBranchChanged;
  final ValueChanged<String> onReportTypeChanged;
  final VoidCallback onExport;
  final VoidCallback onRefresh;
  final ValueChanged<DirectorSection> onNavigate;

  @override
  Widget build(BuildContext context) {
    final financial = _map(data.dashboard['financial']);
    final occupancy = _map(data.dashboard['occupancy']);
    final staff = _map(data.dashboard['staff']);
    final inventory = _map(data.dashboard['inventory']);
    final discrepancies = _map(data.dashboard['discrepancies']);
    final submissions = _rows(data.dashboard['submissions']);
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        _Header(
          title: 'Executive Dashboard',
          subtitle:
              'Full hotel oversight across finance, operations, HR, and audit.',
          actions: [
            _BranchPicker(
              branches: data.branches,
              value: branchId,
              onChanged: onBranchChanged,
            ),
            _DateRangeButton(
              start: startDate,
              end: endDate,
              onChanged: onDateChanged,
            ),
            DropdownButton<String>(
              value: reportType,
              items: const [
                DropdownMenuItem(
                    value: 'comprehensive', child: Text('Comprehensive')),
                DropdownMenuItem(value: 'financial', child: Text('Financial')),
                DropdownMenuItem(value: 'occupancy', child: Text('Occupancy')),
                DropdownMenuItem(value: 'staff', child: Text('Staff')),
              ],
              onChanged: (value) =>
                  onReportTypeChanged(value ?? 'comprehensive'),
            ),
            OutlinedButton.icon(
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Refresh'),
            ),
            FilledButton.icon(
              onPressed: onExport,
              icon: const Icon(Icons.picture_as_pdf_outlined, size: 16),
              label: const Text('Export PDF'),
            ),
          ],
        ),
        const SizedBox(height: 18),
        _MetricGrid(metrics: [
          _MetricData(
              'Total Revenue',
              _money(_num(financial, ['totalRevenue', 'total_revenue'])),
              Icons.trending_up,
              AppColors.kSuccess),
          _MetricData(
              'Net Profit',
              _money(_num(financial, ['netProfit', 'net_profit'])),
              Icons.attach_money,
              AppColors.kPrimary),
          _MetricData(
              'Occupancy Rate',
              '${_fmt(_num(occupancy, ['occupancyRate', 'occupancy_rate']))}%',
              Icons.bed_outlined,
              AppColors.kWarning),
          _MetricData(
              'Active Staff',
              _fmt(_num(staff, ['activeStaff', 'active_staff'])),
              Icons.groups_outlined,
              AppColors.kTextSecondary),
          _MetricData(
              'Total Expenses',
              _money(_num(financial, ['totalExpenses', 'total_expenses'])),
              Icons.south_east,
              AppColors.kError),
          _MetricData(
              'Inventory Value',
              _money(_num(inventory, ['totalValue', 'total_value'])),
              Icons.inventory_2_outlined,
              AppColors.kAccent),
          _MetricData(
              'Pending Flags',
              _fmt(_num(discrepancies, ['pendingFlags', 'pending_flags'])),
              Icons.warning_amber_outlined,
              AppColors.kWarning),
          _MetricData(
              'Low Stock Items',
              _fmt(_num(inventory, ['lowStockItems', 'low_stock_items'])),
              Icons.error_outline,
              AppColors.kError),
        ]),
        const SizedBox(height: 18),
        LayoutBuilder(builder: (context, constraints) {
          final twoCol = constraints.maxWidth > 900;
          final children = [
            _Panel(
              title: 'Payment Method Intelligence',
              child: _BreakdownBars(
                rows: _paymentRows(_map(data.payments['breakdown'])),
                total: _num(data.payments, ['total']),
              ),
            ),
            _Panel(
              title: 'Banking Reconciliation',
              action: TextButton(
                onPressed: () => onNavigate(DirectorSection.banking),
                child: const Text('Open'),
              ),
              child: _BankingSummary(data: data.banking),
            ),
          ];
          return Wrap(
            spacing: 16,
            runSpacing: 16,
            children: children
                .map((child) => SizedBox(
                    width: twoCol
                        ? (constraints.maxWidth - 16) / 2
                        : constraints.maxWidth,
                    child: child))
                .toList(),
          );
        }),
        const SizedBox(height: 18),
        _Panel(
          title: 'Status Overview',
          child: _StatusGrid(items: {
            'Profit Margin':
                '${_fmt(_num(financial, ['profitMargin', 'profit_margin']))}%',
            'Invoices Paid': _fmt(_num(financial, ['paidInvoices'])),
            'Rooms Occupied': '${_fmt(_num(occupancy, [
                  'occupiedRooms',
                  'occupied_rooms'
                ]))} / ${_fmt(_num(occupancy, ['totalRooms', 'total_rooms']))}',
            'Resolution Rate': '${_fmt(_num(discrepancies, [
                  'resolutionRate',
                  'resolution_rate'
                ]))}%',
            'Critical Flags': _fmt(_num(discrepancies, ['criticalFlags'])),
            'Low Stock': _fmt(_num(inventory, ['lowStockItems'])),
          }),
        ),
        const SizedBox(height: 18),
        _Panel(
          title: 'Branch Submission Tracking',
          child: _ResponsiveTable(
            rows: submissions,
            columns: const ['name', 'status', 'submissions', 'drafts'],
          ),
        ),
        const SizedBox(height: 18),
        _QuickActions(onNavigate: onNavigate),
      ],
    );
  }
}

class _PaymentSection extends StatelessWidget {
  const _PaymentSection({
    required this.data,
    required this.startDate,
    required this.endDate,
    required this.onDateChanged,
    required this.onRefresh,
  });

  final _DirectorSnapshot data;
  final DateTime startDate;
  final DateTime endDate;
  final void Function(DateTime, DateTime) onDateChanged;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final total = _num(data.payments, ['total']);
    final breakdown = _map(data.payments['breakdown']);
    final branchRows = _rows(data.payments['byBranch']);
    final dateRows = _rows(data.payments['byDate']);
    final rows = _paymentRows(breakdown);
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        _Header(
          title: 'Payment Intelligence',
          subtitle: 'Payment method breakdown and branch trends.',
          actions: [
            _DateRangeButton(
                start: startDate, end: endDate, onChanged: onDateChanged),
            IconButton.outlined(
                onPressed: onRefresh, icon: const Icon(Icons.refresh)),
          ],
        ),
        const SizedBox(height: 18),
        _MetricGrid(metrics: [
          _MetricData('Total Payments', _money(total), Icons.payments_outlined,
              AppColors.kPrimary),
          ...rows.take(4).map((row) => _MetricData(
                row.label,
                _money(row.value),
                Icons.credit_card_outlined,
                row.color,
              )),
        ]),
        const SizedBox(height: 18),
        _Panel(
          title: 'Payment Method Distribution',
          child: _BreakdownBars(rows: rows, total: total),
        ),
        const SizedBox(height: 18),
        _Panel(
          title: 'Branch Breakdown',
          child: Column(
            children: branchRows.map((branch) {
              final methods = _map(branch['methods']);
              return _BranchPaymentTile(
                branch: _text(branch, ['name'], fallback: 'Branch'),
                total: _num(branch, ['total']),
                rows: _paymentRows(methods),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 18),
        _Panel(
          title: 'Daily Trend',
          child: _ResponsiveTable(
              rows: dateRows, columns: const ['date', 'total']),
        ),
      ],
    );
  }
}

class _BankingSection extends StatelessWidget {
  const _BankingSection({
    required this.data,
    required this.startDate,
    required this.endDate,
    required this.onDateChanged,
    required this.onRefresh,
    required this.onDrill,
  });

  final _DirectorSnapshot data;
  final DateTime startDate;
  final DateTime endDate;
  final void Function(DateTime, DateTime) onDateChanged;
  final VoidCallback onRefresh;
  final ValueChanged<Map<String, dynamic>> onDrill;

  @override
  Widget build(BuildContext context) {
    final branches = _rows(data.banking['branches']);
    final totals = _map(data.banking['totals']);
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        _Header(
          title: 'Banking Control Panel',
          subtitle: 'Cross-branch cash-to-bank verification.',
          actions: [
            _DateRangeButton(
                start: startDate, end: endDate, onChanged: onDateChanged),
            IconButton.outlined(
                onPressed: onRefresh, icon: const Icon(Icons.refresh)),
          ],
        ),
        const SizedBox(height: 18),
        _MetricGrid(metrics: [
          _MetricData(
              'Expected Cash',
              _money(_num(totals, ['expectedCash', 'totalExpected'])),
              Icons.money_outlined,
              AppColors.kPrimary),
          _MetricData(
              'Banked',
              _money(_num(totals, ['totalBanked', 'reconciled'])),
              Icons.account_balance_outlined,
              AppColors.kSuccess),
          _MetricData(
              'Unbanked',
              _money(_num(totals, ['totalUnbanked', 'pending'])),
              Icons.warning_amber_outlined,
              AppColors.kWarning),
        ]),
        const SizedBox(height: 18),
        Wrap(
          spacing: 16,
          runSpacing: 16,
          children: branches
              .map((branch) => SizedBox(
                    width: 340,
                    child: _BankingBranchCard(
                      branch: branch,
                      onDrill: () => onDrill(branch),
                    ),
                  ))
              .toList(),
        ),
        const SizedBox(height: 18),
        _Panel(
          title: 'Branch Reconciliation Summary',
          child: _ResponsiveTable(
            rows: branches,
            columns: const [
              'name',
              'totalExpected',
              'totalBanked',
              'totalUnbanked',
              'pending',
              'discrepancyCount',
            ],
          ),
        ),
      ],
    );
  }
}

class _DiscrepanciesSection extends StatelessWidget {
  const _DiscrepanciesSection({
    required this.data,
    required this.status,
    required this.severity,
    required this.onStatusChanged,
    required this.onSeverityChanged,
    required this.onCreate,
    required this.onOpen,
    required this.onExport,
    required this.onRefresh,
  });

  final _DirectorSnapshot data;
  final String status;
  final String severity;
  final ValueChanged<String> onStatusChanged;
  final ValueChanged<String> onSeverityChanged;
  final VoidCallback onCreate;
  final ValueChanged<Map<String, dynamic>> onOpen;
  final VoidCallback onExport;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final flags = data.discrepancies;
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        _Header(
          title: 'Discrepancy Control',
          subtitle: 'Audit anomaly management and resolution workflow.',
          actions: [
            _smallSelect(
              value: status,
              options: const [
                '',
                'PENDING',
                'UNDER_REVIEW',
                'RESOLVED',
                'ESCALATED'
              ],
              fallbackLabel: 'All Statuses',
              onChanged: onStatusChanged,
            ),
            _smallSelect(
              value: severity,
              options: const ['', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
              fallbackLabel: 'All Severity',
              onChanged: onSeverityChanged,
            ),
            OutlinedButton.icon(
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Refresh'),
            ),
            FilledButton.icon(
              onPressed: onCreate,
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Create Flag'),
            ),
            FilledButton.tonalIcon(
              onPressed: onExport,
              icon: const Icon(Icons.picture_as_pdf_outlined, size: 16),
              label: const Text('Audit Report'),
            ),
          ],
        ),
        const SizedBox(height: 18),
        _MetricGrid(metrics: [
          _MetricData('Total Flags', '${flags.length}',
              Icons.report_problem_outlined, AppColors.kTextPrimary),
          _MetricData(
              'Pending',
              '${flags.where((f) => _text(f, ['status']) == 'PENDING').length}',
              Icons.schedule_outlined,
              AppColors.kError),
          _MetricData(
              'Under Review',
              '${flags.where((f) => _text(f, [
                        'status'
                      ]) == 'UNDER_REVIEW').length}',
              Icons.forum_outlined,
              AppColors.kWarning),
          _MetricData(
              'Resolved',
              '${flags.where((f) => _text(f, [
                        'status'
                      ]) == 'RESOLVED').length}',
              Icons.check_circle_outline,
              AppColors.kSuccess),
        ]),
        const SizedBox(height: 18),
        if (flags.isEmpty)
          const _EmptyPanel(
            icon: Icons.verified_outlined,
            title: 'System is clean',
            message: 'No discrepancies match the active filters.',
          )
        else
          ...flags.map((flag) => _FlagCard(flag: flag, onOpen: onOpen)),
      ],
    );
  }
}

class _DrillDownSection extends StatelessWidget {
  const _DrillDownSection({
    required this.branches,
    required this.selectedBranch,
    required this.selectedDate,
    required this.selectedStream,
    required this.dateRangeDays,
    required this.search,
    required this.drillFuture,
    required this.streams,
    required this.onSearchChanged,
    required this.onDateRangeChanged,
    required this.onBranchSelected,
    required this.onDateSelected,
    required this.onStreamSelected,
    required this.onReset,
    required this.onRefresh,
    required this.onExportCsv,
    required this.onAssignTask,
  });

  final List<Map<String, dynamic>> branches;
  final Map<String, dynamic>? selectedBranch;
  final DateTime? selectedDate;
  final String? selectedStream;
  final int dateRangeDays;
  final String search;
  final Future<Map<String, dynamic>>? drillFuture;
  final List<String> streams;
  final ValueChanged<String> onSearchChanged;
  final ValueChanged<int> onDateRangeChanged;
  final ValueChanged<Map<String, dynamic>> onBranchSelected;
  final ValueChanged<DateTime> onDateSelected;
  final ValueChanged<String> onStreamSelected;
  final ValueChanged<String> onReset;
  final VoidCallback onRefresh;
  final VoidCallback onExportCsv;
  final ValueChanged<Map<String, dynamic>> onAssignTask;

  @override
  Widget build(BuildContext context) {
    final level = selectedBranch == null
        ? 'company'
        : selectedDate == null
            ? 'branch'
            : selectedStream == null
                ? 'date'
                : 'stream';
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        _Header(
          title: 'Deep Drill-Down',
          subtitle: 'Company -> branch -> date -> transaction stream.',
          actions: [
            if (level == 'branch')
              _smallSelect(
                value: '$dateRangeDays',
                options: const ['7', '14', '30', '60', '90'],
                fallbackLabel: '30',
                onChanged: (value) => onDateRangeChanged(int.parse(value)),
              ),
            if (level == 'stream') ...[
              OutlinedButton.icon(
                onPressed: onRefresh,
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Refresh'),
              ),
              FilledButton.icon(
                onPressed: onExportCsv,
                icon: const Icon(Icons.download, size: 16),
                label: const Text('Export CSV'),
              ),
            ],
          ],
        ),
        const SizedBox(height: 12),
        _Breadcrumbs(
          branch: selectedBranch,
          date: selectedDate,
          stream: selectedStream,
          onReset: onReset,
        ),
        const SizedBox(height: 12),
        TextField(
          onChanged: onSearchChanged,
          decoration: const InputDecoration(
            prefixIcon: Icon(Icons.search),
            hintText: 'Search current level...',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 18),
        if (level == 'company')
          _DrillCardGrid(
            rows: branches
                .where((b) => _text(b, ['name'])
                    .toLowerCase()
                    .contains(search.toLowerCase()))
                .toList(),
            icon: Icons.apartment_outlined,
            subtitle: 'Branch View',
            onTap: onBranchSelected,
          )
        else if (level == 'branch')
          _DateGrid(
            days: dateRangeDays,
            search: search,
            onTap: onDateSelected,
          )
        else if (level == 'date')
          _StreamGrid(streams: streams, onTap: onStreamSelected)
        else
          FutureBuilder<Map<String, dynamic>>(
            future: drillFuture,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Padding(
                  padding: EdgeInsets.all(40),
                  child: Center(child: CircularProgressIndicator()),
                );
              }
              if (snapshot.hasError) {
                return ErrorState(message: '${snapshot.error}');
              }
              final data = snapshot.data ?? const {};
              if (data['hasRecord'] == false) {
                return const _EmptyPanel(
                  icon: Icons.storage_outlined,
                  title: 'No financial record found',
                  message: 'This branch/date has no financial record.',
                );
              }
              final rows = _rows(data['rows']);
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _MetricGrid(metrics: [
                    _MetricData('Branch', _text(data, ['branchName']),
                        Icons.apartment_outlined, AppColors.kPrimary),
                    _MetricData('Date', _text(data, ['date']),
                        Icons.calendar_month_outlined, AppColors.kAccent),
                    _MetricData(
                        'Total Revenue',
                        _money(_num(data, ['totalRevenue'])),
                        Icons.trending_up,
                        AppColors.kSuccess),
                    _MetricData('Net Profit', _money(_num(data, ['netProfit'])),
                        Icons.attach_money, AppColors.kPrimary),
                    _MetricData(
                        'Status',
                        _pretty(_text(data, ['recordStatus'])),
                        Icons.fact_check_outlined,
                        AppColors.kWarning),
                  ]),
                  const SizedBox(height: 18),
                  Align(
                    alignment: Alignment.centerRight,
                    child: FilledButton.icon(
                      onPressed: () => onAssignTask({
                        'branch': selectedBranch,
                        'date': selectedDate,
                        'stream': selectedStream,
                        'summary': data['summary'],
                      }),
                      icon: const Icon(Icons.flag_outlined, size: 16),
                      label: const Text('Flag for Review'),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _Panel(
                    title: selectedStream ?? 'Stream',
                    child: _ResponsiveTable(
                      rows: rows,
                      columns: _columnsFor(selectedStream, rows),
                    ),
                  ),
                ],
              );
            },
          ),
      ],
    );
  }
}

class _TasksSection extends StatelessWidget {
  const _TasksSection({
    required this.data,
    required this.status,
    required this.priority,
    required this.assignedRole,
    required this.onStatusChanged,
    required this.onPriorityChanged,
    required this.onRoleChanged,
    required this.onOpen,
    required this.onRefresh,
  });

  final _DirectorSnapshot data;
  final String status;
  final String priority;
  final String assignedRole;
  final ValueChanged<String> onStatusChanged;
  final ValueChanged<String> onPriorityChanged;
  final ValueChanged<String> onRoleChanged;
  final ValueChanged<Map<String, dynamic>> onOpen;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final tasks = data.tasks;
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        _Header(
          title: 'Director Review Tasks',
          subtitle:
              'Assignments issued to branches, auditors, HR, and finance.',
          actions: [
            _smallSelect(
              value: status,
              options: const [
                '',
                'PENDING',
                'IN_PROGRESS',
                'COMPLETED',
                'DISMISSED'
              ],
              fallbackLabel: 'All Statuses',
              onChanged: onStatusChanged,
            ),
            _smallSelect(
              value: priority,
              options: const ['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
              fallbackLabel: 'All Priorities',
              onChanged: onPriorityChanged,
            ),
            _smallSelect(
              value: assignedRole,
              options: const [
                '',
                'branch_accountant',
                'auditor',
                'hr_manager',
                'branch_manager',
                'general_manager',
              ],
              fallbackLabel: 'All Roles',
              onChanged: onRoleChanged,
            ),
            IconButton.outlined(
                onPressed: onRefresh, icon: const Icon(Icons.refresh)),
          ],
        ),
        const SizedBox(height: 18),
        _MetricGrid(metrics: [
          _MetricData('Total Tasks', '${tasks.length}', Icons.task_alt_outlined,
              AppColors.kTextPrimary),
          _MetricData(
              'Pending',
              '${tasks.where((t) => _text(t, ['status']) == 'PENDING').length}',
              Icons.schedule_outlined,
              AppColors.kError),
          _MetricData(
              'In Progress',
              '${tasks.where((t) => _text(t, [
                        'status'
                      ]) == 'IN_PROGRESS').length}',
              Icons.forum_outlined,
              AppColors.kWarning),
          _MetricData(
              'Completed',
              '${tasks.where((t) => _text(t, [
                        'status'
                      ]) == 'COMPLETED').length}',
              Icons.check_circle_outline,
              AppColors.kSuccess),
          _MetricData(
              'Critical',
              '${tasks.where((t) => _text(t, [
                        'priority'
                      ]) == 'CRITICAL').length}',
              Icons.priority_high_outlined,
              AppColors.kError),
        ]),
        const SizedBox(height: 18),
        if (tasks.isEmpty)
          const _EmptyPanel(
            icon: Icons.task_alt_outlined,
            title: 'No tasks found',
            message: 'Assign review tasks from the Drill-Down page.',
          )
        else
          ...tasks.map((task) => _TaskCard(task: task, onOpen: onOpen)),
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.title,
    required this.subtitle,
    this.actions = const [],
  });

  final String title;
  final String subtitle;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      crossAxisAlignment: WrapCrossAlignment.center,
      alignment: WrapAlignment.spaceBetween,
      children: [
        SizedBox(
          width: 420,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 4),
              Text(subtitle,
                  style: const TextStyle(color: AppColors.kTextSecondary)),
            ],
          ),
        ),
        Wrap(spacing: 8, runSpacing: 8, children: actions),
      ],
    );
  }
}

class _MetricGrid extends StatelessWidget {
  const _MetricGrid({required this.metrics});
  final List<_MetricData> metrics;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: metrics.map((metric) => _MetricCard(metric)).toList(),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard(this.metric);
  final _MetricData metric;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 218,
      child: Card(
        elevation: 0,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(metric.icon, color: metric.color),
              const SizedBox(height: 10),
              Text(
                metric.value,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style:
                    const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 4),
              Text(metric.label,
                  style: const TextStyle(color: AppColors.kTextSecondary)),
            ],
          ),
        ),
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.title, required this.child, this.action});
  final String title;
  final Widget child;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                    child: Text(title,
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w800))),
                if (action != null) action!,
              ],
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _BreakdownBars extends StatelessWidget {
  const _BreakdownBars({required this.rows, required this.total});
  final List<_BreakdownRow> rows;
  final double total;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty || total <= 0) {
      return const Text('No payment data available',
          style: TextStyle(color: AppColors.kTextSecondary));
    }
    return Column(
      children: rows.map((row) {
        final pct = total <= 0 ? 0.0 : (row.value / total).clamp(0.0, 1.0);
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                      child: Text(row.label,
                          style: const TextStyle(fontWeight: FontWeight.w700))),
                  Text('${(pct * 100).toStringAsFixed(1)}%'),
                  const SizedBox(width: 12),
                  SizedBox(width: 130, child: Text(_money(row.value))),
                ],
              ),
              const SizedBox(height: 6),
              LinearProgressIndicator(
                value: pct,
                minHeight: 8,
                borderRadius: BorderRadius.circular(999),
                color: row.color,
                backgroundColor: row.color.withValues(alpha: 0.12),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _BankingSummary extends StatelessWidget {
  const _BankingSummary({required this.data});
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final totals = _map(data['totals']);
    return Column(
      children: [
        _StatusGrid(items: {
          'Expected Cash': _money(_num(totals, ['expectedCash'])),
          'Total Banked': _money(_num(totals, ['totalBanked'])),
          'Total Unbanked': _money(_num(totals, ['totalUnbanked'])),
          'Branches': '${_rows(data['branches']).length}',
        }),
      ],
    );
  }
}

class _StatusGrid extends StatelessWidget {
  const _StatusGrid({required this.items});
  final Map<String, String> items;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: items.entries
          .map((entry) => Container(
                width: 210,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.kSurface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.kDivider),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(entry.key,
                        style: const TextStyle(
                            color: AppColors.kTextSecondary, fontSize: 12)),
                    const SizedBox(height: 4),
                    Text(entry.value,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 16)),
                  ],
                ),
              ))
          .toList(),
    );
  }
}

class _ResponsiveTable extends StatelessWidget {
  const _ResponsiveTable({required this.rows, required this.columns});
  final List<Map<String, dynamic>> rows;
  final List<String> columns;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) {
      return const Text('No records found',
          style: TextStyle(color: AppColors.kTextSecondary));
    }
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        columns:
            columns.map((c) => DataColumn(label: Text(_pretty(c)))).toList(),
        rows: rows
            .map(
              (row) => DataRow(
                cells: columns
                    .map((c) => DataCell(Text(_cellValue(row[c]))))
                    .toList(),
              ),
            )
            .toList(),
      ),
    );
  }
}

class _BranchPaymentTile extends StatelessWidget {
  const _BranchPaymentTile({
    required this.branch,
    required this.total,
    required this.rows,
  });
  final String branch;
  final double total;
  final List<_BreakdownRow> rows;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.kDivider),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                  child: Text(branch,
                      style: const TextStyle(fontWeight: FontWeight.w800))),
              Text(_money(total)),
            ],
          ),
          const SizedBox(height: 8),
          _BreakdownBars(rows: rows, total: total),
        ],
      ),
    );
  }
}

class _BankingBranchCard extends StatelessWidget {
  const _BankingBranchCard({required this.branch, required this.onDrill});
  final Map<String, dynamic> branch;
  final VoidCallback onDrill;

  @override
  Widget build(BuildContext context) {
    final variance = _num(branch, ['totalUnbanked', 'pending']);
    final flagged = variance > 1000;
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: flagged ? AppColors.kError : AppColors.kDivider,
          width: flagged ? 1.5 : 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.apartment_outlined,
                    color: flagged ? AppColors.kError : AppColors.kPrimary),
                const SizedBox(width: 8),
                Expanded(
                    child: Text(_text(branch, ['name'], fallback: 'Branch'),
                        style: const TextStyle(fontWeight: FontWeight.w800))),
                if (flagged)
                  const Chip(
                    label: Text('FLAGGED'),
                    visualDensity: VisualDensity.compact,
                  ),
              ],
            ),
            const SizedBox(height: 14),
            _kv('Collected Cash',
                _money(_num(branch, ['totalExpected', 'expectedCash']))),
            _kv('Banked Amount',
                _money(_num(branch, ['totalBanked', 'reconciled']))),
            _kv('Variance', _money(variance),
                valueColor: flagged ? AppColors.kError : AppColors.kSuccess),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: onDrill,
                icon: const Icon(Icons.arrow_forward, size: 16),
                label: const Text('Drill Down'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FlagCard extends StatelessWidget {
  const _FlagCard({required this.flag, required this.onOpen});
  final Map<String, dynamic> flag;
  final ValueChanged<Map<String, dynamic>> onOpen;

  @override
  Widget build(BuildContext context) {
    final severity = _text(flag, ['severity'], fallback: 'LOW');
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: _severityColor(severity).withValues(alpha: 0.12),
          child: Icon(Icons.warning_amber_outlined,
              color: _severityColor(severity)),
        ),
        title: Text(_pretty(_text(flag, ['flag_type'], fallback: 'Flag')),
            style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text(
          '${_nestedText(flag, 'branches', 'name')} • $severity • ${_pretty(_text(flag, [
                'status'
              ]))}\n${_text(flag, ['description'])}',
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        isThreeLine: true,
        trailing: IconButton(
          icon: const Icon(Icons.more_horiz),
          onPressed: () => onOpen(flag),
        ),
      ),
    );
  }
}

class _TaskCard extends StatelessWidget {
  const _TaskCard({required this.task, required this.onOpen});
  final Map<String, dynamic> task;
  final ValueChanged<Map<String, dynamic>> onOpen;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        onTap: () => onOpen(task),
        leading: CircleAvatar(
          backgroundColor:
              _priorityColor(_text(task, ['priority'])).withValues(alpha: 0.12),
          child: Icon(Icons.priority_high_outlined,
              color: _priorityColor(_text(task, ['priority']))),
        ),
        title: Text(_text(task, ['title'], fallback: 'Review task'),
            style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text(
          '${_pretty(_text(task, ['status']))} • ${_pretty(_text(task, [
                'assigned_to_role'
              ]))} • ${_nestedText(task, 'branches', 'name')}\n${_text(task, [
                'description'
              ])}',
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        isThreeLine: true,
        trailing: Text(_text(task, ['due_date'])),
      ),
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.onNavigate});
  final ValueChanged<DirectorSection> onNavigate;

  @override
  Widget build(BuildContext context) {
    const actions = [
      MapEntry(DirectorSection.payments, 'Payment Intelligence'),
      MapEntry(DirectorSection.banking, 'Banking Control'),
      MapEntry(DirectorSection.discrepancies, 'Discrepancy Control'),
      MapEntry(DirectorSection.drillDown, 'Deep Drill-Down'),
      MapEntry(DirectorSection.tasks, 'Review Tasks'),
      MapEntry(DirectorSection.auditor, 'Auditor Portal'),
      MapEntry(DirectorSection.hr, 'HR Dashboard'),
      MapEntry(DirectorSection.branchAccounting, 'Branch Accounting'),
    ];
    return _Panel(
      title: 'Quick Actions and Connected Departments',
      child: Wrap(
        spacing: 10,
        runSpacing: 10,
        children: actions
            .map((entry) => OutlinedButton(
                  onPressed: () => onNavigate(entry.key),
                  child: Text(entry.value),
                ))
            .toList(),
      ),
    );
  }
}

class _Breadcrumbs extends StatelessWidget {
  const _Breadcrumbs({
    required this.branch,
    required this.date,
    required this.stream,
    required this.onReset,
  });
  final Map<String, dynamic>? branch;
  final DateTime? date;
  final String? stream;
  final ValueChanged<String> onReset;

  @override
  Widget build(BuildContext context) {
    final crumbs = <MapEntry<String, String>>[
      const MapEntry('company', 'Famous Gate Hotels'),
      if (branch != null) MapEntry('branch', _text(branch, ['name'])),
      if (date != null) MapEntry('date', _date(date!)),
      if (stream != null) MapEntry('stream', stream!),
    ];
    return Wrap(
      spacing: 8,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        for (final crumb in crumbs) ...[
          TextButton(
            onPressed: () => onReset(crumb.key),
            child: Text(crumb.value),
          ),
          if (crumb != crumbs.last) const Icon(Icons.chevron_right, size: 16),
        ],
      ],
    );
  }
}

class _DrillCardGrid extends StatelessWidget {
  const _DrillCardGrid({
    required this.rows,
    required this.icon,
    required this.subtitle,
    required this.onTap,
  });
  final List<Map<String, dynamic>> rows;
  final IconData icon;
  final String subtitle;
  final ValueChanged<Map<String, dynamic>> onTap;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) {
      return const _EmptyPanel(
        icon: Icons.search_off,
        title: 'No branches found',
        message: 'Adjust the search and try again.',
      );
    }
    return Wrap(
      spacing: 14,
      runSpacing: 14,
      children: rows
          .map(
            (row) => _DrillCard(
              icon: icon,
              title: _text(row, ['name'], fallback: 'Branch'),
              subtitle: subtitle,
              onTap: () => onTap(row),
            ),
          )
          .toList(),
    );
  }
}

class _DateGrid extends StatelessWidget {
  const _DateGrid({
    required this.days,
    required this.search,
    required this.onTap,
  });
  final int days;
  final String search;
  final ValueChanged<DateTime> onTap;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final dates = List.generate(days, (i) {
      final d = now.subtract(Duration(days: i));
      return DateTime(d.year, d.month, d.day);
    }).where((d) => _date(d).contains(search)).toList();
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: dates
          .map((date) => _DrillCard(
                icon: Icons.calendar_month_outlined,
                title: _date(date),
                subtitle: 'Daily Record',
                onTap: () => onTap(date),
                small: true,
              ))
          .toList(),
    );
  }
}

class _StreamGrid extends StatelessWidget {
  const _StreamGrid({required this.streams, required this.onTap});
  final List<String> streams;
  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 14,
      runSpacing: 14,
      children: streams
          .map((stream) => _DrillCard(
                icon: _streamIcon(stream),
                title: stream,
                subtitle: 'Data Layer',
                onTap: () => onTap(stream),
              ))
          .toList(),
    );
  }
}

class _DrillCard extends StatelessWidget {
  const _DrillCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.small = false,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final bool small;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: small ? 170 : 260,
      child: Card(
        elevation: 0,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: EdgeInsets.all(small ? 14 : 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, color: AppColors.kPrimary),
                const SizedBox(height: 12),
                Text(subtitle,
                    style: const TextStyle(
                        color: AppColors.kTextSecondary, fontSize: 12)),
                const SizedBox(height: 4),
                Text(title,
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                const Row(
                  children: [
                    Text('Explore',
                        style: TextStyle(
                            color: AppColors.kPrimary,
                            fontWeight: FontWeight.w700)),
                    Icon(Icons.arrow_forward,
                        color: AppColors.kPrimary, size: 14),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _EmptyPanel extends StatelessWidget {
  const _EmptyPanel({
    required this.icon,
    required this.title,
    required this.message,
  });
  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(36),
        child: Center(
          child: Column(
            children: [
              Icon(icon, color: AppColors.kTextSecondary, size: 42),
              const SizedBox(height: 12),
              Text(title,
                  style: const TextStyle(
                      fontWeight: FontWeight.w800, fontSize: 16)),
              const SizedBox(height: 4),
              Text(message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.kTextSecondary)),
            ],
          ),
        ),
      ),
    );
  }
}

class _BranchPicker extends StatelessWidget {
  const _BranchPicker({
    required this.branches,
    required this.value,
    required this.onChanged,
  });
  final List<Map<String, dynamic>> branches;
  final String? value;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButton<String>(
      value: value,
      hint: const Text('All Branches'),
      items: [
        const DropdownMenuItem<String>(
            value: null, child: Text('All Branches')),
        ...branches.map((b) => DropdownMenuItem<String>(
              value: _id(b),
              child: Text(_text(b, ['name'])),
            )),
      ],
      onChanged: onChanged,
    );
  }
}

class _DateRangeButton extends StatelessWidget {
  const _DateRangeButton({
    required this.start,
    required this.end,
    required this.onChanged,
  });
  final DateTime start;
  final DateTime end;
  final void Function(DateTime, DateTime) onChanged;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: () async {
        final range = await showDateRangePicker(
          context: context,
          firstDate: DateTime(2020),
          lastDate: DateTime.now().add(const Duration(days: 365)),
          initialDateRange: DateTimeRange(start: start, end: end),
        );
        if (range != null) onChanged(range.start, range.end);
      },
      icon: const Icon(Icons.date_range_outlined, size: 16),
      label: Text('${_date(start)} - ${_date(end)}'),
    );
  }
}

class _DirectorSnapshot {
  const _DirectorSnapshot({
    required this.dashboard,
    required this.branches,
    required this.payments,
    required this.banking,
    required this.discrepancies,
    required this.tasks,
  });

  factory _DirectorSnapshot.empty() => const _DirectorSnapshot(
        dashboard: {},
        branches: [],
        payments: {},
        banking: {},
        discrepancies: [],
        tasks: [],
      );

  final Map<String, dynamic> dashboard;
  final List<Map<String, dynamic>> branches;
  final Map<String, dynamic> payments;
  final Map<String, dynamic> banking;
  final List<Map<String, dynamic>> discrepancies;
  final List<Map<String, dynamic>> tasks;
}

class _MetricData {
  const _MetricData(this.label, this.value, this.icon, this.color);
  final String label;
  final String value;
  final IconData icon;
  final Color color;
}

class _BreakdownRow {
  const _BreakdownRow(this.label, this.value, this.color);
  final String label;
  final double value;
  final Color color;
}

Widget _smallSelect({
  required String value,
  required List<String> options,
  required String fallbackLabel,
  required ValueChanged<String> onChanged,
}) {
  return DropdownButton<String>(
    value: value,
    hint: Text(fallbackLabel),
    items: options
        .map((o) => DropdownMenuItem<String>(
              value: o,
              child: Text(o.isEmpty ? fallbackLabel : _pretty(o)),
            ))
        .toList(),
    onChanged: (value) => onChanged(value ?? ''),
  );
}

Widget _selectField({
  required String label,
  required String value,
  required List<MapEntry<String, String>> options,
  required ValueChanged<String> onChanged,
}) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: DropdownButtonFormField<String>(
      initialValue: value.isEmpty ? null : value,
      decoration: InputDecoration(labelText: label),
      items: options
          .map((option) => DropdownMenuItem<String>(
                value: option.key,
                child: Text(option.value),
              ))
          .toList(),
      onChanged: (value) {
        if (value != null) onChanged(value);
      },
    ),
  );
}

Widget _detailGrid(Map<String, String> items) {
  return Wrap(
    spacing: 12,
    runSpacing: 12,
    children: items.entries
        .map((entry) => SizedBox(
              width: 180,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(entry.key,
                      style: const TextStyle(
                          color: AppColors.kTextSecondary, fontSize: 12)),
                  Text(entry.value.isEmpty ? '-' : entry.value,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                ],
              ),
            ))
        .toList(),
  );
}

Widget _noteBlock(String label, String value) {
  return Container(
    width: double.infinity,
    margin: const EdgeInsets.only(top: 10),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: AppColors.kSurface,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: AppColors.kDivider),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                color: AppColors.kTextSecondary, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text(value),
      ],
    ),
  );
}

Widget _kv(String label, String value, {Color? valueColor}) {
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(
      children: [
        Expanded(
            child: Text(label,
                style: const TextStyle(color: AppColors.kTextSecondary))),
        Text(value,
            style: TextStyle(fontWeight: FontWeight.w800, color: valueColor)),
      ],
    ),
  );
}

Map<String, dynamic> _payload(dynamic value) {
  final map = _map(value);
  return _map(map['data'] ?? map);
}

Map<String, dynamic> _map(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return {};
}

List<Map<String, dynamic>> _rows(dynamic value) {
  if (value is List) {
    return value
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }
  if (value is Map) {
    return _rows(value['data'] ?? value['items'] ?? value['rows'] ?? []);
  }
  return [];
}

String _id(dynamic value) => _text(value, ['id']);

String _text(dynamic value, List<String> keys, {String fallback = ''}) {
  final map = _map(value);
  for (final key in keys) {
    final raw = map[key];
    if (raw != null && '$raw'.isNotEmpty) return '$raw';
  }
  return fallback;
}

String _nestedText(Map<String, dynamic> map, String parent, String key) {
  return _text(_map(map[parent]), [key]);
}

double _num(Map<String, dynamic> map, List<String> keys) {
  for (final key in keys) {
    final raw = map[key];
    if (raw is num) return raw.toDouble();
    final parsed = double.tryParse('$raw');
    if (parsed != null) return parsed;
  }
  return 0;
}

String _fmt(num value) {
  final text = value.toStringAsFixed(value.truncateToDouble() == value ? 0 : 2);
  return text.replaceAllMapped(
    RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
    (match) => '${match[1]},',
  );
}

String _money(num value) => 'KES ${_fmt(value)}';

String _date(DateTime value) {
  return '${value.year}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
}

String _pretty(String value) {
  if (value.isEmpty) return '-';
  return value
      .replaceAll('_', ' ')
      .split(' ')
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1).toLowerCase())
      .join(' ');
}

String _cellValue(dynamic value) {
  if (value is num) return _fmt(value);
  if (value is Map) return value.values.join(' ');
  if (value is List) return '${value.length} items';
  return '${value ?? '-'}';
}

List<_BreakdownRow> _paymentRows(Map<String, dynamic> breakdown) {
  final colors = [
    AppColors.kPrimary,
    AppColors.kSuccess,
    AppColors.kWarning,
    AppColors.kAccent,
    AppColors.kError,
    AppColors.kTextSecondary,
  ];
  final labels = {
    'mpesa': 'M-PESA',
    'cash': 'Cash',
    'card': 'Card',
    'swipe': 'Swipe / Card',
    'bank_transfer': 'Bank Transfer',
    'other': 'Other',
  };
  var i = 0;
  return breakdown.entries
      .map((entry) {
        final value = entry.value is num
            ? (entry.value as num).toDouble()
            : double.tryParse('${entry.value}') ?? 0;
        final row = _BreakdownRow(labels[entry.key] ?? _pretty(entry.key),
            value, colors[i++ % colors.length]);
        return row;
      })
      .where((row) => row.value > 0)
      .toList();
}

List<String> _columnsFor(String? stream, List<Map<String, dynamic>> rows) {
  final lower = (stream ?? '').toLowerCase();
  if (lower.contains('revenue')) {
    return const ['stream', 'amount', 'percentage'];
  }
  if (lower.contains('payment')) return const ['method', 'amount'];
  if (lower.contains('expense')) return const ['category', 'amount'];
  if (lower.contains('audit')) {
    return const ['flag_type', 'severity', 'status', 'description'];
  }
  if (lower.contains('bank')) {
    return const ['amount', 'account', 'reference', 'method', 'time'];
  }
  return rows.isEmpty ? const [] : rows.first.keys.take(6).toList();
}

IconData _streamIcon(String stream) {
  final lower = stream.toLowerCase();
  if (lower.contains('payment')) return Icons.credit_card_outlined;
  if (lower.contains('expense')) return Icons.bar_chart_outlined;
  if (lower.contains('audit')) return Icons.warning_amber_outlined;
  if (lower.contains('bank')) return Icons.account_balance_outlined;
  return Icons.trending_up;
}

Color _severityColor(String severity) {
  switch (severity) {
    case 'CRITICAL':
      return AppColors.kError;
    case 'HIGH':
      return Colors.deepOrange;
    case 'MEDIUM':
      return AppColors.kWarning;
    default:
      return AppColors.kPrimary;
  }
}

Color _priorityColor(String priority) {
  switch (priority) {
    case 'CRITICAL':
      return AppColors.kError;
    case 'HIGH':
      return Colors.deepOrange;
    case 'MEDIUM':
      return AppColors.kWarning;
    default:
      return AppColors.kPrimary;
  }
}
