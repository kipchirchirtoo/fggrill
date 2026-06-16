import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:printing/printing.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/api_error_message.dart';
import '../../../../services/report_service.dart';
import '../../../auth/domain/auth_notifier.dart';
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

List<Map<String, dynamic>> _list(dynamic value) {
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

String _date(dynamic value) {
  final parsed = DateTime.tryParse('$value');
  if (parsed == null) return '—';
  return '${parsed.day.toString().padLeft(2, '0')}/${parsed.month.toString().padLeft(2, '0')}/${parsed.year}';
}

String _money(num value) => 'KES ${_groupedWhole(value)}';

String _groupedWhole(num value) {
  final rounded = value.round();
  final sign = rounded < 0 ? '-' : '';
  final digits = rounded.abs().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    final fromEnd = digits.length - i;
    buffer.write(digits[i]);
    if (fromEnd > 1 && fromEnd % 3 == 1) buffer.write(',');
  }
  return '$sign$buffer';
}

String _isoDate(DateTime value) => value.toIso8601String().split('T').first;

String _plainNum(num value) =>
    value.round() == value ? value.toInt().toString() : '$value';

String _normalizePoItemName(String value) => value
    .toLowerCase()
    .replaceAll(RegExp(r'[^a-z0-9]+'), ' ')
    .replaceAll(RegExp(r'\s+'), ' ')
    .trim();

const _poValidUnits = {
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

class _ParsedPurchaseOrderItem {
  _ParsedPurchaseOrderItem({
    required this.key,
    required this.sourceLine,
    required this.itemName,
    required this.quantity,
    required this.unit,
    this.error,
  });

  final String key;
  final String sourceLine;
  String itemName;
  num quantity;
  String unit;
  num unitCost = 0;
  String? sku;
  String? error;

  num get total => quantity * unitCost;
}

final _uuidPattern = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  caseSensitive: false,
);

String _detailLabel(String key) {
  const overrides = {
    'id': 'Record',
    'request_id': 'Request',
    'requesting_branch_id': 'Requesting Branch',
    'branch_id': 'Branch',
    'reviewed_by': 'Reviewed By',
    'reviewed_by_id': 'Reviewed By',
    'auditor_id': 'Auditor',
    'created_by': 'Created By',
    'requested_by': 'Requested By',
    'requested_by_id': 'Requested By',
    'requested_by_user': 'Requested By',
    'reviewed_by_user': 'Reviewed By',
    'requesting_branch': 'Requesting Branch',
  };
  return overrides[key] ??
      key
          .replaceAll('_', ' ')
          .split(' ')
          .where((part) => part.isNotEmpty)
          .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
          .join(' ');
}

String _formatStatusValue(dynamic value) {
  final raw = '$value'.trim();
  if (raw.isEmpty) return '—';
  return raw
      .replaceAll('_', ' ')
      .toLowerCase()
      .split(' ')
      .where((part) => part.isNotEmpty)
      .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
      .join(' ');
}

String _formatDateTimeValue(dynamic value) {
  final parsed = DateTime.tryParse('$value');
  if (parsed == null) return '$value';
  final local = parsed.toLocal();
  final date =
      '${local.day.toString().padLeft(2, '0')}/${local.month.toString().padLeft(2, '0')}/${local.year}';
  final time =
      '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  return '$date $time';
}

String? _mapDisplayName(Map<dynamic, dynamic> value) {
  final firstName = '${value['first_name'] ?? ''}'.trim();
  final lastName = '${value['last_name'] ?? ''}'.trim();
  final fullName = '${value['full_name'] ?? value['name'] ?? ''}'.trim();
  final joinedName = '$firstName $lastName'.trim();
  final email = '${value['email'] ?? ''}'.trim();
  final code = '${value['code'] ?? value['branch_code'] ?? ''}'.trim();
  final number =
      '${value['request_number'] ?? value['po_number'] ?? value['sku'] ?? ''}'
          .trim();

  if (joinedName.isNotEmpty) {
    return email.isNotEmpty ? '$joinedName ($email)' : joinedName;
  }
  if (fullName.isNotEmpty) {
    return code.isNotEmpty ? '$fullName ($code)' : fullName;
  }
  if (number.isNotEmpty) return number;
  if (email.isNotEmpty) return email;
  return null;
}

String _listDisplayValue(List<dynamic> values) {
  if (values.isEmpty) return 'None';

  return values.take(12).map((value) {
    if (value is Map) {
      final name = _mapDisplayName(value) ??
          '${value['item_name'] ?? value['name'] ?? value['description'] ?? value['item_sku'] ?? value['sku'] ?? 'Item'}';
      final quantity = value['quantity_approved'] ??
          value['approved_quantity'] ??
          value['quantity_requested'] ??
          value['quantity'] ??
          value['qty'];
      final unit = value['unit'] ?? value['unit_of_measure'] ?? '';
      final quantityText = quantity == null || '$quantity'.trim().isEmpty
          ? ''
          : ' — Qty $quantity${'$unit'.trim().isNotEmpty ? ' $unit' : ''}';
      return '$name$quantityText';
    }
    return '$value';
  }).join('\n');
}

String? _relatedDisplayValue(Map<String, dynamic> row, String key) {
  final relatedKeys = <String>[
    if (key == 'reviewed_by' || key == 'reviewed_by_id') 'reviewed_by_user',
    if (key == 'auditor_id') 'auditor',
    if (key == 'auditor_id') 'reviewed_by_user',
    if (key == 'created_by') 'created_by_user',
    if (key == 'requested_by' || key == 'requested_by_id') 'requested_by_user',
    if (key == 'requesting_branch_id' || key == 'branch_id')
      'requesting_branch',
    if (key == 'branch_id') 'branch',
  ];

  for (final relatedKey in relatedKeys) {
    final related = row[relatedKey];
    if (related is Map) {
      final name = _mapDisplayName(related);
      if (name != null && name.isNotEmpty) return name;
    }
  }
  return null;
}

String _detailValue(Map<String, dynamic> row, String key, dynamic value) {
  final related = _relatedDisplayValue(row, key);
  if (related != null) return related;

  if (value is Map) {
    return _mapDisplayName(value) ?? 'Linked record';
  }
  if (value is List) {
    return _listDisplayValue(value);
  }
  if (key.endsWith('_at') ||
      key.endsWith('_date') ||
      key == 'created_at' ||
      key == 'updated_at') {
    return _formatDateTimeValue(value);
  }
  if (key == 'status' ||
      key.endsWith('_status') ||
      key == 'count_type' ||
      key == 'store_type') {
    return _formatStatusValue(value);
  }

  final text = '$value'.trim();
  if (_uuidPattern.hasMatch(text)) return 'Linked record';
  return text;
}

bool _shouldShowDetailEntry(
    Map<String, dynamic> row, MapEntry<String, dynamic> entry) {
  final value = entry.value;
  if (value == null || '$value'.trim().isEmpty || '$value' == 'null') {
    return false;
  }
  if (entry.key.endsWith('_id') ||
      entry.key == 'reviewed_by' ||
      entry.key == 'created_by') {
    return _relatedDisplayValue(row, entry.key) != null ||
        !_uuidPattern.hasMatch('$value');
  }
  return true;
}

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
  double trailingMaxWidth = 360,
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
            constraints: BoxConstraints(maxWidth: trailingMaxWidth),
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
    ..invalidate(centralApprovedStoreRequestsProvider)
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

Future<void> _showActionError(
  BuildContext context, {
  required String title,
  required Object error,
}) async {
  if (!context.mounted) return;
  final message = apiErrorMessage(error).replaceAll(r'\n', '\n').trim();
  if (message.length < 120 && !message.contains('\n')) {
    _snack(context, message);
    return;
  }
  await showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: SizedBox(
        width: 560,
        child: SelectableText(
          message.isEmpty ? 'The request could not be completed.' : message,
          style: const TextStyle(height: 1.45),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: const Text('Close'),
        ),
      ],
    ),
  );
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
    label: Text(_statusLabel(status).toUpperCase(),
        style: const TextStyle(fontSize: 10)),
    backgroundColor: color.withValues(alpha: 0.1),
    labelStyle: TextStyle(color: color, fontWeight: FontWeight.w700),
  );
}

String _statusLabel(String status) {
  final normalized = status.trim().toLowerCase();
  if (normalized == 'fully_received') return 'Fully Received';
  if (normalized == 'partially_received') return 'Partially Received';
  if (normalized == 'sent_to_supplier') return 'Sent to Supplier';
  if (normalized == 'pending_approval') return 'Pending Approval';
  return status.replaceAll('_', ' ');
}

/// Open a full-screen, well-structured detail page for a record (replaces the
/// old cramped key/value dialog). Used by every "View" across the central store.
Future<void> _showMapDetails(
  BuildContext context,
  String title,
  Map<String, dynamic> row, {
  List<Widget> actions = const [],
}) async {
  await Navigator.of(context).push<void>(
    MaterialPageRoute(
      builder: (_) =>
          _RecordDetailPage(title: title, row: row, actions: actions),
    ),
  );
}

// Numeric fields worth surfacing as headline metrics (detailed analysis strip).
const _metricKeyHints = [
  'total_loss',
  'total_value',
  'total_amount',
  'grand_total',
  'amount',
  'quantity',
  'quantity_received',
  'unit_cost',
  'unit_price',
  'current_stock',
  'balance',
  'total_quantity',
];

class _RecordDetailPage extends StatelessWidget {
  const _RecordDetailPage({
    required this.title,
    required this.row,
    this.actions = const [],
  });

  final String title;
  final Map<String, dynamic> row;
  final List<Widget> actions;

  num? _asNum(dynamic v) {
    if (v is num) return v;
    return num.tryParse('${v ?? ''}'.replaceAll(',', '').trim());
  }

  @override
  Widget build(BuildContext context) {
    final entries = row.entries
        .where((entry) => _shouldShowDetailEntry(row, entry))
        .take(60)
        .toList();

    final status = _text(row, ['status', 'approval_status'], '');

    // Build a small "headline metrics" strip from notable numeric fields.
    final metrics = <MapEntry<String, num>>[];
    for (final key in _metricKeyHints) {
      if (metrics.length >= 4) break;
      if (!row.containsKey(key)) continue;
      final n = _asNum(row[key]);
      if (n == null) continue;
      if (metrics.any((m) => m.key == key)) continue;
      metrics.add(MapEntry(key, n));
    }

    return Scaffold(
      backgroundColor: AppColors.kSurface,
      appBar: AppBar(
        title: Text(title, overflow: TextOverflow.ellipsis),
        actions:
            actions.isEmpty ? null : [...actions, const SizedBox(width: 8)],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 980),
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                // Header
                _card(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.kPrimary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(PhosphorIcons.fileText(),
                            color: AppColors.kPrimary),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(title,
                                style: const TextStyle(
                                    fontSize: 18, fontWeight: FontWeight.w800)),
                            const SizedBox(height: 4),
                            const Text('Record details & analysis',
                                style: TextStyle(
                                    color: AppColors.kTextSecondary,
                                    fontSize: 12)),
                          ],
                        ),
                      ),
                      if (status.isNotEmpty) _StatusBadge(status: status),
                    ],
                  ),
                ),
                if (metrics.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: metrics
                        .map((m) => _MetricTile(
                              label: _detailLabel(m.key),
                              value: _formatMetric(m.key, m.value),
                            ))
                        .toList(),
                  ),
                ],
                const SizedBox(height: 14),
                _card(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Details',
                          style: TextStyle(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 6),
                      const Divider(height: 1),
                      const SizedBox(height: 6),
                      LayoutBuilder(builder: (context, c) {
                        final twoCol = c.maxWidth > 640;
                        if (!twoCol) {
                          return Column(
                            children: entries
                                .map((e) => _detailRow(e.key, e.value))
                                .toList(),
                          );
                        }
                        final rows = <Widget>[];
                        for (var i = 0; i < entries.length; i += 2) {
                          final left = entries[i];
                          final hasRight = i + 1 < entries.length;
                          rows.add(Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(child: _detailRow(left.key, left.value)),
                              const SizedBox(width: 24),
                              Expanded(
                                child: hasRight
                                    ? _detailRow(entries[i + 1].key,
                                        entries[i + 1].value)
                                    : const SizedBox.shrink(),
                              ),
                            ],
                          ));
                        }
                        return Column(children: rows);
                      }),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _formatMetric(String key, num v) {
    final isMoney = key.contains('value') ||
        key.contains('loss') ||
        key.contains('amount') ||
        key.contains('cost') ||
        key.contains('price') ||
        key.contains('total');
    final s =
        v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(2);
    return isMoney ? 'KES $s' : s;
  }

  Widget _detailRow(String key, dynamic value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 7),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_detailLabel(key).toUpperCase(),
                style: const TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.kTextSecondary)),
            const SizedBox(height: 3),
            SelectableText(
              _detailValue(row, key, value),
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      );

  Widget _card({required Widget child}) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.kDivider.withValues(alpha: 0.5)),
        ),
        child: child,
      );
}

class _MetricTile extends StatelessWidget {
  const _MetricTile({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 200,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style:
                  const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
          const SizedBox(height: 4),
          Text(label.toUpperCase(),
              style: const TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.kTextSecondary)),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});
  final String status;
  @override
  Widget build(BuildContext context) {
    final s = status.toLowerCase();
    Color c = Colors.blueGrey;
    if (s.contains('pending') || s.contains('draft')) {
      c = const Color(0xFFB45309);
    }
    if (s.contains('approv') ||
        s.contains('complete') ||
        s.contains('receiv') ||
        s.contains('paid') ||
        s.contains('confirm')) {
      c = const Color(0xFF15803D);
    }
    if (s.contains('reject') || s.contains('cancel') || s.contains('damaged')) {
      c = Colors.red;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(status.toUpperCase(),
          style:
              TextStyle(color: c, fontSize: 11, fontWeight: FontWeight.w800)),
    );
  }
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
  String? _poId;
  String? _poNumber;
  bool _loadingPo = false;
  bool _scannerMode = true;
  bool _isSubmitting = false;
  bool _isScanning = false;
  String _scanStatus = 'Scanner ready';
  String? _lastScannedCode;
  List<Map<String, dynamic>> _manualResults = [];
  final List<Map<String, dynamic>> _scanned = [];

  num _gnum(dynamic v) => v is num ? v : num.tryParse('${v ?? 0}') ?? 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusScanner();
      _checkPreloadPo();
    });
  }

  void _checkPreloadPo() {
    final poId = ref.read(grnPreloadPoIdProvider);
    if (poId != null && poId.isNotEmpty) {
      ref.read(grnPreloadPoIdProvider.notifier).state = null;
      _applyPo(poId);
    }
  }

  void _focusScanner() {
    if (!mounted || !_scannerMode) return;
    _scannerFocus.requestFocus();
  }

  String _cleanScanCode(String value) => value
      .replaceAll(RegExp(r'[\r\n\t]'), '')
      .replaceAll(RegExp(r'\s+'), '')
      .trim();

  bool _matchesScanCode(Map<String, dynamic> item, String code) {
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
    return keys.any((key) => _text(item, [key], '').toLowerCase() == needle);
  }

  /// Automation: pick an approved PO; its supplier + line items load straight
  /// into the receiving session, prefilled with ordered quantity and unit cost.
  Future<void> _loadFromPo() async {
    setState(() => _loadingPo = true);
    List<Map<String, dynamic>> pos;
    try {
      pos = await ref
          .read(adminRepositoryProvider)
          .getPurchaseOrders(supplierId: _supplierId);
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text('Could not load POs: $e')));
      }
      if (mounted) setState(() => _loadingPo = false);
      return;
    }
    final selectable = pos.where((p) {
      final s = _text(p, ['status'], '').toLowerCase();
      return !s.contains('cancel') &&
          !s.contains('closed') &&
          !s.contains('fully');
    }).toList();
    if (!mounted) {
      setState(() => _loadingPo = false);
      return;
    }
    setState(() => _loadingPo = false);
    if (selectable.isEmpty) {
      AppNotifier.showSnackBar(context,
          const SnackBar(content: Text('No open purchase orders to receive')));
      return;
    }
    final chosen = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text('Receive against Purchase Order'),
        children: selectable
            .map((p) => SimpleDialogOption(
                  onPressed: () => Navigator.pop(ctx, p),
                  child: ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(PhosphorIcons.fileText()),
                    title: Text(_text(p, ['po_number', 'id'], 'PO')),
                    subtitle: Text('${_text(p, [
                          'supplier_name',
                          'supplier'
                        ], 'Supplier')} • ${_text(p, ['status'])}'),
                  ),
                ))
            .toList(),
      ),
    );
    if (chosen == null) return;
    await _applyPo(_text(chosen, ['id']));
  }

  Future<void> _applyPo(String poId) async {
    if (poId.isEmpty) return;
    setState(() => _loadingPo = true);
    try {
      final po = await ref.read(adminRepositoryProvider).getPurchaseOrder(poId);
      final items = (po['items'] as List?) ?? const [];
      final rows = items.whereType<Map>().map((raw) {
        final m = Map<String, dynamic>.from(raw);
        final ordered = _gnum(m['quantity_ordered']);
        final pending = _gnum(m['quantity_pending']);
        final outstanding = pending > 0 ? pending : ordered;
        return <String, dynamic>{
          'item_id': _text(m, ['item_id', 'sku', 'id']),
          'item_name': _text(m, ['item_name', 'name'], 'Item'),
          'sku': _text(m, ['item_id', 'sku']),
          'unit_of_measure': _text(m, ['unit_of_measure', 'unit'], 'units'),
          'quantity_received': outstanding,
          'quantity_ordered': ordered,
          'po_item_id': _text(m, ['id']),
          'unit_price': _gnum(m['unit_price']),
          'barcode': '',
          'added_via': 'po',
        };
      }).toList();
      if (!mounted) return;
      setState(() {
        _poId = poId;
        _poNumber = _text(po, ['po_number', 'id']);
        _supplierId = _text(po, ['supplier_id'], _supplierId ?? '');
        _scanned
          ..clear()
          ..addAll(rows);
      });
      AppNotifier.showSnackBar(
        context,
        SnackBar(
            content: Text(
                'Loaded ${rows.length} item(s) from ${_poNumber ?? 'PO'} — review and Post GRN')),
      );
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text('Could not load PO: $e')));
      }
    } finally {
      if (mounted) setState(() => _loadingPo = false);
    }
  }

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
    final code = _cleanScanCode(_barcodeCtrl.text);
    if (code.isEmpty || _isScanning) return;
    setState(() {
      _isScanning = true;
      _scanStatus = 'Scanning $code';
      _lastScannedCode = code;
    });

    try {
      final repo = ref.read(adminRepositoryProvider);
      final items = await repo.getStoreItems(search: code, limit: 30);
      Map<String, dynamic>? item;
      for (final candidate in items) {
        if (_matchesScanCode(candidate, code)) {
          item = candidate;
          break;
        }
      }
      item ??= items.length == 1 ? items.first : null;

      if (item == null) {
        if (!mounted) return;
        setState(() => _scanStatus = 'Unknown barcode $code');
        await _showCreateItemDialog(code);
      } else {
        final addedName = _addItem(item, viaScan: true);
        if (mounted) setState(() => _scanStatus = 'Added $addedName');
      }
    } catch (error) {
      if (mounted) {
        setState(() => _scanStatus = 'Scan failed');
        AppNotifier.showSnackBar(
          context,
          SnackBar(content: Text('Scan failed: ${apiErrorMessage(error)}')),
        );
      }
    } finally {
      if (mounted) setState(() => _isScanning = false);
      _barcodeCtrl.clear();
      WidgetsBinding.instance.addPostFrameCallback((_) => _focusScanner());
    }
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

  String _addItem(Map<String, dynamic> item, {required bool viaScan}) {
    final sku =
        _text(item, ['sku', 'item_sku', 'item_code', 'item_id', 'id'], '');
    if (sku.isEmpty) return 'item';
    final itemName = _text(item, ['item_name', 'name', 'description'], sku);
    setState(() {
      final index = _scanned.indexWhere((row) => row['item_id'] == sku);
      if (index >= 0) {
        _scanned[index]['quantity_received'] =
            _gnum(_scanned[index]['quantity_received']) + 1;
        _scanned[index]['added_via'] = viaScan ? 'scan' : 'manual';
      } else {
        _scanned.add({
          'item_id': sku,
          'item_name': itemName,
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
    WidgetsBinding.instance.addPostFrameCallback((_) => _focusScanner());
    return itemName;
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
      _addItem(created, viaScan: true);
      if (mounted) {
        setState(() => _scanStatus = 'Created ${_text(created, [
              'item_name',
              'name',
              'description'
            ], barcode)}');
      }
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
      final repo = ref.read(adminRepositoryProvider);
      final grn = await repo.createGRN({
        'supplier_id': _supplierId,
        if (_poId != null) 'po_id': _poId,
        'grn_date': DateTime.now().toIso8601String().split('T').first,
        'delivery_note_number': _deliveryNoteCtrl.text.trim(),
        'invoice_number': _invoiceCtrl.text.trim(),
        'items': _scanned
            .map((item) => {
                  'item_id': item['item_id'],
                  if (item['po_item_id'] != null &&
                      '${item['po_item_id']}'.isNotEmpty)
                    'po_item_id': item['po_item_id'],
                  'quantity_received': item['quantity_received'],
                  'quantity_accepted': item['quantity_received'],
                  'quantity_ordered': item['quantity_ordered'] ?? 0,
                  'unit_price': item['unit_price'],
                  'unit_of_measure': item['unit_of_measure'],
                  'quality_status': 'accepted',
                })
            .toList(),
      });
      final grnId = _id(grn);
      final grnNumber = _text(grn, ['grn_number', 'id'], 'GRN');
      if (grnId.isNotEmpty) {
        try {
          final pdfFile = await repo.downloadGRNPdf(
            grnId,
            grnNumber: grnNumber,
          );
          final bytes = await pdfFile.readAsBytes();
          await Printing.layoutPdf(
            name: '$grnNumber.pdf',
            onLayout: (_) async => bytes,
          );
        } catch (printError) {
          if (mounted) {
            AppNotifier.showSnackBar(
              context,
              SnackBar(
                content: Text(
                  'GRN posted, but printing failed: ${apiErrorMessage(printError)}',
                ),
              ),
            );
          }
        }
      }
      ref
        ..invalidate(centralGrnsProvider)
        ..invalidate(centralStoreItemsProvider)
        ..invalidate(centralFoodstuffsProvider)
        ..invalidate(centralBarItemsProvider);
      setState(() {
        _scanned.clear();
        _invoiceCtrl.clear();
        _deliveryNoteCtrl.clear();
        _poId = null;
        _poNumber = null;
      });
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          SnackBar(
            content: Text(
              grnId.isEmpty
                  ? 'Goods received and stock updated'
                  : 'GRN $grnNumber posted, stock updated, and print prepared',
            ),
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(context,
            SnackBar(content: Text('Failed: ${apiErrorMessage(error)}')));
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
              child: _SupplierSearchField(
                suppliers: suppliers,
                selectedSupplierId: _supplierId,
                onSelected: (supplier) =>
                    setState(() => _supplierId = _id(supplier)),
                onCleared: () => setState(() => _supplierId = null),
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
          const SizedBox(height: 12),
          Row(children: [
            OutlinedButton.icon(
              onPressed: _loadingPo ? null : _loadFromPo,
              icon: _loadingPo
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : Icon(PhosphorIcons.fileText(), size: 16),
              label: Text(_loadingPo ? 'Loading…' : 'Load from PO'),
            ),
            const SizedBox(width: 10),
            if (_poId != null)
              Chip(
                avatar: const Icon(Icons.link, size: 16),
                label: Text('Linked: ${_poNumber ?? _poId}'),
                onDeleted: () => setState(() {
                  _poId = null;
                  _poNumber = null;
                }),
              )
            else
              const Text("Auto-load a PO's supplier & items into this GRN",
                  style:
                      TextStyle(fontSize: 12, color: AppColors.kTextSecondary)),
          ]),
          const SizedBox(height: 16),
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
                          onSelectionChanged: (s) {
                            setState(() => _scannerMode = s.first);
                            WidgetsBinding.instance
                                .addPostFrameCallback((_) => _focusScanner());
                          },
                        ),
                        const SizedBox(height: 16),
                        if (_scannerMode) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEFF6FF),
                              borderRadius: BorderRadius.circular(10),
                              border:
                                  Border.all(color: const Color(0xFFBFDBFE)),
                            ),
                            child: Row(children: [
                              Icon(
                                _isScanning
                                    ? Icons.sync
                                    : Icons.qr_code_scanner,
                                size: 18,
                                color: AppColors.kPrimary,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _scanStatus,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.kPrimary,
                                  ),
                                ),
                              ),
                              if (_lastScannedCode != null)
                                Text(
                                  _lastScannedCode!,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.kTextSecondary,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                            ]),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _barcodeCtrl,
                            focusNode: _scannerFocus,
                            autofocus: true,
                            enabled: !_isScanning,
                            textInputAction: TextInputAction.done,
                            inputFormatters: [
                              FilteringTextInputFormatter.deny(
                                RegExp(r'[\r\n\t]'),
                              ),
                            ],
                            onChanged: (value) {
                              if (value.contains('\n') ||
                                  value.contains('\r')) {
                                _scanBarcode();
                              }
                            },
                            onSubmitted: (_) => _scanBarcode(),
                            decoration: InputDecoration(
                              labelText: 'Scan barcode or enter SKU',
                              prefixIcon: const Icon(Icons.qr_code_2),
                              suffixIcon: IconButton(
                                onPressed: _isScanning ? null : _scanBarcode,
                                icon: _isScanning
                                    ? const SizedBox(
                                        width: 16,
                                        height: 16,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                        ),
                                      )
                                    : const Icon(Icons.add),
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              Chip(
                                avatar: const Icon(Icons.inventory_2, size: 16),
                                label: Text('${_scanned.length} lines'),
                              ),
                              Chip(
                                avatar: const Icon(Icons.add_task, size: 16),
                                label: Text(
                                  '${_plainNum(_scanned.fold<num>(0, (sum, row) => sum + _gnum(row['quantity_received'])))} received',
                                ),
                              ),
                            ],
                          ),
                        ] else ...[
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

// ── Search state lives here so _InventoryListSection stays a ConsumerWidget ──
class _InventorySearchBody extends StatefulWidget {
  const _InventorySearchBody({
    required this.allItems,
    required this.title,
    required this.emptyMessage,
    required this.onExportPdf,
    required this.onSyncStock,
    required this.onAddItem,
    required this.onEditItem,
    required this.onDeleteItem,
    required this.valuation,
    this.showValuationCards = false,
  });

  final List<Map<String, dynamic>> allItems;
  final String title;
  final String emptyMessage;
  final VoidCallback onExportPdf;
  final VoidCallback onSyncStock;
  final VoidCallback onAddItem;
  final void Function(Map<String, dynamic>) onEditItem;
  final void Function(Map<String, dynamic>) onDeleteItem;
  final Map<String, dynamic> valuation;
  final bool showValuationCards;

  @override
  State<_InventorySearchBody> createState() => _InventorySearchBodyState();
}

class _InventorySearchBodyState extends State<_InventorySearchBody> {
  final TextEditingController _searchCtrl = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(
        () => setState(() => _searchQuery = _searchCtrl.text.trim().toLowerCase()));
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> get _filtered {
    if (_searchQuery.isEmpty) return widget.allItems;
    return widget.allItems.where((item) {
      final name = _text(item, ['item_name', 'name', 'description']).toLowerCase();
      final sku = _text(item, ['sku']).toLowerCase();
      final cat = _text(item, ['category']).toLowerCase();
      return name.contains(_searchQuery) || sku.contains(_searchQuery) || cat.contains(_searchQuery);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final allItems = widget.allItems;
    final items = _filtered;
    final low = allItems
        .where((i) => _num(i, ['quantity']) <= _num(i, ['reorder_level', 'min_stock']))
        .length;
    final totalValue = allItems.fold<double>(
        0, (s, i) => s + (_num(i, ['quantity']) * _num(i, ['cost_price', 'unit_price'])));
    final v = widget.valuation;
    final foodValue = _num(v, ['foodstuffs_value', 'foodstuffsStoreValue', 'foodstuffs_store_value']);
    final barValue = _num(v, ['bar_store_value', 'barStoreValue', 'bar_value']);
    final grandValue = _num(v, ['grand_total', 'grandTotal', 'total_value', 'totalValue']);

    return Column(children: [
      Row(children: [
        Expanded(child: _StatCard(label: 'Total Items', value: '${allItems.length}', icon: PhosphorIcons.package(), color: AppColors.kPrimary)),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(label: 'Low Stock', value: '$low', icon: PhosphorIcons.warning(), color: Colors.orange)),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(label: 'Stock Value', value: _money(totalValue), icon: PhosphorIcons.currencyDollar(), color: Colors.green)),
      ]),
      if (widget.showValuationCards) ...[
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: _StatCard(label: 'Foodstuffs Store', value: _money(foodValue), icon: PhosphorIcons.cookingPot(), color: Colors.teal)),
          const SizedBox(width: 12),
          Expanded(child: _StatCard(label: 'Bar Store', value: _money(barValue), icon: PhosphorIcons.wine(), color: Colors.indigo)),
          const SizedBox(width: 12),
          Expanded(child: _StatCard(label: 'Grand Valuation', value: _money(grandValue == 0 ? totalValue : grandValue), icon: PhosphorIcons.currencyDollar(), color: AppColors.kAccent)),
        ]),
      ],
      const SizedBox(height: 20),
      Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextField(
          controller: _searchCtrl,
          decoration: InputDecoration(
            hintText: 'Search by name, SKU or category…',
            prefixIcon: const Icon(Icons.search, size: 18),
            suffixIcon: _searchQuery.isNotEmpty
                ? IconButton(icon: const Icon(Icons.clear, size: 16), onPressed: () => _searchCtrl.clear())
                : null,
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          ),
        ),
      ),
      _RowsCard(
        title: _searchQuery.isEmpty ? widget.title : '${items.length} of ${allItems.length} items',
        rows: items.take(200).toList(),
        emptyMessage: _searchQuery.isEmpty ? widget.emptyMessage : 'No items match "$_searchQuery"',
        trailing: Wrap(
          spacing: 8,
          children: [
            OutlinedButton.icon(onPressed: widget.onExportPdf, icon: const Icon(Icons.picture_as_pdf, size: 14), label: const Text('PDF / Print')),
            OutlinedButton.icon(onPressed: widget.onSyncStock, icon: const Icon(Icons.sync, size: 14), label: const Text('Sync Stock')),
            ElevatedButton.icon(onPressed: widget.onAddItem, icon: const Icon(Icons.add, size: 14), label: const Text('Add Item')),
          ],
        ),
        builder: (item) => _rowTile(
          icon: PhosphorIcons.package(),
          title: _text(item, ['item_name', 'name', 'description']),
          subtitle: '${_text(item, ['sku'])} • ${_text(item, ['category'])} • ${_text(item, ['unit_of_measure', 'unit'])}',
          trailing: Row(mainAxisSize: MainAxisSize.min, children: [
            Text('${_num(item, ['quantity']).toStringAsFixed(0)} in stock',
                style: const TextStyle(fontSize: 11, color: AppColors.kTextSecondary, fontWeight: FontWeight.w600)),
            const SizedBox(width: 8),
            IconButton(tooltip: 'Edit', icon: const Icon(Icons.edit_outlined, size: 18), onPressed: () => widget.onEditItem(item)),
            IconButton(tooltip: 'Delete', icon: const Icon(Icons.delete_outline, size: 18), color: Colors.red, onPressed: () => widget.onDeleteItem(item)),
          ]),
        ),
      ),
    ]);
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
          data: (allItems) {
            return _InventorySearchBody(
              allItems: allItems,
              title: title,
              emptyMessage: emptyMessage,
              valuation: valuationAsync?.valueOrNull ?? const {},
              showValuationCards: valuationAsync != null,
              onExportPdf: () => _exportPdf(context, allItems),
              onSyncStock: () async {
                try {
                  final result = await ref.read(adminRepositoryProvider).backfillGRNStock();
                  final created = result['created'] ?? 0;
                  final updated = result['updated'] ?? 0;
                  if (context.mounted) {
                    AppNotifier.show(context, 'Stock synced — $created new, $updated updated');
                    _refresh(ref);
                  }
                } catch (e) {
                  if (context.mounted) {
                    AppNotifier.show(context, apiErrorMessage(e, fallback: 'Sync failed'), isError: true);
                  }
                }
              },
              onAddItem: () => _showItemDialog(context, ref),
              onEditItem: (item) => _showItemDialog(context, ref, item: item),
              onDeleteItem: (item) => _deleteItem(context, ref, item),
            );
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
        await repo.updateStoreItem(_text(item!, ['sku', 'id']), body); // item non-null when isEdit=true
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
        title: 'Approved Requisitions',
        subtitle:
            'Auditor-approved branch stock requests ready for central fulfillment',
        icon: PhosphorIcons.clipboardText(),
        child: _LiveRows(
          value: ref.watch(centralApprovedStoreRequestsProvider),
          data: (rows) {
            final ready = rows
                .where((row) => ['APPROVED', 'PARTIALLY_APPROVED']
                    .contains(_text(row, ['status']).toUpperCase()))
                .length;
            return Column(children: [
              Row(children: [
                Expanded(
                    child: _StatCard(
                        label: 'Ready for Packing',
                        value: '$ready',
                        icon: PhosphorIcons.package(),
                        color: Colors.green)),
                const SizedBox(width: 12),
                Expanded(
                    child: _StatCard(
                        label: 'Auditor Approved',
                        value: '${rows.length}',
                        icon: PhosphorIcons.shieldCheck(),
                        color: Colors.green)),
                const SizedBox(width: 12),
                Expanded(
                    child: _StatCard(
                        label: 'Approved Requests',
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
        ElevatedButton(
          onPressed: () {
            Navigator.pop(context);
            ref.read(adminSectionProvider.notifier).state =
                AdminSection.packing;
          },
          child: const Text('Open Packing'),
        ),
      ],
    );
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
          value: ref.watch(centralApprovedStoreRequestsProvider),
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
      if (context.mounted) {
        await _showActionError(
          context,
          title: 'Dispatch note could not be created',
          error: error,
        );
      }
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
      if (context.mounted) {
        await _showActionError(
          context,
          title: 'Dispatch blocked',
          error: error,
        );
      }
    }
  }
}

class PurchaseOrdersSection extends ConsumerStatefulWidget {
  const PurchaseOrdersSection({super.key});

  @override
  ConsumerState<PurchaseOrdersSection> createState() =>
      _PurchaseOrdersSectionState();
}

class _PurchaseOrdersSectionState extends ConsumerState<PurchaseOrdersSection> {
  bool _creating = false;
  bool _saving = false;
  bool _printingPdf = false;
  String _search = '';
  String _statusFilter = 'all';
  String? _listSupplierId;
  String? _editingPoId;
  String? _editingPoNumber;
  String? _supplierId;
  String _paymentTerms = 'credit_30_days';
  DateTime _poDate = DateTime.now();
  DateTime? _expectedDate;
  final _bulkController = TextEditingController();
  final _notesController = TextEditingController();
  final List<_ParsedPurchaseOrderItem> _parsedItems = [];

  @override
  void dispose() {
    _bulkController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _LiveSection(
        title: 'Purchase Orders',
        subtitle: _creating
            ? _editingPoId == null
                ? 'Create supplier purchase orders with bulk item paste'
                : 'Edit draft purchase order with bulk item correction'
            : 'Central-store supplier purchase orders',
        icon: PhosphorIcons.fileText(),
        child: _LiveRows(
          value: ref.watch(centralPurchaseOrdersProvider),
          data: (rows) {
            final suppliers = ref.watch(centralStoreSuppliersProvider);
            final items = ref.watch(centralStoreItemsProvider);
            if (_creating) {
              return Column(children: [
                _supplierWorkflowTabs(ref, AdminSection.purchaseOrders),
                const SizedBox(height: 16),
                _createView(
                  suppliers.valueOrNull ?? const [],
                  items.valueOrNull ?? const [],
                ),
              ]);
            }
            final pending = rows
                .where((row) =>
                    _text(row, ['status']).toLowerCase().contains('pending'))
                .length;
            final filtered = rows.where((row) {
              final q = _search.trim().toLowerCase();
              final status = _text(row, ['status'], 'draft').toLowerCase();
              final supplier = _text(row, ['supplier_name']).toLowerCase();
              final poNumber = _text(row, ['po_number', 'id']).toLowerCase();
              final branch = _text(row, ['branch_name']).toLowerCase();
              final matchesSearch = q.isEmpty ||
                  poNumber.contains(q) ||
                  supplier.contains(q) ||
                  branch.contains(q);
              final matchesStatus = _statusFilter == 'all' ||
                  status == _statusFilter ||
                  (_statusFilter == 'received' &&
                      (status == 'fully_received' ||
                          status == 'partially_received')) ||
                  (_statusFilter == 'history' &&
                      (status == 'fully_received' ||
                          status == 'partially_received' ||
                          status == 'closed' ||
                          status == 'cancelled'));
              final matchesSupplier = _listSupplierId == null ||
                  _text(row, ['supplier_id'], '') == _listSupplierId;
              return matchesSearch && matchesStatus && matchesSupplier;
            }).toList();
            return Column(children: [
              _supplierWorkflowTabs(ref, AdminSection.purchaseOrders),
              const SizedBox(height: 16),
              Row(children: [
                Expanded(
                  child: TextField(
                    decoration: const InputDecoration(
                      hintText: 'Search PO, supplier, branch',
                      prefixIcon: Icon(Icons.search),
                      contentPadding: EdgeInsets.zero,
                    ),
                    onChanged: (value) => setState(() => _search = value),
                  ),
                ),
                const SizedBox(width: 12),
                SizedBox(
                  width: 180,
                  child: DropdownButtonFormField<String>(
                    isExpanded: true,
                    initialValue: _statusFilter,
                    decoration: const InputDecoration(labelText: 'Status'),
                    items: const [
                      DropdownMenuItem(value: 'all', child: Text('All')),
                      DropdownMenuItem(value: 'draft', child: Text('Draft')),
                      DropdownMenuItem(
                          value: 'pending', child: Text('Pending')),
                      DropdownMenuItem(
                          value: 'approved', child: Text('Approved')),
                      DropdownMenuItem(
                          value: 'sent_to_supplier',
                          child: Text('Sent to Supplier')),
                      DropdownMenuItem(
                          value: 'received',
                          child: Text('Received / Archived')),
                      DropdownMenuItem(
                          value: 'history', child: Text('History')),
                      DropdownMenuItem(
                          value: 'cancelled', child: Text('Cancelled')),
                    ],
                    onChanged: (value) =>
                        setState(() => _statusFilter = value ?? 'all'),
                  ),
                ),
                const SizedBox(width: 12),
                SizedBox(
                  width: 220,
                  child: DropdownButtonFormField<String?>(
                    isExpanded: true,
                    initialValue: _listSupplierId,
                    decoration: const InputDecoration(labelText: 'Supplier'),
                    items: [
                      const DropdownMenuItem<String?>(
                          value: null, child: Text('All suppliers')),
                      ...((suppliers.valueOrNull ?? const [])
                          .map((supplier) => DropdownMenuItem<String?>(
                                value: _id(supplier),
                                child: Text(
                                  _text(supplier, ['name', 'supplier_name']),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ))),
                    ],
                    onChanged: (value) =>
                        setState(() => _listSupplierId = value),
                  ),
                ),
                const SizedBox(width: 12),
                ElevatedButton.icon(
                  onPressed: () => setState(() => _creating = true),
                  icon: const Icon(Icons.add, size: 16),
                  label: const Text('Create PO'),
                ),
              ]),
              const SizedBox(height: 16),
              Row(children: [
                Expanded(
                    child: _StatCard(
                        label: 'Open POs',
                        value: '${filtered.length}',
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
                        value: _money(filtered.fold<double>(
                            0,
                            (sum, row) =>
                                sum + _num(row, ['total_amount', 'total']))),
                        icon: PhosphorIcons.currencyDollar(),
                        color: Colors.green)),
              ]),
              const SizedBox(height: 20),
              _RowsCard(
                title: 'Purchase Orders',
                rows: filtered,
                emptyMessage: 'No purchase orders found',
                builder: (row) {
                  final status = _text(row, ['status'], 'draft');
                  return _rowTile(
                    icon: PhosphorIcons.fileText(),
                    title: _text(row, ['po_number', 'id']),
                    subtitle: '${_text(row, [
                          'supplier_name'
                        ])} • ${_date(row['created_at'] ?? row['order_date'])}',
                    trailingMaxWidth: 560,
                    trailing: _purchaseOrderActions(context, ref, row, status),
                  );
                },
              ),
            ]);
          },
        ),
      );

  Widget _purchaseOrderActions(
    BuildContext context,
    WidgetRef ref,
    Map<String, dynamic> row,
    String status,
  ) {
    final lowerStatus = status.toLowerCase();
    final isDraft = lowerStatus == 'draft';
    final canApprove = lowerStatus.contains('pending') || isDraft;
    final isApproved = lowerStatus.contains('approved');
    final canReject = !lowerStatus.contains('cancel');

    return Wrap(
      alignment: WrapAlignment.end,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 4,
      runSpacing: 4,
      children: [
        _poStatusPill(status),
        _poActionButton(
          label: 'View',
          width: 68,
          onPressed: () => _showPurchaseOrderDetails(context, row),
        ),
        _poActionButton(
          label: 'Print',
          width: 68,
          onPressed: () async {
            try {
              final detail = await ref
                  .read(adminRepositoryProvider)
                  .getPurchaseOrder(_id(row));
              if (mounted) await _printPurchaseOrderPdf(detail);
            } catch (error) {
              if (mounted) _snack(this.context, 'Failed to print PO: $error');
            }
          },
        ),
        if (isDraft)
          _poActionButton(
            label: 'Edit',
            width: 64,
            onPressed: () => _editDraftPurchaseOrder(row),
          ),
        if (canApprove)
          _poActionButton(
            label: 'Approve',
            width: 88,
            primary: true,
            onPressed: () => _poAction(context, ref, row, 'approve'),
          ),
        if (isApproved)
          _poActionButton(
            label: 'Send',
            width: 68,
            onPressed: () => _poAction(context, ref, row, 'send'),
          ),
        if (isApproved)
          _poActionButton(
            label: 'Receive',
            width: 82,
            primary: true,
            onPressed: () {
              ref.read(grnPreloadPoIdProvider.notifier).state = _id(row);
              ref.read(adminSectionProvider.notifier).state =
                  AdminSection.goodsReceiving;
            },
          ),
        if (canReject)
          _poActionButton(
            label: 'Reject',
            width: 76,
            destructive: true,
            onPressed: () => _poAction(context, ref, row, 'cancel'),
          ),
      ],
    );
  }

  Widget _poStatusPill(String status) {
    final color = _statusColor(status);
    return Container(
      height: 32,
      constraints: const BoxConstraints(minWidth: 88, maxWidth: 132),
      padding: const EdgeInsets.symmetric(horizontal: 10),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.22)),
      ),
      child: Text(
        _statusLabel(status).toUpperCase(),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _poActionButton({
    required String label,
    required double width,
    required VoidCallback onPressed,
    bool primary = false,
    bool destructive = false,
  }) {
    final foreground = destructive ? Colors.red.shade700 : AppColors.kPrimary;
    final sideColor = destructive
        ? Colors.red.shade300
        : AppColors.kPrimary.withValues(alpha: 0.45);
    const textStyle = TextStyle(
      fontSize: 13,
      fontWeight: FontWeight.w700,
    );
    final child = Text(
      label,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );

    if (primary) {
      return SizedBox(
        width: width,
        height: 32,
        child: ElevatedButton(
          onPressed: onPressed,
          style: ElevatedButton.styleFrom(
            padding: EdgeInsets.zero,
            textStyle: textStyle,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            visualDensity: VisualDensity.compact,
            shape: const StadiumBorder(),
          ),
          child: child,
        ),
      );
    }

    return SizedBox(
      width: width,
      height: 32,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: foreground,
          side: BorderSide(color: sideColor),
          padding: EdgeInsets.zero,
          textStyle: textStyle,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          visualDensity: VisualDensity.compact,
          shape: const StadiumBorder(),
        ),
        child: child,
      ),
    );
  }

  Widget _createView(
    List<Map<String, dynamic>> suppliers,
    List<Map<String, dynamic>> inventory,
  ) {
    final validItems =
        _parsedItems.where((item) => item.error == null).toList();
    final total = validItems.fold<num>(0, (sum, item) => sum + item.total);
    final hasErrors = _parsedItems.any((item) => item.error != null);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        OutlinedButton.icon(
          onPressed: _saving
              ? null
              : () => setState(() {
                    _creating = false;
                    _resetCreateForm();
                  }),
          icon: const Icon(Icons.arrow_back, size: 16),
          label: const Text('Back to PO list'),
        ),
        const Spacer(),
        Text(
          '${validItems.length} valid lines · ${_money(total)}',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ]),
      const SizedBox(height: 12),
      Text(
        _editingPoId == null
            ? 'New Purchase Order'
            : 'Editing Draft ${_editingPoNumber ?? _editingPoId}',
        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
      ),
      const SizedBox(height: 16),
      Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: LayoutBuilder(builder: (context, constraints) {
            final width = constraints.maxWidth < 760
                ? constraints.maxWidth
                : (constraints.maxWidth - 12) / 2;
            return Wrap(spacing: 12, runSpacing: 12, children: [
              SizedBox(
                width: width,
                child: _SupplierSearchField(
                  suppliers: suppliers,
                  selectedSupplierId: _supplierId,
                  onSelected: (supplier) =>
                      setState(() => _supplierId = _id(supplier)),
                  onCleared: () => setState(() => _supplierId = null),
                ),
              ),
              SizedBox(
                width: width,
                child: _PoDateField(
                  label: 'PO Date',
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
                width: width,
                child: _PoDateField(
                  label: 'Expected Delivery',
                  value: _expectedDate,
                  firstDate: _poDate,
                  onPicked: (date) => setState(() => _expectedDate = date),
                ),
              ),
              SizedBox(
                width: width,
                child: DropdownButtonFormField<String>(
                  isExpanded: true,
                  initialValue: _paymentTerms,
                  decoration: const InputDecoration(labelText: 'Payment Terms'),
                  items: const [
                    DropdownMenuItem(value: 'cash', child: Text('Cash')),
                    DropdownMenuItem(
                        value: 'credit_7_days', child: Text('Credit 7 days')),
                    DropdownMenuItem(
                        value: 'credit_15_days', child: Text('Credit 15 days')),
                    DropdownMenuItem(
                        value: 'credit_30_days', child: Text('Credit 30 days')),
                    DropdownMenuItem(
                        value: 'credit_45_days', child: Text('Credit 45 days')),
                    DropdownMenuItem(
                        value: 'credit_60_days', child: Text('Credit 60 days')),
                    DropdownMenuItem(
                        value: 'credit_90_days', child: Text('Credit 90 days')),
                    DropdownMenuItem(
                        value: 'advance_payment',
                        child: Text('Advance payment')),
                  ],
                  onChanged: (value) =>
                      setState(() => _paymentTerms = value ?? _paymentTerms),
                ),
              ),
              SizedBox(
                width: constraints.maxWidth,
                child: TextField(
                  controller: _notesController,
                  minLines: 2,
                  maxLines: 3,
                  decoration:
                      const InputDecoration(labelText: 'Remarks / Notes'),
                ),
              ),
            ]);
          }),
        ),
      ),
      const SizedBox(height: 16),
      Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              const Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Bulk Item Entry',
                          style: TextStyle(
                              fontWeight: FontWeight.w800, fontSize: 15)),
                      Text(
                        'Paste lines like "KC PINEAPPLE 750ML, 120, PCS" or "FANTA ORANGE 500ML 50 PCS".',
                        style: TextStyle(
                            color: AppColors.kTextSecondary, fontSize: 12),
                      ),
                    ]),
              ),
              OutlinedButton.icon(
                onPressed: () => _parseBulkItems(inventory),
                icon: const Icon(Icons.auto_fix_high, size: 16),
                label: const Text('Parse Items'),
              ),
            ]),
            const SizedBox(height: 12),
            TextField(
              controller: _bulkController,
              minLines: 6,
              maxLines: 10,
              decoration: const InputDecoration(
                alignLabelWithHint: true,
                labelText: 'Paste items',
                hintText:
                    'KC PINEAPPLE 750ML, 120, PCS\nFANTA ORANGE 500ML 50 PCS\nMILK 1L - 80 - PACKS\nSUGAR 2KG | 30 | BAGS',
              ),
            ),
          ]),
        ),
      ),
      const SizedBox(height: 16),
      Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              const Expanded(
                  child: Text('Parsed Items',
                      style: TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 15))),
              Text(
                hasErrors
                    ? 'Fix invalid rows before saving'
                    : '${validItems.length} rows ready',
                style: TextStyle(
                  color: hasErrors ? Colors.red : Colors.green,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ]),
            const SizedBox(height: 12),
            if (_parsedItems.isEmpty)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(
                    child: Text('No parsed items yet',
                        style: TextStyle(color: AppColors.kTextSecondary))),
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
                      .map((item) => _parsedItemRow(item, inventory))
                      .toList(),
                ),
              ),
          ]),
        ),
      ),
      const SizedBox(height: 16),
      Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            Text('Grand Total: ${_money(total)}',
                style:
                    const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
            const Spacer(),
            OutlinedButton(
                onPressed: (_saving || _printingPdf)
                    ? null
                    : () => setState(_resetCreateForm),
                child: const Text('Clear')),
            const SizedBox(width: 8),
            ElevatedButton.icon(
              onPressed: (_saving || _printingPdf)
                  ? null
                  : () => _savePurchaseOrder(false),
              icon: const Icon(Icons.save, size: 16),
              label: Text(_printingPdf
                  ? 'Opening PDF...'
                  : _saving
                      ? 'Saving...'
                      : _editingPoId == null
                          ? 'Save Draft'
                          : 'Update Draft'),
            ),
            const SizedBox(width: 8),
            ElevatedButton.icon(
              onPressed: (_saving || _printingPdf)
                  ? null
                  : () => _savePurchaseOrder(true),
              icon: const Icon(Icons.check_circle_outline, size: 16),
              label: Text(_printingPdf
                  ? 'Opening PDF...'
                  : _saving
                      ? 'Submitting...'
                      : 'Submit / Approve'),
            ),
          ]),
        ),
      ),
    ]);
  }

  DataRow _parsedItemRow(
      _ParsedPurchaseOrderItem item, List<Map<String, dynamic>> inventory) {
    final hasError = item.error != null;
    return DataRow(
      color: WidgetStateProperty.resolveWith(
          (_) => hasError ? Colors.red.withValues(alpha: .06) : null),
      cells: [
        DataCell(SizedBox(
          width: 240,
          child: TextFormField(
            key: ValueKey('${item.key}-name'),
            initialValue: item.itemName,
            decoration: const InputDecoration(border: InputBorder.none),
            onChanged: (value) => setState(() {
              item.itemName = value;
              _resolveItem(item, inventory);
              _validateItems();
            }),
          ),
        )),
        DataCell(SizedBox(
          width: 190,
          child: item.sku == null
              ? _suggestionButton(item, inventory, compact: true)
              : Text(item.sku!, overflow: TextOverflow.ellipsis),
        )),
        DataCell(SizedBox(
          width: 80,
          child: TextFormField(
            key: ValueKey('${item.key}-qty'),
            initialValue: item.quantity == 0 ? '' : _plainNum(item.quantity),
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(border: InputBorder.none),
            onChanged: (value) => setState(() {
              item.quantity = num.tryParse(value) ?? 0;
              _validateItems();
            }),
          ),
        )),
        DataCell(SizedBox(
          width: 86,
          child: TextFormField(
            key: ValueKey('${item.key}-unit'),
            initialValue: item.unit,
            decoration: const InputDecoration(border: InputBorder.none),
            onChanged: (value) => setState(() {
              item.unit = value.toUpperCase();
              _validateItems();
            }),
          ),
        )),
        DataCell(SizedBox(
          width: 100,
          child: TextFormField(
            key: ValueKey('${item.key}-cost'),
            initialValue: item.unitCost == 0 ? '' : _plainNum(item.unitCost),
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(border: InputBorder.none),
            onChanged: (value) => setState(() {
              item.unitCost = num.tryParse(value) ?? 0;
              _validateItems();
            }),
          ),
        )),
        DataCell(Text(_money(item.total))),
        DataCell(_validationCell(item, inventory)),
        DataCell(IconButton(
          tooltip: 'Remove row',
          icon: const Icon(Icons.close, size: 18),
          onPressed: () => setState(() {
            _parsedItems.remove(item);
            _validateItems();
          }),
        )),
      ],
    );
  }

  Widget _validationCell(
      _ParsedPurchaseOrderItem item, List<Map<String, dynamic>> inventory) {
    final hasError = item.error != null;
    return SizedBox(
      width: 260,
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Flexible(
          child: Text(
            item.error ?? 'Ready',
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: hasError ? Colors.red : Colors.green,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        if (hasError &&
            (item.error == 'No matching inventory SKU' ||
                item.error == 'Unit is required' ||
                item.error == 'Invalid unit')) ...[
          const SizedBox(width: 8),
          _suggestionButton(item, inventory),
        ],
      ]),
    );
  }

  Widget _suggestionButton(
    _ParsedPurchaseOrderItem item,
    List<Map<String, dynamic>> inventory, {
    bool compact = false,
  }) {
    final suggestions = _inventorySuggestions(item.itemName, inventory);
    if (suggestions.isEmpty) {
      return Text(
        compact ? 'Search match' : 'No suggestion',
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(
          color: AppColors.kTextSecondary,
          fontSize: 12,
        ),
      );
    }
    return PopupMenuButton<String>(
      tooltip: 'Choose matching inventory item',
      onSelected: (sku) {
        final match = suggestions.firstWhere(
          (row) => _itemSku(row) == sku,
          orElse: () => suggestions.first,
        );
        setState(() {
          _applyInventorySuggestion(item, match);
          _validateItems();
        });
      },
      itemBuilder: (context) => suggestions
          .map((row) => PopupMenuItem<String>(
                value: _itemSku(row),
                child: SizedBox(
                  width: 320,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_itemName(row),
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                      Text(
                        '${_itemSku(row)} • ${_itemUnit(row).isEmpty ? 'No unit' : _itemUnit(row)}',
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.kTextSecondary,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ))
          .toList(),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.search, size: compact ? 15 : 16, color: AppColors.kPrimary),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            compact ? 'Find SKU' : 'Did you mean?',
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.kPrimary,
              fontSize: 12,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ]),
    );
  }

  List<Map<String, dynamic>> _inventorySuggestions(
      String query, List<Map<String, dynamic>> inventory) {
    final normalized = _normalizePoItemName(query);
    if (normalized.isEmpty) return inventory.take(8).toList();
    final scored = <({Map<String, dynamic> row, int score})>[];
    final queryTokens = normalized.split(' ').where((part) => part.length > 1);
    for (final row in inventory) {
      final sku = _itemSku(row).toLowerCase();
      final name = _normalizePoItemName(_itemName(row));
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
    return scored.map((entry) => entry.row).take(8).toList();
  }

  void _applyInventorySuggestion(
      _ParsedPurchaseOrderItem item, Map<String, dynamic> match) {
    item.sku = _itemSku(match);
    item.itemName = _itemName(match);
    final unit = _itemUnit(match);
    if (unit.isNotEmpty) item.unit = unit;
  }

  String _itemSku(Map<String, dynamic> row) =>
      _text(row, ['sku', 'item_sku', 'id'], '');

  String _itemName(Map<String, dynamic> row) =>
      _text(row, ['item_name', 'name', 'description'], '');

  String _itemUnit(Map<String, dynamic> row) =>
      _text(row, ['unit_of_measure', 'unit'], '').toUpperCase();

  void _parseBulkItems(List<Map<String, dynamic>> inventory) {
    final lines = _bulkController.text
        .split('\n')
        .map((line) => line.trim())
        .where((line) => line.isNotEmpty)
        .toList();
    if (lines.isEmpty) {
      _snack(context, 'Paste at least one item line');
      return;
    }
    setState(() {
      _parsedItems
        ..clear()
        ..addAll(lines.indexed.map((entry) {
          final item = _parseLine(entry.$2, entry.$1);
          _resolveItem(item, inventory);
          return item;
        }));
      _validateItems();
    });
  }

  _ParsedPurchaseOrderItem _parseLine(String line, int index) {
    final clean = line.replaceAll(RegExp(r'\s+'), ' ').trim();
    List<String> parts = const [];
    if (clean.contains(',')) {
      parts = clean.split(',').map((part) => part.trim()).toList();
    } else if (clean.contains('|')) {
      parts = clean.split('|').map((part) => part.trim()).toList();
    } else if (clean.contains(' - ')) {
      parts =
          clean.split(RegExp(r'\s+-\s+')).map((part) => part.trim()).toList();
    }

    if (parts.length >= 2) {
      return _ParsedPurchaseOrderItem(
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
      return _ParsedPurchaseOrderItem(
        key: '${DateTime.now().microsecondsSinceEpoch}-$index',
        sourceLine: line,
        itemName: match.group(1)?.trim() ?? '',
        quantity: num.tryParse(match.group(2) ?? '') ?? 0,
        unit: (match.group(3) ?? '').toUpperCase(),
      );
    }

    return _ParsedPurchaseOrderItem(
      key: '${DateTime.now().microsecondsSinceEpoch}-$index',
      sourceLine: line,
      itemName: clean,
      quantity: 0,
      unit: '',
      error: 'Could not read quantity',
    );
  }

  void _resolveItem(
      _ParsedPurchaseOrderItem parsed, List<Map<String, dynamic>> inventory) {
    final match = _findInventoryItem(parsed.itemName, inventory);
    parsed.sku = match == null ? null : _text(match, ['sku', 'item_sku', 'id']);
    if (match != null) {
      parsed.itemName = _text(match, ['item_name', 'name', 'description']);
      if (parsed.unit.trim().isEmpty) {
        parsed.unit =
            _text(match, ['unit_of_measure', 'unit'], '').toUpperCase();
      }
    }
  }

  Map<String, dynamic>? _findInventoryItem(
      String value, List<Map<String, dynamic>> inventory) {
    final normalized = _normalizePoItemName(value);
    for (final item in inventory) {
      if (_text(item, ['sku', 'item_sku'], '').toLowerCase() ==
          value.toLowerCase()) {
        return item;
      }
      if (_normalizePoItemName(
              _text(item, ['item_name', 'name', 'description'])) ==
          normalized) {
        return item;
      }
    }
    for (final item in inventory) {
      final itemName = _normalizePoItemName(
          _text(item, ['item_name', 'name', 'description']));
      if (itemName.contains(normalized) || normalized.contains(itemName)) {
        return item;
      }
    }
    return null;
  }

  void _validateItems() {
    final seen = <String>{};
    for (final item in _parsedItems) {
      String? error;
      if (item.error == 'Could not read quantity' && item.quantity <= 0) {
        error = item.error;
      } else if (item.itemName.trim().isEmpty) {
        error = 'Item name is required';
      } else if (item.quantity <= 0) {
        error = 'Quantity must be greater than zero';
      } else if (item.sku == null || item.sku!.trim().isEmpty) {
        error = 'No matching inventory SKU';
      } else if (item.unit.trim().isEmpty) {
        error = 'Unit is required';
      } else if (!_poValidUnits.contains(item.unit.trim().toUpperCase())) {
        error = 'Invalid unit';
      } else if (item.unitCost < 0) {
        error = 'Unit cost cannot be negative';
      }
      final duplicateKey =
          '${item.sku ?? _normalizePoItemName(item.itemName)}:${item.unit.toUpperCase()}';
      if (error == null && seen.contains(duplicateKey)) {
        error = 'Duplicate item/unit row';
      }
      seen.add(duplicateKey);
      item.error = error;
    }
  }

  Future<void> _savePurchaseOrder(bool approveNow) async {
    _validateItems();
    if (_supplierId == null || _supplierId!.isEmpty) {
      _snack(context, 'Select a supplier');
      return;
    }
    if (_expectedDate != null && _expectedDate!.isBefore(_poDate)) {
      _snack(context, 'Expected delivery cannot be before PO date');
      return;
    }
    if (_parsedItems.isEmpty ||
        _parsedItems.any((item) => item.error != null)) {
      _snack(context, 'Fix invalid item rows before saving');
      return;
    }

    setState(() => _saving = true);
    try {
      final Map<String, dynamic> payload = {
        'supplier_id': _supplierId,
        'po_date': _isoDate(_poDate),
        if (_expectedDate != null)
          'expected_delivery_date': _isoDate(_expectedDate!),
        'payment_terms': _paymentTerms,
        'delivery_terms': 'Central Store',
        if (_notesController.text.trim().isNotEmpty)
          'special_instructions': _notesController.text.trim(),
        'auto_approve': approveNow,
        'items': _parsedItems
            .map((item) => {
                  'item_id': item.sku,
                  'quantity': item.quantity,
                  'unit_price': item.unitCost,
                  'tax_amount': 0,
                  'total_price': item.total,
                })
            .toList(),
      };
      final repo = ref.read(adminRepositoryProvider);
      final savedPo = _editingPoId == null
          ? await repo.createPurchaseOrder({
              ...payload,
              'auto_approve': approveNow,
            })
          : await repo.updatePurchaseOrder(_editingPoId!, payload);
      if (_editingPoId != null && approveNow) {
        await repo.approvePurchaseOrder(_editingPoId!);
      }
      if (!mounted) return;
      _refreshCentralStore(ref);
      await _printPurchaseOrderPdf(_poForPdf(savedPo));
      if (!mounted) return;
      _snack(
          context,
          approveNow
              ? 'PO submitted and PDF opened'
              : 'Draft PO saved and PDF opened');
      setState(() {
        _creating = false;
        _resetCreateForm();
      });
    } catch (error) {
      if (mounted) _snack(context, 'Failed: $error');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _resetCreateForm() {
    _editingPoId = null;
    _editingPoNumber = null;
    _supplierId = null;
    _paymentTerms = 'credit_30_days';
    _poDate = DateTime.now();
    _expectedDate = null;
    _bulkController.clear();
    _notesController.clear();
    _parsedItems.clear();
  }

  Future<void> _editDraftPurchaseOrder(Map<String, dynamic> row) async {
    try {
      final detail =
          await ref.read(adminRepositoryProvider).getPurchaseOrder(_id(row));
      final items =
          (detail['items'] is List ? detail['items'] as List : const [])
              .whereType<Map>()
              .map((item) => item.cast<String, dynamic>())
              .toList();
      setState(() {
        _editingPoId = _id(detail).isEmpty ? _id(row) : _id(detail);
        _editingPoNumber = _text(detail, ['po_number', 'id']);
        _supplierId = _text(detail, ['supplier_id'], '');
        if (_supplierId!.isEmpty) _supplierId = null;
        _poDate =
            DateTime.tryParse(_text(detail, ['po_date'], '')) ?? DateTime.now();
        _expectedDate =
            DateTime.tryParse(_text(detail, ['expected_delivery_date'], ''));
        _paymentTerms = _text(detail, ['payment_terms'], 'credit_30_days');
        _notesController.text = _text(detail, ['special_instructions'], '');
        _bulkController.clear();
        _parsedItems
          ..clear()
          ..addAll(items.indexed.map((entry) {
            final item = entry.$2;
            final parsed = _ParsedPurchaseOrderItem(
              key: 'edit-${DateTime.now().microsecondsSinceEpoch}-${entry.$1}',
              sourceLine: _text(item, ['item_name', 'item_id']),
              itemName: _text(item, ['item_name', 'description', 'item_id']),
              quantity: _num(item, ['quantity_ordered', 'quantity']),
              unit: _text(item, ['unit_of_measure', 'unit'], '').toUpperCase(),
            );
            parsed.sku = _text(item, ['item_id', 'sku'], '');
            parsed.unitCost = _num(item, ['unit_price']);
            return parsed;
          }));
        _creating = true;
        _validateItems();
      });
    } catch (error) {
      if (mounted) _snack(context, 'Failed to load draft PO: $error');
    }
  }

  Map<String, dynamic> _poForPdf(Map<String, dynamic> savedPo) {
    final suppliers = ref.read(centralStoreSuppliersProvider).valueOrNull ??
        const <Map<String, dynamic>>[];
    final supplier = suppliers.firstWhere(
      (row) => _id(row) == _supplierId,
      orElse: () => const <String, dynamic>{},
    );
    final total = _parsedItems.fold<num>(0, (sum, item) => sum + item.total);
    return {
      ...savedPo,
      'po_number': _text(savedPo, ['po_number', 'purchase_order_number'],
          _editingPoNumber ?? ''),
      'po_date': _isoDate(_poDate),
      'expected_delivery_date':
          _expectedDate == null ? null : _isoDate(_expectedDate!),
      'supplier': supplier,
      'supplier_name': _text(supplier, ['name', 'supplier_name']),
      'branch': const <String, dynamic>{},
      'total_amount': total,
      'subtotal': total,
      'tax_amount': 0,
      'special_instructions': _notesController.text.trim(),
      'items': _parsedItems
          .map((item) => {
                'item_id': item.sku,
                'item_name': item.itemName,
                'quantity_ordered': item.quantity,
                'unit_of_measure': item.unit,
                'unit_price': item.unitCost,
                'total_price': item.total,
              })
          .toList(),
    };
  }

  Future<void> _printPurchaseOrderPdf(Map<String, dynamic> po) async {
    setState(() => _printingPdf = true);
    try {
      final bytes = await _buildPurchaseOrderPdfBytes(po);
      await Printing.layoutPdf(
        name: '${_text(po, ['po_number', 'id'], 'purchase_order')}.pdf',
        onLayout: (_) async => bytes,
      );
    } finally {
      if (mounted) setState(() => _printingPdf = false);
    }
  }

  Future<Uint8List> _buildPurchaseOrderPdfBytes(Map<String, dynamic> po) async {
    final doc = pw.Document();
    final logo = await _loadPoPdfLogo();
    final supplier = po['supplier'] is Map
        ? (po['supplier'] as Map).cast<String, dynamic>()
        : const <String, dynamic>{};
    final branch = po['branch'] is Map
        ? (po['branch'] as Map).cast<String, dynamic>()
        : const <String, dynamic>{};
    final items = (po['items'] is List ? po['items'] as List : const [])
        .whereType<Map>()
        .map((item) => item.cast<String, dynamic>())
        .toList();
    final poNumber = _text(po, ['po_number', 'id'], 'DRAFT');
    final supplierName = _text(po, ['supplier_name'], '').isNotEmpty
        ? _text(po, ['supplier_name'])
        : _text(supplier, ['name', 'supplier_name'], 'Supplier');
    const primary = PdfColor.fromInt(0xFF2C3E50);
    const muted = PdfColor.fromInt(0xFF666666);
    const border = PdfColor.fromInt(0xFFD6D6D6);
    const lightRow = PdfColor.fromInt(0xFFF3F3F3);

    final tableRows = items.map((item) {
      final qty = _num(item, ['quantity_ordered', 'quantity']);
      final price = _num(item, ['unit_price']);
      final total = _num(item, ['total_price', 'total']);
      return [
        _text(item, ['item_name', 'description', 'item_id'], 'Item'),
        _plainNum(qty),
        _pdfMoney(price),
        _pdfMoney(total == 0 ? qty * price : total),
      ];
    }).toList();

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.fromLTRB(42, 40, 42, 42),
        footer: (context) => pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Expanded(
              child: pw.Text(
                'FamousGate Hotels - Procurement System',
                textAlign: pw.TextAlign.center,
                style:
                    const pw.TextStyle(fontSize: 8, color: PdfColors.grey600),
              ),
            ),
            pw.Text(
              'Page ${context.pageNumber} of ${context.pagesCount}',
              style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600),
            ),
          ],
        ),
        build: (context) => [
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              if (logo != null)
                pw.Image(logo, width: 86, height: 86, fit: pw.BoxFit.contain)
              else
                pw.Container(
                  width: 86,
                  height: 86,
                  alignment: pw.Alignment.center,
                  decoration:
                      pw.BoxDecoration(border: pw.Border.all(color: border)),
                  child: pw.Text('FG',
                      style: pw.TextStyle(
                          fontSize: 24, fontWeight: pw.FontWeight.bold)),
                ),
              pw.Spacer(),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text(
                    'PURCHASE ORDER',
                    style: pw.TextStyle(
                      fontSize: 20,
                      color: primary,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                  pw.SizedBox(height: 12),
                  pw.Text('FamousGate Hotels',
                      style: const pw.TextStyle(fontSize: 10, color: muted)),
                  pw.Text(
                      _text(branch, ['name', 'branch_name'], 'Bomet, Kenya'),
                      style: const pw.TextStyle(fontSize: 10, color: muted)),
                  pw.Text(_text(branch, ['phone'], '0706782828'),
                      style: const pw.TextStyle(fontSize: 10, color: muted)),
                  pw.Text(_text(branch, ['email'], 'famousgatesbmt@gmail.com'),
                      style: const pw.TextStyle(fontSize: 10, color: muted)),
                ],
              ),
            ],
          ),
          pw.SizedBox(height: 18),
          pw.Container(height: 1, color: border),
          pw.SizedBox(height: 18),
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('VENDOR / SUPPLIER:',
                        style: pw.TextStyle(
                            fontSize: 12,
                            color: primary,
                            fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 8),
                    pw.Text(supplierName,
                        style: const pw.TextStyle(fontSize: 10)),
                    if (_text(supplier, ['contact_person', 'contact_name'], '')
                        .isNotEmpty)
                      pw.Text(
                          _text(supplier, ['contact_person', 'contact_name']),
                          style: const pw.TextStyle(fontSize: 10)),
                    if (_text(supplier, ['phone', 'contact_phone'], '')
                        .isNotEmpty)
                      pw.Text(_text(supplier, ['phone', 'contact_phone']),
                          style: const pw.TextStyle(fontSize: 10)),
                  ],
                ),
              ),
              pw.SizedBox(width: 36),
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('PO DETAILS:',
                        style: pw.TextStyle(
                            fontSize: 12,
                            color: primary,
                            fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 8),
                    pw.Text('PO Number: $poNumber',
                        style: const pw.TextStyle(fontSize: 10)),
                    pw.Text('Date: ${_date(po['po_date'])}',
                        style: const pw.TextStyle(fontSize: 10)),
                    if (po['expected_delivery_date'] != null)
                      pw.Text(
                          'Expected: ${_date(po['expected_delivery_date'])}',
                          style: const pw.TextStyle(fontSize: 10)),
                  ],
                ),
              ),
            ],
          ),
          pw.SizedBox(height: 24),
          pw.TableHelper.fromTextArray(
            headers: const ['Item Description', 'Qty', 'Unit Price', 'Total'],
            data: tableRows,
            headerStyle: pw.TextStyle(
                color: PdfColors.white,
                fontWeight: pw.FontWeight.bold,
                fontSize: 9),
            headerDecoration: const pw.BoxDecoration(color: primary),
            oddRowDecoration: const pw.BoxDecoration(color: lightRow),
            cellStyle: const pw.TextStyle(fontSize: 9, color: muted),
            cellPadding:
                const pw.EdgeInsets.symmetric(horizontal: 7, vertical: 7),
            columnWidths: {
              0: const pw.FlexColumnWidth(4.8),
              1: const pw.FlexColumnWidth(.8),
              2: const pw.FlexColumnWidth(1.4),
              3: const pw.FlexColumnWidth(1.4),
            },
            cellAlignments: {
              0: pw.Alignment.centerLeft,
              1: pw.Alignment.centerRight,
              2: pw.Alignment.centerRight,
              3: pw.Alignment.centerRight,
            },
          ),
          if (_text(po, ['special_instructions'], '').isNotEmpty) ...[
            pw.SizedBox(height: 18),
            pw.Text('Notes:',
                style:
                    pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 5),
            pw.Text(_text(po, ['special_instructions']),
                style: const pw.TextStyle(fontSize: 10, color: muted)),
          ],
        ],
      ),
    );
    return doc.save();
  }

  Future<pw.MemoryImage?> _loadPoPdfLogo() async {
    try {
      final data = await rootBundle.load('assets/frontend_public/fglogo.png');
      return pw.MemoryImage(data.buffer.asUint8List());
    } catch (_) {
      return null;
    }
  }

  String _pdfMoney(num value) => 'Ksh ${value.toStringAsFixed(2)}';

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

  Future<void> _showPurchaseOrderDetails(
    BuildContext context,
    Map<String, dynamic> row,
  ) async {
    try {
      final detail =
          await ref.read(adminRepositoryProvider).getPurchaseOrder(_id(row));
      if (!mounted || !context.mounted) return;
      final status = _text(detail, ['status'], _text(row, ['status'], 'draft'));
      final lower = status.toLowerCase();
      await _showMapDetails(
        context,
        'PO ${_text(detail, ['po_number', 'id'])}',
        detail,
        actions: [
          IconButton(
            tooltip: 'Print',
            icon: const Icon(Icons.print_outlined),
            onPressed: () async => _printPurchaseOrderPdf(detail),
          ),
          Builder(
            builder: (ctx) => PopupMenuButton<String>(
              tooltip: 'Actions',
              onSelected: (value) {
                Navigator.of(ctx).pop();
                switch (value) {
                  case 'edit':
                    _editDraftPurchaseOrder(detail);
                    break;
                  case 'approve':
                    _poAction(context, ref, detail, 'approve');
                    break;
                  case 'cancel':
                    _poAction(context, ref, detail, 'cancel');
                    break;
                  case 'send':
                    _poAction(context, ref, detail, 'send');
                    break;
                  case 'receive':
                    ref.read(adminSectionProvider.notifier).state =
                        AdminSection.goodsReceiving;
                    break;
                }
              },
              itemBuilder: (_) => [
                if (lower == 'draft')
                  const PopupMenuItem(value: 'edit', child: Text('Edit Draft')),
                if (lower.contains('pending') || lower == 'draft')
                  const PopupMenuItem(value: 'approve', child: Text('Approve')),
                if (!lower.contains('cancel'))
                  const PopupMenuItem(value: 'cancel', child: Text('Reject')),
                if (lower.contains('approved'))
                  const PopupMenuItem(value: 'send', child: Text('Send')),
                if (lower.contains('approved'))
                  const PopupMenuItem(
                      value: 'receive', child: Text('Receive Goods')),
              ],
            ),
          ),
        ],
      );
    } catch (error) {
      if (mounted && context.mounted) {
        _snack(context, 'Failed to load PO details: $error');
      }
    }
  }
}

class _PoDateField extends StatelessWidget {
  const _PoDateField({
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

class _SupplierSearchField extends StatefulWidget {
  const _SupplierSearchField({
    required this.suppliers,
    required this.selectedSupplierId,
    required this.onSelected,
    required this.onCleared,
  });

  final List<Map<String, dynamic>> suppliers;
  final String? selectedSupplierId;
  final ValueChanged<Map<String, dynamic>> onSelected;
  final VoidCallback onCleared;

  @override
  State<_SupplierSearchField> createState() => _SupplierSearchFieldState();
}

class _SupplierSearchFieldState extends State<_SupplierSearchField> {
  late final TextEditingController _controller;
  late final FocusNode _focusNode;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: _selectedSupplierLabel());
    _focusNode = FocusNode();
  }

  @override
  void didUpdateWidget(covariant _SupplierSearchField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selectedSupplierId != widget.selectedSupplierId ||
        oldWidget.suppliers != widget.suppliers) {
      final next = _selectedSupplierLabel();
      if (_controller.text != next) {
        _controller.value = TextEditingValue(
          text: next,
          selection: TextSelection.collapsed(offset: next.length),
        );
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  String _selectedSupplierLabel() {
    final selected = widget.suppliers.where(
      (supplier) => _id(supplier) == widget.selectedSupplierId,
    );
    if (selected.isEmpty) return '';
    return _supplierLabel(selected.first);
  }

  Iterable<Map<String, dynamic>> _optionsFor(TextEditingValue value) {
    final query = value.text.trim().toLowerCase();
    if (query.isEmpty) return widget.suppliers.take(30);
    return widget.suppliers.where((supplier) {
      final haystack = [
        _supplierLabel(supplier),
        _text(supplier, ['supplier_code', 'code']),
        _text(supplier, ['phone', 'contact_phone']),
        _text(supplier, ['email', 'contact_email']),
      ].join(' ').toLowerCase();
      return haystack.contains(query);
    }).take(40);
  }

  @override
  Widget build(BuildContext context) {
    return RawAutocomplete<Map<String, dynamic>>(
      textEditingController: _controller,
      focusNode: _focusNode,
      displayStringForOption: _supplierLabel,
      optionsBuilder: _optionsFor,
      onSelected: (supplier) {
        _controller.text = _supplierLabel(supplier);
        widget.onSelected(supplier);
      },
      fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) {
        return TextField(
          controller: controller,
          focusNode: focusNode,
          decoration: InputDecoration(
            labelText: 'Supplier',
            hintText: widget.suppliers.isEmpty
                ? 'No suppliers available'
                : 'Search supplier name, code, phone, or email',
            prefixIcon: const Icon(Icons.search, size: 18),
            suffixIcon: widget.selectedSupplierId == null
                ? null
                : IconButton(
                    tooltip: 'Clear supplier',
                    icon: const Icon(Icons.close, size: 18),
                    onPressed: () {
                      controller.clear();
                      widget.onCleared();
                      focusNode.requestFocus();
                    },
                  ),
          ),
          onChanged: (_) {
            if (widget.selectedSupplierId != null) widget.onCleared();
          },
        );
      },
      optionsViewBuilder: (context, onSelected, options) {
        final rows = options.toList(growable: false);
        return Align(
          alignment: Alignment.topLeft,
          child: Material(
            elevation: 8,
            color: Theme.of(context).cardColor,
            borderRadius: BorderRadius.circular(8),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 280, maxWidth: 520),
              child: rows.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.all(14),
                      child: Text('No matching supplier found'),
                    )
                  : ListView.separated(
                      padding: EdgeInsets.zero,
                      shrinkWrap: true,
                      itemCount: rows.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final supplier = rows[index];
                        return ListTile(
                          dense: true,
                          title: Text(
                            _supplierLabel(supplier),
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: Text(
                            [
                              _text(supplier, ['supplier_code', 'code'], ''),
                              _text(supplier, ['phone', 'contact_phone'], ''),
                            ].where((part) => part.isNotEmpty).join(' • '),
                            overflow: TextOverflow.ellipsis,
                          ),
                          onTap: () => onSelected(supplier),
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

String _supplierLabel(Map<String, dynamic> supplier) =>
    _text(supplier, ['name', 'supplier_name'], 'Supplier');

String _recordSupplierId(Map<String, dynamic> record) {
  final direct = _text(record, ['supplier_id'], '');
  if (direct.isNotEmpty) return direct;
  final supplier = record['supplier'];
  if (supplier is Map) {
    return _text(supplier.cast<String, dynamic>(), ['id'], '');
  }
  return '';
}

String _recordSupplierName(Map<String, dynamic> record) {
  final direct = _text(record, ['supplier_name', 'other_supplier_name'], '');
  if (direct.isNotEmpty) return direct;
  final supplier = record['supplier'];
  if (supplier is Map) {
    return _supplierLabel(supplier.cast<String, dynamic>());
  }
  return 'Supplier';
}

Widget _supplierWorkflowTabs(WidgetRef ref, AdminSection active) {
  final tabs = [
    (AdminSection.suppliers, 'Suppliers'),
    (AdminSection.purchaseOrders, 'POs'),
    (AdminSection.goodsReceiptGRN, 'GRN'),
    (AdminSection.supplierInvoices, 'Invoices'),
    (AdminSection.procurementPayments, 'Payments'),
    (AdminSection.centralReports, 'Reports'),
  ];
  return Align(
    alignment: Alignment.centerLeft,
    child: Wrap(
      spacing: 8,
      runSpacing: 8,
      children: tabs.map((tab) {
        final selected = tab.$1 == active;
        final child = Text(tab.$2);
        final onPressed = selected
            ? null
            : () => ref.read(adminSectionProvider.notifier).state = tab.$1;
        return selected
            ? ElevatedButton(onPressed: () {}, child: child)
            : OutlinedButton(onPressed: onPressed, child: child);
      }).toList(),
    ),
  );
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
          data: (rows) => Column(children: [
            _supplierWorkflowTabs(ref, AdminSection.goodsReceiptGRN),
            const SizedBox(height: 16),
            _RowsCard(
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
          ]),
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
          data: (rows) => Column(children: [
            _supplierWorkflowTabs(ref, AdminSection.suppliers),
            const SizedBox(height: 16),
            _RowsCard(
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
                    onPressed: () =>
                        _showSupplierDialog(context, ref, row: row),
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
          ]),
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

class CentralStockTakesSection extends ConsumerStatefulWidget {
  const CentralStockTakesSection({super.key});

  @override
  ConsumerState<CentralStockTakesSection> createState() =>
      _CentralStockTakesSectionState();
}

class _CentralStockTakesSectionState
    extends ConsumerState<CentralStockTakesSection> {
  String? _selectedId;
  Map<String, dynamic>? _detail;
  bool _loadingDetail = false;
  final Map<String, String> _draftCounts = {};
  final Map<String, String> _draftReasons = {};

  bool get _canEdit {
    final status = _text(_detail ?? {}, ['status'], '').toLowerCase();
    return status == 'in_progress' || status == 'draft';
  }

  @override
  Widget build(BuildContext context) => _LiveSection(
        title: 'Central Store Stock Takes',
        subtitle:
            'Download worksheets, record physical counts, and submit variances to auditor review',
        icon: PhosphorIcons.clipboardText(),
        child: _LiveRows(
          value: ref.watch(centralStockTakesProvider),
          data: (rows) {
            if (_selectedId != null) return _detailView(ref);
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
                  label: const Text('Start Stock Take'),
                ),
                builder: (row) {
                  return _stockTakeSessionTile(context, ref, row);
                },
              ),
            ]);
          },
        ),
      );

  Widget _stockTakeSessionTile(
      BuildContext context, WidgetRef ref, Map<String, dynamic> row) {
    final status = _text(row, ['status'], 'in_progress');
    final normalizedStatus = status.toLowerCase();
    final canSubmit =
        normalizedStatus.contains('progress') || normalizedStatus == 'draft';
    final isSubmitted = normalizedStatus.contains('submitted');
    final compactOutlinedStyle = OutlinedButton.styleFrom(
      minimumSize: const Size(0, 34),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      visualDensity: VisualDensity.compact,
    );
    final compactFilledStyle = FilledButton.styleFrom(
      minimumSize: const Size(0, 34),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      visualDensity: VisualDensity.compact,
    );

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: AppColors.kDivider.withValues(alpha: 0.35),
          ),
        ),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
        CircleAvatar(
          backgroundColor: AppColors.kPrimary.withValues(alpha: 0.08),
          child: Icon(
            PhosphorIcons.clipboardText(),
            color: AppColors.kPrimary,
            size: 18,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              _text(row, ['session_number', 'stock_take_number', 'id']),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
            ),
            const SizedBox(height: 3),
            Text(
              '${_text(row, ['store_type'], 'all')} • Counted ${_text(row, [
                    'counted_items',
                    'total_items_counted',
                    'items_counted'
                  ], '0')} • ${_date(row['created_at'])}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.kTextSecondary,
                fontSize: 12,
              ),
            ),
          ]),
        ),
        const SizedBox(width: 16),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              _statusChip(status),
              const SizedBox(width: 8),
              OutlinedButton(
                style: compactOutlinedStyle,
                onPressed: () => _openStockTake(ref, _id(row)),
                child: const Text('Open'),
              ),
              const SizedBox(width: 8),
              OutlinedButton.icon(
                style: compactOutlinedStyle,
                onPressed: () => _downloadWorksheet(context, ref, row),
                icon: const Icon(Icons.download, size: 14),
                label: const Text('Worksheet'),
              ),
              if (canSubmit) ...[
                const SizedBox(width: 8),
                FilledButton(
                  style: compactFilledStyle,
                  onPressed: () => _submitStockTake(context, ref, row),
                  child: const Text('Submit'),
                ),
              ],
              if (isSubmitted) ...[
                const SizedBox(width: 8),
                if (_canApproveCentral)
                  FilledButton(
                    style: compactFilledStyle,
                    onPressed: () => _approveCentral(context, ref, row),
                    child: const Text('Approve & Post'),
                  )
                else
                  const Chip(
                    visualDensity: VisualDensity.compact,
                    label: Text(
                      'AWAITING AUDITOR',
                      style: TextStyle(fontSize: 10),
                    ),
                  ),
              ],
            ]),
          ),
        ),
      ]),
    );
  }

  /// Auditor-level roles may approve a submitted central count; approval posts
  /// Variance = Physical − System to the central master stock (simple_items)
  /// with the matching accounting adjustment / write-off journal.
  bool get _canApproveCentral {
    final role =
        (ref.read(authNotifierProvider).valueOrNull?.role ?? '').toLowerCase();
    return const ['super_admin', 'general_manager', 'auditor'].contains(role);
  }

  Future<void> _approveCentral(
      BuildContext context, WidgetRef ref, Map<String, dynamic> row) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Approve & Post Variances'),
        content: const Text(
            'This will post all counted variances to central store stock:\n\n'
            '• Positive variance → Credit Stock Adjustment (stock +)\n'
            '• Negative variance → Debit Stock Write-off (stock −)\n\n'
            'The accounting journal is updated and this cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Approve & Post')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(adminRepositoryProvider).approveCentralStockTake(_id(row));
      ref.invalidate(centralStockTakesProvider);
      if (context.mounted) {
        AppNotifier.showSnackBar(
          context,
          const SnackBar(
              content: Text(
                  'Central stock take approved — adjustments posted to stock and accounting')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        AppNotifier.showSnackBar(
          context,
          SnackBar(
              content: Text(apiErrorMessage(e, fallback: 'Approve failed'))),
        );
      }
    }
  }

  Widget _detailView(WidgetRef ref) {
    final detail = _detail;
    if (_loadingDetail || detail == null) {
      return const Padding(
        padding: EdgeInsets.all(32),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    final items = _list(detail['items']);
    final counted =
        items.where((item) => _stockActualIncludingDraft(item) != null).length;
    final salesUnits =
        items.fold<double>(0, (sum, item) => sum + _tradingSoldQuantity(item));
    final salesRevenue =
        items.fold<double>(0, (sum, item) => sum + _tradingRevenue(item));
    final closingSales =
        items.fold<double>(0, (sum, item) => sum + _tradingClosingSales(item));
    final addedStockValue =
        items.fold<double>(0, (sum, item) => sum + _tradingAddedStock(item));
    final status = _text(detail, ['status'], 'in_progress');
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        OutlinedButton.icon(
          onPressed: () => setState(() {
            _selectedId = null;
            _detail = null;
          }),
          icon: const Icon(Icons.arrow_back, size: 16),
          label: const Text('Back to sessions'),
        ),
        const Spacer(),
        _statusChip(status),
        const SizedBox(width: 8),
        OutlinedButton.icon(
          onPressed: () => _downloadWorksheet(context, ref, detail),
          icon: const Icon(Icons.download, size: 16),
          label: const Text('Download Worksheet'),
        ),
        const SizedBox(width: 8),
        if (_canEdit)
          OutlinedButton.icon(
            onPressed: () => _saveWorksheetCounts(ref, items),
            icon: const Icon(Icons.save, size: 16),
            label: const Text('Save Counts'),
          ),
        if (_canEdit) const SizedBox(width: 8),
        if (_canEdit)
          ElevatedButton.icon(
            onPressed: () => _submitStockTake(context, ref, detail),
            icon: const Icon(Icons.send, size: 16),
            label: const Text('Submit to Auditor'),
          ),
      ]),
      const SizedBox(height: 16),
      Row(children: [
        Expanded(
            child: _StatCard(
                label: 'Items',
                value: '${items.length}',
                icon: PhosphorIcons.package(),
                color: AppColors.kPrimary)),
        const SizedBox(width: 12),
        Expanded(
            child: _StatCard(
                label: 'Counted C/s',
                value: '$counted',
                icon: PhosphorIcons.checkCircle(),
                color: Colors.green)),
        const SizedBox(width: 12),
        Expanded(
            child: _StatCard(
                label: 'Sales Units',
                value: _plainNum(salesUnits),
                icon: PhosphorIcons.trendUp(),
                color: Colors.orange)),
        const SizedBox(width: 12),
        Expanded(
            child: _StatCard(
                label: 'Sales Revenue',
                value: _money(salesRevenue),
                icon: PhosphorIcons.coins(),
                color: Colors.teal)),
        const SizedBox(width: 12),
        Expanded(
            child: _StatCard(
                label: 'Closing Sales',
                value: _money(closingSales),
                icon: PhosphorIcons.buildings(),
                color: AppColors.kPrimary)),
        const SizedBox(width: 12),
        Expanded(
            child: _StatCard(
                label: 'Added Stock',
                value: _money(addedStockValue),
                icon: PhosphorIcons.truck(),
                color: Colors.indigo)),
      ]),
      const SizedBox(height: 16),
      _stockCountWorksheetCard(ref, detail, items, counted),
      if (_text(detail, ['notes'], '').isNotEmpty) ...[
        const SizedBox(height: 12),
        _RowsCard(
          title: 'Auditor / Review Notes',
          rows: [detail],
          emptyMessage: '',
          builder: (row) => Padding(
            padding: const EdgeInsets.all(12),
            child: Text(_text(row, ['notes'], '')),
          ),
        ),
      ],
    ]);
  }

  double? _stockActual(Map<String, dynamic> item) {
    final value = item['counted_quantity'] ??
        item['actual_quantity'] ??
        item['physical_quantity'];
    if (value == null) return null;
    if (value is num) return value.toDouble();
    return double.tryParse('$value');
  }

  double? _stockActualIncludingDraft(Map<String, dynamic> item) {
    final draft = _draftCounts[_worksheetItemKey(item)] ??
        item['_draft_counted_quantity'];
    if (draft != null && '$draft'.trim().isNotEmpty) {
      return double.tryParse('$draft');
    }
    return _stockActual(item);
  }

  double _stockVarianceIncludingDraft(Map<String, dynamic> item) {
    final actual = _stockActualIncludingDraft(item);
    if (actual == null) return 0;
    return actual - _num(item, ['system_closing_stock', 'system_quantity']);
  }

  double _tradingOpening(Map<String, dynamic> item) {
    final explicit =
        _num(item, ['opening_stock', 'opening_quantity', 'opening']);
    if (explicit != 0) return explicit;
    return _num(item, [
      'system_closing_stock',
      'system_quantity',
      'current_stock',
      'quantity'
    ]);
  }

  double _tradingAdded(Map<String, dynamic> item) =>
      _num(item, ['adds', 'added_quantity', 'additions']) +
      _num(item, ['transfers_in', 'received_quantity']) +
      _num(item, ['production_quantity', 'produced_quantity']);

  double _tradingTotal(Map<String, dynamic> item) =>
      _tradingOpening(item) + _tradingAdded(item);

  double _tradingClosing(Map<String, dynamic> item) {
    final actual = _stockActualIncludingDraft(item);
    if (actual != null) return actual;
    final explicit = _num(item, [
      'closing_stock',
      'closing_quantity',
      'counted_quantity',
      'actual_quantity',
      'physical_quantity'
    ]);
    if (explicit != 0) return explicit;
    return _tradingTotal(item);
  }

  double _tradingSoldQuantity(Map<String, dynamic> item) =>
      _tradingTotal(item) - _tradingClosing(item);

  double _tradingSellingPrice(Map<String, dynamic> item) =>
      _num(item, ['selling_price', 'unit_price', 'price', 'retail_price']);

  double _tradingBuyingPrice(Map<String, dynamic> item) =>
      _num(item, ['buying_price', 'cost_price', 'unit_cost', 'cost']);

  double _tradingRevenue(Map<String, dynamic> item) =>
      _tradingSoldQuantity(item) * _tradingSellingPrice(item);

  double _tradingOpeningSales(Map<String, dynamic> item) =>
      _tradingOpening(item) * _tradingSellingPrice(item);

  double _tradingClosingSales(Map<String, dynamic> item) =>
      _tradingClosing(item) * _tradingSellingPrice(item);

  double _tradingAddedStock(Map<String, dynamic> item) =>
      _tradingAdded(item) * _tradingBuyingPrice(item);

  String _stockReasonIncludingDraft(Map<String, dynamic> item) {
    final draft =
        '${_draftReasons[_worksheetItemKey(item)] ?? item['_draft_variance_reason'] ?? ''}'
            .trim();
    if (draft.isNotEmpty) return draft;
    return _text(item, ['variance_reason', 'reason', 'notes'], '');
  }

  String _worksheetItemKey(Map<String, dynamic> item) {
    final id = _id(item);
    if (id.isNotEmpty && id != 'null') return id;
    return _text(item, ['item_sku', 'sku', 'item_id'], '');
  }

  Widget _stockCountWorksheetCard(
    WidgetRef ref,
    Map<String, dynamic> detail,
    List<Map<String, dynamic>> items,
    int counted,
  ) {
    final title =
        'Count Worksheet - ${_text(detail, ['session_number', 'id'])}';
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: .65)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
          child: Row(children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 15)),
                  const SizedBox(height: 3),
                  const Text(
                    'Trading stock sheet: opening plus adds, closing count, sales, revenue, and stock values.',
                    style: TextStyle(
                        color: AppColors.kTextSecondary, fontSize: 12),
                  ),
                ],
              ),
            ),
            Text('$counted / ${items.length} counted',
                style: const TextStyle(
                    color: AppColors.kTextSecondary,
                    fontWeight: FontWeight.w700)),
            if (_canEdit) ...[
              const SizedBox(width: 12),
              ElevatedButton.icon(
                onPressed: () => _saveWorksheetCounts(ref, items),
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
                  style: TextStyle(color: AppColors.kTextSecondary)),
            ),
          )
        else
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SizedBox(
              width: 2170,
              child: Column(children: [
                _stockWorksheetHeaderRow(),
                ...items.map((item) => _stockWorksheetInputRow(item)),
              ]),
            ),
          ),
      ]),
    );
  }

  Widget _stockWorksheetHeaderRow() {
    const style = TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w800,
        color: AppColors.kTextSecondary);
    return Container(
      height: 38,
      color: AppColors.kSurface,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: const Row(children: [
        SizedBox(width: 320, child: Text('ITEM', style: style)),
        SizedBox(width: 24),
        SizedBox(
            width: 82,
            child: Text('O/S', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 24),
        SizedBox(
            width: 82,
            child: Text('ADDS', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 24),
        SizedBox(
            width: 88,
            child: Text('TOTAL', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 24),
        SizedBox(width: 150, child: Text('C/S COUNT', style: style)),
        SizedBox(width: 24),
        SizedBox(
            width: 88,
            child: Text('SALES', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 24),
        SizedBox(
            width: 108,
            child:
                Text('UNIT PRICE', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 24),
        SizedBox(
            width: 118,
            child: Text('AMOUNT', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 24),
        SizedBox(
            width: 108,
            child:
                Text('BUYING PRICE', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 24),
        SizedBox(
            width: 126,
            child: Text('OPENING SALES',
                textAlign: TextAlign.right, style: style)),
        SizedBox(width: 24),
        SizedBox(
            width: 126,
            child: Text('CLOSING SALES',
                textAlign: TextAlign.right, style: style)),
        SizedBox(width: 24),
        SizedBox(
            width: 118,
            child:
                Text('ADDED STOCK', textAlign: TextAlign.right, style: style)),
        SizedBox(width: 24),
        SizedBox(width: 280, child: Text('NOTES', style: style)),
      ]),
    );
  }

  Widget _stockWorksheetInputRow(Map<String, dynamic> item) {
    final actual = _stockActualIncludingDraft(item);
    final variance = _stockVarianceIncludingDraft(item);
    final needsReason = actual != null && variance != 0;
    final sold = _tradingSoldQuantity(item);
    final rowColor = actual == null
        ? Colors.transparent
        : variance == 0 && sold >= 0
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
          width: 320,
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              _text(item, ['item_name', 'name', 'item_sku', 'sku']),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 2),
            Text(
              [
                _text(item, ['item_sku', 'sku'], ''),
                _text(item, ['category', 'store_type'], '')
              ].where((value) => value.isNotEmpty && value != '—').join(' • '),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  color: AppColors.kTextSecondary, fontSize: 11),
            ),
          ]),
        ),
        const SizedBox(width: 24),
        SizedBox(
          width: 82,
          child: Text(_plainNum(_tradingOpening(item)),
              textAlign: TextAlign.right, style: const TextStyle(fontSize: 12)),
        ),
        const SizedBox(width: 24),
        SizedBox(
          width: 82,
          child: Text(_plainNum(_tradingAdded(item)),
              textAlign: TextAlign.right, style: const TextStyle(fontSize: 12)),
        ),
        const SizedBox(width: 24),
        SizedBox(
          width: 88,
          child: Text(_plainNum(_tradingTotal(item)),
              textAlign: TextAlign.right,
              style: const TextStyle(fontWeight: FontWeight.w800)),
        ),
        const SizedBox(width: 24),
        SizedBox(
          width: 150,
          child: _InlineStockInput(
            key: ValueKey('${_id(item)}-central-count'),
            initialValue: _stockActual(item) == null
                ? ''
                : _plainNum(_stockActual(item)!),
            enabled: _canEdit,
            hintText: 'Count',
            keyboardType: TextInputType.number,
            onChanged: (value) => setState(() {
              _draftCounts[_worksheetItemKey(item)] = value;
            }),
          ),
        ),
        const SizedBox(width: 24),
        SizedBox(
          width: 88,
          child: Text(_plainNum(sold),
              textAlign: TextAlign.right,
              style: TextStyle(
                fontWeight: FontWeight.w800,
                color: sold < 0 ? Colors.deepOrange : AppColors.kTextPrimary,
              )),
        ),
        const SizedBox(width: 24),
        SizedBox(
          width: 108,
          child: Text(_money(_tradingSellingPrice(item)),
              textAlign: TextAlign.right, style: const TextStyle(fontSize: 12)),
        ),
        const SizedBox(width: 24),
        SizedBox(
          width: 118,
          child: Text(_money(_tradingRevenue(item)),
              textAlign: TextAlign.right,
              style: const TextStyle(fontWeight: FontWeight.w800)),
        ),
        const SizedBox(width: 24),
        SizedBox(
          width: 108,
          child: Text(_money(_tradingBuyingPrice(item)),
              textAlign: TextAlign.right, style: const TextStyle(fontSize: 12)),
        ),
        const SizedBox(width: 24),
        SizedBox(
          width: 126,
          child: Text(_money(_tradingOpeningSales(item)),
              textAlign: TextAlign.right, style: const TextStyle(fontSize: 12)),
        ),
        const SizedBox(width: 24),
        SizedBox(
          width: 126,
          child: Text(_money(_tradingClosingSales(item)),
              textAlign: TextAlign.right, style: const TextStyle(fontSize: 12)),
        ),
        const SizedBox(width: 24),
        SizedBox(
          width: 118,
          child: Text(_money(_tradingAddedStock(item)),
              textAlign: TextAlign.right, style: const TextStyle(fontSize: 12)),
        ),
        const SizedBox(width: 24),
        SizedBox(
          width: 280,
          child: _InlineStockInput(
            key: ValueKey('${_id(item)}-central-note'),
            initialValue: _stockReasonIncludingDraft(item),
            enabled: _canEdit,
            hintText: needsReason ? 'Required for variance' : 'Optional',
            onChanged: (value) {
              _draftReasons[_worksheetItemKey(item)] = value;
            },
          ),
        ),
      ]),
    );
  }

  Future<void> _saveWorksheetCounts(
      WidgetRef ref, List<Map<String, dynamic>> items) async {
    final payload = <Map<String, dynamic>>[];
    for (final item in items) {
      final actual = _stockActualIncludingDraft(item);
      if (actual == null) continue;
      final variance =
          actual - _num(item, ['system_closing_stock', 'system_quantity']);
      final reason = _stockReasonIncludingDraft(item);
      if (variance != 0 && reason.trim().isEmpty) {
        _snack(
            context,
            'Variance reason required for ${_text(item, [
                  'item_name',
                  'item_sku'
                ])}');
        return;
      }
      payload.add({
        'id': _id(item),
        'item_sku': _text(item, ['item_sku', 'sku'], ''),
        'counted_quantity': actual,
        if (reason.trim().isNotEmpty) 'variance_reason': reason.trim(),
        if (reason.trim().isNotEmpty) 'notes': reason.trim(),
      });
    }
    if (payload.isEmpty) {
      _snack(context, 'Enter at least one physical count');
      return;
    }
    try {
      await ref.read(adminRepositoryProvider).updateCentralStockTake(
        _selectedId!,
        {'items': payload},
      );
      _draftCounts.clear();
      _draftReasons.clear();
      await _openStockTake(ref, _selectedId!);
      if (mounted) _snack(context, 'Worksheet counts saved');
    } catch (error) {
      if (mounted) _snack(context, 'Save failed: $error');
    }
  }

  Future<void> _openStockTake(WidgetRef ref, String id) async {
    if (id.isEmpty) return;
    setState(() {
      _selectedId = id;
      _loadingDetail = true;
      _draftCounts.clear();
      _draftReasons.clear();
    });
    try {
      final detail =
          await ref.read(adminRepositoryProvider).getCentralStockTake(id);
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _loadingDetail = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _loadingDetail = false);
      _snack(context, 'Failed to load stock take: $error');
    }
  }

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
      final session = await ref
          .read(adminRepositoryProvider)
          .createCentralStockTake({'store_type': storeType});
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      await _openStockTake(ref, _id(session));
      if (!context.mounted) return;
      _snack(context, 'Stock take worksheet started');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }

  Future<void> _downloadWorksheet(
    BuildContext context,
    WidgetRef ref,
    Map<String, dynamic> row,
  ) async {
    try {
      final file = await ref
          .read(adminRepositoryProvider)
          .downloadCentralStockTakeWorksheet(_id(row));
      if (context.mounted) _snack(context, 'Worksheet saved to ${file.path}');
    } catch (error) {
      if (context.mounted) _snack(context, 'Download failed: $error');
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
      if (_selectedId != null) await _openStockTake(ref, _selectedId!);
      if (!context.mounted) return;
      _snack(context, 'Stock take submitted to auditor');
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
        subtitle: 'Central-store loss records for auditor audit and notes',
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
                        label: 'Pending Auditor Audit',
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
    Map<String, dynamic>? selectedItem = items.isNotEmpty ? items.first : null;
    var filteredItems = List<Map<String, dynamic>>.from(items);
    final searchCtrl = TextEditingController();
    final qtyCtrl = TextEditingController(text: '1');
    final detailsCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    String reason = 'DAMAGED';
    final body = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) {
          void filterItems(String query) {
            final q = query.trim().toLowerCase();
            setState(() {
              filteredItems = q.isEmpty
                  ? List<Map<String, dynamic>>.from(items)
                  : items.where((item) {
                      final haystack = [
                        _text(item, ['name', 'item_name'], ''),
                        _text(item, ['sku', 'id'], ''),
                        _text(item, ['category'], ''),
                        _text(item, ['store_type'], ''),
                      ].join(' ').toLowerCase();
                      return haystack.contains(q);
                    }).toList();
            });
          }

          final stock = selectedItem == null
              ? 0
              : _num(selectedItem!, ['stock', 'quantity']);
          final unit = selectedItem == null
              ? 'pcs'
              : _text(selectedItem!, ['unit'], 'pcs');
          final cost = selectedItem == null ? 0 : _num(selectedItem!, ['cost']);
          return AlertDialog(
            titlePadding: const EdgeInsets.fromLTRB(24, 22, 24, 8),
            contentPadding: const EdgeInsets.fromLTRB(24, 8, 24, 8),
            actionsPadding: const EdgeInsets.fromLTRB(24, 8, 24, 18),
            title: Row(children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: .10),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(PhosphorIcons.trash(), color: Colors.red),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text('Record Central Store Spoilage',
                    style:
                        TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
              ),
            ]),
            content: SizedBox(
              width: 640,
              child: SingleChildScrollView(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  TextField(
                    controller: searchCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Search item by name, SKU, category',
                      prefixIcon: Icon(Icons.search),
                    ),
                    onChanged: filterItems,
                  ),
                  const SizedBox(height: 8),
                  Container(
                    constraints: const BoxConstraints(maxHeight: 190),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.kDivider),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: filteredItems.isEmpty
                        ? const Center(
                            child: Padding(
                              padding: EdgeInsets.all(18),
                              child: Text('No matching stock items found',
                                  style: TextStyle(
                                      color: AppColors.kTextSecondary)),
                            ),
                          )
                        : ListView.separated(
                            shrinkWrap: true,
                            itemCount: filteredItems.length,
                            separatorBuilder: (_, __) =>
                                const Divider(height: 1),
                            itemBuilder: (ctx, index) {
                              final item = filteredItems[index];
                              final selected =
                                  _id(selectedItem ?? {}) == _id(item);
                              return ListTile(
                                dense: true,
                                selected: selected,
                                selectedTileColor:
                                    AppColors.kPrimary.withValues(alpha: .08),
                                title: Text(
                                  _text(item, ['name', 'item_name']),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700),
                                ),
                                subtitle: Text(
                                  '${_text(item, [
                                        'sku',
                                        'id'
                                      ])} • ${_text(item, [
                                        'store_type'
                                      ], 'store')} • Stock ${_plainNum(_num(item, [
                                        'stock',
                                        'quantity'
                                      ]))} ${_text(item, ['unit'], 'pcs')}',
                                ),
                                trailing: selected
                                    ? const Icon(Icons.check_circle,
                                        color: AppColors.kPrimary)
                                    : null,
                                onTap: () => setState(() {
                                  selectedItem = item;
                                }),
                              );
                            },
                          ),
                  ),
                  const SizedBox(height: 12),
                  if (selectedItem != null)
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.kSurface,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.kDivider),
                      ),
                      child: Row(children: [
                        Expanded(
                            child: _MiniFact(
                                label: 'Available',
                                value: '${_plainNum(stock)} $unit')),
                        Expanded(
                            child: _MiniFact(
                                label: 'Unit Cost', value: _money(cost))),
                        Expanded(
                            child: _MiniFact(
                                label: 'Loss Value',
                                value: _money(
                                    (double.tryParse(qtyCtrl.text.trim()) ??
                                            0) *
                                        cost))),
                      ]),
                    ),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                      child: _field(qtyCtrl, 'Quantity *',
                          required: true, keyboardType: TextInputType.number),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: reason,
                        isExpanded: true,
                        decoration:
                            const InputDecoration(labelText: 'Reason *'),
                        items: const [
                          DropdownMenuItem(
                              value: 'EXPIRED', child: Text('Expired')),
                          DropdownMenuItem(
                              value: 'DAMAGED', child: Text('Damaged')),
                          DropdownMenuItem(
                              value: 'SPOILED', child: Text('Spoiled')),
                          DropdownMenuItem(
                              value: 'QUALITY_ISSUE',
                              child: Text('Quality issue')),
                          DropdownMenuItem(
                              value: 'BREAKAGE', child: Text('Breakage')),
                          DropdownMenuItem(
                              value: 'CONTAMINATION',
                              child: Text('Contamination')),
                          DropdownMenuItem(
                              value: 'THEFT', child: Text('Theft')),
                          DropdownMenuItem(
                              value: 'OTHER', child: Text('Other')),
                        ],
                        onChanged: (value) =>
                            setState(() => reason = value ?? reason),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  _field(detailsCtrl, 'Reason details', maxLines: 2),
                  const SizedBox(height: 12),
                  _field(notesCtrl, 'Notes for auditor', maxLines: 3),
                ]),
              ),
            ),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancel')),
              ElevatedButton(
                  onPressed: () {
                    final selected = selectedItem;
                    final quantity = double.tryParse(qtyCtrl.text.trim()) ?? 0;
                    if (selected == null) return;
                    if (quantity <= 0) return;
                    if (quantity > stock) return;
                    Navigator.pop(ctx, {
                      'item_sku': _text(selected, ['sku', 'id'], ''),
                      'quantity': quantity,
                      'unit': unit,
                      'reason': reason,
                      if (detailsCtrl.text.trim().isNotEmpty)
                        'reason_details': detailsCtrl.text.trim(),
                      if (notesCtrl.text.trim().isNotEmpty)
                        'notes': notesCtrl.text.trim(),
                      'spoilage_date': _isoDate(DateTime.now()),
                      'disposal_method': 'DISPOSED',
                    });
                  },
                  child: const Text('Record Spoilage')),
            ],
          );
        },
      ),
    );
    searchCtrl.dispose();
    qtyCtrl.dispose();
    detailsCtrl.dispose();
    notesCtrl.dispose();
    if (body == null) return;
    try {
      await ref.read(adminRepositoryProvider).createCentralSpoilageRecord(body);
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, 'Spoilage recorded for auditor audit');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }
}

class _MiniFact extends StatelessWidget {
  const _MiniFact({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label,
          style: const TextStyle(
              color: AppColors.kTextSecondary,
              fontSize: 11,
              fontWeight: FontWeight.w600)),
      const SizedBox(height: 3),
      Text(value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w800)),
    ]);
  }
}

class _InlineStockInput extends StatefulWidget {
  const _InlineStockInput({
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
  State<_InlineStockInput> createState() => _InlineStockInputState();
}

class _InlineStockInputState extends State<_InlineStockInput> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue);
  }

  @override
  void didUpdateWidget(covariant _InlineStockInput oldWidget) {
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
        onChanged: widget.onChanged,
        textAlign: widget.keyboardType == TextInputType.number
            ? TextAlign.right
            : TextAlign.left,
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

class CentralSupplierInvoicesSection extends ConsumerWidget {
  const CentralSupplierInvoicesSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => _LiveSection(
        title: 'Supplier Invoices',
        subtitle:
            'Capture AP invoices and submit them for auditor three-way review',
        icon: PhosphorIcons.receipt(),
        child: _LiveRows(
          value: ref.watch(centralSupplierInvoicesProvider),
          data: (rows) => Column(children: [
            _supplierWorkflowTabs(ref, AdminSection.supplierInvoices),
            const SizedBox(height: 16),
            _RowsCard(
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
                  subtitle:
                      '${_recordSupplierName(row)} • ${_date(row['invoice_date'])} • Balance ${_money(_num(row, [
                        'balance_due',
                        'total_amount'
                      ]))}',
                  trailing: Wrap(spacing: 6, children: [
                    _statusChip(status),
                    OutlinedButton(
                        onPressed: () => _showMapDetails(
                            context,
                            'Invoice ${_text(row, ['invoice_number', 'id'])}',
                            row),
                        child: const Text('View')),
                    if (status.toLowerCase() == 'draft' ||
                        status.toLowerCase() == 'rejected')
                      ElevatedButton(
                          onPressed: () => _submitInvoice(context, ref, row),
                          child: const Text('Submit to Auditor')),
                    if (status.toLowerCase() == 'submitted')
                      const Chip(
                        label: Text('AWAITING AUDIT',
                            style: TextStyle(fontSize: 10)),
                      ),
                    if (status.toLowerCase().contains('approved') ||
                        status.toLowerCase() == 'open')
                      const Chip(
                        label: Text('READY FOR ACCOUNTANT PAYMENT',
                            style: TextStyle(fontSize: 10)),
                      ),
                  ]),
                );
              },
            ),
          ]),
        ),
      );

  Future<void> _recordInvoice(BuildContext context, WidgetRef ref) async {
    final suppliers = await ref
        .read(adminRepositoryProvider)
        .getStoreSuppliers(scope: 'global');
    if (!context.mounted) return;
    final repo = ref.read(adminRepositoryProvider);
    String? supplierId;
    String? grnId;
    List<Map<String, dynamic>> supplierGrns = [];
    final invoiceItems = <Map<String, dynamic>>[];
    final invoiceCtrl = TextEditingController();
    final itemCtrl = TextEditingController();
    final qtyCtrl = TextEditingController(text: '1');
    final priceCtrl = TextEditingController(text: '0');
    final vatCtrl = TextEditingController(text: '16');
    final notesCtrl = TextEditingController();
    var invoiceDate = DateTime.now();
    var dueDate = DateTime.now().add(const Duration(days: 30));
    Future<void> loadSupplierGrns(
      String? selectedSupplierId,
      void Function(void Function()) setState,
    ) async {
      grnId = null;
      supplierGrns = [];
      invoiceItems.clear();
      if (selectedSupplierId == null || selectedSupplierId.isEmpty) return;
      final grns = await repo.getGRNs(
        supplierId: selectedSupplierId,
        status: 'approved',
      );
      setState(() => supplierGrns = grns);
    }

    final body = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('Record Supplier Invoice'),
          content: SizedBox(
            width: 760,
            child: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Row(children: [
                  Expanded(
                    child: _SupplierSearchField(
                      suppliers: suppliers,
                      selectedSupplierId: supplierId,
                      onSelected: (supplier) async {
                        supplierId = _id(supplier);
                        setState(() {});
                        await loadSupplierGrns(supplierId, setState);
                      },
                      onCleared: () => setState(() {
                        supplierId = null;
                        grnId = null;
                        supplierGrns = [];
                        invoiceItems.clear();
                      }),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                      child: _field(invoiceCtrl, 'Invoice Number',
                          required: true)),
                ]),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(
                    child: _PoDateField(
                      label: 'Invoice Date',
                      value: invoiceDate,
                      onPicked: (date) => setState(() => invoiceDate = date),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _PoDateField(
                      label: 'Due Date',
                      value: dueDate,
                      firstDate: invoiceDate,
                      onPicked: (date) => setState(() => dueDate = date),
                    ),
                  ),
                ]),
                const SizedBox(height: 12),
                DropdownButtonFormField<String?>(
                  isExpanded: true,
                  initialValue: grnId,
                  decoration:
                      const InputDecoration(labelText: 'Approved GRN optional'),
                  items: [
                    const DropdownMenuItem<String?>(
                        value: null, child: Text('No GRN linkage')),
                    ...supplierGrns.map((grn) => DropdownMenuItem<String?>(
                          value: _id(grn),
                          child: Text(
                            '${_text(grn, [
                                  'grn_number',
                                  'id'
                                ])} • ${_date(grn['grn_date'] ?? grn['created_at'])}',
                            overflow: TextOverflow.ellipsis,
                          ),
                        )),
                  ],
                  onChanged: (value) => setState(() => grnId = value),
                ),
                const SizedBox(height: 16),
                Row(children: [
                  Expanded(flex: 3, child: _field(itemCtrl, 'Item / Service')),
                  const SizedBox(width: 8),
                  Expanded(
                      child: _field(qtyCtrl, 'Qty',
                          keyboardType: TextInputType.number)),
                  const SizedBox(width: 8),
                  Expanded(
                      child: _field(priceCtrl, 'Unit Price',
                          keyboardType: TextInputType.number)),
                  const SizedBox(width: 8),
                  Expanded(
                      child: _field(vatCtrl, 'VAT %',
                          keyboardType: TextInputType.number)),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    tooltip: 'Add line',
                    icon: const Icon(Icons.add),
                    onPressed: () {
                      final description = itemCtrl.text.trim();
                      final quantity =
                          double.tryParse(qtyCtrl.text.trim()) ?? 0;
                      final price = double.tryParse(priceCtrl.text.trim()) ?? 0;
                      final vat = double.tryParse(vatCtrl.text.trim()) ?? 16;
                      if (description.isEmpty || quantity <= 0) return;
                      setState(() {
                        invoiceItems.add({
                          'description': description,
                          'item_name': description,
                          'quantity': quantity,
                          'unit_price': price,
                          'vat_rate': vat,
                        });
                        itemCtrl.clear();
                        qtyCtrl.text = '1';
                        priceCtrl.text = '0';
                      });
                    },
                  ),
                ]),
                const SizedBox(height: 12),
                if (invoiceItems.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(20),
                    child: Text('Add at least one invoice line item',
                        style: TextStyle(color: AppColors.kTextSecondary)),
                  )
                else
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: SizedBox(
                      width: 720,
                      child: DataTable(
                        columns: const [
                          DataColumn(label: Text('Item')),
                          DataColumn(label: Text('Qty')),
                          DataColumn(label: Text('Unit')),
                          DataColumn(label: Text('VAT')),
                          DataColumn(label: Text('Total')),
                          DataColumn(label: Text('')),
                        ],
                        rows: invoiceItems.indexed.map((entry) {
                          final index = entry.$1;
                          final item = entry.$2;
                          final quantity = _num(item, ['quantity']);
                          final price = _num(item, ['unit_price']);
                          final vat = _num(item, ['vat_rate']);
                          final total = quantity * price * (1 + vat / 100);
                          return DataRow(cells: [
                            DataCell(Text(_text(item, ['description']))),
                            DataCell(Text(_plainNum(quantity))),
                            DataCell(Text(_money(price))),
                            DataCell(Text('${_plainNum(vat)}%')),
                            DataCell(Text(_money(total))),
                            DataCell(IconButton(
                              icon: const Icon(Icons.close, size: 18),
                              onPressed: () =>
                                  setState(() => invoiceItems.removeAt(index)),
                            )),
                          ]);
                        }).toList(),
                      ),
                    ),
                  ),
                const SizedBox(height: 12),
                _field(notesCtrl, 'Notes', maxLines: 2),
              ]),
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
                onPressed: () {
                  if (supplierId == null ||
                      invoiceCtrl.text.trim().isEmpty ||
                      invoiceItems.isEmpty) {
                    return;
                  }
                  Navigator.pop(ctx, {
                    'supplier_id': supplierId,
                    if (grnId != null) 'grn_id': grnId,
                    'invoice_number': invoiceCtrl.text.trim(),
                    'invoice_date': _isoDate(invoiceDate),
                    'due_date': _isoDate(dueDate),
                    if (notesCtrl.text.trim().isNotEmpty)
                      'notes': notesCtrl.text.trim(),
                    'items': invoiceItems,
                  });
                },
                child: const Text('Record Invoice')),
          ],
        ),
      ),
    );
    invoiceCtrl.dispose();
    itemCtrl.dispose();
    qtyCtrl.dispose();
    priceCtrl.dispose();
    vatCtrl.dispose();
    notesCtrl.dispose();
    if (body == null) return;
    try {
      final saved =
          await ref.read(adminRepositoryProvider).createSupplierInvoice(body);
      final invoiceId = _id(saved);
      if (invoiceId.isNotEmpty) {
        await ref
            .read(adminRepositoryProvider)
            .submitSupplierInvoice(invoiceId);
      }
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, 'Invoice recorded and submitted for auditor review');
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed: $error');
    }
  }

  Future<void> _submitInvoice(
      BuildContext context, WidgetRef ref, Map<String, dynamic> row) async {
    if (!await _confirm(context,
        title: 'Submit Invoice',
        message: 'Submit ${_text(row, [
              'invoice_number',
              'id'
            ])} for auditor three-way review?')) {
      return;
    }
    try {
      await ref.read(adminRepositoryProvider).submitSupplierInvoice(_id(row));
      if (!context.mounted) return;
      _refreshCentralStore(ref);
      _snack(context, 'Invoice submitted for auditor review');
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
        subtitle:
            'Read-only supplier payment register posted by branch accounting',
        icon: PhosphorIcons.creditCard(),
        child: _LiveRows(
          value: ref.watch(centralSupplierPaymentsProvider),
          data: (rows) => Column(children: [
            _supplierWorkflowTabs(ref, AdminSection.procurementPayments),
            const SizedBox(height: 16),
            _RowsCard(
              title: 'Payment Register',
              rows: rows,
              emptyMessage:
                  'No supplier payments posted by branch accountant yet',
              builder: (row) {
                final status = _text(row, ['status'], 'draft');
                return _rowTile(
                  icon: PhosphorIcons.creditCard(),
                  title: _text(row, ['payment_number', 'id']),
                  subtitle: '${_recordSupplierName(row)} • ${_text(row, [
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
                    if (_recordSupplierId(row).isNotEmpty)
                      OutlinedButton(
                          onPressed: () => _showSupplierLedger(
                              context, ref, _recordSupplierId(row)),
                          child: const Text('Ledger')),
                  ]),
                );
              },
            ),
          ]),
        ),
      );

  Future<void> _showSupplierLedger(
      BuildContext context, WidgetRef ref, String supplierId) async {
    try {
      final rows =
          await ref.read(adminRepositoryProvider).getSupplierLedger(supplierId);
      if (!context.mounted) return;
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Supplier Account Ledger'),
          content: SizedBox(
            width: 760,
            child: rows.isEmpty
                ? const Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No ledger entries found'),
                  )
                : SingleChildScrollView(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: DataTable(
                        columns: const [
                          DataColumn(label: Text('Date')),
                          DataColumn(label: Text('Type / Ref')),
                          DataColumn(label: Text('Debit')),
                          DataColumn(label: Text('Credit')),
                          DataColumn(label: Text('Balance')),
                        ],
                        rows: rows.map((entry) {
                          return DataRow(cells: [
                            DataCell(Text(_date(entry['transaction_date'] ??
                                entry['created_at']))),
                            DataCell(Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                    _text(entry, ['transaction_type', 'type'])),
                                Text(
                                  _text(entry, ['reference_number', 'id']),
                                  style: const TextStyle(
                                      color: AppColors.kTextSecondary,
                                      fontSize: 11),
                                ),
                              ],
                            )),
                            DataCell(
                                Text(_money(_num(entry, ['debit_amount'])))),
                            DataCell(
                                Text(_money(_num(entry, ['credit_amount'])))),
                            DataCell(Text(
                              _money(
                                  _num(entry, ['running_balance', 'balance'])),
                              style:
                                  const TextStyle(fontWeight: FontWeight.w800),
                            )),
                          ]);
                        }).toList(),
                      ),
                    ),
                  ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Close')),
          ],
        ),
      );
    } catch (error) {
      if (context.mounted) _snack(context, 'Failed to load ledger: $error');
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
            _supplierWorkflowTabs(ref, AdminSection.centralReports),
            const SizedBox(height: 16),
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
