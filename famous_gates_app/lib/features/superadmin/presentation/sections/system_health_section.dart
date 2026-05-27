import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../domain/superadmin_providers.dart';

// Valid phosphor icons
final _databaseIcon = PhosphorIcons.cube();
final _serverIcon = PhosphorIcons.buildings();
final _memoryIcon = PhosphorIcons.package();
final _queueIcon = PhosphorIcons.listBullets();

class SystemHealthSection extends ConsumerWidget {
  const SystemHealthSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final healthAsync = ref.watch(systemHealthProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(),
          const SizedBox(height: 24),
          healthAsync.when(
            data: (health) => _buildHealthDashboard(health),
            loading: () => const LoadingSkeleton(height: 400),
            error: (e, _) => ErrorState(message: e.toString()),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'System Health',
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.bold,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Monitor system performance, uptime, and health metrics',
          style: TextStyle(
            fontSize: 14,
            color: Colors.grey.shade500,
          ),
        ),
      ],
    );
  }

  Widget _buildHealthDashboard(Map<String, dynamic> health) {
    final isUnavailable = health['_unavailable'] == true;
    return Column(
      children: [
        // Show a banner when the /system/status route isn't deployed yet
        if (isUnavailable) ...[
          Container(
            width: double.infinity,
            margin: const EdgeInsets.only(bottom: 20),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.orange.shade50,
              border: Border.all(color: Colors.orange.shade200),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(children: [
              Icon(Icons.info_outline, color: Colors.orange.shade700, size: 18),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'System status endpoint is not yet available on the server. '
                  'Deploy the backend to enable live metrics.',
                  style: TextStyle(
                      color: Colors.orange.shade800, fontSize: 13),
                ),
              ),
            ]),
          ),
        ],
        // Status Overview Cards
        Row(
          children: [
            _buildStatusCard(
              'Database',
              health['database']?['status'] ?? 'Unknown',
              _databaseIcon,
            ),
            _buildStatusCard(
              'API Server',
              health['api']?['status'] ?? 'Unknown',
              _serverIcon,
            ),
            _buildStatusCard(
              'Cache',
              health['cache']?['status'] ?? 'Unknown',
              _memoryIcon,
            ),
            _buildStatusCard(
              'Queue',
              health['queue']?['status'] ?? 'Unknown',
              _queueIcon,
            ),
          ],
        ),
        const SizedBox(height: 24),

        // Metrics
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'System Metrics',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 20),
              _buildMetricRow('Uptime', health['uptime']?.toString() ?? '0s'),
              _buildMetricRow(
                  'CPU Usage', '${health['cpu']?.toString() ?? '0'}%'),
              _buildMetricRow(
                  'Memory Usage', '${health['memory']?.toString() ?? '0'}%'),
              _buildMetricRow(
                  'Disk Usage', '${health['disk']?.toString() ?? '0'}%'),
              _buildMetricRow('Active Connections',
                  health['connections']?.toString() ?? '0'),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStatusCard(String name, String status, IconData icon) {
    final isHealthy =
        status.toLowerCase() == 'healthy' || status.toLowerCase() == 'ok';

    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 16),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 24, color: AppColors.kPrimary),
                const Spacer(),
                Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    color: isHealthy
                        ? const Color(0xFF10b981)
                        : const Color(0xFFef4444),
                    shape: BoxShape.circle,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              name,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Colors.grey.shade600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              status.toUpperCase(),
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: isHealthy
                    ? const Color(0xFF10b981)
                    : const Color(0xFFef4444),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey.shade600,
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
