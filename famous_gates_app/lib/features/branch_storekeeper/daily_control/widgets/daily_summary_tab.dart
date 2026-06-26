import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/daily_control_state.dart';
import '../models/kitchen_vs_sales_item.dart';
import 'control_variance_badge.dart';
import 'kitchen_vs_sales_tab.dart';

final _money = NumberFormat('#,##0.00', 'en_KE');
final _qty = NumberFormat('#,##0.##', 'en_KE');
String _fmtMoney(num v) => 'KES ${_money.format(v)}';
String _fmtQty(num v) => _qty.format(v);

class DailySummaryTab extends StatelessWidget {
  const DailySummaryTab({
    super.key,
    required this.summary,
    required this.kitchenVsSales,
  });

  final DailyControlSummary summary;
  final List<KitchenVsSalesItem> kitchenVsSales;

  String get _bomVarianceFlag {
    final pct = summary.bomVariancePercent;
    if (pct == null) return summary.bomVarianceCost > 0 ? 'red' : 'green';
    final abs = pct.abs();
    if (abs <= 5) return 'green';
    if (abs <= 15) return 'orange';
    return 'red';
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          LayoutBuilder(builder: (context, constraints) {
            final crossAxisCount = constraints.maxWidth > 900
                ? 4
                : (constraints.maxWidth > 600 ? 2 : 1);
            return GridView.count(
              crossAxisCount: crossAxisCount,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              childAspectRatio: 2.4,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              children: [
                SummaryTile(
                  title: 'Total POS Food Sales (Qty)',
                  value: _fmtQty(summary.totalFoodQtySold),
                  icon: Icons.shopping_basket_outlined,
                  color: Colors.blue.shade700,
                ),
                SummaryTile(
                  title: 'Total POS Food Revenue',
                  value: _fmtMoney(summary.totalFoodRevenue),
                  icon: Icons.payments_outlined,
                  color: Colors.teal.shade700,
                ),
                SummaryTile(
                  title: 'Theoretical Ingredient Cost',
                  value: _fmtMoney(summary.theoreticalIngredientCost),
                  icon: Icons.menu_book_outlined,
                  color: Colors.indigo.shade700,
                ),
                SummaryTile(
                  title: 'Actual Ingredient Cost Issued',
                  value: _fmtMoney(summary.actualIngredientCost),
                  icon: Icons.outbox_outlined,
                  color: Colors.purple.shade700,
                ),
              ],
            );
          }),
          const SizedBox(height: 16),
          Card(
            elevation: 1,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('BOM Variance (Cost)',
                            style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 6),
                        Text(
                          '${summary.bomVarianceCost >= 0 ? '+' : ''}${_fmtMoney(summary.bomVarianceCost)}',
                          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
                        ),
                      ],
                    ),
                  ),
                  ControlVarianceBadge(
                    flag: _bomVarianceFlag,
                    label: summary.bomVariancePercent == null
                        ? '—'
                        : '${summary.bomVariancePercent! >= 0 ? '+' : ''}${summary.bomVariancePercent}%',
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Food Cost %',
                            style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 6),
                        Text(
                          summary.foodCostPercent == null
                              ? 'N/A'
                              : '${summary.foodCostPercent!.toStringAsFixed(1)}% (target ${summary.targetFoodCostPercent.toStringAsFixed(0)}%)',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text('Top 5 Variance Items',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.grey.shade800)),
          const SizedBox(height: 8),
          if (summary.topVarianceItems.isEmpty)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text('No variance to rank yet.', style: TextStyle(color: Colors.grey.shade600)),
            )
          else
            Card(
              elevation: 1,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              child: Column(
                children: summary.topVarianceItems.asMap().entries.map((entry) {
                  final rank = entry.key + 1;
                  final item = entry.value;
                  return ListTile(
                    leading: CircleAvatar(
                      radius: 14,
                      backgroundColor: Colors.grey.shade200,
                      child: Text('$rank', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                    ),
                    title: Text(item.itemName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                    subtitle: Text(
                      'Variance: ${item.varianceQty >= 0 ? '+' : ''}${_fmtQty(item.varianceQty)} ${item.unit}',
                      style: const TextStyle(fontSize: 11),
                    ),
                    trailing: ControlVarianceBadge(
                      flag: item.flag,
                      label: item.hasCost
                          ? '${item.varianceCost >= 0 ? '+' : ''}${_fmtMoney(item.varianceCost)}'
                          : (item.variancePercent == null ? '—' : '${item.variancePercent}%'),
                    ),
                  );
                }).toList(),
              ),
            ),
          const SizedBox(height: 16),
          Text('Kitchen Production vs Sales',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.grey.shade800)),
          const SizedBox(height: 8),
          KitchenVsSalesTab(items: kitchenVsSales),
        ],
      ),
    );
  }
}

/// Small metric tile reused across the Daily Control summary dashboard.
class SummaryTile extends StatelessWidget {
  const SummaryTile({
    super.key,
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
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: color.withValues(alpha: 0.1), shape: BoxShape.circle),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade600, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(value,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
