import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../../core/widgets/record_detail_screen.dart';
import '../domain/providers.dart';
import '../data/repository.dart';

final _branchOpsReservationFiltersProvider =
    StateProvider<Map<String, String?>>((ref) => const {});

class BranchOperationsDashboard extends ConsumerStatefulWidget {
  const BranchOperationsDashboard({super.key});

  @override
  ConsumerState<BranchOperationsDashboard> createState() =>
      _BranchOperationsDashboardState();
}

class _BranchOperationsDashboardState
    extends ConsumerState<BranchOperationsDashboard> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final tabs = [
      const DashboardTab(label: 'Overview', content: _OverviewTab()),
      const DashboardTab(label: 'Inventory', content: _InventoryTab()),
      const DashboardTab(label: 'Staff', content: _StaffTab()),
      const DashboardTab(label: 'Operations', content: _OperationsTab()),
      const DashboardTab(label: 'Finance', content: _FinanceTab()),
    ];

    return DashboardShell(
      title: 'Branch Operations',
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
    final filters = ref.watch(_branchOpsReservationFiltersProvider);
    final dashboard = ref.watch(branchDashboardProvider);
    final reservations = ref.watch(branchReservationsProvider(filters));
    final incoming = ref.watch(incomingDispatchesProvider);
    final staff = ref.watch(branchStaffProvider);
    final communications = ref.watch(branchCommunicationsProvider);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              DropdownButton<String?>(
                value: filters['status'],
                hint: const Text('Status'),
                items: const [
                  DropdownMenuItem(value: null, child: Text('All')),
                  DropdownMenuItem(value: 'pending', child: Text('Pending')),
                  DropdownMenuItem(
                      value: 'confirmed', child: Text('Confirmed')),
                  DropdownMenuItem(
                      value: 'checked_in', child: Text('Checked In')),
                  DropdownMenuItem(
                      value: 'checked_out', child: Text('Checked Out')),
                ],
                onChanged: (v) => ref
                    .read(_branchOpsReservationFiltersProvider.notifier)
                    .state = {...filters, 'status': v},
              ),
              const SizedBox(width: 12),
              OutlinedButton.icon(
                onPressed: () async {
                  final picked = await showDateRangePicker(
                    context: context,
                    firstDate: DateTime(2024),
                    lastDate: DateTime(2027),
                  );
                  if (picked != null) {
                    ref
                        .read(_branchOpsReservationFiltersProvider.notifier)
                        .state = {
                      ...filters,
                      'check_in_date':
                          '${picked.start.year}-${picked.start.month.toString().padLeft(2, '0')}-${picked.start.day.toString().padLeft(2, '0')}',
                      'check_out_date':
                          '${picked.end.year}-${picked.end.month.toString().padLeft(2, '0')}-${picked.end.day.toString().padLeft(2, '0')}',
                    };
                  }
                },
                icon: const Icon(Icons.date_range, size: 16),
                label: Text(filters['check_in_date'] != null
                    ? '${filters['check_in_date']} → ${filters['check_out_date']}'
                    : 'Date Range'),
              ),
              const SizedBox(width: 12),
              OutlinedButton(
                onPressed: () => ref
                    .read(_branchOpsReservationFiltersProvider.notifier)
                    .state = const {},
                child: const Text('Clear'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                  child: Text('Branch Operations',
                      style: Theme.of(context).textTheme.displaySmall)),
              OutlinedButton.icon(
                onPressed: () {
                  ref.invalidate(branchDashboardProvider);
                  ref.invalidate(branchReservationsProvider);
                  ref.invalidate(incomingDispatchesProvider);
                  ref.invalidate(branchCommunicationsProvider);
                },
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Refresh'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          dashboard.when(
            data: (d) {
              final stats = d['data'] ?? d;
              return Column(
                children: [
                  Row(children: [
                    Expanded(
                        child: _StatCard(
                            label: 'Occupancy',
                            value:
                                '${stats['occupancy_rate'] ?? stats['occupancy'] ?? '-'}%')),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Staff',
                            value:
                                '${stats['active_staff'] ?? staff.maybeWhen(data: (s) => s.length, orElse: () => '-')} / ${stats['total_staff'] ?? '-'}')),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Pending Tasks',
                            value: '${stats['pending_tasks'] ?? '-'}')),
                  ]),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                        child: _StatCard(
                            label: 'Arrivals Today',
                            value:
                                '${stats['arrivals_today'] ?? stats['arrivals'] ?? '-'}')),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Departures Today',
                            value:
                                '${stats['departures_today'] ?? stats['departures'] ?? '-'}')),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Incoming Dispatches',
                            value: incoming.maybeWhen(
                                data: (d) => '${d.length}',
                                orElse: () => '-'))),
                  ]),
                ],
              );
            },
            loading: () => const LoadingSkeleton(type: SkeletonType.card),
            error: (_, __) => Row(children: [
              Expanded(
                  child: _StatCard(
                      label: 'Reservations',
                      value: reservations.maybeWhen(
                          data: (d) => '${d.length}', orElse: () => '-'))),
              const SizedBox(width: 12),
              Expanded(
                  child: _StatCard(
                      label: 'Incoming Dispatches',
                      value: incoming.maybeWhen(
                          data: (d) => '${d.length}', orElse: () => '-'))),
            ]),
          ),
          const SizedBox(height: 24),
          _quickAccess(),
          const SizedBox(height: 24),
          const Text('Recent Reservations',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 8),
          reservations.when(
            data: (list) => list.isEmpty
                ? const EmptyState(message: 'No reservations found')
                : Card(
                    child: ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: list.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (_, i) {
                        final r = list[i];
                        final status = (r['status'] ?? '').toString();
                        final color = status == 'confirmed'
                            ? AppColors.kSuccess
                            : status == 'checked_in'
                                ? AppColors.kPrimary
                                : AppColors.kWarning;
                        return ListTile(
                          leading: CircleAvatar(
                            backgroundColor: color.withValues(alpha: 0.1),
                            child: Icon(Icons.event_available,
                                color: color, size: 18),
                          ),
                          title: Text(r['guest_name']?.toString() ?? 'Guest',
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Text(
                              'Check-in: ${r['check_in_date'] ?? '—'}  •  Room: ${r['room_number'] ?? '—'}'),
                          trailing: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(8)),
                            child: Text(status,
                                style: TextStyle(color: color, fontSize: 11)),
                          ),
                          onTap: () => _showReservationDetail(context, r),
                        );
                      },
                    ),
                  ),
            loading: () => const LoadingSkeleton(type: SkeletonType.list),
            error: (e, _) => ErrorState(message: '$e'),
          ),
          const SizedBox(height: 24),
          const Text('Recent Operations / Communications',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 8),
          communications.when(
            data: (rows) => rows.isEmpty
                ? const EmptyState(message: 'No recent communications')
                : Card(
                    child: ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: rows.take(5).length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (_, i) => ListTile(
                        leading: const Icon(Icons.campaign_outlined),
                        title: Text((rows[i]['title'] ??
                                rows[i]['subject'] ??
                                'Communication')
                            .toString()),
                        subtitle: Text(
                            (rows[i]['message'] ?? rows[i]['content'] ?? '')
                                .toString()),
                      ),
                    ),
                  ),
            loading: () => const LinearProgressIndicator(),
            error: (e, _) => ErrorState(message: '$e'),
          ),
        ],
      ),
    );
  }

  Widget _quickAccess() {
    const links = [
      'Inventory',
      'Staff',
      'Reservations',
      'Rooms',
      'Reports',
      'Communications'
    ];
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: links
          .map((label) => SizedBox(
                width: 180,
                child: Card(
                  child: ListTile(
                    leading: const Icon(Icons.open_in_new, size: 18),
                    title: Text(label,
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                  ),
                ),
              ))
          .toList(),
    );
  }

  void _showReservationDetail(BuildContext context, Map<String, dynamic> r) {
    openRecordDetailScreen(
      context,
      title: r['guest_name']?.toString() ?? 'Reservation Detail',
      subtitle: 'Reservation',
      record: r,
    );
  }
}

class _InventoryTab extends ConsumerWidget {
  const _InventoryTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final incoming = ref.watch(incomingDispatchesProvider);
    return incoming.when(
      data: (rows) => ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: rows.length,
        itemBuilder: (_, i) => Card(
          child: ListTile(
            leading: const Icon(Icons.local_shipping_outlined),
            title: Text(rows[i]['sku']?.toString() ?? 'Dispatch'),
            subtitle: Text(
                'Qty: ${rows[i]['quantity'] ?? '-'}  •  From: ${rows[i]['from'] ?? '-'}'),
          ),
        ),
      ),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e')),
    );
  }
}

class _StaffTab extends ConsumerWidget {
  const _StaffTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final staff = ref.watch(branchStaffProvider);
    return staff.when(
      data: (rows) => ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: rows.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (_, i) => ListTile(
          leading: const Icon(Icons.person_outline),
          title: Text(rows[i]['name']?.toString() ?? 'Staff'),
          subtitle: Text(rows[i]['role']?.toString() ?? ''),
          trailing: Text(rows[i]['status']?.toString() ?? ''),
        ),
      ),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e')),
    );
  }
}

class _OperationsTab extends ConsumerWidget {
  const _OperationsTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stockTakes = ref.watch(stockTakesProvider(null));
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: ElevatedButton.icon(
              onPressed: () => _showCreateStockTake(context, ref),
              icon: const Icon(Icons.add, size: 16),
              label: const Text('New Stock Take'),
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: stockTakes.when(
              data: (rows) => rows.isEmpty
                  ? const EmptyState(message: 'No stock takes found')
                  : ListView.separated(
                      itemCount: rows.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (_, i) {
                        final st = rows[i];
                        return ListTile(
                          leading: const Icon(Icons.fact_check_outlined),
                          title: Text(
                              'Stock Take • ${(st['date'] ?? st['created_at'] ?? '').toString().split('T').first}'),
                          subtitle:
                              Text('Status: ${st['status'] ?? 'pending'}'),
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

  void _showCreateStockTake(BuildContext context, WidgetRef ref) {
    final notesCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Stock Take'),
        content: TextField(
            controller: notesCtrl,
            decoration: const InputDecoration(labelText: 'Notes (optional)'),
            maxLines: 2),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await ref
                    .read(branchOperationsRepositoryProvider)
                    .createStockTake({'notes': notesCtrl.text.trim()});
                ref.invalidate(stockTakesProvider(null));
                if (context.mounted) {
                  AppNotifier.showSnackBar(context,
                      const SnackBar(content: Text('Stock take created')));
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
    );
  }
}

class _FinanceTab extends StatelessWidget {
  const _FinanceTab();
  @override
  Widget build(BuildContext context) {
    return const Center(child: Text('Finance (see Accounting dashboard)'));
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  const _StatCard({required this.label, required this.value});
  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(value,
                style:
                    const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text(label, style: const TextStyle(color: Colors.grey)),
          ],
        ),
      ),
    );
  }
}
