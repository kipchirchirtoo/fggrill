import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';

import '../../../core/widgets/master_dashboard_shell.dart';
import '../../../services/print_service.dart';
import '../../auth/domain/auth_notifier.dart';
import '../data/outlet_pos_repository.dart';
import '../domain/models.dart';

enum OutletPosSection { station, orders }

class OutletPOSScreen extends ConsumerStatefulWidget {
  const OutletPOSScreen({
    super.key,
    required this.outletType,
    required this.title,
    required this.initials,
    this.unifiedStations = false,
  });

  final String outletType;
  final String title;
  final String initials;
  final bool unifiedStations;

  @override
  ConsumerState<OutletPOSScreen> createState() => _OutletPOSScreenState();
}

class _OutletPOSScreenState extends ConsumerState<OutletPOSScreen> {
  static const _sessionTimeout = Duration(minutes: 10);

  static const _unifiedStationTypes = [
    'restaurant',
    'main_bar',
    'executive_bar',
    'non_consumables',
  ];

  static const _stationLabels = {
    'restaurant': 'Restaurant',
    'main_bar': 'Main Bar',
    'executive_bar': 'Executive Bar',
    'non_consumables': 'Non-consumables',
  };

  OutletPosSection _section = OutletPosSection.station;
  PosOutlet? _outlet;
  OutletShift? _shift;
  List<PosOutlet> _stationOutlets = [];
  List<OutletPosItem> _items = [];
  List<OutletCartItem> _cart = [];
  List<OutletShiftOrder> _orders = [];
  OutletShiftOrder? _recalledOrder;
  final _searchController = TextEditingController();
  final _tableController = TextEditingController();
  final _roomController = TextEditingController();
  final _customerController = TextEditingController();
  String _selectedCategory = 'all';
  String _selectedItemGroup = 'all';
  String _orderType = 'dine_in';
  bool _gridView = true;
  bool _loading = true;
  bool _busy = false;
  String? _error;
  Timer? _sessionTimeoutTimer;

  @override
  void initState() {
    super.initState();
    _resetSessionTimeout();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _sessionTimeoutTimer?.cancel();
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
      final outlets = widget.unifiedStations
          ? await repo.getOutlets()
          : await repo.getOutlets(outletType: widget.outletType);
      final stationOutlets = _normaliseStationOutlets(outlets);
      final outlet = _resolveInitialOutlet(stationOutlets);
      if (outlet == null) {
        throw Exception(
          widget.unifiedStations
              ? 'No POS station is configured for this branch.'
              : 'No ${widget.title} outlet is configured for this branch.',
        );
      }
      final snapshot = await _fetchOutletState(repo, outlet);
      if (!mounted) return;
      setState(() {
        _stationOutlets = stationOutlets;
        _outlet = outlet;
        _shift = snapshot.shift;
        _items = snapshot.items;
        _orders = snapshot.orders;
        if (!_items.any((item) => item.category == _selectedCategory)) {
          _selectedCategory = 'all';
        }
        if (_selectedItemGroup != 'all' &&
            !_items.any((item) => item.itemGroup == _selectedItemGroup)) {
          _selectedItemGroup = 'all';
        }
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<PosOutlet> _normaliseStationOutlets(List<PosOutlet> outlets) {
    final filtered = widget.unifiedStations
        ? outlets
            .where((outlet) =>
                _unifiedStationTypes.contains(outlet.outletType.toLowerCase()))
            .toList()
        : outlets.toList();
    filtered.sort((a, b) {
      final aIndex = _stationSortIndex(a.outletType);
      final bIndex = _stationSortIndex(b.outletType);
      if (aIndex != bIndex) return aIndex.compareTo(bIndex);
      return _stationLabel(a).compareTo(_stationLabel(b));
    });
    return filtered;
  }

  int _stationSortIndex(String outletType) {
    final index = _unifiedStationTypes.indexOf(outletType.toLowerCase());
    return index == -1 ? 999 : index;
  }

  PosOutlet? _resolveInitialOutlet(List<PosOutlet> outlets) {
    if (outlets.isEmpty) return null;
    final currentOutlet = _outlet;
    if (currentOutlet != null) {
      for (final outlet in outlets) {
        if (outlet.id == currentOutlet.id) return outlet;
      }
    }
    for (final outlet in outlets) {
      if (outlet.outletType.toLowerCase() == widget.outletType.toLowerCase()) {
        return outlet;
      }
    }
    return outlets.first;
  }

  Future<_OutletStationSnapshot> _fetchOutletState(
    OutletPosRepository repo,
    PosOutlet outlet,
  ) async {
    var shift = await repo.getActiveShift(outlet.id);
    if (shift == null) {
      try {
        shift = await repo.openShift(outlet.id, 0);
      } catch (_) {
        shift = await repo.getActiveShift(outlet.id);
        if (shift == null) rethrow;
      }
    }
    final items = await repo.getItems(outlet.id, fallbackOutlet: outlet);
    final orders = await repo.getOrders(shift.id);
    return _OutletStationSnapshot(shift: shift, items: items, orders: orders);
  }

  Future<void> _selectOutlet(PosOutlet outlet) async {
    if (_busy || _outlet?.id == outlet.id) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(outletPosRepositoryProvider);
      final snapshot = await _fetchOutletState(repo, outlet);
      if (!mounted) return;
      setState(() {
        _outlet = outlet;
        _shift = snapshot.shift;
        _items = snapshot.items;
        _orders = snapshot.orders;
        _cart = [];
        _recalledOrder = null;
        _selectedCategory = 'all';
        _selectedItemGroup = 'all';
        _orderType = 'dine_in';
        _tableController.clear();
        _roomController.clear();
        _customerController.clear();
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
      child: Listener(
        behavior: HitTestBehavior.translucent,
        onPointerDown: (_) => _resetSessionTimeout(),
        onPointerSignal: (_) => _resetSessionTimeout(),
        child: _buildBody(),
      ),
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
    final activeOutlet = _outlet;
    final groups = {
      for (final item in _items)
        if (item.itemGroup == 'restaurant' || item.itemGroup == 'bar')
          item.itemGroup: item.itemGroupLabel,
    };
    final categorySource = _items.where((item) {
      return _selectedItemGroup == 'all' ||
          item.itemGroup == _selectedItemGroup;
    });
    final categories = <String>[];
    for (final item in categorySource) {
      final category = item.category.trim();
      if (category.isNotEmpty && !categories.contains(category)) {
        categories.add(category);
      }
    }
    final query = _searchController.text.trim().toLowerCase();
    final visibleItems = _items.where((item) {
      final matchesGroup =
          _selectedItemGroup == 'all' || item.itemGroup == _selectedItemGroup;
      final matchesCategory =
          _selectedCategory == 'all' || item.category == _selectedCategory;
      final matchesSearch = query.isEmpty ||
          item.name.toLowerCase().contains(query) ||
          item.category.toLowerCase().contains(query) ||
          item.itemGroupLabel.toLowerCase().contains(query) ||
          item.outletName.toLowerCase().contains(query);
      return matchesGroup && matchesCategory && matchesSearch;
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
                        Text(
                            widget.unifiedStations
                                ? [
                                    if (activeOutlet != null)
                                      _stationLabel(activeOutlet),
                                    activeOutlet?.name ?? 'POS station',
                                  ].join(' - ')
                                : _outlet?.name ?? 'Outlet POS',
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
              if (widget.unifiedStations && _stationOutlets.isNotEmpty) ...[
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final outlet in _stationOutlets)
                      ChoiceChip(
                        selected: _outlet?.id == outlet.id,
                        label: Text(_stationLabel(outlet)),
                        avatar: Icon(_stationIcon(outlet.outletType), size: 18),
                        onSelected: _busy || _outlet?.id == outlet.id
                            ? null
                            : (_) => _selectOutlet(outlet),
                      ),
                  ],
                ),
                const SizedBox(height: 16),
              ],
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
              if (groups.length > 1) ...[
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    ChoiceChip(
                      selected: _selectedItemGroup == 'all',
                      label: const Text('All sources'),
                      onSelected: (_) => setState(() {
                        _selectedItemGroup = 'all';
                        _selectedCategory = 'all';
                      }),
                    ),
                    ...groups.entries.map(
                      (entry) => ChoiceChip(
                        selected: _selectedItemGroup == entry.key,
                        label: Text(entry.value),
                        onSelected: (_) => setState(() {
                          _selectedItemGroup = entry.key;
                          _selectedCategory = 'all';
                        }),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
              ],
              if (categories.isNotEmpty)
                _CategoryTabStrip(
                  categories: categories,
                  selectedCategory: _selectedCategory,
                  onSelected: (category) =>
                      setState(() => _selectedCategory = category),
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
                          subtitle: Text(
                            item.outletName.trim().isEmpty
                                ? '${item.itemGroupLabel} - ${item.category}'
                                : '${item.itemGroupLabel} - ${item.category} - ${item.outletName}',
                          ),
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
            onClear: () => setState(() {
              _cart = [];
              _recalledOrder = null;
            }),
            onCreateOrder: _createOrder,
            recalledOrderNumber: _recalledOrder?.orderNumber,
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
              'Recall, split, merge, and request void approval for waiter bills.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton.icon(
                onPressed: _mergeableOrders.length < 2 || _busy
                    ? null
                    : _showMergeOrdersDialog,
                icon: const Icon(Icons.call_merge),
                label: const Text('Merge bills'),
              ),
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
                        Chip(
                          label: Text(order.paymentStatus == 'voided'
                              ? order.isSplit
                                  ? 'Split'
                                  : order.isMerged
                                      ? 'Merged'
                                      : 'Voided'
                              : 'Cleared'),
                          avatar: Icon(
                            order.paymentStatus == 'voided'
                                ? Icons.block
                                : Icons.check_circle,
                            size: 16,
                          ),
                          visualDensity: VisualDensity.compact,
                        ),
                      PopupMenuButton<String>(
                        enabled: !_busy,
                        tooltip: 'Bill actions',
                        onSelected: (value) {
                          switch (value) {
                            case 'recall':
                              _recallOrder(order);
                              break;
                            case 'split':
                              _showSplitOrderDialog(order);
                              break;
                            case 'void':
                              _showVoidOrderDialog(order);
                              break;
                          }
                        },
                        itemBuilder: (context) => [
                          PopupMenuItem(
                            value: 'recall',
                            enabled: _canEditOrder(order),
                            child: const ListTile(
                              dense: true,
                              leading: Icon(Icons.restore),
                              title: Text('Recall bill'),
                            ),
                          ),
                          PopupMenuItem(
                            value: 'split',
                            enabled:
                                _canEditOrder(order) && order.items.length > 1,
                            child: const ListTile(
                              dense: true,
                              leading: Icon(Icons.call_split),
                              title: Text('Split bill'),
                            ),
                          ),
                          PopupMenuItem(
                            value: 'void',
                            enabled: _canEditOrder(order) &&
                                order.voidRequestStatus != 'pending',
                            child: const ListTile(
                              dense: true,
                              leading: Icon(Icons.block),
                              title: Text('Request void'),
                            ),
                          ),
                        ],
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
      final repo = ref.read(outletPosRepositoryProvider);
      final recalled = _recalledOrder;
      final order = recalled == null
          ? await repo.createOrder(
              shiftId: _shift!.id,
              items: _cart,
              customerName: _orderCustomerLabel(),
              orderType: _isRestaurant ? _orderType : null,
              tableNumber: _tableController.text.trim(),
              roomNumber: _roomController.text.trim(),
            )
          : await repo.updateOrder(
              shiftId: _shift!.id,
              orderId: recalled.id,
              items: _cart,
              customerName: _orderCustomerLabel(),
              orderType: _isRestaurant ? _orderType : null,
              tableNumber: _tableController.text.trim(),
              roomNumber: _roomController.text.trim(),
              appendItems: true,
            );
      await _printCaptainOrderReceipt(order);
      _cart = [];
      _recalledOrder = null;
      _orders = await repo.getOrders(_shift!.id);
      await _logoutAfterOrderPlacement();
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
        receiptType: 'ORDER PROFORMA BILL',
        tableNumber: _isRestaurant && _orderType == 'dine_in'
            ? _tableController.text.trim()
            : null,
        roomNumber: _isRestaurant && _orderType == 'room_service'
            ? _roomController.text.trim()
            : null,
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

  bool get _isRestaurant =>
      (_outlet?.outletType ?? widget.outletType).toLowerCase() == 'restaurant';

  String _stationLabel(PosOutlet outlet) {
    final type = outlet.outletType.toLowerCase();
    return _stationLabels[type] ??
        (outlet.name.trim().isEmpty ? 'POS station' : outlet.name.trim());
  }

  IconData _stationIcon(String outletType) {
    final type = outletType.toLowerCase();
    if (type == 'restaurant') return Icons.restaurant_menu;
    if (type == 'main_bar') return Icons.local_bar;
    if (type == 'executive_bar') return Icons.wine_bar;
    if (type == 'non_consumables') return Icons.inventory_2;
    return Icons.point_of_sale;
  }

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

  List<OutletShiftOrder> get _mergeableOrders =>
      _orders.where(_canEditOrder).toList();

  bool _canEditOrder(OutletShiftOrder order) {
    return ['unpaid', 'partial'].contains(order.paymentStatus) &&
        !order.isSplit &&
        !order.isMerged &&
        order.status != 'cancelled' &&
        order.status != 'voided';
  }

  void _recallOrder(OutletShiftOrder order) {
    setState(() {
      _section = OutletPosSection.station;
      _cart = [];
      _recalledOrder = order;
      _customerController.text = order.customerName;
      _orderType =
          order.orderType?.isNotEmpty == true ? order.orderType! : _orderType;
      _tableController.text = order.tableNumber ?? '';
      _roomController.text = order.roomNumber ?? '';
    });
    AppNotifier.showSnackBar(
      context,
      const SnackBar(
        content: Text(
            'Bill recalled. Add new items only; previous items are locked.'),
      ),
    );
  }

  Future<void> _showSplitOrderDialog(OutletShiftOrder order) async {
    final selected = await showDialog<Set<int>>(
      context: context,
      builder: (context) => _SplitOrderDialog(order: order),
    );
    if (selected == null ||
        selected.isEmpty ||
        selected.length >= order.items.length) {
      return;
    }
    final selectedIndexes = selected.toList()..sort();
    final remainingIndexes = [
      for (var i = 0; i < order.items.length; i++)
        if (!selected.contains(i)) i
    ];
    await _run(() async {
      final repo = ref.read(outletPosRepositoryProvider);
      await repo.splitOrder(
        shiftId: _shift!.id,
        orderId: order.id,
        splits: [
          {
            'customer_name': '${order.customerName} A',
            'item_indexes': selectedIndexes,
          },
          {
            'customer_name': '${order.customerName} B',
            'item_indexes': remainingIndexes,
          },
        ],
      );
      _orders = await repo.getOrders(_shift!.id);
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          const SnackBar(content: Text('Bill split successfully')),
        );
      }
    });
  }

  Future<void> _showMergeOrdersDialog() async {
    final selected = await showDialog<Set<String>>(
      context: context,
      builder: (context) => _MergeOrdersDialog(orders: _mergeableOrders),
    );
    if (selected == null || selected.length < 2) return;
    await _run(() async {
      final repo = ref.read(outletPosRepositoryProvider);
      await repo.mergeOrders(shiftId: _shift!.id, orderIds: selected.toList());
      _orders = await repo.getOrders(_shift!.id);
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          const SnackBar(content: Text('Bills merged successfully')),
        );
      }
    });
  }

  Future<void> _showVoidOrderDialog(OutletShiftOrder order) async {
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => const _ReasonDialog(title: 'Request void approval'),
    );
    if (reason == null || reason.trim().isEmpty) return;
    await _run(() async {
      final repo = ref.read(outletPosRepositoryProvider);
      await repo.requestVoidOrder(
        shiftId: _shift!.id,
        orderId: order.id,
        reason: reason.trim(),
      );
      _orders = await repo.getOrders(_shift!.id);
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          const SnackBar(
              content: Text('Void request sent to branch accountant')),
        );
      }
    });
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

  void _resetSessionTimeout() {
    _sessionTimeoutTimer?.cancel();
    _sessionTimeoutTimer = Timer(_sessionTimeout, _logoutForTimeout);
  }

  Future<void> _logoutForTimeout() async {
    if (!mounted) return;
    AppNotifier.showSnackBar(
      context,
      const SnackBar(
          content: Text('POS session timed out. Please log in again.')),
    );
    await ref.read(authNotifierProvider.notifier).logout();
  }

  Future<void> _logoutAfterOrderPlacement() async {
    if (!mounted) return;
    AppNotifier.showSnackBar(
      context,
      const SnackBar(
          content:
              Text('Captain order printed. Please log in for the next order.')),
    );
    await ref.read(authNotifierProvider.notifier).logout();
  }
}

class _OutletStationSnapshot {
  const _OutletStationSnapshot({
    required this.shift,
    required this.items,
    required this.orders,
  });

  final OutletShift shift;
  final List<OutletPosItem> items;
  final List<OutletShiftOrder> orders;
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

class _CategoryTabStrip extends StatefulWidget {
  const _CategoryTabStrip({
    required this.categories,
    required this.selectedCategory,
    required this.onSelected,
  });

  final List<String> categories;
  final String selectedCategory;
  final ValueChanged<String> onSelected;

  @override
  State<_CategoryTabStrip> createState() => _CategoryTabStripState();
}

class _CategoryTabStripState extends State<_CategoryTabStrip> {
  final _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tabs = ['all', ...widget.categories];
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x11000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Scrollbar(
        controller: _scrollController,
        thumbVisibility: true,
        child: SingleChildScrollView(
          controller: _scrollController,
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(
            children: [
              for (var index = 0; index < tabs.length; index++) ...[
                _CategoryTabButton(
                  label: tabs[index] == 'all'
                      ? 'All Items'
                      : tabs[index].toUpperCase(),
                  selected: widget.selectedCategory == tabs[index],
                  onTap: () => widget.onSelected(tabs[index]),
                ),
                if (index != tabs.length - 1) const SizedBox(width: 10),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _CategoryTabButton extends StatelessWidget {
  const _CategoryTabButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final background =
        selected ? const Color(0xFF2563EB) : const Color(0xFFF9FAFB);
    final foreground = selected ? Colors.white : const Color(0xFF1F2937);
    return Material(
      color: background,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          constraints: const BoxConstraints(minWidth: 92, minHeight: 48),
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 18),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: foreground,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0,
                ),
          ),
        ),
      ),
    );
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
                if (item.itemGroupLabel.trim().isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    item.outletName.trim().isEmpty
                        ? item.itemGroupLabel
                        : '${item.itemGroupLabel} - ${item.outletName}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
                ],
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
    this.recalledOrderNumber,
  });

  final List<OutletCartItem> cart;
  final double subtotal;
  final bool busy;
  final ValueChanged<OutletCartItem> onIncrement;
  final ValueChanged<OutletCartItem> onDecrement;
  final VoidCallback onClear;
  final VoidCallback onCreateOrder;
  final String? recalledOrderNumber;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.all(20),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    recalledOrderNumber == null
                        ? 'Current bill'
                        : 'Recalled $recalledOrderNumber',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                if (recalledOrderNumber != null)
                  const Chip(
                    label: Text('Recall'),
                    visualDensity: VisualDensity.compact,
                  ),
              ],
            ),
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
              label: Text(recalledOrderNumber == null
                  ? 'Place Order'
                  : 'Update recalled bill'),
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

class _SplitOrderDialog extends StatefulWidget {
  const _SplitOrderDialog({required this.order});

  final OutletShiftOrder order;

  @override
  State<_SplitOrderDialog> createState() => _SplitOrderDialogState();
}

class _SplitOrderDialogState extends State<_SplitOrderDialog> {
  final Set<int> _selected = {};

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Split ${widget.order.orderNumber}'),
      content: SizedBox(
        width: 420,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Select the items to move into the second bill.'),
            const SizedBox(height: 12),
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: widget.order.items.length,
                itemBuilder: (context, index) {
                  final item = widget.order.items[index];
                  final map = item is Map ? item : const {};
                  return CheckboxListTile(
                    value: _selected.contains(index),
                    onChanged: (checked) {
                      setState(() {
                        if (checked == true) {
                          _selected.add(index);
                        } else {
                          _selected.remove(index);
                        }
                      });
                    },
                    title: Text('${map['name'] ?? 'Item ${index + 1}'}'),
                    subtitle: Text(
                      '${map['quantity'] ?? 1} x ${formatKes(double.tryParse('${map['unit_price'] ?? 0}') ?? 0)}',
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed:
              _selected.isEmpty || _selected.length >= widget.order.items.length
                  ? null
                  : () => Navigator.pop(context, _selected),
          child: const Text('Split bill'),
        ),
      ],
    );
  }
}

class _MergeOrdersDialog extends StatefulWidget {
  const _MergeOrdersDialog({required this.orders});

  final List<OutletShiftOrder> orders;

  @override
  State<_MergeOrdersDialog> createState() => _MergeOrdersDialogState();
}

class _MergeOrdersDialogState extends State<_MergeOrdersDialog> {
  final Set<String> _selected = {};

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Merge bills'),
      content: SizedBox(
        width: 440,
        child: ListView(
          shrinkWrap: true,
          children: [
            const Text('Select two or more unpaid bills to merge.'),
            const SizedBox(height: 12),
            for (final order in widget.orders)
              CheckboxListTile(
                value: _selected.contains(order.id),
                onChanged: (checked) {
                  setState(() {
                    if (checked == true) {
                      _selected.add(order.id);
                    } else {
                      _selected.remove(order.id);
                    }
                  });
                },
                title: Text(order.orderNumber),
                subtitle: Text(
                  '${order.customerName} • ${formatKes(order.totalAmount)}',
                ),
              ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _selected.length < 2
              ? null
              : () => Navigator.pop(context, _selected),
          child: const Text('Merge bills'),
        ),
      ],
    );
  }
}

class _ReasonDialog extends StatefulWidget {
  const _ReasonDialog({required this.title});

  final String title;

  @override
  State<_ReasonDialog> createState() => _ReasonDialogState();
}

class _ReasonDialogState extends State<_ReasonDialog> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: TextField(
        controller: _controller,
        minLines: 3,
        maxLines: 5,
        decoration: const InputDecoration(
          labelText: 'Reason',
          border: OutlineInputBorder(),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, _controller.text.trim()),
          child: const Text('Submit'),
        ),
      ],
    );
  }
}
