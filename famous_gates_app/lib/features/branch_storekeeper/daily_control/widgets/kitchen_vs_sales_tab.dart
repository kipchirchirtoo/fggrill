import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/kitchen_vs_sales_item.dart';
import 'daily_control_empty_state.dart';

final _qty = NumberFormat('#,##0.##', 'en_KE');
String _fmtQty(num v) => _qty.format(v);

class KitchenVsSalesTab extends StatelessWidget {
  const KitchenVsSalesTab({super.key, required this.items});

  final List<KitchenVsSalesItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const DailyControlEmptyState(
        message: 'No kitchen production entries or POS sales for this date yet.',
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Card(
        elevation: 1,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            columnSpacing: 24,
            headingRowColor: WidgetStateProperty.all(Colors.grey.shade50),
            columns: const [
              DataColumn(label: Text('Menu Item')),
              DataColumn(label: Text('Kitchen Produced'), numeric: true),
              DataColumn(label: Text('POS Sold'), numeric: true),
              DataColumn(label: Text('Variance'), numeric: true),
              DataColumn(label: Text('Status')),
            ],
            rows: items.map((item) {
              final color = item.isOverproduction
                  ? Colors.orange.shade800
                  : item.isUnderproduction
                      ? Colors.red.shade700
                      : Colors.green.shade700;
              final label = item.isOverproduction
                  ? 'Overproduction (waste risk)'
                  : item.isUnderproduction
                      ? 'Underproduction (fulfillment risk)'
                      : 'Balanced';
              return DataRow(cells: [
                DataCell(SizedBox(
                  width: 200,
                  child: Text(item.itemName,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                )),
                DataCell(Text(_fmtQty(item.producedQty))),
                DataCell(Text(_fmtQty(item.soldQty))),
                DataCell(Text(
                  '${item.variance >= 0 ? '+' : ''}${_fmtQty(item.variance)}',
                  style: TextStyle(color: color, fontWeight: FontWeight.w700),
                )),
                DataCell(Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
                )),
              ]);
            }).toList(),
          ),
        ),
      ),
    );
  }
}
