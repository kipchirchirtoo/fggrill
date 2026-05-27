import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/widgets.dart';
import '../domain/bar_providers.dart';
import '../domain/models.dart';

class BarTabsTab extends ConsumerWidget {
  const BarTabsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tabsAsync = ref.watch(barTabsProvider);
    final notifier = ref.read(barTabsProvider.notifier);

    return Column(
      children: [
        Container(
          height: 60,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: AppColors.kDivider)),
          ),
          child: Row(
            children: [
              _FilterChip(
                label: 'Open',
                selected: notifier.statusFilter == 'open',
                onTap: () => notifier.load(status: 'open'),
              ),
              const SizedBox(width: 8),
              _FilterChip(
                label: 'Closed',
                selected: notifier.statusFilter == 'closed',
                onTap: () => notifier.load(status: 'closed'),
              ),
              const SizedBox(width: 8),
              _FilterChip(
                label: 'All',
                selected: notifier.statusFilter == '',
                onTap: () => notifier.load(),
              ),
              const Spacer(),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: ElevatedButton.icon(
                  onPressed: () => _showCreateTabDialog(context, ref),
                  icon: Icon(PhosphorIcons.plus(), size: 18),
                  label: const Text('New Tab'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.kPrimary,
                    foregroundColor: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: AsyncValueWidget(
            value: tabsAsync,
            data: (tabs) {
              if (tabs.isEmpty) {
                return const EmptyState(message: 'No tabs found');
              }
              return RefreshIndicator(
                onRefresh: notifier.refresh,
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: tabs.length,
                  itemBuilder: (context, index) => _TabCard(tab: tabs[index]),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Future<void> _showCreateTabDialog(BuildContext context, WidgetRef ref) {
    final controller = TextEditingController();
    return showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Tab'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            hintText: 'Customer name (optional)',
            labelText: 'Customer Name',
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              ref.read(barTabsProvider.notifier).createTab(
                    CreateBarTabRequest(
                      customerName: controller.text.trim().isEmpty
                          ? null
                          : controller.text.trim(),
                    ),
                  );
              Navigator.of(ctx).pop();
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _FilterChip(
      {required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onTap(),
        selectedColor: AppColors.kPrimary,
        labelStyle: TextStyle(
          color: selected ? Colors.white : AppColors.kTextPrimary,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

class _TabCard extends ConsumerWidget {
  final BarTab tab;

  const _TabCard({required this.tab});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isOpen = tab.status == 'open';
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                    isOpen
                        ? PhosphorIcons.bookmark()
                        : PhosphorIcons.bookmarkSimple(),
                    size: 20),
                const SizedBox(width: 8),
                Text(
                  tab.customerName ?? 'Tab #${tab.id.substring(0, 8)}',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 15),
                ),
                const Spacer(),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color:
                        (isOpen ? AppColors.kSuccess : AppColors.kTextSecondary)
                            .withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    isOpen ? 'Open' : 'Closed',
                    style: TextStyle(
                      color: isOpen
                          ? AppColors.kSuccess
                          : AppColors.kTextSecondary,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'KES ${tab.runningTotal.toStringAsFixed(2)}',
                  style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: AppColors.kPrimary),
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (isOpen) ...[
                      _ActionButton(
                        icon: PhosphorIcons.x(),
                        color: AppColors.kError,
                        onTap: () => _confirmDelete(context, ref, tab.id),
                      ),
                      const SizedBox(width: 8),
                      _ActionButton(
                        icon: PhosphorIcons.wallet(),
                        color: AppColors.kPrimary,
                        onTap: () => _showCloseTabDialog(context, ref, tab),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmDelete(
      BuildContext context, WidgetRef ref, String tabId) {
    return showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Tab'),
        content: const Text('Are you sure you want to delete this tab?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              ref.read(barTabsProvider.notifier).deleteTab(tabId);
              Navigator.of(ctx).pop();
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.kError),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  Future<void> _showCloseTabDialog(
      BuildContext context, WidgetRef ref, BarTab tab) {
    return showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
            'Close Tab - ${tab.customerName ?? 'Tab #${tab.id.substring(0, 8)}'}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Outstanding: KES ${tab.runningTotal.toStringAsFixed(2)}',
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            const Text('Payment Method',
                style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              ref.read(barTabsProvider.notifier).closeTab(tab.id, 'cash');
              Navigator.of(ctx).pop();
            },
            child: const Text('Cash'),
          ),
          const SizedBox(width: 8),
          ElevatedButton(
            onPressed: () {
              ref.read(barTabsProvider.notifier).closeTab(tab.id, 'mpesa');
              Navigator.of(ctx).pop();
            },
            child: const Text('M-Pesa'),
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _ActionButton(
      {required this.icon, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, color: color, size: 18),
      ),
    );
  }
}
