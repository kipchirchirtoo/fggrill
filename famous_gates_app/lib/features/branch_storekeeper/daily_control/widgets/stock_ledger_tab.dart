import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/stock_ledger_item.dart';
import 'daily_control_empty_state.dart';

final _qty = NumberFormat('#,##0.###', 'en_KE');
String _fmtQty(num v) => _qty.format(v);

class StockLedgerTab extends StatelessWidget {
  const StockLedgerTab({super.key, required this.items, required this.isLoading});

  final List<StockLedgerItem> items;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (items.isEmpty) {
      return const DailyControlEmptyState(
        message: 'No stock items being tracked in a kitchen shift for this date yet.',
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Card(
            elevation: 1,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                columnSpacing: 18,
                headingRowColor: WidgetStateProperty.all(Colors.grey.shade50),
                columns: const [
                  DataColumn(label: Text('Item')),
                  DataColumn(label: Text('Opening'), numeric: true),
                  DataColumn(label: Text('Added'), numeric: true),
                  DataColumn(label: Text('Totals'), numeric: true),
                  DataColumn(label: Text('Closing'), numeric: true),
                  DataColumn(label: Text('Rejects'), numeric: true),
                  DataColumn(label: Text('Qty Sold'), numeric: true),
                  DataColumn(label: Text('System Sold'), numeric: true),
                  DataColumn(label: Text('Shorts'), numeric: true),
                ],
                rows: items.map((item) => _row(item)).toList(),
              ),
            ),
          ),
        ],
      ),
    );
  }

  DataRow _row(StockLedgerItem item) {
    if (item.dataQuality == 'PENDING_HANDOVER') {
      return DataRow(cells: [
        DataCell(SizedBox(
          width: 170,
          child: Text(item.itemName,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w600)),
        )),
        DataCell(Text('${_fmtQty(item.openingStock)} ${item.unit}')),
        DataCell(Text('${_fmtQty(item.addedStock)} ${item.unit}')),
        DataCell(Text('${_fmtQty(item.totals)} ${item.unit}')),
        DataCell(_PendingChip()),
        DataCell(Text('${_fmtQty(item.rejects)} ${item.unit}')),
        const DataCell(Text('—')),
        DataCell(Text('${_fmtQty(item.systemSold)} ${item.unit}')),
        const DataCell(Text('—')),
      ]);
    }

    if (item.dataQuality == 'NO_MOVEMENT') {
      return DataRow(cells: [
        DataCell(SizedBox(
          width: 170,
          child: Text(item.itemName,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w600)),
        )),
        DataCell(Text('${_fmtQty(item.openingStock)} ${item.unit}')),
        DataCell(Text('${_fmtQty(item.addedStock)} ${item.unit}')),
        DataCell(Text('${_fmtQty(item.totals)} ${item.unit}')),
        DataCell(Text('${_fmtQty(item.closingStock ?? 0)} ${item.unit}')),
        DataCell(Text('${_fmtQty(item.rejects)} ${item.unit}')),
        DataCell(Text('${_fmtQty(item.quantitySold ?? 0)} ${item.unit}')),
        DataCell(Text('${_fmtQty(item.systemSold)} ${item.unit}')),
        DataCell(_NoActivityChip()),
      ]);
    }

    if (item.dataQuality == 'INCOMPLETE_OPENING') {
      return DataRow(cells: [
        DataCell(SizedBox(
          width: 170,
          child: Text(item.itemName,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w600)),
        )),
        DataCell(Text('${_fmtQty(item.openingStock)} ${item.unit}')),
        DataCell(Text('${_fmtQty(item.addedStock)} ${item.unit}')),
        DataCell(Text('${_fmtQty(item.totals)} ${item.unit}')),
        DataCell(Text('${_fmtQty(item.closingStock ?? 0)} ${item.unit}')),
        DataCell(Text('${_fmtQty(item.rejects)} ${item.unit}')),
        const DataCell(Text('—')),
        DataCell(Text('${_fmtQty(item.systemSold)} ${item.unit}')),
        DataCell(_IncompleteOpeningChip()),
      ]);
    }

    final shorts = item.shorts ?? 0;
    final totals = item.totals == 0 ? 1 : item.totals;
    final shortsPct = (shorts.abs() / totals) * 100;
    final shortsColor = shorts == 0
        ? Colors.grey.shade700
        : shortsPct >= 5
            ? Colors.red.shade700
            : Colors.orange.shade800;

    return DataRow(cells: [
      DataCell(SizedBox(
        width: 170,
        child: Text(item.itemName,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w600)),
      )),
      DataCell(Text('${_fmtQty(item.openingStock)} ${item.unit}')),
      DataCell(Text('${_fmtQty(item.addedStock)} ${item.unit}')),
      DataCell(Text('${_fmtQty(item.totals)} ${item.unit}')),
      DataCell(Text('${_fmtQty(item.closingStock ?? 0)} ${item.unit}')),
      DataCell(Text('${_fmtQty(item.rejects)} ${item.unit}')),
      DataCell(Text('${_fmtQty(item.quantitySold ?? 0)} ${item.unit}')),
      DataCell(Text('${_fmtQty(item.systemSold)} ${item.unit}')),
      DataCell(Text(
        '${shorts >= 0 ? '+' : ''}${_fmtQty(shorts)} ${item.unit}',
        style: TextStyle(color: shortsColor, fontWeight: FontWeight.w800),
      )),
    ]);
  }
}

class _PendingChip extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'No physical closing count entered yet for this shift — '
          'Qty Sold and Shorts cannot be computed until handover.',
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: Colors.blueGrey.shade50,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: Colors.blueGrey.shade200),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.schedule, size: 12, color: Colors.blueGrey.shade700),
            const SizedBox(width: 4),
            Text('Pending',
                style: TextStyle(fontSize: 10, color: Colors.blueGrey.shade800, fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}

class _IncompleteOpeningChip extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'Closing count exceeds opening + added — the opening/added '
          'quantities were not recorded for this item, so Qty Sold and '
          'Shorts cannot be computed. Ask the storekeeper to enter opening stock.',
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: Colors.amber.shade50,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: Colors.amber.shade300),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.warning_amber_rounded,
                size: 12, color: Colors.amber.shade900),
            const SizedBox(width: 4),
            Text('No opening data',
                style: TextStyle(
                    fontSize: 10,
                    color: Colors.amber.shade900,
                    fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}

class _NoActivityChip extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Text('No activity',
          style: TextStyle(fontSize: 10, color: Colors.grey.shade700, fontWeight: FontWeight.w700)),
    );
  }
}
