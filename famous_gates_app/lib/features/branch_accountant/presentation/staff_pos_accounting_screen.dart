import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/theme/app_theme.dart';
import '../data/repository.dart';

final _fmt = NumberFormat('#,##0.00', 'en_KE');

String _money(dynamic v) =>
    'KES ${_fmt.format(double.tryParse(v?.toString() ?? '0') ?? 0)}';

double _d(dynamic v) => double.tryParse(v?.toString() ?? '0') ?? 0;

const _roleOptions = <String, String>{
  'all': 'All Roles',
  'waiter': 'Waiter',
  'waitress': 'Waitress',
  'head_waiter': 'Head Waiter',
  'bartender': 'Bartender',
  'barista': 'Barista',
};

class StaffPosAccountingScreen extends ConsumerStatefulWidget {
  const StaffPosAccountingScreen({super.key});

  @override
  ConsumerState<StaffPosAccountingScreen> createState() =>
      _StaffPosAccountingScreenState();
}

class _StaffPosAccountingScreenState
    extends ConsumerState<StaffPosAccountingScreen> {
  bool _busy = false;
  String? _error;
  String _role = 'all';
  DateTimeRange? _range;

  List<Map<String, dynamic>> _staff = [];
  Map<String, dynamic>? _selectedStaff;
  List<Map<String, dynamic>> _orders = [];
  bool _ordersBusy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final data = await ref
          .read(branchAccountantRepositoryProvider)
          .getStaffPosAccountingSummary(
            from: _range == null
                ? null
                : DateFormat('yyyy-MM-dd').format(_range!.start),
            to: _range == null
                ? null
                : DateFormat('yyyy-MM-dd').format(_range!.end),
            role: _role,
          );
      data.sort(
          (a, b) => _d(b['total_outstanding']).compareTo(_d(a['total_outstanding'])));
      if (!mounted) return;
      setState(() {
        _staff = data;
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

  Future<void> _openStaff(Map<String, dynamic> staff) async {
    setState(() {
      _selectedStaff = staff;
      _ordersBusy = true;
      _orders = [];
    });
    try {
      final waiterId = staff['waiter_id']?.toString() ?? '';
      final data = await ref
          .read(branchAccountantRepositoryProvider)
          .getStaffPosAccountingOrders(
            waiterId,
            from: _range == null
                ? null
                : DateFormat('yyyy-MM-dd').format(_range!.start),
            to: _range == null
                ? null
                : DateFormat('yyyy-MM-dd').format(_range!.end),
          );
      if (!mounted) return;
      setState(() {
        _orders = data;
        _ordersBusy = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _ordersBusy = false;
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
    if (_selectedStaff != null) _openStaff(_selectedStaff!);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.kSurface,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Staff POS Accounting',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: AppColors.kTextPrimary,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: _load,
                    icon: Icon(PhosphorIcons.arrowsClockwise()),
                    tooltip: 'Refresh',
                  ),
                ],
              ),
            ),
            _buildFilters(),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Text(_error!, style: const TextStyle(color: AppColors.kError)),
              ),
            Expanded(
              child: _selectedStaff == null
                  ? _buildStaffList()
                  : _buildStaffDetail(_selectedStaff!),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilters() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: DropdownButtonFormField<String>(
              initialValue: _role,
              decoration: const InputDecoration(
                isDense: true,
                labelText: 'Role',
                border: OutlineInputBorder(),
              ),
              items: _roleOptions.entries
                  .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
                  .toList(),
              onChanged: (v) {
                if (v == null) return;
                setState(() => _role = v);
                _load();
              },
            ),
          ),
          const SizedBox(width: 12),
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
                if (_selectedStaff != null) _openStaff(_selectedStaff!);
              },
              icon: Icon(PhosphorIcons.x(), size: 18),
              tooltip: 'Clear date range',
            ),
        ],
      ),
    );
  }

  Widget _buildStaffList() {
    if (_busy) return const Center(child: CircularProgressIndicator());
    if (_staff.isEmpty) {
      return const Center(child: Text('No POS orders found for this branch.'));
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      itemCount: _staff.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final staff = _staff[index];
        final outstanding = _d(staff['total_outstanding']);
        final cleared = _d(staff['total_cleared']);
        return Card(
          color: AppColors.kCardBg,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: AppColors.kDivider),
          ),
          child: ListTile(
            onTap: () => _openStaff(staff),
            leading: CircleAvatar(
              backgroundColor: AppColors.kPrimary.withValues(alpha: 0.1),
              child: Text(
                (staff['name']?.toString().isNotEmpty == true
                        ? staff['name'].toString()[0]
                        : '?')
                    .toUpperCase(),
                style: const TextStyle(
                    color: AppColors.kPrimary, fontWeight: FontWeight.w700),
              ),
            ),
            title: Text(staff['name']?.toString() ?? 'Unknown',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(
              '${(staff['role']?.toString() ?? '-').replaceAll('_', ' ')} • ${staff['total_orders']} orders',
              style: const TextStyle(color: AppColors.kTextSecondary, fontSize: 12),
            ),
            trailing: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_money(cleared),
                    style: const TextStyle(
                        color: AppColors.kSuccess,
                        fontWeight: FontWeight.w600,
                        fontSize: 13)),
                if (outstanding > 0)
                  Text(
                    '${_money(outstanding)} (${staff['outstanding_order_count']})',
                    style: const TextStyle(
                        color: AppColors.kError,
                        fontWeight: FontWeight.w600,
                        fontSize: 13),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildStaffDetail(Map<String, dynamic> staff) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
          child: Row(
            children: [
              IconButton(
                onPressed: () => setState(() => _selectedStaff = null),
                icon: Icon(PhosphorIcons.caretLeft()),
              ),
              Expanded(
                child: Text(
                  staff['name']?.toString() ?? 'Unknown',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: _ordersBusy
              ? const Center(child: CircularProgressIndicator())
              : _orders.isEmpty
                  ? const Center(child: Text('No orders found for this staff member.'))
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                      itemCount: _orders.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final order = _orders[index];
                        final outstanding = order['clearance_status'] == 'outstanding';
                        return Card(
                          color: AppColors.kCardBg,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: const BorderSide(color: AppColors.kDivider),
                          ),
                          child: ListTile(
                            title: Text(
                              order['order_type']?.toString() ?? 'Order',
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            subtitle: Text(
                              order['created_at']?.toString() ?? '',
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
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: (outstanding
                                            ? AppColors.kError
                                            : AppColors.kSuccess)
                                        .withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    outstanding ? 'Outstanding' : 'Cleared',
                                    style: TextStyle(
                                      color: outstanding
                                          ? AppColors.kError
                                          : AppColors.kSuccess,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 11,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
        ),
      ],
    );
  }
}
