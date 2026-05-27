import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../widgets/stat_card.dart';
import '../widgets/admin_table.dart';

enum _KitchenTab { overview, recipes, foodControls, wastage, requisitions }

final _kitchenDataProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return {
    'prep_today': 45,
    'orders_pending': 12,
    'low_stock_items': 8,
    'wastage_today': 2,
    'recipes': List.generate(
        10,
        (i) => {
              'name': 'Chicken Tikka Masala${i > 0 ? ' $i' : ''}',
              'category': ['Main Course', 'Appetizer', 'Dessert'][i % 3],
              'ingredients_count': 6 + i,
              'cost': 1200.0 + (i * 150),
            }),
    'wastage': List.generate(
        5,
        (i) => {
              'item': 'Tomatoes',
              'quantity': '${i + 1} kg',
              'reason': [
                'Spoiled',
                'Over-prepped',
                'Expired',
                'Burnt',
                'Contaminated'
              ][i],
              'cost': 500.0 * (i + 1),
              'recorded_by': 'Chef ${String.fromCharCode(65 + i)}',
              'date': DateTime.now().subtract(Duration(days: i)),
            }),
    'requisitions': List.generate(
        6,
        (i) => {
              'item': 'Chicken Breast',
              'quantity': '${(i + 1) * 5} kg',
              'from_branch': ['Nairobi', 'Mombasa', 'Kisumu'][i % 3],
              'status': ['pending', 'approved', 'rejected'][i % 3],
            }),
  };
});

class KitchenSection extends ConsumerStatefulWidget {
  const KitchenSection({super.key});

  @override
  ConsumerState<KitchenSection> createState() => _KitchenSectionState();
}

class _KitchenSectionState extends ConsumerState<KitchenSection> {
  _KitchenTab _currentTab = _KitchenTab.overview;
  DateTime? _wastageFrom;
  DateTime? _wastageTo;

  @override
  Widget build(BuildContext context) {
    final dataAsync = ref.watch(_kitchenDataProvider);

    return Column(
      children: [
        _SubTabBar(
          tabs: _KitchenTab.values,
          selected: _currentTab,
          onChanged: (tab) => setState(() => _currentTab = tab),
        ),
        Expanded(
          child: dataAsync.when(
            loading: () => const TabbedSkeleton(tabCount: 5),
            error: (e, _) => ErrorState(
              message: '$e',
              onRetry: () => ref.invalidate(_kitchenDataProvider),
            ),
            data: (data) => _buildContent(data),
          ),
        ),
      ],
    );
  }

  Widget _buildContent(Map<String, dynamic> data) {
    switch (_currentTab) {
      case _KitchenTab.overview:
        return _OverviewTab(data: data);
      case _KitchenTab.recipes:
        return _RecipesTab(data: data);
      case _KitchenTab.foodControls:
        return _FoodControlsTab();
      case _KitchenTab.wastage:
        return _WastageTab(
            data: data,
            from: _wastageFrom,
            to: _wastageTo,
            onFromChanged: (d) => setState(() => _wastageFrom = d),
            onToChanged: (d) => setState(() => _wastageTo = d));
      case _KitchenTab.requisitions:
        return _RequisitionsTab(data: data, ref: ref);
    }
  }
}

class _SubTabBar extends StatelessWidget {
  final List<_KitchenTab> tabs;
  final _KitchenTab selected;
  final ValueChanged<_KitchenTab> onChanged;

  const _SubTabBar(
      {required this.tabs, required this.selected, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      color: Colors.white,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 24),
        itemCount: tabs.length,
        separatorBuilder: (_, __) => const SizedBox(width: 4),
        itemBuilder: (context, index) {
          final tab = tabs[index];
          final isSelected = tab == selected;
          return GestureDetector(
            onTap: () => onChanged(tab),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              margin: const EdgeInsets.symmetric(vertical: 8),
              decoration: BoxDecoration(
                color: isSelected ? AppColors.kPrimary : Colors.transparent,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                    color:
                        isSelected ? AppColors.kPrimary : AppColors.kDivider),
              ),
              child: Center(
                child: Text(
                  tab.name
                      .split('.')
                      .last
                      .replaceAllMapped(
                          RegExp(r'[A-Z]'), (m) => ' ${m.group(0)}')
                      .trim(),
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

class _OverviewTab extends StatelessWidget {
  final Map<String, dynamic> data;

  const _OverviewTab({required this.data});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                  child: AdminStatCard(
                      label: 'Prep Today',
                      value: '${data['prep_today'] ?? 0}',
                      icon: PhosphorIcons.cube(),
                      color: AppColors.kPrimary)),
              const SizedBox(width: 16),
              Expanded(
                  child: AdminStatCard(
                      label: 'Orders Pending',
                      value: '${data['orders_pending'] ?? 0}',
                      icon: PhosphorIcons.creditCard(),
                      color: AppColors.kWarning)),
              const SizedBox(width: 16),
              Expanded(
                  child: AdminStatCard(
                      label: 'Low Stock Items',
                      value: '${data['low_stock_items'] ?? 0}',
                      icon: PhosphorIcons.warningCircle(),
                      color: AppColors.kError)),
              const SizedBox(width: 16),
              Expanded(
                  child: AdminStatCard(
                      label: 'Wastage Today',
                      value: '${data['wastage_today'] ?? 0}',
                      icon: PhosphorIcons.prohibit(),
                      color: AppColors.kTextSecondary)),
            ],
          ),
        ],
      ),
    );
  }
}

class _RecipesTab extends StatelessWidget {
  final Map<String, dynamic> data;

  const _RecipesTab({required this.data});

  @override
  Widget build(BuildContext context) {
    final recipes = data['recipes'] as List? ?? [];
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Recipes', style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 16),
          AdminTable(
            columns: const [
              'Name',
              'Category',
              'Ingredients',
              'Cost',
              'Actions'
            ],
            rows: recipes.map((r) {
              final recipe = r as Map<String, dynamic>;
              return [
                Text('${recipe['name']}',
                    style: const TextStyle(fontWeight: FontWeight.w500)),
                Text('${recipe['category']}'),
                Text('${recipe['ingredients_count']} items'),
                Text('KES ${(recipe['cost'] as num).toStringAsFixed(0)}'),
                Icon(PhosphorIcons.magnifyingGlass(),
                    size: 18, color: AppColors.kPrimary),
              ];
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _FoodControlsTab extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: EmptyState(
          message: 'Food controls data will appear here',
          icon: PhosphorIcons.bookmark()),
    );
  }
}

class _WastageTab extends StatelessWidget {
  final Map<String, dynamic> data;
  final DateTime? from;
  final DateTime? to;
  final ValueChanged<DateTime?> onFromChanged;
  final ValueChanged<DateTime?> onToChanged;

  const _WastageTab({
    required this.data,
    required this.from,
    required this.to,
    required this.onFromChanged,
    required this.onToChanged,
  });

  @override
  Widget build(BuildContext context) {
    final wastage = data['wastage'] as List? ?? [];
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Wastage Records',
                  style: Theme.of(context).textTheme.displaySmall),
              const Spacer(),
              _DateFilter(label: 'From', date: from, onChanged: onFromChanged),
              const SizedBox(width: 12),
              _DateFilter(label: 'To', date: to, onChanged: onToChanged),
            ],
          ),
          const SizedBox(height: 16),
          AdminTable(
            columns: const [
              'Item',
              'Quantity',
              'Reason',
              'Cost',
              'Recorded By'
            ],
            rows: wastage.map((w) {
              final entry = w as Map<String, dynamic>;
              return [
                Text('${entry['item']}'),
                Text('${entry['quantity']}'),
                Text('${entry['reason']}'),
                Text('KES ${(entry['cost'] as num).toStringAsFixed(0)}'),
                Text('${entry['recorded_by']}'),
              ];
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _DateFilter extends StatelessWidget {
  final String label;
  final DateTime? date;
  final ValueChanged<DateTime?> onChanged;

  const _DateFilter(
      {required this.label, required this.date, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () async {
        final picked = await showDatePicker(
            context: context,
            initialDate: date ?? DateTime.now(),
            firstDate: DateTime(2020),
            lastDate: DateTime.now());
        if (picked != null) onChanged(picked);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.kDivider),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(label,
                style: const TextStyle(
                    color: AppColors.kTextSecondary, fontSize: 12)),
            const SizedBox(width: 8),
            Text(
                date != null
                    ? '${date!.day}/${date!.month}/${date!.year}'
                    : 'All',
                style: const TextStyle(fontSize: 12)),
          ],
        ),
      ),
    );
  }
}

class _RequisitionsTab extends StatelessWidget {
  final Map<String, dynamic> data;
  final WidgetRef ref;

  const _RequisitionsTab({required this.data, required this.ref});

  @override
  Widget build(BuildContext context) {
    final requisitions = data['requisitions'] as List? ?? [];
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Stock Requisitions',
              style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 16),
          AdminTable(
            columns: const [
              'Item',
              'Quantity',
              'From Branch',
              'Status',
              'Actions'
            ],
            rows: requisitions.map((r) {
              final req = r as Map<String, dynamic>;
              final status = '${req['status']}';
              return [
                Text('${req['item']}'),
                Text('${req['quantity']}'),
                Text('${req['from_branch']}'),
                StatusBadge(status: status),
                status == 'pending'
                    ? Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: Icon(PhosphorIcons.checkCircle(),
                                color: AppColors.kSuccess, size: 20),
                            onPressed: () => AppNotifier.showSnackBar(
                                context,
                                SnackBar(
                                    content: Text(
                                        'Requisition for ${req['item']} approved'))),
                            tooltip: 'Approve',
                          ),
                          IconButton(
                            icon: Icon(PhosphorIcons.x(),
                                color: AppColors.kError, size: 20),
                            onPressed: () => AppNotifier.showSnackBar(
                                context,
                                SnackBar(
                                    content: Text(
                                        'Requisition for ${req['item']} rejected'))),
                            tooltip: 'Reject',
                          ),
                        ],
                      )
                    : Text(status == 'approved' ? 'Approved' : 'Rejected',
                        style: TextStyle(
                            color: status == 'approved'
                                ? AppColors.kSuccess
                                : AppColors.kError,
                            fontSize: 12)),
              ];
            }).toList(),
          ),
        ],
      ),
    );
  }
}
