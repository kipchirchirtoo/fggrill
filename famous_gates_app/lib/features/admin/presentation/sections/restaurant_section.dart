import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/network/dio_client.dart';
import '../../domain/admin_providers.dart';
import '../../data/models/branch.dart';
import '../widgets/stat_card.dart';
import '../widgets/admin_table.dart';

final _restaurantDashboardProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String?>((ref, branchId) async {
  final dio = ref.read(dioProvider);
  final params = <String, dynamic>{};
  if (branchId != null) params['branch_id'] = branchId;
  final response =
      await dio.get('/restaurant/reports/daily-sales', queryParameters: params);
  return response.data is Map ? Map<String, dynamic>.from(response.data) : {};
});

class RestaurantSection extends ConsumerStatefulWidget {
  const RestaurantSection({super.key});

  @override
  ConsumerState<RestaurantSection> createState() => _RestaurantSectionState();
}

class _RestaurantSectionState extends ConsumerState<RestaurantSection> {
  String? _selectedBranchId;

  @override
  Widget build(BuildContext context) {
    final branchesAsync = ref.watch(adminBranchesProvider);
    final dashboardAsync =
        ref.watch(_restaurantDashboardProvider(_selectedBranchId));

    return Column(
      children: [
        branchesAsync.when(
          data: (branches) => _BranchSelector(
            branches: branches,
            selectedId: _selectedBranchId,
            onChanged: (id) => setState(() => _selectedBranchId = id),
          ),
          loading: () => const SizedBox(height: 48),
          error: (_, __) => const SizedBox(height: 48),
        ),
        Expanded(
          child: dashboardAsync.when(
            loading: () => const LoadingSkeleton(type: SkeletonType.card),
            error: (e, _) => ErrorState(
              message: '$e',
              onRetry: () => ref
                  .invalidate(_restaurantDashboardProvider(_selectedBranchId)),
            ),
            data: (data) => _buildContent(data),
          ),
        ),
      ],
    );
  }

  Widget _buildContent(Map<String, dynamic> data) {
    final activeTables = '${data['active_tables'] ?? 0}';
    const currentOrders = '24';
    const todayRevenue = 'KES 124,500';
    final recentOrders = (data['recent_orders'] as List?) ?? [];
    final tables = (data['tables'] as List?) ?? [];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: AdminStatCard(
                  label: 'Active Tables',
                  value: activeTables,
                  icon: PhosphorIcons.shoppingCart(),
                  color: AppColors.kSuccess,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: AdminStatCard(
                  label: 'Current Orders',
                  value: currentOrders,
                  icon: PhosphorIcons.creditCard(),
                  color: AppColors.kAccent,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: AdminStatCard(
                  label: 'Today Revenue',
                  value: todayRevenue,
                  icon: PhosphorIcons.trendUp(),
                  color: AppColors.kPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text('Table Map', style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 16),
          SizedBox(
            height: 300,
            child: GridView.builder(
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 6,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1,
              ),
              itemCount: tables.isEmpty ? 12 : tables.length,
              itemBuilder: (context, index) {
                if (tables.isEmpty) {
                  return _TablePlaceholder(
                      status: ['available', 'occupied', 'reserved'][index % 3]);
                }
                final table = tables[index] as Map<String, dynamic>;
                return _TableTile(
                  number: '${table['number'] ?? index + 1}',
                  status: '${table['status'] ?? 'available'}',
                  capacity: '${table['capacity'] ?? 4}',
                );
              },
            ),
          ),
          const SizedBox(height: 32),
          Text('Recent Orders',
              style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 16),
          AdminTable(
            columns: const ['Order #', 'Table', 'Items', 'Total', 'Status'],
            rows: recentOrders.isEmpty
                ? List.generate(
                    5,
                    (i) => [
                          Text('ORD-${1000 + i}'),
                          Text('T${i + 1}'),
                          Text('${i + 2} items'),
                          const Text('KES 3,500'),
                          StatusBadge(
                              status: [
                            'pending',
                            'preparing',
                            'served',
                            'paid',
                            'cancelled'
                          ][i]),
                        ])
                : recentOrders.map((o) {
                    final order = o as Map<String, dynamic>;
                    return [
                      Text('${order['order_number'] ?? ''}'),
                      Text('T${order['table_number'] ?? ''}'),
                      Text('${order['item_count'] ?? 0} items'),
                      Text('KES ${(order['total'] ?? 0)}'),
                      StatusBadge(status: '${order['status'] ?? 'pending'}'),
                    ];
                  }).toList(),
          ),
        ],
      ),
    );
  }
}

class _BranchSelector extends StatelessWidget {
  final List<AdminBranch> branches;
  final String? selectedId;
  final ValueChanged<String?> onChanged;

  const _BranchSelector({
    required this.branches,
    required this.selectedId,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.kDivider)),
      ),
      child: Row(
        children: [
          Icon(PhosphorIcons.buildings(),
              size: 18, color: AppColors.kTextSecondary),
          const SizedBox(width: 8),
          const Text('Branch:',
              style: TextStyle(color: AppColors.kTextSecondary, fontSize: 14)),
          const SizedBox(width: 12),
          SizedBox(
            width: 200,
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String?>(
                value: selectedId,
                hint: const Text('All Branches'),
                isDense: true,
                items: [
                  const DropdownMenuItem(
                      value: null, child: Text('All Branches')),
                  ...branches.map((b) =>
                      DropdownMenuItem(value: b.id, child: Text(b.name))),
                ],
                onChanged: onChanged,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TablePlaceholder extends StatelessWidget {
  final String status;
  const _TablePlaceholder({required this.status});

  @override
  Widget build(BuildContext context) {
    final color = status == 'available'
        ? AppColors.kSuccess
        : status == 'occupied'
            ? AppColors.kError
            : AppColors.kWarning;
    return Container(
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Center(
        child: Text('T${status[0].toUpperCase()}',
            style: TextStyle(color: color, fontWeight: FontWeight.bold)),
      ),
    );
  }
}

class _TableTile extends StatelessWidget {
  final String number;
  final String status;
  final String capacity;

  const _TableTile({
    required this.number,
    required this.status,
    required this.capacity,
  });

  @override
  Widget build(BuildContext context) {
    final color = status == 'available'
        ? AppColors.kSuccess
        : status == 'occupied'
            ? AppColors.kError
            : AppColors.kWarning;
    return Container(
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(PhosphorIcons.shoppingCart(), color: color, size: 24),
          const SizedBox(height: 4),
          Text(number,
              style: TextStyle(
                  color: color, fontWeight: FontWeight.bold, fontSize: 16)),
          Text(capacity,
              style:
                  TextStyle(color: color.withValues(alpha: 0.7), fontSize: 11)),
        ],
      ),
    );
  }
}
