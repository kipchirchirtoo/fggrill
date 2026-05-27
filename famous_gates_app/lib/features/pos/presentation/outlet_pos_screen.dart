import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';

import '../../../core/widgets/master_dashboard_shell.dart';
import '../../../services/print_service.dart';
import '../data/outlet_pos_repository.dart';
import '../domain/models.dart';

enum OutletPosSection { station, orders }

class OutletPOSScreen extends ConsumerStatefulWidget {
  const OutletPOSScreen({
    super.key,
    required this.outletType,
    required this.title,
    required this.initials,
  });

  final String outletType;
  final String title;
  final String initials;

  @override
  ConsumerState<OutletPOSScreen> createState() => _OutletPOSScreenState();
}

class _OutletPOSScreenState extends ConsumerState<OutletPOSScreen> {
  OutletPosSection _section = OutletPosSection.station;
  PosOutlet? _outlet;
  OutletShift? _shift;
  List<OutletPosItem> _items = [];
  List<OutletCartItem> _cart = [];
  List<OutletShiftOrder> _orders = [];
  final _searchController = TextEditingController();
  final _tableController = TextEditingController();
  final _roomController = TextEditingController();
  final _customerController = TextEditingController();
  String _selectedCategory = 'all';
  String _orderType = 'dine_in';
  bool _gridView = true;
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _searchController.dispose();
    _tableController.dispose();
    _roomController.dispose();
    _customerController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(outletPosRepositoryProvider);
      final outlets = await repo.getOutlets(outletType: widget.outletType);
      final outlet = outlets.isNotEmpty ? outlets.first : null;
      if (outlet == null) {
        throw Exception(
            'No ${widget.title} outlet is configured for this branch.');
      }
      var shift = await repo.getActiveShift(outlet.id);
      if (shift == null) {
        try {
          shift = await repo.openShift(outlet.id, 0);
        } catch (_) {
          shift = await repo.getActiveShift(outlet.id);
          if (shift == null) rethrow;
        }
      }
      final items = await repo.getItems(outlet.id);
      final orders = await repo.getOrders(shift.id);
      if (!mounted) return;
      setState(() {
        _outlet = outlet;
        _shift = shift;
        _items = items;
        _orders = orders;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return MasterDashboardShell<OutletPosSection>(
      title: widget.title,
      subtitle: 'Outlet POS',
      initials: widget.initials,
      currentSection: _section,
      items: [
        MasterNavItem(
            section: OutletPosSection.station,
            label: 'POS',
            icon: PhosphorIcons.shoppingCart()),
        MasterNavItem(
            section: OutletPosSection.orders,
            label: 'Orders',
            icon: PhosphorIcons.receipt()),
      ],
      onSectionSelected: (section) => setState(() => _section = section),
      child: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return _Surface(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    return switch (_section) {
      OutletPosSection.station => _station(),
      OutletPosSection.orders => _ordersView(),
    };
  }

  Widget _station() {
    final categories = {
      for (final item in _items) item.category,
    }.where((category) => category.trim().isNotEmpty).toList()
      ..sort();
    final query = _searchController.text.trim().toLowerCase();
    final visibleItems = _items.where((item) {
      final matchesCategory =
          _selectedCategory == 'all' || item.category == _selectedCategory;
      final matchesSearch = query.isEmpty ||
          item.name.toLowerCase().contains(query) ||
          item.category.toLowerCase().contains(query);
      return matchesCategory && matchesSearch;
    }).toList();
    final subtotal = _cart.fold<double>(0, (sum, item) => sum + item.lineTotal);

    return _Surface(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final menu = ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.title,
                            style: Theme.of(context).textTheme.headlineSmall),
                        Text(_outlet?.name ?? 'Outlet POS',
                            style: Theme.of(context).textTheme.bodyMedium),
                      ],
                    ),
                  ),
                  IconButton.outlined(
                    onPressed: _busy ? null : _load,
                    tooltip: 'Refresh',
                    icon: const Icon(Icons.refresh),
                  ),
                  const SizedBox(width: 8),
                  SegmentedButton<bool>(
                    segments: const [
                      ButtonSegment(
                        value: true,
                        icon: Icon(Icons.grid_view),
                      ),
                      ButtonSegment(
                        value: false,
                        icon: Icon(Icons.view_list),
                      ),
                    ],
                    selected: {_gridView},
                    onSelectionChanged: (value) =>
                        setState(() => _gridView = value.first),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _searchController,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search),
                  hintText: 'Search menu items',
                ),
              ),
              if (_isRestaurant) ...[
                const SizedBox(height: 12),
                _OrderContextPanel(
                  orderType: _orderType,
                  tableController: _tableController,
                  roomController: _roomController,
                  customerController: _customerController,
                  onOrderTypeChanged: (value) =>
                      setState(() => _orderType = value),
                ),
              ],
              const SizedBox(height: 16),
              if (categories.isNotEmpty)
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    ChoiceChip(
                      selected: _selectedCategory == 'all',
                      label: const Text('All'),
                      onSelected: (_) =>
                          setState(() => _selectedCategory = 'all'),
                    ),
                    ...categories.map(
                      (category) => ChoiceChip(
                        selected: _selectedCategory == category,
                        label: Text(category),
                        onSelected: (_) =>
                            setState(() => _selectedCategory = category),
                      ),
                    ),
                  ],
                ),
              const SizedBox(height: 16),
              if (visibleItems.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 80),
                  child: Center(child: Text('No menu items found')),
                )
              else if (_gridView)
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: visibleItems
                      .map((item) => _ItemTile(
                            item: item,
                            onTap: () => _addToCart(item),
                          ))
                      .toList(),
                )
              else
                Card(
                  child: Column(
                    children: [
                      for (final item in visibleItems)
                        ListTile(
                          title: Text(item.name),
                          subtitle: Text(item.category),
                          trailing: Text(formatKes(item.sellingPrice),
                              style:
                                  const TextStyle(fontWeight: FontWeight.w800)),
                          onTap: () => _addToCart(item),
                        ),
                    ],
                  ),
                ),
            ],
          );
          final cart = _CartPanel(
            cart: _cart,
            subtotal: subtotal,
            busy: _busy,
            onIncrement: (item) => _setQty(item.item.id, item.quantity + 1),
            onDecrement: (item) => _setQty(item.item.id, item.quantity - 1),
            onClear: () => setState(() => _cart = []),
            onCreateOrder: _createOrder,
          );
          if (constraints.maxWidth < 920) {
            return Column(
              children: [
                Expanded(child: menu),
                SizedBox(height: 300, child: cart),
              ],
            );
          }
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(flex: 3, child: menu),
              SizedBox(width: 360, child: cart),
            ],
          );
        },
      ),
    );
  }

  Widget _ordersView() {
    return _Surface(
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text('Recent orders',
                style: Theme.of(context).textTheme.titleLarge),
            Text(
              'Orders placed from this POS.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 12),
            for (final order in _orders)
              Card(
                child: ListTile(
                  title: Text(order.orderNumber),
                  subtitle: Text(
                    [
                      order.customerName,
                      if ((order.waiterName ?? '').isNotEmpty)
                        'Waiter: ${order.waiterName}',
                      order.paymentStatus,
                    ].join(' • '),
                  ),
                  trailing: Wrap(
                    spacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(formatKes(order.totalAmount),
                              style:
                                  const TextStyle(fontWeight: FontWeight.w800)),
                          Text(
                            'Paid ${formatKes(order.amountPaid)} • Bal ${formatKes(_orderBalance(order))}',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                      if (['unpaid', 'partial'].contains(order.paymentStatus))
                        const Chip(
                          label: Text('Unpaid'),
                          avatar: Icon(Icons.hourglass_empty, size: 16),
                          visualDensity: VisualDensity.compact,
                        )
                      else
                        const Chip(
                          label: Text('Cleared'),
                          avatar: Icon(Icons.check_circle, size: 16),
                          visualDensity: VisualDensity.compact,
                        ),
                    ],
                  ),
                ),
              ),
            if (_orders.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 100),
                child: Center(child: Text('No orders placed yet')),
              ),
          ],
        ),
      ),
    );
  }

  void _addToCart(OutletPosItem item) {
    final index = _cart.indexWhere((entry) => entry.item.id == item.id);
    setState(() {
      if (index == -1) {
        _cart = [..._cart, OutletCartItem(item: item, quantity: 1)];
      } else {
        final updated = [..._cart];
        updated[index] =
            updated[index].copyWith(quantity: updated[index].quantity + 1);
        _cart = updated;
      }
    });
  }

  void _setQty(String itemId, int qty) {
    setState(() {
      if (qty <= 0) {
        _cart = _cart.where((entry) => entry.item.id != itemId).toList();
      } else {
        _cart = _cart
            .map((entry) =>
                entry.item.id == itemId ? entry.copyWith(quantity: qty) : entry)
            .toList();
      }
    });
  }

  Future<void> _createOrder() async {
    if (_shift == null || _cart.isEmpty) return;
    await _run(() async {
      final order = await ref.read(outletPosRepositoryProvider).createOrder(
            shiftId: _shift!.id,
            items: _cart,
            customerName: _orderCustomerLabel(),
            orderType: _isRestaurant ? _orderType : null,
            tableNumber: _tableController.text.trim(),
            roomNumber: _roomController.text.trim(),
          );
      await _printCaptainOrderReceipt(order);
      _cart = [];
      _orders =
          await ref.read(outletPosRepositoryProvider).getOrders(_shift!.id);
    });
  }

  Future<void> _printCaptainOrderReceipt(OutletShiftOrder order) async {
    final sale = SaleResult(
      transactionId: order.id,
      createdAt: order.createdAt ?? DateTime.now(),
      receiptNumber: order.orderNumber,
      cashierName: order.waiterName,
      total: order.totalAmount,
      paymentMethod: 'pending',
    );
    final receiptItems = _cart
        .map((item) => CartItem(
              productId: item.item.id,
              name: item.item.name,
              unitPrice: item.item.sellingPrice,
              qty: item.quantity,
            ))
        .toList();

    try {
      await PrintService().printReceipt(
        sale,
        receiptItems,
        _outlet?.name ?? widget.title,
        receiptType: 'CAPTAIN ORDER',
        tableNumber:
            _orderType == 'dine_in' ? _tableController.text.trim() : null,
        roomNumber:
            _orderType == 'room_service' ? _roomController.text.trim() : null,
        customerName: _orderCustomerLabel(),
        staffLabel: 'Waiter',
        publicCode: order.shortCode,
        barcodeValue: (order.shortCode?.trim().isNotEmpty ?? false)
            ? order.shortCode
            : order.orderNumber,
      );
    } catch (error) {
      if (!mounted) return;
      AppNotifier.showSnackBar(
        context,
        SnackBar(
            content: Text('Order saved, but receipt print failed: $error')),
      );
    }
  }

  bool get _isRestaurant => widget.outletType == 'restaurant';

  String _orderCustomerLabel() {
    final customerName = _customerController.text.trim();
    if (!_isRestaurant) return customerName.isEmpty ? 'Walk-in' : customerName;
    if (_orderType == 'dine_in' && _tableController.text.trim().isNotEmpty) {
      return 'Table ${_tableController.text.trim()}';
    }
    if (_orderType == 'room_service' &&
        _roomController.text.trim().isNotEmpty) {
      return 'Room ${_roomController.text.trim()}';
    }
    return customerName.isEmpty ? 'Walk-in' : customerName;
  }

  double _orderBalance(OutletShiftOrder order) {
    if (order.balanceAmount > 0) return order.balanceAmount;
    if (['paid', 'credit_bill', 'voided'].contains(order.paymentStatus)) {
      return 0;
    }
    return (order.totalAmount - order.amountPaid)
        .clamp(0, order.totalAmount)
        .toDouble();
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
      if (mounted) setState(() {});
    } catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(context, SnackBar(content: Text('$error')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

class _OrderContextPanel extends StatelessWidget {
  const _OrderContextPanel({
    required this.orderType,
    required this.tableController,
    required this.roomController,
    required this.customerController,
    required this.onOrderTypeChanged,
  });

  final String orderType;
  final TextEditingController tableController;
  final TextEditingController roomController;
  final TextEditingController customerController;
  final ValueChanged<String> onOrderTypeChanged;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Wrap(
          spacing: 12,
          runSpacing: 12,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(
                  value: 'dine_in',
                  label: Text('Dine in'),
                  icon: Icon(Icons.table_restaurant),
                ),
                ButtonSegment(
                  value: 'takeaway',
                  label: Text('Takeaway'),
                  icon: Icon(Icons.shopping_bag_outlined),
                ),
                ButtonSegment(
                  value: 'room_service',
                  label: Text('Room'),
                  icon: Icon(Icons.hotel),
                ),
              ],
              selected: {orderType},
              onSelectionChanged: (value) => onOrderTypeChanged(value.first),
            ),
            SizedBox(
              width: 180,
              child: TextField(
                controller: customerController,
                decoration: const InputDecoration(labelText: 'Customer name'),
              ),
            ),
            if (orderType == 'dine_in')
              SizedBox(
                width: 140,
                child: TextField(
                  controller: tableController,
                  decoration: const InputDecoration(labelText: 'Table'),
                ),
              ),
            if (orderType == 'room_service')
              SizedBox(
                width: 140,
                child: TextField(
                  controller: roomController,
                  decoration: const InputDecoration(labelText: 'Room'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Surface extends StatelessWidget {
  const _Surface({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(color: const Color(0xFFF6F7FB), child: child);
  }
}

class _ItemTile extends StatelessWidget {
  const _ItemTile({required this.item, required this.onTap});
  final OutletPosItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 190,
      height: 150,
      child: Card(
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                const Spacer(),
                Text(item.category,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: Text(formatKes(item.sellingPrice),
                          style: const TextStyle(
                              fontWeight: FontWeight.w900, fontSize: 16)),
                    ),
                    const Icon(Icons.add_circle_outline),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CartPanel extends StatelessWidget {
  const _CartPanel({
    required this.cart,
    required this.subtotal,
    required this.busy,
    required this.onIncrement,
    required this.onDecrement,
    required this.onClear,
    required this.onCreateOrder,
  });

  final List<OutletCartItem> cart;
  final double subtotal;
  final bool busy;
  final ValueChanged<OutletCartItem> onIncrement;
  final ValueChanged<OutletCartItem> onDecrement;
  final VoidCallback onClear;
  final VoidCallback onCreateOrder;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.all(20),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Current bill', style: Theme.of(context).textTheme.titleLarge),
            const Divider(),
            Expanded(
              child: ListView(
                children: [
                  for (final item in cart)
                    ListTile(
                      title: Text(item.item.name),
                      subtitle: Text(formatKes(item.lineTotal)),
                      trailing: Wrap(
                        spacing: 4,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          IconButton(
                              onPressed: () => onDecrement(item),
                              icon: const Icon(Icons.remove)),
                          Text('${item.quantity}'),
                          IconButton(
                              onPressed: () => onIncrement(item),
                              icon: const Icon(Icons.add)),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            Text('Total ${formatKes(subtotal)}',
                textAlign: TextAlign.end,
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: cart.isEmpty || busy ? null : onCreateOrder,
              icon: const Icon(Icons.receipt_long),
              label: const Text('Place Order'),
            ),
            TextButton(
                onPressed: cart.isEmpty ? null : onClear,
                child: const Text('Clear')),
          ],
        ),
      ),
    );
  }
}
