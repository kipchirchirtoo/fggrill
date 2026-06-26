import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:timezone/timezone.dart' as tz; // KENYA TIME
import '../../../../core/widgets/kes_text.dart';
import '../models/shift_reconciliation_model.dart';
import '../models/reconciliation_credit_bill.dart';
import 'credit_bill_detail_screen.dart';

class CreditBillsDetailScreen extends StatefulWidget {
  final ShiftReconciliationModel shift;

  const CreditBillsDetailScreen({
    super.key,
    required this.shift,
  });

  @override
  State<CreditBillsDetailScreen> createState() => _CreditBillsDetailScreenState();
}

class _CreditBillsDetailScreenState extends State<CreditBillsDetailScreen> {
  String _searchQuery = '';
  int _rowsPerPage = PaginatedDataTable.defaultRowsPerPage;

  @override
  Widget build(BuildContext context) {
    final filtered = widget.shift.creditBills.where((b) {
      final q = _searchQuery.toLowerCase();
      return b.staffName.toLowerCase().contains(q) ||
          (b.creditNumber ?? '').toLowerCase().contains(q) ||
          (b.department ?? '').toLowerCase().contains(q);
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Shift Credit Bills'),
            Text(
              'Shift: ${widget.shift.shiftNumber}',
              style: const TextStyle(fontSize: 12, color: Colors.white70),
            ),
          ],
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
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
                      child: TextField(
                        decoration: InputDecoration(
                          hintText: 'Search employee, reference, department...',
                          prefixIcon: const Icon(Icons.search, size: 18),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                          contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 8),
                        ),
                        onChanged: (val) => setState(() => _searchQuery = val),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
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
                        child: Text('No credit bills found for this shift.', style: TextStyle(color: Colors.grey)),
                      ),
                    )
                  : PaginatedDataTable(
                      header: null,
                      rowsPerPage: _rowsPerPage,
                      onRowsPerPageChanged: (rows) {
                        setState(() => _rowsPerPage = rows ?? PaginatedDataTable.defaultRowsPerPage);
                      },
                      columns: const [
                        DataColumn(label: Text('Date (Kenya)', style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(label: Text('Employee Name', style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(label: Text('Department', style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(label: Text('Bill Number', style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(label: Text('Amount', style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(label: Text('Status', style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(label: Text('Actions', style: TextStyle(fontWeight: FontWeight.bold))),
                      ],
                      source: _CreditBillsDataSource(
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

class _CreditBillsDataSource extends DataTableSource {
  final BuildContext context;
  final List<ReconciliationCreditBill> items;
  final ShiftReconciliationModel shift;

  _CreditBillsDataSource({
    required this.context,
    required this.items,
    required this.shift,
  });

  @override
  DataRow? getRow(int index) {
    if (index >= items.length) return null;
    final bill = items[index];

    final nairobi = tz.getLocation('Africa/Nairobi'); // KENYA TIME
    final timeKenya = tz.TZDateTime.from(bill.createdAt.toLocal(), nairobi); // KENYA TIME
    final timeStr = DateFormat('yyyy-MM-dd HH:mm').format(timeKenya);

    Color statusColor;
    Color statusBg;
    if (bill.status.toLowerCase() == 'paid' || bill.status.toLowerCase() == 'cleared') {
      statusColor = const Color(0xFF15803D);
      statusBg = const Color(0xFFDCFCE7);
    } else {
      statusColor = const Color(0xFFB45309);
      statusBg = const Color(0xFFFEF3C7);
    }

    return DataRow.byIndex(
      index: index,
      cells: [
        DataCell(Text(timeStr)),
        DataCell(Text(bill.staffName)),
        DataCell(Text(bill.department ?? 'N/A')),
        DataCell(Text(bill.creditNumber ?? 'N/A')),
        DataCell(Text(formatKes(bill.amount))),
        DataCell(
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: statusBg,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              bill.status.toUpperCase(),
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: statusColor),
            ),
          ),
        ),
        DataCell(
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => CreditBillDetailScreen(
                        bill: bill,
                        shift: shift,
                      ),
                    ),
                  );
                },
                child: const Text('Details'),
              ),
            ],
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
