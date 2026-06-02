import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../data/models/admin_dashboard.dart';
import '../../domain/admin_providers.dart';
import '../widgets/stat_card.dart';

class OverviewSection extends ConsumerStatefulWidget {
  const OverviewSection({super.key});

  @override
  ConsumerState<OverviewSection> createState() => _OverviewSectionState();
}

class _OverviewSectionState extends ConsumerState<OverviewSection> {
  static final NumberFormat _wholeNumber = NumberFormat.decimalPattern();

  String _money(num value) => 'KES ${_wholeNumber.format(value.round())}';

  @override
  Widget build(BuildContext context) {
    final dashboardAsync = ref.watch(adminDashboardProvider);
    final isMobile = MediaQuery.of(context).size.width < 768;

    return dashboardAsync.when(
      loading: () => const LoadingSkeleton(type: SkeletonType.card),
      error: (err, _) => ErrorState(
        message: '$err',
        onRetry: () => ref.invalidate(adminDashboardProvider),
      ),
      data: (dashboard) => RefreshIndicator(
        onRefresh: () async => ref.invalidate(adminDashboardProvider),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Dashboard Overview',
                style: Theme.of(context).textTheme.displaySmall,
              ),
              const SizedBox(height: 24),
              _buildStatGrid(dashboard, isMobile),
              const SizedBox(height: 24),
              _buildCharts(dashboard, isMobile),
              const SizedBox(height: 24),
              _buildRecentActivity(dashboard.recentActivity),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatGrid(AdminDashboard dashboard, bool isMobile) {
    final stats = [
      AdminStatCard(
        label: 'Today Revenue',
        value: _money(dashboard.todayRevenue),
        icon: PhosphorIcons.trendUp(),
        color: AppColors.kSuccess,
      ),
      AdminStatCard(
        label: 'Monthly Revenue',
        value: _money(dashboard.monthlyRevenue),
        icon: PhosphorIcons.chartLine(),
        color: AppColors.kPrimary,
      ),
      AdminStatCard(
        label: 'Active Bookings',
        value: '${dashboard.occupiedRooms}',
        icon: PhosphorIcons.calendar(),
        color: AppColors.kAccent,
      ),
      AdminStatCard(
        label: 'Occupancy %',
        value: dashboard.totalRooms > 0
            ? '${(dashboard.occupiedRooms / dashboard.totalRooms * 100).toStringAsFixed(1)}%'
            : '0%',
        icon: PhosphorIcons.building(),
        color: AppColors.kWarning,
      ),
      AdminStatCard(
        label: 'Total Branches',
        value: '${dashboard.totalBranches}',
        icon: PhosphorIcons.buildings(),
        color: AppColors.kTextSecondary,
      ),
      AdminStatCard(
        label: 'Total Staff',
        value: '${dashboard.totalStaff}',
        icon: PhosphorIcons.users(),
        color: AppColors.kPrimary,
      ),
      AdminStatCard(
        label: 'Active Users',
        value: '${dashboard.activeSessions}',
        icon: PhosphorIcons.user(),
        color: AppColors.kSuccess,
      ),
      AdminStatCard(
        label: 'Pending Actions',
        value: '${dashboard.failedLogins}',
        icon: PhosphorIcons.warning(),
        color: AppColors.kError,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final crossAxisCount = isMobile ? 2 : 4;
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: crossAxisCount,
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
            childAspectRatio: isMobile ? 1.6 : 2.4,
          ),
          itemCount: stats.length,
          itemBuilder: (_, i) => stats[i],
        );
      },
    );
  }

  Widget _buildCharts(AdminDashboard dashboard, bool isMobile) {
    return isMobile
        ? Column(
            children: [
              _buildRevenueChart(dashboard.revenueTrend),
              const SizedBox(height: 16),
              _buildOccupancyChart(dashboard.occupancyTrend),
            ],
          )
        : Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _buildRevenueChart(dashboard.revenueTrend)),
              const SizedBox(width: 16),
              Expanded(child: _buildOccupancyChart(dashboard.occupancyTrend)),
            ],
          );
  }

  Widget _buildRevenueChart(List<RevenueDataPoint> data) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Revenue Trend',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.kTextPrimary),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 180,
              child: data.isEmpty
                  ? const Center(
                      child: Text('No data',
                          style: TextStyle(color: AppColors.kTextSecondary)))
                  : Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: List.generate(data.length, (i) {
                        final maxRevenue = data.fold<double>(
                            0, (m, d) => m > d.revenue ? m : d.revenue);
                        final height = maxRevenue > 0
                            ? (data[i].revenue / maxRevenue) * 160
                            : 0.0;
                        return Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 2),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                Container(
                                  height: height,
                                  decoration: BoxDecoration(
                                    color: AppColors.kPrimary
                                        .withValues(alpha: 0.7),
                                    borderRadius: const BorderRadius.vertical(
                                        top: Radius.circular(4)),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  data[i].label,
                                  style: const TextStyle(
                                      fontSize: 10,
                                      color: AppColors.kTextSecondary),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        );
                      }),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOccupancyChart(List<OccupancyDataPoint> data) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Occupancy Trend',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.kTextPrimary),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 180,
              child: data.isEmpty
                  ? const Center(
                      child: Text('No data',
                          style: TextStyle(color: AppColors.kTextSecondary)))
                  : CustomPaint(
                      size: const Size(double.infinity, 180),
                      painter: _LineChartPainter(data),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecentActivity(List<RecentActivity> activities) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Recent Activity',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.kTextPrimary),
            ),
            const SizedBox(height: 16),
            if (activities.isEmpty)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(
                    child: Text('No recent activity',
                        style: TextStyle(color: AppColors.kTextSecondary))),
              )
            else
              ...activities.take(8).map((a) => _buildActivityItem(a)),
          ],
        ),
      ),
    );
  }

  Widget _buildActivityItem(RecentActivity activity) {
    IconData icon;
    Color color;
    switch (activity.type) {
      case 'success':
        icon = PhosphorIcons.checkCircle();
        color = AppColors.kSuccess;
        break;
      case 'warning':
        icon = PhosphorIcons.warning();
        color = AppColors.kWarning;
        break;
      case 'error':
        icon = PhosphorIcons.x();
        color = AppColors.kError;
        break;
      default:
        icon = PhosphorIcons.info();
        color = AppColors.kPrimary;
    }

    final timeStr = activity.createdAt != null
        ? '${activity.createdAt!.hour.toString().padLeft(2, '0')}:${activity.createdAt!.minute.toString().padLeft(2, '0')}'
        : '';

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 16, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  activity.action,
                  style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: AppColors.kTextPrimary),
                ),
                const SizedBox(height: 2),
                Text(
                  activity.description,
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.kTextSecondary),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            timeStr,
            style:
                const TextStyle(fontSize: 11, color: AppColors.kTextSecondary),
          ),
        ],
      ),
    );
  }
}

class _LineChartPainter extends CustomPainter {
  final List<OccupancyDataPoint> data;
  _LineChartPainter(this.data);

  @override
  void paint(Canvas canvas, Size size) {
    if (data.isEmpty) return;

    final paint = Paint()
      ..color = AppColors.kAccent
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;

    final fillPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          AppColors.kAccent.withValues(alpha: 0.3),
          AppColors.kAccent.withValues(alpha: 0.0)
        ],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));

    final path = Path();
    final fillPath = Path();
    final stepX = size.width / (data.length - 1);
    final maxVal =
        data.fold<double>(0, (m, d) => m > d.occupancy ? m : d.occupancy);
    final scale = maxVal > 0 ? size.height / maxVal : 1.0;

    for (int i = 0; i < data.length; i++) {
      final x = i * stepX;
      final y = size.height - (data[i].occupancy * scale);
      if (i == 0) {
        path.moveTo(x, y);
        fillPath.moveTo(x, size.height);
        fillPath.lineTo(x, y);
      } else {
        path.lineTo(x, y);
        fillPath.lineTo(x, y);
      }
    }

    fillPath.lineTo(size.width, size.height);
    fillPath.close();

    canvas.drawPath(fillPath, fillPaint);
    canvas.drawPath(path, paint);

    final dotPaint = Paint()
      ..color = AppColors.kAccent
      ..style = PaintingStyle.fill;

    for (int i = 0; i < data.length; i++) {
      final x = i * stepX;
      final y = size.height - (data[i].occupancy * scale);
      canvas.drawCircle(Offset(x, y), 3, dotPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _LineChartPainter oldDelegate) =>
      data != oldDelegate.data;
}
