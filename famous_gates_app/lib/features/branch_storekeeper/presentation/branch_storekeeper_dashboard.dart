import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/master_dashboard_shell.dart';
import '../../../core/widgets/record_detail_screen.dart';
import '../../../core/widgets/notification_button.dart';
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
  notifications,
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
  String? _poSupplierFilter;
  String? _selectedStockTakeId;
  String? _selectedRequestId;
  final _receiveBarcodeCtrl = TextEditingController();
  final _receiveManualSearchCtrl = TextEditingController();
  final _receiveInvoiceCtrl = TextEditingController();
  final _receiveDeliveryNoteCtrl = TextEditingController();
  final _receiveRemarksCtrl = TextEditingController();
  final _receiveScannerFocus = FocusNode();
  String? _receiveSupplierId;
  String? _receivePoId;
  String? _receivePoNumber;
  bool _receiveScannerMode = true;
  bool _receiveScanning = false;
  bool _receiveLoadingPo = false;
  bool _receiveSubmitting = false;
  String _receiveScanStatus = 'Scanner ready';
  String? _receiveLastScan;
  List<Map<String, dynamic>> _receiveManualResults = [];
  final List<Map<String, dynamic>> _receiveLines = [];

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
  List<Map<String, dynamic>> _departmentAccounts = [];
  List<Map<String, dynamic>> _departmentConsumption = [];
  Map<String, dynamic> _inventoryAnalytics = {};
  Map<String, dynamic>? _stockTakeDetail;
  List<Map<String, dynamic>> _stockTakeItems = [];
  String _analyticsPeriod = 'month';
  bool _analyticsLoading = false;

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
    'main_bar': 'Main Bar',
    'executive_bar': 'Executive Bar',
    'kitchen_shift_a': 'Kitchen Shift A',
    'kitchen_shift_b': 'Kitchen Shift B',
    'housekeeping': 'Housekeeping',
    'spa_sauna': 'Spa & Sauna',
    'pos_outlet': 'POS Outlet',
    'general': 'General Stock',
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

  @override
  void dispose() {
    _receiveBarcodeCtrl.dispose();
    _receiveManualSearchCtrl.dispose();
    _receiveInvoiceCtrl.dispose();
    _receiveDeliveryNoteCtrl.dispose();
    _receiveRemarksCtrl.dispose();
    _receiveScannerFocus.dispose();
    super.dispose();
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
      _safe(_repo.departmentAccounts, <Map<String, dynamic>>[]),
      _safe(_repo.departmentConsumption, <Map<String, dynamic>>[]),
      _safe(_repo.enterpriseInventoryAnalytics, <String, dynamic>{}),
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
      _departmentAccounts =
          List<Map<String, dynamic>>.from(results[12] as List);
      _departmentConsumption =
          List<Map<String, dynamic>>.from(results[13] as List);
      _inventoryAnalytics = results[14] as Map<String, dynamic>;
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

  String _optionSku(Map<String, dynamic> item) =>
      '${item['item_sku'] ?? item['sku'] ?? item['item_code'] ?? ''}'.trim();

  String _catalogOptionSku(Map<String, dynamic> item) =>
      '${item['sku'] ?? item['item_sku'] ?? item['item_code'] ?? ''}'.trim();

  String _itemSearchText(Map<String, dynamic> item) => [
        _optionSku(item),
        _catalogOptionSku(item),
        _itemName(item),
        item['barcode'],
        item['bar_code'],
        item['category'],
        item['item_category'],
        item['unit'],
        item['unit_of_measure'],
      ]
          .where((value) => value != null && '$value'.trim().isNotEmpty)
          .join(' ')
          .toLowerCase();

  String _supplierLabel(Map<String, dynamic> supplier) {
    final name =
        '${supplier['name'] ?? supplier['supplier_name'] ?? ''}'.trim();
    final code =
        '${supplier['supplier_code'] ?? supplier['code'] ?? ''}'.trim();
    final phone = '${supplier['phone'] ?? ''}'.trim();
    return [name, code, phone].where((part) => part.isNotEmpty).join(' | ');
  }

  String _supplierSearchText(Map<String, dynamic> supplier) => [
        supplier['name'],
        supplier['supplier_name'],
        supplier['supplier_code'],
        supplier['code'],
        supplier['phone'],
        supplier['email'],
        supplier['contact_person'],
      ]
          .where((value) => value != null && '$value'.trim().isNotEmpty)
          .join(' ')
          .toLowerCase();

  void _focusReceiveScanner() {
    if (!mounted ||
        _section != BranchStorekeeperSection.receive ||
        !_receiveScannerMode) {
      return;
    }
    _receiveScannerFocus.requestFocus();
  }

  String _cleanScanCode(String value) => value
      .replaceAll(RegExp(r'[\r\n\t]'), '')
      .replaceAll(RegExp(r'\s+'), '')
      .trim();

  String _catalogSku(Map<String, dynamic> item) =>
      '${item['sku'] ?? item['item_sku'] ?? item['item_code'] ?? item['id'] ?? ''}'
          .trim();

  bool _matchesCatalogCode(Map<String, dynamic> item, String code) {
    final needle = code.toLowerCase();
    const keys = [
      'barcode',
      'bar_code',
      'sku',
      'item_sku',
      'item_code',
      'code',
      'id',
    ];
    return keys
        .any((key) => '${item[key] ?? ''}'.trim().toLowerCase() == needle);
  }

  Map<String, dynamic>? _findLoadedCatalogItem(String code) {
    for (final item in _catalogOptions) {
      if (_matchesCatalogCode(item, code)) return item;
    }
    return null;
  }

  Future<void> _scanBranchReceiptBarcode() async {
    final code = _cleanScanCode(_receiveBarcodeCtrl.text);
    if (code.isEmpty || _receiveScanning) return;
    setState(() {
      _receiveScanning = true;
      _receiveScanStatus = 'Scanning $code';
      _receiveLastScan = code;
    });
    try {
      var item = _findLoadedCatalogItem(code);
      if (item == null) {
        final rows = await _repo.masterCatalog(search: code, limit: 30);
        for (final row in rows) {
          if (_matchesCatalogCode(row, code)) {
            item = row;
            break;
          }
        }
        item ??= rows.length == 1 ? rows.first : null;
      }
      if (item == null) {
        if (mounted) {
          setState(() => _receiveScanStatus = 'No item found for $code');
          _showSnack('No catalog item found for $code', error: true);
        }
        return;
      }
      final name = _addReceiveLine(item, viaScan: true);
      if (mounted) setState(() => _receiveScanStatus = 'Added $name');
    } catch (error) {
      if (mounted) {
        setState(() => _receiveScanStatus = 'Scan failed');
        _showSnack('Scan failed: $error', error: true);
      }
    } finally {
      if (mounted) setState(() => _receiveScanning = false);
      _receiveBarcodeCtrl.clear();
      WidgetsBinding.instance
          .addPostFrameCallback((_) => _focusReceiveScanner());
    }
  }

  Future<void> _searchReceiveManual() async {
    final query = _receiveManualSearchCtrl.text.trim();
    if (query.isEmpty) return;
    final rows = await _safe(
      () => _repo.masterCatalog(search: query, limit: 25),
      <Map<String, dynamic>>[],
    );
    if (mounted) setState(() => _receiveManualResults = rows);
  }

  String _addReceiveLine(Map<String, dynamic> item, {required bool viaScan}) {
    final sku = _catalogSku(item);
    if (sku.isEmpty) return 'item';
    final name =
        '${item['item_name'] ?? item['name'] ?? item['description'] ?? sku}';
    setState(() {
      final index =
          _receiveLines.indexWhere((line) => '${line['item_sku']}' == sku);
      if (index >= 0) {
        _receiveLines[index]['quantity'] =
            _num(_receiveLines[index]['quantity']) + 1;
        _receiveLines[index]['added_via'] = viaScan ? 'scan' : 'manual';
      } else {
        _receiveLines.add({
          'item_sku': sku,
          'item_name': name,
          'quantity': 1,
          'unit_price': item['cost_price'] ?? item['unit_price'] ?? 0,
          'unit_of_measure': item['unit_of_measure'] ?? item['unit'] ?? 'units',
          'barcode': item['barcode'] ?? item['bar_code'] ?? '',
          'added_via': viaScan ? 'scan' : 'manual',
        });
      }
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _focusReceiveScanner());
    return name;
  }

  void _removeReceiveLine(int index) {
    setState(() => _receiveLines.removeAt(index));
    WidgetsBinding.instance.addPostFrameCallback((_) => _focusReceiveScanner());
  }

  Future<void> _loadBranchReceiptFromPo() async {
    setState(() => _receiveLoadingPo = true);
    try {
      final selectable = _purchaseOrders.where((po) {
        final status = '${po['status'] ?? ''}'.toLowerCase();
        return !status.contains('cancel') &&
            !status.contains('receiv') &&
            !status.contains('closed');
      }).toList();
      if (selectable.isEmpty) {
        _showSnack('No open branch purchase orders to receive', error: true);
        return;
      }
      final chosen = await showDialog<Map<String, dynamic>>(
        context: context,
        builder: (ctx) => SimpleDialog(
          title: const Text('Receive against Branch Purchase Order'),
          children: selectable
              .map((po) => SimpleDialogOption(
                    onPressed: () => Navigator.pop(ctx, po),
                    child: ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(PhosphorIcons.fileText()),
                      title: Text('${po['po_number'] ?? po['id'] ?? 'PO'}'),
                      subtitle: Text(
                        '${po['supplier_name'] ?? po['supplier']?['name'] ?? 'Supplier'} | ${po['status'] ?? ''}',
                      ),
                      trailing: Text(_money(_num(po['total_amount']))),
                    ),
                  ))
              .toList(),
        ),
      );
      if (chosen == null) return;
      await _applyBranchReceiptPo('${chosen['id'] ?? ''}', fallback: chosen);
    } catch (error) {
      _showSnack('Could not load purchase orders: $error', error: true);
    } finally {
      if (mounted) setState(() => _receiveLoadingPo = false);
      WidgetsBinding.instance
          .addPostFrameCallback((_) => _focusReceiveScanner());
    }
  }

  Future<void> _applyBranchReceiptPo(
    String poId, {
    Map<String, dynamic>? fallback,
  }) async {
    if (poId.isEmpty) return;
    setState(() => _receiveLoadingPo = true);
    try {
      final po = await _safe(
        () => _repo.purchaseOrder(poId),
        fallback ?? <String, dynamic>{},
      );
      final items = _listFrom(po['items']);
      final lines = items
          .map((item) {
            final quantity = _num(
              item['quantity_pending'] ??
                  item['quantity_ordered'] ??
                  item['ordered_quantity'] ??
                  item['quantity'] ??
                  0,
            );
            final sku =
                '${item['item_id'] ?? item['item_sku'] ?? item['sku'] ?? ''}';
            return <String, dynamic>{
              'item_id': sku,
              'item_sku': sku,
              'item_name':
                  '${item['item_name'] ?? item['name'] ?? item['item']?['name'] ?? sku}',
              'quantity': quantity <= 0 ? 1 : quantity,
              'quantity_ordered': _num(
                item['quantity_ordered'] ??
                    item['ordered_quantity'] ??
                    quantity,
              ),
              'unit_price': item['unit_price'] ?? item['cost_price'] ?? 0,
              'unit_of_measure':
                  item['unit_of_measure'] ?? item['unit'] ?? 'units',
              'po_item_id': item['id'],
              'added_via': 'po',
            };
          })
          .where((line) => '${line['item_sku']}'.trim().isNotEmpty)
          .toList();
      if (lines.isEmpty) {
        _showSnack('Selected PO has no receivable items', error: true);
        return;
      }
      if (!mounted) return;
      setState(() {
        _receivePoId = poId;
        _receivePoNumber = '${po['po_number'] ?? poId}';
        _receiveSupplierId =
            '${po['supplier_id'] ?? po['supplier']?['id'] ?? _receiveSupplierId ?? ''}';
        if (_receiveSupplierId == 'null' || _receiveSupplierId!.isEmpty) {
          _receiveSupplierId = null;
        }
        _receiveLines
          ..clear()
          ..addAll(lines);
        _receiveScanStatus =
            'Loaded ${lines.length} item(s) from $_receivePoNumber';
      });
      _showSnack('Loaded ${lines.length} item(s) from $_receivePoNumber');
    } catch (error) {
      _showSnack('Could not load PO: $error', error: true);
    } finally {
      if (mounted) setState(() => _receiveLoadingPo = false);
      WidgetsBinding.instance
          .addPostFrameCallback((_) => _focusReceiveScanner());
    }
  }

  Future<void> _submitBranchSupplierReceipt() async {
    if (_receiveSupplierId == null || _receiveSupplierId!.isEmpty) {
      _showSnack('Select a supplier first', error: true);
      return;
    }
    if (_receiveLines.isEmpty) {
      _showSnack('Scan or add at least one item', error: true);
      return;
    }
    setState(() => _receiveSubmitting = true);
    try {
      await _repo.receiveFromSupplier({
        'supplier_id': _receiveSupplierId,
        if (_receivePoId != null) 'po_id': _receivePoId,
        'delivery_note_number': _receiveDeliveryNoteCtrl.text.trim(),
        'invoice_number': _receiveInvoiceCtrl.text.trim(),
        'remarks': _receiveRemarksCtrl.text.trim(),
        'items': _receiveLines
            .map((line) => {
                  ...line,
                  if (line['po_item_id'] != null)
                    'po_item_id': line['po_item_id'],
                })
            .toList(),
      });
      setState(() {
        _receiveLines.clear();
        _receiveInvoiceCtrl.clear();
        _receiveDeliveryNoteCtrl.clear();
        _receiveRemarksCtrl.clear();
        _receivePoId = null;
        _receivePoNumber = null;
        _receiveScanStatus = 'Scanner ready';
        _receiveLastScan = null;
      });
      await _loadAll();
      _showSnack('Supplier receipt finalized');
    } catch (error) {
      _showSnack('Receipt failed: $error', error: true);
    } finally {
      if (mounted) setState(() => _receiveSubmitting = false);
      WidgetsBinding.instance
          .addPostFrameCallback((_) => _focusReceiveScanner());
    }
  }

  @override
  Widget build(BuildContext context) {
    return MasterDashboardShell<BranchStorekeeperSection>(
      title: 'Branch Store',
      subtitle: 'Famous Gates',
      initials: 'B',
      sidebarTitle: 'Famous Gates Hotels',
      sidebarSubtitle: 'Management System',
      sidebarInitials: 'FG',
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
          _poSupplierFilter = null;
        });
        if (section == BranchStorekeeperSection.receive) {
          WidgetsBinding.instance
              .addPostFrameCallback((_) => _focusReceiveScanner());
        }
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
        MasterNavItem(
          section: BranchStorekeeperSection.notifications,
          label: 'Notifications',
          icon: PhosphorIcons.bell(),
          group: 'System',
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
      case BranchStorekeeperSection.notifications:
        return _notificationsPage();
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
        // ── Dispatch en-route alert ──────────────────────────────────
        if (inTransit > 0)
          _AlertBanner(
            icon: PhosphorIcons.truck(),
            color: AppColors.kSuccess,
            title: '$inTransit Dispatch${inTransit == 1 ? '' : 'es'} En Route',
            subtitle:
                'Stock has been dispatched from central store and is on its way. Tap to prepare for receiving.',
            onTap: () => _go(BranchStorekeeperSection.receive),
          ),

        // ── Recently approved requests alert ────────────────────────
        if (_stockRequests.any((r) =>
            '${r['status']}'.toUpperCase() == 'APPROVED' ||
            '${r['status']}'.toUpperCase() == 'PARTIALLY_APPROVED'))
          _AlertBanner(
            icon: PhosphorIcons.checkCircle(),
            color: AppColors.kPrimary,
            title:
                '${_stockRequests.where((r) => '${r['status']}'.toUpperCase() == 'APPROVED' || '${r['status']}'.toUpperCase() == 'PARTIALLY_APPROVED').length} Request${_stockRequests.where((r) => '${r['status']}'.toUpperCase() == 'APPROVED').length == 1 ? '' : 's'} Approved by Auditor',
            subtitle:
                'Your stock request has been approved and is being prepared at central store.',
            onTap: () => _go(BranchStorekeeperSection.requests),
          ),

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
    final incoming = _incomingDispatches
        .where((d) => '${d['status']}' == 'IN_TRANSIT')
        .length;
    return _Page(
      title: 'Receive Goods',
      subtitle:
          'Scan supplier deliveries, confirm central dispatches, and update branch stock.',
      actions: [
        _RefreshButton(onPressed: _loadAll),
        OutlinedButton.icon(
          onPressed: _exportDispatches,
          icon: Icon(PhosphorIcons.download()),
          label: const Text('Export Delivery PDF'),
        ),
      ],
      children: [
        _StatGrid(cards: [
          _StatCardData('Incoming', '${_incomingDispatches.length}',
              PhosphorIcons.truck(), AppColors.kPrimary),
          _StatCardData('In Transit', '$incoming', PhosphorIcons.clock(),
              AppColors.kWarning),
          _StatCardData('Local Vendors', '${_suppliers.length}',
              PhosphorIcons.buildings(), AppColors.kSuccess),
        ]),
        _branchReceiptHeader(),
        _branchReceivingStation(),
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

  Widget _branchReceiptHeader() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Expanded(
          flex: 2,
          child: Autocomplete<Map<String, dynamic>>(
            key: ValueKey('receive_supplier_${_receiveSupplierId ?? ''}'),
            initialValue: TextEditingValue(
              text: _receiveSupplierId == null
                  ? ''
                  : _supplierLabel(_supplierOptions.firstWhere(
                      (supplier) => '${supplier['id']}' == _receiveSupplierId,
                      orElse: () => <String, dynamic>{},
                    )),
            ),
            displayStringForOption: _supplierLabel,
            optionsBuilder: (value) {
              final query = value.text.trim().toLowerCase();
              return _supplierOptions
                  .where((supplier) =>
                      query.isEmpty ||
                      _supplierSearchText(supplier).contains(query))
                  .take(30);
            },
            onSelected: (supplier) {
              setState(() => _receiveSupplierId = '${supplier['id']}');
              WidgetsBinding.instance
                  .addPostFrameCallback((_) => _focusReceiveScanner());
            },
            fieldViewBuilder:
                (context, controller, focusNode, onFieldSubmitted) {
              return TextField(
                controller: controller,
                focusNode: focusNode,
                decoration: const InputDecoration(
                  labelText: 'Supplier',
                  hintText: 'Search supplier, code, phone or contact',
                  prefixIcon: Icon(Icons.search),
                ),
                onChanged: (_) {
                  if (_receiveSupplierId != null) {
                    setState(() => _receiveSupplierId = null);
                  }
                },
              );
            },
            optionsViewBuilder: (context, onSelected, options) =>
                _SupplierOptionsOverlay(
              options: options.toList(),
              onSelected: onSelected,
              labelFor: _supplierLabel,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: TextField(
            controller: _receiveInvoiceCtrl,
            decoration: const InputDecoration(labelText: 'Invoice #'),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: TextField(
            controller: _receiveDeliveryNoteCtrl,
            decoration: const InputDecoration(labelText: 'Delivery Note'),
          ),
        ),
      ]),
      const SizedBox(height: 12),
      Row(children: [
        OutlinedButton.icon(
          onPressed: _receiveLoadingPo ? null : _loadBranchReceiptFromPo,
          icon: _receiveLoadingPo
              ? const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Icon(PhosphorIcons.fileText(), size: 16),
          label: Text(_receiveLoadingPo ? 'Loading...' : 'Load from PO'),
        ),
        const SizedBox(width: 10),
        if (_receivePoId != null)
          Chip(
            avatar: const Icon(Icons.link, size: 16),
            label: Text('Linked: ${_receivePoNumber ?? _receivePoId}'),
            onDeleted: () => setState(() {
              _receivePoId = null;
              _receivePoNumber = null;
            }),
          )
        else
          const Text(
            "Auto-load a branch PO's supplier & items into this receipt",
            style: TextStyle(fontSize: 12, color: AppColors.kTextSecondary),
          ),
      ]),
    ]);
  }

  Widget _branchReceivingStation() {
    return LayoutBuilder(builder: (context, constraints) {
      final form = _branchReceiptFormCard();
      final session = _branchReceiptSessionCard();
      if (constraints.maxWidth < 980) {
        return Column(children: [
          form,
          const SizedBox(height: 16),
          session,
        ]);
      }
      return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(child: form),
        const SizedBox(width: 16),
        Expanded(child: session),
      ]);
    });
  }

  Widget _branchReceiptFormCard() {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment(
                value: true,
                label: Text('Scanner'),
                icon: Icon(Icons.qr_code_scanner),
              ),
              ButtonSegment(
                value: false,
                label: Text('Manual'),
                icon: Icon(Icons.search),
              ),
            ],
            selected: {_receiveScannerMode},
            onSelectionChanged: (value) {
              setState(() => _receiveScannerMode = value.first);
              WidgetsBinding.instance
                  .addPostFrameCallback((_) => _focusReceiveScanner());
            },
          ),
          const SizedBox(height: 16),
          if (_receiveScannerMode) ...[
            _scannerStatusBanner(),
            const SizedBox(height: 12),
            TextField(
              controller: _receiveBarcodeCtrl,
              focusNode: _receiveScannerFocus,
              autofocus: true,
              enabled: !_receiveScanning,
              textInputAction: TextInputAction.done,
              inputFormatters: [
                FilteringTextInputFormatter.deny(RegExp(r'[\r\n\t]')),
              ],
              onChanged: (value) {
                if (value.contains('\n') || value.contains('\r')) {
                  _scanBranchReceiptBarcode();
                }
              },
              onSubmitted: (_) => _scanBranchReceiptBarcode(),
              decoration: InputDecoration(
                labelText: 'Scan barcode or enter SKU',
                prefixIcon: const Icon(Icons.qr_code_2),
                suffixIcon: IconButton(
                  onPressed:
                      _receiveScanning ? null : _scanBranchReceiptBarcode,
                  icon: _receiveScanning
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.add),
                ),
              ),
            ),
          ] else ...[
            TextField(
              controller: _receiveManualSearchCtrl,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _searchReceiveManual(),
              decoration: InputDecoration(
                labelText: 'Search item name or SKU',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  onPressed: _searchReceiveManual,
                  icon: const Icon(Icons.search),
                ),
              ),
            ),
            const SizedBox(height: 10),
            ..._receiveManualResults.take(8).map((item) => ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text('${item['item_name'] ?? item['name'] ?? 'Item'}'),
                  subtitle: Text(_catalogSku(item)),
                  trailing: IconButton(
                    icon: const Icon(Icons.add),
                    onPressed: () => _addReceiveLine(item, viaScan: false),
                  ),
                )),
          ],
          const SizedBox(height: 12),
          TextField(
            controller: _receiveRemarksCtrl,
            decoration: const InputDecoration(labelText: 'Remarks'),
          ),
        ]),
      ),
    );
  }

  Widget _scannerStatusBanner() {
    final received = _receiveLines.fold<num>(
      0,
      (sum, line) => sum + _num(line['quantity']),
    );
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFBFDBFE)),
      ),
      child: Row(children: [
        Icon(
          _receiveScanning ? Icons.sync : Icons.qr_code_scanner,
          color: AppColors.kPrimary,
          size: 18,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            _receiveScanStatus,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.kPrimary,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        if (_receiveLastScan != null)
          Text(
            _receiveLastScan!,
            style: const TextStyle(
              color: AppColors.kTextSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        const SizedBox(width: 12),
        Chip(label: Text('${_receiveLines.length} lines')),
        const SizedBox(width: 6),
        Chip(label: Text('${_qtyText(received)} received')),
      ]),
    );
  }

  Widget _branchReceiptSessionCard() {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Receiving Session',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Review scanned items before posting to branch stock',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.kTextSecondary,
                    ),
                  ),
                ],
              ),
            ),
            FilledButton.icon(
              onPressed:
                  _receiveSubmitting ? null : _submitBranchSupplierReceipt,
              icon: _receiveSubmitting
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save, size: 16),
              label: const Text('Post Receipt'),
            ),
          ]),
          const SizedBox(height: 14),
          if (_receiveLines.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: Colors.grey.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: const Center(child: Text('No items scanned yet')),
            )
          else
            Column(
              children: _receiveLines
                  .asMap()
                  .entries
                  .map((entry) => _receiveLineTile(entry.key, entry.value))
                  .toList(),
            ),
        ]),
      ),
    );
  }

  Widget _receiveLineTile(int index, Map<String, dynamic> line) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade200),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.kPrimary.withValues(alpha: .08),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            line['added_via'] == 'scan'
                ? Icons.qr_code_scanner
                : PhosphorIcons.package(),
            color: AppColors.kPrimary,
            size: 20,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${line['item_name'] ?? 'Item'}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 3),
              Text(
                '${line['item_sku'] ?? ''} | ${line['unit_of_measure'] ?? 'units'} | ${_money(_num(line['unit_price']))}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.kTextSecondary,
                ),
              ),
            ],
          ),
        ),
        SizedBox(
          width: 96,
          child: TextFormField(
            initialValue: _qtyText(line['quantity']),
            keyboardType: TextInputType.number,
            textAlign: TextAlign.right,
            decoration: const InputDecoration(labelText: 'Qty'),
            onChanged: (value) {
              line['quantity'] = num.tryParse(value) ?? 0;
              setState(() {});
            },
          ),
        ),
        const SizedBox(width: 6),
        IconButton(
          tooltip: 'Remove',
          onPressed: () => _removeReceiveLine(index),
          icon: Icon(PhosphorIcons.trash()),
        ),
      ]),
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
          icon: Icon(PhosphorIcons.clipboardText()),
          label: const Text('Count Sheet'),
        ),
        OutlinedButton.icon(
          onPressed: () => _downloadStockTakeReport(_selectedStockTakeId!),
          icon: Icon(PhosphorIcons.filePdf()),
          label: const Text('Report (PDF)'),
        ),
        OutlinedButton.icon(
          onPressed: () => _downloadStockTakeWorkbook(_selectedStockTakeId!),
          icon: Icon(PhosphorIcons.fileSpreadsheet()),
          label: const Text('Excel'),
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
          child: _stockTakeWorksheetGrid(editable),
        ),
      ],
    );
  }

  Widget _stockTakeWorksheetGrid(bool editable) {
    final counted = _stockTakeItems
        .where((item) => _actualIncludingDraft(item) != null)
        .length;
    if (_stockTakeItems.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: Colors.grey.shade50,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: const Center(child: Text('No items in this stock take')),
      );
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Expanded(
          child: Text(
            '$counted / ${_stockTakeItems.length} counted',
            style: const TextStyle(
                color: AppColors.kTextSecondary, fontWeight: FontWeight.w700),
          ),
        ),
        if (editable)
          FilledButton.icon(
            onPressed: _saveStockTakeWorksheetCounts,
            icon: const Icon(Icons.save, size: 16),
            label: const Text('Save Counts'),
          ),
      ]),
      const SizedBox(height: 12),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: SizedBox(
          width: 1840,
          child: Column(children: [
            _stockTakeWorksheetHeader(),
            ..._stockTakeItems.map(
              (item) => _stockTakeWorksheetRow(item, editable),
            ),
          ]),
        ),
      ),
    ]);
  }

  Widget _stockTakeWorksheetHeader() {
    const style = TextStyle(
      fontSize: 11,
      fontWeight: FontWeight.w900,
      color: AppColors.kTextSecondary,
    );
    return Container(
      height: 38,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: AppColors.kSurface,
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Row(children: [
        SizedBox(width: 310, child: Text('ITEM', style: style)),
        SizedBox(width: 20),
        SizedBox(width: 190, child: Text('SKU', style: style)),
        SizedBox(width: 20),
        SizedBox(
            width: 92,
            child: Text('OPENING', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 20),
        SizedBox(
            width: 92,
            child: Text('ADDED', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 20),
        SizedBox(
            width: 92,
            child: Text('ISSUED', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 20),
        SizedBox(
            width: 110,
            child: Text('SYSTEM', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 20),
        SizedBox(width: 170, child: Text('PHYSICAL COUNT', style: style)),
        SizedBox(width: 20),
        SizedBox(
            width: 120,
            child: Text('VARIANCE', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 20),
        SizedBox(
            width: 120,
            child: Text('COST', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 20),
        SizedBox(width: 340, child: Text('VARIANCE NOTES', style: style)),
      ]),
    );
  }

  Widget _stockTakeWorksheetRow(Map<String, dynamic> item, bool editable) {
    final system =
        _num(item['system_closing_stock'] ?? item['system_quantity']);
    final actual = _actualIncludingDraft(item);
    final variance = actual == null ? 0 : actual - system;
    final needsReason = actual != null && variance != 0;
    final color = actual == null
        ? Colors.transparent
        : variance == 0
            ? Colors.green.withValues(alpha: .035)
            : Colors.orange.withValues(alpha: .055);
    final itemMap = item['item'] is Map ? item['item'] as Map : null;
    final name = itemMap?['name'] ??
        itemMap?['item_name'] ??
        item['item_name'] ??
        item['name'] ??
        item['item_sku'];

    return Container(
      constraints: const BoxConstraints(minHeight: 58),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: color,
        border: Border(
          top: BorderSide(color: Colors.grey.shade200),
        ),
      ),
      child: Row(children: [
        SizedBox(
          width: 310,
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('$name',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 2),
            Text('${item['category'] ?? itemMap?['category'] ?? ''}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    color: AppColors.kTextSecondary, fontSize: 11)),
          ]),
        ),
        const SizedBox(width: 20),
        SizedBox(
            width: 190,
            child: Text('${item['item_sku'] ?? item['sku'] ?? '—'}',
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12))),
        const SizedBox(width: 20),
        _worksheetNumberCell(_num(item['opening_stock'])),
        const SizedBox(width: 20),
        _worksheetNumberCell(_num(item['additions'])),
        const SizedBox(width: 20),
        _worksheetNumberCell(_num(item['issued_quantity'])),
        const SizedBox(width: 20),
        SizedBox(
          width: 110,
          child: Text(_qtyText(system),
              textAlign: TextAlign.right,
              style: const TextStyle(fontWeight: FontWeight.w800)),
        ),
        const SizedBox(width: 20),
        SizedBox(
          width: 170,
          child: _StockTakeInlineInput(
            key:
                ValueKey('${item['id'] ?? item['item_sku']}-storekeeper-count'),
            initialValue: _actual(item) == null ? '' : _qtyText(_actual(item)!),
            enabled: editable,
            hintText: 'Count',
            keyboardType: TextInputType.number,
            onChanged: (value) => setState(() {
              item['_draft_counted_quantity'] = value;
            }),
          ),
        ),
        const SizedBox(width: 20),
        SizedBox(
          width: 120,
          child: Align(
            alignment: Alignment.centerRight,
            child: _stockTakeVarianceBadge(actual == null ? null : variance),
          ),
        ),
        const SizedBox(width: 20),
        SizedBox(
          width: 120,
          child: Text(_money(_num(item['cost_price'] ?? item['unit_cost'])),
              textAlign: TextAlign.right, style: const TextStyle(fontSize: 12)),
        ),
        const SizedBox(width: 20),
        SizedBox(
          width: 340,
          child: _StockTakeInlineInput(
            key: ValueKey('${item['id'] ?? item['item_sku']}-storekeeper-note'),
            initialValue: _reasonIncludingDraft(item),
            enabled: editable,
            hintText: needsReason ? 'Required for variance' : 'Optional',
            onChanged: (value) {
              item['_draft_variance_reason'] = value;
            },
          ),
        ),
      ]),
    );
  }

  Widget _stockTakeVarianceBadge(num? variance) {
    if (variance == null) {
      return const Text(
        '-',
        textAlign: TextAlign.right,
        style: TextStyle(
          color: AppColors.kTextSecondary,
          fontWeight: FontWeight.w800,
        ),
      );
    }
    final isZero = variance == 0;
    final isPositive = variance > 0;
    final color = isZero
        ? AppColors.kSuccess
        : isPositive
            ? Colors.blue
            : AppColors.kWarning;
    final label =
        isZero ? '0' : '${isPositive ? '+' : ''}${_qtyText(variance)}';
    return Container(
      constraints: const BoxConstraints(minWidth: 68),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .10),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: .35)),
      ),
      child: Text(
        label,
        textAlign: TextAlign.center,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w900,
          fontSize: 12,
        ),
      ),
    );
  }

  Widget _worksheetNumberCell(num value) {
    return SizedBox(
      width: 92,
      child: Text(_qtyText(value),
          textAlign: TextAlign.right, style: const TextStyle(fontSize: 12)),
    );
  }

  Widget _purchaseOrdersPage() {
    final supplierOptions = _uniqueRows(_purchaseOrders, (po) {
      final direct = '${po['supplier_id'] ?? po['supplier']?['id'] ?? ''}';
      return direct == 'null' ? '' : direct;
    });
    final filtered = _purchaseOrders.where((po) {
      final status = '${po['status'] ?? ''}'.toUpperCase();
      final supplierId = '${po['supplier_id'] ?? po['supplier']?['id'] ?? ''}';
      final statusOk = _statusFilter == 'ALL' || status == _statusFilter;
      final supplierOk = _poSupplierFilter == null ||
          _poSupplierFilter!.isEmpty ||
          supplierId == _poSupplierFilter;
      final q = _search.toLowerCase();
      return statusOk &&
          supplierOk &&
          (q.isEmpty ||
              '${po['po_number'] ?? ''}'.toLowerCase().contains(q) ||
              '${po['supplier_name'] ?? po['supplier']?['name'] ?? ''}'
                  .toLowerCase()
                  .contains(q));
    }).toList();
    final pending = _purchaseOrders.where((po) {
      final status = '${po['status'] ?? ''}'.toLowerCase();
      return status == 'pending' || status == 'draft';
    }).length;
    final open = filtered.where((po) {
      final status = '${po['status'] ?? ''}'.toLowerCase();
      return !const {'received', 'cancelled', 'closed'}.contains(status);
    }).length;
    final totalValue = filtered.fold<num>(
      0,
      (sum, po) => sum + _num(po['total_amount'] ?? po['total']),
    );
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
          _StatCardData('Open POs', '$open', PhosphorIcons.fileText(),
              AppColors.kPrimary),
          _StatCardData('Pending Approval', '$pending', PhosphorIcons.clock(),
              Colors.orange),
          _StatCardData(
              'Approved',
              '${_purchaseOrders.where((po) => '${po['status']}'.toUpperCase() == 'APPROVED').length}',
              PhosphorIcons.checkCircle(),
              AppColors.kSuccess),
          _StatCardData('Total Value', _money(totalValue),
              PhosphorIcons.currencyDollar(), Colors.green),
        ]),
        _SectionCard(
          title: 'Filters',
          child: LayoutBuilder(builder: (context, constraints) {
            final compact = constraints.maxWidth < 820;
            return Wrap(
              spacing: 12,
              runSpacing: 12,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                SizedBox(
                  width: compact ? constraints.maxWidth : 520,
                  child: TextField(
                    decoration: const InputDecoration(
                      hintText: 'Search PO, supplier, branch',
                      prefixIcon: Icon(Icons.search),
                    ),
                    onChanged: (value) => setState(() => _search = value),
                  ),
                ),
                SizedBox(
                  width: compact ? constraints.maxWidth : 190,
                  child: _statusDropdown([
                    'ALL',
                    'PENDING',
                    'DRAFT',
                    'APPROVED',
                    'ORDERED',
                    'SENT',
                    'RECEIVED',
                    'CANCELLED'
                  ]),
                ),
                SizedBox(
                  width: compact ? constraints.maxWidth : 260,
                  child: DropdownButtonFormField<String?>(
                    isExpanded: true,
                    initialValue: _poSupplierFilter,
                    decoration: const InputDecoration(labelText: 'Supplier'),
                    items: [
                      const DropdownMenuItem<String?>(
                        value: null,
                        child: Text('All suppliers'),
                      ),
                      ...supplierOptions.map((po) {
                        final supplierId =
                            '${po['supplier_id'] ?? po['supplier']?['id'] ?? ''}';
                        final supplierName =
                            '${po['supplier_name'] ?? po['supplier']?['name'] ?? 'Supplier'}';
                        return DropdownMenuItem<String?>(
                          value: supplierId,
                          child: Text(
                            supplierName,
                            overflow: TextOverflow.ellipsis,
                          ),
                        );
                      }),
                    ],
                    onChanged: (value) =>
                        setState(() => _poSupplierFilter = value),
                  ),
                ),
              ],
            );
          }),
        ),
        _SectionCard(
          title: 'Purchase Orders',
          child: _RecordList(
            emptyText: 'No purchase orders found',
            children: filtered.map((po) {
              final status = '${po['status'] ?? ''}';
              final statusLower = status.toLowerCase();
              return _RecordTile(
                icon: PhosphorIcons.fileText(),
                title: '${po['po_number'] ?? po['id']}',
                subtitle:
                    '${po['supplier_name'] ?? po['supplier']?['name'] ?? 'Supplier'} | ${_date(po['created_at'] ?? po['po_date'])} | Expected ${_date(po['expected_delivery'] ?? po['expected_delivery_date'])}',
                trailing: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    _StatusChip(status, success: status == 'RECEIVED'),
                    Text(
                      _money(_num(po['total_amount'] ?? po['total'])),
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
                actions: [
                  OutlinedButton(
                    onPressed: () => _showJsonDetail('Purchase Order', po),
                    child: const Text('View'),
                  ),
                  if (statusLower == 'pending' || statusLower == 'draft')
                    FilledButton(
                      onPressed: () => _poAction(po, 'approve'),
                      child: const Text('Approve'),
                    ),
                  if (const {'APPROVED', 'ORDERED', 'SENT'}
                      .contains(status.toUpperCase()))
                    OutlinedButton(
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

  Widget _movementGroup(
      String label, List<Map<String, dynamic>> rows, Color color, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 6),
              Text('$label (${rows.length})',
                  style: TextStyle(fontWeight: FontWeight.w800, color: color)),
            ],
          ),
          const SizedBox(height: 6),
          if (rows.isEmpty)
            const Padding(
              padding: EdgeInsets.only(left: 22, bottom: 4),
              child: Text('No items', style: TextStyle(color: Colors.grey)),
            )
          else
            ...rows.take(8).map((row) {
              final item = Map<String, dynamic>.from((row['item'] as Map?) ?? {});
              final sku = '${row['item_sku'] ?? row['sku'] ?? item['sku'] ?? ''}';
              return _RecordTile(
                icon: icon,
                title: _itemName(row),
                subtitle:
                    '$sku | On hand ${_num(row['quantity']).toStringAsFixed(0)}'
                    ' | Moved ${_num(row['movement_quantity']).toStringAsFixed(0)}',
                trailing: Text(
                  _money(_num(row['stock_value'])),
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _reportsPage() {
    final analyticsSummary = Map<String, dynamic>.from(
      (_inventoryAnalytics['summary'] as Map?) ?? const {},
    );
    final departmentRows = _listFrom(
      _inventoryAnalytics['department_consumption'] ?? _departmentConsumption,
    );
    final lowStockRows = _listFrom(_inventoryAnalytics['low_stock'] ?? []);
    final deadStockRows = _listFrom(_inventoryAnalytics['dead_stock'] ?? []);
    final fastRows = _listFrom(_inventoryAnalytics['fast_moving'] ?? []);
    final slowRows = _listFrom(_inventoryAnalytics['slow_moving'] ?? []);
    const periodLabels = {
      'today': 'Today',
      'week': 'This Week',
      'month': 'This Month',
      'year': 'This Year',
    };
    return _Page(
      title: 'Branch Store Reports',
      subtitle:
          'Inventory valuation, department consumption, movement analytics, stock-take exceptions, and exports.',
      actions: [_RefreshButton(onPressed: _loadAll)],
      children: [
        _SectionCard(
          title: 'Reporting Period',
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              ...periodLabels.entries.map((entry) => ChoiceChip(
                    label: Text(entry.value),
                    selected: _analyticsPeriod == entry.key,
                    onSelected: _analyticsLoading
                        ? null
                        : (_) => _reloadAnalytics(entry.key),
                  )),
              if (_analyticsLoading)
                const Padding(
                  padding: EdgeInsets.only(left: 8),
                  child: SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2)),
                ),
            ],
          ),
        ),
        _StatGrid(cards: [
          _StatCardData('Stock SKUs', '${_stock.length}',
              PhosphorIcons.package(), AppColors.kPrimary),
          _StatCardData(
              'Stock Value',
              _money(_num(analyticsSummary['total_stock_value'])),
              PhosphorIcons.coins(),
              Colors.teal),
          _StatCardData(
              'Consumption',
              _money(_num(analyticsSummary['total_consumption_cost'])),
              PhosphorIcons.forkKnife(),
              AppColors.kSuccess),
          _StatCardData(
              'Exceptions',
              '${_num(analyticsSummary['low_stock_count']) + _num(analyticsSummary['out_of_stock_count']) + _num(analyticsSummary['dead_stock_count'])}',
              PhosphorIcons.warning(),
              AppColors.kWarning),
        ]),
        _SectionCard(
          title: 'Inventory Analytics',
          child: Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _InfoPill(
                  'Low stock', '${analyticsSummary['low_stock_count'] ?? 0}'),
              _InfoPill('Out of stock',
                  '${analyticsSummary['out_of_stock_count'] ?? 0}'),
              _InfoPill('Fast moving',
                  '${analyticsSummary['fast_moving_count'] ?? 0}'),
              _InfoPill('Slow moving',
                  '${analyticsSummary['slow_moving_count'] ?? 0}'),
              _InfoPill(
                  'Dead stock', '${analyticsSummary['dead_stock_count'] ?? 0}'),
              _InfoPill('Pending stock takes',
                  '${analyticsSummary['pending_stock_take_count'] ?? 0}'),
            ],
          ),
        ),
        _SectionCard(
          title: 'Movement Analysis (${periodLabels[_analyticsPeriod] ?? ''})',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _movementGroup('Fast moving', fastRows, AppColors.kSuccess,
                  PhosphorIcons.trendUp()),
              _movementGroup('Slow moving', slowRows, AppColors.kWarning,
                  PhosphorIcons.chartLine()),
              _movementGroup('Dead stock', deadStockRows, AppColors.kError,
                  PhosphorIcons.clockCounterClockwise()),
            ],
          ),
        ),
        _SectionCard(
          title: 'Department Consumption',
          child: _RecordList(
            emptyText: 'No department consumption found for the period',
            children: departmentRows.take(8).map((row) {
              final account =
                  Map<String, dynamic>.from((row['account'] as Map?) ?? row);
              final code = '${account['department_code'] ?? row['department_code'] ?? ''}';
              final name =
                  '${account['department_name'] ?? row['department_name'] ?? row['department_code'] ?? 'Department'}';
              return _RecordTile(
                icon: PhosphorIcons.buildings(),
                title: name,
                subtitle:
                    '${row['movement_count'] ?? row['movement_type'] ?? 'movement'}'
                    ' | Qty ${_num(row['quantity']).toStringAsFixed(2)}',
                trailing: Text(
                  _money(_num(row['total_cost'])),
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                actions: [
                  if (code.isNotEmpty)
                    TextButton(
                      onPressed: () => _showDepartmentHistory(code, name),
                      child: const Text('History'),
                    ),
                  TextButton(
                    onPressed: () => _showJsonDetail('Consumption', row),
                    child: const Text('View'),
                  )
                ],
              );
            }).toList(),
          ),
        ),
        _SectionCard(
          title: 'Stock Exceptions',
          child: _RecordList(
            emptyText: 'No stock exceptions found',
            children: [
              ...lowStockRows.take(5).map((row) => _RecordTile(
                    icon: PhosphorIcons.warning(),
                    title: _itemName(row),
                    subtitle: 'Low stock | ${row['item_sku'] ?? row['sku']}',
                    trailing: Text(_qty(row)),
                    actions: [
                      TextButton(
                        onPressed: () => _showJsonDetail('Low Stock', row),
                        child: const Text('View'),
                      )
                    ],
                  )),
              ...deadStockRows.take(5).map((row) => _RecordTile(
                    icon: PhosphorIcons.clockCounterClockwise(),
                    title: _itemName(row),
                    subtitle: 'Dead stock | ${row['item_sku'] ?? row['sku']}',
                    trailing: Text(_qty(row)),
                    actions: [
                      TextButton(
                        onPressed: () => _showJsonDetail('Dead Stock', row),
                        child: const Text('View'),
                      )
                    ],
                  )),
            ],
          ),
        ),
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

  Widget _notificationsPage() {
    return _Page(
      title: 'Notifications',
      subtitle:
          'Review system alerts, approvals, stock exceptions, and updates.',
      actions: [
        FilledButton.icon(
          onPressed: () => showAppNotificationPanel(context, ref),
          icon: Icon(PhosphorIcons.bell()),
          label: const Text('Open Notifications'),
        ),
      ],
      children: [
        _SectionCard(
          title: 'Notification Center',
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(PhosphorIcons.bell(), color: AppColors.kPrimary, size: 28),
                const SizedBox(height: 12),
                const Text(
                  'Branch store notifications open in the notification panel.',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Use this area for stock alerts, requisition updates, receipt approvals, and audit messages.',
                  style: TextStyle(color: AppColors.kTextSecondary),
                ),
              ],
            ),
          ),
        ),
      ],
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

  ({String start, String end}) _periodRange(String period) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    String fmt(DateTime d) => d.toIso8601String().split('T').first;
    switch (period) {
      case 'today':
        return (start: fmt(today), end: fmt(today));
      case 'week':
        return (start: fmt(today.subtract(Duration(days: today.weekday - 1))), end: fmt(today));
      case 'year':
        return (start: fmt(DateTime(now.year, 1, 1)), end: fmt(today));
      case 'month':
      default:
        return (start: fmt(DateTime(now.year, now.month, 1)), end: fmt(today));
    }
  }

  Future<void> _reloadAnalytics(String period) async {
    setState(() {
      _analyticsPeriod = period;
      _analyticsLoading = true;
    });
    final range = _periodRange(period);
    try {
      final results = await Future.wait([
        _safe(
            () => _repo.enterpriseInventoryAnalytics(
                startDate: range.start, endDate: range.end),
            <String, dynamic>{}),
        _safe(
            () => _repo.departmentConsumption(
                startDate: range.start, endDate: range.end),
            <Map<String, dynamic>>[]),
      ]);
      if (!mounted) return;
      setState(() {
        _inventoryAnalytics = results[0] as Map<String, dynamic>;
        _departmentConsumption =
            List<Map<String, dynamic>>.from(results[1] as List);
        _analyticsLoading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _analyticsLoading = false);
      _showSnack('Analytics refresh failed: ${_errorText(error)}', error: true);
    }
  }

  Future<void> _showDepartmentHistory(
      String departmentCode, String departmentName) async {
    final range = _periodRange(_analyticsPeriod);
    List<Map<String, dynamic>> rows;
    try {
      rows = await _repo.departmentIssueJournals(
        departmentCode: departmentCode,
        startDate: range.start,
        endDate: range.end,
      );
    } catch (error) {
      _showSnack('Could not load history: ${_errorText(error)}', error: true);
      return;
    }
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('$departmentName — Issue History'),
        content: SizedBox(
          width: 560,
          child: rows.isEmpty
              ? const Text('No issues recorded for this period.')
              : _RecordList(
                  emptyText: 'No issues recorded',
                  children: rows.take(60).map((row) {
                    final event = '${row['event_name'] ?? ''}'.trim();
                    final paxValue = _num(row['pax_count']);
                    final meta = [
                      if (row['shift_code'] != null &&
                          '${row['shift_code']}'.isNotEmpty)
                        'Shift ${row['shift_code']}',
                      if (event.isNotEmpty) event,
                      if (paxValue > 0) '${paxValue.toStringAsFixed(0)} pax',
                    ].join(' · ');
                    return _RecordTile(
                      icon: PhosphorIcons.trendDown(),
                      title: _itemName(row),
                      subtitle: [
                        _date(row['created_at']),
                        if (meta.isNotEmpty) meta,
                      ].join(' | '),
                      trailing: Text(
                        '-${_num(row['quantity']).abs().toStringAsFixed(0)}'
                        '  ${_money(_num(row['total_cost']))}',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    );
                  }).toList(),
                ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Future<void> _downloadStockTakeReport(String id) async {
    try {
      final file = await _repo.downloadStockTakeReportPdf(id);
      _showSnack('Stock take report downloaded: ${file.path}');
    } catch (error) {
      _showSnack('Report download failed: $error', error: true);
    }
  }

  Future<void> _downloadStockTakeWorkbook(String id) async {
    try {
      final file = await _repo.downloadStockTakeReportWorkbook(id);
      _showSnack('Stock take workbook downloaded: ${file.path}');
    } catch (error) {
      _showSnack('Workbook download failed: $error', error: true);
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
    bool pickItems = false;
    final selectedSkus = <String>{};
    String itemSearch = '';
    showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setDialogState) {
        final catalog = _catalog.isNotEmpty ? _catalog : _stockOptions;
        final filtered = itemSearch.trim().isEmpty
            ? catalog
            : catalog
                .where((item) =>
                    _itemSearchText(item).contains(itemSearch.trim().toLowerCase()))
                .toList();
        return AlertDialog(
          title: const Text('Start Daily Stock Take'),
          content: SizedBox(
            width: 480,
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
                const SizedBox(height: 4),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Pick specific items'),
                  subtitle: Text(pickItems
                      ? '${selectedSkus.length} item(s) selected'
                      : 'Off = include all items for this type'),
                  value: pickItems,
                  onChanged: (value) => setDialogState(() => pickItems = value),
                ),
                if (pickItems) ...[
                  TextField(
                    decoration: const InputDecoration(
                      labelText: 'Search master inventory',
                      prefixIcon: Icon(Icons.search),
                      isDense: true,
                    ),
                    onChanged: (value) => setDialogState(() => itemSearch = value),
                  ),
                  const SizedBox(height: 8),
                  if (selectedSkus.isNotEmpty)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: () =>
                            setDialogState(() => selectedSkus.clear()),
                        icon: const Icon(Icons.clear_all, size: 18),
                        label: const Text('Clear selection'),
                      ),
                    ),
                  SizedBox(
                    height: 260,
                    child: filtered.isEmpty
                        ? const Center(child: Text('No catalog items found'))
                        : ListView.builder(
                            itemCount: filtered.length,
                            itemBuilder: (context, index) {
                              final item = filtered[index];
                              final sku = _catalogOptionSku(item);
                              if (sku.isEmpty) return const SizedBox.shrink();
                              return CheckboxListTile(
                                dense: true,
                                contentPadding: EdgeInsets.zero,
                                value: selectedSkus.contains(sku),
                                title: Text(_itemName(item),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis),
                                subtitle: Text(
                                    '$sku${item['category'] != null ? ' · ${item['category']}' : ''}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis),
                                onChanged: (checked) => setDialogState(() {
                                  if (checked == true) {
                                    selectedSkus.add(sku);
                                  } else {
                                    selectedSkus.remove(sku);
                                  }
                                }),
                              );
                            },
                          ),
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
              onPressed: pickItems && selectedSkus.isEmpty
                  ? null
                  : () async {
                Navigator.pop(context);
                try {
                  final result = await _repo.createStockTake(
                    storeType: storeType,
                    outletCode: storeType == 'bar_store' ? outletCode : null,
                    itemSkus: pickItems ? selectedSkus.toList() : null,
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

  num? _actual(Map<String, dynamic> item) {
    final value = item['physical_quantity'] ??
        item['counted_quantity'] ??
        item['actual_quantity'];
    if (value == null) return null;
    if (value is num) return value;
    return num.tryParse('$value');
  }

  num? _actualIncludingDraft(Map<String, dynamic> item) {
    final draft = item['_draft_counted_quantity'];
    if (draft != null && '$draft'.trim().isNotEmpty) {
      return num.tryParse('$draft');
    }
    return _actual(item);
  }

  String _reasonIncludingDraft(Map<String, dynamic> item) {
    final draft = '${item['_draft_variance_reason'] ?? ''}'.trim();
    if (draft.isNotEmpty) return draft;
    return '${item['variance_reason'] ?? item['reason'] ?? item['notes'] ?? ''}'
        .trim();
  }

  Future<void> _saveStockTakeWorksheetCounts() async {
    final payload = <Map<String, dynamic>>[];
    for (final item in _stockTakeItems) {
      final physical = _actualIncludingDraft(item);
      if (physical == null) continue;
      final systemClosing =
          _num(item['system_closing_stock'] ?? item['system_quantity']);
      final variance = physical - systemClosing;
      final reason = _reasonIncludingDraft(item);
      if (variance != 0 && reason.isEmpty) {
        _showSnack(
          'Variance reason required for ${item['item']?['name'] ?? item['item_name'] ?? item['item_sku']}',
          error: true,
        );
        return;
      }
      payload.add({
        'id': item['id'],
        'item_sku': item['item_sku'],
        'counted_quantity': physical,
        'physical_quantity': physical,
        if (reason.isNotEmpty) 'variance_reason': reason,
        if (reason.isNotEmpty) 'notes': reason,
      });
    }
    if (payload.isEmpty) {
      _showSnack('Enter at least one physical count', error: true);
      return;
    }
    try {
      await _repo.updateStockTake(_selectedStockTakeId!, payload);
      await _loadStockTakeDetail(_selectedStockTakeId!);
      _showSnack('Worksheet counts saved');
    } catch (error) {
      _showSnack('Count save failed: $error', error: true);
    }
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
                Autocomplete<Map<String, dynamic>>(
                  displayStringForOption: (item) =>
                      '${_itemName(item)} - ${_catalogOptionSku(item)}',
                  optionsBuilder: (value) {
                    final query = value.text.trim().toLowerCase();
                    return _catalogOptions
                        .where((item) =>
                            query.isEmpty ||
                            _itemSearchText(item).contains(query))
                        .take(40);
                  },
                  onSelected: (item) =>
                      setDialogState(() => sku = _catalogOptionSku(item)),
                  fieldViewBuilder:
                      (context, controller, focusNode, onFieldSubmitted) {
                    return TextField(
                      controller: controller,
                      focusNode: focusNode,
                      decoration: const InputDecoration(
                        labelText: 'Search item',
                        hintText: 'Type item name, SKU, barcode or category',
                        prefixIcon: Icon(Icons.search),
                      ),
                      onChanged: (_) {
                        if (sku != null) setDialogState(() => sku = null);
                      },
                    );
                  },
                  optionsViewBuilder: (context, onSelected, options) =>
                      _ItemOptionsOverlay(
                    options: options.toList(),
                    onSelected: onSelected,
                    skuFor: _catalogOptionSku,
                    nameFor: _itemName,
                    qtyFor: _qty,
                    priceFor: (item) =>
                        _num(item['cost_price'] ?? item['unit_price']),
                  ),
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
                        child: Autocomplete<Map<String, dynamic>>(
                          key: ValueKey('po_supplier_${supplierId ?? ''}'),
                          initialValue: TextEditingValue(
                            text: supplierId == null
                                ? ''
                                : _supplierLabel(_supplierOptions.firstWhere(
                                    (supplier) =>
                                        '${supplier['id']}' == supplierId,
                                    orElse: () => <String, dynamic>{},
                                  )),
                          ),
                          displayStringForOption: _supplierLabel,
                          optionsBuilder: (value) {
                            final query = value.text.trim().toLowerCase();
                            return _supplierOptions
                                .where((supplier) =>
                                    query.isEmpty ||
                                    _supplierSearchText(supplier)
                                        .contains(query))
                                .take(30);
                          },
                          onSelected: (supplier) => setDialogState(
                              () => supplierId = '${supplier['id']}'),
                          fieldViewBuilder: (context, controller, focusNode,
                              onFieldSubmitted) {
                            return TextField(
                              controller: controller,
                              focusNode: focusNode,
                              decoration: const InputDecoration(
                                labelText: 'Search supplier',
                                hintText:
                                    'Type supplier name, code, phone or contact',
                                prefixIcon: Icon(Icons.search),
                              ),
                              onChanged: (_) {
                                if (supplierId != null) {
                                  setDialogState(() => supplierId = null);
                                }
                              },
                            );
                          },
                          optionsViewBuilder: (context, onSelected, options) =>
                              _SupplierOptionsOverlay(
                            options: options.toList(),
                            onSelected: onSelected,
                            labelFor: _supplierLabel,
                          ),
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
                    priceEnabled: false,
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
                          'items': lines
                              .map((line) => {
                                    ...line,
                                    'unit_price': 0,
                                  })
                              .toList(),
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
    final date = TextEditingController(
        text: DateTime.now().toIso8601String().substring(0, 10));
    final revenue = TextEditingController(text: '0');
    final lines = <Map<String, dynamic>>[];
    showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setDialogState) {
        final totalQuantity =
            lines.fold<num>(0, (sum, line) => sum + _num(line['quantity']));
        final totalCost = lines.fold<num>(
          0,
          (sum, line) =>
              sum + (_num(line['quantity']) * _num(line['unit_price'])),
        );
        return AlertDialog(
          title: const Text('Issue Items to Kitchen'),
          content: SizedBox(
            width: 760,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _LineEditor(
                    catalog: _trackableOptions,
                    lines: lines,
                    onChanged: () => setDialogState(() {}),
                    quantityKey: 'quantity',
                  ),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                      child: TextField(
                        controller: date,
                        decoration: const InputDecoration(
                          labelText: 'Issue Date',
                          hintText: 'YYYY-MM-DD',
                          prefixIcon: Icon(Icons.calendar_today),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: revenue,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Expected Revenue',
                          prefixIcon: Icon(Icons.payments_outlined),
                        ),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _InfoPill('Lines', '${lines.length}'),
                      _InfoPill('Total Qty', _qtyText(totalQuantity)),
                      _InfoPill('Total Cost', _money(totalCost)),
                    ],
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
                        for (final line in lines) {
                          await _repo.createKitchenUsageRecord({
                            'item_sku': line['item_sku'],
                            'received_quantity': _num(line['quantity']),
                            'usage_date': date.text,
                            'unit_cost': _num(line['unit_price']),
                            'expected_revenue': _num(revenue.text),
                          });
                        }
                        await _loadAll();
                        _showSnack('${lines.length} item(s) issued to kitchen');
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

  // Departments that represent a one-off service event and therefore need a
  // name (and, except breakfast, a pax count) recorded against each issue.
  static const _eventDepartments = {
    'buffet': (label: 'Buffet Name', pax: true),
    'outside_catering': (label: 'Event Name', pax: true),
    'accommodation_breakfast': (label: 'Guest / Room', pax: false),
  };

  void _showStockOutForm() {
    final notes = TextEditingController();
    final eventName = TextEditingController();
    final pax = TextEditingController();
    final lines = <Map<String, dynamic>>[];
    String departmentCode = _departmentAccounts.isNotEmpty
        ? '${_departmentAccounts.first['department_code']}'
        : 'main_kitchen';
    String shiftCode = 'A';
    showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setDialogState) {
        final eventConfig = _eventDepartments[departmentCode];
        final eventName0 = eventName.text.trim();
        final eventNameMissing = eventConfig != null && eventName0.isEmpty;
        Map<String, dynamic> stockForLine(Map<String, dynamic> line) {
          return _stockOptions.firstWhere(
            (item) => _optionSku(item) == '${line['item_sku']}',
            orElse: () => <String, dynamic>{},
          );
        }

        final invalidLines = lines.where((line) {
          final stock = stockForLine(line);
          final qty = _num(line['quantity']);
          return stock.isEmpty || qty <= 0 || qty > _num(stock['quantity']);
        }).toList();
        final totalQuantity =
            lines.fold<num>(0, (sum, line) => sum + _num(line['quantity']));
        final departmentOptions = _departmentAccounts.isNotEmpty
            ? _departmentAccounts
            : const [
                {
                  'department_code': 'main_kitchen',
                  'department_name': 'Main Kitchen'
                },
                {
                  'department_code': 'choma_zone_kitchen',
                  'department_name': 'Choma Zone Kitchen'
                },
                {
                  'department_code': 'pastries_kitchen',
                  'department_name': 'Pastries Kitchen'
                },
                {'department_code': 'buffet', 'department_name': 'Buffets'},
                {
                  'department_code': 'outside_catering',
                  'department_name': 'Outside Catering'
                },
                {
                  'department_code': 'accommodation_breakfast',
                  'department_name': 'Accommodation Breakfast'
                },
                {'department_code': 'main_bar', 'department_name': 'Main Bar'},
                {
                  'department_code': 'executive_bar',
                  'department_name': 'Executive Bar'
                },
                {
                  'department_code': 'housekeeping',
                  'department_name': 'Housekeeping & Maintenance'
                },
                {
                  'department_code': 'spa_sauna',
                  'department_name': 'Spa & Sauna'
                },
                {
                  'department_code': 'back_office',
                  'department_name': 'Back Office'
                },
              ];
        return AlertDialog(
          title: const Text('Issue Stock to Department'),
          content: SizedBox(
            width: 680,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _LineEditor(
                    catalog: _stockOptions,
                    lines: lines,
                    onChanged: () => setDialogState(() {}),
                    quantityKey: 'quantity',
                    priceEnabled: false,
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _InfoPill('Lines', '${lines.length}'),
                      _InfoPill('Total Qty', _qtyText(totalQuantity)),
                      if (invalidLines.isNotEmpty)
                        _InfoPill('Invalid', '${invalidLines.length}'),
                    ],
                  ),
                  if (invalidLines.isNotEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 8),
                      child: Text(
                        'Fix quantities that are zero or exceed available stock before issuing.',
                        style: TextStyle(
                          color: AppColors.kError,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  const SizedBox(height: 14),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          isExpanded: true,
                          initialValue: departmentCode,
                          decoration: const InputDecoration(
                            labelText: 'Department',
                            prefixIcon: Icon(Icons.business),
                          ),
                          items: departmentOptions
                              .map((item) => DropdownMenuItem(
                                    value: '${item['department_code']}',
                                    child: Text(
                                      '${item['department_name'] ?? item['department_code']}',
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ))
                              .toList(),
                          onChanged: (value) =>
                              setDialogState(() => departmentCode = value!),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          isExpanded: true,
                          initialValue: shiftCode,
                          decoration: const InputDecoration(
                            labelText: 'Shift',
                            prefixIcon: Icon(Icons.schedule),
                          ),
                          items: const [
                            DropdownMenuItem(
                                value: 'A', child: Text('Shift A')),
                            DropdownMenuItem(
                                value: 'B', child: Text('Shift B')),
                            DropdownMenuItem(
                                value: '', child: Text('No shift')),
                          ],
                          onChanged: (value) =>
                              setDialogState(() => shiftCode = value ?? ''),
                        ),
                      ),
                    ],
                  ),
                  if (eventConfig != null) ...[
                    const SizedBox(height: 12),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          flex: 2,
                          child: TextField(
                            controller: eventName,
                            onChanged: (_) => setDialogState(() {}),
                            decoration: InputDecoration(
                              labelText: '${eventConfig.label} *',
                              prefixIcon: const Icon(Icons.event),
                              errorText:
                                  eventNameMissing ? 'Required' : null,
                            ),
                          ),
                        ),
                        if (eventConfig.pax) ...[
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextField(
                              controller: pax,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                labelText: 'Pax',
                                prefixIcon: Icon(Icons.groups),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                  const SizedBox(height: 12),
                  TextField(
                    controller: notes,
                    minLines: 2,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Notes',
                      prefixIcon: Icon(Icons.notes),
                    ),
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
              onPressed: lines.isEmpty || invalidLines.isNotEmpty || eventNameMissing
                  ? null
                  : () async {
                      Navigator.pop(context);
                      try {
                        final paxValue = int.tryParse(pax.text.trim());
                        for (final line in lines) {
                          await _repo.recordDepartmentIssue({
                            'item_sku': line['item_sku'],
                            'quantity': _num(line['quantity']),
                            'department_code': departmentCode,
                            if (shiftCode.isNotEmpty) 'shift_code': shiftCode,
                            'destination_type':
                                eventConfig != null ? departmentCode : 'department_issue',
                            if (eventConfig != null && eventName0.isNotEmpty)
                              'event_name': eventName0,
                            if (eventConfig != null &&
                                eventConfig.pax &&
                                paxValue != null)
                              'pax_count': paxValue,
                            'notes': notes.text,
                          });
                        }
                        await _loadAll();
                        _showSnack(
                            '${lines.length} item(s) issued to department');
                      } catch (error) {
                        _showSnack('Stock out failed: ${_errorText(error)}',
                            error: true);
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
    openRecordDetailScreen(context, title: title, record: data);
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

  String _errorText(Object error) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map) {
        final message = data['message'] ?? data['error'];
        if (message != null && '$message'.trim().isNotEmpty) {
          return '$message';
        }
      }
      if (error.message != null && error.message!.trim().isNotEmpty) {
        return error.message!;
      }
    }
    return '$error';
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

class _ItemOptionsOverlay extends StatelessWidget {
  const _ItemOptionsOverlay({
    required this.options,
    required this.onSelected,
    required this.skuFor,
    required this.nameFor,
    required this.qtyFor,
    required this.priceFor,
  });

  final List<Map<String, dynamic>> options;
  final ValueChanged<Map<String, dynamic>> onSelected;
  final String Function(Map<String, dynamic>) skuFor;
  final String Function(Map<String, dynamic>) nameFor;
  final String Function(Map<String, dynamic>) qtyFor;
  final num Function(Map<String, dynamic>) priceFor;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topLeft,
      child: Material(
        elevation: 8,
        borderRadius: BorderRadius.circular(12),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 680, maxHeight: 320),
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(vertical: 6),
            itemCount: options.length,
            separatorBuilder: (_, __) =>
                const Divider(height: 1, indent: 16, endIndent: 16),
            itemBuilder: (context, index) {
              final item = options[index];
              final price = priceFor(item);
              return ListTile(
                dense: true,
                leading: CircleAvatar(
                  radius: 18,
                  backgroundColor: AppColors.kPrimary.withValues(alpha: 0.1),
                  child: const Icon(Icons.inventory_2,
                      size: 18, color: AppColors.kPrimary),
                ),
                title: Text(
                  nameFor(item),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                subtitle: Text(
                  '${skuFor(item)} | ${qtyFor(item)}${price > 0 ? ' | Cost KES ${price.toStringAsFixed(2)}' : ''}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                onTap: () => onSelected(item),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _SupplierOptionsOverlay extends StatelessWidget {
  const _SupplierOptionsOverlay({
    required this.options,
    required this.onSelected,
    required this.labelFor,
  });

  final List<Map<String, dynamic>> options;
  final ValueChanged<Map<String, dynamic>> onSelected;
  final String Function(Map<String, dynamic>) labelFor;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topLeft,
      child: Material(
        elevation: 8,
        borderRadius: BorderRadius.circular(12),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640, maxHeight: 300),
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(vertical: 6),
            itemCount: options.length,
            separatorBuilder: (_, __) =>
                const Divider(height: 1, indent: 16, endIndent: 16),
            itemBuilder: (context, index) {
              final supplier = options[index];
              return ListTile(
                dense: true,
                leading: CircleAvatar(
                  radius: 18,
                  backgroundColor: AppColors.kPrimary.withValues(alpha: 0.1),
                  child: const Icon(Icons.business,
                      size: 18, color: AppColors.kPrimary),
                ),
                title: Text(
                  '${supplier['name'] ?? supplier['supplier_name'] ?? 'Supplier'}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                subtitle: Text(
                  labelFor(supplier),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                onTap: () => onSelected(supplier),
              );
            },
          ),
        ),
      ),
    );
  }
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
  Map<String, dynamic> _selectedItem = {};

  List<Map<String, dynamic>> get _catalogOptions {
    final seen = <String>{};
    return widget.catalog.where((item) {
      final sku = '${item['sku'] ?? item['item_sku'] ?? ''}'.trim();
      if (sku.isEmpty || sku == 'null' || seen.contains(sku)) return false;
      seen.add(sku);
      return true;
    }).toList();
  }

  String _sku(Map<String, dynamic> item) =>
      '${item['sku'] ?? item['item_sku'] ?? item['item_code'] ?? ''}'.trim();

  String _name(Map<String, dynamic> item) =>
      '${item['item_name'] ?? item['name'] ?? item['description'] ?? _sku(item)}';

  num _num(dynamic value) {
    if (value is num) return value;
    return num.tryParse('$value') ?? 0;
  }

  String _qty(Map<String, dynamic> item) {
    final quantity = _num(item['quantity'] ?? item['available_quantity']);
    final unit = item['unit_of_measure'] ?? item['unit'] ?? 'units';
    return '${quantity.toStringAsFixed(quantity % 1 == 0 ? 0 : 2)} $unit';
  }

  String _searchText(Map<String, dynamic> item) => [
        _sku(item),
        _name(item),
        item['barcode'],
        item['bar_code'],
        item['category'],
        item['item_category'],
      ]
          .where((value) => value != null && '$value'.trim().isNotEmpty)
          .join(' ')
          .toLowerCase();

  @override
  Widget build(BuildContext context) {
    final catalog = _catalogOptions;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Autocomplete<Map<String, dynamic>>(
                key: ValueKey('line_editor_${_selectedSku ?? ''}'),
                initialValue: TextEditingValue(
                  text: _selectedSku == null
                      ? ''
                      : '${_name(_selectedItem)} - $_selectedSku',
                ),
                displayStringForOption: (item) =>
                    '${_name(item)} - ${_sku(item)}',
                optionsBuilder: (value) {
                  final query = value.text.trim().toLowerCase();
                  return catalog
                      .where((item) =>
                          query.isEmpty || _searchText(item).contains(query))
                      .take(40);
                },
                onSelected: (item) => setState(() {
                  _selectedItem = item;
                  _selectedSku = _sku(item);
                }),
                fieldViewBuilder:
                    (context, controller, focusNode, onFieldSubmitted) {
                  return TextField(
                    controller: controller,
                    focusNode: focusNode,
                    decoration: const InputDecoration(
                      labelText: 'Search item',
                      hintText: 'Type item name, SKU, barcode or category',
                      prefixIcon: Icon(Icons.search),
                    ),
                    onChanged: (_) {
                      if (_selectedSku != null) {
                        setState(() {
                          _selectedSku = null;
                          _selectedItem = {};
                        });
                      }
                    },
                  );
                },
                optionsViewBuilder: (context, onSelected, options) =>
                    _ItemOptionsOverlay(
                  options: options.toList(),
                  onSelected: onSelected,
                  skuFor: _sku,
                  nameFor: _name,
                  qtyFor: _qty,
                  priceFor: (item) => _num(item['cost_price'] ??
                      item['unit_cost'] ??
                      item['last_purchase_price'] ??
                      item['unit_price']),
                ),
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
      (element) => _sku(element) == _selectedSku,
      orElse: () => <String, dynamic>{},
    );
    if (item.isEmpty) return;
    if (widget.lines.any((line) => line['item_sku'] == _selectedSku)) return;
    setState(() {
      widget.lines.add({
        if (widget.itemIdKey != null) widget.itemIdKey!: _sku(item),
        'item_sku': _sku(item),
        'item_name': _name(item),
        widget.quantityKey: 1,
        if (widget.priceEnabled)
          'unit_price': item['cost_price'] ??
              item['unit_cost'] ??
              item['last_purchase_price'] ??
              item['unit_price'] ??
              0,
      });
      _selectedSku = null;
      _selectedItem = {};
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

class _StockTakeInlineInput extends StatefulWidget {
  const _StockTakeInlineInput({
    super.key,
    required this.initialValue,
    required this.enabled,
    required this.onChanged,
    required this.hintText,
    this.keyboardType,
  });

  final String initialValue;
  final bool enabled;
  final ValueChanged<String> onChanged;
  final String hintText;
  final TextInputType? keyboardType;

  @override
  State<_StockTakeInlineInput> createState() => _StockTakeInlineInputState();
}

class _StockTakeInlineInputState extends State<_StockTakeInlineInput> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue);
  }

  @override
  void didUpdateWidget(covariant _StockTakeInlineInput oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialValue != widget.initialValue &&
        _controller.text != widget.initialValue) {
      _controller.text = widget.initialValue;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 38,
      child: TextField(
        controller: _controller,
        enabled: widget.enabled,
        keyboardType: widget.keyboardType,
        textAlign: widget.keyboardType == TextInputType.number
            ? TextAlign.right
            : TextAlign.left,
        onChanged: widget.onChanged,
        decoration: InputDecoration(
          hintText: widget.hintText,
          isDense: true,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
    );
  }
}

class _AlertBanner extends StatelessWidget {
  const _AlertBanner({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.35)),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(9),
              ),
              child: Icon(icon, color: color, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 13)),
                  Text(subtitle,
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.kTextSecondary)),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios_rounded, size: 13, color: color),
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
