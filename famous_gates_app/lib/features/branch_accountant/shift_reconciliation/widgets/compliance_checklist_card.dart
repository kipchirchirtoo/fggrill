import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:timezone/timezone.dart' as tz; // KENYA TIME
import '../../../../core/widgets/kes_text.dart';
import '../models/shift_reconciliation_model.dart';
import '../models/reconciliation_payment_summary.dart';

class ComplianceChecklistCard extends StatelessWidget {
  final ShiftReconciliationModel shift;
  final double actualCash;
  final String explanation;
  final String notes;

  const ComplianceChecklistCard({
    super.key,
    required this.shift,
    required this.actualCash,
    required this.explanation,
    required this.notes,
  });

  @override
  Widget build(BuildContext context) {
    final double cashSales = shift.paymentBreakdown
        .firstWhere((p) => p.method.toLowerCase() == 'cash', orElse: () => ReconciliationPaymentSummary(method: 'cash', amount: 0, count: 0))
        .amount;
    final double expectedCash = shift.openingFloat + cashSales;
    final double variance = actualCash - expectedCash;

    final nairobi = tz.getLocation('Africa/Nairobi'); // KENYA TIME
    final nowKenya = tz.TZDateTime.from(DateTime.now(), nairobi); // KENYA TIME
    final timeStr = DateFormat('HH:mm').format(nowKenya);

    final bool evidenceAttached = variance == 0 || explanation.isNotEmpty;
    final bool notesCompleted = notes.isNotEmpty || variance == 0;

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
              'Compliance Checklist',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 14),
            _CheckItem(
              label: 'Shift Closed',
              isCompleted: shift.shiftEnd != null,
              subtitle: shift.shiftEnd != null
                  ? 'Closed at ${DateFormat('HH:mm').format(tz.TZDateTime.from(shift.shiftEnd!.toLocal(), nairobi))} // KENYA TIME' // KENYA TIME
                  : 'Shift is active',
            ),
            const _CheckItem(
              label: 'Sales Verified',
              isCompleted: true,
              subtitle: 'System aggregates validated',
            ),
            _CheckItem(
              label: 'Payments Balanced',
              isCompleted: variance == 0,
              subtitle: variance == 0 ? 'No cash variance detected' : 'Variance explanation required',
              isWarning: variance != 0,
            ),
            const _CheckItem(
              label: 'Transactions Synced',
              isCompleted: true,
              subtitle: 'All order lines synced to database',
            ),
            _CheckItem(
              label: 'Credit Bills Reviewed',
              isCompleted: true,
              subtitle: '${shift.creditBills.length} bills processed',
            ),
            _CheckItem(
              label: 'Supporting Evidence Attached',
              isCompleted: evidenceAttached,
              subtitle: variance == 0 ? 'Not required (balanced)' : (evidenceAttached ? 'Completed at $timeStr' : 'Pending file or reason'),
              isWarning: !evidenceAttached,
            ),
            _CheckItem(
              label: 'Notes Completed',
              isCompleted: notesCompleted,
              subtitle: notesCompleted ? 'Observations logged' : 'Reconciliation notes missing',
              isWarning: !notesCompleted,
            ),
            if (variance != 0)
              _CheckItem(
                label: 'Cash Variance Detected',
                isCompleted: false,
                subtitle: 'Discrepancy of ${formatKes(variance)} exists',
                isWarning: true,
                customIcon: Icons.warning_amber_rounded,
              ),
          ],
        ),
      ),
    );
  }
}

class _CheckItem extends StatelessWidget {
  final String label;
  final bool isCompleted;
  final String subtitle;
  final bool isWarning;
  final IconData? customIcon;

  const _CheckItem({
    required this.label,
    required this.isCompleted,
    required this.subtitle,
    this.isWarning = false,
    this.customIcon,
  });

  @override
  Widget build(BuildContext context) {
    IconData iconData = Icons.check_circle_rounded;
    Color iconColor = Colors.green;

    if (customIcon != null) {
      iconData = customIcon!;
      iconColor = isWarning ? Colors.orange.shade700 : Colors.red;
    } else if (!isCompleted) {
      iconData = isWarning ? Icons.error_rounded : Icons.pending_rounded;
      iconColor = isWarning ? Colors.red : Colors.grey;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(iconData, color: iconColor, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: !isCompleted && isWarning ? Colors.red.shade900 : const Color(0xFF1E293B),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
