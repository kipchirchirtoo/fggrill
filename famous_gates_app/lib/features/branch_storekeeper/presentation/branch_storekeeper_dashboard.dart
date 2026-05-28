import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/master_dashboard_shell.dart';
import '../data/branch_storekeeper_repository.dart';

enum BranchStorekeeperSection {
  overview,
  stock,
  receive,
  suppliers,
  stockTakes,
  purchaseOrders,
  requests,
  kitchenRequisitions,
  kitchenUsage,
  stockOut,
  reports,
}

class BranchStorekeeperDashboard extends ConsumerStatefulWidget {
  const BranchStorekeeperDashboard({
    super.key,
    this.initialSection,
    this.stockTakeId,
    this.requestId,
  });

  final BranchStorekeeperSection? initialSection;
  final String? stockTakeId;
  final String? requestId;

  @override
  ConsumerState<BranchStorekeeperDashboard> createState() =>
      _BranchStorekeeperDashboardState();
}

class _BranchStorekeeperDashboardState
    extends ConsumerState<BranchStorekeeperDashboard> {
  late BranchStorekeeperSection _section;
  bool _loading = true;
  String _search = '';
  String _statusFilter = 'ALL';
  String _catalogFilter = 'all';
  String? _selectedStockTakeId;
  String? _selectedRequestId;

  Map<String, dynamic> _dashboard = {};
  List<Map<String, dynamic>> _stock = [];
  List<Map<String, dynamic>> _catalog = [];
  List<Map<String, dynamic>> _incomingDispatches = [];
  List<Map<String, dynamic>> _suppliers = [];
  List<Map<String, dynamic>> _stockTakes = [];
  List<Map<String, dynamic>> _purchaseOrders = [];
  List<Map<String, dynamic>> _stockRequests = [];
  List<Map<String, dynamic>> _kitchenRequisitions = [];
  List<Map<String, dynamic>> _kitchenUsage = [];
  List<Map<String, dynamic>> _trackableItems = [];
  List<Map<String, dynamic>> _stockMovements = [];
  Map<String, dynamic>? _stockTakeDetail;
  List<Map<String, dynamic>> _stockTakeItems = [];

  static const _categories = [
    'all',
    'Foodstuffs',
    'Beverages',
    'Perishable goods',
    'Vegetables',
    'Fruits',
    'Cleaning',
    'Stationery',
    'Gas',
    'Other',
  ];

  static const _stockTakeStoreTypes = {
    'foodstuffs': 'Foodstuffs',
    'bar_store': 'Bar Store',
    'store_items': 'General Store Items',
  };

  static const _barOutlets = {
    'main_bar': 'Main Bar',
    'executive_bar': 'Executive Bar',
    'sports_bar': 'Sports Bar',
  };

  @override
  void initState() {
    super.initState();
    _section = widget.initialSection ?? BranchStorekeeperSection.overview;
    _selectedStockTakeId = widget.stockTakeId;
    _selectedRequestId = widget.requestId;
    if (_selectedStockTakeId != null) {
      _section = BranchStorekeeperSection.stockTakes;
    }
    if (_selectedRequestId != null) {
      _section = BranchStorekeeperSection.requests;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadAll());
  }

  BranchStorekeeperRepository get _repo =>
      ref.read(branchStorekeeperRepositoryProvider);

  Future<T> _safe<T>(Future<T> Function() action, T fallback) async {
    try {
      return await action();
    } catch (_) {
      return fallback;
    }
  }

  Future<void> _loadAll() async {
    setState(() => _loading = true);
    final results = await Future.wait<dynamic>([
      _safe(_repo.dashboard, <String, dynamic>{}),
      _safe(_repo.branchStock, <Map<String, dynamic>>[]),
      _safe(() => _repo.masterCatalog(limit: 500), <Map<String, dynamic>>[]),
      _safe(_repo.incomingDispatches, <Map<String, dynamic>>[]),
      _safe(_repo.suppliers, <Map<String, dynamic>>[]),
      _safe(_repo.stockTakes, <Map<String, dynamic>>[]),
      _safe(_repo.purchaseOrders, <Map<String, dynamic>>[]),
      _safe(_repo.stockRequests, <Map<String, dynamic>>[]),
      _safe(_repo.kitchenRequisitions, <Map<String, dynamic>>[]),
      _safe(_repo.kitchenUsageRecords, <Map<String, dynamic>>[]),
      _safe(_repo.trackableItems, <Map<String, dynamic>>[]),
      _safe(_repo.stockMovements, <Map<String, dynamic>>[]),
    ]);
    if (!mounted) return;
    setState(() {
      _dashboard = results[0] as Map<String, dynamic>;
      _stock = List<Map<String, dynamic>>.from(results[1] as List);
      _catalog = List<Map<String, dynamic>>.from(results[2] as List);
      _incomingDispatches = List<Map<String, dynamic>>.from(results[3] as List);
      _suppliers = List<Map<String, dynamic>>.from(results[4] as List);
      _stockTakes = List<Map<String, dynamic>>.from(results[5] as List);
      _purchaseOrders = List<Map<String, dynamic>>.from(results[6] as List);
      _stockRequests = List<Map<String, dynamic>>.from(results[7] as List);
      _kitchenRequisitions =
          List<Map<String, dynamic>>.from(results[8] as List);
      _kitchenUsage = List<Map<String, dynamic>>.from(results[9] as List);
      _trackableItems = List<Map<String, dynamic>>.from(results[10] as List);
      _stockMovements = List<Map<String, dynamic>>.from(results[11] as List);
      _loading = false;
    });
    if (_selectedStockTakeId != null) {
      await _loadStockTakeDetail(_selectedStockTakeId!);
    }
  }

  Future<void> _loadStockTakeDetail(String id) async {
    setState(() {
      _selectedStockTakeId = id;
      _loading = true;
    });
    final detail = await _safe(() => _repo.stockTake(id), <String, dynamic>{});
    final items =
        await _safe(() => _repo.stockTakeItems(id), <Map<String, dynamic>>[]);
    if (!mounted) return;
    setState(() {
      _stockTakeDetail = detail;
      _stockTakeItems =
          items.isNotEmpty ? items : _listFrom(detail['items'] ?? []);
      _loading = false;
    });
  }

  List<Map<String, dynamic>> _listFrom(dynamic data) {
    if (data is List) {
      return data
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }
    return [];
  }

  List<Map<String, dynamic>> _uniqueRows(
    List<Map<String, dynamic>> rows,
    String Function(Map<String, dynamic>) keyFor,
  ) {
    final seen = <String>{};
    return rows.where((row) {
      final key = keyFor(row).trim();
      if (key.isEmpty || key == 'null' || seen.contains(key)) return false;
      seen.add(key);
      return true;
    }).toList();
  }

  List<Map<String, dynamic>> get _catalogOptions => _uniqueRows(
        _catalog,
        (item) => '${item['sku'] ?? item['item_sku'] ?? ''}',
      );

  List<Map<String, dynamic>> get _stockOptions => _uniqueRows(
        _stock,
        (item) => '${item['item_sku'] ?? item['sku'] ?? ''}',
      );

  List<Map<String, dynamic>> get _supplierOptions => _uniqueRows(
        _suppliers,
        (supplier) => '${supplier['id'] ?? ''}',
      );

  List<Map<String, dynamic>> get _trackableOptions => _uniqueRows(
        _trackableItems,
        (item) => '${item['item_sku'] ?? item['sku'] ?? ''}',
      );

  @override
  Widget build(BuildContext context) {
    return MasterDashboardShell<BranchStorekeeperSection>(
      title: 'Branch Store',
      subtitle: 'Famous Gates',
      initials: 'B',
      breadcrumbRoot: 'Branch Storekeeper',
      currentSection: _section,
      items: _navItems,
      onSectionSelected: (section) {
        setState(() {
          _section = section;
          _selectedStockTakeId = null;
          _selectedRequestId = null;
          _search = '';
          _statusFilter = 'ALL';
        });
      },
      child: KeyedSubtree(
        key: ValueKey('${_section.name}-${_selectedStockTakeId ?? ''}'),
        child: _buildSection(),
      ),
    );
  }

  List<MasterNavItem<BranchStorekeeperSection>> get _navItems => [
        const MasterNavItem(
          section: BranchStorekeeperSection.overview,
          label: 'Overview',
          icon: Icons.dashboard_outlined,
          group: 'Branch Store',
        ),
        MasterNavItem(
          section: BranchStorekeeperSection.stock,
          label: 'Master Inventory',
          icon: PhosphorIcons.package(),
          group: 'Inventory',
        ),
        MasterNavItem(
          section: BranchStorekeeperSection.receive,
          label: 'Receive Goods',
          icon: PhosphorIcons.truck(),
          group: 'Inventory',
        ),
        MasterNavItem(
          section: BranchStorekeeperSection.suppliers,
          label: 'Local Vendors',
          icon: PhosphorIcons.buildings(),
          group: 'Inventory',
        ),
        MasterNavItem(
          section: BranchStorekeeperSection.stockTakes,
          label: 'Stock Takes',
          icon: PhosphorIcons.clipboardText(),
          group: 'Inventory',
        ),
        MasterNavItem(
          section: BranchStorekeeperSection.purchaseOrders,
          label: 'Purchase Orders',
          icon: PhosphorIcons.shoppingCart(),
          group: 'Procurement',
        ),
        MasterNavItem(
          section: BranchStorekeeperSection.requests,
          label: 'Store Requests',
          icon: PhosphorIcons.gitPullRequest(),
          group: 'Requisitions',
        ),
        MasterNavItem(
          section: BranchStorekeeperSection.kitchenRequisitions,
          label: 'Dept Requisitions',
          icon: PhosphorIcons.chefHat(),
          group: 'Requisitions',
        ),
        MasterNavItem(
          section: BranchStorekeeperSection.kitchenUsage,
          label: 'Kitchen Usage',
          icon: PhosphorIcons.forkKnife(),
          group: 'Usage',
        ),
        MasterNavItem(
          section: BranchStorekeeperSection.stockOut,
          label: 'Stock Out',
          icon: PhosphorIcons.trendDown(),
          group: 'Usage',
        ),
        MasterNavItem(
          section: BranchStorekeeperSection.reports,
          label: 'Reports',
          icon: PhosphorIcons.filePdf(),
          group: 'Reporting',
        ),
      ];

  Widget _buildSection() {
    if (_loading) return const _LoadingPage();
    switch (_section) {
      case BranchStorekeeperSection.overview:
        return _overview();
      case BranchStorekeeperSection.stock:
        return _stockPage();
      case BranchStorekeeperSection.receive:
        return _receivePage();
      case BranchStorekeeperSection.suppliers:
        return _suppliersPage();
      case BranchStorekeeperSection.stockTakes:
        return _selectedStockTakeId == null
            ? _stockTakesPage()
            : _stockTakeDetailPage();
      case BranchStorekeeperSection.purchaseOrders:
        return _purchaseOrdersPage();
      case BranchStorekeeperSection.requests:
        return _selectedRequestId == null ? _requestsPage() : _requestDetail();
      case BranchStorekeeperSection.kitchenRequisitions:
        return _kitchenRequisitionsPage();
      case BranchStorekeeperSection.kitchenUsage:
        return _kitchenUsagePage();
      case BranchStorekeeperSection.stockOut:
        return _stockOutPage();
      case BranchStorekeeperSection.reports:
        return _reportsPage();
    }
  }

  Widget _overview() {
    final low = _stock.where((item) {
      final qty = _num(item['quantity']);
      final reorder = _num(item['reorder_level'] ?? item['min_quantity']);
      return qty <= reorder;
    }).length;
    final pendingRequests =
        _stockRequests.where((r) => '${r['status']}' == 'PENDING').length;
    final inTransit = _incomingDispatches
        .where((d) => '${d['status']}'.toUpperCase() == 'IN_TRANSIT')
        .length;
    return _Page(
      title: 'Branch Storekeeper Dashboard',
      subtitle:
          'Branch inventory, receiving, local vendors, requisitions, usage, and reporting.',
      actions: [_RefreshButton(onPressed: _loadAll)],
      children: [
        _StatGrid(cards: [
          _StatCardData(
              'Stock SKUs',
              '${_dashboard['totalItems'] ?? _stock.length}',
              PhosphorIcons.package(),
              AppColors.kPrimary),
          _StatCardData('Low Stock', '${_dashboard['lowStock'] ?? low}',
              PhosphorIcons.warning(), AppColors.kWarning),
          _StatCardData(
              'Pending Requests',
              '${_dashboard['pendingRequests'] ?? pendingRequests}',
              PhosphorIcons.gitPullRequest(),
              Colors.indigo),
          _StatCardData(
              'Incoming Dispatches',
              '${_dashboard['incomingDispatches'] ?? inTransit}',
              PhosphorIcons.truck(),
              AppColors.kSuccess),
        ]),
        _SectionCard(
          title: 'Operational Shortcuts',
          child: Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _QuickAction('Receive dispatches', PhosphorIcons.truck(),
                  () => _go(BranchStorekeeperSection.receive)),
              _QuickAction('Request stock', PhosphorIcons.gitPullRequest(),
                  () => _go(BranchStorekeeperSection.requests)),
              _QuickAction('Start stock take', PhosphorIcons.clipboardText(),
                  _startStockTake),
              _QuickAction('Issue to kitchen', PhosphorIcons.forkKnife(),
                  () => _go(BranchStorekeeperSection.kitchenUsage)),
              _QuickAction('Stock out', PhosphorIcons.trendDown(),
                  () => _go(BranchStorekeeperSection.stockOut)),
            ],
          ),
        ),
        _SectionCard(
          title: 'Low Stock Watchlist',
          child: _DataTable(
            columns: const ['Item', 'SKU', 'Available', 'Reorder'],
            rows: _stock
                .where((item) =>
                    _num(item['quantity']) <=
                    _num(item['reorder_level'] ?? item['min_quantity']))
                .take(8)
                .map((item) => [
                      _itemName(item),
                      '${item['item_sku'] ?? item['sku'] ?? ''}',
                      _qty(item),
                      '${item['reorder_level'] ?? item['min_quantity'] ?? 0}',
                    ])
                .toList(),
          ),
        ),
      ],
    );
  }

  Widget _stockPage() {
    final q = _search.toLowerCase();
    final filtered = _stock.where((item) {
      return q.isEmpty ||
          _itemName(item).toLowerCase().contains(q) ||
          '${item['item_sku'] ?? item['sku']}'.toLowerCase().contains(q);
    }).toList();
    final catalog = _catalog.where((item) {
      final category = '${item['category'] ?? ''}';
      return (_catalogFilter == 'all' || category == _catalogFilter) &&
          (q.isEmpty ||
              '${item['item_name'] ?? item['name'] ?? ''}'
                  .toLowerCase()
                  .contains(q) ||
              '${item['sku'] ?? ''}'.toLowerCase().contains(q));
    }).toList();
    return _Page(
      title: 'Master Inventory',
      subtitle:
          'Current branch stock, master catalog registration, low stock requests, and manual quantity adjustments.',
      actions: [
        _RefreshButton(onPressed: _loadAll),
        OutlinedButton.icon(
          onPressed: _exportStockLedger,
          icon: Icon(PhosphorIcons.download()),
          label: const Text('Export Ledger'),
        ),
        FilledButton.icon(
          onPressed: () => _go(BranchStorekeeperSection.receive),
          icon: Icon(PhosphorIcons.truck()),
          label: const Text('Receive Goods'),
        ),
      ],
      children: [
        _StatGrid(cards: [
          _StatCardData('In Stock SKUs', '${_stock.length}',
              PhosphorIcons.package(), AppColors.kPrimary),
          _StatCardData(
              'Low Stock',
              '${_stock.where((i) => _num(i['quantity']) <= _num(i['reorder_level'] ?? i['min_quantity'])).length}',
              PhosphorIcons.warning(),
              AppColors.kWarning),
          _StatCardData('Catalog Items', '${_catalog.length}',
              PhosphorIcons.listBullets(), Colors.indigo),
        ]),
        _FiltersBar(
          search: _search,
          searchHint: 'Search branch inventory or catalog...',
          onSearchChanged: (value) => setState(() => _search = value),
          trailing: DropdownButton<String>(
            isExpanded: true,
            value: _catalogFilter,
            items: _categories
                .map((item) => DropdownMenuItem(value: item, child: Text(item)))
                .toList(),
            onChanged: (value) => setState(() => _catalogFilter = value!),
          ),
        ),
        _SectionCard(
          title: 'Current Stock',
          child: _RecordList(
            emptyText: 'No branch stock found',
            children: filtered.map((item) {
              final qty = _num(item['quantity']);
              final reorder =
                  _num(item['reorder_level'] ?? item['min_quantity']);
              return _RecordTile(
                icon: PhosphorIcons.package(),
                title: _itemName(item),
                subtitle:
                    '${item['item_sku'] ?? item['sku'] ?? ''} | ${item['item']?['category'] ?? item['category'] ?? 'Uncategorized'}',
                trailing: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(_qty(item),
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: qty <= reorder
                              ? AppColors.kWarning
                              : AppColors.kTextPrimary,
                        )),
                    if (qty <= reorder) const _StatusChip('LOW', warning: true),
                  ],
                ),
                actions: [
                  TextButton(
                    onPressed: () => _showStockAdjustment(item),
                    child: const Text('Adjust'),
                  ),
                  TextButton(
                    onPressed: () => _quickRequestStock(item),
                    child: const Text('Request'),
                  ),
                ],
              );
            }).toList(),
          ),
        ),
        _SectionCard(
          title: 'Stock Take List / Master Catalog',
          child: _RecordList(
            emptyText: 'No catalog items found',
            children: catalog.map((item) {
              final inBranch = _stock.any((stock) =>
                  '${stock['item_sku'] ?? stock['sku']}' == '${item['sku']}');
              return _RecordTile(
                icon: PhosphorIcons.listBullets(),
                title: '${item['item_name'] ?? item['name'] ?? item['sku']}',
                subtitle:
                    '${item['sku'] ?? ''} | ${item['category'] ?? 'Uncategorized'}',
                trailing: _StatusChip(inBranch ? 'REGISTERED' : 'NEW',
                    success: inBranch),
                actions: [
                  TextButton(
                    onPressed:
                        inBranch ? null : () => _registerCatalogItem(item),
                    child: const Text('Register'),
                  ),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _receivePage() {
    return _Page(
      title: 'Receive Goods',
      subtitle:
          'Confirm central store dispatches and record direct supplier receipts.',
      actions: [
        _RefreshButton(onPressed: _loadAll),
        OutlinedButton.icon(
          onPressed: _exportDispatches,
          icon: Icon(PhosphorIcons.download()),
          label: const Text('Export Delivery PDF'),
        ),
        FilledButton.icon(
          onPressed: _showSupplierReceipt,
          icon: Icon(PhosphorIcons.plus()),
          label: const Text('Direct Supplier Receipt'),
        ),
      ],
      children: [
        _StatGrid(cards: [
          _StatCardData('Incoming', '${_incomingDispatches.length}',
              PhosphorIcons.truck(), AppColors.kPrimary),
          _StatCardData(
              'In Transit',
              '${_incomingDispatches.where((d) => '${d['status']}' == 'IN_TRANSIT').length}',
              PhosphorIcons.clock(),
              AppColors.kWarning),
          _StatCardData('Local Vendors', '${_suppliers.length}',
              PhosphorIcons.buildings(), AppColors.kSuccess),
        ]),
        _SectionCard(
          title: 'Central Store Dispatches',
          child: _RecordList(
            emptyText: 'No incoming deliveries',
            children: _incomingDispatches.map((dispatch) {
              final status = '${dispatch['status'] ?? ''}';
              return _RecordTile(
                icon: PhosphorIcons.truck(),
                title:
                    '${dispatch['dispatch_number'] ?? dispatch['id'] ?? 'Dispatch'}',
                subtitle:
                    'From ${dispatch['from_branch']?['name'] ?? 'Central Store'} | ${_listFrom(dispatch['items']).length} items',
                trailing: _StatusChip(status, success: status == 'CONFIRMED'),
                actions: [
                  TextButton(
                    onPressed: status == 'IN_TRANSIT'
                        ? () => _showConfirmDispatch(dispatch)
                        : null,
                    child: const Text('Receive'),
                  ),
                  TextButton(
                    onPressed: () =>
                        _showJsonDetail('Dispatch Detail', dispatch),
                    child: const Text('View'),
                  ),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _suppliersPage() {
    final q = _search.toLowerCase();
    final filtered = _suppliers.where((supplier) {
      return q.isEmpty ||
          '${supplier['name'] ?? ''}'.toLowerCase().contains(q) ||
          '${supplier['supplier_code'] ?? ''}'.toLowerCase().contains(q) ||
          '${supplier['phone'] ?? ''}'.toLowerCase().contains(q);
    }).toList();
    return _Page(
      title: 'Local Vendors',
      subtitle:
          'Manage branch-specific suppliers, folio details, contact information, and terms.',
      actions: [
        _RefreshButton(onPressed: _loadAll),
        FilledButton.icon(
          onPressed: () => _showSupplierForm(),
          icon: Icon(PhosphorIcons.plus()),
          label: const Text('Add Local Vendor'),
        ),
      ],
      children: [
        _StatGrid(cards: [
          _StatCardData('Total Vendors', '${_suppliers.length}',
              PhosphorIcons.buildings(), AppColors.kPrimary),
          _StatCardData(
              'Active',
              '${_suppliers.where((s) => '${s['status']}' == 'ACTIVE').length}',
              PhosphorIcons.checkCircle(),
              AppColors.kSuccess),
          _StatCardData(
              'Blocked',
              '${_suppliers.where((s) => '${s['status']}' == 'BLOCKED').length}',
              PhosphorIcons.prohibit(),
              AppColors.kError),
        ]),
        _FiltersBar(
          search: _search,
          searchHint: 'Search local vendors...',
          onSearchChanged: (value) => setState(() => _search = value),
        ),
        _SectionCard(
          title: 'Vendor Registry',
          child: _RecordList(
            emptyText: 'No local vendors registered',
            children: filtered.map((supplier) {
              return _RecordTile(
                icon: PhosphorIcons.buildings(),
                title: '${supplier['name'] ?? 'Vendor'}',
                subtitle:
                    '${supplier['supplier_code'] ?? 'No code'} | ${supplier['contact_person'] ?? supplier['phone'] ?? 'No contact'}',
                trailing: _StatusChip('${supplier['status'] ?? 'ACTIVE'}',
                    success: '${supplier['status']}' == 'ACTIVE'),
                actions: [
                  TextButton(
                    onPressed: () => _showSupplierFolio(supplier),
                    child: const Text('Folio'),
                  ),
                  TextButton(
                    onPressed: () => _showSupplierForm(supplier: supplier),
                    child: const Text('Edit'),
                  ),
                  TextButton(
                    onPressed: () => _deleteSupplier(supplier),
                    child: const Text('Delete'),
                  ),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _stockTakesPage() {
    return _Page(
      title: 'Stock Take History',
      subtitle:
          'Start daily food, bar, and store-item counts, explain variances, then submit to the branch accountant.',
      actions: [
        _RefreshButton(onPressed: _loadAll),
        OutlinedButton.icon(
          onPressed: _downloadStockTakeWorksheet,
          icon: Icon(PhosphorIcons.download()),
          label: const Text('Download Worksheet'),
        ),
        FilledButton.icon(
          onPressed: _startStockTake,
          icon: Icon(PhosphorIcons.plus()),
          label: const Text('Start New Count'),
        ),
      ],
      children: [
        _SectionCard(
          title: 'Stock Takes',
          child: _RecordList(
            emptyText: 'No stock takes recorded',
            children: _stockTakes.map((take) {
              return _RecordTile(
                icon: PhosphorIcons.clipboardText(),
                title:
                    '${take['count_number'] ?? take['take_number'] ?? 'ST-${'${take['id']}'.take(8)}'}',
                subtitle:
                    '${_stockTakeStoreTypes['${take['store_type'] ?? 'foodstuffs'}'] ?? take['store_type'] ?? 'Foodstuffs'}'
                    '${take['outlet_code'] == null ? '' : ' - ${_barOutlets['${take['outlet_code']}'] ?? take['outlet_code']}'}'
                    ' | ${take['count_type'] ?? take['take_type'] ?? 'daily'} | ${_date(take['count_date'] ?? take['created_at'])}',
                trailing: _StatusChip('${take['status'] ?? 'draft'}'),
                onTap: () => _loadStockTakeDetail('${take['id']}'),
                actions: [
                  TextButton(
                    onPressed: () => _loadStockTakeDetail('${take['id']}'),
                    child: const Text('Open'),
                  ),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _stockTakeDetailPage() {
    final detail = _stockTakeDetail ?? {};
    final editable =
        ['draft', 'in_progress'].contains('${detail['status']}'.toLowerCase());
    return _Page(
      title:
          '${detail['count_number'] ?? detail['take_number'] ?? _selectedStockTakeId}',
      subtitle:
          '${_stockTakeStoreTypes['${detail['store_type'] ?? 'foodstuffs'}'] ?? detail['store_type'] ?? 'Foodstuffs'} daily stock take, valuation, COGS, variance, and review.',
      actions: [
        OutlinedButton.icon(
          onPressed: () => setState(() => _selectedStockTakeId = null),
          icon: const Icon(Icons.arrow_back),
          label: const Text('Back'),
        ),
        _RefreshButton(
            onPressed: () => _loadStockTakeDetail(_selectedStockTakeId!)),
        OutlinedButton.icon(
          onPressed: () =>
              _downloadStockTakeWorksheet(id: _selectedStockTakeId),
          icon: Icon(PhosphorIcons.download()),
          label: const Text('Download PDF'),
        ),
        if (editable)
          OutlinedButton.icon(
            onPressed: _showAddManualStockTakeItem,
            icon: Icon(PhosphorIcons.plus()),
            label: const Text('Add Item'),
          ),
        if (editable)
          FilledButton.icon(
            onPressed: () => _completeStockTake(_selectedStockTakeId!),
            icon: Icon(PhosphorIcons.paperPlaneTilt()),
            label: const Text('Submit for Review'),
          ),
      ],
      children: [
        _StatGrid(cards: [
          _StatCardData('Total Items', '${_stockTakeItems.length}',
              PhosphorIcons.package(), AppColors.kPrimary),
          _StatCardData(
              'Counted',
              '${_stockTakeItems.where((i) => i['counted_quantity'] != null || i['physical_quantity'] != null).length}',
              PhosphorIcons.checkCircle(),
              AppColors.kSuccess),
          _StatCardData(
              'Variances',
              '${_stockTakeItems.where((i) => _num(i['variance']) != 0).length}',
              PhosphorIcons.warning(),
              AppColors.kWarning),
          _StatCardData(
              'Stock Value',
              _money(_stockTakeItems.fold<num>(
                  0,
                  (sum, item) =>
                      sum +
                      (_num(item['physical_quantity'] ??
                              item['system_closing_stock'] ??
                              item['system_quantity']) *
                          _num(item['cost_price'] ?? item['unit_cost'])))),
              PhosphorIcons.coins(),
              Colors.teal),
          _StatCardData(
              'COGS Value',
              _money(_stockTakeItems.fold<num>(
                  0,
                  (sum, item) =>
                      sum +
                      (_num(item['issued_quantity']) *
                          _num(item['cost_price'] ?? item['unit_cost'])))),
              PhosphorIcons.trendUp(),
              Colors.deepOrange),
        ]),
        _SectionCard(
          title: 'Count Sheet',
          child: _RecordList(
            emptyText: 'No items in this stock take',
            children: _stockTakeItems.map((item) {
              return _RecordTile(
                icon: PhosphorIcons.package(),
                title:
                    '${item['item']?['name'] ?? item['item_name'] ?? item['item_sku']}',
                subtitle:
                    'Opening: ${_qtyText(item['opening_stock'])} | Additions: ${_qtyText(item['additions'])} | Issued: ${_qtyText(item['issued_quantity'])} | System closing: ${_qtyText(item['system_closing_stock'] ?? item['system_quantity'])} | Physical: ${item['physical_quantity'] ?? item['counted_quantity'] ?? '-'} | Variance: ${item['variance'] ?? 0} | Cost: ${_money(_num(item['cost_price'] ?? item['unit_cost']))}',
                trailing: _StatusChip('${item['status'] ?? 'PENDING'}',
                    success: '${item['status']}' == 'COUNTED'),
                actions: [
                  if (editable)
                    TextButton(
                      onPressed: () => _showCountItemDialog(item),
                      child: const Text('Count'),
                    ),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _purchaseOrdersPage() {
    final filtered = _purchaseOrders.where((po) {
      final statusOk =
          _statusFilter == 'ALL' || '${po['status']}' == _statusFilter;
      final q = _search.toLowerCase();
      return statusOk &&
          (q.isEmpty ||
              '${po['po_number'] ?? ''}'.toLowerCase().contains(q) ||
              '${po['supplier']?['name'] ?? ''}'.toLowerCase().contains(q));
    }).toList();
    return _Page(
      title: 'Purchase Orders',
      subtitle: 'Create, approve, receive, cancel, and review branch POs.',
      actions: [
        _RefreshButton(onPressed: _loadAll),
        FilledButton.icon(
          onPressed: _showPurchaseOrderForm,
          icon: Icon(PhosphorIcons.plus()),
          label: const Text('New Order'),
        ),
      ],
      children: [
        _StatGrid(cards: [
          _poStat('Pending', 'PENDING', PhosphorIcons.clock()),
          _poStat('Approved', 'APPROVED', PhosphorIcons.checkCircle()),
          _poStat('On Order', 'ORDERED', PhosphorIcons.truck()),
          _poStat('Received', 'RECEIVED', PhosphorIcons.package()),
        ]),
        _FiltersBar(
          search: _search,
          searchHint: 'Search purchase orders...',
          onSearchChanged: (value) => setState(() => _search = value),
          trailing: _statusDropdown([
            'ALL',
            'PENDING',
            'APPROVED',
            'ORDERED',
            'RECEIVED',
            'CANCELLED'
          ]),
        ),
        _SectionCard(
          title: 'Orders',
          child: _RecordList(
            emptyText: 'No purchase orders found',
            children: filtered.map((po) {
              final status = '${po['status'] ?? ''}';
              return _RecordTile(
                icon: PhosphorIcons.shoppingCart(),
                title: '${po['po_number'] ?? po['id']}',
                subtitle:
                    '${po['supplier']?['name'] ?? 'Supplier'} | Expected ${_date(po['expected_delivery'] ?? po['expected_delivery_date'])}',
                trailing: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    _StatusChip(status, success: status == 'RECEIVED'),
                    Text('KES ${_num(po['total_amount']).toStringAsFixed(0)}'),
                  ],
                ),
                actions: [
                  TextButton(
                    onPressed: () => _showJsonDetail('Purchase Order', po),
                    child: const Text('View'),
                  ),
                  if (status == 'PENDING')
                    TextButton(
                      onPressed: () => _poAction(po, 'approve'),
                      child: const Text('Approve'),
                    ),
                  if (status == 'APPROVED')
                    TextButton(
                      onPressed: () => _poAction(po, 'receive'),
                      child: const Text('Receive'),
                    ),
                  if (status != 'RECEIVED' && status != 'CANCELLED')
                    TextButton(
                      onPressed: () => _poAction(po, 'cancel'),
                      child: const Text('Cancel'),
                    ),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _requestsPage() {
    final currentStatuses = {
      'PENDING',
      'PENDING_AUDIT',
      'REVIEWED',
      'APPROVED',
      'PARTIALLY_APPROVED',
      'PACKED',
      'DISPATCHED',
      'REJECTED',
      'IN_TRANSIT',
    };
    final filtered = _stockRequests.where((request) {
      final status = '${request['status']}'.toUpperCase();
      final current = currentStatuses.contains(status);
      final tabOk = _statusFilter == 'HISTORY' ? !current : current;
      return tabOk;
    }).toList();
    return _Page(
      title: 'Stock Requests',
      subtitle:
          'Request stock from central store. Auditor-approved requests move to central store for packing and dispatch.',
      actions: [
        _RefreshButton(onPressed: _loadAll),
        OutlinedButton.icon(
          onPressed: _exportStockRequests,
          icon: Icon(PhosphorIcons.download()),
          label: const Text('Export PDF'),
        ),
        FilledButton.icon(
          onPressed: _showStockRequestForm,
          icon: Icon(PhosphorIcons.plus()),
          label: const Text('New Request'),
        ),
      ],
      children: [
        _Segmented(
          value: _statusFilter == 'HISTORY' ? 'HISTORY' : 'CURRENT',
          values: const ['CURRENT', 'HISTORY'],
          onChanged: (value) => setState(() => _statusFilter = value),
        ),
        _SectionCard(
          title: 'Requests',
          child: _RecordList(
            emptyText: 'No requests found',
            children: filtered.map((request) {
              return _RecordTile(
                icon: PhosphorIcons.gitPullRequest(),
                title: '${request['request_number'] ?? request['id']}',
                subtitle:
                    '${_listFrom(request['items']).length} items | ${_date(request['created_at'])}',
                trailing: _StatusChip('${request['status'] ?? ''}',
                    success: '${request['status']}' == 'DELIVERED'),
                onTap: () =>
                    setState(() => _selectedRequestId = '${request['id']}'),
                actions: [
                  TextButton(
                    onPressed: () =>
                        setState(() => _selectedRequestId = '${request['id']}'),
                    child: const Text('Details'),
                  ),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _requestDetail() {
    final request = _stockRequests.firstWhere(
      (item) => '${item['id']}' == _selectedRequestId,
      orElse: () => <String, dynamic>{},
    );
    final items = _listFrom(request['items']);
    return _Page(
      title: 'Request Details',
      subtitle: '${request['request_number'] ?? _selectedRequestId}',
      actions: [
        OutlinedButton.icon(
          onPressed: () => setState(() => _selectedRequestId = null),
          icon: const Icon(Icons.arrow_back),
          label: const Text('Back'),
        ),
        _RefreshButton(onPressed: _loadAll),
      ],
      children: [
        _SectionCard(
          title: 'Summary',
          child: Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _InfoPill('Status', '${request['status'] ?? '-'}'),
              _InfoPill('Next Step', _stockRequestNextStep(request['status'])),
              _InfoPill('Priority', '${request['priority'] ?? '-'}'),
              _InfoPill('Type', '${request['request_type'] ?? '-'}'),
              _InfoPill('Created', _date(request['created_at'])),
            ],
          ),
        ),
        _SectionCard(
          title: 'Item Breakdown',
          child: _DataTable(
            columns: const [
              'Item',
              'Requested',
              'Approved',
              'Delivered',
              'Distributed',
              'Status'
            ],
            rows: items
                .map((item) => [
                      '${item['item_name'] ?? item['item_sku']}',
                      '${item['requested_quantity'] ?? 0}',
                      '${item['approved_quantity'] ?? '-'}',
                      '${item['dispatched_quantity'] ?? '-'}',
                      '${item['received_quantity'] ?? '-'}',
                      '${item['status'] ?? '-'}',
                    ])
                .toList(),
          ),
        ),
      ],
    );
  }

  Widget _kitchenRequisitionsPage() {
    final q = _search.toLowerCase();
    final filtered = _kitchenRequisitions.where((req) {
      final status = '${req['status']}'.toUpperCase();
      final statusOk = _statusFilter == 'ALL' || status == _statusFilter;
      final items = _listFrom(req['items']);
      final text = [
        req['requisition_number'],
        req['reason'],
        req['priority'],
        req['department'],
        for (final item in items) item['item_name'],
        for (final item in items) item['item_sku'],
      ].join(' ').toLowerCase();
      return statusOk && (q.isEmpty || text.contains(q));
    }).toList();
    return _Page(
      title: 'Department Requisitions',
      subtitle: 'Issue stock to kitchen and other departments or reject.',
      actions: [_RefreshButton(onPressed: _loadAll)],
      children: [
        _FiltersBar(
          search: _search,
          searchHint: 'Search requisitions...',
          onSearchChanged: (value) => setState(() => _search = value),
          trailing: _statusDropdown(
              ['ALL', 'PENDING', 'APPROVED', 'FULFILLED', 'REJECTED']),
        ),
        _SectionCard(
          title: 'Requisitions',
          child: _RecordList(
            emptyText: 'No department requisitions found',
            children: filtered.map((req) {
              final status = '${req['status'] ?? ''}';
              return _RecordTile(
                icon: PhosphorIcons.chefHat(),
                title: '${req['requisition_number'] ?? req['id']}',
                subtitle:
                    '${req['priority'] ?? 'NORMAL'} | ${req['reason'] ?? '-'}',
                trailing: _StatusChip(status, success: status == 'FULFILLED'),
                actions: [
                  if (status == 'PENDING' || status == 'APPROVED')
                    TextButton(
                      onPressed: () => _showFulfillRequisition(req),
                      child: const Text('Issue Stock'),
                    ),
                  if (status == 'PENDING' || status == 'APPROVED')
                    TextButton(
                      onPressed: () => _showRejectRequisition(req),
                      child: const Text('Reject'),
                    ),
                  TextButton(
                    onPressed: () => _showJsonDetail('Requisition Detail', req),
                    child: const Text('View'),
                  ),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _kitchenUsagePage() {
    return _Page(
      title: 'Kitchen Usage Tracking',
      subtitle:
          'Issue items to kitchen, track consumption, spoilage, losses, and closure.',
      actions: [
        _RefreshButton(onPressed: _loadAll),
        FilledButton.icon(
          onPressed: _showKitchenIssueForm,
          icon: Icon(PhosphorIcons.plus()),
          label: const Text('Issue to Kitchen'),
        ),
      ],
      children: [
        _StatGrid(cards: [
          _StatCardData(
              'Active Tracking',
              '${_kitchenUsage.where((r) => '${r['status']}' != 'CLOSED').length}',
              PhosphorIcons.forkKnife(),
              AppColors.kPrimary),
          _StatCardData('Items Available', '${_trackableItems.length}',
              PhosphorIcons.package(), AppColors.kSuccess),
          _StatCardData('Total Records', '${_kitchenUsage.length}',
              PhosphorIcons.clipboardText(), Colors.indigo),
        ]),
        _SectionCard(
          title: 'Usage Records',
          child: _RecordList(
            emptyText: 'No usage records yet',
            children: _kitchenUsage.map((record) {
              final received = _num(record['received_quantity']);
              final remaining = _num(record['remaining_quantity']);
              return _RecordTile(
                icon: PhosphorIcons.forkKnife(),
                title: '${record['item_name'] ?? record['item_sku']}',
                subtitle:
                    '${_date(record['usage_date'])} | remaining ${remaining.toStringAsFixed(0)} of ${received.toStringAsFixed(0)}',
                trailing: _StatusChip('${record['status'] ?? ''}',
                    success: '${record['status']}' == 'CLOSED'),
                actions: [
                  TextButton(
                    onPressed: () => _showKitchenUsageDetail(record),
                    child: const Text('Details'),
                  ),
                  if ('${record['status']}' != 'CLOSED')
                    TextButton(
                      onPressed: () => _showKitchenUsageEntry(record),
                      child: const Text('Record Usage'),
                    ),
                  if ('${record['status']}' != 'CLOSED')
                    TextButton(
                      onPressed: () => _closeKitchenUsage(record),
                      child: const Text('Close'),
                    ),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _stockOutPage() {
    final outs = _stockMovements.where((m) {
      final type = '${m['movement_type']}'.toUpperCase();
      return type == 'STOCK_OUT' || type == 'OUT';
    }).toList();
    return _Page(
      title: 'Stock Out',
      subtitle: 'Issue branch stock to departments with availability checks.',
      actions: [
        _RefreshButton(onPressed: _loadAll),
        OutlinedButton.icon(
          onPressed: _exportStockOut,
          icon: Icon(PhosphorIcons.download()),
          label: const Text('Export Ledger'),
        ),
        FilledButton.icon(
          onPressed: _showStockOutForm,
          icon: Icon(PhosphorIcons.plus()),
          label: const Text('Issue Stock'),
        ),
      ],
      children: [
        _StatGrid(cards: [
          _StatCardData(
              'Total Volume',
              outs
                  .fold<num>(
                      0, (sum, item) => sum + _num(item['quantity']).abs())
                  .toStringAsFixed(0),
              PhosphorIcons.package(),
              AppColors.kPrimary),
          _StatCardData(
              'High Intensity',
              '${outs.where((r) => _num(r['quantity']).abs() > 10).length}',
              PhosphorIcons.activity(),
              AppColors.kError),
          _StatCardData(
              'Today',
              '${outs.where((r) => '${r['created_at']}'.startsWith(DateTime.now().toIso8601String().substring(0, 10))).length}',
              PhosphorIcons.calendar(),
              AppColors.kSuccess),
        ]),
        _SectionCard(
          title: 'Stock Out Ledger',
          child: _RecordList(
            emptyText: 'No stock out records',
            children: outs.map((record) {
              return _RecordTile(
                icon: PhosphorIcons.trendDown(),
                title: _itemName(record),
                subtitle:
                    '${record['reason'] ?? 'department'} | ${_date(record['created_at'])}',
                trailing: Text(
                  '-${_num(record['quantity']).abs().toStringAsFixed(0)}',
                  style: const TextStyle(
                    color: AppColors.kError,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                actions: [
                  TextButton(
                    onPressed: () =>
                        _showJsonDetail('Stock Out Detail', record),
                    child: const Text('View'),
                  ),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _reportsPage() {
    return _Page(
      title: 'Branch Store Reports',
      subtitle:
          'Generate stock, receiving, requests, purchase, usage, and stock-out reports.',
      actions: [_RefreshButton(onPressed: _loadAll)],
      children: [
        _StatGrid(cards: [
          _StatCardData('Stock SKUs', '${_stock.length}',
              PhosphorIcons.package(), AppColors.kPrimary),
          _StatCardData('Requests', '${_stockRequests.length}',
              PhosphorIcons.gitPullRequest(), Colors.indigo),
          _StatCardData('Usage Records', '${_kitchenUsage.length}',
              PhosphorIcons.forkKnife(), AppColors.kSuccess),
          _StatCardData('Purchase Orders', '${_purchaseOrders.length}',
              PhosphorIcons.shoppingCart(), AppColors.kWarning),
        ]),
        _SectionCard(
          title: 'Export Center',
          child: Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _ReportButton(
                  'Stock Ledger', PhosphorIcons.package(), _exportStockLedger),
              _ReportButton('Receiving Oversight', PhosphorIcons.truck(),
                  _exportDispatches),
              _ReportButton('Request History', PhosphorIcons.gitPullRequest(),
                  _exportStockRequests),
              _ReportButton('Stock Take Worksheet',
                  PhosphorIcons.clipboardText(), _downloadStockTakeWorksheet),
              _ReportButton('Kitchen Usage', PhosphorIcons.forkKnife(),
                  _exportKitchenUsage),
              _ReportButton('Stock Out Ledger', PhosphorIcons.trendDown(),
                  _exportStockOut),
            ],
          ),
        ),
      ],
    );
  }

  _StatCardData _poStat(String label, String status, IconData icon) {
    return _StatCardData(
      label,
      '${_purchaseOrders.where((po) => '${po['status']}' == status).length}',
      icon,
      AppColors.kPrimary,
    );
  }

  Widget _statusDropdown(List<String> statuses) {
    return DropdownButton<String>(
      isExpanded: true,
      value: statuses.contains(_statusFilter) ? _statusFilter : statuses.first,
      items: statuses
          .map((status) => DropdownMenuItem(
                value: status,
                child: Text(status, overflow: TextOverflow.ellipsis),
              ))
          .toList(),
      onChanged: (value) => setState(() => _statusFilter = value!),
    );
  }

  void _go(BranchStorekeeperSection section) {
    setState(() => _section = section);
  }

  Future<void> _downloadStockTakeWorksheet({String? id}) async {
    try {
      final file = id == null
          ? await _repo.downloadStockTakeWorksheet(category: _catalogFilter)
          : await _repo.downloadStockTakeWorksheet(id: id);
      _showSnack('Worksheet downloaded: ${file.path}');
    } catch (error) {
      _showSnack('Worksheet download failed: $error', error: true);
    }
  }

  Future<void> _exportStockLedger() async {
    try {
      final file = await _repo.exportStockLedger();
      _showSnack('Stock ledger downloaded: ${file.path}');
    } catch (error) {
      _showSnack('Stock ledger export failed: $error', error: true);
    }
  }

  Future<void> _exportDispatches() async {
    try {
      final file = await _repo.exportBrandedPdf('dispatches');
      _showSnack('Delivery report downloaded: ${file.path}');
    } catch (error) {
      _showSnack('Delivery export failed: $error', error: true);
    }
  }

  Future<void> _exportStockRequests() async {
    final history = _statusFilter == 'HISTORY';
    try {
      final file = await _repo.exportBrandedPdf(
        history ? 'stock_requests_history' : 'stock_requests',
        filters: {
          'status': history
              ? 'DELIVERED,RECEIVED,CANCELLED,FULFILLED'
              : 'PENDING,PENDING_AUDIT,REVIEWED,APPROVED,PARTIALLY_APPROVED,PACKED,DISPATCHED,REJECTED,IN_TRANSIT',
        },
      );
      _showSnack('Stock request report downloaded: ${file.path}');
    } catch (error) {
      _showSnack('Request export failed: $error', error: true);
    }
  }

  Future<void> _exportStockOut() async {
    final today = DateTime.now();
    final start = today.subtract(const Duration(days: 30));
    String fmt(DateTime value) => value.toIso8601String().split('T').first;
    try {
      final file = await _repo.exportBrandedPdf(
        'stock_movement',
        filters: {
          'movement_type': 'STOCK_OUT',
          'start_date': fmt(start),
          'end_date': fmt(today),
        },
      );
      _showSnack('Stock out ledger downloaded: ${file.path}');
    } catch (error) {
      _showSnack('Stock out export failed: $error', error: true);
    }
  }

  Future<void> _exportKitchenUsage() async {
    try {
      final file = await _repo.exportBrandedPdf('kitchen_usage');
      _showSnack('Kitchen usage report downloaded: ${file.path}');
    } catch (error) {
      _showSnack('Kitchen usage export failed: $error', error: true);
    }
  }

  Future<void> _startStockTake() async {
    String storeType = 'foodstuffs';
    String outletCode = 'main_bar';
    showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setDialogState) {
        return AlertDialog(
          title: const Text('Start Daily Stock Take'),
          content: SizedBox(
            width: 420,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  initialValue: storeType,
                  decoration:
                      const InputDecoration(labelText: 'Stock take type'),
                  items: _stockTakeStoreTypes.entries
                      .map((entry) => DropdownMenuItem(
                            value: entry.key,
                            child: Text(entry.value),
                          ))
                      .toList(),
                  onChanged: (value) => setDialogState(() {
                    storeType = value ?? 'foodstuffs';
                  }),
                ),
                if (storeType == 'bar_store') ...[
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    isExpanded: true,
                    initialValue: outletCode,
                    decoration: const InputDecoration(labelText: 'Bar outlet'),
                    items: _barOutlets.entries
                        .map((entry) => DropdownMenuItem(
                              value: entry.key,
                              child: Text(entry.value),
                            ))
                        .toList(),
                    onChanged: (value) =>
                        setDialogState(() => outletCode = value ?? 'main_bar'),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel')),
            FilledButton(
              onPressed: () async {
                Navigator.pop(context);
                try {
                  final result = await _repo.createStockTake(
                    storeType: storeType,
                    outletCode: storeType == 'bar_store' ? outletCode : null,
                  );
                  final id = '${result['id'] ?? result['data']?['id'] ?? ''}';
                  if (id.isNotEmpty) {
                    await _loadAll();
                    await _loadStockTakeDetail(id);
                  }
                  _showSnack('Daily stock take initialized');
                } catch (error) {
                  _showSnack('Failed to start stock take: $error', error: true);
                }
              },
              child: const Text('Start'),
            ),
          ],
        );
      }),
    );
  }

  Future<void> _registerCatalogItem(Map<String, dynamic> item) async {
    try {
      await _repo.adjustBranchStock({
        'item_sku': item['sku'],
        'quantity_change': 0,
        'adjustment_type': 'INITIAL_STOCK',
        'notes': 'Registered from master catalog in Flutter app',
      });
      await _loadAll();
      _showSnack('Item registered for branch stock take');
    } catch (error) {
      _showSnack('Registration failed: $error', error: true);
    }
  }

  Future<void> _quickRequestStock(Map<String, dynamic> item) async {
    try {
      await _repo.createStockRequest({
        'items': [
          {
            'item_sku': item['item_sku'] ?? item['sku'],
            'requested_quantity':
                (_num(item['reorder_level'] ?? item['min_quantity']) * 2)
                    .clamp(1, 999999)
          }
        ],
        'request_type': 'ROUTINE',
        'priority': _num(item['quantity']) <= 0 ? 'URGENT' : 'NORMAL',
        'reason': 'Stock replenishment',
      });
      await _loadAll();
      _showSnack('Stock request submitted');
    } catch (error) {
      _showSnack('Request failed: $error', error: true);
    }
  }

  void _showStockAdjustment(Map<String, dynamic> item) {
    final qtyController = TextEditingController(text: '0');
    final notesController = TextEditingController();
    String type = 'MANUAL_ADJUSTMENT';
    showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setDialogState) {
        return AlertDialog(
          title: Text('Adjust ${_itemName(item)}'),
          content: SizedBox(
            width: 420,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  initialValue: type,
                  decoration:
                      const InputDecoration(labelText: 'Adjustment Type'),
                  items: const [
                    DropdownMenuItem(
                        value: 'MANUAL_ADJUSTMENT',
                        child: Text('Manual Adjustment')),
                    DropdownMenuItem(
                        value: 'INITIAL_STOCK', child: Text('Initial Stock')),
                    DropdownMenuItem(value: 'DAMAGE', child: Text('Damage')),
                    DropdownMenuItem(value: 'LOSS', child: Text('Loss')),
                  ],
                  onChanged: (value) => setDialogState(() => type = value!),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: qtyController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Quantity Change',
                    helperText: 'Use negative values for reduction.',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: notesController,
                  decoration: const InputDecoration(labelText: 'Notes'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel')),
            FilledButton(
              onPressed: () async {
                Navigator.pop(context);
                try {
                  await _repo.adjustBranchStock({
                    'item_sku': item['item_sku'] ?? item['sku'],
                    'quantity_change': num.tryParse(qtyController.text) ?? 0,
                    'adjustment_type': type,
                    'notes': notesController.text,
                  });
                  await _loadAll();
                  _showSnack('Stock adjusted');
                } catch (error) {
                  _showSnack('Adjustment failed: $error', error: true);
                }
              },
              child: const Text('Save'),
            ),
          ],
        );
      }),
    );
  }

  void _showConfirmDispatch(Map<String, dynamic> dispatch) {
    final notesController = TextEditingController();
    final items = _listFrom(dispatch['items']);
    final quantities = {
      for (final item in items)
        '${item['id']}': _num(item['dispatched_quantity'] ?? item['quantity'])
    };
    showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setDialogState) {
        return AlertDialog(
          title: Text('Receive ${dispatch['dispatch_number'] ?? ''}'),
          content: SizedBox(
            width: 640,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ...items.map((item) {
                    final id = '${item['id']}';
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              '${item['item_name'] ?? item['item_sku']}',
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600),
                            ),
                          ),
                          SizedBox(
                            width: 120,
                            child: TextFormField(
                              initialValue:
                                  quantities[id]?.toStringAsFixed(0) ?? '0',
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                labelText: 'Received',
                              ),
                              onChanged: (value) =>
                                  quantities[id] = num.tryParse(value) ?? 0,
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                  TextField(
                    controller: notesController,
                    decoration:
                        const InputDecoration(labelText: 'Delivery Notes'),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel')),
            FilledButton(
              onPressed: () async {
                Navigator.pop(context);
                try {
                  await _repo.confirmDispatch('${dispatch['id']}', {
                    'items_received': items
                        .map((item) => {
                              'item_id': item['id'],
                              'quantity': quantities['${item['id']}'] ?? 0,
                              'damaged': 0,
                              'missing': 0,
                              'note': '',
                            })
                        .toList(),
                    'notes': notesController.text,
                  });
                  await _loadAll();
                  _showSnack('Dispatch received');
                } catch (error) {
                  _showSnack('Receive failed: $error', error: true);
                }
              },
              child: const Text('Confirm Receipt'),
            ),
          ],
        );
      }),
    );
  }

  void _showSupplierReceipt() {
    String? supplierId;
    final deliveryNoteController = TextEditingController();
    final invoiceController = TextEditingController();
    final remarksController = TextEditingController();
    final lines = <Map<String, dynamic>>[];
    showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setDialogState) {
        return AlertDialog(
          title: const Text('Direct Supplier Receipt'),
          content: SizedBox(
            width: 760,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<String>(
                    isExpanded: true,
                    initialValue: supplierId,
                    decoration: const InputDecoration(labelText: 'Supplier'),
                    items: _supplierOptions
                        .map((supplier) => DropdownMenuItem(
                              value: '${supplier['id']}',
                              child: Text('${supplier['name']}'),
                            ))
                        .toList(),
                    onChanged: (value) =>
                        setDialogState(() => supplierId = value),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: deliveryNoteController,
                          decoration:
                              const InputDecoration(labelText: 'Delivery Note'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: invoiceController,
                          decoration:
                              const InputDecoration(labelText: 'Invoice No.'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _LineEditor(
                    catalog: _catalog,
                    lines: lines,
                    onChanged: () => setDialogState(() {}),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: remarksController,
                    decoration: const InputDecoration(labelText: 'Remarks'),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel')),
            FilledButton(
              onPressed: supplierId == null || lines.isEmpty
                  ? null
                  : () async {
                      Navigator.pop(context);
                      try {
                        await _repo.receiveFromSupplier({
                          'supplier_id': supplierId,
                          'delivery_note_number': deliveryNoteController.text,
                          'invoice_number': invoiceController.text,
                          'remarks': remarksController.text,
                          'items': lines,
                        });
                        await _loadAll();
                        _showSnack('Supplier receipt finalized');
                      } catch (error) {
                        _showSnack('Receipt failed: $error', error: true);
                      }
                    },
              child: const Text('Finalize Receipt'),
            ),
          ],
        );
      }),
    );
  }

  void _showSupplierForm({Map<String, dynamic>? supplier}) {
    final name = TextEditingController(text: '${supplier?['name'] ?? ''}');
    final code =
        TextEditingController(text: '${supplier?['supplier_code'] ?? ''}');
    final contact =
        TextEditingController(text: '${supplier?['contact_person'] ?? ''}');
    final phone = TextEditingController(text: '${supplier?['phone'] ?? ''}');
    final email = TextEditingController(text: '${supplier?['email'] ?? ''}');
    final address =
        TextEditingController(text: '${supplier?['address_line1'] ?? ''}');
    final city = TextEditingController(text: '${supplier?['city'] ?? ''}');
    String status = '${supplier?['status'] ?? 'ACTIVE'}';
    String terms = '${supplier?['payment_terms'] ?? 'NET30'}';
    showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setDialogState) {
        return AlertDialog(
          title: Text(supplier == null ? 'Add Local Vendor' : 'Edit Vendor'),
          content: SizedBox(
            width: 640,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(children: [
                    Expanded(
                        child: TextField(
                            controller: name,
                            decoration:
                                const InputDecoration(labelText: 'Name *'))),
                    const SizedBox(width: 12),
                    Expanded(
                        child: TextField(
                            controller: code,
                            decoration:
                                const InputDecoration(labelText: 'Code'))),
                  ]),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                        child: TextField(
                            controller: contact,
                            decoration: const InputDecoration(
                                labelText: 'Contact Person'))),
                    const SizedBox(width: 12),
                    Expanded(
                        child: TextField(
                            controller: phone,
                            decoration:
                                const InputDecoration(labelText: 'Phone'))),
                  ]),
                  const SizedBox(height: 12),
                  TextField(
                      controller: email,
                      decoration: const InputDecoration(labelText: 'Email')),
                  const SizedBox(height: 12),
                  TextField(
                      controller: address,
                      decoration: const InputDecoration(labelText: 'Address')),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                        child: TextField(
                            controller: city,
                            decoration:
                                const InputDecoration(labelText: 'City'))),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        isExpanded: true,
                        initialValue: terms,
                        decoration:
                            const InputDecoration(labelText: 'Payment Terms'),
                        items: const ['COD', 'NET7', 'NET15', 'NET30', 'NET60']
                            .map((item) => DropdownMenuItem(
                                value: item, child: Text(item)))
                            .toList(),
                        onChanged: (value) =>
                            setDialogState(() => terms = value!),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        isExpanded: true,
                        initialValue: status,
                        decoration: const InputDecoration(labelText: 'Status'),
                        items: const ['ACTIVE', 'INACTIVE', 'BLOCKED']
                            .map((item) => DropdownMenuItem(
                                value: item, child: Text(item)))
                            .toList(),
                        onChanged: (value) =>
                            setDialogState(() => status = value!),
                      ),
                    ),
                  ]),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel')),
            FilledButton(
              onPressed: () async {
                if (name.text.trim().isEmpty) return;
                Navigator.pop(context);
                final payload = {
                  'name': name.text.trim(),
                  'supplier_code': code.text.trim(),
                  'contact_person': contact.text.trim(),
                  'phone': phone.text.trim(),
                  'email': email.text.trim(),
                  'address_line1': address.text.trim(),
                  'city': city.text.trim(),
                  'payment_terms': terms,
                  'status': status,
                };
                try {
                  if (supplier == null) {
                    await _repo.createSupplier(payload);
                  } else {
                    await _repo.updateSupplier('${supplier['id']}', payload);
                  }
                  await _loadAll();
                  _showSnack('Vendor saved');
                } catch (error) {
                  _showSnack('Vendor save failed: $error', error: true);
                }
              },
              child: const Text('Save'),
            ),
          ],
        );
      }),
    );
  }

  Future<void> _deleteSupplier(Map<String, dynamic> supplier) async {
    final confirmed = await _confirm('Delete ${supplier['name']}?');
    if (!confirmed) return;
    try {
      await _repo.deleteSupplier('${supplier['id']}');
      await _loadAll();
      _showSnack('Vendor removed');
    } catch (error) {
      _showSnack('Delete failed: $error', error: true);
    }
  }

  void _showSupplierFolio(Map<String, dynamic> supplier) {
    _showJsonDetail('Supplier Folio - ${supplier['name']}', supplier);
  }

  void _showCountItemDialog(Map<String, dynamic> item) {
    final counted = TextEditingController(
        text:
            '${item['counted_quantity'] ?? item['system_closing_stock'] ?? item['system_quantity'] ?? 0}');
    final notes = TextEditingController(
        text:
            '${item['variance_reason'] ?? item['reason'] ?? item['notes'] ?? ''}');
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Count ${item['item_sku']}'),
        content: SizedBox(
          width: 360,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: counted,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Physical Count'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: notes,
                decoration: const InputDecoration(
                    labelText: 'Variance reason / notes',
                    helperText:
                        'Required when physical count differs from system closing stock'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              final physical = num.tryParse(counted.text) ?? 0;
              final systemClosing =
                  _num(item['system_closing_stock'] ?? item['system_quantity']);
              if (physical != systemClosing && notes.text.trim().isEmpty) {
                _showSnack('Variance reason is required', error: true);
                return;
              }
              Navigator.pop(context);
              try {
                await _repo.updateStockTake(_selectedStockTakeId!, [
                  {
                    'id': item['id'],
                    'item_sku': item['item_sku'],
                    'counted_quantity': physical,
                    'variance_reason': notes.text,
                    'notes': notes.text,
                  }
                ]);
                await _loadStockTakeDetail(_selectedStockTakeId!);
                _showSnack('Count saved');
              } catch (error) {
                _showSnack('Count save failed: $error', error: true);
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _showAddManualStockTakeItem() {
    String? sku;
    final quantity = TextEditingController(text: '0');
    showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setDialogState) {
        return AlertDialog(
          title: const Text('Add Manual Item'),
          content: SizedBox(
            width: 460,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  initialValue: sku,
                  decoration: const InputDecoration(labelText: 'Item'),
                  items: _catalogOptions
                      .map((item) => DropdownMenuItem(
                            value: '${item['sku'] ?? item['item_sku']}',
                            child: Text(
                              '${item['item_name'] ?? item['name'] ?? item['sku']}',
                              overflow: TextOverflow.ellipsis,
                            ),
                          ))
                      .toList(),
                  onChanged: (value) => setDialogState(() => sku = value),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: quantity,
                  keyboardType: TextInputType.number,
                  decoration:
                      const InputDecoration(labelText: 'Counted Quantity'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel')),
            FilledButton(
              onPressed: sku == null
                  ? null
                  : () async {
                      Navigator.pop(context);
                      try {
                        await _repo.updateStockTake(_selectedStockTakeId!, [
                          {
                            'item_sku': sku,
                            'counted_quantity':
                                num.tryParse(quantity.text) ?? 0,
                            'is_new': true,
                          }
                        ]);
                        await _loadStockTakeDetail(_selectedStockTakeId!);
                        _showSnack('Manual item added');
                      } catch (error) {
                        _showSnack('Manual item failed: $error', error: true);
                      }
                    },
              child: const Text('Add Item'),
            ),
          ],
        );
      }),
    );
  }

  Future<void> _completeStockTake(String id) async {
    final confirmed = await _confirm(
      'Submit this stock take to the branch accountant for review?',
    );
    if (!confirmed) return;
    try {
      await _repo.completeStockTake(id, notes: 'Submitted from Flutter app');
      await _loadStockTakeDetail(id);
      _showSnack('Stock take submitted to branch accountant');
    } catch (error) {
      _showSnack('Submit failed: $error', error: true);
    }
  }

  void _showPurchaseOrderForm() {
    String? supplierId;
    final expectedDate = TextEditingController();
    final notes = TextEditingController();
    bool autoApprove = true;
    final lines = <Map<String, dynamic>>[];
    showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setDialogState) {
        return AlertDialog(
          title: const Text('Create Purchase Order'),
          content: SizedBox(
            width: 780,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          isExpanded: true,
                          initialValue: supplierId,
                          decoration:
                              const InputDecoration(labelText: 'Supplier'),
                          items: _supplierOptions
                              .map((supplier) => DropdownMenuItem(
                                  value: '${supplier['id']}',
                                  child: Text('${supplier['name']}')))
                              .toList(),
                          onChanged: (value) =>
                              setDialogState(() => supplierId = value),
                        ),
                      ),
                      const SizedBox(width: 12),
                      OutlinedButton.icon(
                        onPressed: () {
                          Navigator.pop(context);
                          _showSupplierForm();
                        },
                        icon: Icon(PhosphorIcons.buildings()),
                        label: const Text('Add Branch Supplier'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: expectedDate,
                    decoration: const InputDecoration(
                      labelText: 'Expected Delivery',
                      hintText: 'YYYY-MM-DD',
                    ),
                  ),
                  const SizedBox(height: 12),
                  _LineEditor(
                    catalog: _catalog,
                    lines: lines,
                    onChanged: () => setDialogState(() {}),
                    itemIdKey: 'item_id',
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: notes,
                    decoration: const InputDecoration(labelText: 'Notes'),
                  ),
                  CheckboxListTile(
                    value: autoApprove,
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Auto-Approve Purchase Order'),
                    onChanged: (value) =>
                        setDialogState(() => autoApprove = value ?? true),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel')),
            FilledButton(
              onPressed: supplierId == null || lines.isEmpty
                  ? null
                  : () async {
                      Navigator.pop(context);
                      try {
                        await _repo.createPurchaseOrder({
                          'supplier_id': supplierId,
                          'po_date':
                              DateTime.now().toIso8601String().substring(0, 10),
                          'expected_delivery_date': expectedDate.text.isEmpty
                              ? null
                              : expectedDate.text,
                          'special_instructions': notes.text,
                          'auto_approve': autoApprove,
                          'items': lines,
                        });
                        await _loadAll();
                        _showSnack('Purchase order created');
                      } catch (error) {
                        _showSnack('PO create failed: $error', error: true);
                      }
                    },
              child: Text(autoApprove ? 'Create & Approve' : 'Create'),
            ),
          ],
        );
      }),
    );
  }

  Future<void> _poAction(Map<String, dynamic> po, String action) async {
    try {
      final id = '${po['id']}';
      if (action == 'approve') await _repo.approvePurchaseOrder(id);
      if (action == 'receive') await _repo.receivePurchaseOrder(id);
      if (action == 'cancel') await _repo.cancelPurchaseOrder(id);
      await _loadAll();
      _showSnack('Purchase order $action complete');
    } catch (error) {
      _showSnack('PO action failed: $error', error: true);
    }
  }

  void _showStockRequestForm() {
    final lines = <Map<String, dynamic>>[];
    final reason = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setDialogState) {
        return AlertDialog(
          title: const Text('New Stock Requisition'),
          content: SizedBox(
            width: 720,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _LineEditor(
                    catalog: _catalog,
                    lines: lines,
                    onChanged: () => setDialogState(() {}),
                    priceEnabled: false,
                    quantityKey: 'requested_quantity',
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: reason,
                    decoration:
                        const InputDecoration(labelText: 'Reason for request'),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel')),
            FilledButton(
              onPressed: lines.isEmpty
                  ? null
                  : () async {
                      Navigator.pop(context);
                      try {
                        await _repo.createStockRequest({
                          'items': lines
                              .map((line) => {
                                    'item_sku': line['item_sku'],
                                    'requested_quantity':
                                        line['requested_quantity'] ??
                                            line['quantity'],
                                  })
                              .toList(),
                          'request_type': 'ROUTINE',
                          'priority': 'NORMAL',
                          'reason': reason.text,
                        });
                        await _loadAll();
                        _showSnack('Stock requisition submitted');
                      } catch (error) {
                        _showSnack('Request failed: $error', error: true);
                      }
                    },
              child: const Text('Submit'),
            ),
          ],
        );
      }),
    );
  }

  void _showFulfillRequisition(Map<String, dynamic> req) {
    final items = _listFrom(req['items']);
    final quantities = {
      for (final item in items)
        '${item['id']}':
            _num(item['approved_quantity'] ?? item['requested_quantity'])
    };
    showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setDialogState) {
        return AlertDialog(
          title: Text('Issue Stock - ${req['requisition_number']}'),
          content: SizedBox(
            width: 640,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: items.map((item) {
                  final id = '${item['id']}';
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      children: [
                        Expanded(
                            child: Text(
                                '${item['item_name'] ?? item['item_sku']}')),
                        SizedBox(
                          width: 120,
                          child: TextFormField(
                            initialValue: quantities[id]?.toStringAsFixed(0),
                            keyboardType: TextInputType.number,
                            decoration:
                                const InputDecoration(labelText: 'Issue Qty'),
                            onChanged: (value) =>
                                quantities[id] = num.tryParse(value) ?? 0,
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel')),
            FilledButton(
              onPressed: () async {
                Navigator.pop(context);
                try {
                  await _repo.fulfillKitchenRequisition(
                    '${req['id']}',
                    items
                        .map((item) => {
                              'item_id': item['id'],
                              'issued_quantity': quantities['${item['id']}'],
                            })
                        .toList(),
                  );
                  await _loadAll();
                  _showSnack('Requisition fulfilled');
                } catch (error) {
                  _showSnack('Fulfillment failed: $error', error: true);
                }
              },
              child: const Text('Confirm Issue'),
            ),
          ],
        );
      }),
    );
  }

  void _showRejectRequisition(Map<String, dynamic> req) {
    final reason = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Reject ${req['requisition_number']}'),
        content: TextField(
          controller: reason,
          decoration: const InputDecoration(labelText: 'Reason *'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              Navigator.pop(context);
              try {
                await _repo.rejectKitchenRequisition(
                    '${req['id']}', reason.text);
                await _loadAll();
                _showSnack('Requisition rejected');
              } catch (error) {
                _showSnack('Reject failed: $error', error: true);
              }
            },
            child: const Text('Reject'),
          ),
        ],
      ),
    );
  }

  void _showKitchenIssueForm() {
    String? sku;
    final quantity = TextEditingController(text: '1');
    final date = TextEditingController(
        text: DateTime.now().toIso8601String().substring(0, 10));
    final unitCost = TextEditingController(text: '0');
    final revenue = TextEditingController(text: '0');
    showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setDialogState) {
        final selected = _trackableOptions.firstWhere(
          (item) => '${item['item_sku'] ?? item['sku']}' == sku,
          orElse: () => <String, dynamic>{},
        );
        return AlertDialog(
          title: const Text('Issue Items to Kitchen'),
          content: SizedBox(
            width: 520,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  initialValue: sku,
                  decoration: const InputDecoration(labelText: 'Item'),
                  items: _trackableOptions
                      .map((item) => DropdownMenuItem(
                            value: '${item['item_sku'] ?? item['sku']}',
                            child: Text(
                              '${item['item_name'] ?? item['name'] ?? item['item_sku'] ?? item['sku']} (${item['quantity'] ?? 0})',
                              overflow: TextOverflow.ellipsis,
                            ),
                          ))
                      .toList(),
                  onChanged: (value) => setDialogState(() => sku = value),
                ),
                if (selected.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: _InfoPill('Available',
                        '${selected['quantity'] ?? 0} ${selected['unit'] ?? 'units'}'),
                  ),
                const SizedBox(height: 12),
                TextField(
                  controller: quantity,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Quantity'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: date,
                  decoration:
                      const InputDecoration(labelText: 'Issue Date YYYY-MM-DD'),
                ),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(
                    child: TextField(
                      controller: unitCost,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Unit Cost'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: revenue,
                      keyboardType: TextInputType.number,
                      decoration:
                          const InputDecoration(labelText: 'Expected Revenue'),
                    ),
                  ),
                ]),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel')),
            FilledButton(
              onPressed: sku == null
                  ? null
                  : () async {
                      Navigator.pop(context);
                      try {
                        await _repo.createKitchenUsageRecord({
                          'item_sku': sku,
                          'received_quantity': num.tryParse(quantity.text) ?? 0,
                          'usage_date': date.text,
                          'unit_cost': num.tryParse(unitCost.text) ?? 0,
                          'expected_revenue': num.tryParse(revenue.text) ?? 0,
                        });
                        await _loadAll();
                        _showSnack('Items issued to kitchen');
                      } catch (error) {
                        _showSnack('Kitchen issue failed: $error', error: true);
                      }
                    },
              child: const Text('Issue'),
            ),
          ],
        );
      }),
    );
  }

  void _showKitchenUsageEntry(Map<String, dynamic> record) {
    final consumed = TextEditingController(text: '0');
    final spoilt = TextEditingController(text: '0');
    final lost = TextEditingController(text: '0');
    final notes = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title:
            Text('Record Usage - ${record['item_name'] ?? record['item_sku']}'),
        content: SizedBox(
          width: 420,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(children: [
                Expanded(
                    child: TextField(
                        controller: consumed,
                        keyboardType: TextInputType.number,
                        decoration:
                            const InputDecoration(labelText: 'Consumed'))),
                const SizedBox(width: 12),
                Expanded(
                    child: TextField(
                        controller: spoilt,
                        keyboardType: TextInputType.number,
                        decoration:
                            const InputDecoration(labelText: 'Spoilt'))),
                const SizedBox(width: 12),
                Expanded(
                    child: TextField(
                        controller: lost,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Lost'))),
              ]),
              const SizedBox(height: 12),
              TextField(
                  controller: notes,
                  decoration: const InputDecoration(labelText: 'Notes')),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              Navigator.pop(context);
              try {
                await _repo.addKitchenUsageEntry('${record['id']}', {
                  'consumed_quantity': num.tryParse(consumed.text) ?? 0,
                  'spoilt_quantity': num.tryParse(spoilt.text) ?? 0,
                  'lost_quantity': num.tryParse(lost.text) ?? 0,
                  'notes': notes.text,
                });
                await _loadAll();
                _showSnack('Usage entry recorded');
              } catch (error) {
                _showSnack('Usage entry failed: $error', error: true);
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  Future<void> _closeKitchenUsage(Map<String, dynamic> record) async {
    final confirmed = await _confirm('Close this kitchen usage record?');
    if (!confirmed) return;
    try {
      await _repo.closeKitchenUsageRecord('${record['id']}', {
        'notes': 'Closed from Flutter branch storekeeper dashboard',
      });
      await _loadAll();
      _showSnack('Usage record closed');
    } catch (error) {
      _showSnack('Close failed: $error', error: true);
    }
  }

  void _showKitchenUsageDetail(Map<String, dynamic> record) {
    _showJsonDetail('Kitchen Usage Detail', record);
  }

  void _showStockOutForm() {
    String? sku;
    final qty = TextEditingController(text: '1');
    final notes = TextEditingController();
    String department = 'Main Kitchen - Shift A';
    showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setDialogState) {
        final selected = _stockOptions.firstWhere(
          (item) => '${item['item_sku'] ?? item['sku']}' == sku,
          orElse: () => <String, dynamic>{},
        );
        return AlertDialog(
          title: const Text('Issue Stock to Department'),
          content: SizedBox(
            width: 520,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  initialValue: sku,
                  decoration: const InputDecoration(labelText: 'Item'),
                  items: _stockOptions
                      .map((item) => DropdownMenuItem(
                            value: '${item['item_sku'] ?? item['sku']}',
                            child: Text(
                              '${_itemName(item)} (${_qty(item)})',
                              overflow: TextOverflow.ellipsis,
                            ),
                          ))
                      .toList(),
                  onChanged: (value) => setDialogState(() => sku = value),
                ),
                if (selected.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: _InfoPill('Available', _qty(selected)),
                  ),
                const SizedBox(height: 12),
                TextField(
                  controller: qty,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Quantity'),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  initialValue: department,
                  decoration: const InputDecoration(labelText: 'Department'),
                  items: const [
                    'Housekeeping',
                    'Buffet',
                    'Breakfast',
                    'Outside Catering',
                    'Pastries Kitchen',
                    'Chomazone Kitchen',
                    'Main Kitchen - Shift A',
                    'Main Kitchen - Shift B',
                    'Executive Bar',
                    'Main Bar',
                    'Maintenance',
                    'Other',
                  ]
                      .map((item) =>
                          DropdownMenuItem(value: item, child: Text(item)))
                      .toList(),
                  onChanged: (value) =>
                      setDialogState(() => department = value!),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: notes,
                  decoration: const InputDecoration(labelText: 'Notes'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel')),
            FilledButton(
              onPressed: sku == null
                  ? null
                  : () async {
                      final quantity = num.tryParse(qty.text) ?? 0;
                      if (quantity <= 0 ||
                          (selected.isNotEmpty &&
                              quantity > _num(selected['quantity']))) {
                        _showSnack('Quantity exceeds available stock',
                            error: true);
                        return;
                      }
                      Navigator.pop(context);
                      try {
                        await _repo.recordStockOut({
                          'item_sku': sku,
                          'quantity': quantity,
                          'reason': department,
                          'notes': notes.text,
                          'movement_type': 'STOCK_OUT',
                        });
                        await _loadAll();
                        _showSnack('Stock issued to department');
                      } catch (error) {
                        _showSnack('Stock out failed: $error', error: true);
                      }
                    },
              child: const Text('Issue & Approve'),
            ),
          ],
        );
      }),
    );
  }

  void _showJsonDetail(String title, Map<String, dynamic> data) {
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: SizedBox(
          width: 680,
          child: SingleChildScrollView(
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: data.entries
                  .where((entry) => entry.value != null)
                  .map((entry) => _InfoPill(entry.key, _display(entry.value)))
                  .toList(),
            ),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Close')),
        ],
      ),
    );
  }

  Future<bool> _confirm(String message) async {
    return await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Confirm'),
            content: Text(message),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Confirm'),
              ),
            ],
          ),
        ) ??
        false;
  }

  void _showSnack(String message, {bool error = false}) {
    if (!mounted) return;
    AppNotifier.showSnackBar(
      context,
      SnackBar(
        content: Text(message),
        backgroundColor: error ? AppColors.kError : AppColors.kPrimary,
      ),
    );
  }

  String _itemName(Map<String, dynamic> item) {
    final nested = item['item'];
    if (nested is Map) {
      return '${nested['item_name'] ?? nested['name'] ?? item['item_sku'] ?? ''}';
    }
    return '${item['item_name'] ?? item['name'] ?? item['description'] ?? item['item_sku'] ?? item['sku'] ?? 'Unknown Item'}';
  }

  String _qty(Map<String, dynamic> item) {
    final unit = item['item'] is Map
        ? item['item']['unit_of_measure'] ?? item['item']['unit']
        : item['unit_of_measure'] ?? item['unit'];
    return '${_num(item['quantity']).toStringAsFixed(_num(item['quantity']) % 1 == 0 ? 0 : 2)} ${unit ?? 'units'}';
  }

  String _qtyText(dynamic value) {
    final number = _num(value);
    return number.toStringAsFixed(number % 1 == 0 ? 0 : 2);
  }

  String _money(num value) {
    return 'KES ${value.toStringAsFixed(2)}';
  }

  num _num(dynamic value) {
    if (value is num) return value;
    return num.tryParse('$value') ?? 0;
  }

  String _date(dynamic value) {
    if (value == null || '$value'.isEmpty || '$value' == 'null') return '-';
    final parsed = DateTime.tryParse('$value');
    if (parsed == null) return '$value';
    return '${parsed.year.toString().padLeft(4, '0')}-${parsed.month.toString().padLeft(2, '0')}-${parsed.day.toString().padLeft(2, '0')}';
  }

  String _display(dynamic value) {
    if (value is List) return '${value.length} items';
    if (value is Map) {
      return value.entries
          .take(4)
          .map((e) => '${e.key}: ${e.value}')
          .join(', ');
    }
    return '$value';
  }

  String _stockRequestNextStep(dynamic rawStatus) {
    final status = '$rawStatus'.toUpperCase();
    if (status == 'PENDING' || status == 'PENDING_AUDIT') {
      return 'Auditor review';
    }
    if (status == 'APPROVED' || status == 'REVIEWED') {
      return 'Central store packing';
    }
    if (status == 'PACKED' ||
        status == 'DISPATCHED' ||
        status == 'IN_TRANSIT') {
      return 'Await branch receipt';
    }
    if (status == 'DELIVERED' ||
        status == 'RECEIVED' ||
        status == 'FULFILLED') {
      return 'Completed';
    }
    if (status == 'REJECTED' || status == 'CANCELLED') return 'Closed';
    return '-';
  }
}

extension on String {
  String take(int count) => length <= count ? this : substring(0, count);
}

class _LineEditor extends StatefulWidget {
  const _LineEditor({
    required this.catalog,
    required this.lines,
    required this.onChanged,
    this.itemIdKey,
    this.quantityKey = 'quantity',
    this.priceEnabled = true,
  });

  final List<Map<String, dynamic>> catalog;
  final List<Map<String, dynamic>> lines;
  final VoidCallback onChanged;
  final String? itemIdKey;
  final String quantityKey;
  final bool priceEnabled;

  @override
  State<_LineEditor> createState() => _LineEditorState();
}

class _LineEditorState extends State<_LineEditor> {
  String? _selectedSku;

  List<Map<String, dynamic>> get _catalogOptions {
    final seen = <String>{};
    return widget.catalog.where((item) {
      final sku = '${item['sku'] ?? item['item_sku'] ?? ''}'.trim();
      if (sku.isEmpty || sku == 'null' || seen.contains(sku)) return false;
      seen.add(sku);
      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final catalog = _catalogOptions;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: DropdownButtonFormField<String>(
                isExpanded: true,
                initialValue: _selectedSku,
                decoration: const InputDecoration(labelText: 'Add Item'),
                items: catalog
                    .map((item) => DropdownMenuItem(
                          value: '${item['sku'] ?? item['item_sku']}',
                          child: Text(
                            '${item['item_name'] ?? item['name'] ?? item['sku']}',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ))
                    .toList(),
                onChanged: (value) => setState(() => _selectedSku = value),
              ),
            ),
            const SizedBox(width: 12),
            FilledButton.icon(
              onPressed: _selectedSku == null ? null : _addLine,
              icon: Icon(PhosphorIcons.plus()),
              label: const Text('Add'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (widget.lines.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              border: Border.all(color: Colors.grey.shade200),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Text('No line items added yet'),
          )
        else
          Column(
            children: widget.lines.map((line) {
              final index = widget.lines.indexOf(line);
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${line['item_name'] ?? line['item_sku']}',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ),
                      SizedBox(
                        width: 92,
                        child: TextFormField(
                          initialValue: '${line[widget.quantityKey] ?? 1}',
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Qty'),
                          onChanged: (value) {
                            line[widget.quantityKey] = num.tryParse(value) ?? 0;
                            widget.onChanged();
                          },
                        ),
                      ),
                      if (widget.priceEnabled) ...[
                        const SizedBox(width: 8),
                        SizedBox(
                          width: 112,
                          child: TextFormField(
                            initialValue: '${line['unit_price'] ?? 0}',
                            keyboardType: TextInputType.number,
                            decoration:
                                const InputDecoration(labelText: 'Unit Price'),
                            onChanged: (value) {
                              line['unit_price'] = num.tryParse(value) ?? 0;
                              widget.onChanged();
                            },
                          ),
                        ),
                      ],
                      IconButton(
                        tooltip: 'Remove',
                        onPressed: () {
                          setState(() => widget.lines.removeAt(index));
                          widget.onChanged();
                        },
                        icon: Icon(PhosphorIcons.trash()),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
      ],
    );
  }

  void _addLine() {
    final item = _catalogOptions.firstWhere(
      (element) => '${element['sku'] ?? element['item_sku']}' == _selectedSku,
      orElse: () => <String, dynamic>{},
    );
    if (item.isEmpty) return;
    if (widget.lines.any((line) => line['item_sku'] == _selectedSku)) return;
    setState(() {
      widget.lines.add({
        if (widget.itemIdKey != null)
          widget.itemIdKey!: item['sku'] ?? item['item_sku'],
        'item_sku': item['sku'] ?? item['item_sku'],
        'item_name': item['item_name'] ?? item['name'] ?? item['sku'],
        widget.quantityKey: 1,
        if (widget.priceEnabled)
          'unit_price': item['cost_price'] ?? item['unit_price'] ?? 0,
      });
      _selectedSku = null;
    });
    widget.onChanged();
  }
}

class _Page extends StatelessWidget {
  const _Page({
    required this.title,
    required this.subtitle,
    required this.children,
    this.actions = const [],
  });

  final String title;
  final String subtitle;
  final List<Widget> actions;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 16,
            runSpacing: 12,
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 760),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context).textTheme.displaySmall,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        color: AppColors.kTextSecondary,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
              Wrap(spacing: 8, runSpacing: 8, children: actions),
            ],
          ),
          const SizedBox(height: 24),
          ...children.expand((child) => [child, const SizedBox(height: 18)]),
        ],
      ),
    );
  }
}

class _LoadingPage extends StatelessWidget {
  const _LoadingPage();

  @override
  Widget build(BuildContext context) {
    return const Center(child: CircularProgressIndicator());
  }
}

class _RefreshButton extends StatelessWidget {
  const _RefreshButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: const Icon(Icons.refresh),
      label: const Text('Refresh'),
    );
  }
}

class _StatCardData {
  const _StatCardData(this.label, this.value, this.icon, this.color);
  final String label;
  final String value;
  final IconData icon;
  final Color color;
}

class _StatGrid extends StatelessWidget {
  const _StatGrid({required this.cards});

  final List<_StatCardData> cards;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final columns = constraints.maxWidth > 1100
          ? 4
          : constraints.maxWidth > 760
              ? 3
              : constraints.maxWidth > 520
                  ? 2
                  : 1;
      return GridView.count(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisCount: columns,
        crossAxisSpacing: 14,
        mainAxisSpacing: 14,
        childAspectRatio: 3.2,
        children: cards.map((card) => _StatCard(card)).toList(),
      );
    });
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard(this.data);
  final _StatCardData data;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: data.color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(data.icon, color: data.color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    data.label.toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: AppColors.kTextSecondary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    data.value,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 14),
            child,
          ],
        ),
      ),
    );
  }
}

class _FiltersBar extends StatelessWidget {
  const _FiltersBar({
    required this.search,
    required this.searchHint,
    required this.onSearchChanged,
    this.trailing,
  });

  final String search;
  final String searchHint;
  final ValueChanged<String> onSearchChanged;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: 'Filters',
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: TextEditingController(text: search)
                ..selection = TextSelection.collapsed(offset: search.length),
              onChanged: onSearchChanged,
              decoration: InputDecoration(
                hintText: searchHint,
                prefixIcon: Icon(PhosphorIcons.magnifyingGlass()),
              ),
            ),
          ),
          if (trailing != null) ...[
            const SizedBox(width: 16),
            SizedBox(width: 220, child: trailing!),
          ],
        ],
      ),
    );
  }
}

class _RecordList extends StatelessWidget {
  const _RecordList({required this.children, required this.emptyText});

  final List<Widget> children;
  final String emptyText;

  @override
  Widget build(BuildContext context) {
    if (children.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: Colors.grey.shade50,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Center(child: Text(emptyText)),
      );
    }
    return Column(children: children);
  }
}

class _RecordTile extends StatelessWidget {
  const _RecordTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.trailing,
    this.actions = const [],
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final List<Widget> actions;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade200),
        borderRadius: BorderRadius.circular(8),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.kPrimary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: AppColors.kPrimary),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.kTextSecondary,
                      ),
                    ),
                    if (actions.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child:
                            Wrap(spacing: 8, runSpacing: 4, children: actions),
                      ),
                  ],
                ),
              ),
              if (trailing != null) ...[
                const SizedBox(width: 12),
                trailing!,
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip(this.label, {this.success = false, this.warning = false});

  final String label;
  final bool success;
  final bool warning;

  @override
  Widget build(BuildContext context) {
    final color = success
        ? AppColors.kSuccess
        : warning
            ? AppColors.kWarning
            : AppColors.kPrimary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction(this.label, this.icon, this.onTap);

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 220,
      child: OutlinedButton.icon(
        onPressed: onTap,
        icon: Icon(icon),
        label: Text(label, overflow: TextOverflow.ellipsis),
        style: OutlinedButton.styleFrom(
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        ),
      ),
    );
  }
}

class _ReportButton extends StatelessWidget {
  const _ReportButton(this.label, this.icon, this.onPressed);

  final String label;
  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 220,
      child: FilledButton.icon(
        onPressed: onPressed,
        icon: Icon(icon),
        label: Text(label),
      ),
    );
  }
}

class _InfoPill extends StatelessWidget {
  const _InfoPill(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 260),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 10,
              color: AppColors.kTextSecondary,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _Segmented extends StatelessWidget {
  const _Segmented({
    required this.value,
    required this.values,
    required this.onChanged,
  });

  final String value;
  final List<String> values;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: values.map((item) {
            final selected = item == value;
            return Padding(
              padding: const EdgeInsets.all(2),
              child: ChoiceChip(
                label: Text(item),
                selected: selected,
                onSelected: (_) => onChanged(item),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}

class _DataTable extends StatelessWidget {
  const _DataTable({required this.columns, required this.rows});

  final List<String> columns;
  final List<List<String>> rows;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: Center(child: Text('No records found')),
      );
    }
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        columns:
            columns.map((column) => DataColumn(label: Text(column))).toList(),
        rows: rows
            .map(
              (row) => DataRow(
                cells: row.map((cell) => DataCell(Text(cell))).toList(),
              ),
            )
            .toList(),
      ),
    );
  }
}
