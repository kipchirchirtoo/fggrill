import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:printing/printing.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';

import '../../../core/storage/secure_storage_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/master_dashboard_shell.dart';
import '../../../core/widgets/record_detail_screen.dart';
import '../../../core/widgets/notification_button.dart';
import '../../auth/data/auth_repository.dart';
import '../data/branch_storekeeper_repository.dart';
import 'branch_po_create_screen.dart';

enum BranchStorekeeperSection {
  overview,
  stock,
  inventoryControl,
  inventoryLedger,
  receive,
  receiptVerification,
  suppliers,
  stockTakes,
  purchaseOrders,
  requests,
  departmentRequestLogging,
  posOutletAssembly,
  kitchenRequisitions,
  kitchenUsage,
  stockOut,
  foodControl,
  kitchenProduction,
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
  List<Map<String, dynamic>> _departmentAccounts = [];
  List<Map<String, dynamic>> _departmentConsumption = [];
  List<Map<String, dynamic>> _departmentIssueJournals = [];
  List<Map<String, dynamic>> _deptRequestLogs = [];
  List<Map<String, dynamic>>? _stockOutPreloadLines;
  String _stockOutPreloadDeptCode = '';
  String _stockOutPreloadRef = '';
  List<Map<String, dynamic>> _inventoryTruthMovements = [];
  List<Map<String, dynamic>> _outletStock = [];
  List<Map<String, dynamic>> _posOutlets = [];
  final Map<String, List<Map<String, dynamic>>> _outletMenuItems = {};
  Map<String, dynamic> _inventoryAnalytics = {};
  String _ledgerFilter = 'ALL';
  String? _selectedOutletId;
  String _branchName = '';
  String _branchId = '';
  bool _outletItemsLoading = false;
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
    'pos_outlet': 'Outlet Stock (POS / Bar / Restaurant)',
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
    final storage = ref.read(secureStorageProvider);
    final branchName =
        (await storage.read(key: AuthRepository.branchNameKey))?.trim() ?? '';
    final branchId =
        (await storage.read(key: AuthRepository.branchIdKey))?.trim() ?? '';
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
      _safe(_repo.departmentAccounts, <Map<String, dynamic>>[]),
      _safe(_repo.departmentConsumption, <Map<String, dynamic>>[]),
      _safe(_repo.enterpriseInventoryAnalytics, <String, dynamic>{}),
      _safe(_repo.departmentIssueJournals, <Map<String, dynamic>>[]),
      _safe(_repo.inventoryTruthMovements, <Map<String, dynamic>>[]),
      _safe(_repo.outletStock, <Map<String, dynamic>>[]),
      _safe(_repo.departmentRequestLogs, <Map<String, dynamic>>[]),
      _safe(_repo.posOutlets, <Map<String, dynamic>>[]),
    ]);
    if (!mounted) return;
    String? outletToLoad;
    setState(() {
      _branchName = branchName;
      _branchId = branchId;
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
      _departmentAccounts =
          List<Map<String, dynamic>>.from(results[11] as List);
      _departmentConsumption =
          List<Map<String, dynamic>>.from(results[12] as List);
      _inventoryAnalytics = results[13] as Map<String, dynamic>;
      _departmentIssueJournals =
          List<Map<String, dynamic>>.from(results[14] as List);
      _inventoryTruthMovements =
          List<Map<String, dynamic>>.from(results[15] as List);
      _outletStock = List<Map<String, dynamic>>.from(results[16] as List)
          .where(_isOutletRowVisible)
          .toList();
      _deptRequestLogs = List<Map<String, dynamic>>.from(results[17] as List);
      _posOutlets = List<Map<String, dynamic>>.from(results[18] as List)
          .where(_isOutletRowVisible)
          .toList();
      _outletMenuItems.clear();
      final outlets = _posOutletOptionsFrom(
        _posOutlets,
        _outletStock,
      );
      if (outlets.isNotEmpty &&
          (_selectedOutletId == null ||
              !outlets.any((row) => _outletId(row) == _selectedOutletId))) {
        final preferredOutlet = outlets.firstWhere(
          (row) =>
              _normalisedOutletText(_outletDisplayName(row))
                  .contains('restaurant') ||
              _normalisedOutletText(row['outlet_type'] ?? row['type'])
                  .contains('restaurant'),
          orElse: () => outlets.first,
        );
        _selectedOutletId = _outletId(preferredOutlet);
      }
      outletToLoad = _selectedOutletId;
      _loading = false;
    });
    if (outletToLoad != null && outletToLoad!.isNotEmpty) {
      await _loadOutletMenuItems(outletToLoad!);
    }
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

  String _normalisedOutletText(Object? value) {
    return '$value'.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), ' ').trim();
  }

  bool _isOutletRowVisible(Map<String, dynamic> row) {
    final outletName = _normalisedOutletText(_outletName(row));
    final branchName = _normalisedOutletText(_branchName);
    var nameWithoutBranch = outletName;
    if (branchName.isNotEmpty) {
      nameWithoutBranch = nameWithoutBranch.replaceFirst(branchName, '').trim();
    }

    if (branchName.isNotEmpty &&
        nameWithoutBranch.contains('kyogong') &&
        !branchName.contains('kyogong')) {
      return false;
    }
    if (branchName.isNotEmpty &&
        nameWithoutBranch.contains('bomet') &&
        !branchName.contains('bomet')) {
      return false;
    }

    final rowBranchId = '${row['branch_id'] ?? ''}'.trim();
    if (_branchId.isNotEmpty &&
        rowBranchId.isNotEmpty &&
        rowBranchId != 'null' &&
        rowBranchId != _branchId) {
      return false;
    }
    return true;
  }

  String _outletDisplayName(Map<String, dynamic> item) {
    var name = _outletName(item);
    final branchName = _branchName.trim();
    if (branchName.isNotEmpty) {
      name = name
          .replaceFirst(
              RegExp(RegExp.escape(branchName), caseSensitive: false), '')
          .trim();
    }
    name = name
        .replaceAll(RegExp(r'\s+POS$', caseSensitive: false), '')
        .replaceAll(RegExp(r'^\s*[-–—]\s*'), '')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    return name.isEmpty ? _outletName(item) : name;
  }

  Future<void> _loadOutletMenuItems(String outletId) async {
    if (outletId.isEmpty || _outletMenuItems.containsKey(outletId)) return;
    if (mounted) setState(() => _outletItemsLoading = true);
    final rows = await _safe(
      () => _repo.posOutletItems(outletId),
      <Map<String, dynamic>>[],
    );
    if (!mounted) return;
    setState(() {
      final outlet = _posOutletOptions.firstWhere(
        (row) => _outletId(row) == outletId,
        orElse: () => <String, dynamic>{},
      );
      _outletMenuItems[outletId] = rows
          .map((row) => {
                ...row,
                'outlet_id': row['outlet_id'] ?? outletId,
                'outlet_name': row['outlet_name'] ??
                    (outlet.isEmpty ? null : _outletName(outlet)),
                'outlet_type': row['outlet_type'] ??
                    (outlet.isEmpty ? null : _outletType(outlet)),
              })
          .where(_isOutletRowVisible)
          .toList();
      _outletItemsLoading = false;
    });
  }

  void _selectOutlet(String outletId) {
    setState(() {
      _selectedOutletId = outletId;
      _search = '';
    });
    unawaited(_loadOutletMenuItems(outletId));
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

  List<Map<String, dynamic>> get _posOutletOptions =>
      _posOutletOptionsFrom(_posOutlets, _outletStock);

  List<Map<String, dynamic>> _posOutletOptionsFrom(
    List<Map<String, dynamic>> outlets,
    List<Map<String, dynamic>> stockRows,
  ) {
    final byId = <String, Map<String, dynamic>>{};
    for (final outlet in outlets) {
      if (!_isOutletRowVisible(outlet)) continue;
      final id = _outletId(outlet);
      if (id.isEmpty) continue;
      byId[id] = {
        ...outlet,
        'id': id,
        'name': _outletName(outlet),
        'outlet_type': outlet['outlet_type'] ?? outlet['type'],
      };
    }
    // Fallback: add outlets found in stock data only if they belong to this branch
    // and are not already in the outlets list above.
    for (final item in stockRows) {
      if (!_isOutletRowVisible(item)) continue;
      final id = _outletId(item);
      if (id.isEmpty || byId.containsKey(id)) continue;
      // Hard branch guard — never add outlets from a different branch
      final itemBranchId = '${item['branch_id'] ?? ''}'.trim();
      if (_branchId.isNotEmpty &&
          itemBranchId.isNotEmpty &&
          itemBranchId != 'null' &&
          itemBranchId != _branchId) continue;
      byId[id] = {
        'id': id,
        'name': _outletName(item),
        'outlet_type': item['outlet_type'] ?? 'pos_outlet',
        'branch_id': item['branch_id'],
      };
    }
    final values = byId.values.toList()
      ..sort((a, b) => _outletDisplayName(a).compareTo(_outletDisplayName(b)));
    return values;
  }

  String _outletId(Map<String, dynamic> item) {
    final stockOutletId =
        '${item['outlet_id'] ?? item['outletId'] ?? ''}'.trim();
    if (stockOutletId.isNotEmpty && stockOutletId != 'null') {
      return stockOutletId;
    }
    return '${item['id'] ?? ''}'.trim();
  }

  String _outletName(Map<String, dynamic> item) =>
      '${item['outlet_name'] ?? item['name'] ?? item['outletName'] ?? 'POS Outlet'}'
          .trim();

  String _outletType(Map<String, dynamic> item) =>
      '${item['outlet_type'] ?? item['outletType'] ?? item['type'] ?? 'pos_outlet'}'
          .trim();

  String _outletItemId(Map<String, dynamic> item) =>
      '${item['id'] ?? item['outlet_item_id'] ?? item['outletItemId'] ?? ''}'
          .trim();

  String _outletItemSku(Map<String, dynamic> item) =>
      '${item['sku'] ?? item['item_sku'] ?? item['output_sku'] ?? ''}'.trim();

  String _outletItemName(Map<String, dynamic> item) {
    final raw =
        '${item['name'] ?? item['item_name'] ?? item['output_name'] ?? _outletItemSku(item)}'
            .trim();
    return raw.isEmpty || raw == 'null' ? 'Outlet Item' : raw;
  }

  String _outletStockStatus(Map<String, dynamic> item) =>
      '${item['stock_status'] ?? item['status'] ?? ''}'.trim();

  String _outletStockStatusLabel(Map<String, dynamic> item) {
    final status = _outletStockStatus(item);
    if (status == 'production_required') return 'Production Required';
    if (status == 'out_of_stock') return 'Out of Stock';
    if (status == 'low_stock') return 'Low Stock';
    if (status == 'available') return 'Available';
    return status.isEmpty ? 'Stocked' : _movementLabel(status);
  }

  Color _outletStockStatusColor(Map<String, dynamic> item) {
    final status = _outletStockStatus(item);
    if (status == 'production_required' || status == 'low_stock') {
      return AppColors.kWarning;
    }
    if (status == 'out_of_stock') return AppColors.kError;
    return AppColors.kSuccess;
  }

  String _menuLinkLabel(Map<String, dynamic> item) {
    final source = '${item['linked_menu_table'] ?? item['source_table'] ?? ''}';
    if (source == 'restaurant_menu_items') return 'Restaurant menu';
    if (source == 'bar_drinks') return 'Bar drink';
    return '${item['menu_mapping_status'] ?? 'manual'}' == 'linked'
        ? 'Linked menu'
        : 'Manual outlet item';
  }

  num _outletUnitCost(Map<String, dynamic> item) =>
      _num(item['computed_unit_cost'] ??
          item['recipe_unit_cost'] ??
          item['cost_price'] ??
          item['unit_cost']);

  String _recipeInfoLine(Map<String, dynamic> item) {
    final count = _num(item['recipe_ingredient_count']);
    final max = item['max_producible_quantity'];
    final recipe = '${item['recipe_name'] ?? item['recipe_code'] ?? ''}'.trim();
    final parts = <String>[
      if (recipe.isNotEmpty) 'Recipe: $recipe',
      if (count > 0) '${_qtyText(count)} ingredients',
      if (max != null) 'Max producible ${_qtyText(max)}',
      'Cost ${_money(_outletUnitCost(item))}',
      if (_num(item['selling_price']) > 0)
        'Margin ${_num(item['gross_margin']).toStringAsFixed(1)}%',
    ];
    return parts.join(' | ');
  }

  List<Map<String, dynamic>> _stockForOutlet(String? outletId) {
    final rows = <Map<String, dynamic>>[
      ..._outletStock,
      if (outletId != null) ...?_outletMenuItems[outletId],
    ];
    return _uniqueRows(
        rows.where(_isOutletRowVisible).where((row) {
          if (outletId == null || outletId.isEmpty) return true;
          return _outletId(row) == outletId ||
              '${row['outlet_id'] ?? row['outletId'] ?? ''}' == outletId;
        }).toList(),
        _outletItemId);
  }

  Map<String, dynamic>? _selectedOutlet() {
    final outlets = _posOutletOptions;
    if (outlets.isEmpty) return null;
    return outlets.firstWhere(
      (row) => _outletId(row) == _selectedOutletId,
      orElse: () => outlets.first,
    );
  }

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
      final receivableItems = items.where((item) {
        if (item['quantity_pending'] == null) return true;
        return _num(item['quantity_pending']) > 0;
      }).toList();

      final lines = receivableItems
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
        _showSnack(
            'Selected PO has no receivable items (already fully received)',
            error: true);
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

  Future<void> _receivePurchaseOrderViaGoodsScreen(
    Map<String, dynamic> po, {
    bool closeCurrentRoute = false,
  }) async {
    final id = '${po['id'] ?? ''}';
    if (id.isEmpty || id == 'null') {
      _showSnack('Could not identify this purchase order', error: true);
      return;
    }

    if (closeCurrentRoute && mounted) {
      Navigator.of(context).maybePop();
    }

    if (mounted) {
      setState(() {
        _section = BranchStorekeeperSection.receive;
        _search = '';
        _statusFilter = 'ALL';
        _poSupplierFilter = null;
      });
    }

    await _applyBranchReceiptPo(id, fallback: po);
    if (!mounted) return;
    _showSnack(
      'PO loaded in Receive Goods. Post the receipt/GRN to update received status.',
    );
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
      final receipt = await _repo.receiveFromSupplier({
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
      final grn =
          _poMap(receipt['grn']).isNotEmpty ? _poMap(receipt['grn']) : receipt;
      final grnNumber = _poText(grn, const ['grn_number']);
      final invoice = _poMap(receipt['supplier_invoice']);
      final isFullyReceived = receipt['fullyReceived'] == true;
      final isDuplicate = receipt['duplicate'] == true;
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
      if (isFullyReceived) {
        _showSnack(
          grnNumber.isEmpty
              ? 'This PO is already fully received. Open the existing GRN from Purchase Orders.'
              : 'PO already fully received. Existing GRN $grnNumber is on record — open it from Purchase Orders.',
        );
      } else if (isDuplicate) {
        _showSnack(
          grnNumber.isEmpty
              ? 'A matching GRN already exists for this receipt.'
              : 'GRN $grnNumber already exists — no duplicate created.',
        );
      } else {
        _showSnack(
          grnNumber.isEmpty
              ? 'Supplier GRN posted. Branch Accountant can now bill it.'
              : invoice.isEmpty
                  ? 'GRN $grnNumber posted. Branch Accountant can now bill it.'
                  : 'GRN $grnNumber posted and supplier invoice draft created.',
        );
      }
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
        const MasterNavItem(
          section: BranchStorekeeperSection.inventoryControl,
          label: 'POS Outlet Issue',
          icon: Icons.restaurant_menu_outlined,
          group: 'Inventory',
        ),
        const MasterNavItem(
          section: BranchStorekeeperSection.posOutletAssembly,
          label: 'Outlet Production',
          icon: Icons.precision_manufacturing_outlined,
          group: 'Inventory',
        ),
        MasterNavItem(
          section: BranchStorekeeperSection.inventoryLedger,
          label: 'Inventory Ledger',
          icon: PhosphorIcons.listChecks(),
          group: 'Inventory',
        ),
        MasterNavItem(
          section: BranchStorekeeperSection.receive,
          label: 'Receive Goods',
          icon: PhosphorIcons.truck(),
          group: 'Inventory',
        ),
        MasterNavItem(
          section: BranchStorekeeperSection.receiptVerification,
          label: 'Receipt Verification',
          icon: PhosphorIcons.clipboardText(),
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
          label: 'Stock Take',
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
          label: 'Branch Requisition',
          icon: PhosphorIcons.gitPullRequest(),
          group: 'Requisitions',
        ),
        MasterNavItem(
          section: BranchStorekeeperSection.kitchenRequisitions,
          label: 'Kitchen Requisitions',
          icon: PhosphorIcons.cookingPot(),
          group: 'Requisitions',
        ),
        MasterNavItem(
          section: BranchStorekeeperSection.departmentRequestLogging,
          label: 'Department Requests',
          icon: PhosphorIcons.clipboardText(),
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
        const MasterNavItem(
          section: BranchStorekeeperSection.foodControl,
          label: 'Food Control',
          icon: Icons.restaurant_outlined,
          group: 'Usage',
        ),
        const MasterNavItem(
          section: BranchStorekeeperSection.kitchenProduction,
          label: 'Kitchen Sessions',
          icon: Icons.soup_kitchen_outlined,
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
      case BranchStorekeeperSection.inventoryControl:
        return _posOutletIssuePage();
      case BranchStorekeeperSection.inventoryLedger:
        return _inventoryLedgerPage();
      case BranchStorekeeperSection.receive:
        return _receivePage();
      case BranchStorekeeperSection.receiptVerification:
        return _receiptVerificationPage();
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
      case BranchStorekeeperSection.departmentRequestLogging:
        return _departmentRequestLoggingPage();
      case BranchStorekeeperSection.posOutletAssembly:
        return _outletProductionLedgerPage();
      case BranchStorekeeperSection.kitchenRequisitions:
        return _kitchenRequisitionsPage();
      case BranchStorekeeperSection.kitchenUsage:
        return _kitchenUsagePage();
      case BranchStorekeeperSection.stockOut:
        return _stockOutPage();
      case BranchStorekeeperSection.foodControl:
        return _FoodControlSection(stock: _stock);
      case BranchStorekeeperSection.kitchenProduction:
        return _KitchenProductionSection(stock: _stock);
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
    return DefaultTabController(
      length: 2,
      child: _Page(
        title: 'Master Inventory',
        subtitle:
            'Branch stock + Central Catalog registration. Branches adopt items from Central — no free creation.',
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
          Container(
            decoration: BoxDecoration(
              color: AppColors.kPrimary,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const TabBar(
              labelColor: Colors.white,
              unselectedLabelColor: Colors.white60,
              indicatorColor: Colors.white,
              indicatorSize: TabBarIndicatorSize.tab,
              tabs: [
                Tab(
                  icon: Icon(Icons.inventory_2_outlined, size: 18),
                  text: 'Branch Inventory',
                ),
                Tab(
                  icon: Icon(Icons.store_outlined, size: 18),
                  text: 'Central Master Catalog',
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 900,
            child: TabBarView(
              children: [
                _BranchInventoryTab(
                  stock: _stock,
                  search: _search,
                  onSearchChanged: (v) => setState(() => _search = v),
                  itemName: _itemName,
                  qty: _qty,
                  toNum: _num,
                  onRequest: _quickRequestStock,
                ),
                _CentralCatalogTab(
                  catalog: _catalog,
                  stock: _stock,
                  catalogFilter: _catalogFilter,
                  categories: _categories,
                  onFilterChanged: (v) => setState(() => _catalogFilter = v),
                  toNum: _num,
                  onRegister: _openRegistrationDialog,
                  onRefresh: _loadAll,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openRegistrationDialog(Map<String, dynamic> item) async {
    final saved = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _CatalogRegistrationDialog(item: item),
    );
    if (saved == true) {
      await _loadAll();
      _showSnack(
          '${item['item_name'] ?? item['name']} registered to branch inventory');
    }
  }

  Widget _receivePage() {
    final incoming = _incomingDispatches
        .where((d) => '${d['status']}'.toUpperCase() == 'IN_TRANSIT')
        .length;
    final pendingDispatches = _incomingDispatches.where((d) {
      final s = '${d['status']}'.toUpperCase();
      return s == 'IN_TRANSIT' || s == 'READY' || s == 'DELIVERED';
    }).length;
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
          _StatCardData('Incoming', '$pendingDispatches',
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
                trailing: _StatusChip(status,
                    success: status.toUpperCase() == 'CONFIRMED' ||
                        status.toUpperCase() == 'COMPLETED' ||
                        status.toUpperCase() == 'RECEIVED' ||
                        status.toUpperCase() == 'VERIFIED'),
                actions: [
                  if (['IN_TRANSIT', 'READY', 'DELIVERED']
                      .contains(status.toUpperCase()))
                    TextButton(
                      onPressed: () => _showConfirmDispatch(dispatch),
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
          _StatCardData('Items', '${_stockTakeItems.length}',
              PhosphorIcons.package(), AppColors.kPrimary),
          _StatCardData(
              'Counted C/s',
              '${_stockTakeItems.where((i) => i['counted_quantity'] != null || i['physical_quantity'] != null).length}',
              PhosphorIcons.checkCircle(),
              AppColors.kSuccess),
          _StatCardData(
              'Sales Units',
              _qtyText(_stockTakeItems.fold<num>(
                  0, (sum, item) => sum + _stockTakeSoldQuantity(item))),
              PhosphorIcons.trendUp(),
              AppColors.kWarning),
          _StatCardData(
              'Sales Revenue',
              _money(_stockTakeItems.fold<num>(
                  0, (sum, item) => sum + _stockTakeRevenue(item))),
              PhosphorIcons.coins(),
              Colors.teal),
          _StatCardData(
              'Closing Sales',
              _money(_stockTakeItems.fold<num>(
                  0, (sum, item) => sum + _stockTakeClosingSales(item))),
              PhosphorIcons.buildings(),
              AppColors.kPrimary),
          _StatCardData(
              'Added Stock',
              _money(_stockTakeItems.fold<num>(
                  0, (sum, item) => sum + _stockTakeAddedStock(item))),
              PhosphorIcons.truck(),
              Colors.deepOrange),
        ]),
        _SectionCard(
          title: 'Trading Stock Sheet',
          child: _stockTakeWorksheetGrid(editable),
        ),
      ],
    );
  }

  dynamic _stockTakeField(Map<String, dynamic> item, List<String> keys) {
    final itemMap = item['item'] is Map ? item['item'] as Map : null;
    for (final key in keys) {
      final value = item[key] ?? itemMap?[key];
      if (value != null && '$value'.trim().isNotEmpty && '$value' != 'null') {
        return value;
      }
    }
    return null;
  }

  num _stockTakeFirstNum(Map<String, dynamic> item, List<String> keys) {
    return _num(_stockTakeField(item, keys));
  }

  num _stockTakeOpening(Map<String, dynamic> item) {
    final explicit = _stockTakeFirstNum(
        item, ['opening_stock', 'opening_quantity', 'opening']);
    if (explicit != 0) return explicit;
    return _stockTakeFirstNum(item, [
      'system_closing_stock',
      'system_quantity',
      'current_stock',
      'quantity'
    ]);
  }

  num _stockTakeAdded(Map<String, dynamic> item) =>
      _stockTakeFirstNum(item, ['adds', 'added_quantity', 'additions']) +
      _stockTakeFirstNum(item, ['transfers_in', 'received_quantity']) +
      _stockTakeFirstNum(item, ['production_quantity', 'produced_quantity']);

  num _stockTakeTotal(Map<String, dynamic> item) =>
      _stockTakeOpening(item) + _stockTakeAdded(item);

  num _stockTakeClosing(Map<String, dynamic> item) {
    final actual = _actualIncludingDraft(item);
    if (actual != null) return actual;
    final explicit = _stockTakeFirstNum(item, [
      'closing_stock',
      'closing_quantity',
      'counted_quantity',
      'actual_quantity',
      'physical_quantity'
    ]);
    if (explicit != 0) return explicit;
    return _stockTakeTotal(item);
  }

  num _stockTakeSoldQuantity(Map<String, dynamic> item) =>
      _stockTakeTotal(item) - _stockTakeClosing(item);

  num _stockTakeSellingPrice(Map<String, dynamic> item) => _stockTakeFirstNum(
      item, ['selling_price', 'unit_price', 'price', 'retail_price']);

  num _stockTakeBuyingPrice(Map<String, dynamic> item) => _stockTakeFirstNum(
      item, ['buying_price', 'cost_price', 'unit_cost', 'cost']);

  num _stockTakeRevenue(Map<String, dynamic> item) =>
      _stockTakeSoldQuantity(item) * _stockTakeSellingPrice(item);

  num _stockTakeOpeningSales(Map<String, dynamic> item) =>
      _stockTakeOpening(item) * _stockTakeSellingPrice(item);

  num _stockTakeClosingSales(Map<String, dynamic> item) =>
      _stockTakeClosing(item) * _stockTakeSellingPrice(item);

  num _stockTakeAddedStock(Map<String, dynamic> item) =>
      _stockTakeAdded(item) * _stockTakeBuyingPrice(item);

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
            '$counted / ${_stockTakeItems.length} closing counts entered',
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
          width: 2180,
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
        SizedBox(width: 320, child: Text('ITEM', style: style)),
        SizedBox(width: 20),
        SizedBox(
            width: 82,
            child: Text('O/S', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 20),
        SizedBox(
            width: 82,
            child: Text('ADDS', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 20),
        SizedBox(
            width: 88,
            child: Text('TOTAL', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 20),
        SizedBox(width: 150, child: Text('C/S COUNT', style: style)),
        SizedBox(width: 20),
        SizedBox(
            width: 88,
            child: Text('SALES', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 20),
        SizedBox(
            width: 108,
            child:
                Text('UNIT PRICE', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 20),
        SizedBox(
            width: 118,
            child: Text('AMOUNT', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 20),
        SizedBox(
            width: 108,
            child:
                Text('BUYING PRICE', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 20),
        SizedBox(
            width: 126,
            child: Text('OPENING SALES',
                textAlign: TextAlign.right, style: style)),
        SizedBox(width: 20),
        SizedBox(
            width: 126,
            child: Text('CLOSING SALES',
                textAlign: TextAlign.right, style: style)),
        SizedBox(width: 20),
        SizedBox(
            width: 118,
            child:
                Text('ADDED STOCK', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 20),
        SizedBox(width: 280, child: Text('NOTES', style: style)),
      ]),
    );
  }

  Widget _stockTakeWorksheetRow(Map<String, dynamic> item, bool editable) {
    final system =
        _num(item['system_closing_stock'] ?? item['system_quantity']);
    final actual = _actualIncludingDraft(item);
    final variance = actual == null ? 0 : actual - system;
    final needsReason = actual != null && variance != 0;
    final sold = _stockTakeSoldQuantity(item);
    final color = actual == null
        ? Colors.transparent
        : variance == 0 && sold >= 0
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
          width: 320,
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('$name',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 2),
            Text(
                [
                  '${item['item_sku'] ?? item['sku'] ?? ''}',
                  '${item['category'] ?? itemMap?['category'] ?? ''}'
                ]
                    .where((part) => part.trim().isNotEmpty && part != 'null')
                    .join(' • '),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    color: AppColors.kTextSecondary, fontSize: 11)),
          ]),
        ),
        const SizedBox(width: 20),
        _worksheetNumberCell(_stockTakeOpening(item), width: 82),
        const SizedBox(width: 20),
        _worksheetNumberCell(_stockTakeAdded(item), width: 82),
        const SizedBox(width: 20),
        _worksheetNumberCell(_stockTakeTotal(item), width: 88, bold: true),
        const SizedBox(width: 20),
        SizedBox(
          width: 150,
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
          width: 88,
          child: Text(_qtyText(sold),
              textAlign: TextAlign.right,
              style: TextStyle(
                color: sold < 0 ? AppColors.kWarning : AppColors.kTextPrimary,
                fontWeight: FontWeight.w800,
              )),
        ),
        const SizedBox(width: 20),
        SizedBox(
          width: 108,
          child: Text(_money(_stockTakeSellingPrice(item)),
              textAlign: TextAlign.right, style: const TextStyle(fontSize: 12)),
        ),
        const SizedBox(width: 20),
        SizedBox(
          width: 118,
          child: Text(_money(_stockTakeRevenue(item)),
              textAlign: TextAlign.right,
              style: const TextStyle(fontWeight: FontWeight.w800)),
        ),
        const SizedBox(width: 20),
        SizedBox(
          width: 108,
          child: Text(_money(_stockTakeBuyingPrice(item)),
              textAlign: TextAlign.right, style: const TextStyle(fontSize: 12)),
        ),
        const SizedBox(width: 20),
        SizedBox(
          width: 126,
          child: Text(_money(_stockTakeOpeningSales(item)),
              textAlign: TextAlign.right, style: const TextStyle(fontSize: 12)),
        ),
        const SizedBox(width: 20),
        SizedBox(
          width: 126,
          child: Text(_money(_stockTakeClosingSales(item)),
              textAlign: TextAlign.right, style: const TextStyle(fontSize: 12)),
        ),
        const SizedBox(width: 20),
        SizedBox(
          width: 118,
          child: Text(_money(_stockTakeAddedStock(item)),
              textAlign: TextAlign.right, style: const TextStyle(fontSize: 12)),
        ),
        const SizedBox(width: 20),
        SizedBox(
          width: 280,
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

  Widget _worksheetNumberCell(num value,
      {double width = 92, bool bold = false}) {
    return SizedBox(
      width: width,
      child: Text(_qtyText(value),
          textAlign: TextAlign.right,
          style: TextStyle(
              fontSize: 12, fontWeight: bold ? FontWeight.w800 : null)),
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
          onPressed: _openPoCreateScreen,
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
                  OutlinedButton.icon(
                    onPressed: () => _showPurchaseOrderDetail(po),
                    icon: Icon(PhosphorIcons.eye()),
                    label: const Text('View'),
                  ),
                  OutlinedButton.icon(
                    onPressed: () => _downloadPurchaseOrderPdf(po),
                    icon: Icon(PhosphorIcons.downloadSimple()),
                    label: const Text('Download'),
                  ),
                  OutlinedButton.icon(
                    onPressed: () => _printPurchaseOrderPdf(po),
                    icon: Icon(PhosphorIcons.printer()),
                    label: const Text('Print'),
                  ),
                  if (statusLower == 'pending' || statusLower == 'draft')
                    FilledButton(
                      onPressed: () => _poAction(po, 'approve'),
                      child: const Text('Approve'),
                    ),
                  if (const {'APPROVED', 'ORDERED', 'SENT'}
                      .contains(status.toUpperCase()))
                    OutlinedButton.icon(
                      onPressed: () => _receivePurchaseOrderViaGoodsScreen(po),
                      icon: Icon(PhosphorIcons.package()),
                      label: const Text('Receive Goods'),
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
      title: 'Branch Requisition',
      subtitle:
          'Create branch requests, track auditor approval, central packing, dispatch and receipt closure.',
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
          title: 'Branch Requisition Queue',
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
    final pending = _kitchenRequisitions
        .where((r) =>
            '${r['status']}'.toUpperCase() == 'PENDING' ||
            '${r['status']}'.toUpperCase() == 'APPROVED')
        .toList();
    final history = _kitchenRequisitions
        .where((r) =>
            '${r['status']}'.toUpperCase() == 'FULFILLED' ||
            '${r['status']}'.toUpperCase() == 'REJECTED')
        .toList();
    return _Page(
      title: 'Kitchen Requisitions',
      subtitle:
          'Review, fulfill, and track kitchen item requisitions from the branch.',
      actions: [
        _RefreshButton(onPressed: _loadAll),
      ],
      children: [
        _StatGrid(cards: [
          _StatCardData('Pending', '${pending.length}',
              PhosphorIcons.clock(), AppColors.kWarning),
          _StatCardData('History', '${history.length}',
              PhosphorIcons.checkCircle(), AppColors.kSuccess),
        ]),
        if (pending.isNotEmpty)
          _SectionCard(
            title: 'Pending Requisitions',
            child: _RecordList(
              emptyText: 'No pending requisitions',
              children: pending.map((req) {
                final items = _listFrom(req['items']);
                final status = '${req['status'] ?? ''}'.toUpperCase();
                return _RecordTile(
                  icon: PhosphorIcons.cookingPot(),
                  title:
                      '${req['requisition_number'] ?? req['id'] ?? 'Requisition'}',
                  subtitle:
                      '${items.length} items | ${_date(req['requested_at'] ?? req['created_at'])} | Priority: ${req['priority'] ?? 'Normal'}',
                  trailing: _StatusChip(status,
                      success: status == 'FULFILLED',
                      warning: status == 'PENDING',
                      error: status == 'REJECTED'),
                  actions: [
                    TextButton(
                      onPressed: () =>
                          _showJsonDetail('Requisition Detail', req),
                      child: const Text('View'),
                    ),
                    if (status == 'PENDING' || status == 'APPROVED')
                      FilledButton(
                        onPressed: () => _showFulfillRequisition(req),
                        child: const Text('Issue'),
                      ),
                    if (status == 'PENDING')
                      TextButton(
                        onPressed: () => _showRejectRequisition(req),
                        child: const Text('Reject'),
                      ),
                    TextButton(
                      onPressed: () => _showRequisitionRelatedActivity(req),
                      child: const Text('Activity'),
                    ),
                  ],
                );
              }).toList(),
            ),
          ),
        if (history.isNotEmpty)
          _SectionCard(
            title: 'History',
            child: _RecordList(
              emptyText: 'No historical requisitions',
              children: history.map((req) {
                final items = _listFrom(req['items']);
                final status = '${req['status'] ?? ''}'.toUpperCase();
                return _RecordTile(
                  icon: PhosphorIcons.cookingPot(),
                  title:
                      '${req['requisition_number'] ?? req['id'] ?? 'Requisition'}',
                  subtitle:
                      '${items.length} items | ${_date(req['requested_at'] ?? req['created_at'])}',
                  trailing: _StatusChip(status,
                      success: status == 'FULFILLED',
                      warning: status == 'PENDING',
                      error: status == 'REJECTED'),
                  actions: [
                    TextButton(
                      onPressed: () =>
                          _showJsonDetail('Requisition Detail', req),
                      child: const Text('View'),
                    ),
                    TextButton(
                      onPressed: () => _showRequisitionRelatedActivity(req),
                      child: const Text('Activity'),
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
    final records = _kitchenUsage.where((record) {
      if (_search.trim().isEmpty) return true;
      final haystack = [
        record['item_name'],
        record['item_sku'],
        record['category'],
        record['status'],
        record['recorded_by_name'],
      ].join(' ').toLowerCase();
      return haystack.contains(_search.trim().toLowerCase());
    }).toList();
    final active = records
        .where((r) => '${r['status']}'.toUpperCase() != 'CLOSED')
        .toList();
    final issued = records.fold<num>(
        0, (sum, r) => sum + _num(r['received_quantity'] ?? r['quantity']));
    final consumed =
        records.fold<num>(0, (sum, r) => sum + _num(r['consumed_quantity']));
    final spoilt =
        records.fold<num>(0, (sum, r) => sum + _num(r['spoilt_quantity']));
    final lost =
        records.fold<num>(0, (sum, r) => sum + _num(r['lost_quantity']));
    final damaged =
        records.fold<num>(0, (sum, r) => sum + _num(r['damaged_quantity']));
    final expired =
        records.fold<num>(0, (sum, r) => sum + _num(r['expired_quantity']));
    final returned =
        records.fold<num>(0, (sum, r) => sum + _num(r['returned_quantity']));
    final remaining =
        records.fold<num>(0, (sum, r) => sum + _num(r['remaining_quantity']));
    final wastage = spoilt + lost + damaged + expired;
    final lossValue = records.fold<num>(
      0,
      (sum, r) {
        final itemWaste = _num(r['spoilt_quantity']) +
            _num(r['lost_quantity']) +
            _num(r['damaged_quantity']) +
            _num(r['expired_quantity']);
        return sum + itemWaste * _num(r['unit_cost']);
      },
    );
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
          _StatCardData('Active Tracking', '${active.length}',
              PhosphorIcons.forkKnife(), AppColors.kPrimary),
          _StatCardData('Items Available', '${_trackableItems.length}',
              PhosphorIcons.package(), AppColors.kSuccess),
          _StatCardData(
              'Issued', _qtyText(issued), Icons.output_outlined, Colors.indigo),
          _StatCardData('Consumed', _qtyText(consumed),
              PhosphorIcons.cookingPot(), AppColors.kSuccess),
          _StatCardData('Spoilage / Loss', _qtyText(wastage),
              PhosphorIcons.warning(), AppColors.kError),
          _StatCardData('Remaining', _qtyText(remaining),
              PhosphorIcons.package(), AppColors.kWarning),
        ]),
        _SectionCard(
          title: 'Usage Control',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: TextEditingController(text: _search)
                        ..selection =
                            TextSelection.collapsed(offset: _search.length),
                      decoration: const InputDecoration(
                        labelText:
                            'Search kitchen item, SKU, status or recorder',
                        prefixIcon: Icon(Icons.search),
                      ),
                      onChanged: (value) => setState(() => _search = value),
                    ),
                  ),
                  const SizedBox(width: 12),
                  _InfoPill('Returned', _qtyText(returned)),
                  const SizedBox(width: 8),
                  _InfoPill('Loss Value', _money(lossValue)),
                ],
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _InfoPill('Spoilt', _qtyText(spoilt)),
                  _InfoPill('Lost', _qtyText(lost)),
                  _InfoPill('Damaged', _qtyText(damaged)),
                  _InfoPill('Expired', _qtyText(expired)),
                  _InfoPill('Records', '${records.length}'),
                ],
              ),
            ],
          ),
        ),
        _SectionCard(
          title: 'Usage Records',
          child: _RecordList(
            emptyText: 'No usage records yet',
            children: records.map((record) {
              final received = _num(record['received_quantity']);
              final remainingQty = _num(record['remaining_quantity']);
              final consumedQty = _num(record['consumed_quantity']);
              final wasteQty = _num(record['spoilt_quantity']) +
                  _num(record['lost_quantity']) +
                  _num(record['damaged_quantity']) +
                  _num(record['expired_quantity']);
              final returnedQty = _num(record['returned_quantity']);
              final status = '${record['status'] ?? ''}'.toUpperCase();
              return _RecordTile(
                icon: PhosphorIcons.forkKnife(),
                title: '${record['item_name'] ?? record['item_sku']}',
                subtitle:
                    '${record['item_sku'] ?? '-'} | ${_date(record['usage_date'])} | issued ${_qtyText(received)}',
                trailing: _StatusChip(status,
                    success: status == 'CLOSED' || status == 'COMPLETED',
                    warning: status == 'PARTIAL' || status == 'APPROVED'),
                actions: [
                  TextButton(
                    onPressed: () => _showKitchenUsageDetail(record),
                    child: const Text('Ledger'),
                  ),
                  if (status != 'CLOSED')
                    TextButton(
                      onPressed: () => _showKitchenUsageEntry(record,
                          initialType: 'CONSUMED'),
                      child: const Text('Consume'),
                    ),
                  if (status != 'CLOSED')
                    TextButton(
                      onPressed: () =>
                          _showKitchenUsageEntry(record, initialType: 'SPOILT'),
                      child: const Text('Spoilage'),
                    ),
                  if (status != 'CLOSED')
                    TextButton(
                      onPressed: () => _closeKitchenUsage(record),
                      child: const Text('Close'),
                    ),
                ],
                meta: [
                  _InfoPill('Consumed', _qtyText(consumedQty)),
                  _InfoPill('Spoilage/Loss', _qtyText(wasteQty)),
                  _InfoPill('Returned', _qtyText(returnedQty)),
                  _InfoPill('Remaining', _qtyText(remainingQty)),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _stockOutPage() {
    final outs = _departmentIssueJournals;
    final hasPreload = _stockOutPreloadLines != null;
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
          onPressed: () => _showStockOutForm(
            preloadLines: _stockOutPreloadLines,
            preloadDeptCode: _stockOutPreloadDeptCode,
            preloadRef: _stockOutPreloadRef,
          ),
          icon: Icon(PhosphorIcons.plus()),
          label: const Text('Issue Stock'),
        ),
      ],
      children: [
        if (hasPreload)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.kPrimary.withValues(alpha: 0.09),
              borderRadius: BorderRadius.circular(10),
              border:
                  Border.all(color: AppColors.kPrimary.withValues(alpha: 0.35)),
            ),
            child: Row(
              children: [
                Icon(PhosphorIcons.caretRight(),
                    color: AppColors.kPrimary, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Auto-loaded from request: $_stockOutPreloadRef',
                        style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            color: AppColors.kPrimary),
                      ),
                      Text(
                        '${_stockOutPreloadLines!.length} item(s) ready to issue to '
                        '${_stockOutPreloadDeptCode.isNotEmpty ? _stockOutPreloadDeptCode.replaceAll('_', ' ') : 'department'}',
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.kTextSecondary),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                OutlinedButton(
                  onPressed: () => setState(() {
                    _stockOutPreloadLines = null;
                    _stockOutPreloadDeptCode = '';
                    _stockOutPreloadRef = '';
                  }),
                  child: const Text('Clear'),
                ),
                const SizedBox(width: 8),
                FilledButton.icon(
                  onPressed: () => _showStockOutForm(
                    preloadLines: _stockOutPreloadLines,
                    preloadDeptCode: _stockOutPreloadDeptCode,
                    preloadRef: _stockOutPreloadRef,
                  ),
                  icon: Icon(PhosphorIcons.trendDown(), size: 16),
                  label: const Text('Issue Now'),
                ),
              ],
            ),
          ),
        _StatGrid(cards: [
          _StatCardData(
              'Total Volume',
              outs
                  .fold<num>(
                      0,
                      (sum, item) =>
                          sum + _num(item['ledger']?['quantity']).abs())
                  .toStringAsFixed(0),
              PhosphorIcons.package(),
              AppColors.kPrimary),
          _StatCardData(
              'High Intensity',
              '${outs.where((r) => _num(r['ledger']?['quantity']).abs() > 10).length}',
              PhosphorIcons.activity(),
              AppColors.kError),
          _StatCardData(
              'Today',
              '${outs.where((r) => '${r['created_at'] ?? r['ledger']?['created_at']}'.startsWith(DateTime.now().toIso8601String().substring(0, 10))).length}',
              PhosphorIcons.calendar(),
              AppColors.kSuccess),
        ]),
        _SectionCard(
          title: 'Stock Out Ledger',
          child: _RecordList(
            emptyText: 'No stock out records',
            children: outs.map((record) {
              final ledger = Map<String, dynamic>.from(
                  (record['ledger'] as Map?) ?? const {});
              final metadata = Map<String, dynamic>.from(
                  (ledger['metadata'] as Map?) ?? const {});
              final account = Map<String, dynamic>.from(
                  (record['account'] as Map?) ?? const {});
              final issued = _num(metadata['issued_quantity'] ??
                  ledger['quantity'] ??
                  record['quantity']);
              final requested = _num(metadata['requested_quantity'] ?? issued);
              final pending = _num(metadata['pending_quantity']);
              final status = '${metadata['issue_status'] ?? 'completed'}';
              final minNumber =
                  '${metadata['min_number'] ?? ledger['source_number'] ?? 'MIN'}';
              return _RecordTile(
                icon: PhosphorIcons.trendDown(),
                title:
                    '${metadata['item_name'] ?? ledger['item_sku'] ?? _itemName(record)}',
                subtitle:
                    '$minNumber | ${account['department_name'] ?? ledger['destination_type'] ?? 'Department'} | ${_date(ledger['created_at'] ?? record['created_at'])}',
                trailing: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      _qtyText(issued),
                      style: TextStyle(
                        color:
                            pending > 0 ? AppColors.kWarning : AppColors.kError,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    _StatusChip(
                      status == 'pending'
                          ? 'PENDING'
                          : status == 'partially_issued'
                              ? 'PARTIAL'
                              : 'ISSUED',
                      warning: status != 'completed',
                      success: status == 'completed',
                    ),
                    if (pending > 0)
                      Text(
                        'Bal ${_qtyText(pending)} / Req ${_qtyText(requested)}',
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.kTextSecondary,
                        ),
                      ),
                  ],
                ),
                actions: [
                  TextButton(
                    onPressed: () => _showJsonDetail(minNumber, record),
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

  Widget _receiptVerificationPage() {
    final pending = _incomingDispatches
        .where((row) => '${row['status']}'.toUpperCase() == 'IN_TRANSIT')
        .toList();
    final verified = _incomingDispatches
        .where((row) => '${row['status']}'.toUpperCase() != 'IN_TRANSIT')
        .toList();
    return _Page(
      title: 'Receipt Verification',
      subtitle:
          'Compare branch requisition, dispatch document and physical receipt before posting branch stock.',
      actions: [
        _RefreshButton(onPressed: _loadAll),
        OutlinedButton.icon(
          onPressed: _exportDispatches,
          icon: Icon(PhosphorIcons.download()),
          label: const Text('Dispatch PDF'),
        ),
      ],
      children: [
        _StatGrid(cards: [
          _StatCardData('Pending Verification', '${pending.length}',
              PhosphorIcons.clock(), AppColors.kWarning),
          _StatCardData('Verified Receipts', '${verified.length}',
              PhosphorIcons.checkCircle(), AppColors.kSuccess),
          _StatCardData(
              'Dispatched Lines',
              '${_incomingDispatches.fold<int>(0, (sum, row) => sum + _listFrom(row['items']).length)}',
              PhosphorIcons.package(),
              AppColors.kPrimary),
        ]),
        _SectionCard(
          title: 'Receipt Comparison Queue',
          child: _RecordList(
            emptyText: 'No dispatches waiting for verification',
            children: _incomingDispatches.map((dispatch) {
              final status = '${dispatch['status'] ?? ''}';
              final items = _listFrom(dispatch['items']);
              return _RecordTile(
                icon: PhosphorIcons.truck(),
                title:
                    '${dispatch['dispatch_number'] ?? dispatch['request_number'] ?? dispatch['id'] ?? 'Dispatch'}',
                subtitle:
                    '${dispatch['from_branch']?['name'] ?? 'Central Store'} -> ${dispatch['to_branch']?['name'] ?? 'Branch'} | ${items.length} lines | ${_date(dispatch['created_at'] ?? dispatch['dispatch_date'])}',
                trailing: _StatusChip(status,
                    success: status.toUpperCase() == 'CONFIRMED' ||
                        status.toUpperCase() == 'RECEIVED' ||
                        status.toUpperCase() == 'COMPLETED' ||
                        status.toUpperCase() == 'VERIFIED'),
                actions: [
                  TextButton(
                    onPressed: () =>
                        _showJsonDetail('Dispatch Document', dispatch),
                    child: const Text('View Dispatch'),
                  ),
                  if (status.toUpperCase() == 'IN_TRANSIT')
                    FilledButton(
                      onPressed: () => _showConfirmDispatch(dispatch),
                      child: const Text('Verify Receipt'),
                    ),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _departmentRequestLoggingPage() {
    final pendingReqs = _deptRequestLogs
        .where((r) => '${r['status']}'.contains('pending'))
        .length;
    final issuedReqs = _deptRequestLogs
        .where((r) =>
            '${r['status']}' == 'issued' ||
            '${r['status']}' == 'partially_issued')
        .length;
    return _Page(
      title: 'Department Request Logging',
      subtitle:
          'Log stock requests from departments for auditing. Issue directly or cross-link to the Stock Out ledger.',
      actions: [
        _RefreshButton(onPressed: _loadAll),
        OutlinedButton.icon(
          onPressed: () => _showLogRequestDialog(issueAfter: false),
          icon: Icon(PhosphorIcons.clipboardText()),
          label: const Text('Log Request'),
        ),
        FilledButton.icon(
          onPressed: () => _showLogRequestDialog(issueAfter: true),
          icon: Icon(PhosphorIcons.caretRight()),
          label: const Text('Log & Issue'),
        ),
      ],
      children: [
        _StatGrid(cards: [
          _StatCardData('Total Logged', '${_deptRequestLogs.length}',
              PhosphorIcons.clipboardText(), AppColors.kPrimary),
          _StatCardData('Pending Audit', '$pendingReqs', PhosphorIcons.clock(),
              AppColors.kWarning),
          _StatCardData('Issued', '$issuedReqs', PhosphorIcons.checkCircle(),
              AppColors.kSuccess),
        ]),
        _SectionCard(
          title: 'Logged Requests',
          child: _RecordList(
            emptyText: 'No department requests logged yet',
            children: _deptRequestLogs.map((req) {
              final status = '${req['status'] ?? 'pending_audit'}';
              final items =
                  (req['items'] as List?)?.cast<Map<String, dynamic>>() ?? [];
              final reqNumber =
                  '${req['request_number'] ?? req['id'] ?? 'REQ'}';
              final deptName =
                  '${req['department_name'] ?? req['department_code'] ?? 'Department'}';
              final canIssue = status == 'pending_audit' ||
                  status == 'approved' ||
                  status == 'partially_issued';
              return _RecordTile(
                icon: PhosphorIcons.clipboardText(),
                title: '$reqNumber — $deptName',
                subtitle:
                    '${req['requestor_name'] ?? 'Requestor'} | ${items.length} item(s) | ${_date(req['created_at'])}',
                trailing: _StatusChip(
                  status.toUpperCase().replaceAll('_', ' '),
                  warning: status.contains('pending') ||
                      status == 'partially_issued',
                  success: status == 'issued',
                ),
                actions: [
                  if (canIssue)
                    TextButton(
                      onPressed: () =>
                          _issueRequestDirect('${req['id']}', reqNumber),
                      child: const Text('Issue'),
                    ),
                  if (canIssue)
                    FilledButton.tonal(
                      onPressed: () => _preloadStockOutFromRequest(req),
                      child: const Text('Log & Issue'),
                    ),
                  TextButton(
                    onPressed: () => _showJsonDetail('Department Request', req),
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

  Future<void> _issueRequestDirect(String id, String ref) async {
    final confirmed = await _confirm('Issue all items in $ref?');
    if (!confirmed) return;
    try {
      await _repo.issueDepartmentRequest(id);
      await _loadAll();
      _showSnack('$ref issued successfully');
    } catch (error) {
      _showSnack('Issue failed: ${_errorText(error)}', error: true);
    }
  }

  void _preloadStockOutFromRequest(Map<String, dynamic> req) {
    final items = (req['items'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final lines = items
        .map((item) {
          return <String, dynamic>{
            'item_sku': '${item['item_sku'] ?? ''}',
            'item_name': '${item['item_name'] ?? item['item_sku'] ?? ''}',
            'quantity': _num(item['pending_quantity'] ?? item['quantity']),
            'unit': '${item['unit'] ?? 'units'}',
          };
        })
        .where((l) => l['item_sku'] != '' && _num(l['quantity']) > 0)
        .toList();

    if (lines.isEmpty) {
      _showSnack('No issuable items in this request', error: true);
      return;
    }
    setState(() {
      _stockOutPreloadLines = lines;
      _stockOutPreloadDeptCode = '${req['department_code'] ?? ''}';
      _stockOutPreloadRef = '${req['request_number'] ?? req['id'] ?? ''}';
      _section = BranchStorekeeperSection.stockOut;
    });
  }

  void _showLogRequestDialog({required bool issueAfter}) {
    final requestorCtrl = TextEditingController();
    final purposeCtrl = TextEditingController();
    final lines = <Map<String, dynamic>>[];
    String departmentCode = _departmentAccounts.isNotEmpty
        ? '${_departmentAccounts.first['department_code']}'
        : 'main_kitchen';
    String shiftCode = 'A';

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
            {'department_code': 'main_bar', 'department_name': 'Main Bar'},
            {
              'department_code': 'housekeeping',
              'department_name': 'Housekeeping & Maintenance'
            },
            {
              'department_code': 'back_office',
              'department_name': 'Back Office'
            },
          ];

    showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setS) {
        final totalQty =
            lines.fold<num>(0, (sum, l) => sum + _num(l['quantity']));
        return AlertDialog(
          title: Row(
            children: [
              Icon(PhosphorIcons.clipboardText(), color: AppColors.kPrimary),
              const SizedBox(width: 8),
              Text(issueAfter
                  ? 'Log Request & Go to Stock Out'
                  : 'Log Department Request'),
            ],
          ),
          content: SizedBox(
            width: 680,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          isExpanded: true,
                          initialValue: departmentCode,
                          decoration: const InputDecoration(
                            labelText: 'Department *',
                            prefixIcon: Icon(Icons.business),
                          ),
                          items: departmentOptions
                              .map((item) => DropdownMenuItem(
                                    value: '${item['department_code']}',
                                    child: Text(
                                        '${item['department_name'] ?? item['department_code']}',
                                        overflow: TextOverflow.ellipsis),
                                  ))
                              .toList(),
                          onChanged: (v) => setS(() => departmentCode = v!),
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
                          onChanged: (v) => setS(() => shiftCode = v ?? ''),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: requestorCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Requestor Name *',
                      prefixIcon: Icon(Icons.person),
                    ),
                    onChanged: (_) => setS(() {}),
                  ),
                  const SizedBox(height: 12),
                  _LineEditor(
                    catalog: _stockOptions,
                    lines: lines,
                    onChanged: () => setS(() {}),
                    quantityKey: 'quantity',
                    priceEnabled: false,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: [
                      _InfoPill('Lines', '${lines.length}'),
                      _InfoPill('Total Qty', _qtyText(totalQty)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: purposeCtrl,
                    minLines: 2,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Purpose / Notes',
                      prefixIcon: Icon(Icons.notes),
                    ),
                  ),
                  if (issueAfter) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.kPrimary.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                            color: AppColors.kPrimary.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        children: [
                          Icon(PhosphorIcons.caretRight(),
                              size: 16, color: AppColors.kPrimary),
                          const SizedBox(width: 8),
                          const Expanded(
                            child: Text(
                              'After logging, you will be taken to Stock Out to issue these items to the department.',
                              style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.kTextSecondary),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: lines.isEmpty || requestorCtrl.text.trim().isEmpty
                  ? null
                  : () async {
                      Navigator.pop(ctx);
                      try {
                        final result = await _repo.createDepartmentRequestLog({
                          'department_code': departmentCode,
                          'requestor_name': requestorCtrl.text.trim(),
                          if (shiftCode.isNotEmpty) 'shift_code': shiftCode,
                          if (purposeCtrl.text.trim().isNotEmpty)
                            'purpose': purposeCtrl.text.trim(),
                          'items': lines
                              .map((l) => {
                                    'item_sku': l['item_sku'],
                                    'item_name':
                                        l['item_name'] ?? l['item_sku'],
                                    'quantity': _num(l['quantity']),
                                    'unit': l['unit'] ?? 'units',
                                  })
                              .toList(),
                        });
                        await _loadAll();
                        _showSnack(
                            'Request ${result['request_number'] ?? ''} logged');
                        if (issueAfter) {
                          _preloadStockOutFromRequest(result);
                        }
                      } catch (error) {
                        _showSnack('Log failed: ${_errorText(error)}',
                            error: true);
                      }
                    },
              child: Text(issueAfter ? 'Log & Go to Stock Out' : 'Log Request'),
            ),
          ],
        );
      }),
    );
  }

  Widget _inventoryLedgerPage() {
    // ── aggregate stats ──────────────────────────────────────────────────────
    final movements = _inventoryTruthMovements;
    final stockIn = movements.where((r) => _num(r['quantity']) > 0).toList();
    final stockOut = movements.where((r) => _num(r['quantity']) < 0).toList();
    // Also count confirmed dispatches from central store as stock-in
    final dispatchStockIn = _incomingDispatches
        .where((d) => ['CONFIRMED', 'RECEIVED', 'VERIFIED']
            .contains('${d['status']}'.toUpperCase()))
        .fold<num>(0, (s, d) {
          final items = _listFrom(d['items']);
          return s + items.fold<num>(0, (ss, i) => ss + _num(i['received_quantity'] ?? i['dispatched_quantity'] ?? i['quantity'] ?? 0));
        });
    final totalIn = stockIn.fold<num>(0, (s, r) => s + _num(r['quantity'])) + dispatchStockIn;
    final totalOut =
        stockOut.fold<num>(0, (s, r) => s + _num(r['quantity']).abs());
    final pendingRequests = _stockRequests
        .where((r) => !['received', 'cancelled', 'rejected']
            .contains('${r['status']}'.toLowerCase()))
        .length;
    final inTransit = _incomingDispatches
        .where((r) => '${r['status']}'.toUpperCase() == 'IN_TRANSIT')
        .length;

    // ── build unified timeline ────────────────────────────────────────────────
    // Each entry: {_type, _label, _ref, _item, _qty, _sign, _status, _date, _raw}
    final timeline = <Map<String, dynamic>>[];

    for (final row in movements) {
      final qty = _num(row['quantity']);
      final type = '${row['movement_type'] ?? ''}';
      final isIn = qty > 0;
      timeline.add({
        '_type': isIn ? 'IN' : 'OUT',
        '_label': _movementLabel(type),
        '_ref': '${row['document_reference'] ?? row['movement_number'] ?? '-'}',
        '_item': _truthItemName(row),
        '_qty': qty,
        '_sign': isIn ? '+' : '',
        '_status': '',
        '_date': '${row['created_at'] ?? ''}',
        '_raw': row,
      });
    }

    for (final record in _departmentIssueJournals) {
      final ledger =
          Map<String, dynamic>.from((record['ledger'] as Map?) ?? {});
      final meta =
          Map<String, dynamic>.from((ledger['metadata'] as Map?) ?? {});
      final qty = _num(ledger['quantity']).abs();
      timeline.add({
        '_type': 'OUT',
        '_label': 'Material Issue',
        '_ref': '${meta['min_number'] ?? ledger['source_number'] ?? 'MIN'}',
        '_item':
            '${meta['item_name'] ?? ledger['item_sku'] ?? _itemName(record)}',
        '_qty': -qty,
        '_sign': '-',
        '_status': '${meta['issue_status'] ?? 'issued'}',
        '_date': '${ledger['created_at'] ?? record['created_at'] ?? ''}',
        '_raw': record,
      });
    }

    for (final dispatch in _incomingDispatches) {
      final status = '${dispatch['status'] ?? ''}';
      timeline.add({
        '_type': 'IN',
        '_label': 'Central Dispatch',
        '_ref':
            '${dispatch['dispatch_number'] ?? dispatch['reference_number'] ?? dispatch['id'] ?? '-'}',
        '_item': () {
          final items = _listFrom(dispatch['items']);
          if (items.isEmpty) return 'Dispatched goods';
          final names = items
              .map((e) => '${e['item_name'] ?? e['item_sku'] ?? ''}')
              .where((n) => n.isNotEmpty)
              .toList();
          if (names.isEmpty) return 'Dispatched goods';
          if (names.length == 1) return names.first;
          return '${names.first} + ${names.length - 1} more';
        }(),
        '_qty': () {
          final dispItems = _listFrom(dispatch['items']);
          if (dispItems.isEmpty) return _num(dispatch['total_quantity'] ?? dispatch['quantity'] ?? 0);
          return dispItems.fold<num>(0, (s, i) => s + _num(i['dispatched_quantity'] ?? i['quantity'] ?? 0));
        }(),
        '_sign': '+',
        '_status': status,
        '_date': '${dispatch['created_at'] ?? dispatch['dispatched_at'] ?? ''}',
        '_raw': dispatch,
      });
    }

    // sort descending by date
    timeline.sort((a, b) {
      final da = DateTime.tryParse('${a['_date']}') ?? DateTime(2000);
      final db = DateTime.tryParse('${b['_date']}') ?? DateTime(2000);
      return db.compareTo(da);
    });

    // ── apply filter ─────────────────────────────────────────────────────────
    final filtered = _ledgerFilter == 'ALL'
        ? timeline
        : _ledgerFilter == 'REQUESTS'
            ? <Map<String, dynamic>>[]
            : timeline.where((r) => r['_type'] == _ledgerFilter).toList();

    final stockRequestsFiltered = _stockRequests.toList()
      ..sort((a, b) {
        final da = DateTime.tryParse('${a['created_at']}') ?? DateTime(2000);
        final db = DateTime.tryParse('${b['created_at']}') ?? DateTime(2000);
        return db.compareTo(da);
      });

    return _Page(
      title: 'Inventory Ledger',
      subtitle:
          'Live stock movement monitor: branch receipts, department issues, central store requests and in-transit dispatches.',
      actions: [
        _RefreshButton(onPressed: _loadAll),
        OutlinedButton.icon(
          onPressed: _exportStockLedger,
          icon: Icon(PhosphorIcons.download()),
          label: const Text('Export'),
        ),
      ],
      children: [
        // ── stat strip ────────────────────────────────────────────────────────
        _StatGrid(cards: [
          _StatCardData('Stock IN', _qtyText(totalIn), PhosphorIcons.trendUp(),
              AppColors.kSuccess),
          _StatCardData('Stock OUT', _qtyText(totalOut),
              PhosphorIcons.trendDown(), AppColors.kError),
          _StatCardData(
              'Net Movement',
              '${totalIn - totalOut >= 0 ? '+' : ''}${_qtyText(totalIn - totalOut)}',
              PhosphorIcons.arrowsLeftRight(),
              totalIn >= totalOut ? AppColors.kPrimary : AppColors.kWarning),
          _StatCardData('Pending Requests', '$pendingRequests',
              PhosphorIcons.clock(), AppColors.kWarning),
          _StatCardData('In Transit', '$inTransit', PhosphorIcons.truck(),
              AppColors.kPrimary),
          _StatCardData('MINs Issued', '${_departmentIssueJournals.length}',
              PhosphorIcons.clipboardText(), AppColors.kError),
        ]),

        // ── filter bar ────────────────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Wrap(
            spacing: 8,
            children: [
              for (final f in ['ALL', 'IN', 'OUT', 'REQUESTS'])
                ChoiceChip(
                  label: Text(f == 'IN'
                      ? 'Stock IN'
                      : f == 'OUT'
                          ? 'Stock OUT'
                          : f == 'REQUESTS'
                              ? 'Central Requests'
                              : 'All Movements'),
                  selected: _ledgerFilter == f,
                  selectedColor: AppColors.kPrimary.withValues(alpha: 0.15),
                  onSelected: (_) => setState(() => _ledgerFilter = f),
                ),
            ],
          ),
        ),

        // ── REQUESTS view ─────────────────────────────────────────────────────
        if (_ledgerFilter == 'REQUESTS') ...[
          _SectionCard(
            title: 'Central Store Requests',
            child: _RecordList(
              emptyText: 'No central store requests found',
              children: stockRequestsFiltered.take(100).map((req) {
                final status = '${req['status'] ?? 'pending'}';
                final statusUp = status.toUpperCase();
                final isReceived = statusUp == 'RECEIVED';
                final isPending = statusUp.contains('PENDING');
                final isDispatched =
                    statusUp == 'DISPATCHED' || statusUp == 'IN_TRANSIT';
                final nextStep = _stockRequestNextStep(status);
                final items = (req['items'] as List?)?.cast<Map>() ?? [];
                final totalQty = items.fold<num>(
                    0,
                    (s, item) =>
                        s +
                        _num(item['quantity'] ?? item['requested_quantity']));
                return _RecordTile(
                  icon: isReceived
                      ? PhosphorIcons.checkCircle()
                      : isDispatched
                          ? PhosphorIcons.truck()
                          : isPending
                              ? PhosphorIcons.clock()
                              : PhosphorIcons.package(),
                  title:
                      '${req['request_number'] ?? req['requisition_number'] ?? req['id']}',
                  subtitle:
                      '${_movementLabel(status)} | ${items.length} item(s) — ${_qtyText(totalQty)} units | ${_date(req['created_at'])}',
                  trailing: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      _StatusChip(
                        _movementLabel(status),
                        success: isReceived,
                        warning: isPending || isDispatched,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        nextStep,
                        style: const TextStyle(
                            fontSize: 10, color: AppColors.kTextSecondary),
                      ),
                    ],
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => _showJsonDetail('Stock Request', req),
                      child: const Text('View'),
                    ),
                  ],
                );
              }).toList(),
            ),
          ),
          _SectionCard(
            title: 'Incoming Dispatches',
            child: _RecordList(
              emptyText: 'No dispatches found',
              children: _incomingDispatches.take(60).map((dispatch) {
                final status = '${dispatch['status'] ?? ''}';
                final isInTransit = status.toUpperCase() == 'IN_TRANSIT';
                final isVerified = status.toUpperCase() == 'VERIFIED' ||
                    status.toUpperCase() == 'RECEIVED';
                return _RecordTile(
                  icon: isInTransit
                      ? PhosphorIcons.truck()
                      : isVerified
                          ? PhosphorIcons.checkCircle()
                          : PhosphorIcons.package(),
                  title:
                      '${dispatch['dispatch_number'] ?? dispatch['reference_number'] ?? dispatch['id'] ?? 'Dispatch'}',
                  subtitle:
                      '${_movementLabel(status)} | ${_date(dispatch['dispatched_at'] ?? dispatch['created_at'])}',
                  trailing: _StatusChip(
                    _movementLabel(status),
                    warning: isInTransit,
                    success: isVerified,
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => _showJsonDetail('Dispatch', dispatch),
                      child: const Text('View'),
                    ),
                  ],
                );
              }).toList(),
            ),
          ),
        ] else ...[
          // ── movement timeline ────────────────────────────────────────────────
          _SectionCard(
            title: _ledgerFilter == 'IN'
                ? 'Stock IN — Receipts & Dispatches'
                : _ledgerFilter == 'OUT'
                    ? 'Stock OUT — Issues & MINs'
                    : 'Stock Movement Timeline',
            child: _RecordList(
              emptyText: 'No movements found for this filter',
              children: filtered.take(150).map((entry) {
                final isIn = entry['_type'] == 'IN';
                final qty = _num(entry['_qty']);
                final sign = isIn ? '+' : '-';
                final color = isIn ? AppColors.kSuccess : AppColors.kError;
                final icon =
                    isIn ? PhosphorIcons.trendUp() : PhosphorIcons.trendDown();
                final entryStatus = '${entry['_status'] ?? ''}';
                return _RecordTile(
                  icon: icon,
                  title: '${entry['_item']}',
                  subtitle:
                      '${entry['_label']} | Ref: ${entry['_ref']} | ${_date(entry['_date'])}',
                  trailing: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '$sign${_qtyText(qty.abs())} units',
                        style: TextStyle(
                          color: color,
                          fontWeight: FontWeight.w800,
                          fontSize: 13,
                        ),
                      ),
                      if (entryStatus.isNotEmpty) ...[
                        const SizedBox(height: 3),
                        _StatusChip(
                          _movementLabel(entryStatus),
                          success: entryStatus == 'completed' ||
                              entryStatus == 'issued',
                          warning: entryStatus == 'pending' ||
                              entryStatus == 'partially_issued',
                        ),
                      ],
                    ],
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => _showJsonDetail('Ledger Entry',
                          entry['_raw'] as Map<String, dynamic>),
                      child: const Text('View'),
                    ),
                  ],
                );
              }).toList(),
            ),
          ),

          // ── MINs sub-section (visible in ALL and OUT) ────────────────────────
          if (_ledgerFilter != 'IN')
            _SectionCard(
              title: 'Material Issue Notes (MINs)',
              child: _RecordList(
                emptyText: 'No MIN records',
                children: _departmentIssueJournals.take(60).map((record) {
                  final ledger = Map<String, dynamic>.from(
                      (record['ledger'] as Map?) ?? {});
                  final meta = Map<String, dynamic>.from(
                      (ledger['metadata'] as Map?) ?? {});
                  final account = Map<String, dynamic>.from(
                      (record['account'] as Map?) ?? {});
                  final issued = _num(meta['issued_quantity'] ??
                      ledger['quantity'] ??
                      record['quantity']);
                  final pending = _num(meta['pending_quantity']);
                  final status = '${meta['issue_status'] ?? 'completed'}';
                  return _RecordTile(
                    icon: PhosphorIcons.trendDown(),
                    title:
                        '${meta['min_number'] ?? ledger['source_number'] ?? 'MIN'}',
                    subtitle:
                        '${meta['item_name'] ?? ledger['item_sku'] ?? _itemName(record)} '
                        '| ${account['department_name'] ?? 'Department'} '
                        '| ${_date(ledger['created_at'] ?? record['created_at'])}',
                    trailing: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          '-${_qtyText(issued)} units',
                          style: const TextStyle(
                              color: AppColors.kError,
                              fontWeight: FontWeight.w800),
                        ),
                        if (pending > 0) ...[
                          const SizedBox(height: 3),
                          Text(
                            'Bal ${_qtyText(pending)}',
                            style: const TextStyle(
                                fontSize: 11, color: AppColors.kWarning),
                          ),
                        ],
                        const SizedBox(height: 3),
                        _StatusChip(
                          status == 'completed'
                              ? 'ISSUED'
                              : status == 'partially_issued'
                                  ? 'PARTIAL'
                                  : 'PENDING',
                          success: status == 'completed',
                          warning: status != 'completed',
                        ),
                      ],
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => _showJsonDetail('MIN Record', record),
                        child: const Text('View'),
                      ),
                    ],
                  );
                }).toList(),
              ),
            ),
        ],
      ],
    );
  }

  Widget _posOutletIssuePage() {
    final outlets = _posOutletOptions;
    final selected = _selectedOutlet();
    final selectedId = selected == null ? null : _outletId(selected);
    final rawOutletRows = _stockForOutlet(selectedId);
    final query = _search.trim().toLowerCase();
    final outletRows = rawOutletRows.where((item) {
      if (query.isEmpty) return true;
      final haystack = [
        _outletItemName(item),
        _outletItemSku(item),
        _outletName(item),
        _outletType(item),
        item['category'],
      ].join(' ').toLowerCase();
      return haystack.contains(query);
    }).toList();
    final outletValue = outletRows.fold<num>(
      0,
      (sum, item) =>
          sum +
          (_num(item['current_stock'] ?? item['quantity']) *
              _num(item['cost_price'] ?? item['unit_cost'])),
    );
    final available = outletRows
        .where((item) => _num(item['current_stock'] ?? item['quantity']) > 0)
        .length;
    final lowStock = outletRows.where((item) {
      final status = _outletStockStatus(item);
      return status == 'low_stock' ||
          status == 'out_of_stock' ||
          status == 'production_required';
    }).length;
    final isBarSelected = selected != null &&
        (_outletType(selected).contains('bar') ||
            _barOutlets.containsKey(_outletType(selected)) ||
            _outletDisplayName(selected).toLowerCase().contains('bar'));

    return _Page(
      title: 'POS Outlet Issue',
      subtitle: isBarSelected
          ? 'Bar Stock Transfer — Issue branch store stock directly to the bar counter. No production or recipes required.'
          : 'POS outlet means a selling point such as Restaurant POS, Main Bar, Executive Bar, Sports Bar, kitchen pass, or cashier outlet. This screen issues branch-store stock into that outlet sellable counter.',
      actions: [
        _RefreshButton(onPressed: _loadAll),
        FilledButton.icon(
          onPressed:
              selected == null ? null : () => _showPosOutletIssueForm(selected),
          icon: Icon(isBarSelected
              ? Icons.local_bar_outlined
              : PhosphorIcons.package()),
          label: Text(isBarSelected ? 'Transfer to Bar' : 'Issue to POS Outlet'),
          style: isBarSelected
              ? FilledButton.styleFrom(backgroundColor: Colors.amber.shade700)
              : null,
        ),
        if (!isBarSelected)
          OutlinedButton.icon(
            onPressed: () => setState(
                () => _section = BranchStorekeeperSection.posOutletAssembly),
            icon: const Icon(Icons.precision_manufacturing_outlined),
            label: const Text('Production Ledger'),
          ),
      ],
      children: [
        if (isBarSelected)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.amber.shade50,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.amber.shade300),
            ),
            child: Row(
              children: [
                Icon(Icons.local_bar_outlined,
                    color: Colors.amber.shade800, size: 26),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Bar Flow: Select items from branch stock → Transfer to bar counter → '
                    'Bar stock increases → Cashier sells → Stock decrements. '
                    'When bar runs low, come back here and transfer more.',
                    style: TextStyle(
                        color: Colors.amber.shade900,
                        fontSize: 13,
                        fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          ),
        _SectionCard(
          title: 'POS Outlets',
          subtitle: isBarSelected
              ? 'Select the bar counter to transfer stock into.'
              : 'Choose the salable outlet first. Every issue updates that outlet, not generic branch stock.',
          child: outlets.isEmpty
              ? const _EmptyState(
                  'No POS outlets configured for this branch. Create or sync POS outlets first.')
              : Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: outlets.map((outlet) {
                    final id = _outletId(outlet);
                    final rows = _stockForOutlet(id);
                    return ChoiceChip(
                      selected: id == selectedId,
                      label: Text(
                        '${_outletDisplayName(outlet)} (${rows.length})',
                        overflow: TextOverflow.ellipsis,
                      ),
                      avatar: const Icon(Icons.storefront_outlined, size: 18),
                      onSelected: (_) => _selectOutlet(id),
                    );
                  }).toList(),
                ),
        ),
        _SectionCard(
          title: 'Search Outlet Stock',
          child: TextField(
            controller: TextEditingController(text: _search)
              ..selection = TextSelection.collapsed(offset: _search.length),
            decoration: InputDecoration(
              labelText: selected == null
                  ? 'Search POS outlet stock'
                  : 'Search ${_outletDisplayName(selected)} stock',
              prefixIcon: const Icon(Icons.search),
            ),
            onChanged: (value) => setState(() => _search = value),
          ),
        ),
        _StatGrid(cards: [
          _StatCardData('Outlet Items', '${outletRows.length}',
              Icons.storefront_outlined, AppColors.kPrimary),
          _StatCardData('Available', '$available', PhosphorIcons.checkCircle(),
              AppColors.kSuccess),
          _StatCardData('Low / Zero', '$lowStock', PhosphorIcons.warning(),
              AppColors.kWarning),
          _StatCardData('Outlet Stock Value', _money(outletValue),
              PhosphorIcons.coins(), Colors.teal),
        ]),
        _SectionCard(
          title: selected == null
              ? 'POS Outlet Stock'
              : '${_outletDisplayName(selected)} Stock',
          child: _RecordList(
            emptyText: selected == null
                ? 'No outlet selected'
                : 'No stock found for ${_outletDisplayName(selected)}',
            children: outletRows.take(150).map((item) {
              final qty = _num(item['current_stock'] ?? item['quantity']);
              final opening = _num(item['opening_stock']);
              final produced = _num(item['shift_produced_quantity']);
              final sold = _num(item['shift_sales_quantity']);
              final wasted = _num(item['shift_wastage_quantity']);
              return _RecordTile(
                icon: Icons.storefront_outlined,
                title: _outletItemName(item),
                subtitle:
                    '${_outletItemSku(item)} | ${_movementLabel(_outletType(item))}\n'
                    '${_menuLinkLabel(item)} | ${_recipeInfoLine(item)}\n'
                    'Opening ${_qtyText(opening)} | Produced ${_qtyText(produced)} | Sold ${_qtyText(sold)} | Wastage ${_qtyText(wasted)}',
                trailing: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    _StatusChip(
                      _outletStockStatusLabel(item),
                      success:
                          _outletStockStatusColor(item) == AppColors.kSuccess,
                      warning:
                          _outletStockStatusColor(item) != AppColors.kSuccess,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${_qtyText(qty)} ${item['unit'] ?? 'units'}',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    Text(
                      _money(
                          qty * _num(item['cost_price'] ?? item['unit_cost'])),
                      style: const TextStyle(
                        color: AppColors.kTextSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
                actions: [
                  TextButton(
                    onPressed: selected == null
                        ? null
                        : () => _showPosOutletIssueForm(
                              selected,
                              presetOutput: item,
                            ),
                    child: const Text('Issue'),
                  ),
                ],
              );
            }).toList(),
          ),
        ),
        _SectionCard(
          title: 'Branch Stock Available for POS Outlet Issue',
          subtitle:
              'This is the source stock. Issuing is blocked by backend availability rules and records a movement ledger.',
          child: _RecordList(
            emptyText: 'No branch stock available for outlet issue',
            children: _stockOptions.take(100).map((item) {
              return _RecordTile(
                icon: PhosphorIcons.package(),
                title: _itemName(item),
                subtitle:
                    '${_optionSku(item)} | Available ${_qty(item)} | ${item['category'] ?? '-'}',
                trailing: Text(
                    _money(_num(item['unit_price'] ?? item['cost_price']))),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _outletProductionLedgerPage() {
    final productionMovements = _inventoryTruthMovements.where((movement) {
      final type = '${movement['movement_type'] ?? movement['movementType']}';
      return type.contains('production');
    }).toList();
    final outputs = productionMovements
        .where((movement) =>
            '${movement['movement_type'] ?? movement['movementType']}'
                .contains('output'))
        .toList();
    final inputs = productionMovements
        .where((movement) =>
            '${movement['movement_type'] ?? movement['movementType']}'
                .contains('consumption'))
        .toList();
    final producedQty =
        outputs.fold<num>(0, (sum, row) => sum + _num(row['quantity']));
    final consumedQty =
        inputs.fold<num>(0, (sum, row) => sum + _num(row['quantity']));
    final outlets = _posOutletOptions;
    final selectedOutlet = _selectedOutlet();
    final selectedOutletId =
        selectedOutlet == null ? null : _outletId(selectedOutlet);
    final selectedOutletDropdownId =
        outlets.any((outlet) => _outletId(outlet) == selectedOutletId)
            ? selectedOutletId
            : null;
    final outletItems = selectedOutletId == null
        ? <Map<String, dynamic>>[]
        : _stockForOutlet(selectedOutletId)
            .where((item) => _outletItemId(item).isNotEmpty)
            .toList();
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    bool isTodayMovement(Map<String, dynamic> row) {
      final rawDate = row['created_at'] ??
          row['createdAt'] ??
          row['timestamp'] ??
          row['date'];
      final parsed = DateTime.tryParse('$rawDate');
      if (parsed == null) return false;
      final local = parsed.toLocal();
      return !local.isBefore(today) &&
          local.isBefore(today.add(const Duration(days: 1)));
    }

    num producedTodayFor(Map<String, dynamic> item) {
      final itemId = _outletItemId(item);
      final sku = _outletItemSku(item);
      return outputs.fold<num>(0, (sum, row) {
        if (!isTodayMovement(row)) return sum;
        final meta = _dynamicMap(row['metadata']);
        final matchesId =
            itemId.isNotEmpty && '${meta['outlet_item_id'] ?? ''}' == itemId;
        final matchesSku =
            sku.isNotEmpty && '${row['item_sku'] ?? row['sku'] ?? ''}' == sku;
        return matchesId || matchesSku ? sum + _num(row['quantity']) : sum;
      });
    }

    final isBarOutlet = selectedOutlet != null &&
        (_outletType(selectedOutlet).contains('bar') ||
            _barOutlets.containsKey(_outletType(selectedOutlet)) ||
            _outletDisplayName(selectedOutlet).toLowerCase().contains('bar'));

    final filteredItems = outletItems.where((item) {
      final query = _search.toLowerCase().trim();
      if (query.isEmpty) return true;
      return [
        _outletItemName(item),
        _outletItemSku(item),
        item['category'],
      ].any((value) => '$value'.toLowerCase().contains(query));
    }).toList();

    return _Page(
      title: 'Outlet Production',
      subtitle: 'Select outlet, enter today produced quantity, commit.',
      actions: [
        _RefreshButton(onPressed: _loadAll),
        OutlinedButton.icon(
          onPressed: () => setState(
              () => _section = BranchStorekeeperSection.inventoryControl),
          icon: const Icon(Icons.storefront_outlined),
          label: const Text('POS Outlet Issue'),
        ),
      ],
      children: [
        _StatGrid(cards: [
          _StatCardData('Production Runs', '${outputs.length}',
              Icons.precision_manufacturing_outlined, AppColors.kPrimary),
          _StatCardData('Raw Consumed', _qtyText(consumedQty),
              PhosphorIcons.trendDown(), AppColors.kError),
          _StatCardData('Output Produced', _qtyText(producedQty),
              PhosphorIcons.trendUp(), AppColors.kSuccess),
          _StatCardData('Menu Items', '${outletItems.length}',
              Icons.storefront_outlined, Colors.teal),
        ]),
        _SectionCard(
          title: 'Stockable Assembly',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      isExpanded: true,
                      initialValue: selectedOutletDropdownId,
                      decoration: const InputDecoration(
                        labelText: 'Assembly produced from point',
                        prefixIcon: Icon(Icons.storefront_outlined),
                      ),
                      items: outlets
                          .map(
                            (outlet) => DropdownMenuItem(
                              value: _outletId(outlet),
                              child: Text(
                                _outletDisplayName(outlet),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: (value) {
                        if (value != null) _selectOutlet(value);
                      },
                    ),
                  ),
                  // ── Bar outlet redirect banner inserted below dropdown ──
                  const SizedBox(width: 12),
                  if (_outletItemsLoading)
                    const Padding(
                      padding: EdgeInsets.only(bottom: 12),
                      child: SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              if (isBarOutlet) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.amber.shade300),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.local_bar_outlined,
                          color: Colors.amber.shade800, size: 28),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Bar Outlet — Direct Stock Issue',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 15,
                                color: Colors.amber.shade900,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Bar items (beers, spirits, sodas, water, wines) are NOT produced — '
                              'they are issued directly from Branch Stock to the bar counter. '
                              'No portioning or recipe is required. '
                              'Use POS Outlet Issue to transfer stock into this bar.',
                              style: TextStyle(
                                  color: Colors.amber.shade900, fontSize: 13),
                            ),
                            const SizedBox(height: 12),
                            FilledButton.icon(
                              style: FilledButton.styleFrom(
                                  backgroundColor: Colors.amber.shade700),
                              onPressed: () => setState(() {
                                _section =
                                    BranchStorekeeperSection.inventoryControl;
                              }),
                              icon: const Icon(Icons.storefront_outlined,
                                  size: 16),
                              label: const Text('Go to POS Outlet Issue'),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ] else ...[
              TextField(
                onChanged: (value) => setState(() => _search = value),
                decoration: InputDecoration(
                  hintText: selectedOutlet == null
                      ? 'Search menu item'
                      : 'Search ${_outletDisplayName(selectedOutlet)} menu item',
                  prefixIcon: const Icon(Icons.search),
                ),
              ),
              const SizedBox(height: 12),
              _OutletProductionSheet(
                items: filteredItems,
                emptyText: selectedOutlet == null
                    ? 'Select POS outlet first'
                    : 'No menu items found for ${_outletDisplayName(selectedOutlet)}',
                itemName: _outletItemName,
                itemSku: _outletItemSku,
                currentStock: producedTodayFor,
                maxProduce: (item) => item['max_producible_quantity'] == null
                    ? null
                    : _num(item['max_producible_quantity']),
                qtyText: _qtyText,
                onCommit: selectedOutlet == null
                    ? null
                    : (item, quantity) => _commitOutletProductionItem(
                          selectedOutlet,
                          item,
                          quantity,
                        ),
                onToggleTrackStock: selectedOutlet == null
                    ? null
                    : (item, trackStock) => _toggleOutletItemTrackStock(
                          selectedOutlet,
                          item,
                          trackStock,
                        ),
              ),
              const SizedBox(height: 8),
              const Text(
                '(Double click item line to view production turns)',
                style: TextStyle(
                  color: AppColors.kError,
                  fontWeight: FontWeight.w700,
                  fontSize: 12,
                  fontStyle: FontStyle.italic,
                ),
              ),
              ], // end else (non-bar outlets)
            ],
          ),
        ),
        _SectionCard(
          title: 'Recent Production',
          child: _RecordList(
            emptyText: 'No production ledger entries yet',
            children: productionMovements.take(120).map((row) {
              final type = '${row['movement_type'] ?? row['movementType']}';
              final meta =
                  Map<String, dynamic>.from((row['metadata'] as Map?) ?? {});
              final name = meta['item_name'] ??
                  row['item_name'] ??
                  row['sku'] ??
                  row['item_sku'] ??
                  'Production Item';
              return _RecordTile(
                icon: type.contains('output')
                    ? Icons.storefront_outlined
                    : PhosphorIcons.trendDown(),
                title: '$name',
                subtitle:
                    '${_movementLabel(type)} | ${row['document_number'] ?? row['documentNumber'] ?? '-'} | ${_date(row['created_at'])}',
                trailing: _StatusChip(
                  type.contains('output') ? 'POS Stock In' : 'Raw Stock Out',
                  success: type.contains('output'),
                  warning: !type.contains('output'),
                ),
                meta: [
                  _InfoPill('Qty', _qtyText(row['quantity'])),
                  if (meta['batch_reference'] != null)
                    _InfoPill('Batch', '${meta['batch_reference']}'),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _movementGroup(String label, List<Map<String, dynamic>> rows,
      Color color, IconData icon) {
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
              final item =
                  Map<String, dynamic>.from((row['item'] as Map?) ?? {});
              final sku =
                  '${row['item_sku'] ?? row['sku'] ?? item['sku'] ?? ''}';
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
              final code =
                  '${account['department_code'] ?? row['department_code'] ?? ''}';
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
        return (
          start: fmt(today.subtract(Duration(days: today.weekday - 1))),
          end: fmt(today)
        );
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
                .where((item) => _itemSearchText(item)
                    .contains(itemSearch.trim().toLowerCase()))
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
                    onChanged: (value) =>
                        setDialogState(() => itemSearch = value),
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
                          outletCode:
                              storeType == 'bar_store' ? outletCode : null,
                          itemSkus: pickItems ? selectedSkus.toList() : null,
                        );
                        final id =
                            '${result['id'] ?? result['data']?['id'] ?? ''}';
                        if (id.isNotEmpty) {
                          await _loadAll();
                          await _loadStockTakeDetail(id);
                        }
                        _showSnack('Daily stock take initialized');
                      } catch (error) {
                        _showSnack('Failed to start stock take: $error',
                            error: true);
                      }
                    },
              child: const Text('Start'),
            ),
          ],
        );
      }),
    );
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
                        .where((item) => item['id'] != null)
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

  Future<void> _openPoCreateScreen() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const BranchPoCreateScreen()),
    );
    if (created == true) await _loadAll();
  }

  // ignore: unused_element
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

  Future<Map<String, dynamic>> _resolvePurchaseOrder(
    Map<String, dynamic> po,
  ) async {
    final id = '${po['id'] ?? ''}'.trim();
    if (id.isEmpty || id == 'null') return po;
    try {
      final detail = await _repo.purchaseOrder(id);
      return detail.isEmpty ? po : detail;
    } catch (_) {
      return po;
    }
  }

  Future<void> _showPurchaseOrderDetail(Map<String, dynamic> po) async {
    final detail = await _resolvePurchaseOrder(po);
    if (!mounted) return;
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => _PurchaseOrderDetailScreen(
          purchaseOrder: detail,
          onDownload: () => _downloadPurchaseOrderPdf(detail),
          onPrint: () => _printPurchaseOrderPdf(detail),
          onApprove: _canApprovePo(detail)
              ? () async {
                  await _poAction(detail, 'approve');
                  if (mounted) Navigator.of(context).maybePop();
                }
              : null,
          onReceive: _canReceivePo(detail)
              ? () async {
                  await _receivePurchaseOrderViaGoodsScreen(
                    detail,
                    closeCurrentRoute: true,
                  );
                }
              : null,
          onCancel: _canCancelPo(detail)
              ? () async {
                  await _poAction(detail, 'cancel');
                  if (mounted) Navigator.of(context).maybePop();
                }
              : null,
        ),
      ),
    );
  }

  bool _canApprovePo(Map<String, dynamic> po) {
    final status = '${po['status'] ?? ''}'.toLowerCase();
    return status == 'pending' || status == 'draft';
  }

  bool _canReceivePo(Map<String, dynamic> po) {
    return const {'approved', 'ordered', 'sent'}
        .contains('${po['status'] ?? ''}'.toLowerCase());
  }

  bool _canCancelPo(Map<String, dynamic> po) {
    return !const {'received', 'fully_received', 'cancelled', 'closed'}
        .contains('${po['status'] ?? ''}'.toLowerCase());
  }

  Future<void> _downloadPurchaseOrderPdf(Map<String, dynamic> po) async {
    try {
      final detail = await _resolvePurchaseOrder(po);
      final file = await _savePurchaseOrderPdf(detail);
      _showSnack('PO PDF saved to ${file.path}');
    } catch (error) {
      _showSnack('PO download failed: ${_errorText(error)}', error: true);
    }
  }

  Future<void> _printPurchaseOrderPdf(Map<String, dynamic> po) async {
    try {
      final detail = await _resolvePurchaseOrder(po);
      final bytes = await _buildPurchaseOrderPdfBytes(detail);
      await Printing.layoutPdf(
        name: '${_safePoFileName(detail)}.pdf',
        onLayout: (_) async => bytes,
      );
    } catch (error) {
      _showSnack('PO print failed: ${_errorText(error)}', error: true);
    }
  }

  Future<File> _savePurchaseOrderPdf(Map<String, dynamic> po) async {
    final bytes = await _buildPurchaseOrderPdfBytes(po);
    final directory = await getDownloadsDirectory() ??
        await getApplicationDocumentsDirectory();
    final file = File('${directory.path}/${_safePoFileName(po)}.pdf');
    await file.writeAsBytes(bytes, flush: true);
    return file;
  }

  String _safePoFileName(Map<String, dynamic> po) {
    final number = _poText(
        po, const ['po_number', 'purchase_order_number', 'id'],
        fallback: 'Purchase_Order');
    return 'PO_$number'.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
  }

  Future<Uint8List> _buildPurchaseOrderPdfBytes(
    Map<String, dynamic> po,
  ) async {
    final doc = pw.Document();
    final logo = await _loadPoPdfLogo();
    final items = _poItems(po);
    final supplier = _poMap(po['supplier']);
    final supplierName = _poSupplierName(po);
    final poNumber = _poNumber(po);
    final total = _poTotal(po);
    final subtotal = _poNum(po['subtotal'] ?? po['sub_total']);
    final tax = _poNum(po['tax_amount'] ?? po['vat_amount']);
    const primary = PdfColor.fromInt(0xFF173D5F);
    const muted = PdfColor.fromInt(0xFF667085);
    const border = PdfColor.fromInt(0xFFD0D5DD);
    const soft = PdfColor.fromInt(0xFFF7F9FC);

    pw.Widget moneyLine(String label, num value, {bool bold = false}) {
      return pw.Padding(
        padding: const pw.EdgeInsets.only(top: 7),
        child: pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text(label,
                style: pw.TextStyle(
                    fontSize: bold ? 12 : 10,
                    fontWeight:
                        bold ? pw.FontWeight.bold : pw.FontWeight.normal)),
            pw.Text(_poMoney(value),
                style: pw.TextStyle(
                    fontSize: bold ? 12 : 10,
                    fontWeight:
                        bold ? pw.FontWeight.bold : pw.FontWeight.normal)),
          ],
        ),
      );
    }

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.fromLTRB(38, 34, 38, 38),
        footer: (context) => pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text('FamousGate Hotels - Branch Store Purchase Order',
                style:
                    const pw.TextStyle(fontSize: 8, color: PdfColors.grey600)),
            pw.Text('Page ${context.pageNumber} of ${context.pagesCount}',
                style:
                    const pw.TextStyle(fontSize: 8, color: PdfColors.grey600)),
          ],
        ),
        build: (context) => [
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              if (logo != null)
                pw.Image(logo, width: 74, height: 74, fit: pw.BoxFit.contain)
              else
                pw.Container(
                  width: 74,
                  height: 74,
                  alignment: pw.Alignment.center,
                  decoration: pw.BoxDecoration(
                    border: pw.Border.all(color: border),
                    borderRadius: pw.BorderRadius.circular(4),
                  ),
                  child: pw.Text('FG',
                      style: pw.TextStyle(
                          fontSize: 22,
                          fontWeight: pw.FontWeight.bold,
                          color: primary)),
                ),
              pw.Spacer(),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text('PURCHASE ORDER',
                      style: pw.TextStyle(
                          fontSize: 22,
                          color: primary,
                          fontWeight: pw.FontWeight.bold)),
                  pw.SizedBox(height: 8),
                  pw.Text('PO: $poNumber',
                      style: pw.TextStyle(
                          fontSize: 11, fontWeight: pw.FontWeight.bold)),
                  pw.Text('Status: ${_poStatusLabel(po).toUpperCase()}',
                      style: const pw.TextStyle(fontSize: 10, color: muted)),
                  pw.Text('Date: ${_poDate(po['po_date'] ?? po['created_at'])}',
                      style: const pw.TextStyle(fontSize: 10, color: muted)),
                ],
              ),
            ],
          ),
          pw.SizedBox(height: 16),
          pw.Container(height: 1, color: border),
          pw.SizedBox(height: 18),
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Expanded(
                child: _poPdfBlock('Supplier', [
                  supplierName,
                  _poText(supplier, const ['supplier_code', 'code']),
                  _poText(supplier, const ['contact_person', 'contact_name']),
                  _poText(supplier, const ['phone', 'contact_phone']),
                  _poText(supplier, const ['email']),
                ]),
              ),
              pw.SizedBox(width: 26),
              pw.Expanded(
                child: _poPdfBlock('Order Details', [
                  'Expected delivery: ${_poDate(po['expected_delivery'] ?? po['expected_delivery_date'])}',
                  'Payment terms: ${_poText(po, const [
                        'payment_terms'
                      ], fallback: 'Credit 30 days')}',
                  'Source: ${_poStatusTitle(_poText(po, const [
                        'source_module'
                      ], fallback: 'branch store'))}',
                  'Created: ${_poDate(po['created_at'])}',
                ]),
              ),
            ],
          ),
          pw.SizedBox(height: 20),
          pw.TableHelper.fromTextArray(
            headers: const [
              '#',
              'Item',
              'SKU',
              'Ordered',
              'Received',
              'Pending',
              'Unit',
              'Unit Price',
              'Total'
            ],
            data: [
              for (var i = 0; i < items.length; i++)
                [
                  '${i + 1}',
                  _poItemName(items[i]),
                  _poItemSku(items[i]),
                  _poQty(_poOrderedQty(items[i])),
                  _poQty(_poReceivedQty(items[i])),
                  _poQty(_poPendingQty(items[i])),
                  _poItemUnit(items[i]),
                  _poMoney(_poNum(items[i]['unit_price'])),
                  _poMoney(_poLineTotal(items[i])),
                ],
            ],
            headerStyle: pw.TextStyle(
                color: PdfColors.white,
                fontWeight: pw.FontWeight.bold,
                fontSize: 7.5),
            headerDecoration: const pw.BoxDecoration(color: primary),
            oddRowDecoration: const pw.BoxDecoration(color: soft),
            cellStyle: const pw.TextStyle(fontSize: 7.5),
            cellPadding:
                const pw.EdgeInsets.symmetric(horizontal: 4, vertical: 6),
            columnWidths: {
              0: const pw.FixedColumnWidth(20),
              1: const pw.FlexColumnWidth(2.7),
              2: const pw.FlexColumnWidth(2.1),
              3: const pw.FlexColumnWidth(1),
              4: const pw.FlexColumnWidth(1),
              5: const pw.FlexColumnWidth(1),
              6: const pw.FlexColumnWidth(1),
              7: const pw.FlexColumnWidth(1.2),
              8: const pw.FlexColumnWidth(1.2),
            },
            cellAlignments: {
              0: pw.Alignment.centerLeft,
              1: pw.Alignment.centerLeft,
              2: pw.Alignment.centerLeft,
              3: pw.Alignment.centerRight,
              4: pw.Alignment.centerRight,
              5: pw.Alignment.centerRight,
              6: pw.Alignment.centerLeft,
              7: pw.Alignment.centerRight,
              8: pw.Alignment.centerRight,
            },
          ),
          pw.SizedBox(height: 16),
          pw.Align(
            alignment: pw.Alignment.centerRight,
            child: pw.Container(
              width: 230,
              padding: const pw.EdgeInsets.all(12),
              decoration: pw.BoxDecoration(
                border: pw.Border.all(color: border),
                borderRadius: pw.BorderRadius.circular(4),
              ),
              child: pw.Column(
                children: [
                  moneyLine('Subtotal', subtotal == 0 ? total : subtotal),
                  moneyLine('VAT / Tax', tax),
                  moneyLine('Grand Total', total, bold: true),
                ],
              ),
            ),
          ),
          if (_poText(po, const ['notes', 'special_instructions']).isNotEmpty)
            pw.Padding(
              padding: const pw.EdgeInsets.only(top: 18),
              child: _poPdfBlock('Notes', [
                _poText(po, const ['notes', 'special_instructions']),
              ]),
            ),
          pw.SizedBox(height: 34),
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              _poSignature('Prepared By'),
              _poSignature('Approved By'),
              _poSignature('Supplier Acknowledgement'),
            ],
          ),
        ],
      ),
    );

    return doc.save();
  }

  pw.Widget _poPdfBlock(String title, List<String> lines) {
    final visible = lines
        .map((line) => line.trim())
        .where((line) => line.isNotEmpty && line != '-' && line != 'null')
        .toList();
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(title.toUpperCase(),
            style: pw.TextStyle(
                fontSize: 10,
                color: const PdfColor.fromInt(0xFF173D5F),
                fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 6),
        ...visible.map((line) => pw.Padding(
              padding: const pw.EdgeInsets.only(bottom: 3),
              child: pw.Text(line, style: const pw.TextStyle(fontSize: 9)),
            )),
      ],
    );
  }

  pw.Widget _poSignature(String label) {
    return pw.Container(
      width: 145,
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Container(height: 1, color: PdfColors.black),
          pw.SizedBox(height: 6),
          pw.Text(label, style: const pw.TextStyle(fontSize: 9)),
        ],
      ),
    );
  }

  Future<pw.MemoryImage?> _loadPoPdfLogo() async {
    try {
      final data = await rootBundle.load('assets/frontend_public/fglogo.png');
      return pw.MemoryImage(data.buffer.asUint8List());
    } catch (_) {
      return null;
    }
  }

  Future<void> _poAction(Map<String, dynamic> po, String action) async {
    try {
      final id = '${po['id']}';
      if (action == 'approve') await _repo.approvePurchaseOrder(id);
      if (action == 'receive') {
        await _receivePurchaseOrderViaGoodsScreen(po);
        return;
      }
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
            width: 760,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.blue.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.blue.shade200),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.warehouse_outlined,
                            size: 18, color: Colors.blue.shade700),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Quantities shown are current Central Store stock. '
                            'Items turning orange/red mean your request exceeds what central has available.',
                            style: TextStyle(
                                fontSize: 12,
                                color: Colors.blue.shade900,
                                fontWeight: FontWeight.w500),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  _LineEditor(
                    catalog: _catalog,
                    lines: lines,
                    onChanged: () => setDialogState(() {}),
                    priceEnabled: false,
                    quantityKey: 'requested_quantity',
                    showCentralAvailable: true,
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

  Future<void> _showRequisitionRelatedActivity(Map<String, dynamic> req) async {
    final id = '${req['id']}';
    try {
      final activity = await _repo.getKitchenRequisitionRelatedActivity(id);
      if (!mounted) return;
      final grns = _listFrom(activity['grns']);
      final usageEntries = _listFrom(activity['usageEntries']);
      final wastageEntries = _listFrom(activity['wastageEntries']);
      final issueEntries = _listFrom(activity['issueEntries']);
      final ledgerEntries = _listFrom(activity['ledgerEntries']);

      showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text('Related Activity — ${req['requisition_number'] ?? req['id']}'),
          content: SizedBox(
            width: 720,
            height: 520,
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (grns.isNotEmpty) ...[
                    _RelatedSection(
                      title: 'GRN Receipts',
                      count: grns.length,
                      children: grns.map((g) => ListTile(
                        dense: true,
                        leading: const Icon(Icons.receipt_long_outlined),
                        title: Text('GRN #${g['grn_number'] ?? g['id']}'),
                        subtitle: Text('${_date(g['created_at'] ?? g['received_at'])} | ${_listFrom(g['items']).length} items'),
                      )).toList(),
                    ),
                    const Divider(),
                  ],
                  if (ledgerEntries.isNotEmpty) ...[
                    _RelatedSection(
                      title: 'Stock Ledger',
                      count: ledgerEntries.length,
                      children: ledgerEntries.map((l) => ListTile(
                        dense: true,
                        leading: const Icon(Icons.account_balance_outlined),
                        title: Text('${l['item_name'] ?? l['item_sku']}'),
                        subtitle: Text('${l['transaction_type']} | Qty ${_num(l['quantity_in']) > 0 ? '+${_num(l['quantity_in'])}' : '-${_num(l['quantity_out'])}'} | Balance ${_num(l['closing_balance'])}'),
                      )).toList(),
                    ),
                    const Divider(),
                  ],
                  if (usageEntries.isNotEmpty) ...[
                    _RelatedSection(
                      title: 'Kitchen Usage',
                      count: usageEntries.length,
                      children: usageEntries.map((u) => ListTile(
                        dense: true,
                        leading: const Icon(Icons.restaurant_outlined),
                        title: Text('${u['item_name'] ?? u['item_sku']}'),
                        subtitle: Text('${_date(u['usage_date'])} | ${_num(u['quantity'])} ${u['unit_of_measure'] ?? ''} | ${u['usage_type'] ?? 'CONSUMPTION'}'),
                      )).toList(),
                    ),
                    const Divider(),
                  ],
                  if (wastageEntries.isNotEmpty) ...[
                    _RelatedSection(
                      title: 'Wastage',
                      count: wastageEntries.length,
                      children: wastageEntries.map((w) => ListTile(
                        dense: true,
                        leading: const Icon(Icons.delete_outline),
                        title: Text('${w['item_name'] ?? w['item_sku']}'),
                        subtitle: Text('${_date(w['wastage_date'])} | ${_num(w['quantity'])} ${w['unit_of_measure'] ?? ''} | ${w['reason'] ?? ''}'),
                      )).toList(),
                    ),
                    const Divider(),
                  ],
                  if (issueEntries.isNotEmpty) ...[
                    _RelatedSection(
                      title: 'Department Issues',
                      count: issueEntries.length,
                      children: issueEntries.map((i) => ListTile(
                        dense: true,
                        leading: const Icon(Icons.assignment_return_outlined),
                        title: Text('${i['item_name'] ?? i['item_sku']}'),
                        subtitle: Text('${_date(i['issued_at'])} | Dept: ${i['department_code'] ?? i['department_name'] ?? ''} | ${_num(i['quantity'])}'),
                      )).toList(),
                    ),
                  ],
                  if (grns.isEmpty && usageEntries.isEmpty && wastageEntries.isEmpty && issueEntries.isEmpty && ledgerEntries.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(24),
                      child: Center(child: Text('No related activity found yet.')),
                    ),
                ],
              ),
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
    } catch (error) {
      _showSnack('Failed to load related activity: $error', error: true);
    }
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

  void _showKitchenUsageEntry(
    Map<String, dynamic> record, {
    String initialType = 'CONSUMED',
  }) {
    final quantity = TextEditingController();
    final reason = TextEditingController();
    final producedItem = TextEditingController();
    final portionsProduced = TextEditingController();
    final notes = TextEditingController();
    String usageType = initialType;
    final remaining = _num(record['remaining_quantity']);
    showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setDialogState) {
        final typeColor = _usageTypeColor(usageType);
        return AlertDialog(
          title: Text('Record ${_usageTypeLabel(usageType)}'),
          content: SizedBox(
            width: 520,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${record['item_name'] ?? record['item_sku']}',
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${record['item_sku'] ?? '-'} | Remaining ${_qtyText(remaining)} of ${_qtyText(record['received_quantity'])}',
                    style: const TextStyle(
                      color: AppColors.kTextSecondary,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    initialValue: usageType,
                    isExpanded: true,
                    decoration: InputDecoration(
                      labelText: 'Usage type',
                      prefixIcon:
                          Icon(Icons.fact_check_outlined, color: typeColor),
                    ),
                    items: const [
                      DropdownMenuItem(
                          value: 'CONSUMED', child: Text('Consumed / Used')),
                      DropdownMenuItem(value: 'SPOILT', child: Text('Spoilt')),
                      DropdownMenuItem(value: 'LOST', child: Text('Lost')),
                      DropdownMenuItem(
                          value: 'DAMAGED', child: Text('Damaged')),
                      DropdownMenuItem(
                          value: 'EXPIRED', child: Text('Expired')),
                      DropdownMenuItem(
                          value: 'RETURNED', child: Text('Returned to Store')),
                    ],
                    onChanged: (value) =>
                        setDialogState(() => usageType = value ?? usageType),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: quantity,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: 'Quantity',
                      helperText:
                          'Cannot exceed remaining ${_qtyText(remaining)}',
                      prefixIcon: const Icon(Icons.numbers),
                    ),
                  ),
                  if (usageType == 'CONSUMED') ...[
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: producedItem,
                            decoration: const InputDecoration(
                              labelText: 'Produced item / menu output',
                              prefixIcon: Icon(Icons.restaurant_menu),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        SizedBox(
                          width: 160,
                          child: TextField(
                            controller: portionsProduced,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: 'Portions',
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 12),
                  TextField(
                    controller: reason,
                    decoration: InputDecoration(
                      labelText: usageType == 'CONSUMED'
                          ? 'Purpose / service reason'
                          : 'Reason',
                      prefixIcon: const Icon(Icons.notes_outlined),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: notes,
                    minLines: 2,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Notes',
                      prefixIcon: Icon(Icons.comment_outlined),
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
              onPressed: () async {
                final qty = num.tryParse(quantity.text.trim()) ?? 0;
                if (qty <= 0) {
                  _showSnack('Enter a quantity greater than zero', error: true);
                  return;
                }
                if (qty > remaining) {
                  _showSnack('Quantity exceeds remaining stock', error: true);
                  return;
                }
                Navigator.pop(context);
                try {
                  await _repo.addKitchenUsageEntry('${record['id']}', {
                    'usage_type': usageType,
                    'quantity': qty,
                    'reason': reason.text.trim(),
                    'notes': notes.text.trim(),
                    if (usageType == 'CONSUMED') ...{
                      'produced_item': producedItem.text.trim(),
                      'portions_produced':
                          num.tryParse(portionsProduced.text.trim()) ?? 0,
                    },
                  });
                  await _loadAll();
                  _showSnack('${_usageTypeLabel(usageType)} entry recorded');
                } catch (error) {
                  _showSnack('Usage entry failed: $error', error: true);
                }
              },
              child: const Text('Save Entry'),
            ),
          ],
        );
      }),
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
    final entriesFuture = _repo.kitchenUsageEntries('${record['id']}');
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('${record['item_name'] ?? record['item_sku']} Ledger'),
        content: SizedBox(
          width: 760,
          child: FutureBuilder<List<Map<String, dynamic>>>(
            future: entriesFuture,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const SizedBox(
                  height: 180,
                  child: Center(child: CircularProgressIndicator()),
                );
              }
              if (snapshot.hasError) {
                return Text('Could not load usage ledger: ${snapshot.error}');
              }
              final entries = snapshot.data ?? const <Map<String, dynamic>>[];
              final issued = _num(record['received_quantity']);
              final consumed = _num(record['consumed_quantity']);
              final spoilage = _num(record['spoilt_quantity']) +
                  _num(record['lost_quantity']) +
                  _num(record['damaged_quantity']) +
                  _num(record['expired_quantity']);
              final returned = _num(record['returned_quantity']);
              final remaining = _num(record['remaining_quantity']);
              return SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _InfoPill('Issued', _qtyText(issued)),
                        _InfoPill('Consumed', _qtyText(consumed)),
                        _InfoPill('Spoilage/Loss', _qtyText(spoilage)),
                        _InfoPill('Returned', _qtyText(returned)),
                        _InfoPill('Remaining', _qtyText(remaining)),
                        _InfoPill('Status', '${record['status'] ?? '-'}'),
                      ],
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Usage Entries',
                      style: TextStyle(fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 8),
                    if (entries.isEmpty)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.grey.shade200),
                        ),
                        child: const Center(
                          child: Text('No consumption or spoilage entries yet'),
                        ),
                      )
                    else
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: DataTable(
                          headingRowColor:
                              WidgetStatePropertyAll(Colors.grey.shade100),
                          columns: const [
                            DataColumn(label: Text('Date')),
                            DataColumn(label: Text('Type')),
                            DataColumn(label: Text('Qty'), numeric: true),
                            DataColumn(label: Text('Responsible')),
                            DataColumn(label: Text('Reason')),
                            DataColumn(label: Text('Notes')),
                          ],
                          rows: entries.map((entry) {
                            final usageType = '${entry['usage_type'] ?? ''}';
                            return DataRow(cells: [
                              DataCell(Text(_date(entry['created_at']))),
                              DataCell(_StatusChip(
                                _usageTypeLabel(usageType),
                                success: usageType == 'CONSUMED' ||
                                    usageType == 'RETURNED',
                                warning: usageType == 'SPOILT',
                              )),
                              DataCell(Text(_qtyText(entry['quantity']))),
                              DataCell(Text(
                                  '${entry['responsible_staff_name'] ?? entry['responsible_staff']?['full_name'] ?? entry['recorded_by_name'] ?? '-'}')),
                              DataCell(SizedBox(
                                width: 180,
                                child: Text(
                                  '${entry['reason'] ?? '-'}',
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              )),
                              DataCell(SizedBox(
                                width: 220,
                                child: Text(
                                  '${entry['notes'] ?? '-'}',
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              )),
                            ]);
                          }).toList(),
                        ),
                      ),
                  ],
                ),
              );
            },
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

  // Departments that represent a one-off service event and therefore need a
  // name (and, except breakfast, a pax count) recorded against each issue.
  static const _eventDepartments = {
    'buffet': (label: 'Buffet Name', pax: true),
    'outside_catering': (label: 'Event Name', pax: true),
    'accommodation_breakfast': (label: 'Guest / Room', pax: false),
  };

  void _showPosOutletIssueForm(
    Map<String, dynamic> outlet, {
    Map<String, dynamic>? presetOutput,
  }) {
    final outletId = _outletId(outlet);
    final quantity = TextEditingController();
    final notes = TextEditingController();
    Map<String, dynamic>? sourceItem;
    Map<String, dynamic>? outputItem = presetOutput;
    if (presetOutput != null) {
      final outputSku = _outletItemSku(presetOutput);
      final matches = _stockOptions.where((item) {
        return _optionSku(item) == outputSku ||
            _itemName(item).toLowerCase() ==
                _outletItemName(presetOutput).toLowerCase();
      }).toList();
      sourceItem = matches.isEmpty ? null : matches.first;
    }

    showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setDialogState) {
        final outletItems = _stockForOutlet(outletId);
        final qty = _num(quantity.text);
        final available = _num(sourceItem?['quantity']);
        final hasOutletItem = outputItem != null &&
            _outletItemId(outputItem!).isNotEmpty &&
            _outletItemSku(outputItem!).isNotEmpty;
        final canPost =
            sourceItem != null && hasOutletItem && qty > 0 && available >= qty;

        return AlertDialog(
          title: Text('Issue to ${_outletDisplayName(outlet)}'),
          content: SizedBox(
            width: 760,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _InfoPill('Outlet', _outletDisplayName(outlet)),
                  const SizedBox(height: 12),
                  _SearchPickField(
                    label: 'Source branch stock',
                    hint: 'Search item, SKU, barcode or category',
                    options: _stockOptions,
                    selected: sourceItem,
                    titleFor: _itemName,
                    subtitleFor: (item) =>
                        '${_optionSku(item)} | Available ${_qty(item)}',
                    icon: PhosphorIcons.package(),
                    onSelected: (item) =>
                        setDialogState(() => sourceItem = item),
                  ),
                  const SizedBox(height: 12),
                  _SearchPickField(
                    label: 'POS outlet item to increase',
                    hint: 'Search the selected outlet menu/stock item',
                    options: outletItems,
                    selected: outputItem,
                    titleFor: _outletItemName,
                    subtitleFor: (item) =>
                        '${_outletItemSku(item)} | Current ${_qtyText(item['current_stock'] ?? item['quantity'])} ${item['unit'] ?? 'units'}',
                    icon: Icons.storefront_outlined,
                    onSelected: (item) =>
                        setDialogState(() => outputItem = item),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: quantity,
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setDialogState(() {}),
                    decoration: InputDecoration(
                      labelText: 'Quantity to issue',
                      prefixIcon: const Icon(Icons.numbers),
                      helperText: sourceItem == null
                          ? 'Select source stock first'
                          : 'Available in branch store: ${_qtyText(available)}',
                      errorText: qty > available && sourceItem != null
                          ? 'Cannot issue more than branch stock available'
                          : null,
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: notes,
                    minLines: 2,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Notes',
                      prefixIcon: Icon(Icons.notes),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _InfoPill('Branch Stock Out', _qtyText(qty)),
                      _InfoPill('POS Outlet Stock In', _qtyText(qty)),
                      if (outputItem != null)
                        _InfoPill('POS Item ID', _outletItemId(outputItem!)),
                    ],
                  ),
                  if (outletItems.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 10),
                      child: Text(
                        'This POS outlet has no stock/menu items. Sync or create POS outlet items before issuing stock to it.',
                        style: TextStyle(
                          color: AppColors.kError,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: canPost
                  ? () async {
                      Navigator.pop(context);
                      try {
                        final source = sourceItem!;
                        final output = outputItem!;
                        await _repo.createProductionRun({
                          'destination_outlet_id': outletId,
                          'production_area': 'pos_outlet_issue',
                          'batch_reference':
                              'OUT-${DateTime.now().millisecondsSinceEpoch}',
                          'inputs': [
                            {
                              'item_sku': _optionSku(source),
                              'item_name': _itemName(source),
                              'quantity': qty,
                              'unit': source['unit_of_measure'] ??
                                  source['unit'] ??
                                  'units',
                              'unit_cost': _num(source['cost_price'] ??
                                  source['unit_cost'] ??
                                  source['unit_price']),
                            }
                          ],
                          'outputs': [
                            {
                              'outlet_item_id': _outletItemId(output),
                              'item_sku': _outletItemSku(output),
                              'item_name': _outletItemName(output),
                              'quantity': qty,
                              'unit': output['unit'] ?? 'units',
                              'unit_cost': _num(output['cost_price'] ??
                                  source['cost_price'] ??
                                  source['unit_cost']),
                              'category': output['category'],
                              'metadata': {
                                'source': 'branch_store_pos_outlet_issue',
                                'source_sku': _optionSku(source),
                              },
                            }
                          ],
                          'remarks': notes.text.trim().isEmpty
                              ? 'Branch store issue to ${_outletDisplayName(outlet)}'
                              : notes.text.trim(),
                        });
                        await _loadAll();
                        _showSnack(
                            '${_qtyText(qty)} ${_outletItemName(output)} issued to ${_outletDisplayName(outlet)}');
                      } catch (error) {
                        _showSnack(
                            'POS outlet issue failed: ${_errorText(error)}',
                            error: true);
                      }
                    }
                  : null,
              child: const Text('Post Issue'),
            ),
          ],
        );
      }),
    );
  }

  Future<void> _commitOutletProductionItem(
    Map<String, dynamic> outlet,
    Map<String, dynamic> output,
    num produced, {
    String? turnReference,
    String? notes,
  }) async {
    if (produced <= 0) {
      _showSnack('Enter produced quantity', error: true);
      return;
    }
    try {
      await _repo.createProductionRun({
        'destination_outlet_id': _outletId(outlet),
        'production_area': 'outlet_production',
        'batch_reference': turnReference?.trim().isNotEmpty == true
            ? turnReference!.trim()
            : 'TURN-${DateTime.now().millisecondsSinceEpoch}',
        'outputs': [
          {
            'outlet_item_id': _outletItemId(output),
            'item_sku': _outletItemSku(output),
            'item_name': _outletItemName(output),
            'quantity': produced,
            'unit': output['unit'] ?? 'units',
            'category': output['category'],
            'metadata': {
              'source': 'outlet_production_sheet',
              'recipe_id': output['recipe_id'],
              'menu_item_id':
                  output['linked_menu_item_id'] ?? output['source_item_id'],
            },
          }
        ],
        'remarks': notes?.trim() ?? '',
      });
      await _loadAll();
      _showSnack(
        '${_qtyText(produced)} ${_outletItemName(output)} added to ${_outletDisplayName(outlet)}',
      );
    } catch (error) {
      _showSnack('Production failed: ${_errorText(error)}', error: true);
    }
  }

  Future<void> _toggleOutletItemTrackStock(
    Map<String, dynamic> outlet,
    Map<String, dynamic> item,
    bool trackStock,
  ) async {
    try {
      final outletId = _outletId(outlet);
      final itemId = _outletItemId(item);
      await _repo.patchOutletItemTrackStock(
          outletId: outletId, itemId: itemId, trackStock: trackStock);
      item['track_stock'] = trackStock;
      await _loadAll();
      _showSnack(trackStock
          ? '${_outletItemName(item)} is now tracked — requires production.'
          : '${_outletItemName(item)} marked as Always On — available in POS without stock.');
    } catch (error) {
      _showSnack('Failed to update: ${_errorText(error)}', error: true);
    }
  }

  void _showStockOutForm({
    List<Map<String, dynamic>>? preloadLines,
    String preloadDeptCode = '',
    String preloadRef = '',
  }) {
    final notes = TextEditingController();
    final eventName = TextEditingController();
    final pax = TextEditingController();
    final lines = <Map<String, dynamic>>[
      if (preloadLines != null) ...preloadLines,
    ];
    String departmentCode = preloadDeptCode.isNotEmpty
        ? preloadDeptCode
        : _departmentAccounts.isNotEmpty
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
          return stock.isEmpty || qty <= 0;
        }).toList();
        final shortfallLines = lines.where((line) {
          final stock = stockForLine(line);
          final qty = _num(line['quantity']);
          return stock.isNotEmpty && qty > _num(stock['quantity']);
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
          title: Text(preloadRef.isNotEmpty
              ? 'Issue Stock — Ref: $preloadRef'
              : 'Issue Stock to Department'),
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
                      if (shortfallLines.isNotEmpty)
                        _InfoPill(
                            'Partial/Pending', '${shortfallLines.length}'),
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
                  if (shortfallLines.isNotEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 8),
                      child: Text(
                        'Lines above available stock will issue what is available and keep the balance pending. Zero-stock lines create a pending MIN without reducing stock.',
                        style: TextStyle(
                          color: AppColors.kWarning,
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
                              errorText: eventNameMissing ? 'Required' : null,
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
              onPressed: lines.isEmpty ||
                      invalidLines.isNotEmpty ||
                      eventNameMissing
                  ? null
                  : () async {
                      Navigator.pop(context);
                      try {
                        final paxValue = int.tryParse(pax.text.trim());
                        final results = <Map<String, dynamic>>[];
                        for (final line in lines) {
                          final result = await _repo.recordDepartmentIssue({
                            'item_sku': line['item_sku'],
                            'quantity': _num(line['quantity']),
                            'department_code': departmentCode,
                            if (shiftCode.isNotEmpty) 'shift_code': shiftCode,
                            'destination_type': eventConfig != null
                                ? departmentCode
                                : 'department_issue',
                            if (eventConfig != null && eventName0.isNotEmpty)
                              'event_name': eventName0,
                            if (eventConfig != null &&
                                eventConfig.pax &&
                                paxValue != null)
                              'pax_count': paxValue,
                            'notes': notes.text,
                          });
                          results.add(result);
                        }
                        await _loadAll();
                        if (preloadLines != null) {
                          setState(() {
                            _stockOutPreloadLines = null;
                            _stockOutPreloadDeptCode = '';
                            _stockOutPreloadRef = '';
                          });
                        }
                        final statuses = results
                            .map((r) => '${r['status'] ?? ''}')
                            .where((status) => status.isNotEmpty)
                            .toSet();
                        final minNumbers = results
                            .map((r) => '${r['minNumber'] ?? ''}')
                            .where((number) => number.isNotEmpty)
                            .take(3)
                            .join(', ');
                        _showSnack(
                            'MIN recorded${minNumbers.isNotEmpty ? ': $minNumbers' : ''}${statuses.isNotEmpty ? ' (${statuses.join(', ')})' : ''}');
                      } catch (error) {
                        _showSnack('Stock out failed: ${_errorText(error)}',
                            error: true);
                      }
                    },
              child: Text(
                  shortfallLines.isEmpty ? 'Issue & Approve' : 'Create MIN'),
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
      return '${nested['item_name'] ?? nested['name'] ?? nested['description'] ?? item['item_sku'] ?? ''}';
    }
    return '${item['item_name'] ?? item['name'] ?? item['description'] ?? item['item_sku'] ?? item['sku'] ?? 'Unknown Item'}';
  }

  String _truthItemName(Map<String, dynamic> item) {
    return '${item['item_name'] ?? item['name'] ?? item['description'] ?? item['sku'] ?? item['item_sku'] ?? 'Unknown Item'}';
  }

  String _movementLabel(dynamic value) {
    final text = '$value'.trim();
    if (text.isEmpty || text == 'null') return '-';
    return text
        .split('_')
        .where((part) => part.isNotEmpty)
        .map((part) => part[0].toUpperCase() + part.substring(1))
        .join(' ');
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

  String _usageTypeLabel(dynamic value) {
    final raw = '$value'.trim().toUpperCase();
    switch (raw) {
      case 'CONSUMED':
        return 'Consumed';
      case 'SPOILT':
        return 'Spoilt';
      case 'LOST':
        return 'Lost';
      case 'DAMAGED':
        return 'Damaged';
      case 'EXPIRED':
        return 'Expired';
      case 'RETURNED':
        return 'Returned';
      default:
        return _movementLabel(raw);
    }
  }

  Color _usageTypeColor(dynamic value) {
    final raw = '$value'.trim().toUpperCase();
    if (raw == 'CONSUMED' || raw == 'RETURNED') return AppColors.kSuccess;
    if (raw == 'SPOILT' ||
        raw == 'LOST' ||
        raw == 'DAMAGED' ||
        raw == 'EXPIRED') {
      return AppColors.kError;
    }
    return AppColors.kPrimary;
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

class _RelatedSection extends StatelessWidget {
  const _RelatedSection({
    required this.title,
    required this.count,
    required this.children,
  });

  final String title;
  final int count;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.kPrimary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: AppColors.kPrimary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          ...children,
        ],
      ),
    );
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

class _SearchPickField extends StatelessWidget {
  const _SearchPickField({
    required this.label,
    required this.hint,
    required this.options,
    required this.selected,
    required this.titleFor,
    required this.subtitleFor,
    required this.icon,
    required this.onSelected,
  });

  final String label;
  final String hint;
  final List<Map<String, dynamic>> options;
  final Map<String, dynamic>? selected;
  final String Function(Map<String, dynamic>) titleFor;
  final String Function(Map<String, dynamic>) subtitleFor;
  final IconData icon;
  final ValueChanged<Map<String, dynamic>> onSelected;

  String _display(Map<String, dynamic>? item) {
    if (item == null || item.isEmpty) return '';
    final title = titleFor(item);
    final subtitle = subtitleFor(item);
    return subtitle.trim().isEmpty ? title : '$title - $subtitle';
  }

  String _searchText(Map<String, dynamic> item) =>
      '${titleFor(item)} ${subtitleFor(item)} ${item.values.join(' ')}'
          .toLowerCase();

  @override
  Widget build(BuildContext context) {
    return Autocomplete<Map<String, dynamic>>(
      key: ValueKey('$label-${_display(selected)}'),
      initialValue: TextEditingValue(text: _display(selected)),
      displayStringForOption: _display,
      optionsBuilder: (value) {
        final query = value.text.trim().toLowerCase();
        return options
            .where((item) => query.isEmpty || _searchText(item).contains(query))
            .take(50);
      },
      onSelected: onSelected,
      fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) {
        return TextField(
          controller: controller,
          focusNode: focusNode,
          decoration: InputDecoration(
            labelText: label,
            hintText: hint,
            prefixIcon: Icon(icon),
          ),
        );
      },
      optionsViewBuilder: (context, onSelected, values) {
        final rows = values.toList();
        return Align(
          alignment: Alignment.topLeft,
          child: Material(
            elevation: 8,
            borderRadius: BorderRadius.circular(12),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 720, maxHeight: 320),
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(vertical: 6),
                itemCount: rows.length,
                separatorBuilder: (_, __) =>
                    const Divider(height: 1, indent: 16, endIndent: 16),
                itemBuilder: (context, index) {
                  final item = rows[index];
                  return ListTile(
                    dense: true,
                    leading: CircleAvatar(
                      radius: 18,
                      backgroundColor:
                          AppColors.kPrimary.withValues(alpha: 0.1),
                      child: Icon(icon, size: 18, color: AppColors.kPrimary),
                    ),
                    title: Text(
                      titleFor(item),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    subtitle: Text(
                      subtitleFor(item),
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
      },
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.kSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.kDivider),
      ),
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: const TextStyle(color: AppColors.kTextSecondary),
      ),
    );
  }
}

class _OutletProductionSheet extends StatefulWidget {
  const _OutletProductionSheet({
    required this.items,
    required this.emptyText,
    required this.itemName,
    required this.itemSku,
    required this.currentStock,
    required this.maxProduce,
    required this.qtyText,
    required this.onCommit,
    this.onToggleTrackStock,
  });

  final List<Map<String, dynamic>> items;
  final String emptyText;
  final String Function(Map<String, dynamic>) itemName;
  final String Function(Map<String, dynamic>) itemSku;
  final num Function(Map<String, dynamic>) currentStock;
  final num? Function(Map<String, dynamic>) maxProduce;
  final String Function(dynamic) qtyText;
  final Future<void> Function(Map<String, dynamic>, num)? onCommit;
  final Future<void> Function(Map<String, dynamic>, bool)? onToggleTrackStock;

  @override
  State<_OutletProductionSheet> createState() => _OutletProductionSheetState();
}

class _OutletProductionSheetState extends State<_OutletProductionSheet> {
  final Map<String, TextEditingController> _controllers = {};
  bool _posting = false;

  @override
  void didUpdateWidget(covariant _OutletProductionSheet oldWidget) {
    super.didUpdateWidget(oldWidget);
    final keys = widget.items.map(_keyFor).toSet();
    for (final key in _controllers.keys.toList()) {
      if (!keys.contains(key)) {
        _controllers.remove(key)?.dispose();
      }
    }
  }

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  String _keyFor(Map<String, dynamic> item) =>
      '${item['id'] ?? item['outlet_item_id'] ?? widget.itemSku(item)}';

  TextEditingController _controllerFor(Map<String, dynamic> item) {
    final key = _keyFor(item);
    return _controllers.putIfAbsent(key, TextEditingController.new);
  }

  Future<void> _commit(Map<String, dynamic> item) async {
    final controller = _controllerFor(item);
    final quantity = num.tryParse(controller.text.trim()) ?? 0;
    if (widget.onCommit == null || quantity <= 0 || _posting) return;
    setState(() => _posting = true);
    try {
      await widget.onCommit!(item, quantity);
      controller.clear();
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  Future<void> _toggleTrackStock(
      BuildContext ctx, Map<String, dynamic> item) async {
    if (widget.onToggleTrackStock == null) return;
    final current = item['track_stock'] != false;
    final newValue = !current;
    final label = newValue ? 'Track Stock' : 'Always On (no stock required)';
    final confirmed = await showDialog<bool>(
      context: ctx,
      builder: (_) => AlertDialog(
        title: Text(newValue ? 'Enable Stock Tracking' : 'Mark as Always On'),
        content: Text(newValue
            ? 'This item will require production commits and will show out-of-stock in POS when stock hits zero.'
            : '"${item['name'] ?? item['item_name'] ?? 'This item'}" will be permanently available in POS. Stock tracking will be disabled — it won\'t block sales even at zero stock.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel')),
          FilledButton(
            style: newValue
                ? null
                : FilledButton.styleFrom(backgroundColor: Colors.green),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(label),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      setState(() => _posting = true);
      try {
        await widget.onToggleTrackStock!(item, newValue);
      } finally {
        if (mounted) setState(() => _posting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty) return _EmptyState(widget.emptyText);

    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.kDivider),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            color: AppColors.kPrimary,
            child: const Row(
              children: [
                SizedBox(width: 48, child: Text('#', style: _headerStyle)),
                Expanded(
                    flex: 3, child: Text('Item Name', style: _headerStyle)),
                Expanded(
                    flex: 2,
                    child: Text('[ Total Registered Production Of The Day ]',
                        style: _headerStyle)),
                SizedBox(
                    width: 120,
                    child: Text('Stock Control', style: _headerStyle)),
                SizedBox(
                    width: 170,
                    child: Text('Add Qty Produced', style: _headerStyle)),
                SizedBox(width: 96, child: Text('Action', style: _headerStyle)),
              ],
            ),
          ),
          ...widget.items.asMap().entries.map((entry) {
            final index = entry.key;
            final item = entry.value;
            final controller = _controllerFor(item);
            final max = widget.maxProduce(item);
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              color: index.isEven ? Colors.white : Colors.blueGrey.shade50,
              child: Row(
                children: [
                  SizedBox(width: 48, child: Text('${index + 1}')),
                  Expanded(
                    flex: 3,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.itemName(item),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        Text(
                          widget.itemSku(item),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: AppColors.kTextSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    flex: 2,
                    child: Text(
                      '[ ${widget.qtyText(widget.currentStock(item))} ]'
                      '${max == null ? '' : '  Max ${widget.qtyText(max)}'}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  // ── Stock tracking toggle ──
                  Builder(builder: (ctx) {
                    final tracked = item['track_stock'] != false;
                    return SizedBox(
                      width: 120,
                      child: GestureDetector(
                        onTap: _posting
                            ? null
                            : () => _toggleTrackStock(ctx, item),
                        child: Chip(
                          visualDensity: VisualDensity.compact,
                          padding: EdgeInsets.zero,
                          avatar: Icon(
                            tracked
                                ? Icons.track_changes_outlined
                                : Icons.all_inclusive,
                            size: 14,
                            color: tracked ? Colors.blue : Colors.green,
                          ),
                          label: Text(
                            tracked ? 'Tracked' : 'Always On',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: tracked
                                  ? Colors.blue.shade800
                                  : Colors.green.shade800,
                            ),
                          ),
                          backgroundColor: tracked
                              ? Colors.blue.shade50
                              : Colors.green.shade50,
                          side: BorderSide(
                              color: tracked
                                  ? Colors.blue.shade200
                                  : Colors.green.shade200),
                        ),
                      ),
                    );
                  }),
                  SizedBox(
                    width: 170,
                    child: TextField(
                      controller: controller,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        isDense: true,
                        hintText: '0.00',
                      ),
                      onSubmitted: (_) => _commit(item),
                    ),
                  ),
                  const SizedBox(width: 10),
                  SizedBox(
                    width: 86,
                    child: FilledButton(
                      onPressed: _posting || widget.onCommit == null
                          ? null
                          : () => _commit(item),
                      child: const Text('Commit'),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

const _headerStyle = TextStyle(
  color: Colors.white,
  fontWeight: FontWeight.w900,
  fontSize: 12,
);

class _LineEditor extends StatefulWidget {
  const _LineEditor({
    required this.catalog,
    required this.lines,
    required this.onChanged,
    this.itemIdKey,
    this.quantityKey = 'quantity',
    this.priceEnabled = true,
    this.showCentralAvailable = false,
  });

  final List<Map<String, dynamic>> catalog;
  final List<Map<String, dynamic>> lines;
  final VoidCallback onChanged;
  final String? itemIdKey;
  final String quantityKey;
  final bool priceEnabled;
  final bool showCentralAvailable;

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

  String _name(Map<String, dynamic> item) {
    final nested = item['item'];
    if (nested is Map) {
      final nestedName =
          nested['item_name'] ?? nested['name'] ?? nested['description'];
      if (nestedName != null && '$nestedName'.trim().isNotEmpty) {
        return '$nestedName';
      }
    }
    return '${item['item_name'] ?? item['name'] ?? item['description'] ?? _sku(item)}';
  }

  num _num(dynamic value) {
    if (value is num) return value;
    return num.tryParse('$value') ?? 0;
  }

  String _qty(Map<String, dynamic> item) {
    final quantity = _num(item['quantity'] ?? item['available_quantity']);
    final unit = item['item'] is Map
        ? item['item']['unit_of_measure'] ?? item['item']['unit']
        : item['unit_of_measure'] ?? item['unit'];
    return '${quantity.toStringAsFixed(quantity % 1 == 0 ? 0 : 2)} ${unit ?? 'units'}';
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
              final centralQty = _num(line['quantity'] ?? line['available_quantity']);
              final requestedQty = _num(line[widget.quantityKey] ?? 1);
              final overRequest = widget.showCentralAvailable && requestedQty > centralQty;
              final unit = line['unit_of_measure'] ?? line['unit'] ?? 'units';
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                color: overRequest ? Colors.red.shade50 : null,
                shape: overRequest
                    ? RoundedRectangleBorder(
                        side: BorderSide(color: Colors.red.shade300),
                        borderRadius: BorderRadius.circular(12))
                    : null,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              '${line['item_name'] ?? line['item_sku']}',
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                          ),
                          if (widget.showCentralAvailable) ...[
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              margin: const EdgeInsets.only(right: 8),
                              decoration: BoxDecoration(
                                color: centralQty <= 0
                                    ? Colors.red.shade100
                                    : overRequest
                                        ? Colors.orange.shade100
                                        : Colors.green.shade100,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(
                                  color: centralQty <= 0
                                      ? Colors.red.shade300
                                      : overRequest
                                          ? Colors.orange.shade300
                                          : Colors.green.shade300,
                                ),
                              ),
                              child: Text(
                                'Central: ${centralQty.toStringAsFixed(centralQty % 1 == 0 ? 0 : 2)} $unit',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: centralQty <= 0
                                      ? Colors.red.shade800
                                      : overRequest
                                          ? Colors.orange.shade800
                                          : Colors.green.shade800,
                                ),
                              ),
                            ),
                          ],
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
                      if (widget.showCentralAvailable && overRequest)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Row(
                            children: [
                              Icon(Icons.warning_amber_rounded,
                                  size: 14, color: Colors.orange.shade700),
                              const SizedBox(width: 4),
                              Text(
                                'Requesting ${requestedQty.toStringAsFixed(0)} but central only has ${centralQty.toStringAsFixed(centralQty % 1 == 0 ? 0 : 2)} $unit',
                                style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.orange.shade800,
                                    fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
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
        'available_quantity':
            _num(item['quantity'] ?? item['available_quantity']),
        'unit_of_measure': item['item'] is Map
            ? item['item']['unit_of_measure'] ?? item['item']['unit']
            : item['unit_of_measure'] ?? item['unit'],
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
  const _SectionCard({required this.title, required this.child, this.subtitle});

  final String title;
  final String? subtitle;
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
            if (subtitle != null && subtitle!.trim().isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                subtitle!,
                style: const TextStyle(
                  color: AppColors.kTextSecondary,
                  fontSize: 12,
                ),
              ),
            ],
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
    this.meta = const [],
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final List<Widget> actions;
  final List<Widget> meta;
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
                    if (meta.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Wrap(spacing: 8, runSpacing: 8, children: meta),
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
  const _StatusChip(this.label,
      {this.success = false, this.warning = false, this.error = false});

  final String label;
  final bool success;
  final bool warning;
  final bool error;

  @override
  Widget build(BuildContext context) {
    final color = success
        ? AppColors.kSuccess
        : error
            ? AppColors.kError
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

class _PurchaseOrderDetailScreen extends StatelessWidget {
  const _PurchaseOrderDetailScreen({
    required this.purchaseOrder,
    required this.onDownload,
    required this.onPrint,
    this.onApprove,
    this.onReceive,
    this.onCancel,
  });

  final Map<String, dynamic> purchaseOrder;
  final Future<void> Function() onDownload;
  final Future<void> Function() onPrint;
  final Future<void> Function()? onApprove;
  final Future<void> Function()? onReceive;
  final Future<void> Function()? onCancel;

  @override
  Widget build(BuildContext context) {
    final items = _poItems(purchaseOrder);
    final supplier = _poMap(purchaseOrder['supplier']);
    final total = _poTotal(purchaseOrder);
    final ordered =
        items.fold<num>(0, (sum, item) => sum + _poOrderedQty(item));
    final received =
        items.fold<num>(0, (sum, item) => sum + _poReceivedQty(item));
    final pending =
        items.fold<num>(0, (sum, item) => sum + _poPendingQty(item));
    final status = _poStatusLabel(purchaseOrder);
    final financeStatus = _poStatusTitle(
      _poText(
        purchaseOrder,
        const ['finance_status'],
        fallback: 'Awaiting Receipt',
      ),
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(_poNumber(purchaseOrder)),
        actions: [
          IconButton(
            tooltip: 'Download PO',
            onPressed: () => onDownload(),
            icon: Icon(PhosphorIcons.downloadSimple()),
          ),
          IconButton(
            tooltip: 'Print PO',
            onPressed: () => onPrint(),
            icon: Icon(PhosphorIcons.printer()),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1180),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _PoHeroCard(
                  po: purchaseOrder,
                  status: status,
                  actions: [
                    if (onApprove != null)
                      FilledButton.icon(
                        onPressed: () => onApprove!(),
                        icon: Icon(PhosphorIcons.checkCircle()),
                        label: const Text('Approve'),
                      ),
                    if (onReceive != null)
                      FilledButton.icon(
                        onPressed: () => onReceive!(),
                        icon: Icon(PhosphorIcons.package()),
                        label: const Text('Receive Goods'),
                      ),
                    OutlinedButton.icon(
                      onPressed: () => onDownload(),
                      icon: Icon(PhosphorIcons.downloadSimple()),
                      label: const Text('Download'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => onPrint(),
                      icon: Icon(PhosphorIcons.printer()),
                      label: const Text('Print'),
                    ),
                    if (onCancel != null)
                      TextButton.icon(
                        onPressed: () => onCancel!(),
                        icon: Icon(PhosphorIcons.xCircle()),
                        label: const Text('Cancel PO'),
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final narrow = constraints.maxWidth < 850;
                    final cards = [
                      _PoMetricCard(
                        label: 'Total Value',
                        value: _poMoney(total),
                        icon: PhosphorIcons.currencyDollar(),
                        color: AppColors.kSuccess,
                      ),
                      _PoMetricCard(
                        label: 'Line Items',
                        value: '${items.length}',
                        icon: PhosphorIcons.listChecks(),
                        color: AppColors.kPrimary,
                      ),
                      _PoMetricCard(
                        label: 'Ordered',
                        value: _poQty(ordered),
                        icon: PhosphorIcons.shoppingCart(),
                        color: Colors.indigo,
                      ),
                      _PoMetricCard(
                        label: 'Pending',
                        value: _poQty(pending),
                        icon: PhosphorIcons.clock(),
                        color: pending > 0 ? Colors.orange : AppColors.kSuccess,
                      ),
                      _PoMetricCard(
                        label: 'Finance',
                        value: financeStatus,
                        icon: PhosphorIcons.receipt(),
                        color: financeStatus.toLowerCase().contains('paid')
                            ? AppColors.kSuccess
                            : Colors.blueGrey,
                      ),
                    ];
                    return GridView.count(
                      crossAxisCount: narrow ? 2 : 5,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      childAspectRatio: narrow ? 2.8 : 3.2,
                      children: cards,
                    );
                  },
                ),
                const SizedBox(height: 16),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final narrow = constraints.maxWidth < 900;
                    final supplierPanel = _PoPanel(
                      title: 'Supplier',
                      icon: Icons.storefront,
                      children: [
                        _PoFact('Name', _poSupplierName(purchaseOrder)),
                        _PoFact('Code',
                            _poText(supplier, const ['supplier_code', 'code'])),
                        _PoFact(
                            'Contact',
                            _poText(supplier,
                                const ['contact_person', 'contact_name'])),
                        _PoFact(
                            'Phone',
                            _poText(
                                supplier, const ['phone', 'contact_phone'])),
                        _PoFact('Email', _poText(supplier, const ['email'])),
                      ],
                    );
                    final orderPanel = _PoPanel(
                      title: 'Order Details',
                      icon: PhosphorIcons.clipboardText(),
                      children: [
                        _PoFact('PO Date', _poDate(purchaseOrder['po_date'])),
                        _PoFact(
                          'Expected Delivery',
                          _poDate(purchaseOrder['expected_delivery'] ??
                              purchaseOrder['expected_delivery_date']),
                        ),
                        _PoFact(
                          'Payment Terms',
                          _poStatusTitle(_poText(
                              purchaseOrder, const ['payment_terms'],
                              fallback: 'credit 30 days')),
                        ),
                        _PoFact(
                          'Source Module',
                          _poStatusTitle(_poText(
                              purchaseOrder, const ['source_module'],
                              fallback: 'branch store')),
                        ),
                        _PoFact(
                          'Created',
                          _poDate(purchaseOrder['created_at']),
                        ),
                      ],
                    );
                    if (narrow) {
                      return Column(
                        children: [
                          SizedBox(
                              width: double.infinity, child: supplierPanel),
                          const SizedBox(height: 12),
                          SizedBox(width: double.infinity, child: orderPanel),
                        ],
                      );
                    }
                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(child: supplierPanel),
                        const SizedBox(width: 12),
                        Expanded(child: orderPanel),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 16),
                _PoPanel(
                  title: 'Items',
                  icon: PhosphorIcons.package(),
                  children: [
                    _PoItemsTable(items: items),
                  ],
                ),
                const SizedBox(height: 16),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final narrow = constraints.maxWidth < 900;
                    final timeline = _PoPanel(
                      title: 'Workflow Timeline',
                      icon: Icons.timeline,
                      children: [_PoTimeline(po: purchaseOrder)],
                    );
                    final totals = _PoPanel(
                      title: 'Totals',
                      icon: Icons.calculate,
                      children: [
                        _PoFact(
                            'Subtotal',
                            _poMoney(
                                _poNum(purchaseOrder['subtotal'] ?? total))),
                        _PoFact('VAT / Tax',
                            _poMoney(_poNum(purchaseOrder['tax_amount']))),
                        _PoFact('Discount',
                            _poMoney(_poNum(purchaseOrder['discount_amount']))),
                        _PoFact('Shipping',
                            _poMoney(_poNum(purchaseOrder['shipping_cost']))),
                        const Divider(height: 20),
                        _PoFact('Grand Total', _poMoney(total), strong: true),
                        _PoFact('Quantity Received', _poQty(received)),
                      ],
                    );
                    if (narrow) {
                      return Column(children: [
                        timeline,
                        const SizedBox(height: 12),
                        totals,
                      ]);
                    }
                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(flex: 2, child: timeline),
                        const SizedBox(width: 12),
                        Expanded(child: totals),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 16),
                _PoPanel(
                  title: 'Financial History',
                  icon: PhosphorIcons.wallet(),
                  children: [
                    _PoFinancialHistory(po: purchaseOrder),
                  ],
                ),
                if (_poText(
                        purchaseOrder, const ['notes', 'special_instructions'])
                    .isNotEmpty) ...[
                  const SizedBox(height: 16),
                  _PoPanel(
                    title: 'Notes',
                    icon: PhosphorIcons.note(),
                    children: [
                      Text(_poText(purchaseOrder,
                          const ['notes', 'special_instructions'])),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PoHeroCard extends StatelessWidget {
  const _PoHeroCard({
    required this.po,
    required this.status,
    required this.actions,
  });

  final Map<String, dynamic> po;
  final String status;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.kPrimary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(PhosphorIcons.fileText(),
                  color: AppColors.kPrimary, size: 30),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 10,
                    runSpacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        _poNumber(po),
                        style: const TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      _StatusChip(
                        status,
                        success: _poStatusIsSuccess(status),
                        warning: _poStatusIsWarning(status),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${_poSupplierName(po)} • ${_poDate(po['po_date'] ?? po['created_at'])} • Expected ${_poDate(po['expected_delivery'] ?? po['expected_delivery_date'])}',
                    style: const TextStyle(color: AppColors.kTextSecondary),
                  ),
                  const SizedBox(height: 14),
                  Wrap(spacing: 8, runSpacing: 8, children: actions),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PoMetricCard extends StatelessWidget {
  const _PoMetricCard({
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
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 20, fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    label,
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
          ],
        ),
      ),
    );
  }
}

class _PoPanel extends StatelessWidget {
  const _PoPanel({
    required this.title,
    required this.icon,
    required this.children,
  });

  final String title;
  final IconData icon;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 20, color: AppColors.kPrimary),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w900),
                ),
              ],
            ),
            const SizedBox(height: 14),
            ...children,
          ],
        ),
      ),
    );
  }
}

class _PoFact extends StatelessWidget {
  const _PoFact(this.label, this.value, {this.strong = false});

  final String label;
  final String value;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    final cleaned = value.trim().isEmpty || value == 'null' ? '-' : value;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(
              label,
              style: const TextStyle(
                color: AppColors.kTextSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          Expanded(
            child: Text(
              cleaned,
              style: TextStyle(
                fontWeight: strong ? FontWeight.w900 : FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PoItemsTable extends StatelessWidget {
  const _PoItemsTable({required this.items});

  final List<Map<String, dynamic>> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(28),
        decoration: BoxDecoration(
          color: Colors.grey.shade50,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: const Center(child: Text('No items attached to this PO')),
      );
    }

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        headingRowColor: WidgetStatePropertyAll(Colors.grey.shade100),
        columns: const [
          DataColumn(label: Text('#')),
          DataColumn(label: Text('Item')),
          DataColumn(label: Text('SKU')),
          DataColumn(label: Text('Ordered'), numeric: true),
          DataColumn(label: Text('Received'), numeric: true),
          DataColumn(label: Text('Pending'), numeric: true),
          DataColumn(label: Text('Unit')),
          DataColumn(label: Text('Unit Price'), numeric: true),
          DataColumn(label: Text('Total'), numeric: true),
        ],
        rows: [
          for (var i = 0; i < items.length; i++)
            DataRow(cells: [
              DataCell(Text('${i + 1}')),
              DataCell(SizedBox(
                width: 220,
                child: Text(
                  _poItemName(items[i]),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              )),
              DataCell(Text(_poItemSku(items[i]))),
              DataCell(Text(_poQty(_poOrderedQty(items[i])))),
              DataCell(Text(_poQty(_poReceivedQty(items[i])))),
              DataCell(Text(_poQty(_poPendingQty(items[i])))),
              DataCell(Text(_poItemUnit(items[i]))),
              DataCell(Text(_poMoney(_poNum(items[i]['unit_price'])))),
              DataCell(Text(_poMoney(_poLineTotal(items[i])))),
            ]),
        ],
      ),
    );
  }
}

class _PoTimeline extends StatelessWidget {
  const _PoTimeline({required this.po});

  final Map<String, dynamic> po;

  @override
  Widget build(BuildContext context) {
    final events = [
      ('Created', po['created_at'], Icons.add_circle_outline),
      ('Approved', po['approved_at'], PhosphorIcons.checkCircle()),
      ('Sent to Supplier', po['sent_at'], PhosphorIcons.paperPlaneTilt()),
      ('Received', po['received_at'], PhosphorIcons.package()),
      ('Last Updated', po['updated_at'], PhosphorIcons.clockCounterClockwise()),
    ].where((event) => _poDate(event.$2) != '-').toList();

    if (events.isEmpty) {
      return const Text('No workflow events recorded yet.');
    }
    return Column(
      children: events
          .map(
            (event) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: AppColors.kPrimary.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(event.$3, size: 17, color: AppColors.kPrimary),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(event.$1,
                            style:
                                const TextStyle(fontWeight: FontWeight.w800)),
                        Text(
                          _poDateTime(event.$2),
                          style: const TextStyle(
                            color: AppColors.kTextSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class _PoFinancialHistory extends StatelessWidget {
  const _PoFinancialHistory({required this.po});

  final Map<String, dynamic> po;

  @override
  Widget build(BuildContext context) {
    final grns = _poRelatedList(po, const ['grns', 'goods_receipts']);
    final invoices =
        _poRelatedList(po, const ['supplier_invoices', 'invoices']);
    final payments =
        _poRelatedList(po, const ['supplier_payments', 'payments']);
    final financeStatus = _poStatusTitle(
      _poText(po, const ['finance_status'], fallback: 'Awaiting Receipt'),
    );

    if (grns.isEmpty && invoices.isEmpty && payments.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.grey.shade50,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Text(
          'No GRN, invoice, or payment history yet. Finance status: $financeStatus.',
          style: const TextStyle(color: AppColors.kTextSecondary),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            _StatusChip(
              financeStatus,
              success: financeStatus.toLowerCase().contains('paid'),
              warning: financeStatus.toLowerCase().contains('pending') ||
                  financeStatus.toLowerCase().contains('bill'),
            ),
            _StatusChip('${grns.length} GRN${grns.length == 1 ? '' : 's'}'),
            _StatusChip(
                '${invoices.length} Invoice${invoices.length == 1 ? '' : 's'}'),
            _StatusChip(
                '${payments.length} Payment${payments.length == 1 ? '' : 's'}'),
          ],
        ),
        const SizedBox(height: 14),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            headingRowColor: WidgetStatePropertyAll(Colors.grey.shade100),
            columns: const [
              DataColumn(label: Text('Date')),
              DataColumn(label: Text('Document')),
              DataColumn(label: Text('Reference')),
              DataColumn(label: Text('Status')),
              DataColumn(label: Text('Amount'), numeric: true),
              DataColumn(label: Text('Details')),
            ],
            rows: _poFinancialRows(
              grns: grns,
              invoices: invoices,
              payments: payments,
            )
                .map(
                  (row) => DataRow(
                    cells: [
                      DataCell(Text(row['date'] ?? '-')),
                      DataCell(Text(row['document'] ?? '-')),
                      DataCell(Text(row['reference'] ?? '-')),
                      DataCell(Text(row['status'] ?? '-')),
                      DataCell(Text(row['amount'] ?? '-')),
                      DataCell(SizedBox(
                        width: 260,
                        child: Text(
                          row['details'] ?? '-',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      )),
                    ],
                  ),
                )
                .toList(),
          ),
        ),
      ],
    );
  }
}

Map<String, dynamic> _poMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return <String, dynamic>{};
}

Map<String, dynamic> _dynamicMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  if (value is String && value.trim().isNotEmpty) {
    try {
      final decoded = jsonDecode(value);
      if (decoded is Map) return Map<String, dynamic>.from(decoded);
    } catch (_) {
      return <String, dynamic>{};
    }
  }
  return <String, dynamic>{};
}

List<Map<String, dynamic>> _poItems(Map<String, dynamic> po) {
  final raw = po['items'] ??
      po['po_items'] ??
      po['purchase_order_items'] ??
      po['lines'];
  if (raw is List) {
    return raw
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }
  return <Map<String, dynamic>>[];
}

List<Map<String, dynamic>> _poRelatedList(
  Map<String, dynamic> po,
  List<String> keys,
) {
  for (final key in keys) {
    final raw = po[key];
    if (raw is List) {
      return raw
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }
  }
  return <Map<String, dynamic>>[];
}

String _poText(
  Map<String, dynamic> source,
  List<String> keys, {
  String fallback = '',
}) {
  for (final key in keys) {
    final value = source[key];
    if (value == null) continue;
    final text = '$value'.trim();
    if (text.isNotEmpty && text != 'null') return text;
  }
  return fallback;
}

List<Map<String, String>> _poFinancialRows({
  required List<Map<String, dynamic>> grns,
  required List<Map<String, dynamic>> invoices,
  required List<Map<String, dynamic>> payments,
}) {
  final rows = <Map<String, String>>[
    ...grns.map((grn) => {
          'sort_date': _poText(grn, const ['grn_date', 'created_at']),
          'date': _poDate(_poText(grn, const ['grn_date', 'created_at'])),
          'document': 'GRN',
          'reference': _poText(grn, const ['grn_number', 'id']),
          'status': _poStatusTitle(_poText(grn, const ['status'])),
          'amount': _poMoney(_poNum(grn['total_value'])),
          'details': 'Delivery note ${_poText(grn, const [
                'delivery_note_number'
              ], fallback: '-')}',
        }),
    ...invoices.map((invoice) => {
          'sort_date': _poText(invoice, const ['invoice_date', 'created_at']),
          'date':
              _poDate(_poText(invoice, const ['invoice_date', 'created_at'])),
          'document': 'Invoice',
          'reference': _poText(invoice, const ['invoice_number', 'id']),
          'status': _poStatusTitle(_poText(invoice, const ['status'])),
          'amount': _poMoney(_poNum(invoice['total_amount'])),
          'details': 'Balance ${_poMoney(_poNum(invoice['balance_due']))}',
        }),
    ...payments.map((payment) => {
          'sort_date': _poText(payment, const ['payment_date', 'created_at']),
          'date':
              _poDate(_poText(payment, const ['payment_date', 'created_at'])),
          'document': 'Payment',
          'reference': _poText(
              payment, const ['payment_number', 'reference_number', 'id']),
          'status': _poStatusTitle(_poText(payment, const ['status'])),
          'amount': _poMoney(
              _poNum(payment['allocated_amount'] ?? payment['payment_amount'])),
          'details': _poStatusTitle(
              _poText(payment, const ['payment_method'], fallback: '-')),
        }),
  ];
  rows.sort((a, b) {
    final ad = DateTime.tryParse(a['sort_date'] ?? '');
    final bd = DateTime.tryParse(b['sort_date'] ?? '');
    if (ad == null && bd == null) {
      return (b['sort_date'] ?? '').compareTo(a['sort_date'] ?? '');
    }
    if (ad == null) return 1;
    if (bd == null) return -1;
    return bd.compareTo(ad);
  });
  return rows;
}

num _poNum(dynamic value) {
  if (value is num) return value;
  return num.tryParse('$value') ?? 0;
}

String _poNumber(Map<String, dynamic> po) {
  return _poText(
      po, const ['po_number', 'purchase_order_number', 'number', 'id'],
      fallback: 'Purchase Order');
}

String _poSupplierName(Map<String, dynamic> po) {
  final supplier = _poMap(po['supplier']);
  return _poText(po, const ['supplier_name', 'vendor_name'],
      fallback: _poText(supplier, const ['name', 'supplier_name'],
          fallback: 'Supplier'));
}

String _poStatusLabel(Map<String, dynamic> po) {
  final raw = _poText(po, const ['status'], fallback: 'draft');
  final status = raw.toLowerCase();
  final items = _poItems(po);
  if (status.contains('received') && items.isNotEmpty) {
    final ordered =
        items.fold<num>(0, (sum, item) => sum + _poOrderedQty(item));
    final received =
        items.fold<num>(0, (sum, item) => sum + _poReceivedQty(item));
    if (ordered > 0 && received <= 0) return 'Awaiting GRN';
    if (ordered > 0 && received < ordered) return 'Partially Received';
  }
  return _poStatusTitle(raw);
}

String _poStatusTitle(String value) {
  return value
      .replaceAll('_', ' ')
      .replaceAll('-', ' ')
      .split(' ')
      .where((part) => part.trim().isNotEmpty)
      .map((part) => part.length <= 1
          ? part.toUpperCase()
          : '${part[0].toUpperCase()}${part.substring(1).toLowerCase()}')
      .join(' ');
}

bool _poStatusIsSuccess(String value) {
  final status = value.toLowerCase();
  return status.contains('approved') ||
      status.contains('received') ||
      status.contains('sent');
}

bool _poStatusIsWarning(String value) {
  final status = value.toLowerCase();
  return status.contains('draft') ||
      status.contains('pending') ||
      status.contains('partial');
}

String _poItemName(Map<String, dynamic> item) {
  final nested = _poMap(item['item']);
  return _poText(item, const ['item_name', 'name', 'description'],
      fallback: _poText(nested, const ['item_name', 'name', 'description'],
          fallback: _poItemSku(item)));
}

String _poItemSku(Map<String, dynamic> item) {
  final nested = _poMap(item['item']);
  return _poText(item, const ['item_id', 'item_sku', 'sku'],
      fallback:
          _poText(nested, const ['sku', 'item_sku', 'item_id'], fallback: '-'));
}

String _poItemUnit(Map<String, dynamic> item) {
  final nested = _poMap(item['item']);
  return _poText(item, const ['unit_of_measure', 'unit'],
      fallback: _poText(nested, const ['unit_of_measure', 'unit'],
          fallback: 'units'));
}

num _poOrderedQty(Map<String, dynamic> item) {
  return _poNum(item['quantity_ordered'] ??
      item['ordered_quantity'] ??
      item['quantity'] ??
      item['qty']);
}

num _poReceivedQty(Map<String, dynamic> item) {
  return _poNum(item['quantity_received'] ?? item['received_quantity']);
}

num _poPendingQty(Map<String, dynamic> item) {
  final pending = item['quantity_pending'] ?? item['pending_quantity'];
  if (pending != null) return _poNum(pending);
  final remaining = _poOrderedQty(item) - _poReceivedQty(item);
  return remaining < 0 ? 0 : remaining;
}

num _poLineTotal(Map<String, dynamic> item) {
  final stored =
      _poNum(item['total_price'] ?? item['line_total'] ?? item['total_amount']);
  if (stored > 0) return stored;
  return _poOrderedQty(item) * _poNum(item['unit_price']);
}

num _poTotal(Map<String, dynamic> po) {
  final stored = _poNum(po['total_amount'] ?? po['total'] ?? po['grand_total']);
  if (stored > 0) return stored;
  return _poItems(po).fold<num>(0, (sum, item) => sum + _poLineTotal(item));
}

String _poQty(num value) {
  if (value % 1 == 0) return value.toInt().toString();
  return value.toStringAsFixed(2).replaceFirst(RegExp(r'\.?0+$'), '');
}

String _poMoney(num value) {
  final rounded = value.toStringAsFixed(2);
  return 'KES ${rounded.endsWith('.00') ? rounded.substring(0, rounded.length - 3) : rounded}';
}

String _poDate(dynamic value) {
  if (value == null || '$value'.trim().isEmpty || '$value' == 'null') {
    return '-';
  }
  final parsed = DateTime.tryParse('$value');
  if (parsed == null) return '$value';
  return '${parsed.year.toString().padLeft(4, '0')}-${parsed.month.toString().padLeft(2, '0')}-${parsed.day.toString().padLeft(2, '0')}';
}

String _poDateTime(dynamic value) {
  if (value == null || '$value'.trim().isEmpty || '$value' == 'null') {
    return '-';
  }
  final parsed = DateTime.tryParse('$value');
  if (parsed == null) return '$value';
  final hour = parsed.hour.toString().padLeft(2, '0');
  final minute = parsed.minute.toString().padLeft(2, '0');
  return '${_poDate(value)} $hour:$minute';
}

// ─────────────────────────── FOOD CONTROL SECTION ───────────────────────────

double _fcNum(dynamic v) {
  if (v == null) return 0;
  return (v is num) ? v.toDouble() : double.tryParse('$v') ?? 0;
}

class _FoodControlSection extends ConsumerStatefulWidget {
  const _FoodControlSection({required this.stock});
  final List<Map<String, dynamic>> stock;

  @override
  ConsumerState<_FoodControlSection> createState() => _FoodControlSectionState();
}

class _FoodControlSectionState extends ConsumerState<_FoodControlSection> {
  List<Map<String, dynamic>> _recipes = [];
  bool _loading = true;
  String _stockSearch = '';
  String _recipeSearch = '';
  Map<String, dynamic>? _selectedStock;

  @override
  void initState() {
    super.initState();
    _loadRecipes();
  }

  Future<void> _loadRecipes() async {
    setState(() => _loading = true);
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      final data = await repo.getRecipes();
      if (mounted) setState(() => _recipes = data);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  static bool _isBarItem(Map<String, dynamic> s) {
    final cat = '${s['category'] ?? ''}'.toLowerCase();
    final sku = '${s['item_sku'] ?? ''}'.toLowerCase();
    final name = '${s['item_name'] ?? ''}'.toLowerCase();
    // Common bar category keywords
    return cat.contains('beer') ||
        cat.contains('spirit') ||
        cat.contains('wine') ||
        cat.contains('whisky') ||
        cat.contains('whiskey') ||
        cat.contains('vodka') ||
        cat.contains('gin') ||
        cat.contains('rum') ||
        cat.contains('brandy') ||
        cat.contains('liqueur') ||
        cat.contains('soft drink') ||
        cat.contains('soda') ||
        cat.contains('alcohol') ||
        cat.contains('bar') ||
        sku.startsWith('bar-') ||
        sku.startsWith('bev-') ||
        name.contains('beer') ||
        name.contains('soda');
  }

  List<Map<String, dynamic>> get _filteredStock {
    final q = _stockSearch.toLowerCase();
    return widget.stock.where((s) {
      if (_isBarItem(s)) return false; // bar items don't need recipes
      if (q.isEmpty) return true;
      return '${s['item_name']}'.toLowerCase().contains(q) ||
          '${s['item_sku']}'.toLowerCase().contains(q);
    }).toList();
  }

  List<Map<String, dynamic>> get _filteredRecipes {
    final q = _recipeSearch.toLowerCase();
    var list = _recipes;
    if (_selectedStock != null) {
      final sku = '${_selectedStock!['item_sku']}';
      list = list.where((r) {
        final ings = r['ingredients'];
        if (ings is! List) return false;
        return ings.any((i) => '${i['item_sku']}' == sku);
      }).toList();
    }
    if (q.isNotEmpty) {
      list = list
          .where((r) => '${r['menu_item_name']}'.toLowerCase().contains(q))
          .toList();
    }
    return list;
  }

  @override
  Widget build(BuildContext context) {
    return _Page(
      title: 'Food Control',
      subtitle: 'Recipe yield ratios — link raw ingredients to menu outputs.',
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh),
          onPressed: _loadRecipes,
          tooltip: 'Refresh',
        ),
        FilledButton.icon(
          onPressed: () => _openRecipeDialog(null),
          icon: const Icon(Icons.add, size: 16),
          label: const Text('New Recipe'),
        ),
      ],
      children: [
        // ── Two-flow info banner ──
        Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.blue.shade50,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.blue.shade200),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.info_outline, color: Colors.blue.shade700, size: 22),
              const SizedBox(width: 10),
              Expanded(
                child: RichText(
                  text: TextSpan(
                    style: TextStyle(
                        color: Colors.blue.shade900, fontSize: 13, height: 1.6),
                    children: const [
                      TextSpan(
                          text: 'Restaurant items',
                          style: TextStyle(fontWeight: FontWeight.w800)),
                      TextSpan(
                          text:
                              ' (food, snacks, meals): configure a recipe here → commit daily production in Outlet Production → ingredients auto-deducted from branch stock.\n'),
                      TextSpan(
                          text: 'Bar items',
                          style: TextStyle(fontWeight: FontWeight.w800)),
                      TextSpan(
                          text:
                              ' (beers, spirits, sodas, wines): issue directly from Branch Stock via POS Outlet Issue → bar stock increases immediately. No recipe or production needed. Bar items are excluded from this page.'),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 10),
              OutlinedButton.icon(
                onPressed: null, // navigated from parent
                icon: const Icon(Icons.local_bar_outlined, size: 16),
                label: const Text('Bar → POS Outlet Issue',
                    style: TextStyle(fontSize: 11)),
              ),
            ],
          ),
        ),
        SizedBox(
          height: MediaQuery.of(context).size.height - 260,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Left: Branch Stock ──
              SizedBox(
                width: 300,
                child: Card(
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.kPrimary,
                          borderRadius: const BorderRadius.vertical(
                              top: Radius.circular(12)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.inventory_2_outlined,
                                color: Colors.white, size: 18),
                            const SizedBox(width: 8),
                            const Expanded(
                              child: Text('Branch Stock',
                                  style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700)),
                            ),
                            if (_selectedStock != null)
                              GestureDetector(
                                onTap: () =>
                                    setState(() => _selectedStock = null),
                                child: const Icon(Icons.close,
                                    color: Colors.white70, size: 16),
                              ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(8),
                        child: TextField(
                          decoration: const InputDecoration(
                            hintText: 'Search ingredients…',
                            prefixIcon: Icon(Icons.search, size: 18),
                            isDense: true,
                            border: OutlineInputBorder(),
                          ),
                          onChanged: (v) =>
                              setState(() => _stockSearch = v),
                        ),
                      ),
                      Expanded(
                        child: ListView.builder(
                          itemCount: _filteredStock.length,
                          itemBuilder: (ctx, i) {
                            final s = _filteredStock[i];
                            final selected =
                                _selectedStock?['item_sku'] == s['item_sku'];
                            final qty = _fcNum(s['quantity']);
                            return ListTile(
                              dense: true,
                              selected: selected,
                              selectedTileColor:
                                  AppColors.kPrimary.withOpacity(0.08),
                              onTap: () => setState(() =>
                                  _selectedStock = selected ? null : s),
                              title: Text('${s['item_name']}',
                                  style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600)),
                              subtitle: Text(
                                  '${s['item_sku']} · ${s['unit_of_measure'] ?? s['unit'] ?? ''}',
                                  style: const TextStyle(fontSize: 11)),
                              trailing: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(qty.toStringAsFixed(1),
                                      style: TextStyle(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 13,
                                          color: qty <= 0
                                              ? Colors.red
                                              : AppColors.kPrimary)),
                                  Text(
                                      '${s['unit_of_measure'] ?? s['unit'] ?? ''}',
                                      style: const TextStyle(fontSize: 10)),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              // ── Right: Recipes ──
              Expanded(
                child: Card(
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.teal.shade700,
                          borderRadius: const BorderRadius.vertical(
                              top: Radius.circular(12)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.restaurant_outlined,
                                color: Colors.white, size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _selectedStock == null
                                    ? 'All Recipes'
                                    : 'Recipes using ${_selectedStock!['item_name']}',
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(8),
                        child: TextField(
                          decoration: const InputDecoration(
                            hintText: 'Search recipes…',
                            prefixIcon: Icon(Icons.search, size: 18),
                            isDense: true,
                            border: OutlineInputBorder(),
                          ),
                          onChanged: (v) =>
                              setState(() => _recipeSearch = v),
                        ),
                      ),
                      if (_loading)
                        const Expanded(
                            child:
                                Center(child: CircularProgressIndicator()))
                      else if (_filteredRecipes.isEmpty)
                        Expanded(
                          child: Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.restaurant_menu_outlined,
                                    size: 48,
                                    color: Colors.grey.shade400),
                                const SizedBox(height: 12),
                                Text(
                                  _selectedStock != null
                                      ? 'No recipe uses ${_selectedStock!['item_name']} yet.'
                                      : 'No recipes configured yet.',
                                  style: TextStyle(
                                      color: Colors.grey.shade600),
                                ),
                                const SizedBox(height: 12),
                                FilledButton.icon(
                                  onPressed: () => _openRecipeDialog(null),
                                  icon: const Icon(Icons.add, size: 16),
                                  label: const Text('Add Recipe'),
                                ),
                              ],
                            ),
                          ),
                        )
                      else
                        Expanded(
                          child: ListView.separated(
                            padding: const EdgeInsets.all(8),
                            itemCount: _filteredRecipes.length,
                            separatorBuilder: (_, __) =>
                                const SizedBox(height: 8),
                            itemBuilder: (ctx, i) {
                              final r = _filteredRecipes[i];
                              return _RecipeCard(
                                recipe: r,
                                onEdit: () => _openRecipeDialog(r),
                              );
                            },
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _openRecipeDialog(Map<String, dynamic>? existing) async {
    final saved = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _RecipeDialog(
        existing: existing,
        preselectedIngredient: existing == null ? _selectedStock : null,
        stock: widget.stock,
      ),
    );
    if (saved == true) _loadRecipes();
  }
}

// ─── Recipe Card ────────────────────────────────────────────────────────────

class _RecipeCard extends StatelessWidget {
  const _RecipeCard({required this.recipe, required this.onEdit});
  final Map<String, dynamic> recipe;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final ingredients = recipe['ingredients'];
    final ings = ingredients is List ? ingredients : <dynamic>[];
    final portions = _fcNum(recipe['portions_per_recipe']).toInt();
    final cost = _fcNum(recipe['standard_cost']);

    return Card(
      elevation: 0,
      color: Colors.grey.shade50,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: Colors.grey.shade200)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.teal.shade700,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    '${recipe['menu_item_name'] ?? recipe['recipe_code'] ?? 'Recipe'}',
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 13),
                  ),
                ),
                const SizedBox(width: 8),
                if (portions > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 6, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.orange.shade100,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text('×$portions portions',
                        style: TextStyle(
                            color: Colors.orange.shade800,
                            fontWeight: FontWeight.w600,
                            fontSize: 11)),
                  ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.edit_outlined, size: 18),
                  onPressed: onEdit,
                  tooltip: 'Edit recipe',
                  style: IconButton.styleFrom(
                      foregroundColor: AppColors.kPrimary),
                ),
              ],
            ),
            if (ings.isNotEmpty) ...[
              const SizedBox(height: 10),
              const Text('Ingredients',
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey)),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: ings.map<Widget>((ing) {
                  final qty = _fcNum(ing['quantity_per_portion']);
                  final unit = '${ing['unit_of_measure'] ?? ''}';
                  return Chip(
                    label: Text(
                        '${qty % 1 == 0 ? qty.toInt() : qty} $unit ${ing['item_name']}',
                        style: const TextStyle(fontSize: 11)),
                    visualDensity: VisualDensity.compact,
                    padding: EdgeInsets.zero,
                    backgroundColor: AppColors.kPrimary.withOpacity(0.07),
                  );
                }).toList(),
              ),
            ],
            if (cost > 0) ...[
              const SizedBox(height: 8),
              Text('Est. cost: KES ${cost.toStringAsFixed(2)}',
                  style: TextStyle(
                      fontSize: 11, color: Colors.grey.shade600)),
            ],
          ],
        ),
      ),
    );
  }
}

// ─── Recipe Create/Edit Dialog ───────────────────────────────────────────────

class _RecipeDialog extends ConsumerStatefulWidget {
  const _RecipeDialog({
    this.existing,
    this.preselectedIngredient,
    required this.stock,
  });
  final Map<String, dynamic>? existing;
  final Map<String, dynamic>? preselectedIngredient;
  final List<Map<String, dynamic>> stock;

  @override
  ConsumerState<_RecipeDialog> createState() => _RecipeDialogState();
}

class _RecipeDialogState extends ConsumerState<_RecipeDialog> {
  final _menuItemCtrl = TextEditingController();
  final _portionsCtrl = TextEditingController(text: '1');
  bool _busy = false;
  List<Map<String, dynamic>> _menuItems = [];
  bool _menuLoading = true;
  String? _selectedMenuItemId;

  // ingredient rows: [sku, name, qty, unit, unit_cost]
  final List<Map<String, TextEditingController>> _rows = [];

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    if (e != null) {
      _menuItemCtrl.text = '${e['menu_item_name'] ?? ''}';
      _selectedMenuItemId = '${e['menu_item_id'] ?? ''}';
      _portionsCtrl.text = '${e['portions_per_recipe'] ?? 1}';
      final ings = e['ingredients'];
      if (ings is List) {
        for (final ing in ings) {
          _rows.add(_buildRow(
            sku: '${ing['item_sku'] ?? ''}',
            name: '${ing['item_name'] ?? ''}',
            qty: '${ing['quantity_per_portion'] ?? ''}',
            unit: '${ing['unit_of_measure'] ?? ''}',
            cost: '${ing['unit_cost'] ?? ''}',
          ));
        }
      }
    } else if (widget.preselectedIngredient != null) {
      final s = widget.preselectedIngredient!;
      _rows.add(_buildRow(
        sku: '${s['item_sku'] ?? ''}',
        name: '${s['item_name'] ?? ''}',
        qty: '1',
        unit: '${s['unit_of_measure'] ?? s['unit'] ?? ''}',
        cost: '0',
      ));
    }
    if (_rows.isEmpty) _addRow();
    _loadMenuItems();
  }

  Future<void> _loadMenuItems() async {
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      final items = await repo.getMenuItems();
      if (mounted) setState(() { _menuItems = items; _menuLoading = false; });
    } catch (_) {
      if (mounted) setState(() => _menuLoading = false);
    }
  }

  Map<String, TextEditingController> _buildRow({
    String sku = '',
    String name = '',
    String qty = '',
    String unit = '',
    String cost = '0',
  }) =>
      {
        'sku': TextEditingController(text: sku),
        'name': TextEditingController(text: name),
        'qty': TextEditingController(text: qty),
        'unit': TextEditingController(text: unit),
        'cost': TextEditingController(text: cost),
      };

  void _addRow() {
    setState(() => _rows.add(_buildRow()));
  }

  void _removeRow(int i) {
    setState(() {
      for (final c in _rows[i].values) c.dispose();
      _rows.removeAt(i);
    });
  }

  void _fillFromStock(int rowIndex, Map<String, dynamic> s) {
    final row = _rows[rowIndex];
    row['sku']!.text = '${s['item_sku'] ?? ''}';
    row['name']!.text = '${s['item_name'] ?? ''}';
    row['unit']!.text =
        '${s['unit_of_measure'] ?? s['unit'] ?? ''}';
    setState(() {});
  }

  @override
  void dispose() {
    _menuItemCtrl.dispose();
    _portionsCtrl.dispose();
    for (final row in _rows) {
      for (final c in row.values) c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    final menuName = _menuItemCtrl.text.trim();
    if (menuName.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Menu item name is required')));
      return;
    }
    final portions = int.tryParse(_portionsCtrl.text.trim()) ?? 1;
    final ingredients = _rows
        .where((r) => r['sku']!.text.trim().isNotEmpty)
        .map((r) => {
              'item_sku': r['sku']!.text.trim(),
              'item_name': r['name']!.text.trim(),
              'quantity_per_portion':
                  double.tryParse(r['qty']!.text.trim()) ?? 0,
              'unit_of_measure': r['unit']!.text.trim(),
              'unit_cost': double.tryParse(r['cost']!.text.trim()) ?? 0,
            })
        .toList();

    if (ingredients.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Add at least one ingredient')));
      return;
    }

    setState(() => _busy = true);
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      if (widget.existing != null) {
        await repo.updateRecipe(
          id: '${widget.existing!['id']}',
          menuItemName: menuName,
          portionsPerRecipe: portions,
          ingredients: ingredients,
        );
      } else {
        await repo.createRecipe(
          menuItemName: menuName,
          menuItemId: (_selectedMenuItemId?.isNotEmpty == true &&
                  _selectedMenuItemId != 'null')
              ? _selectedMenuItemId
              : null,
          portionsPerRecipe: portions,
          ingredients: ingredients,
        );
      }
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.existing != null;
    return AlertDialog(
      title: Text(isEdit ? 'Edit Recipe' : 'New Recipe'),
      contentPadding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      content: SizedBox(
        width: 680,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Output (menu item) — searchable autocomplete
              Row(
                children: [
                  const Text('Output (Menu Item)',
                      style: TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 13)),
                  const SizedBox(width: 8),
                  if (_menuLoading)
                    const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2)),
                  if (!_menuLoading)
                    Text('${_menuItems.length} items loaded',
                        style: TextStyle(
                            fontSize: 11, color: Colors.grey.shade500)),
                ],
              ),
              const SizedBox(height: 6),
              Autocomplete<Map<String, dynamic>>(
                initialValue:
                    TextEditingValue(text: _menuItemCtrl.text),
                optionsBuilder: (tv) {
                  final q = tv.text.toLowerCase().trim();
                  if (q.isEmpty) return _menuItems.take(20);
                  return _menuItems.where((m) {
                    final name = '${m['name'] ?? ''}'.toLowerCase();
                    final cat = '${m['category_name'] ?? m['category'] ?? ''}'.toLowerCase();
                    return name.contains(q) || cat.contains(q);
                  }).take(20);
                },
                displayStringForOption: (m) => '${m['name'] ?? ''}',
                onSelected: (m) {
                  setState(() {
                    _menuItemCtrl.text = '${m['name'] ?? ''}';
                    _selectedMenuItemId = '${m['id'] ?? ''}';
                  });
                },
                fieldViewBuilder: (ctx, ctrl, focusNode, onSubmitted) {
                  ctrl.text = _menuItemCtrl.text;
                  ctrl.addListener(() => _menuItemCtrl.text = ctrl.text);
                  return TextField(
                    controller: ctrl,
                    focusNode: focusNode,
                    decoration: InputDecoration(
                      hintText: _menuLoading
                          ? 'Loading menu items…'
                          : 'Search menu items (e.g. Samosa, Ugali, Beef…)',
                      border: const OutlineInputBorder(),
                      isDense: true,
                      prefixIcon:
                          const Icon(Icons.restaurant_menu_outlined),
                      suffixIcon: _selectedMenuItemId != null &&
                              _selectedMenuItemId!.isNotEmpty &&
                              _selectedMenuItemId != 'null'
                          ? const Icon(Icons.check_circle,
                              color: Colors.green, size: 18)
                          : null,
                    ),
                  );
                },
                optionsViewBuilder: (ctx, onSel, opts) => Align(
                  alignment: Alignment.topLeft,
                  child: Material(
                    elevation: 6,
                    borderRadius: BorderRadius.circular(8),
                    child: SizedBox(
                      width: 640,
                      child: ListView(
                        padding: EdgeInsets.zero,
                        shrinkWrap: true,
                        children: opts.map((m) {
                          final cat =
                              '${m['category_name'] ?? m['category'] ?? ''}';
                          final price =
                              _fcNum(m['price'] ?? m['selling_price']);
                          return ListTile(
                            dense: true,
                            leading: const Icon(
                                Icons.restaurant_menu_outlined,
                                size: 18),
                            title: Text('${m['name'] ?? ''}',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 13)),
                            subtitle: Text(cat,
                                style:
                                    const TextStyle(fontSize: 11)),
                            trailing: price > 0
                                ? Text(
                                    'KES ${price.toStringAsFixed(0)}',
                                    style: TextStyle(
                                        fontSize: 12,
                                        color: Colors.teal.shade700,
                                        fontWeight: FontWeight.w600))
                                : null,
                            onTap: () => onSel(m),
                          );
                        }).toList(),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  const Text('Portions per batch: ',
                      style: TextStyle(fontSize: 12)),
                  SizedBox(
                    width: 70,
                    child: TextField(
                      controller: _portionsCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                          border: OutlineInputBorder(), isDense: true),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              const Divider(),
              const SizedBox(height: 8),
              // Ingredients
              Row(
                children: [
                  const Text('Ingredients (Inputs)',
                      style: TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 13)),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: _addRow,
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text('Add row'),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              // Header row
              const Row(
                children: [
                  SizedBox(
                      width: 120,
                      child: Text('SKU',
                          style: TextStyle(
                              fontSize: 11, fontWeight: FontWeight.w600))),
                  SizedBox(width: 4),
                  Expanded(
                      child: Text('Ingredient Name',
                          style: TextStyle(
                              fontSize: 11, fontWeight: FontWeight.w600))),
                  SizedBox(width: 4),
                  SizedBox(
                      width: 60,
                      child: Text('Qty/batch',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600))),
                  SizedBox(width: 4),
                  SizedBox(
                      width: 60,
                      child: Text('Unit',
                          style: TextStyle(
                              fontSize: 11, fontWeight: FontWeight.w600))),
                  SizedBox(width: 32),
                ],
              ),
              const SizedBox(height: 4),
              ..._rows.asMap().entries.map((entry) {
                final i = entry.key;
                final row = entry.value;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      // SKU with stock picker
                      SizedBox(
                        width: 120,
                        child: _StockAutocomplete(
                          controller: row['sku']!,
                          stock: widget.stock,
                          onSelected: (s) => _fillFromStock(i, s),
                          hint: 'SKU',
                        ),
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: TextField(
                          controller: row['name']!,
                          decoration: const InputDecoration(
                              hintText: 'Name',
                              border: OutlineInputBorder(),
                              isDense: true),
                        ),
                      ),
                      const SizedBox(width: 4),
                      SizedBox(
                        width: 60,
                        child: TextField(
                          controller: row['qty']!,
                          keyboardType:
                              const TextInputType.numberWithOptions(decimal: true),
                          decoration: const InputDecoration(
                              hintText: '1',
                              border: OutlineInputBorder(),
                              isDense: true),
                        ),
                      ),
                      const SizedBox(width: 4),
                      SizedBox(
                        width: 60,
                        child: TextField(
                          controller: row['unit']!,
                          decoration: const InputDecoration(
                              hintText: 'kg',
                              border: OutlineInputBorder(),
                              isDense: true),
                        ),
                      ),
                      IconButton(
                        icon:
                            const Icon(Icons.close, size: 16, color: Colors.red),
                        onPressed: _rows.length > 1 ? () => _removeRow(i) : null,
                        style: IconButton.styleFrom(padding: EdgeInsets.zero),
                      ),
                    ],
                  ),
                );
              }),
              const SizedBox(height: 8),
              // Default yield reference
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.amber.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Standard Yield Reference',
                        style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 11,
                            color: Colors.amber.shade900)),
                    const SizedBox(height: 6),
                    const Text(
                      '1kg Minced Meat → 30 Samosas\n'
                      '1kg Beef/Mbuzi → 4 Portions\n'
                      '1kg Beef → 10 Mixes Managu/Sukuma\n'
                      '1kg Beef → 12 Specials Rice/Pilau\n'
                      '2kg Chips → 3 Portions Chips\n'
                      '1kg Chips → 3 Specials Sausage/Samosa\n'
                      '1kg Chips → 6 Specials Rice/Pilau\n'
                      '2kg EXE flour → 27 Chapatis\n'
                      '2kg EXE flour → 70 Kebabs\n'
                      '2kg Self Raising → 23 Portions Ndazi\n'
                      '1kg Rice → 7 Plates Rice/Pilau\n'
                      '2kg Ajab → 8 Ugalis\n'
                      '1 Litre Milk → 4 Tea Cups\n'
                      '1kg Managu → 4 Portions Managu',
                      style: TextStyle(fontSize: 10, height: 1.7),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
            onPressed: _busy ? null : () => Navigator.of(context).pop(false),
            child: const Text('Cancel')),
        FilledButton(
          onPressed: _busy ? null : _submit,
          child: _busy
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white))
              : Text(isEdit ? 'Save Changes' : 'Create Recipe'),
        ),
      ],
    );
  }
}

// ─── Stock SKU Autocomplete field ────────────────────────────────────────────

class _StockAutocomplete extends StatelessWidget {
  const _StockAutocomplete({
    required this.controller,
    required this.stock,
    required this.onSelected,
    this.hint = '',
  });
  final TextEditingController controller;
  final List<Map<String, dynamic>> stock;
  final ValueChanged<Map<String, dynamic>> onSelected;
  final String hint;

  @override
  Widget build(BuildContext context) {
    return Autocomplete<Map<String, dynamic>>(
      initialValue: TextEditingValue(text: controller.text),
      optionsBuilder: (tv) {
        final q = tv.text.toLowerCase();
        if (q.isEmpty) return const [];
        return stock
            .where((s) =>
                '${s['item_sku']}'.toLowerCase().contains(q) ||
                '${s['item_name']}'.toLowerCase().contains(q))
            .take(8);
      },
      displayStringForOption: (s) => '${s['item_sku']}',
      onSelected: (s) {
        controller.text = '${s['item_sku']}';
        onSelected(s);
      },
      fieldViewBuilder: (ctx, ctrl, focusNode, _) {
        // sync external controller → internal
        ctrl.text = controller.text;
        ctrl.addListener(() => controller.text = ctrl.text);
        return TextField(
          controller: ctrl,
          focusNode: focusNode,
          decoration: InputDecoration(
              hintText: hint,
              border: const OutlineInputBorder(),
              isDense: true),
        );
      },
      optionsViewBuilder: (ctx, onSel, opts) => Align(
        alignment: Alignment.topLeft,
        child: Material(
          elevation: 4,
          borderRadius: BorderRadius.circular(8),
          child: SizedBox(
            width: 280,
            child: ListView(
              padding: EdgeInsets.zero,
              shrinkWrap: true,
              children: opts
                  .map((s) => ListTile(
                        dense: true,
                        title: Text('${s['item_name']}',
                            style: const TextStyle(fontSize: 12)),
                        subtitle: Text('${s['item_sku']}',
                            style: const TextStyle(fontSize: 10)),
                        onTap: () => onSel(s),
                      ))
                  .toList(),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────── BRANCH INVENTORY TAB ───────────────────────────────

class _BranchInventoryTab extends StatelessWidget {
  const _BranchInventoryTab({
    required this.stock,
    required this.search,
    required this.onSearchChanged,
    required this.itemName,
    required this.qty,
    required this.toNum,
    required this.onRequest,
  });

  final List<Map<String, dynamic>> stock;
  final String search;
  final ValueChanged<String> onSearchChanged;
  final String Function(Map<String, dynamic>) itemName;
  final String Function(Map<String, dynamic>) qty;
  final num Function(dynamic) toNum;
  final void Function(Map<String, dynamic>) onRequest;

  @override
  Widget build(BuildContext context) {
    final q = search.toLowerCase();
    final filtered = stock.where((item) {
      return q.isEmpty ||
          itemName(item).toLowerCase().contains(q) ||
          '${item['item_sku'] ?? item['sku']}'.toLowerCase().contains(q) ||
          '${item['category'] ?? ''}'.toLowerCase().contains(q);
    }).toList();
    final lowStock = filtered
        .where((i) =>
            toNum(i['quantity']) <=
            toNum(i['reorder_level'] ?? i['min_quantity'] ?? 0))
        .length;

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _InventoryStat(
                  label: 'Branch Stock Items',
                  value: '${stock.length}',
                  icon: Icons.inventory_2_outlined,
                  color: AppColors.kPrimary),
              const SizedBox(width: 8),
              _InventoryStat(
                  label: 'Low / Zero Stock',
                  value: '$lowStock',
                  icon: Icons.warning_amber_outlined,
                  color: Colors.orange),
              const SizedBox(width: 8),
              _InventoryStat(
                  label: 'Showing',
                  value: '${filtered.length}',
                  icon: Icons.filter_list,
                  color: Colors.teal),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.amber.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.amber.shade300),
            ),
            child: Row(
              children: [
                Icon(Icons.lock_outline,
                    size: 16, color: Colors.amber.shade800),
                const SizedBox(width: 10),
                Expanded(
                  child: RichText(
                    text: TextSpan(
                      style: TextStyle(
                          fontSize: 12,
                          color: Colors.amber.shade900,
                          fontWeight: FontWeight.w500),
                      children: const [
                        TextSpan(
                            text: 'Stock quantities are controlled and tamper-proof. '
                                'Opening stock is entered once via the Central Master Catalog tab. '
                                'Changes only happen via Receive Goods, Stock Takes, or approved issuances. '),
                        TextSpan(
                            text: 'Items in this list that do not appear in the Central Catalog are legacy items '
                                'added before the catalog control system was introduced.',
                            style: TextStyle(fontStyle: FontStyle.italic)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            onChanged: onSearchChanged,
            decoration: const InputDecoration(
              hintText: 'Search branch stock by name, SKU or category…',
              prefixIcon: Icon(Icons.search),
              border: OutlineInputBorder(),
              isDense: true,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey.shade200),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppColors.kPrimary,
                    borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(8)),
                  ),
                  child: const Row(
                    children: [
                      Expanded(
                          flex: 3,
                          child: Text('Item',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12))),
                      Expanded(
                          child: Text('SKU',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12))),
                      Expanded(
                          child: Text('Category',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12))),
                      SizedBox(
                          width: 72,
                          child: Text('Store',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12))),
                      SizedBox(
                          width: 100,
                          child: Text('Balance',
                              textAlign: TextAlign.right,
                              style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12))),
                      SizedBox(
                          width: 70,
                          child: Text('Status',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12))),
                      SizedBox(width: 110),
                    ],
                  ),
                ),
                if (filtered.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(
                        child: Text('No items found',
                            style: TextStyle(color: Colors.grey))),
                  )
                else
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) =>
                        Divider(height: 1, color: Colors.grey.shade100),
                    itemBuilder: (ctx, i) {
                      final item = filtered[i];
                      final q2 = toNum(item['quantity']);
                      final reorder = toNum(
                          item['reorder_level'] ?? item['min_quantity'] ?? 0);
                      final isLow = q2 <= reorder;
                      final isZero = q2 <= 0;
                      return Container(
                        color: i.isEven ? Colors.white : Colors.grey.shade50,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                        child: Row(
                          children: [
                            Expanded(
                              flex: 3,
                              child: Text(itemName(item),
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13)),
                            ),
                            Expanded(
                              child: Text(
                                  '${item['item_sku'] ?? item['sku'] ?? ''}',
                                  style: const TextStyle(
                                      fontSize: 11, color: Colors.grey)),
                            ),
                            Expanded(
                              child: Text(
                                  '${item['item']?['category'] ?? item['category'] ?? '—'}',
                                  style: const TextStyle(fontSize: 12)),
                            ),
                            SizedBox(
                              width: 72,
                              child: Center(
                                child: Builder(builder: (_) {
                                  final st = '${item['store_type'] ?? item['item']?['store_type'] ?? 'foodstuffs'}';
                                  final isBar = st == 'bar_store';
                                  return Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: isBar ? Colors.purple.shade50 : Colors.green.shade50,
                                      borderRadius: BorderRadius.circular(4),
                                      border: Border.all(color: isBar ? Colors.purple.shade200 : Colors.green.shade200),
                                    ),
                                    child: Text(
                                      isBar ? 'Bar' : 'Food',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                        color: isBar ? Colors.purple.shade700 : Colors.green.shade700,
                                      ),
                                    ),
                                  );
                                }),
                              ),
                            ),
                            SizedBox(
                              width: 100,
                              child: Text(
                                qty(item),
                                textAlign: TextAlign.right,
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 13,
                                  color: isZero
                                      ? Colors.red
                                      : isLow
                                          ? Colors.orange
                                          : AppColors.kPrimary,
                                ),
                              ),
                            ),
                            SizedBox(
                              width: 70,
                              child: Center(
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 5, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: isZero
                                        ? Colors.red.shade100
                                        : isLow
                                            ? Colors.orange.shade100
                                            : Colors.green.shade100,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    isZero
                                        ? 'ZERO'
                                        : isLow
                                            ? 'LOW'
                                            : 'OK',
                                    style: TextStyle(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w700,
                                      color: isZero
                                          ? Colors.red.shade800
                                          : isLow
                                              ? Colors.orange.shade800
                                              : Colors.green.shade800,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            SizedBox(
                              width: 110,
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  Tooltip(
                                    message: 'Stock is controlled. Request from Central Store to add more.',
                                    child: Icon(Icons.lock_outline,
                                        size: 14, color: Colors.grey.shade400),
                                  ),
                                  const SizedBox(width: 4),
                                  TextButton(
                                    onPressed: () => onRequest(item),
                                    child: const Text('Request',
                                        style: TextStyle(fontSize: 12)),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────── CENTRAL CATALOG TAB ────────────────────────────────

class _CentralCatalogTab extends StatefulWidget {
  const _CentralCatalogTab({
    required this.catalog,
    required this.stock,
    required this.catalogFilter,
    required this.categories,
    required this.onFilterChanged,
    required this.toNum,
    required this.onRegister,
    this.onRefresh,
  });

  final List<Map<String, dynamic>> catalog;
  final List<Map<String, dynamic>> stock;
  final String catalogFilter;
  final List<String> categories;
  final ValueChanged<String> onFilterChanged;
  final num Function(dynamic) toNum;
  final Future<void> Function(Map<String, dynamic>) onRegister;
  final Future<void> Function()? onRefresh;

  @override
  State<_CentralCatalogTab> createState() => _CentralCatalogTabState();
}

class _CentralCatalogTabState extends State<_CentralCatalogTab> {
  String _search = '';
  String _storeTypeFilter = 'all'; // 'all' | 'foodstuffs' | 'bar_store'
  final Set<String> _selectedSkus = {};

  Set<String> get _registeredSkus => widget.stock
      .map((s) => '${s['item_sku'] ?? s['sku']}'.trim().toUpperCase())
      .where((s) => s.isNotEmpty && s != 'NULL')
      .toSet();

  List<Map<String, dynamic>> get _unregisteredFiltered =>
      _filtered.where((i) => !_registeredSkus.contains('${i['sku']}'.trim().toUpperCase())).toList();

  void _toggleItem(String sku) {
    setState(() {
      if (_selectedSkus.contains(sku)) {
        _selectedSkus.remove(sku);
      } else {
        _selectedSkus.add(sku);
      }
    });
  }

  void _selectAll() {
    setState(() {
      for (final i in _unregisteredFiltered) {
        _selectedSkus.add('${i['sku']}'.trim().toUpperCase());
      }
    });
  }

  void _clearSelection() => setState(() => _selectedSkus.clear());

  Future<void> _openBulkReview() async {
    final items = _unregisteredFiltered
        .where((i) => _selectedSkus.contains('${i['sku']}'.trim().toUpperCase()))
        .toList();
    if (items.isEmpty) return;
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _BulkRegistrationSheet(items: items),
    );
    if (confirmed == true) {
      _clearSelection();
      await widget.onRefresh?.call();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('${items.length} item${items.length == 1 ? '' : 's'} registered to branch inventory'),
          backgroundColor: Colors.green.shade700,
        ));
      }
    }
  }

  List<Map<String, dynamic>> get _filtered {
    final q = _search.toLowerCase();
    return widget.catalog.where((item) {
      final cat = '${item['category'] ?? ''}';
      if (widget.catalogFilter != 'all' && cat != widget.catalogFilter) {
        return false;
      }
      final st = '${item['store_type'] ?? 'foodstuffs'}';
      if (_storeTypeFilter != 'all' && st != _storeTypeFilter) {
        return false;
      }
      if (q.isEmpty) return true;
      return '${item['item_name'] ?? item['name'] ?? ''}'
              .toLowerCase()
              .contains(q) ||
          '${item['sku'] ?? ''}'.toLowerCase().contains(q) ||
          cat.toLowerCase().contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    final registered = filtered
        .where((i) => _registeredSkus
            .contains('${i['sku']}'.trim().toUpperCase()))
        .length;
    final available = filtered.length - registered;
    final selectedCount = _selectedSkus.length;
    final unregisteredCount = _unregisteredFiltered.length;
    final allSelected = unregisteredCount > 0 && _selectedSkus.length >= unregisteredCount;

    return Stack(
      children: [
      SingleChildScrollView(
        padding: EdgeInsets.only(bottom: selectedCount > 0 ? 72 : 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.indigo.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.indigo.shade200),
            ),
            child: Row(
              children: [
                Icon(Icons.lock_outline,
                    color: Colors.indigo.shade700, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Branches adopt items from this central catalog — they cannot create new items. '
                    'Cost prices, SKUs, and units are centrally controlled and read-only.',
                    style: TextStyle(
                        color: Colors.indigo.shade900,
                        fontSize: 12,
                        fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _InventoryStat(
                  label: 'Catalog Items',
                  value: '${widget.catalog.length}',
                  icon: Icons.store_outlined,
                  color: Colors.indigo),
              const SizedBox(width: 8),
              _InventoryStat(
                  label: 'Registered',
                  value: '$registered',
                  icon: Icons.check_circle_outline,
                  color: Colors.green),
              const SizedBox(width: 8),
              _InventoryStat(
                  label: 'Not Yet Registered',
                  value: '$available',
                  icon: Icons.add_circle_outline,
                  color: Colors.orange),
            ],
          ),
          const SizedBox(height: 10),
          // Store type filter pills
          Row(
            children: [
              const Text('Store:',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.kTextSecondary)),
              const SizedBox(width: 8),
              for (final entry in const [
                ('all', 'All Items', Colors.grey),
                ('foodstuffs', 'Foodstuffs', Colors.green),
                ('bar_store', 'Bar Store', Colors.purple),
              ])
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: FilterChip(
                    label: Text(entry.$2),
                    selected: _storeTypeFilter == entry.$1,
                    onSelected: (_) =>
                        setState(() => _storeTypeFilter = entry.$1),
                    selectedColor: (entry.$3 as Color).withValues(alpha: 0.15),
                    checkmarkColor: entry.$3 as Color,
                    labelStyle: TextStyle(
                      fontSize: 12,
                      fontWeight: _storeTypeFilter == entry.$1
                          ? FontWeight.w700
                          : FontWeight.normal,
                      color: _storeTypeFilter == entry.$1
                          ? entry.$3 as Color
                          : AppColors.kTextSecondary,
                    ),
                    side: BorderSide(
                      color: _storeTypeFilter == entry.$1
                          ? (entry.$3 as Color).withValues(alpha: 0.5)
                          : Colors.grey.shade300,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  onChanged: (v) => setState(() => _search = v),
                  decoration: const InputDecoration(
                    hintText:
                        'Search central catalog (name, SKU, category)…',
                    prefixIcon: Icon(Icons.search),
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 200,
                child: DropdownButtonFormField<String>(
                  isExpanded: true,
                  value: widget.catalogFilter,
                  decoration: const InputDecoration(
                      isDense: true,
                      border: OutlineInputBorder(),
                      labelText: 'Category'),
                  items: widget.categories
                      .map((c) =>
                          DropdownMenuItem(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (v) =>
                      v != null ? widget.onFilterChanged(v) : null,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // ── Bulk-select toolbar ──────────────────────────────────────────
          if (unregisteredCount > 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: selectedCount > 0 ? Colors.indigo.shade50 : Colors.grey.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: selectedCount > 0 ? Colors.indigo.shade300 : Colors.grey.shade200,
                ),
              ),
              child: Row(
                children: [
                  Checkbox(
                    value: allSelected ? true : (selectedCount > 0 ? null : false),
                    tristate: true,
                    activeColor: Colors.indigo,
                    onChanged: (_) => allSelected ? _clearSelection() : _selectAll(),
                  ),
                  Text(
                    selectedCount > 0
                        ? '$selectedCount of $unregisteredCount selected'
                        : 'Select items to bulk register',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: selectedCount > 0 ? Colors.indigo.shade700 : Colors.grey.shade600,
                    ),
                  ),
                  const Spacer(),
                  if (selectedCount > 0) ...[
                    TextButton.icon(
                      onPressed: _clearSelection,
                      icon: const Icon(Icons.clear, size: 14),
                      label: const Text('Clear', style: TextStyle(fontSize: 12)),
                      style: TextButton.styleFrom(foregroundColor: Colors.grey.shade700),
                    ),
                    const SizedBox(width: 8),
                    FilledButton.icon(
                      onPressed: _openBulkReview,
                      icon: const Icon(Icons.checklist_rtl, size: 15),
                      label: Text('Review & Register ($selectedCount)'),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.indigo,
                        textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ] else
                    TextButton.icon(
                      onPressed: _selectAll,
                      icon: const Icon(Icons.select_all, size: 14),
                      label: Text('Select All ($unregisteredCount)', style: const TextStyle(fontSize: 12)),
                      style: TextButton.styleFrom(foregroundColor: Colors.indigo),
                    ),
                ],
              ),
            ),
          const SizedBox(height: 10),
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey.shade200),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.indigo.shade800,
                    borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(8)),
                  ),
                  child: const Row(
                    children: [
                      SizedBox(width: 40), // checkbox column
                      Expanded(
                          flex: 3,
                          child: Text('Item Name',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12))),
                      Expanded(
                          flex: 2,
                          child: Text('SKU',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12))),
                      Expanded(
                          child: Text('Category',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12))),
                      SizedBox(
                          width: 80,
                          child: Text('Store',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12))),
                      Expanded(
                          child: Text('Unit',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12))),
                      SizedBox(
                          width: 90,
                          child: Text('Cost Price',
                              textAlign: TextAlign.right,
                              style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12))),
                      SizedBox(
                          width: 110,
                          child: Text('Status',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12))),
                      SizedBox(width: 110),
                    ],
                  ),
                ),
                if (filtered.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(
                        child: Text('No catalog items found',
                            style: TextStyle(color: Colors.grey))),
                  )
                else
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) =>
                        Divider(height: 1, color: Colors.grey.shade100),
                    itemBuilder: (ctx, i) {
                      final item = filtered[i];
                      final sku = '${item['sku'] ?? ''}';
                      final skuKey = sku.trim().toUpperCase();
                      final isRegistered = _registeredSkus.contains(skuKey);
                      final isSelected = _selectedSkus.contains(skuKey);
                      final cost =
                          _fcNum(item['cost_price'] ?? item['unit_cost']);
                      return InkWell(
                        onTap: isRegistered ? null : () => _toggleItem(skuKey),
                        child: Container(
                        color: isSelected
                            ? Colors.indigo.shade50
                            : isRegistered
                                ? Colors.green.shade50
                                : (i.isEven
                                    ? Colors.white
                                    : Colors.grey.shade50),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 40,
                              child: isRegistered
                                  ? const Icon(Icons.check_circle,
                                      size: 18, color: Colors.green)
                                  : Checkbox(
                                      value: isSelected,
                                      activeColor: Colors.indigo,
                                      onChanged: (_) => _toggleItem(skuKey),
                                    ),
                            ),
                            Expanded(
                              flex: 3,
                              child: Text(
                                '${item['item_name'] ?? item['name'] ?? sku}',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 13),
                              ),
                            ),
                            Expanded(
                              flex: 2,
                              child: Text(sku,
                                  style: const TextStyle(
                                      fontSize: 11, color: Colors.grey)),
                            ),
                            Expanded(
                              child: Text(
                                  '${item['category'] ?? '—'}',
                                  style: const TextStyle(fontSize: 12)),
                            ),
                            SizedBox(
                              width: 80,
                              child: Center(
                                child: Builder(builder: (_) {
                                  final st = '${item['store_type'] ?? 'foodstuffs'}';
                                  final isBar = st == 'bar_store';
                                  return Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: isBar ? Colors.purple.shade50 : Colors.green.shade50,
                                      borderRadius: BorderRadius.circular(4),
                                      border: Border.all(color: isBar ? Colors.purple.shade200 : Colors.green.shade200),
                                    ),
                                    child: Text(
                                      isBar ? 'Bar' : 'Food',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                        color: isBar ? Colors.purple.shade700 : Colors.green.shade700,
                                      ),
                                    ),
                                  );
                                }),
                              ),
                            ),
                            Expanded(
                              child: Text(
                                  '${item['unit'] ?? item['unit_of_measure'] ?? '—'}',
                                  style: const TextStyle(fontSize: 12)),
                            ),
                            SizedBox(
                              width: 90,
                              child: Text(
                                cost > 0
                                    ? 'KES ${cost.toStringAsFixed(0)}'
                                    : '—',
                                textAlign: TextAlign.right,
                                style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.teal.shade700),
                              ),
                            ),
                            SizedBox(
                              width: 110,
                              child: Center(
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 5, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: isRegistered
                                        ? Colors.green.shade100
                                        : Colors.blue.shade50,
                                    borderRadius:
                                        BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    isRegistered
                                        ? '✓ REGISTERED'
                                        : 'NOT REGISTERED',
                                    style: TextStyle(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w700,
                                      color: isRegistered
                                          ? Colors.green.shade800
                                          : Colors.blue.shade800,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            SizedBox(
                              width: 110,
                              child: isRegistered
                                  ? const Center(
                                      child: Icon(Icons.lock_outline,
                                          size: 16, color: Colors.green))
                                  : FilledButton(
                                      onPressed: () =>
                                          widget.onRegister(item),
                                      style: FilledButton.styleFrom(
                                        backgroundColor: Colors.indigo,
                                        padding:
                                            const EdgeInsets.symmetric(
                                                horizontal: 10,
                                                vertical: 6),
                                        textStyle: const TextStyle(
                                            fontSize: 12),
                                      ),
                                      child: const Text('+ Register'),
                                    ),
                            ),
                          ],
                        ),
                        ), // InkWell
                      );
                    },
                  ),
              ],
            ),
          ),
        ],
      ),
      ), // SingleChildScrollView
      // ── Sticky bottom action bar ────────────────────────────────────────────
      if (selectedCount > 0)
        Positioned(
          left: 0, right: 0, bottom: 0,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.indigo.shade900,
              boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 8, offset: const Offset(0, -2))],
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '$selectedCount item${selectedCount == 1 ? '' : 's'} selected',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                ),
                const Spacer(),
                TextButton(
                  onPressed: _clearSelection,
                  child: const Text('Cancel', style: TextStyle(color: Colors.white70, fontSize: 13)),
                ),
                const SizedBox(width: 8),
                FilledButton.icon(
                  onPressed: _openBulkReview,
                  icon: const Icon(Icons.checklist_rtl, size: 16),
                  label: Text('Review & Register ($selectedCount)',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: Colors.indigo.shade900,
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  ),
                ),
              ],
            ),
          ),
        ),
      ], // Stack children
    );
  }
}

// ─────────────────────── BULK REGISTRATION SHEET ────────────────────────────

class _BulkRegistrationSheet extends ConsumerStatefulWidget {
  const _BulkRegistrationSheet({required this.items});
  final List<Map<String, dynamic>> items;

  @override
  ConsumerState<_BulkRegistrationSheet> createState() => _BulkRegistrationSheetState();
}

class _BulkRegistrationSheetState extends ConsumerState<_BulkRegistrationSheet> {
  final _initialQtyCtrl = TextEditingController(text: '0');
  final _reorderCtrl = TextEditingController(text: '0');
  final _maxCtrl = TextEditingController(text: '0');
  final _locationCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  bool _busy = false;
  int _done = 0;
  String? _error;

  @override
  void dispose() {
    _initialQtyCtrl.dispose();
    _reorderCtrl.dispose();
    _maxCtrl.dispose();
    _locationCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final initialQty = double.tryParse(_initialQtyCtrl.text.trim()) ?? 0;
    if (initialQty < 0) {
      setState(() => _error = 'Initial quantity cannot be negative');
      return;
    }
    setState(() { _busy = true; _done = 0; _error = null; });
    final repo = ref.read(branchStorekeeperRepositoryProvider);
    final notes = _notesCtrl.text.trim();
    try {
      for (final item in widget.items) {
        await repo.adjustBranchStock({
          'item_sku': '${item['sku']}',
          'quantity_change': initialQty,
          'adjustment_type': 'INITIAL_STOCK',
          'reorder_level': double.tryParse(_reorderCtrl.text.trim()) ?? 0,
          'max_stock_level': double.tryParse(_maxCtrl.text.trim()) ?? 0,
          'storage_location': _locationCtrl.text.trim(),
          'notes': notes.isNotEmpty
              ? notes
              : 'Bulk registration from central catalog — '
                  '${DateTime.now().toLocal().toString().split('.').first}.',
        });
        if (mounted) setState(() => _done++);
      }
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) setState(() { _busy = false; _error = 'Failed at item ${_done + 1}: $e'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        left: 20, right: 20, top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle
          Center(
            child: Container(
              width: 40, height: 4,
              decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
            ),
          ),
          const SizedBox(height: 16),
          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: Colors.indigo.shade50, borderRadius: BorderRadius.circular(8)),
                child: Icon(Icons.checklist_rtl, color: Colors.indigo.shade700, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Bulk Register to Branch',
                        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                    Text('${widget.items.length} items selected',
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                  ],
                ),
              ),
              IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
            ],
          ),
          const Divider(height: 20),
          // Items preview
          Container(
            constraints: const BoxConstraints(maxHeight: 160),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey.shade200),
              borderRadius: BorderRadius.circular(8),
              color: Colors.grey.shade50,
            ),
            child: ListView.separated(
              shrinkWrap: true,
              padding: const EdgeInsets.symmetric(vertical: 4),
              itemCount: widget.items.length,
              separatorBuilder: (_, __) => Divider(height: 1, color: Colors.grey.shade200),
              itemBuilder: (_, i) {
                final item = widget.items[i];
                final name = '${item['item_name'] ?? item['name'] ?? item['sku']}';
                final sku = '${item['sku'] ?? ''}';
                final isDone = _busy && i < _done;
                return ListTile(
                  dense: true,
                  leading: isDone
                      ? const Icon(Icons.check_circle, color: Colors.green, size: 18)
                      : (_busy && i == _done
                          ? const SizedBox(width: 18, height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2))
                          : Icon(Icons.inventory_2_outlined, color: Colors.indigo.shade300, size: 18)),
                  title: Text(name, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  subtitle: Text('SKU: $sku • ${item['category'] ?? ''}',
                      style: const TextStyle(fontSize: 11)),
                );
              },
            ),
          ),
          const SizedBox(height: 16),
          // Shared fields
          const Text('Apply to all selected items:',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.grey)),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _initialQtyCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Initial Qty',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _reorderCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Reorder Level',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _maxCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Max Stock',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _locationCtrl,
            decoration: const InputDecoration(
              labelText: 'Storage Location (optional)',
              border: OutlineInputBorder(),
              isDense: true,
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _notesCtrl,
            decoration: const InputDecoration(
              labelText: 'Notes (optional)',
              border: OutlineInputBorder(),
              isDense: true,
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12)),
          ],
          const SizedBox(height: 16),
          if (_busy)
            Column(
              children: [
                LinearProgressIndicator(
                  value: _done / widget.items.length,
                  backgroundColor: Colors.grey.shade200,
                  color: Colors.indigo,
                ),
                const SizedBox(height: 6),
                Text('Registering $_done of ${widget.items.length}…',
                    style: const TextStyle(fontSize: 12, color: Colors.grey)),
              ],
            )
          else
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: FilledButton.icon(
                    onPressed: _submit,
                    icon: const Icon(Icons.add_business_outlined, size: 18),
                    label: Text('Confirm & Register All (${widget.items.length})',
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.indigo,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

// ─────────────────────── REGISTRATION DIALOG ────────────────────────────────

class _CatalogRegistrationDialog extends ConsumerStatefulWidget {
  const _CatalogRegistrationDialog({required this.item});
  final Map<String, dynamic> item;

  @override
  ConsumerState<_CatalogRegistrationDialog> createState() =>
      _CatalogRegistrationDialogState();
}

class _CatalogRegistrationDialogState
    extends ConsumerState<_CatalogRegistrationDialog> {
  final _initialQtyCtrl = TextEditingController(text: '0');
  final _reorderCtrl = TextEditingController(text: '0');
  final _maxCtrl = TextEditingController(text: '0');
  final _locationCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _initialQtyCtrl.dispose();
    _reorderCtrl.dispose();
    _maxCtrl.dispose();
    _locationCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final initialQty = double.tryParse(_initialQtyCtrl.text.trim()) ?? 0;
    if (initialQty < 0) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Initial quantity cannot be negative')));
      return;
    }
    setState(() => _busy = true);
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      await repo.adjustBranchStock({
        'item_sku': widget.item['sku'],
        'quantity_change': initialQty,
        'adjustment_type': 'INITIAL_STOCK',
        'reorder_level': double.tryParse(_reorderCtrl.text.trim()) ?? 0,
        'max_stock_level': double.tryParse(_maxCtrl.text.trim()) ?? 0,
        'storage_location': _locationCtrl.text.trim(),
        'notes': _notesCtrl.text.trim().isNotEmpty
            ? _notesCtrl.text.trim()
            : 'Initial registration from central catalog — '
                '${DateTime.now().toLocal().toString().split('.').first}.',
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Registration failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _roField(String label, String value) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: InputDecorator(
          decoration: InputDecoration(
            labelText: label,
            border: const OutlineInputBorder(),
            isDense: true,
            filled: true,
            fillColor: Colors.grey.shade100,
            suffixIcon:
                const Icon(Icons.lock_outline, size: 16, color: Colors.grey),
          ),
          child: Text(value,
              style: const TextStyle(
                  fontWeight: FontWeight.w600, fontSize: 13)),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final name =
        '${item['item_name'] ?? item['name'] ?? item['sku'] ?? ''}';
    final sku = '${item['sku'] ?? ''}';
    final category = '${item['category'] ?? '—'}';
    final unit = '${item['unit'] ?? item['unit_of_measure'] ?? '—'}';
    final cost = _fcNum(item['cost_price'] ?? item['unit_cost']);

    return AlertDialog(
      title: Row(
        children: [
          const Icon(Icons.add_business_outlined,
              color: Colors.indigo, size: 22),
          const SizedBox(width: 8),
          const Expanded(
            child: Text('Register to Branch Inventory',
                style: TextStyle(
                    fontSize: 16, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
      contentPadding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      content: SizedBox(
        width: 560,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Read-only central info
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.indigo.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.indigo.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.lock_outline,
                            size: 14,
                            color: Colors.indigo.shade700),
                        const SizedBox(width: 6),
                        Text(
                          'Central Master Inventory — Read Only',
                          style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Colors.indigo.shade700),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    _roField('Item Name', name),
                    _roField('SKU', sku),
                    Row(
                      children: [
                        Expanded(
                            child: _roField('Category', category)),
                        const SizedBox(width: 10),
                        Expanded(child: _roField('Unit', unit)),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _roField(
                            'Cost Price (Central)',
                            cost > 0
                                ? 'KES ${cost.toStringAsFixed(2)}'
                                : 'Not set',
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              const Divider(),
              const SizedBox(height: 6),
              Row(
                children: [
                  Icon(Icons.edit_outlined,
                      size: 14, color: Colors.green.shade700),
                  const SizedBox(width: 6),
                  Text(
                    'Branch Registration Details — entered ONE TIME then locked',
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Colors.green.shade800),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: Colors.amber.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.warning_amber_outlined,
                        size: 16, color: Colors.amber.shade800),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Initial quantity is entered ONCE and LOCKED after save. '
                        'Future stock additions only via approved dispatches and transfers.',
                        style: TextStyle(
                            fontSize: 11, color: Colors.amber.shade900),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _initialQtyCtrl,
                      keyboardType:
                          const TextInputType.numberWithOptions(
                              decimal: true),
                      decoration: InputDecoration(
                        labelText: 'Initial Branch Quantity *',
                        hintText: '0',
                        border: const OutlineInputBorder(),
                        isDense: true,
                        helperText: 'Locked after save',
                        helperStyle: TextStyle(
                            color: Colors.red.shade400,
                            fontSize: 11),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _reorderCtrl,
                      keyboardType:
                          const TextInputType.numberWithOptions(
                              decimal: true),
                      decoration: const InputDecoration(
                        labelText: 'Reorder Level',
                        hintText: '0',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _maxCtrl,
                      keyboardType:
                          const TextInputType.numberWithOptions(
                              decimal: true),
                      decoration: const InputDecoration(
                        labelText: 'Maximum Level',
                        hintText: '0',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _locationCtrl,
                decoration: const InputDecoration(
                  labelText: 'Storage Location',
                  hintText:
                      'e.g. Food Store A, Cold Room, Dry Store',
                  border: OutlineInputBorder(),
                  isDense: true,
                  prefixIcon: Icon(Icons.location_on_outlined),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _notesCtrl,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Notes (optional)',
                  hintText: 'Any notes about this registration…',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed:
              _busy ? null : () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton.icon(
          style: FilledButton.styleFrom(
              backgroundColor: Colors.indigo),
          onPressed: _busy ? null : _submit,
          icon: _busy
              ? const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white))
              : const Icon(Icons.add_business_outlined, size: 16),
          label: const Text('Register to Branch'),
        ),
      ],
    );
  }
}

// ─────────────────────── INVENTORY STAT CHIP ────────────────────────────────

class _InventoryStat extends StatelessWidget {
  const _InventoryStat({
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
    return Expanded(
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value,
                    style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                        color: color)),
                Text(label,
                    style: const TextStyle(
                        fontSize: 11, color: Colors.grey)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// KITCHEN PRODUCTION SESSIONS SECTION
// ═══════════════════════════════════════════════════════════════════

class _KitchenProductionSection extends ConsumerStatefulWidget {
  const _KitchenProductionSection({required this.stock});
  final List<Map<String, dynamic>> stock;

  @override
  ConsumerState<_KitchenProductionSection> createState() =>
      _KitchenProductionSectionState();
}

class _KitchenProductionSectionState
    extends ConsumerState<_KitchenProductionSection> {
  List<Map<String, dynamic>> _sessions = [];
  List<Map<String, dynamic>> _recipes = [];
  bool _loading = true;
  Map<String, dynamic>? _selected; // open session for detail view

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      final results = await Future.wait([
        repo.getProductionSessions(),
        repo.getProductionRecipes(),
      ]);
      if (!mounted) return;
      setState(() {
        _sessions = results[0];
        _recipes = results[1];
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading sessions: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openNewSession() async {
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _NewSessionSheet(
        recipes: _recipes,
        stock: widget.stock,
      ),
    );
    if (result == true) {
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Session created — stock issued to kitchen'),
            backgroundColor: Colors.green,
          ),
        );
      }
    }
  }

  Future<void> _openComplete(Map<String, dynamic> session) async {
    final result = await showModalBottomSheet<Map<String, dynamic>?>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _RecordProductionSheet(session: session),
    );
    if (result != null) {
      await _load();
      if (mounted) {
        final penalty = result['total_penalty'] ?? 0;
        final msg = penalty > 0
            ? 'Session completed. Penalty KES ${(penalty as num).toStringAsFixed(2)} raised as credit bill.'
            : 'Session completed — no variance penalty.';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: penalty > 0 ? Colors.orange : Colors.green,
            duration: const Duration(seconds: 5),
          ),
        );
        // Refresh selected if open
        if (_selected != null && _selected!['id'] == result['session_id']) {
          setState(() => _selected = null);
        }
      }
    }
  }

  Color _statusColor(String? status) {
    switch (status) {
      case 'completed': return Colors.green;
      case 'closed': return Colors.grey;
      default: return Colors.orange; // in_production
    }
  }

  String _statusLabel(String? status) {
    switch (status) {
      case 'completed': return 'Completed';
      case 'closed': return 'Closed';
      default: return 'In Production';
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());

    if (_selected != null) {
      return _buildDetail(_selected!);
    }

    final inProd = _sessions.where((s) => s['status'] == 'in_production').length;
    final completed = _sessions.where((s) => s['status'] == 'completed').length;
    final totalPenalty = _sessions.fold<double>(
      0,
      (sum, s) => sum + (double.tryParse('${s['total_penalty'] ?? 0}') ?? 0),
    );

    return _Page(
      title: 'Kitchen Sessions',
      subtitle: 'Issue stock to kitchen, log actual production, track variance.',
      actions: [
        _RefreshButton(onPressed: _load),
        FilledButton.icon(
          onPressed: _openNewSession,
          icon: const Icon(Icons.add, size: 16),
          label: const Text('New Session'),
        ),
      ],
      children: [
        _StatGrid(cards: [
          _StatCardData('In Production', '$inProd', Icons.soup_kitchen_outlined, Colors.orange),
          _StatCardData('Completed', '$completed', Icons.check_circle_outline, Colors.green),
          _StatCardData('Recipes Loaded', '${_recipes.length}', Icons.menu_book_outlined, AppColors.kPrimary),
          _StatCardData('Total Penalties', 'KES ${totalPenalty.toStringAsFixed(0)}', Icons.money_off_outlined, AppColors.kError),
        ]),
        if (_sessions.isEmpty)
          _SectionCard(
            title: 'No Sessions Yet',
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 32),
              child: Center(
                child: Column(
                  children: [
                    Icon(Icons.soup_kitchen_outlined, size: 48, color: Colors.grey.shade400),
                    const SizedBox(height: 12),
                    const Text('Tap "New Session" when a cook comes to collect ingredients.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.grey)),
                  ],
                ),
              ),
            ),
          )
        else
          _SectionCard(
            title: 'Sessions',
            child: Column(
              children: _sessions.map((s) => _sessionTile(s)).toList(),
            ),
          ),
      ],
    );
  }

  Widget _sessionTile(Map<String, dynamic> s) {
    final status = '${s['status'] ?? ''}';
    final variance = double.tryParse('${s['total_variance'] ?? 0}') ?? 0;
    final penalty = double.tryParse('${s['total_penalty'] ?? 0}') ?? 0;
    final entries = (s['entries'] as List?) ?? [];

    return InkWell(
      onTap: () => setState(() => _selected = s),
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        child: Row(
          children: [
            Container(
              width: 10, height: 10,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _statusColor(status),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${s['session_number'] ?? 'Session'}',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                  const SizedBox(height: 2),
                  Text('Cook: ${s['staff_name'] ?? '—'}  •  ${s['session_date'] ?? ''}',
                      style: const TextStyle(fontSize: 12, color: Colors.grey)),
                  if (entries.isNotEmpty)
                    Text('${entries.length} item(s) planned',
                        style: const TextStyle(fontSize: 11, color: Colors.grey)),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _statusColor(status).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(_statusLabel(status),
                      style: TextStyle(fontSize: 11, color: _statusColor(status), fontWeight: FontWeight.w600)),
                ),
                if (penalty > 0) ...[
                  const SizedBox(height: 4),
                  Text('−KES ${penalty.toStringAsFixed(0)}',
                      style: const TextStyle(fontSize: 12, color: Colors.red, fontWeight: FontWeight.w700)),
                ] else if (variance != 0 && status == 'completed') ...[
                  const SizedBox(height: 4),
                  Text('Var: ${variance > 0 ? '+' : ''}${variance.toStringAsFixed(1)}',
                      style: TextStyle(fontSize: 12,
                          color: variance >= 0 ? Colors.green : Colors.red,
                          fontWeight: FontWeight.w600)),
                ],
              ],
            ),
            const SizedBox(width: 8),
            Icon(Icons.chevron_right, color: Colors.grey.shade400),
          ],
        ),
      ),
    );
  }

  Widget _buildDetail(Map<String, dynamic> s) {
    final status = '${s['status'] ?? ''}';
    final issues = (s['issues'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final entries = (s['entries'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final canComplete = status == 'in_production';

    return _Page(
      title: '${s['session_number'] ?? 'Session'}',
      subtitle: 'Cook: ${s['staff_name']}  •  ${s['session_date'] ?? ''}',
      actions: [
        OutlinedButton.icon(
          onPressed: () => setState(() => _selected = null),
          icon: const Icon(Icons.arrow_back, size: 16),
          label: const Text('Back'),
        ),
        _RefreshButton(onPressed: () async {
          final repo = ref.read(branchStorekeeperRepositoryProvider);
          final detail = await repo.getProductionSessionDetail(s['id']);
          if (mounted) setState(() => _selected = detail);
        }),
        if (canComplete)
          FilledButton.icon(
            onPressed: () => _openComplete(s),
            icon: const Icon(Icons.check, size: 16),
            label: const Text('Record Production'),
            style: FilledButton.styleFrom(backgroundColor: Colors.green),
          ),
      ],
      children: [
        // Status banner
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: _statusColor(status).withOpacity(0.10),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: _statusColor(status).withOpacity(0.3)),
          ),
          child: Row(
            children: [
              Icon(Icons.info_outline, color: _statusColor(status), size: 18),
              const SizedBox(width: 8),
              Text(_statusLabel(status),
                  style: TextStyle(color: _statusColor(status), fontWeight: FontWeight.w600)),
              if (s['notes'] != null && '${s['notes']}'.isNotEmpty) ...[
                const Text('  •  ', style: TextStyle(color: Colors.grey)),
                Expanded(child: Text('${s['notes']}', style: const TextStyle(color: Colors.grey, fontSize: 12))),
              ],
            ],
          ),
        ),
        // Issued ingredients
        _SectionCard(
          title: 'Ingredients Issued to Kitchen',
          child: issues.isEmpty
              ? const Text('No issues recorded.', style: TextStyle(color: Colors.grey))
              : Table(
                  columnWidths: const {0: FlexColumnWidth(3), 1: FlexColumnWidth(2), 2: FlexColumnWidth(1)},
                  children: [
                    TableRow(
                      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: Colors.grey.shade200))),
                      children: const [
                        Padding(padding: EdgeInsets.only(bottom: 6), child: Text('Ingredient', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12))),
                        Padding(padding: EdgeInsets.only(bottom: 6), child: Text('Issued', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12))),
                        Padding(padding: EdgeInsets.only(bottom: 6), child: Text('Unit', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12))),
                      ],
                    ),
                    ...issues.map((i) => TableRow(children: [
                      Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Text('${i['item_name']}', style: const TextStyle(fontSize: 13))),
                      Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Text('${i['quantity_issued']}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                      Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Text('${i['unit'] ?? ''}', style: const TextStyle(fontSize: 12, color: Colors.grey))),
                    ])),
                  ],
                ),
        ),
        // Production entries + variance
        _SectionCard(
          title: 'Production & Variance',
          child: entries.isEmpty
              ? const Text('No production entries.', style: TextStyle(color: Colors.grey))
              : Column(
                  children: [
                    Table(
                      columnWidths: const {
                        0: FlexColumnWidth(3),
                        1: FlexColumnWidth(2),
                        2: FlexColumnWidth(2),
                        3: FlexColumnWidth(2),
                        4: FlexColumnWidth(2),
                      },
                      children: [
                        TableRow(
                          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: Colors.grey.shade200))),
                          children: const [
                            Padding(padding: EdgeInsets.only(bottom: 6), child: Text('Item', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11))),
                            Padding(padding: EdgeInsets.only(bottom: 6), child: Text('Expected', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11))),
                            Padding(padding: EdgeInsets.only(bottom: 6), child: Text('Actual', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11))),
                            Padding(padding: EdgeInsets.only(bottom: 6), child: Text('Variance', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11))),
                            Padding(padding: EdgeInsets.only(bottom: 6), child: Text('Penalty', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11))),
                          ],
                        ),
                        ...entries.map((e) {
                          final variance = double.tryParse('${e['variance'] ?? 0}') ?? 0;
                          final penalty = double.tryParse('${e['variance_penalty'] ?? 0}') ?? 0;
                          final isNeg = variance < 0;
                          return TableRow(children: [
                            Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Text('${e['menu_item_name']}', style: const TextStyle(fontSize: 12))),
                            Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Text('${e['expected_quantity'] ?? 0}', style: const TextStyle(fontSize: 12))),
                            Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Text('${e['actual_quantity'] ?? 0}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))),
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 6),
                              child: Text(
                                '${variance >= 0 ? '+' : ''}${variance.toStringAsFixed(1)}',
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                                    color: isNeg ? Colors.red : Colors.green),
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 6),
                              child: penalty > 0
                                  ? Text('KES ${penalty.toStringAsFixed(0)}',
                                      style: const TextStyle(fontSize: 12, color: Colors.red, fontWeight: FontWeight.w700))
                                  : const Text('—', style: TextStyle(color: Colors.grey)),
                            ),
                          ]);
                        }),
                      ],
                    ),
                    if (status == 'completed') ...[
                      const Divider(height: 24),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Total Penalty Raised:', style: TextStyle(fontWeight: FontWeight.w700)),
                          Text(
                            'KES ${(double.tryParse('${s['total_penalty'] ?? 0}') ?? 0).toStringAsFixed(2)}',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 15,
                              color: (double.tryParse('${s['total_penalty'] ?? 0}') ?? 0) > 0
                                  ? Colors.red : Colors.green,
                            ),
                          ),
                        ],
                      ),
                      if ((double.tryParse('${s['total_penalty'] ?? 0}') ?? 0) > 0)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: Colors.red.shade50,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.red.shade200),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.receipt_long_outlined, color: Colors.red, size: 16),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Credit bill raised against ${s['staff_name']} — sent to accountant for review.',
                                    style: const TextStyle(fontSize: 12, color: Colors.red),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ],
                ),
        ),
      ],
    );
  }
}

// ── New Session Bottom Sheet ─────────────────────────────────────────────────

class _NewSessionSheet extends ConsumerStatefulWidget {
  const _NewSessionSheet({required this.recipes, required this.stock});
  final List<Map<String, dynamic>> recipes;
  final List<Map<String, dynamic>> stock;

  @override
  ConsumerState<_NewSessionSheet> createState() => _NewSessionSheetState();
}

class _NewSessionSheetState extends ConsumerState<_NewSessionSheet> {
  final _cookNameCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();

  // Selected recipes: recipeId → {recipe, qty to produce (text ctrl)}
  final Map<String, _RecipePlan> _plans = {};
  bool _posting = false;

  @override
  void dispose() {
    _cookNameCtrl.dispose();
    _notesCtrl.dispose();
    for (final p in _plans.values) p.ctrl.dispose();
    super.dispose();
  }

  void _toggleRecipe(Map<String, dynamic> recipe) {
    final id = '${recipe['id']}';
    setState(() {
      if (_plans.containsKey(id)) {
        _plans.remove(id)?.ctrl.dispose();
      } else {
        _plans[id] = _RecipePlan(recipe: recipe, ctrl: TextEditingController(text: '${recipe['output_quantity'] ?? 1}'));
      }
    });
  }

  // Compute total ingredient needs from all plans
  Map<String, _IngredientNeed> _computeNeeds() {
    final needs = <String, _IngredientNeed>{};
    for (final plan in _plans.values) {
      final qty = double.tryParse(plan.ctrl.text.trim()) ?? 0;
      if (qty <= 0) continue;
      final ingredients = (plan.recipe['ingredients'] as List?) ?? [];
      for (final ing in ingredients.cast<Map<String, dynamic>>()) {
        final sku = '${ing['item_sku']}';
        final perPortion = double.tryParse('${ing['quantity_required']}') ?? 0;
        final total = perPortion * qty;
        final unit = '${ing['unit'] ?? 'kg'}';
        final name = '${ing['item_name']}';
        if (needs.containsKey(sku)) {
          needs[sku]!.qty += total;
        } else {
          needs[sku] = _IngredientNeed(sku: sku, name: name, qty: total, unit: unit);
        }
      }
    }
    return needs;
  }

  Future<void> _submit() async {
    if (_cookNameCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter cook name'), backgroundColor: Colors.red),
      );
      return;
    }
    if (_plans.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select at least one item to produce'), backgroundColor: Colors.red),
      );
      return;
    }
    final needs = _computeNeeds();
    if (needs.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No ingredients computed — check recipe quantities'), backgroundColor: Colors.red),
      );
      return;
    }

    setState(() => _posting = true);
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      await repo.createProductionSession(
        staffName: _cookNameCtrl.text.trim(),
        notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
        issues: needs.values.map((n) => {
          'item_sku': n.sku,
          'item_name': n.name,
          'quantity_issued': n.qty,
          'unit': n.unit,
        }).toList(),
        plannedItems: _plans.values.map((p) => {
          'menu_item_id': p.recipe['menu_item_id'],
          'menu_item_name': p.recipe['menu_item_name'],
        }).toList(),
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final needs = _computeNeeds();
    final bottomPad = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      height: MediaQuery.of(context).size.height * 0.90,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          // Handle
          const SizedBox(height: 12),
          Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                const Icon(Icons.soup_kitchen_outlined, color: AppColors.kPrimary),
                const SizedBox(width: 10),
                const Expanded(child: Text('New Kitchen Session', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800))),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.of(context).pop()),
              ],
            ),
          ),
          const Divider(),
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(20, 8, 20, bottomPad + 100),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Cook name
                  TextField(
                    controller: _cookNameCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Cook / Staff Name *',
                      prefixIcon: Icon(Icons.person_outline),
                      border: OutlineInputBorder(),
                    ),
                    textCapitalization: TextCapitalization.words,
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _notesCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Notes (optional)',
                      prefixIcon: Icon(Icons.notes_outlined),
                      border: OutlineInputBorder(),
                    ),
                    maxLines: 1,
                  ),
                  const SizedBox(height: 20),
                  // Recipe selection
                  Row(
                    children: [
                      const Text('Select Items to Produce', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                      const SizedBox(width: 8),
                      Text('(${widget.recipes.length} recipes)', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ...widget.recipes.map((recipe) {
                    final id = '${recipe['id']}';
                    final selected = _plans.containsKey(id);
                    final ingredients = (recipe['ingredients'] as List?) ?? [];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                        side: BorderSide(
                          color: selected ? AppColors.kPrimary : Colors.grey.shade200,
                          width: selected ? 2 : 1,
                        ),
                      ),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(10),
                        onTap: () => _toggleRecipe(recipe),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Checkbox(
                                    value: selected,
                                    onChanged: (_) => _toggleRecipe(recipe),
                                    activeColor: AppColors.kPrimary,
                                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                  ),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text('${recipe['menu_item_name']}',
                                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                                        Text('${recipe['recipe_name']}  •  std batch: ${recipe['output_quantity']} ${recipe['output_unit'] ?? 'portions'}',
                                            style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                      ],
                                    ),
                                  ),
                                  if (selected)
                                    SizedBox(
                                      width: 70,
                                      child: TextField(
                                        controller: _plans[id]?.ctrl,
                                        keyboardType: TextInputType.number,
                                        textAlign: TextAlign.center,
                                        decoration: const InputDecoration(
                                          labelText: 'Qty',
                                          border: OutlineInputBorder(),
                                          contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                                          isDense: true,
                                        ),
                                        onChanged: (_) => setState(() {}),
                                      ),
                                    ),
                                ],
                              ),
                              if (ingredients.isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(left: 40, top: 4),
                                  child: Wrap(
                                    spacing: 6,
                                    children: ingredients.map<Widget>((ing) {
                                      final qr = double.tryParse('${ing['quantity_required']}') ?? 0;
                                      return Chip(
                                        label: Text('${ing['item_name']} ${qr.toStringAsFixed(3)} ${ing['unit']}',
                                            style: const TextStyle(fontSize: 10)),
                                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                        padding: EdgeInsets.zero,
                                        visualDensity: VisualDensity.compact,
                                        backgroundColor: Colors.grey.shade100,
                                      );
                                    }).toList(),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),
                  // Ingredient summary
                  if (needs.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.blue.shade50,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.blue.shade200),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.inventory_2_outlined, color: Colors.blue, size: 16),
                              SizedBox(width: 6),
                              Text('Stock to be Issued', style: TextStyle(fontWeight: FontWeight.w700, color: Colors.blue)),
                            ],
                          ),
                          const SizedBox(height: 10),
                          ...needs.values.map((n) {
                            final stockItem = widget.stock.firstWhere(
                              (s) => '${s['item_sku']}' == n.sku || '${s['sku']}' == n.sku,
                              orElse: () => <String, dynamic>{},
                            );
                            final available = double.tryParse('${stockItem['quantity'] ?? stockItem['current_stock'] ?? 0}') ?? 0;
                            final sufficient = available >= n.qty;
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 6),
                              child: Row(
                                children: [
                                  Icon(sufficient ? Icons.check_circle_outline : Icons.warning_amber_outlined,
                                      size: 14,
                                      color: sufficient ? Colors.green : Colors.orange),
                                  const SizedBox(width: 6),
                                  Expanded(child: Text(n.name, style: const TextStyle(fontSize: 12))),
                                  Text('${n.qty.toStringAsFixed(3)} ${n.unit}',
                                      style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                          color: sufficient ? Colors.black87 : Colors.orange)),
                                  const SizedBox(width: 8),
                                  Text('(avail: ${available.toStringAsFixed(2)})',
                                      style: TextStyle(fontSize: 11,
                                          color: sufficient ? Colors.grey : Colors.orange)),
                                ],
                              ),
                            );
                          }),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          // Bottom sticky bar
          Container(
            padding: EdgeInsets.fromLTRB(20, 12, 20, MediaQuery.of(context).padding.bottom + 12),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Colors.grey.shade200)),
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 8, offset: const Offset(0, -2))],
            ),
            child: SizedBox(
              width: double.infinity,
              height: 48,
              child: FilledButton.icon(
                onPressed: _posting ? null : _submit,
                icon: _posting
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.send_outlined),
                label: Text(_posting ? 'Creating...' : 'Create Session & Issue Stock'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RecipePlan {
  _RecipePlan({required this.recipe, required this.ctrl});
  final Map<String, dynamic> recipe;
  final TextEditingController ctrl;
}

class _IngredientNeed {
  _IngredientNeed({required this.sku, required this.name, required this.qty, required this.unit});
  final String sku;
  final String name;
  double qty;
  final String unit;
}

// ── Record Production Bottom Sheet ─────────────────────────────────────────

class _RecordProductionSheet extends ConsumerStatefulWidget {
  const _RecordProductionSheet({required this.session});
  final Map<String, dynamic> session;

  @override
  ConsumerState<_RecordProductionSheet> createState() => _RecordProductionSheetState();
}

class _RecordProductionSheetState extends ConsumerState<_RecordProductionSheet> {
  final Map<String, TextEditingController> _ctrlMap = {};
  bool _posting = false;

  List<Map<String, dynamic>> get _entries =>
      ((widget.session['entries'] as List?) ?? []).cast<Map<String, dynamic>>();

  @override
  void initState() {
    super.initState();
    for (final e in _entries) {
      final id = '${e['id']}';
      _ctrlMap[id] = TextEditingController(
        text: '${e['expected_quantity'] ?? 0}',
      );
    }
  }

  @override
  void dispose() {
    for (final c in _ctrlMap.values) c.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _posting = true);
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      final entries = _entries.map((e) {
        final id = '${e['id']}';
        return {
          'entry_id': id,
          'actual_quantity': double.tryParse(_ctrlMap[id]?.text.trim() ?? '0') ?? 0,
        };
      }).toList();

      final result = await repo.completeProductionSession(
        sessionId: '${widget.session['id']}',
        entries: entries,
      );
      if (mounted) {
        Navigator.of(context).pop({
          ...result,
          'session_id': widget.session['id'],
          'total_penalty': result['total_penalty'],
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomPad = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      height: MediaQuery.of(context).size.height * 0.80,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 12),
          Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                const Icon(Icons.fact_check_outlined, color: Colors.green),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Record Actual Production', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                      Text('Cook: ${widget.session['staff_name']}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                    ],
                  ),
                ),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.of(context).pop()),
              ],
            ),
          ),
          const Divider(),
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.amber.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.amber.shade300),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline, color: Colors.amber, size: 16),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Enter the ACTUAL number of items the cook produced. Negative variance = deduction from cook\'s credit bill.',
                    style: TextStyle(fontSize: 12, color: Colors.black87),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.separated(
              padding: EdgeInsets.fromLTRB(20, 8, 20, bottomPad + 100),
              itemCount: _entries.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (_, i) {
                final e = _entries[i];
                final id = '${e['id']}';
                final expected = double.tryParse('${e['expected_quantity'] ?? 0}') ?? 0;
                final price = double.tryParse('${e['menu_selling_price'] ?? 0}') ?? 0;
                final actualText = _ctrlMap[id]?.text.trim() ?? '0';
                final actual = double.tryParse(actualText) ?? 0;
                final variance = actual - expected;
                final penalty = variance < 0 ? (-variance * price) : 0.0;

                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${e['menu_item_name']}',
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Expected: ${expected.toStringAsFixed(0)} portions  •  Price: KES ${price.toStringAsFixed(0)}',
                              style: const TextStyle(color: Colors.grey, fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _ctrlMap[id],
                              keyboardType: TextInputType.number,
                              decoration: InputDecoration(
                                labelText: 'Actual produced *',
                                border: const OutlineInputBorder(),
                                suffixText: 'portions',
                                filled: variance < 0,
                                fillColor: variance < 0 ? Colors.red.shade50 : null,
                              ),
                              onChanged: (_) => setState(() {}),
                            ),
                          ),
                          const SizedBox(width: 12),
                          SizedBox(
                            width: 110,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  '${variance >= 0 ? '+' : ''}${variance.toStringAsFixed(1)}',
                                  style: TextStyle(
                                    fontSize: 16, fontWeight: FontWeight.w800,
                                    color: variance >= 0 ? Colors.green : Colors.red,
                                  ),
                                ),
                                Text('variance', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                if (penalty > 0) ...[
                                  const SizedBox(height: 2),
                                  Text('−KES ${penalty.toStringAsFixed(0)}',
                                      style: const TextStyle(fontSize: 12, color: Colors.red, fontWeight: FontWeight.w700)),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
          // Total penalty preview
          if (_entries.isNotEmpty) Builder(builder: (ctx) {
            double totalPenalty = 0;
            for (final e in _entries) {
              final id = '${e['id']}';
              final expected = double.tryParse('${e['expected_quantity'] ?? 0}') ?? 0;
              final price = double.tryParse('${e['menu_selling_price'] ?? 0}') ?? 0;
              final actual = double.tryParse(_ctrlMap[id]?.text.trim() ?? '0') ?? 0;
              final variance = actual - expected;
              if (variance < 0) totalPenalty += -variance * price;
            }
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              color: totalPenalty > 0 ? Colors.red.shade50 : Colors.green.shade50,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(totalPenalty > 0 ? 'Penalty to raise:' : 'No penalty',
                      style: TextStyle(fontWeight: FontWeight.w600,
                          color: totalPenalty > 0 ? Colors.red : Colors.green)),
                  if (totalPenalty > 0)
                    Text('KES ${totalPenalty.toStringAsFixed(2)}',
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Colors.red)),
                ],
              ),
            );
          }),
          Container(
            padding: EdgeInsets.fromLTRB(20, 12, 20, MediaQuery.of(context).padding.bottom + 12),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Colors.grey.shade200)),
            ),
            child: SizedBox(
              width: double.infinity,
              height: 48,
              child: FilledButton.icon(
                onPressed: _posting ? null : _submit,
                style: FilledButton.styleFrom(backgroundColor: Colors.green),
                icon: _posting
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.check),
                label: Text(_posting ? 'Submitting...' : 'Complete Session'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
