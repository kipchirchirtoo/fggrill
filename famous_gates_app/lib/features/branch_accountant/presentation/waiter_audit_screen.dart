import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../data/repository.dart';

class WaiterAuditScreen extends ConsumerStatefulWidget {
  const WaiterAuditScreen({super.key});

  @override
  ConsumerState<WaiterAuditScreen> createState() => _WaiterAuditScreenState();
}

class _WaiterAuditScreenState extends ConsumerState<WaiterAuditScreen> {
  late Future<List<Map<String, dynamic>>> _waitersFuture = _loadWaiters();
  String? _selectedWaiterId;
  Map<String, dynamic>? _selectedWaiter;
  Map<String, dynamic>? _orderData;
  bool _loadingOrders = false;
  DateTime _selectedDate = DateTime.now();
  final Set<String> _busyOrderIds = {};

  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text;
      });
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<List<Map<String, dynamic>>> _loadWaiters() {
    return ref.read(branchAccountantRepositoryProvider).getBranchWaiters();
  }

  void _refresh() {
    setState(() {
      _waitersFuture = _loadWaiters();
      _selectedWaiterId = null;
      _selectedWaiter = null;
      _orderData = null;
    });
  }

  Future<void> _selectWaiter(Map<String, dynamic> waiter) async {
    if (_selectedWaiterId == '${waiter['id']}') return;

    setState(() {
      _selectedWaiterId = '${waiter['id']}';
      _selectedWaiter = waiter;
      _loadingOrders = true;
      _orderData = null;
    });

    await _loadOrders();
  }

  Future<void> _loadOrders() async {
    if (_selectedWaiterId == null) return;

    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
      final data = await ref
          .read(branchAccountantRepositoryProvider)
          .getWaiterOrders(waiterId: _selectedWaiterId!, date: dateStr);

      if (!mounted) return;
      setState(() {
        _orderData = data;
        _loadingOrders = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _loadingOrders = false);
      _showMessage('Failed to load orders: $error');
    }
  }

  Future<void> _changeDate(DateTime? newDate) async {
    if (newDate == null || newDate == _selectedDate) return;
    setState(() {
      _selectedDate = newDate;
      if (_selectedWaiterId != null) {
        _loadingOrders = true;
      }
    });
    if (_selectedWaiterId != null) {
      await _loadOrders();
    }
  }

  Future<void> _createCreditBill(Map<String, dynamic> order) async {
    final orderId = '${order['id'] ?? ''}';
    if (orderId.isEmpty || _busyOrderIds.contains(orderId)) return;

    // Confirm with user
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Create Credit Bill'),
        content: Text(
          'Create a credit bill for ${order['customer_name'] ?? 'this order'} '
          '(${order['order_number']})?\n\n'
          'Amount: KES ${_formatMoney(order['total_amount'])}',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Create'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _busyOrderIds.add(orderId));

    try {
      // Call the repository to create a credit bill
      // This endpoint already exists and prevents duplicates
      await ref.read(branchAccountantRepositoryProvider).createCreditBillFromOrder(
        orderId: order['id'],
        orderNumber: order['order_number'],
        customerName: order['customer_name'] ?? order['waiter_name'] ?? 'Walk-in',
        amount: order['total_amount'],
      );

      if (!mounted) return;
      _showMessage('Credit bill created successfully');

      // Reload orders to reflect the change
      await _loadOrders();
    } catch (error) {
      if (!mounted) return;
      _showMessage('Failed to create credit bill: $error');
    } finally {
      if (mounted) setState(() => _busyOrderIds.remove(orderId));
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  String _formatMoney(dynamic value) {
    final amount = value is num ? value : double.tryParse('$value') ?? 0;
    return NumberFormat('#,##0.00').format(amount);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Waiter / Bartender Audit'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _refresh,
            tooltip: 'Refresh',
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _waitersFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline,
                        size: 48, color: Colors.red),
                    const SizedBox(height: 16),
                    Text('Error: ${snapshot.error}'),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: _refresh,
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            );
          }

          final waiters = snapshot.data ?? [];
          final filteredWaiters = waiters.where((w) {
            if (_searchQuery.isEmpty) return true;
            final name = '${w['staff_name'] ?? ''} ${w['first_name'] ?? ''} ${w['last_name'] ?? ''} ${w['employee_number'] ?? ''} ${w['employee_id'] ?? ''}'.toLowerCase();
            return name.contains(_searchQuery.toLowerCase());
          }).toList();

          if (waiters.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.people_outline,
                      size: 64, color: AppColors.kTextSecondary),
                  const SizedBox(height: 16),
                  Text(
                    'No waiters/bartenders found',
                    style: TextStyle(
                      fontSize: 18,
                      color: AppColors.kTextSecondary,
                    ),
                  ),
                ],
              ),
            );
          }

          return LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth > 900;

              final waiterList = _WaiterList(
                waiters: filteredWaiters,
                selectedId: _selectedWaiterId,
                onSelect: _selectWaiter,
                searchController: _searchController,
              );

              final ordersPanel = _WaiterOrdersPanel(
                waiter: _selectedWaiter,
                orderData: _orderData,
                loading: _loadingOrders,
                selectedDate: _selectedDate,
                onDateChange: _changeDate,
                onCreateCreditBill: _createCreditBill,
                busyOrderIds: _busyOrderIds,
              );

              if (wide) {
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(width: 380, child: waiterList),
                    const VerticalDivider(width: 1),
                    Expanded(child: ordersPanel),
                  ],
                );
              } else {
                return Column(
                  children: [
                    SizedBox(height: 200, child: waiterList),
                    const Divider(height: 1),
                    Expanded(child: ordersPanel),
                  ],
                );
              }
            },
          );
        },
      ),
    );
  }
}

class _WaiterList extends StatelessWidget {
  const _WaiterList({
    required this.waiters,
    required this.selectedId,
    required this.onSelect,
    required this.searchController,
  });

  final List<Map<String, dynamic>> waiters;
  final String? selectedId;
  final ValueChanged<Map<String, dynamic>> onSelect;
  final TextEditingController searchController;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.kSurface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(
                bottom: BorderSide(color: AppColors.kDivider),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Waiters & Bartenders',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 4),
                Text(
                  '${waiters.length} staff members',
                  style: TextStyle(
                    fontSize: 14,
                    color: AppColors.kTextSecondary,
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: searchController,
                  decoration: InputDecoration(
                    hintText: 'Search waiter or bartender...',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(color: AppColors.kDivider),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(color: AppColors.kDivider),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: Colors.orange),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: waiters.isEmpty
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(16),
                      child: Text('No waiters matching search'),
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: waiters.length,
                    itemBuilder: (context, index) {
                final waiter = waiters[index];
                final selected = '${waiter['id']}' == selectedId;
                final name = waiter['staff_name'] ??
                    '${waiter['first_name'] ?? ''} ${waiter['last_name'] ?? ''}'.trim();
                final role = '${waiter['role'] ?? ''}'.replaceAll('_', ' ').toUpperCase();
                final employeeNumber = waiter['employee_number'] ?? waiter['employee_id'];

                return InkWell(
                  onTap: () => onSelect(waiter),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: selected ? Colors.orange : AppColors.kDivider,
                        width: selected ? 2 : 1,
                      ),
                      boxShadow: selected
                          ? [
                              BoxShadow(
                                color: Colors.orange.withOpacity(0.2),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              )
                            ]
                          : null,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            CircleAvatar(
                              radius: 18,
                              backgroundColor: selected
                                  ? Colors.orange
                                  : AppColors.kPrimary.withOpacity(0.1),
                              child: Icon(
                                Icons.person,
                                size: 18,
                                color: selected
                                    ? Colors.white
                                    : AppColors.kPrimary,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    name,
                                    style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 15,
                                      color: selected
                                          ? Colors.orange.shade800
                                          : AppColors.kTextPrimary,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    role,
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: AppColors.kTextSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        if (employeeNumber != null) ...[
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.kSurface,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              'ID: $employeeNumber',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _WaiterOrdersPanel extends StatelessWidget {
  const _WaiterOrdersPanel({
    required this.waiter,
    required this.orderData,
    required this.loading,
    required this.selectedDate,
    required this.onDateChange,
    required this.onCreateCreditBill,
    required this.busyOrderIds,
  });

  final Map<String, dynamic>? waiter;
  final Map<String, dynamic>? orderData;
  final bool loading;
  final DateTime selectedDate;
  final ValueChanged<DateTime?> onDateChange;
  final ValueChanged<Map<String, dynamic>> onCreateCreditBill;
  final Set<String> busyOrderIds;

  String _formatMoney(dynamic value) {
    final amount = value is num ? value : double.tryParse('$value') ?? 0;
    return NumberFormat('#,##0.00').format(amount);
  }

  @override
  Widget build(BuildContext context) {
    if (waiter == null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.arrow_back, size: 64, color: AppColors.kTextSecondary),
            const SizedBox(height: 16),
            Text(
              'Select a waiter to view their orders',
              style: TextStyle(
                fontSize: 18,
                color: AppColors.kTextSecondary,
              ),
            ),
          ],
        ),
      );
    }

    final waiterName = waiter!['staff_name'] ??
        '${waiter!['first_name'] ?? ''} ${waiter!['last_name'] ?? ''}'.trim();
    final orders = orderData?['orders'] as List? ?? [];
    final summary = orderData?['summary'] as Map<String, dynamic>? ?? {};

    return Container(
      color: Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header with date picker
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.kSurface,
              border: Border(bottom: BorderSide(color: AppColors.kDivider)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            waiterName,
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Orders for ${DateFormat('MMM dd, yyyy').format(selectedDate)}',
                            style: TextStyle(
                              fontSize: 14,
                              color: AppColors.kTextSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    FilledButton.icon(
                      onPressed: () async {
                        final date = await showDatePicker(
                          context: context,
                          initialDate: selectedDate,
                          firstDate: DateTime.now().subtract(const Duration(days: 365)),
                          lastDate: DateTime.now(),
                        );
                        onDateChange(date);
                      },
                      icon: const Icon(Icons.calendar_today, size: 16),
                      label: const Text('Change Date'),
                    ),
                  ],
                ),
                if (loading) ...[
                  const SizedBox(height: 12),
                  const LinearProgressIndicator(minHeight: 2),
                ],
              ],
            ),
          ),

          // Summary cards
          if (summary.isNotEmpty && !loading) ...[
            Container(
              padding: const EdgeInsets.all(16),
              child: Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  _SummaryCard(
                    label: 'Total Orders',
                    value: '${summary['total_orders'] ?? 0}',
                    icon: Icons.receipt_long,
                    color: AppColors.kPrimary,
                  ),
                  _SummaryCard(
                    label: 'Total Sales',
                    value: 'KES ${_formatMoney(summary['total_sales'])}',
                    icon: Icons.payments,
                    color: Colors.green.shade700,
                  ),
                  _SummaryCard(
                    label: 'Paid',
                    value: '${summary['paid_orders'] ?? 0}',
                    icon: Icons.check_circle,
                    color: Colors.green.shade700,
                  ),
                  _SummaryCard(
                    label: 'Unpaid',
                    value: '${summary['unpaid_orders'] ?? 0}',
                    icon: Icons.pending,
                    color: Colors.orange.shade700,
                  ),
                  _SummaryCard(
                    label: 'Voided',
                    value: '${summary['voided_orders'] ?? 0}',
                    icon: Icons.block,
                    color: Colors.red.shade700,
                  ),
                  _SummaryCard(
                    label: 'Credit Bills',
                    value: '${summary['credit_bills'] ?? 0}',
                    icon: Icons.credit_card,
                    color: Colors.blue.shade700,
                  ),
                  _SummaryCard(
                    label: 'Reprints',
                    value: '${summary['total_reprints'] ?? 0}',
                    icon: Icons.print,
                    color: Colors.purple.shade700,
                  ),
                  _SummaryCard(
                    label: 'Avg Order',
                    value: 'KES ${_formatMoney(summary['average_order_value'])}',
                    icon: Icons.analytics,
                    color: Colors.teal.shade700,
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
          ],

          // Orders list
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : orders.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.inbox,
                                  size: 64, color: AppColors.kTextSecondary),
                              const SizedBox(height: 16),
                              Text(
                                'No orders for this date',
                                style: TextStyle(
                                  fontSize: 18,
                                  color: AppColors.kTextSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: orders.length,
                        itemBuilder: (context, index) {
                          final order = orders[index];
                          return _OrderCard(
                            order: order,
                            onCreateCreditBill: onCreateCreditBill,
                            busy: busyOrderIds.contains('${order['id']}'),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
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
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 20, color: color),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  color: AppColors.kTextSecondary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({
    required this.order,
    required this.onCreateCreditBill,
    required this.busy,
  });

  final Map<String, dynamic> order;
  final ValueChanged<Map<String, dynamic>> onCreateCreditBill;
  final bool busy;

  String _formatMoney(dynamic value) {
    final amount = value is num ? value : double.tryParse('$value') ?? 0;
    return NumberFormat('#,##0.00').format(amount);
  }

  String _formatTime(String? timestamp) {
    if (timestamp == null || timestamp.isEmpty) return 'N/A';
    try {
      final date = DateTime.parse(timestamp);
      return DateFormat('h:mm a').format(date);
    } catch (_) {
      return timestamp;
    }
  }

  @override
  Widget build(BuildContext context) {
    final orderNumber = order['order_number'] ?? 'N/A';
    final shortCode = order['short_code'] ?? '';
    final customerName = order['customer_name'] ?? 'Walk-in';
    final totalAmount = order['total_amount'] ?? 0;
    final itemCount = order['item_count'] ?? 0;
    final itemNames = order['item_names'] ?? '';
    final paymentStatus = '${order['payment_status'] ?? ''}'.toUpperCase();
    final isVoided = order['is_voided'] == true;
    final voidCount = order['void_count'] ?? 0;
    final reprintCount = order['reprint_count'] ?? 0;
    final hasCreditBill = order['has_credit_bill'] == true;
    final creditBillNumber = order['credit_bill_number'];
    final canCreateCreditBill = order['can_create_credit_bill'] == true;
    final createdAt = _formatTime(order['created_at']);

    Color statusColor = AppColors.kTextSecondary;
    if (isVoided) {
      statusColor = Colors.red.shade700;
    } else if (paymentStatus == 'PAID') {
      statusColor = Colors.green.shade700;
    } else if (paymentStatus == 'UNPAID') {
      statusColor = Colors.orange.shade700;
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isVoided
              ? Colors.red.shade300
              : hasCreditBill
                  ? Colors.blue.shade300
                  : AppColors.kDivider,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            orderNumber,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          if (shortCode.isNotEmpty) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.kSurface,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                '#$shortCode',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        customerName,
                        style: TextStyle(
                          fontSize: 14,
                          color: AppColors.kTextSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'KES ${_formatMoney(totalAmount)}',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: AppColors.kPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        paymentStatus,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: statusColor,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Divider(height: 1),
            const SizedBox(height: 12),
            Wrap(
              spacing: 12,
              runSpacing: 8,
              children: [
                _OrderMeta(
                  icon: Icons.access_time,
                  label: 'Time',
                  value: createdAt,
                ),
                _OrderMeta(
                  icon: Icons.shopping_cart,
                  label: 'Items',
                  value: '$itemCount',
                ),
                if (reprintCount > 0)
                  _OrderMeta(
                    icon: Icons.print,
                    label: 'Reprints',
                    value: '$reprintCount',
                    color: Colors.purple.shade700,
                  ),
                if (voidCount > 0)
                  _OrderMeta(
                    icon: Icons.block,
                    label: 'Void Attempts',
                    value: '$voidCount',
                    color: Colors.red.shade700,
                  ),
                if (hasCreditBill)
                  _OrderMeta(
                    icon: Icons.credit_card,
                    label: 'Credit Bill',
                    value: creditBillNumber ?? 'Yes',
                    color: Colors.blue.shade700,
                  ),
              ],
            ),
            if (itemNames.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.kSurface,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(Icons.restaurant_menu,
                        size: 16, color: AppColors.kTextSecondary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        itemNames,
                        style: TextStyle(
                          fontSize: 13,
                          color: AppColors.kTextSecondary,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (canCreateCreditBill && !busy) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () => onCreateCreditBill(order),
                  icon: const Icon(Icons.add_card, size: 18),
                  label: const Text('Create Credit Bill'),
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.blue.shade700,
                  ),
                ),
              ),
            ],
            if (busy) ...[
              const SizedBox(height: 12),
              const LinearProgressIndicator(minHeight: 2),
            ],
          ],
        ),
      ),
    );
  }
}

class _OrderMeta extends StatelessWidget {
  const _OrderMeta({
    required this.icon,
    required this.label,
    required this.value,
    this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final effectiveColor = color ?? AppColors.kTextSecondary;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: effectiveColor),
        const SizedBox(width: 4),
        Text(
          '$label: ',
          style: TextStyle(
            fontSize: 12,
            color: AppColors.kTextSecondary,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: effectiveColor,
          ),
        ),
      ],
    );
  }
}
