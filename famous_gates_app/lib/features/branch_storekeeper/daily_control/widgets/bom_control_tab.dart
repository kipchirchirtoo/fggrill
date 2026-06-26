import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/bom_control_item.dart';
import 'control_variance_badge.dart';
import 'daily_control_empty_state.dart';

final _money = NumberFormat('#,##0.00', 'en_KE');
final _qty = NumberFormat('#,##0.###', 'en_KE');
String _fmtMoney(num v) => 'KES ${_money.format(v)}';
String _fmtQty(num v) => _qty.format(v);

class BomControlTab extends StatelessWidget {
  const BomControlTab({
    super.key,
    required this.items,
    required this.noRecipeItems,
  });

  final List<BomControlItem> items;
  final List<NoRecipeItem> noRecipeItems;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty && noRecipeItems.isEmpty) {
      return const DailyControlEmptyState(
        message: 'No POS sales or ingredient issues recorded for this date yet.',
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (noRecipeItems.isNotEmpty) ...[
            Card(
              color: Colors.orange.shade50,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
                side: BorderSide(color: Colors.orange.shade200),
              ),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Icon(Icons.warning_amber_rounded, color: Colors.orange.shade800, size: 18),
                      const SizedBox(width: 8),
                      Text('⚠ Sold items with no recipe registered',
                          style: TextStyle(
                              fontWeight: FontWeight.w800,
                              color: Colors.orange.shade900,
                              fontSize: 13)),
                    ]),
                    const SizedBox(height: 8),
                    ...noRecipeItems.map((i) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 2),
                          child: Text(
                            '${i.itemName} — sold ${_fmtQty(i.qtySold)}',
                            style: const TextStyle(fontSize: 12),
                          ),
                        )),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],
          if (items.isNotEmpty)
            Card(
              elevation: 1,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  columnSpacing: 20,
                  headingRowColor: WidgetStateProperty.all(Colors.grey.shade50),
                  columns: const [
                    DataColumn(label: Text('Ingredient')),
                    DataColumn(label: Text('Theoretical'), numeric: true),
                    DataColumn(label: Text('Actual'), numeric: true),
                    DataColumn(label: Text('Variance (qty)'), numeric: true),
                    DataColumn(label: Text('Theoretical Cost'), numeric: true),
                    DataColumn(label: Text('Actual Cost'), numeric: true),
                    DataColumn(label: Text('Variance (cost)'), numeric: true),
                    DataColumn(label: Text('Status')),
                  ],
                  rows: items.map((item) {
                    return DataRow(cells: [
                      DataCell(SizedBox(
                        width: 180,
                        child: Text(
                          item.itemName,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      )),
                      DataCell(Text('${_fmtQty(item.theoreticalQty)} ${item.unit}')),
                      DataCell(Text('${_fmtQty(item.actualQty)} ${item.unit}')),
                      DataCell(Text(
                        '${item.varianceQty >= 0 ? '+' : ''}${_fmtQty(item.varianceQty)}',
                        style: TextStyle(
                          color: item.varianceQty == 0
                              ? Colors.grey.shade700
                              : (item.varianceQty > 0 ? Colors.orange.shade800 : Colors.red.shade700),
                          fontWeight: FontWeight.w700,
                        ),
                      )),
                      DataCell(Text(item.hasCost ? _fmtMoney(item.theoreticalCost) : '—')),
                      DataCell(Text(item.hasCost ? _fmtMoney(item.actualCost) : '—')),
                      DataCell(Text(
                        item.hasCost
                            ? '${item.varianceCost >= 0 ? '+' : ''}${_fmtMoney(item.varianceCost)}'
                            : '—',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      )),
                      DataCell(ControlVarianceBadge(
                        flag: item.flag,
                        label: item.variancePercent == null
                            ? (item.flag == 'red' ? 'Unaccounted' : 'OK')
                            : '${item.variancePercent! >= 0 ? '+' : ''}${item.variancePercent}%',
                      )),
                    ]);
                  }).toList(),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

