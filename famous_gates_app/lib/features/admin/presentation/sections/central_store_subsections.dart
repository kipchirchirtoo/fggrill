import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/api_error_message.dart';
import '../../../../services/report_service.dart';
import '../../data/admin_repository.dart';
import '../../domain/admin_providers.dart';

String _text(Map<String, dynamic> row, List<String> keys,
    [String fallback = '—']) {
  for (final key in keys) {
    final value = row[key];
    if (value != null && '$value'.trim().isNotEmpty && '$value' != 'null') {
      return '$value';
    }
  }
  return fallback;
}

double _num(Map<String, dynamic> row, List<String> keys) {
  for (final key in keys) {
    final value = row[key];
    if (value is num) return value.toDouble();
    final parsed = double.tryParse('$value');
    if (parsed != null) return parsed;
  }
  return 0;
}

String _date(dynamic value) {
  final parsed = DateTime.tryParse('$value');
  if (parsed == null) return '—';
  return '${parsed.day.toString().padLeft(2, '0')}/${parsed.month.toString().padLeft(2, '0')}/${parsed.year}';
}

String _money(num value) => 'KES ${value.toStringAsFixed(0)}';

Widget _header(String title, IconData icon, {String? subtitle}) {
  return Container(
    padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
    decoration: const BoxDecoration(
      color: Colors.white,
      border: Border(bottom: BorderSide(color: AppColors.kDivider)),
    ),
    child: Row(children: [
      Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: AppColors.kPrimary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: AppColors.kPrimary, size: 20),
      ),
      const SizedBox(width: 14),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
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
      ),
    ]),
  );
}

class _StatCard extends StatelessWidget {
  const _StatCard({
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
  Widget build(BuildContext context) => Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, color: color, size: 18),
            const SizedBox(height: 8),
            Text(value,
                style:
                    const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            Text(label,
                style: const TextStyle(
                    fontSize: 11, color: AppColors.kTextSecondary)),
          ]),
        ),
      );
}

class _LiveSection extends StatelessWidget {
  const _LiveSection({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.child,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) => Column(children: [
        _header(title, icon, subtitle: subtitle),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: child,
          ),
        ),
      ]);
}

class _RowsCard extends StatelessWidget {
  const _RowsCard({
    required this.title,
    required this.rows,
    required this.emptyMessage,
    required this.builder,
    this.trailing,
  });

  final String title;
  final List<Map<String, dynamic>> rows;
  final String emptyMessage;
  final Widget Function(Map<String, dynamic> row) builder;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
        ),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(children: [
              Expanded(
                child: Text(title,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 14)),
              ),
              if (trailing != null) trailing!,
            ]),
          ),
          const Divider(height: 1),
          if (rows.isEmpty)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Center(
                child: Text(emptyMessage,
                    style: const TextStyle(color: AppColors.kTextSecondary)),
              ),
            )
          else
            ...rows.map(builder),
        ]),
      );
}

class _LiveRows extends StatelessWidget {
  const _LiveRows({
    required this.value,
    required this.data,
  });

  final AsyncValue<List<Map<String, dynamic>>> value;
  final Widget Function(List<Map<String, dynamic>> rows) data;

  @override
  Widget build(BuildContext context) => value.when(
        loading: () => const Center(
          child: Padding(
            padding: EdgeInsets.all(40),
            child: CircularProgressIndicator(),
          ),
        ),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('Failed to load: ${apiErrorMessage(error)}',
                style: const TextStyle(color: Colors.red)),
          ),
        ),
        data: data,
      );
}

Widget _rowTile({
  required IconData icon,
  required String title,
  required String subtitle,
  String? meta,
  Widget? trailing,
}) {
  return ListTile(
    leading: CircleAvatar(
      backgroundColor: AppColors.kPrimary.withValues(alpha: 0.08),
      child: Icon(icon, color: AppColors.kPrimary, size: 18),
    ),
    title: Text(title,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
    subtitle: Text(subtitle,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontSize: 12)),
    trailing: trailing == null
        ? Text(meta ?? '',
            textAlign: TextAlign.right,
            style: const TextStyle(
                fontSize: 11,
                color: AppColors.kTextSecondary,
                fontWeight: FontWeight.w600))
        : ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 360),
            child: Align(
              alignment: Alignment.centerRight,
              widthFactor: 1,
              child: trailing,
            ),
          ),
  );
}

String _id(Map<String, dynamic> row) => _text(row, ['id', 'sku'], '');

Color _statusColor(String status) {
  final normalized = status.toLowerCase();
  if (normalized.contains('approved') ||
      normalized.contains('delivered') ||
      normalized.contains('active') ||
      normalized.contains('available') ||
      normalized.contains('paid')) {
    return Colors.green;
  }
  if (normalized.contains('reject') ||
      normalized.contains('cancel') ||
      normalized.contains('out_of_service')) {
    return Colors.red;
  }
  if (normalized.contains('transit') ||
      normalized.contains('dispatch') ||
      normalized.contains('submitted')) {
    return AppColors.kPrimary;
  }
  return Colors.orange;
}

void _refreshCentralStore(WidgetRef ref) {
  ref
    ..invalidate(centralStoreDashboardProvider)
    ..invalidate(centralStoreValuationProvider)
    ..invalidate(centralStoreItemsProvider)
    ..invalidate(centralFoodstuffsProvider)
    ..invalidate(centralBarItemsProvider)
    ..invalidate(centralStationeryProvider)
    ..invalidate(centralStoreRequestsProvider)
    ..invalidate(centralStoreDispatchesProvider)
    ..invalidate(centralPurchaseOrdersProvider)
    ..invalidate(centralGrnsProvider)
    ..invalidate(centralStockTakesProvider)
    ..invalidate(centralSpoilageProvider)
    ..invalidate(centralSpoilageItemsProvider)
    ..invalidate(centralStoreSuppliersProvider)
    ..invalidate(centralStoreVehiclesProvider)
    ..invalidate(centralStoreDriversProvider)
    ..invalidate(centralSupplierInvoicesProvider)
    ..invalidate(centralSupplierPaymentsProvider)
    ..invalidate(centralVatReportProvider)
    ..invalidate(centralGrniReportProvider)
    ..invalidate(centralAgingReportProvider);
}

void _snack(BuildContext context, String message) {
  if (!context.mounted) return;
  AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
}

Future<bool> _confirm(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Confirm',
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel')),
        ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(confirmLabel)),
      ],
    ),
  );
  return result == true;
}

TextField _field(
  TextEditingController controller,
  String label, {
  int maxLines = 1,
  bool required = false,
  TextInputType? keyboardType,
}) {
  return TextField(
    controller: controller,
    keyboardType: keyboardType,
    maxLines: maxLines,
    decoration: InputDecoration(labelText: required ? '$label *' : label),
  );
}

Widget _statusChip(String status) {
  final color = _statusColor(status);
  return Chip(
    label: Text(status.toUpperCase(), style: const TextStyle(fontSize: 10)),
    backgroundColor: color.withValues(alpha: 0.1),
    labelStyle: TextStyle(color: color, fontWeight: FontWeight.w700),
  );
}

Future<void> _showMapDetails(
  BuildContext context,
  String title,
  Map<String, dynamic> row, {
  List<Widget> actions = const [],
}) async {
  await showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: SizedBox(
        width: 520,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: row.entries
                .where((entry) =>
                    entry.value != null && '${entry.value}'.isNotEmpty)
                .take(40)
                .map((entry) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 5),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 160,
                            child: Text(
                              entry.key.replaceAll('_', ' ').toUpperCase(),
                              style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.kTextSecondary),
                            ),
                          ),
                          Expanded(child: Text('${entry.value}')),
                        ],
                      ),
                    ))
                .toList(),
          ),
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
        ...actions,
      ],
    ),
  );
}

class GoodsReceivingSection extends ConsumerStatefulWidget {
  const GoodsReceivingSection({super.key});

  @override
  ConsumerState<GoodsReceivingSection> createState() =>
      _GoodsReceivingSectionState();
}

class _GoodsReceivingSectionState extends ConsumerState<GoodsReceivingSection> {
  final _barcodeCtrl = TextEditingController();
  final _manualSearchCtrl = TextEditingController();
  final _invoiceCtrl = TextEditingController();
  final _deliveryNoteCtrl = TextEditingController();
  final _scannerFocus = FocusNode();

  String? _supplierId;
  bool _scannerMode = true;
  bool _isSubmitting = false;
  List<Map<String, dynamic>> _manualResults = [];
  final List<Map<String, dynamic>> _scanned = [];

  @override
  void dispose() {
    _barcodeCtrl.dispose();
    _manualSearchCtrl.dispose();
    _invoiceCtrl.dispose();
    _deliveryNoteCtrl.dispose();
    _scannerFocus.dispose();
    super.dispose();
  }

  Future<void> _scanBarcode() async {
    final code = _barcodeCtrl.text.trim();
    if (code.isEmpty) return;
    final repo = ref.read(adminRepositoryProvider);
    final items = await repo.getStoreItems(search: code, limit: 20);
    final needle = code.toLowerCase();
    final item = items.cast<Map<String, dynamic>?>().firstWhere(
      (candidate) {
        if (candidate == null) return false;
        return _text(candidate, ['barcode'], '').toLowerCase() == needle ||
            _text(candidate, ['sku'], '').toLowerCase() == needle;
      },
      orElse: () => null,
    );

    if (item == null) {
      if (!mounted) return;
      await _showCreateItemDialog(code);
    } else {
      _addItem(item, viaScan: true);
    }
    _barcodeCtrl.clear();
    _scannerFocus.requestFocus();
  }

  Future<void> _searchManual() async {
    final query = _manualSearchCtrl.text.trim();
    if (query.isEmpty) return;
    final rows = await ref.read(adminRepositoryProvider).getStoreItems(
          search: query,
          limit: 25,
        );
    if (mounted) setState(() => _manualResults = rows);
  }

  void _addItem(Map<String, dynamic> item, {required bool viaScan}) {
    final sku = _text(item, ['sku', 'item_id', 'id'], '');
    if (sku.isEmpty) return;
    setState(() {
      final index = _scanned.indexWhere((row) => row['item_id'] == sku);
      if (index >= 0) {
        _scanned[index]['quantity_received'] =
            (_scanned[index]['quantity_received'] as num) + 1;
      } else {
        _scanned.add({
          'item_id': sku,
          'item_name': _text(item, ['item_name', 'name', 'description']),
          'sku': sku,
          'unit_of_measure': _text(item, ['unit_of_measure', 'unit'], 'units'),
          'quantity_received': 1,
          'unit_price':
              _num(item, ['cost_price', 'unit_price', 'retail_price']),
          'barcode': _text(item, ['barcode'], ''),
          'added_via': viaScan ? 'scan' : 'manual',
        });
      }
    });
  }

  Future<void> _showCreateItemDialog(String barcode) async {
    final nameCtrl = TextEditingController();
    final categoryCtrl = TextEditingController(text: 'food');
    final unitCtrl = TextEditingController(text: 'units');
    final costCtrl = TextEditingController(text: '0');
    final created = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Unknown barcode $barcode'),
        content: SizedBox(
          width: 420,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(labelText: 'Item Name'),
              autofocus: true,
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                child: TextField(
                  controller: categoryCtrl,
                  decoration: const InputDecoration(labelText: 'Category'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: unitCtrl,
                  decoration: const InputDecoration(labelText: 'Unit'),
                ),
              ),
            ]),
            const SizedBox(height: 12),
            TextField(
              controller: costCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Cost Price'),
            ),
          ]),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (nameCtrl.text.trim().isEmpty) return;
              final repo = ref.read(adminRepositoryProvider);
              final item = await repo.createStoreItem({
                'item_name': nameCtrl.text.trim(),
                'description': nameCtrl.text.trim(),
                'category': categoryCtrl.text.trim().isEmpty
                    ? 'other'
                    : categoryCtrl.text.trim(),
                'unit_of_measure': unitCtrl.text.trim().isEmpty
                    ? 'units'
                    : unitCtrl.text.trim(),
                'cost_price': double.tryParse(costCtrl.text.trim()) ?? 0,
                'retail_price': double.tryParse(costCtrl.text.trim()) ?? 0,
                'reorder_level': 10,
                'barcode': barcode,
                'quantity': 0,
              });
              if (ctx.mounted) Navigator.pop(ctx, item);
            },
            child: const Text('Create SKU & Add'),
          ),
        ],
      ),
    );

    nameCtrl.dispose();
    categoryCtrl.dispose();
    unitCtrl.dispose();
    costCtrl.dispose();

    if (created != null) {
      _addItem(created, viaScan: false);
    }
  }

  Future<void> _submitGrn() async {
    if (_supplierId == null || _supplierId!.isEmpty) {
      AppNotifier.showSnackBar(
        context,
        const SnackBar(content: Text('Select a supplier first')),
      );
      return;
    }
    if (_scanned.isEmpty) {
      AppNotifier.showSnackBar(
        context,
        const SnackBar(content: Text('Scan or add at least one item')),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      await ref.read(adminRepositoryProvider).createGRN({
        'supplier_id': _supplierId,
        'grn_date': DateTime.now().toIso8601String().split('T').first,
        'delivery_note_number': _deliveryNoteCtrl.text.trim(),
        'invoice_number': _invoiceCtrl.text.trim(),
        'items': _scanned
            .map((item) => {
                  'item_id': item['item_id'],
                  'quantity_received': item['quantity_received'],
                  'quantity_accepted': item['quantity_received'],
                  'quantity_ordered': 0,
                  'unit_price': item['unit_price'],
                  'unit_of_measure': item['unit_of_measure'],
                  'quality_status': 'accepted',
                })
            .toList(),
      });
      ref
        ..invalidate(centralGrnsProvider)
        ..invalidate(centralStoreItemsProvider)
        ..invalidate(centralFoodstuffsProvider)
        ..invalidate(centralBarItemsProvider);
      setState(() {
        _scanned.clear();
        _invoiceCtrl.clear();
        _deliveryNoteCtrl.clear();
      });
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          const SnackBar(content: Text('Goods received and stock updated')),
        );
      }
    } catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text('Failed: $error')));
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final suppliersAsync = ref.watch(centralStoreSuppliersProvider);
    return _LiveSection(
      title: 'Goods Receiving',
      subtitle: 'Scan deliveries, create missing SKUs, and post GRNs',
      icon: PhosphorIcons.packageArrowUp(),
      child: suppliersAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) =>
            Text('Failed to load suppliers: ${apiErrorMessage(error)}'),
        data: (suppliers) => Column(children: [
          Row(children: [
            Expanded(
              flex: 2,
              child: DropdownButtonFormField<String>(
                initialValue: _supplierId,
                decoration: const InputDecoration(labelText: 'Supplier'),
                items: suppliers
                    .map((supplier) => DropdownMenuItem(
                          value: _text(supplier, ['id']),
                          child: Text(_text(supplier, ['name'])),
                        ))
                    .toList(),
                onChanged: (value) => setState(() => _supplierId = value),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TextField(
                controller: _invoiceCtrl,
                decoration: const InputDecoration(labelText: 'Invoice #'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TextField(
                controller: _deliveryNoteCtrl,
                decoration: const InputDecoration(labelText: 'Delivery Note'),
              ),
            ),
          ]),
          const SizedBox(height: 20),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(
                      color: AppColors.kDivider.withValues(alpha: 0.5)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        SegmentedButton<bool>(
                          segments: const [
                            ButtonSegment(
                                value: true,
                                label: Text('Scanner'),
                                icon: Icon(Icons.qr_code_scanner)),
                            ButtonSegment(
                                value: false,
                                label: Text('Manual'),
                                icon: Icon(Icons.search)),
                          ],
                          selected: {_scannerMode},
                          onSelectionChanged: (s) =>
                              setState(() => _scannerMode = s.first),
                        ),
                        const SizedBox(height: 16),
                        if (_scannerMode)
                          TextField(
                            controller: _barcodeCtrl,
                            focusNode: _scannerFocus,
                            autofocus: true,
                            textInputAction: TextInputAction.done,
                            onSubmitted: (_) => _scanBarcode(),
                            decoration: InputDecoration(
                              labelText: 'Scan barcode or enter SKU',
                              suffixIcon: IconButton(
                                onPressed: _scanBarcode,
                                icon: const Icon(Icons.add),
                              ),
                            ),
                          )
                        else ...[
                          TextField(
                            controller: _manualSearchCtrl,
                            textInputAction: TextInputAction.search,
                            onSubmitted: (_) => _searchManual(),
                            decoration: InputDecoration(
                              labelText: 'Search item name or SKU',
                              suffixIcon: IconButton(
                                onPressed: _searchManual,
                                icon: const Icon(Icons.search),
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          ..._manualResults.take(8).map((item) => ListTile(
                                dense: true,
                                title: Text(_text(item, ['item_name', 'name'])),
                                subtitle:
                                    Text(_text(item, ['sku', 'barcode'], '')),
                                trailing: IconButton(
                                  icon: const Icon(Icons.add),
                                  onPressed: () =>
                                      _addItem(item, viaScan: false),
                                ),
                              )),
                        ],
                      ]),
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: _RowsCard(
                title: 'Receiving Session',
                rows: _scanned,
                emptyMessage: 'No items scanned yet',
                trailing: ElevatedButton.icon(
                  onPressed: _isSubmitting ? null : _submitGrn,
                  icon: _isSubmitting
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.save, size: 14),
                  label: const Text('Post GRN'),
                ),
                builder: (row) => _rowTile(
                  icon: row['added_via'] == 'scan'
                      ? Icons.qr_code_scanner
                      : PhosphorIcons.package(),
                  title: _text(row, ['item_name']),
                  subtitle: '${_text(row, ['sku'])} • ${_text(row, [
                        'unit_of_measure'
                      ])}',
                  meta:
                      'Qty ${(row['quantity_received'] as num).toStringAsFixed(0)}',
                ),
              ),
            ),
          ]),
        ]),
      ),
    );
  }
}

class FoodstuffsSection extends ConsumerWidget {
  const FoodstuffsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final itemsAsync = ref.watch(centralFoodstuffsProvider);
    return _InventoryListSection(
      title: 'Foodstuffs',
      subtitle: 'Central food items, dry goods, packaging and consumables',
      icon: PhosphorIcons.cookingPot(),
      itemsAsync: itemsAsync,
      emptyMessage: 'No foodstuffs found',
      storeType: 'foodstuffs',
    );
  }
}

class BarBeveragesStoreSection extends ConsumerWidget {
  const BarBeveragesStoreSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _InventoryListSection(
      title: 'Bar & Beverages',
      subtitle: 'Bar items, spirits, wines and beverage stock',
      icon: PhosphorIcons.wine(),
      itemsAsync: ref.watch(centralBarItemsProvider),
      emptyMessage: 'No bar items found',
      storeType: 'bar_store',
    );
  }
}

class StationeryItemsSection extends ConsumerWidget {
  const StationeryItemsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _InventoryListSection(
      title: 'Stationery Items',
      subtitle: 'Office and operational stationery stock',
      icon: PhosphorIcons.pencil(),
      itemsAsync: ref.watch(centralStationeryProvider),
      emptyMessage: 'No stationery items found',
      defaultCategory: 'office_supplies',
    );
  }
}

class CentralMasterInventorySection extends ConsumerWidget {
  const CentralMasterInventorySection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _InventoryListSection(
      title: 'Master Inventory',
      subtitle:
          'Central master catalog, SKU classification, valuation and stock controls',
      icon: PhosphorIcons.package(),
      itemsAsync: ref.watch(centralStoreItemsProvider),
      emptyMessage: 'No master inventory items found',
      valuationAsync: ref.watch(centralStoreValuationProvider),
    );
  }
}

class _InventoryListSection extends ConsumerWidget {
  const _InventoryListSection({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.itemsAsync,
    required this.emptyMessage,
    this.storeType,
    this.defaultCategory,
    this.valuationAsync,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final AsyncValue<List<Map<String, dynamic>>> itemsAsync;
  final String emptyMessage;
  final String? storeType;
  final String? defaultCategory;
  final AsyncValue<Map<String, dynamic>>? valuationAsync;

  @override
  Widget build(BuildContext context, WidgetRef ref) => _LiveSection(
        title: title,
        subtitle: subtitle,
        icon: icon,
        child: _LiveRows(
          value: itemsAsync,
          data: (items) {
            final low = items
                .where((item) =>
                    _num(item, ['quantity']) <=
                    _num(item, ['reorder_level', 'min_stock']))
                .length;
            final totalValue = items.fold<double>(
              0,
              (sum, item) =>
                  sum +
                  (_num(item, ['quantity']) *
                      _num(item, ['cost_price', 'unit_price'])),
            );
            final valuation = valuationAsync?.valueOrNull ?? const {};
            final foodValue = _num(valuation, [
              'foodstuffs_value',
              'foodstuffsStoreValue',
              'foodstuffs_store_value'
            ]);
            final barValue = _num(
                valuation, ['bar_store_value', 'barStoreValue', 'bar_value']);
            final grandValue = _num(valuation,
                ['grand_total', 'grandTotal', 'total_value', 'totalValue']);
            return Column(children: [
              Row(children: [
                Expanded(
                    child: _StatCard(
                        label: 'Total Items',
                        value: '${items.length}',
                        icon: PhosphorIcons.package(),
                        color: AppColors.kPrimary)),
                const SizedBox(width: 12),
                Expanded(
                    child: _StatCard(
                        label: 'Low Stock',
                        value: '$low',
                        icon: PhosphorIcons.warning(),
                        color: Colors.orange)),
                const SizedBox(width: 12),
                Expanded(
                    child: _StatCard(
                        label: 'Stock Value',
                        value: _money(totalValue),
                        icon: PhosphorIcons.currencyDollar(),
                        color: Colors.green)),
              ]),
              if (valuationAsync != null) ...[
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(
                      child: _StatCard(
                          label: 'Foodstuffs Store',
                          value: _money(foodValue),
                          icon: PhosphorIcons.cookingPot(),
                          color: Colors.teal)),
                  const SizedBox(width: 12),
                  Expanded(
                      child: _StatCard(
                          label: 'Bar Store',
                          value: _money(barValue),
                          icon: PhosphorIcons.wine(),
                          color: Colors.indigo)),
                  const SizedBox(width: 12),
                  Expanded(
                      child: _StatCard(
                          label: 'Grand Valuation',
                          value:
                              _money(grandValue == 0 ? totalValue : grandValue),
                          icon: PhosphorIcons.currencyDollar(),
                          color: AppColors.kAccent)),
                ]),
              ],
              const SizedBox(height: 20),
              _RowsCard(
                title: title,
                rows: items.take(100).toList(),
                emptyMessage: emptyMessage,
                trailing: Wrap(
                  spacing: 8,
                  children: [
                    OutlinedButton.icon(
                      onPressed: () => _exportPdf(context, items),
                      icon: const Icon(Icons.picture_as_pdf, size: 14),
                      label: const Text('PDF / Print'),
                    ),
                    ElevatedButton.icon(
                      onPressed: () => _showItemDialog(context, ref),
                      icon: const Icon(Icons.add, size: 14),
                      label: const Text('Add Item'),
                    ),
                  ],
                ),
                builder: (item) => _rowTile(
                  icon: PhosphorIcons.package(),
                  title: _text(item, ['item_name', 'name', 'description']),
                  subtitle: '${_text(item, ['sku'])} • ${_text(item, [
                        'category'
                      ])} • ${_text(item, ['unit_of_measure', 'unit'])}',
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '${_num(item, [
                              'quantity'
                            ]).toStringAsFixed(0)} in stock',
                        textAlign: TextAlign.right,
                        style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.kTextSecondary,
                            fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        tooltip: 'Edit',
                        icon: const Icon(Icons.edit_outlined, size: 18),
                        onPressed: () =>
                            _showItemDialog(context, ref, item: item),
                      ),
                      IconButton(
                        tooltip: 'Delete',
                        icon: const Icon(Icons.delete_outline, size: 18),
                        color: Colors.red,
                        onPressed: () => _deleteItem(context, ref, item),
                      ),
                    ],
                  ),
                ),
              ),
            ]);
          },
        ),
      );

  Future<void> _showItemDialog(
    BuildContext context,
    WidgetRef ref, {
    Map<String, dynamic>? item,
  }) async {
    final isEdit = item != null;
    final nameCtrl = TextEditingController(
      text: isEdit ? _text(item, ['item_name', 'name', 'description'], '') : '',
    );
    final skuCtrl = TextEditingController(
      text: isEdit ? _text(item, ['sku'], '') : '',
    );
    final categoryCtrl = TextEditingController(
      text: isEdit
          ? _text(item, ['category'], '')
          : (defaultCategory ??
              (storeType == 'bar_store' ? 'beverage' : 'food')),
    );
    final unitCtrl = TextEditingController(
      text:
          isEdit ? _text(item, ['unit_of_measure', 'unit'], 'units') : 'units',
    );
    final qtyCtrl = TextEditingController(
      text: isEdit ? _num(item, ['quantity']).toStringAsFixed(0) : '0',
    );
    final costCtrl = TextEditingController(
      text: isEdit
          ? _num(item, ['cost_price', 'retail_price']).toStringAsFixed(0)
          : '0',
    );
    final reorderCtrl = TextEditingController(
      text: isEdit ? _num(item, ['reorder_level']).toStringAsFixed(0) : '0',
    );

    final body = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isEdit ? 'Edit Item' : 'Add Item'),
        content: SizedBox(
          width: 460,
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Item Name *'),
                autofocus: true,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: skuCtrl,
                enabled: !isEdit,
                decoration: const InputDecoration(
                  labelText: 'SKU',
                  helperText: 'Leave blank to auto-generate',
                ),
              ),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                  child: TextField(
                    controller: categoryCtrl,
                    decoration: const InputDecoration(labelText: 'Category'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: unitCtrl,
                    decoration: const InputDecoration(labelText: 'Unit'),
                  ),
                ),
              ]),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                  child: TextField(
                    controller: qtyCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Quantity'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: reorderCtrl,
                    keyboardType: TextInputType.number,
                    decoration:
                        const InputDecoration(labelText: 'Reorder Level'),
                  ),
                ),
              ]),
              const SizedBox(height: 12),
              TextField(
                controller: costCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Cost Price'),
              ),
            ]),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              if (nameCtrl.text.trim().isEmpty) return;
              Navigator.pop(ctx, {
                'item_name': nameCtrl.text.trim(),
                'description': nameCtrl.text.trim(),
                if (skuCtrl.text.trim().isNotEmpty) 'sku': skuCtrl.text.trim(),
                'category': categoryCtrl.text.trim().isEmpty
                    ? 'other'
                    : categoryCtrl.text.trim(),
                'unit_of_measure': unitCtrl.text.trim().isEmpty
                    ? 'units'
                    : unitCtrl.text.trim(),
                'quantity': double.tryParse(qtyCtrl.text.trim()) ?? 0,
                'cost_price': double.tryParse(costCtrl.text.trim()) ?? 0,
                'retail_price': double.tryParse(costCtrl.text.trim()) ?? 0,
                'reorder_level': double.tryParse(reorderCtrl.text.trim()) ?? 0,
                if (storeType != null) 'store_type': storeType,
              });
            },
            child: Text(isEdit ? 'Update' : 'Create'),
          ),
        ],
      ),
    );

    for (final controller in [
      nameCtrl,
      skuCtrl,
      categoryCtrl,
      unitCtrl,
      qtyCtrl,
      costCtrl,
      reorderCtrl
    ]) {
      controller.dispose();
    }

    if (body == null) return;
    try {
      final repo = ref.read(adminRepositoryProvider);
      if (isEdit) {
        await repo.updateStoreItem(_text(item, ['sku', 'id']), body);
      } else {
        await repo.createStoreItem(body);
      }
      _refresh(ref);
      if (context.mounted) {
        AppNotifier.showSnackBar(
          context,
          SnackBar(content: Text(isEdit ? 'Item updated' : 'Item created')),
        );
      }
    } catch (error) {
      if (context.mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text('Failed: $error')));
      }
    }
  }

  Future<void> _deleteItem(
    BuildContext context,
    WidgetRef ref,
    Map<String, dynamic> item,
  ) async {
    final sku = _text(item, ['sku', 'id'], '');
    if (sku.isEmpty) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Item'),
        content: Text(
            'Remove ${_text(item, ['item_name', 'name', 'description'])}?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(adminRepositoryProvider).deleteStoreItem(sku);
      _refresh(ref);
      if (context.mounted) {
        AppNotifier.showSnackBar(
            context, const SnackBar(content: Text('Item deleted')));
      }
    } catch (error) {
      if (context.mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text('Failed: $error')));
      }
    }
  }

  Future<void> _exportPdf(
    BuildContext context,
    List<Map<String, dynamic>> items,
  ) async {
    try {
      await ReportService().generateAndPrint(
        title: title,
        subtitle: subtitle,
        sections: [
          ReportSection(
            title: 'Inventory',
            tableHeaders: const [
              'SKU',
              'Item',
              'Category',
              'Unit',
              'Qty',
              'Cost'
            ],
            tableRows: items
                .map((item) => [
                      _text(item, ['sku']),
                      _text(item, ['item_name', 'name', 'description']),
                      _text(item, ['category']),
                      _text(item, ['unit_of_measure', 'unit']),
                      _num(item, ['quantity']).toStringAsFixed(0),
                      _money(_num(item, ['cost_price', 'retail_price'])),
                    ])
                .toList(),
          ),
        ],
      );
    } catch (error) {
      if (context.mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text('PDF failed: $error')));
      }
    }
  }

  void _refresh(WidgetRef ref) {
    ref
      ..invalidate(centralStoreItemsProvider)
      ..invalidate(centralFoodstuffsProvider)
      ..invalidate(centralBarItemsProvider)
      ..invalidate(centralStationeryProvider)
      ..invalidate(centralStoreDashboardProvider);
  }
}

class RequisitionsSection extends ConsumerWidget {
  const RequisitionsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => _LiveSection(
        title: 'Requisitions',
        subtitle: 'Branch stock requests awaiting review and fulfillment',
        icon: PhosphorIcons.clipboardText(),
        child: _LiveRows(
          value: ref.watch(centralStoreRequestsProvider),
          data: (rows) {
            final pending = rows
                .where(
                    (row) => _text(row, ['status']).toUpperCase() == 'PENDING')
                .length;
            final approved = rows
                .where((row) =>
                    _text(row, ['status']).toUpperCase().contains('APPROVED'))
                .length;
            return Column(children: [
              Row(children: [
                Expanded(
                    child: _StatCard(
                        label: 'Pending Review',
                        value: '$pending',
                        icon: PhosphorIcons.clock(),
                        color: Colors.orange)),
                const SizedBox(width: 12),
                Expanded(
                    child: _StatCard(
                        label: 'Approved',
                        value: '$approved',
                        icon: PhosphorIcons.checkCircle(),
                        color: Colors.green)),
                const SizedBox(width: 12),
                Expanded(
                    child: _StatCard(
                        label: 'Total Monitored',
                        value: '${rows.length}',
                        icon: PhosphorIcons.clipboardText(),
                        color: AppColors.kPrimary)),
              ]),
              const SizedBox(height: 20),
              _RowsCard(
                title: 'Branch Requisitions',
                rows: rows,
                emptyMessage: 'No requisitions found',
                builder: (row) {
                  final status = _text(row, ['status'], 'PENDING');
                  return _rowTile(
                    icon: PhosphorIcons.clipboardText(),
                    title: _text(row, ['request_number', 'id']),
                    subtitle: '${_text(row, [
                          'requesting_branch_name',
                          'branch_name',
                          'branch'
                        ])} • ${_text(row, [
                          'priority'
                        ], 'normal')} • ${_date(row['created_at'])}',
                    trailing: Wrap(spacing: 6, children: [
                      _statusChip(status),
                      OutlinedButton(
                        onPressed: () =>
                            _showRequisitionDetails(context, ref, row),
                        child: const Text('View'),
                      ),
                      if (status.toUpperCase() == 'PENDING') ...[
                        TextButton(
                          onPressed: () =>
                              _review(context, ref, row, 'REJECTED'),
                          child: const Text('Reject'),
                        ),
                        ElevatedButton(
                          onPressed: () =>
                              _review(context, ref, row, 'APPROVED'),
                          child: const Text('Approve'),
                        ),
                      ],
                    ]),
                  );
                },
              ),
            ]);
          },
        ),
      );

  Future<void> _showRequisitionDetails(
      BuildContext context, WidgetRef ref, Map<String, dynamic> row) {
    return _showMapDetails(
      context,
      'Requisition ${_text(row, ['request_number', 'id'])}',
      row,
      actions: [
        if (_text(row, ['status']).toUpperCase() == 'PENDING')
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              _review(context, ref, row, 'APPROVED');
            },
            child: const Text('Approve Request'),
          ),
      ],
    );
  }

  Future<void> _review(BuildContext context, WidgetRef ref,
      Map<String, dynamic> row, String status) async {
    final notesCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title:
            Text(status == 'APPROVED' ? 'Approve Request' : 'Reject Request'),
        content: SizedBox(
          width: 420,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text('Request ${_text(row, ['request_number', 'id'])}'),
            const SizedBox(height: 12),
            _field(notesCtrl, status == 'APPROVED' ? 'Review Notes' : 'Reason',
                maxLines: 3),
          ]),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(status == 'APPROVED' ? 'Approve' : 'Reject')),
        ],
      ),
    );
    if (confirmed != true) {
      notesCtrl.dispose();
      return;
    }
    try {
      await ref.read(adminRepositoryProvider).reviewStoreStockRequest(
        _id(row),
        {
          'status': status,
          'review_notes': notesCtrl.text.trim(),
          'notes': notesCtrl.text.trim(),
        },
      );
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, 'Request ${status.toLowerCase()}');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    } finally {
      notesCtrl.dispose();
    }
  }
}

class PackingSection extends ConsumerWidget {
  const PackingSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => _LiveSection(
        title: 'Packing',
        subtitle: 'Approved branch requests ready to pack into dispatch notes',
        icon: PhosphorIcons.package(),
        child: _LiveRows(
          value: ref.watch(centralStoreRequestsProvider),
          data: (rows) {
            final approved = rows
                .where((row) => ['APPROVED', 'PARTIALLY_APPROVED']
                    .contains(_text(row, ['status']).toUpperCase()))
                .toList();
            return _RowsCard(
              title: 'Packing Queue',
              rows: approved,
              emptyMessage: 'No approved requests ready for packing',
              builder: (row) => _rowTile(
                icon: PhosphorIcons.package(),
                title: _text(row, ['request_number', 'id']),
                subtitle: '${_text(row, [
                      'requesting_branch_name',
                      'branch_name'
                    ])} • ${_date(row['created_at'])}',
                trailing: Wrap(spacing: 6, children: [
                  OutlinedButton(
                    onPressed: () => _showMapDetails(
                        context,
                        'Packing Checklist ${_text(row, [
                              'request_number',
                              'id'
                            ])}',
                        row),
                    child: const Text('View'),
                  ),
                  ElevatedButton(
                    onPressed: () => _createDispatch(context, ref, row),
                    child: const Text('Mark Ready'),
                  ),
                ]),
              ),
            );
          },
        ),
      );

  Future<void> _createDispatch(
      BuildContext context, WidgetRef ref, Map<String, dynamic> row) async {
    final confirmed = await _confirm(
      context,
      title: 'Create Dispatch Note',
      message: 'Mark ${_text(row, [
            'request_number',
            'id'
          ])} as packed and ready for dispatch?',
      confirmLabel: 'Mark Ready',
    );
    if (!confirmed) return;
    try {
      await ref.read(adminRepositoryProvider).createStoreDispatchNote({
        'request_id': _id(row),
        'to_branch_id': row['requesting_branch_id'] ?? row['branch_id'],
        'notes': 'Packed from Flutter central store',
        'items': row['items'] ?? row['request_items'] ?? [],
      });
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, 'Dispatch note created');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }
}

class DispatchNotesSection extends ConsumerWidget {
  const DispatchNotesSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => _LiveSection(
        title: 'Dispatch & Notes',
        subtitle: 'Dispatch records and delivery notes sent to branches',
        icon: PhosphorIcons.truck(),
        child: _LiveRows(
          value: ref.watch(centralStoreDispatchesProvider),
          data: (rows) => _RowsCard(
            title: 'Dispatch Notes',
            rows: rows,
            emptyMessage: 'No dispatch notes found',
            trailing: OutlinedButton.icon(
              onPressed: () => _refreshCentralStore(ref),
              icon: const Icon(Icons.refresh, size: 14),
              label: const Text('Refresh'),
            ),
            builder: (row) {
              final status = _text(row, ['status'], 'READY');
              final ready = status.toUpperCase() == 'READY' ||
                  status.toUpperCase() == 'PENDING';
              return _rowTile(
                icon: PhosphorIcons.truck(),
                title: _text(
                    row, ['dispatch_number', 'dispatch_note_number', 'id']),
                subtitle: '${_text(row, [
                      'to_branch_name',
                      'branch_name'
                    ])} • ${_text(row, ['driver_name'], 'No driver')}',
                trailing: Wrap(spacing: 6, children: [
                  _statusChip(status),
                  OutlinedButton(
                    onPressed: () => _showMapDetails(
                        context,
                        'Dispatch ${_text(row, ['dispatch_number', 'id'])}',
                        row),
                    child: const Text('View'),
                  ),
                  if (ready)
                    ElevatedButton(
                      onPressed: () => _assignLogistics(context, ref, row),
                      child: const Text('Proceed'),
                    ),
                ]),
              );
            },
          ),
        ),
      );

  Future<void> _assignLogistics(
      BuildContext context, WidgetRef ref, Map<String, dynamic> row) async {
    final vehicles = await ref.read(adminRepositoryProvider).getStoreVehicles();
    final drivers = await ref.read(adminRepositoryProvider).getStoreDrivers();
    if (!context.mounted) return;
    String? vehicleId = vehicles.isNotEmpty ? _id(vehicles.first) : null;
    String? driverId = drivers.isNotEmpty ? _id(drivers.first) : null;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('Logistic Assignment'),
          content: SizedBox(
            width: 460,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              DropdownButtonFormField<String>(
                initialValue: vehicleId,
                decoration: const InputDecoration(labelText: 'Vehicle'),
                items: vehicles
                    .map((vehicle) => DropdownMenuItem(
                          value: _id(vehicle),
                          child: Text(_text(vehicle,
                              ['registration_number', 'vehicle_number'])),
                        ))
                    .toList(),
                onChanged: (value) => setState(() => vehicleId = value),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: driverId,
                decoration: const InputDecoration(labelText: 'Driver'),
                items: drivers
                    .map((driver) => DropdownMenuItem(
                          value: _id(driver),
                          child: Text(_text(driver, ['name', 'full_name'])),
                        ))
                    .toList(),
                onChanged: (value) => setState(() => driverId = value),
              ),
            ]),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel')),
            ElevatedButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Confirm Dispatch')),
          ],
        ),
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(adminRepositoryProvider).dispatchStoreItems(_id(row), {
        if (vehicleId != null) 'vehicle_id': vehicleId,
        if (driverId != null) 'driver_id': driverId,
      });
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, 'Dispatch moved to transit');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }
}

class PurchaseOrdersSection extends ConsumerWidget {
  const PurchaseOrdersSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => _LiveSection(
        title: 'Purchase Orders',
        subtitle: 'Central-store supplier purchase orders',
        icon: PhosphorIcons.fileText(),
        child: _LiveRows(
          value: ref.watch(centralPurchaseOrdersProvider),
          data: (rows) {
            final pending = rows
                .where((row) =>
                    _text(row, ['status']).toLowerCase().contains('pending'))
                .length;
            return Column(children: [
              Row(children: [
                Expanded(
                    child: _StatCard(
                        label: 'Open POs',
                        value: '${rows.length}',
                        icon: PhosphorIcons.fileText(),
                        color: AppColors.kPrimary)),
                const SizedBox(width: 12),
                Expanded(
                    child: _StatCard(
                        label: 'Pending Approval',
                        value: '$pending',
                        icon: PhosphorIcons.clock(),
                        color: Colors.orange)),
                const SizedBox(width: 12),
                Expanded(
                    child: _StatCard(
                        label: 'Total Value',
                        value: _money(rows.fold<double>(
                            0,
                            (sum, row) =>
                                sum + _num(row, ['total_amount', 'total']))),
                        icon: PhosphorIcons.currencyDollar(),
                        color: Colors.green)),
              ]),
              const SizedBox(height: 20),
              _RowsCard(
                title: 'Purchase Orders',
                rows: rows,
                emptyMessage: 'No purchase orders found',
                builder: (row) {
                  final status = _text(row, ['status'], 'draft');
                  return _rowTile(
                    icon: PhosphorIcons.fileText(),
                    title: _text(row, ['po_number', 'id']),
                    subtitle: '${_text(row, [
                          'supplier_name'
                        ])} • ${_date(row['created_at'] ?? row['order_date'])}',
                    trailing: Wrap(spacing: 6, children: [
                      _statusChip(status),
                      OutlinedButton(
                          onPressed: () => _showMapDetails(context,
                              'PO ${_text(row, ['po_number', 'id'])}', row),
                          child: const Text('View')),
                      if (status.toLowerCase().contains('pending') ||
                          status.toLowerCase() == 'draft')
                        ElevatedButton(
                            onPressed: () =>
                                _poAction(context, ref, row, 'approve'),
                            child: const Text('Approve')),
                      if (!status.toLowerCase().contains('cancel'))
                        TextButton(
                            onPressed: () =>
                                _poAction(context, ref, row, 'cancel'),
                            child: const Text('Reject')),
                      if (status.toLowerCase().contains('approved'))
                        OutlinedButton(
                            onPressed: () =>
                                _poAction(context, ref, row, 'send'),
                            child: const Text('Send')),
                    ]),
                  );
                },
              ),
            ]);
          },
        ),
      );

  Future<void> _poAction(BuildContext context, WidgetRef ref,
      Map<String, dynamic> row, String action) async {
    final confirmed = await _confirm(
      context,
      title: '${action[0].toUpperCase()}${action.substring(1)} PO',
      message: '${action[0].toUpperCase()}${action.substring(1)} ${_text(row, [
            'po_number',
            'id'
          ])}?',
      confirmLabel: action == 'cancel' ? 'Reject' : 'Confirm',
    );
    if (!confirmed) return;
    try {
      final repo = ref.read(adminRepositoryProvider);
      if (action == 'approve') await repo.approvePurchaseOrder(_id(row));
      if (action == 'cancel') await repo.cancelPurchaseOrder(_id(row));
      if (action == 'send') await repo.sendPurchaseOrder(_id(row));
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, 'PO updated');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }
}

class GoodsReceiptGRNSection extends ConsumerWidget {
  const GoodsReceiptGRNSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => _LiveSection(
        title: 'Goods Receipt (GRN)',
        subtitle: 'Posted goods-received notes and supplier receipts',
        icon: PhosphorIcons.clipboardText(),
        child: _LiveRows(
          value: ref.watch(centralGrnsProvider),
          data: (rows) => _RowsCard(
            title: 'GRN Register',
            rows: rows,
            emptyMessage: 'No GRNs found',
            trailing: ElevatedButton.icon(
              onPressed: () => ref.read(adminSectionProvider.notifier).state =
                  AdminSection.goodsReceiving,
              icon: const Icon(Icons.add, size: 14),
              label: const Text('Record Receipt'),
            ),
            builder: (row) {
              final status = _text(row, ['status'], 'pending_review');
              return _rowTile(
                icon: PhosphorIcons.clipboardText(),
                title: _text(row, ['grn_number', 'id']),
                subtitle: '${_text(row, ['supplier_name'])} • ${_text(row, [
                      'po_number'
                    ], 'Direct Receipt')}',
                trailing: Wrap(spacing: 6, children: [
                  _statusChip(status),
                  OutlinedButton(
                      onPressed: () => _showMapDetails(context,
                          'GRN ${_text(row, ['grn_number', 'id'])}', row),
                      child: const Text('View')),
                  if (!status.toLowerCase().contains('approved'))
                    ElevatedButton(
                        onPressed: () => _approveGrn(context, ref, row),
                        child: const Text('Approve')),
                ]),
              );
            },
          ),
        ),
      );

  Future<void> _approveGrn(
      BuildContext context, WidgetRef ref, Map<String, dynamic> row) async {
    final confirmed = await _confirm(
      context,
      title: 'Approve GRN',
      message: 'Approve ${_text(row, ['grn_number', 'id'])} and update stock?',
      confirmLabel: 'Approve',
    );
    if (!confirmed) return;
    try {
      await ref.read(adminRepositoryProvider).approveGRN(_id(row));
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, 'GRN approved');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }
}

class CentralSuppliersSection extends ConsumerWidget {
  const CentralSuppliersSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => _LiveSection(
        title: 'Suppliers',
        subtitle: 'Central-store supplier master data',
        icon: PhosphorIcons.buildings(),
        child: _LiveRows(
          value: ref.watch(centralStoreSuppliersProvider),
          data: (rows) => _RowsCard(
            title: 'Suppliers',
            rows: rows,
            emptyMessage: 'No suppliers found',
            trailing: ElevatedButton.icon(
              onPressed: () => _showSupplierDialog(context, ref),
              icon: const Icon(Icons.add, size: 14),
              label: const Text('Add Supplier'),
            ),
            builder: (row) => _rowTile(
              icon: PhosphorIcons.buildings(),
              title: _text(row, ['name', 'supplier_name']),
              subtitle:
                  '${_text(row, ['supplier_code', 'code'], 'No code')} • ${_text(row, [
                        'phone',
                        'phone_number'
                      ], 'No phone')} • ${_text(row, ['email'], 'No email')}',
              trailing: Wrap(spacing: 6, children: [
                _statusChip(_text(row, ['status'], 'active')),
                OutlinedButton(
                    onPressed: () => _showMapDetails(
                        context, _text(row, ['name', 'supplier_name']), row),
                    child: const Text('View')),
                IconButton(
                  tooltip: 'Receive Goods',
                  onPressed: () => ref
                      .read(adminSectionProvider.notifier)
                      .state = AdminSection.goodsReceiving,
                  icon: const Icon(Icons.inventory_2_outlined),
                ),
                IconButton(
                  tooltip: 'Edit',
                  onPressed: () => _showSupplierDialog(context, ref, row: row),
                  icon: const Icon(Icons.edit_outlined),
                ),
                IconButton(
                  tooltip: 'Delete',
                  color: Colors.red,
                  onPressed: () => _deleteSupplier(context, ref, row),
                  icon: const Icon(Icons.delete_outline),
                ),
              ]),
            ),
          ),
        ),
      );

  Future<void> _showSupplierDialog(BuildContext context, WidgetRef ref,
      {Map<String, dynamic>? row}) async {
    final isEdit = row != null;
    final nameCtrl =
        TextEditingController(text: isEdit ? _text(row, ['name'], '') : '');
    final codeCtrl = TextEditingController(
        text: isEdit ? _text(row, ['supplier_code', 'code'], '') : '');
    final contactCtrl = TextEditingController(
        text: isEdit ? _text(row, ['contact_person'], '') : '');
    final phoneCtrl =
        TextEditingController(text: isEdit ? _text(row, ['phone'], '') : '');
    final emailCtrl =
        TextEditingController(text: isEdit ? _text(row, ['email'], '') : '');
    final pinCtrl = TextEditingController(
        text: isEdit ? _text(row, ['tax_id', 'kra_pin'], '') : '');
    final addressCtrl =
        TextEditingController(text: isEdit ? _text(row, ['address'], '') : '');
    final body = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isEdit ? 'Edit Supplier' : 'Add Supplier'),
        content: SizedBox(
          width: 520,
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              _field(nameCtrl, 'Supplier Name', required: true),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: _field(codeCtrl, 'Supplier Code')),
                const SizedBox(width: 12),
                Expanded(child: _field(contactCtrl, 'Contact Person')),
              ]),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: _field(phoneCtrl, 'Phone')),
                const SizedBox(width: 12),
                Expanded(child: _field(emailCtrl, 'Email')),
              ]),
              const SizedBox(height: 12),
              _field(pinCtrl, 'KRA PIN'),
              const SizedBox(height: 12),
              _field(addressCtrl, 'Address', maxLines: 2),
            ]),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
              onPressed: () {
                if (nameCtrl.text.trim().isEmpty) return;
                Navigator.pop(ctx, {
                  'name': nameCtrl.text.trim(),
                  if (codeCtrl.text.trim().isNotEmpty)
                    'supplier_code': codeCtrl.text.trim(),
                  'contact_person': contactCtrl.text.trim(),
                  'phone': phoneCtrl.text.trim(),
                  'email': emailCtrl.text.trim(),
                  'tax_id': pinCtrl.text.trim(),
                  'address': addressCtrl.text.trim(),
                  'status': 'active',
                });
              },
              child: Text(isEdit ? 'Save Changes' : 'Add Supplier')),
        ],
      ),
    );
    for (final controller in [
      nameCtrl,
      codeCtrl,
      contactCtrl,
      phoneCtrl,
      emailCtrl,
      pinCtrl,
      addressCtrl
    ]) {
      controller.dispose();
    }
    if (body == null) return;
    try {
      final repo = ref.read(adminRepositoryProvider);
      if (isEdit) {
        await repo.updateStoreSupplier(_id(row), body);
      } else {
        await repo.createStoreSupplier(body);
      }
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, isEdit ? 'Supplier updated' : 'Supplier created');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }

  Future<void> _deleteSupplier(
      BuildContext context, WidgetRef ref, Map<String, dynamic> row) async {
    final confirmed = await _confirm(
      context,
      title: 'Delete Supplier',
      message: 'Delete ${_text(row, ['name', 'supplier_name'])}?',
      confirmLabel: 'Delete',
    );
    if (!confirmed) return;
    try {
      await ref.read(adminRepositoryProvider).deleteStoreSupplier(_id(row));
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, 'Supplier deleted');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }
}

class CentralVehiclesSection extends ConsumerWidget {
  const CentralVehiclesSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => _LiveSection(
        title: 'Vehicles',
        subtitle: 'Central-store fleet vehicles available for dispatch',
        icon: PhosphorIcons.truck(),
        child: _LiveRows(
          value: ref.watch(centralStoreVehiclesProvider),
          data: (rows) => _RowsCard(
            title: 'Vehicles',
            rows: rows,
            emptyMessage: 'No vehicles found',
            trailing: ElevatedButton.icon(
              onPressed: () => _showVehicleDialog(context, ref),
              icon: const Icon(Icons.add, size: 14),
              label: const Text('Add Vehicle'),
            ),
            builder: (row) => _rowTile(
              icon: PhosphorIcons.truck(),
              title: _text(row, ['registration_number', 'vehicle_number']),
              subtitle: '${_text(row, [
                    'make'
                  ])} ${_text(row, ['model'], '')} • Capacity ${_text(row, [
                    'capacity_kg',
                    'capacity'
                  ], '—')}',
              trailing: Wrap(spacing: 6, children: [
                _statusChip(_text(row, ['status'], 'available')),
                IconButton(
                  tooltip: 'Edit',
                  onPressed: () => _showVehicleDialog(context, ref, row: row),
                  icon: const Icon(Icons.edit_outlined),
                ),
                IconButton(
                  tooltip: 'Delete',
                  color: Colors.red,
                  onPressed: () => _deleteVehicle(context, ref, row),
                  icon: const Icon(Icons.delete_outline),
                ),
              ]),
            ),
          ),
        ),
      );

  Future<void> _showVehicleDialog(BuildContext context, WidgetRef ref,
      {Map<String, dynamic>? row}) async {
    final isEdit = row != null;
    final regCtrl = TextEditingController(
        text: isEdit ? _text(row, ['registration_number'], '') : '');
    final makeCtrl =
        TextEditingController(text: isEdit ? _text(row, ['make'], '') : '');
    final modelCtrl =
        TextEditingController(text: isEdit ? _text(row, ['model'], '') : '');
    final capacityCtrl = TextEditingController(
        text: isEdit ? _text(row, ['capacity_kg', 'capacity'], '') : '');
    String status = isEdit ? _text(row, ['status'], 'available') : 'available';
    final body = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: Text(isEdit ? 'Edit Vehicle' : 'Add Vehicle'),
          content: SizedBox(
            width: 440,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              _field(regCtrl, 'Registration Number', required: true),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: _field(makeCtrl, 'Make')),
                const SizedBox(width: 12),
                Expanded(child: _field(modelCtrl, 'Model')),
              ]),
              const SizedBox(height: 12),
              _field(capacityCtrl, 'Capacity KG',
                  keyboardType: TextInputType.number),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: status,
                decoration: const InputDecoration(labelText: 'Status'),
                items: const [
                  DropdownMenuItem(
                      value: 'available', child: Text('Available')),
                  DropdownMenuItem(value: 'in_use', child: Text('In Use')),
                  DropdownMenuItem(
                      value: 'maintenance', child: Text('Maintenance')),
                  DropdownMenuItem(
                      value: 'out_of_service', child: Text('Out of Service')),
                ],
                onChanged: (value) => setState(() => status = value ?? status),
              ),
            ]),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
                onPressed: () {
                  if (regCtrl.text.trim().isEmpty) return;
                  Navigator.pop(ctx, {
                    'registration_number': regCtrl.text.trim(),
                    'make': makeCtrl.text.trim(),
                    'model': modelCtrl.text.trim(),
                    'capacity_kg':
                        double.tryParse(capacityCtrl.text.trim()) ?? 0,
                    'status': status,
                  });
                },
                child: Text(isEdit ? 'Save Changes' : 'Add Vehicle')),
          ],
        ),
      ),
    );
    for (final controller in [regCtrl, makeCtrl, modelCtrl, capacityCtrl]) {
      controller.dispose();
    }
    if (body == null) return;
    try {
      final repo = ref.read(adminRepositoryProvider);
      if (isEdit) {
        await repo.updateStoreVehicle(_id(row), body);
      } else {
        await repo.createStoreVehicle(body);
      }
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, isEdit ? 'Vehicle updated' : 'Vehicle created');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }

  Future<void> _deleteVehicle(
      BuildContext context, WidgetRef ref, Map<String, dynamic> row) async {
    final confirmed = await _confirm(
      context,
      title: 'Delete Vehicle',
      message: 'Delete ${_text(row, ['registration_number'])}?',
      confirmLabel: 'Delete',
    );
    if (!confirmed) return;
    try {
      await ref.read(adminRepositoryProvider).deleteStoreVehicle(_id(row));
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, 'Vehicle deleted');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }
}

class DriversSection extends ConsumerWidget {
  const DriversSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => _LiveSection(
        title: 'Drivers',
        subtitle: 'Fleet drivers and delivery assignments',
        icon: PhosphorIcons.users(),
        child: _LiveRows(
          value: ref.watch(centralStoreDriversProvider),
          data: (rows) => _RowsCard(
            title: 'Drivers',
            rows: rows,
            emptyMessage: 'No drivers found',
            trailing: ElevatedButton.icon(
              onPressed: () => _showDriverDialog(context, ref),
              icon: const Icon(Icons.add, size: 14),
              label: const Text('Register Driver'),
            ),
            builder: (row) => _rowTile(
              icon: PhosphorIcons.user(),
              title: _text(row, ['name', 'full_name', 'first_name']),
              subtitle: '${_text(row, [
                    'phone',
                    'phone_number'
                  ])} • ${_text(row, ['license_number'], 'No license')}',
              trailing: Wrap(spacing: 6, children: [
                _statusChip(_text(row, ['status'], 'available')),
                if (_text(row, ['source'], '') != 'staff')
                  IconButton(
                    tooltip: 'Edit',
                    onPressed: () => _showDriverDialog(context, ref, row: row),
                    icon: const Icon(Icons.edit_outlined),
                  ),
                if (_text(row, ['source'], '') != 'staff')
                  IconButton(
                    tooltip: 'Delete',
                    color: Colors.red,
                    onPressed: () => _deleteDriver(context, ref, row),
                    icon: const Icon(Icons.delete_outline),
                  ),
              ]),
            ),
          ),
        ),
      );

  Future<void> _showDriverDialog(BuildContext context, WidgetRef ref,
      {Map<String, dynamic>? row}) async {
    final isEdit = row != null;
    final nameCtrl = TextEditingController(
        text: isEdit ? _text(row, ['name', 'full_name'], '') : '');
    final phoneCtrl =
        TextEditingController(text: isEdit ? _text(row, ['phone'], '') : '');
    final licenseCtrl = TextEditingController(
        text: isEdit ? _text(row, ['license_number'], '') : '');
    final expiryCtrl = TextEditingController(
        text: isEdit ? _text(row, ['license_expiry'], '') : '');
    String status = isEdit ? _text(row, ['status'], 'available') : 'available';
    final body = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: Text(isEdit ? 'Edit Driver' : 'Register Driver'),
          content: SizedBox(
            width: 440,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              _field(nameCtrl, 'Full Name', required: true),
              const SizedBox(height: 12),
              _field(phoneCtrl, 'Phone', required: true),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: _field(licenseCtrl, 'License Number')),
                const SizedBox(width: 12),
                Expanded(child: _field(expiryCtrl, 'License Expiry')),
              ]),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: status,
                decoration: const InputDecoration(labelText: 'Status'),
                items: const [
                  DropdownMenuItem(
                      value: 'available', child: Text('Available')),
                  DropdownMenuItem(value: 'on_trip', child: Text('On Trip')),
                  DropdownMenuItem(value: 'inactive', child: Text('Inactive')),
                ],
                onChanged: (value) => setState(() => status = value ?? status),
              ),
            ]),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
                onPressed: () {
                  if (nameCtrl.text.trim().isEmpty ||
                      phoneCtrl.text.trim().isEmpty) {
                    return;
                  }
                  Navigator.pop(ctx, {
                    'name': nameCtrl.text.trim(),
                    'phone': phoneCtrl.text.trim(),
                    'license_number': licenseCtrl.text.trim(),
                    'license_expiry': expiryCtrl.text.trim(),
                    'status': status,
                  });
                },
                child: Text(isEdit ? 'Save Changes' : 'Register Driver')),
          ],
        ),
      ),
    );
    for (final controller in [nameCtrl, phoneCtrl, licenseCtrl, expiryCtrl]) {
      controller.dispose();
    }
    if (body == null) return;
    try {
      final repo = ref.read(adminRepositoryProvider);
      if (isEdit) {
        await repo.updateStoreDriver(_id(row), body);
      } else {
        await repo.createStoreDriver(body);
      }
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, isEdit ? 'Driver updated' : 'Driver registered');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }

  Future<void> _deleteDriver(
      BuildContext context, WidgetRef ref, Map<String, dynamic> row) async {
    final confirmed = await _confirm(
      context,
      title: 'Delete Driver',
      message: 'Delete ${_text(row, ['name', 'full_name'])}?',
      confirmLabel: 'Delete',
    );
    if (!confirmed) return;
    try {
      await ref.read(adminRepositoryProvider).deleteStoreDriver(_id(row));
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, 'Driver deleted');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }
}

class CentralStockTakesSection extends ConsumerWidget {
  const CentralStockTakesSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => _LiveSection(
        title: 'Central Store Stock Takes',
        subtitle:
            'Foodstuffs and bar-store stock counts, variances and exports',
        icon: PhosphorIcons.clipboardText(),
        child: _LiveRows(
          value: ref.watch(centralStockTakesProvider),
          data: (rows) {
            final open = rows
                .where((row) =>
                    _text(row, ['status']).toLowerCase().contains('progress'))
                .length;
            final submitted = rows
                .where((row) =>
                    _text(row, ['status']).toLowerCase().contains('submitted'))
                .length;
            return Column(children: [
              Row(children: [
                Expanded(
                    child: _StatCard(
                        label: 'Open Counts',
                        value: '$open',
                        icon: PhosphorIcons.clipboardText(),
                        color: AppColors.kPrimary)),
                const SizedBox(width: 12),
                Expanded(
                    child: _StatCard(
                        label: 'Pending Review',
                        value: '$submitted',
                        icon: PhosphorIcons.clock(),
                        color: Colors.orange)),
                const SizedBox(width: 12),
                Expanded(
                    child: _StatCard(
                        label: 'Sessions',
                        value: '${rows.length}',
                        icon: PhosphorIcons.package(),
                        color: Colors.green)),
              ]),
              const SizedBox(height: 20),
              _RowsCard(
                title: 'Stock Take Sessions',
                rows: rows,
                emptyMessage: 'No stock take sessions found',
                trailing: ElevatedButton.icon(
                  onPressed: () => _startStockTake(context, ref),
                  icon: const Icon(Icons.add, size: 14),
                  label: const Text('New Stock Take'),
                ),
                builder: (row) {
                  final status = _text(row, ['status'], 'in_progress');
                  return _rowTile(
                    icon: PhosphorIcons.clipboardText(),
                    title: _text(
                        row, ['session_number', 'stock_take_number', 'id']),
                    subtitle:
                        '${_text(row, ['store_type'], 'all')} • Counted ${_text(row, [
                              'counted_items',
                              'items_counted'
                            ], '0')} • ${_date(row['created_at'])}',
                    trailing: Wrap(spacing: 6, children: [
                      _statusChip(status),
                      OutlinedButton(
                          onPressed: () => _showMapDetails(
                              context,
                              'Stock Take ${_text(row, [
                                    'session_number',
                                    'id'
                                  ])}',
                              row),
                          child: const Text('View')),
                      if (status.toLowerCase().contains('progress'))
                        ElevatedButton(
                            onPressed: () =>
                                _submitStockTake(context, ref, row),
                            child: const Text('Submit')),
                      if (status.toLowerCase().contains('submitted')) ...[
                        TextButton(
                            onPressed: () =>
                                _rejectStockTake(context, ref, row),
                            child: const Text('Reject')),
                        ElevatedButton(
                            onPressed: () =>
                                _approveStockTake(context, ref, row),
                            child: const Text('Approve')),
                      ],
                    ]),
                  );
                },
              ),
            ]);
          },
        ),
      );

  Future<void> _startStockTake(BuildContext context, WidgetRef ref) async {
    String storeType = 'foodstuffs';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('Start Central Stock Take'),
          content: DropdownButtonFormField<String>(
            initialValue: storeType,
            decoration: const InputDecoration(labelText: 'Store Type'),
            items: const [
              DropdownMenuItem(value: 'foodstuffs', child: Text('Foodstuffs')),
              DropdownMenuItem(value: 'bar_store', child: Text('Bar Store')),
            ],
            onChanged: (value) =>
                setState(() => storeType = value ?? storeType),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel')),
            ElevatedButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Start')),
          ],
        ),
      ),
    );
    if (confirmed != true) return;
    try {
      await ref
          .read(adminRepositoryProvider)
          .createCentralStockTake({'store_type': storeType});
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, 'Stock take started');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }

  Future<void> _submitStockTake(
      BuildContext context, WidgetRef ref, Map<String, dynamic> row) async {
    if (!await _confirm(context,
        title: 'Submit Stock Take',
        message: 'Submit this stock take for review?')) {
      return;
    }
    try {
      await ref.read(adminRepositoryProvider).submitCentralStockTake(_id(row));
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, 'Stock take submitted');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }

  Future<void> _approveStockTake(
      BuildContext context, WidgetRef ref, Map<String, dynamic> row) async {
    if (!await _confirm(context,
        title: 'Approve Stock Take', message: 'Approve this count?')) {
      return;
    }
    try {
      await ref.read(adminRepositoryProvider).approveCentralStockTake(_id(row));
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, 'Stock take approved');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }

  Future<void> _rejectStockTake(
      BuildContext context, WidgetRef ref, Map<String, dynamic> row) async {
    final reasonCtrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject Stock Take'),
        content: _field(reasonCtrl, 'Reason', maxLines: 3),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
              onPressed: () => Navigator.pop(ctx, reasonCtrl.text.trim()),
              child: const Text('Reject')),
        ],
      ),
    );
    reasonCtrl.dispose();
    if (reason == null) return;
    try {
      await ref
          .read(adminRepositoryProvider)
          .rejectCentralStockTake(_id(row), reason);
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, 'Stock take rejected');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }
}

class CentralSpoilageSection extends ConsumerWidget {
  const CentralSpoilageSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => _LiveSection(
        title: 'Spoilage Log',
        subtitle: 'Central-store loss records, disposal reasons and approvals',
        icon: PhosphorIcons.trash(),
        child: _LiveRows(
          value: ref.watch(centralSpoilageProvider),
          data: (rows) {
            final pending = rows
                .where(
                    (row) => _text(row, ['status']).toUpperCase() == 'PENDING')
                .length;
            final loss = rows.fold<double>(
                0, (sum, row) => sum + _num(row, ['loss_value', 'total_loss']));
            return Column(children: [
              Row(children: [
                Expanded(
                    child: _StatCard(
                        label: 'Loss Value',
                        value: _money(loss),
                        icon: PhosphorIcons.currencyDollar(),
                        color: Colors.red)),
                const SizedBox(width: 12),
                Expanded(
                    child: _StatCard(
                        label: 'Pending Approval',
                        value: '$pending',
                        icon: PhosphorIcons.clock(),
                        color: Colors.orange)),
                const SizedBox(width: 12),
                Expanded(
                    child: _StatCard(
                        label: 'Records',
                        value: '${rows.length}',
                        icon: PhosphorIcons.trash(),
                        color: AppColors.kPrimary)),
              ]),
              const SizedBox(height: 20),
              _RowsCard(
                title: 'Spoilage Records',
                rows: rows,
                emptyMessage: 'No spoilage records found',
                trailing: ElevatedButton.icon(
                  onPressed: () => _recordSpoilage(context, ref),
                  icon: const Icon(Icons.add, size: 14),
                  label: const Text('Record Spoilage'),
                ),
                builder: (row) {
                  final status = _text(row, ['status'], 'PENDING');
                  return _rowTile(
                    icon: PhosphorIcons.trash(),
                    title: _text(
                        row, ['reference_number', 'spoilage_number', 'id']),
                    subtitle:
                        '${_text(row, ['item_name', 'name'])} • ${_num(row, [
                          'quantity',
                          'quantity_spoiled'
                        ]).toStringAsFixed(0)} ${_text(row, [
                          'unit',
                          'unit_of_measure'
                        ])} • ${_text(row, ['reason'])}',
                    trailing: Wrap(spacing: 6, children: [
                      _statusChip(status),
                      OutlinedButton(
                          onPressed: () => _showMapDetails(
                              context,
                              'Spoilage ${_text(row, [
                                    'reference_number',
                                    'id'
                                  ])}',
                              row),
                          child: const Text('View')),
                      if (status.toUpperCase() == 'PENDING') ...[
                        TextButton(
                            onPressed: () =>
                                _updateStatus(context, ref, row, 'REJECTED'),
                            child: const Text('Reject')),
                        ElevatedButton(
                            onPressed: () =>
                                _updateStatus(context, ref, row, 'APPROVED'),
                            child: const Text('Approve')),
                      ],
                    ]),
                  );
                },
              ),
            ]);
          },
        ),
      );

  Future<void> _recordSpoilage(BuildContext context, WidgetRef ref) async {
    final items =
        await ref.read(adminRepositoryProvider).getCentralSpoilageItems();
    if (!context.mounted) return;
    String? itemId = items.isNotEmpty ? _id(items.first) : null;
    final qtyCtrl = TextEditingController(text: '1');
    final notesCtrl = TextEditingController();
    String reason = 'DAMAGED';
    final body = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('Record Central Store Spoilage'),
          content: SizedBox(
            width: 520,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              DropdownButtonFormField<String>(
                initialValue: itemId,
                decoration: const InputDecoration(labelText: 'Item'),
                items: items
                    .map((item) => DropdownMenuItem(
                          value: _id(item),
                          child: Text(_text(item, ['item_name', 'name'])),
                        ))
                    .toList(),
                onChanged: (value) => setState(() => itemId = value),
              ),
              const SizedBox(height: 12),
              _field(qtyCtrl, 'Quantity',
                  required: true, keyboardType: TextInputType.number),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: reason,
                decoration: const InputDecoration(labelText: 'Reason'),
                items: const [
                  DropdownMenuItem(value: 'EXPIRED', child: Text('Expired')),
                  DropdownMenuItem(value: 'DAMAGED', child: Text('Damaged')),
                  DropdownMenuItem(value: 'SPOILED', child: Text('Spoiled')),
                  DropdownMenuItem(value: 'BREAKAGE', child: Text('Breakage')),
                  DropdownMenuItem(value: 'OTHER', child: Text('Other')),
                ],
                onChanged: (value) => setState(() => reason = value ?? reason),
              ),
              const SizedBox(height: 12),
              _field(notesCtrl, 'Notes', maxLines: 3),
            ]),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
                onPressed: () {
                  if (itemId == null) return;
                  Navigator.pop(ctx, {
                    'item_id': itemId,
                    'quantity': double.tryParse(qtyCtrl.text.trim()) ?? 0,
                    'reason': reason,
                    'notes': notesCtrl.text.trim(),
                    'spoilage_date':
                        DateTime.now().toIso8601String().split('T').first,
                    'disposal_method': 'DISPOSED',
                  });
                },
                child: const Text('Record Spoilage')),
          ],
        ),
      ),
    );
    qtyCtrl.dispose();
    notesCtrl.dispose();
    if (body == null) return;
    try {
      await ref.read(adminRepositoryProvider).createCentralSpoilageRecord(body);
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, 'Spoilage recorded');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }

  Future<void> _updateStatus(BuildContext context, WidgetRef ref,
      Map<String, dynamic> row, String status) async {
    if (!await _confirm(
      context,
      title: '${status == 'APPROVED' ? 'Approve' : 'Reject'} Spoilage',
      message: '${status == 'APPROVED' ? 'Approve' : 'Reject'} this record?',
      confirmLabel: status == 'APPROVED' ? 'Approve' : 'Reject',
    )) {
      return;
    }
    try {
      await ref
          .read(adminRepositoryProvider)
          .updateCentralSpoilageStatus(_id(row), status, null);
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, 'Spoilage ${status.toLowerCase()}');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }
}

class CentralSupplierInvoicesSection extends ConsumerWidget {
  const CentralSupplierInvoicesSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => _LiveSection(
        title: 'Supplier Invoices',
        subtitle: 'Supplier AP invoice capture, review and payment handoff',
        icon: PhosphorIcons.receipt(),
        child: _LiveRows(
          value: ref.watch(centralSupplierInvoicesProvider),
          data: (rows) => _RowsCard(
            title: 'Invoices',
            rows: rows,
            emptyMessage: 'No invoices found',
            trailing: ElevatedButton.icon(
              onPressed: () => _recordInvoice(context, ref),
              icon: const Icon(Icons.add, size: 14),
              label: const Text('Record Invoice'),
            ),
            builder: (row) {
              final status = _text(row, ['status'], 'draft');
              return _rowTile(
                icon: PhosphorIcons.receipt(),
                title: _text(row, ['invoice_number', 'id']),
                subtitle: '${_text(row, [
                      'supplier_name'
                    ])} • ${_date(row['invoice_date'])}',
                trailing: Wrap(spacing: 6, children: [
                  _statusChip(status),
                  OutlinedButton(
                      onPressed: () => _showMapDetails(
                          context,
                          'Invoice ${_text(row, ['invoice_number', 'id'])}',
                          row),
                      child: const Text('View')),
                  if (!status.toLowerCase().contains('approved')) ...[
                    TextButton(
                        onPressed: () => _rejectInvoice(context, ref, row),
                        child: const Text('Reject')),
                    ElevatedButton(
                        onPressed: () => _approveInvoice(context, ref, row),
                        child: const Text('Approve')),
                  ],
                  if (status.toLowerCase().contains('approved'))
                    OutlinedButton(
                        onPressed: () => ref
                            .read(adminSectionProvider.notifier)
                            .state = AdminSection.procurementPayments,
                        child: const Text('Pay')),
                ]),
              );
            },
          ),
        ),
      );

  Future<void> _recordInvoice(BuildContext context, WidgetRef ref) async {
    final suppliers = await ref
        .read(adminRepositoryProvider)
        .getStoreSuppliers(scope: 'global');
    if (!context.mounted) return;
    String? supplierId = suppliers.isNotEmpty ? _id(suppliers.first) : null;
    final invoiceCtrl = TextEditingController();
    final amountCtrl = TextEditingController(text: '0');
    final body = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('Record Supplier Invoice'),
          content: SizedBox(
            width: 460,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              DropdownButtonFormField<String>(
                initialValue: supplierId,
                decoration: const InputDecoration(labelText: 'Supplier'),
                items: suppliers
                    .map((supplier) => DropdownMenuItem(
                          value: _id(supplier),
                          child: Text(_text(supplier, ['name'])),
                        ))
                    .toList(),
                onChanged: (value) => setState(() => supplierId = value),
              ),
              const SizedBox(height: 12),
              _field(invoiceCtrl, 'Invoice Number', required: true),
              const SizedBox(height: 12),
              _field(amountCtrl, 'Total Amount',
                  keyboardType: TextInputType.number, required: true),
            ]),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
                onPressed: () {
                  if (supplierId == null || invoiceCtrl.text.trim().isEmpty) {
                    return;
                  }
                  final amount = double.tryParse(amountCtrl.text.trim()) ?? 0;
                  Navigator.pop(ctx, {
                    'supplier_id': supplierId,
                    'invoice_number': invoiceCtrl.text.trim(),
                    'invoice_date':
                        DateTime.now().toIso8601String().split('T').first,
                    'total_amount': amount,
                    'subtotal': amount,
                    'items': const [],
                  });
                },
                child: const Text('Record Invoice')),
          ],
        ),
      ),
    );
    invoiceCtrl.dispose();
    amountCtrl.dispose();
    if (body == null) return;
    try {
      await ref.read(adminRepositoryProvider).createSupplierInvoice(body);
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, 'Invoice recorded');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }

  Future<void> _approveInvoice(
      BuildContext context, WidgetRef ref, Map<String, dynamic> row) async {
    if (!await _confirm(context,
        title: 'Approve Invoice', message: 'Approve this invoice?')) {
      return;
    }
    try {
      await ref.read(adminRepositoryProvider).approveSupplierInvoice(_id(row));
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, 'Invoice approved');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }

  Future<void> _rejectInvoice(
      BuildContext context, WidgetRef ref, Map<String, dynamic> row) async {
    final reasonCtrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject Invoice'),
        content: _field(reasonCtrl, 'Reason', maxLines: 3),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
              onPressed: () => Navigator.pop(ctx, reasonCtrl.text.trim()),
              child: const Text('Reject')),
        ],
      ),
    );
    reasonCtrl.dispose();
    if (reason == null) return;
    try {
      await ref
          .read(adminRepositoryProvider)
          .rejectSupplierInvoice(_id(row), reason);
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, 'Invoice rejected');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }
}

class CentralSupplierPaymentsSection extends ConsumerWidget {
  const CentralSupplierPaymentsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => _LiveSection(
        title: 'Supplier Payments',
        subtitle: 'Supplier payment initiation, processing and ledger review',
        icon: PhosphorIcons.creditCard(),
        child: _LiveRows(
          value: ref.watch(centralSupplierPaymentsProvider),
          data: (rows) => _RowsCard(
            title: 'Payments',
            rows: rows,
            emptyMessage: 'No payments found',
            trailing: ElevatedButton.icon(
              onPressed: () => _recordPayment(context, ref),
              icon: const Icon(Icons.add, size: 14),
              label: const Text('Record Payment'),
            ),
            builder: (row) {
              final status = _text(row, ['status'], 'draft');
              return _rowTile(
                icon: PhosphorIcons.creditCard(),
                title: _text(row, ['payment_number', 'id']),
                subtitle: '${_text(row, ['supplier_name'])} • ${_text(row, [
                      'payment_method'
                    ], 'method')} • ${_text(row, ['reference_number'], 'no ref')}',
                trailing: Wrap(spacing: 6, children: [
                  _statusChip(status),
                  OutlinedButton(
                      onPressed: () => _showMapDetails(
                          context,
                          'Payment ${_text(row, ['payment_number', 'id'])}',
                          row),
                      child: const Text('View')),
                  if (!status.toLowerCase().contains('processed') &&
                      !status.toLowerCase().contains('paid'))
                    ElevatedButton(
                        onPressed: () => _processPayment(context, ref, row),
                        child: const Text('Process')),
                ]),
              );
            },
          ),
        ),
      );

  Future<void> _recordPayment(BuildContext context, WidgetRef ref) async {
    final suppliers = await ref
        .read(adminRepositoryProvider)
        .getStoreSuppliers(scope: 'global');
    if (!context.mounted) return;
    String? supplierId = suppliers.isNotEmpty ? _id(suppliers.first) : null;
    final amountCtrl = TextEditingController(text: '0');
    final refCtrl = TextEditingController();
    String method = 'bank_transfer';
    final body = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('Record Supplier Payment'),
          content: SizedBox(
            width: 460,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              DropdownButtonFormField<String>(
                initialValue: supplierId,
                decoration: const InputDecoration(labelText: 'Supplier'),
                items: suppliers
                    .map((supplier) => DropdownMenuItem(
                          value: _id(supplier),
                          child: Text(_text(supplier, ['name'])),
                        ))
                    .toList(),
                onChanged: (value) => setState(() => supplierId = value),
              ),
              const SizedBox(height: 12),
              _field(amountCtrl, 'Amount',
                  keyboardType: TextInputType.number, required: true),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: method,
                decoration: const InputDecoration(labelText: 'Payment Method'),
                items: const [
                  DropdownMenuItem(
                      value: 'bank_transfer', child: Text('Bank Transfer')),
                  DropdownMenuItem(value: 'cash', child: Text('Cash')),
                  DropdownMenuItem(value: 'mpesa', child: Text('M-Pesa')),
                  DropdownMenuItem(value: 'cheque', child: Text('Cheque')),
                ],
                onChanged: (value) => setState(() => method = value ?? method),
              ),
              const SizedBox(height: 12),
              _field(refCtrl, 'Reference Number'),
            ]),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
                onPressed: () {
                  if (supplierId == null) return;
                  Navigator.pop(ctx, {
                    'supplier_id': supplierId,
                    'amount': double.tryParse(amountCtrl.text.trim()) ?? 0,
                    'payment_method': method,
                    'reference_number': refCtrl.text.trim(),
                    'payment_date':
                        DateTime.now().toIso8601String().split('T').first,
                  });
                },
                child: const Text('Record Payment')),
          ],
        ),
      ),
    );
    amountCtrl.dispose();
    refCtrl.dispose();
    if (body == null) return;
    try {
      await ref.read(adminRepositoryProvider).createSupplierPayment(body);
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, 'Payment recorded');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }

  Future<void> _processPayment(
      BuildContext context, WidgetRef ref, Map<String, dynamic> row) async {
    if (!await _confirm(context,
        title: 'Process Payment', message: 'Process this payment?')) {
      return;
    }
    try {
      await ref.read(adminRepositoryProvider).processSupplierPayment(_id(row));
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, 'Payment processed');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }
}

class CentralReportsSection extends ConsumerWidget {
  const CentralReportsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboardAsync = ref.watch(centralStoreDashboardProvider);
    return _LiveSection(
      title: 'Central Reports',
      subtitle: 'Central store analytics and operational summaries',
      icon: PhosphorIcons.chartBar(),
      child: dashboardAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) =>
            Text('Failed to load dashboard: ${apiErrorMessage(error)}'),
        data: (dashboard) {
          final stats = dashboard['stats'] is Map
              ? Map<String, dynamic>.from(dashboard['stats'])
              : dashboard;
          return Column(children: [
            Row(children: [
              Expanded(
                  child: _StatCard(
                      label: 'Master Items',
                      value:
                          '${stats['totalMasterItems'] ?? dashboard['totalItems'] ?? 0}',
                      icon: PhosphorIcons.package(),
                      color: AppColors.kPrimary)),
              const SizedBox(width: 12),
              Expanded(
                  child: _StatCard(
                      label: 'Low Stock',
                      value:
                          '${stats['totalLowStockItems'] ?? dashboard['lowStockCount'] ?? 0}',
                      icon: PhosphorIcons.warning(),
                      color: Colors.orange)),
              const SizedBox(width: 12),
              Expanded(
                  child: _StatCard(
                      label: 'In Transit',
                      value: '${stats['inTransit'] ?? 0}',
                      icon: PhosphorIcons.truck(),
                      color: Colors.green)),
            ]),
            const SizedBox(height: 20),
            _RowsCard(
              title: 'Report Shortcuts',
              rows: const [
                {'title': 'Stock Valuation Report', 'kind': 'Inventory'},
                {'title': 'Purchase Summary', 'kind': 'Procurement'},
                {'title': 'Dispatch Report', 'kind': 'Logistics'},
                {'title': 'Low Stock Alert', 'kind': 'Inventory'},
                {'title': 'Supplier Performance', 'kind': 'Suppliers'},
                {'title': 'GRN Discrepancy Report', 'kind': 'Receiving'},
              ],
              emptyMessage: '',
              builder: (row) => _rowTile(
                icon: PhosphorIcons.fileText(),
                title: _text(row, ['title']),
                subtitle: _text(row, ['kind']),
                trailing: OutlinedButton.icon(
                  onPressed: () => _generateReport(context, ref, row),
                  icon: const Icon(Icons.file_download, size: 14),
                  label: const Text('Generate'),
                ),
              ),
            ),
          ]);
        },
      ),
    );
  }

  Future<void> _generateReport(
    BuildContext context,
    WidgetRef ref,
    Map<String, dynamic> row,
  ) async {
    final title = _text(row, ['title']);
    try {
      final repo = ref.read(adminRepositoryProvider);
      final items = await repo.getStoreItems(limit: 500);
      final pos = await repo.getPurchaseOrders();
      final dispatches = await repo.getStoreDispatchNotes();
      final spoilage = await repo.getCentralSpoilageRecords();
      final grns = await repo.getGRNs();
      await ReportService().generateAndPrint(
        title: title,
        subtitle: 'Central Store ${_text(row, ['kind'])}',
        sections: [
          if (title.contains('Stock') || title.contains('Low'))
            ReportSection(
              title: 'Inventory',
              tableHeaders: const ['SKU', 'Item', 'Store', 'Qty', 'Reorder'],
              tableRows: items
                  .where((item) =>
                      !title.contains('Low') ||
                      _num(item, ['quantity']) <=
                          _num(item, ['reorder_level', 'min_stock']))
                  .map((item) => [
                        _text(item, ['sku']),
                        _text(item, ['item_name', 'name', 'description']),
                        _text(item, ['store_type']),
                        _num(item, ['quantity']).toStringAsFixed(0),
                        _num(item, ['reorder_level', 'min_stock'])
                            .toStringAsFixed(0),
                      ])
                  .toList(),
            ),
          if (title.contains('Purchase') ||
              title.contains('Supplier Performance'))
            ReportSection(
              title: 'Purchase Orders',
              tableHeaders: const ['PO', 'Supplier', 'Status', 'Total'],
              tableRows: pos
                  .map((po) => [
                        _text(po, ['po_number', 'id']),
                        _text(po, ['supplier_name']),
                        _text(po, ['status']),
                        _money(_num(po, ['total_amount', 'total'])),
                      ])
                  .toList(),
            ),
          if (title.contains('Dispatch'))
            ReportSection(
              title: 'Dispatch Notes',
              tableHeaders: const ['Dispatch', 'Branch', 'Driver', 'Status'],
              tableRows: dispatches
                  .map((dispatch) => [
                        _text(dispatch,
                            ['dispatch_number', 'dispatch_note_number', 'id']),
                        _text(dispatch, ['to_branch_name', 'branch_name']),
                        _text(dispatch, ['driver_name']),
                        _text(dispatch, ['status']),
                      ])
                  .toList(),
            ),
          if (title.contains('GRN'))
            ReportSection(
              title: 'GRNs',
              tableHeaders: const ['GRN', 'Supplier', 'PO', 'Date'],
              tableRows: grns
                  .map((grn) => [
                        _text(grn, ['grn_number', 'id']),
                        _text(grn, ['supplier_name']),
                        _text(grn, ['po_number'], 'Direct'),
                        _date(grn['grn_date'] ?? grn['delivery_date']),
                      ])
                  .toList(),
            ),
          if (spoilage.isNotEmpty && title.contains('Stock'))
            ReportSection(
              title: 'Spoilage Summary',
              tableHeaders: const ['Ref', 'Item', 'Reason', 'Loss'],
              tableRows: spoilage
                  .take(50)
                  .map((record) => [
                        _text(record, ['reference_number', 'id']),
                        _text(record, ['item_name', 'name']),
                        _text(record, ['reason']),
                        _money(_num(record, ['loss_value', 'total_loss'])),
                      ])
                  .toList(),
            ),
        ],
      );
    } catch (error) {
      if (context.mounted) _snack(context, 'Report failed: $error');
    }
  }
}
