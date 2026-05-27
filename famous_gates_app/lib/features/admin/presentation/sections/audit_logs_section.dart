import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../domain/admin_providers.dart';
import '../widgets/stat_card.dart';
import '../widgets/admin_table.dart';

class AuditLogsSection extends ConsumerStatefulWidget {
  const AuditLogsSection({super.key});

  @override
  ConsumerState<AuditLogsSection> createState() => _AuditLogsSectionState();
}

class _AuditLogsSectionState extends ConsumerState<AuditLogsSection> {
  int _selectedTab = 0;
  String? _selectedSeverity;
  String? _selectedAction;
  final _searchController = TextEditingController();
  DateTime? _startDate;
  DateTime? _endDate;

  final _tabs = ['All Logs', 'Critical Actions', 'System Logs'];
  final _severities = ['All', 'critical', 'high', 'medium', 'low', 'info'];
  final _actionTypes = [
    'All',
    'LOGIN',
    'LOGOUT',
    'CREATE',
    'UPDATE',
    'DELETE',
    'EXPORT'
  ];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final logsAsync = ref.watch(adminAuditLogsProvider);
    final dashboardAsync = ref.watch(adminDashboardProvider);

    return AsyncValueWidget(
      value: dashboardAsync,
      data: (dashboard) {
        return logsAsync.when(
          loading: () => const TabbedSkeleton(tabCount: 3),
          error: (err, _) => ErrorState(
            message: '$err',
            onRetry: () {
              ref.invalidate(adminAuditLogsProvider);
              ref.invalidate(adminDashboardProvider);
            },
          ),
          data: (logs) {
            final filtered = _filterLogs(logs);

            return RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(adminAuditLogsProvider);
                ref.invalidate(adminDashboardProvider);
              },
              child: Column(
                children: [
                  _buildTabBar(),
                  Expanded(
                    child: SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildStatCards(dashboard),
                          const SizedBox(height: 24),
                          _buildFilters(),
                          const SizedBox(height: 20),
                          _buildActionButtons(),
                          const SizedBox(height: 20),
                          if (filtered.isEmpty)
                            EmptyState(
                                message: 'No audit logs found',
                                icon: PhosphorIcons.shield())
                          else
                            _buildLogsTable(filtered),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
      loading: const LoadingSkeleton(type: SkeletonType.table),
      errorMessage: (err) => '$err',
    );
  }

  List<dynamic> _filterLogs(List<dynamic> logs) {
    var filtered = List<dynamic>.from(logs);

    if (_selectedTab == 1) {
      filtered = filtered
          .where((l) => l.severity == 'critical' || l.severity == 'high')
          .toList();
    } else if (_selectedTab == 2) {
      filtered = filtered
          .where((l) => l.severity == 'info' || l.severity == 'low')
          .toList();
    }

    if (_selectedSeverity != null && _selectedSeverity != 'All') {
      filtered =
          filtered.where((l) => l.severity == _selectedSeverity).toList();
    }
    if (_selectedAction != null && _selectedAction != 'All') {
      filtered = filtered
          .where((l) => l.action.toUpperCase() == _selectedAction)
          .toList();
    }
    if (_searchController.text.isNotEmpty) {
      final q = _searchController.text.toLowerCase();
      filtered = filtered.where((l) {
        return l.userName.toLowerCase().contains(q) ||
            l.action.toLowerCase().contains(q) ||
            l.ipAddress.contains(q);
      }).toList();
    }
    return filtered;
  }

  Widget _buildTabBar() {
    return Container(
      color: AppColors.kCardBg,
      child: Row(
        children: _tabs.asMap().entries.map((e) {
          final isSelected = e.key == _selectedTab;
          return Expanded(
            child: InkWell(
              onTap: () => setState(() => _selectedTab = e.key),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 16),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      width: 2,
                      color:
                          isSelected ? AppColors.kPrimary : Colors.transparent,
                    ),
                  ),
                ),
                child: Center(
                  child: Text(
                    e.value,
                    style: TextStyle(
                      fontWeight:
                          isSelected ? FontWeight.w600 : FontWeight.normal,
                      color: isSelected
                          ? AppColors.kPrimary
                          : AppColors.kTextSecondary,
                    ),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildStatCards(dynamic dashboard) {
    final stats = [
      AdminStatCard(
        label: 'Total Events',
        value: '${dashboard.loginsToday + dashboard.failedLogins + 50}',
        icon: PhosphorIcons.listBullets(),
        color: AppColors.kPrimary,
      ),
      AdminStatCard(
        label: 'Critical',
        value: '${dashboard.failedLogins}',
        icon: PhosphorIcons.warning(),
        color: AppColors.kError,
      ),
      AdminStatCard(
        label: 'Warnings',
        value: '${dashboard.securityAlerts}',
        icon: PhosphorIcons.warning(),
        color: AppColors.kWarning,
      ),
      AdminStatCard(
        label: 'Info',
        value: '${dashboard.loginsToday}',
        icon: PhosphorIcons.info(),
        color: AppColors.kSuccess,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final isMobile = constraints.maxWidth < 768;
        final crossAxisCount = isMobile ? 2 : 4;
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: crossAxisCount,
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
            childAspectRatio: isMobile ? 1.6 : 2.4,
          ),
          itemCount: stats.length,
          itemBuilder: (_, i) => stats[i],
        );
      },
    );
  }

  Widget _buildFilters() {
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
            GestureDetector(
              onTap: () => _pickDateRange(context),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.kDivider),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(PhosphorIcons.calendar(),
                        size: 18, color: AppColors.kTextSecondary),
                    const SizedBox(width: 8),
                    Text(
                      _startDate != null
                          ? '${_startDate!.day}/${_startDate!.month} - ${_endDate!.day}/${_endDate!.month}'
                          : 'Date Range',
                      style: const TextStyle(color: AppColors.kTextSecondary),
                    ),
                  ],
                ),
              ),
            ),
            SizedBox(
              width: 150,
              child: DropdownButtonFormField<String>(
                initialValue: _selectedAction,
                decoration: const InputDecoration(
                  labelText: 'Action Type',
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                items: _actionTypes
                    .map((a) => DropdownMenuItem(
                        value: a == 'All' ? null : a, child: Text(a)))
                    .toList(),
                onChanged: (v) => setState(() => _selectedAction = v),
              ),
            ),
            SizedBox(
              width: 150,
              child: DropdownButtonFormField<String>(
                initialValue: _selectedSeverity,
                decoration: const InputDecoration(
                  labelText: 'Severity',
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                items: _severities
                    .map((s) => DropdownMenuItem(
                        value: s == 'All' ? null : s,
                        child: Text(s[0].toUpperCase() + s.substring(1))))
                    .toList(),
                onChanged: (v) => setState(() => _selectedSeverity = v),
              ),
            ),
            SizedBox(
              width: 200,
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Search user, IP...',
                  prefixIcon: Icon(PhosphorIcons.magnifyingGlass(), size: 20),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                ),
                onChanged: (_) => setState(() {}),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButtons() {
    return Row(
      children: [
        OutlinedButton.icon(
          onPressed: () {
            AppNotifier.showSnackBar(
              context,
              const SnackBar(content: Text('PDF export triggered')),
            );
          },
          icon: Icon(PhosphorIcons.fileText(), size: 18),
          label: const Text('Export PDF'),
          style: OutlinedButton.styleFrom(foregroundColor: AppColors.kError),
        ),
        const SizedBox(width: 12),
        OutlinedButton.icon(
          onPressed: () {
            AppNotifier.showSnackBar(
              context,
              const SnackBar(content: Text('CSV export triggered')),
            );
          },
          icon: Icon(PhosphorIcons.fileArrowDown(), size: 18),
          label: const Text('Export CSV'),
        ),
      ],
    );
  }

  Widget _buildLogsTable(List<dynamic> logs) {
    return AdminTable(
      columns: const [
        'Timestamp',
        'User',
        'Action',
        'Category',
        'Severity',
        'Branch',
        'IP Address'
      ],
      rows: logs.take(20).map((l) {
        Color severityColor;
        switch (l.severity) {
          case 'critical':
            severityColor = AppColors.kError;
            break;
          case 'high':
            severityColor = AppColors.kError;
            break;
          case 'medium':
            severityColor = AppColors.kWarning;
            break;
          case 'low':
            severityColor = AppColors.kAccent;
            break;
          default:
            severityColor = AppColors.kSuccess;
        }

        final timeStr = l.createdAt != null
            ? '${l.createdAt!.day}/${l.createdAt!.month}/${l.createdAt!.year} ${l.createdAt!.hour.toString().padLeft(2, '0')}:${l.createdAt!.minute.toString().padLeft(2, '0')}'
            : 'N/A';

        return [
          Text(timeStr, style: const TextStyle(fontSize: 12)),
          Text(l.userName.isEmpty ? 'System' : l.userName,
              style: const TextStyle(fontWeight: FontWeight.w500)),
          Text(l.action),
          Text(l.category, style: const TextStyle(fontSize: 12)),
          StatusBadge(
              status: l.severity[0].toUpperCase() + l.severity.substring(1),
              color: severityColor),
          Text(l.branchName.isEmpty ? 'Global' : l.branchName,
              style: const TextStyle(fontSize: 12)),
          Text(l.ipAddress.isEmpty ? 'N/A' : l.ipAddress,
              style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
        ];
      }).toList(),
      hasActions: false,
    );
  }

  Future<void> _pickDateRange(BuildContext context) async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime.now().subtract(const Duration(days: 90)),
      lastDate: DateTime.now(),
      initialDateRange: _startDate != null
          ? DateTimeRange(start: _startDate!, end: _endDate!)
          : DateTimeRange(
              start: DateTime.now().subtract(const Duration(days: 7)),
              end: DateTime.now()),
    );
    if (picked != null) {
      setState(() {
        _startDate = picked.start;
        _endDate = picked.end;
      });
    }
  }
}
