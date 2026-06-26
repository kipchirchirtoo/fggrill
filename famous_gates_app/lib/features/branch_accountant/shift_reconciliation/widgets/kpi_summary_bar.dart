import 'package:flutter/material.dart';
import '../../../../core/widgets/kes_text.dart';
import '../models/shift_reconciliation_model.dart';
import '../models/reconciliation_payment_summary.dart';

class KpiSummaryBar extends StatelessWidget {
  final ShiftReconciliationModel shift;
  final double actualCash;

  const KpiSummaryBar({
    super.key,
    required this.shift,
    required this.actualCash,
  });

  @override
  Widget build(BuildContext context) {
    final double totalSales = shift.paymentBreakdown.fold(0, (sum, p) => sum + p.amount);
    final double cashSales = shift.paymentBreakdown
        .firstWhere((p) => p.method.toLowerCase() == 'cash', orElse: () => ReconciliationPaymentSummary(method: 'cash', amount: 0, count: 0))
        .amount;
    final int cashCount = shift.paymentBreakdown
        .firstWhere((p) => p.method.toLowerCase() == 'cash', orElse: () => ReconciliationPaymentSummary(method: 'cash', amount: 0, count: 0))
        .count;

    final double mpesaSales = shift.paymentBreakdown
        .firstWhere((p) => p.method.toLowerCase() == 'mpesa', orElse: () => ReconciliationPaymentSummary(method: 'mpesa', amount: 0, count: 0))
        .amount;
    final int mpesaCount = shift.paymentBreakdown
        .firstWhere((p) => p.method.toLowerCase() == 'mpesa', orElse: () => ReconciliationPaymentSummary(method: 'mpesa', amount: 0, count: 0))
        .count;

    final double creditBills = shift.creditBills.fold(0, (sum, b) => sum + b.amount);
    final int creditCount = shift.creditBills.length;

    // Expected cash: float + cash sales
    final double expectedCash = shift.openingFloat + cashSales;
    final double cashVariance = actualCash - expectedCash;

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final crossCount = constraints.maxWidth < 900 ? 3 : 6;
          return GridView.count(
            shrinkWrap: true,
            crossAxisCount: crossCount,
            physics: const NeverScrollableScrollPhysics(),
            childAspectRatio: 2.8,
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: [
              _KpiCard(
                title: 'Total Sales',
                value: totalSales,
                subLabel: 'Across all methods',
              ),
              _KpiCard(
                title: 'Cash Sales',
                value: cashSales,
                subLabel: '$cashCount transactions',
              ),
              _KpiCard(
                title: 'M-Pesa',
                value: mpesaSales,
                subLabel: '$mpesaCount transactions',
              ),
              _KpiCard(
                title: 'Credit Bills',
                value: creditBills,
                subLabel: '$creditCount bills',
              ),
              _KpiCard(
                title: 'Expected Cash',
                value: expectedCash,
                subLabel: 'Float + cash sales',
              ),
              _VarianceKpiCard(
                title: 'Cash Variance',
                value: cashVariance,
              ),
            ],
          );
        },
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  final String title;
  final double value;
  final String subLabel;

  const _KpiCard({
    required this.title,
    required this.value,
    required this.subLabel,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          Text(
            formatKes(value),
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
          ),
          const SizedBox(height: 2),
          Text(
            subLabel,
            style: const TextStyle(fontSize: 10, color: Colors.grey),
          ),
        ],
      ),
    );
  }
}

class _VarianceKpiCard extends StatelessWidget {
  final String title;
  final double value;

  const _VarianceKpiCard({
    required this.title,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    Color cardColor;
    Color textColor;
    String statusText;

    if (value == 0) {
      cardColor = const Color(0xFFDCFCE7);
      textColor = const Color(0xFF15803D);
      statusText = 'Balanced';
    } else if (value.abs() <= 500) {
      cardColor = const Color(0xFFFEF3C7);
      textColor = const Color(0xFFB45309);
      statusText = 'Minor Variance';
    } else {
      cardColor = const Color(0xFFFEE2E2);
      textColor = const Color(0xFFB91C1C);
      statusText = 'Major Variance';
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: textColor.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            title,
            style: TextStyle(fontSize: 12, color: textColor.withOpacity(0.8), fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          Text(
            value > 0 ? '+${formatKes(value)}' : formatKes(value),
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: textColor),
          ),
          const SizedBox(height: 2),
          Text(
            statusText,
            style: TextStyle(fontSize: 10, color: textColor, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }
}
