import 'dart:math' as math;
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/models/admin_dashboard.dart';
import '../../data/models/ai_analytics.dart';

class AdminBarChart extends StatelessWidget {
  final List<RevenueDataPoint> data;
  final double height;

  const AdminBarChart({
    super.key,
    required this.data,
    this.height = 200,
  });

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) {
      return SizedBox(
        height: height,
        child: const Center(
            child: Text('No data',
                style: TextStyle(color: AppColors.kTextSecondary))),
      );
    }
    final maxY = data.map((d) => d.revenue).reduce((a, b) => a > b ? a : b);
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: SizedBox(
          height: height,
          child: BarChart(
            BarChartData(
              maxY: maxY * 1.2,
              barTouchData: BarTouchData(
                touchTooltipData: BarTouchTooltipData(
                  getTooltipItem: (group, groupIndex, rod, rodIndex) =>
                      BarTooltipItem(
                    '${data[groupIndex].label}\n\$${rod.toY.toStringAsFixed(0)}',
                    const TextStyle(color: Colors.white, fontSize: 12),
                  ),
                ),
              ),
              titlesData: FlTitlesData(
                show: true,
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    getTitlesWidget: (value, meta) {
                      final i = value.toInt();
                      if (i < 0 || i >= data.length) {
                        return const SizedBox.shrink();
                      }
                      return Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(data[i].label,
                            style: const TextStyle(
                                fontSize: 10, color: AppColors.kTextSecondary)),
                      );
                    },
                    reservedSize: 24,
                  ),
                ),
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 48,
                    getTitlesWidget: (value, meta) => Text('\$${value.toInt()}',
                        style: const TextStyle(
                            fontSize: 10, color: AppColors.kTextSecondary)),
                  ),
                ),
                topTitles:
                    const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles:
                    const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              ),
              gridData: FlGridData(
                show: true,
                horizontalInterval: maxY / 4,
                drawVerticalLine: false,
                getDrawingHorizontalLine: (value) => FlLine(
                    color: AppColors.kDivider.withValues(alpha: 0.3),
                    strokeWidth: 1),
              ),
              borderData: FlBorderData(show: false),
              barGroups: data.asMap().entries.map((entry) {
                final i = entry.key;
                final point = entry.value;
                return BarChartGroupData(
                  x: i,
                  barRods: [
                    BarChartRodData(
                      toY: point.revenue,
                      color: AppColors.kPrimary,
                      width: math.min(
                          24,
                          (MediaQuery.of(context).size.width - 80) /
                              data.length *
                              0.6),
                      borderRadius: const BorderRadius.only(
                          topLeft: Radius.circular(4),
                          topRight: Radius.circular(4)),
                    ),
                  ],
                );
              }).toList(),
            ),
          ),
        ),
      ),
    );
  }
}

class AdminLineChart extends StatelessWidget {
  final List<ForecastPoint> data;
  final double height;

  const AdminLineChart({
    super.key,
    required this.data,
    this.height = 200,
  });

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) {
      return SizedBox(
        height: height,
        child: const Center(
            child: Text('No data',
                style: TextStyle(color: AppColors.kTextSecondary))),
      );
    }
    final allValues = [
      ...data.map((d) => d.value),
      ...data.map((d) => d.upperBound),
      ...data.map((d) => d.lowerBound)
    ];
    final minY = allValues.reduce((a, b) => a < b ? a : b);
    final maxY = allValues.reduce((a, b) => a > b ? a : b);
    final yRange = maxY - minY;
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: SizedBox(
          height: height,
          child: LineChart(
            LineChartData(
              minY: (minY - yRange * 0.1).clamp(0, double.infinity),
              maxY: maxY + yRange * 0.1,
              lineTouchData: LineTouchData(
                touchTooltipData: LineTouchTooltipData(
                  getTooltipItems: (spots) => spots.map((spot) {
                    final i = spot.x.toInt();
                    if (i < 0 || i >= data.length) return null;
                    return LineTooltipItem(
                      '${data[i].label}\n\$${data[i].value.toStringAsFixed(0)}',
                      const TextStyle(color: Colors.white, fontSize: 12),
                    );
                  }).toList(),
                ),
              ),
              titlesData: FlTitlesData(
                show: true,
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    getTitlesWidget: (value, meta) {
                      final i = value.toInt();
                      if (i < 0 || i >= data.length) {
                        return const SizedBox.shrink();
                      }
                      return Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(data[i].label,
                            style: const TextStyle(
                                fontSize: 10, color: AppColors.kTextSecondary)),
                      );
                    },
                    reservedSize: 24,
                  ),
                ),
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 48,
                    getTitlesWidget: (value, meta) => Text('\$${value.toInt()}',
                        style: const TextStyle(
                            fontSize: 10, color: AppColors.kTextSecondary)),
                  ),
                ),
                topTitles:
                    const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles:
                    const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              ),
              gridData: FlGridData(
                show: true,
                drawVerticalLine: false,
                getDrawingHorizontalLine: (value) => FlLine(
                    color: AppColors.kDivider.withValues(alpha: 0.3),
                    strokeWidth: 1),
              ),
              borderData: FlBorderData(show: false),
              lineBarsData: [
                LineChartBarData(
                  spots: data
                      .asMap()
                      .entries
                      .map((e) => FlSpot(e.key.toDouble(), e.value.upperBound))
                      .toList(),
                  isCurved: false,
                  color: AppColors.kPrimary.withValues(alpha: 0.15),
                  barWidth: 0,
                  dotData: const FlDotData(show: false),
                  belowBarData: BarAreaData(
                      show: true,
                      color: AppColors.kPrimary.withValues(alpha: 0.05)),
                ),
                LineChartBarData(
                  spots: data
                      .asMap()
                      .entries
                      .map((e) => FlSpot(e.key.toDouble(), e.value.lowerBound))
                      .toList(),
                  isCurved: false,
                  color: Colors.transparent,
                  barWidth: 0,
                  dotData: const FlDotData(show: false),
                  belowBarData: BarAreaData(
                      show: true,
                      color: AppColors.kPrimary.withValues(alpha: 0.08)),
                ),
                LineChartBarData(
                  spots: data
                      .asMap()
                      .entries
                      .map((e) => FlSpot(e.key.toDouble(), e.value.value))
                      .toList(),
                  isCurved: true,
                  color: AppColors.kPrimary,
                  barWidth: 2.5,
                  dotData: FlDotData(
                    show: true,
                    getDotPainter: (spot, percent, barData, index) =>
                        FlDotCirclePainter(
                      radius: 3,
                      color: AppColors.kPrimary,
                      strokeWidth: 2,
                      strokeColor: Colors.white,
                    ),
                  ),
                  belowBarData: BarAreaData(show: false),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class AdminPieChart extends StatelessWidget {
  final List<MapEntry<String, double>> data;
  final double height;

  const AdminPieChart({
    super.key,
    required this.data,
    this.height = 200,
  });

  static const _pieColors = [
    AppColors.kPrimary,
    AppColors.kAccent,
    Color(0xFF2E7D32),
    Color(0xFF6B21A8),
    Color(0xFFDC2626),
    Color(0xFF0891B2),
    Color(0xFFD97706),
    Color(0xFF4F46E5),
  ];

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) {
      return SizedBox(
        height: height,
        child: const Center(
            child: Text('No data',
                style: TextStyle(color: AppColors.kTextSecondary))),
      );
    }
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: SizedBox(
          height: height,
          child: Row(
            children: [
              Expanded(
                child: PieChart(
                  PieChartData(
                    sectionsSpace: 2,
                    centerSpaceRadius: 32,
                    sections: data.asMap().entries.map((entry) {
                      final i = entry.key;
                      final point = entry.value;
                      final total =
                          data.map((e) => e.value).reduce((a, b) => a + b);
                      final percentage =
                          total > 0 ? (point.value / total) * 100 : 0;
                      return PieChartSectionData(
                        value: point.value,
                        color: _pieColors[i % _pieColors.length],
                        radius: 36,
                        title: '${percentage.toStringAsFixed(0)}%',
                        titleStyle: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Colors.white),
                      );
                    }).toList(),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: data.asMap().entries.map((entry) {
                  final i = entry.key;
                  final point = entry.value;
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                            width: 10,
                            height: 10,
                            decoration: BoxDecoration(
                                color: _pieColors[i % _pieColors.length],
                                borderRadius: BorderRadius.circular(2))),
                        const SizedBox(width: 8),
                        Text(point.key,
                            style: const TextStyle(
                                fontSize: 12, color: AppColors.kTextSecondary)),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class AdminRadarChart extends StatelessWidget {
  final List<BranchComparison> data;
  final double height;

  const AdminRadarChart({
    super.key,
    required this.data,
    this.height = 250,
  });

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) {
      return SizedBox(
        height: height,
        child: const Center(
            child: Text('No data',
                style: TextStyle(color: AppColors.kTextSecondary))),
      );
    }
    final maxValues = [
      data.map((d) => d.revenue).reduce((a, b) => a > b ? a : b),
      data.map((d) => d.occupancy).reduce((a, b) => a > b ? a : b),
      data.map((d) => d.satisfaction).reduce((a, b) => a > b ? a : b),
    ];
    final globalMax = maxValues.reduce((a, b) => a > b ? a : b) * 1.2;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: SizedBox(
          height: height,
          child: RadarChart(
            RadarChartData(
              radarShape: RadarShape.polygon,
              tickCount: 4,
              tickBorderData:
                  BorderSide(color: AppColors.kDivider.withValues(alpha: 0.3)),
              gridBorderData:
                  BorderSide(color: AppColors.kDivider.withValues(alpha: 0.3)),
              titlePositionPercentageOffset: 0.15,
              titleTextStyle: const TextStyle(
                  fontSize: 11, color: AppColors.kTextSecondary),
              getTitle: (index, angle) {
                const categories = ['Revenue', 'Occupancy', 'Satisfaction'];
                return RadarChartTitle(text: categories[index]);
              },
              radarBackgroundColor: Colors.transparent,
              borderData: FlBorderData(show: false),
              dataSets: data.asMap().entries.map((entry) {
                final i = entry.key;
                final branch = entry.value;
                final color = i.isEven ? AppColors.kPrimary : AppColors.kAccent;
                return RadarDataSet(
                  fillColor: color.withValues(alpha: 0.1),
                  borderColor: color,
                  borderWidth: 2,
                  entryRadius: 3,
                  dataEntries: [
                    RadarEntry(value: (branch.revenue / globalMax) * 100),
                    RadarEntry(value: (branch.occupancy / globalMax) * 100),
                    RadarEntry(value: (branch.satisfaction / globalMax) * 100),
                  ],
                );
              }).toList(),
            ),
          ),
        ),
      ),
    );
  }
}
