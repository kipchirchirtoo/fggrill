import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:timezone/timezone.dart' as tz; // KENYA TIME
import '../../../../core/widgets/kes_text.dart';
import '../models/shift_reconciliation_model.dart';
import '../models/reconciliation_payment_summary.dart';

class ShiftSummaryCard extends StatelessWidget {
  final ShiftReconciliationModel shift;
  final double actualCash;

  const ShiftSummaryCard({
    super.key,
    required this.shift,
    required this.actualCash,
  });

  @override
  Widget build(BuildContext context) {
    final nairobi = tz.getLocation('Africa/Nairobi'); // KENYA TIME
    final startKenya = tz.TZDateTime.from(shift.shiftStart.toLocal(), nairobi); // KENYA TIME
    final endKenya = shift.shiftEnd != null
        ? tz.TZDateTime.from(shift.shiftEnd!.toLocal(), nairobi) // KENYA TIME
        : null;

    final df = DateFormat('yyyy-MM-dd HH:mm:ss');
    final startStr = df.format(startKenya);
    final endStr = endKenya != null ? df.format(endKenya) : 'Active / Unclosed';

    String durationStr = 'N/A';
    if (shift.shiftEnd != null) {
      final diff = shift.shiftEnd!.difference(shift.shiftStart);
      final hours = diff.inHours;
      final mins = diff.inMinutes % 60;
      durationStr = '${hours}h ${mins}m';
    }

    final double cashSales = shift.paymentBreakdown
        .firstWhere((p) => p.method.toLowerCase() == 'cash', orElse: () => ReconciliationPaymentSummary(method: 'cash', amount: 0, count: 0))
        .amount;
    final double expectedCash = shift.openingFloat + cashSales;
    final double variance = actualCash - expectedCash;

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
            const Text(
              'Shift Summary Details',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 14),
            _SummaryRow(label: 'Cashier', value: shift.cashierName),
            _SummaryRow(label: 'Branch', value: shift.branchName ?? 'Main Branch'),
            _SummaryRow(label: 'Register #', value: shift.registerNumber ?? '1'),
            _SummaryRow(label: 'Opened At', value: startStr),
            _SummaryRow(label: 'Closed At', value: endStr),
            _SummaryRow(label: 'Shift Duration', value: durationStr),
            const Divider(height: 20),
            _SummaryRow(label: 'Opening Float', value: formatKes(shift.openingFloat)),
            _SummaryRow(label: 'Expected Cash', value: formatKes(expectedCash)),
            _SummaryRow(label: 'Actual Cash', value: formatKes(actualCash)),
            _SummaryRow(
              label: 'Variance',
              value: variance > 0 ? '+${formatKes(variance)}' : formatKes(variance),
              valueColor: variance == 0
                  ? Colors.green
                  : (variance.abs() <= 500 ? Colors.orange : Colors.red),
            ),
            const Divider(height: 20),
            _SummaryRow(
              label: 'Shift Status',
              widget: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: _statusBg(shift.status),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  shift.status.toUpperCase(),
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: _statusColor(shift.status)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _statusBg(String status) {
    switch (status.toLowerCase()) {
      case 'reconciled':
        return const Color(0xFFE0F2FE);
      case 'verified':
        return const Color(0xFFDCFCE7);
      case 'closed':
        return const Color(0xFFF3F4F6);
      default:
        return const Color(0xFFFEF3C7);
    }
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'reconciled':
        return const Color(0xFF0369A1);
      case 'verified':
        return const Color(0xFF15803D);
      case 'closed':
        return const Color(0xFF4B5563);
      default:
        return const Color(0xFFB45309);
    }
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String? value;
  final Widget? widget;
  final Color? valueColor;

  const _SummaryRow({
    required this.label,
    this.value,
    this.widget,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
          ),
          if (widget != null)
            widget!
          else
            Text(
              value ?? 'N/A',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: valueColor ?? const Color(0xFF1E293B),
              ),
            ),
        ],
      ),
    );
  }
}
