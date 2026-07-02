import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/theme/app_theme.dart';
import '../data/branch_storekeeper_repository.dart';

final _moneyFormat = NumberFormat('#,##0.00', 'en_KE');

String _money(num value) => 'KES ${_moneyFormat.format(value)}';

String _date(DateTime value) =>
    '${value.year}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';

String _plainNum(num value) =>
    value == value.truncate() ? value.toInt().toString() : value.toString();

String _text(Map<String, dynamic> row, List<String> keys,
    [String fallback = '']) {
  for (final key in keys) {
    final value = row[key];
    if (value != null && '$value'.trim().isNotEmpty && '$value' != 'null') {
      return '$value'.trim();
    }
  }
  return fallback;
}

num _num(dynamic value) {
  if (value is num) return value;
  return num.tryParse('$value'.replaceAll(',', '').trim()) ?? 0;
}

String _normalise(String value) => value
    .toLowerCase()
    .replaceAll(RegExp(r'[^a-z0-9\s]'), ' ')
    .replaceAll(RegExp(r'\s+'), ' ')
    .trim();

const _validUnits = {
  'PC',
  'PCS',
  'PACK',
  'PACKS',
  'PKT',
  'PKTS',
  'BAG',
  'BAGS',
  'KG',
  'G',
  'LTR',
  'L',
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
  'CAN',
  'CANS',
  'ROLL',
  'ROLLS',
  'DOZEN',
  'DZ',
  'SACK',
  'SACKS',
};

class _PoLine {
  _PoLine({
    required this.key,
    required String itemName,
    required this.quantity,
    required String unit,
    this.unitCost = 0,
    this.manual = false,
  })  : itemName = itemName.trim(),
        unit = unit.trim().toUpperCase() {
    nameCtrl = TextEditingController(text: this.itemName);
    qtyCtrl =
        TextEditingController(text: quantity <= 0 ? '' : _plainNum(quantity));
    unitCtrl = TextEditingController(text: this.unit);
    costCtrl =
        TextEditingController(text: unitCost <= 0 ? '' : _plainNum(unitCost));
  }

  final String key;
  final bool manual;
  String itemName;
  num quantity;
  String unit;
  num unitCost;
  String? sku;
  String? catalogItemId;
  String? error;

  late final TextEditingController nameCtrl;
  late final TextEditingController qtyCtrl;
  late final TextEditingController unitCtrl;
  late final TextEditingController costCtrl;

  num get total => quantity * unitCost;

  void applyCatalog(Map<String, dynamic> item) {
    final name = _text(item, ['item_name', 'name', 'description']);
    final nextSku = _text(item, ['sku', 'item_sku']);
    final nextUnit = _text(item, ['unit_of_measure', 'unit']).toUpperCase();
    itemName = name;
    sku = nextSku.isEmpty ? null : nextSku;
    catalogItemId = _text(item, ['id']);
    nameCtrl.text = name;
    if (nextUnit.isNotEmpty) {
      unit = nextUnit;
      unitCtrl.text = nextUnit;
    }
    final cost = _num(item['cost_price'] ?? item['default_unit_cost']);
    if (unitCost <= 0 && cost > 0) {
      unitCost = cost;
      costCtrl.text = _plainNum(cost);
    }
  }

  void dispose() {
    nameCtrl.dispose();
    qtyCtrl.dispose();
    unitCtrl.dispose();
    costCtrl.dispose();
  }
}

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

  List<Map<String, dynamic>> _suppliers = const [];
  List<Map<String, dynamic>> _catalog = const [];

  String? _supplierId;
  String _paymentTerms = 'credit_30_days';
  DateTime _poDate = DateTime.now();
  DateTime? _expectedDate;
  bool _autoApprove = false;

  final _bulkCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  final List<_PoLine> _lines = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _bulkCtrl.dispose();
    _notesCtrl.dispose();
    for (final line in _lines) {
      line.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      final results = await Future.wait([
        repo.suppliers(),
        repo.masterCatalog(limit: 1000),
      ]);
      if (!mounted) return;
      setState(() {
        _suppliers = List<Map<String, dynamic>>.from(results[0] as List);
        _catalog = List<Map<String, dynamic>>.from(results[1] as List);
        _loading = false;
      });
      _validateAll();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = '$error';
        _loading = false;
      });
    }
  }

  List<_PoLine> get _validLines =>
      _lines.where((line) => line.error == null).toList();

  num get _total => _validLines.fold<num>(0, (sum, line) => sum + line.total);

  int get _errorCount => _lines.where((line) => line.error != null).length;

  void _parseBulk() {
    final rows = _bulkCtrl.text
        .split('\n')
        .map((line) => line.trim())
        .where((line) => line.isNotEmpty)
        .toList();
    if (rows.isEmpty) {
      _snack('Paste at least one item line first');
      return;
    }

    setState(() {
      for (final line in _lines) {
        line.dispose();
      }
      _lines
        ..clear()
        ..addAll(rows.indexed.map((entry) {
          final line = _parseLine(entry.$2, entry.$1);
          _resolveLine(line);
          return line;
        }));
      _validateAll();
    });
  }

  _PoLine _parseLine(String raw, int index) {
    final clean = raw.replaceAll(RegExp(r'\s+'), ' ').trim();
    final key = '${DateTime.now().microsecondsSinceEpoch}-$index';

    List<String> parts = const [];
    if (clean.contains('|')) {
      parts = clean.split('|').map((part) => part.trim()).toList();
    } else if (clean.contains(',')) {
      parts = clean.split(',').map((part) => part.trim()).toList();
    } else if (clean.contains(' - ')) {
      parts =
          clean.split(RegExp(r'\s+-\s+')).map((part) => part.trim()).toList();
    }

    if (parts.length >= 2) {
      return _PoLine(
        key: key,
        itemName: parts.first,
        quantity: _num(parts[1]),
        unit: parts.length > 2 ? parts[2] : '',
        unitCost: parts.length > 3 ? _num(parts[3]) : 0,
      );
    }

    final match = RegExp(
      r'^(.+?)\s+(\d+(?:\.\d+)?)\s*([A-Za-z][A-Za-z0-9/_-]*)?(?:\s+(\d+(?:\.\d+)?))?$',
    ).firstMatch(clean);
    if (match != null) {
      return _PoLine(
        key: key,
        itemName: match.group(1) ?? '',
        quantity: _num(match.group(2)),
        unit: match.group(3) ?? '',
        unitCost: _num(match.group(4)),
      );
    }

    return _PoLine(
      key: key,
      itemName: clean,
      quantity: 0,
      unit: '',
    )..error = 'Could not read quantity';
  }

  void _addManualRow() {
    setState(() {
      _lines.add(_PoLine(
        key: '${DateTime.now().microsecondsSinceEpoch}-manual',
        itemName: '',
        quantity: 0,
        unit: '',
        manual: true,
      ));
      _validateAll();
    });
  }

  void _resolveLine(_PoLine line) {
    final match = _findCatalog(line.itemName);
    if (match != null) line.applyCatalog(match);
  }

  Map<String, dynamic>? _findCatalog(String value) {
    final needle = _normalise(value);
    if (needle.isEmpty) return null;
    for (final item in _catalog) {
      final sku = _text(item, ['sku', 'item_sku']).toLowerCase();
      if (sku == value.trim().toLowerCase()) return item;
    }
    for (final item in _catalog) {
      final name =
          _normalise(_text(item, ['item_name', 'name', 'description']));
      if (name == needle) return item;
    }
    for (final item in _catalog) {
      final name =
          _normalise(_text(item, ['item_name', 'name', 'description']));
      if (name.contains(needle) || needle.contains(name)) return item;
    }
    return null;
  }

  void _validateAll() {
    final seen = <String>{};
    for (final line in _lines) {
      String? error;
      line.itemName = line.nameCtrl.text.trim();
      line.quantity = _num(line.qtyCtrl.text);
      line.unit = line.unitCtrl.text.trim().toUpperCase();
      line.unitCost = _num(line.costCtrl.text);

      if (line.itemName.isEmpty) {
        error = 'Item name required';
      } else if (line.quantity <= 0) {
        error = 'Qty must be > 0';
      } else if (line.sku == null || line.sku!.trim().isEmpty) {
        error = 'Pick catalog item';
      } else if (line.unit.isEmpty) {
        error = 'Unit required';
      } else if (!_validUnits.contains(line.unit)) {
        error = 'Check unit';
      } else if (line.unitCost < 0) {
        error = 'Cost cannot be negative';
      }

      final duplicateKey =
          '${line.sku ?? _normalise(line.itemName)}:${line.unit}';
      if (error == null && seen.contains(duplicateKey)) {
        error = 'Duplicate row';
      }
      seen.add(duplicateKey);
      line.error = error;
    }
  }

  Future<void> _pickCatalogFor(_PoLine line) async {
    final picked = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _CatalogPickerDialog(
        catalog: _catalog,
        initialQuery: line.nameCtrl.text,
      ),
    );
    if (picked == null) return;
    setState(() {
      line.applyCatalog(picked);
      _validateAll();
    });
  }

  Future<void> _pickDate({
    required DateTime? value,
    required ValueChanged<DateTime?> onPicked,
    DateTime? firstDate,
    bool nullable = false,
  }) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: value ?? DateTime.now(),
      firstDate: firstDate ?? DateTime(2024),
      lastDate: DateTime.now().add(const Duration(days: 365 * 3)),
    );
    if (picked != null) onPicked(picked);
    if (picked == null && nullable) return;
  }

  Future<void> _createMissingManualCatalogItems() async {
    final missing = _lines
        .where((line) =>
            line.manual &&
            (line.sku == null || line.sku!.trim().isEmpty) &&
            line.nameCtrl.text.trim().isNotEmpty &&
            _num(line.qtyCtrl.text) > 0 &&
            line.unitCtrl.text.trim().isNotEmpty)
        .toList();
    if (missing.isEmpty) return;

    final repo = ref.read(branchStorekeeperRepositoryProvider);
    var catalogChanged = false;

    for (final line in missing) {
      final existing = _findCatalog(line.nameCtrl.text);
      if (existing != null) {
        line.applyCatalog(existing);
        continue;
      }

      await repo.createItem({
        'item_name': line.nameCtrl.text.trim().toUpperCase(),
        'description': line.nameCtrl.text.trim(),
        'category': 'DRY GOODS',
        'unit_of_measure': line.unitCtrl.text.trim().toLowerCase(),
        'cost_price': _num(line.costCtrl.text),
        'retail_price': _num(line.costCtrl.text),
        'quantity': 0,
        'store_type': 'foodstuffs',
        'reorder_level': 0,
      });

      final matches = await repo.masterCatalog(
        search: line.nameCtrl.text.trim(),
        limit: 20,
      );
      for (final item in matches) {
        final id = _text(item, ['id']);
        final sku = _text(item, ['sku', 'item_sku']);
        final exists = _catalog.any((row) =>
            (id.isNotEmpty && _text(row, ['id']) == id) ||
            (sku.isNotEmpty && _text(row, ['sku', 'item_sku']) == sku));
        if (!exists) {
          _catalog = [..._catalog, item];
          catalogChanged = true;
        }
      }

      final created = _findCatalog(line.nameCtrl.text) ??
          (matches.isNotEmpty ? matches.first : null);
      if (created != null) line.applyCatalog(created);
    }

    if (catalogChanged && mounted) setState(() {});
  }

  Future<void> _submit({required bool approve}) async {
    setState(_validateAll);
    if (_supplierId == null || _supplierId!.isEmpty) {
      _snack('Select a supplier first');
      return;
    }
    if (_expectedDate != null && _expectedDate!.isBefore(_poDate)) {
      _snack('Expected delivery cannot be before PO date');
      return;
    }
    if (_lines.isEmpty) {
      _snack('Add at least one item');
      return;
    }

    setState(() => _saving = true);
    try {
      await _createMissingManualCatalogItems();
      if (!mounted) return;
      setState(_validateAll);
    } catch (error) {
      if (mounted) {
        setState(() => _saving = false);
        _snack('Could not create manual catalog item: $error');
      }
      return;
    }

    if (_errorCount > 0) {
      setState(() => _saving = false);
      _snack('Fix $_errorCount item error(s) before saving');
      return;
    }

    try {
      await ref.read(branchStorekeeperRepositoryProvider).createPurchaseOrder({
        'supplier_id': _supplierId,
        'po_date': _date(_poDate),
        if (_expectedDate != null)
          'expected_delivery_date': _date(_expectedDate!),
        'payment_terms': _paymentTerms,
        'delivery_terms': 'Branch Store',
        if (_notesCtrl.text.trim().isNotEmpty)
          'special_instructions': _notesCtrl.text.trim(),
        'auto_approve': approve || _autoApprove,
        'items': _lines
            .map((line) => {
                  'item_id': line.sku,
                  'quantity': line.quantity,
                  'unit_price': line.unitCost,
                  'tax_amount': 0,
                  'total_price': line.total,
                })
            .toList(),
      });
      if (!mounted) return;
      _snack(
        approve || _autoApprove
            ? 'Purchase Order created and approved'
            : 'Purchase Order saved as draft',
        success: true,
      );
      Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) _snack('Could not create PO: $error');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _clear() {
    for (final line in _lines) {
      line.dispose();
    }
    setState(() {
      _supplierId = null;
      _paymentTerms = 'credit_30_days';
      _poDate = DateTime.now();
      _expectedDate = null;
      _autoApprove = false;
      _bulkCtrl.clear();
      _notesCtrl.clear();
      _lines.clear();
    });
  }

  void _snack(String message, {bool success = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: success ? AppColors.kSuccess : AppColors.kError,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final hasErrors = _errorCount > 0;
    return Scaffold(
      backgroundColor: AppColors.kSurface,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        leading: IconButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(),
          icon: const Icon(Icons.arrow_back),
        ),
        title: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.kPrimary.withValues(alpha: .1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                PhosphorIcons.shoppingCart(),
                color: AppColors.kPrimary,
                size: 21,
              ),
            ),
            const SizedBox(width: 12),
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'New Purchase Order',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                    color: AppColors.kTextPrimary,
                  ),
                ),
                Text(
                  'Branch Store Supplier Order',
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.kTextSecondary,
                    fontWeight: FontWeight.normal,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh catalog and suppliers',
            onPressed: _saving ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
          TextButton.icon(
            onPressed: (_saving || _lines.isEmpty) ? null : _clear,
            icon: const Icon(Icons.clear_all, size: 18),
            label: const Text('Clear'),
          ),
          const SizedBox(width: 10),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: AppColors.kDivider),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _ErrorPanel(message: _error!, onRetry: _load)
              : _buildBody(hasErrors),
      bottomNavigationBar: _loading || _error != null
          ? null
          : _BottomSummaryBar(
              saving: _saving,
              lineCount: _validLines.length,
              errorCount: _errorCount,
              total: _total,
              onDraft: () => _submit(approve: false),
              onSubmit: () => _submit(approve: true),
            ),
    );
  }

  Widget _buildBody(bool hasErrors) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 110),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _HeroPanel(
            supplierCount: _suppliers.length,
            catalogCount: _catalog.length,
            lineCount: _lines.length,
            validCount: _validLines.length,
            total: _total,
          ),
          const SizedBox(height: 16),
          _Panel(
            title: 'Order Details',
            subtitle: 'Choose supplier, dates, payment terms, and notes.',
            icon: PhosphorIcons.fileText(),
            child: LayoutBuilder(builder: (context, constraints) {
              final compact = constraints.maxWidth < 760;
              final fieldWidth = compact
                  ? constraints.maxWidth
                  : (constraints.maxWidth - 12) / 2;
              return Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  SizedBox(
                    width: constraints.maxWidth,
                    child: DropdownButtonFormField<String>(
                      isExpanded: true,
                      initialValue: _supplierId,
                      decoration: const InputDecoration(
                        labelText: 'Supplier',
                        prefixIcon: Icon(Icons.storefront_outlined),
                      ),
                      items: _suppliers
                          .map((supplier) => DropdownMenuItem(
                                value: _text(supplier, ['id']),
                                child: Text(
                                  [
                                    _text(supplier, ['name', 'supplier_name'],
                                        'Supplier'),
                                    _text(supplier, ['supplier_code', 'code']),
                                  ]
                                      .where((part) => part.isNotEmpty)
                                      .join(' | '),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ))
                          .toList(),
                      onChanged: (value) => setState(() => _supplierId = value),
                    ),
                  ),
                  SizedBox(
                    width: fieldWidth,
                    child: _DateTile(
                      label: 'PO Date',
                      value: _date(_poDate),
                      onTap: () => _pickDate(
                        value: _poDate,
                        onPicked: (date) {
                          if (date == null) return;
                          setState(() {
                            _poDate = date;
                            if (_expectedDate != null &&
                                _expectedDate!.isBefore(date)) {
                              _expectedDate = date;
                            }
                          });
                        },
                      ),
                    ),
                  ),
                  SizedBox(
                    width: fieldWidth,
                    child: _DateTile(
                      label: 'Expected Delivery',
                      value: _expectedDate == null
                          ? 'Not set'
                          : _date(_expectedDate!),
                      onTap: () => _pickDate(
                        value: _expectedDate ?? _poDate,
                        firstDate: _poDate,
                        nullable: true,
                        onPicked: (date) =>
                            setState(() => _expectedDate = date),
                      ),
                    ),
                  ),
                  SizedBox(
                    width: fieldWidth,
                    child: DropdownButtonFormField<String>(
                      isExpanded: true,
                      initialValue: _paymentTerms,
                      decoration:
                          const InputDecoration(labelText: 'Payment Terms'),
                      items: const [
                        DropdownMenuItem(value: 'cash', child: Text('Cash')),
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
                            value: 'credit_90_days',
                            child: Text('Credit 90 days')),
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
                    child: SwitchListTile(
                      value: _autoApprove,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                      title: const Text('Auto-approve when saving'),
                      subtitle: const Text('Creates an approved supplier PO.'),
                      onChanged: (value) =>
                          setState(() => _autoApprove = value),
                    ),
                  ),
                  SizedBox(
                    width: constraints.maxWidth,
                    child: TextField(
                      controller: _notesCtrl,
                      minLines: 2,
                      maxLines: 3,
                      decoration: const InputDecoration(
                        labelText: 'Remarks / Notes',
                        alignLabelWithHint: true,
                      ),
                    ),
                  ),
                ],
              );
            }),
          ),
          const SizedBox(height: 16),
          _Panel(
            title: 'Bulk Entry',
            subtitle:
                'Paste items the central-store way, then review and fix lines below.',
            icon: PhosphorIcons.sparkle(),
            trailing: Wrap(
              spacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: _addManualRow,
                  icon: const Icon(Icons.add, size: 17),
                  label: const Text('Manual row'),
                ),
                FilledButton.icon(
                  onPressed: _parseBulk,
                  icon: const Icon(Icons.auto_fix_high, size: 17),
                  label: const Text('Parse items'),
                ),
              ],
            ),
            child: TextField(
              controller: _bulkCtrl,
              minLines: 6,
              maxLines: 10,
              style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
              decoration: const InputDecoration(
                alignLabelWithHint: true,
                labelText: 'Paste item lines',
                hintText:
                    'FRESH MILK, 1000, LTR, 0\nSUGAR 2KG | 30 | BAGS | 2500\nWATER 500ML 50 PCS',
              ),
            ),
          ),
          const SizedBox(height: 16),
          _Panel(
            title: 'Order Lines',
            subtitle:
                'Excel-style grid. Type manually, pick catalog matches, and submit only clean rows.',
            icon: PhosphorIcons.listChecks(),
            trailing: Text(
              hasErrors
                  ? '$_errorCount error(s)'
                  : '${_validLines.length} ready',
              style: TextStyle(
                color: hasErrors ? AppColors.kError : AppColors.kSuccess,
                fontWeight: FontWeight.w800,
              ),
            ),
            child: _lines.isEmpty
                ? _EmptyLines(onManual: _addManualRow)
                : _LinesTable(
                    lines: _lines,
                    onChanged: () => setState(_validateAll),
                    onPickCatalog: _pickCatalogFor,
                    onRemove: (line) {
                      setState(() {
                        line.dispose();
                        _lines.remove(line);
                        _validateAll();
                      });
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class _HeroPanel extends StatelessWidget {
  const _HeroPanel({
    required this.supplierCount,
    required this.catalogCount,
    required this.lineCount,
    required this.validCount,
    required this.total,
  });

  final int supplierCount;
  final int catalogCount;
  final int lineCount;
  final int validCount;
  final num total;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.kPrimary, Color(0xFF255B84)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: AppColors.kPrimary.withValues(alpha: .18),
            blurRadius: 22,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Wrap(
        spacing: 12,
        runSpacing: 12,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          SizedBox(
            width: 360,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Branch purchase order desk',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 20,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Create supplier POs using the same flow as Central Store, with branch-safe catalog validation.',
                  style: TextStyle(color: Colors.white.withValues(alpha: .82)),
                ),
              ],
            ),
          ),
          _HeroMetric(label: 'Suppliers', value: '$supplierCount'),
          _HeroMetric(label: 'Catalog Items', value: '$catalogCount'),
          _HeroMetric(label: 'Lines', value: '$validCount/$lineCount'),
          _HeroMetric(label: 'Total', value: _money(total)),
        ],
      ),
    );
  }
}

class _HeroMetric extends StatelessWidget {
  const _HeroMetric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 132),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: .12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: .18)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: TextStyle(
                  color: Colors.white.withValues(alpha: .72), fontSize: 12)),
          const SizedBox(height: 4),
          Text(value,
              style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 16)),
        ],
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.child,
    this.trailing,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: .75)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppColors.kPrimary.withValues(alpha: .08),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, color: AppColors.kPrimary, size: 20),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: const TextStyle(
                              fontWeight: FontWeight.w900, fontSize: 16)),
                      Text(subtitle,
                          style: const TextStyle(
                              color: AppColors.kTextSecondary, fontSize: 12)),
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

class _DateTile extends StatelessWidget {
  const _DateTile({
    required this.label,
    required this.value,
    required this.onTap,
  });

  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: onTap,
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: const Icon(Icons.calendar_today_outlined),
        ),
        child: Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
      ),
    );
  }
}

class _LinesTable extends StatelessWidget {
  const _LinesTable({
    required this.lines,
    required this.onChanged,
    required this.onPickCatalog,
    required this.onRemove,
  });

  final List<_PoLine> lines;
  final VoidCallback onChanged;
  final ValueChanged<_PoLine> onPickCatalog;
  final ValueChanged<_PoLine> onRemove;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: SizedBox(
        width: 1180,
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.kSurface,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Row(
                children: [
                  SizedBox(width: 42, child: Text('#', style: _headerStyle)),
                  Expanded(flex: 4, child: Text('Item', style: _headerStyle)),
                  SizedBox(width: 130, child: Text('SKU', style: _headerStyle)),
                  SizedBox(width: 100, child: Text('Qty', style: _headerStyle)),
                  SizedBox(
                      width: 100, child: Text('Unit', style: _headerStyle)),
                  SizedBox(
                      width: 120,
                      child: Text('Unit Cost', style: _headerStyle)),
                  SizedBox(
                      width: 120, child: Text('Total', style: _headerStyle)),
                  SizedBox(
                      width: 180, child: Text('Status', style: _headerStyle)),
                  SizedBox(width: 86),
                ],
              ),
            ),
            const SizedBox(height: 8),
            ...lines.indexed.map((entry) {
              final index = entry.$1;
              final line = entry.$2;
              final hasError = line.error != null;
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: hasError
                      ? AppColors.kError.withValues(alpha: .035)
                      : Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: hasError
                        ? AppColors.kError.withValues(alpha: .25)
                        : AppColors.kDivider,
                  ),
                ),
                child: Row(
                  children: [
                    SizedBox(
                      width: 42,
                      child: Text('${index + 1}',
                          style: const TextStyle(fontWeight: FontWeight.w800)),
                    ),
                    Expanded(
                      flex: 4,
                      child: TextField(
                        controller: line.nameCtrl,
                        onChanged: (_) => onChanged(),
                        onSubmitted: (_) => onPickCatalog(line),
                        decoration: InputDecoration(
                          hintText: line.manual
                              ? 'Type item manually then pick catalog'
                              : 'Item name',
                          isDense: true,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      width: 122,
                      child: InkWell(
                        onTap: () => onPickCatalog(line),
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          height: 48,
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          decoration: BoxDecoration(
                            color: line.sku == null
                                ? AppColors.kWarning.withValues(alpha: .08)
                                : AppColors.kSuccess.withValues(alpha: .08),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: line.sku == null
                                  ? AppColors.kWarning.withValues(alpha: .35)
                                  : AppColors.kSuccess.withValues(alpha: .22),
                            ),
                          ),
                          alignment: Alignment.centerLeft,
                          child: Text(
                            line.sku ?? 'Pick',
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              color: line.sku == null
                                  ? AppColors.kWarning
                                  : AppColors.kSuccess,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      width: 92,
                      child: TextField(
                        controller: line.qtyCtrl,
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                        ],
                        keyboardType: TextInputType.number,
                        onChanged: (_) => onChanged(),
                        decoration:
                            const InputDecoration(hintText: '0', isDense: true),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      width: 92,
                      child: TextField(
                        controller: line.unitCtrl,
                        textCapitalization: TextCapitalization.characters,
                        onChanged: (_) => onChanged(),
                        decoration: const InputDecoration(
                            hintText: 'PCS', isDense: true),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      width: 112,
                      child: TextField(
                        controller: line.costCtrl,
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                        ],
                        keyboardType: TextInputType.number,
                        onChanged: (_) => onChanged(),
                        decoration:
                            const InputDecoration(hintText: '0', isDense: true),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      width: 112,
                      child: Text(_money(line.total),
                          textAlign: TextAlign.right,
                          style: const TextStyle(fontWeight: FontWeight.w800)),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      width: 172,
                      child: Text(
                        line.error ?? 'Ready',
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color:
                              hasError ? AppColors.kError : AppColors.kSuccess,
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    SizedBox(
                      width: 78,
                      child: Row(
                        children: [
                          IconButton(
                            tooltip: 'Pick catalog item',
                            onPressed: () => onPickCatalog(line),
                            icon: const Icon(Icons.search, size: 18),
                          ),
                          IconButton(
                            tooltip: 'Remove row',
                            onPressed: () => onRemove(line),
                            icon: const Icon(Icons.close, size: 18),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}

const _headerStyle = TextStyle(
  fontWeight: FontWeight.w900,
  color: AppColors.kTextSecondary,
  fontSize: 12,
);

class _EmptyLines extends StatelessWidget {
  const _EmptyLines({required this.onManual});

  final VoidCallback onManual;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: AppColors.kSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.kDivider),
      ),
      child: Column(
        children: [
          Icon(PhosphorIcons.package(), size: 44, color: AppColors.kPrimary),
          const SizedBox(height: 10),
          const Text(
            'No purchase order lines yet',
            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
          ),
          const SizedBox(height: 5),
          const Text(
            'Paste bulk items above or add one manual line and pick the catalog match.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.kTextSecondary),
          ),
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: onManual,
            icon: const Icon(Icons.add),
            label: const Text('Add manual row'),
          ),
        ],
      ),
    );
  }
}

class _BottomSummaryBar extends StatelessWidget {
  const _BottomSummaryBar({
    required this.saving,
    required this.lineCount,
    required this.errorCount,
    required this.total,
    required this.onDraft,
    required this.onSubmit,
  });

  final bool saving;
  final int lineCount;
  final int errorCount;
  final num total;
  final VoidCallback onDraft;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 14),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.kDivider)),
      ),
      child: SafeArea(
        child: Row(
          children: [
            Expanded(
              child: Wrap(
                spacing: 12,
                runSpacing: 4,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(
                    '$lineCount valid line(s)',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  if (errorCount > 0)
                    Text(
                      '$errorCount error(s)',
                      style: const TextStyle(
                        color: AppColors.kError,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  Text(
                    _money(total),
                    style: const TextStyle(
                        fontWeight: FontWeight.w900, fontSize: 16),
                  ),
                ],
              ),
            ),
            OutlinedButton.icon(
              onPressed: saving ? null : onDraft,
              icon: const Icon(Icons.save_outlined, size: 18),
              label: Text(saving ? 'Saving...' : 'Save Draft'),
            ),
            const SizedBox(width: 10),
            FilledButton.icon(
              onPressed: saving ? null : onSubmit,
              icon: const Icon(Icons.check_circle_outline, size: 18),
              label: Text(saving ? 'Submitting...' : 'Submit / Approve'),
            ),
          ],
        ),
      ),
    );
  }
}

class _CatalogPickerDialog extends StatefulWidget {
  const _CatalogPickerDialog({
    required this.catalog,
    required this.initialQuery,
  });

  final List<Map<String, dynamic>> catalog;
  final String initialQuery;

  @override
  State<_CatalogPickerDialog> createState() => _CatalogPickerDialogState();
}

class _CatalogPickerDialogState extends State<_CatalogPickerDialog> {
  late final TextEditingController _searchCtrl =
      TextEditingController(text: widget.initialQuery);

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> get _filtered {
    final needle = _normalise(_searchCtrl.text);
    if (needle.isEmpty) return widget.catalog.take(80).toList();
    return widget.catalog
        .where((item) {
          final haystack = [
            _text(item, ['sku', 'item_sku']),
            _text(item, ['item_name', 'name', 'description']),
            _text(item, ['category']),
            _text(item, ['store_type']),
          ].join(' ');
          return _normalise(haystack).contains(needle);
        })
        .take(80)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final rows = _filtered;
    return Dialog(
      insetPadding: const EdgeInsets.all(24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 760, maxHeight: 680),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Pick Master Inventory Item',
                      style:
                          TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _searchCtrl,
                autofocus: true,
                decoration: const InputDecoration(
                  hintText: 'Search by item, SKU, category',
                  prefixIcon: Icon(Icons.search),
                ),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: rows.isEmpty
                    ? const Center(
                        child: Text(
                          'No catalog matches. Add the item to Master Inventory first.',
                          style: TextStyle(color: AppColors.kTextSecondary),
                        ),
                      )
                    : ListView.separated(
                        itemCount: rows.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (_, index) {
                          final item = rows[index];
                          final name =
                              _text(item, ['item_name', 'name', 'description']);
                          final sku = _text(item, ['sku', 'item_sku']);
                          final unit = _text(item, ['unit_of_measure', 'unit']);
                          return ListTile(
                            title: Text(name,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w800)),
                            subtitle: Text([
                              sku,
                              _text(item, ['category']),
                              if (unit.isNotEmpty) 'Unit: $unit',
                            ].where((part) => part.isNotEmpty).join(' | ')),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: () => Navigator.pop(context, item),
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ),
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
      child: Card(
        elevation: 0,
        margin: const EdgeInsets.all(24),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline,
                  color: AppColors.kError, size: 48),
              const SizedBox(height: 10),
              const Text('Could not load purchase order screen',
                  style: TextStyle(fontWeight: FontWeight.w900)),
              const SizedBox(height: 8),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.kTextSecondary),
              ),
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
