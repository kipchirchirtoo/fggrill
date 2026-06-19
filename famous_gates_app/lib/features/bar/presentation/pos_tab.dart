import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/bar_repository.dart';
import '../domain/bar_providers.dart';
import '../domain/models.dart';

final barCartProvider = StateProvider<Map<String, int>>((ref) => {});

class BarPOSTab extends ConsumerWidget {
  const BarPOSTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final drinksAsync = ref.watch(barDrinksProvider);
    final categoriesAsync = ref.watch(barCategoriesProvider);

    return Row(
      children: [
        Expanded(
          flex: 3,
          child: Column(
            children: [
              _CategoryBar(categoriesAsync: categoriesAsync),
              Expanded(
                child: AsyncValueWidget(
                  value: drinksAsync,
                  data: (drinks) {
                    final selectedCat = ref.watch(selectedBarCategoryProvider);
                    
                    // Filter by category
                    var filtered = selectedCat == null
                        ? drinks
                        : drinks
                            .where((d) => d.categoryId == selectedCat)
                            .toList();
                    
                    // Filter out unavailable items (out of stock or disabled)
                    // Only show items that are available and have stock > 0
                    filtered = filtered.where((d) => 
                      d.isAvailable && (d.stockQuantity == null || d.stockQuantity! > 0)
                    ).toList();
                    
                    if (filtered.isEmpty) {
                      return const EmptyState(
                          message: 'No drinks available in this category');
                    }
                    return RefreshIndicator(
                      onRefresh: () => ref.refresh(barDrinksProvider.future),
                      child: GridView.builder(
                        padding: const EdgeInsets.all(16),
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 4,
                          childAspectRatio: 0.85,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                        ),
                        itemCount: filtered.length,
                        itemBuilder: (context, index) =>
                            _DrinkCard(drink: filtered[index]),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        Container(width: 1, color: AppColors.kDivider),
        Expanded(flex: 2, child: _OrderPanel()),
      ],
    );
  }
}

final selectedBarCategoryProvider = StateProvider<String?>((ref) => null);

/// Which bar POS station this screen represents. Defaults to the main bar;
/// an Executive Bar screen overrides this to 'executive_bar'.
final barStationProvider = StateProvider<String>((ref) => 'main_bar');

class _CategoryBar extends ConsumerWidget {
  final AsyncValue<List<BarCategory>> categoriesAsync;

  const _CategoryBar({required this.categoriesAsync});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      height: 60,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.kDivider)),
      ),
      child: categoriesAsync.when(
        loading: () => const Center(
            child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2))),
        error: (_, __) => const SizedBox.shrink(),
        data: (categories) {
          final selected = ref.watch(selectedBarCategoryProvider);
          return ListView(
            scrollDirection: Axis.horizontal,
            children: [
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                child: ChoiceChip(
                  label: const Text('All'),
                  selected: selected == null,
                  onSelected: (_) => ref
                      .read(selectedBarCategoryProvider.notifier)
                      .state = null,
                  selectedColor: AppColors.kPrimary,
                  labelStyle: TextStyle(
                    color: selected == null
                        ? Colors.white
                        : AppColors.kTextPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              ...categories.map((cat) {
                final isSelected = selected == cat.id;
                return Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                  child: ChoiceChip(
                    label: Text(cat.name),
                    selected: isSelected,
                    onSelected: (_) => ref
                        .read(selectedBarCategoryProvider.notifier)
                        .state = cat.id,
                    selectedColor: AppColors.kPrimary,
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.white : AppColors.kTextPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                );
              }),
            ],
          );
        },
      ),
    );
  }
}

class _DrinkCard extends ConsumerWidget {
  final BarDrink drink;

  const _DrinkCard({required this.drink});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stockQty = drink.stockQuantity ?? 999;
    final isOutOfStock = stockQty <= 0;
    
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: isOutOfStock ? null : () {
          // Check stock before adding to cart
          if (stockQty <= 0) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('${drink.name} is out of stock'),
                backgroundColor: AppColors.kError,
              ),
            );
            return;
          }
          
          ref.read(barCartProvider.notifier).update((state) {
            final next = Map<String, int>.from(state);
            next.update(drink.id, (v) => v + 1, ifAbsent: () => 1);
            return next;
          });
        },
        child: Opacity(
          opacity: isOutOfStock ? 0.5 : 1.0,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Container(
                  width: double.infinity,
                  color: AppColors.kSurface,
                  child: Stack(
                    children: [
                      Center(
                        child: Icon(
                          PhosphorIcons.wine(),
                          size: 40,
                          color: isOutOfStock ? AppColors.kError : AppColors.kDivider,
                        ),
                      ),
                      if (stockQty <= 0)
                        Positioned(
                          top: 8,
                          right: 8,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.kError,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text(
                              'OUT',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 8,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        )
                      else if (stockQty < 10)
                        Positioned(
                          top: 8,
                          right: 8,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.kWarning,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text(
                              'LOW',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 8,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      drink.name,
                      style: TextStyle(
                        fontWeight: FontWeight.bold, 
                        fontSize: 13,
                        color: isOutOfStock ? AppColors.kTextSecondary : AppColors.kTextPrimary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'KES ${drink.price.toStringAsFixed(0)}',
                      style: TextStyle(
                        color: isOutOfStock ? AppColors.kTextSecondary : AppColors.kAccent,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                    if (drink.stockQuantity != null)
                      Text(
                        isOutOfStock 
                          ? 'Out of Stock' 
                          : 'Stock: ${drink.stockQuantity!.toStringAsFixed(0)}',
                        style: TextStyle(
                          color: isOutOfStock ? AppColors.kError : AppColors.kTextSecondary, 
                          fontSize: 10,
                          fontWeight: isOutOfStock ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OrderPanel extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(barCartProvider);
    final drinksAsync = ref.watch(barDrinksProvider);
    final drinks = drinksAsync.asData?.value ?? [];

    final cartItems = cart.entries.map((e) {
      final drink =
          drinks.firstWhere((d) => d.id == e.key, orElse: () => drinks.first);
      return _CartItemDisplay(drink: drink, qty: e.value);
    }).toList();

    final subtotal = cart.entries.fold<double>(0, (sum, e) {
      final drink =
          drinks.firstWhere((d) => d.id == e.key, orElse: () => drinks.first);
      return sum + drink.price * e.value;
    });

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Bar Order',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              _TabSelector(),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
            child: cart.isEmpty
                ? const Center(child: Text('Tap a drink to add it here.'))
                : ListView.separated(
                    itemCount: cartItems.length,
                    separatorBuilder: (_, __) => const Divider(height: 20),
                    itemBuilder: (context, index) => cartItems[index],
                  ),
          ),
          if (cart.isNotEmpty) ...[
            const Divider(height: 32),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Total',
                    style:
                        TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                Text(
                  'KES ${subtotal.toStringAsFixed(2)}',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppColors.kPrimary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => _processOrder(context, ref, cart, subtotal),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.kSuccess,
                minimumSize: const Size(double.infinity, 56),
              ),
              child: const Text(
                'PROCESS ORDER',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _processOrder(BuildContext context, WidgetRef ref,
      Map<String, int> cart, double subtotal) async {
    if (cart.isEmpty) return;
    final drinks = ref.read(barDrinksProvider).asData?.value ?? [];
    final items = cart.entries.map((e) {
      final drink = drinks.firstWhere((d) => d.id == e.key);
      return BarOrderItem(
        drinkId: drink.id,
        name: drink.name,
        quantity: e.value,
        unitPrice: drink.price,
      );
    }).toList();

    try {
      await ref.read(barRepositoryProvider).createOrder(
            CreateBarOrderRequest(
              items: items,
              totalAmount: subtotal,
              // This is the Main Bar POS station; routes the bill to the
              // main-bar cashier and requires their shift to be open.
              // (The Executive Bar screen sends 'executive_bar'.)
              outletType: ref.read(barStationProvider),
            ),
          );
      ref.read(barCartProvider.notifier).state = {};
      if (context.mounted) {
        AppNotifier.showSnackBar(
            context, const SnackBar(content: Text('Order placed.')));
      }
    } catch (e) {
      if (context.mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text('Failed: $e')));
      }
    }
  }
}

class _TabSelector extends ConsumerStatefulWidget {
  @override
  _TabSelectorState createState() => _TabSelectorState();
}

class _TabSelectorState extends ConsumerState<_TabSelector> {
  String _mode = 'walkin';

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      onSelected: (v) => setState(() => _mode = v),
      itemBuilder: (context) => [
        const PopupMenuItem(value: 'walkin', child: Text('Walk-in')),
        const PopupMenuItem(value: 'tab', child: Text('Open Tab')),
      ],
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.kDivider),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
                _mode == 'walkin'
                    ? PhosphorIcons.user()
                    : PhosphorIcons.bookmark(),
                size: 16),
            const SizedBox(width: 6),
            Text(_mode == 'walkin' ? 'Walk-in' : 'Tab',
                style: const TextStyle(fontSize: 13)),
          ],
        ),
      ),
    );
  }
}

class _CartItemDisplay extends ConsumerWidget {
  final BarDrink drink;
  final int qty;

  const _CartItemDisplay({required this.drink, required this.qty});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(drink.name,
                  style: const TextStyle(fontWeight: FontWeight.bold)),
              Text(
                '${drink.price.toStringAsFixed(0)} x $qty',
                style: const TextStyle(
                    color: AppColors.kTextSecondary, fontSize: 12),
              ),
            ],
          ),
        ),
        IconButton(
          icon: const Icon(Icons.remove_circle_outline, size: 20),
          onPressed: () {
            ref.read(barCartProvider.notifier).update((state) {
              final next = Map<String, int>.from(state);
              final current = next[drink.id] ?? 0;
              if (current <= 1) {
                next.remove(drink.id);
              } else {
                next[drink.id] = current - 1;
              }
              return next;
            });
          },
        ),
        Text('$qty'),
        IconButton(
          icon: const Icon(Icons.add_circle_outline, size: 20),
          onPressed: () {
            ref.read(barCartProvider.notifier).update((state) {
              final next = Map<String, int>.from(state);
              next.update(drink.id, (v) => v + 1, ifAbsent: () => 1);
              return next;
            });
          },
        ),
        SizedBox(
          width: 80,
          child: Text(
            'KES ${(drink.price * qty).toStringAsFixed(0)}',
            textAlign: TextAlign.end,
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
        ),
      ],
    );
  }
}
