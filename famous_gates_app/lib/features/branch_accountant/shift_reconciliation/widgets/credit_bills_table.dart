import 'package:flutter/material.dart';
import '../../../../core/widgets/kes_text.dart';
import '../models/shift_reconciliation_model.dart';
import '../models/reconciliation_credit_bill.dart';

class CreditBillsTable extends StatefulWidget {
  final ShiftReconciliationModel shift;
  final ValueChanged<ReconciliationCreditBill> onViewDetails;

  const CreditBillsTable({
    super.key,
    required this.shift,
    required this.onViewDetails,
  });

  @override
  State<CreditBillsTable> createState() => _CreditBillsTableState();
}

class _CreditBillsTableState extends State<CreditBillsTable> {
  String _searchQuery = '';
  int _rowsPerPage = PaginatedDataTable.defaultRowsPerPage;

  @override
  Widget build(BuildContext context) {
    final filteredBills = widget.shift.creditBills.where((b) {
      final query = _searchQuery.toLowerCase();
      return b.staffName.toLowerCase().contains(query) ||
          (b.creditNumber ?? '').toLowerCase().contains(query) ||
          (b.department ?? '').toLowerCase().contains(query);
    }).toList();

    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Credit Bills Issued',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                ),
                SizedBox(
                  width: 250,
                  height: 40,
                  child: TextField(
                    decoration: InputDecoration(
                      hintText: 'Search employee, department...',
                      prefixIcon: const Icon(Icons.search, size: 18),
                      contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 8),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(color: Colors.grey.shade300),
                      ),
                    ),
                    onChanged: (val) {
                      setState(() {
                        _searchQuery = val;
                      });
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (filteredBills.isEmpty)
              const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 32),
                  child: Text(
                    'No credit bills found for this shift.',
                    style: TextStyle(color: Colors.grey),
                  ),
                ),
              )
            else
              PaginatedDataTable(
                header: null,
                rowsPerPage: _rowsPerPage,
                onRowsPerPageChanged: (rows) {
                  setState(() {
                    _rowsPerPage = rows ?? PaginatedDataTable.defaultRowsPerPage;
                  });
                },
                showFirstLastButtons: true,
                columns: const [
                  DataColumn(label: Text('Employee Name', style: TextStyle(fontWeight: FontWeight.bold))),
                  DataColumn(label: Text('Department', style: TextStyle(fontWeight: FontWeight.bold))),
                  DataColumn(label: Text('Bill Ref', style: TextStyle(fontWeight: FontWeight.bold))),
                  DataColumn(label: Text('Outstanding Amount', style: TextStyle(fontWeight: FontWeight.bold))),
                  DataColumn(label: Text('Status', style: TextStyle(fontWeight: FontWeight.bold))),
                  DataColumn(label: Text('Actions', style: TextStyle(fontWeight: FontWeight.bold))),
                ],
                source: _CreditBillsDataSource(
                  bills: filteredBills,
                  onView: widget.onViewDetails,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _CreditBillsDataSource extends DataTableSource {
  final List<ReconciliationCreditBill> bills;
  final ValueChanged<ReconciliationCreditBill> onView;

  _CreditBillsDataSource({required this.bills, required this.onView});

  @override
  DataRow? getRow(int index) {
    if (index >= bills.length) return null;
    final bill = bills[index];

    Color statusColor;
    Color statusBgColor;
    if (bill.status.toLowerCase() == 'paid' || bill.status.toLowerCase() == 'cleared') {
      statusColor = const Color(0xFF15803D);
      statusBgColor = const Color(0xFFDCFCE7);
    } else {
      statusColor = const Color(0xFFB45309);
      statusBgColor = const Color(0xFFFEF3C7);
    }

    return DataRow.byIndex(
      index: index,
      cells: [
        DataCell(Text(bill.staffName)),
        DataCell(Text(bill.department ?? 'N/A')),
        DataCell(Text(bill.creditNumber ?? 'N/A')),
        DataCell(Text(formatKes(bill.amount))),
        DataCell(
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: statusBgColor,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              bill.status.toUpperCase(),
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: statusColor),
            ),
          ),
        ),
        DataCell(
          TextButton(
            onPressed: () => onView(bill),
            child: const Text('View Details'),
          ),
        ),
      ],
    );
  }

  @override
  bool get isRowCountApproximate => false;

  @override
  int get rowCount => bills.length;

  @override
  int get selectedRowCount => 0;
}
