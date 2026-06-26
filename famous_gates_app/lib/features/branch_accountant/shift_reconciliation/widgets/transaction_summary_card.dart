import 'package:flutter/material.dart';
import '../models/shift_reconciliation_model.dart';

class TransactionSummaryCard extends StatelessWidget {
  final ShiftReconciliationModel shift;
  final VoidCallback onViewAll;
  final VoidCallback onExport;

  const TransactionSummaryCard({
    super.key,
    required this.shift,
    required this.onViewAll,
    required this.onExport,
  });

  @override
  Widget build(BuildContext context) {
    final int totalCount = shift.lines.length;
    // Count based on lines status / sections
    final int successCount = shift.lines.where((l) {
      final status = (l['status'] ?? '').toString().toLowerCase();
      return status != 'voided' && status != 'cancelled' && status != 'refunded';
    }).length;
    
    final int voidedCount = shift.lines.where((l) => (l['status'] ?? '').toString().toLowerCase() == 'voided').length;
    final int cancelledCount = shift.lines.where((l) => (l['status'] ?? '').toString().toLowerCase() == 'cancelled').length;
    final int refundedCount = shift.lines.where((l) => (l['status'] ?? '').toString().toLowerCase() == 'refunded').length;

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
              'Transaction Summary',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _StatItem(label: 'Total', count: totalCount, color: const Color(0xFF1E293B)),
                _StatItem(label: 'Successful', count: successCount, color: Colors.green),
                _StatItem(label: 'Voided', count: voidedCount, color: Colors.red),
                _StatItem(label: 'Cancelled', count: cancelledCount, color: Colors.orange),
                _StatItem(label: 'Refunded', count: refundedCount, color: Colors.purple),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onViewAll,
                    icon: const Icon(Icons.list_alt_rounded),
                    label: const Text('View All Transactions'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onExport,
                    icon: const Icon(Icons.download_rounded),
                    label: const Text('Export Transactions'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  final String label;
  final int count;
  final Color color;

  const _StatItem({
    required this.label,
    required this.count,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          '$count',
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w600),
        ),
      ],
    );
  }
}
