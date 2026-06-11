import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/admin_repository.dart';

// ─── Shared ────────────────────────────────────────────────────────────────

Widget _header(String title, IconData icon, {String? subtitle}) => Container(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
      decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(bottom: BorderSide(color: AppColors.kDivider))),
      child: Row(children: [
        Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
                color: AppColors.kPrimary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: AppColors.kPrimary, size: 20)),
        const SizedBox(width: 14),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title,
              style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.kTextPrimary)),
          if (subtitle != null)
            Text(subtitle,
                style: const TextStyle(
                    fontSize: 12, color: AppColors.kTextSecondary)),
        ]),
      ]),
    );

class _S extends StatelessWidget {
  final String label, value;
  final IconData icon;
  final Color color;
  const _S(
      {required this.label,
      required this.value,
      required this.icon,
      required this.color});
  @override
  Widget build(BuildContext context) => Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5))),
        child: Padding(
            padding: const EdgeInsets.all(16),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(icon, color: color, size: 18),
              const SizedBox(height: 8),
              Text(value,
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.w700)),
              Text(label,
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.kTextSecondary)),
            ])),
      );
}

Widget _t(String title) => Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Text(title,
                style: const TextStyle(
                    fontWeight: FontWeight.w600, fontSize: 14))),
        const Divider(height: 1),
        const Padding(
            padding: EdgeInsets.all(20),
            child: Center(
                child: Text('No records found',
                    style: TextStyle(color: AppColors.kTextSecondary)))),
      ]),
    );

String _bsText(Map<String, dynamic> row, List<String> keys,
    [String fallback = '—']) {
  for (final key in keys) {
    final value = row[key];
    if (value != null && '$value'.trim().isNotEmpty && '$value' != 'null') {
      return '$value';
    }
  }
  return fallback;
}

double _bsNum(Map<String, dynamic> row, List<String> keys) {
  for (final key in keys) {
    final value = row[key];
    if (value is num) return value.toDouble();
    final parsed = double.tryParse('$value');
    if (parsed != null) return parsed;
  }
  return 0;
}

List<Map<String, dynamic>> _bsList(dynamic value) {
  final raw = value is Map
      ? value['data'] ?? value['items'] ?? value['rows'] ?? value['results']
      : value;
  if (raw is List) {
    return raw
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }
  if (raw is Map) return [Map<String, dynamic>.from(raw)];
  return <Map<String, dynamic>>[];
}

String _bsId(Map<String, dynamic> row) => _bsText(row, ['id', 'sku'], '');

String _bsDate(dynamic value) {
  final parsed = DateTime.tryParse('$value');
  if (parsed == null) return '—';
  return '${parsed.day.toString().padLeft(2, '0')}/${parsed.month.toString().padLeft(2, '0')}/${parsed.year}';
}

String _bsPlain(num value) =>
    value.round() == value ? value.toInt().toString() : value.toString();

String _bsMoney(num value) => 'KES ${value.toStringAsFixed(0)}';

Widget _bsStatus(String status) {
  final normalized = status.toLowerCase();
  final color =
      normalized.contains('approved') || normalized.contains('counted')
          ? Colors.green
          : normalized.contains('submitted')
              ? Colors.orange
              : normalized.contains('reject') || normalized.contains('variance')
                  ? Colors.red
                  : AppColors.kPrimary;
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .10),
      border: Border.all(color: color.withValues(alpha: .28)),
      borderRadius: BorderRadius.circular(999),
    ),
    child: Text(
      status.toUpperCase(),
      style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 10),
    ),
  );
}

class _BranchInlineStockInput extends StatefulWidget {
  const _BranchInlineStockInput({
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
  State<_BranchInlineStockInput> createState() =>
      _BranchInlineStockInputState();
}

class _BranchInlineStockInputState extends State<_BranchInlineStockInput> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue);
  }

  @override
  void didUpdateWidget(covariant _BranchInlineStockInput oldWidget) {
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

// ═══════════════════════════════════════════════════════════════════
// BRANCH STORE OPS
// ═══════════════════════════════════════════════════════════════════

class BranchStoreOverviewSection extends StatelessWidget {
  const BranchStoreOverviewSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Branch Store', PhosphorIcons.package(),
            subtitle: 'Branch-level stock and storekeeping overview'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Items in Stock',
                            value: '—',
                            icon: PhosphorIcons.package(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Low Stock Alerts',
                            value: '—',
                            icon: PhosphorIcons.warning(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Pending Requests',
                            value: '—',
                            icon: PhosphorIcons.clock(),
                            color: Colors.blue)),
                  ]),
                  const SizedBox(height: 20),
                  _t('Recent Stock Movements'),
                ]))),
      ]);
}

class ReceiveGoodsSection extends StatelessWidget {
  const ReceiveGoodsSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Receive Goods', PhosphorIcons.packageArrowUp(),
            subtitle: 'Receive and verify incoming stock at branch level'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: ElevatedButton.icon(
                      onPressed: () {
                        final poCtrl = TextEditingController();
                        final supplierCtrl = TextEditingController();
                        showDialog(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: const Text('Record Goods Receipt'),
                            content: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  TextField(
                                      controller: poCtrl,
                                      decoration: const InputDecoration(
                                          labelText: 'PO Number')),
                                  const SizedBox(height: 12),
                                  TextField(
                                      controller: supplierCtrl,
                                      decoration: const InputDecoration(
                                          labelText: 'Supplier')),
                                ]),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.pop(ctx),
                                  child: const Text('Cancel')),
                              ElevatedButton(
                                  onPressed: () {
                                    Navigator.pop(ctx);
                                    AppNotifier.showSnackBar(
                                        context,
                                        const SnackBar(
                                            content: Text('Receipt recorded')));
                                  },
                                  child: const Text('Record')),
                            ],
                          ),
                        );
                      },
                      icon: Icon(PhosphorIcons.plus(), size: 14),
                      label: const Text('Record Receipt'),
                      style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.kPrimary,
                          foregroundColor: Colors.white,
                          minimumSize: const Size(0, 36)),
                    )),
                  ]),
                  const SizedBox(height: 20),
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Expected Today',
                            value: '—',
                            icon: PhosphorIcons.truck(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Received',
                            value: '—',
                            icon: PhosphorIcons.checkCircle(),
                            color: Colors.green)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Discrepancies',
                            value: '—',
                            icon: PhosphorIcons.warning(),
                            color: Colors.red)),
                  ]),
                  const SizedBox(height: 20),
                  _t('Goods Receipt Log'),
                ]))),
      ]);
}

class BranchSuppliersSection extends StatelessWidget {
  const BranchSuppliersSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Branch Suppliers', PhosphorIcons.users(),
            subtitle: 'Branch-level supplier management'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Active Suppliers',
                            value: '—',
                            icon: PhosphorIcons.users(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    ElevatedButton.icon(
                      onPressed: () {
                        final nameCtrl = TextEditingController();
                        final phoneCtrl = TextEditingController();
                        showDialog(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: const Text('Add Supplier'),
                            content: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  TextField(
                                      controller: nameCtrl,
                                      decoration: const InputDecoration(
                                          labelText: 'Supplier Name')),
                                  const SizedBox(height: 12),
                                  TextField(
                                      controller: phoneCtrl,
                                      decoration: const InputDecoration(
                                          labelText: 'Phone')),
                                ]),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.pop(ctx),
                                  child: const Text('Cancel')),
                              ElevatedButton(
                                  onPressed: () {
                                    Navigator.pop(ctx);
                                    AppNotifier.showSnackBar(
                                        context,
                                        SnackBar(
                                            content: Text(
                                                'Supplier ${nameCtrl.text} added')));
                                  },
                                  child: const Text('Add')),
                            ],
                          ),
                        );
                      },
                      icon: Icon(PhosphorIcons.plus(), size: 14),
                      label: const Text('Add Supplier'),
                      style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.kPrimary,
                          foregroundColor: Colors.white,
                          minimumSize: const Size(0, 36)),
                    ),
                  ]),
                  const SizedBox(height: 20),
                  _t('Suppliers'),
                ]))),
      ]);
}

class BranchStockTakesSection extends ConsumerStatefulWidget {
  const BranchStockTakesSection({super.key});

  @override
  ConsumerState<BranchStockTakesSection> createState() =>
      _BranchStockTakesSectionState();
}

class _BranchStockTakesSectionState
    extends ConsumerState<BranchStockTakesSection> {
  late Future<List<Map<String, dynamic>>> _future = _load();
  String? _selectedId;
  Map<String, dynamic>? _detail;
  bool _loadingDetail = false;

  Future<List<Map<String, dynamic>>> _load() {
    return ref.read(adminRepositoryProvider).getBranchStockTakes();
  }

  void _refresh() {
    setState(() => _future = _load());
  }

  bool get _canEdit {
    final status = _bsText(_detail ?? {}, ['status'], '').toLowerCase();
    return status == 'draft' || status == 'in_progress';
  }

  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Stock Takes', PhosphorIcons.clipboardText(),
            subtitle:
                'Download worksheets, record actual counts, explain variances, and submit for audit'),
        Expanded(
            child: _selectedId == null
                ? FutureBuilder<List<Map<String, dynamic>>>(
                    future: _future,
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const Center(child: CircularProgressIndicator());
                      }
                      if (snapshot.hasError) {
                        return Center(
                          child: Text(
                              'Failed to load stock takes: ${snapshot.error}'),
                        );
                      }
                      final rows = snapshot.data ?? const [];
                      return _historyView(rows);
                    },
                  )
                : _detailView()),
      ]);

  Widget _historyView(List<Map<String, dynamic>> rows) {
    final open = rows
        .where((row) => ['draft', 'in_progress']
            .contains(_bsText(row, ['status']).toLowerCase()))
        .length;
    final submitted = rows
        .where((row) =>
            _bsText(row, ['status']).toLowerCase().contains('submitted'))
        .length;
    final lastDate = rows.isEmpty
        ? '—'
        : _bsDate(rows.first['count_date'] ?? rows.first['created_at']);
    return RefreshIndicator(
      onRefresh: () async => _refresh(),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        child: Column(children: [
          Row(children: [
            Expanded(
                child: _S(
                    label: 'Last Stock Take',
                    value: lastDate,
                    icon: PhosphorIcons.calendar(),
                    color: AppColors.kPrimary)),
            const SizedBox(width: 12),
            Expanded(
                child: _S(
                    label: 'Open Worksheets',
                    value: '$open',
                    icon: PhosphorIcons.clipboardText(),
                    color: Colors.orange)),
            const SizedBox(width: 12),
            Expanded(
                child: _S(
                    label: 'Submitted for Audit',
                    value: '$submitted',
                    icon: PhosphorIcons.paperPlaneTilt(),
                    color: Colors.green)),
          ]),
          const SizedBox(height: 20),
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: AppColors.kDivider.withValues(alpha: .7)),
            ),
            child: Column(children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                child: Row(children: [
                  const Expanded(
                    child: Text('Stock Take History',
                        style: TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 15)),
                  ),
                  OutlinedButton.icon(
                    onPressed: _refresh,
                    icon: const Icon(Icons.refresh, size: 16),
                    label: const Text('Refresh'),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton.icon(
                    onPressed: _startStockTake,
                    icon: Icon(PhosphorIcons.plus(), size: 14),
                    label: const Text('Stock Take'),
                    style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.kPrimary,
                        foregroundColor: Colors.white),
                  ),
                ]),
              ),
              const Divider(height: 1),
              if (rows.isEmpty)
                const Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No stock take sessions found',
                        style: TextStyle(color: AppColors.kTextSecondary)))
              else
                ...rows.map((row) => _stockTakeTile(row)),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _stockTakeTile(Map<String, dynamic> row) {
    final status = _bsText(row, ['status'], 'draft');
    return Column(children: [
      ListTile(
        leading: CircleAvatar(
          backgroundColor: AppColors.kPrimary.withValues(alpha: .10),
          child: Icon(PhosphorIcons.clipboardText(), color: AppColors.kPrimary),
        ),
        title: Text(_bsText(row, ['count_number', 'take_number', 'id']),
            style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text(
          '${_bsText(row, ['store_type'], 'foodstuffs')} • ${_bsText(row, [
                'count_type',
                'take_type'
              ], 'daily')} • ${_bsDate(row['count_date'] ?? row['created_at'])}',
        ),
        trailing: Wrap(
            spacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              _bsStatus(status),
              OutlinedButton(
                onPressed: () => _openStockTake(_bsId(row)),
                child: const Text('Open'),
              ),
              OutlinedButton.icon(
                onPressed: () => _downloadWorksheet(row),
                icon: const Icon(Icons.download, size: 14),
                label: const Text('Worksheet'),
              ),
            ]),
      ),
      const Divider(height: 1),
    ]);
  }

  Widget _detailView() {
    if (_loadingDetail || _detail == null) {
      return const Center(child: CircularProgressIndicator());
    }
    final detail = _detail!;
    final items = _bsList(detail['items']);
    final counted =
        items.where((item) => _actualIncludingDraft(item) != null).length;
    final variances =
        items.where((item) => _varianceIncludingDraft(item) != 0).length;
    final varianceValue = items.fold<double>(
        0,
        (sum, item) =>
            sum +
            (_varianceIncludingDraft(item) *
                _bsNum(item, ['unit_cost', 'cost_price', 'cost'])));
    final status = _bsText(detail, ['status'], 'draft');
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          OutlinedButton.icon(
            onPressed: () => setState(() {
              _selectedId = null;
              _detail = null;
            }),
            icon: const Icon(Icons.arrow_back, size: 16),
            label: const Text('Back to list'),
          ),
          const Spacer(),
          _bsStatus(status),
          const SizedBox(width: 8),
          OutlinedButton.icon(
            onPressed: () => _downloadWorksheet(detail),
            icon: const Icon(Icons.download, size: 16),
            label: const Text('Download Worksheet'),
          ),
          const SizedBox(width: 8),
          if (_canEdit)
            OutlinedButton.icon(
              onPressed: () => _saveWorksheetCounts(items),
              icon: const Icon(Icons.save, size: 16),
              label: const Text('Save Counts'),
            ),
          if (_canEdit) const SizedBox(width: 8),
          if (_canEdit)
            ElevatedButton.icon(
              onPressed: () => _submitStockTake(detail),
              icon: const Icon(Icons.send, size: 16),
              label: const Text('Submit to Auditor'),
              style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.kPrimary,
                  foregroundColor: Colors.white),
            ),
        ]),
        const SizedBox(height: 18),
        Row(children: [
          Expanded(
              child: _S(
                  label: 'Worksheet Items',
                  value: '${items.length}',
                  icon: PhosphorIcons.package(),
                  color: AppColors.kPrimary)),
          const SizedBox(width: 12),
          Expanded(
              child: _S(
                  label: 'Counted',
                  value: '$counted',
                  icon: PhosphorIcons.checkCircle(),
                  color: Colors.green)),
          const SizedBox(width: 12),
          Expanded(
              child: _S(
                  label: 'Variances',
                  value: '$variances',
                  icon: PhosphorIcons.warning(),
                  color: Colors.orange)),
          const SizedBox(width: 12),
          Expanded(
              child: _S(
                  label: 'Variance Value',
                  value: _bsMoney(varianceValue),
                  icon: PhosphorIcons.coins(),
                  color: varianceValue == 0 ? Colors.green : Colors.red)),
        ]),
        const SizedBox(height: 18),
        _worksheetInputCard(detail, items, counted),
        if (_bsText(detail, ['notes'], '').isNotEmpty) ...[
          const SizedBox(height: 14),
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(
                    color: AppColors.kDivider.withValues(alpha: .7))),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Auditor / Review Notes',
                        style: TextStyle(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    Text(_bsText(detail, ['notes'], '')),
                  ]),
            ),
          ),
        ],
      ]),
    );
  }

  Widget _worksheetInputCard(
    Map<String, dynamic> detail,
    List<Map<String, dynamic>> items,
    int counted,
  ) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: AppColors.kDivider.withValues(alpha: .7))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
          child: Row(children: [
            Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Stock Worksheet - ${_bsText(detail, [
                            'count_number',
                            'take_number',
                            'id'
                          ])}',
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 15),
                    ),
                    const SizedBox(height: 3),
                    const Text(
                      'Enter counts directly in the sheet and save all rows once.',
                      style: TextStyle(
                          color: AppColors.kTextSecondary, fontSize: 12),
                    ),
                  ]),
            ),
            Text('$counted / ${items.length} counted',
                style: const TextStyle(
                    color: AppColors.kTextSecondary,
                    fontWeight: FontWeight.w700)),
            if (_canEdit) ...[
              const SizedBox(width: 12),
              ElevatedButton.icon(
                onPressed: () => _saveWorksheetCounts(items),
                icon: const Icon(Icons.save, size: 16),
                label: const Text('Save Counts'),
              ),
            ],
          ]),
        ),
        const Divider(height: 1),
        if (items.isEmpty)
          const Padding(
              padding: EdgeInsets.all(24),
              child: Center(
                  child: Text('No worksheet items found',
                      style: TextStyle(color: AppColors.kTextSecondary))))
        else
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SizedBox(
              width: 1180,
              child: Column(children: [
                _worksheetHeaderRow(),
                ...items.map((item) => _worksheetInputRow(item)),
              ]),
            ),
          ),
      ]),
    );
  }

  Widget _worksheetHeaderRow() {
    const style = TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w800,
        color: AppColors.kTextSecondary);
    return Container(
      height: 38,
      color: AppColors.kSurface,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: const Row(children: [
        SizedBox(width: 330, child: Text('ITEM', style: style)),
        SizedBox(width: 180, child: Text('SKU', style: style)),
        SizedBox(
            width: 100,
            child: Text('SYSTEM', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 140, child: Text('ACTUAL COUNT', style: style)),
        SizedBox(
            width: 100,
            child: Text('VARIANCE', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 270, child: Text('VARIANCE NOTES', style: style)),
      ]),
    );
  }

  Widget _worksheetInputRow(Map<String, dynamic> item) {
    final system = _bsNum(item, ['system_closing_stock', 'system_quantity']);
    final actual = _actualIncludingDraft(item);
    final variance = _varianceIncludingDraft(item);
    final needsReason = actual != null && variance != 0;
    final rowColor = actual == null
        ? Colors.transparent
        : variance == 0
            ? Colors.green.withValues(alpha: .035)
            : Colors.orange.withValues(alpha: .055);
    return Container(
      constraints: const BoxConstraints(minHeight: 56),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
      decoration: BoxDecoration(
        color: rowColor,
        border: Border(
          top: BorderSide(color: AppColors.kDivider.withValues(alpha: .7)),
        ),
      ),
      child: Row(children: [
        SizedBox(
          width: 330,
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(_bsText(item, ['item_name', 'name', 'item_sku']),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 2),
            Text(
              _bsText(item, ['category', 'store_type'], ''),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  color: AppColors.kTextSecondary, fontSize: 11),
            ),
          ]),
        ),
        SizedBox(
          width: 180,
          child: Text(_bsText(item, ['item_sku', 'sku']),
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12)),
        ),
        SizedBox(
          width: 100,
          child: Text(_bsPlain(system),
              textAlign: TextAlign.right,
              style: const TextStyle(fontWeight: FontWeight.w800)),
        ),
        SizedBox(
          width: 140,
          child: _BranchInlineStockInput(
            key: ValueKey('${_bsId(item)}-branch-count'),
            initialValue: _actual(item) == null ? '' : _bsPlain(_actual(item)!),
            enabled: _canEdit,
            hintText: 'Count',
            keyboardType: TextInputType.number,
            onChanged: (value) => setState(() {
              item['_draft_counted_quantity'] = value;
            }),
          ),
        ),
        SizedBox(
          width: 100,
          child: Text(
            actual == null ? '—' : _bsPlain(variance),
            textAlign: TextAlign.right,
            style: TextStyle(
              fontWeight: FontWeight.w900,
              color: actual == null
                  ? AppColors.kTextSecondary
                  : variance == 0
                      ? Colors.green
                      : Colors.deepOrange,
            ),
          ),
        ),
        SizedBox(
          width: 270,
          child: _BranchInlineStockInput(
            key: ValueKey('${_bsId(item)}-branch-note'),
            initialValue: _reasonIncludingDraft(item),
            enabled: _canEdit,
            hintText: needsReason ? 'Required for variance' : 'Optional',
            onChanged: (value) {
              item['_draft_variance_reason'] = value;
            },
          ),
        ),
      ]),
    );
  }

  double? _actual(Map<String, dynamic> item) {
    final value = item['counted_quantity'] ??
        item['physical_quantity'] ??
        item['actual_quantity'];
    if (value == null) return null;
    if (value is num) return value.toDouble();
    return double.tryParse('$value');
  }

  double? _actualIncludingDraft(Map<String, dynamic> item) {
    final draft = item['_draft_counted_quantity'];
    if (draft != null && '$draft'.trim().isNotEmpty) {
      return double.tryParse('$draft');
    }
    return _actual(item);
  }

  double _varianceIncludingDraft(Map<String, dynamic> item) {
    final actual = _actualIncludingDraft(item);
    if (actual == null) return 0;
    return actual - _bsNum(item, ['system_closing_stock', 'system_quantity']);
  }

  String _reasonIncludingDraft(Map<String, dynamic> item) {
    final draft = '${item['_draft_variance_reason'] ?? ''}'.trim();
    if (draft.isNotEmpty) return draft;
    return _bsText(item, ['variance_reason', 'reason', 'notes'], '');
  }

  Future<void> _saveWorksheetCounts(List<Map<String, dynamic>> items) async {
    final payload = <Map<String, dynamic>>[];
    for (final item in items) {
      final actual = _actualIncludingDraft(item);
      if (actual == null) continue;
      final variance =
          actual - _bsNum(item, ['system_closing_stock', 'system_quantity']);
      final reason = _reasonIncludingDraft(item);
      if (variance != 0 && reason.trim().isEmpty) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
                content: Text('Variance reason required for ${_bsText(item, [
                  'item_name',
                  'item_sku'
                ])}')));
        return;
      }
      payload.add({
        'id': _bsId(item),
        'item_sku': _bsText(item, ['item_sku', 'sku'], ''),
        'counted_quantity': actual,
        if (reason.trim().isNotEmpty) 'variance_reason': reason.trim(),
        if (reason.trim().isNotEmpty) 'notes': reason.trim(),
      });
    }
    if (payload.isEmpty) {
      AppNotifier.showSnackBar(
          context, const SnackBar(content: Text('Enter at least one count')));
      return;
    }
    try {
      await ref
          .read(adminRepositoryProvider)
          .updateBranchStockTake(_selectedId!, payload);
      await _openStockTake(_selectedId!);
      if (mounted) {
        AppNotifier.showSnackBar(
            context, const SnackBar(content: Text('Worksheet counts saved')));
      }
    } catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text('Save failed: $error')));
      }
    }
  }

  Future<void> _startStockTake() async {
    String storeType = 'foodstuffs';
    String outletCode = 'main_bar';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Start Branch Stock Take'),
          content: SizedBox(
            width: 420,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              DropdownButtonFormField<String>(
                initialValue: storeType,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Stock area'),
                items: const [
                  DropdownMenuItem(
                      value: 'foodstuffs', child: Text('Foodstuffs')),
                  DropdownMenuItem(
                      value: 'bar_store', child: Text('Bar Store')),
                  DropdownMenuItem(
                      value: 'store_items', child: Text('All Store Items')),
                ],
                onChanged: (value) =>
                    setDialogState(() => storeType = value ?? storeType),
              ),
              if (storeType == 'bar_store') ...[
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: outletCode,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Outlet'),
                  items: const [
                    DropdownMenuItem(
                        value: 'main_bar', child: Text('Main Bar')),
                    DropdownMenuItem(
                        value: 'sports_bar', child: Text('Sports Bar')),
                    DropdownMenuItem(
                        value: 'executive_bar', child: Text('Executive Bar')),
                  ],
                  onChanged: (value) =>
                      setDialogState(() => outletCode = value ?? outletCode),
                ),
              ],
            ]),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel')),
            ElevatedButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Start Worksheet')),
          ],
        ),
      ),
    );
    if (confirmed != true) return;
    try {
      final session =
          await ref.read(adminRepositoryProvider).createBranchStockTake(
                storeType: storeType,
                outletCode: storeType == 'bar_store' ? outletCode : null,
              );
      _refresh();
      await _openStockTake(_bsId(session));
      if (mounted) {
        AppNotifier.showSnackBar(
            context, const SnackBar(content: Text('Stock worksheet started')));
      }
    } catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text('Failed: $error')));
      }
    }
  }

  Future<void> _openStockTake(String id) async {
    if (id.isEmpty) return;
    setState(() {
      _selectedId = id;
      _loadingDetail = true;
    });
    try {
      final detail =
          await ref.read(adminRepositoryProvider).getBranchStockTake(id);
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _loadingDetail = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _loadingDetail = false);
      AppNotifier.showSnackBar(
          context, SnackBar(content: Text('Failed to load: $error')));
    }
  }

  Future<void> _downloadWorksheet(Map<String, dynamic> row) async {
    try {
      final file = await ref
          .read(adminRepositoryProvider)
          .downloadBranchStockTakeWorksheet(_bsId(row));
      if (mounted) {
        AppNotifier.showSnackBar(context,
            SnackBar(content: Text('Worksheet saved to ${file.path}')));
      }
    } catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text('Download failed: $error')));
      }
    }
  }

  Future<void> _submitStockTake(Map<String, dynamic> detail) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Submit Stock Take'),
        content: const Text(
            'Submit this completed worksheet to auditor for verification and notes?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Submit')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(adminRepositoryProvider).submitBranchStockTake(
          _bsId(detail),
          notes: 'Submitted from Flutter app');
      await _openStockTake(_bsId(detail));
      _refresh();
      if (mounted) {
        AppNotifier.showSnackBar(context,
            const SnackBar(content: Text('Stock take submitted to auditor')));
      }
    } catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text('Submit failed: $error')));
      }
    }
  }
}

class BranchPurchaseOrdersSection extends StatelessWidget {
  const BranchPurchaseOrdersSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Purchase Orders', PhosphorIcons.fileText(),
            subtitle: 'Branch-level purchase orders to central store'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Open POs',
                            value: '—',
                            icon: PhosphorIcons.clock(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Fulfilled',
                            value: '—',
                            icon: PhosphorIcons.checkCircle(),
                            color: Colors.green)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'This Month',
                            value: '—',
                            icon: PhosphorIcons.calendar(),
                            color: AppColors.kPrimary)),
                  ]),
                  const SizedBox(height: 20),
                  Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Purchase Orders',
                            style: TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 14)),
                        ElevatedButton.icon(
                          onPressed: () {
                            final supplierCtrl = TextEditingController();
                            final itemsCtrl = TextEditingController();
                            showDialog(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: const Text('New Purchase Order'),
                                content: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      TextField(
                                          controller: supplierCtrl,
                                          decoration: const InputDecoration(
                                              labelText: 'Supplier')),
                                      const SizedBox(height: 12),
                                      TextField(
                                          controller: itemsCtrl,
                                          decoration: const InputDecoration(
                                              labelText:
                                                  'Items (comma-separated)'),
                                          maxLines: 2),
                                    ]),
                                actions: [
                                  TextButton(
                                      onPressed: () => Navigator.pop(ctx),
                                      child: const Text('Cancel')),
                                  ElevatedButton(
                                      onPressed: () {
                                        Navigator.pop(ctx);
                                        AppNotifier.showSnackBar(
                                            context,
                                            const SnackBar(
                                                content: Text(
                                                    'Purchase order created')));
                                      },
                                      child: const Text('Create')),
                                ],
                              ),
                            );
                          },
                          icon: Icon(PhosphorIcons.plus(), size: 14),
                          label: const Text('New PO'),
                          style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.kPrimary,
                              foregroundColor: Colors.white,
                              minimumSize: const Size(0, 36)),
                        ),
                      ]),
                  const SizedBox(height: 12),
                  _t('Purchase Orders'),
                ]))),
      ]);
}

class StoreRequisitionsSection extends StatelessWidget {
  const StoreRequisitionsSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Store Requisitions', PhosphorIcons.shoppingCart(),
            subtitle: 'Request stock from central store'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Pending',
                            value: '—',
                            icon: PhosphorIcons.clock(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Approved',
                            value: '—',
                            icon: PhosphorIcons.checkCircle(),
                            color: Colors.green)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Fulfilled',
                            value: '—',
                            icon: PhosphorIcons.package(),
                            color: AppColors.kPrimary)),
                  ]),
                  const SizedBox(height: 20),
                  Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Requisitions',
                            style: TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 14)),
                        ElevatedButton.icon(
                          onPressed: () {
                            final itemCtrl = TextEditingController();
                            final qtyCtrl = TextEditingController();
                            showDialog(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: const Text('New Stock Requisition'),
                                content: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      TextField(
                                          controller: itemCtrl,
                                          decoration: const InputDecoration(
                                              labelText: 'Item Name')),
                                      const SizedBox(height: 12),
                                      TextField(
                                          controller: qtyCtrl,
                                          keyboardType: TextInputType.number,
                                          decoration: const InputDecoration(
                                              labelText: 'Quantity')),
                                    ]),
                                actions: [
                                  TextButton(
                                      onPressed: () => Navigator.pop(ctx),
                                      child: const Text('Cancel')),
                                  ElevatedButton(
                                      onPressed: () {
                                        Navigator.pop(ctx);
                                        AppNotifier.showSnackBar(
                                            context,
                                            const SnackBar(
                                                content: Text(
                                                    'Requisition submitted')));
                                      },
                                      child: const Text('Submit')),
                                ],
                              ),
                            );
                          },
                          icon: Icon(PhosphorIcons.plus(), size: 14),
                          label: const Text('New Request'),
                          style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.kPrimary,
                              foregroundColor: Colors.white,
                              minimumSize: const Size(0, 36)),
                        ),
                      ]),
                  const SizedBox(height: 12),
                  _t('Requisition History'),
                ]))),
      ]);
}

class KitchenUsageSection extends StatelessWidget {
  const KitchenUsageSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Kitchen Usage', PhosphorIcons.cookingPot(),
            subtitle: 'Track ingredients and supplies consumed by kitchen'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Items Used Today',
                            value: '—',
                            icon: PhosphorIcons.cookingPot(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Cost Today',
                            value: '—',
                            icon: PhosphorIcons.currencyDollar(),
                            color: Colors.blue)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'vs Yesterday',
                            value: '—',
                            icon: PhosphorIcons.arrowsLeftRight(),
                            color: Colors.green)),
                  ]),
                  const SizedBox(height: 20),
                  _t('Usage Log'),
                ]))),
      ]);
}

class StockOutSection extends StatelessWidget {
  const StockOutSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Stock Out', PhosphorIcons.arrowUpRight(),
            subtitle: 'Stock issuance and outgoing stock records'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Issued Today',
                            value: '—',
                            icon: PhosphorIcons.arrowUpRight(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Total This Week',
                            value: '—',
                            icon: PhosphorIcons.trendUp(),
                            color: Colors.blue)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Pending Approval',
                            value: '—',
                            icon: PhosphorIcons.clock(),
                            color: Colors.orange)),
                  ]),
                  const SizedBox(height: 20),
                  Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Stock Out Log',
                            style: TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 14)),
                        ElevatedButton.icon(
                          onPressed: () {
                            final itemCtrl = TextEditingController();
                            final qtyCtrl = TextEditingController();
                            final toCtrl = TextEditingController();
                            showDialog(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: const Text('Issue Stock'),
                                content: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      TextField(
                                          controller: itemCtrl,
                                          decoration: const InputDecoration(
                                              labelText: 'Item Name')),
                                      const SizedBox(height: 12),
                                      TextField(
                                          controller: qtyCtrl,
                                          keyboardType: TextInputType.number,
                                          decoration: const InputDecoration(
                                              labelText: 'Quantity')),
                                      const SizedBox(height: 12),
                                      TextField(
                                          controller: toCtrl,
                                          decoration: const InputDecoration(
                                              labelText:
                                                  'Issued To (Dept/Person)')),
                                    ]),
                                actions: [
                                  TextButton(
                                      onPressed: () => Navigator.pop(ctx),
                                      child: const Text('Cancel')),
                                  ElevatedButton(
                                      onPressed: () {
                                        Navigator.pop(ctx);
                                        AppNotifier.showSnackBar(
                                            context,
                                            const SnackBar(
                                                content: Text('Stock issued')));
                                      },
                                      child: const Text('Issue')),
                                ],
                              ),
                            );
                          },
                          icon: Icon(PhosphorIcons.plus(), size: 14),
                          label: const Text('Issue Stock'),
                          style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.kPrimary,
                              foregroundColor: Colors.white,
                              minimumSize: const Size(0, 36)),
                        ),
                      ]),
                  const SizedBox(height: 12),
                  _t('Issuance Records'),
                ]))),
      ]);
}

// ═══════════════════════════════════════════════════════════════════
// KITCHEN OPS
// ═══════════════════════════════════════════════════════════════════

class KitchenOpsOverviewSection extends StatelessWidget {
  const KitchenOpsOverviewSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Kitchen Ops Overview', PhosphorIcons.chefHat(),
            subtitle: 'Kitchen operations, stock and production management'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Active Orders',
                            value: '—',
                            icon: PhosphorIcons.clipboardText(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Items in Stock',
                            value: '—',
                            icon: PhosphorIcons.package(),
                            color: Colors.green)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Wastage Today',
                            value: '—',
                            icon: PhosphorIcons.trash(),
                            color: Colors.red)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Low Stock Items',
                            value: '—',
                            icon: PhosphorIcons.warning(),
                            color: Colors.orange)),
                  ]),
                  const SizedBox(height: 20),
                  _t('Active Kitchen Orders'),
                ]))),
      ]);
}

class StockLedgerSection extends StatelessWidget {
  const StockLedgerSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Stock Ledger', PhosphorIcons.bookOpen(),
            subtitle: 'Complete kitchen ingredient and stock ledger'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Total Items',
                            value: '—',
                            icon: PhosphorIcons.package(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Below Reorder',
                            value: '—',
                            icon: PhosphorIcons.warning(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Stock Value',
                            value: '—',
                            icon: PhosphorIcons.currencyDollar(),
                            color: Colors.green)),
                  ]),
                  const SizedBox(height: 20),
                  _t('Stock Ledger'),
                ]))),
      ]);
}

class RequestStockSection extends StatelessWidget {
  const RequestStockSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Request Stock', PhosphorIcons.shoppingCart(),
            subtitle: 'Request ingredients and supplies from branch store'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: ElevatedButton.icon(
                      onPressed: () {
                        final itemCtrl = TextEditingController();
                        final qtyCtrl = TextEditingController();
                        showDialog(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: const Text('Kitchen Stock Requisition'),
                            content: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  TextField(
                                      controller: itemCtrl,
                                      decoration: const InputDecoration(
                                          labelText: 'Ingredient/Item')),
                                  const SizedBox(height: 12),
                                  TextField(
                                      controller: qtyCtrl,
                                      keyboardType: TextInputType.number,
                                      decoration: const InputDecoration(
                                          labelText: 'Quantity')),
                                ]),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.pop(ctx),
                                  child: const Text('Cancel')),
                              ElevatedButton(
                                  onPressed: () {
                                    Navigator.pop(ctx);
                                    AppNotifier.showSnackBar(
                                        context,
                                        const SnackBar(
                                            content: Text(
                                                'Requisition submitted to store')));
                                  },
                                  child: const Text('Submit')),
                            ],
                          ),
                        );
                      },
                      icon: Icon(PhosphorIcons.plus(), size: 14),
                      label: const Text('New Requisition'),
                      style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.kPrimary,
                          foregroundColor: Colors.white,
                          minimumSize: const Size(0, 36)),
                    )),
                  ]),
                  const SizedBox(height: 20),
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Pending',
                            value: '—',
                            icon: PhosphorIcons.clock(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Approved',
                            value: '—',
                            icon: PhosphorIcons.checkCircle(),
                            color: Colors.green)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Delivered',
                            value: '—',
                            icon: PhosphorIcons.package(),
                            color: AppColors.kPrimary)),
                  ]),
                  const SizedBox(height: 20),
                  _t('Requisition History'),
                ]))),
      ]);
}

class RecipesBOMSection extends StatelessWidget {
  const RecipesBOMSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Recipes & BOM', PhosphorIcons.chefHat(),
            subtitle: 'Recipe management and bill of materials for costing'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(children: [
                          _S(
                              label: 'Recipes',
                              value: '—',
                              icon: PhosphorIcons.chefHat(),
                              color: AppColors.kPrimary),
                        ]),
                        ElevatedButton.icon(
                          onPressed: () {
                            final nameCtrl = TextEditingController();
                            final categoryCtrl = TextEditingController();
                            showDialog(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: const Text('Add Recipe'),
                                content: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      TextField(
                                          controller: nameCtrl,
                                          decoration: const InputDecoration(
                                              labelText: 'Recipe Name')),
                                      const SizedBox(height: 12),
                                      TextField(
                                          controller: categoryCtrl,
                                          decoration: const InputDecoration(
                                              labelText:
                                                  'Category (e.g. Main, Starter)')),
                                    ]),
                                actions: [
                                  TextButton(
                                      onPressed: () => Navigator.pop(ctx),
                                      child: const Text('Cancel')),
                                  ElevatedButton(
                                      onPressed: () {
                                        Navigator.pop(ctx);
                                        AppNotifier.showSnackBar(
                                            context,
                                            SnackBar(
                                                content: Text(
                                                    'Recipe "${nameCtrl.text}" added')));
                                      },
                                      child: const Text('Add')),
                                ],
                              ),
                            );
                          },
                          icon: Icon(PhosphorIcons.plus(), size: 14),
                          label: const Text('Add Recipe'),
                          style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.kPrimary,
                              foregroundColor: Colors.white,
                              minimumSize: const Size(0, 36)),
                        ),
                      ]),
                  const SizedBox(height: 20),
                  _t('Recipes'),
                ]))),
      ]);
}

class UsageTrackingSection extends StatelessWidget {
  const UsageTrackingSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Usage Tracking', PhosphorIcons.clipboardText(),
            subtitle: 'Track ingredient consumption per order and shift'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Tracked Today',
                            value: '—',
                            icon: PhosphorIcons.clipboardText(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Cost of Goods',
                            value: '—',
                            icon: PhosphorIcons.currencyDollar(),
                            color: Colors.blue)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Variance',
                            value: '—',
                            icon: PhosphorIcons.warning(),
                            color: Colors.orange)),
                  ]),
                  const SizedBox(height: 20),
                  _t('Usage Log'),
                ]))),
      ]);
}

class RecordWastageSection extends StatelessWidget {
  const RecordWastageSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Record Wastage', PhosphorIcons.trash(),
            subtitle: 'Log and track kitchen food wastage'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: ElevatedButton.icon(
                      onPressed: () {
                        final itemCtrl = TextEditingController();
                        final qtyCtrl = TextEditingController();
                        final reasonCtrl = TextEditingController();
                        showDialog(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: const Text('Record Wastage'),
                            content: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  TextField(
                                      controller: itemCtrl,
                                      decoration: const InputDecoration(
                                          labelText: 'Item')),
                                  const SizedBox(height: 12),
                                  TextField(
                                      controller: qtyCtrl,
                                      keyboardType: TextInputType.number,
                                      decoration: const InputDecoration(
                                          labelText: 'Quantity Wasted')),
                                  const SizedBox(height: 12),
                                  TextField(
                                      controller: reasonCtrl,
                                      decoration: const InputDecoration(
                                          labelText: 'Reason'),
                                      maxLines: 2),
                                ]),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.pop(ctx),
                                  child: const Text('Cancel')),
                              ElevatedButton(
                                  style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.red),
                                  onPressed: () {
                                    Navigator.pop(ctx);
                                    AppNotifier.showSnackBar(
                                        context,
                                        const SnackBar(
                                            content: Text('Wastage recorded')));
                                  },
                                  child: const Text('Record')),
                            ],
                          ),
                        );
                      },
                      icon: Icon(PhosphorIcons.plus(), size: 14),
                      label: const Text('Record Wastage'),
                      style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.red,
                          foregroundColor: Colors.white,
                          minimumSize: const Size(0, 36)),
                    )),
                  ]),
                  const SizedBox(height: 20),
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Today\'s Wastage',
                            value: '—',
                            icon: PhosphorIcons.trash(),
                            color: Colors.red)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'This Week',
                            value: '—',
                            icon: PhosphorIcons.calendar(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Cost Lost',
                            value: '—',
                            icon: PhosphorIcons.currencyDollar(),
                            color: Colors.grey)),
                  ]),
                  const SizedBox(height: 20),
                  _t('Wastage Records'),
                ]))),
      ]);
}
