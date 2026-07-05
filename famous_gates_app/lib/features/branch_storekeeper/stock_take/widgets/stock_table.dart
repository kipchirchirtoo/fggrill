import 'dart:ui';
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
  final bool isStorekeeper;
  final List<Map<String, dynamic>> staffList;
  final ValueChanged2<String, int?> onPhysicalCountChanged;
  final ValueChanged2<String, String?> onReasonChanged;
  final void Function(String itemId, String explanation)? onExplanationChanged;
  final void Function(String itemId, String action)? onActionTakenChanged;

  const StockTable({
    super.key,
    required this.items,
    required this.isReadOnly,
    this.isStorekeeper = false,
    this.staffList = const [],
    required this.onPhysicalCountChanged,
    required this.onReasonChanged,
    this.onExplanationChanged,
    this.onActionTakenChanged,
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

    final actionsList = <String>[];
    for (final staff in widget.staffList) {
      final name = getStaffName(staff);
      if (name.isNotEmpty) {
        actionsList.add('Credited to $name');
      }
    }
    actionsList.addAll([
      'Approved Spoilage',
      'Stock Adjustment',
      'Write Off',
      'Supplier Refund',
      'Pending Investigation',
      'No Action Needed',
      'Other',
    ]);

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
            for (int _ = 0; _ < (widget.isStorekeeper ? 1 : 8); _++) const DataCell(SizedBox.shrink()),
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
        cells: widget.isStorekeeper
            ? [
                // #
                DataCell(Text(
                  '$idx',
                  style: TextStyle(
                    fontSize: 9.5,
                    color: Colors.grey.shade500,
                    fontWeight: FontWeight.w600,
                  ),
                )),
                // Product
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
                // Count
                DataCell(EditableCell(
                  value: item.physicalCount,
                  readOnly: widget.isReadOnly,
                  focusNode: _focusNodes[fi],
                  onNext: fi < _focusNodes.length - 1
                      ? () => _focusNodes[fi + 1].requestFocus()
                      : null,
                  onChanged: (val) => widget.onPhysicalCountChanged(item.id, val),
                )),
              ]
            : [
                // #
                DataCell(Text(
                  '$idx',
                  style: TextStyle(
                    fontSize: 9.5,
                    color: Colors.grey.shade500,
                    fontWeight: FontWeight.w600,
                  ),
                )),
                // Product
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
                // Opening
                DataCell(_numCell('${item.openingStock}', isDark)),
                // Sales
                DataCell(_numCell(
                  item.sales > 0 ? '-${item.sales}' : '${item.sales}',
                  isDark,
                  color: item.sales > 0 ? Colors.red.shade700 : null,
                )),
                // Adds
                DataCell(_numCell(
                  item.sdds != 0 ? '+${-item.sdds}' : '0',
                  isDark,
                  color: item.sdds < 0 ? Colors.green.shade700 : null,
                )),
                // Closing
                DataCell(_numCell(
                  '${item.closingStock}',
                  isDark,
                  bold: true,
                )),
                // Count (Read-only count for Accountant)
                DataCell(_numCell('${item.physicalCount ?? ''}', isDark, bold: true)),
                // Var
                DataCell(VarianceBadge(variance: variance, hasCount: hasCount)),
                // Explanation
                DataCell(EditableTextCell(
                  value: item.explanation ?? '',
                  readOnly: widget.isReadOnly,
                  onChanged: (val) {
                    if (widget.onExplanationChanged != null) {
                      widget.onExplanationChanged!(item.id, val);
                    }
                  },
                )),
                // Action Taken
                DataCell(_ReasonDropdown(
                  value: hasVar && actionsList.contains(item.actionTaken)
                      ? item.actionTaken
                      : null,
                  items: actionsList,
                  enabled: !widget.isReadOnly && hasVar,
                  onChanged: (v) {
                    if (widget.onActionTakenChanged != null && v != null) {
                      widget.onActionTakenChanged!(item.id, v);
                    }
                  },
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
          minWidth: widget.isStorekeeper ? 400 : 980,
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
          columns: widget.isStorekeeper
              ? const [
                  DataColumn2(label: Text('#'),            size: ColumnSize.S, fixedWidth: 32, numeric: true),
                  DataColumn2(label: Text('Product'),      size: ColumnSize.L),
                  DataColumn2(label: Text('Count'),        size: ColumnSize.M, fixedWidth: 110),
                ]
              : const [
                  DataColumn2(label: Text('#'),            size: ColumnSize.S, fixedWidth: 32, numeric: true),
                  DataColumn2(label: Text('Product'),      size: ColumnSize.L),
                  DataColumn2(label: Text('Opening'),      size: ColumnSize.S, fixedWidth: 70, numeric: true),
                  DataColumn2(label: Text('Sales'),        size: ColumnSize.S, fixedWidth: 60, numeric: true),
                  DataColumn2(label: Text('Adds'),         size: ColumnSize.S, fixedWidth: 60, numeric: true),
                  DataColumn2(label: Text('Closing'),      size: ColumnSize.S, fixedWidth: 70, numeric: true),
                  DataColumn2(label: Text('Count'),        size: ColumnSize.M, fixedWidth: 70, numeric: true),
                  DataColumn2(label: Text('Var'),          size: ColumnSize.S, fixedWidth: 60, numeric: true),
                  DataColumn2(label: Text('Explanation'),  size: ColumnSize.L),
                  DataColumn2(label: Text('Action Taken'), size: ColumnSize.L),
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

// ── Compact inline text editor cell for explanations ───────────────────────
class EditableTextCell extends StatefulWidget {
  final String value;
  final ValueChanged<String> onChanged;
  final bool readOnly;
  final String hintText;

  const EditableTextCell({
    super.key,
    required this.value,
    required this.onChanged,
    required this.readOnly,
    this.hintText = 'Explain…',
  });

  @override
  State<EditableTextCell> createState() => _EditableTextCellState();
}

class _EditableTextCellState extends State<EditableTextCell> {
  late final TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.value);
  }

  @override
  void didUpdateWidget(covariant EditableTextCell old) {
    super.didUpdateWidget(old);
    if (old.value != widget.value) {
      if (_ctrl.text != widget.value) {
        _ctrl.text = widget.value;
        _ctrl.selection = TextSelection.collapsed(offset: widget.value.length);
      }
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.readOnly) {
      return Text(
        widget.value.isNotEmpty ? widget.value : '—',
        style: const TextStyle(fontSize: 10),
      );
    }

    return SizedBox(
      height: 24,
      child: TextField(
        controller: _ctrl,
        style: const TextStyle(fontSize: 10),
        onChanged: widget.onChanged,
        decoration: InputDecoration(
          isDense: true,
          hintText: widget.hintText,
          hintStyle: TextStyle(fontSize: 9, color: Colors.grey.shade400),
          contentPadding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
          filled: true,
          fillColor: Colors.grey.shade50,
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(2),
            borderSide: BorderSide(color: Colors.grey.shade300, width: 0.8),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(2),
            borderSide: const BorderSide(color: Color(0xFF217346), width: 1.2),
          ),
        ),
      ),
    );
  }
}

String getStaffName(Map<String, dynamic> row) {
  final explicit = '${row['staff_name'] ?? row['full_name'] ?? row['name'] ?? ''}'.trim();
  if (explicit.isNotEmpty && explicit.toLowerCase() != 'null') return explicit;
  final first = '${row['first_name'] ?? row['firstName'] ?? ''}'.trim();
  final last = '${row['last_name'] ?? row['lastName'] ?? ''}'.trim();
  return '$first $last'.trim();
}

typedef ValueChanged2<T1, T2> = void Function(T1 value1, T2 value2);
