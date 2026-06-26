import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/stock_vs_sales_summary.dart';

final _money = NumberFormat('#,##0.00', 'en_KE');
String _fmtMoney(num v) => 'KES ${_money.format(v)}';

class StockVsSalesTab extends StatelessWidget {
  const StockVsSalesTab({super.key, required this.summary});

  final StockVsSalesSummary summary;

  @override
  Widget build(BuildContext context) {
    final pct = summary.foodCostPercent;
    final color = pct == null
        ? Colors.grey.shade600
        : (summary.exceedsTarget ? Colors.red.shade700 : Colors.green.shade700);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            elevation: 1,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Text('Food Cost %',
                      style: TextStyle(fontSize: 13, color: Colors.grey.shade600, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Text(
                    pct == null ? 'N/A' : '${pct.toStringAsFixed(1)}%',
                    style: TextStyle(fontSize: 40, fontWeight: FontWeight.w900, color: color),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    pct == null
                        ? 'No food revenue recorded for this date'
                        : (summary.exceedsTarget
                            ? 'Exceeds target of ${summary.targetPercent.toStringAsFixed(0)}%'
                            : 'Within target of ${summary.targetPercent.toStringAsFixed(0)}%'),
                    style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _MetricCard(
                  title: 'Stock Issued Cost (to kitchen)',
                  value: _fmtMoney(summary.stockIssuedCost),
                  icon: Icons.outbox_outlined,
                  color: Colors.indigo.shade700,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _MetricCard(
                  title: 'Food Revenue (POS)',
                  value: _fmtMoney(summary.foodRevenue),
                  icon: Icons.point_of_sale_outlined,
                  color: Colors.teal.shade700,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String title;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: color.withValues(alpha: 0.1), shape: BoxShape.circle),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade600, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
