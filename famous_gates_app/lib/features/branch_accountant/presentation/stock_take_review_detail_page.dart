import 'package:flutter/material.dart';
import '../../branch_storekeeper/stock_take/models/stock_take_item.dart';
import '../../branch_storekeeper/stock_take/providers/stock_take_provider.dart';
import '../../branch_storekeeper/stock_take/widgets/stock_table.dart';
import '../../branch_storekeeper/stock_take/widgets/summary_card.dart';

class StockTakeReviewDetailPage extends StatefulWidget {
  final StockTakeType stockTakeType;
  final String title;
  final String subtitle;
  final List<StockTakeItem> items;
  final List<String> ids;
  final Future<void> Function(String? notes) onApprove;
  final Future<void> Function(String notes) onReject;
  final Future<void> Function(String? notes) onReview;

  const StockTakeReviewDetailPage({
    super.key,
    required this.stockTakeType,
    required this.title,
    required this.subtitle,
    required this.items,
    required this.ids,
    required this.onApprove,
    required this.onReject,
    required this.onReview,
  });

  @override
  State<StockTakeReviewDetailPage> createState() => _StockTakeReviewDetailPageState();
}

class _StockTakeReviewDetailPageState extends State<StockTakeReviewDetailPage> {
  bool _isBusy = false;

  Future<void> _handleAction(Future<void> Function() action, String successMsg) async {
    setState(() => _isBusy = true);
    try {
      await action();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(successMsg), backgroundColor: Colors.green),
        );
        Navigator.pop(context, true); // Pop back returning true to refresh parent
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Action failed: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isBusy = false);
      }
    }
  }

  Future<String?> _askNotes(String title, String labelText, {bool required = false}) async {
    final ctrl = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: ctrl,
          minLines: 2,
          maxLines: 4,
          autofocus: true,
          decoration: InputDecoration(
            labelText: labelText,
            border: const OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              final text = ctrl.text.trim();
              if (required && text.isEmpty) return;
              Navigator.pop(ctx, text);
            },
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    // Summary calculations
    int totalOpening = 0;
    int totalSales = 0;
    int totalSdds = 0;
    int physicalCount = 0;
    int totalVariance = 0;

    for (final item in widget.items) {
      totalOpening += item.openingStock;
      totalSales += item.sales;
      totalSdds += item.sdds;
      if (item.physicalCount != null) {
        physicalCount += item.physicalCount!;
        totalVariance += item.variance;
      }
    }
    int expectedClosing = totalOpening - totalSales - totalSdds;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : const Color(0xFFF5F7FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1565C0), // Material 3 blue AppBar style
        foregroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.title,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
            Text(
              widget.subtitle,
              style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 12),
            ),
          ],
        ),
      ),
      body: Stack(
        children: [
          Column(
            children: [
              // Main Excel Sheet Area
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: StockTable(
                    items: widget.items,
                    isReadOnly: true,
                    onPhysicalCountChanged: (_, __) {},
                    onReasonChanged: (_, __) {},
                  ),
                ),
              ),

              // Summary card
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                child: SummaryCard(
                  totalOpening: totalOpening,
                  totalSales: totalSales,
                  totalSdds: totalSdds,
                  expectedClosing: expectedClosing,
                  physicalCount: physicalCount,
                  totalVariance: totalVariance,
                ),
              ),

              // Actions bar
              SafeArea(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.05),
                        blurRadius: 10,
                        offset: const Offset(0, -4),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _isBusy
                              ? null
                              : () async {
                                  final reason = await _askNotes(
                                    'Reject Stock Take',
                                    'Reason for rejection (required)',
                                    required: true,
                                  );
                                  if (reason == null || reason.isEmpty) return;
                                  await _handleAction(
                                    () => widget.onReject(reason),
                                    'Stock take rejected.',
                                  );
                                },
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Color(0xFFD32F2F)),
                            foregroundColor: const Color(0xFFD32F2F),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                          icon: const Icon(Icons.close),
                          label: const Text(
                            'Reject',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _isBusy
                              ? null
                              : () async {
                                  final notes = await _askNotes(
                                    'Review Stock Take',
                                    'Review notes (optional)',
                                    required: false,
                                  );
                                  if (notes == null) return;
                                  await _handleAction(
                                    () => widget.onReview(notes),
                                    'Stock take marked as reviewed.',
                                  );
                                },
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                          icon: const Icon(Icons.rate_review_outlined),
                          label: const Text(
                            'Review',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: _isBusy
                              ? null
                              : () async {
                                  final notes = await _askNotes(
                                    'Approve Stock Take',
                                    'Approval notes (optional)',
                                    required: false,
                                  );
                                  if (notes == null) return;
                                  await _handleAction(
                                    () => widget.onApprove(notes),
                                    'Stock take approved and inventory updated.',
                                  );
                                },
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF1565C0),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                          icon: const Icon(Icons.check_circle_outline),
                          label: const Text(
                            'Approve',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (_isBusy)
            Container(
              color: Colors.black.withOpacity(0.2),
              child: const Center(
                child: CircularProgressIndicator(),
              ),
            ),
        ],
      ),
    );
  }
}
