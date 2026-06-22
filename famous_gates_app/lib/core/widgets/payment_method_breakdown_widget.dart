import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'kes_text.dart';

/// Reusable 4-tile Mpesa/Cash/Card/Credit revenue breakdown.
///
/// Used on the Revenue Oversight screen, the Branch Sales & Payments
/// "By Payment Method" section, and the Branch Sales Analytics screen.
class PaymentMethodBreakdownWidget extends StatelessWidget {
  const PaymentMethodBreakdownWidget({
    super.key,
    required this.mpesa,
    required this.cash,
    required this.card,
    required this.credit,
    this.title,
  });

  final num mpesa;
  final num cash;
  final num card;
  final num credit;
  final String? title;

  @override
  Widget build(BuildContext context) {
    final total = mpesa + cash + card + credit;
    final tiles = [
      _MethodTile(
        label: 'Mpesa',
        icon: Icons.phone_iphone,
        color: Colors.green,
        amount: mpesa,
        percentage: total > 0 ? (mpesa / total) * 100 : 0,
      ),
      _MethodTile(
        label: 'Cash',
        icon: Icons.payments,
        color: Colors.blue,
        amount: cash,
        percentage: total > 0 ? (cash / total) * 100 : 0,
      ),
      _MethodTile(
        label: 'Card',
        icon: Icons.credit_card,
        color: Colors.purple,
        amount: card,
        percentage: total > 0 ? (card / total) * 100 : 0,
      ),
      _MethodTile(
        label: 'Credit',
        icon: Icons.receipt_long,
        color: Colors.orange,
        amount: credit,
        percentage: total > 0 ? (credit / total) * 100 : 0,
      ),
    ];

    final grid = LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 760
            ? 4
            : constraints.maxWidth >= 420
                ? 2
                : 1;
        return GridView.count(
          crossAxisCount: columns,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 2.2,
          children: tiles,
        );
      },
    );

    if (title == null) return grid;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title!,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        const SizedBox(height: 12),
        grid,
      ],
    );
  }
}

class _MethodTile extends StatelessWidget {
  const _MethodTile({
    required this.label,
    required this.icon,
    required this.color,
    required this.amount,
    required this.percentage,
  });

  final String label;
  final IconData icon;
  final Color color;
  final num amount;
  final double percentage;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.kDivider),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    color: AppColors.kTextSecondary,
                    fontSize: 12,
                  ),
                ),
                KesText(
                  amount,
                  style: TextStyle(fontWeight: FontWeight.bold, color: color),
                ),
                Text(
                  '${percentage.toStringAsFixed(1)}%',
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.kTextSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
