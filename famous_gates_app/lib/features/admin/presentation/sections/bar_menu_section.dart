import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../domain/admin_providers.dart';
import '../../data/models/branch.dart';
import '../../data/models/menu_item.dart';
import 'package:famous_gates_app/features/admin/data/admin_repository.dart';

final _barMenuFilteredProvider = FutureProvider.autoDispose
    .family<List<AdminMenuItem>, String?>((ref, category) async {
  final repo = ref.read(adminRepositoryProvider);
  final branchId = ref.watch(adminSelectedBranchProvider);
  return repo.getMenuItems(
      branchId: branchId, category: category, menuType: 'bar');
});

final _barCategories = [
  'All',
  'Alcoholic',
  'Non-Alcoholic',
  'Spirits',
  'Wine',
  'Beer',
  'Snacks'
];

class BarMenuSection extends ConsumerStatefulWidget {
  const BarMenuSection({super.key});

  @override
  ConsumerState<BarMenuSection> createState() => _BarMenuSectionState();
}

class _BarMenuSectionState extends ConsumerState<BarMenuSection> {
  int _selectedCategory = 0;

  String? get _category => _selectedCategory == 0
      ? null
      : _barCategories[_selectedCategory].toLowerCase();

  @override
  Widget build(BuildContext context) {
    final branchesAsync = ref.watch(adminBranchesProvider);
    final itemsAsync = ref.watch(_barMenuFilteredProvider(_category));

    return Column(
      children: [
        branchesAsync.when(
          data: (branches) => _BranchSelector(branches: branches),
          loading: () => const SizedBox(height: 48),
          error: (_, __) => const SizedBox(height: 48),
        ),
        _CategoryTabBar(
          categories: _barCategories,
          selectedIndex: _selectedCategory,
          onChanged: (i) => setState(() => _selectedCategory = i),
        ),
        Expanded(
          child: itemsAsync.when(
            loading: () => const LoadingSkeleton(type: SkeletonType.grid),
            error: (e, _) => ErrorState(
              message: '$e',
              onRetry: () =>
                  ref.invalidate(_barMenuFilteredProvider(_category)),
            ),
            data: (items) => _buildGrid(items),
          ),
        ),
      ],
    );
  }

  Widget _buildGrid(List<AdminMenuItem> items) {
    return Stack(
      children: [
        if (items.isEmpty)
          Center(
            child: EmptyState(
                message: 'No bar items found', icon: PhosphorIcons.wine()),
          )
        else
          GridView.builder(
            padding: const EdgeInsets.all(24),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
              childAspectRatio: 0.85,
            ),
            itemCount: items.length,
            itemBuilder: (context, index) => _BarMenuCard(item: items[index]),
          ),
        Positioned(
          right: 24,
          bottom: 24,
          child: FloatingActionButton(
            backgroundColor: AppColors.kPrimary,
            onPressed: () => _showAddItemDialog(),
            child: Icon(PhosphorIcons.plus(), color: Colors.white),
          ),
        ),
      ],
    );
  }

  void _showAddItemDialog() {
    final nameCtrl = TextEditingController();
    final priceCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final stockCtrl = TextEditingController(text: '0');
    String category = 'Alcoholic';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Bar Item'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Item Name')),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: category,
                decoration: const InputDecoration(labelText: 'Category'),
                items: _barCategories
                    .skip(1)
                    .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                    .toList(),
                onChanged: (v) => category = v ?? category,
              ),
              const SizedBox(height: 12),
              TextField(
                  controller: priceCtrl,
                  decoration: const InputDecoration(labelText: 'Price'),
                  keyboardType: TextInputType.number),
              const SizedBox(height: 12),
              TextField(
                  controller: stockCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Stock Quantity'),
                  keyboardType: TextInputType.number),
              const SizedBox(height: 12),
              TextField(
                  controller: descCtrl,
                  decoration: const InputDecoration(labelText: 'Description'),
                  maxLines: 3),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (nameCtrl.text.isEmpty) return;
              await ref.read(adminRepositoryProvider).createMenuItem({
                'name': nameCtrl.text,
                'category': category.toLowerCase(),
                'price': double.tryParse(priceCtrl.text) ?? 0,
                'description': descCtrl.text,
                'menu_type': 'bar',
                'stock_quantity': int.tryParse(stockCtrl.text) ?? 0,
                'is_available': true,
              });
              if (ctx.mounted) Navigator.pop(ctx);
              ref.invalidate(_barMenuFilteredProvider(_category));
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }
}

class _BranchSelector extends ConsumerWidget {
  final List<AdminBranch> branches;

  const _BranchSelector({required this.branches});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedId = ref.watch(adminSelectedBranchProvider);
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
                onChanged: (v) =>
                    ref.read(adminSelectedBranchProvider.notifier).state = v,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CategoryTabBar extends StatelessWidget {
  final List<String> categories;
  final int selectedIndex;
  final ValueChanged<int> onChanged;

  const _CategoryTabBar({
    required this.categories,
    required this.selectedIndex,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      color: Colors.white,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 24),
        itemCount: categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 4),
        itemBuilder: (context, index) {
          final isSelected = index == selectedIndex;
          return GestureDetector(
            onTap: () => onChanged(index),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              margin: const EdgeInsets.symmetric(vertical: 8),
              decoration: BoxDecoration(
                color: isSelected ? AppColors.kPrimary : AppColors.kSurface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                    color:
                        isSelected ? AppColors.kPrimary : AppColors.kDivider),
              ),
              child: Center(
                child: Text(
                  categories[index],
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight:
                        isSelected ? FontWeight.w600 : FontWeight.normal,
                    color: isSelected ? Colors.white : AppColors.kTextSecondary,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _BarMenuCard extends StatelessWidget {
  final AdminMenuItem item;

  const _BarMenuCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final isLow = item.isLowStock || item.stockQuantity <= item.reorderLevel;
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
            color: isLow
                ? AppColors.kWarning.withValues(alpha: 0.5)
                : AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              Container(
                height: 100,
                decoration: const BoxDecoration(
                  color: AppColors.kSurface,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
                ),
                child: Center(
                  child: Icon(PhosphorIcons.wine(),
                      size: 40, color: AppColors.kDivider),
                ),
              ),
              if (isLow)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppColors.kWarning,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Text('LOW STOCK',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.bold)),
                  ),
                ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.name,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 14),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                const SizedBox(height: 4),
                Text('KES ${item.price.toStringAsFixed(0)}',
                    style: const TextStyle(
                        color: AppColors.kAccent,
                        fontWeight: FontWeight.bold,
                        fontSize: 16)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(PhosphorIcons.package(),
                        size: 14, color: AppColors.kTextSecondary),
                    const SizedBox(width: 4),
                    Text('Stock: ${item.stockQuantity}',
                        style: TextStyle(
                            fontSize: 12,
                            color: isLow
                                ? AppColors.kWarning
                                : AppColors.kTextSecondary)),
                    const Spacer(),
                    Container(
                      width: 40,
                      height: 22,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        color: item.isAvailable
                            ? AppColors.kSuccess.withValues(alpha: 0.15)
                            : AppColors.kDivider,
                      ),
                      child: Center(
                        child: Text(
                          item.isAvailable ? 'ON' : 'OFF',
                          style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: item.isAvailable
                                  ? AppColors.kSuccess
                                  : AppColors.kTextSecondary),
                        ),
                      ),
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
}
