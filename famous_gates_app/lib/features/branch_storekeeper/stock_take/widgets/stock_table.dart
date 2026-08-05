import 'dart:ui';

import 'package:data_table_2/data_table_2.dart';
import 'package:flutter/material.dart';

import '../models/stock_take_item.dart';
import 'editable_cell.dart';
import 'variance_badge.dart';

const _kHeaderBg = Color(0xFF0F2E5E);
const _kHeaderText = Colors.white;
const _kCatBg = Color(0xFFE8F5E9);
const _kCatBgDark = Color(0xFF1B3A2A);
const _kEvenRow = Color(0xFFF9FAFB);
const _kOddRow = Colors.white;
const _kGridLine = Color(0xFFD0D7E2);
const _kFontSz = 11.0;
const _kHdrFontSz = 10.5;
const _kRowH = 36.0;

class StockTable extends StatefulWidget {
  final List<StockTakeItem> items;
  final bool isReadOnly;
  final bool isStorekeeper;
  final List<Map<String, dynamic>> staffList;
  final ValueChanged2<String, double?> onPhysicalCountChanged;
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
    for (final node in _focusNodes) {
      node.dispose();
    }
    _focusNodes = List.generate(count, (_) => FocusNode());
    _lastItemCount = count;
  }

  @override
  void dispose() {
    for (final node in _focusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.table_chart_outlined,
              size: 48,
              color: Colors.grey.shade400,
            ),
            const SizedBox(height: 12),
            Text(
              'No items found',
              style: TextStyle(fontSize: 13, color: Colors.grey.shade500),
            ),
          ],
        ),
      );
    }

    final sorted = List<StockTakeItem>.from(widget.items)..sort((a, b) {
      final categoryCompare = a.category.compareTo(b.category);
      if (categoryCompare != 0) return categoryCompare;
      return a.productName.compareTo(b.productName);
    });

    _ensureFocusNodes(sorted.length);

    if (widget.isStorekeeper) {
      return _buildBlindCountTable(sorted);
    }

    return _buildVarianceReviewTable(context, sorted);
  }

  void _focusNextCell(int index) {
    if (index >= _focusNodes.length - 1) {
      _focusNodes[index].unfocus();
      return;
    }
    final nextNode = _focusNodes[index + 1];
    FocusScope.of(context).requestFocus(nextNode);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final nextContext = nextNode.context;
      if (nextContext != null) {
        Scrollable.ensureVisible(
          nextContext,
          duration: const Duration(milliseconds: 140),
          curve: Curves.easeOut,
          alignment: 0.2,
        );
      }
    });
  }

  Widget _buildBlindCountTable(List<StockTakeItem> items) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A0F172A),
            blurRadius: 20,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
            decoration: const BoxDecoration(
              border: Border(
                bottom: BorderSide(color: Color(0xFFE2E8F0)),
              ),
            ),
            child: Row(
              children: [
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Blind Count Grid',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Enter physical count only. Press Enter to move to the next line.',
                        style: TextStyle(
                          fontSize: 13,
                          color: Color(0xFF475569),
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '${items.length} item(s)',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF334155),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            decoration: const BoxDecoration(
              color: Color(0xFFF8FAFC),
              border: Border(
                bottom: BorderSide(color: Color(0xFFE2E8F0)),
              ),
            ),
            child: const Row(
              children: [
                _BlindHeaderCell('#', flex: 1),
                _BlindHeaderCell('Product', flex: 4),
                _BlindHeaderCell('SKU', flex: 3),
                _BlindHeaderCell('Category', flex: 3),
                _BlindHeaderCell(
                  'Physical Count',
                  flex: 2,
                  alignEnd: true,
                ),
              ],
            ),
          ),
          ListView.separated(
            itemCount: items.length,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            separatorBuilder: (_, __) =>
                const Divider(height: 1, color: Color(0xFFE2E8F0)),
            itemBuilder: (context, index) {
              final item = items[index];
              return Container(
                color: index.isEven ? Colors.white : const Color(0xFFFCFDFE),
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 14,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    _BlindBodyCell('${index + 1}', flex: 1),
                    Expanded(
                      flex: 4,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.productName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            item.physicalCount == null
                                ? 'Pending count'
                                : 'Count entered',
                            style: TextStyle(
                              fontSize: 12,
                              color: item.physicalCount == null
                                  ? const Color(0xFF94A3B8)
                                  : const Color(0xFF16A34A),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    _BlindBodyCell(item.sku, flex: 3),
                    Expanded(
                      flex: 3,
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: _CategoryChip(label: item.category),
                      ),
                    ),
                    Expanded(
                      flex: 2,
                        child: Align(
                          alignment: Alignment.centerRight,
                          child: EditableCell(
                            value: item.physicalCount,
                            readOnly: widget.isReadOnly,
                            focusNode: _focusNodes[index],
                            onNext: () => _focusNextCell(index),
                            onChanged: (value) =>
                                widget.onPhysicalCountChanged(item.id, value),
                          ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildVarianceReviewTable(
    BuildContext context,
    List<StockTakeItem> sorted,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final actionsList = <String>[];
    for (final staff in widget.staffList) {
      final name = getStaffName(staff);
      if (name.isNotEmpty) {
        actionsList.add('Credited to $name');
      }
    }
    actionsList.addAll(const [
      'Approved Spoilage',
      'Stock Adjustment',
      'Write Off',
      'Supplier Refund',
      'Pending Investigation',
      'No Action Needed',
      'Other',
    ]);

    final rows = <DataRow2>[];
    String? lastCategory;

    for (int index = 0; index < sorted.length; index++) {
      final item = sorted[index];
      if (lastCategory != item.category) {
        lastCategory = item.category;
        rows.add(
          DataRow2(
            key: ValueKey('cat_$index'),
            color: WidgetStateProperty.all(
              isDark ? _kCatBgDark : _kCatBg,
            ),
            cells: [
              const DataCell(SizedBox.shrink()),
              DataCell(
                Row(
                  children: [
                    Icon(
                      Icons.label_outline,
                      size: 11,
                      color: isDark
                          ? Colors.green.shade300
                          : const Color(0xFF217346),
                    ),
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
                  ],
                ),
              ),
              for (int i = 0; i < 9; i++) const DataCell(SizedBox.shrink()),
            ],
          ),
        );
      }

      final rowNumber = index + 1;
      final variance = item.physicalCount != null ? item.variance : 0;
      final hasCount = item.physicalCount != null;
      final hasVariance = hasCount && variance != 0;
      final isEven = rowNumber.isEven;
      final background = isEven
          ? (isDark ? const Color(0xFF1A1A1A) : _kEvenRow)
          : (isDark ? const Color(0xFF111111) : _kOddRow);

      rows.add(
        DataRow2(
          key: ValueKey(item.id),
          specificRowHeight: _kRowH,
          color: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.hovered)) {
              return isDark
                  ? Colors.green.shade900.withOpacity(0.3)
                  : const Color(0xFFE8F5E9);
            }
            return background;
          }),
          cells: [
            DataCell(
              Text(
                '$rowNumber',
                style: TextStyle(
                  fontSize: 9.5,
                  color: Colors.grey.shade500,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            DataCell(
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      item.productName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: _kFontSz,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      item.sku,
                      style: TextStyle(
                        fontSize: 8.5,
                        color: Colors.grey.shade500,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            DataCell(_numCell('${item.openingStock}', isDark)),
            DataCell(
              _numCell(
                item.adds != 0 ? '+${item.adds}' : '0',
                isDark,
                color: item.adds > 0 ? Colors.green.shade700 : null,
              ),
            ),
            DataCell(_numCell('${item.total}', isDark, bold: true)),
            DataCell(
              _numCell(
                item.sales > 0 ? '-${item.sales}' : '${item.sales}',
                isDark,
                color: item.sales > 0 ? Colors.red.shade700 : null,
              ),
            ),
            DataCell(_numCell('${item.closingStock}', isDark, bold: true)),
            DataCell(
              _numCell(
                item.physicalCount?.toString() ?? '',
                isDark,
                bold: true,
              ),
            ),
            DataCell(
              VarianceBadge(variance: variance, hasCount: hasCount),
            ),
            DataCell(
              EditableTextCell(
                value: item.explanation ?? '',
                readOnly: widget.isReadOnly || !hasVariance,
                onChanged: (value) {
                  widget.onExplanationChanged?.call(item.id, value);
                },
              ),
            ),
            DataCell(
              _ReasonDropdown(
                value: hasVariance && actionsList.contains(item.actionTaken)
                    ? item.actionTaken
                    : null,
                items: actionsList,
                enabled: !widget.isReadOnly && hasVariance,
                onChanged: (value) {
                  if (value != null) {
                    widget.onActionTakenChanged?.call(item.id, value);
                  }
                },
              ),
            ),
          ],
        ),
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(6),
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(color: _kGridLine),
          borderRadius: BorderRadius.circular(6),
          color: isDark ? const Color(0xFF111111) : Colors.white,
        ),
        child: DataTable2(
          columnSpacing: 8,
          horizontalMargin: 8,
          minWidth: 1050,
          dataRowHeight: _kRowH,
          headingRowHeight: 32,
          fixedTopRows: 1,
          fixedLeftColumns: 2,
          headingRowColor: WidgetStateProperty.all(_kHeaderBg),
          headingTextStyle: const TextStyle(
            color: _kHeaderText,
            fontWeight: FontWeight.w700,
            fontSize: _kHdrFontSz,
            letterSpacing: 0.3,
          ),
          border: const TableBorder(
            horizontalInside: BorderSide(color: _kGridLine, width: 0.5),
            verticalInside: BorderSide(color: _kGridLine, width: 0.5),
            top: BorderSide(color: _kGridLine, width: 0.5),
            bottom: BorderSide(color: _kGridLine, width: 0.5),
          ),
          columns: const [
            DataColumn2(
              label: Text('#'),
              size: ColumnSize.S,
              fixedWidth: 32,
              numeric: true,
            ),
            DataColumn2(label: Text('Product'), size: ColumnSize.L),
            DataColumn2(
              label: Text('Opening'),
              size: ColumnSize.S,
              fixedWidth: 70,
              numeric: true,
            ),
            DataColumn2(
              label: Text('Adds'),
              size: ColumnSize.S,
              fixedWidth: 60,
              numeric: true,
            ),
            DataColumn2(
              label: Text('Total'),
              size: ColumnSize.S,
              fixedWidth: 70,
              numeric: true,
            ),
            DataColumn2(
              label: Text('Sales'),
              size: ColumnSize.S,
              fixedWidth: 60,
              numeric: true,
            ),
            DataColumn2(
              label: Text('Closing'),
              size: ColumnSize.S,
              fixedWidth: 70,
              numeric: true,
            ),
            DataColumn2(
              label: Text('Count'),
              size: ColumnSize.M,
              fixedWidth: 70,
              numeric: true,
            ),
            DataColumn2(
              label: Text('Var'),
              size: ColumnSize.S,
              fixedWidth: 60,
              numeric: true,
            ),
            DataColumn2(label: Text('Explanation'), size: ColumnSize.L),
            DataColumn2(label: Text('Action Taken'), size: ColumnSize.L),
          ],
          rows: rows,
        ),
      ),
    );
  }

  Widget _numCell(String text, bool isDark, {Color? color, bool bold = false}) {
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

class _BlindHeaderCell extends StatelessWidget {
  final String label;
  final int flex;
  final bool alignEnd;

  const _BlindHeaderCell(
    this.label, {
    required this.flex,
    this.alignEnd = false,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      flex: flex,
      child: Align(
        alignment: alignEnd ? Alignment.centerRight : Alignment.centerLeft,
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: Color(0xFF64748B),
          ),
        ),
      ),
    );
  }
}

class _BlindBodyCell extends StatelessWidget {
  final String value;
  final int flex;

  const _BlindBodyCell(this.value, {required this.flex});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      flex: flex,
      child: Text(
        value,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: Color(0xFF334155),
        ),
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  final String label;

  const _CategoryChip({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: Color(0xFF475569),
        ),
      ),
    );
  }
}

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
        style: TextStyle(fontSize: 10, color: Colors.grey.shade400),
      );
    }
    return DropdownButtonHideUnderline(
      child: DropdownButton<String>(
        value: value,
        hint: Text(
          'Select...',
          style: TextStyle(fontSize: 10, color: Colors.grey.shade400),
        ),
        style: TextStyle(
          fontSize: 10,
          color: isDark ? Colors.grey.shade200 : Colors.grey.shade800,
        ),
        isDense: true,
        iconSize: 14,
        items: items
            .map(
              (item) => DropdownMenuItem(
                value: item,
                child: Text(item, style: const TextStyle(fontSize: 10)),
              ),
            )
            .toList(),
        onChanged: onChanged,
      ),
    );
  }
}

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
    this.hintText = 'Explain...',
  });

  @override
  State<EditableTextCell> createState() => _EditableTextCellState();
}

class _EditableTextCellState extends State<EditableTextCell> {
  // Constructed at declaration (not `late` + initState) so a hot reload —
  // which does not re-run initState — can never hit a LateInitializationError.
  final TextEditingController _controller = TextEditingController();

  @override
  void initState() {
    super.initState();
    _controller.text = widget.value;
  }

  @override
  void didUpdateWidget(covariant EditableTextCell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value && _controller.text != widget.value) {
      _controller.text = widget.value;
      _controller.selection = TextSelection.collapsed(
        offset: widget.value.length,
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
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
        controller: _controller,
        style: const TextStyle(fontSize: 10),
        onChanged: widget.onChanged,
        decoration: InputDecoration(
          isDense: true,
          hintText: widget.hintText,
          hintStyle: TextStyle(fontSize: 9, color: Colors.grey.shade400),
          contentPadding: const EdgeInsets.symmetric(
            vertical: 4,
            horizontal: 4,
          ),
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
  final explicit =
      '${row['staff_name'] ?? row['full_name'] ?? row['name'] ?? ''}'.trim();
  if (explicit.isNotEmpty && explicit.toLowerCase() != 'null') return explicit;
  final first = '${row['first_name'] ?? row['firstName'] ?? ''}'.trim();
  final last = '${row['last_name'] ?? row['lastName'] ?? ''}'.trim();
  return '$first $last'.trim();
}

typedef ValueChanged2<T1, T2> = void Function(T1 value1, T2 value2);
