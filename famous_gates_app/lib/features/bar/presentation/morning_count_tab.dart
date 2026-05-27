import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/bar_repository.dart';
import '../domain/bar_providers.dart';
import '../domain/models.dart';

class MorningCountTab extends ConsumerWidget {
  const MorningCountTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final itemsAsync = ref.watch(morningCountProvider);

    return Column(
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.kPrimary.withValues(alpha: 0.05),
            border: const Border(bottom: BorderSide(color: AppColors.kDivider)),
          ),
          child: Row(
            children: [
              Icon(PhosphorIcons.sun(), color: AppColors.kPrimary, size: 24),
              const SizedBox(width: 12),
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Morning Stock Count',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  Text(
                    'Record physical counts for opening stock',
                    style: TextStyle(
                        color: AppColors.kTextSecondary, fontSize: 13),
                  ),
                ],
              ),
            ],
          ),
        ),
        Expanded(
          child: AsyncValueWidget(
            value: itemsAsync,
            loading: const TabbedSkeleton(),
            data: (items) {
              if (items.isEmpty) {
                return const EmptyState(message: 'No stock items to count');
              }
              return _MorningCountForm(items: items);
            },
          ),
        ),
      ],
    );
  }
}

class _MorningCountForm extends ConsumerStatefulWidget {
  final List<MorningCountItem> items;

  const _MorningCountForm({required this.items});

  @override
  ConsumerState<_MorningCountForm> createState() => _MorningCountFormState();
}

class _MorningCountFormState extends ConsumerState<_MorningCountForm> {
  late List<MorningCountItem> _items;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _items = widget.items
        .map((item) => MorningCountItem(
              drinkId: item.drinkId,
              name: item.name,
              category: item.category,
              systemQuantity: item.systemQuantity,
              physicalCount: item.physicalCount,
            ))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final grouped = <String, List<MorningCountItem>>{};
    for (final item in _items) {
      final cat = item.category ?? 'Uncategorized';
      grouped.putIfAbsent(cat, () => []).add(item);
    }

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: grouped.entries.map((entry) {
              return _CategoryGroup(
                categoryName: entry.key,
                items: entry.value,
                onChanged: (index, value) {
                  setState(() {
                    _items[_items.indexOf(entry.value[index])].physicalCount =
                        value;
                  });
                },
              );
            }).toList(),
          ),
        ),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: AppColors.kDivider)),
          ),
          child: SafeArea(
            child: SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton.icon(
                onPressed: _isSubmitting ? null : _submit,
                icon: _isSubmitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : Icon(PhosphorIcons.check(), size: 20),
                label: Text(
                    _isSubmitting ? 'Submitting...' : 'Submit Morning Count'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.kPrimary,
                  foregroundColor: Colors.white,
                  textStyle: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _submit() async {
    setState(() => _isSubmitting = true);
    try {
      final repo = ref.read(barRepositoryProvider);
      await repo.submitStockTake(
        StockTakeSubmission(countType: 'morning_opening', items: _items),
      );
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          const SnackBar(
              content: Text('Morning count submitted successfully.')),
        );
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          SnackBar(content: Text('Failed to submit: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }
}

class _CategoryGroup extends StatelessWidget {
  final String categoryName;
  final List<MorningCountItem> items;
  final void Function(int index, double value) onChanged;

  const _CategoryGroup({
    required this.categoryName,
    required this.items,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              categoryName,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
                color: AppColors.kPrimary,
              ),
            ),
            const Divider(),
            ...items.asMap().entries.map((entry) {
              final index = entry.key;
              final item = entry.value;
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item.name,
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold, fontSize: 14)),
                          Text(
                            'System: ${item.systemQuantity.toStringAsFixed(1)}',
                            style: const TextStyle(
                                color: AppColors.kTextSecondary, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(
                      width: 120,
                      child: TextField(
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                        controller: TextEditingController(
                          text: item.physicalCount == item.systemQuantity
                              ? ''
                              : item.physicalCount.toStringAsFixed(1),
                        ),
                        decoration: InputDecoration(
                          hintText: item.systemQuantity.toStringAsFixed(1),
                          isDense: true,
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 10),
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8)),
                        ),
                        onChanged: (val) {
                          final parsed = double.tryParse(val);
                          onChanged(index, parsed ?? item.systemQuantity);
                        },
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}
