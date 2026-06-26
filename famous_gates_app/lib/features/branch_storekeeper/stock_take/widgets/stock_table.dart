import 'package:flutter/material.dart';
import 'package:data_table_2/data_table_2.dart';

import '../models/stock_take_item.dart';
import 'editable_cell.dart';
import 'variance_badge.dart';

// ── Excel-style constants ─────────────────────────────────────────────────────
const _kHeaderBg    = Color(0xFF217346); // Excel green header
const _kHeaderText  = Colors.white;
const _kCatBg       = Color(0xFFE8F5E9); // light-green category band
const _kCatBgDark   = Color(0xFF1B3A2A);
const _kEvenRow     = Color(0xFFF9F9F9);
const _kOddRow      = Colors.white;
const _kGridLine    = Color(0xFFD0D0D0);
const _kFontSz      = 11.0;  // cell body text
const _kHdrFontSz   = 10.5;  // header text
const _kRowH        = 36.0;  // row height — enough for two-line product cell

class StockTable extends StatefulWidget {
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
  State<StockTable> createState() => _StockTableState();
}

class _StockTableState extends State<StockTable> {
  List<FocusNode> _focusNodes = [];
  int _lastItemCount = 0;

  void _ensureFocusNodes(int count) {
    if (count == _lastItemCount) return;
    for (final fn in _focusNodes) fn.dispose();
    _focusNodes = List.generate(count, (_) => FocusNode());
    _lastItemCount = count;
  }

  @override
  void dispose() {
    for (final fn in _focusNodes) fn.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    const reasonsList = [
      'Damaged', 'Expired', 'Theft', 'Supplier Error',
      'Counting Error', 'Transfer', 'Adjustment', 'Other',
    ];

    if (widget.items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.table_chart_outlined, size: 48,
                color: Colors.grey.shade400),
            const SizedBox(height: 12),
            Text('No items found',
                style: TextStyle(fontSize: 13, color: Colors.grey.shade500)),
          ],
        ),
      );
    }

    final sorted = List<StockTakeItem>.from(widget.items)
      ..sort((a, b) {
        if (a.category != b.category) return a.category.compareTo(b.category);
        return a.productName.compareTo(b.productName);
      });

    _ensureFocusNodes(sorted.length);

    final rows = <DataRow2>[];
    String? lastCat;
    int rowNum = 1;
    int fi = 0;

    for (int i = 0; i < sorted.length; i++) {
      final item = sorted[i];

      // ── Category header row ──────────────────────────────────────────────
      if (lastCat != item.category) {
        lastCat = item.category;
        rows.add(DataRow2(
          key: ValueKey('cat_$i'),
          color: WidgetStateProperty.all(
              isDark ? _kCatBgDark : _kCatBg),
          cells: [
            const DataCell(SizedBox.shrink()),
            DataCell(Row(children: [
              Icon(Icons.label_outline,
                  size: 11,
                  color: isDark ? Colors.green.shade300 : const Color(0xFF217346)),
              const SizedBox(width: 4),
              Text(
                item.category.toUpperCase(),
                style: TextStyle(
                  fontSize: 9.5,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8,
                  color: isDark
                      ? Colors.green.shade300
                      : const Color(0xFF1A5C38),
                ),
              ),
            ])),
            for (int _ = 0; _ < 7; _++) const DataCell(SizedBox.shrink()),
          ],
        ));
      }

      // ── Data row ─────────────────────────────────────────────────────────
      final idx      = rowNum++;
      final isEven   = idx % 2 == 0;
      final bgColor  = isEven
          ? (isDark ? const Color(0xFF1A1A1A) : _kEvenRow)
          : (isDark ? const Color(0xFF111111) : _kOddRow);
      final variance = item.physicalCount != null ? item.variance : 0;
      final hasCount = item.physicalCount != null;
      final hasVar   = hasCount && variance != 0;

      rows.add(DataRow2(
        key: ValueKey(item.id),
        specificRowHeight: _kRowH,
        color: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.hovered)) {
            return isDark
                ? Colors.green.shade900.withOpacity(0.3)
                : const Color(0xFFE8F5E9);
          }
          return bgColor;
        }),
        cells: [
          // # ─────────────────────────────────────────────────────────────
          DataCell(Text(
            '$idx',
            style: TextStyle(
              fontSize: 9.5,
              color: Colors.grey.shade500,
              fontWeight: FontWeight.w600,
            ),
          )),

          // Product ─────────────────────────────────────────────────────
          DataCell(Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  item.productName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: _kFontSz, fontWeight: FontWeight.w600),
                ),
                Text(
                  item.sku,
                  style: TextStyle(
                      fontSize: 8.5,
                      color: Colors.grey.shade500,
                      letterSpacing: 0.2),
                ),
              ],
            ),
          )),

          // Opening ─────────────────────────────────────────────────────
          DataCell(_numCell('${item.openingStock}', isDark)),

          // Sales ───────────────────────────────────────────────────────
          DataCell(_numCell(
            item.sales > 0 ? '-${item.sales}' : '${item.sales}',
            isDark,
            color: item.sales > 0 ? Colors.red.shade700 : null,
          )),

          // Adds ────────────────────────────────────────────────────────
          DataCell(_numCell(
            item.sdds != 0 ? '+${-item.sdds}' : '0',
            isDark,
            color: item.sdds < 0 ? Colors.green.shade700 : null,
          )),

          // Closing (auto) ──────────────────────────────────────────────
          DataCell(_numCell(
            '${item.closingStock}',
            isDark,
            bold: true,
          )),

          // Physical Count ──────────────────────────────────────────────
          DataCell(EditableCell(
            value: item.physicalCount,
            readOnly: widget.isReadOnly,
            focusNode: _focusNodes[fi],
            onNext: fi < _focusNodes.length - 1
                ? () => _focusNodes[fi + 1].requestFocus()
                : null,
            onChanged: (val) => widget.onPhysicalCountChanged(item.id, val),
          )),

          // Variance ────────────────────────────────────────────────────
          DataCell(VarianceBadge(variance: variance, hasCount: hasCount)),

          // Reason ──────────────────────────────────────────────────────
          DataCell(_ReasonDropdown(
            value: hasVar && reasonsList.contains(item.reason)
                ? item.reason
                : null,
            items: reasonsList,
            enabled: !widget.isReadOnly && hasVar,
            onChanged: (v) => widget.onReasonChanged(item.id, v),
          )),
        ],
      ));
      fi++;
    }

    // ── Table ───────────────────────────────────────────────────────────────
    return ClipRRect(
      borderRadius: BorderRadius.circular(6),
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(color: _kGridLine, width: 1),
          borderRadius: BorderRadius.circular(6),
          color: isDark ? const Color(0xFF111111) : Colors.white,
        ),
        child: DataTable2(
          columnSpacing: 8,
          horizontalMargin: 8,
          minWidth: 900,
          dataRowHeight: _kRowH,
          headingRowHeight: 32,
          fixedTopRows: 1,
          fixedLeftColumns: 2,
          headingRowColor:
              WidgetStateProperty.all(_kHeaderBg),
          headingTextStyle: const TextStyle(
            color: _kHeaderText,
            fontWeight: FontWeight.w700,
            fontSize: _kHdrFontSz,
            letterSpacing: 0.3,
          ),
          border: TableBorder(
            horizontalInside: const BorderSide(color: _kGridLine, width: 0.5),
            verticalInside: const BorderSide(color: _kGridLine, width: 0.5),
            top: const BorderSide(color: _kGridLine, width: 0.5),
            bottom: const BorderSide(color: _kGridLine, width: 0.5),
          ),
          columns: const [
            DataColumn2(label: Text('#'),            size: ColumnSize.S, fixedWidth: 32, numeric: true),
            DataColumn2(label: Text('Product'),      size: ColumnSize.L),
            DataColumn2(label: Text('Opening'),      size: ColumnSize.S, fixedWidth: 70, numeric: true),
            DataColumn2(label: Text('Sales'),        size: ColumnSize.S, fixedWidth: 60, numeric: true),
            DataColumn2(label: Text('Adds'),         size: ColumnSize.S, fixedWidth: 60, numeric: true),
            DataColumn2(label: Text('Closing'),      size: ColumnSize.S, fixedWidth: 70, numeric: true),
            DataColumn2(label: Text('Count'),        size: ColumnSize.M, fixedWidth: 110),
            DataColumn2(label: Text('Var'),          size: ColumnSize.S, fixedWidth: 60, numeric: true),
            DataColumn2(label: Text('Reason'),       size: ColumnSize.L),
          ],
          rows: rows,
        ),
      ),
    );
  }

  Widget _numCell(String text, bool isDark,
      {Color? color, bool bold = false}) {
    return Text(
      text,
      textAlign: TextAlign.right,
      style: TextStyle(
        fontSize: _kFontSz,
        fontWeight: bold ? FontWeight.w700 : FontWeight.normal,
        color: color ?? (isDark ? Colors.grey.shade200 : Colors.grey.shade800),
        fontFeatures: const [FontFeature.tabularFigures()],
      ),
    );
  }
}

// ── Compact inline reason dropdown ───────────────────────────────────────────
class _ReasonDropdown extends StatelessWidget {
  final String? value;
  final List<String> items;
  final bool enabled;
  final ValueChanged<String?> onChanged;

  const _ReasonDropdown({
    required this.value,
    required this.items,
    required this.enabled,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    if (!enabled) {
      return Text(
        value ?? '—',
        style: TextStyle(
            fontSize: 10, color: Colors.grey.shade400),
      );
    }
    return DropdownButtonHideUnderline(
      child: DropdownButton<String>(
        value: value,
        hint: Text('Select…',
            style: TextStyle(fontSize: 10, color: Colors.grey.shade400)),
        style: TextStyle(
          fontSize: 10,
          color: isDark ? Colors.grey.shade200 : Colors.grey.shade800,
        ),
        isDense: true,
        iconSize: 14,
        items: items
            .map((r) => DropdownMenuItem(
                value: r,
                child: Text(r, style: const TextStyle(fontSize: 10))))
            .toList(),
        onChanged: onChanged,
      ),
    );
  }
}

typedef ValueChanged2<T1, T2> = void Function(T1 value1, T2 value2);
