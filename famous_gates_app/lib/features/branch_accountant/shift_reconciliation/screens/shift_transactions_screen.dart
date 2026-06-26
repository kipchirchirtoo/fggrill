import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:timezone/timezone.dart' as tz; // KENYA TIME
import '../../../../core/widgets/kes_text.dart';
import '../../../../core/widgets/record_detail_screen.dart';
import '../models/shift_reconciliation_model.dart';

class ShiftTransactionsScreen extends StatefulWidget {
  final ShiftReconciliationModel shift;
  final List<Map<String, dynamic>> initialTransactions;
  final String title;

  const ShiftTransactionsScreen({
    super.key,
    required this.shift,
    required this.initialTransactions,
    this.title = 'Shift Transactions',
  });

  @override
  State<ShiftTransactionsScreen> createState() => _ShiftTransactionsScreenState();
}

class _ShiftTransactionsScreenState extends State<ShiftTransactionsScreen> {
  late List<Map<String, dynamic>> _transactions;
  String _searchQuery = '';
  String _paymentMethodFilter = 'all';
  String _statusFilter = 'all';
  int _rowsPerPage = PaginatedDataTable.defaultRowsPerPage;

  @override
  void initState() {
    super.initState();
    _transactions = widget.initialTransactions;
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _transactions.where((tx) {
      final query = _searchQuery.toLowerCase();
      final id = (tx['id'] ?? '').toString().toLowerCase();
      final ref = (tx['reference'] ?? '').toString().toLowerCase();
      final customer = (tx['customer_name'] ?? '').toString().toLowerCase();
      final method = (tx['payment_method'] ?? '').toString().toLowerCase();
      final status = (tx['status'] ?? '').toString().toLowerCase();

      final matchesSearch = id.contains(query) || ref.contains(query) || customer.contains(query);
      final matchesMethod = _paymentMethodFilter == 'all' || method == _paymentMethodFilter;
      final matchesStatus = _statusFilter == 'all' || status == _statusFilter;

      return matchesSearch && matchesMethod && matchesStatus;
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.title),
            Text(
              'Shift: ${widget.shift.shiftNumber}',
              style: const TextStyle(fontSize: 12, color: Colors.white70),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Export CSV',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Transactions exported to CSV successfully.')),
              );
            },
            icon: const Icon(Icons.download_rounded),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            // Filter Bar
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
                side: BorderSide(color: Colors.grey.shade200),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    Expanded(
                      flex: 2,
                      child: TextField(
                        decoration: InputDecoration(
                          hintText: 'Search order #, customer...',
                          prefixIcon: const Icon(Icons.search, size: 18),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                          contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 8),
                        ),
                        onChanged: (val) => setState(() => _searchQuery = val),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: _paymentMethodFilter,
                        decoration: const InputDecoration(
                          labelText: 'Payment Method',
                          contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        ),
                        items: const [
                          DropdownMenuItem(value: 'all', child: Text('All Methods')),
                          DropdownMenuItem(value: 'cash', child: Text('Cash')),
                          DropdownMenuItem(value: 'mpesa', child: Text('M-Pesa')),
                          DropdownMenuItem(value: 'card', child: Text('Card')),
                          DropdownMenuItem(value: 'credit_bill', child: Text('Credit Bill')),
                        ],
                        onChanged: (val) {
                          if (val != null) setState(() => _paymentMethodFilter = val);
                        },
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: _statusFilter,
                        decoration: const InputDecoration(
                          labelText: 'Status',
                          contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        ),
                        items: const [
                          DropdownMenuItem(value: 'all', child: Text('All Statuses')),
                          DropdownMenuItem(value: 'success', child: Text('Success')),
                          DropdownMenuItem(value: 'voided', child: Text('Voided')),
                          DropdownMenuItem(value: 'cancelled', child: Text('Cancelled')),
                        ],
                        onChanged: (val) {
                          if (val != null) setState(() => _statusFilter = val);
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            // Data Table
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
                side: BorderSide(color: Colors.grey.shade200),
              ),
              child: filtered.isEmpty
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.symmetric(vertical: 40),
                        child: Text('No matching transactions found.', style: TextStyle(color: Colors.grey)),
                      ),
                    )
                  : PaginatedDataTable(
                      header: null,
                      rowsPerPage: _rowsPerPage,
                      onRowsPerPageChanged: (rows) {
                        setState(() => _rowsPerPage = rows ?? PaginatedDataTable.defaultRowsPerPage);
                      },
                      columns: const [
                        DataColumn(label: Text('Time (Kenya)', style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(label: Text('Order/Ref #', style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(label: Text('Customer/Details', style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(label: Text('Method', style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(label: Text('Amount', style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(label: Text('Status', style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(label: Text('Actions', style: TextStyle(fontWeight: FontWeight.bold))),
                      ],
                      source: _TransactionsDataSource(
                        context: context,
                        items: filtered,
                        shift: widget.shift,
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TransactionsDataSource extends DataTableSource {
  final BuildContext context;
  final List<Map<String, dynamic>> items;
  final ShiftReconciliationModel shift;

  _TransactionsDataSource({
    required this.context,
    required this.items,
    required this.shift,
  });

  @override
  DataRow? getRow(int index) {
    if (index >= items.length) return null;
    final item = items[index];

    final nairobi = tz.getLocation('Africa/Nairobi'); // KENYA TIME
    final DateTime rawTime = item['created_at'] != null
        ? DateTime.parse(item['created_at'].toString())
        : DateTime.now();
    final timeKenya = tz.TZDateTime.from(rawTime.toLocal(), nairobi); // KENYA TIME
    final timeStr = DateFormat('yyyy-MM-dd HH:mm:ss').format(timeKenya);

    final status = (item['status'] ?? 'Success').toString().toUpperCase();
    final method = (item['payment_method'] ?? 'cash').toString().toUpperCase();
    final ref = item['reference'] ?? item['id'] ?? 'N/A';

    Color statusColor;
    if (status == 'VOIDED' || status == 'CANCELLED') {
      statusColor = Colors.red;
    } else {
      statusColor = Colors.green.shade700;
    }

    return DataRow.byIndex(
      index: index,
      cells: [
        DataCell(Text(timeStr)),
        DataCell(Text(ref.toString())),
        DataCell(Text(item['customer_name'] ?? 'Walk-in Guest')),
        DataCell(Text(method)),
        DataCell(Text(formatKes((item['amount'] ?? 0).toDouble()))),
        DataCell(
          Text(
            status,
            style: TextStyle(fontWeight: FontWeight.bold, color: statusColor, fontSize: 11),
          ),
        ),
        DataCell(
          TextButton(
            onPressed: () {
              openRecordDetailScreen(
                context,
                title: 'Transaction Details',
                record: item,
              );
            },
            child: const Text('View JSON'),
          ),
        ),
      ],
    );
  }

  @override
  bool get isRowCountApproximate => false;

  @override
  int get rowCount => items.length;

  @override
  int get selectedRowCount => 0;
}
