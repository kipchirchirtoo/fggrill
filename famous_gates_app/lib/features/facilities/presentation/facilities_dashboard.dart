import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/widgets.dart';
import '../domain/providers.dart';
import '../../maintenance/domain/providers.dart';
import '../../maintenance/data/repository.dart';

class FacilitiesDashboard extends ConsumerStatefulWidget {
  const FacilitiesDashboard({super.key});

  @override
  ConsumerState<FacilitiesDashboard> createState() =>
      _FacilitiesDashboardState();
}

class _MaintenanceTab extends ConsumerWidget {
  const _MaintenanceTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(facilitiesWorkOrdersProvider);
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: ElevatedButton.icon(
              onPressed: () => _showCreateDialog(context, ref),
              icon: const Icon(Icons.add, size: 16),
              label: const Text('New Work Order'),
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: orders.when(
              data: (rows) => ListView.separated(
                itemCount: rows.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (_, i) {
                  final o = rows[i];
                  return ListTile(
                    leading: const Icon(Icons.build),
                    title: Text(
                        (o['issue_description'] ?? o['title'] ?? 'Work order')
                            .toString()),
                    subtitle: Text(
                        '${o['location'] ?? o['room_number'] ?? ''} • ${o['priority'] ?? ''}'),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text((o['status'] ?? '').toString()),
                      ],
                    ),
                  );
                },
              ),
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Error: $e')),
            ),
          ),
        ],
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
        content: SizedBox(
          width: 420,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                  controller: titleCtrl,
                  decoration: const InputDecoration(labelText: 'Description')),
              const SizedBox(height: 8),
              TextField(
                  controller: roomCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Room/Location')),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (titleCtrl.text.trim().isEmpty) return;
              Navigator.pop(ctx);
              await ref.read(maintenanceRepositoryProvider).createWorkOrder({
                'title': titleCtrl.text.trim(),
                'room_number': roomCtrl.text.trim(),
                'priority': 'medium',
              });
              ref.invalidate(workOrdersProvider(null));
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }
}

class _RoomStatusTab extends ConsumerWidget {
  const _RoomStatusTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rooms = ref.watch(facilitiesRoomsProvider);
    return rooms.when(
      data: (rows) => GridView.builder(
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 5,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
        ),
        itemCount: rows.length,
        itemBuilder: (_, i) {
          final r = rows[i];
          final status = (r['status'] ?? '').toString();
          Color color;
          switch (status) {
            case 'clean':
              color = AppColors.kSuccess;
              break;
            case 'occupied':
              color = AppColors.kWarning;
              break;
            default:
              color = AppColors.kError;
              break;
          }
          return Card(
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text((r['room_number'] ?? '').toString(),
                      style:
                          TextStyle(fontWeight: FontWeight.bold, color: color)),
                  const SizedBox(height: 4),
                  Text(status, style: TextStyle(fontSize: 11, color: color)),
                ],
              ),
            ),
          );
        },
      ),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e')),
    );
  }
}

class _FacilitiesDashboardState extends ConsumerState<FacilitiesDashboard> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final tabs = [
      const DashboardTab(label: 'Overview', content: _OverviewTab()),
      const DashboardTab(label: 'Housekeeping', content: _HousekeepingTab()),
      const DashboardTab(label: 'Maintenance', content: _MaintenanceTab()),
      const DashboardTab(label: 'Assets', content: _AssetsTab()),
      const DashboardTab(
          label: 'Inventory', content: _FacilitiesInventoryTab()),
      const DashboardTab(label: 'Room Status', content: _RoomStatusTab()),
    ];

    return DashboardShell(
      title: 'Facilities',
      tabs: tabs,
      currentTab: _tab,
      onTabChanged: (i) => setState(() => _tab = i),
    );
  }
}

class _OverviewTab extends ConsumerWidget {
  const _OverviewTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dash = ref.watch(facilitiesDashboardProvider);
    return dash.when(
      data: (d) {
        final stats = (d['data']?['stats'] as Map?) ?? {};
        return Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Facilities Overview',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
              const SizedBox(height: 16),
              Wrap(spacing: 12, runSpacing: 12, children: [
                _Stat(
                    label: 'Rooms',
                    value: '${(stats['rooms']?['total']) ?? '-'}'),
                _Stat(
                    label: 'Clean',
                    value: '${(stats['rooms']?['clean']) ?? '-'}'),
                _Stat(
                    label: 'Dirty',
                    value: '${(stats['rooms']?['dirty']) ?? '-'}'),
                _Stat(
                    label: 'Tasks',
                    value: '${(stats['tasks']?['total']) ?? '-'}'),
                _Stat(
                    label: 'Work Orders',
                    value: '${(stats['workOrders']?['total']) ?? '-'}'),
              ]),
            ],
          ),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e')),
    );
  }
}

class _HousekeepingTab extends ConsumerWidget {
  const _HousekeepingTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tasks = ref.watch(housekeepingTasksProvider);
    return tasks.when(
      data: (rows) => ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: rows.length,
        itemBuilder: (_, i) => Card(
          child: ListTile(
            leading: const Icon(Icons.cleaning_services_outlined),
            title: Text((rows[i]['task_type'] ?? '').toString()),
            subtitle: Text(
                'Room: ${rows[i]['room_number'] ?? ''} • Priority: ${rows[i]['priority'] ?? ''}'),
            trailing: Text((rows[i]['status'] ?? '').toString()),
          ),
        ),
      ),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e')),
    );
  }
}

class _AssetsTab extends ConsumerWidget {
  const _AssetsTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assets = ref.watch(facilitiesAssetsProvider);
    final schedule = ref.watch(facilitiesScheduleProvider);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Maintenance Assets',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 8),
        assets.when(
          data: (rows) => _mapList(
              rows,
              Icons.inventory_2_outlined,
              (r) => (r['name'] ?? r['asset_tag'] ?? 'Asset').toString(),
              (r) =>
                  '${r['category'] ?? ''} • ${r['location'] ?? ''} • ${r['status'] ?? ''}'),
          loading: () => const LinearProgressIndicator(),
          error: (e, _) => ErrorState(message: '$e'),
        ),
        const SizedBox(height: 20),
        const Text('Maintenance Schedule',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 8),
        schedule.when(
          data: (rows) => _mapList(
              rows,
              Icons.event_repeat_outlined,
              (r) => (r['title'] ?? r['asset_name'] ?? 'Scheduled maintenance')
                  .toString(),
              (r) =>
                  '${r['due_date'] ?? r['scheduled_date'] ?? ''} • ${r['status'] ?? ''}'),
          loading: () => const LinearProgressIndicator(),
          error: (e, _) => ErrorState(message: '$e'),
        ),
      ],
    );
  }
}

class _FacilitiesInventoryTab extends ConsumerWidget {
  const _FacilitiesInventoryTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inventory = ref.watch(facilitiesInventoryProvider);
    final staff = ref.watch(facilitiesStaffProvider);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Supplies Inventory',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 8),
        inventory.when(
          data: (rows) => _mapList(
              rows,
              Icons.cleaning_services_outlined,
              (r) => (r['name'] ?? r['supply_name'] ?? 'Supply').toString(),
              (r) =>
                  'Qty: ${r['quantity'] ?? '-'} ${r['unit'] ?? ''} • ${r['status'] ?? ''}'),
          loading: () => const LinearProgressIndicator(),
          error: (e, _) => ErrorState(message: '$e'),
        ),
        const SizedBox(height: 20),
        const Text('Facilities Staff',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 8),
        staff.when(
          data: (rows) => _mapList(
              rows,
              Icons.people_outline,
              (r) => (r['name'] ?? r['staff_name'] ?? 'Staff').toString(),
              (r) => '${r['department'] ?? ''} • ${r['status'] ?? ''}'),
          loading: () => const LinearProgressIndicator(),
          error: (e, _) => ErrorState(message: '$e'),
        ),
      ],
    );
  }
}

Widget _mapList(
    List<Map<String, dynamic>> rows,
    IconData icon,
    String Function(Map<String, dynamic>) title,
    String Function(Map<String, dynamic>) subtitle) {
  if (rows.isEmpty) return const EmptyState(message: 'No records found');
  return Card(
    child: ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: rows.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (_, i) => ListTile(
        leading: Icon(icon),
        title: Text(title(rows[i])),
        subtitle: Text(subtitle(rows[i])),
      ),
    ),
  );
}

class _Stat extends StatelessWidget {
  final String label;
  final String value;
  const _Stat({required this.label, required this.value});
  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(value,
                style:
                    const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            Text(label, style: const TextStyle(color: Colors.grey)),
          ],
        ),
      ),
    );
  }
}
