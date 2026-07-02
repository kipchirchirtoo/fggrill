import 'package:flutter/material.dart';
// hide TextDirection: intl exports its own, which would shadow dart:ui's and
// break the ShapeBorder overrides below (getInnerPath/getOuterPath/paint).
import 'package:intl/intl.dart' hide TextDirection;

import '../../../lina_daily_controls/domain/lina_daily_controls_provider.dart';
import 'daily_control_empty_state.dart';

final _qty = NumberFormat('#,##0.###', 'en_KE');
String _fmtQty(num v) => _qty.format(v);

class ParentYieldSplitsTab extends StatelessWidget {
  const ParentYieldSplitsTab({super.key, required this.items});

  final List<ParentChildSalesItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const DailyControlEmptyState(
        message: 'No parent-child recipes or yield rules active for this branch.',
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final parent = items[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          elevation: 1,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey.shade200),
          ),
          child: ExpansionTile(
            shape: const BorderRounded(),
            collapsedShape: const BorderRounded(),
            title: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        parent.parentName,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF1565C0),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'SKU: ${parent.parentSku}',
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.grey.shade600,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.blue.shade100),
                  ),
                  child: Text(
                    'Total Consumed: ${_fmtQty(parent.totalRawSold)}',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: Colors.blue.shade800,
                    ),
                  ),
                ),
              ],
            ),
            children: [
              if (parent.children.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(16.0),
                  child: Text(
                    'No child menu items mapped.',
                    style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic),
                  ),
                )
              else
                Padding(
                  padding: const EdgeInsets.only(left: 12.0, right: 12.0, bottom: 12.0),
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.grey.shade200),
                    ),
                    child: Table(
                      columnWidths: const {
                        0: FlexColumnWidth(2.5),
                        1: FlexColumnWidth(1.2),
                        2: FlexColumnWidth(1.5),
                      },
                      children: [
                        TableRow(
                          decoration: BoxDecoration(
                            border: Border(bottom: BorderSide(color: Colors.grey.shade300)),
                          ),
                          children: const [
                            Padding(
                              padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              child: Text(
                                'Child Menu Item',
                                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11),
                              ),
                            ),
                            Padding(
                              padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              child: Text(
                                'POS Sold',
                                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11),
                              ),
                            ),
                            Padding(
                              padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              child: Text(
                                'Raw Consumed',
                                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11),
                              ),
                            ),
                          ],
                        ),
                        ...parent.children.map((child) {
                          return TableRow(
                            decoration: BoxDecoration(
                              border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
                            ),
                            children: [
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                child: Text(
                                  child.childName,
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                child: Text(
                                  '${_fmtQty(child.soldQty)} ${child.unit}',
                                  style: const TextStyle(fontSize: 12),
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                child: Text(
                                  '${_fmtQty(child.rawQtyUsed)} ${child.rawUnit}',
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ],
                          );
                        }),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class BorderRounded extends ShapeBorder {
  const BorderRounded();

  @override
  EdgeInsetsGeometry get dimensions => EdgeInsets.zero;

  @override
  Path getInnerPath(Rect rect, {TextDirection? textDirection}) => Path();

  @override
  Path getOuterPath(Rect rect, {TextDirection? textDirection}) {
    return Path()
      ..addRRect(RRect.fromRectAndRadius(rect, const Radius.circular(12)));
  }

  @override
  void paint(Canvas canvas, Rect rect, {TextDirection? textDirection}) {}

  @override
  ShapeBorder scale(double t) => this;
}
