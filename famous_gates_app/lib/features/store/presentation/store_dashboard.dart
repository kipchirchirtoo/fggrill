import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/widgets.dart' hide DataColumn, DataRow;
import '../../../core/widgets/permission_guard.dart';
import '../../../core/widgets/record_detail_screen.dart';
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

  void _jumpToTab(int index) => setState(() => _tab = index);

  @override
  Widget build(BuildContext context) {
    final centralTabs = [
      DashboardTab(
          label: 'Central Store',
          icon: PhosphorIcons.warehouse(),
          content: _CentralStoreOverviewTab(onNavigate: _jumpToTab)),
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
          label: 'Stationery',
          icon: PhosphorIcons.pencil(),
          content: const _StoreResourceTab(
            title: 'Stationery',
            endpoint: '/store/items',
            queryParameters: {'category': 'office_supplies'},
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
          label: 'Receiving',
          icon: PhosphorIcons.signIn(),
          content: const _ReceivingTab()),
      DashboardTab(
          label: 'Purchase Orders',
          icon: PhosphorIcons.fileText(),
          content: const _PurchaseOrdersTab()),
      DashboardTab(
          label: 'Goods Receipt (GRN)',
          icon: PhosphorIcons.clipboardText(),
          content: const _GrnTab()),
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
      DashboardTab(
          label: 'Reports',
          icon: PhosphorIcons.chartBar(),
          content: const _CentralReportsTab()),
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
    openRecordDetailScreen(
      context,
      title: item.name,
      subtitle: 'Inventory Item',
      record: {
        'sku': item.sku,
        'category': item.category,
        'unit': item.unit,
        'current_stock': item.currentStock,
        'min_stock': item.minStock,
        'max_stock': item.maxStock,
        if (item.isLowStock) 'stock_alert': 'Low stock — below minimum level',
      },
    );
  }

}

class _CentralStoreOverviewTab extends ConsumerWidget {
  const _CentralStoreOverviewTab({required this.onNavigate});

  final ValueChanged<int> onNavigate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashAsync = ref.watch(centralStoreDashboardProvider);
    final items = ref.watch(inventoryItemsProvider(null));
    final requests = ref.watch(stockRequestsProvider(null));
    final dispatch = ref.watch(dispatchOrdersProvider(null));
    final suppliers = ref.watch(suppliersProvider);
    final vehicles = ref.watch(fleetVehiclesProvider);
    final drivers = ref.watch(fleetDriversProvider);

    const sections = [
      _CentralStoreSection(
        title: 'Inventory Control',
        actions: [
          _CentralStoreAction(
              label: 'Master Catalog',
              description: 'Global inventory',
              icon: Icons.inventory_2_outlined,
              tabIndex: 1),
          _CentralStoreAction(
              label: 'Foodstuffs',
              description: 'Kitchen and dry store',
              icon: Icons.kitchen_outlined,
              tabIndex: 2),
          _CentralStoreAction(
              label: 'Bar Store',
              description: 'Beverages and liquor',
              icon: Icons.local_bar_outlined,
              tabIndex: 3),
          _CentralStoreAction(
              label: 'Stationery',
              description: 'Office supplies',
              icon: Icons.edit_note_outlined,
              tabIndex: 4),
          _CentralStoreAction(
              label: 'Stock Takes',
              description: 'Foodstuffs and bar counts',
              icon: Icons.fact_check_outlined,
              tabIndex: 5),
          _CentralStoreAction(
              label: 'Spoilage Log',
              description: 'Losses, expiry, damage',
              icon: Icons.delete_outline,
              tabIndex: 6),
        ],
      ),
      _CentralStoreSection(
        title: 'Logistics Hub',
        actions: [
          _CentralStoreAction(
              label: 'Requisitions',
              description: 'Monitor branch requests',
              icon: Icons.assignment_outlined,
              tabIndex: 7),
          _CentralStoreAction(
              label: 'Packing Station',
              description: 'Fulfil approved requests',
              icon: Icons.inventory_outlined,
              tabIndex: 8),
          _CentralStoreAction(
              label: 'Dispatch',
              description: 'Transit tracking',
              icon: Icons.local_shipping_outlined,
              tabIndex: 9),
          _CentralStoreAction(
              label: 'Receiving',
              description: 'Supplier and dispatch receipts',
              icon: Icons.input_outlined,
              tabIndex: 10),
          _CentralStoreAction(
              label: 'Fleet Management',
              description: 'Vehicles and drivers',
              icon: Icons.fire_truck_outlined,
              tabIndex: 14),
        ],
      ),
      _CentralStoreSection(
        title: 'Supplier & Reporting',
        actions: [
          _CentralStoreAction(
              label: 'Purchase Orders',
              description: 'Supplier ordering',
              icon: Icons.receipt_long_outlined,
              tabIndex: 11),
          _CentralStoreAction(
              label: 'Goods Receipt',
              description: 'GRN verification',
              icon: Icons.playlist_add_check_outlined,
              tabIndex: 12),
          _CentralStoreAction(
              label: 'Suppliers',
              description: 'Vendors and contacts',
              icon: Icons.people_outline,
              tabIndex: 13),
          _CentralStoreAction(
              label: 'Reports',
              description: 'Inventory analytics',
              icon: Icons.bar_chart_outlined,
              tabIndex: 16),
        ],
      ),
    ];

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
          _CentralStoreStatsGrid(
            dashAsync: dashAsync,
            items: items,
            requests: requests,
            dispatch: dispatch,
            suppliers: suppliers,
            vehicles: vehicles,
            drivers: drivers,
          ),
          const SizedBox(height: 24),
          ...sections.map((section) => Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: _CentralStoreActionSection(
                  section: section,
                  onNavigate: onNavigate,
                ),
              )),
        ],
      ),
    );
  }
}

class _CentralStoreStatsGrid extends StatelessWidget {
  const _CentralStoreStatsGrid({
    required this.dashAsync,
    required this.items,
    required this.requests,
    required this.dispatch,
    required this.suppliers,
    required this.vehicles,
    required this.drivers,
  });

  final AsyncValue<Map<String, dynamic>> dashAsync;
  final AsyncValue<List<InventoryItem>> items;
  final AsyncValue<List<StockRequest>> requests;
  final AsyncValue<List<Map<String, dynamic>>> dispatch;
  final AsyncValue<List<Supplier>> suppliers;
  final AsyncValue<List<Map<String, dynamic>>> vehicles;
  final AsyncValue<List<Map<String, dynamic>>> drivers;

  @override
  Widget build(BuildContext context) {
    final statCards = [
      _CentralStoreMetric(
        label: 'Master Items',
        value: dashAsync.maybeWhen(
          data: (d) =>
              '${_storeNum(d['totalItems'] ?? d['stats']?['totalItems']) > 0 ? _storeNum(d['totalItems'] ?? d['stats']?['totalItems']).toInt() : items.maybeWhen(data: (list) => list.length, orElse: () => '-')}',
          orElse: () => items.maybeWhen(
              data: (list) => '${list.length}', orElse: () => '-'),
        ),
        icon: Icons.inventory_2_outlined,
        color: AppColors.kPrimary,
      ),
      _CentralStoreMetric(
        label: 'Low Stock',
        value: dashAsync.maybeWhen(
          data: (d) {
            final lowStockItems = d['lowStockItems'];
            if (lowStockItems is List) return '${lowStockItems.length}';
            return '${_storeNum(d['lowStock'] ?? d['stats']?['lowStock']).toInt()}';
          },
          orElse: () => items.maybeWhen(
            data: (list) => '${list.where((item) => item.isLowStock).length}',
            orElse: () => '-',
          ),
        ),
        icon: Icons.warning_amber_outlined,
        color: AppColors.kError,
      ),
      _CentralStoreMetric(
        label: 'Pending Requests',
        value: requests.maybeWhen(
          data: (list) => '${list.where((request) {
            final status = (request.status ?? '').toUpperCase();
            return status.isEmpty || status == 'PENDING';
          }).length}',
          orElse: () => dashAsync.maybeWhen(
            data: (d) => '${_storeNum(d['pendingRequests']).toInt()}',
            orElse: () => '-',
          ),
        ),
        icon: Icons.assignment_outlined,
        color: AppColors.kWarning,
      ),
      _CentralStoreMetric(
        label: 'In Transit',
        value: dashAsync.maybeWhen(
          data: (d) =>
              '${_storeNum(d['inTransit'] ?? d['stats']?['inTransit']).toInt()}',
          orElse: () => dispatch.maybeWhen(
            data: (list) => '${list.where((row) {
              final status = '${row['status']}'.toLowerCase();
              return status == 'in_transit' || status == 'dispatched';
            }).length}',
            orElse: () => '-',
          ),
        ),
        icon: Icons.local_shipping_outlined,
        color: Colors.blue,
      ),
      _CentralStoreMetric(
        label: 'Suppliers',
        value: suppliers.maybeWhen(
            data: (list) => '${list.length}', orElse: () => '-'),
        icon: Icons.people_outline,
        color: Colors.teal,
      ),
      _CentralStoreMetric(
        label: 'Fleet',
        value: vehicles.maybeWhen(
          data: (fleet) => drivers.maybeWhen(
            data: (crew) => '${fleet.length} / ${crew.length}',
            orElse: () => '${fleet.length} / -',
          ),
          orElse: () => '-',
        ),
        icon: Icons.fire_truck_outlined,
        color: Colors.deepPurple,
      ),
    ];
    return LayoutBuilder(builder: (context, constraints) {
      final width = constraints.maxWidth < 720
          ? constraints.maxWidth
          : (constraints.maxWidth - 24) / 3;
      return Wrap(
        spacing: 12,
        runSpacing: 12,
        children: statCards
            .map((card) => SizedBox(width: width, child: card))
            .toList(),
      );
    });
  }
}

class _CentralStoreMetric extends StatelessWidget {
  const _CentralStoreMetric({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 92,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.kDivider),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: color.withValues(alpha: .1),
              borderRadius: BorderRadius.circular(8),
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
                        fontSize: 20, fontWeight: FontWeight.w900)),
                Text(label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        color: AppColors.kTextSecondary, fontSize: 12)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CentralStoreSection {
  const _CentralStoreSection({required this.title, required this.actions});
  final String title;
  final List<_CentralStoreAction> actions;
}

class _CentralStoreAction {
  const _CentralStoreAction({
    required this.label,
    required this.description,
    required this.icon,
    required this.tabIndex,
  });

  final String label;
  final String description;
  final IconData icon;
  final int tabIndex;
}

class _CentralStoreActionSection extends StatelessWidget {
  const _CentralStoreActionSection({
    required this.section,
    required this.onNavigate,
  });

  final _CentralStoreSection section;
  final ValueChanged<int> onNavigate;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.kDivider),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(section.title.toUpperCase(),
              style: const TextStyle(
                  color: AppColors.kTextSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                  letterSpacing: .6)),
          const SizedBox(height: 14),
          LayoutBuilder(builder: (context, constraints) {
            final width = constraints.maxWidth < 760
                ? constraints.maxWidth
                : (constraints.maxWidth - 24) / 3;
            return Wrap(
              spacing: 12,
              runSpacing: 12,
              children: section.actions
                  .map((action) => SizedBox(
                        width: width,
                        child: _CentralStoreActionCard(
                          action: action,
                          onTap: () => onNavigate(action.tabIndex),
                        ),
                      ))
                  .toList(),
            );
          }),
        ],
      ),
    );
  }
}

class _CentralStoreActionCard extends StatelessWidget {
  const _CentralStoreActionCard({required this.action, required this.onTap});

  final _CentralStoreAction action;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.kSurface,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Container(
          height: 78,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.kDivider),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.kDivider),
                ),
                child: Icon(action.icon, color: AppColors.kPrimary, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(action.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                    Text(action.description,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            color: AppColors.kTextSecondary, fontSize: 12)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right,
                  color: AppColors.kTextSecondary, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}

class _StoreResourceTab extends ConsumerStatefulWidget {
  const _StoreResourceTab({
    required this.title,
    required this.endpoint,
    this.fields = const ['name', 'description'],
    this.queryStoreType,
    this.queryParameters = const {},
  });

  final String title;
  final String endpoint;
  final List<String> fields;
  final String? queryStoreType;
  final Map<String, String> queryParameters;

  @override
  ConsumerState<_StoreResourceTab> createState() => _StoreResourceTabState();
}

class _StoreResourceTabState extends ConsumerState<_StoreResourceTab> {
  String _search = '';
  String _status = 'all';

  @override
  Widget build(BuildContext context) {
    final query = <String, String>{
      ...widget.queryParameters,
      if (widget.queryStoreType != null) 'store_type': widget.queryStoreType!,
    };
    final resourceKey = query.isEmpty
        ? widget.endpoint
        : Uri(path: widget.endpoint, queryParameters: query).toString();
    final rowsAsync = ref.watch(storeResourceProvider(resourceKey));
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                  child: Text(widget.title,
                      style: Theme.of(context).textTheme.displaySmall)),
              SizedBox(
                width: 260,
                child: TextField(
                  decoration: const InputDecoration(
                    hintText: 'Search records',
                    prefixIcon: Icon(Icons.search),
                    contentPadding: EdgeInsets.zero,
                  ),
                  onChanged: (value) => setState(() => _search = value),
                ),
              ),
              const SizedBox(width: 12),
              _StoreStatusFilter(
                value: _status,
                onChanged: (value) => setState(() => _status = value),
              ),
              const SizedBox(width: 8),
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
                label: const Text('New'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
            child: rowsAsync.when(
              data: (rows) {
                final filtered = rows.where(_matchesFilters).toList();
                if (filtered.isEmpty) {
                  return EmptyState(
                      message: 'No ${widget.title} records found');
                }
                return Column(
                  children: [
                    _StoreResourceSummary(rows: filtered),
                    const SizedBox(height: 12),
                    Expanded(
                      child: ListView.separated(
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (_, i) => _resourceTile(filtered[i]),
                      ),
                    ),
                  ],
                );
              },
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

  bool _matchesFilters(Map<String, dynamic> row) {
    final lower = _search.trim().toLowerCase();
    final status = '${row['status'] ?? ''}'.toLowerCase();
    final matchesStatus = _status == 'all' || status == _status.toLowerCase();
    if (!matchesStatus) return false;
    if (lower.isEmpty) return true;
    final haystack = [
      _primary(row),
      _secondary(row),
      row['status'],
      row['sku'],
      row['item_sku'],
      row['category'],
      row['registration_number'],
      row['phone'],
      row['email'],
    ].where((part) => part != null).join(' ').toLowerCase();
    return haystack.contains(lower);
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
      for (final field in widget.fields) field: TextEditingController(),
    };
    final body = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('New ${widget.title}'),
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
              ...widget.queryParameters,
              if (widget.queryStoreType != null)
                'store_type': widget.queryStoreType,
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
      await ref
          .read(storeRepositoryProvider)
          .createResource(widget.endpoint, body);
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

class _StoreStatusFilter extends StatelessWidget {
  const _StoreStatusFilter({required this.value, required this.onChanged});

  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButton<String>(
      value: value,
      items: const [
        DropdownMenuItem(value: 'all', child: Text('All')),
        DropdownMenuItem(value: 'active', child: Text('Active')),
        DropdownMenuItem(value: 'pending', child: Text('Pending')),
        DropdownMenuItem(value: 'approved', child: Text('Approved')),
        DropdownMenuItem(value: 'completed', child: Text('Completed')),
        DropdownMenuItem(value: 'dispatched', child: Text('Dispatched')),
        DropdownMenuItem(value: 'in_transit', child: Text('In Transit')),
        DropdownMenuItem(value: 'rejected', child: Text('Rejected')),
        DropdownMenuItem(value: 'inactive', child: Text('Inactive')),
      ],
      onChanged: (next) {
        if (next != null) onChanged(next);
      },
    );
  }
}

class _StoreResourceSummary extends StatelessWidget {
  const _StoreResourceSummary({required this.rows});

  final List<Map<String, dynamic>> rows;

  @override
  Widget build(BuildContext context) {
    final statuses = <String>{};
    for (final row in rows) {
      final status = '${row['status'] ?? ''}'.trim();
      if (status.isNotEmpty) statuses.add(status.toUpperCase());
    }
    final qty = rows.fold<num>(
        0,
        (sum, row) =>
            sum +
            _storeNum(row['quantity'] ??
                row['current_stock'] ??
                row['stock_quantity'] ??
                row['total_quantity']));
    return Row(
      children: [
        Expanded(
          child: _StoreMiniMetric(
              label: 'Records', value: '${rows.length}', icon: Icons.dataset),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StoreMiniMetric(
              label: 'Quantity',
              value: qty == 0 ? '-' : qty.toStringAsFixed(0),
              icon: Icons.inventory_2_outlined),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StoreMiniMetric(
              label: 'Statuses',
              value: statuses.isEmpty ? '-' : '${statuses.length}',
              icon: Icons.flag_outlined),
        ),
      ],
    );
  }
}

class _StoreMiniMetric extends StatelessWidget {
  const _StoreMiniMetric({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: AppColors.kSurface,
        border: Border.all(color: AppColors.kDivider),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppColors.kPrimary, size: 19),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w900)),
                Text(label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        color: AppColors.kTextSecondary, fontSize: 11)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PurchaseOrdersTab extends ConsumerStatefulWidget {
  const _PurchaseOrdersTab();

  @override
  ConsumerState<_PurchaseOrdersTab> createState() => _PurchaseOrdersTabState();
}

class _PurchaseOrdersTabState extends ConsumerState<_PurchaseOrdersTab> {
  bool _creating = false;
  bool _saving = false;
  String _status = 'all';
  String _search = '';
  String? _supplierId;
  String? _selectedSupplierId;
  DateTime _poDate = DateTime.now();
  DateTime? _expectedDate;
  String _paymentTerms = 'credit_30_days';
  String _deliveryTerms = '';
  String _remarks = '';
  String _outlet = 'Central Store';
  final _bulkController = TextEditingController();
  final List<_ParsedPOItem> _parsedItems = [];

  String get _ordersKey {
    final params = <String, String>{
      'source_module': 'central_store',
      'limit': '100',
      if (_status != 'all') 'status': _status,
      if (_supplierId != null && _supplierId!.isNotEmpty)
        'supplier_id': _supplierId!,
    };
    return Uri(path: '/procurement/purchase-orders', queryParameters: params)
        .toString();
  }

  @override
  void dispose() {
    _bulkController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final suppliersAsync = ref.watch(suppliersProvider);
    final inventoryAsync = ref.watch(inventoryItemsProvider(null));
    final ordersAsync = ref.watch(storeResourceProvider(_ordersKey));
    final suppliers = suppliersAsync.valueOrNull ?? const <Supplier>[];
    final inventory = inventoryAsync.valueOrNull ?? const <InventoryItem>[];

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _creating ? 'Create Purchase Order' : 'Purchase Orders',
                        style: Theme.of(context).textTheme.displaySmall,
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Central-store supplier ordering with bulk item paste, SKU validation, approval, and supplier sending.',
                        style: TextStyle(color: AppColors.kTextSecondary),
                      ),
                    ]),
              ),
              if (_creating)
                OutlinedButton.icon(
                  onPressed: _saving
                      ? null
                      : () => setState(() {
                            _creating = false;
                            _resetCreateForm();
                          }),
                  icon: const Icon(Icons.arrow_back, size: 16),
                  label: const Text('Back to POs'),
                )
              else ...[
                IconButton(
                  tooltip: 'Refresh',
                  onPressed: () {
                    ref.invalidate(storeResourceProvider(_ordersKey));
                    ref.invalidate(suppliersProvider);
                    ref.invalidate(inventoryItemsProvider(null));
                  },
                  icon: const Icon(Icons.refresh),
                ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  onPressed: () => setState(() => _creating = true),
                  icon: const Icon(Icons.add, size: 16),
                  label: const Text('Create PO'),
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size(132, 42),
                    backgroundColor: AppColors.kPrimary,
                    foregroundColor: Colors.white,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 18),
          if (_creating)
            Expanded(
              child: _buildCreateScreen(context, suppliers, inventory),
            )
          else
            Expanded(
              child: _buildOrdersList(context, ordersAsync, suppliers),
            ),
        ],
      ),
    );
  }

  Widget _buildOrdersList(
    BuildContext context,
    AsyncValue<List<Map<String, dynamic>>> ordersAsync,
    List<Supplier> suppliers,
  ) {
    return Column(
      children: [
        Wrap(
          spacing: 12,
          runSpacing: 12,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            SizedBox(
              width: 300,
              child: TextField(
                decoration: const InputDecoration(
                  hintText: 'Search PO, supplier, status',
                  prefixIcon: Icon(Icons.search),
                  contentPadding: EdgeInsets.zero,
                ),
                onChanged: (value) => setState(() => _search = value),
              ),
            ),
            SizedBox(
              width: 180,
              child: DropdownButtonFormField<String>(
                initialValue: _status,
                decoration: const InputDecoration(labelText: 'Status'),
                items: const [
                  DropdownMenuItem(value: 'all', child: Text('All')),
                  DropdownMenuItem(value: 'draft', child: Text('Draft')),
                  DropdownMenuItem(value: 'pending', child: Text('Pending')),
                  DropdownMenuItem(value: 'approved', child: Text('Approved')),
                  DropdownMenuItem(value: 'sent', child: Text('Sent')),
                  DropdownMenuItem(value: 'received', child: Text('Received')),
                  DropdownMenuItem(
                      value: 'cancelled', child: Text('Cancelled')),
                ],
                onChanged: (value) => setState(() => _status = value ?? 'all'),
              ),
            ),
            SizedBox(
              width: 260,
              child: DropdownButtonFormField<String?>(
                initialValue: _supplierId,
                decoration: const InputDecoration(labelText: 'Supplier'),
                items: [
                  const DropdownMenuItem<String?>(
                      value: null, child: Text('All suppliers')),
                  ...suppliers.map((supplier) => DropdownMenuItem<String?>(
                        value: supplier.id,
                        child: Text(supplier.name,
                            overflow: TextOverflow.ellipsis),
                      )),
                ],
                onChanged: (value) => setState(() => _supplierId = value),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Expanded(
          child: ordersAsync.when(
            data: (orders) {
              final filtered = orders.where(_matchesOrderFilters).toList();
              final open = filtered.where((po) {
                final status = '${po['status'] ?? ''}'.toLowerCase();
                return status == 'draft' ||
                    status == 'pending' ||
                    status == 'approved';
              }).length;
              final pending = filtered
                  .where((po) =>
                      '${po['status'] ?? ''}'.toLowerCase() == 'pending')
                  .length;
              final value = filtered.fold<num>(
                  0, (sum, po) => sum + _storeNum(po['total_amount']));

              return Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                          child: _StoreMiniMetric(
                              label: 'Open POs',
                              value: '$open',
                              icon: Icons.receipt_long_outlined)),
                      const SizedBox(width: 12),
                      Expanded(
                          child: _StoreMiniMetric(
                              label: 'Pending Approval',
                              value: '$pending',
                              icon: Icons.pending_actions_outlined)),
                      const SizedBox(width: 12),
                      Expanded(
                          child: _StoreMiniMetric(
                              label: 'Total Value',
                              value: _storeMoney(value),
                              icon: Icons.payments_outlined)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Expanded(
                    child: filtered.isEmpty
                        ? const EmptyState(message: 'No purchase orders found')
                        : ListView.separated(
                            itemCount: filtered.length,
                            separatorBuilder: (_, __) =>
                                const Divider(height: 1),
                            itemBuilder: (_, index) =>
                                _purchaseOrderTile(filtered[index]),
                          ),
                  ),
                ],
              );
            },
            loading: () => const LoadingSkeleton(type: SkeletonType.list),
            error: (e, _) => ErrorState(
              message: '$e',
              onRetry: () => ref.invalidate(storeResourceProvider(_ordersKey)),
            ),
          ),
        ),
      ],
    );
  }

  bool _matchesOrderFilters(Map<String, dynamic> order) {
    final needle = _search.trim().toLowerCase();
    if (needle.isEmpty) return true;
    final supplier = order['supplier'];
    final supplierName =
        supplier is Map ? supplier['name'] : order['supplier_name'];
    final haystack = [
      order['po_number'],
      supplierName,
      order['status'],
      order['po_date'],
      order['expected_delivery_date'],
    ].where((part) => part != null).join(' ').toLowerCase();
    return haystack.contains(needle);
  }

  Widget _purchaseOrderTile(Map<String, dynamic> order) {
    final status = '${order['status'] ?? 'draft'}'.toLowerCase();
    final supplier = order['supplier'];
    final supplierName =
        supplier is Map ? supplier['name'] : order['supplier_name'];
    final statusColor = _poStatusColor(status);
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: statusColor.withValues(alpha: .1),
          child:
              Icon(Icons.receipt_long_outlined, color: statusColor, size: 18),
        ),
        title: Text('${order['po_number'] ?? 'Draft PO'}',
            style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text(
          '${supplierName ?? 'Supplier'}  •  ${(order['po_date'] ?? order['created_at'] ?? '').toString().split('T').first}  •  ${_storeMoney(_storeNum(order['total_amount']))}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: Wrap(
          spacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Chip(
              label: Text(status.toUpperCase(),
                  style: const TextStyle(
                      fontSize: 10, fontWeight: FontWeight.w800)),
              backgroundColor: statusColor.withValues(alpha: .1),
              side: BorderSide(color: statusColor.withValues(alpha: .25)),
            ),
            OutlinedButton(
              onPressed: () => _showPurchaseOrderDetail(order),
              child: const Text('View'),
            ),
            if (status == 'draft' || status == 'pending')
              ElevatedButton(
                onPressed: () => _runPOAction(
                  () => ref
                      .read(storeRepositoryProvider)
                      .approvePurchaseOrder('${order['id']}'),
                  'Purchase order approved',
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.kPrimary,
                  foregroundColor: Colors.white,
                ),
                child: const Text('Approve'),
              ),
            if (status == 'approved' || status == 'sent')
              OutlinedButton(
                onPressed: () => _runPOAction(
                  () => ref
                      .read(storeRepositoryProvider)
                      .sendPurchaseOrder('${order['id']}'),
                  'Purchase order sent',
                ),
                child: const Text('Send'),
              ),
            if (status != 'cancelled' && status != 'received')
              TextButton(
                onPressed: () => _runPOAction(
                  () => ref
                      .read(storeRepositoryProvider)
                      .cancelPurchaseOrder('${order['id']}'),
                  'Purchase order cancelled',
                ),
                child: const Text('Cancel'),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildCreateScreen(
    BuildContext context,
    List<Supplier> suppliers,
    List<InventoryItem> inventory,
  ) {
    final validRows = _validParsedItems;
    final total = validRows.fold<num>(0, (sum, item) => sum + item.lineTotal);
    final hasErrors = _parsedItems.any((item) => item.error != null);

    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: _panelDecoration(),
                  child: LayoutBuilder(builder: (context, constraints) {
                    final fieldWidth = constraints.maxWidth < 760
                        ? constraints.maxWidth
                        : (constraints.maxWidth - 24) / 3;
                    return Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        SizedBox(
                          width: fieldWidth,
                          child: DropdownButtonFormField<String>(
                            initialValue: _selectedSupplierId,
                            decoration:
                                const InputDecoration(labelText: 'Supplier'),
                            items: suppliers
                                .map((supplier) => DropdownMenuItem(
                                      value: supplier.id,
                                      child: Text(supplier.name,
                                          overflow: TextOverflow.ellipsis),
                                    ))
                                .toList(),
                            onChanged: (value) =>
                                setState(() => _selectedSupplierId = value),
                          ),
                        ),
                        SizedBox(
                          width: fieldWidth,
                          child: DropdownButtonFormField<String>(
                            initialValue: _outlet,
                            decoration: const InputDecoration(
                                labelText: 'Outlet / destination'),
                            items: const [
                              DropdownMenuItem(
                                  value: 'Central Store',
                                  child: Text('Central Store')),
                              DropdownMenuItem(
                                  value: 'Restaurant POS',
                                  child: Text('Restaurant POS')),
                              DropdownMenuItem(
                                  value: 'Bar POS', child: Text('Bar POS')),
                              DropdownMenuItem(
                                  value: 'Room Service',
                                  child: Text('Room Service')),
                              DropdownMenuItem(
                                  value: 'Branch Operations',
                                  child: Text('Branch Operations')),
                            ],
                            onChanged: (value) =>
                                setState(() => _outlet = value ?? _outlet),
                          ),
                        ),
                        SizedBox(
                          width: fieldWidth,
                          child: DropdownButtonFormField<String>(
                            initialValue: _paymentTerms,
                            decoration: const InputDecoration(
                                labelText: 'Payment terms'),
                            items: const [
                              DropdownMenuItem(
                                  value: 'cash', child: Text('Cash')),
                              DropdownMenuItem(
                                  value: 'credit_7_days',
                                  child: Text('Credit 7 days')),
                              DropdownMenuItem(
                                  value: 'credit_15_days',
                                  child: Text('Credit 15 days')),
                              DropdownMenuItem(
                                  value: 'credit_30_days',
                                  child: Text('Credit 30 days')),
                              DropdownMenuItem(
                                  value: 'credit_45_days',
                                  child: Text('Credit 45 days')),
                              DropdownMenuItem(
                                  value: 'credit_60_days',
                                  child: Text('Credit 60 days')),
                              DropdownMenuItem(
                                  value: 'advance_payment',
                                  child: Text('Advance payment')),
                            ],
                            onChanged: (value) => setState(
                                () => _paymentTerms = value ?? _paymentTerms),
                          ),
                        ),
                        SizedBox(
                          width: fieldWidth,
                          child: _DateSelectField(
                            label: 'PO date',
                            value: _poDate,
                            onPicked: (date) => setState(() {
                              _poDate = date;
                              if (_expectedDate != null &&
                                  _expectedDate!.isBefore(_poDate)) {
                                _expectedDate = _poDate;
                              }
                            }),
                          ),
                        ),
                        SizedBox(
                          width: fieldWidth,
                          child: _DateSelectField(
                            label: 'Expected delivery',
                            value: _expectedDate,
                            firstDate: _poDate,
                            onPicked: (date) =>
                                setState(() => _expectedDate = date),
                          ),
                        ),
                        SizedBox(
                          width: fieldWidth,
                          child: TextField(
                            decoration: const InputDecoration(
                              labelText: 'Delivery location / terms',
                            ),
                            onChanged: (value) => _deliveryTerms = value,
                          ),
                        ),
                        SizedBox(
                          width: constraints.maxWidth,
                          child: TextField(
                            minLines: 2,
                            maxLines: 3,
                            decoration: const InputDecoration(
                              labelText: 'Remarks / special instructions',
                            ),
                            onChanged: (value) => _remarks = value,
                          ),
                        ),
                      ],
                    );
                  }),
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: _panelDecoration(),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          const Expanded(
                            child: Text('Bulk item entry',
                                style: TextStyle(
                                    fontWeight: FontWeight.w900, fontSize: 16)),
                          ),
                          OutlinedButton.icon(
                            onPressed: () => _parseBulkItems(inventory),
                            icon: const Icon(Icons.auto_fix_high, size: 16),
                            label: const Text('Parse Items'),
                          ),
                        ]),
                        const SizedBox(height: 10),
                        TextField(
                          controller: _bulkController,
                          minLines: 6,
                          maxLines: 10,
                          decoration: const InputDecoration(
                            alignLabelWithHint: true,
                            labelText: 'Paste many items at once',
                            hintText:
                                'KC PINEAPPLE 750ML, 120, PCS\nFANTA ORANGE 500ML 50 PCS\nMILK 1L - 80 - PACKS\nSUGAR 2KG | 30 | BAGS',
                          ),
                        ),
                      ]),
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: _panelDecoration(),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          const Expanded(
                            child: Text('Parsed items',
                                style: TextStyle(
                                    fontWeight: FontWeight.w900, fontSize: 16)),
                          ),
                          Text(
                            '${validRows.length} valid / ${_parsedItems.length} rows',
                            style: TextStyle(
                              color: hasErrors
                                  ? AppColors.kError
                                  : AppColors.kSuccess,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ]),
                        const SizedBox(height: 10),
                        if (_parsedItems.isEmpty)
                          const Padding(
                            padding: EdgeInsets.all(24),
                            child: EmptyState(
                                message:
                                    'Paste item lines and click Parse Items'),
                          )
                        else
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: DataTable(
                              columns: const [
                                DataColumn(label: Text('Item')),
                                DataColumn(label: Text('SKU')),
                                DataColumn(label: Text('Qty')),
                                DataColumn(label: Text('Unit')),
                                DataColumn(label: Text('Unit Cost')),
                                DataColumn(label: Text('Total')),
                                DataColumn(label: Text('Validation')),
                                DataColumn(label: Text('')),
                              ],
                              rows: _parsedItems
                                  .map(
                                      (item) => _parsedItemRow(item, inventory))
                                  .toList(),
                            ),
                          ),
                      ]),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: _panelDecoration(),
          child: Row(
            children: [
              _StoreMiniMetric(
                  label: 'Lines',
                  value: '${validRows.length}',
                  icon: Icons.playlist_add_check_outlined),
              const SizedBox(width: 12),
              SizedBox(
                width: 220,
                child: _StoreMiniMetric(
                    label: 'Grand Total',
                    value: _storeMoney(total),
                    icon: Icons.payments_outlined),
              ),
              const Spacer(),
              OutlinedButton(
                onPressed: _saving ? null : () => setState(_resetCreateForm),
                child: const Text('Clear'),
              ),
              const SizedBox(width: 8),
              ElevatedButton.icon(
                onPressed: _saving ? null : () => _savePurchaseOrder(false),
                icon: const Icon(Icons.save_outlined, size: 16),
                label: Text(_saving ? 'Saving...' : 'Save Draft'),
              ),
              const SizedBox(width: 8),
              ElevatedButton.icon(
                onPressed: _saving ? null : () => _savePurchaseOrder(true),
                icon: const Icon(Icons.check_circle_outline, size: 16),
                label: Text(_saving ? 'Submitting...' : 'Submit / Approve'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.kPrimary,
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  DataRow _parsedItemRow(_ParsedPOItem item, List<InventoryItem> inventory) {
    final hasError = item.error != null;
    return DataRow(
      color: WidgetStateProperty.resolveWith(
          (_) => hasError ? AppColors.kError.withValues(alpha: .05) : null),
      cells: [
        DataCell(SizedBox(
          width: 240,
          child: TextFormField(
            key: ValueKey('${item.key}-name'),
            initialValue: item.name,
            decoration: const InputDecoration(border: InputBorder.none),
            onChanged: (value) => setState(() {
              item.name = value;
              _resolveParsedItem(item, inventory);
              _validateParsedItems();
            }),
          ),
        )),
        DataCell(Text(item.sku ?? '--')),
        DataCell(SizedBox(
          width: 84,
          child: TextFormField(
            key: ValueKey('${item.key}-qty'),
            initialValue:
                item.quantity == 0 ? '' : _storePlainNum(item.quantity),
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(border: InputBorder.none),
            onChanged: (value) => setState(() {
              item.quantity = num.tryParse(value) ?? 0;
              _validateParsedItems();
            }),
          ),
        )),
        DataCell(SizedBox(
          width: 92,
          child: TextFormField(
            key: ValueKey('${item.key}-unit'),
            initialValue: item.unit,
            decoration: const InputDecoration(border: InputBorder.none),
            onChanged: (value) => setState(() {
              item.unit = value.toUpperCase();
              _validateParsedItems();
            }),
          ),
        )),
        DataCell(SizedBox(
          width: 110,
          child: TextFormField(
            key: ValueKey('${item.key}-cost'),
            initialValue:
                item.unitCost == 0 ? '' : _storePlainNum(item.unitCost),
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(border: InputBorder.none),
            onChanged: (value) => setState(() {
              item.unitCost = num.tryParse(value) ?? 0;
              _validateParsedItems();
            }),
          ),
        )),
        DataCell(Text(_storeMoney(item.lineTotal))),
        DataCell(SizedBox(
          width: 210,
          child: Text(
            item.error ?? 'Ready',
            style: TextStyle(
              color: hasError ? AppColors.kError : AppColors.kSuccess,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        )),
        DataCell(IconButton(
          tooltip: 'Remove',
          icon: const Icon(Icons.close, size: 18),
          onPressed: () => setState(() {
            _parsedItems.remove(item);
            _validateParsedItems();
          }),
        )),
      ],
    );
  }

  void _parseBulkItems(List<InventoryItem> inventory) {
    final lines = _bulkController.text
        .split('\n')
        .map((line) => line.trim())
        .where((line) => line.isNotEmpty)
        .toList();
    setState(() {
      _parsedItems
        ..clear()
        ..addAll(lines.indexed.map((entry) {
          final parsed = _parseLine(entry.$2, entry.$1);
          _resolveParsedItem(parsed, inventory);
          return parsed;
        }));
      _validateParsedItems();
    });
  }

  _ParsedPOItem _parseLine(String line, int index) {
    final clean = line.replaceAll(RegExp(r'\s+'), ' ').trim();
    List<String> parts = const [];
    if (clean.contains(',')) {
      parts = clean.split(',').map((p) => p.trim()).toList();
    } else if (clean.contains('|')) {
      parts = clean.split('|').map((p) => p.trim()).toList();
    } else if (clean.contains(' - ')) {
      parts = clean.split(RegExp(r'\s+-\s+')).map((p) => p.trim()).toList();
    }

    if (parts.length >= 2) {
      return _ParsedPOItem(
        key: '${DateTime.now().microsecondsSinceEpoch}-$index',
        sourceLine: line,
        name: parts.first,
        quantity: num.tryParse(parts[1]) ?? 0,
        unit: parts.length > 2 ? parts[2].toUpperCase() : '',
      );
    }

    final compact =
        RegExp(r'^(.+?)\s+(\d+(?:\.\d+)?)\s*([A-Za-z][A-Za-z0-9/_-]*)?$')
            .firstMatch(clean);
    if (compact != null) {
      return _ParsedPOItem(
        key: '${DateTime.now().microsecondsSinceEpoch}-$index',
        sourceLine: line,
        name: compact.group(1)?.trim() ?? '',
        quantity: num.tryParse(compact.group(2) ?? '') ?? 0,
        unit: (compact.group(3) ?? '').toUpperCase(),
      );
    }

    return _ParsedPOItem(
      key: '${DateTime.now().microsecondsSinceEpoch}-$index',
      sourceLine: line,
      name: clean,
      quantity: 0,
      unit: '',
      error: 'Could not read quantity',
    );
  }

  void _resolveParsedItem(_ParsedPOItem parsed, List<InventoryItem> inventory) {
    final match = _findInventoryMatch(parsed.name, inventory);
    parsed.inventoryItem = match;
    parsed.sku = match?.sku;
    if (parsed.unit.isEmpty && match?.unit != null) {
      parsed.unit = match!.unit!.toUpperCase();
    }
  }

  InventoryItem? _findInventoryMatch(
      String rawName, List<InventoryItem> inventory) {
    final normalized = _normalizeItemName(rawName);
    for (final item in inventory) {
      if ((item.sku ?? '').toLowerCase() == rawName.toLowerCase()) {
        return item;
      }
      if (_normalizeItemName(item.name) == normalized) return item;
    }
    for (final item in inventory) {
      final itemName = _normalizeItemName(item.name);
      if (itemName.contains(normalized) || normalized.contains(itemName)) {
        return item;
      }
    }
    return null;
  }

  void _validateParsedItems() {
    final seen = <String>{};
    for (final item in _parsedItems) {
      String? error;
      if (item.error == 'Could not read quantity' && item.quantity <= 0) {
        error = item.error;
      } else if (item.name.trim().isEmpty) {
        error = 'Item name is required';
      } else if (item.quantity <= 0) {
        error = 'Quantity must be greater than zero';
      } else if (item.sku == null || item.sku!.trim().isEmpty) {
        error = 'No matching inventory SKU';
      } else if (item.unit.trim().isEmpty) {
        error = 'Unit is required';
      } else if (!_validUnits.contains(item.unit.trim().toUpperCase())) {
        error = 'Invalid unit';
      } else if (item.unitCost < 0) {
        error = 'Unit cost cannot be negative';
      }
      final duplicateKey =
          '${item.sku ?? _normalizeItemName(item.name)}:${item.unit}';
      if (error == null && seen.contains(duplicateKey)) {
        error = 'Duplicate item/unit row';
      }
      seen.add(duplicateKey);
      item.error = error;
    }
  }

  List<_ParsedPOItem> get _validParsedItems =>
      _parsedItems.where((item) => item.error == null).toList();

  Future<void> _savePurchaseOrder(bool approveNow) async {
    _validateParsedItems();
    if (_selectedSupplierId == null || _selectedSupplierId!.isEmpty) {
      _notify('Select a supplier before saving');
      return;
    }
    if (_parsedItems.isEmpty) {
      _notify('Paste and parse at least one item');
      return;
    }
    if (_parsedItems.any((item) => item.error != null)) {
      _notify('Fix invalid item rows before saving');
      return;
    }
    if (_expectedDate != null && _expectedDate!.isBefore(_poDate)) {
      _notify('Expected delivery cannot be before PO date');
      return;
    }

    setState(() => _saving = true);
    try {
      final payload = {
        'supplier_id': _selectedSupplierId,
        'po_date': _isoDate(_poDate),
        if (_expectedDate != null)
          'expected_delivery_date': _isoDate(_expectedDate!),
        'payment_terms': _paymentTerms,
        'delivery_terms': [
          if (_deliveryTerms.trim().isNotEmpty) _deliveryTerms.trim(),
          if (_outlet.trim().isNotEmpty) 'Outlet: $_outlet',
        ].join(' | '),
        if (_remarks.trim().isNotEmpty) 'special_instructions': _remarks.trim(),
        'auto_approve': approveNow,
        'items': _parsedItems
            .map((item) => {
                  'item_id': item.sku,
                  'quantity': item.quantity,
                  'unit_price': item.unitCost,
                  'tax_amount': 0,
                  'total_price': item.lineTotal,
                })
            .toList(),
      };
      await ref.read(storeRepositoryProvider).createPurchaseOrder(payload);
      ref.invalidate(storeResourceProvider(_ordersKey));
      if (!mounted) return;
      AppNotifier.showSnackBar(
        context,
        SnackBar(
          content:
              Text(approveNow ? 'Purchase order approved' : 'Draft PO saved'),
        ),
      );
      setState(() {
        _creating = false;
        _resetCreateForm();
      });
    } catch (e) {
      if (mounted) _notify('Error: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _runPOAction(
      Future<void> Function() action, String message) async {
    try {
      await action();
      ref.invalidate(storeResourceProvider(_ordersKey));
      if (mounted) {
        AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
      }
    } catch (e) {
      if (mounted) _notify('Error: $e');
    }
  }

  void _showPurchaseOrderDetail(Map<String, dynamic> order) {
    final supplierName = order['supplier_name'] ??
        (order['supplier'] is Map ? order['supplier']['name'] : null);
    openRecordDetailScreen(
      context,
      title: '${order['po_number'] ?? 'Purchase Order'}',
      subtitle: 'Purchase Order',
      record: {
        ...order,
        if (supplierName != null) 'supplier_name': supplierName,
      },
    );
  }


  void _resetCreateForm() {
    _selectedSupplierId = null;
    _poDate = DateTime.now();
    _expectedDate = null;
    _paymentTerms = 'credit_30_days';
    _deliveryTerms = '';
    _remarks = '';
    _outlet = 'Central Store';
    _bulkController.clear();
    _parsedItems.clear();
  }

  void _notify(String message) {
    AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
  }

  BoxDecoration _panelDecoration() => BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.kDivider),
        borderRadius: BorderRadius.circular(8),
      );

  Color _poStatusColor(String status) {
    if (status == 'approved' || status == 'sent' || status == 'received') {
      return AppColors.kSuccess;
    }
    if (status == 'cancelled' || status == 'rejected') return AppColors.kError;
    if (status == 'pending') return AppColors.kWarning;
    return AppColors.kPrimary;
  }
}

class _DateSelectField extends StatelessWidget {
  const _DateSelectField({
    required this.label,
    required this.value,
    required this.onPicked,
    this.firstDate,
  });

  final String label;
  final DateTime? value;
  final ValueChanged<DateTime> onPicked;
  final DateTime? firstDate;

  @override
  Widget build(BuildContext context) {
    return TextField(
      readOnly: true,
      controller:
          TextEditingController(text: value == null ? '' : _isoDate(value!)),
      decoration: InputDecoration(
        labelText: label,
        suffixIcon: const Icon(Icons.calendar_today_outlined, size: 18),
      ),
      onTap: () async {
        final now = DateTime.now();
        final picked = await showDatePicker(
          context: context,
          initialDate: value ?? firstDate ?? now,
          firstDate: firstDate ?? DateTime(now.year - 1),
          lastDate: DateTime(now.year + 3),
        );
        if (picked != null) onPicked(picked);
      },
    );
  }
}

class _ParsedPOItem {
  _ParsedPOItem({
    required this.key,
    required this.sourceLine,
    required this.name,
    required this.quantity,
    required this.unit,
    this.error,
  });

  final String key;
  final String sourceLine;
  String name;
  num quantity;
  String unit;
  num unitCost = 0;
  String? sku;
  InventoryItem? inventoryItem;
  String? error;

  num get lineTotal => quantity * unitCost;
}

const _validUnits = {
  'PC',
  'PCS',
  'PACK',
  'PACKS',
  'BAG',
  'BAGS',
  'KG',
  'G',
  'L',
  'LTR',
  'ML',
  'BTL',
  'BOTTLE',
  'BOTTLES',
  'CTN',
  'CARTON',
  'CARTONS',
  'CASE',
  'CASES',
  'BOX',
  'BOXES',
  'TIN',
  'TINS',
  'ROLL',
  'ROLLS',
  'DOZEN',
  'DZ',
};

String _normalizeItemName(String value) => value
    .toLowerCase()
    .replaceAll(RegExp(r'[^a-z0-9]+'), ' ')
    .replaceAll(RegExp(r'\s+'), ' ')
    .trim();

String _isoDate(DateTime date) => date.toIso8601String().split('T').first;

String _storeMoney(num value) {
  final fixed = value.round() == value
      ? value.toInt().toString()
      : value.toStringAsFixed(2);
  return 'KES $fixed';
}

String _storePlainNum(num value) {
  return value.round() == value ? value.toInt().toString() : '$value';
}

class _CentralReportsTab extends ConsumerWidget {
  const _CentralReportsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(inventoryItemsProvider(null));
    final requests = ref.watch(stockRequestsProvider(null));
    final dispatch = ref.watch(dispatchOrdersProvider(null));
    final suppliers = ref.watch(suppliersProvider);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: Text('Central Store Reports',
                style: Theme.of(context).textTheme.displaySmall),
          ),
          IconButton(
            tooltip: 'Refresh',
            onPressed: () {
              ref.invalidate(inventoryItemsProvider(null));
              ref.invalidate(stockRequestsProvider(null));
              ref.invalidate(dispatchOrdersProvider(null));
              ref.invalidate(suppliersProvider);
            },
            icon: const Icon(Icons.refresh),
          ),
        ]),
        const SizedBox(height: 16),
        _ReportsPanel(
          title: 'Inventory Health',
          rows: items.maybeWhen(
            data: (list) {
              final low = list.where((item) => item.isLowStock).length;
              final categories =
                  list.map((item) => item.category ?? 'General').toSet().length;
              final units =
                  list.fold<num>(0, (sum, item) => sum + item.currentStock);
              return {
                'Master Items': '${list.length}',
                'Low Stock Items': '$low',
                'Categories': '$categories',
                'Total Units On Hand': units.toStringAsFixed(0),
              };
            },
            orElse: () => const {'Master Items': '-'},
          ),
        ),
        const SizedBox(height: 12),
        _ReportsPanel(
          title: 'Requisition Pipeline',
          rows: requests.maybeWhen(
            data: (list) => _statusCounts(
              list.map((request) => request.status ?? 'PENDING').toList(),
            ),
            orElse: () => const {'Requests': '-'},
          ),
        ),
        const SizedBox(height: 12),
        _ReportsPanel(
          title: 'Dispatch Pipeline',
          rows: dispatch.maybeWhen(
            data: (list) => _statusCounts(
              list.map((row) => '${row['status'] ?? 'PENDING'}').toList(),
            ),
            orElse: () => const {'Dispatch Notes': '-'},
          ),
        ),
        const SizedBox(height: 12),
        _ReportsPanel(
          title: 'Supplier Network',
          rows: suppliers.maybeWhen(
            data: (list) => {
              'Suppliers': '${list.length}',
              'Active':
                  '${list.where((s) => (s.status ?? 'active') == 'active').length}',
              'Inactive':
                  '${list.where((s) => (s.status ?? 'active') != 'active').length}',
            },
            orElse: () => const {'Suppliers': '-'},
          ),
        ),
      ]),
    );
  }

  Map<String, String> _statusCounts(List<String> statuses) {
    final counts = <String, int>{};
    for (final raw in statuses) {
      final status = raw.trim().isEmpty ? 'PENDING' : raw.toUpperCase();
      counts[status] = (counts[status] ?? 0) + 1;
    }
    if (counts.isEmpty) return {'Records': '0'};
    return {
      'Total': '${statuses.length}',
      for (final entry in counts.entries)
        _titleCase(entry.key): '${entry.value}',
    };
  }
}

class _ReportsPanel extends StatelessWidget {
  const _ReportsPanel({required this.title, required this.rows});

  final String title;
  final Map<String, String> rows;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.kDivider),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
        const SizedBox(height: 12),
        LayoutBuilder(builder: (context, constraints) {
          final width = constraints.maxWidth < 700
              ? constraints.maxWidth
              : (constraints.maxWidth - 24) / 3;
          return Wrap(
            spacing: 12,
            runSpacing: 12,
            children: rows.entries
                .map((entry) => SizedBox(
                      width: width,
                      child: _StoreMiniMetric(
                        label: entry.key,
                        value: entry.value,
                        icon: Icons.analytics_outlined,
                      ),
                    ))
                .toList(),
          );
        }),
      ]),
    );
  }
}

String _storeDisplayName(dynamic value) {
  if (value is Map) {
    final joinedName = [value['first_name'], value['last_name']]
        .where((part) => part != null && '$part'.trim().isNotEmpty)
        .map((part) => '$part'.trim())
        .join(' ');
    final name = value['display_name'] ??
        value['name'] ??
        value['branch_name'] ??
        value['full_name'] ??
        value['staff_name'] ??
        value['employee_name'] ??
        (joinedName.isEmpty ? null : joinedName) ??
        value['registration_number'] ??
        value['model'] ??
        value['code'];
    if (name != null && '$name'.trim().isNotEmpty) return '$name';
    final id = value['id'];
    return id == null ? '—' : _storeShortReference('$id');
  }
  if (value == null || '$value'.trim().isEmpty) return '—';
  return _storeShortReference('$value');
}

num _storeNum(dynamic value) {
  if (value is num) return value;
  return num.tryParse('$value') ?? 0;
}

String _titleCase(String value) => value
    .replaceAll('_', ' ')
    .split(' ')
    .map((word) => word.isEmpty
        ? word
        : word[0].toUpperCase() + word.substring(1).toLowerCase())
    .join(' ');

String _storeShortReference(String value) {
  final trimmed = value.trim();
  final isUuid = RegExp(
          r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
      .hasMatch(trimmed);
  if (!isUuid || trimmed.length <= 12) return trimmed;
  return '${trimmed.substring(0, 8)}...${trimmed.substring(trimmed.length - 4)}';
}

String _storeBranchName(Map<String, dynamic> row) {
  final branch = row['branch_name'] ??
      row['to_branch_name'] ??
      row['from_branch_name'] ??
      row['requesting_branch'] ??
      row['branch'] ??
      row['to_branch'] ??
      row['from_branch'];
  return _storeDisplayName(branch);
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
                              '${r['request_number'] ?? _storeDisplayName(r['id'])}  —  ${_storeBranchName(r)}',
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
    openRecordDetailScreen(
      context,
      title:
          'Request ${request['request_number'] ?? _storeDisplayName(request['id'])}',
      subtitle: 'Stock Request — ${_storeBranchName(request)}',
      record: request,
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
                        '${r['request_number'] ?? _storeDisplayName(r['id'])}  —  ${_storeBranchName(r)}',
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
                                  child: Text(_storeDisplayName(v)),
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
                                  child: Text(_storeDisplayName(d)),
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
                        '${t['take_number'] ?? _storeDisplayName(t['id'])}  —  ${t['store_type'] ?? ''}',
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

// ── Goods Received (GRN) register — card grid + Record Receipt flow ──────────
String _grnText(Map<String, dynamic> r, List<String> keys, [String fallback = '—']) {
  for (final k in keys) {
    final v = r[k];
    if (v != null && '$v'.trim().isNotEmpty && '$v' != 'null') return '$v';
  }
  return fallback;
}

num _grnNum(dynamic v) => v is num ? v : num.tryParse('${v ?? 0}') ?? 0;

String _grnSupplier(Map<String, dynamic> r) {
  final s = r['supplier'];
  if (s is Map && s['name'] != null) return '${s['name']}';
  return _grnText(r, ['supplier_name', 'supplier'], 'Supplier');
}

String _grnDate(Map<String, dynamic> r) {
  final raw = _grnText(r, ['grn_date', 'created_at', 'date'], '');
  if (raw.isEmpty) return '—';
  final d = DateTime.tryParse(raw);
  if (d == null) return raw.split('T').first;
  return '${d.day}/${d.month}/${d.year}';
}

class _GrnTab extends ConsumerStatefulWidget {
  const _GrnTab();
  @override
  ConsumerState<_GrnTab> createState() => _GrnTabState();
}

class _GrnTabState extends ConsumerState<_GrnTab> {
  String _search = '';

  void _refresh() => ref.invalidate(grnListProvider);

  Future<void> _recordReceipt() async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const _ReceiveGoodsScreen()),
    );
    if (saved == true) _refresh();
  }

  @override
  Widget build(BuildContext context) {
    final grnAsync = ref.watch(grnListProvider);
    return Padding(
      padding: const EdgeInsets.all(20),
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
                    const Text('Goods Received (GRN)',
                        style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    Text('Record and verify incoming shipments',
                        style: TextStyle(color: Colors.grey.shade600)),
                  ],
                ),
              ),
              OutlinedButton.icon(
                onPressed: _refresh,
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Refresh'),
              ),
              const SizedBox(width: 10),
              FilledButton.icon(
                onPressed: _recordReceipt,
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Record Receipt'),
                style: FilledButton.styleFrom(backgroundColor: AppColors.kPrimary),
              ),
            ],
          ),
          const SizedBox(height: 16),
          TextField(
            decoration: InputDecoration(
              hintText: 'Search by GRN #, PO # or Supplier…',
              prefixIcon: const Icon(Icons.search),
              filled: true,
              fillColor: Colors.grey.shade100,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
            ),
            onChanged: (v) => setState(() => _search = v.trim().toLowerCase()),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: AsyncValueWidget(
              value: grnAsync,
              data: (rows) {
                var list = rows;
                if (_search.isNotEmpty) {
                  list = rows.where((r) {
                    final hay =
                        '${_grnText(r, ['grn_number'])} ${_grnText(r, ['po_number', 'po_id'])} ${_grnSupplier(r)}'
                            .toLowerCase();
                    return hay.contains(_search);
                  }).toList();
                }
                if (list.isEmpty) {
                  return const EmptyState(message: 'No goods received notes yet');
                }
                return LayoutBuilder(builder: (context, constraints) {
                  final cols = constraints.maxWidth >= 1100
                      ? 3
                      : constraints.maxWidth >= 720
                          ? 2
                          : 1;
                  return GridView.builder(
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: cols,
                      mainAxisSpacing: 14,
                      crossAxisSpacing: 14,
                      mainAxisExtent: 168,
                    ),
                    itemCount: list.length,
                    itemBuilder: (_, i) => _GrnCard(grn: list[i]),
                  );
                });
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _GrnCard extends StatelessWidget {
  const _GrnCard({required this.grn});
  final Map<String, dynamic> grn;

  @override
  Widget build(BuildContext context) {
    final status = _grnText(grn, ['status'], 'draft');
    final total = _grnNum(grn['total_value'] ?? grn['total'] ?? 0);
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(_grnText(grn, ['grn_number'], 'GRN'),
                    style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: AppColors.kPrimary,
                        fontSize: 13)),
              ),
              _StatusPill(status: status),
            ],
          ),
          const SizedBox(height: 2),
          Text(_grnSupplier(grn).toUpperCase(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 10),
          _kv(Icons.receipt_long, 'PO:', _grnText(grn, ['po_number', 'po_id'])),
          const SizedBox(height: 4),
          _kv(Icons.calendar_today, 'Date:', _grnDate(grn)),
          const Spacer(),
          const Divider(height: 1),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Total Value:',
                  style: TextStyle(fontWeight: FontWeight.w700)),
              Text('KES ${total.toStringAsFixed(0)}',
                  style: const TextStyle(fontWeight: FontWeight.w800)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _kv(IconData icon, String label, String value) => Row(
        children: [
          Icon(icon, size: 13, color: Colors.grey.shade500),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
          const Spacer(),
          Flexible(
            child: Text(value,
                textAlign: TextAlign.right,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
          ),
        ],
      );
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});
  final String status;
  @override
  Widget build(BuildContext context) {
    final s = status.toLowerCase();
    Color c = Colors.blueGrey;
    if (s.contains('draft')) c = const Color(0xFFB45309);
    if (s.contains('approv') || s.contains('complete') || s.contains('receiv')) {
      c = const Color(0xFF15803D);
    }
    if (s.contains('cancel') || s.contains('reject')) c = Colors.red;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(status,
          style: TextStyle(color: c, fontSize: 11, fontWeight: FontWeight.w700)),
    );
  }
}

// ── Receive Goods: pick a PO, prefill supplier + items, submit a GRN ─────────
class _GrnItemRow {
  _GrnItemRow({
    required this.poItemId,
    required this.itemId,
    required this.name,
    required this.unit,
    required this.ordered,
    required double unitPrice,
    required double received,
  })  : receivedCtrl = TextEditingController(text: _fmt(received)),
        rejectedCtrl = TextEditingController(text: '0'),
        priceCtrl = TextEditingController(text: _fmt(unitPrice));

  final String poItemId;
  final String itemId;
  final String name;
  final String unit;
  final num ordered;
  final TextEditingController receivedCtrl;
  final TextEditingController rejectedCtrl;
  final TextEditingController priceCtrl;

  static String _fmt(double v) =>
      v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(2);

  double get received => double.tryParse(receivedCtrl.text.trim()) ?? 0;
  double get rejected => double.tryParse(rejectedCtrl.text.trim()) ?? 0;
  double get price => double.tryParse(priceCtrl.text.trim()) ?? 0;
  double get lineTotal => (received - rejected).clamp(0, received) * price;

  void dispose() {
    receivedCtrl.dispose();
    rejectedCtrl.dispose();
    priceCtrl.dispose();
  }
}

class _ReceiveGoodsScreen extends ConsumerStatefulWidget {
  const _ReceiveGoodsScreen();
  @override
  ConsumerState<_ReceiveGoodsScreen> createState() => _ReceiveGoodsScreenState();
}

class _ReceiveGoodsScreenState extends ConsumerState<_ReceiveGoodsScreen> {
  String? _poId;
  Map<String, dynamic>? _po;
  bool _loadingPo = false;
  bool _saving = false;
  final _invoice = TextEditingController();
  final _deliveryNote = TextEditingController();
  final _notes = TextEditingController();
  List<_GrnItemRow> _items = [];

  @override
  void dispose() {
    _invoice.dispose();
    _deliveryNote.dispose();
    _notes.dispose();
    for (final i in _items) {
      i.dispose();
    }
    super.dispose();
  }

  Future<void> _loadPo(String id) async {
    setState(() {
      _loadingPo = true;
      _poId = id;
    });
    try {
      final po = await ref.read(storeRepositoryProvider).getPurchaseOrder(id);
      final rawItems = (po['items'] as List?) ?? const [];
      for (final i in _items) {
        i.dispose();
      }
      final rows = rawItems.whereType<Map>().map((raw) {
        final m = Map<String, dynamic>.from(raw);
        final ordered = _grnNum(m['quantity_ordered']);
        final pending = _grnNum(m['quantity_pending']);
        final outstanding = pending > 0 ? pending : ordered;
        return _GrnItemRow(
          poItemId: '${m['id'] ?? ''}',
          itemId: '${m['item_id'] ?? ''}',
          name: _grnText(m, ['item_name', 'name', 'item_id'], 'Item'),
          unit: _grnText(m, ['unit_of_measure', 'unit'], ''),
          ordered: ordered,
          unitPrice: _grnNum(m['unit_price']).toDouble(),
          received: outstanding.toDouble(),
        );
      }).toList();
      if (!mounted) return;
      setState(() {
        _po = po;
        _items = rows;
      });
    } catch (e) {
      if (mounted) {
        AppNotifier.show(context, 'Could not load PO: $e', isError: true);
      }
    } finally {
      if (mounted) setState(() => _loadingPo = false);
    }
  }

  double get _grandTotal => _items.fold<double>(0, (s, i) => s + i.lineTotal);

  Future<void> _submit() async {
    final po = _po;
    if (po == null || _items.isEmpty) {
      AppNotifier.show(context, 'Select a purchase order first', isError: true);
      return;
    }
    final received = _items.where((i) => i.received > 0).toList();
    if (received.isEmpty) {
      AppNotifier.show(context, 'Enter at least one received quantity',
          isError: true);
      return;
    }
    setState(() => _saving = true);
    try {
      await ref.read(storeRepositoryProvider).submitGrn({
        'po_id': _poId,
        'supplier_id': po['supplier_id'],
        'grn_date': DateTime.now().toIso8601String().split('T').first,
        if (_invoice.text.trim().isNotEmpty)
          'invoice_number': _invoice.text.trim(),
        if (_deliveryNote.text.trim().isNotEmpty)
          'delivery_note_number': _deliveryNote.text.trim(),
        if (_notes.text.trim().isNotEmpty) 'remarks': _notes.text.trim(),
        'items': received
            .map((i) => {
                  'po_item_id': i.poItemId,
                  'item_id': i.itemId,
                  'quantity_ordered': i.ordered,
                  'quantity_received': i.received,
                  'quantity_accepted': (i.received - i.rejected).clamp(0, i.received),
                  'quantity_rejected': i.rejected,
                  'unit_price': i.price,
                  'quality_status': i.rejected > 0 ? 'partial' : 'accepted',
                })
            .toList(),
      });
      if (!mounted) return;
      AppNotifier.show(context, 'Goods received note created');
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        AppNotifier.show(context, 'Failed to record receipt: $e', isError: true);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final posAsync = ref.watch(receivablePurchaseOrdersProvider(null));
    return Scaffold(
      backgroundColor: AppColors.kSurface,
      appBar: AppBar(title: const Text('Receive Goods')),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1000),
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                _card(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Purchase Order',
                          style: TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      posAsync.when(
                        loading: () =>
                            const LinearProgressIndicator(minHeight: 2),
                        error: (e, _) => Text('Could not load POs: $e',
                            style: const TextStyle(color: Colors.red)),
                        data: (pos) {
                          final selectable = pos.where((p) {
                            final s = _grnText(p, ['status'], '').toLowerCase();
                            return !s.contains('cancel') &&
                                !s.contains('closed') &&
                                !s.contains('fully');
                          }).toList();
                          return DropdownButtonFormField<String>(
                            initialValue: _poId,
                            isExpanded: true,
                            decoration: const InputDecoration(
                              labelText: 'Select an approved PO to receive against',
                              border: OutlineInputBorder(),
                              isDense: true,
                            ),
                            items: selectable
                                .map((p) => DropdownMenuItem<String>(
                                      value: '${p['id']}',
                                      child: Text(
                                        '${_grnText(p, ['po_number', 'id'])}  ·  ${_grnSupplier(p)}',
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ))
                                .toList(),
                            onChanged: _loadingPo
                                ? null
                                : (v) {
                                    if (v != null) _loadPo(v);
                                  },
                          );
                        },
                      ),
                      if (_po != null) ...[
                        const SizedBox(height: 12),
                        Wrap(spacing: 18, runSpacing: 6, children: [
                          _meta('Supplier', _grnSupplier(_po!)),
                          _meta('PO Number', _grnText(_po!, ['po_number', 'id'])),
                          _meta('Status', _grnText(_po!, ['status'])),
                        ]),
                      ],
                    ],
                  ),
                ),
                if (_loadingPo)
                  const Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (_po != null) ...[
                  const SizedBox(height: 14),
                  _card(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Delivery details',
                            style: TextStyle(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 10),
                        Row(children: [
                          Expanded(
                            child: TextField(
                              controller: _invoice,
                              decoration: const InputDecoration(
                                  labelText: 'Invoice number',
                                  border: OutlineInputBorder(),
                                  isDense: true),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextField(
                              controller: _deliveryNote,
                              decoration: const InputDecoration(
                                  labelText: 'Delivery note number',
                                  border: OutlineInputBorder(),
                                  isDense: true),
                            ),
                          ),
                        ]),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  _card(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Items received',
                            style: TextStyle(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 4),
                        Text(
                            'Ordered quantities are from the PO. Adjust received / rejected to match the actual delivery.',
                            style: TextStyle(
                                fontSize: 12, color: Colors.grey.shade600)),
                        const SizedBox(height: 10),
                        ..._items.map(_itemRow),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  _card(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Total received value',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                        Text('KES ${_grandTotal.toStringAsFixed(2)}',
                            style: const TextStyle(
                                fontWeight: FontWeight.w900, fontSize: 16)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _notes,
                    minLines: 2,
                    maxLines: 4,
                    decoration: const InputDecoration(
                        labelText: 'Remarks', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 48,
                    child: FilledButton.icon(
                      onPressed: _saving ? null : _submit,
                      icon: _saving
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.check),
                      label: Text(_saving ? 'Recording…' : 'Record Goods Receipt'),
                      style: FilledButton.styleFrom(
                          backgroundColor: AppColors.kPrimary),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _itemRow(_GrnItemRow it) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(it.name,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
              ),
              Text('Ordered: ${it.ordered}${it.unit.isNotEmpty ? ' ${it.unit}' : ''}',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            ],
          ),
          const SizedBox(height: 6),
          Row(children: [
            Expanded(child: _numField(it.receivedCtrl, 'Received')),
            const SizedBox(width: 8),
            Expanded(child: _numField(it.rejectedCtrl, 'Rejected')),
            const SizedBox(width: 8),
            Expanded(child: _numField(it.priceCtrl, 'Unit cost')),
          ]),
          const SizedBox(height: 6),
          const Divider(height: 1),
        ],
      ),
    );
  }

  Widget _numField(TextEditingController c, String label) => TextField(
        controller: c,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: InputDecoration(
            labelText: label, border: const OutlineInputBorder(), isDense: true),
        onChanged: (_) => setState(() {}),
      );

  Widget _meta(String label, String value) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      );

  Widget _card({required Widget child}) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: child,
      );
}
