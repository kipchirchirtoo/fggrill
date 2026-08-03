import 'dart:ui';

import 'package:flutter/material.dart';

class SummaryCard extends StatelessWidget {
  final int totalOpening;
  final int totalSales;
  final int totalSdds;
  final int expectedClosing;
  final int physicalCount;
  final int totalVariance;
  final bool isStorekeeper;
  final int? totalItems;
  final int? countedLines;

  const SummaryCard({
    super.key,
    required this.totalOpening,
    required this.totalSales,
    required this.totalSdds,
    required this.expectedClosing,
    required this.physicalCount,
    required this.totalVariance,
    this.isStorekeeper = false,
    this.totalItems,
    this.countedLines,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final totalLineCount = totalItems ?? 0;
    final countedLineCount = countedLines ?? 0;
    final remainingLines = totalLineCount - countedLineCount < 0
        ? 0
        : totalLineCount - countedLineCount;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      padding: const EdgeInsets.all(16),
      child: isStorekeeper
          ? Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                _StorekeeperStatCard(
                  label: 'Total Lines',
                  value: '$totalLineCount',
                  tone: const Color(0xFFF8FAFC),
                  valueColor: const Color(0xFF0F172A),
                ),
                _StorekeeperStatCard(
                  label: 'Counted Lines',
                  value: '$countedLineCount',
                  tone: const Color(0xFFECFDF5),
                  valueColor: const Color(0xFF166534),
                ),
                _StorekeeperStatCard(
                  label: 'Remaining',
                  value: '$remainingLines',
                  tone: const Color(0xFFFFF7ED),
                  valueColor: const Color(0xFF9A3412),
                ),
                _StorekeeperStatCard(
                  label: 'Entered Total',
                  value: '$physicalCount',
                  tone: const Color(0xFFEFF6FF),
                  valueColor: theme.colorScheme.primary,
                ),
              ],
            )
          : Row(
              children: [
                _LegacyStat(
                  'Opening',
                  '$totalOpening',
                  const Color(0xFF64748B),
                  const Color(0xFF0F172A),
                ),
                _divider(),
                _LegacyStat(
                  'Adds',
                  '+${-totalSdds}',
                  const Color(0xFF64748B),
                  (-totalSdds) > 0
                      ? const Color(0xFF166534)
                      : const Color(0xFF0F172A),
                ),
                _divider(),
                _LegacyStat(
                  'Total',
                  '${totalOpening - totalSdds}',
                  const Color(0xFF64748B),
                  const Color(0xFF0F172A),
                  bold: true,
                ),
                _divider(),
                _LegacyStat(
                  'Sales',
                  '-$totalSales',
                  const Color(0xFF64748B),
                  totalSales > 0
                      ? const Color(0xFFB91C1C)
                      : const Color(0xFF0F172A),
                ),
                _divider(),
                _LegacyStat(
                  'Closing',
                  '$expectedClosing',
                  const Color(0xFF64748B),
                  const Color(0xFF0F172A),
                  bold: true,
                ),
                _divider(),
                _LegacyStat(
                  'Counted',
                  '$physicalCount',
                  const Color(0xFF64748B),
                  theme.colorScheme.primary,
                ),
                _divider(),
                _LegacyStat(
                  'Variance',
                  totalVariance >= 0 ? '+$totalVariance' : '$totalVariance',
                  const Color(0xFF64748B),
                  totalVariance == 0
                      ? const Color(0xFF0F172A)
                      : (totalVariance > 0
                          ? const Color(0xFF166534)
                          : const Color(0xFFB91C1C)),
                  bold: true,
                ),
              ],
            ),
    );
  }

  Widget _divider() => Container(
        width: 1,
        height: 34,
        color: const Color(0xFFE2E8F0),
      );
}

class _StorekeeperStatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color tone;
  final Color valueColor;

  const _StorekeeperStatCard({
    required this.label,
    required this.value,
    required this.tone,
    required this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 180,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: tone,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: valueColor,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

class _LegacyStat extends StatelessWidget {
  final String label;
  final String value;
  final Color labelColor;
  final Color valueColor;
  final bool bold;

  const _LegacyStat(
    this.label,
    this.value,
    this.labelColor,
    this.valueColor, {
    this.bold = false,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              color: labelColor,
              letterSpacing: 0.3,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
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
