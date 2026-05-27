import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/services/maintenance_service.dart';
import '../../domain/admin_providers.dart';
import '../widgets/stat_card.dart';
import '../widgets/admin_table.dart';

class MaintenanceSection extends ConsumerStatefulWidget {
  const MaintenanceSection({super.key});

  @override
  ConsumerState<MaintenanceSection> createState() => _MaintenanceSectionState();
}

class _MaintenanceSectionState extends ConsumerState<MaintenanceSection> {
  String? _selectedPriority;
  String? _selectedStatus;
  final _searchController = TextEditingController();

  final _priorities = ['All', 'high', 'medium', 'low'];
  final _statuses = ['All', 'open', 'in_progress', 'completed', 'cancelled'];

  Map<String, String?> get _filters => {
        'priority': (_selectedPriority == null || _selectedPriority == 'All')
            ? null
            : _selectedPriority,
        'status': (_selectedStatus == null || _selectedStatus == 'All')
            ? null
            : _selectedStatus,
      };

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final requestsAsync = ref.watch(adminMaintenanceRequestsProvider(_filters));
    final isMobile = MediaQuery.of(context).size.width < 768;

    return requestsAsync.when(
      loading: () => const LoadingSkeleton(type: SkeletonType.table),
      error: (err, _) => ErrorState(
        message: '$err',
        onRetry: () =>
            ref.invalidate(adminMaintenanceRequestsProvider(_filters)),
      ),
      data: (allRequests) {
        final filtered = _applySearch(allRequests);
        final openCount = allRequests
            .where(
                (w) => (w['status'] ?? '').toString().toLowerCase() == 'open')
            .length;
        final inProgressCount = allRequests
            .where((w) =>
                (w['status'] ?? '').toString().toLowerCase() == 'in_progress')
            .length;
        final completedCount = allRequests
            .where((w) =>
                (w['status'] ?? '').toString().toLowerCase() == 'completed')
            .length;

        return RefreshIndicator(
          onRefresh: () async =>
              ref.invalidate(adminMaintenanceRequestsProvider(_filters)),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Maintenance',
                    style: Theme.of(context).textTheme.displaySmall),
                const SizedBox(height: 20),
                _buildStatCards(
                    isMobile, openCount, inProgressCount, completedCount),
                const SizedBox(height: 24),
                _buildFilterRow(),
                const SizedBox(height: 20),
                if (filtered.isEmpty)
                  EmptyState(
                      message: 'No work orders found',
                      icon: PhosphorIcons.shieldCheck())
                else
                  _buildWorkOrdersTable(filtered),
              ],
            ),
          ),
        );
      },
    );
  }

  List<Map<String, dynamic>> _applySearch(List<Map<String, dynamic>> orders) {
    if (_searchController.text.isEmpty) return orders;
    final q = _searchController.text.toLowerCase();
    return orders.where((w) {
      return (w['title'] ?? '').toString().toLowerCase().contains(q) ||
          (w['location'] ?? w['room_number'] ?? '')
              .toString()
              .toLowerCase()
              .contains(q) ||
          (w['id'] ?? '').toString().toLowerCase().contains(q) ||
          (w['description'] ?? '').toString().toLowerCase().contains(q);
    }).toList();
  }

  Widget _buildStatCards(
      bool isMobile, int open, int inProgress, int completed) {
    final stats = [
      AdminStatCard(
        label: 'Open',
        value: '$open',
        icon: PhosphorIcons.clock(),
        color: AppColors.kError,
      ),
      AdminStatCard(
        label: 'In Progress',
        value: '$inProgress',
        icon: PhosphorIcons.clockCountdown(),
        color: AppColors.kWarning,
      ),
      AdminStatCard(
        label: 'Completed',
        value: '$completed',
        icon: PhosphorIcons.checkCircle(),
        color: AppColors.kSuccess,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final crossAxisCount = isMobile ? 2 : 3;
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

  Widget _buildFilterRow() {
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
              width: 150,
              child: DropdownButtonFormField<String>(
                initialValue: _selectedPriority ?? 'All',
                decoration: const InputDecoration(
                  labelText: 'Priority',
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                items: _priorities
                    .map((p) =>
                        DropdownMenuItem(value: p, child: Text(_capitalize(p))))
                    .toList(),
                onChanged: (v) => setState(() => _selectedPriority = v),
              ),
            ),
            SizedBox(
              width: 150,
              child: DropdownButtonFormField<String>(
                initialValue: _selectedStatus ?? 'All',
                decoration: const InputDecoration(
                  labelText: 'Status',
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                items: _statuses
                    .map((s) => DropdownMenuItem(
                        value: s,
                        child: Text(_capitalize(s.replaceAll('_', ' ')))))
                    .toList(),
                onChanged: (v) => setState(() => _selectedStatus = v),
              ),
            ),
            SizedBox(
              width: 200,
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Search work orders...',
                  prefixIcon: Icon(PhosphorIcons.magnifyingGlass(), size: 20),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                ),
                onChanged: (_) => setState(() {}),
              ),
            ),
            const SizedBox.shrink(),
            ElevatedButton.icon(
              onPressed: () => _showCreateDialog(context),
              icon: Icon(PhosphorIcons.plus(), size: 20),
              label: const Text('Create Work Order'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWorkOrdersTable(List<Map<String, dynamic>> orders) {
    return AdminTable(
      columns: const [
        'ID',
        'Title',
        'Location',
        'Priority',
        'Status',
        'Assigned To',
        'Date',
        ''
      ],
      rows: orders.map((w) {
        final priority = (w['priority'] ?? 'low').toString().toLowerCase();
        Color priorityColor;
        switch (priority) {
          case 'high':
          case 'urgent':
            priorityColor = AppColors.kError;
            break;
          case 'medium':
            priorityColor = AppColors.kWarning;
            break;
          default:
            priorityColor = AppColors.kSuccess;
        }

        final status = (w['status'] ?? 'open').toString();
        final assignedTo =
            w['assigned_to'] ?? w['assignedTo'] ?? w['assignee_name'] ?? '';
        final date = (w['created_at'] ?? w['date'] ?? '').toString();
        final displayDate = date.length >= 10 ? date.substring(0, 10) : date;
        final id = (w['id'] ?? '').toString();
        final shortId =
            id.length > 8 ? id.substring(0, 8).toUpperCase() : id.toUpperCase();

        return [
          Text('WO-$shortId',
              style: const TextStyle(
                  fontWeight: FontWeight.w500, color: AppColors.kPrimary)),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(w['title'] ?? 'Work Order',
                  style: const TextStyle(fontWeight: FontWeight.w500)),
              Text(w['description'] ?? '',
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.kTextSecondary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis),
            ],
          ),
          Text(w['location'] ?? w['room_number'] ?? 'N/A'),
          StatusBadge(status: _capitalize(priority), color: priorityColor),
          StatusBadge(status: _capitalize(status.replaceAll('_', ' '))),
          Text(assignedTo.toString().isEmpty
              ? 'Unassigned'
              : assignedTo.toString()),
          Text(displayDate),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                icon: Icon(PhosphorIcons.magnifyingGlass(), size: 18),
                onPressed: () => _showDetailsDialog(context, w),
                tooltip: 'View',
              ),
              IconButton(
                icon: Icon(PhosphorIcons.pencilLine(), size: 18),
                onPressed: () => _showUpdateStatusDialog(context, w),
                tooltip: 'Update Status',
              ),
            ],
          ),
        ];
      }).toList(),
      hasActions: true,
    );
  }

  void _showDetailsDialog(BuildContext context, Map<String, dynamic> order) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(order['title'] ?? 'Work Order'),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              _detailRow('Status', order['status'] ?? ''),
              _detailRow('Priority', order['priority'] ?? ''),
              _detailRow('Location',
                  order['location'] ?? order['room_number'] ?? 'N/A'),
              _detailRow('Description', order['description'] ?? ''),
              _detailRow('Assigned To',
                  order['assigned_to'] ?? order['assignedTo'] ?? 'Unassigned'),
              _detailRow('Created', (order['created_at'] ?? '').toString()),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
        ],
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text('$label:',
                style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: AppColors.kTextSecondary)),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }

  void _showUpdateStatusDialog(
      BuildContext context, Map<String, dynamic> order) {
    String selectedStatus = order['status'] ?? 'open';
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setStateDialog) => AlertDialog(
          title: const Text('Update Status'),
          content: DropdownButtonFormField<String>(
            initialValue: selectedStatus,
            decoration: const InputDecoration(labelText: 'New Status'),
            items: ['open', 'in_progress', 'completed', 'cancelled']
                .map((s) => DropdownMenuItem(
                    value: s, child: Text(_capitalize(s.replaceAll('_', ' ')))))
                .toList(),
            onChanged: (v) =>
                setStateDialog(() => selectedStatus = v ?? selectedStatus),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                try {
                  await ref
                      .read(maintenanceServiceProvider)
                      .updateRequestStatus(
                          order['id'].toString(), selectedStatus);
                  ref.invalidate(adminMaintenanceRequestsProvider(_filters));
                  if (context.mounted) {
                    AppNotifier.showSnackBar(
                      context,
                      const SnackBar(content: Text('Work order updated')),
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
              child: const Text('Update'),
            ),
          ],
        ),
      ),
    );
  }

  void _showCreateDialog(BuildContext context) {
    final titleCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final locationCtrl = TextEditingController();
    String priority = 'medium';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setStateDialog) => AlertDialog(
          title: const Text('Create Work Order'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: titleCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Title', hintText: 'e.g. AC Unit Repair'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: descCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Description'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: locationCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Location', hintText: 'e.g. Room 101'),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: priority,
                  decoration: const InputDecoration(labelText: 'Priority'),
                  items: ['low', 'medium', 'high', 'urgent']
                      .map((p) => DropdownMenuItem(
                          value: p, child: Text(_capitalize(p))))
                      .toList(),
                  onChanged: (v) =>
                      setStateDialog(() => priority = v ?? priority),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                if (titleCtrl.text.isEmpty) return;
                Navigator.pop(ctx);
                try {
                  await ref.read(maintenanceServiceProvider).createRequest({
                    'title': titleCtrl.text,
                    'description': descCtrl.text,
                    'location': locationCtrl.text,
                    'priority': priority,
                    'status': 'open',
                  });
                  ref.invalidate(adminMaintenanceRequestsProvider(_filters));
                  if (context.mounted) {
                    AppNotifier.showSnackBar(
                      context,
                      const SnackBar(content: Text('Work order created')),
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
              child: const Text('Create'),
            ),
          ],
        ),
      ),
    );
  }

  String _capitalize(String s) {
    if (s.isEmpty) return s;
    return s[0].toUpperCase() + s.substring(1);
  }
}
