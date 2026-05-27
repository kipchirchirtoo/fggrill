import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/widgets.dart';
import '../domain/bar_providers.dart';
import '../domain/models.dart';

class BarInventoryTab extends ConsumerWidget {
  const BarInventoryTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stockAsync = ref.watch(barStockProvider);
    final notifier = ref.read(barStockProvider.notifier);

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: AppColors.kDivider)),
          ),
          child: Row(
            children: [
              OutlinedButton.icon(
                onPressed: () => notifier.syncFromMaster(),
                icon: Icon(PhosphorIcons.arrowsClockwise(), size: 18),
                label: const Text('Sync from Master'),
              ),
              const SizedBox(width: 12),
              OutlinedButton.icon(
                onPressed: () => _showStockRequestDialog(context),
                icon: Icon(PhosphorIcons.paperPlaneTilt(), size: 18),
                label: const Text('Request Stock'),
              ),
              const Spacer(),
              IconButton(
                onPressed: notifier.refresh,
                icon: Icon(PhosphorIcons.arrowsClockwise()),
                tooltip: 'Refresh',
              ),
            ],
          ),
        ),
        Expanded(
          child: AsyncValueWidget(
            value: stockAsync,
            data: (stock) {
              final lowStock = stock.where((s) => s.lowStock).toList();
              return Column(
                children: [
                  if (lowStock.isNotEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      color: AppColors.kError.withValues(alpha: 0.1),
                      child: Row(
                        children: [
                          Icon(PhosphorIcons.warning(),
                              color: AppColors.kError, size: 20),
                          const SizedBox(width: 8),
                          Text(
                            '${lowStock.length} low stock item(s)',
                            style: const TextStyle(
                              color: AppColors.kError,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const Spacer(),
                          TextButton(
                            onPressed: () =>
                                _showLowStockDialog(context, lowStock),
                            child: const Text('View'),
                          ),
                        ],
                      ),
                    ),
                  Expanded(
                    child: stock.isEmpty
                        ? const EmptyState(message: 'No stock items')
                        : RefreshIndicator(
                            onRefresh: notifier.refresh,
                            child: ListView.builder(
                              padding: const EdgeInsets.all(16),
                              itemCount: stock.length,
                              itemBuilder: (context, index) {
                                final item = stock[index];
                                return Card(
                                  margin: const EdgeInsets.only(bottom: 8),
                                  child: ListTile(
                                    leading: Container(
                                      width: 8,
                                      height: 8,
                                      decoration: BoxDecoration(
                                        color: item.lowStock
                                            ? AppColors.kError
                                            : AppColors.kSuccess,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    title: Text(item.drinkName,
                                        style: const TextStyle(
                                            fontWeight: FontWeight.bold)),
                                    subtitle: Text(
                                        'Par: ${item.parLevel.toStringAsFixed(0)} ${item.unit ?? ''}'),
                                    trailing: Column(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      crossAxisAlignment:
                                          CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          '${item.currentStock.toStringAsFixed(1)} ${item.unit ?? ''}',
                                          style: TextStyle(
                                            fontWeight: FontWeight.bold,
                                            color: item.lowStock
                                                ? AppColors.kError
                                                : AppColors.kTextPrimary,
                                          ),
                                        ),
                                        if (item.lowStock)
                                          const Text('LOW STOCK',
                                              style: TextStyle(
                                                  color: AppColors.kError,
                                                  fontSize: 10)),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
                  ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }

  void _showLowStockDialog(BuildContext context, List<StockItem> items) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Low Stock Items'),
        content: SizedBox(
          width: double.maxFinite,
          child: ListView.builder(
            shrinkWrap: true,
            itemCount: items.length,
            itemBuilder: (context, index) {
              final item = items[index];
              return ListTile(
                title: Text(item.drinkName),
                subtitle: Text(
                    'Current: ${item.currentStock.toStringAsFixed(1)} ${item.unit ?? ''}'),
                trailing: Text('Par: ${item.parLevel.toStringAsFixed(0)}'),
              );
            },
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Close')),
        ],
      ),
    );
  }

  void _showStockRequestDialog(BuildContext context) {
    final qtyController = TextEditingController();
    final itemController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Request Stock'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: itemController,
              decoration: const InputDecoration(
                  labelText: 'Item Name', hintText: 'e.g. Tusker Lager'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: qtyController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                  labelText: 'Quantity', hintText: 'e.g. 24'),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
            },
            child: const Text('Submit Request'),
          ),
        ],
      ),
    );
  }
}
