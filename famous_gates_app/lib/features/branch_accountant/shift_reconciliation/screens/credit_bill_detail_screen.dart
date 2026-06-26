import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:timezone/timezone.dart' as tz; // KENYA TIME
import '../../../../core/widgets/kes_text.dart';
import '../models/shift_reconciliation_model.dart';
import '../models/reconciliation_credit_bill.dart';

class CreditBillDetailScreen extends StatelessWidget {
  final ReconciliationCreditBill bill;
  final ShiftReconciliationModel shift;

  const CreditBillDetailScreen({
    super.key,
    required this.bill,
    required this.shift,
  });

  @override
  Widget build(BuildContext context) {
    final nairobi = tz.getLocation('Africa/Nairobi'); // KENYA TIME
    final createdKenya = tz.TZDateTime.from(bill.createdAt.toLocal(), nairobi); // KENYA TIME
    final timeStr = DateFormat('yyyy-MM-dd HH:mm').format(createdKenya);

    Color statusColor;
    Color statusBg;
    if (bill.status.toLowerCase() == 'paid' || bill.status.toLowerCase() == 'cleared') {
      statusColor = const Color(0xFF15803D);
      statusBg = const Color(0xFFDCFCE7);
    } else {
      statusColor = const Color(0xFFB45309);
      statusBg = const Color(0xFFFEF3C7);
    }

    // Try to find the matching transaction line to display items
    Map<String, dynamic>? matchingTx;
    for (final line in shift.lines) {
      if (line['credit_bill_id'] == bill.id ||
          line['reference'] == bill.creditNumber ||
          (line['reference'] != null && bill.creditNumber != null && line['reference'].toString().contains(bill.creditNumber!))) {
        matchingTx = line;
        break;
      }
    }

    final List<dynamic> items = matchingTx?['items'] ?? [];

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Credit Bill Details'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: Container(
            constraints: const BoxConstraints(maxWidth: 800),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header card
                Card(
                  elevation: 0,
                  color: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(color: Colors.grey.shade200),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              bill.creditNumber ?? 'Credit Bill',
                              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: statusBg,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                bill.status.toUpperCase(),
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: statusColor),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 18),
                        _DetailRow(label: 'Employee Name', value: bill.staffName),
                        _DetailRow(label: 'Employee ID', value: bill.employeeId ?? 'N/A'),
                        _DetailRow(label: 'Department', value: bill.department ?? 'N/A'),
                        _DetailRow(label: 'Date Issued', value: '$timeStr // KENYA TIME'), // KENYA TIME
                        _DetailRow(label: 'Original Amount', value: formatKes(bill.amount)),
                        _DetailRow(label: 'Remaining Balance', value: formatKes(bill.balance), isBold: true),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                // Items Breakdown card
                Card(
                  elevation: 0,
                  color: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(color: Colors.grey.shade200),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Items Breakdown',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                        ),
                        const SizedBox(height: 16),
                        if (items.isEmpty)
                          const Center(
                            child: Padding(
                              padding: EdgeInsets.symmetric(vertical: 24),
                              child: Text(
                                'No detailed item breakdown available for this manually generated credit bill.',
                                style: TextStyle(color: Colors.grey, fontSize: 13),
                              ),
                            ),
                          )
                        else
                          Table(
                            columnWidths: const {
                              0: FlexColumnWidth(4),
                              1: FlexColumnWidth(1),
                              2: FlexColumnWidth(2),
                              3: FlexColumnWidth(2),
                            },
                            children: [
                              TableRow(
                                decoration: BoxDecoration(border: Border(bottom: BorderSide(color: Colors.grey.shade200))),
                                children: const [
                                  Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('Product', style: TextStyle(fontWeight: FontWeight.bold))),
                                  Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('Qty', style: TextStyle(fontWeight: FontWeight.bold), textAlign: TextAlign.center)),
                                  Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('Price', style: TextStyle(fontWeight: FontWeight.bold), textAlign: TextAlign.right)),
                                  Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('Total', style: TextStyle(fontWeight: FontWeight.bold), textAlign: TextAlign.right)),
                                ],
                              ),
                              ...items.map((i) {
                                final name = i['name'] ?? i['item_name'] ?? 'Item';
                                final qty = i['quantity'] ?? i['qty'] ?? 1;
                                final price = (i['price'] ?? i['selling_price'] ?? 0).toDouble();
                                final total = qty * price;
                                return TableRow(
                                  decoration: BoxDecoration(border: Border(bottom: BorderSide(color: Colors.grey.shade100))),
                                  children: [
                                    Padding(padding: const EdgeInsets.symmetric(vertical: 10), child: Text(name.toString())),
                                    Padding(padding: const EdgeInsets.symmetric(vertical: 10), child: Text(qty.toString(), textAlign: TextAlign.center)),
                                    Padding(padding: const EdgeInsets.symmetric(vertical: 10), child: Text(formatKes(price), textAlign: TextAlign.right)),
                                    Padding(padding: const EdgeInsets.symmetric(vertical: 10), child: Text(formatKes(total), textAlign: TextAlign.right)),
                                  ],
                                );
                              }),
                            ],
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isBold;

  const _DetailRow({
    required this.label,
    required this.value,
    this.isBold = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 14, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
              color: isBold ? const Color(0xFF1E293B) : const Color(0xFF334155),
            ),
          ),
        ],
      ),
    );
  }
}
