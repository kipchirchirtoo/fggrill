import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';

enum InventoryControlInitialTab {
  truth,
  reservations,
  outletProduction,
  adjustments,
  governance,
  documents,
}

class InventoryControlCenterScreen extends ConsumerStatefulWidget {
  const InventoryControlCenterScreen({
    super.key,
    this.title = 'Inventory Control Tower',
    this.subtitle =
        'Inventory truth, alerts, production, adjustments and audit governance.',
    this.role = 'inventory',
    this.initialTab = InventoryControlInitialTab.governance,
    this.allowGovernanceReview = false,
  });

  final String title;
  final String subtitle;
  final String role;
  final InventoryControlInitialTab initialTab;
  final bool allowGovernanceReview;

  @override
  ConsumerState<InventoryControlCenterScreen> createState() =>
      _InventoryControlCenterScreenState();
}

class _InventoryControlCenterScreenState
    extends ConsumerState<InventoryControlCenterScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  late Future<_InventoryControlSnapshot> _future;
  String _search = '';
  String _severity = '';
  String _status = '';

  @override
  void initState() {
    super.initState();
    _tabs = TabController(
      length: 6,
      vsync: this,
      initialIndex: widget.initialTab.index,
    );
    _future = _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<String?> get _branchId async {
    final storage = ref.read(secureStorageProvider);
    final value = await storage.read(key: AuthRepository.branchIdKey);
    return value == null || value.trim().isEmpty ? null : value.trim();
  }

  Dio get _dio => ref.read(dioProvider);

  Future<Map<String, dynamic>> _branchQuery(
      [Map<String, dynamic>? extra]) async {
    final branchId = await _branchId;
    return {
      if (branchId != null) 'branch_id': branchId,
      ...?extra,
    };
  }

  Map<String, dynamic> _map(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    return <String, dynamic>{};
  }

  Map<String, dynamic> _unwrapMap(dynamic data) {
    final raw = _map(data);
    final payload = raw['data'];
    if (payload is Map) return Map<String, dynamic>.from(payload);
    return raw;
  }

  List<Map<String, dynamic>> _unwrapList(dynamic data) {
    final raw = data is Map ? Map<String, dynamic>.from(data) : null;
    final payload = raw == null
        ? data
        : raw['data'] ?? raw['rows'] ?? raw['items'] ?? raw['results'];
    if (payload is List) {
      return payload
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }
    if (payload is Map) return [Map<String, dynamic>.from(payload)];
    return <Map<String, dynamic>>[];
  }

  Future<List<Map<String, dynamic>>> _getList(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    final response = await _dio.get(
      path,
      queryParameters: await _branchQuery(query),
    );
    return _unwrapList(response.data);
  }

  Future<Map<String, dynamic>> _getMap(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    final response = await _dio.get(
      path,
      queryParameters: await _branchQuery(query),
    );
    return _unwrapMap(response.data);
  }

  Future<T> _safe<T>(Future<T> Function() action, T fallback) async {
    try {
      return await action();
    } catch (_) {
      return fallback;
    }
  }

  Future<_InventoryControlSnapshot> _load() async {
    final results = await Future.wait<dynamic>([
      _safe(
          () =>
              _getList('/inventory-foundation/balances', query: {'limit': 250}),
          <Map<String, dynamic>>[]),
      _safe(
          () => _getList('/inventory-foundation/movements',
              query: {'limit': 120}),
          <Map<String, dynamic>>[]),
      _safe(
          () => _getList('/inventory-foundation/reservations',
              query: {'limit': 120}),
          <Map<String, dynamic>>[]),
      _safe(
          () => _getList('/inventory-foundation/alerts',
              query: {'status': 'open', 'limit': 120}),
          <Map<String, dynamic>>[]),
      _safe(
          () => _getList('/inventory-foundation/outlet-stock',
              query: {'limit': 250}),
          <Map<String, dynamic>>[]),
      _safe(
          () => _getList('/inventory-foundation/stock-adjustments',
              query: {'limit': 120}),
          <Map<String, dynamic>>[]),
      _safe(
          () => _getList('/inventory-governance/exceptions',
              query: {'limit': 120}),
          <Map<String, dynamic>>[]),
      _safe(() => _getMap('/inventory-governance/alerts'), <String, dynamic>{}),
      _safe(() => _getMap('/inventory-governance/dashboards/${widget.role}'),
          <String, dynamic>{}),
      _safe(
          () => _getList('/inventory-governance/documents',
              query: {'limit': 120}),
          <Map<String, dynamic>>[]),
      _safe(() => _getList('/inventory-governance/rules'),
          <Map<String, dynamic>>[]),
    ]);

    return _InventoryControlSnapshot(
      balances: List<Map<String, dynamic>>.from(results[0] as List),
      movements: List<Map<String, dynamic>>.from(results[1] as List),
      reservations: List<Map<String, dynamic>>.from(results[2] as List),
      alerts: List<Map<String, dynamic>>.from(results[3] as List),
      outletStock: List<Map<String, dynamic>>.from(results[4] as List),
      adjustments: List<Map<String, dynamic>>.from(results[5] as List),
      exceptions: List<Map<String, dynamic>>.from(results[6] as List),
      alertSummary: Map<String, dynamic>.from(results[7] as Map),
      dashboard: Map<String, dynamic>.from(results[8] as Map),
      documents: List<Map<String, dynamic>>.from(results[9] as List),
      rules: List<Map<String, dynamic>>.from(results[10] as List),
    );
  }

  void _refresh() {
    setState(() => _future = _load());
  }

  List<Map<String, dynamic>> _filterRows(List<Map<String, dynamic>> rows) {
    final q = _search.trim().toLowerCase();
    return rows.where((row) {
      if (_severity.isNotEmpty &&
          '${row['severity'] ?? ''}'.toLowerCase() != _severity) {
        return false;
      }
      if (_status.isNotEmpty &&
          '${row['status'] ?? row['workflow_status'] ?? ''}'.toLowerCase() !=
              _status) {
        return false;
      }
      if (q.isEmpty) return true;
      return row.values.any((value) => '$value'.toLowerCase().contains(q));
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_InventoryControlSnapshot>(
      future: _future,
      builder: (context, snapshot) {
        final loading = snapshot.connectionState == ConnectionState.waiting &&
            !snapshot.hasData;
        if (snapshot.hasError) {
          return _PageFrame(
            title: widget.title,
            subtitle: widget.subtitle,
            actions: [
              _ActionButton(
                  label: 'Retry', icon: Icons.refresh, onTap: _refresh)
            ],
            child: _ErrorPanel(message: '${snapshot.error}', onRetry: _refresh),
          );
        }
        final data = snapshot.data ?? _InventoryControlSnapshot.empty();
        return _PageFrame(
          title: widget.title,
          subtitle: widget.subtitle,
          actions: [
            _ActionButton(
                label: 'Refresh', icon: Icons.refresh, onTap: _refresh),
          ],
          child: Column(
            children: [
              _Toolbar(
                search: _search,
                severity: _severity,
                status: _status,
                onSearch: (value) => setState(() => _search = value),
                onSeverity: (value) => setState(() => _severity = value ?? ''),
                onStatus: (value) => setState(() => _status = value ?? ''),
              ),
              const SizedBox(height: 12),
              TabBar(
                controller: _tabs,
                isScrollable: true,
                labelColor: const Color(0xff163d63),
                tabs: const [
                  Tab(icon: Icon(Icons.inventory_2_outlined), text: 'Truth'),
                  Tab(
                      icon: Icon(Icons.event_available_outlined),
                      text: 'Reservations'),
                  Tab(
                      icon: Icon(Icons.precision_manufacturing_outlined),
                      text: 'Outlet & Production'),
                  Tab(icon: Icon(Icons.rule_outlined), text: 'Adjustments'),
                  Tab(
                      icon: Icon(Icons.verified_user_outlined),
                      text: 'Governance'),
                  Tab(
                      icon: Icon(Icons.description_outlined),
                      text: 'Documents'),
                ],
              ),
              const SizedBox(height: 12),
              Expanded(
                child: loading
                    ? const Center(child: CircularProgressIndicator())
                    : TabBarView(
                        controller: _tabs,
                        children: [
                          _truthTab(data),
                          _reservationsTab(data),
                          _outletProductionTab(data),
                          _adjustmentsTab(data),
                          _governanceTab(data),
                          _documentsTab(data),
                        ],
                      ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _truthTab(_InventoryControlSnapshot data) {
    final balances = _filterRows(data.balances);
    final movements = _filterRows(data.movements);
    final totalAvailable = balances.fold<double>(
      0,
      (sum, row) => sum + _num(row['available_quantity'] ?? row['quantity']),
    );
    final reserved = balances.fold<double>(
      0,
      (sum, row) => sum + _num(row['reserved_quantity']),
    );

    return _ScrollColumn(
      children: [
        _StatsGrid(cards: [
          _StatCardData('Items', '${balances.length}',
              Icons.inventory_2_outlined, Colors.blue),
          _StatCardData('Available', _qty(totalAvailable),
              Icons.check_circle_outline, Colors.green),
          _StatCardData('Reserved', _qty(reserved), Icons.lock_clock_outlined,
              Colors.orange),
          _StatCardData('Movements', '${movements.length}',
              Icons.swap_horiz_outlined, Colors.indigo),
        ]),
        const SizedBox(height: 16),
        _SectionCard(
          title: 'Inventory Balances',
          subtitle:
              'Computed current, reserved, damaged, expired and available quantity.',
          child: _RecordTable(
            rows: balances,
            columns: const [
              _ColumnSpec('Item', ['item_name', 'name', 'sku', 'item_sku']),
              _ColumnSpec('SKU', ['sku', 'item_sku', 'item_id']),
              _ColumnSpec('Location', ['location_name', 'location_code']),
              _ColumnSpec('Current', ['current_quantity', 'quantity']),
              _ColumnSpec('Reserved', ['reserved_quantity']),
              _ColumnSpec('Available', ['available_quantity']),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _SectionCard(
          title: 'Movement Ledger',
          subtitle:
              'Every quantity change with document reference and actor trail.',
          child: _RecordTable(
            rows: movements,
            columns: const [
              _ColumnSpec('Date', ['created_at']),
              _ColumnSpec('Type', ['movement_type']),
              _ColumnSpec('Item', ['item_name', 'sku', 'item_sku']),
              _ColumnSpec('Qty', ['quantity']),
              _ColumnSpec(
                  'Source', ['source_location_name', 'source_location_code']),
              _ColumnSpec('Destination',
                  ['destination_location_name', 'destination_location_code']),
              _ColumnSpec(
                  'Document', ['document_number', 'document_reference']),
            ],
          ),
        ),
      ],
    );
  }

  Widget _reservationsTab(_InventoryControlSnapshot data) {
    final reservations = _filterRows(data.reservations);
    final alerts = _filterRows(data.alerts);
    return _ScrollColumn(
      children: [
        _StatsGrid(cards: [
          _StatCardData('Reservations', '${reservations.length}',
              Icons.event_available_outlined, Colors.blue),
          _StatCardData('Open Alerts', '${alerts.length}',
              Icons.notifications_active_outlined, Colors.red),
          _StatCardData(
              'Critical',
              '${alerts.where((a) => '${a['severity']}'.toLowerCase() == 'critical').length}',
              Icons.priority_high_outlined,
              Colors.deepOrange),
          _StatCardData(
              'Expired/Damaged',
              '${alerts.where((a) => '${a['alert_type']}'.contains('expired') || '${a['alert_type']}'.contains('damaged')).length}',
              Icons.warning_amber_outlined,
              Colors.orange),
        ]),
        const SizedBox(height: 16),
        _SectionCard(
          title: 'Reservations',
          subtitle:
              'Reserved stock reduces availability, not physical quantity.',
          child: _RecordTable(
            rows: reservations,
            columns: const [
              _ColumnSpec('Item', ['item_name', 'sku', 'item_sku']),
              _ColumnSpec('Qty', ['quantity', 'reserved_quantity']),
              _ColumnSpec('Status', ['status', 'state']),
              _ColumnSpec('Document',
                  ['source_document_number', 'source_document_reference']),
              _ColumnSpec('Expires', ['expires_at']),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _SectionCard(
          title: 'Inventory Alerts',
          subtitle:
              'Low stock, expired, damaged, negative attempt and over-reservation warnings.',
          child: _RecordTable(
            rows: alerts,
            columns: const [
              _ColumnSpec('Type', ['alert_type']),
              _ColumnSpec('Severity', ['severity']),
              _ColumnSpec('Status', ['status']),
              _ColumnSpec('Message', ['message', 'title']),
              _ColumnSpec('Document', ['source_document_reference']),
            ],
          ),
        ),
      ],
    );
  }

  Widget _outletProductionTab(_InventoryControlSnapshot data) {
    final outlet = _filterRows(data.outletStock);
    return _ScrollColumn(
      children: [
        _StatsGrid(cards: [
          _StatCardData('Outlet Items', '${outlet.length}',
              Icons.storefront_outlined, Colors.blue),
          _StatCardData(
              'Low/Out',
              '${outlet.where((r) => '${r['status']}'.contains('low') || '${r['status']}'.contains('out')).length}',
              Icons.report_outlined,
              Colors.red),
          _StatCardData(
              'Produced',
              '${outlet.where((r) => _num(r['produced_quantity']) > 0).length}',
              Icons.precision_manufacturing_outlined,
              Colors.green),
          _StatCardData(
              'Variance',
              '${outlet.where((r) => _num(r['variance_quantity']) != 0).length}',
              Icons.difference_outlined,
              Colors.orange),
        ]),
        const SizedBox(height: 16),
        _SectionCard(
          title: 'Outlet Stock',
          subtitle:
              'Opening + produced + transferred in - sales - issued out - wastage = closing.',
          child: _RecordTable(
            rows: outlet,
            columns: const [
              _ColumnSpec('Outlet', ['outlet_name', 'outlet_type']),
              _ColumnSpec('Item', ['item_name', 'sku', 'item_sku']),
              _ColumnSpec('Opening', ['opening_quantity']),
              _ColumnSpec('Produced', ['produced_quantity']),
              _ColumnSpec('Sales', ['sales_quantity']),
              _ColumnSpec('Closing', ['closing_quantity', 'quantity']),
              _ColumnSpec('Status', ['status']),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _ProductionRunCard(onPosted: _refresh),
      ],
    );
  }

  Widget _adjustmentsTab(_InventoryControlSnapshot data) {
    final rows = _filterRows(data.adjustments);
    return _ScrollColumn(
      children: [
        _StatsGrid(cards: [
          _StatCardData(
              'Requests', '${rows.length}', Icons.rule_outlined, Colors.blue),
          _StatCardData(
              'Pending',
              '${rows.where((r) => '${r['status']}'.toLowerCase() == 'requested').length}',
              Icons.hourglass_bottom_outlined,
              Colors.orange),
          _StatCardData(
              'Approved',
              '${rows.where((r) => '${r['status']}'.toLowerCase() == 'approved').length}',
              Icons.verified_outlined,
              Colors.green),
          _StatCardData(
              'High Risk',
              '${rows.where((r) => [
                    'theft',
                    'loss',
                    'write_off'
                  ].contains('${r['adjustment_reason']}'.toLowerCase())).length}',
              Icons.security_outlined,
              Colors.red),
        ]),
        const SizedBox(height: 16),
        _SectionCard(
          title: 'Stock Adjustment Requests',
          subtitle:
              'Corrections are requested, reviewed, approved, posted and audited.',
          trailing: _ActionButton(
            label: 'New Request',
            icon: Icons.add,
            onTap: () => _showAdjustmentDialog(),
          ),
          child: _RecordTable(
            rows: rows,
            columns: const [
              _ColumnSpec('Number', ['adjustment_number', 'id']),
              _ColumnSpec('Reason', ['adjustment_reason']),
              _ColumnSpec('Status', ['status']),
              _ColumnSpec(
                  'Requested By', ['requested_by_name', 'created_by_name']),
              _ColumnSpec('Created', ['created_at']),
            ],
          ),
        ),
      ],
    );
  }

  Widget _governanceTab(_InventoryControlSnapshot data) {
    final exceptions = _filterRows(data.exceptions);
    final cards = _map(data.dashboard['cards'] ?? data.dashboard);
    return _ScrollColumn(
      children: [
        _StatsGrid(cards: [
          _StatCardData(
              'Open Alerts',
              '${cards['open_alerts'] ?? data.alerts.length}',
              Icons.notifications_active_outlined,
              Colors.red),
          _StatCardData(
              'Critical',
              '${cards['critical_alerts'] ?? exceptions.where((e) => '${e['severity']}' == 'critical').length}',
              Icons.priority_high_outlined,
              Colors.deepOrange),
          _StatCardData('Requests', '${cards['pending_requests'] ?? 0}',
              Icons.assignment_outlined, Colors.blue),
          _StatCardData(
              'Dispatch Follow-up',
              '${cards['pending_dispatches'] ?? 0}',
              Icons.local_shipping_outlined,
              Colors.indigo),
        ]),
        const SizedBox(height: 16),
        _SectionCard(
          title: 'Audit Exception Queue',
          subtitle:
              'Critical variances, rejected requests, partial dispatches, shortages and high-risk adjustments.',
          child: _ExceptionList(
            rows: exceptions,
            allowReview: widget.allowGovernanceReview,
            onReview: _reviewException,
          ),
        ),
      ],
    );
  }

  Widget _documentsTab(_InventoryControlSnapshot data) {
    final docs = _filterRows(data.documents);
    final rules = _filterRows(data.rules);
    return _ScrollColumn(
      children: [
        _SectionCard(
          title: 'Inventory Documents',
          subtitle:
              'Requests, approvals, packing lists, dispatch, receipt verification, MINs, stock take and adjustment documents.',
          child: _RecordTable(
            rows: docs,
            columns: const [
              _ColumnSpec('Number', ['document_number', 'source_number']),
              _ColumnSpec('Type', ['document_type']),
              _ColumnSpec('Source', ['source_table', 'source_id']),
              _ColumnSpec('Created', ['created_at']),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _SectionCard(
          title: 'Governance Rules',
          subtitle:
              'Operational hard stops and approval boundaries enforced by the inventory control layer.',
          child: _RecordTable(
            rows: rules,
            columns: const [
              _ColumnSpec('Rule', ['title']),
              _ColumnSpec('Severity', ['severity']),
              _ColumnSpec('Description', ['description']),
              _ColumnSpec('Applies To', ['applies_to']),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _showAdjustmentDialog() async {
    final reasonCtrl = TextEditingController();
    final itemCtrl = TextEditingController();
    final qtyCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    String adjustmentType = 'decrease';
    String adjustmentReason = 'count_variance';

    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('New Stock Adjustment Request'),
          content: SizedBox(
            width: 520,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: itemCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Item SKU or item ID',
                      prefixIcon: Icon(Icons.search),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: qtyCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Quantity'),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    key: ValueKey('adjustment-type-$adjustmentType'),
                    initialValue: adjustmentType,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Type'),
                    items: const [
                      DropdownMenuItem(
                          value: 'increase', child: Text('Increase')),
                      DropdownMenuItem(
                          value: 'decrease', child: Text('Decrease')),
                    ],
                    onChanged: (value) => setDialogState(
                        () => adjustmentType = value ?? adjustmentType),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    key: ValueKey('adjustment-reason-$adjustmentReason'),
                    initialValue: adjustmentReason,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Reason'),
                    items: const [
                      DropdownMenuItem(value: 'damage', child: Text('Damage')),
                      DropdownMenuItem(value: 'expiry', child: Text('Expiry')),
                      DropdownMenuItem(value: 'loss', child: Text('Loss')),
                      DropdownMenuItem(value: 'theft', child: Text('Theft')),
                      DropdownMenuItem(
                          value: 'breakage', child: Text('Breakage')),
                      DropdownMenuItem(
                          value: 'correction', child: Text('Correction')),
                      DropdownMenuItem(
                          value: 'count_variance',
                          child: Text('Count variance')),
                      DropdownMenuItem(
                          value: 'spoilage', child: Text('Spoilage')),
                      DropdownMenuItem(
                          value: 'write_off', child: Text('Write-off')),
                    ],
                    onChanged: (value) => setDialogState(
                        () => adjustmentReason = value ?? adjustmentReason),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: reasonCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Reason summary'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: notesCtrl,
                    maxLines: 3,
                    decoration: const InputDecoration(labelText: 'Notes'),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel')),
            FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Submit')),
          ],
        ),
      ),
    );

    if (saved != true) return;
    try {
      await _dio.post(
        '/inventory-foundation/stock-adjustments',
        data: {
          ...await _branchQuery(),
          'adjustment_type': adjustmentType,
          'adjustment_reason': adjustmentReason,
          'reason': reasonCtrl.text.trim().isEmpty
              ? adjustmentReason
              : reasonCtrl.text.trim(),
          'notes': notesCtrl.text.trim(),
          'items': [
            {
              'item_sku': itemCtrl.text.trim(),
              'item_name': itemCtrl.text.trim(),
              'quantity': _num(qtyCtrl.text),
              'unit_of_measure': 'units',
            }
          ],
        },
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Adjustment request submitted')),
        );
      }
      _refresh();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Adjustment failed: $error'),
              backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _reviewException(Map<String, dynamic> row, String status) async {
    try {
      await _dio.post(
        '/inventory-governance/exceptions/review',
        data: {
          ...await _branchQuery(),
          'exception_type': row['exception_type'] ?? 'inventory_exception',
          'severity': row['severity'] ?? 'medium',
          'source_table': row['source_table'],
          'source_id': row['source_id'] ?? row['id'],
          'source_number': row['source_number'],
          'title': row['title'] ?? 'Inventory exception',
          'description': row['description'],
          'status': status,
          'notes': status == 'resolved'
              ? 'Resolved from Flutter inventory control tower'
              : 'Acknowledged from Flutter inventory control tower',
        },
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Exception ${status.replaceAll('_', ' ')}')),
        );
      }
      _refresh();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Review failed: $error'),
              backgroundColor: Colors.red),
        );
      }
    }
  }
}

class _ProductionRunCard extends ConsumerStatefulWidget {
  const _ProductionRunCard({required this.onPosted});
  final VoidCallback onPosted;

  @override
  ConsumerState<_ProductionRunCard> createState() => _ProductionRunCardState();
}

class _ProductionRunCardState extends ConsumerState<_ProductionRunCard> {
  final _rawSkuCtrl = TextEditingController();
  final _rawQtyCtrl = TextEditingController();
  final _outputSkuCtrl = TextEditingController();
  final _outputNameCtrl = TextEditingController();
  final _outputQtyCtrl = TextEditingController();
  final _outletCtrl = TextEditingController();
  final _remarksCtrl = TextEditingController();
  bool _posting = false;

  @override
  void dispose() {
    _rawSkuCtrl.dispose();
    _rawQtyCtrl.dispose();
    _outputSkuCtrl.dispose();
    _outputNameCtrl.dispose();
    _outputQtyCtrl.dispose();
    _outletCtrl.dispose();
    _remarksCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: 'Post Production / Assembly',
      subtitle:
          'Consume raw branch stock and produce outlet-ready stock with one audited movement.',
      child: Wrap(
        runSpacing: 12,
        spacing: 12,
        children: [
          _field(_rawSkuCtrl, 'Raw item SKU', Icons.inventory_2_outlined),
          _field(_rawQtyCtrl, 'Consumed quantity', Icons.remove_circle_outline,
              number: true),
          _field(_outputSkuCtrl, 'Output SKU', Icons.restaurant_menu_outlined),
          _field(_outputNameCtrl, 'Output name', Icons.label_outline),
          _field(_outputQtyCtrl, 'Produced quantity', Icons.add_circle_outline,
              number: true),
          _field(_outletCtrl, 'Destination outlet', Icons.storefront_outlined),
          SizedBox(
            width: 520,
            child: TextField(
              controller: _remarksCtrl,
              decoration: const InputDecoration(labelText: 'Remarks'),
            ),
          ),
          SizedBox(
            height: 48,
            child: FilledButton.icon(
              onPressed: _posting ? null : _post,
              icon: _posting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.playlist_add_check),
              label: const Text('Post Production'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _field(TextEditingController controller, String label, IconData icon,
      {bool number = false}) {
    return SizedBox(
      width: 250,
      child: TextField(
        controller: controller,
        keyboardType: number ? TextInputType.number : TextInputType.text,
        decoration: InputDecoration(labelText: label, prefixIcon: Icon(icon)),
      ),
    );
  }

  Future<void> _post() async {
    setState(() => _posting = true);
    try {
      final storage = ref.read(secureStorageProvider);
      final branchId = await storage.read(key: AuthRepository.branchIdKey);
      await ref
          .read(dioProvider)
          .post('/inventory-foundation/production-runs', data: {
        if (branchId != null && branchId.trim().isNotEmpty)
          'branch_id': branchId,
        'destination_outlet_id': _outletCtrl.text.trim(),
        'destination_outlet_name': _outletCtrl.text.trim().isEmpty
            ? 'Outlet'
            : _outletCtrl.text.trim(),
        'inputs': [
          {
            'item_sku': _rawSkuCtrl.text.trim(),
            'item_name': _rawSkuCtrl.text.trim(),
            'quantity': _num(_rawQtyCtrl.text),
            'unit_of_measure': 'units',
          }
        ],
        'outputs': [
          {
            'item_sku': _outputSkuCtrl.text.trim(),
            'item_name': _outputNameCtrl.text.trim().isEmpty
                ? _outputSkuCtrl.text.trim()
                : _outputNameCtrl.text.trim(),
            'quantity': _num(_outputQtyCtrl.text),
            'unit_of_measure': 'units',
          }
        ],
        'remarks': _remarksCtrl.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Production posted')),
        );
      }
      _rawSkuCtrl.clear();
      _rawQtyCtrl.clear();
      _outputSkuCtrl.clear();
      _outputNameCtrl.clear();
      _outputQtyCtrl.clear();
      _remarksCtrl.clear();
      widget.onPosted();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Production failed: $error'),
              backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }
}

class _InventoryControlSnapshot {
  const _InventoryControlSnapshot({
    required this.balances,
    required this.movements,
    required this.reservations,
    required this.alerts,
    required this.outletStock,
    required this.adjustments,
    required this.exceptions,
    required this.alertSummary,
    required this.dashboard,
    required this.documents,
    required this.rules,
  });

  final List<Map<String, dynamic>> balances;
  final List<Map<String, dynamic>> movements;
  final List<Map<String, dynamic>> reservations;
  final List<Map<String, dynamic>> alerts;
  final List<Map<String, dynamic>> outletStock;
  final List<Map<String, dynamic>> adjustments;
  final List<Map<String, dynamic>> exceptions;
  final Map<String, dynamic> alertSummary;
  final Map<String, dynamic> dashboard;
  final List<Map<String, dynamic>> documents;
  final List<Map<String, dynamic>> rules;

  factory _InventoryControlSnapshot.empty() => const _InventoryControlSnapshot(
        balances: [],
        movements: [],
        reservations: [],
        alerts: [],
        outletStock: [],
        adjustments: [],
        exceptions: [],
        alertSummary: {},
        dashboard: {},
        documents: [],
        rules: [],
      );
}

class _PageFrame extends StatelessWidget {
  const _PageFrame({
    required this.title,
    required this.subtitle,
    required this.child,
    this.actions = const [],
  });

  final String title;
  final String subtitle;
  final Widget child;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 16,
            runSpacing: 12,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              SizedBox(
                width: 560,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style:
                            Theme.of(context).textTheme.headlineSmall?.copyWith(
                                  fontWeight: FontWeight.w700,
                                )),
                    const SizedBox(height: 4),
                    Text(subtitle,
                        style: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(color: Colors.blueGrey.shade600)),
                  ],
                ),
              ),
              ...actions,
            ],
          ),
          const SizedBox(height: 18),
          Expanded(child: child),
        ],
      ),
    );
  }
}

class _Toolbar extends StatelessWidget {
  const _Toolbar({
    required this.search,
    required this.severity,
    required this.status,
    required this.onSearch,
    required this.onSeverity,
    required this.onStatus,
  });

  final String search;
  final String severity;
  final String status;
  final ValueChanged<String> onSearch;
  final ValueChanged<String?> onSeverity;
  final ValueChanged<String?> onStatus;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        SizedBox(
          width: 420,
          child: TextField(
            onChanged: onSearch,
            decoration: const InputDecoration(
              hintText: 'Search item, document, supplier, reason...',
              prefixIcon: Icon(Icons.search),
            ),
          ),
        ),
        SizedBox(
          width: 180,
          child: DropdownButtonFormField<String>(
            key: ValueKey('severity-$severity'),
            initialValue: severity,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Severity'),
            items: const [
              DropdownMenuItem(value: '', child: Text('All')),
              DropdownMenuItem(value: 'critical', child: Text('Critical')),
              DropdownMenuItem(value: 'high', child: Text('High')),
              DropdownMenuItem(value: 'medium', child: Text('Medium')),
              DropdownMenuItem(value: 'low', child: Text('Low')),
            ],
            onChanged: onSeverity,
          ),
        ),
        SizedBox(
          width: 180,
          child: DropdownButtonFormField<String>(
            key: ValueKey('status-$status'),
            initialValue: status,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Status'),
            items: const [
              DropdownMenuItem(value: '', child: Text('All')),
              DropdownMenuItem(value: 'open', child: Text('Open')),
              DropdownMenuItem(
                  value: 'acknowledged', child: Text('Acknowledged')),
              DropdownMenuItem(value: 'in_review', child: Text('In review')),
              DropdownMenuItem(value: 'resolved', child: Text('Resolved')),
              DropdownMenuItem(value: 'dismissed', child: Text('Dismissed')),
              DropdownMenuItem(value: 'requested', child: Text('Requested')),
              DropdownMenuItem(value: 'approved', child: Text('Approved')),
            ],
            onChanged: onStatus,
          ),
        ),
      ],
    );
  }
}

class _ScrollColumn extends StatelessWidget {
  const _ScrollColumn({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: EdgeInsets.zero,
      children: children,
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
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
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: Colors.blueGrey.shade100),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 16)),
                      const SizedBox(height: 3),
                      Text(subtitle,
                          style: TextStyle(
                              color: Colors.blueGrey.shade600, fontSize: 12)),
                    ],
                  ),
                ),
                if (trailing != null) trailing!,
              ],
            ),
            const SizedBox(height: 14),
            child,
          ],
        ),
      ),
    );
  }
}

class _StatsGrid extends StatelessWidget {
  const _StatsGrid({required this.cards});
  final List<_StatCardData> cards;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final columns = width > 1200
            ? 4
            : width > 760
                ? 2
                : 1;
        return GridView.count(
          crossAxisCount: columns,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: width > 760 ? 4.6 : 4,
          children: cards.map((card) => _StatCard(data: card)).toList(),
        );
      },
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

class _StatCard extends StatelessWidget {
  const _StatCard({required this.data});
  final _StatCardData data;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: Colors.blueGrey.shade100),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: data.color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(data.icon, color: data.color),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(data.value,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 20)),
                  Text(data.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          color: Colors.blueGrey.shade600, fontSize: 12)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RecordTable extends StatelessWidget {
  const _RecordTable({required this.rows, required this.columns});
  final List<Map<String, dynamic>> rows;
  final List<_ColumnSpec> columns;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return const _EmptyPanel(message: 'No records found');
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        headingRowColor: WidgetStatePropertyAll(
            Colors.blueGrey.shade50.withValues(alpha: 0.8)),
        columns: columns
            .map((column) => DataColumn(label: Text(column.label)))
            .toList(),
        rows: rows.take(120).map((row) {
          return DataRow(
            cells: columns.map((column) {
              return DataCell(
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 280),
                  child: Text(
                    _display(_firstValue(row, column.keys)),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              );
            }).toList(),
          );
        }).toList(),
      ),
    );
  }
}

class _ExceptionList extends StatelessWidget {
  const _ExceptionList({
    required this.rows,
    required this.allowReview,
    required this.onReview,
  });

  final List<Map<String, dynamic>> rows;
  final bool allowReview;
  final Future<void> Function(Map<String, dynamic>, String) onReview;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return const _EmptyPanel(message: 'No exceptions found');
    return Column(
      children: rows.take(80).map((row) {
        final severity = '${row['severity'] ?? 'medium'}'.toLowerCase();
        final color = switch (severity) {
          'critical' => Colors.red,
          'high' => Colors.deepOrange,
          'medium' => Colors.orange,
          _ => Colors.blueGrey,
        };
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.blueGrey.shade100),
          ),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: color.withValues(alpha: 0.12),
                child: Icon(Icons.warning_amber_outlined, color: color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${row['title'] ?? row['exception_type'] ?? 'Exception'}',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      [
                        row['source_number'],
                        row['description'],
                      ]
                          .where((v) => v != null && '$v'.trim().isNotEmpty)
                          .join(' • '),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: Colors.blueGrey.shade600),
                    ),
                  ],
                ),
              ),
              _StatusChip(label: severity, color: color),
              if (allowReview) ...[
                const SizedBox(width: 8),
                TextButton(
                  onPressed: () => onReview(row, 'acknowledged'),
                  child: const Text('Acknowledge'),
                ),
                FilledButton(
                  onPressed: () => onReview(row, 'resolved'),
                  child: const Text('Resolve'),
                ),
              ],
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 18),
      label: Text(label),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label.replaceAll('_', ' ').toUpperCase(),
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w700,
          fontSize: 11,
        ),
      ),
    );
  }
}

class _EmptyPanel extends StatelessWidget {
  const _EmptyPanel({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 40),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Colors.blueGrey.shade50.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(message, style: TextStyle(color: Colors.blueGrey.shade600)),
    );
  }
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, color: Colors.red, size: 42),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

class _ColumnSpec {
  const _ColumnSpec(this.label, this.keys);
  final String label;
  final List<String> keys;
}

dynamic _firstValue(Map<String, dynamic> row, List<String> keys) {
  for (final key in keys) {
    if (row[key] != null && '${row[key]}'.trim().isNotEmpty) return row[key];
  }
  return '';
}

String _display(dynamic value) {
  if (value == null) return '—';
  if (value is List) return value.join(', ');
  if (value is Map) {
    return value.entries
        .where((entry) => entry.value != null && '${entry.value}'.isNotEmpty)
        .map((entry) => '${entry.key}: ${entry.value}')
        .join(', ');
  }
  final text = '$value'.trim();
  if (text.isEmpty || text == 'null') return '—';
  if (text.contains('T')) return text.split('.').first.replaceFirst('T', ' ');
  return text.replaceAll('_', ' ');
}

double _num(dynamic value) {
  if (value is num) return value.toDouble();
  return double.tryParse('$value') ?? 0;
}

String _qty(num value) {
  if (value % 1 == 0) return value.toStringAsFixed(0);
  return value.toStringAsFixed(2);
}
