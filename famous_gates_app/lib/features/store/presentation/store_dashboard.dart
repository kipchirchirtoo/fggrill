import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../../core/widgets/permission_guard.dart';
import '../../../core/config/permissions.dart';
import '../data/repository.dart';
import '../domain/providers.dart';
import '../domain/models.dart';

final _storeSearchProvider = StateProvider<String>((ref) => '');

class StoreDashboard extends ConsumerStatefulWidget {
  const StoreDashboard({super.key, this.isCentral = false});
  final bool isCentral;
  @override
  ConsumerState<StoreDashboard> createState() => _StoreDashboardState();
}

class _StoreDashboardState extends ConsumerState<StoreDashboard> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final centralTabs = [
      DashboardTab(
          label: 'Central Store',
          icon: PhosphorIcons.warehouse(),
          content: const _CentralStoreOverviewTab()),
      DashboardTab(
          label: 'Master Inventory',
          icon: PhosphorIcons.package(),
          content: const _InventoryTab()),
      DashboardTab(
          label: 'Foodstuffs',
          icon: PhosphorIcons.cookingPot(),
          content: const _StoreResourceTab(
            title: 'Foodstuffs',
            endpoint: '/store/items',
            queryStoreType: 'foodstuffs',
            fields: ['name', 'sku', 'category', 'quantity', 'unit'],
          )),
      DashboardTab(
          label: 'Bar Store',
          icon: PhosphorIcons.wine(),
          content: const _StoreResourceTab(
            title: 'Bar Store',
            endpoint: '/store/items',
            queryStoreType: 'bar_store',
            fields: ['name', 'sku', 'category', 'quantity', 'unit'],
          )),
      DashboardTab(
          label: 'Stock Takes',
          icon: PhosphorIcons.clipboardText(),
          content: const _CentralStockTakesTab()),
      DashboardTab(
          label: 'Spoilage Log',
          icon: PhosphorIcons.trash(),
          content: const _SpoilageTab()),
      DashboardTab(
          label: 'Requisitions',
          icon: PhosphorIcons.gitPullRequest(),
          content: const _StockRequestsTab()),
      DashboardTab(
          label: 'Packing',
          icon: PhosphorIcons.package(),
          content: const _PackingTab()),
      DashboardTab(
          label: 'Dispatch & Notes',
          icon: PhosphorIcons.truck(),
          content: const _DispatchTab()),
      DashboardTab(
          label: 'Purchase Orders',
          icon: PhosphorIcons.fileText(),
          content: const _StoreResourceTab(
            title: 'Purchase Orders',
            endpoint: '/store/purchase-orders',
            fields: ['supplier_id', 'po_number', 'status', 'notes'],
          )),
      DashboardTab(
          label: 'Goods Receipt (GRN)',
          icon: PhosphorIcons.clipboardText(),
          content: const _StoreResourceTab(
            title: 'Goods Receipt (GRN)',
            endpoint: '/procurement/grn',
            actionLabel: 'Create GRN',
            fields: ['po_id', 'supplier_id', 'grn_number', 'status', 'notes'],
          )),
      DashboardTab(
          label: 'Suppliers',
          icon: PhosphorIcons.users(),
          content: const _SuppliersTab()),
      DashboardTab(
          label: 'Vehicles',
          icon: PhosphorIcons.truck(),
          content: const _StoreResourceTab(
            title: 'Vehicles',
            endpoint: '/store/vehicles',
            fields: ['registration_number', 'make', 'model', 'status'],
          )),
      DashboardTab(
          label: 'Drivers',
          icon: PhosphorIcons.user(),
          content: const _StoreResourceTab(
            title: 'Drivers',
            endpoint: '/store/drivers',
            fields: ['name', 'phone', 'license_number', 'status'],
          )),
    ];

    return DashboardShell(
      title: widget.isCentral ? 'Central Inventory' : 'Branch Inventory',
      currentTab: _tab,
      onTabChanged: (i) => setState(() => _tab = i),
      tabs: widget.isCentral
          ? centralTabs
          : [
              DashboardTab(
                  label: 'Overview',
                  icon: PhosphorIcons.package(),
                  content: const _InventoryTab()),
              DashboardTab(
                  label: 'Master Inventory',
                  icon: PhosphorIcons.package(),
                  content: const _InventoryTab()),
              DashboardTab(
                  label: 'Receive Goods',
                  icon: PhosphorIcons.packageArrowUp(),
                  content: const _ReceivingTab()),
              DashboardTab(
                  label: 'Branch Suppliers',
                  icon: PhosphorIcons.truck(),
                  content: const _SuppliersTab()),
              DashboardTab(
                  label: 'Stock Takes',
                  icon: PhosphorIcons.clipboardText(),
                  content: const _StoreResourceTab(
                    title: 'Stock Takes',
                    endpoint: '/stock-takes',
                    fields: ['count_type', 'store_type', 'notes'],
                  )),
              DashboardTab(
                  label: 'Purchase Orders',
                  icon: PhosphorIcons.fileText(),
                  content: const _StoreResourceTab(
                    title: 'Purchase Orders',
                    endpoint: '/store/purchase-orders',
                    fields: ['supplier_id', 'po_number', 'status', 'notes'],
                  )),
              DashboardTab(
                  label: 'Store Requisitions',
                  icon: PhosphorIcons.gitPullRequest(),
                  content: const _StockRequestsTab()),
              DashboardTab(
                  label: 'Kitchen Usage',
                  icon: PhosphorIcons.cookingPot(),
                  content: const _StoreResourceTab(
                    title: 'Kitchen Usage',
                    endpoint: '/store/kitchen-usage',
                    fields: ['sku', 'quantity', 'unit', 'notes'],
                  )),
              DashboardTab(
                  label: 'Stock Out',
                  icon: PhosphorIcons.arrowUpRight(),
                  content: const _StoreResourceTab(
                    title: 'Stock Out',
                    endpoint: '/store/branch-stock/out',
                    fields: ['item_sku', 'quantity', 'reason', 'notes'],
                  )),
            ],
    );
  }
}

class _InventoryTab extends ConsumerWidget {
  const _InventoryTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final search = ref.watch(_storeSearchProvider);
    final itemsAsync =
        ref.watch(inventoryItemsProvider(search.isEmpty ? null : search));
    final lowStockAsync = ref.watch(lowStockItemsProvider);
    final requestsAsync = ref.watch(stockRequestsProvider(null));
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          itemsAsync.when(
            data: (items) {
              final lowStockCount = lowStockAsync.valueOrNull?.length ?? 0;
              final pendingCount = requestsAsync.valueOrNull?.length ?? 0;
              return Row(
                children: [
                  _InventoryStatCard(
                      label: 'Total Items',
                      value: '${items.length}',
                      icon: PhosphorIcons.package()),
                  const SizedBox(width: 16),
                  _InventoryStatCard(
                      label: 'Low Stock',
                      value: '$lowStockCount',
                      icon: PhosphorIcons.warning(),
                      color: AppColors.kError),
                  const SizedBox(width: 16),
                  _InventoryStatCard(
                      label: 'Pending Requests',
                      value: '$pendingCount',
                      icon: PhosphorIcons.gitPullRequest(),
                      color: AppColors.kWarning),
                  const SizedBox(width: 16),
                  _InventoryStatCard(
                      label: 'Categories',
                      value: '${items.map((i) => i.category).toSet().length}',
                      icon: PhosphorIcons.treeStructure(),
                      color: AppColors.kPrimary),
                ],
              );
            },
            loading: () => const Row(children: [
              Expanded(child: LoadingSkeleton(type: SkeletonType.card)),
              SizedBox(width: 16),
              Expanded(child: LoadingSkeleton(type: SkeletonType.card)),
              SizedBox(width: 16),
              Expanded(child: LoadingSkeleton(type: SkeletonType.card)),
              SizedBox(width: 16),
              Expanded(child: LoadingSkeleton(type: SkeletonType.card)),
            ]),
            error: (e, _) => const SizedBox.shrink(),
          ),
          const SizedBox(height: 24),
          Card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.all(24),
                  child: Row(
                    children: [
                      const Text('Inventory',
                          style: TextStyle(
                              fontSize: 18, fontWeight: FontWeight.bold)),
                      const Spacer(),
                      SizedBox(
                        width: 280,
                        child: TextField(
                          decoration: InputDecoration(
                            hintText: 'Search items...',
                            prefixIcon: Icon(PhosphorIcons.magnifyingGlass()),
                            contentPadding: EdgeInsets.zero,
                          ),
                          onChanged: (v) =>
                              ref.read(_storeSearchProvider.notifier).state = v,
                        ),
                      ),
                    ],
                  ),
                ),
                itemsAsync.when(
                  data: (items) => items.isEmpty
                      ? const Padding(
                          padding: EdgeInsets.all(48),
                          child: EmptyState(message: 'No items found'))
                      : ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: items.length,
                          separatorBuilder: (_, __) => const Divider(),
                          itemBuilder: (ctx, i) {
                            final item = items[i];
                            return ListTile(
                              leading: CircleAvatar(
                                backgroundColor: item.isLowStock
                                    ? AppColors.kError.withValues(alpha: 0.1)
                                    : AppColors.kSurface,
                                child: Icon(
                                    item.isLowStock
                                        ? PhosphorIcons.warning()
                                        : PhosphorIcons.package(),
                                    color: item.isLowStock
                                        ? AppColors.kError
                                        : AppColors.kPrimary,
                                    size: 20),
                              ),
                              title: Text(item.name,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600)),
                              subtitle: Text(
                                  '${item.category ?? 'General'} • ${item.sku ?? ''}'),
                              trailing: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                      'Stock: ${item.currentStock.toStringAsFixed(0)}',
                                      style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          color: item.isLowStock
                                              ? AppColors.kError
                                              : AppColors.kTextPrimary)),
                                  Text('Unit: ${item.unit ?? 'PCS'}',
                                      style: const TextStyle(
                                          color: AppColors.kTextSecondary,
                                          fontSize: 10)),
                                ],
                              ),
                              onTap: () => _showItemDetail(ctx, item),
                            );
                          },
                        ),
                  loading: () => const LoadingSkeleton(type: SkeletonType.list),
                  error: (e, _) => ErrorState(
                      message: '$e',
                      onRetry: () =>
                          ref.invalidate(inventoryItemsProvider(null))),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showItemDetail(BuildContext context, InventoryItem item) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(item.name),
        content: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _dr('SKU', item.sku ?? '--'),
            _dr('Category', item.category ?? '--'),
            _dr('Unit', item.unit ?? '--'),
            _dr('Current Stock', item.currentStock.toStringAsFixed(0)),
            _dr('Min Stock', item.minStock?.toStringAsFixed(0) ?? '--'),
            _dr('Max Stock', item.maxStock?.toStringAsFixed(0) ?? '--'),
            if (item.isLowStock)
              const Padding(
                  padding: EdgeInsets.only(top: 12),
                  child: Text('⚠ Low stock alert!',
                      style: TextStyle(
                          color: AppColors.kError,
                          fontWeight: FontWeight.bold))),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Close'))
        ],
      ),
    );
  }

  Widget _dr(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child:
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(label, style: const TextStyle(color: AppColors.kTextSecondary)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ]),
      );
}

class _CentralStoreOverviewTab extends ConsumerWidget {
  const _CentralStoreOverviewTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashAsync = ref.watch(centralStoreDashboardProvider);
    final items = ref.watch(inventoryItemsProvider(null));
    final requests = ref.watch(stockRequestsProvider(null));
    final dispatch = ref.watch(dispatchOrdersProvider(null));
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Central Store',
                    style: Theme.of(context).textTheme.displaySmall),
                const SizedBox(height: 4),
                const Text(
                  'Inventory, receiving, requisitions, dispatch, procurement, fleet',
                  style: TextStyle(color: AppColors.kTextSecondary),
                ),
              ]),
              IconButton(
                tooltip: 'Refresh',
                icon: const Icon(Icons.refresh),
                onPressed: () {
                  ref.invalidate(centralStoreDashboardProvider);
                  ref.invalidate(inventoryItemsProvider(null));
                  ref.invalidate(stockRequestsProvider(null));
                  ref.invalidate(dispatchOrdersProvider(null));
                },
              ),
            ],
          ),
          const SizedBox(height: 24),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _InventoryStatCard(
                  label: 'Master Items',
                  value: dashAsync.maybeWhen(
                    data: (d) =>
                        '${d['totalItems'] ?? items.maybeWhen(data: (list) => list.length, orElse: () => '-')}',
                    orElse: () => items.maybeWhen(
                        data: (list) => '${list.length}', orElse: () => '-'),
                  ),
                  icon: PhosphorIcons.package(),
                ),
                const SizedBox(width: 16),
                _InventoryStatCard(
                  label: 'Low Stock',
                  value: dashAsync.maybeWhen(
                    data: (d) => '${d['lowStock'] ?? d['lowStockItems'] ?? 0}',
                    orElse: () => '-',
                  ),
                  icon: PhosphorIcons.warning(),
                  color: AppColors.kError,
                ),
                const SizedBox(width: 16),
                _InventoryStatCard(
                  label: 'Pending Requests',
                  value: requests.maybeWhen(
                    data: (d) => '${d.length}',
                    orElse: () => dashAsync.maybeWhen(
                        data: (d) => '${d['pendingRequests'] ?? '-'}',
                        orElse: () => '-'),
                  ),
                  icon: PhosphorIcons.gitPullRequest(),
                  color: AppColors.kWarning,
                ),
                const SizedBox(width: 16),
                _InventoryStatCard(
                  label: 'In Transit',
                  value: dashAsync.maybeWhen(
                    data: (d) => '${d['inTransit'] ?? d['dispatched'] ?? '-'}',
                    orElse: () => dispatch.maybeWhen(
                        data: (d) =>
                            '${d.where((o) => '${o['status']}'.toLowerCase() == 'in_transit' || '${o['status']}'.toLowerCase() == 'dispatched').length}',
                        orElse: () => '-'),
                  ),
                  icon: PhosphorIcons.truck(),
                  color: AppColors.kPrimary,
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _StoreShortcut('Master Inventory', Icons.warehouse_outlined),
              _StoreShortcut('Foodstuffs', Icons.kitchen_outlined),
              _StoreShortcut('Bar Store', Icons.local_bar_outlined),
              _StoreShortcut('Stock Takes', Icons.fact_check_outlined),
              _StoreShortcut('Spoilage Log', Icons.delete_outline),
              _StoreShortcut('Requisitions', Icons.assignment_outlined),
              _StoreShortcut('Packing', Icons.inventory_outlined),
              _StoreShortcut('Dispatch & Notes', Icons.local_shipping_outlined),
              _StoreShortcut('Purchase Orders', Icons.receipt_long_outlined),
              _StoreShortcut('Goods Receipt (GRN)', Icons.fact_check_outlined),
              _StoreShortcut('Suppliers', Icons.people_outline),
              _StoreShortcut('Vehicles', Icons.fire_truck_outlined),
              _StoreShortcut('Drivers', Icons.badge_outlined),
            ],
          ),
        ],
      ),
    );
  }
}

class _StoreShortcut extends StatelessWidget {
  const _StoreShortcut(this.label, this.icon);
  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 190,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Icon(icon, color: AppColors.kPrimary, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(label,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StoreResourceTab extends ConsumerWidget {
  const _StoreResourceTab({
    required this.title,
    required this.endpoint,
    this.fields = const ['name', 'description'],
    this.actionLabel,
    this.queryStoreType,
  });

  final String title;
  final String endpoint;
  final List<String> fields;
  final String? actionLabel;
  final String? queryStoreType;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final query = <String, String>{
      if (queryStoreType != null) 'store_type': queryStoreType!,
    };
    final resourceKey = query.isEmpty
        ? endpoint
        : Uri(path: endpoint, queryParameters: query).toString();
    final rowsAsync = ref.watch(storeResourceProvider(resourceKey));
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                  child: Text(title,
                      style: Theme.of(context).textTheme.displaySmall)),
              IconButton(
                tooltip: 'Refresh',
                onPressed: () =>
                    ref.invalidate(storeResourceProvider(resourceKey)),
                icon: const Icon(Icons.refresh),
              ),
              const SizedBox(width: 8),
              ElevatedButton.icon(
                style:
                    ElevatedButton.styleFrom(minimumSize: const Size(132, 42)),
                onPressed: () => _showCreateDialog(context, ref, resourceKey),
                icon: const Icon(Icons.add, size: 16),
                label: Text(actionLabel ?? 'New'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
            child: rowsAsync.when(
              data: (rows) => rows.isEmpty
                  ? EmptyState(message: 'No $title records found')
                  : ListView.separated(
                      itemCount: rows.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (_, i) => _resourceTile(rows[i]),
                    ),
              loading: () => const LoadingSkeleton(type: SkeletonType.list),
              error: (e, _) => ErrorState(
                message: '$e',
                onRetry: () =>
                    ref.invalidate(storeResourceProvider(resourceKey)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _resourceTile(Map<String, dynamic> row) {
    final status = (row['status'] ?? '').toString();
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: AppColors.kPrimary.withValues(alpha: 0.1),
          child: const Icon(Icons.dataset_outlined,
              color: AppColors.kPrimary, size: 18),
        ),
        title: Text(_primary(row),
            style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle:
            Text(_secondary(row), maxLines: 2, overflow: TextOverflow.ellipsis),
        trailing: status.isEmpty
            ? null
            : Chip(
                label: Text(status.toUpperCase(),
                    style: const TextStyle(fontSize: 10)),
                backgroundColor: AppColors.kSurface,
              ),
      ),
    );
  }

  Future<void> _showCreateDialog(
      BuildContext context, WidgetRef ref, String resourceKey) async {
    final controllers = {
      for (final field in fields) field: TextEditingController(),
    };
    final body = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(actionLabel ?? 'New $title'),
        content: SizedBox(
          width: 420,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: controllers.entries
                  .map((entry) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: TextField(
                          controller: entry.value,
                          decoration:
                              InputDecoration(labelText: _label(entry.key)),
                        ),
                      ))
                  .toList(),
            ),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(minimumSize: const Size(96, 42)),
            onPressed: () => Navigator.pop(ctx, {
              for (final entry in controllers.entries)
                entry.key: entry.value.text.trim(),
              if (queryStoreType != null) 'store_type': queryStoreType,
            }),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    for (final controller in controllers.values) {
      controller.dispose();
    }
    if (body == null) return;
    try {
      await ref.read(storeRepositoryProvider).createResource(endpoint, body);
      ref.invalidate(storeResourceProvider(resourceKey));
      if (context.mounted) {
        AppNotifier.showSnackBar(
            context, const SnackBar(content: Text('Saved')));
      }
    } catch (e) {
      if (context.mounted) {
        AppNotifier.showSnackBar(context, SnackBar(content: Text('Error: $e')));
      }
    }
  }

  String _primary(Map<String, dynamic> row) {
    for (final key in const [
      'name',
      'item_name',
      'title',
      'po_number',
      'grn_number',
      'reference',
      'registration_number',
      'id'
    ]) {
      final value = row[key];
      if (value != null && '$value'.isNotEmpty) return '$value';
    }
    return 'Record';
  }

  String _secondary(Map<String, dynamic> row) {
    final parts = <String>[];
    for (final key in const [
      'sku',
      'category',
      'quantity',
      'unit',
      'supplier_name',
      'branch_name',
      'phone',
      'created_at',
      'notes'
    ]) {
      final value = row[key];
      if (value != null && '$value'.isNotEmpty) {
        parts.add('${_label(key)}: $value');
      }
    }
    return parts.isEmpty ? 'No additional details' : parts.join('  •  ');
  }

  String _label(String field) => field
      .replaceAll('_', ' ')
      .split(' ')
      .map((word) =>
          word.isEmpty ? word : word[0].toUpperCase() + word.substring(1))
      .join(' ');
}

// Uses raw map data via storeResourceProvider so we get all fields
// (request_number, branch_name, items[], status, priority).
// The old StockRequest model only had itemName/quantity (single item) — insufficient.
final _centralRequestsRawProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String?>(
  (ref, status) {
    final path = status != null && status.isNotEmpty
        ? '/store/stock-requests?status=$status'
        : '/store/stock-requests';
    return ref.read(storeRepositoryProvider).getResource(path);
  },
);

class _StockRequestsTab extends ConsumerStatefulWidget {
  const _StockRequestsTab();
  @override
  ConsumerState<_StockRequestsTab> createState() => _StockRequestsTabState();
}

class _StockRequestsTabState extends ConsumerState<_StockRequestsTab> {
  String? _statusFilter;

  static Color _statusColor(String? status) {
    final s = (status ?? '').toUpperCase();
    if (s == 'APPROVED' ||
        s == 'RECEIVED' ||
        s == 'DELIVERED' ||
        s == 'FULFILLED') {
      return AppColors.kSuccess;
    }
    if (s == 'DISPATCHED' || s == 'IN_TRANSIT') {
      return AppColors.kPrimary;
    }
    if (s == 'REJECTED' || s == 'CANCELLED') {
      return AppColors.kError;
    }
    return AppColors.kWarning;
  }

  @override
  Widget build(BuildContext context) {
    final requestsAsync = ref.watch(_centralRequestsRawProvider(_statusFilter));
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                  child: Text('Branch Requisitions',
                      style: Theme.of(context).textTheme.displaySmall)),
              DropdownButton<String?>(
                value: _statusFilter,
                hint: const Text('All Statuses'),
                items: const [
                  DropdownMenuItem(value: null, child: Text('All')),
                  DropdownMenuItem(value: 'PENDING', child: Text('Pending')),
                  DropdownMenuItem(value: 'APPROVED', child: Text('Approved')),
                  DropdownMenuItem(
                      value: 'DISPATCHED', child: Text('Dispatched')),
                  DropdownMenuItem(
                      value: 'DELIVERED', child: Text('Delivered')),
                  DropdownMenuItem(value: 'REJECTED', child: Text('Rejected')),
                ],
                onChanged: (v) => setState(() => _statusFilter = v),
              ),
              const SizedBox(width: 12),
              IconButton(
                tooltip: 'Refresh',
                icon: const Icon(Icons.refresh),
                onPressed: () =>
                    ref.invalidate(_centralRequestsRawProvider(_statusFilter)),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
            child: requestsAsync.when(
              data: (requests) => requests.isEmpty
                  ? const EmptyState(message: 'No stock requests')
                  : ListView.separated(
                      itemCount: requests.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (_, i) {
                        final r = requests[i];
                        final status = '${r['status'] ?? ''}';
                        final statusColor = _statusColor(status);
                        final items = r['items'];
                        final itemCount = items is List ? items.length : 0;
                        return Card(
                          margin: const EdgeInsets.only(bottom: 4),
                          child: ListTile(
                            leading: CircleAvatar(
                              backgroundColor:
                                  statusColor.withValues(alpha: 0.1),
                              child: Icon(PhosphorIcons.gitPullRequest(),
                                  color: statusColor, size: 18),
                            ),
                            title: Text(
                              '${r['request_number'] ?? r['id']}  —  ${r['branch_name'] ?? r['requesting_branch'] ?? '—'}',
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('$itemCount items  •  '
                                    '${(r['created_at'] ?? '').toString().split('T').first}'),
                                if (items is List && items.isNotEmpty)
                                  Text(
                                    items
                                        .take(3)
                                        .whereType<Map>()
                                        .map((item) =>
                                            '${item['item_name'] ?? item['item_sku']} (${item['requested_quantity'] ?? 0})')
                                        .join(', '),
                                    style: const TextStyle(
                                        fontSize: 11,
                                        color: AppColors.kTextSecondary),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                              ],
                            ),
                            trailing: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                  color: statusColor.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(12)),
                              child: Text(status.toUpperCase(),
                                  style: TextStyle(
                                      fontSize: 10,
                                      color: statusColor,
                                      fontWeight: FontWeight.bold)),
                            ),
                            onTap: () => _showRequestDetail(context, r),
                          ),
                        );
                      },
                    ),
              loading: () => const LoadingSkeleton(type: SkeletonType.list),
              error: (e, _) => ErrorState(
                  message: '$e',
                  onRetry: () => ref
                      .invalidate(_centralRequestsRawProvider(_statusFilter))),
            ),
          ),
        ],
      ),
    );
  }

  void _showRequestDetail(BuildContext context, Map<String, dynamic> request) {
    final items = request['items'];
    final itemList = items is List
        ? items
            .whereType<Map>()
            .map((i) => Map<String, dynamic>.from(i))
            .toList()
        : <Map<String, dynamic>>[];
    final status = '${request['status'] ?? ''}';

    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Request ${request['request_number'] ?? request['id']}'),
        content: SizedBox(
          width: 600,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Wrap(spacing: 8, runSpacing: 8, children: [
                  Chip(
                      label: Text(status.toUpperCase(),
                          style: const TextStyle(fontSize: 10))),
                  Chip(
                      label: Text(
                          'Branch: ${request['branch_name'] ?? request['requesting_branch'] ?? '—'}',
                          style: const TextStyle(fontSize: 10))),
                  if (request['priority'] != null)
                    Chip(
                        label: Text('Priority: ${request['priority']}',
                            style: const TextStyle(fontSize: 10))),
                ]),
                const SizedBox(height: 12),
                const Text('Items',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                ...itemList.map((item) => Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(children: [
                        Expanded(
                            child: Text(
                                '${item['item_name'] ?? item['item_sku']}')),
                        Text('Req: ${item['requested_quantity'] ?? 0}',
                            style: const TextStyle(fontSize: 12)),
                        const SizedBox(width: 8),
                        if (item['approved_quantity'] != null)
                          Text('App: ${item['approved_quantity']}',
                              style: const TextStyle(
                                  fontSize: 12, color: AppColors.kSuccess)),
                      ]),
                    )),
                if (request['review_notes'] != null) ...[
                  const SizedBox(height: 12),
                  Text('Notes: ${request['review_notes']}',
                      style: const TextStyle(
                          color: AppColors.kTextSecondary, fontSize: 12)),
                ],
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
        ],
      ),
    );
  }
}

class _SuppliersTab extends ConsumerWidget {
  const _SuppliersTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final suppliersAsync = ref.watch(suppliersProvider);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Suppliers', style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 16),
          Expanded(
            child: suppliersAsync.when(
              data: (suppliers) => suppliers.isEmpty
                  ? const EmptyState(message: 'No suppliers found')
                  : ListView.separated(
                      itemCount: suppliers.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (_, i) {
                        final s = suppliers[i];
                        return ListTile(
                          leading: CircleAvatar(
                            backgroundColor:
                                AppColors.kPrimary.withValues(alpha: 0.1),
                            child: Icon(PhosphorIcons.truck(),
                                color: AppColors.kPrimary, size: 18),
                          ),
                          title: Text(s.name,
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Text(
                              '${s.contactPerson ?? ''}  ${s.phone != null ? '• ${s.phone}' : ''}  ${s.email != null ? '• ${s.email}' : ''}'),
                          trailing: (s.status == null || s.status == 'active')
                              ? const Icon(Icons.circle,
                                  color: AppColors.kSuccess, size: 10)
                              : const Icon(Icons.circle,
                                  color: AppColors.kError, size: 10),
                        );
                      },
                    ),
              loading: () => const LoadingSkeleton(type: SkeletonType.list),
              error: (e, _) => ErrorState(
                  message: '$e',
                  onRetry: () => ref.invalidate(suppliersProvider)),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

class _DispatchTab extends ConsumerStatefulWidget {
  const _DispatchTab();
  @override
  ConsumerState<_DispatchTab> createState() => _DispatchTabState();
}

class _DispatchTabState extends ConsumerState<_DispatchTab> {
  String? _statusFilter;

  @override
  Widget build(BuildContext context) {
    final dispatchAsync = ref.watch(dispatchOrdersProvider(_statusFilter));
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        Row(children: [
          DropdownButton<String?>(
            value: _statusFilter,
            hint: const Text('All Statuses'),
            items: const [
              DropdownMenuItem(value: null, child: Text('All')),
              DropdownMenuItem(value: 'pending', child: Text('Pending')),
              DropdownMenuItem(value: 'dispatched', child: Text('Dispatched')),
              DropdownMenuItem(value: 'delivered', child: Text('Delivered')),
            ],
            onChanged: (v) => setState(() => _statusFilter = v),
          ),
          const Spacer(),
          ElevatedButton.icon(
            onPressed: () => _showNewDispatchDialog(context),
            icon: const Icon(Icons.add, size: 16),
            label: const Text('New Dispatch'),
            style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.kPrimary,
                foregroundColor: Colors.white),
          ),
        ]),
        const SizedBox(height: 12),
        Expanded(
          child: AsyncValueWidget(
            value: dispatchAsync,
            data: (orders) {
              if (orders.isEmpty) {
                return const EmptyState(message: 'No dispatch orders');
              }
              return ListView.builder(
                itemCount: orders.length,
                itemBuilder: (_, i) {
                  final o = orders[i];
                  final status = (o['status'] ?? 'pending').toString();
                  final color = status == 'delivered'
                      ? AppColors.kSuccess
                      : status == 'dispatched'
                          ? AppColors.kWarning
                          : AppColors.kTextSecondary;
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading: Icon(PhosphorIcons.upload(), color: color),
                      title: Text(
                          'Order #${o['id'] ?? i + 1}  —  ${o['destination'] ?? o['branch_name'] ?? '—'}',
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(
                          'Items: ${o['item_count'] ?? o['items']?.length ?? '—'}  •  ${(o['created_at'] ?? '').toString().split('T').first}'),
                      trailing: status == 'pending'
                          ? PermissionGuard(
                              permission: Permission.canManageDispatch,
                              child: TextButton(
                                onPressed: () async {
                                  final id = (o['id'] ?? '').toString();
                                  await ref
                                      .read(storeRepositoryProvider)
                                      .updateDispatchStatus(id, 'dispatched');
                                  ref.invalidate(
                                      dispatchOrdersProvider(_statusFilter));
                                },
                                child: const Text('Dispatch'),
                              ),
                            )
                          : Chip(
                              label: Text(status.toUpperCase(),
                                  style: const TextStyle(fontSize: 10)),
                              backgroundColor: color.withValues(alpha: 0.1),
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

  void _showNewDispatchDialog(BuildContext context) {
    // Dispatch notes originate from the Packing Station tab.
    // This dialog informs the user of the correct workflow.
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Dispatch'),
        content: const SizedBox(
          width: 380,
          child: Text(
            'To create a dispatch note, go to the Packing Station tab, select an approved request, and tap "Pack & Dispatch". '
            'This will create the dispatch note and mark it as IN_TRANSIT.',
            style: TextStyle(color: AppColors.kTextSecondary),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('OK')),
        ],
      ),
    );
  }
}

// ─── Receiving ─────────────────────────────────────────────────────────────────

class _ReceivingTab extends ConsumerWidget {
  const _ReceivingTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recvAsync = ref.watch(receivingRecordsProvider);
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          const Text('Received Stock',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
          ElevatedButton.icon(
            onPressed: () => _showReceiveDialog(context, ref),
            icon: const Icon(Icons.add, size: 16),
            label: const Text('Record Receipt'),
            style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.kPrimary,
                foregroundColor: Colors.white),
          ),
        ]),
        const SizedBox(height: 12),
        Expanded(
          child: AsyncValueWidget(
            value: recvAsync,
            data: (records) {
              if (records.isEmpty) {
                return const EmptyState(message: 'No receiving records');
              }
              return ListView.builder(
                itemCount: records.length,
                itemBuilder: (_, i) {
                  final r = records[i];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor:
                            AppColors.kSuccess.withValues(alpha: 0.1),
                        child: Icon(PhosphorIcons.signIn(),
                            color: AppColors.kSuccess, size: 18),
                      ),
                      title: Text(
                          (r['item_name'] ?? r['product'] ?? 'Item').toString(),
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(
                          'Qty: ${r['quantity'] ?? '—'}  •  Supplier: ${r['supplier_name'] ?? r['supplier'] ?? '—'}'),
                      trailing: Text(
                          (r['created_at'] ?? r['date'] ?? '')
                              .toString()
                              .split('T')
                              .first,
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

  void _showReceiveDialog(BuildContext context, WidgetRef ref) {
    final itemCtrl = TextEditingController();
    final qtyCtrl = TextEditingController();
    final supplierCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Record Received Stock'),
        content: SizedBox(
          width: 320,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(
                controller: itemCtrl,
                decoration: const InputDecoration(labelText: 'Item Name')),
            const SizedBox(height: 12),
            TextField(
                controller: qtyCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Quantity')),
            const SizedBox(height: 12),
            TextField(
                controller: supplierCtrl,
                decoration: const InputDecoration(labelText: 'Supplier')),
          ]),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (itemCtrl.text.trim().isEmpty) return;
              Navigator.pop(ctx);
              try {
                await ref.read(storeRepositoryProvider).recordReceiving({
                  'item_name': itemCtrl.text.trim(),
                  'quantity': int.tryParse(qtyCtrl.text.trim()) ?? 0,
                  'supplier_name': supplierCtrl.text.trim(),
                });
                ref.invalidate(receivingRecordsProvider);
                if (context.mounted) {
                  AppNotifier.showSnackBar(context,
                      const SnackBar(content: Text('Receipt recorded')));
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
    );
  }
}

// ─── Spoilage + Packing ────────────────────────────────────────────────────────

class _SpoilageTab extends ConsumerStatefulWidget {
  const _SpoilageTab();
  @override
  ConsumerState<_SpoilageTab> createState() => _SpoilageTabState();
}

class _SpoilageTabState extends ConsumerState<_SpoilageTab> {
  int _subTab = 0;

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Row(children: [
        _sub('Spoilage', 0),
        _sub('Packing', 1),
      ]),
      Expanded(child: _subTab == 0 ? _buildSpoilage() : _buildPacking()),
    ]);
  }

  Widget _sub(String label, int idx) => Expanded(
        child: InkWell(
          onTap: () => setState(() => _subTab = idx),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              border: Border(
                  bottom: BorderSide(
                color: _subTab == idx ? AppColors.kPrimary : Colors.transparent,
                width: 2,
              )),
            ),
            child: Text(label,
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontWeight:
                        _subTab == idx ? FontWeight.bold : FontWeight.normal,
                    color: _subTab == idx
                        ? AppColors.kPrimary
                        : AppColors.kTextSecondary)),
          ),
        ),
      );

  Widget _buildSpoilage() {
    final spoilAsync = ref.watch(spoilageRecordsProvider);
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          const Text('Spoilage Records',
              style: TextStyle(fontWeight: FontWeight.w600)),
          ElevatedButton.icon(
            onPressed: () => _showSpoilageDialog(context),
            icon: const Icon(Icons.add, size: 16),
            label: const Text('Record'),
            style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.kError,
                foregroundColor: Colors.white),
          ),
        ]),
        const SizedBox(height: 12),
        Expanded(
          child: AsyncValueWidget(
            value: spoilAsync,
            data: (records) {
              if (records.isEmpty) {
                return const EmptyState(message: 'No spoilage records');
              }
              return ListView.builder(
                itemCount: records.length,
                itemBuilder: (_, i) {
                  final r = records[i];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading: Icon(PhosphorIcons.warning(),
                          color: AppColors.kError),
                      title: Text(
                          (r['item_name'] ?? r['item'] ?? 'Item').toString(),
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(
                          'Qty: ${r['quantity'] ?? '—'}  •  Reason: ${r['reason'] ?? '—'}'),
                      trailing: Text(
                          (r['created_at'] ?? r['date'] ?? '')
                              .toString()
                              .split('T')
                              .first,
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

  Widget _buildPacking() {
    final packAsync = ref.watch(packingRecordsProvider);
    return Padding(
      padding: const EdgeInsets.all(16),
      child: AsyncValueWidget(
        value: packAsync,
        data: (records) {
          if (records.isEmpty) {
            return const EmptyState(message: 'No packing records');
          }
          return ListView.builder(
            itemCount: records.length,
            itemBuilder: (_, i) {
              final r = records[i];
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading:
                      Icon(PhosphorIcons.package(), color: AppColors.kPrimary),
                  title: Text(
                      (r['item_name'] ?? r['product'] ?? 'Item').toString(),
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(
                      'Qty: ${r['quantity'] ?? '—'}  •  Packed by: ${r['packed_by'] ?? '—'}'),
                  trailing: Text(
                      (r['created_at'] ?? r['date'] ?? '')
                          .toString()
                          .split('T')
                          .first,
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.kTextSecondary)),
                ),
              );
            },
          );
        },
      ),
    );
  }

  void _showSpoilageDialog(BuildContext context) {
    // POST /wastage with proper fields
    String? itemSku;
    String reason = 'SPOILED';
    String disposalMethod = 'DISPOSED';
    String storeType = 'foodstuffs';
    final qtyCtrl = TextEditingController(text: '1');
    final reasonDetailsCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    final dateCtrl = TextEditingController(
        text: DateTime.now().toIso8601String().split('T').first);

    // Load central stock items for the dropdown
    showDialog(
      context: context,
      builder: (ctx) => FutureBuilder<List<Map<String, dynamic>>>(
        future: ref.read(storeRepositoryProvider).getResource('/store/items'),
        builder: (ctx, snap) {
          final items = snap.data ?? [];
          return StatefulBuilder(
            builder: (ctx, setDialogState) => AlertDialog(
              title: const Text('Record Central Store Spoilage'),
              content: SizedBox(
                width: 480,
                child: SingleChildScrollView(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    if (snap.connectionState == ConnectionState.waiting)
                      const Padding(
                        padding: EdgeInsets.all(12),
                        child: CircularProgressIndicator(),
                      )
                    else
                      DropdownButtonFormField<String>(
                        isExpanded: true,
                        decoration:
                            const InputDecoration(labelText: 'Item (SKU) *'),
                        items: items
                            .map((i) => DropdownMenuItem(
                                  value: '${i['sku'] ?? i['item_sku']}',
                                  child: Text(
                                    '${i['item_name'] ?? i['name'] ?? i['sku']} (${i['sku'] ?? ''})',
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ))
                            .toList(),
                        onChanged: (v) => setDialogState(() => itemSku = v),
                      ),
                    const SizedBox(height: 12),
                    Row(children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          isExpanded: true,
                          initialValue: storeType,
                          decoration:
                              const InputDecoration(labelText: 'Store Type'),
                          items: const [
                            DropdownMenuItem(
                                value: 'foodstuffs', child: Text('Foodstuffs')),
                            DropdownMenuItem(
                                value: 'bar_store', child: Text('Bar Store')),
                          ],
                          onChanged: (v) =>
                              setDialogState(() => storeType = v!),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: qtyCtrl,
                          keyboardType: TextInputType.number,
                          decoration:
                              const InputDecoration(labelText: 'Quantity *'),
                        ),
                      ),
                    ]),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      isExpanded: true,
                      initialValue: reason,
                      decoration: const InputDecoration(labelText: 'Reason *'),
                      items: const [
                        DropdownMenuItem(
                            value: 'EXPIRED', child: Text('Expired')),
                        DropdownMenuItem(
                            value: 'DAMAGED', child: Text('Damaged')),
                        DropdownMenuItem(
                            value: 'SPOILED', child: Text('Spoiled')),
                        DropdownMenuItem(
                            value: 'QUALITY_ISSUE',
                            child: Text('Quality Issue')),
                        DropdownMenuItem(
                            value: 'THEFT', child: Text('Theft/Loss')),
                        DropdownMenuItem(
                            value: 'BREAKAGE', child: Text('Breakage')),
                        DropdownMenuItem(
                            value: 'CONTAMINATION',
                            child: Text('Contamination')),
                        DropdownMenuItem(value: 'OTHER', child: Text('Other')),
                      ],
                      onChanged: (v) => setDialogState(() => reason = v!),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      isExpanded: true,
                      initialValue: disposalMethod,
                      decoration:
                          const InputDecoration(labelText: 'Disposal Method'),
                      items: const [
                        DropdownMenuItem(
                            value: 'DISPOSED', child: Text('Disposed')),
                        DropdownMenuItem(
                            value: 'RETURNED_SUPPLIER',
                            child: Text('Returned to Supplier')),
                        DropdownMenuItem(
                            value: 'DONATED', child: Text('Donated')),
                        DropdownMenuItem(
                            value: 'RECYCLED', child: Text('Recycled')),
                        DropdownMenuItem(
                            value: 'DESTROYED', child: Text('Destroyed')),
                      ],
                      onChanged: (v) =>
                          setDialogState(() => disposalMethod = v!),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: dateCtrl,
                      decoration: const InputDecoration(
                          labelText: 'Spoilage Date (YYYY-MM-DD)'),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: reasonDetailsCtrl,
                      decoration:
                          const InputDecoration(labelText: 'Reason Details'),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: notesCtrl,
                      decoration: const InputDecoration(labelText: 'Notes'),
                    ),
                  ]),
                ),
              ),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Cancel')),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.kError,
                      foregroundColor: Colors.white),
                  onPressed: itemSku == null
                      ? null
                      : () async {
                          Navigator.pop(ctx);
                          try {
                            await ref
                                .read(storeRepositoryProvider)
                                .recordSpoilage({
                              'item_sku': itemSku,
                              'quantity':
                                  int.tryParse(qtyCtrl.text.trim()) ?? 1,
                              'reason': reason,
                              'disposal_method': disposalMethod,
                              'store_type': storeType,
                              'spoilage_date': dateCtrl.text,
                              if (reasonDetailsCtrl.text.isNotEmpty)
                                'reason_details': reasonDetailsCtrl.text,
                              if (notesCtrl.text.isNotEmpty)
                                'notes': notesCtrl.text,
                            });
                            ref.invalidate(spoilageRecordsProvider);
                            if (context.mounted) {
                              AppNotifier.showSnackBar(
                                context,
                                const SnackBar(
                                    content: Text(
                                        'Spoilage recorded — stock deducted')),
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
                  child: const Text('Record Spoilage'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ─── Packing Tab ───────────────────────────────────────────────────────────────

class _PackingTab extends ConsumerStatefulWidget {
  const _PackingTab();
  @override
  ConsumerState<_PackingTab> createState() => _PackingTabState();
}

class _PackingTabState extends ConsumerState<_PackingTab> {
  // Correct endpoint: GET /store/stock-requests?status=APPROVED
  static const _approvedKey = '/store/stock-requests?status=APPROVED';
  static const _partialKey = '/store/stock-requests?status=PARTIALLY_APPROVED';

  @override
  Widget build(BuildContext context) {
    final approvedAsync = ref.watch(storeResourceProvider(_approvedKey));
    final partialAsync = ref.watch(storeResourceProvider(_partialKey));

    final combinedAsync = approvedAsync.when(
      data: (approved) => partialAsync.when(
        data: (partial) => AsyncValue.data([...approved, ...partial]),
        loading: () => const AsyncValue<List<Map<String, dynamic>>>.loading(),
        error: (e, s) => AsyncValue<List<Map<String, dynamic>>>.error(e, s),
      ),
      loading: () => const AsyncValue<List<Map<String, dynamic>>>.loading(),
      error: (e, s) => AsyncValue<List<Map<String, dynamic>>>.error(e, s),
    );

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Packing Station',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
            IconButton(
              tooltip: 'Refresh',
              icon: const Icon(Icons.refresh),
              onPressed: () {
                ref.invalidate(storeResourceProvider(_approvedKey));
                ref.invalidate(storeResourceProvider(_partialKey));
              },
            ),
          ],
        ),
        const SizedBox(height: 12),
        Expanded(
          child: AsyncValueWidget(
            value: combinedAsync,
            data: (requests) {
              if (requests.isEmpty) {
                return const EmptyState(
                    message: 'No approved requests awaiting packing');
              }
              return ListView.builder(
                itemCount: requests.length,
                itemBuilder: (_, i) {
                  final r = requests[i];
                  final status = '${r['status'] ?? 'APPROVED'}';
                  final items = r['items'];
                  final itemCount = items is List ? items.length : 0;
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading: Icon(PhosphorIcons.package(),
                          color: AppColors.kPrimary),
                      title: Text(
                        '${r['request_number'] ?? r['id']}  —  ${r['branch_name'] ?? r['requesting_branch'] ?? '—'}',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      subtitle: Text(
                          'Items: $itemCount  •  ${(r['created_at'] ?? '').toString().split('T').first}'),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Chip(
                            label: Text(status.toUpperCase(),
                                style: const TextStyle(fontSize: 10)),
                            backgroundColor:
                                AppColors.kSuccess.withValues(alpha: 0.1),
                          ),
                          const SizedBox(width: 8),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.kPrimary,
                              foregroundColor: Colors.white,
                              minimumSize: const Size(100, 36),
                            ),
                            onPressed: () => _showPackAndDispatch(context, r),
                            child: const Text('Pack & Dispatch',
                                style: TextStyle(fontSize: 11)),
                          ),
                        ],
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

  void _showPackAndDispatch(
      BuildContext context, Map<String, dynamic> request) {
    String? vehicleId;
    String? driverId;
    final notesCtrl = TextEditingController(
        text: 'Packed from request ${request['request_number'] ?? ''}');

    showDialog<void>(
      context: context,
      builder: (ctx) => FutureBuilder<List<List<Map<String, dynamic>>>>(
        future: Future.wait([
          ref.read(storeRepositoryProvider).getFleetVehicles(),
          ref.read(storeRepositoryProvider).getFleetDrivers(),
        ]),
        builder: (ctx, snap) {
          final vehicles = snap.data?[0] ?? [];
          final drivers = snap.data?[1] ?? [];
          return StatefulBuilder(
            builder: (ctx, setDialogState) => AlertDialog(
              title:
                  Text('Pack & Dispatch — ${request['request_number'] ?? ''}'),
              content: SizedBox(
                width: 480,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (snap.connectionState == ConnectionState.waiting)
                      const Padding(
                        padding: EdgeInsets.all(16),
                        child: CircularProgressIndicator(),
                      )
                    else ...[
                      DropdownButtonFormField<String>(
                        isExpanded: true,
                        decoration: const InputDecoration(
                            labelText: 'Vehicle (optional)'),
                        items: vehicles
                            .map((v) => DropdownMenuItem(
                                  value: '${v['id']}',
                                  child: Text(
                                      '${v['registration_number'] ?? v['model'] ?? v['id']}'),
                                ))
                            .toList(),
                        onChanged: (val) =>
                            setDialogState(() => vehicleId = val),
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        isExpanded: true,
                        decoration: const InputDecoration(
                            labelText: 'Driver (optional)'),
                        items: drivers
                            .map((d) => DropdownMenuItem(
                                  value: '${d['id']}',
                                  child: Text('${d['name'] ?? d['id']}'),
                                ))
                            .toList(),
                        onChanged: (val) =>
                            setDialogState(() => driverId = val),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: notesCtrl,
                        decoration: const InputDecoration(labelText: 'Notes'),
                      ),
                    ],
                  ],
                ),
              ),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Cancel')),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.kPrimary,
                      foregroundColor: Colors.white),
                  onPressed: () async {
                    Navigator.pop(ctx);
                    try {
                      final items = request['items'];
                      final lineItems = items is List
                          ? items
                              .whereType<Map>()
                              .map((item) => {
                                    'item_sku':
                                        item['item_sku'] ?? item['sku'] ?? '',
                                    'dispatched_quantity':
                                        item['approved_quantity'] ??
                                            item['requested_quantity'] ??
                                            0,
                                  })
                              .toList()
                          : <Map<String, dynamic>>[];

                      final toBranchId = request['requesting_branch_id'] ??
                          request['to_branch_id'];

                      final result = await ref
                          .read(storeRepositoryProvider)
                          .createDispatchNote({
                        'request_id': request['id'],
                        if (toBranchId != null) 'to_branch_id': toBranchId,
                        'items': lineItems,
                        'notes': notesCtrl.text,
                        if (vehicleId != null) 'vehicle_id': vehicleId,
                        if (driverId != null) 'driver_id': driverId,
                      });

                      final dispatchId = result['id'] ?? result['dispatch_id'];
                      if (dispatchId != null) {
                        await ref.read(storeRepositoryProvider).markDispatched(
                              '$dispatchId',
                              vehicleId: vehicleId,
                              driverId: driverId,
                            );
                      }

                      ref.invalidate(storeResourceProvider(_approvedKey));
                      ref.invalidate(storeResourceProvider(_partialKey));
                      ref.invalidate(dispatchOrdersProvider(null));

                      if (context.mounted) {
                        AppNotifier.showSnackBar(
                          context,
                          const SnackBar(
                              content: Text('Items packed and dispatched')),
                        );
                      }
                    } catch (e) {
                      if (context.mounted) {
                        AppNotifier.showSnackBar(
                          context,
                          SnackBar(content: Text('Dispatch failed: $e')),
                        );
                      }
                    }
                  },
                  child: const Text('Confirm Pack & Dispatch'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ─── Central Stock Takes ───────────────────────────────────────────────────────

class _CentralStockTakesTab extends ConsumerStatefulWidget {
  const _CentralStockTakesTab();
  @override
  ConsumerState<_CentralStockTakesTab> createState() =>
      _CentralStockTakesTabState();
}

class _CentralStockTakesTabState extends ConsumerState<_CentralStockTakesTab> {
  String? _statusFilter;

  @override
  Widget build(BuildContext context) {
    final filter = _statusFilter;
    // Real route: GET /stock-takes (mounted at /stock-takes in index.ts)
    final resourceKey =
        filter == null ? '/stock-takes' : '/stock-takes?status=$filter';
    final takesAsync = ref.watch(storeResourceProvider(resourceKey));
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        Row(children: [
          DropdownButton<String?>(
            value: _statusFilter,
            hint: const Text('All Statuses'),
            items: const [
              DropdownMenuItem(value: null, child: Text('All')),
              DropdownMenuItem(value: 'draft', child: Text('Draft')),
              DropdownMenuItem(
                  value: 'in_progress', child: Text('In Progress')),
              DropdownMenuItem(value: 'submitted', child: Text('Submitted')),
              DropdownMenuItem(value: 'approved', child: Text('Approved')),
              DropdownMenuItem(value: 'rejected', child: Text('Rejected')),
            ],
            onChanged: (v) => setState(() => _statusFilter = v),
          ),
          const Spacer(),
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(storeResourceProvider(resourceKey)),
          ),
          const SizedBox(width: 8),
          ElevatedButton.icon(
            onPressed: () => _startStockTake(context, resourceKey),
            icon: const Icon(Icons.add, size: 16),
            label: const Text('Start Count'),
          ),
        ]),
        const SizedBox(height: 12),
        Expanded(
          child: AsyncValueWidget(
            value: takesAsync,
            data: (takes) {
              if (takes.isEmpty) {
                return const EmptyState(
                    message: 'No central stock takes found');
              }
              return ListView.builder(
                itemCount: takes.length,
                itemBuilder: (_, i) {
                  final t = takes[i];
                  final status = '${t['status'] ?? 'draft'}';
                  final color = status == 'approved'
                      ? AppColors.kSuccess
                      : status == 'submitted'
                          ? AppColors.kPrimary
                          : status == 'rejected'
                              ? AppColors.kError
                              : AppColors.kWarning;
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading:
                          Icon(PhosphorIcons.clipboardText(), color: color),
                      title: Text(
                        '${t['take_number'] ?? t['id']}  —  ${t['store_type'] ?? ''}',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      subtitle: Text(
                          '${(t['created_at'] ?? '').toString().split('T').first}  •  ${t['count_type'] ?? ''}'),
                      trailing: Chip(
                        label: Text(status.toUpperCase(),
                            style: const TextStyle(fontSize: 10)),
                        backgroundColor: color.withValues(alpha: 0.1),
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

  void _startStockTake(BuildContext context, String resourceKey) {
    String storeType = 'foodstuffs';
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Start Central Stock Take'),
          content: SizedBox(
            width: 380,
            child: DropdownButtonFormField<String>(
              isExpanded: true,
              initialValue: storeType,
              decoration: const InputDecoration(labelText: 'Store Type'),
              items: const [
                DropdownMenuItem(
                    value: 'foodstuffs', child: Text('Foodstuffs')),
                DropdownMenuItem(value: 'bar_store', child: Text('Bar Store')),
              ],
              onChanged: (v) => setDialogState(() => storeType = v!),
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                try {
                  // Real route: POST /stock-takes
                  await ref.read(storeRepositoryProvider).createResource(
                    '/stock-takes',
                    {'store_type': storeType, 'count_type': 'daily'},
                  );
                  ref.invalidate(storeResourceProvider(resourceKey));
                  if (context.mounted) {
                    AppNotifier.showSnackBar(context,
                        const SnackBar(content: Text('Stock take started')));
                  }
                } catch (e) {
                  if (context.mounted) {
                    AppNotifier.showSnackBar(
                        context, SnackBar(content: Text('Error: $e')));
                  }
                }
              },
              child: const Text('Start'),
            ),
          ],
        ),
      ),
    );
  }
}

class _InventoryStatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _InventoryStatCard({
    required this.label,
    required this.value,
    required this.icon,
    this.color = AppColors.kPrimary,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.kDivider),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(width: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value,
                    style: const TextStyle(
                        fontSize: 20, fontWeight: FontWeight.bold)),
                Text(label,
                    style: const TextStyle(
                        color: AppColors.kTextSecondary, fontSize: 11)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
