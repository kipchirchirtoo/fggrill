import 'package:flutter/material.dart';

// Excel-style summary footer — single compact row of labelled totals.
class SummaryCard extends StatelessWidget {
  final int totalOpening;
  final int totalSales;
  final int totalSdds;   // "Adds" (kept as totalSdds internally for compatibility)
  final int expectedClosing;
  final int physicalCount;
  final int totalVariance;

  const SummaryCard({
    super.key,
    required this.totalOpening,
    required this.totalSales,
    required this.totalSdds,
    required this.expectedClosing,
    required this.physicalCount,
    required this.totalVariance,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? const Color(0xFF1A2B1F) : const Color(0xFF217346);

    final varColor = totalVariance == 0
        ? Colors.white
        : (totalVariance > 0 ? const Color(0xFFFFF176) : const Color(0xFFFF8A80));
    final varText  = totalVariance >= 0 ? '+$totalVariance' : '$totalVariance';

    return Container(
      height: 40,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        children: [
          _Stat('Opening',  '$totalOpening',  Colors.white70, Colors.white),
          _divider(),
          _Stat('Sales',    '-$totalSales',   Colors.white70,
              totalSales > 0 ? const Color(0xFFFFCDD2) : Colors.white),
          _divider(),
          _Stat('Adds',     '+$totalSdds',    Colors.white70,
              totalSdds > 0 ? const Color(0xFFC8E6C9) : Colors.white),
          _divider(),
          _Stat('Closing',  '$expectedClosing', Colors.white70, Colors.white),
          _divider(),
          _Stat('Counted',  '$physicalCount', Colors.white70,
              const Color(0xFFB3E5FC)),
          _divider(),
          _Stat('Variance', varText, Colors.white70, varColor,
              bold: true),
        ],
      ),
    );
  }

  Widget _divider() => Container(
        width: 1,
        height: 24,
        color: Colors.white24,
        margin: const EdgeInsets.symmetric(horizontal: 4),
      );
}

class _Stat extends StatelessWidget {
  final String label;
  final String value;
  final Color labelColor;
  final Color valueColor;
  final bool bold;

  const _Stat(this.label, this.value, this.labelColor, this.valueColor,
      {this.bold = false});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            label,
            style: TextStyle(
                fontSize: 8.5,
                color: labelColor,
                letterSpacing: 0.3,
                fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 1),
          Text(
            value,
            style: TextStyle(
              fontSize: 12,
              color: valueColor,
              fontWeight: bold ? FontWeight.w800 : FontWeight.w700,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}
