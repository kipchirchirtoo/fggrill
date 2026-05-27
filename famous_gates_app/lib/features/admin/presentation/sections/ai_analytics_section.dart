import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../domain/admin_providers.dart';
import '../widgets/admin_charts.dart';
import '../widgets/admin_table.dart';
import '../../data/models/ai_analytics.dart';

class AiAnalyticsSection extends ConsumerStatefulWidget {
  const AiAnalyticsSection({super.key});

  @override
  ConsumerState<AiAnalyticsSection> createState() => _AiAnalyticsSectionState();
}

class _AiAnalyticsSectionState extends ConsumerState<AiAnalyticsSection> {
  @override
  Widget build(BuildContext context) {
    final aiAnalyticsAsync = ref.watch(aiAnalyticsProvider);
    final demandForecastAsync = ref.watch(demandForecastProvider);
    final revenueForecastAsync = ref.watch(revenueForecastProvider);
    final isMobile = MediaQuery.of(context).size.width < 768;

    return aiAnalyticsAsync.when(
      loading: () => const LoadingSkeleton(type: SkeletonType.card),
      error: (err, _) => ErrorState(
        message: '$err',
        onRetry: () {
          ref.invalidate(aiAnalyticsProvider);
          ref.invalidate(demandForecastProvider);
          ref.invalidate(revenueForecastProvider);
        },
      ),
      data: (analytics) {
        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(aiAnalyticsProvider);
            ref.invalidate(demandForecastProvider);
            ref.invalidate(revenueForecastProvider);
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'AI Analytics',
                  style: Theme.of(context).textTheme.displaySmall,
                ),
                const SizedBox(height: 8),
                const Text(
                  'AI-powered insights, forecasts, and anomaly detection',
                  style: TextStyle(color: AppColors.kTextSecondary),
                ),
                const SizedBox(height: 24),
                _buildInsights(analytics.insights),
                const SizedBox(height: 24),
                _buildForecastCharts(
                    isMobile,
                    demandForecastAsync.valueOrNull ?? <ForecastPoint>[],
                    revenueForecastAsync.valueOrNull ?? <ForecastPoint>[]),
                const SizedBox(height: 24),
                _buildAnomalies(analytics.anomalies),
                const SizedBox(height: 24),
                _buildBranchComparison(analytics.branchComparisons),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildInsights(List<dynamic> insights) {
    if (insights.isEmpty) {
      return Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
        ),
        child: const Padding(
          padding: EdgeInsets.all(24),
          child: Center(
              child: Text('No insights available',
                  style: TextStyle(color: AppColors.kTextSecondary))),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'AI Insights',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 16),
        LayoutBuilder(
          builder: (context, constraints) {
            final crossAxisCount = constraints.maxWidth < 768 ? 1 : 3;
            return GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: crossAxisCount,
                crossAxisSpacing: 16,
                mainAxisSpacing: 16,
                childAspectRatio: 1.8,
              ),
              itemCount: insights.length > 6 ? 6 : insights.length,
              itemBuilder: (_, i) => _buildInsightCard(insights[i]),
            );
          },
        ),
      ],
    );
  }

  Widget _buildInsightCard(dynamic insight) {
    Color color;
    IconData icon;
    switch (insight.type) {
      case 'success':
        color = AppColors.kSuccess;
        icon = PhosphorIcons.trendUp();
        break;
      case 'warning':
        color = AppColors.kWarning;
        icon = PhosphorIcons.warning();
        break;
      case 'error':
        color = AppColors.kError;
        icon = PhosphorIcons.warning();
        break;
      default:
        color = AppColors.kPrimary;
        icon = PhosphorIcons.sun();
    }

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: color.withValues(alpha: 0.3)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(icon, color: color, size: 20),
                ),
                const Spacer(),
                if (insight.impact > 0)
                  StatusBadge(
                    status:
                        '${(insight.impact * 100).toStringAsFixed(0)}% impact',
                    color: color,
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              insight.title,
              style: TextStyle(fontWeight: FontWeight.w600, color: color),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Expanded(
              child: Text(
                insight.description,
                style: const TextStyle(
                    fontSize: 12, color: AppColors.kTextSecondary),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildForecastCharts(bool isMobile, List<ForecastPoint> demandData,
      List<ForecastPoint> revenueData) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Forecasts',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 16),
        isMobile
            ? Column(
                children: [
                  AdminLineChart(data: demandData),
                  const SizedBox(height: 16),
                  AdminLineChart(data: revenueData),
                ],
              )
            : Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: AdminLineChart(data: demandData)),
                  const SizedBox(width: 16),
                  Expanded(child: AdminLineChart(data: revenueData)),
                ],
              ),
      ],
    );
  }

  Widget _buildAnomalies(List<dynamic> anomalies) {
    if (anomalies.isEmpty) {
      return Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
        ),
        child: const Padding(
          padding: EdgeInsets.all(24),
          child: Center(
              child: Text('No anomalies detected',
                  style: TextStyle(color: AppColors.kTextSecondary))),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Detected Anomalies',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 16),
        ...anomalies.map((a) => _buildAnomalyItem(a)),
      ],
    );
  }

  Widget _buildAnomalyItem(dynamic anomaly) {
    Color severityColor;
    switch (anomaly.severity) {
      case 'critical':
        severityColor = AppColors.kError;
        break;
      case 'high':
        severityColor = AppColors.kError;
        break;
      case 'medium':
        severityColor = AppColors.kWarning;
        break;
      default:
        severityColor = AppColors.kAccent;
    }

    final timeStr = anomaly.detectedAt != null
        ? '${anomaly.detectedAt!.day}/${anomaly.detectedAt!.month} ${anomaly.detectedAt!.hour.toString().padLeft(2, '0')}:${anomaly.detectedAt!.minute.toString().padLeft(2, '0')}'
        : 'Recently';

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: severityColor.withValues(alpha: 0.3)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: severityColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                anomaly.severity == 'critical' || anomaly.severity == 'high'
                    ? PhosphorIcons.warning()
                    : PhosphorIcons.warning(),
                color: severityColor,
                size: 24,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(anomaly.title,
                          style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: severityColor)),
                      const SizedBox(width: 12),
                      StatusBadge(
                          status: anomaly.severity[0].toUpperCase() +
                              anomaly.severity.substring(1),
                          color: severityColor),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(anomaly.description,
                      style: const TextStyle(color: AppColors.kTextSecondary)),
                  if (anomaly.category.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text('Category: ${anomaly.category}',
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.kTextSecondary)),
                  ],
                ],
              ),
            ),
            Column(
              children: [
                Text(timeStr,
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.kTextSecondary)),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () => AppNotifier.showSnackBar(
                      context,
                      const SnackBar(
                          content: Text(
                              'Investigation logged — check security section'))),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: severityColor,
                    side: BorderSide(color: severityColor),
                  ),
                  child: const Text('Investigate'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBranchComparison(List<BranchComparison> comparisons) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Branch Performance Comparison',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 16),
        AdminRadarChart(data: comparisons),
      ],
    );
  }
}
