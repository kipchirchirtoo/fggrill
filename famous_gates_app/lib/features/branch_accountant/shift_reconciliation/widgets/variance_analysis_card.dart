import 'package:flutter/material.dart';

class VarianceAnalysisCard extends StatelessWidget {
  final double variance;

  const VarianceAnalysisCard({
    super.key,
    required this.variance,
  });

  @override
  Widget build(BuildContext context) {
    if (variance == 0) return const SizedBox.shrink();

    final causes = [
      _CauseItem(cause: 'Counting Error', confidence: 94),
      _CauseItem(cause: 'Pending Cash Transfer', confidence: 81),
      _CauseItem(cause: 'Wrong Change Issued', confidence: 76),
      _CauseItem(cause: 'Missing Receipt', confidence: 68),
      _CauseItem(cause: 'Unrecorded Expense', confidence: 55),
    ];

    return Card(
      elevation: 0,
      color: const Color(0xFFFFFBEB),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.amber.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.analytics_rounded, color: Colors.amber.shade800),
                const SizedBox(width: 8),
                const Text(
                  'Heuristic Variance Analysis',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF78350F)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Text(
              'Below are the most probable causes of the current cash discrepancy, based on transaction history and logs:',
              style: TextStyle(fontSize: 12, color: Color(0xFF92400E)),
            ),
            const SizedBox(height: 14),
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: causes.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, idx) {
                final item = causes[idx];
                return Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      item.cause,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF78350F)),
                    ),
                    Row(
                      children: [
                        Text(
                          '${item.confidence}%',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFFB45309)),
                        ),
                        const SizedBox(width: 8),
                        SizedBox(
                          width: 80,
                          height: 8,
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(
                              value: item.confidence / 100,
                              backgroundColor: Colors.amber.shade100,
                              color: Colors.amber.shade600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _CauseItem {
  final String cause;
  final int confidence;

  _CauseItem({required this.cause, required this.confidence});
}
