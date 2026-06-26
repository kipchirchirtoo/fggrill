import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/theme/app_theme.dart';
import '../data/branch_storekeeper_repository.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Constants & model
// ─────────────────────────────────────────────────────────────────────────────

const _poValidUnits = {
  'PC', 'PCS', 'PACK', 'PACKS', 'BAG', 'BAGS',
  'KG', 'G', 'L', 'LTR', 'ML',
  'BTL', 'BOTTLE', 'BOTTLES',
  'CTN', 'CARTON', 'CARTONS', 'CASE', 'CASES',
  'BOX', 'BOXES', 'TIN', 'TINS',
  'ROLL', 'ROLLS', 'DOZEN', 'DZ',
};

class _PoItem {
  _PoItem({
    required this.key,
    required this.sourceLine,
    required this.itemName,
    required this.quantity,
    required this.unit,
    this.error,
  }) {
    nameCtrl = TextEditingController(text: itemName);
    qtyCtrl = TextEditingController(text: quantity == 0 ? '' : _plainNum(quantity));
    unitCtrl = TextEditingController(text: unit);
    costCtrl = TextEditingController(text: unitCost == 0 ? '' : _plainNum(unitCost));
  }

  final String key;
  final String sourceLine;
  String itemName;
  num quantity;
  String unit;
  num unitCost = 0;
  String? sku;
  String? error;

  late final TextEditingController nameCtrl;
  late final TextEditingController qtyCtrl;
  late final TextEditingController unitCtrl;
  late final TextEditingController costCtrl;

  num get total => quantity * unitCost;

  void dispose() {
    nameCtrl.dispose();
    qtyCtrl.dispose();
    unitCtrl.dispose();
    costCtrl.dispose();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

final _moneyFmt = NumberFormat('#,##0.00', 'en_KE');
String _money(num v) => 'KES ${_moneyFmt.format(v)}';
String _isoDate(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
String _plainNum(num v) =>
    v == v.truncate() ? v.toInt().toString() : v.toString();
String _text(Map<String, dynamic> row, List<String> keys, [String fallback = '']) {
  for (final key in keys) {
    final v = row[key];
    if (v != null && '$v'.trim().isNotEmpty && '$v' != 'null') return '$v'.trim();
  }
  return fallback;
}

String _normalizeName(String value) => value
    .toLowerCase()
    .replaceAll(RegExp(r'[^a-z0-9\s]'), ' ')
    .replaceAll(RegExp(r'\s+'), ' ')
    .trim();

String _supplierLabel(Map<String, dynamic> s) {
  final name = _text(s, ['name', 'supplier_name']);
  final code = _text(s, ['supplier_code', 'code']);
  final phone = _text(s, ['phone']);
  return [name, code, phone].where((p) => p.isNotEmpty).join(' | ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

class BranchPoCreateScreen extends ConsumerStatefulWidget {
  const BranchPoCreateScreen({super.key});

  @override
  ConsumerState<BranchPoCreateScreen> createState() =>
      _BranchPoCreateScreenState();
}

class _BranchPoCreateScreenState extends ConsumerState<BranchPoCreateScreen> {
  bool _loading = true;
  bool _saving = false;
  String? _error;

  List<Map<String, dynamic>> _suppliers = [];
  List<Map<String, dynamic>> _catalog = [];

  // Form state
  String? _supplierId;
  String _paymentTerms = 'credit_30_days';
  DateTime _poDate = DateTime.now();
  DateTime? _expectedDate;
  bool _autoApprove = false;

  final _bulkCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  final List<_PoItem> _items = [];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _bulkCtrl.dispose();
    _notesCtrl.dispose();
    for (final item in _items) {
      item.dispose();
    }
    super.dispose();
  }

  // ── Data ────────────────────────────────────────────────────────────────────

  Future<void> _loadData() async {
    setState(() { _loading = true; _error = null; });
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      final results = await Future.wait([
        repo.suppliers(),
        repo.masterCatalog(limit: 500),
      ]);
      if (!mounted) return;
      setState(() {
        _suppliers = List<Map<String, dynamic>>.from(results[0] as List);
        _catalog = List<Map<String, dynamic>>.from(results[1] as List);
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  // ── Item parsing & resolution ────────────────────────────────────────────────

  void _parseBulk() {
    final lines = _bulkCtrl.text
        .split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();
    if (lines.isEmpty) {
      _snack('Paste at least one item line');
      return;
    }
    setState(() {
      for (final item in _items) {
        item.dispose();
      }
      _items
        ..clear()
        ..addAll(lines.indexed.map((e) {
          final item = _parseLine(e.$2, e.$1);
          _resolveItem(item);
          return item;
        }));
      _validateAll();
    });
  }

  _PoItem _parseLine(String line, int index) {
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
      return _PoItem(
        key: '${DateTime.now().microsecondsSinceEpoch}-$index',
        sourceLine: line,
        itemName: parts.first,
        quantity: num.tryParse(parts[1]) ?? 0,
        unit: parts.length > 2 ? parts[2].toUpperCase() : '',
      );
    }

    final match =
        RegExp(r'^(.+?)\s+(\d+(?:\.\d+)?)\s*([A-Za-z][A-Za-z0-9/_-]*)?$')
            .firstMatch(clean);
    if (match != null) {
      return _PoItem(
        key: '${DateTime.now().microsecondsSinceEpoch}-$index',
        sourceLine: line,
        itemName: match.group(1)?.trim() ?? '',
        quantity: num.tryParse(match.group(2) ?? '') ?? 0,
        unit: (match.group(3) ?? '').toUpperCase(),
      );
    }

    return _PoItem(
      key: '${DateTime.now().microsecondsSinceEpoch}-$index',
      sourceLine: line,
      itemName: clean,
      quantity: 0,
      unit: '',
      error: 'Could not read quantity',
    );
  }

  void _resolveItem(_PoItem item) {
    final match = _findCatalogItem(item.itemName);
    item.sku = match == null ? null : _text(match, ['sku', 'item_sku', 'id']);
    if (match != null) {
      item.itemName = _text(match, ['item_name', 'name', 'description']);
      if (item.unit.trim().isEmpty) {
        item.unit = _text(match, ['unit_of_measure', 'unit'], '').toUpperCase();
      }
    }
  }

  Map<String, dynamic>? _findCatalogItem(String value) {
    final normalized = _normalizeName(value);
    for (final item in _catalog) {
      if (_text(item, ['sku', 'item_sku'], '').toLowerCase() ==
          value.toLowerCase()) return item;
      if (_normalizeName(_text(item, ['item_name', 'name', 'description'])) ==
          normalized) return item;
    }
    for (final item in _catalog) {
      final n = _normalizeName(_text(item, ['item_name', 'name', 'description']));
      if (n.contains(normalized) || normalized.contains(n)) return item;
    }
    return null;
  }

  List<Map<String, dynamic>> _catalogSuggestions(String query) {
    final normalized = _normalizeName(query);
    if (normalized.isEmpty) return _catalog.take(8).toList();
    final scored = <({Map<String, dynamic> row, int score})>[];
    final queryTokens =
        normalized.split(' ').where((p) => p.length > 1);
    for (final row in _catalog) {
      final sku = _text(row, ['sku', 'item_sku', 'id']).toLowerCase();
      final name = _normalizeName(_text(row, ['item_name', 'name', 'description']));
      var score = 0;
      if (sku == query.toLowerCase().trim()) score += 100;
      if (name == normalized) score += 90;
      if (sku.contains(normalized)) score += 60;
      if (name.contains(normalized) || normalized.contains(name)) score += 50;
      for (final token in queryTokens) {
        if (name.split(' ').contains(token)) score += 12;
        if (name.contains(token)) score += 5;
      }
      if (score > 0) scored.add((row: row, score: score));
    }
    scored.sort((a, b) => b.score.compareTo(a.score));
    return scored.map((e) => e.row).take(8).toList();
  }

  void _applySuggestion(_PoItem item, Map<String, dynamic> match) {
    item.sku = _text(match, ['sku', 'item_sku', 'id']);
    item.itemName = _text(match, ['item_name', 'name', 'description']);
    item.nameCtrl.text = item.itemName;
    final unit = _text(match, ['unit_of_measure', 'unit'], '').toUpperCase();
    if (unit.isNotEmpty) {
      item.unit = unit;
      item.unitCtrl.text = unit;
    }
  }

  void _validateAll() {
    final seen = <String>{};
    for (final item in _items) {
      String? error;
      if (item.error == 'Could not read quantity' && item.quantity <= 0) {
        error = item.error;
      } else if (item.itemName.trim().isEmpty) {
        error = 'Item name is required';
      } else if (item.quantity <= 0) {
        error = 'Quantity must be > 0';
      } else if (item.sku == null || item.sku!.trim().isEmpty) {
        error = 'No matching SKU';
      } else if (item.unit.trim().isEmpty) {
        error = 'Unit required';
      } else if (!_poValidUnits.contains(item.unit.trim().toUpperCase())) {
        error = 'Invalid unit';
      } else if (item.unitCost < 0) {
        error = 'Unit cost < 0';
      }
      final key =
          '${item.sku ?? _normalizeName(item.itemName)}:${item.unit.toUpperCase()}';
      if (error == null && seen.contains(key)) error = 'Duplicate row';
      seen.add(key);
      item.error = error;
    }
  }

  void _addBlankRow() => _showManualAddDialog();

  void _showManualAddDialog() {
    showDialog<void>(
      context: context,
      builder: (_) => _ManualAddItemDialog(
        catalog: _catalog,
        onAdd: (Map<String, dynamic> catalogItem, num qty, num unitCost) {
          setState(() {
            final name = _text(
                catalogItem, ['item_name', 'name', 'description']);
            final sku = _text(catalogItem, ['sku', 'item_sku']);
            final unit = _text(catalogItem,
                ['unit_of_measure', 'unit', 'unit_of_measure']);
            final item = _PoItem(
              key: '${DateTime.now().microsecondsSinceEpoch}-manual',
              sourceLine: name,
              itemName: name,
              quantity: qty,
              unit: unit.toUpperCase(),
            )
              ..unitCost = unitCost
              ..sku = sku.isNotEmpty ? sku : null;
            item.costCtrl.text = unitCost == 0 ? '' : _plainNum(unitCost);
            _items.add(item);
            _validateAll();
          });
        },
      ),
    );
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  Future<void> _submit(bool approve) async {
    _validateAll();
    if (_supplierId == null || _supplierId!.isEmpty) {
      _snack('Select a supplier first');
      return;
    }
    if (_expectedDate != null && _expectedDate!.isBefore(_poDate)) {
      _snack('Expected delivery cannot be before PO date');
      return;
    }
    final validItems = _items.where((i) => i.error == null).toList();
    if (validItems.isEmpty) {
      _snack('No valid items — fix all errors before saving');
      return;
    }
    if (_items.any((i) => i.error != null)) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Invalid rows detected'),
          content: const Text(
              'Some rows have errors and will be SKIPPED. Only valid rows will be saved. Continue?'),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Fix first')),
            FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Save valid rows only')),
          ],
        ),
      );
      if (ok != true) return;
    }

    setState(() => _saving = true);
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      await repo.createPurchaseOrder({
        'supplier_id': _supplierId,
        'po_date': _isoDate(_poDate),
        if (_expectedDate != null)
          'expected_delivery_date': _isoDate(_expectedDate!),
        'payment_terms': _paymentTerms,
        'delivery_terms': 'Branch Store',
        if (_notesCtrl.text.trim().isNotEmpty)
          'special_instructions': _notesCtrl.text.trim(),
        'auto_approve': approve,
        'items': validItems
            .map((item) => {
                  'item_id': item.sku,
                  'quantity': item.quantity,
                  'unit_price': item.unitCost,
                  'tax_amount': 0,
                  'total_price': item.total,
                })
            .toList(),
      });
      if (!mounted) return;
      _snack(approve
          ? 'Purchase Order created & submitted for approval'
          : 'Purchase Order saved as draft', success: true);
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) _snack('Failed: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _reset() {
    for (final item in _items) {
      item.dispose();
    }
    setState(() {
      _supplierId = null;
      _paymentTerms = 'credit_30_days';
      _poDate = DateTime.now();
      _expectedDate = null;
      _bulkCtrl.clear();
      _notesCtrl.clear();
      _items.clear();
    });
  }

  void _snack(String msg, {bool success = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: success ? AppColors.kSuccess : AppColors.kError,
    ));
  }

  // ── Build ───────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final validItems = _items.where((i) => i.error == null).toList();
    final total = validItems.fold<num>(0, (s, i) => s + i.total);
    final hasErrors = _items.any((i) => i.error != null);

    return Scaffold(
      backgroundColor: AppColors.kSurface,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        leading: IconButton(
          onPressed: _saving ? null : () => Navigator.pop(context),
          icon: const Icon(Icons.arrow_back),
        ),
        title: Row(children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              color: AppColors.kPrimary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(PhosphorIcons.shoppingCart(), color: AppColors.kPrimary, size: 20),
          ),
          const SizedBox(width: 12),
          const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('New Purchase Order',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.kTextPrimary)),
            Text('Branch Store Supplier Order',
                style: TextStyle(fontSize: 11, color: AppColors.kTextSecondary, fontWeight: FontWeight.normal)),
          ]),
        ]),
        actions: [
          if (_items.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: hasErrors
                        ? AppColors.kError.withValues(alpha: 0.08)
                        : AppColors.kSuccess.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: hasErrors
                          ? AppColors.kError.withValues(alpha: 0.3)
                          : AppColors.kSuccess.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Text(
                    hasErrors
                        ? '${_items.where((i) => i.error != null).length} errors · ${validItems.length} valid'
                        : '${validItems.length} items · ${_money(total)}',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: hasErrors ? AppColors.kError : AppColors.kSuccess,
                    ),
                  ),
                ),
              ),
            ),
          TextButton.icon(
            onPressed: (_saving || _items.isEmpty) ? null : _reset,
            icon: const Icon(Icons.clear_all, size: 16),
            label: const Text('Clear'),
          ),
          const SizedBox(width: 4),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: AppColors.kDivider),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _errorView()
              : _body(validItems, total, hasErrors),
      bottomNavigationBar: _saving
          ? null
          : _items.isNotEmpty
              ? _bottomBar(validItems, total)
              : null,
    );
  }

  Widget _errorView() {
    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.error_outline, size: 48, color: AppColors.kError),
        const SizedBox(height: 12),
        Text(_error ?? 'Failed to load', style: TextStyle(color: AppColors.kError)),
        const SizedBox(height: 12),
        FilledButton(onPressed: _loadData, child: const Text('Retry')),
      ]),
    );
  }

  Widget _body(List<_PoItem> validItems, num total, bool hasErrors) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        // ── 1. PO Header ─────────────────────────────────────────────────────
        _card(
          title: 'Order Details',
          icon: PhosphorIcons.fileText(),
          child: LayoutBuilder(builder: (context, constraints) {
            final half = constraints.maxWidth < 700
                ? constraints.maxWidth
                : (constraints.maxWidth - 12) / 2;
            return Wrap(spacing: 12, runSpacing: 12, children: [
              SizedBox(
                width: constraints.maxWidth,
                child: _SupplierField(
                  suppliers: _suppliers,
                  selectedId: _supplierId,
                  onSelected: (s) =>
                      setState(() => _supplierId = _text(s, ['id'])),
                  onCleared: () => setState(() => _supplierId = null),
                ),
              ),
              SizedBox(
                width: half,
                child: _DateField(
                  label: 'PO Date *',
                  value: _poDate,
                  onPicked: (d) => setState(() {
                    _poDate = d;
                    if (_expectedDate != null && _expectedDate!.isBefore(d)) {
                      _expectedDate = d;
                    }
                  }),
                ),
              ),
              SizedBox(
                width: half,
                child: _DateField(
                  label: 'Expected Delivery',
                  value: _expectedDate,
                  firstDate: _poDate,
                  nullable: true,
                  onPicked: (d) => setState(() => _expectedDate = d),
                ),
              ),
              SizedBox(
                width: half,
                child: DropdownButtonFormField<String>(
                  isExpanded: true,
                  initialValue: _paymentTerms,
                  decoration:
                      const InputDecoration(labelText: 'Payment Terms'),
                  items: const [
                    DropdownMenuItem(value: 'cash', child: Text('Cash')),
                    DropdownMenuItem(
                        value: 'credit_7_days', child: Text('Credit 7 days')),
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
                        value: 'credit_90_days',
                        child: Text('Credit 90 days')),
                    DropdownMenuItem(
                        value: 'advance_payment',
                        child: Text('Advance payment')),
                  ],
                  onChanged: (v) =>
                      setState(() => _paymentTerms = v ?? _paymentTerms),
                ),
              ),
              SizedBox(
                width: half,
                child: CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _autoApprove,
                  title: const Text('Auto-Approve on Submit',
                      style: TextStyle(fontSize: 13)),
                  subtitle: const Text('Bypasses draft review',
                      style: TextStyle(fontSize: 11)),
                  onChanged: (v) => setState(() => _autoApprove = v ?? false),
                ),
              ),
              SizedBox(
                width: constraints.maxWidth,
                child: TextField(
                  controller: _notesCtrl,
                  minLines: 2,
                  maxLines: 3,
                  decoration:
                      const InputDecoration(labelText: 'Remarks / Notes'),
                ),
              ),
            ]);
          }),
        ),

        const SizedBox(height: 16),

        // ── 2. Bulk paste + items (combined card) ─────────────────────────────
        _card(
          title: 'Order Lines',
          icon: PhosphorIcons.listChecks(),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            // ── Paste box ──────────────────────────────────────────────────
            TextField(
              controller: _bulkCtrl,
              minLines: 5,
              maxLines: 10,
              style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
              decoration: const InputDecoration(
                alignLabelWithHint: true,
                labelText: 'Bulk paste — one item per line',
                hintText:
                    'KC PINEAPPLE 750ML, 120, PCS\n'
                    'FANTA ORANGE 500ML 50 PCS\n'
                    'SUGAR 2KG | 30 | BAGS',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 10),
            // ── Parse + Add buttons ────────────────────────────────────────
            Row(children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: _parseBulk,
                  icon: const Icon(Icons.auto_fix_high, size: 16),
                  label: const Text('Parse Items from Text'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.kPrimary,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              OutlinedButton.icon(
                onPressed: _addBlankRow,
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Add Item Manually'),
              ),
            ]),

            // ── Items list ─────────────────────────────────────────────────
            if (_items.isEmpty) ...[
              const SizedBox(height: 24),
              Center(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Icon(PhosphorIcons.package(),
                      size: 40, color: AppColors.kTextSecondary),
                  const SizedBox(height: 8),
                  const Text('No items yet',
                      style: TextStyle(
                          color: AppColors.kTextSecondary,
                          fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  const Text(
                    'Paste items above and tap "Parse Items from Text", or tap "Add Item Manually"',
                    style: TextStyle(
                        fontSize: 12, color: AppColors.kTextSecondary),
                    textAlign: TextAlign.center,
                  ),
                ]),
              ),
              const SizedBox(height: 24),
            ] else ...[
              const SizedBox(height: 16),
              // Column header labels
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Row(children: [
                  const Expanded(flex: 3, child: Text('Item Name', style: _hdr)),
                  const SizedBox(width: 6),
                  const SizedBox(width: 70, child: Text('Qty', style: _hdr, textAlign: TextAlign.center)),
                  const SizedBox(width: 6),
                  const SizedBox(width: 70, child: Text('Unit', style: _hdr, textAlign: TextAlign.center)),
                  const SizedBox(width: 6),
                  const SizedBox(width: 90, child: Text('Unit Cost', style: _hdr, textAlign: TextAlign.center)),
                  const SizedBox(width: 6),
                  const SizedBox(width: 80, child: Text('Total', style: _hdr, textAlign: TextAlign.right)),
                  const SizedBox(width: 32),
                ]),
              ),
              const Divider(height: 8),
              // Item rows — no DataTable, no nested scrollview
              ...List.generate(_items.length, (index) {
                final item = _items[index];
                return _itemRow(item, index);
              }),
              const SizedBox(height: 8),
              // Summary footer
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.kSurface,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(children: [
                  Text(
                    hasErrors
                        ? '${_items.where((i) => i.error != null).length} error(s) — fix before saving'
                        : '${validItems.length} item(s) ready',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                      color: hasErrors ? AppColors.kError : AppColors.kSuccess,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    'Total: ${_money(total)}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w900, fontSize: 14),
                  ),
                ]),
              ),
            ],
          ]),
        ),

        const SizedBox(height: 80),
      ]),
    );
  }

  static const _hdr = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w700,
    color: AppColors.kTextSecondary,
  );

  Widget _itemRow(_PoItem item, int index) {
    final hasError = item.error != null;
    final bgColor = hasError
        ? AppColors.kError.withValues(alpha: 0.05)
        : (index % 2 == 0 ? Colors.white : AppColors.kSurface);

    return Container(
      margin: const EdgeInsets.only(bottom: 2),
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(6),
        border: hasError
            ? Border.all(color: AppColors.kError.withValues(alpha: 0.3))
            : null,
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
          // Item name field (takes most space)
          Expanded(
            flex: 3,
            child: _itemNameField(item),
          ),
          const SizedBox(width: 6),
          // Qty
          SizedBox(
            width: 70,
            child: TextFormField(
              controller: item.qtyCtrl,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              textAlign: TextAlign.center,
              decoration: const InputDecoration(
                hintText: '0',
                isDense: true,
                border: OutlineInputBorder(),
                contentPadding:
                    EdgeInsets.symmetric(horizontal: 8, vertical: 10),
              ),
              onChanged: (v) => setState(() {
                item.quantity = num.tryParse(v) ?? 0;
                _validateAll();
              }),
            ),
          ),
          const SizedBox(width: 6),
          // Unit
          SizedBox(
            width: 70,
            child: TextFormField(
              controller: item.unitCtrl,
              textCapitalization: TextCapitalization.characters,
              textAlign: TextAlign.center,
              decoration: const InputDecoration(
                hintText: 'PCS',
                isDense: true,
                border: OutlineInputBorder(),
                contentPadding:
                    EdgeInsets.symmetric(horizontal: 8, vertical: 10),
              ),
              onChanged: (v) => setState(() {
                item.unit = v.toUpperCase().trim();
                _validateAll();
              }),
            ),
          ),
          const SizedBox(width: 6),
          // Unit Cost
          SizedBox(
            width: 90,
            child: TextFormField(
              controller: item.costCtrl,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              textAlign: TextAlign.right,
              decoration: const InputDecoration(
                hintText: '0.00',
                isDense: true,
                border: OutlineInputBorder(),
                contentPadding:
                    EdgeInsets.symmetric(horizontal: 8, vertical: 10),
              ),
              onChanged: (v) => setState(() {
                item.unitCost = num.tryParse(v) ?? 0;
                _validateAll();
              }),
            ),
          ),
          const SizedBox(width: 6),
          // Total (read-only)
          SizedBox(
            width: 80,
            child: Text(
              _money(item.total),
              textAlign: TextAlign.right,
              style: const TextStyle(
                  fontWeight: FontWeight.w700, fontSize: 12),
            ),
          ),
          // Remove button
          SizedBox(
            width: 32,
            child: IconButton(
              padding: EdgeInsets.zero,
              tooltip: 'Remove',
              icon: const Icon(Icons.close, size: 16),
              onPressed: () => setState(() {
                item.dispose();
                _items.remove(item);
                _validateAll();
              }),
            ),
          ),
        ]),
        // SKU chip + error row
        Padding(
          padding: const EdgeInsets.only(left: 2, top: 3),
          child: Row(children: [
            if (item.sku != null)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.kSuccess.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '✓ ${item.sku}',
                  style: const TextStyle(
                      fontSize: 10,
                      color: AppColors.kSuccess,
                      fontWeight: FontWeight.w700),
                ),
              )
            else
              _suggestionButton(item),
            if (hasError) ...[
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  item.error!,
                  style: const TextStyle(
                      color: AppColors.kError,
                      fontSize: 10,
                      fontWeight: FontWeight.w700),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ]),
        ),
      ]),
    );
  }

  Widget _itemNameField(_PoItem item) {
    return TextFormField(
      controller: item.nameCtrl,
      decoration: const InputDecoration(
        hintText: 'Item name or SKU…',
        isDense: true,
        border: OutlineInputBorder(),
        contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      ),
      onChanged: (v) => setState(() {
        item.itemName = v;
        _resolveItem(item);
        _validateAll();
      }),
    );
  }

  Widget _suggestionButton(_PoItem item) {
    final suggestions = _catalogSuggestions(item.itemName);
    if (suggestions.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: AppColors.kError.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Text(
          'No catalog match',
          style: TextStyle(
              fontSize: 10,
              color: AppColors.kError,
              fontWeight: FontWeight.w700),
        ),
      );
    }
    return PopupMenuButton<String>(
      tooltip: 'Pick matching catalog item',
      onSelected: (sku) {
        final match = suggestions.firstWhere(
          (r) => _text(r, ['sku', 'item_sku', 'id']) == sku,
          orElse: () => suggestions.first,
        );
        setState(() {
          _applySuggestion(item, match);
          _validateAll();
        });
      },
      itemBuilder: (_) => suggestions
          .map((row) => PopupMenuItem<String>(
                value: _text(row, ['sku', 'item_sku', 'id']),
                child: SizedBox(
                  width: 320,
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _text(row, ['item_name', 'name', 'description']),
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        Text(
                          '${_text(row, ['sku', 'item_sku', 'id'])} • ${_text(row, ['unit_of_measure', 'unit'], '—')}',
                          style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.kTextSecondary),
                        ),
                      ]),
                ),
              ))
          .toList(),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: AppColors.kWarning.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.search, size: 11, color: AppColors.kWarning),
          const SizedBox(width: 4),
          const Text(
            'Did you mean?',
            style: TextStyle(
                fontSize: 10,
                color: AppColors.kWarning,
                fontWeight: FontWeight.w700),
          ),
        ]),
      ),
    );
  }

  Widget _bottomBar(List<_PoItem> validItems, num total) {
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: AppColors.kDivider)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 8,
              offset: const Offset(0, -2),
            )
          ],
        ),
        child: Row(children: [
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              'Grand Total: ${_money(total)}',
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
            ),
            Text(
              '${validItems.length} valid line${validItems.length == 1 ? '' : 's'}',
              style: const TextStyle(
                  fontSize: 11, color: AppColors.kTextSecondary),
            ),
          ]),
          const Spacer(),
          OutlinedButton(
            onPressed: _saving ? null : _reset,
            child: const Text('Clear All'),
          ),
          const SizedBox(width: 8),
          ElevatedButton.icon(
            onPressed: (_saving || validItems.isEmpty)
                ? null
                : () => _submit(false),
            icon: _saving
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.save_outlined, size: 16),
            label: Text(_saving ? 'Saving…' : 'Save Draft'),
          ),
          const SizedBox(width: 8),
          FilledButton.icon(
            onPressed: (_saving || validItems.isEmpty)
                ? null
                : () => _submit(true),
            icon: const Icon(Icons.check_circle_outline, size: 16),
            label: const Text('Submit / Approve'),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.kSuccess,
              foregroundColor: Colors.white,
            ),
          ),
        ]),
      ),
    );
  }

  // ── Card wrapper ─────────────────────────────────────────────────────────────

  Widget _card({
    required String title,
    required IconData icon,
    required Widget child,
    Widget? headerTrailing,
    String? subtitle,
  }) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: AppColors.kPrimary.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(icon, size: 16, color: AppColors.kPrimary),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title,
                            style: const TextStyle(
                                fontWeight: FontWeight.w800, fontSize: 14)),
                        if (subtitle != null)
                          Text(subtitle,
                              style: const TextStyle(
                                  fontSize: 11,
                                  color: AppColors.kTextSecondary)),
                      ]),
                ),
                if (headerTrailing != null) headerTrailing,
              ]),
              const SizedBox(height: 14),
              const Divider(height: 1),
              const SizedBox(height: 14),
              child,
            ]),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Supplier search field
// ─────────────────────────────────────────────────────────────────────────────

class _SupplierField extends StatefulWidget {
  const _SupplierField({
    required this.suppliers,
    required this.selectedId,
    required this.onSelected,
    required this.onCleared,
  });

  final List<Map<String, dynamic>> suppliers;
  final String? selectedId;
  final ValueChanged<Map<String, dynamic>> onSelected;
  final VoidCallback onCleared;

  @override
  State<_SupplierField> createState() => _SupplierFieldState();
}

class _SupplierFieldState extends State<_SupplierField> {
  late final TextEditingController _ctrl;
  late final FocusNode _focus;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: _label());
    _focus = FocusNode();
  }

  @override
  void didUpdateWidget(covariant _SupplierField old) {
    super.didUpdateWidget(old);
    if (old.selectedId != widget.selectedId || old.suppliers != widget.suppliers) {
      final next = _label();
      if (_ctrl.text != next) {
        _ctrl.value = TextEditingValue(
          text: next,
          selection: TextSelection.collapsed(offset: next.length),
        );
      }
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _focus.dispose();
    super.dispose();
  }

  String _label() {
    if (widget.selectedId == null) return '';
    final match = widget.suppliers.where(
        (s) => _text(s, ['id']) == widget.selectedId);
    return match.isEmpty ? '' : _supplierLabel(match.first);
  }

  Iterable<Map<String, dynamic>> _options(TextEditingValue v) {
    final q = v.text.trim().toLowerCase();
    if (q.isEmpty) return widget.suppliers.take(30);
    return widget.suppliers.where((s) {
      final hay = [
        _text(s, ['name', 'supplier_name']),
        _text(s, ['supplier_code', 'code']),
        _text(s, ['phone']),
        _text(s, ['email']),
      ].join(' ').toLowerCase();
      return hay.contains(q);
    }).take(40);
  }

  @override
  Widget build(BuildContext context) {
    return RawAutocomplete<Map<String, dynamic>>(
      textEditingController: _ctrl,
      focusNode: _focus,
      displayStringForOption: _supplierLabel,
      optionsBuilder: _options,
      onSelected: (s) {
        _ctrl.text = _supplierLabel(s);
        widget.onSelected(s);
      },
      fieldViewBuilder: (_, ctrl, focus, onSubmitted) => TextField(
        controller: ctrl,
        focusNode: focus,
        decoration: InputDecoration(
          labelText: 'Supplier *',
          hintText: widget.suppliers.isEmpty
              ? 'No suppliers loaded'
              : 'Search by name, code, phone or email',
          prefixIcon: const Icon(Icons.search, size: 18),
          suffixIcon: widget.selectedId != null
              ? IconButton(
                  icon: const Icon(Icons.clear, size: 18),
                  onPressed: () {
                    ctrl.clear();
                    widget.onCleared();
                  },
                )
              : null,
        ),
        onChanged: (_) {
          if (widget.selectedId != null) widget.onCleared();
        },
      ),
      optionsViewBuilder: (context, onSelected, options) => Align(
        alignment: Alignment.topLeft,
        child: Material(
          elevation: 8,
          borderRadius: BorderRadius.circular(12),
          child: ConstrainedBox(
            constraints:
                const BoxConstraints(maxWidth: 640, maxHeight: 300),
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 6),
              itemCount: options.length,
              separatorBuilder: (_, __) =>
                  const Divider(height: 1, indent: 16, endIndent: 16),
              itemBuilder: (_, i) {
                final s = options.elementAt(i);
                return ListTile(
                  dense: true,
                  leading: CircleAvatar(
                    radius: 18,
                    backgroundColor:
                        AppColors.kPrimary.withValues(alpha: 0.1),
                    child: const Icon(Icons.business,
                        size: 18, color: AppColors.kPrimary),
                  ),
                  title: Text(
                    _text(s, ['name', 'supplier_name'], 'Supplier'),
                    style: const TextStyle(fontWeight: FontWeight.w800),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  subtitle: Text(
                    _supplierLabel(s),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  onTap: () => onSelected(s),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Date picker field
// ─────────────────────────────────────────────────────────────────────────────

class _DateField extends StatefulWidget {
  const _DateField({
    required this.label,
    required this.value,
    required this.onPicked,
    this.firstDate,
    this.nullable = false,
  });

  final String label;
  final DateTime? value;
  final ValueChanged<DateTime> onPicked;
  final DateTime? firstDate;
  final bool nullable;

  @override
  State<_DateField> createState() => _DateFieldState();
}

class _DateFieldState extends State<_DateField> {
  late final TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(
      text: widget.value == null ? '' : _isoDate(widget.value!),
    );
  }

  @override
  void didUpdateWidget(covariant _DateField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value) {
      _ctrl.text = widget.value == null ? '' : _isoDate(widget.value!);
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    return TextField(
      readOnly: true,
      controller: _ctrl,
      decoration: InputDecoration(
        labelText: widget.label,
        hintText: widget.nullable ? 'Optional' : 'Select date',
        suffixIcon: const Icon(Icons.calendar_today_outlined, size: 18),
      ),
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: widget.value ?? widget.firstDate ?? now,
          firstDate: widget.firstDate ?? DateTime(now.year - 1),
          lastDate: DateTime(now.year + 3),
        );
        if (picked != null) widget.onPicked(picked);
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Manual Add Item Dialog
// ─────────────────────────────────────────────────────────────────────────────

class _ManualAddItemDialog extends StatefulWidget {
  const _ManualAddItemDialog({
    required this.catalog,
    required this.onAdd,
  });

  final List<Map<String, dynamic>> catalog;
  final void Function(Map<String, dynamic> item, num qty, num unitCost) onAdd;

  @override
  State<_ManualAddItemDialog> createState() => _ManualAddItemDialogState();
}

class _ManualAddItemDialogState extends State<_ManualAddItemDialog> {
  String _search = '';
  Map<String, dynamic>? _selected;
  final _qtyCtrl = TextEditingController(text: '1');
  final _costCtrl = TextEditingController(text: '0');

  @override
  void dispose() {
    _qtyCtrl.dispose();
    _costCtrl.dispose();
    super.dispose();
  }

  String _name(Map<String, dynamic> item) =>
      _text(item, ['item_name', 'name', 'description']);

  String _sku(Map<String, dynamic> item) =>
      _text(item, ['sku', 'item_sku']);

  List<Map<String, dynamic>> get _filtered {
    final q = _search.toLowerCase().trim();
    if (q.isEmpty) return widget.catalog.take(80).toList();
    return widget.catalog.where((item) {
      return _name(item).toLowerCase().contains(q) ||
          _sku(item).toLowerCase().contains(q) ||
          _text(item, ['category']).toLowerCase().contains(q);
    }).take(60).toList();
  }

  void _selectItem(Map<String, dynamic> item) {
    final cost = item['cost_price'] ?? item['unit_cost'] ?? item['unit_price'] ?? 0;
    setState(() {
      _selected = item;
      _costCtrl.text = '${(cost is num ? cost : num.tryParse('$cost') ?? 0).toStringAsFixed(2)}';
    });
  }

  void _addToOrder() {
    if (_selected == null) return;
    final qty = num.tryParse(_qtyCtrl.text.trim()) ?? 0;
    final cost = num.tryParse(_costCtrl.text.trim()) ?? 0;
    if (qty <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Quantity must be greater than 0')));
      return;
    }
    final addedName = _name(_selected!);
    widget.onAdd(_selected!, qty, cost);
    // Reset to allow adding more items without closing dialog
    setState(() {
      _selected = null;
      _qtyCtrl.text = '1';
      _costCtrl.text = '0';
    });
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text('$addedName added to order')));
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    final sel = _selected;

    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 40, vertical: 40),
      child: SizedBox(
        width: 700,
        height: 580,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Header ──────────────────────────────────────────────────────
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              decoration: const BoxDecoration(
                color: AppColors.kPrimary,
                borderRadius:
                    BorderRadius.vertical(top: Radius.circular(12)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.add_shopping_cart_outlined,
                      color: Colors.white, size: 20),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Text('Add Item Manually',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w800)),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close, color: Colors.white70),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
            ),

            // ── Search ──────────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
              child: TextField(
                autofocus: true,
                onChanged: (v) => setState(() {
                  _search = v;
                  _selected = null;
                }),
                decoration: const InputDecoration(
                  hintText: 'Search by item name, SKU or category…',
                  prefixIcon: Icon(Icons.search),
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
            ),

            // ── List + selected form ─────────────────────────────────────────
            Expanded(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Left: catalog list
                  Expanded(
                    flex: 3,
                    child: filtered.isEmpty
                        ? const Center(
                            child: Text('No items found',
                                style: TextStyle(color: Colors.grey)))
                        : ListView.separated(
                            padding: const EdgeInsets.symmetric(
                                vertical: 4, horizontal: 8),
                            itemCount: filtered.length,
                            separatorBuilder: (_, __) =>
                                const Divider(height: 1),
                            itemBuilder: (ctx, i) {
                              final item = filtered[i];
                              final isSelected = _selected == item;
                              final centralQty = item['quantity'] is num
                                  ? item['quantity'] as num
                                  : num.tryParse(
                                          '${item['quantity']}') ??
                                      0;
                              return ListTile(
                                dense: true,
                                selected: isSelected,
                                selectedTileColor: AppColors.kPrimary
                                    .withValues(alpha: 0.08),
                                selectedColor: AppColors.kPrimary,
                                leading: CircleAvatar(
                                  radius: 16,
                                  backgroundColor: isSelected
                                      ? AppColors.kPrimary
                                      : AppColors.kPrimary
                                          .withValues(alpha: 0.1),
                                  child: Icon(Icons.inventory_2_outlined,
                                      size: 14,
                                      color: isSelected
                                          ? Colors.white
                                          : AppColors.kPrimary),
                                ),
                                title: Text(_name(item),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 13)),
                                subtitle: Text(
                                  '${_sku(item)}  ·  ${_text(item, ['category'])}  ·  Central: ${centralQty.toStringAsFixed(centralQty % 1 == 0 ? 0 : 1)} ${_text(item, ['unit_of_measure', 'unit'])}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                      fontSize: 11,
                                      color: centralQty <= 0
                                          ? Colors.red
                                          : Colors.grey.shade600),
                                ),
                                onTap: () => _selectItem(item),
                              );
                            },
                          ),
                  ),
                  // Right: qty + cost form (shows when item selected)
                  Container(
                    width: 200,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: sel != null
                          ? AppColors.kPrimary.withValues(alpha: 0.03)
                          : Colors.grey.shade50,
                      border: Border(
                          left: BorderSide(color: Colors.grey.shade200)),
                    ),
                    child: sel == null
                        ? Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.touch_app_outlined,
                                  size: 32, color: Colors.grey.shade400),
                              const SizedBox(height: 8),
                              Text(
                                'Select an item\nfrom the list',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                    color: Colors.grey.shade500,
                                    fontSize: 12),
                              ),
                            ],
                          )
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(_name(sel),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 13,
                                      color: AppColors.kPrimary)),
                              const SizedBox(height: 2),
                              Text(_sku(sel),
                                  style: const TextStyle(
                                      fontSize: 11,
                                      color: AppColors.kTextSecondary)),
                              const Divider(height: 16),
                              TextField(
                                controller: _qtyCtrl,
                                keyboardType:
                                    const TextInputType.numberWithOptions(
                                        decimal: true),
                                decoration: const InputDecoration(
                                  labelText: 'Quantity *',
                                  border: OutlineInputBorder(),
                                  isDense: true,
                                ),
                              ),
                              const SizedBox(height: 10),
                              TextField(
                                controller: _costCtrl,
                                keyboardType:
                                    const TextInputType.numberWithOptions(
                                        decimal: true),
                                decoration: const InputDecoration(
                                  labelText: 'Unit Cost (KES)',
                                  border: OutlineInputBorder(),
                                  isDense: true,
                                ),
                              ),
                              const SizedBox(height: 14),
                              FilledButton.icon(
                                onPressed: _addToOrder,
                                icon: const Icon(Icons.add, size: 16),
                                label: const Text('Add to Order'),
                                style: FilledButton.styleFrom(
                                    backgroundColor: AppColors.kPrimary),
                              ),
                              const SizedBox(height: 6),
                              OutlinedButton(
                                onPressed: () =>
                                    setState(() => _selected = null),
                                child: const Text('Cancel',
                                    style: TextStyle(fontSize: 12)),
                              ),
                            ],
                          ),
                  ),
                ],
              ),
            ),

            // ── Footer ──────────────────────────────────────────────────────
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                border:
                    Border(top: BorderSide(color: Colors.grey.shade200)),
              ),
              child: Row(
                children: [
                  Text(
                    '${widget.catalog.length} items in catalog',
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.kTextSecondary),
                  ),
                  const Spacer(),
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Done'),
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
