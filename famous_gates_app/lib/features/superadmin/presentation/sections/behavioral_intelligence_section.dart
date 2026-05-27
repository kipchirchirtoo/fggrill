import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/api_error_message.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../domain/superadmin_providers.dart';
import '../../../../core/services/services.dart';

// Valid phosphor icons
final _robotIcon = PhosphorIcons.cube();
final _sparkleIcon = PhosphorIcons.bookmark();
final _activityIcon = PhosphorIcons.chartLine();
final _targetIcon = PhosphorIcons.chartPie();

class BehavioralIntelligenceSection extends ConsumerWidget {
  const BehavioralIntelligenceSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final anomaliesAsync = ref.watch(aiAnomaliesProvider);
    final insightsAsync = ref.watch(aiInsightsProvider);
    final statsAsync = ref.watch(aiStatsProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          _buildHeader(context, ref),
          const SizedBox(height: 24),

          // Stats Cards
          statsAsync.when(
            data: (stats) => _buildStatsCards(stats),
            loading: () => const LoadingSkeleton(height: 120, count: 4),
            error: (e, _) => ErrorState(message: e.toString()),
          ),
          const SizedBox(height: 24),

          // Main Content Grid
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Left Column - Chart & Anomaly Table
              Expanded(
                flex: 3,
                child: Column(
                  children: [
                    // Trend Chart
                    anomaliesAsync.when(
                      data: (data) => _buildTrendChart(data),
                      loading: () => const LoadingSkeleton(height: 250),
                      error: (e, _) => ErrorState(message: e.toString()),
                    ),
                    const SizedBox(height: 24),

                    // Anomaly Table
                    anomaliesAsync.when(
                      data: (data) => _buildAnomalyTable(data),
                      loading: () => const LoadingSkeleton(height: 400),
                      error: (e, _) => ErrorState(message: e.toString()),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 24),

              // Right Column - AI Insights
              Expanded(
                flex: 1,
                child: insightsAsync.when(
                  data: (insights) => _buildInsightsPanel(insights),
                  loading: () => const LoadingSkeleton(height: 500),
                  error: (e, _) => ErrorState(message: e.toString()),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1e1b4b), Color(0xFF0f0f1a)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                            color: Colors.white.withValues(alpha: 0.2)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            _robotIcon,
                            color: const Color(0xFF818cf8),
                            size: 16,
                          ),
                          const SizedBox(width: 8),
                          const Text(
                            'Gemini AI Active',
                            style: TextStyle(
                              color: Color(0xFF818cf8),
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const Text(
                  'Behavioral Intelligence',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Real-time anomaly detection powered by Gemini AI — tracking shift discrepancies, void patterns, and audit exceptions.',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.6),
                    fontSize: 14,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    _buildActionButton(
                      'Refresh',
                      PhosphorIcons.arrowsClockwise(),
                      () => _refreshData(ref),
                      isPrimary: false,
                    ),
                    const SizedBox(width: 12),
                    _buildActionButton(
                      'Ask Gemini',
                      _sparkleIcon,
                      () => _fetchInsights(ref),
                      isPrimary: true,
                    ),
                    const SizedBox(width: 12),
                    _buildActionButton(
                      'Retrain',
                      _activityIcon,
                      () => _retrainModels(context, ref),
                      isPrimary: false,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton(String label, IconData icon, VoidCallback onTap,
      {required bool isPrimary}) {
    return Material(
      color: isPrimary
          ? const Color(0xFF4f46e5)
          : Colors.white.withValues(alpha: 0.1),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: isPrimary
                ? null
                : Border.all(color: Colors.white.withValues(alpha: 0.2)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon,
                  color: isPrimary ? Colors.white : Colors.white70, size: 18),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  color: isPrimary ? Colors.white : Colors.white70,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatsCards(Map<String, dynamic> stats) {
    final anomalies = stats['anomalies'] as List<dynamic>? ?? [];

    final criticalCount =
        anomalies.where((a) => a['severity'] == 'CRITICAL').length;
    final highCount = anomalies.where((a) => a['severity'] == 'HIGH').length;
    final avgScore = anomalies.isEmpty
        ? 0.0
        : anomalies
                .map((a) => (a['score'] as num?)?.toDouble() ?? 0.0)
                .reduce((a, b) => a + b) /
            anomalies.length;

    final cards = [
      {
        'label': 'Critical',
        'value': criticalCount.toString(),
        'color': const Color(0xFFef4444)
      },
      {
        'label': 'High Risk',
        'value': highCount.toString(),
        'color': const Color(0xFFf59e0b)
      },
      {
        'label': 'Avg Score',
        'value': avgScore.toStringAsFixed(1),
        'color': const Color(0xFF818cf8)
      },
      {
        'label': 'Total Events',
        'value': anomalies.length.toString(),
        'color': AppColors.kPrimary
      },
    ];

    return Row(
      children: cards.map((card) {
        return Expanded(
          child: Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade200),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  card['value'] as String,
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: card['color'] as Color,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  card['label'] as String,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey.shade500,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildTrendChart(Map<String, dynamic> data) {
    final anomalies = data['anomalies'] as List<dynamic>? ?? [];

    // Group anomalies by date
    final grouped = <String, int>{};
    for (final anomaly in anomalies) {
      final date = DateTime.parse(anomaly['detected_at'] as String);
      final key = DateFormat('MMM dd').format(date);
      grouped[key] = (grouped[key] ?? 0) + 1;
    }

    final sortedKeys = grouped.keys.toList()..sort();
    final chartData = sortedKeys.map((k) => grouped[k]!.toDouble()).toList();

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(PhosphorIcons.trendUp(),
                  color: AppColors.kPrimary, size: 20),
              const SizedBox(width: 12),
              const Text(
                'Anomaly Detection Frequency',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '30-day rolling window — spikes indicate coordinated deviations',
            style: TextStyle(
              fontSize: 13,
              color: Colors.grey.shade500,
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            height: 220,
            child: chartData.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(_targetIcon,
                            size: 48, color: Colors.grey.shade300),
                        const SizedBox(height: 12),
                        Text(
                          'No trend data yet',
                          style: TextStyle(color: Colors.grey.shade400),
                        ),
                      ],
                    ),
                  )
                : LineChart(
                    LineChartData(
                      gridData: FlGridData(
                        show: true,
                        drawVerticalLine: false,
                        horizontalInterval: 1,
                        getDrawingHorizontalLine: (value) {
                          return FlLine(
                            color: Colors.grey.shade200,
                            strokeWidth: 1,
                          );
                        },
                      ),
                      titlesData: FlTitlesData(
                        leftTitles: const AxisTitles(
                            sideTitles: SideTitles(showTitles: false)),
                        rightTitles: const AxisTitles(
                            sideTitles: SideTitles(showTitles: false)),
                        topTitles: const AxisTitles(
                            sideTitles: SideTitles(showTitles: false)),
                        bottomTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            getTitlesWidget: (value, meta) {
                              if (value.toInt() < sortedKeys.length) {
                                return Text(
                                  sortedKeys[value.toInt()],
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: Colors.grey.shade500,
                                  ),
                                );
                              }
                              return const SizedBox.shrink();
                            },
                          ),
                        ),
                      ),
                      borderData: FlBorderData(show: false),
                      lineBarsData: [
                        LineChartBarData(
                          spots: chartData.asMap().entries.map((e) {
                            return FlSpot(e.key.toDouble(), e.value);
                          }).toList(),
                          isCurved: true,
                          color: const Color(0xFF4f46e5),
                          barWidth: 3,
                          isStrokeCapRound: true,
                          dotData: const FlDotData(show: false),
                          belowBarData: BarAreaData(
                            show: true,
                            color:
                                const Color(0xFF4f46e5).withValues(alpha: 0.1),
                          ),
                        ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildAnomalyTable(Map<String, dynamic> data) {
    final anomalies = data['anomalies'] as List<dynamic>? ?? [];
    final stats = data['stats'] as Map<String, dynamic>? ?? {};

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(_targetIcon, color: AppColors.kPrimary, size: 20),
              const SizedBox(width: 12),
              const Text(
                'Anomaly Event Index',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Stats Summary
          Wrap(
            spacing: 16,
            runSpacing: 12,
            children: [
              _buildStatChip('Audit Events',
                  stats['total_audit_events']?.toString() ?? '0'),
              _buildStatChip(
                  'Shifts', stats['total_shifts']?.toString() ?? '0'),
              _buildStatChip('Voids', stats['total_voids']?.toString() ?? '0'),
              _buildStatChip('Bills', stats['total_bills']?.toString() ?? '0'),
            ],
          ),
          const SizedBox(height: 24),

          // Table
          if (anomalies.isEmpty)
            Center(
              child: Column(
                children: [
                  const SizedBox(height: 40),
                  Icon(_activityIcon, size: 64, color: Colors.grey.shade200),
                  const SizedBox(height: 16),
                  Text(
                    'Baseline Stable',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.grey.shade600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'No anomalies detected in the last 30 days',
                    style: TextStyle(color: Colors.grey.shade400),
                  ),
                  const SizedBox(height: 40),
                ],
              ),
            )
          else
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                columns: const [
                  DataColumn(label: Text('Time')),
                  DataColumn(label: Text('Type')),
                  DataColumn(label: Text('Description')),
                  DataColumn(label: Text('Severity')),
                ],
                rows: anomalies.take(20).map((anomaly) {
                  final date = DateTime.parse(anomaly['detected_at'] as String);
                  final severity = anomaly['severity'] as String? ?? 'LOW';

                  return DataRow(
                    cells: [
                      DataCell(
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              DateFormat('HH:mm').format(date),
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            Text(
                              DateFormat('MMM dd').format(date),
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey.shade500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      DataCell(
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFeef2ff),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: const Color(0xFFc7d2fe)),
                          ),
                          child: Text(
                            (anomaly['type'] as String? ?? 'UNKNOWN')
                                .toUpperCase(),
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF4f46e5),
                            ),
                          ),
                        ),
                      ),
                      DataCell(
                        Text(
                          anomaly['description'] as String? ?? 'No description',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: Colors.grey.shade700),
                        ),
                      ),
                      DataCell(_buildSeverityBadge(severity)),
                    ],
                  );
                }).toList(),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildStatChip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              color: Colors.grey.shade500,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSeverityBadge(String severity) {
    final colors = {
      'CRITICAL': const Color(0xFFef4444),
      'HIGH': const Color(0xFFf59e0b),
      'MEDIUM': const Color(0xFFf97316),
      'LOW': const Color(0xFF4f46e5),
    };

    final bgColors = {
      'CRITICAL': const Color(0xFFfef2f2),
      'HIGH': const Color(0xFFfffbeb),
      'MEDIUM': const Color(0xFFfff7ed),
      'LOW': const Color(0xFFeef2ff),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: bgColors[severity] ?? Colors.grey.shade100,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: (colors[severity] ?? Colors.grey).withValues(alpha: 0.3),
        ),
      ),
      child: Text(
        severity,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: colors[severity] ?? Colors.grey,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildInsightsPanel(Map<String, dynamic> insights) {
    final riskLevel = insights['risk_level'] as String? ?? 'LOW';
    final summary = insights['summary'] as String? ?? 'No analysis available';
    final geminiInsights = insights['insights'] as List<dynamic>? ?? [];
    final recommendation = insights['recommendation'] as String?;

    final riskColors = {
      'LOW': const Color(0xFF10b981),
      'MEDIUM': const Color(0xFFf59e0b),
      'HIGH': const Color(0xFFf97316),
      'CRITICAL': const Color(0xFFef4444),
    };

    return Column(
      children: [
        // Risk Level Card
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF1e1b4b), Color(0xFF312e81)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(_sparkleIcon, color: const Color(0xFF818cf8), size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Gemini Analysis'.toUpperCase(),
                    style: const TextStyle(
                      color: Color(0xFF818cf8),
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: (riskColors[riskLevel] ?? Colors.grey)
                      .withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: (riskColors[riskLevel] ?? Colors.grey)
                        .withValues(alpha: 0.5),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      PhosphorIcons.warning(),
                      color: riskColors[riskLevel] ?? Colors.grey,
                      size: 14,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Risk: $riskLevel',
                      style: TextStyle(
                        color: riskColors[riskLevel] ?? Colors.grey,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Text(
                summary,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.9),
                  fontSize: 14,
                  height: 1.6,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Insights Cards
        ...geminiInsights.map((insight) {
          final category = insight['category'] as String? ?? 'GENERAL';
          final categoryColors = {
            'FINANCIAL': const Color(0xFF10b981),
            'OPERATIONAL': const Color(0xFF3b82f6),
            'SECURITY': const Color(0xFFef4444),
            'COMPLIANCE': const Color(0xFFf59e0b),
          };
          final categoryBgColors = {
            'FINANCIAL': const Color(0xFFecfdf5),
            'OPERATIONAL': const Color(0xFFeff6ff),
            'SECURITY': const Color(0xFFfef2f2),
            'COMPLIANCE': const Color(0xFFfffbeb),
          };

          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: categoryBgColors[category] ?? Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: (categoryColors[category] ?? Colors.grey)
                          .withValues(alpha: 0.3),
                    ),
                  ),
                  child: Text(
                    category,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: categoryColors[category] ?? Colors.grey,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  insight['title'] as String? ?? 'Untitled',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  insight['detail'] as String? ?? 'No details',
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.grey.shade600,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          );
        }),

        // Recommendation
        if (recommendation != null)
          Container(
            margin: const EdgeInsets.only(top: 4),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1f2937),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Top Recommendation'.toUpperCase(),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: Colors.grey.shade400,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  recommendation,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  void _refreshData(WidgetRef ref) {
    ref.invalidate(aiAnomaliesProvider);
    ref.invalidate(aiStatsProvider);
  }

  void _fetchInsights(WidgetRef ref) {
    ref.invalidate(aiInsightsProvider);
  }

  Future<void> _retrainModels(BuildContext context, WidgetRef ref) async {
    final service = ref.read(securityServiceProvider);
    try {
      final response = await service.retrainAIModels();
      if (!context.mounted) return;
      AppNotifier.showSnackBar(
        context,
        SnackBar(
            content: Text(response['message']?.toString() ??
                'Baseline profiles refreshed')),
      );
      _refreshData(ref);
    } catch (e) {
      if (!context.mounted) return;
      AppNotifier.showSnackBar(
        context,
        SnackBar(content: Text(apiErrorMessage(e))),
      );
    }
  }
}
