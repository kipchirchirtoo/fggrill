import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../domain/superadmin_providers.dart';

class SuperAdminAuditLogsSection extends ConsumerWidget {
  const SuperAdminAuditLogsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logsAsync = ref.watch(systemLogsProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(),
          const SizedBox(height: 24),
          logsAsync.when(
            data: (data) => _buildLogsTable(data),
            loading: () => const LoadingSkeleton(height: 400),
            error: (e, _) => ErrorState(
              message: e.toString(),
              onRetry: () => ref.invalidate(systemLogsProvider),
            ),
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
          'System Audit Logs',
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.bold,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Track all system changes and user activities',
          style: TextStyle(
            fontSize: 14,
            color: Colors.grey.shade500,
          ),
        ),
      ],
    );
  }

  Widget _buildLogsTable(Map<String, dynamic> data) {
    final logs = data['data'] as List<dynamic>? ?? [];

    if (logs.isEmpty) {
      return const Center(child: Text('No audit logs found'));
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          columns: const [
            DataColumn(label: Text('Timestamp')),
            DataColumn(label: Text('User')),
            DataColumn(label: Text('Action')),
            DataColumn(label: Text('Entity')),
            DataColumn(label: Text('Details')),
            DataColumn(label: Text('IP Address')),
          ],
          rows: logs.map((log) {
            return DataRow(
              cells: [
                DataCell(Text(_formatTimestamp(log['created_at']))),
                DataCell(
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 12,
                        backgroundColor:
                            AppColors.kPrimary.withValues(alpha: 0.1),
                        child: Text(
                          _initialFor(log['user_name']?.toString()),
                          style: const TextStyle(
                            fontSize: 10,
                            color: AppColors.kPrimary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(log['user_name']?.toString() ?? 'System'),
                    ],
                  ),
                ),
                DataCell(
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: _getActionColor(log['action']?.toString() ?? '')
                          .withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      (log['action']?.toString() ?? 'UNKNOWN').toUpperCase(),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: _getActionColor(log['action']?.toString() ?? ''),
                      ),
                    ),
                  ),
                ),
                DataCell(Text(log['entity']?.toString() ?? 'N/A')),
                DataCell(
                  SizedBox(
                    width: 200,
                    child: Text(
                      log['details']?.toString() ?? '',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: Colors.grey.shade600),
                    ),
                  ),
                ),
                DataCell(Text(log['ip_address']?.toString() ?? 'N/A')),
              ],
            );
          }).toList(),
        ),
      ),
    );
  }

  String _initialFor(String? userName) {
    final trimmed = userName?.trim() ?? '';
    return trimmed.isEmpty ? '?' : trimmed[0].toUpperCase();
  }

  String _formatTimestamp(String? timestamp) {
    if (timestamp == null) return 'Unknown';
    try {
      final date = DateTime.parse(timestamp);
      return '${date.day}/${date.month}/${date.year} ${date.hour}:${date.minute.toString().padLeft(2, '0')}:${date.second.toString().padLeft(2, '0')}';
    } catch (e) {
      return timestamp;
    }
  }

  Color _getActionColor(String action) {
    switch (action.toLowerCase()) {
      case 'create':
        return const Color(0xFF10b981);
      case 'update':
        return const Color(0xFF3b82f6);
      case 'delete':
        return const Color(0xFFef4444);
      case 'login':
        return const Color(0xFF8b5cf6);
      case 'logout':
        return const Color(0xFF6b7280);
      default:
        return Colors.grey;
    }
  }
}
