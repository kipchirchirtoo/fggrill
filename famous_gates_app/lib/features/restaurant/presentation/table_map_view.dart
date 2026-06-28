import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';
import '../../auth/domain/auth_notifier.dart';
import '../../kitchen/domain/models.dart';
import '../../kitchen/domain/providers.dart';
import '../../pos/data/outlet_pos_repository.dart';
import '../../pos/domain/models.dart';
import '../../pos/domain/pos_providers.dart';
import '../../templates/data/document_printer.dart';
import '../data/repository.dart';
import '../domain/models.dart';
import '../domain/providers.dart';

class TableMapView extends ConsumerStatefulWidget {
  const TableMapView({super.key});

  @override
  ConsumerState<TableMapView> createState() => _TableMapViewState();
}

class _TableMapViewState extends ConsumerState<TableMapView>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final _tableController = TextEditingController();
  final _roomController = TextEditingController();
  final _customerController = TextEditingController();
  final _searchController = TextEditingController();
  String _orderType = 'dine_in';
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _tableController.dispose();
    _roomController.dispose();
    _customerController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Shortcuts(
      shortcuts: {
        LogicalKeySet(LogicalKeyboardKey.control, LogicalKeyboardKey.keyN):
            const _NewOrderIntent(),
        LogicalKeySet(LogicalKeyboardKey.control, LogicalKeyboardKey.keyS):
            const _SendOrderIntent(),
      },
      child: Actions(
        actions: {
          _NewOrderIntent: CallbackAction<_NewOrderIntent>(
            onInvoke: (_) {
              _clearOrder();
              return null;
            },
          ),
          _SendOrderIntent: CallbackAction<_SendOrderIntent>(
            onInvoke: (_) {
              _sendToKitchen();
              return null;
            },
          ),
        },
        child: Scaffold(
          backgroundColor: AppColors.kSurface,
          appBar: AppBar(
            leading: IconButton(
              tooltip: 'Back to terminal',
              onPressed: () {
                final router = GoRouter.of(context);
                if (router.canPop()) {
                  router.pop();
                } else {
                  router.go('/terminal?hub=1');
                }
              },
              icon: const Icon(Icons.arrow_back_ios_new_rounded),
            ),
            title: const Text('POS Kitchen'),
            backgroundColor: AppColors.kPrimary,
            foregroundColor: Colors.white,
            actions: [
              if (ref.read(authNotifierProvider).valueOrNull != null)
                Padding(
                  padding: const EdgeInsets.only(right: 4),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircleAvatar(
                        radius: 12,
                        backgroundColor: Colors.white24,
                        child: Text(
                            ref
                                    .read(authNotifierProvider)
                                    .valueOrNull!
                                    .name
                                    .isNotEmpty
                                ? ref
                                    .read(authNotifierProvider)
                                    .valueOrNull!
                                    .name[0]
                                    .toUpperCase()
                                : '?',
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.bold)),
                      ),
                      const SizedBox(width: 4),
                      Text(
                          ref
                              .read(authNotifierProvider)
                              .valueOrNull!
                              .name
                              .split(' ')
                              .first,
                          style: const TextStyle(
                              color: Colors.white70, fontSize: 12)),
                    ],
                  ),
                ),
              IconButton(
                tooltip: 'Settings',
                onPressed: () => context.push('/settings'),
                icon: const Icon(Icons.settings_outlined, color: Colors.white70),
              ),
              IconButton(
                onPressed: () async {
                  final confirmed = await showDialog<bool>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      title: const Text('Logout?'),
                      content: const Text('Are you sure you want to logout?'),
                      actions: [
                        TextButton(
                            onPressed: () => Navigator.of(ctx).pop(false),
                            child: const Text('Cancel')),
                        ElevatedButton(
                            onPressed: () => Navigator.of(ctx).pop(true),
                            child: const Text('Logout')),
                      ],
                    ),
                  );
                  if (confirmed == true && context.mounted) {
                    await ref.read(authNotifierProvider.notifier).logout();
                    if (context.mounted) context.go('/terminal');
                  }
                },
                icon: const Icon(Icons.logout, color: Colors.white70),
              ),
            ],
            bottom: TabBar(
              controller: _tabController,
              indicatorColor: Colors.white,
              labelColor: Colors.white,
              unselectedLabelColor: Colors.white70,
              tabs: const [
                Tab(icon: Icon(Icons.restaurant_menu), text: 'Restaurant'),
                Tab(icon: Icon(Icons.soup_kitchen), text: 'Kitchen'),
                Tab(icon: Icon(Icons.receipt_long), text: 'Recent'),
              ],
            ),
          ),
          body: TabBarView(
            controller: _tabController,
            children: [
              _buildRestaurantPos(),
              _buildKitchenDisplay(),
              _buildRecentOrders(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRestaurantPos() {
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 900;
        final menu = _MenuPane(searchController: _searchController);
        final order = _OrderPane(
          orderType: _orderType,
          tableController: _tableController,
          roomController: _roomController,
          customerController: _customerController,
          isSubmitting: _isSubmitting,
          onOrderTypeChanged: (value) => setState(() => _orderType = value),
          onClear: _clearOrder,
          onSubmit: _sendToKitchen,
        );
        if (compact) {
          return Column(
            children: [
              Expanded(flex: 3, child: menu),
              const Divider(height: 1),
              SizedBox(height: 360, child: order),
            ],
          );
        }
        return Row(
          children: [
            Expanded(flex: 3, child: menu),
            Container(width: 1, color: AppColors.kDivider),
            SizedBox(width: 430, child: order),
          ],
        );
      },
    );
  }

  Widget _buildKitchenDisplay() {
    final ordersAsync = ref.watch(kdsOrdersProvider);
    return Container(
      color: const Color(0xFF111111),
      child: ordersAsync.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(color: Colors.white)),
        error: (error, _) => _DarkRetryState(
          message: 'Could not load kitchen orders',
          onRetry: () => ref.read(kdsOrdersProvider.notifier).start(),
        ),
        data: (orders) {
          if (orders.isEmpty) {
            return const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check_circle, color: Colors.green, size: 56),
                  SizedBox(height: 12),
                  Text('All orders completed',
                      style: TextStyle(color: Colors.white70, fontSize: 18)),
                ],
              ),
            );
          }

          final pending = orders
              .where((o) => o.status == 'pending' || o.status == 'confirmed')
              .toList();
          final preparing =
              orders.where((o) => o.status == 'preparing').toList();
          final ready = orders.where((o) => o.status == 'ready').toList();
          final activeOrders = [...pending, ...preparing];
          final avgWait = activeOrders.isEmpty
              ? 0
              : activeOrders.fold<int>(
                      0, (sum, o) => sum + o.elapsed.inMinutes) ~/
                  activeOrders.length;

          return Column(
            children: [
              _KdsStatsBar(
                pending: pending.length,
                preparing: preparing.length,
                avgWait: avgWait,
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (pending.isNotEmpty)
                      _OrderGroup(
                        label: 'Pending',
                        orders: pending,
                        color: Colors.amber,
                      ),
                    if (preparing.isNotEmpty)
                      _OrderGroup(
                        label: 'Preparing',
                        orders: preparing,
                        color: Colors.blue,
                      ),
                    if (ready.isNotEmpty)
                      _OrderGroup(
                        label: 'Ready',
                        orders: ready,
                        color: Colors.green,
                      ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildRecentOrders() {
    final ordersAsync = ref.watch(restaurantRecentOrdersProvider);
    return ordersAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => _RetryState(
        message: 'Could not load recent orders',
        onRetry: () => ref.invalidate(restaurantRecentOrdersProvider),
      ),
      data: (orders) {
        if (orders.isEmpty) {
          return const Center(child: Text('No recent restaurant orders.'));
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(restaurantRecentOrdersProvider),
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: orders.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) =>
                _RecentOrderTile(order: orders[index]),
          ),
        );
      },
    );
  }

  Future<void> _sendToKitchen() async {
    final cart = ref.read(cartNotifierProvider);
    if (cart.items.isEmpty || _isSubmitting) return;

    setState(() => _isSubmitting = true);
    try {
      final user = ref.read(authNotifierProvider).valueOrNull;
      final request = CreateRestaurantOrderRequest(
        orderType: _orderType,
        tableNumber: _tableController.text.trim(),
        roomNumber: _roomController.text.trim(),
        customerName: _customerController.text.trim(),
        paymentMethod: 'cash',
        waiterName: user?.name,
        items: cart.items
            .map((item) => RestaurantOrderItem(
                  id: item.productId,
                  name: item.name,
                  quantity: item.qty,
                  unitPrice: item.unitPrice,
                ))
            .toList(),
        total: cart.subtotal,
      );
      final orderResult =
          await ref.read(restaurantRepositoryProvider).createOrder(request);
      _clearOrder();
      ref.invalidate(restaurantRecentOrdersProvider);
      ref.read(kdsOrdersProvider.notifier).start();
      _generateProformaBill(request, orderResult);
    } catch (error) {
      _showMessage('$error');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _generateProformaBill(CreateRestaurantOrderRequest request,
      Map<String, dynamic> orderResult) async {
    final orderData =
        orderResult['data'] as Map<String, dynamic>? ?? orderResult;
    final receiptNumber =
        '${orderData['order_number'] ?? orderData['orderNumber'] ?? ''}';
    final shortCode =
        '${orderData['short_code'] ?? orderData['shortCode'] ?? ''}'.trim();

    final branchName = await ref
            .read(secureStorageProvider)
            .read(key: AuthRepository.branchNameKey) ??
        'Famous Gates';
    final cashierName = request.waiterName ?? '';

    final sale = SaleResult(
      transactionId: '${orderData['id'] ?? ''}',
      createdAt: DateTime.now(),
      receiptNumber: receiptNumber,
      cashierName: cashierName,
      total: request.total,
      paymentMethod: request.paymentMethod,
    );

    final items = request.items
        .map((item) => CartItem(
              productId: item.id,
              name: item.name,
              unitPrice: item.unitPrice,
              qty: item.quantity,
            ))
        .toList();

    try {
      final user = ref.read(authNotifierProvider).valueOrNull;
      // The logged-in user's outletId is only set for PIN-based outlet
      // logins. Waiters using the table map authenticate at branch level, so
      // resolve the branch's actual Restaurant POS outlet here — that's the
      // outlet whose till number (set in SuperAdmin) must print on the bill.
      String? outletId = user?.outletId;
      try {
        final branchIdInt = int.tryParse(user?.branchId ?? '');
        final outlets = await ref
            .read(outletPosRepositoryProvider)
            .getOutlets(outletType: 'restaurant', branchId: branchIdInt);
        if (outlets.isNotEmpty) outletId = outlets.first.id;
      } catch (_) {
        // Fall back to user?.outletId if the lookup fails.
      }
      await printCustomerDocument(
        ref,
        templateKey: 'customer_bill',
        fallbackTitle: 'CUSTOMER BILL',
        branchId: user?.branchId,
        outletId: outletId,
        sale: sale,
        items: items,
        branchName: branchName,
        tableNumber:
            request.tableNumber.isNotEmpty ? request.tableNumber : null,
        roomNumber: request.roomNumber.isNotEmpty ? request.roomNumber : null,
        customerName:
            request.customerName.isNotEmpty ? request.customerName : null,
        staffLabel: 'Waiter',
        publicCode: shortCode.isNotEmpty ? shortCode : null,
        barcodeValue: shortCode.isNotEmpty ? shortCode : receiptNumber,
      );
    } catch (_) {
      if (mounted) _showMessage('Order sent to kitchen.');
    }
  }

  void _clearOrder() {
    ref.read(cartNotifierProvider.notifier).clearCart();
    _tableController.clear();
    _roomController.clear();
    _customerController.clear();
  }

  void _showMessage(String message) {
    if (!mounted) return;
    AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
  }
}

class _MenuPane extends ConsumerWidget {
  const _MenuPane({required this.searchController});

  final TextEditingController searchController;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productsState = ref.watch(productsNotifierProvider);
    final categories = productsState.allProducts
        .map((product) => product.category)
        .where((category) => category.isNotEmpty)
        .toSet()
        .toList()
      ..sort();

    return Column(
      children: [
        Container(
          height: 58,
          color: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              _CategoryChip(
                label: 'All',
                selected: productsState.category == null,
                onSelected:
                    ref.read(productsNotifierProvider.notifier).clearCategory,
              ),
              ...categories.map(
                (category) => _CategoryChip(
                  label: category,
                  selected: productsState.category == category,
                  onSelected: () => ref
                      .read(productsNotifierProvider.notifier)
                      .filterByCategory(category),
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
          child: TextField(
            controller: searchController,
            onChanged: ref.read(productsNotifierProvider.notifier).search,
            decoration: InputDecoration(
              hintText: 'Search menu',
              prefixIcon: Icon(PhosphorIcons.magnifyingGlass()),
              suffixIcon: IconButton(
                tooltip: 'Refresh menu',
                onPressed: ref.read(productsNotifierProvider.notifier).refresh,
                icon: Icon(PhosphorIcons.arrowsClockwise()),
              ),
            ),
          ),
        ),
        Expanded(
          child: productsState.products.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, _) => _RetryState(
              message: 'Could not load menu items',
              onRetry: ref.read(productsNotifierProvider.notifier).refresh,
            ),
            data: (products) {
              if (products.isEmpty) {
                return _RetryState(
                  message: 'No available menu items.',
                  onRetry: ref.read(productsNotifierProvider.notifier).refresh,
                );
              }
              return RefreshIndicator(
                onRefresh: ref.read(productsNotifierProvider.notifier).refresh,
                child: GridView.builder(
                  padding: const EdgeInsets.all(16),
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: MediaQuery.sizeOf(context).width > 1300
                        ? 5
                        : MediaQuery.sizeOf(context).width > 900
                            ? 4
                            : 3,
                    childAspectRatio: 0.92,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  itemCount: products.length,
                  itemBuilder: (context, index) =>
                      _MenuItemCard(product: products[index]),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _OrderPane extends ConsumerWidget {
  const _OrderPane({
    required this.orderType,
    required this.tableController,
    required this.roomController,
    required this.customerController,
    required this.isSubmitting,
    required this.onOrderTypeChanged,
    required this.onClear,
    required this.onSubmit,
  });

  final String orderType;
  final TextEditingController tableController;
  final TextEditingController roomController;
  final TextEditingController customerController;
  final bool isSubmitting;
  final ValueChanged<String> onOrderTypeChanged;
  final VoidCallback onClear;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartNotifierProvider);
    final subtotal = (cart.subtotal / 1.16).roundToDouble();
    final tax = cart.subtotal - subtotal;

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('Current Order',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const Spacer(),
              IconButton(
                tooltip: 'Clear order',
                onPressed: cart.items.isEmpty ? null : onClear,
                icon: const Icon(Icons.delete_outline),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'dine_in', label: Text('Dine In')),
              ButtonSegment(value: 'takeaway', label: Text('Takeaway')),
              ButtonSegment(value: 'room_service', label: Text('Room')),
            ],
            selected: {orderType},
            onSelectionChanged: (value) => onOrderTypeChanged(value.first),
          ),
          const SizedBox(height: 12),
          if (orderType == 'dine_in')
            TextField(
              controller: tableController,
              decoration: const InputDecoration(
                labelText: 'Table number',
                prefixIcon: Icon(Icons.table_restaurant),
              ),
            ),
          if (orderType == 'room_service')
            TextField(
              controller: roomController,
              decoration: const InputDecoration(
                labelText: 'Room number',
                prefixIcon: Icon(Icons.meeting_room),
              ),
            ),
          if (orderType != 'dine_in') ...[
            const SizedBox(height: 12),
            TextField(
              controller: customerController,
              decoration: const InputDecoration(
                labelText: 'Customer name',
                prefixIcon: Icon(Icons.person),
              ),
            ),
          ],
          const SizedBox(height: 12),
          Expanded(
            child: cart.items.isEmpty
                ? const Center(
                    child: Text('Select menu items to build an order.',
                        style: TextStyle(color: AppColors.kTextSecondary)),
                  )
                : ListView.separated(
                    itemCount: cart.items.length,
                    separatorBuilder: (_, __) => const Divider(height: 20),
                    itemBuilder: (context, index) =>
                        _CartLineItem(item: cart.items[index]),
                  ),
          ),
          const Divider(height: 24),
          _SummaryRow(label: 'Subtotal', value: formatKes(subtotal)),
          _SummaryRow(label: 'VAT', value: formatKes(tax)),
          _SummaryRow(
              label: 'Total', value: formatKes(cart.subtotal), total: true),
          const SizedBox(height: 12),
          ElevatedButton.icon(
            onPressed: cart.items.isEmpty || isSubmitting ? null : onSubmit,
            icon: isSubmitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.send),
            label: Text('SEND TO KITCHEN  ${formatKes(cart.subtotal)}'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.kSuccess,
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 54),
            ),
          ),
        ],
      ),
    );
  }
}

class _MenuItemCard extends ConsumerWidget {
  const _MenuItemCard({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      clipBehavior: Clip.antiAlias,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: const BorderSide(color: AppColors.kDivider),
      ),
      child: InkWell(
        onTap: () => ref.read(cartNotifierProvider.notifier).addItem(product),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Center(
                  child: Icon(Icons.restaurant_menu,
                      color: AppColors.kPrimary.withValues(alpha: 0.55),
                      size: 42),
                ),
              ),
              Text(product.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text(product.category,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      color: AppColors.kTextSecondary, fontSize: 12)),
              const SizedBox(height: 6),
              Text(formatKes(product.price),
                  style: const TextStyle(
                      color: AppColors.kAccent, fontWeight: FontWeight.bold)),
            ],
          ),
        ),
      ),
    );
  }
}

class _CartLineItem extends ConsumerWidget {
  const _CartLineItem({required this.item});

  final CartItem item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.read(cartNotifierProvider.notifier);
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              Text('${item.qty} x ${formatKes(item.unitPrice)}',
                  style: const TextStyle(
                      color: AppColors.kTextSecondary, fontSize: 12)),
            ],
          ),
        ),
        IconButton(
          tooltip: 'Decrease',
          onPressed: () => cart.updateQty(item.productId, item.qty - 1),
          icon: const Icon(Icons.remove_circle_outline),
        ),
        Text('${item.qty}',
            style: const TextStyle(fontWeight: FontWeight.bold)),
        IconButton(
          tooltip: 'Increase',
          onPressed: () => cart.updateQty(item.productId, item.qty + 1),
          icon: const Icon(Icons.add_circle_outline),
        ),
        SizedBox(
          width: 92,
          child: Text(formatKes(item.lineTotal),
              textAlign: TextAlign.end,
              style: const TextStyle(fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }
}

class _KdsStatsBar extends StatelessWidget {
  const _KdsStatsBar({
    required this.pending,
    required this.preparing,
    required this.avgWait,
  });

  final int pending;
  final int preparing;
  final int avgWait;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFF1A1A1A),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      child: Row(
        children: [
          _StatChip(
            icon: Icons.hourglass_empty,
            label: '$pending Pending',
            color: Colors.amber,
          ),
          const SizedBox(width: 20),
          _StatChip(
            icon: Icons.restaurant,
            label: '$preparing Preparing',
            color: Colors.blue,
          ),
          const SizedBox(width: 20),
          _StatChip(
            icon: Icons.timer,
            label: '${avgWait}m avg',
            color: Colors.amber,
          ),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({
    required this.icon,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: color, size: 18),
        const SizedBox(width: 6),
        Text(label,
            style: TextStyle(
                color: color, fontWeight: FontWeight.bold, fontSize: 14)),
      ],
    );
  }
}

class _OrderGroup extends StatelessWidget {
  const _OrderGroup({
    required this.label,
    required this.orders,
    required this.color,
  });

  final String label;
  final List<KitchenOrder> orders;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(label.toUpperCase(),
              style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.bold,
                  fontSize: 11,
                  letterSpacing: 1.2)),
        ),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: MediaQuery.sizeOf(context).width > 1400 ? 4 : 3,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 0.72,
          ),
          itemCount: orders.length,
          itemBuilder: (context, index) =>
              _KdsTicket(order: orders[index], statusColor: color),
        ),
        const SizedBox(height: 24),
      ],
    );
  }
}

class _KdsTicket extends ConsumerWidget {
  const _KdsTicket({required this.order, required this.statusColor});

  final KitchenOrder order;
  final Color statusColor;

  void _showDetail(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1F1F1F),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: Row(
          children: [
            const Icon(Icons.receipt_long, color: Colors.white70, size: 20),
            const SizedBox(width: 8),
            Text(
                order.orderNumber.isNotEmpty
                    ? '#${order.orderNumber}'
                    : '#${order.id.substring(0, 6)}',
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold)),
          ],
        ),
        content: SizedBox(
          width: 400,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _detailRow(
                  Icons.table_restaurant, 'Location', order.locationLabel),
              const SizedBox(height: 6),
              _detailRow(Icons.person, 'Waiter', order.waiterName ?? '—'),
              const SizedBox(height: 6),
              _detailRow(Icons.timer, 'Elapsed', '${order.elapsed.inMinutes}m'),
              const SizedBox(height: 6),
              _detailRow(Icons.circle, 'Status', order.status,
                  valueColor: statusColor),
              if (order.total > 0) ...[
                const SizedBox(height: 6),
                _detailRow(Icons.attach_money, 'Total', formatKes(order.total)),
              ],
              const Divider(color: Colors.white12, height: 24),
              Text('ITEMS (${order.items.length})',
                  style: const TextStyle(
                      color: Colors.white54, fontSize: 11, letterSpacing: 1)),
              const SizedBox(height: 8),
              ...order.items.map((item) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      children: [
                        Text('${item.quantity}x',
                            style: TextStyle(
                                color: item.isReady
                                    ? Colors.green
                                    : AppColors.kAccent,
                                fontWeight: FontWeight.bold)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            item.isReady ? '${item.name} ✓' : item.name,
                            style: TextStyle(
                              color: item.isReady ? Colors.grey : Colors.white,
                              decoration: item.isReady
                                  ? TextDecoration.lineThrough
                                  : null,
                            ),
                          ),
                        ),
                      ],
                    ),
                  )),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Close', style: TextStyle(color: Colors.white70)),
          ),
        ],
      ),
    );
  }

  Widget _detailRow(IconData icon, String label, String value,
      {Color? valueColor}) {
    return Row(
      children: [
        Icon(icon, color: Colors.white38, size: 16),
        const SizedBox(width: 8),
        Text('$label: ',
            style: const TextStyle(color: Colors.white54, fontSize: 13)),
        Expanded(
          child: Text(value,
              style: TextStyle(
                  color: valueColor ?? Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 13)),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final minutes = order.elapsed.inMinutes;
    final urgent = order.isUrgent;
    final isPending = order.status == 'pending' || order.status == 'confirmed';
    final isPreparing = order.status == 'preparing';

    return Card(
      color: const Color(0xFF1F1F1F),
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(
          color: urgent ? Colors.red : statusColor.withValues(alpha: 0.4),
          width: urgent ? 2 : 1,
        ),
      ),
      child: InkWell(
        onTap: () => _showDetail(context),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              color: urgent
                  ? Colors.red.withValues(alpha: 0.2)
                  : statusColor.withValues(alpha: 0.15),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  if (urgent)
                    const Padding(
                      padding: EdgeInsets.only(right: 6),
                      child: Icon(Icons.warning_amber_rounded,
                          color: Colors.red, size: 18),
                    ),
                  Expanded(
                    child: Text(
                        order.orderNumber.isNotEmpty
                            ? '#${order.orderNumber}'
                            : '#${order.id.substring(0, 6)}',
                        style: const TextStyle(
                            color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                  Text('${minutes}m',
                      style: TextStyle(
                          color: urgent ? Colors.red : Colors.white70,
                          fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
              child: Text(
                order.locationLabel +
                    (order.waiterName != null ? ' • ${order.waiterName}' : ''),
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                children: order.items
                    .map(
                      (item) => Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('${item.quantity}x',
                                style: TextStyle(
                                    color: item.isReady
                                        ? Colors.green
                                        : AppColors.kAccent,
                                    fontWeight: FontWeight.bold)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                item.isReady ? '${item.name} ✓' : item.name,
                                style: TextStyle(
                                  color:
                                      item.isReady ? Colors.grey : Colors.white,
                                  fontWeight: FontWeight.w600,
                                  decoration: item.isReady
                                      ? TextDecoration.lineThrough
                                      : null,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 4, 10, 10),
              child: SizedBox(
                width: double.infinity,
                child: isPending
                    ? ElevatedButton.icon(
                        onPressed: () {
                          ref
                              .read(kdsOrdersProvider.notifier)
                              .startCooking(order.id);
                        },
                        icon: const Icon(Icons.restaurant, size: 16),
                        label: const Text('Start Cooking'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF333333),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                      )
                    : isPreparing
                        ? ElevatedButton.icon(
                            onPressed: () {
                              ref
                                  .read(kdsOrdersProvider.notifier)
                                  .markReady(order.id);
                            },
                            icon: const Icon(Icons.check_circle, size: 16),
                            label: const Text('Ready to Serve'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.green.shade700,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 10),
                            ),
                          )
                        : const SizedBox.shrink(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RecentOrderTile extends StatelessWidget {
  const _RecentOrderTile({required this.order});

  final RestaurantOrder order;

  @override
  Widget build(BuildContext context) {
    final location = order.tableNumber != null && order.tableNumber!.isNotEmpty
        ? 'Table ${order.tableNumber}'
        : order.roomNumber != null && order.roomNumber!.isNotEmpty
            ? 'Room ${order.roomNumber}'
            : order.orderType.replaceAll('_', ' ');
    return Card(
      elevation: 0,
      child: ListTile(
        leading: const Icon(Icons.receipt_long),
        title: Text(order.orderNumber,
            style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text('$location • ${order.status}'),
        trailing: Text(formatKes(order.total),
            style: const TextStyle(fontWeight: FontWeight.bold)),
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.label,
    required this.selected,
    required this.onSelected,
  });

  final String label;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onSelected(),
        selectedColor: AppColors.kPrimary,
        labelStyle: TextStyle(
          color: selected ? Colors.white : AppColors.kTextPrimary,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.total = false,
  });

  final String label;
  final String value;
  final bool total;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(
                  fontWeight: total ? FontWeight.bold : FontWeight.normal,
                  fontSize: total ? 16 : 13,
                  color: total
                      ? AppColors.kTextPrimary
                      : AppColors.kTextSecondary)),
          Text(value,
              style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: total ? 16 : 13,
                  color: total ? AppColors.kPrimary : AppColors.kTextPrimary)),
        ],
      ),
    );
  }
}

class _RetryState extends StatelessWidget {
  const _RetryState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message,
              style: const TextStyle(color: AppColors.kTextSecondary)),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

class _DarkRetryState extends StatelessWidget {
  const _DarkRetryState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, style: const TextStyle(color: Colors.white70)),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
            style: OutlinedButton.styleFrom(foregroundColor: Colors.white),
          ),
        ],
      ),
    );
  }
}

class _NewOrderIntent extends Intent {
  const _NewOrderIntent();
}

class _SendOrderIntent extends Intent {
  const _SendOrderIntent();
}
