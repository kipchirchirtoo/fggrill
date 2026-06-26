import 'package:flutter/material.dart';
import '../../../../core/widgets/kes_text.dart';
import '../models/shift_reconciliation_model.dart';
import '../models/reconciliation_payment_summary.dart';

class PaymentBreakdownCard extends StatelessWidget {
  final ShiftReconciliationModel shift;
  final VoidCallback onCashTap;
  final VoidCallback onMpesaTap;
  final VoidCallback onCreditTap;
  final VoidCallback onOtherTap;

  const PaymentBreakdownCard({
    super.key,
    required this.shift,
    required this.onCashTap,
    required this.onMpesaTap,
    required this.onCreditTap,
    required this.onOtherTap,
  });

  @override
  Widget build(BuildContext context) {
    final cash = shift.paymentBreakdown.firstWhere(
      (p) => p.method.toLowerCase() == 'cash',
      orElse: () => ReconciliationPaymentSummary(method: 'cash', amount: 0, count: 0),
    );
    final mpesa = shift.paymentBreakdown.firstWhere(
      (p) => p.method.toLowerCase() == 'mpesa',
      orElse: () => ReconciliationPaymentSummary(method: 'mpesa', amount: 0, count: 0),
    );
    // Sum card and other payment methods
    double otherAmount = 0;
    int otherCount = 0;
    for (final p in shift.paymentBreakdown) {
      final methodLower = p.method.toLowerCase();
      if (methodLower != 'cash' && methodLower != 'mpesa' && methodLower != 'credit_bill' && methodLower != 'credit') {
        otherAmount += p.amount;
        otherCount += p.count;
      }
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
            const Text(
              'Payment Method Breakdown',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 16),
            LayoutBuilder(
              builder: (context, constraints) {
                final double width = (constraints.maxWidth - 16) / 2;
                return Wrap(
                  spacing: 16,
                  runSpacing: 16,
                  children: [
                    _MethodTile(
                      width: width,
                      title: 'Cash Payments',
                      amount: cash.amount,
                      countLabel: '${cash.count} transactions',
                      icon: Icons.money_rounded,
                      color: Colors.teal,
                      onTap: onCashTap,
                    ),
                    _MethodTile(
                      width: width,
                      title: 'M-Pesa Collections',
                      amount: mpesa.amount,
                      countLabel: '${mpesa.count} transactions',
                      icon: Icons.phone_android_rounded,
                      color: Colors.lightGreen.shade700,
                      onTap: onMpesaTap,
                    ),
                    _MethodTile(
                      width: width,
                      title: 'Credit Bills Issued',
                      amount: shift.creditBills.fold(0, (sum, b) => sum + b.amount),
                      countLabel: '${shift.creditBills.length} outstanding bills',
                      icon: Icons.assignment_ind_rounded,
                      color: Colors.orange.shade700,
                      onTap: onCreditTap,
                    ),
                    _MethodTile(
                      width: width,
                      title: 'Card / Other Methods',
                      amount: otherAmount,
                      countLabel: '$otherCount transactions',
                      icon: Icons.credit_card_rounded,
                      color: Colors.blueAccent,
                      onTap: onOtherTap,
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

class _MethodTile extends StatelessWidget {
  final double width;
  final String title;
  final double amount;
  final String countLabel;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _MethodTile({
    required this.width,
    required this.title,
    required this.amount,
    required this.countLabel,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        width: width,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.grey.shade200),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.01),
              blurRadius: 4,
              offset: const Offset(0, 2),
            )
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    formatKes(amount),
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    countLabel,
                    style: const TextStyle(fontSize: 10, color: Colors.grey),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: Colors.grey),
          ],
        ),
      ),
    );
  }
}
