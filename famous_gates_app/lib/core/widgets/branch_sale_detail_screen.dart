import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../network/dio_client.dart';
import '../theme/app_theme.dart';

/// Full-screen deep-dive for a single branch sale / POS order, opened from the
/// Branch Sales & Payments feed. Shows date/time, waiter, items, payment method
/// and the correct POS outlet — the same detail a cashier sees on the order.
class BranchSaleDetailScreen extends ConsumerStatefulWidget {
  const BranchSaleDetailScreen({
    super.key,
    required this.source,
    required this.id,
    this.fallbackCode,
  });

  final String source;
  final String id;
  final String? fallbackCode;

  @override
  ConsumerState<BranchSaleDetailScreen> createState() => _BranchSaleDetailScreenState();
}

class _BranchSaleDetailScreenState extends ConsumerState<BranchSaleDetailScreen> {
  late Future<Map<String, dynamic>> _future = _load();
  final _money = NumberFormat('#,##0.00', 'en_KE');

  Future<Map<String, dynamic>> _load() async {
    final dio = ref.read(dioProvider);
    try {
      final res = await dio.get('/analytics/branch-sales/transaction/${widget.source}/${widget.id}');
      final body = res.data;
      if (body is Map && body['data'] is Map) {
        return Map<String, dynamic>.from(body['data'] as Map);
      }
      if (body is Map) return Map<String, dynamic>.from(body);
      return {};
    } on DioException catch (e) {
      final msg = e.response?.data is Map
          ? (e.response?.data['error']?.toString() ?? 'Failed to load order')
          : 'Failed to load order';
      throw msg;
    }
  }

  num _n(dynamic v) => v is num ? v : num.tryParse('${v ?? 0}') ?? 0;
  String _money2(num v) => 'KES ${_money.format(v)}';

  String _methodLabel(String raw) {
    switch (raw.toLowerCase()) {
      case 'mpesa':
      case 'm-pesa':
        return 'M-Pesa';
      case 'cash':
        return 'Cash';
      case 'card':
        return 'Card';
      case 'mixed':
      case 'split':
        return 'Split';
      case 'credit_bill':
      case 'credit':
        return 'Credit Bill';
      default:
        return raw.isEmpty ? '—' : raw;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.kSurface,
      appBar: AppBar(title: Text(widget.fallbackCode ?? 'Order Detail')),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return _error('${snap.error}');
          }
          return _content(snap.data ?? const {});
        },
      ),
    );
  }

  Widget _error(String msg) => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.error_outline, color: Colors.red.shade300, size: 40),
          const SizedBox(height: 12),
          Text(msg, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => setState(() => _future = _load()),
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ]),
      );

  Widget _content(Map<String, dynamic> d) {
    final code = '${d['code'] ?? widget.fallbackCode ?? widget.id}';
    final shortCode = '${d['short_code'] ?? ''}';
    final outlet = '${d['outlet'] ?? ''}';
    final waiter = '${d['waiter_name'] ?? ''}';
    final method = '${d['payment_method'] ?? ''}';
    final status = '${d['status'] ?? ''}';
    final customer = '${d['customer_name'] ?? ''}';
    final table = '${d['table_number'] ?? ''}';
    final dateRaw = '${d['date'] ?? ''}';
    final parsed = DateTime.tryParse(dateRaw);
    final when = parsed != null ? DateFormat('EEE, MMM d yyyy · HH:mm').format(parsed) : dateRaw;

    final items = (d['items'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header card: code + short code + outlet
          _card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Expanded(
                    child: Text(code,
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
                  ),
                  if (status.isNotEmpty) _statusChip(status),
                ]),
                if (shortCode.isNotEmpty && shortCode != 'null')
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text('Short code: $shortCode',
                        style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                  ),
                const SizedBox(height: 10),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  if (outlet.isNotEmpty) _pill(Icons.storefront_outlined, outlet),
                  _pill(Icons.payments_outlined, _methodLabel(method)),
                  if (when.isNotEmpty) _pill(Icons.schedule, when),
                ]),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Meta rows
          _card(
            child: Column(
              children: [
                if (waiter.isNotEmpty && waiter != 'null') _row('Waiter / Served by', waiter),
                if (customer.isNotEmpty && customer != 'null') _row('Customer', customer),
                if (table.isNotEmpty && table != 'null') _row('Table / Room', table),
                _row('Payment method', _methodLabel(method)),
                _row('Date & time', when),
                _row('POS outlet', outlet.isEmpty ? '—' : outlet),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Items
          Text('Items (${items.length})',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          if (items.isEmpty)
            _card(child: Text('No line items recorded for this order.',
                style: TextStyle(color: Colors.grey.shade600)))
          else
            _card(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (var i = 0; i < items.length; i++) ...[
                    _itemRow(items[i]),
                    if (i < items.length - 1) const Divider(height: 1),
                  ],
                ],
              ),
            ),
          const SizedBox(height: 12),

          // Totals
          _card(
            child: Column(
              children: [
                if (d['subtotal'] != null) _totalRow('Subtotal', _n(d['subtotal'])),
                if (_n(d['service_charge']) > 0) _totalRow('Service charge', _n(d['service_charge'])),
                if (_n(d['tax_amount']) > 0) _totalRow('Tax', _n(d['tax_amount'])),
                if (_n(d['discount_amount']) > 0) _totalRow('Discount', -_n(d['discount_amount'])),
                const Divider(),
                _totalRow('Total', _n(d['total']), bold: true),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _itemRow(Map<String, dynamic> it) {
    final qty = _n(it['quantity']);
    final name = '${it['name'] ?? 'Item'}';
    final unit = _n(it['unit_price']);
    final total = _n(it['total_price']);
    final notes = '${it['notes'] ?? ''}';
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(right: 10, top: 2),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: AppColors.kPrimary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text('${qty.toInt()}×',
                style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.kPrimary)),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                if (unit > 0)
                  Text('@ ${_money2(unit)}',
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                if (notes.isNotEmpty && notes != 'null')
                  Text(notes, style: TextStyle(fontSize: 12, color: Colors.orange.shade700)),
              ],
            ),
          ),
          Text(_money2(total), style: const TextStyle(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 150,
              child: Text(label, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
            ),
            Expanded(
              child: Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      );

  Widget _totalRow(String label, num value, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label,
                style: TextStyle(
                    fontWeight: bold ? FontWeight.w900 : FontWeight.w500,
                    fontSize: bold ? 16 : 14)),
            Text(_money2(value),
                style: TextStyle(
                    fontWeight: bold ? FontWeight.w900 : FontWeight.w600,
                    fontSize: bold ? 16 : 14)),
          ],
        ),
      );

  Widget _pill(IconData icon, String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 14, color: Colors.grey.shade700),
          const SizedBox(width: 6),
          Text(text, style: TextStyle(fontSize: 12, color: Colors.grey.shade800)),
        ]),
      );

  Widget _statusChip(String status) {
    Color c = Colors.blueGrey;
    final s = status.toLowerCase();
    if (s.contains('paid') || s.contains('complete')) c = const Color(0xFF16A34A);
    if (s.contains('void') || s.contains('cancel')) c = Colors.red;
    if (s.contains('pending')) c = Colors.orange;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(status,
          style: TextStyle(color: c, fontWeight: FontWeight.w700, fontSize: 12)),
    );
  }

  Widget _card({required Widget child, EdgeInsets? padding}) => Container(
        width: double.infinity,
        padding: padding ?? const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: child,
      );
}
