import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/master_dashboard_shell.dart';
import '../../../core/widgets/widgets.dart' hide DataColumn, DataRow;
import '../data/repository.dart';
import '../domain/models.dart';
import '../domain/providers.dart';

final _hkTaskFilterProvider = StateProvider<String?>((ref) => null);

enum HousekeepingSection {
  overview,
  roomBoard,
  taskAssignment,
  guestPriorities,
  checklists,
  inventory,
  lostFound,
  schedule,
  reports,
}

class HousekeepingScreen extends ConsumerStatefulWidget {
  const HousekeepingScreen({super.key});

  @override
  ConsumerState<HousekeepingScreen> createState() => _HousekeepingScreenState();
}

class _HousekeepingScreenState extends ConsumerState<HousekeepingScreen> {
  HousekeepingSection _section = HousekeepingSection.overview;

  @override
  Widget build(BuildContext context) {
    return MasterDashboardShell<HousekeepingSection>(
      title: 'Housekeeping',
      subtitle: 'Room readiness, cleaning tasks, inspections, and supplies',
      initials: 'HK',
      sidebarTitle: 'Housekeeping',
      sidebarSubtitle: 'Rooms & Service',
      sidebarInitials: 'HK',
      breadcrumbRoot: 'Operations',
      searchHint: 'Search rooms, tasks, inventory...',
      currentSection: _section,
      items: const [
        MasterNavItem(
          section: HousekeepingSection.overview,
          label: 'Command Center',
          icon: Icons.dashboard_outlined,
          group: 'Overview',
        ),
        MasterNavItem(
          section: HousekeepingSection.roomBoard,
          label: 'Room Status',
          icon: Icons.meeting_room_outlined,
          group: 'Rooms',
        ),
        MasterNavItem(
          section: HousekeepingSection.taskAssignment,
          label: 'Task Assignment',
          icon: Icons.assignment_outlined,
          group: 'Rooms',
        ),
        MasterNavItem(
          section: HousekeepingSection.guestPriorities,
          label: 'Guest Priorities',
          icon: Icons.hotel_outlined,
          group: 'Rooms',
        ),
        MasterNavItem(
          section: HousekeepingSection.checklists,
          label: 'Checklists',
          icon: Icons.fact_check_outlined,
          group: 'Quality',
        ),
        MasterNavItem(
          section: HousekeepingSection.inventory,
          label: 'Inventory & Linen',
          icon: Icons.inventory_2_outlined,
          group: 'Resources',
        ),
        MasterNavItem(
          section: HousekeepingSection.lostFound,
          label: 'Lost & Found',
          icon: Icons.manage_search_outlined,
          group: 'Resources',
        ),
        MasterNavItem(
          section: HousekeepingSection.schedule,
          label: 'Schedule',
          icon: Icons.calendar_month_outlined,
          group: 'Team',
        ),
        MasterNavItem(
          section: HousekeepingSection.reports,
          label: 'Reports',
          icon: Icons.bar_chart_outlined,
          group: 'Team',
        ),
      ],
      onSectionSelected: (section) => setState(() => _section = section),
      child: _sectionView(),
    );
  }

  Widget _sectionView() {
    switch (_section) {
      case HousekeepingSection.overview:
        return const _OverviewView();
      case HousekeepingSection.roomBoard:
        return const _RoomBoardView();
      case HousekeepingSection.taskAssignment:
        return const _TasksView();
      case HousekeepingSection.guestPriorities:
        return const _GuestPrioritiesView();
      case HousekeepingSection.checklists:
        return const _ChecklistsView();
      case HousekeepingSection.inventory:
        return const _InventoryView();
      case HousekeepingSection.lostFound:
        return const _LostFoundView();
      case HousekeepingSection.schedule:
        return const _ScheduleView();
      case HousekeepingSection.reports:
        return const _ReportsView();
    }
  }
}

class _OverviewView extends ConsumerWidget {
  const _OverviewView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final roomsAsync = ref.watch(hkRoomsProvider);
    final tasksAsync = ref.watch(hkTasksProvider(null));
    final suppliesAsync = ref.watch(hkSuppliesProvider);

    return _PageScaffold(
      title: 'Housekeeping Command Center',
      subtitle:
          'Live readiness board for room status, cleaner workload, inspections, and supply risk.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _AsyncTriple(
            a: roomsAsync,
            b: tasksAsync,
            c: suppliesAsync,
            builder: (rooms, tasks, supplies) {
              final dirty = rooms.where((r) => _dirtyStatuses.contains(r.status)).length;
              final clean = rooms.where((r) => _cleanStatuses.contains(r.status)).length;
              final openTasks = tasks.where((t) => t.status != 'completed').length;
              final lowSupplies = supplies.where(_isLowSupply).length;
              return Wrap(
                spacing: 14,
                runSpacing: 14,
                children: [
                  _MetricCard('Rooms Clean', '$clean', Icons.check_circle_outline,
                      AppColors.kSuccess),
                  _MetricCard('Need Cleaning', '$dirty',
                      Icons.cleaning_services_outlined, AppColors.kWarning),
                  _MetricCard('Open Tasks', '$openTasks',
                      Icons.assignment_late_outlined, AppColors.kPrimary),
                  _MetricCard('Low Supplies', '$lowSupplies',
                      Icons.inventory_outlined, AppColors.kError),
                ],
              );
            },
          ),
          const SizedBox(height: 18),
          LayoutBuilder(builder: (context, constraints) {
            final wide = constraints.maxWidth > 900;
            final tasks = _Panel(
              title: 'Priority Task Queue',
              child: AsyncValueWidget(
                value: tasksAsync,
                data: (items) {
                  final rows = items.where((t) => t.status != 'completed').take(8).toList();
                  if (rows.isEmpty) {
                    return const EmptyState(message: 'No open housekeeping tasks.');
                  }
                  return Column(
                    children: rows
                        .map((task) => _CompactTile(
                              title: task.taskType,
                              subtitle: 'Room ${task.roomNumber ?? 'N/A'}',
                              trailing: task.status,
                              color: _taskColor(task.status),
                            ))
                        .toList(),
                  );
                },
              ),
            );
            final rooms = _Panel(
              title: 'Room Readiness Snapshot',
              child: AsyncValueWidget(
                value: roomsAsync,
                data: (items) => _MiniRoomGrid(rooms: items.take(24).toList()),
              ),
            );
            if (!wide) return Column(children: [tasks, rooms]);
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: tasks),
                const SizedBox(width: 16),
                Expanded(child: rooms),
              ],
            );
          }),
        ],
      ),
    );
  }
}

class _RoomBoardView extends ConsumerWidget {
  const _RoomBoardView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final roomsAsync = ref.watch(hkRoomsProvider);
    return _PageScaffold(
      title: 'Real-Time Room Status',
      subtitle:
          'Color-coded room board for clean, dirty, occupied, inspected, and out-of-order rooms.',
      child: AsyncValueWidget(
        value: roomsAsync,
        data: (rooms) {
          if (rooms.isEmpty) return const EmptyState(message: 'No rooms found.');
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  _StatusLegend('Clean', AppColors.kSuccess),
                  _StatusLegend('Dirty / Cleaning', AppColors.kWarning),
                  _StatusLegend('Occupied', AppColors.kPrimary),
                  _StatusLegend('Out of Order', AppColors.kError),
                ],
              ),
              const SizedBox(height: 16),
              LayoutBuilder(builder: (context, constraints) {
                final width = constraints.maxWidth;
                final columns = width > 1300
                    ? 6
                    : width > 980
                        ? 5
                        : width > 680
                            ? 3
                            : 2;
                return GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: columns,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: 1.3,
                  ),
                  itemCount: rooms.length,
                  itemBuilder: (context, index) =>
                      _RoomStatusCard(room: rooms[index]),
                );
              }),
            ],
          );
        },
      ),
    );
  }
}

class _RoomStatusCard extends ConsumerWidget {
  const _RoomStatusCard({required this.room});

  final HkRoom room;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final color = _roomColor(room.status);
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: color.withValues(alpha: 0.55), width: 1.5),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: color.withValues(alpha: 0.12),
                  child: Icon(Icons.bed_outlined, color: color),
                ),
                const Spacer(),
                _Badge(_pretty(room.status), color),
              ],
            ),
            const Spacer(),
            Text('Room ${room.number}',
                style:
                    const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                _TinyAction(
                  label: 'Clean',
                  onTap: () =>
                      _setRoomStatus(context, ref, room.id, 'vacant_clean'),
                ),
                _TinyAction(
                  label: 'Dirty',
                  onTap: () =>
                      _setRoomStatus(context, ref, room.id, 'vacant_dirty'),
                ),
                _TinyAction(
                  label: 'OOO',
                  onTap: () =>
                      _setRoomStatus(context, ref, room.id, 'out_of_order'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _setRoomStatus(
      BuildContext context, WidgetRef ref, String roomId, String status) async {
    try {
      await ref.read(housekeepingRepositoryProvider).updateRoomStatus(roomId, status);
      ref.invalidate(hkRoomsProvider);
      if (context.mounted) {
        AppNotifier.showSnackBar(
          context,
          SnackBar(content: Text('Room marked ${_pretty(status)}')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        AppNotifier.showSnackBar(context, SnackBar(content: Text('Error: $e')));
      }
    }
  }
}

class _TasksView extends ConsumerWidget {
  const _TasksView();

  static const _taskTypes = [
    'checkout_full_clean',
    'stay_over_service',
    'deep_clean',
    'inspection',
    'restock_amenities',
    'turndown_service',
    'guest_request',
    'pre_arrival_vip',
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filter = ref.watch(_hkTaskFilterProvider);
    final tasksAsync = ref.watch(hkTasksProvider(filter));
    final roomsAsync = ref.watch(hkRoomsProvider);
    return _PageScaffold(
      title: 'Smart Task Assignment',
      subtitle:
          'Create, prioritize, and progress cleaning tasks. Designed for future auto-assignment by workload, room location, and guest priority.',
      trailing: ElevatedButton.icon(
        onPressed: () =>
            _showCreateTaskDialog(context, ref, roomsAsync.valueOrNull ?? []),
        icon: const Icon(Icons.add, size: 18),
        label: const Text('New Task'),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _FilterChipButton(
                label: 'All',
                selected: filter == null,
                onTap: () => ref.read(_hkTaskFilterProvider.notifier).state = null,
              ),
              for (final status in ['pending', 'in_progress', 'completed'])
                _FilterChipButton(
                  label: _pretty(status),
                  selected: filter == status,
                  onTap: () =>
                      ref.read(_hkTaskFilterProvider.notifier).state = status,
                ),
            ],
          ),
          const SizedBox(height: 16),
          AsyncValueWidget(
            value: tasksAsync,
            data: (tasks) {
              if (tasks.isEmpty) return const EmptyState(message: 'No tasks.');
              return _ExcelGrid(
                columns: const [
                  'Room',
                  'Task',
                  'Priority',
                  'Status',
                  'Assigned',
                  'Created',
                  'Action',
                ],
                rows: tasks.map((task) {
                  return [
                    'Room ${task.roomNumber ?? 'N/A'}',
                    _pretty(task.taskType),
                    task.priority ?? 'normal',
                    task.status,
                    task.assignedTo ?? '-',
                    _date(task.createdAt),
                    task.status == 'pending'
                        ? _GridAction(
                            label: 'Start',
                            onTap: () => _updateTask(context, ref, task.id, 'in_progress'),
                          )
                        : task.status == 'in_progress'
                            ? _GridAction(
                                label: 'Complete',
                                onTap: () =>
                                    _updateTask(context, ref, task.id, 'completed'),
                              )
                            : const Text('Done',
                                style: TextStyle(color: AppColors.kSuccess)),
                  ];
                }).toList(),
              );
            },
          ),
        ],
      ),
    );
  }

  Future<void> _updateTask(
      BuildContext context, WidgetRef ref, String id, String status) async {
    try {
      await ref.read(housekeepingRepositoryProvider).updateTaskStatus(id, status);
      ref.invalidate(hkTasksProvider(ref.read(_hkTaskFilterProvider)));
    } catch (e) {
      if (context.mounted) {
        AppNotifier.showSnackBar(context, SnackBar(content: Text('Error: $e')));
      }
    }
  }

  void _showCreateTaskDialog(
      BuildContext context, WidgetRef ref, List<HkRoom> rooms) {
    String? selectedRoomId = rooms.isEmpty ? null : rooms.first.id;
    String selectedType = _taskTypes.first;
    String priority = 'normal';
    final notesCtrl = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('New Housekeeping Task'),
          content: SizedBox(
            width: 420,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: selectedRoomId,
                  decoration: const InputDecoration(labelText: 'Room'),
                  items: rooms
                      .map((room) => DropdownMenuItem(
                            value: room.id,
                            child: Text('Room ${room.number}'),
                          ))
                      .toList(),
                  onChanged: (value) =>
                      setDialogState(() => selectedRoomId = value),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: selectedType,
                  decoration: const InputDecoration(labelText: 'Task Type'),
                  items: _taskTypes
                      .map((type) => DropdownMenuItem(
                            value: type,
                            child: Text(_pretty(type)),
                          ))
                      .toList(),
                  onChanged: (value) =>
                      setDialogState(() => selectedType = value ?? selectedType),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: priority,
                  decoration: const InputDecoration(labelText: 'Priority'),
                  items: const [
                    DropdownMenuItem(value: 'low', child: Text('Low')),
                    DropdownMenuItem(value: 'normal', child: Text('Normal')),
                    DropdownMenuItem(value: 'high', child: Text('High')),
                    DropdownMenuItem(value: 'urgent', child: Text('Urgent')),
                  ],
                  onChanged: (value) =>
                      setDialogState(() => priority = value ?? priority),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: notesCtrl,
                  maxLines: 2,
                  decoration: const InputDecoration(labelText: 'Notes'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: selectedRoomId == null
                  ? null
                  : () async {
                      Navigator.pop(ctx);
                      try {
                        await ref.read(housekeepingRepositoryProvider).createTask({
                          'roomId': selectedRoomId,
                          'taskType': selectedType,
                          'priority': priority,
                          'notes': notesCtrl.text.trim(),
                        });
                        ref.invalidate(hkTasksProvider(ref.read(_hkTaskFilterProvider)));
                        if (context.mounted) {
                          AppNotifier.showSnackBar(
                            context,
                            const SnackBar(content: Text('Task created')),
                          );
                        }
                      } catch (e) {
                        if (context.mounted) {
                          AppNotifier.showSnackBar(
                              context, SnackBar(content: Text('Error: $e')));
                        }
                      }
                    },
              child: const Text('Create'),
            ),
          ],
        ),
      ),
    ).whenComplete(notesCtrl.dispose);
  }
}

class _GuestPrioritiesView extends ConsumerWidget {
  const _GuestPrioritiesView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final roomsAsync = ref.watch(hkRoomsProvider);
    final tasksAsync = ref.watch(hkTasksProvider(null));
    return _PageScaffold(
      title: 'Guest-Specific Priorities',
      subtitle:
          'Operational view for VIP rooms, early arrivals, late departures, DND, and guest requests.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AsyncValueWidget(
            value: roomsAsync,
            data: (rooms) {
              final needsService = rooms
                  .where((room) => _dirtyStatuses.contains(room.status))
                  .take(12)
                  .toList();
              return _ExcelGrid(
                columns: const ['Flag', 'Room', 'Priority', 'Action Needed'],
                rows: [
                  for (final room in needsService)
                    [
                      'Cleaning',
                      'Room ${room.number}',
                      room.status.contains('vip') ? 'VIP' : 'Standard',
                      _pretty(room.status),
                    ],
                  if (needsService.isEmpty)
                    ['Ready', '-', 'Low', 'No guest-priority rooms pending'],
                ],
              );
            },
          ),
          const SizedBox(height: 18),
          _Panel(
            title: 'Guest Request Signals',
            child: AsyncValueWidget(
              value: tasksAsync,
              data: (tasks) {
                final requestLike = tasks
                    .where((task) =>
                        task.taskType.contains('guest') ||
                        task.taskType.contains('turndown') ||
                        task.taskType.contains('stayover'))
                    .toList();
                if (requestLike.isEmpty) {
                  return const EmptyState(
                    message:
                        'No guest-specific tasks found. Guest requests can be created from reception or housekeeping task assignment.',
                  );
                }
                return Column(
                  children: requestLike
                      .map((task) => _CompactTile(
                            title: _pretty(task.taskType),
                            subtitle: 'Room ${task.roomNumber ?? 'N/A'}',
                            trailing: task.status,
                            color: _taskColor(task.status),
                          ))
                      .toList(),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _ChecklistsView extends ConsumerWidget {
  const _ChecklistsView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inspectionsAsync = ref.watch(hkInspectionsProvider);
    final roomsAsync = ref.watch(hkRoomsProvider);
    return _PageScaffold(
      title: 'Checklists & Inspections',
      subtitle:
          'Excel-style checklist grid for consistent cleaning standards and inspection scoring.',
      trailing: ElevatedButton.icon(
        onPressed: () =>
            _showInspectionDialog(context, ref, roomsAsync.valueOrNull ?? []),
        icon: const Icon(Icons.add, size: 18),
        label: const Text('New Inspection'),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _ExcelGrid(
            columns: const [
              'Area',
              'Checklist Item',
              'Standard',
              'Pass/Fail',
              'Notes',
            ],
            rows: const [
              ['Bedroom', 'Bed linen changed', 'Fresh, tucked, no stains', 'Pass', ''],
              ['Bathroom', 'Toilet and shower disinfected', 'No odor, no residue', 'Pass', ''],
              ['Amenities', 'Towels/toiletries stocked', 'Par level met', 'Pass', ''],
              ['Floor', 'Vacuum/mop complete', 'No dust, no spills', 'Pass', ''],
              ['Safety', 'Maintenance defects reported', 'Logged if found', 'Pass', ''],
            ],
          ),
          const SizedBox(height: 18),
          _Panel(
            title: 'Inspection History',
            child: AsyncValueWidget(
              value: inspectionsAsync,
              data: (items) {
                if (items.isEmpty) {
                  return const EmptyState(message: 'No inspections recorded.');
                }
                return _ExcelGrid(
                  columns: const ['Room', 'Type', 'Score', 'Result', 'Date'],
                  rows: items
                      .map((item) => [
                            '${item['room_number'] ?? item['room'] ?? '-'}',
                            _pretty('${item['inspection_type'] ?? 'standard'}'),
                            '${item['overall_score'] ?? item['score'] ?? '-'}',
                            _pretty('${item['result'] ?? item['status'] ?? '-'}'),
                            _dateText(item['inspected_at'] ?? item['created_at']),
                          ])
                      .toList(),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _showInspectionDialog(
      BuildContext context, WidgetRef ref, List<HkRoom> rooms) {
    String? selectedRoomId = rooms.isEmpty ? null : rooms.first.id;
    String inspectionType = 'room_cleanliness';
    double score = 5;
    final notesCtrl = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('New Room Inspection'),
          content: SizedBox(
            width: 420,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: selectedRoomId,
                  decoration: const InputDecoration(labelText: 'Room'),
                  items: rooms
                      .map((room) => DropdownMenuItem(
                            value: room.id,
                            child: Text('Room ${room.number}'),
                          ))
                      .toList(),
                  onChanged: (value) =>
                      setDialogState(() => selectedRoomId = value),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: inspectionType,
                  decoration:
                      const InputDecoration(labelText: 'Inspection Type'),
                  items: const [
                    DropdownMenuItem(
                        value: 'room_cleanliness',
                        child: Text('Room Cleanliness')),
                    DropdownMenuItem(
                        value: 'checkout_quality',
                        child: Text('Checkout Quality')),
                    DropdownMenuItem(
                        value: 'vip_readiness', child: Text('VIP Readiness')),
                  ],
                  onChanged: (value) => setDialogState(
                      () => inspectionType = value ?? inspectionType),
                ),
                const SizedBox(height: 12),
                Slider(
                  value: score,
                  min: 1,
                  max: 5,
                  divisions: 4,
                  label: score.toStringAsFixed(0),
                  onChanged: (value) => setDialogState(() => score = value),
                ),
                Text('Score ${score.toStringAsFixed(0)} / 5'),
                const SizedBox(height: 12),
                TextField(
                  controller: notesCtrl,
                  maxLines: 2,
                  decoration: const InputDecoration(labelText: 'Notes'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: selectedRoomId == null
                  ? null
                  : () async {
                      Navigator.pop(ctx);
                      try {
                        await ref.read(housekeepingRepositoryProvider).createInspection({
                          'roomId': selectedRoomId,
                          'inspectionType': inspectionType,
                          'cleanlinessScore': score,
                          'tidinessScore': score,
                          'bathroomScore': score,
                          'amenitiesScore': score,
                          'linensScore': score,
                          'maintenanceScore': score,
                          'notes': notesCtrl.text.trim(),
                        });
                        ref.invalidate(hkInspectionsProvider);
                        ref.invalidate(hkRoomsProvider);
                      } catch (e) {
                        if (context.mounted) {
                          AppNotifier.showSnackBar(
                              context, SnackBar(content: Text('Error: $e')));
                        }
                      }
                    },
              child: const Text('Submit'),
            ),
          ],
        ),
      ),
    ).whenComplete(notesCtrl.dispose);
  }
}

class _InventoryView extends ConsumerWidget {
  const _InventoryView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final suppliesAsync = ref.watch(hkSuppliesProvider);
    return _PageScaffold(
      title: 'Inventory & Linen Control',
      subtitle:
          'Excel-style stock view for consumables, linen, amenities, low-stock alerts, and supply requests.',
      trailing: OutlinedButton.icon(
        onPressed: () =>
            _showRequestDialog(context, ref, suppliesAsync.valueOrNull ?? []),
        icon: const Icon(Icons.add_shopping_cart, size: 18),
        label: const Text('Request Supplies'),
      ),
      child: AsyncValueWidget(
        value: suppliesAsync,
        data: (items) {
          if (items.isEmpty) return const EmptyState(message: 'No supplies data.');
          return _ExcelGrid(
            columns: const [
              'Item',
              'Category',
              'Unit',
              'Current Stock',
              'Min',
              'Status',
              'Action',
            ],
            rows: items.map((item) {
              final qty = _num(item['quantity'] ?? item['stock'] ?? item['current_stock']);
              final minQty = _num(item['min_quantity'] ?? item['reorder_level'] ?? 5);
              final low = qty <= minQty;
              return [
                '${item['name'] ?? item['item_name'] ?? 'Item'}',
                '${item['category'] ?? item['type'] ?? 'Housekeeping'}',
                '${item['unit'] ?? '-'}',
                qty.toStringAsFixed(qty.truncateToDouble() == qty ? 0 : 2),
                minQty.toStringAsFixed(minQty.truncateToDouble() == minQty ? 0 : 2),
                _Badge(low ? 'LOW' : 'OK', low ? AppColors.kError : AppColors.kSuccess),
                _GridAction(
                  label: 'Request',
                  onTap: () => _showRequestDialog(context, ref, [item]),
                ),
              ];
            }).toList(),
          );
        },
      ),
    );
  }

  void _showRequestDialog(
      BuildContext context, WidgetRef ref, List<Map<String, dynamic>> items) {
    String? selectedSupplyId =
        items.isEmpty ? null : '${items.first['id'] ?? ''}';
    final qtyCtrl = TextEditingController();
    String urgency = 'normal';
    showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Request Housekeeping Supplies'),
          content: SizedBox(
            width: 380,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue:
                      selectedSupplyId?.isEmpty == true ? null : selectedSupplyId,
                  decoration: const InputDecoration(labelText: 'Supply Item'),
                  items: items
                      .where((item) => '${item['id'] ?? ''}'.isNotEmpty)
                      .map((item) => DropdownMenuItem(
                            value: '${item['id']}',
                            child: Text(
                              '${item['name'] ?? item['item_name'] ?? 'Supply'}',
                            ),
                          ))
                      .toList(),
                  onChanged: (value) =>
                      setDialogState(() => selectedSupplyId = value),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: qtyCtrl,
                  keyboardType: TextInputType.number,
                  decoration:
                      const InputDecoration(labelText: 'Quantity Needed'),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: urgency,
                  decoration: const InputDecoration(labelText: 'Urgency'),
                  items: const [
                    DropdownMenuItem(value: 'low', child: Text('Low')),
                    DropdownMenuItem(value: 'normal', child: Text('Normal')),
                    DropdownMenuItem(value: 'high', child: Text('High')),
                    DropdownMenuItem(value: 'urgent', child: Text('Urgent')),
                  ],
                  onChanged: (value) =>
                      setDialogState(() => urgency = value ?? urgency),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: selectedSupplyId == null
                  ? null
                  : () async {
                      if (qtyCtrl.text.trim().isEmpty) return;
                      Navigator.pop(ctx);
                      try {
                        await ref
                            .read(housekeepingRepositoryProvider)
                            .requestSupplies({
                          'supply_id': selectedSupplyId,
                          'quantity': int.tryParse(qtyCtrl.text.trim()) ?? 1,
                          'urgency': urgency,
                        });
                        ref.invalidate(hkSuppliesProvider);
                        if (context.mounted) {
                          AppNotifier.showSnackBar(
                            context,
                            const SnackBar(
                                content: Text('Supply request submitted')),
                          );
                        }
                      } catch (e) {
                        if (context.mounted) {
                          AppNotifier.showSnackBar(
                              context, SnackBar(content: Text('Error: $e')));
                        }
                      }
                    },
              child: const Text('Submit'),
            ),
          ],
        ),
      ),
    ).whenComplete(() {
      qtyCtrl.dispose();
    });
  }
}

class _LostFoundView extends ConsumerWidget {
  const _LostFoundView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final itemsAsync = ref.watch(hkLostFoundProvider);
    return _PageScaffold(
      title: 'Lost & Found',
      subtitle: 'Record found items, location, date, and claim status.',
      trailing: ElevatedButton.icon(
        onPressed: () => _showReportDialog(context, ref),
        icon: const Icon(Icons.add, size: 18),
        label: const Text('Report Item'),
      ),
      child: AsyncValueWidget(
        value: itemsAsync,
        data: (items) {
          if (items.isEmpty) {
            return const EmptyState(message: 'No lost and found items.');
          }
          return _ExcelGrid(
            columns: const ['Item', 'Location', 'Found Date', 'Status', 'Action'],
            rows: items.map((item) {
              final id = '${item['id'] ?? ''}';
              final status = '${item['status'] ?? 'found'}';
              return [
                '${item['item_description'] ?? item['item_name'] ?? item['description'] ?? 'Item'}',
                '${item['found_location'] ?? item['location'] ?? item['room'] ?? '-'}',
                _dateText(item['found_at'] ?? item['created_at'] ?? item['found_date']),
                _Badge(_pretty(status),
                    status == 'claimed' ? AppColors.kSuccess : AppColors.kPrimary),
                status == 'claimed'
                    ? const Text('Closed',
                        style: TextStyle(color: AppColors.kTextSecondary))
                    : _GridAction(
                        label: 'Claimed',
                        onTap: () async {
                          await ref
                              .read(housekeepingRepositoryProvider)
                              .updateLostFoundStatus(id, 'claimed');
                          ref.invalidate(hkLostFoundProvider);
                        },
                      ),
              ];
            }).toList(),
          );
        },
      ),
    );
  }

  void _showReportDialog(BuildContext context, WidgetRef ref) {
    final locationCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final valueCtrl = TextEditingController();
    String category = 'other';
    showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Report Lost & Found Item'),
          content: SizedBox(
            width: 380,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                    controller: descCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Item Description'),
                    maxLines: 2),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: category,
                  decoration: const InputDecoration(labelText: 'Category'),
                  items: const [
                    DropdownMenuItem(value: 'electronics', child: Text('Electronics')),
                    DropdownMenuItem(value: 'clothing', child: Text('Clothing')),
                    DropdownMenuItem(value: 'documents', child: Text('Documents')),
                    DropdownMenuItem(value: 'jewelry', child: Text('Jewelry')),
                    DropdownMenuItem(value: 'other', child: Text('Other')),
                  ],
                  onChanged: (value) =>
                      setDialogState(() => category = value ?? category),
                ),
                const SizedBox(height: 12),
                TextField(
                    controller: locationCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Found Location')),
                const SizedBox(height: 12),
                TextField(
                  controller: valueCtrl,
                  keyboardType: TextInputType.number,
                  decoration:
                      const InputDecoration(labelText: 'Estimated Value'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                if (descCtrl.text.trim().isEmpty) return;
                Navigator.pop(ctx);
                try {
                  final estimatedValue =
                      num.tryParse(valueCtrl.text.trim()) ?? 0;
                  await ref
                      .read(housekeepingRepositoryProvider)
                      .reportLostFoundItem({
                    'itemDescription': descCtrl.text.trim(),
                    'itemCategory': category,
                    'foundLocation': locationCtrl.text.trim(),
                    'estimatedValue': estimatedValue,
                    'isValuable': estimatedValue > 1000,
                  });
                  ref.invalidate(hkLostFoundProvider);
                  if (context.mounted) {
                    AppNotifier.showSnackBar(
                      context,
                      const SnackBar(content: Text('Lost item reported')),
                    );
                  }
                } catch (e) {
                  if (context.mounted) {
                    AppNotifier.showSnackBar(
                        context, SnackBar(content: Text('Error: $e')));
                  }
                }
              },
              child: const Text('Report'),
            ),
          ],
        ),
      ),
    ).whenComplete(() {
      locationCtrl.dispose();
      descCtrl.dispose();
      valueCtrl.dispose();
    });
  }
}

class _ScheduleView extends ConsumerWidget {
  const _ScheduleView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheduleAsync = ref.watch(hkScheduleProvider);
    final staffAsync = ref.watch(hkStaffProvider);
    final shiftsAsync = ref.watch(hkShiftDefinitionsProvider);
    return _PageScaffold(
      title: 'Staff Schedule',
      subtitle: 'Shift roster, assigned areas, room ranges, and daily coverage.',
      trailing: ElevatedButton.icon(
        onPressed: () => _showScheduleDialog(
          context,
          ref,
          staffAsync.valueOrNull ?? const [],
          shiftsAsync.valueOrNull ?? const [],
        ),
        icon: const Icon(Icons.add, size: 18),
        label: const Text('Add Entry'),
      ),
      child: AsyncValueWidget(
        value: scheduleAsync,
        data: (entries) {
          if (entries.isEmpty) {
            return const EmptyState(message: 'No schedule entries.');
          }
          return _ExcelGrid(
            columns: const ['Staff', 'Shift', 'Area / Rooms', 'Start', 'End'],
            rows: entries
                .map((entry) => [
                      _staffName(entry['staff']),
                      _shiftName(entry['shift']),
                      '${entry['assigned_sections'] ?? entry['assigned_floors'] ?? '-'}',
                      _shiftTime(entry['shift'], 'start_time',
                          fallback: entry['start_time']),
                      _shiftTime(entry['shift'], 'end_time',
                          fallback: entry['end_time']),
                    ])
                .toList(),
          );
        },
      ),
    );
  }

  void _showScheduleDialog(
    BuildContext context,
    WidgetRef ref,
    List<Map<String, dynamic>> staff,
    List<Map<String, dynamic>> shifts,
  ) {
    String? selectedStaffId = staff.isEmpty ? null : '${staff.first['id']}';
    String? selectedShiftId = shifts.isEmpty ? null : '${shifts.first['id']}';
    final sectionsCtrl = TextEditingController();
    final floorsCtrl = TextEditingController();
    DateTime scheduleDate = DateTime.now();
    showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Add Schedule Entry'),
          content: SizedBox(
            width: 360,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: selectedStaffId,
                  decoration: const InputDecoration(labelText: 'Staff'),
                  items: staff
                      .where((item) => '${item['id'] ?? ''}'.isNotEmpty)
                      .map((item) => DropdownMenuItem(
                            value: '${item['id']}',
                            child: Text(_staffName(item)),
                          ))
                      .toList(),
                  onChanged: (value) =>
                      setDialogState(() => selectedStaffId = value),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: selectedShiftId,
                  decoration: const InputDecoration(labelText: 'Shift'),
                  items: shifts
                      .where((item) => '${item['id'] ?? ''}'.isNotEmpty)
                      .map((item) => DropdownMenuItem(
                            value: '${item['id']}',
                            child: Text(_shiftName(item)),
                          ))
                      .toList(),
                  onChanged: (value) =>
                      setDialogState(() => selectedShiftId = value),
                ),
                const SizedBox(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Schedule Date'),
                  subtitle: Text(_date(scheduleDate)),
                  trailing: const Icon(Icons.calendar_month_outlined),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: ctx,
                      initialDate: scheduleDate,
                      firstDate: DateTime.now().subtract(const Duration(days: 7)),
                      lastDate: DateTime.now().add(const Duration(days: 90)),
                    );
                    if (picked != null) {
                      setDialogState(() => scheduleDate = picked);
                    }
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: floorsCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Assigned Floors (comma separated)'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: sectionsCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Assigned Sections'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: selectedStaffId == null || selectedShiftId == null
                  ? null
                  : () async {
                      Navigator.pop(ctx);
                      try {
                        await ref
                            .read(housekeepingRepositoryProvider)
                            .createScheduleEntry({
                          'staffId': selectedStaffId,
                          'shiftId': selectedShiftId,
                          'scheduleDate': _date(scheduleDate),
                          'assignedFloors': floorsCtrl.text
                              .split(',')
                              .map((value) => int.tryParse(value.trim()))
                              .whereType<int>()
                              .toList(),
                          'assignedSections': sectionsCtrl.text
                              .split(',')
                              .map((value) => value.trim())
                              .where((value) => value.isNotEmpty)
                              .toList(),
                        });
                        ref.invalidate(hkScheduleProvider);
                        if (context.mounted) {
                          AppNotifier.showSnackBar(
                            context,
                            const SnackBar(
                                content: Text('Schedule entry created')),
                          );
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
      ),
    ).whenComplete(() {
      sectionsCtrl.dispose();
      floorsCtrl.dispose();
    });
  }
}

class _ReportsView extends ConsumerWidget {
  const _ReportsView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final roomsAsync = ref.watch(hkRoomsProvider);
    final tasksAsync = ref.watch(hkTasksProvider(null));
    final inspectionsAsync = ref.watch(hkInspectionsProvider);
    return _PageScaffold(
      title: 'Reports & Analytics',
      subtitle:
          'Room readiness, cleaning workload, inspection quality, and resource risk.',
      child: _AsyncTriple(
        a: roomsAsync,
        b: tasksAsync,
        c: inspectionsAsync,
        builder: (rooms, tasks, inspections) {
          final completed = tasks.where((t) => t.status == 'completed').length;
          final open = tasks.length - completed;
          final passCount = inspections
              .where((i) => '${i['result'] ?? i['status']}'.contains('pass'))
              .length;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 14,
                runSpacing: 14,
                children: [
                  _MetricCard('Rooms Tracked', '${rooms.length}',
                      Icons.meeting_room_outlined, AppColors.kPrimary),
                  _MetricCard('Completed Tasks', '$completed',
                      Icons.task_alt_outlined, AppColors.kSuccess),
                  _MetricCard('Open Tasks', '$open',
                      Icons.pending_actions_outlined, AppColors.kWarning),
                  _MetricCard('Passed Inspections', '$passCount',
                      Icons.verified_outlined, AppColors.kSuccess),
                ],
              ),
              const SizedBox(height: 18),
              _ExcelGrid(
                columns: const ['Metric', 'Value', 'Signal'],
                rows: [
                  ['Task completion rate', _percent(completed, tasks.length), 'Productivity'],
                  ['Clean room ratio', _percent(rooms.where((r) => _cleanStatuses.contains(r.status)).length, rooms.length), 'Readiness'],
                  ['Inspection pass rate', _percent(passCount, inspections.length), 'Quality'],
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

class _PageScaffold extends StatelessWidget {
  const _PageScaffold({
    required this.title,
    required this.subtitle,
    required this.child,
    this.trailing,
  });

  final String title;
  final String subtitle;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: const TextStyle(
                            fontSize: 30, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 6),
                    Text(subtitle,
                        style: const TextStyle(
                            color: AppColors.kTextSecondary, fontSize: 15)),
                  ],
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: 22),
          child,
        ],
      ),
    );
  }
}

class _ExcelGrid extends StatelessWidget {
  const _ExcelGrid({required this.columns, required this.rows});

  final List<String> columns;
  final List<List<Object?>> rows;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.85)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          headingRowColor:
              WidgetStateProperty.all(const Color(0xFFEAF7EE)),
          dataRowMinHeight: 54,
          dataRowMaxHeight: 76,
          headingTextStyle: const TextStyle(
            color: Color(0xFF155E35),
            fontWeight: FontWeight.w900,
            fontSize: 12,
          ),
          border: TableBorder.all(
            color: const Color(0xFFD3E4D8),
            width: 0.8,
          ),
          columns: [
            const DataColumn(label: Text('#')),
            for (final column in columns) DataColumn(label: Text(column)),
          ],
          rows: [
            for (var i = 0; i < rows.length; i++)
              DataRow(cells: [
                DataCell(Text('${i + 1}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: AppColors.kTextSecondary))),
                for (final value in rows[i])
                  DataCell(value is Widget
                      ? value
                      : Text('$value',
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 13))),
              ]),
          ],
        ),
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard(this.label, this.value, this.icon, this.color);

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 230,
      child: Card(
        elevation: 0,
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: color.withValues(alpha: 0.12),
                child: Icon(icon, color: color),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label,
                        style: const TextStyle(
                            color: AppColors.kTextSecondary, fontSize: 12)),
                    Text(value,
                        style: const TextStyle(
                            fontSize: 24, fontWeight: FontWeight.w900)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style:
                    const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _CompactTile extends StatelessWidget {
  const _CompactTile({
    required this.title,
    required this.subtitle,
    required this.trailing,
    required this.color,
  });

  final String title;
  final String subtitle;
  final String trailing;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: CircleAvatar(
        backgroundColor: color.withValues(alpha: 0.12),
        child: Icon(Icons.auto_awesome_outlined, color: color, size: 18),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
      subtitle: Text(subtitle),
      trailing: _Badge(_pretty(trailing), color),
    );
  }
}

class _MiniRoomGrid extends StatelessWidget {
  const _MiniRoomGrid({required this.rooms});

  final List<HkRoom> rooms;

  @override
  Widget build(BuildContext context) {
    if (rooms.isEmpty) return const EmptyState(message: 'No rooms found.');
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: rooms.map((room) {
        final color = _roomColor(room.status);
        return Container(
          width: 70,
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: color.withValues(alpha: 0.5)),
          ),
          child: Column(
            children: [
              Text('${room.number}',
                  style: TextStyle(
                      color: color, fontWeight: FontWeight.w900, fontSize: 16)),
              Text(_shortStatus(room.status),
                  style: TextStyle(color: color, fontSize: 10)),
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge(this.label, this.color);

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label,
          style:
              TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w900)),
    );
  }
}

class _TinyAction extends StatelessWidget {
  const _TinyAction({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.kDivider),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(label,
            style:
                const TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
      ),
    );
  }
}

class _StatusLegend extends StatelessWidget {
  const _StatusLegend(this.label, this.color);

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    );
  }
}

class _FilterChipButton extends StatelessWidget {
  const _FilterChipButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
      selectedColor: AppColors.kPrimary.withValues(alpha: 0.14),
      labelStyle: TextStyle(
        color: selected ? AppColors.kPrimary : AppColors.kTextPrimary,
        fontWeight: FontWeight.w800,
      ),
    );
  }
}

class _GridAction extends StatelessWidget {
  const _GridAction({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return TextButton(onPressed: onTap, child: Text(label));
  }
}

class _AsyncTriple<A, B, C> extends StatelessWidget {
  const _AsyncTriple({
    required this.a,
    required this.b,
    required this.c,
    required this.builder,
  });

  final AsyncValue<A> a;
  final AsyncValue<B> b;
  final AsyncValue<C> c;
  final Widget Function(A a, B b, C c) builder;

  @override
  Widget build(BuildContext context) {
    if (a.isLoading || b.isLoading || c.isLoading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: CircularProgressIndicator(),
        ),
      );
    }
    final error = a.error ?? b.error ?? c.error;
    if (error != null) {
      return EmptyState(message: 'Could not load housekeeping data: $error');
    }
    final av = a.valueOrNull;
    final bv = b.valueOrNull;
    final cv = c.valueOrNull;
    if (av == null || bv == null || cv == null) {
      return const EmptyState(message: 'Housekeeping data is not available.');
    }
    return builder(av, bv, cv);
  }
}

const _cleanStatuses = {
  'clean',
  'available',
  'vacant_clean',
  'occupied_clean',
  'inspected',
  'ready',
  'turndown_complete',
};

const _dirtyStatuses = {
  'dirty',
  'cleaning',
  'vacant_dirty',
  'occupied_dirty',
  'checkout_dirty',
  'cleaning_in_progress',
  'checkout',
  'stay_over',
  'early_makeup',
  'late_checkout',
  'turndown_pending',
  'needs_cleaning',
};

Color _roomColor(String status) {
  final normalized = status.toLowerCase();
  if (_cleanStatuses.contains(normalized)) return AppColors.kSuccess;
  if (normalized.contains('occupied')) return AppColors.kPrimary;
  if (normalized.contains('order') || normalized.contains('maintenance')) {
    return AppColors.kError;
  }
  return AppColors.kWarning;
}

Color _taskColor(String status) {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'inspection_passed':
      return AppColors.kSuccess;
    case 'in_progress':
    case 'pending':
      return AppColors.kWarning;
    case 'failed':
    case 'inspection_failed':
      return AppColors.kError;
    default:
      return AppColors.kPrimary;
  }
}

bool _isLowSupply(Map<String, dynamic> item) {
  final qty = _num(item['quantity'] ?? item['stock'] ?? item['current_stock']);
  final minQty = _num(item['min_quantity'] ?? item['reorder_level'] ?? 5);
  return qty <= minQty;
}

num _num(dynamic value) {
  if (value is num) return value;
  return num.tryParse('$value') ?? 0;
}

String _pretty(String value) {
  final text = value.replaceAll('_', ' ').trim();
  if (text.isEmpty || text == 'null') return '-';
  return text
      .split(' ')
      .map((part) =>
          part.isEmpty ? part : '${part[0].toUpperCase()}${part.substring(1)}')
      .join(' ');
}

String _shortStatus(String status) {
  final pretty = _pretty(status);
  if (pretty.length <= 8) return pretty;
  return pretty.substring(0, 8);
}

String _date(DateTime date) =>
    '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

String _dateText(dynamic value) {
  final parsed = DateTime.tryParse('$value');
  return parsed == null ? '-' : _date(parsed);
}

String _staffName(dynamic value) {
  if (value is! Map) return '${value ?? 'Staff'}';
  final user = value['user'];
  final firstName = user is Map ? '${user['first_name'] ?? ''}' : '';
  final lastName = user is Map ? '${user['last_name'] ?? ''}' : '';
  final fullName = '$firstName $lastName'.trim();
  if (fullName.isNotEmpty) return fullName;
  final directName = '${value['first_name'] ?? ''} ${value['last_name'] ?? ''}'.trim();
  if (directName.isNotEmpty) return directName;
  return '${value['staff_code'] ?? value['designation'] ?? 'Staff'}';
}

String _shiftName(dynamic value) {
  if (value is! Map) return '${value ?? 'Shift'}';
  final name = '${value['name'] ?? value['shift_type'] ?? 'Shift'}';
  final start = value['start_time'];
  final end = value['end_time'];
  if (start == null && end == null) return _pretty(name);
  return '${_pretty(name)} (${start ?? '-'}-${end ?? '-'})';
}

String _shiftTime(dynamic value, String key, {dynamic fallback}) {
  if (value is Map && value[key] != null) return '${value[key]}';
  return '${fallback ?? '-'}';
}

String _percent(int part, int total) {
  if (total <= 0) return '0%';
  return '${((part / total) * 100).toStringAsFixed(0)}%';
}
