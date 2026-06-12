import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../utils/readable_record.dart';

Future<T?> openRecordDetailScreen<T>(
  BuildContext context, {
  required Map<String, dynamic> record,
  String title = 'Details',
  String? subtitle,
  List<Widget> actions = const [],
}) {
  return Navigator.of(context).push<T>(
    MaterialPageRoute(
      builder: (_) => RecordDetailScreen(
        record: record,
        title: title,
        subtitle: subtitle,
        actions: actions,
      ),
    ),
  );
}

class RecordDetailScreen extends StatelessWidget {
  const RecordDetailScreen({
    super.key,
    required this.record,
    this.title = 'Details',
    this.subtitle,
    this.actions = const [],
    this.limit = 80,
  });

  final Map<String, dynamic> record;
  final String title;
  final String? subtitle;
  final List<Widget> actions;
  final int limit;

  @override
  Widget build(BuildContext context) {
    final entries = readableRecordEntries(record, limit: limit);
    final status = _firstText(record, const [
      'status',
      'approval_status',
      'payment_status',
      'workflow_status',
    ]);
    final reference = _firstText(record, const [
      'request_number',
      'po_number',
      'invoice_number',
      'grn_number',
      'receipt_number',
      'count_number',
      'take_number',
      'order_number',
      'booking_reference',
      'confirmation_number',
      'staff_number',
      'employee_number',
      'sku',
      'item_sku',
      'code',
    ]);
    final when = _firstText(record, const [
      'created_at',
      'updated_at',
      'date',
      'count_date',
      'request_date',
      'entry_date',
      'payment_date',
    ]);
    final metrics = _metricEntries(record);

    return Scaffold(
      backgroundColor: AppColors.kSurface,
      appBar: AppBar(
        title: Text(title, overflow: TextOverflow.ellipsis),
        actions: actions.isEmpty ? null : [...actions, const SizedBox(width: 8)],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1040),
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                _card(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: AppColors.kPrimary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.description_outlined,
                          color: AppColors.kPrimary,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            if (subtitle != null &&
                                subtitle!.trim().isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text(
                                subtitle!,
                                style: const TextStyle(
                                  color: AppColors.kTextSecondary,
                                ),
                              ),
                            ],
                            const SizedBox(height: 10),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                if (reference.isNotEmpty)
                                  _pill(Icons.tag, reference),
                                if (when.isNotEmpty)
                                  _pill(
                                    Icons.schedule,
                                    readableRecordValue(record, 'date', when),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      if (status.isNotEmpty) _statusChip(status),
                    ],
                  ),
                ),
                if (metrics.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: metrics
                        .map(
                          (entry) => _MetricCard(
                            label: readableRecordLabel(entry.key),
                            value: _formatMetric(entry.key, entry.value),
                          ),
                        )
                        .toList(),
                  ),
                ],
                const SizedBox(height: 14),
                _card(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Record Information',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 10),
                      if (entries.isEmpty)
                        const Text(
                          'No details available.',
                          style: TextStyle(color: AppColors.kTextSecondary),
                        )
                      else
                        LayoutBuilder(
                          builder: (context, constraints) {
                            final twoColumn = constraints.maxWidth >= 720;
                            if (!twoColumn) {
                              return Column(
                                children: entries
                                    .map((entry) => _DetailRow(
                                          record: record,
                                          entry: entry,
                                        ))
                                    .toList(),
                              );
                            }
                            final rows = <Widget>[];
                            for (var i = 0; i < entries.length; i += 2) {
                              rows.add(
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(
                                      child: _DetailRow(
                                        record: record,
                                        entry: entries[i],
                                      ),
                                    ),
                                    const SizedBox(width: 24),
                                    Expanded(
                                      child: i + 1 < entries.length
                                          ? _DetailRow(
                                              record: record,
                                              entry: entries[i + 1],
                                            )
                                          : const SizedBox.shrink(),
                                    ),
                                  ],
                                ),
                              );
                            }
                            return Column(children: rows);
                          },
                        ),
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

  Widget _card({required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.kDivider.withValues(alpha: 0.55)),
      ),
      child: child,
    );
  }

  Widget _pill(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.kDivider),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.kTextSecondary),
          const SizedBox(width: 6),
          Text(text, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  Widget _statusChip(String status) {
    final lower = status.toLowerCase();
    Color color = Colors.blueGrey;
    if (lower.contains('pending') ||
        lower.contains('draft') ||
        lower.contains('review')) {
      color = const Color(0xFFB45309);
    }
    if (lower.contains('approved') ||
        lower.contains('complete') ||
        lower.contains('paid') ||
        lower.contains('posted') ||
        lower.contains('active')) {
      color = const Color(0xFF15803D);
    }
    if (lower.contains('reject') ||
        lower.contains('cancel') ||
        lower.contains('void') ||
        lower.contains('flag')) {
      color = AppColors.kError;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        readableStatus(status).toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }

  String _firstText(Map<String, dynamic> row, List<String> keys) {
    for (final key in keys) {
      final value = row[key];
      if (value == null) continue;
      final text = '$value'.trim();
      if (text.isNotEmpty && text != 'null') return text;
    }
    return '';
  }

  List<MapEntry<String, num>> _metricEntries(Map<String, dynamic> row) {
    const hints = [
      'net_salary',
      'gross_salary',
      'total_amount',
      'grand_total',
      'amount',
      'balance',
      'variance',
      'total_variance_value',
      'expected_cash',
      'actual_cash',
      'quantity',
      'quantity_received',
      'quantity_requested',
      'current_stock',
      'unit_cost',
      'unit_price',
    ];
    final entries = <MapEntry<String, num>>[];
    for (final key in hints) {
      final value = row[key];
      final n = value is num ? value : num.tryParse('$value');
      if (n == null) continue;
      entries.add(MapEntry(key, n));
      if (entries.length >= 4) break;
    }
    return entries;
  }

  String _formatMetric(String key, num value) {
    final isMoney = key.contains('amount') ||
        key.contains('salary') ||
        key.contains('cash') ||
        key.contains('balance') ||
        key.contains('price') ||
        key.contains('cost') ||
        key.contains('value') ||
        key.contains('variance');
    final number = value == value.roundToDouble()
        ? value.toStringAsFixed(0)
        : value.toStringAsFixed(2);
    return isMoney ? 'KES $number' : number;
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 210,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.kDivider.withValues(alpha: 0.55)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 4),
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              color: AppColors.kTextSecondary,
              fontSize: 10.5,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.record, required this.entry});

  final Map<String, dynamic> record;
  final MapEntry<String, dynamic> entry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 9),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFE5E7EB))),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            readableRecordLabel(entry.key).toUpperCase(),
            style: const TextStyle(
              color: AppColors.kTextSecondary,
              fontSize: 10.5,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          SelectableText(
            readableRecordValue(record, entry.key, entry.value),
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
