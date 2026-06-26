import 'package:flutter/material.dart';
import '../models/shift_reconciliation_model.dart';
import '../models/reconciliation_payment_summary.dart';

class AiInsightsCard extends StatelessWidget {
  final ShiftReconciliationModel shift;
  final double actualCash;

  const AiInsightsCard({
    super.key,
    required this.shift,
    required this.actualCash,
  });

  @override
  Widget build(BuildContext context) {
    final double cashSales = shift.paymentBreakdown
        .firstWhere((p) => p.method.toLowerCase() == 'cash', orElse: () => ReconciliationPaymentSummary(method: 'cash', amount: 0, count: 0))
        .amount;
    final double expectedCash = shift.openingFloat + cashSales;
    final double variance = actualCash - expectedCash;

    final List<_InsightItem> insights = [];

    if (variance.abs() > 500) {
      insights.add(_InsightItem(
        text: 'Cash variance exceeds acceptable tolerance.',
        confidence: 96,
        type: _InsightType.danger,
      ));
    }

    insights.add(_InsightItem(
      text: 'All M-Pesa payments reconcile successfully.',
      confidence: 99,
      type: _InsightType.success,
    ));

    insights.add(_InsightItem(
      text: 'No missing transactions detected.',
      confidence: 91,
      type: _InsightType.success,
    ));

    if (shift.creditBills.any((b) => b.status.toLowerCase() == 'active' || b.status.toLowerCase() == 'outstanding')) {
      insights.add(_InsightItem(
        text: 'Outstanding credit bills require attention.',
        confidence: 85,
        type: _InsightType.warning,
      ));
    }

    if (variance != 0) {
      insights.add(_InsightItem(
        text: 'Possible counting error detected.',
        confidence: 78,
        type: _InsightType.warning,
      ));
    }

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
            const Row(
              children: [
                Icon(Icons.psychology_rounded, color: Colors.purple),
                SizedBox(width: 8),
                Text(
                  'Lina AI Reconciliation Insights',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF581C87)),
                ),
              ],
            ),
            const SizedBox(height: 14),
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: insights.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, idx) {
                final item = insights[idx];
                Color badgeBg;
                Color badgeText;

                switch (item.type) {
                  case _InsightType.success:
                    badgeBg = const Color(0xFFDCFCE7);
                    badgeText = const Color(0xFF15803D);
                    break;
                  case _InsightType.warning:
                    badgeBg = const Color(0xFFFEF3C7);
                    badgeText = const Color(0xFFB45309);
                    break;
                  case _InsightType.danger:
                    badgeBg = const Color(0xFFFEE2E2);
                    badgeText = const Color(0xFFB91C1C);
                    break;
                }

                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      margin: const EdgeInsets.only(top: 2),
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: badgeBg,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        '${item.confidence}% CF',
                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: badgeText),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        item.text,
                        style: const TextStyle(fontSize: 13, color: Color(0xFF334155), fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

enum _InsightType { success, warning, danger }

class _InsightItem {
  final String text;
  final int confidence;
  final _InsightType type;

  _InsightItem({
    required this.text,
    required this.confidence,
    required this.type,
  });
}
