import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/repository.dart';
import '../domain/providers.dart';

final _hkTaskFilterProvider = StateProvider<String?>((ref) => null);

class HousekeepingScreen extends ConsumerStatefulWidget {
  const HousekeepingScreen({super.key});

  @override
  ConsumerState<HousekeepingScreen> createState() => _HousekeepingScreenState();
}

class _HousekeepingScreenState extends ConsumerState<HousekeepingScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Housekeeping'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          Container(
            color: Colors.white,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _tabBtn('Rooms', 0),
                  _tabBtn('Tasks', 1),
                  _tabBtn('Inspections', 2),
                  _tabBtn('Lost & Found', 3),
                  _tabBtn('Supplies', 4),
                  _tabBtn('Schedule', 5),
                ],
              ),
            ),
          ),
          Expanded(
            child: IndexedStack(
              index: _tab,
              children: const [
                _RoomsView(),
                _TasksView(),
                _InspectionsView(),
                _LostFoundView(),
                _SuppliesView(),
                _ScheduleView(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _tabBtn(String label, int index) {
    final selected = _tab == index;
    return InkWell(
      onTap: () => setState(() => _tab = index),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
        decoration: BoxDecoration(
          border: Border(
              bottom: BorderSide(
            color: selected ? AppColors.kPrimary : Colors.transparent,
            width: 2,
          )),
        ),
        child: Text(label,
            style: TextStyle(
              fontWeight: selected ? FontWeight.bold : FontWeight.normal,
              color: selected ? AppColors.kPrimary : AppColors.kTextSecondary,
            )),
      ),
    );
  }
}

class _RoomsView extends ConsumerWidget {
  const _RoomsView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final roomsAsync = ref.watch(hkRoomsProvider);
    return AsyncValueWidget(
      value: roomsAsync,
      data: (rooms) {
        if (rooms.isEmpty) return const EmptyState(message: 'No rooms');
        return GridView.builder(
          padding: const EdgeInsets.all(16),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 5,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
          ),
          itemCount: rooms.length,
          itemBuilder: (context, index) {
            final room = rooms[index];
            final color = room.status == 'clean'
                ? AppColors.kSuccess
                : room.status == 'occupied'
                    ? AppColors.kWarning
                    : AppColors.kError;
            return Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: color, width: 2),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('${room.number}',
                      style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: color)),
                  const SizedBox(height: 4),
                  Text(room.status,
                      style: TextStyle(fontSize: 10, color: color)),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

// ─── Inspections ──────────────────────────────────────────────────────────────

class _InspectionsView extends ConsumerWidget {
  const _InspectionsView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inspAsync = ref.watch(hkInspectionsProvider);
    return Column(children: [
      Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Room Inspections',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
            ElevatedButton.icon(
              onPressed: () => _showNewInspectionDialog(context, ref),
              icon: const Icon(Icons.add, size: 16),
              label: const Text('New Inspection'),
              style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.kPrimary,
                  foregroundColor: Colors.white),
            ),
          ],
        ),
      ),
      Expanded(
        child: AsyncValueWidget(
          value: inspAsync,
          data: (items) {
            if (items.isEmpty) {
              return const EmptyState(message: 'No inspections recorded');
            }
            return ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: items.length,
              itemBuilder: (_, i) {
                final item = items[i];
                final passed =
                    item['result'] == 'pass' || item['status'] == 'passed';
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor:
                          (passed ? AppColors.kSuccess : AppColors.kError)
                              .withValues(alpha: 0.1),
                      child: Icon(passed ? Icons.check : Icons.close,
                          color: passed ? AppColors.kSuccess : AppColors.kError,
                          size: 18),
                    ),
                    title: Text(
                        'Room ${item['room_number'] ?? item['room'] ?? '—'}',
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(
                        'Inspector: ${item['inspector_name'] ?? item['inspected_by'] ?? '—'}\nDate: ${(item['created_at'] ?? item['date'] ?? '').toString().split('T').first}'),
                    isThreeLine: true,
                    trailing: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: (passed ? AppColors.kSuccess : AppColors.kError)
                            .withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(passed ? 'PASS' : 'FAIL',
                          style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: passed
                                  ? AppColors.kSuccess
                                  : AppColors.kError)),
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    ]);
  }

  void _showNewInspectionDialog(BuildContext context, WidgetRef ref) {
    final roomCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    String result = 'pass';
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => AlertDialog(
          title: const Text('New Inspection'),
          content: SizedBox(
            width: 320,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(
                  controller: roomCtrl,
                  decoration: const InputDecoration(labelText: 'Room Number')),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: result,
                decoration: const InputDecoration(labelText: 'Result'),
                items: const [
                  DropdownMenuItem(value: 'pass', child: Text('Pass')),
                  DropdownMenuItem(value: 'fail', child: Text('Fail')),
                ],
                onChanged: (v) => set(() => result = v ?? result),
              ),
              const SizedBox(height: 12),
              TextField(
                  controller: notesCtrl,
                  decoration: const InputDecoration(labelText: 'Notes'),
                  maxLines: 2),
            ]),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                if (roomCtrl.text.trim().isEmpty) return;
                Navigator.pop(ctx);
                try {
                  await ref
                      .read(housekeepingRepositoryProvider)
                      .createInspection({
                    'room_number': roomCtrl.text.trim(),
                    'result': result,
                    'notes': notesCtrl.text,
                  });
                  ref.invalidate(hkInspectionsProvider);
                  if (context.mounted) {
                    AppNotifier.showSnackBar(context,
                        const SnackBar(content: Text('Inspection recorded')));
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
}

// ─── Lost & Found ──────────────────────────────────────────────────────────────

class _LostFoundView extends ConsumerWidget {
  const _LostFoundView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lfAsync = ref.watch(hkLostFoundProvider);
    return Column(children: [
      Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Lost & Found',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
            ElevatedButton.icon(
              onPressed: () => _showReportDialog(context, ref),
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Report Item'),
              style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.kPrimary,
                  foregroundColor: Colors.white),
            ),
          ],
        ),
      ),
      Expanded(
        child: AsyncValueWidget(
          value: lfAsync,
          data: (items) {
            if (items.isEmpty) {
              return const EmptyState(message: 'No lost & found items');
            }
            return ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: items.length,
              itemBuilder: (ctx, i) {
                final item = items[i];
                final status = (item['status'] ?? 'found').toString();
                final isClaimed = status == 'claimed';
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor:
                          AppColors.kPrimary.withValues(alpha: 0.1),
                      child: Icon(PhosphorIcons.package(),
                          color: AppColors.kPrimary, size: 18),
                    ),
                    title: Text(
                        (item['item_name'] ?? item['description'] ?? 'Item')
                            .toString(),
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(
                        'Location: ${item['location'] ?? item['room'] ?? '—'}  •  '
                        'Found: ${(item['created_at'] ?? item['found_date'] ?? '').toString().split('T').first}'),
                    trailing: isClaimed
                        ? const Chip(
                            label:
                                Text('Claimed', style: TextStyle(fontSize: 11)))
                        : TextButton(
                            onPressed: () async {
                              final id = (item['id'] ?? '').toString();
                              await ref
                                  .read(housekeepingRepositoryProvider)
                                  .updateLostFoundStatus(id, 'claimed');
                              ref.invalidate(hkLostFoundProvider);
                            },
                            child: const Text('Mark Claimed'),
                          ),
                  ),
                );
              },
            );
          },
        ),
      ),
    ]);
  }

  void _showReportDialog(BuildContext context, WidgetRef ref) {
    final nameCtrl = TextEditingController();
    final locationCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Report Lost & Found Item'),
        content: SizedBox(
          width: 320,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Item Name')),
            const SizedBox(height: 12),
            TextField(
                controller: locationCtrl,
                decoration: const InputDecoration(
                    labelText: 'Found Location (Room/Area)')),
            const SizedBox(height: 12),
            TextField(
                controller: descCtrl,
                decoration: const InputDecoration(labelText: 'Description'),
                maxLines: 2),
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
                await ref
                    .read(housekeepingRepositoryProvider)
                    .reportLostFoundItem({
                  'item_name': nameCtrl.text.trim(),
                  'location': locationCtrl.text.trim(),
                  'description': descCtrl.text,
                  'status': 'found',
                });
                ref.invalidate(hkLostFoundProvider);
                if (context.mounted) {
                  AppNotifier.showSnackBar(
                      context, const SnackBar(content: Text('Item reported')));
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
    );
  }
}

// ─── Supplies Inventory ────────────────────────────────────────────────────────

class _SuppliesView extends ConsumerWidget {
  const _SuppliesView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final suppliesAsync = ref.watch(hkSuppliesProvider);
    return Column(children: [
      Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Supplies Inventory',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
            OutlinedButton.icon(
              onPressed: () => _showRequestDialog(
                  context, ref, suppliesAsync.valueOrNull ?? []),
              icon: const Icon(Icons.add_shopping_cart, size: 16),
              label: const Text('Request Supplies'),
            ),
          ],
        ),
      ),
      Expanded(
        child: AsyncValueWidget(
          value: suppliesAsync,
          data: (items) {
            if (items.isEmpty) {
              return const EmptyState(message: 'No supplies data');
            }
            return ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: items.length,
              itemBuilder: (_, i) {
                final item = items[i];
                final qty = (item['quantity'] ?? item['stock'] ?? 0) as num;
                final minQty =
                    (item['min_quantity'] ?? item['reorder_level'] ?? 5) as num;
                final isLow = qty <= minQty;
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor:
                          (isLow ? AppColors.kError : AppColors.kSuccess)
                              .withValues(alpha: 0.1),
                      child: Icon(PhosphorIcons.package(),
                          color: isLow ? AppColors.kError : AppColors.kSuccess,
                          size: 18),
                    ),
                    title: Text(
                        (item['name'] ?? item['item_name'] ?? 'Item')
                            .toString(),
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle:
                        Text('Unit: ${item['unit'] ?? '—'}  •  Min: $minQty'),
                    trailing: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: (isLow ? AppColors.kError : AppColors.kSuccess)
                            .withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text('$qty',
                          style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: isLow
                                  ? AppColors.kError
                                  : AppColors.kSuccess)),
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    ]);
  }

  void _showRequestDialog(
      BuildContext context, WidgetRef ref, List<Map<String, dynamic>> items) {
    final itemCtrl = TextEditingController();
    final qtyCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Request Supplies'),
        content: SizedBox(
          width: 300,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(
                controller: itemCtrl,
                decoration: const InputDecoration(labelText: 'Item Name')),
            const SizedBox(height: 12),
            TextField(
                controller: qtyCtrl,
                keyboardType: TextInputType.number,
                decoration:
                    const InputDecoration(labelText: 'Quantity Needed')),
          ]),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (itemCtrl.text.trim().isEmpty || qtyCtrl.text.trim().isEmpty) {
                return;
              }
              Navigator.pop(ctx);
              try {
                await ref.read(housekeepingRepositoryProvider).requestSupplies({
                  'item_name': itemCtrl.text.trim(),
                  'quantity': int.tryParse(qtyCtrl.text.trim()) ?? 1,
                });
                ref.invalidate(hkSuppliesProvider);
                if (context.mounted) {
                  AppNotifier.showSnackBar(
                      context,
                      const SnackBar(
                          content: Text('Supply request submitted')));
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
    );
  }
}

// ─── Schedule ──────────────────────────────────────────────────────────────────

class _ScheduleView extends ConsumerWidget {
  const _ScheduleView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final schedAsync = ref.watch(hkScheduleProvider);
    final today = DateTime.now();
    final todayStr =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    return Column(children: [
      Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Schedule — $todayStr',
                style:
                    const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
            ElevatedButton.icon(
              onPressed: () => _showAddEntryDialog(context, ref),
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Add Entry'),
              style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.kPrimary,
                  foregroundColor: Colors.white),
            ),
          ],
        ),
      ),
      Expanded(
        child: AsyncValueWidget(
          value: schedAsync,
          data: (entries) {
            if (entries.isEmpty) {
              return const EmptyState(message: 'No schedule entries');
            }
            return ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: entries.length,
              itemBuilder: (_, i) {
                final e = entries[i];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor:
                          AppColors.kPrimary.withValues(alpha: 0.1),
                      child: Icon(PhosphorIcons.clock(),
                          color: AppColors.kPrimary, size: 18),
                    ),
                    title: Text(
                        (e['staff_name'] ?? e['employee'] ?? 'Staff')
                            .toString(),
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(
                      'Shift: ${e['shift'] ?? e['shift_type'] ?? '—'}  •  '
                      'Area: ${e['area'] ?? e['room_range'] ?? '—'}',
                    ),
                    trailing: Text(
                      '${e['start_time'] ?? '—'} – ${e['end_time'] ?? '—'}',
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.kTextSecondary),
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    ]);
  }

  void _showAddEntryDialog(BuildContext context, WidgetRef ref) {
    final staffCtrl = TextEditingController();
    final areaCtrl = TextEditingController();
    String shift = 'morning';
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => AlertDialog(
          title: const Text('Add Schedule Entry'),
          content: SizedBox(
            width: 320,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(
                  controller: staffCtrl,
                  decoration: const InputDecoration(labelText: 'Staff Name')),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: shift,
                decoration: const InputDecoration(labelText: 'Shift'),
                items: const [
                  DropdownMenuItem(value: 'morning', child: Text('Morning')),
                  DropdownMenuItem(
                      value: 'afternoon', child: Text('Afternoon')),
                  DropdownMenuItem(value: 'evening', child: Text('Evening')),
                  DropdownMenuItem(value: 'night', child: Text('Night')),
                ],
                onChanged: (v) => set(() => shift = v ?? shift),
              ),
              const SizedBox(height: 12),
              TextField(
                  controller: areaCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Assigned Area/Rooms')),
            ]),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                if (staffCtrl.text.trim().isEmpty) return;
                Navigator.pop(ctx);
                try {
                  await ref
                      .read(housekeepingRepositoryProvider)
                      .createScheduleEntry({
                    'staff_name': staffCtrl.text.trim(),
                    'shift': shift,
                    'area': areaCtrl.text.trim(),
                  });
                  ref.invalidate(hkScheduleProvider);
                  if (context.mounted) {
                    AppNotifier.showSnackBar(context,
                        const SnackBar(content: Text('Schedule entry added')));
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
    );
  }
}

class _TasksView extends ConsumerWidget {
  const _TasksView();

  static const _taskTypes = [
    'Cleaning',
    'Inspection',
    'Maintenance',
    'Laundry',
    'Turndown',
    'Deep Clean'
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statusFilter = ref.watch(_hkTaskFilterProvider);
    final tasksAsync = ref.watch(hkTasksProvider(statusFilter));
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          color: Colors.white,
          child: Row(
            children: [
              DropdownButton<String?>(
                value: statusFilter,
                hint: const Text('All Statuses'),
                items: const [
                  DropdownMenuItem(value: null, child: Text('All')),
                  DropdownMenuItem(value: 'pending', child: Text('Pending')),
                  DropdownMenuItem(
                      value: 'in_progress', child: Text('In Progress')),
                  DropdownMenuItem(
                      value: 'completed', child: Text('Completed')),
                ],
                onChanged: (v) =>
                    ref.read(_hkTaskFilterProvider.notifier).state = v,
              ),
              const Spacer(),
              ElevatedButton.icon(
                onPressed: () => _showCreateTaskDialog(context, ref),
                icon: const Icon(Icons.add, size: 18),
                label: const Text('New Task'),
                style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.kPrimary,
                    foregroundColor: Colors.white),
              ),
            ],
          ),
        ),
        Expanded(
          child: AsyncValueWidget(
            value: tasksAsync,
            data: (tasks) {
              if (tasks.isEmpty) return const EmptyState(message: 'No tasks');
              return ListView.builder(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                itemCount: tasks.length,
                itemBuilder: (context, index) {
                  final task = tasks[index];
                  final color = task.status == 'completed'
                      ? AppColors.kSuccess
                      : task.status == 'in_progress'
                          ? AppColors.kWarning
                          : AppColors.kTextSecondary;
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: color.withValues(alpha: 0.1),
                        child: Icon(PhosphorIcons.sparkle(),
                            color: color, size: 18),
                      ),
                      title: Text(task.taskType,
                          style: const TextStyle(fontWeight: FontWeight.bold)),
                      subtitle: Text('Room ${task.roomNumber ?? 'N/A'}'),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(8)),
                            child: Text(task.status,
                                style: TextStyle(
                                    color: color,
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold)),
                          ),
                          if (task.status == 'pending') ...[
                            const SizedBox(width: 4),
                            IconButton(
                              tooltip: 'Start',
                              icon: const Icon(Icons.play_arrow,
                                  color: AppColors.kWarning, size: 20),
                              onPressed: () async {
                                await ref
                                    .read(housekeepingRepositoryProvider)
                                    .updateTaskStatus(task.id, 'in_progress');
                                ref.invalidate(hkTasksProvider(
                                    ref.read(_hkTaskFilterProvider)));
                              },
                            ),
                          ],
                          if (task.status == 'in_progress') ...[
                            const SizedBox(width: 4),
                            IconButton(
                              tooltip: 'Complete',
                              icon: const Icon(Icons.check_circle,
                                  color: AppColors.kSuccess, size: 20),
                              onPressed: () async {
                                await ref
                                    .read(housekeepingRepositoryProvider)
                                    .updateTaskStatus(task.id, 'completed');
                                ref.invalidate(hkTasksProvider(
                                    ref.read(_hkTaskFilterProvider)));
                              },
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }

  void _showCreateTaskDialog(BuildContext context, WidgetRef ref) {
    final roomCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    String selectedType = _taskTypes.first;
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlgState) => AlertDialog(
          title: const Text('New Housekeeping Task'),
          content: SizedBox(
            width: 340,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: roomCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Room Number', hintText: 'e.g. 101'),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: selectedType,
                  decoration: const InputDecoration(labelText: 'Task Type'),
                  items: _taskTypes
                      .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                      .toList(),
                  onChanged: (v) =>
                      setDlgState(() => selectedType = v ?? selectedType),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: notesCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Notes (optional)'),
                  maxLines: 2,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                if (roomCtrl.text.trim().isEmpty) return;
                Navigator.of(ctx).pop();
                try {
                  await ref.read(housekeepingRepositoryProvider).createTask({
                    'room_number': roomCtrl.text.trim(),
                    'task_type':
                        selectedType.toLowerCase().replaceAll(' ', '_'),
                    'notes': notesCtrl.text,
                    'status': 'pending',
                  });
                  ref.invalidate(
                      hkTasksProvider(ref.read(_hkTaskFilterProvider)));
                  if (context.mounted) {
                    AppNotifier.showSnackBar(
                        context, const SnackBar(content: Text('Task created')));
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
    );
  }
}
