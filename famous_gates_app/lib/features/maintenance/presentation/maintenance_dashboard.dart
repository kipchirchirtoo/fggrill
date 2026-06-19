import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../auth/domain/auth_notifier.dart';
import '../data/repository.dart';
import '../domain/models.dart';
import '../domain/providers.dart';

class MaintenanceDashboard extends ConsumerStatefulWidget {
  const MaintenanceDashboard({super.key});

  @override
  ConsumerState<MaintenanceDashboard> createState() =>
      _MaintenanceDashboardState();
}

class _MaintenanceDashboardState extends ConsumerState<MaintenanceDashboard> {
  int _tabIndex = 0;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authNotifierProvider).valueOrNull;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Maintenance & Work Orders'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
        actions: [
          if (user != null)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircleAvatar(
                    radius: 12,
                    backgroundColor: Colors.white24,
                    child: Text(
                        user.name.isNotEmpty ? user.name[0].toUpperCase() : '?',
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(width: 6),
                  Text(user.name.split(' ').first,
                      style:
                          const TextStyle(color: Colors.white70, fontSize: 12)),
                ],
              ),
            ),
          IconButton(
            onPressed: () async {
              final confirmed = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Logout?'),
                  content: const Text('Are you sure you want to logout?'),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.of(ctx).pop(false),
                        child: const Text('Cancel')),
                    ElevatedButton(
                        onPressed: () => Navigator.of(ctx).pop(true),
                        child: const Text('Logout')),
                  ],
                ),
              );
              if (confirmed == true && context.mounted) {
                await ref.read(authNotifierProvider.notifier).logout();
                if (context.mounted) context.go('/terminal');
              }
            },
            icon: const Icon(Icons.logout, color: Colors.white70),
          ),
        ],
      ),
      body: Column(
        children: [
          _TabBar(
            selectedIndex: _tabIndex,
            onTabChanged: (i) => setState(() => _tabIndex = i),
          ),
          Expanded(
            child: IndexedStack(
              index: _tabIndex,
              children: const [
                _WorkOrdersTab(),
                _AssetsTab(),
                _ScheduleTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TabBar extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int> onTabChanged;

  const _TabBar({required this.selectedIndex, required this.onTabChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      child: Row(
        children: [
          _TabItem(
              label: 'Work Orders',
              index: 0,
              selected: selectedIndex == 0,
              onTap: onTabChanged),
          _TabItem(
              label: 'Assets',
              index: 1,
              selected: selectedIndex == 1,
              onTap: onTabChanged),
          _TabItem(
              label: 'Schedule',
              index: 2,
              selected: selectedIndex == 2,
              onTap: onTabChanged),
        ],
      ),
    );
  }
}

class _TabItem extends StatelessWidget {
  final String label;
  final int index;
  final bool selected;
  final ValueChanged<int> onTap;

  const _TabItem(
      {required this.label,
      required this.index,
      required this.selected,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: () => onTap(index),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            border: Border(
                bottom: BorderSide(
              color: selected ? AppColors.kPrimary : Colors.transparent,
              width: 2,
            )),
          ),
          child: Text(label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                color: selected ? AppColors.kPrimary : AppColors.kTextSecondary,
              )),
        ),
      ),
    );
  }
}

class _WorkOrdersTab extends ConsumerWidget {
  const _WorkOrdersTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AsyncValueWidget(
      value: ref.watch(workOrdersProvider(null)),
      data: (orders) {
        final open = orders.where((o) => o.status == 'pending').length;
        final inProgress =
            orders.where((o) => o.status == 'in_progress').length;
        final completed = orders.where((o) => o.status == 'completed').length;

        return Column(
          children: [
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  _statCard('Open', '$open', AppColors.kError),
                  const SizedBox(width: 12),
                  _statCard('In Progress', '$inProgress', AppColors.kWarning),
                  const SizedBox(width: 12),
                  _statCard('Completed', '$completed', AppColors.kSuccess),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => _showCreateDialog(context, ref),
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('New Work Order'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.kPrimary,
                    foregroundColor: Colors.white,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Expanded(
              child: orders.isEmpty
                  ? const EmptyState(message: 'No work orders')
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: orders.length,
                      separatorBuilder: (_, __) => const Divider(),
                      itemBuilder: (context, index) =>
                          _WorkOrderCard(order: orders[index]),
                    ),
            ),
          ],
        );
      },
    );
  }

  Widget _statCard(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border(bottom: BorderSide(color: color, width: 4)),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withValues(alpha: 0.05), blurRadius: 10)
          ],
        ),
        child: Column(
          children: [
            Text(value,
                style: TextStyle(
                    fontSize: 28, fontWeight: FontWeight.bold, color: color)),
            Text(label,
                style: const TextStyle(
                    color: AppColors.kTextSecondary, fontSize: 12)),
          ],
        ),
      ),
    );
  }

  void _showCreateDialog(BuildContext context, WidgetRef ref) {
    final titleCtrl = TextEditingController();
    final roomCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Work Order'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: titleCtrl,
              decoration: const InputDecoration(
                  labelText: 'Description', hintText: 'e.g. Fix broken tap'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: roomCtrl,
              decoration: const InputDecoration(
                  labelText: 'Room/Location', hintText: 'e.g. Room 101'),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              await ref.read(maintenanceRepositoryProvider).createWorkOrder({
                'title': titleCtrl.text.trim(),
                'room_number': roomCtrl.text.trim(),
                'priority': 'medium',
              });
              ref.invalidate(workOrdersProvider(null));
              if (ctx.mounted) Navigator.of(ctx).pop();
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }
}

class _WorkOrderCard extends ConsumerWidget {
  final WorkOrder order;

  const _WorkOrderCard({required this.order});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final color = order.status == 'completed'
        ? AppColors.kSuccess
        : order.status == 'in_progress'
            ? AppColors.kWarning
            : AppColors.kError;
    return ListTile(
      leading: const Icon(Icons.build, color: AppColors.kTextSecondary),
      title: Text(order.title,
          style: const TextStyle(fontWeight: FontWeight.bold)),
      subtitle:
          Text('${order.roomNumber ?? ''} • ${order.requestedBy ?? 'Staff'}'),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: color),
            ),
            child: Text(_label,
                style: TextStyle(
                    color: color, fontSize: 10, fontWeight: FontWeight.bold)),
          ),
          if (order.status == 'pending') ...[
            const SizedBox(width: 4),
            IconButton(
              icon: const Icon(Icons.check, size: 18),
              onPressed: () => ref
                  .read(maintenanceRepositoryProvider)
                  .updateStatus(order.id, 'in_progress'),
            ),
          ],
          if (order.status == 'in_progress')
            IconButton(
              icon: const Icon(Icons.done, size: 18),
              onPressed: () => ref
                  .read(maintenanceRepositoryProvider)
                  .updateStatus(order.id, 'completed'),
            ),
        ],
      ),
    );
  }

  String get _label {
    switch (order.status) {
      case 'pending':
        return 'Open';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      default:
        return order.status;
    }
  }
}

// ─── Assets Tab ─────────────────────────────────────────────────────────────

class _AssetsTab extends ConsumerWidget {
  const _AssetsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assetsAsync = ref.watch(assetsProvider(null));
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          const Text('Assets',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
          ElevatedButton.icon(
            onPressed: () => _showNewAssetDialog(context, ref),
            icon: const Icon(Icons.add, size: 16),
            label: const Text('Add Asset'),
            style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.kPrimary,
                foregroundColor: Colors.white),
          ),
        ]),
        const SizedBox(height: 12),
        Expanded(
          child: AsyncValueWidget(
            value: assetsAsync,
            data: (assets) {
              if (assets.isEmpty) {
                return const EmptyState(message: 'No assets registered');
              }
              return ListView.builder(
                itemCount: assets.length,
                itemBuilder: (_, i) {
                  final a = assets[i];
                  final status = (a['status'] ?? 'active').toString();
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading: const Icon(Icons.inventory_2,
                          color: AppColors.kPrimary),
                      title: Text(
                          (a['name'] ?? a['asset_name'] ?? 'Asset').toString(),
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(
                          'Type: ${a['type'] ?? '—'}  •  Location: ${a['location'] ?? '—'}'),
                      trailing: Chip(
                        label: Text(status.toUpperCase(),
                            style: const TextStyle(fontSize: 10)),
                        backgroundColor: status == 'active'
                            ? AppColors.kSuccess.withValues(alpha: 0.1)
                            : AppColors.kError.withValues(alpha: 0.1),
                      ),
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

  void _showNewAssetDialog(BuildContext context, WidgetRef ref) {
    final nameCtrl = TextEditingController();
    final typeCtrl = TextEditingController();
    final locationCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add New Asset'),
        content: SizedBox(
          width: 320,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Asset Name')),
            const SizedBox(height: 12),
            TextField(
                controller: typeCtrl,
                decoration: const InputDecoration(labelText: 'Type')),
            const SizedBox(height: 12),
            TextField(
                controller: locationCtrl,
                decoration: const InputDecoration(labelText: 'Location')),
          ]),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (nameCtrl.text.trim().isEmpty) return;
              Navigator.pop(ctx);
              try {
                await ref.read(maintenanceRepositoryProvider).createAsset({
                  'name': nameCtrl.text.trim(),
                  'type': typeCtrl.text.trim(),
                  'location': locationCtrl.text.trim(),
                  'status': 'active',
                });
                ref.invalidate(assetsProvider(null));
                if (context.mounted) {
                  AppNotifier.showSnackBar(
                      context, const SnackBar(content: Text('Asset added')));
                }
              } catch (e) {
                if (context.mounted) {
                  AppNotifier.showSnackBar(
                      context, SnackBar(content: Text('Error: $e')));
                }
              }
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }
}

// ─── Schedule Tab ───────────────────────────────────────────────────────────

class _ScheduleTab extends ConsumerWidget {
  const _ScheduleTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheduleAsync = ref.watch(maintenanceScheduleProvider(null));
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          const Text('Maintenance Schedule',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
          ElevatedButton.icon(
            onPressed: () => _showNewScheduleDialog(context, ref),
            icon: const Icon(Icons.add, size: 16),
            label: const Text('Add Schedule'),
            style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.kPrimary,
                foregroundColor: Colors.white),
          ),
        ]),
        const SizedBox(height: 12),
        Expanded(
          child: AsyncValueWidget(
            value: scheduleAsync,
            data: (entries) {
              if (entries.isEmpty) {
                return const EmptyState(message: 'No scheduled maintenance');
              }
              return ListView.builder(
                itemCount: entries.length,
                itemBuilder: (_, i) {
                  final e = entries[i];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading: const Icon(Icons.calendar_today,
                          color: AppColors.kPrimary),
                      title: Text(
                          (e['task'] ?? e['title'] ?? 'Task').toString(),
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(
                          'Date: ${(e['scheduled_date'] ?? e['date'] ?? '').toString().split('T').first}  •  Assigned: ${e['assigned_to'] ?? '—'}'),
                      trailing: Text((e['priority'] ?? 'medium').toString(),
                          style: const TextStyle(
                              fontSize: 11, color: AppColors.kTextSecondary)),
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

  void _showNewScheduleDialog(BuildContext context, WidgetRef ref) {
    final taskCtrl = TextEditingController();
    final dateCtrl = TextEditingController();
    final assignedCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Scheduled Maintenance'),
        content: SizedBox(
          width: 320,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(
                controller: taskCtrl,
                decoration: const InputDecoration(labelText: 'Task')),
            const SizedBox(height: 12),
            TextField(
                controller: dateCtrl,
                decoration:
                    const InputDecoration(labelText: 'Date (YYYY-MM-DD)')),
            const SizedBox(height: 12),
            TextField(
                controller: assignedCtrl,
                decoration: const InputDecoration(labelText: 'Assigned To')),
          ]),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (taskCtrl.text.trim().isEmpty) return;
              Navigator.pop(ctx);
              try {
                await ref
                    .read(maintenanceRepositoryProvider)
                    .createScheduleEntry({
                  'task': taskCtrl.text.trim(),
                  'scheduled_date': dateCtrl.text.trim(),
                  'assigned_to': assignedCtrl.text.trim(),
                  'priority': 'medium',
                });
                ref.invalidate(maintenanceScheduleProvider(null));
                if (context.mounted) {
                  AppNotifier.showSnackBar(
                      context, const SnackBar(content: Text('Schedule added')));
                }
              } catch (e) {
                if (context.mounted) {
                  AppNotifier.showSnackBar(
                      context, SnackBar(content: Text('Error: $e')));
                }
              }
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }
}
