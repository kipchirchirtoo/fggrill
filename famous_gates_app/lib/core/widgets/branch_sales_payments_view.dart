import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../network/dio_client.dart';
import '../storage/secure_storage_provider.dart';
import '../theme/app_theme.dart';
import '../../features/auth/data/auth_repository.dart';
import 'branch_sale_detail_screen.dart';
import 'payment_method_breakdown_widget.dart';

/// Shared "Branch Sales & Payments" view used by Branch Manager, Branch
/// Accountant, Auditor and Director so every branch sale flows to all of them
/// with: source (what it's from in POS), payment method (cash / M-Pesa / card /
/// split / credit bill), order/short code, and amount.
class BranchSalesPaymentsView extends ConsumerStatefulWidget {
  const BranchSalesPaymentsView({super.key});

  @override
  ConsumerState<BranchSalesPaymentsView> createState() =>
      _BranchSalesPaymentsViewState();
}

class _BranchSalesPaymentsViewState
    extends ConsumerState<BranchSalesPaymentsView> {
  late DateTime _start = DateTime.now().subtract(const Duration(days: 29));
  late DateTime _end = DateTime.now();
  late Future<Map<String, dynamic>> _future = _load();

  final _money = NumberFormat('#,##0', 'en_KE');

  String _d(DateTime v) => DateFormat('yyyy-MM-dd').format(v);

  Future<Map<String, dynamic>> _load() async {
    final branchId = await ref
        .read(secureStorageProvider)
        .read(key: AuthRepository.branchIdKey);
    if (branchId != null && branchId.isNotEmpty) {
      return _loadBranch(branchId);
    }

    final branches = await _loadBranches();
    if (branches.isEmpty) return _emptySalesData();

    final reports = <Map<String, dynamic>>[];
    for (final branch in branches) {
      final id = '${branch['id'] ?? branch['branch_id'] ?? ''}';
      if (id.isEmpty) continue;
      try {
        reports.add(await _loadBranch(id));
      } catch (error) {
        debugPrint('Branch sales load failed for branch $id: $error');
      }
    }

    return reports.isEmpty ? _emptySalesData() : _mergeSalesReports(reports);
  }

  Future<Map<String, dynamic>> _loadBranch(String branchId) async {
    final dio = ref.read(dioProvider);
    final res = await dio.post('/analytics/branch-sales', data: {
      'branch_id': int.tryParse(branchId) ?? branchId,
      'start_date': _d(_start),
      'end_date': _d(_end),
      'filters': const {},
    });
    final body = res.data;
    if (body is Map && body['data'] is Map) {
      return Map<String, dynamic>.from(body['data'] as Map);
    }
    if (body is Map) return Map<String, dynamic>.from(body);
    return {};
  }

  Future<List<Map<String, dynamic>>> _loadBranches() async {
    final dio = ref.read(dioProvider);
    try {
      final res = await dio.get('/finance/branches');
      final body = res.data;
      final raw = body is Map ? body['data'] : body;
      return (raw is List)
          ? raw
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList()
          : const [];
    } catch (error) {
      debugPrint('Branch list load failed for sales aggregation: $error');
      return const [];
    }
  }

  Map<String, dynamic> _emptySalesData() => {
        'summary': {'total_sales': 0, 'transaction_count': 0},
        'payment_method_breakdown': <Map<String, dynamic>>[],
        'category_breakdown': <Map<String, dynamic>>[],
        'transactions': <Map<String, dynamic>>[],
      };

  Map<String, dynamic> _mergeSalesReports(List<Map<String, dynamic>> reports) {
    var totalSales = 0.0;
    var transactionCount = 0;
    final methods = <String, Map<String, dynamic>>{};
    final categories = <String, Map<String, dynamic>>{};
    final transactions = <Map<String, dynamic>>[];

    for (final report in reports) {
      final summary = report['summary'] is Map
          ? Map<String, dynamic>.from(report['summary'] as Map)
          : const <String, dynamic>{};
      totalSales += _n(summary['total_sales']).toDouble();
      transactionCount += _n(summary['transaction_count']).toInt();
      _mergeBreakdown(methods, report['payment_method_breakdown'],
          keyFields: const ['payment_method', 'method']);
      _mergeBreakdown(categories, report['category_breakdown'],
          keyFields: const ['category', 'source']);
      transactions.addAll((report['transactions'] as List? ?? [])
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item)));
    }

    List<Map<String, dynamic>> finalizeBreakdown(
      Map<String, Map<String, dynamic>> bucket,
    ) {
      return bucket.values.map((row) {
        final amount = _n(row['total_sales'] ?? row['amount']);
        return {
          ...row,
          'total_sales': amount,
          'amount': amount,
          'transaction_count': _n(row['transaction_count'] ?? row['count']),
          'percentage': totalSales > 0 ? (amount / totalSales) * 100 : 0,
        };
      }).toList()
        ..sort((a, b) => _n(b['total_sales'] ?? b['amount'])
            .compareTo(_n(a['total_sales'] ?? a['amount'])));
    }

    return {
      'summary': {
        'total_sales': totalSales,
        'transaction_count': transactionCount,
      },
      'payment_method_breakdown': finalizeBreakdown(methods),
      'category_breakdown': finalizeBreakdown(categories),
      'transactions': transactions,
    };
  }

  void _mergeBreakdown(
    Map<String, Map<String, dynamic>> bucket,
    dynamic rawRows, {
    required List<String> keyFields,
  }) {
    for (final item in (rawRows as List? ?? []).whereType<Map>()) {
      final row = Map<String, dynamic>.from(item);
      var key = '';
      for (final field in keyFields) {
        final value = '${row[field] ?? ''}'.trim();
        if (value.isNotEmpty && value != 'null') {
          key = value;
          break;
        }
      }
      if (key.isEmpty) key = 'Other';
      final current = bucket.putIfAbsent(
        key,
        () => {
          ...row,
          'total_sales': 0,
          'amount': 0,
          'transaction_count': 0,
          'count': 0,
        },
      );
      current[keyFields.first] = key;
      final amount = _n(current['total_sales'] ?? current['amount']) +
          _n(row['total_sales'] ?? row['amount']);
      final count = _n(current['transaction_count'] ?? current['count']) +
          _n(row['transaction_count'] ?? row['count']);
      current['total_sales'] = amount;
      current['amount'] = amount;
      current['transaction_count'] = count;
      current['count'] = count;
    }
  }

  void _refresh() => setState(() => _future = _load());

  Future<void> _pickRange() async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2023),
      lastDate: DateTime.now().add(const Duration(days: 1)),
      initialDateRange: DateTimeRange(start: _start, end: _end),
    );
    if (picked != null) {
      setState(() {
        _start = picked.start;
        _end = picked.end;
        _future = _load();
      });
    }
  }

  num _n(dynamic v) => v is num ? v : num.tryParse('${v ?? 0}') ?? 0;

  num _sumMethod(List<Map<String, dynamic>> methods, List<String> rawNames) {
    return methods
        .where((m) =>
            rawNames.contains('${m['payment_method'] ?? ''}'.toLowerCase()))
        .fold<num>(
            0, (sum, m) => sum + _n(m['total_sales'] ?? m['amount']));
  }

  String _money0(num v) => 'KES ${_money.format(v)}';

  // ── Payment method display ────────────────────────────────────────────────
  static const _methodLabels = {
    'cash': 'Cash',
    'mpesa': 'M-Pesa',
    'm-pesa': 'M-Pesa',
    'card': 'Card',
    'mixed': 'Split',
    'split': 'Split',
    'credit_bill': 'Credit Bill',
    'credit': 'Credit Bill',
  };

  String _methodLabel(String raw) =>
      _methodLabels[raw.toLowerCase()] ?? _title(raw);

  IconData _methodIcon(String raw) {
    switch (raw.toLowerCase()) {
      case 'cash':
        return Icons.payments_outlined;
      case 'mpesa':
      case 'm-pesa':
        return Icons.phone_android_outlined;
      case 'card':
        return Icons.credit_card_outlined;
      case 'mixed':
      case 'split':
        return Icons.call_split_outlined;
      case 'credit_bill':
      case 'credit':
        return Icons.account_balance_wallet_outlined;
      default:
        return Icons.receipt_long_outlined;
    }
  }

  Color _methodColor(String raw) {
    switch (raw.toLowerCase()) {
      case 'cash':
        return const Color(0xFF16A34A);
      case 'mpesa':
      case 'm-pesa':
        return const Color(0xFF059669);
      case 'card':
        return const Color(0xFF2563EB);
      case 'mixed':
      case 'split':
        return const Color(0xFF7C3AED);
      case 'credit_bill':
      case 'credit':
        return const Color(0xFFEA580C);
      default:
        return Colors.blueGrey;
    }
  }

  String _title(String v) => v
      .replaceAll('_', ' ')
      .split(' ')
      .where((p) => p.isNotEmpty)
      .map((p) => p[0].toUpperCase() + p.substring(1))
      .join(' ');

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) {
        return SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _header(),
              const SizedBox(height: 16),
              if (snap.connectionState == ConnectionState.waiting)
                const Padding(
                  padding: EdgeInsets.all(48),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (snap.hasError)
                _errorBox('${snap.error}')
              else
                _body(snap.data ?? const {}),
            ],
          ),
        );
      },
    );
  }

  Widget _header() => Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Branch Sales & Payments',
                    style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: AppColors.kTextPrimary)),
                Text(
                    'Every branch sale by source and payment method — cash, M-Pesa, card, split, and credit bills.',
                    style:
                        TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              ],
            ),
          ),
          OutlinedButton.icon(
            onPressed: _pickRange,
            icon: const Icon(Icons.calendar_today, size: 16),
            label: Text('${_d(_start)} → ${_d(_end)}'),
          ),
          const SizedBox(width: 8),
          IconButton(
              onPressed: _refresh,
              tooltip: 'Refresh',
              icon: const Icon(Icons.refresh)),
        ],
      );

  Widget _errorBox(String message) => Container(
        padding: const EdgeInsets.all(24),
        alignment: Alignment.center,
        child: Column(children: [
          Icon(Icons.error_outline, color: Colors.red.shade300, size: 40),
          const SizedBox(height: 12),
          Text(message,
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade700)),
          const SizedBox(height: 12),
          OutlinedButton.icon(
              onPressed: _refresh,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry')),
        ]),
      );

  Widget _body(Map<String, dynamic> data) {
    final summary = (data['summary'] is Map)
        ? Map<String, dynamic>.from(data['summary'])
        : <String, dynamic>{};
    final methods = (data['payment_method_breakdown'] as List? ?? [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    final sources = (data['category_breakdown'] as List? ?? [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    final txns = (data['transactions'] as List? ?? [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();

    final totalSales = _n(summary['total_sales']);
    final txnCount = _n(summary['transaction_count']);

    // Newest transactions first.
    txns.sort((a, b) => '${b['created_at'] ?? b['date'] ?? ''}'
        .compareTo('${a['created_at'] ?? a['date'] ?? ''}'));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // KPIs
        Wrap(spacing: 12, runSpacing: 12, children: [
          _kpi('Total Sales', _money0(totalSales), Icons.trending_up,
              const Color(0xFF16A34A)),
          _kpi('Transactions', '${txnCount.toInt()}', Icons.receipt_long,
              AppColors.kPrimary),
          _kpi('Avg Sale', _money0(txnCount > 0 ? totalSales / txnCount : 0),
              Icons.calculate_outlined, const Color(0xFF2563EB)),
        ]),
        const SizedBox(height: 20),

        // Payment method breakdown
        const Text('By Payment Method',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        if (methods.isNotEmpty) ...[
          PaymentMethodBreakdownWidget(
            mpesa: _sumMethod(methods, const ['mpesa', 'mobile_money']),
            cash: _sumMethod(methods, const ['cash']),
            card: _sumMethod(methods, const ['card', 'swipe']),
            credit: _sumMethod(methods, const ['credit', 'credit_bill']),
          ),
          const SizedBox(height: 12),
        ],
        if (methods.isEmpty)
          _muted('No payments in this period.')
        else
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: methods.map((m) {
              final raw = '${m['payment_method'] ?? 'unknown'}';
              final amount = _n(m['total_sales'] ?? m['amount']);
              final count = _n(m['transaction_count'] ?? m['count']);
              final pct = _n(m['percentage']);
              return _methodCard(raw, amount, count, pct);
            }).toList(),
          ),
        const SizedBox(height: 20),

        // Source / outlet breakdown
        const Text('By Source (POS / Outlet)',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        if (sources.isEmpty)
          _muted('No sales sources in this period.')
        else
          _card(
            child: Column(
              children: [
                for (final s in sources)
                  _sourceRow(
                    _title('${s['category'] ?? s['source'] ?? 'Other'}'),
                    _n(s['total_sales'] ?? s['amount']),
                    _n(s['transaction_count'] ?? s['count']),
                    totalSales,
                  ),
              ],
            ),
          ),
        const SizedBox(height: 20),

        // Transaction feed
        Text('Transactions (${txns.length})',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        if (txns.isEmpty)
          _muted('No transactions in this period.')
        else
          _card(
            padding: EdgeInsets.zero,
            child: ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: txns.length > 200 ? 200 : txns.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (_, i) => _txnTile(txns[i]),
            ),
          ),
      ],
    );
  }

  Widget _kpi(String label, String value, IconData icon, Color color) =>
      Container(
        width: 200,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Row(children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w800)),
                Text(label,
                    style:
                        TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              ],
            ),
          ),
        ]),
      );

  Widget _methodCard(String raw, num amount, num count, num pct) {
    final color = _methodColor(raw);
    return Container(
      width: 190,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(_methodIcon(raw), color: color, size: 18),
            const SizedBox(width: 6),
            Expanded(
              child: Text(_methodLabel(raw),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontWeight: FontWeight.w800, color: color)),
            ),
          ]),
          const SizedBox(height: 8),
          Text(_money0(amount),
              style:
                  const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
          const SizedBox(height: 2),
          Text(
              '${count.toInt()} txn${count == 1 ? '' : 's'}'
              '${pct > 0 ? ' · ${pct.toStringAsFixed(1)}%' : ''}',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
        ],
      ),
    );
  }

  Widget _sourceRow(String name, num amount, num count, num total) {
    final pct = total > 0 ? (amount / total) * 100 : 0;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(children: [
        Expanded(
          flex: 3,
          child:
              Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
        ),
        Expanded(
          flex: 4,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (pct / 100).clamp(0, 1).toDouble(),
              minHeight: 8,
              backgroundColor: Colors.grey.shade100,
              valueColor: const AlwaysStoppedAnimation(AppColors.kPrimary),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Text('${count.toInt()}',
            style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
        const SizedBox(width: 12),
        SizedBox(
          width: 110,
          child: Text(_money0(amount),
              textAlign: TextAlign.right,
              style: const TextStyle(fontWeight: FontWeight.w800)),
        ),
      ]),
    );
  }

  Widget _txnTile(Map<String, dynamic> t) {
    final method = '${t['payment_method'] ?? 'unknown'}';
    final source = '${t['source'] ?? ''}';
    final outlet = '${t['outlet'] ?? t['category'] ?? ''}';
    final amount = _n(t['total_amount'] ?? t['amount']);
    final code =
        '${t['code'] ?? t['order_number'] ?? t['transaction_number'] ?? t['reference'] ?? t['id'] ?? ''}';
    final shortCode = '${t['short_code'] ?? ''}';
    final id = '${t['id'] ?? ''}';
    final waiter = '${t['waiter_name'] ?? ''}';
    final created =
        '${t['created_at'] ?? t['transaction_date'] ?? t['date'] ?? ''}';
    String when = created;
    final parsed = DateTime.tryParse(created);
    if (parsed != null) when = DateFormat('MMM d, HH:mm').format(parsed);
    final color = _methodColor(method);
    final canOpen = source.isNotEmpty && id.isNotEmpty;

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: color.withValues(alpha: 0.12),
        child: Icon(_methodIcon(method), color: color, size: 18),
      ),
      title: Row(children: [
        Expanded(
          child: Text(code.isEmpty ? 'Sale' : code,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w700)),
        ),
        if (shortCode.isNotEmpty && shortCode != 'null')
          Container(
            margin: const EdgeInsets.only(left: 6, right: 8),
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text('#$shortCode',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade700)),
          ),
        Text(_money0(amount),
            style: const TextStyle(fontWeight: FontWeight.w900)),
      ]),
      subtitle: Text(
        [
          if (outlet.isNotEmpty) _title(outlet),
          _methodLabel(method),
          if (waiter.isNotEmpty && waiter != 'null') 'Waiter: $waiter',
          if (when.isNotEmpty) when,
        ].join(' · '),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
      ),
      trailing: canOpen ? const Icon(Icons.chevron_right, size: 18) : null,
      onTap: canOpen
          ? () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => BranchSaleDetailScreen(
                    source: source,
                    id: id,
                    fallbackCode: code.isEmpty ? null : code,
                  ),
                ),
              )
          : null,
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

  Widget _muted(String text) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Text(text, style: TextStyle(color: Colors.grey.shade500)),
      );
}
