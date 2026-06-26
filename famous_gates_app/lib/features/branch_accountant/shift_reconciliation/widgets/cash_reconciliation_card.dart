import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/widgets/kes_text.dart';
import '../models/shift_reconciliation_model.dart';
import '../models/reconciliation_payment_summary.dart';

class CashReconciliationCard extends StatefulWidget {
  final ShiftReconciliationModel shift;
  final double actualCash;
  final ValueChanged<double> onActualCashChanged;

  const CashReconciliationCard({
    super.key,
    required this.shift,
    required this.actualCash,
    required this.onActualCashChanged,
  });

  @override
  State<CashReconciliationCard> createState() => _CashReconciliationCardState();
}

class _CashReconciliationCardState extends State<CashReconciliationCard> {
  late TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(
      text: widget.actualCash == 0 ? '' : widget.actualCash.toStringAsFixed(2),
    );
  }

  @override
  void didUpdateWidget(covariant CashReconciliationCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.actualCash != widget.actualCash) {
      final newText = widget.actualCash == 0 ? '' : widget.actualCash.toStringAsFixed(2);
      if (_controller.text != newText && _controller.text != '${widget.actualCash}') {
        _controller.text = newText;
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final double cashSales = widget.shift.paymentBreakdown
        .firstWhere((p) => p.method.toLowerCase() == 'cash', orElse: () => ReconciliationPaymentSummary(method: 'cash', amount: 0, count: 0))
        .amount;

    // Expected cash: float + cash sales
    final double expectedCash = widget.shift.openingFloat + cashSales;
    final double variance = widget.actualCash - expectedCash;
    final double variancePercent = expectedCash > 0 ? (variance / expectedCash) * 100 : 0.0;

    Color badgeBgColor;
    Color badgeTextColor;
    String statusLabel;

    if (variance == 0) {
      badgeBgColor = const Color(0xFFDCFCE7);
      badgeTextColor = const Color(0xFF15803D);
      statusLabel = 'Balanced';
    } else if (variance.abs() <= 500) {
      badgeBgColor = const Color(0xFFFEF3C7);
      badgeTextColor = const Color(0xFFB45309);
      statusLabel = 'Minor Variance';
    } else {
      badgeBgColor = const Color(0xFFFEE2E2);
      badgeTextColor = const Color(0xFFB91C1C);
      statusLabel = 'Major Variance';
    }

    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Cash Drawer Reconciliation',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 16),
            _ReconRow(
              label: 'Opening Float',
              amount: widget.shift.openingFloat,
            ),
            const SizedBox(height: 8),
            _ReconRow(
              label: '+ Cash Sales (System)',
              amount: cashSales,
            ),
            const SizedBox(height: 8),
            const _ReconRow(
              label: '− Cash Paid Out (System)',
              amount: 0.0,
            ),
            const SizedBox(height: 8),
            const _ReconRow(
              label: '+ Cash Received (System)',
              amount: 0.0,
            ),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Divider(),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  '= Expected Cash',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF1E293B)),
                ),
                Text(
                  formatKes(expectedCash),
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF1E293B)),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  flex: 3,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Actual Cash Counted',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
                      ),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _controller,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
                        ],
                        decoration: InputDecoration(
                          hintText: 'Enter counted cash',
                          prefixText: 'KES ',
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: BorderSide(color: Colors.grey.shade300),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(color: Colors.blue, width: 1.5),
                          ),
                        ),
                        onChanged: (val) {
                          final parsed = double.tryParse(val) ?? 0.0;
                          widget.onActualCashChanged(parsed);
                        },
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  flex: 2,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        'Variance Status',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                        decoration: BoxDecoration(
                          color: badgeBgColor,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: badgeTextColor.withOpacity(0.3)),
                        ),
                        child: Column(
                          children: [
                            Text(
                              statusLabel,
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: badgeTextColor),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${variancePercent > 0 ? "+" : ""}${variancePercent.toStringAsFixed(1)}%',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: badgeTextColor),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (variance != 0) ...[
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Net Cash Variance:',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
                  ),
                  Text(
                    variance > 0 ? '+${formatKes(variance)}' : formatKes(variance),
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: variance > 0 ? Colors.green.shade700 : Colors.red.shade700,
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ReconRow extends StatelessWidget {
  final String label;
  final double amount;

  const _ReconRow({
    required this.label,
    required this.amount,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 14, color: Color(0xFF475569)),
        ),
        Text(
          formatKes(amount),
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF1E293B)),
        ),
      ],
    );
  }
}
