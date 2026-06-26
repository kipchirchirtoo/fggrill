import 'package:flutter/material.dart';

class SummaryCard extends StatelessWidget {
  final int totalOpening;
  final int totalSales;
  final int totalSdds;
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
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: isDark ? theme.colorScheme.surface : Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: LayoutBuilder(
          builder: (context, constraints) {
            // Adjust card layout based on available width
            final width = constraints.maxWidth;
            final crossAxisCount = width > 900 ? 6 : (width > 600 ? 3 : 2);

            if (crossAxisCount == 6) {
              return Row(
                children: [
                  Expanded(
                    child: _SummaryTile(
                      title: 'Total Opening',
                      value: totalOpening.toString(),
                      icon: Icons.inventory_2_outlined,
                      color: Colors.blue.shade700,
                    ),
                  ),
                  _buildDivider(),
                  Expanded(
                    child: _SummaryTile(
                      title: 'Total Sales',
                      value: totalSales.toString(),
                      icon: Icons.trending_down,
                      color: Colors.green.shade700,
                    ),
                  ),
                  _buildDivider(),
                  Expanded(
                    child: _SummaryTile(
                      title: 'Total SDDS',
                      value: totalSdds.toString(),
                      icon: Icons.swap_horiz,
                      color: Colors.purple.shade700,
                    ),
                  ),
                  _buildDivider(),
                  Expanded(
                    child: _SummaryTile(
                      title: 'Expected Closing',
                      value: expectedClosing.toString(),
                      icon: Icons.calculate_outlined,
                      color: Colors.indigo.shade700,
                    ),
                  ),
                  _buildDivider(),
                  Expanded(
                    child: _SummaryTile(
                      title: 'Physical Count',
                      value: physicalCount.toString(),
                      icon: Icons.check_circle_outline,
                      color: Colors.teal.shade700,
                    ),
                  ),
                  _buildDivider(),
                  Expanded(
                    child: _SummaryTile(
                      title: 'Total Variance',
                      value: totalVariance >= 0 ? '+$totalVariance' : '$totalVariance',
                      icon: Icons.warning_amber_rounded,
                      color: totalVariance == 0
                          ? Colors.green.shade700
                          : (totalVariance > 0 ? Colors.orange.shade800 : Colors.red.shade700),
                    ),
                  ),
                ],
              );
            } else if (crossAxisCount == 3) {
              return Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: _SummaryTile(
                          title: 'Total Opening',
                          value: totalOpening.toString(),
                          icon: Icons.inventory_2_outlined,
                          color: Colors.blue.shade700,
                        ),
                      ),
                      Expanded(
                        child: _SummaryTile(
                          title: 'Total Sales',
                          value: totalSales.toString(),
                          icon: Icons.trending_down,
                          color: Colors.green.shade700,
                        ),
                      ),
                      Expanded(
                        child: _SummaryTile(
                          title: 'Total SDDS',
                          value: totalSdds.toString(),
                          icon: Icons.swap_horiz,
                          color: Colors.purple.shade700,
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 24),
                  Row(
                    children: [
                      Expanded(
                        child: _SummaryTile(
                          title: 'Expected Closing',
                          value: expectedClosing.toString(),
                          icon: Icons.calculate_outlined,
                          color: Colors.indigo.shade700,
                        ),
                      ),
                      Expanded(
                        child: _SummaryTile(
                          title: 'Physical Count',
                          value: physicalCount.toString(),
                          icon: Icons.check_circle_outline,
                          color: Colors.teal.shade700,
                        ),
                      ),
                      Expanded(
                        child: _SummaryTile(
                          title: 'Total Variance',
                          value: totalVariance >= 0 ? '+$totalVariance' : '$totalVariance',
                          icon: Icons.warning_amber_rounded,
                          color: totalVariance == 0
                              ? Colors.green.shade700
                              : (totalVariance > 0 ? Colors.orange.shade800 : Colors.red.shade700),
                        ),
                      ),
                    ],
                  ),
                ],
              );
            } else {
              // 2 Column Grid
              return Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: _SummaryTile(
                          title: 'Total Opening',
                          value: totalOpening.toString(),
                          icon: Icons.inventory_2_outlined,
                          color: Colors.blue.shade700,
                        ),
                      ),
                      Expanded(
                        child: _SummaryTile(
                          title: 'Total Sales',
                          value: totalSales.toString(),
                          icon: Icons.trending_down,
                          color: Colors.green.shade700,
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _SummaryTile(
                          title: 'Total SDDS',
                          value: totalSdds.toString(),
                          icon: Icons.swap_horiz,
                          color: Colors.purple.shade700,
                        ),
                      ),
                      Expanded(
                        child: _SummaryTile(
                          title: 'Expected Closing',
                          value: expectedClosing.toString(),
                          icon: Icons.calculate_outlined,
                          color: Colors.indigo.shade700,
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _SummaryTile(
                          title: 'Physical Count',
                          value: physicalCount.toString(),
                          icon: Icons.check_circle_outline,
                          color: Colors.teal.shade700,
                        ),
                      ),
                      Expanded(
                        child: _SummaryTile(
                          title: 'Total Variance',
                          value: totalVariance >= 0 ? '+$totalVariance' : '$totalVariance',
                          icon: Icons.warning_amber_rounded,
                          color: totalVariance == 0
                              ? Colors.green.shade700
                              : (totalVariance > 0 ? Colors.orange.shade800 : Colors.red.shade700),
                        ),
                      ),
                    ],
                  ),
                ],
              );
            }
          },
        ),
      ),
    );
  }

  Widget _buildDivider() {
    return Container(
      height: 40,
      width: 1,
      color: Colors.grey.shade300,
      margin: const EdgeInsets.symmetric(horizontal: 12),
    );
  }
}

class _SummaryTile extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;

  const _SummaryTile({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: color, size: 24),
        ),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              title,
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey.shade600,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              value,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
