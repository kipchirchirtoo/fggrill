import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/widgets.dart';
import '../domain/bar_providers.dart';
import '../domain/models.dart';

class BarOrdersTab extends ConsumerWidget {
  const BarOrdersTab({super.key});

  static const _statuses = <String?>[
    null,
    'pending',
    'preparing',
    'ready',
    'completed',
    'cancelled',
  ];

  static const _statusLabels = <String>[
    'All',
    'Pending',
    'Preparing',
    'Ready',
    'Completed',
    'Cancelled',
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(barOrdersProvider);
    final notifier = ref.read(barOrdersProvider.notifier);

    return Column(
      children: [
        Container(
          height: 60,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: AppColors.kDivider)),
          ),
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: List.generate(_statuses.length, (i) {
              final isSelected = notifier.statusFilter == (_statuses[i] ?? '');
              return Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
                child: FilterChip(
                  label: Text(_statusLabels[i]),
                  selected: isSelected,
                  onSelected: (_) => notifier.load(status: _statuses[i]),
                  selectedColor: AppColors.kPrimary,
                  checkmarkColor: Colors.white,
                  labelStyle: TextStyle(
                    color: isSelected ? Colors.white : AppColors.kTextPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              );
            }),
          ),
        ),
        Expanded(
          child: AsyncValueWidget(
            value: ordersAsync,
            data: (orders) {
              if (orders.isEmpty) {
                return const EmptyState(message: 'No orders found');
              }
              return RefreshIndicator(
                onRefresh: notifier.refresh,
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: orders.length,
                  itemBuilder: (context, index) =>
                      _OrderCard(order: orders[index]),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _OrderCard extends ConsumerWidget {
  final BarOrder order;

  const _OrderCard({required this.order});

  Color _statusColor(String status) {
    switch (status) {
      case 'pending':
        return AppColors.kWarning;
      case 'preparing':
        return Colors.blue;
      case 'ready':
        return AppColors.kSuccess;
      case 'completed':
        return AppColors.kTextSecondary;
      case 'cancelled':
        return AppColors.kError;
      default:
        return AppColors.kTextSecondary;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  'Order #${order.id.substring(0, 8)}',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 15),
                ),
                const Spacer(),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: _statusColor(order.status).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    order.statusLabel,
                    style: TextStyle(
                      color: _statusColor(order.status),
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            if (order.customerName != null) ...[
              const SizedBox(height: 8),
              Text(order.customerName!,
                  style: const TextStyle(color: AppColors.kTextSecondary)),
            ],
            const SizedBox(height: 8),
            ...order.items.map((item) {
                  final activeQty = item.activeQty;
                  final isFullyVoided = activeQty <= 0;
                  if (isFullyVoided) return const SizedBox.shrink();
                  final activeTotal = item.activeTotal;
                  return Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Row(
                      children: [
                        Text(
                          '${activeQty.toStringAsFixed(activeQty.truncateToDouble() == activeQty ? 0 : 1)}x ${item.name}'
                          '${item.voidedQty > 0 ? " (${item.voidedQty.toStringAsFixed(0)} voided)" : ""}',
                        ),
                        const Spacer(),
                        Text('KES ${activeTotal.toStringAsFixed(0)}'),
                      ],
                    ),
                  );
                }),
            const Divider(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Total: KES ${order.totalAmount.toStringAsFixed(2)}',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                if (order.status == 'pending')
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _ActionChip(
                        label: 'Preparing',
                        color: Colors.blue,
                        onTap: () => ref
                            .read(barOrdersProvider.notifier)
                            .updateStatus(order.id, 'preparing'),
                      ),
                      const SizedBox(width: 8),
                      _ActionChip(
                        label: 'Cancel',
                        color: AppColors.kError,
                        onTap: () => ref
                            .read(barOrdersProvider.notifier)
                            .updateStatus(order.id, 'cancelled'),
                      ),
                    ],
                  ),
                if (order.status == 'preparing')
                  _ActionChip(
                    label: 'Ready',
                    color: AppColors.kSuccess,
                    onTap: () => ref
                        .read(barOrdersProvider.notifier)
                        .updateStatus(order.id, 'ready'),
                  ),
                if (order.status == 'ready')
                  _ActionChip(
                    label: 'Complete',
                    color: AppColors.kPrimary,
                    onTap: () => ref
                        .read(barOrdersProvider.notifier)
                        .updateStatus(order.id, 'completed'),
                  ),
              ],
            ),
            Text(
              _formatTime(order.createdAt),
              style: const TextStyle(
                  color: AppColors.kTextSecondary, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '${dt.day}/${dt.month}/${dt.year} $h:$m';
  }
}

class _ActionChip extends StatelessWidget {
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ActionChip(
      {required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(label,
            style: TextStyle(
                color: color, fontWeight: FontWeight.bold, fontSize: 12)),
      ),
    );
  }
}
