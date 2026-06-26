import 'package:flutter/material.dart';
import 'package:data_table_2/data_table_2.dart';

import '../models/stock_take_item.dart';
import 'editable_cell.dart';
import 'variance_badge.dart';

class StockTable extends StatelessWidget {
  final List<StockTakeItem> items;
  final bool isReadOnly;
  final ValueChanged2<String, int?> onPhysicalCountChanged;
  final ValueChanged2<String, String?> onReasonChanged;

  const StockTable({
    super.key,
    required this.items,
    required this.isReadOnly,
    required this.onPhysicalCountChanged,
    required this.onReasonChanged,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final reasonsList = [
      'Damaged',
      'Expired',
      'Theft',
      'Supplier Error',
      'Counting Error',
      'Transfer',
      'Adjustment',
      'Other'
    ];

    if (items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.inventory_2_outlined, size: 64, color: Colors.grey.shade400),
              const SizedBox(height: 16),
              Text(
                'No products match your search or filters.',
                style: TextStyle(
                  fontSize: 16,
                  color: Colors.grey.shade600,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      clipBehavior: Clip.antiAlias,
      color: isDark ? theme.colorScheme.surface : Colors.white,
      child: Container(
        height: double.infinity,
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey.shade300, width: 1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: DataTable2(
          columnSpacing: 12,
          horizontalMargin: 12,
          minWidth: 1200,
          fixedTopRows: 1,
          fixedLeftColumns: 2, // Sticky index + Product columns
          headingRowColor: WidgetStateProperty.resolveWith(
            (states) => const Color(0xFF1565C0), // Material 3 blue AppBar style
          ),
          headingTextStyle: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 13,
          ),
          border: TableBorder(
            horizontalInside: BorderSide(color: Colors.grey.shade300, width: 1),
            verticalInside: BorderSide(color: Colors.grey.shade200, width: 1),
            bottom: BorderSide(color: Colors.grey.shade300, width: 1),
          ),
          columns: const [
            DataColumn2(label: Text('#'), size: ColumnSize.S, numeric: true),
            DataColumn2(label: Text('Product'), size: ColumnSize.L),
            DataColumn2(label: Text('Opening Stock'), size: ColumnSize.S, numeric: true),
            DataColumn2(label: Text('Sales'), size: ColumnSize.S, numeric: true),
            DataColumn2(label: Text('SDDS'), size: ColumnSize.S, numeric: true),
            DataColumn2(label: Text('Closing Stock (Auto)'), size: ColumnSize.M, numeric: true),
            DataColumn2(label: Text('Physical Count (Editable)'), size: ColumnSize.M, numeric: true),
            DataColumn2(label: Text('Variance'), size: ColumnSize.S, numeric: true),
            DataColumn2(label: Text('Reason for Variance'), size: ColumnSize.L),
          ],
          rows: List<DataRow2>.generate(items.length, (index) {
            final item = items[index];
            final isEven = index % 2 == 0;
            final rowColor = isEven
                ? (isDark ? Colors.grey.shade900 : Colors.grey.shade50)
                : (isDark ? const Color(0xFF0F0F0F) : Colors.white);
            final varianceVal = item.physicalCount != null ? item.variance : 0;
            final hasCount = item.physicalCount != null;
            final isVarianceNonZero = hasCount && varianceVal != 0;

            return DataRow2(
              key: ValueKey(item.id),
              color: WidgetStateProperty.resolveWith((states) {
                if (states.contains(WidgetState.hovered)) {
                  return isDark ? Colors.grey.shade800 : const Color(0xFFE3F2FD); // Hover color
                }
                return rowColor;
              }),
              cells: [
                // 1. Index
                DataCell(
                  Text(
                    '${index + 1}',
                    style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.grey),
                  ),
                ),
                // 2. Product Name, SKU, Image
                DataCell(
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4.0),
                    child: Row(
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: Colors.grey.shade300),
                          ),
                          child: item.imageUrl.isNotEmpty
                              ? ClipRRect(
                                  borderRadius: BorderRadius.circular(4),
                                  child: Image.network(
                                    item.imageUrl,
                                    fit: BoxFit.cover,
                                    errorBuilder: (c, e, s) =>
                                        const Icon(Icons.image_outlined, size: 16, color: Colors.grey),
                                  ),
                                )
                              : const Icon(Icons.image_outlined, size: 16, color: Colors.grey),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                item.productName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                              ),
                              const SizedBox(height: 1),
                              Text(
                                item.sku,
                                style: TextStyle(
                                  color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                // 3. Opening Stock
                DataCell(Text('${item.openingStock}')),
                // 4. Sales
                DataCell(Text('${item.sales}')),
                // 5. SDDS
                // If sdds is negative (representing additions), we can show it as negative or format it.
                // But wait! To match the math `Opening Stock - Sales - SDDS = Closing Stock`,
                // if SDDS is additions, we mapped it as -additions.
                // Let's display the absolute value of SDDS if it's additions, or let's display the actual value.
                // Wait! In the Excel mock, SDDS is a positive subtraction (e.g. 5, 2, 10).
                // So if we mapped additions to SDDS, and additions is +10 (restocks),
                // then SDDS is -10. But showing -10 in the UI under SDDS might look strange if additions is positive.
                // If it is bar stocktake, where additions is +10 and sales is 25, then:
                // Closing = Opening + 10 - 25 = Opening - 25 - (-10).
                // So SDDS is -10. We can show it as `-10` (or show it as additions).
                // Let's display `item.sdds` as is.
                DataCell(Text('${item.sdds}')),
                // 6. Expected Closing Stock (Auto)
                DataCell(
                  Text(
                    '${item.closingStock}',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
                // 7. Physical Count (Editable)
                DataCell(
                  EditableCell(
                    value: item.physicalCount,
                    readOnly: isReadOnly,
                    onChanged: (val) {
                      onPhysicalCountChanged(item.id, val);
                    },
                  ),
                ),
                // 8. Variance
                DataCell(
                  VarianceBadge(
                    variance: varianceVal,
                    hasCount: hasCount,
                  ),
                ),
                // 9. Reason for Variance
                DataCell(
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: DropdownButtonFormField<String>(
                      value: isVarianceNonZero && reasonsList.contains(item.reason)
                          ? item.reason
                          : null,
                      hint: Text(
                        isReadOnly ? '—' : '— Select reason —',
                        style: const TextStyle(fontSize: 12),
                      ),
                      style: TextStyle(
                        fontSize: 12,
                        color: theme.textTheme.bodyMedium?.color,
                      ),
                      decoration: const InputDecoration(
                        isDense: true,
                        contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                        border: OutlineInputBorder(),
                      ),
                      items: reasonsList
                          .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                          .toList(),
                      onChanged: !isReadOnly && isVarianceNonZero
                          ? (val) {
                              onReasonChanged(item.id, val);
                            }
                          : null, // Disabled if read-only or variance is 0
                    ),
                  ),
                ),
              ],
            );
          }),
        ),
      ),
    );
  }
}

typedef ValueChanged2<T1, T2> = void Function(T1 value1, T2 value2);
