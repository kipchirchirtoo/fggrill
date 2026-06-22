import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/theme/app_theme.dart';
import '../data/repository.dart';

final _fmt = NumberFormat('#,##0.00', 'en_KE');
final _dateFmt = DateFormat('MMM d, y • hh:mm:ss a');

String _money(dynamic v) =>
    'KES ${_fmt.format(double.tryParse(v?.toString() ?? '0') ?? 0)}';

String _dateTime(dynamic v) {
  if (v == null) return '-';
  final parsed = DateTime.tryParse(v.toString());
  if (parsed == null) return v.toString();
  return _dateFmt.format(parsed.toLocal());
}

const _statusOptions = <String, String>{
  'all': 'All statuses',
  'open': 'Open',
  'paid': 'Paid',
  'credit_bill': 'Credit Bill',
  'voided': 'Voided',
};

/// Full audit feed of every POS order placed at the branch, across all
/// outlets and waiters — every column on pos_shift_orders plus resolved
/// outlet/waiter names, linked credit bill, and clearing payments.
class PosDeepDrillScreen extends ConsumerStatefulWidget {
  const PosDeepDrillScreen({super.key});

  @override
  ConsumerState<PosDeepDrillScreen> createState() => _PosDeepDrillScreenState();
}

class _PosDeepDrillScreenState extends ConsumerState<PosDeepDrillScreen> {
  bool _busy = false;
  String? _error;
  String _status = 'all';
  DateTimeRange? _range;
  final _searchController = TextEditingController();
  String _search = '';

  List<Map<String, dynamic>> _orders = [];
  int _total = 0;
  int _offset = 0;
  static const _pageSize = 100;

  String? _expandedOrderId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load({bool resetOffset = true}) async {
    if (resetOffset) _offset = 0;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await ref
          .read(branchAccountantRepositoryProvider)
          .getPosDeepDrillOrders(
            from: _range == null
                ? null
                : DateFormat('yyyy-MM-dd').format(_range!.start),
            to: _range == null
                ? null
                : DateFormat('yyyy-MM-dd').format(_range!.end),
            status: _status == 'all' ? null : _status,
            search: _search.trim().isEmpty ? null : _search.trim(),
            limit: _pageSize,
            offset: _offset,
          );
      if (!mounted) return;
      setState(() {
        _orders = result['data'] as List<Map<String, dynamic>>;
        _total = result['total'] as int;
        _busy = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _busy = false;
        });
      }
    }
  }

  Future<void> _pickRange() async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2024, 1, 1),
      lastDate: DateTime.now(),
      initialDateRange: _range,
    );
    if (picked == null) return;
    setState(() => _range = picked);
    _load();
  }

  void _nextPage() {
    if (_offset + _pageSize >= _total) return;
    setState(() => _offset += _pageSize);
    _load(resetOffset: false);
  }

  void _prevPage() {
    if (_offset == 0) return;
    setState(() => _offset = (_offset - _pageSize).clamp(0, _total));
    _load(resetOffset: false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.kSurface,
      appBar: AppBar(
        title: const Text('POS Deep Drill — Full Order Audit'),
        backgroundColor: AppColors.kCardBg,
        foregroundColor: AppColors.kTextPrimary,
        elevation: 0,
        actions: [
          IconButton(
            onPressed: () => _load(),
            icon: Icon(PhosphorIcons.arrowsClockwise()),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildFilters(),
            if (_error != null)
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Text(_error!,
                    style: const TextStyle(color: AppColors.kError)),
              ),
            Expanded(
              child: _busy
                  ? const Center(child: CircularProgressIndicator())
                  : _orders.isEmpty
                      ? const Center(
                          child: Text('No POS orders found for this filter.'))
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
                          itemCount: _orders.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (context, index) =>
                              _buildOrderTile(_orders[index]),
                        ),
            ),
            _buildPager(),
          ],
        ),
      ),
    );
  }

  Widget _buildFilters() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
      child: Wrap(
        spacing: 12,
        runSpacing: 8,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          SizedBox(
            width: 260,
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                isDense: true,
                hintText: 'Search bill code, order #, customer, waiter...',
                prefixIcon: Icon(PhosphorIcons.magnifyingGlass(), size: 18),
                border: const OutlineInputBorder(),
              ),
              onSubmitted: (v) {
                _search = v;
                _load();
              },
            ),
          ),
          SizedBox(
            width: 180,
            child: DropdownButtonFormField<String>(
              initialValue: _status,
              decoration: const InputDecoration(
                isDense: true,
                labelText: 'Status',
                border: OutlineInputBorder(),
              ),
              items: _statusOptions.entries
                  .map((e) =>
                      DropdownMenuItem(value: e.key, child: Text(e.value)))
                  .toList(),
              onChanged: (v) {
                if (v == null) return;
                setState(() => _status = v);
                _load();
              },
            ),
          ),
          OutlinedButton.icon(
            onPressed: _pickRange,
            icon: Icon(PhosphorIcons.calendarBlank(), size: 18),
            label: Text(_range == null
                ? 'All dates'
                : '${DateFormat('MMM d').format(_range!.start)} - ${DateFormat('MMM d').format(_range!.end)}'),
          ),
          if (_range != null)
            IconButton(
              onPressed: () {
                setState(() => _range = null);
                _load();
              },
              icon: Icon(PhosphorIcons.x(), size: 18),
              tooltip: 'Clear date range',
            ),
          Text(
            '$_total order${_total == 1 ? '' : 's'} found',
            style:
                const TextStyle(color: AppColors.kTextSecondary, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildPager() {
    if (_total <= _pageSize) return const SizedBox.shrink();
    final from = _offset + 1;
    final to = (_offset + _pageSize).clamp(0, _total);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          Text('$from–$to of $_total',
              style: const TextStyle(
                  color: AppColors.kTextSecondary, fontSize: 12)),
          IconButton(
            onPressed: _offset == 0 ? null : _prevPage,
            icon: const Icon(Icons.chevron_left),
          ),
          IconButton(
            onPressed: _offset + _pageSize >= _total ? null : _nextPage,
            icon: const Icon(Icons.chevron_right),
          ),
        ],
      ),
    );
  }

  Widget _buildOrderTile(Map<String, dynamic> order) {
    final id = order['id']?.toString() ?? '';
    final outstanding = order['clearance_status'] == 'outstanding';
    final voided = order['status'] == 'voided';
    final expanded = _expandedOrderId == id;
    final shortCode = order['short_code']?.toString();
    final orderNumber = order['order_number']?.toString();

    return Container(
      decoration: BoxDecoration(
        color: AppColors.kCardBg,
        borderRadius: BorderRadius.circular(12),
        border:
            const Border.fromBorderSide(BorderSide(color: AppColors.kDivider)),
      ),
      child: Column(
        children: [
          ListTile(
            onTap: () =>
                setState(() => _expandedOrderId = expanded ? null : id),
            leading: CircleAvatar(
              backgroundColor: (voided
                      ? AppColors.kError
                      : outstanding
                          ? AppColors.kWarning
                          : AppColors.kSuccess)
                  .withValues(alpha: 0.12),
              child: Icon(
                voided ? PhosphorIcons.prohibit() : PhosphorIcons.receipt(),
                size: 18,
                color: voided
                    ? AppColors.kError
                    : outstanding
                        ? AppColors.kWarning
                        : AppColors.kSuccess,
              ),
            ),
            title: Text(
              shortCode != null && shortCode.isNotEmpty
                  ? 'Bill #$shortCode'
                  : (orderNumber ?? 'Order $id'),
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            subtitle: Text(
              '${order['outlet_name'] ?? '-'} • ${order['order_type'] ?? '-'} • '
              'Placed ${_dateTime(order['created_at'])}',
              style: const TextStyle(
                  color: AppColors.kTextSecondary, fontSize: 12),
            ),
            trailing: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_money(order['total_amount']),
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: (voided
                            ? AppColors.kError
                            : outstanding
                                ? AppColors.kWarning
                                : AppColors.kSuccess)
                        .withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    voided
                        ? 'Voided'
                        : outstanding
                            ? 'Outstanding'
                            : 'Cleared',
                    style: TextStyle(
                      color: voided
                          ? AppColors.kError
                          : outstanding
                              ? AppColors.kWarning
                              : AppColors.kSuccess,
                      fontWeight: FontWeight.w600,
                      fontSize: 11,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (expanded) _buildOrderDetail(order),
        ],
      ),
    );
  }

  Widget _buildOrderDetail(Map<String, dynamic> order) {
    final items = (order['items'] as List?) ?? const [];
    final payments = (order['payments'] as List?) ?? const [];

    Widget kv(String label, String value) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 150,
                child: Text(label,
                    style: const TextStyle(
                        color: AppColors.kTextSecondary, fontSize: 12)),
              ),
              Expanded(
                child: Text(value.isEmpty ? '-' : value,
                    style: const TextStyle(fontSize: 12)),
              ),
            ],
          ),
        );

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.kDivider)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 12),
          const Text('Identifiers',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          kv('Order ID:', order['id']?.toString() ?? ''),
          kv('Order #:', order['order_number']?.toString() ?? ''),
          kv('Bill lookup code:', order['short_code']?.toString() ?? ''),
          kv('Shift ID:', order['shift_id']?.toString() ?? ''),
          kv('Source:',
              '${order['source_type'] ?? '-'} (${order['source_id'] ?? '-'})'),
          const SizedBox(height: 10),
          const Text('Where / who',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          kv('Outlet:',
              '${order['outlet_name'] ?? '-'} (${order['outlet_code'] ?? '-'})'),
          kv('Table / Room:',
              '${order['table_number'] ?? '-'} / ${order['room_number'] ?? '-'}'),
          kv('Customer:', order['customer_name']?.toString() ?? ''),
          kv('Waiter:',
              '${order['waiter_resolved_name'] ?? order['waiter_name'] ?? '-'} (${order['waiter_role'] ?? '-'})'),
          kv('Created by (user id):', order['created_by']?.toString() ?? ''),
          const SizedBox(height: 10),
          const Text('Status',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          kv('Order status:', order['status']?.toString() ?? ''),
          kv('Payment status:', order['payment_status']?.toString() ?? ''),
          kv('Kitchen status:', order['kitchen_status']?.toString() ?? ''),
          kv('Clearance:', order['clearance_status']?.toString() ?? ''),
          kv('Void request status:',
              order['void_request_status']?.toString() ?? ''),
          if (order['voided_at'] != null) ...[
            kv('Voided at:', _dateTime(order['voided_at'])),
            kv('Voided by (user id):', order['voided_by']?.toString() ?? ''),
            kv('Void reason:', order['void_reason']?.toString() ?? ''),
          ],
          kv('Split / Merged:',
              'split=${order['is_split'] == true}, merged=${order['is_merged'] == true}'),
          const SizedBox(height: 10),
          const Text('Money',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          kv('Total:', _money(order['total_amount'])),
          kv('Amount paid:', _money(order['amount_paid'])),
          kv('Balance:', _money(order['balance_amount'])),
          kv(
              'Linked credit bill:',
              order['credit_bill'] != null
                  ? '${order['credit_bill']['id']} (${order['credit_bill']['status']})'
                  : ''),
          const SizedBox(height: 10),
          const Text('Timestamps',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          kv('Placed (created_at):', _dateTime(order['created_at'])),
          kv('Last updated:', _dateTime(order['updated_at'])),
          kv('Cleared (last payment):', _dateTime(order['cleared_at'])),
          kv('Kitchen started:', _dateTime(order['kitchen_started_at'])),
          kv('Kitchen ready:', _dateTime(order['kitchen_ready_at'])),
          kv('Kitchen served:', _dateTime(order['kitchen_served_at'])),
          kv('Captain ticket printed:', _dateTime(order['captain_printed_at'])),
          kv('Bill reprint count:',
              order['bill_reprint_count']?.toString() ?? '0'),
          kv('Inventory posted:', _dateTime(order['inventory_posted_at'])),
          kv('Inventory reversed:', _dateTime(order['inventory_reversed_at'])),
          if (items.isNotEmpty) ...[
            const SizedBox(height: 10),
            const Text('Items',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            ...items.map((raw) {
              final item = raw as Map<String, dynamic>;
              final qty = item['quantity'] ?? item['qty'] ?? '';
              final name = item['name'] ?? item['item_name'] ?? 'Item';
              final price = item['unit_price'] ?? item['price'] ?? 0;
              return kv('$name', 'x$qty @ ${_money(price)}');
            }),
          ],
          if (payments.isNotEmpty) ...[
            const SizedBox(height: 10),
            const Text('Payments',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            ...payments.map((raw) {
              final p = raw as Map<String, dynamic>;
              return kv(
                '${p['payment_method'] ?? '-'} @ ${_dateTime(p['created_at'])}:',
                '${_money(p['amount'])}${(p['reference'] ?? '').toString().isNotEmpty ? ' (ref: ${p['reference']})' : ''}',
              );
            }),
          ],
        ],
      ),
    );
  }
}
