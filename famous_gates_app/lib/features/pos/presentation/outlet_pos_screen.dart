import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';

import '../../../core/widgets/master_dashboard_shell.dart';
import '../../auth/domain/auth_notifier.dart';
import '../../templates/data/document_printer.dart';
import '../../../core/realtime/realtime_service.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';
import '../data/outlet_pos_repository.dart';
import '../domain/models.dart';

enum OutletPosSection { station, orders }

// Temporarily disabled per ops request — flip back to true to restore the
// "Merge bills" button on the orders tab.
const bool _kMergeBillsEnabled = false;

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
  bool _printBillImmediately = true;

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
      final storage = ref.read(secureStorageProvider);
      final printImmediatelyStr = await storage.read(key: 'print_bill_immediately');
      if (!mounted) return;
      setState(() {
        if (printImmediatelyStr != null) {
          _printBillImmediately = printImmediatelyStr == 'true';
        } else {
          _printBillImmediately = true;
        }
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

  Future<void> _setPrintBillImmediately(bool value) async {
    setState(() {
      _printBillImmediately = value;
    });
    final storage = ref.read(secureStorageProvider);
    await storage.write(key: 'print_bill_immediately', value: value.toString());
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
    // Do NOT auto-open a shift. Orders can only be placed when the station's
    // cashier has explicitly opened a shift.
    final shift = await repo.getActiveShift(outlet.id);
    final items = await repo.getItems(outlet.id, fallbackOutlet: outlet);
    final orders =
        shift == null ? <OutletShiftOrder>[] : await repo.getOrders(shift.id);
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
    _PosPalette.isDark = !_usesLightPalette;
    return MasterDashboardShell<OutletPosSection>(
      title: widget.title,
      subtitle: 'Outlet POS',
      initials: widget.initials,
      palette: ShellPalette(
        background: _PosPalette.canvas,
        surface: _PosPalette.surface,
        accent: _PosPalette.accent,
        onAccent: _PosPalette.onAccent,
        border: _PosPalette.border,
        text: _PosPalette.text,
        mutedText: _PosPalette.textMuted,
      ),
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
      initialSidebarCollapsed: true,
      allowSidebarCollapse: true,
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
                  const SizedBox(width: 12),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.print_outlined, size: 20),
                      const SizedBox(width: 4),
                      const Text('Auto-print Bill', style: TextStyle(fontSize: 13)),
                      const SizedBox(width: 4),
                      Switch(
                        value: _printBillImmediately,
                        onChanged: (val) => _setPrintBillImmediately(val),
                      ),
                    ],
                  ),
                  const SizedBox(width: 12),
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
              if (_shift == null) ...[
                _NoShiftBanner(
                  stationLabel: activeOutlet != null
                      ? _stationLabel(activeOutlet)
                      : widget.title,
                  busy: _busy,
                  canOpenShift: _canOpenShift(),
                  onOpenShift: _openShift,
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
            onIncrement: (item) => _setQty(item, item.quantity + 1),
            onDecrement: (item) => _setQty(item, item.quantity - 1),
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
              'Tap a bill to view it and print a duplicate. Recall, split, merge, '
              'and request void approval from the bill actions menu.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            if (_kMergeBillsEnabled) ...[
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
            ],
            const SizedBox(height: 12),
            for (final order in _visibleOrders)
              Card(
                child: ListTile(
                  onTap: () => _showBillDetail(order),
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
                            case 'exchange':
                              _showExchangeRequestSheet(order);
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
                          // Restaurant waiters can request a whole-bill void
                          // (goes to the branch accountant for approval).
                          // Bartenders (Main Bar/Executive Bar/Sports Bar) do
                          // not get this — all bar voids go through the
                          // Cashier Void Management screen instead.
                          if (_isRestaurant)
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
                          PopupMenuItem(
                            value: 'exchange',
                            enabled: _canExchangeOrder(order),
                            child: const ListTile(
                              dense: true,
                              leading: Icon(Icons.swap_horiz),
                              title: Text('Request Exchange'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            if (_visibleOrders.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 100),
                child: Center(child: Text('No orders placed yet')),
              ),
          ],
        ),
      ),
    );
  }

  // Only a cashier (or a manager) may open a shift — waiters never can.
  bool _canOpenShift() {
    final role =
        (ref.read(authNotifierProvider).valueOrNull?.role ?? '').toLowerCase();
    const managers = {
      'super_admin',
      'general_manager',
      'branch_manager',
      'branch_accountant',
      'accountant',
    };
    return role.contains('cashier') || managers.contains(role);
  }

  Future<void> _openShift() async {
    final outlet = _outlet;
    if (outlet == null || _busy || !_canOpenShift()) return;
    setState(() => _busy = true);
    try {
      await ref.read(outletPosRepositoryProvider).openShift(outlet.id, 0);
      await _load();
      if (mounted) {
        AppNotifier.showSnackBar(
            context, const SnackBar(content: Text('Shift opened')));
      }
    } catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text('Cannot open shift: $error')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  // Drinks in these categories can be served warm or cold - the waiter picks
  // one when adding to cart, and it rides through to the bar captain order.
  static const _temperatureCategories = {
    'soft drinks',
    'beers',
    'canned beers',
  };

  Future<String?> _pickDrinkTemperature(String itemName) {
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(itemName),
        content: const Text('Serve warm or cold?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel')),
          OutlinedButton(
              onPressed: () => Navigator.of(context).pop('Warm'),
              child: const Text('Warm')),
          FilledButton(
              onPressed: () => Navigator.of(context).pop('Cold'),
              child: const Text('Cold')),
        ],
      ),
    );
  }

  Future<void> _addToCart(OutletPosItem item) async {
    if (_shift == null) {
      AppNotifier.showSnackBar(
        context,
        const SnackBar(
            content: Text(
                'No open shift for this station. The cashier must open a shift before taking orders.')),
      );
      return;
    }

    String? notes;
    if (_temperatureCategories.contains(item.category.trim().toLowerCase())) {
      notes = await _pickDrinkTemperature(item.name);
      if (notes == null) return; // cancelled
    }

    final index = _cart.indexWhere(
        (entry) => entry.item.id == item.id && entry.notes == notes);
    setState(() {
      if (index == -1) {
        _cart = [..._cart, OutletCartItem(item: item, quantity: 1, notes: notes)];
      } else {
        final updated = [..._cart];
        updated[index] =
            updated[index].copyWith(quantity: updated[index].quantity + 1);
        _cart = updated;
      }
    });
  }

  void _setQty(OutletCartItem entry, int qty) {
    setState(() {
      final index = _cart.indexOf(entry);
      if (index == -1) return;
      if (qty <= 0) {
        _cart = [..._cart]..removeAt(index);
      } else {
        _cart = [..._cart]..[index] = entry.copyWith(quantity: qty);
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
      if (_printBillImmediately) {
        if (recalled == null) {
          if (_isRestaurant) {
            // Restaurant new order: print the customer bill only.
            // The captain order goes to the KDS which polls every 5 s and
            // prints it on the kitchen printer — printing it here too would
            // send a duplicate to the waiter's own station printer.
            await _printCaptainOrderReceipt(order);
          } else {
            // Bar / non-restaurant new order: print customer bill immediately.
            // Captain orders for these outlets are delivered to the cashier
            // station feed separately — but the customer still needs a bill.
            await _printCustomerBillFromSavedOrder(order);
          }
        } else {
          // Recall: the customer bill always prints locally from the desktop app
          // using the fully merged order returned by updateOrder.
          // The recalled captain order is picked up by the KDS poll automatically.
          await _printCustomerBillFromSavedOrder(order);
        }
      }
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
      final user = ref.read(authNotifierProvider).valueOrNull;
      final branchId = _outlet?.branchId?.toString() ?? user?.branchId;
      final outletId = _outlet?.id;
      final branchName = _outlet?.name ?? widget.title;
      final tableNum = _isRestaurant && _orderType == 'dine_in'
          ? _tableController.text.trim()
          : null;
      final roomNum = _isRestaurant && _orderType == 'room_service'
          ? _roomController.text.trim()
          : null;
      final customerLabel = _orderCustomerLabel();
      final barcodeVal = (order.shortCode?.trim().isNotEmpty ?? false)
          ? order.shortCode
          : order.orderNumber;

      // PRINT: Customer Bill (given to customer at table)
      await printCustomerDocument(
        ref,
        templateKey: 'customer_bill',
        fallbackTitle: 'CUSTOMER BILL',
        branchId: branchId,
        outletId: outletId,
        sale: sale,
        items: receiptItems,
        branchName: branchName,
        tableNumber: tableNum,
        roomNumber: roomNum,
        customerName: customerLabel,
        staffLabel: 'Waiter',
        publicCode: order.shortCode,
        barcodeValue: barcodeVal,
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

  // Reprints the Customer Bill for a past order with the exact details it
  // was originally printed with — pulled from the saved order record, not
  // the live cart (which has since moved on to other items).
  Future<void> _printCustomerBillFromSavedOrder(
    OutletShiftOrder order, {
    String fallbackTitle = 'CUSTOMER BILL',
    List<CartItem>? itemsOverride,
  }) async {
    final savedItems = itemsOverride ??
        order.items.map((raw) {
          final m = Map<String, dynamic>.from(raw as Map);
          final qty = (m['quantity'] is num)
              ? (m['quantity'] as num).toInt()
              : int.tryParse('${m['quantity']}') ?? 0;
          final unitPrice = (m['unit_price'] is num)
              ? (m['unit_price'] as num).toDouble()
              : double.tryParse('${m['unit_price']}') ?? 0;
          return CartItem(
            productId: '${m['outlet_item_id'] ?? ''}',
            name: '${m['name'] ?? ''}',
            unitPrice: unitPrice,
            qty: qty,
          );
        }).toList();

    final sale = SaleResult(
      transactionId: order.id,
      createdAt: order.effectiveCreatedAt ?? DateTime.now(),
      receiptNumber: order.orderNumber,
      cashierName: order.waiterName,
      total: order.totalAmount,
      paymentMethod: 'pending',
    );

    try {
      final user = ref.read(authNotifierProvider).valueOrNull;
      final branchId = _outlet?.branchId?.toString() ?? user?.branchId;
      final outletId = _outlet?.id;
      final branchName = _outlet?.name ?? widget.title;
      final barcodeVal = (order.shortCode?.trim().isNotEmpty ?? false)
          ? order.shortCode
          : order.orderNumber;

      await printCustomerDocument(
        ref,
        templateKey: 'customer_bill',
        fallbackTitle: fallbackTitle,
        branchId: branchId,
        outletId: outletId,
        sale: sale,
        items: savedItems,
        branchName: branchName,
        tableNumber: order.tableNumber,
        roomNumber: order.roomNumber,
        customerName: order.customerName,
        staffLabel: 'Waiter',
        publicCode: order.shortCode,
        barcodeValue: barcodeVal,
        duplicateLabel:
            fallbackTitle.toUpperCase().contains('REPRINT') ? 'DUPLICATE' : null,
      );
    } catch (error) {
      if (!mounted) rethrow;
      AppNotifier.showSnackBar(
        context,
        SnackBar(content: Text('$fallbackTitle failed: $error')),
      );
      rethrow;
    }
  }

  // The only way a waiter can reach the duplicate-print action — printing
  // is deliberately not exposed on the bill-actions popup menu, so a waiter
  // must open and look at the bill before a duplicate can be printed.
  Future<void> _showBillDetail(OutletShiftOrder order) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _BillDetailSheet(
        order: order,
        shiftId: _shift!.id,
        isRestaurant: _isRestaurant,
        onPrintOriginal: () {
          Navigator.of(context).pop();
          _printOriginalBill(order);
        },
        onPrintDuplicate: () {
          Navigator.of(context).pop();
          _reprintBill(order);
        },
        onPrintUpdated: () {
          Navigator.of(context).pop();
          _printUpdatedBill(order);
        },
      ),
    );
  }

  // Items still on the bill after an approved item void — qty is the
  // remaining (post-void) quantity, so the printed total matches the
  // already-corrected order.totalAmount.
  List<CartItem> _activeBillItems(OutletShiftOrder order) {
    return order.items.whereType<Map>().map((raw) {
      final m = Map<String, dynamic>.from(raw);
      final qty = (m['quantity'] is num)
          ? (m['quantity'] as num).toDouble()
          : double.tryParse('${m['quantity']}') ?? 0;
      final voidedQty = (m['voided_qty'] is num)
          ? (m['voided_qty'] as num).toDouble()
          : double.tryParse('${m['voided_qty']}') ?? 0;
      final unitPrice = (m['unit_price'] is num)
          ? (m['unit_price'] as num).toDouble()
          : double.tryParse('${m['unit_price']}') ?? 0;
      final activeQty = qty - voidedQty;
      if (activeQty <= 0) return null;
      return CartItem(
        productId: '${m['outlet_item_id'] ?? ''}',
        name: '${m['name'] ?? ''}',
        unitPrice: unitPrice,
        qty: activeQty.round(),
      );
    }).whereType<CartItem>().toList();
  }

  Future<void> _printOriginalBill(OutletShiftOrder order) async {
    OutletShiftOrder? updatedOrder;
    try {
      updatedOrder = await ref.read(outletPosRepositoryProvider).markOriginalBillPrinted(
            shiftId: _shift!.id,
            orderId: order.id,
          );
    } on StateError catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          SnackBar(content: Text(error.message)),
        );
      }
      return;
    } catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          SnackBar(content: Text('Could not mark bill as printed: $error')),
        );
      }
      return;
    }

    try {
      await _printCustomerBillFromSavedOrder(
        updatedOrder,
        fallbackTitle: 'CUSTOMER BILL',
        itemsOverride: _activeBillItems(updatedOrder),
      );
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          const SnackBar(content: Text('Original bill printed')),
        );
      }
    } catch (error) {
      if (!mounted) return;
    } finally {
      final repo = ref.read(outletPosRepositoryProvider);
      try {
        final refreshed = await repo.getOrders(_shift!.id);
        if (mounted) setState(() => _orders = refreshed);
      } catch (_) {
        // Best-effort refresh
      }
    }
  }

  Future<void> _printUpdatedBill(OutletShiftOrder order) async {
    try {
      await _printCustomerBillFromSavedOrder(
        order,
        fallbackTitle: 'UPDATED BILL',
        itemsOverride: _activeBillItems(order),
      );
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          const SnackBar(content: Text('Updated bill printed')),
        );
      }
    } catch (_) {
      // _printCustomerBillFromSavedOrder already surfaces the error.
    }
  }

  Future<void> _reprintBill(OutletShiftOrder order) async {
    try {
      // Server-side check-and-consume of the one allowed duplicate. This
      // must happen BEFORE printing — the limit is enforced here, not just
      // in the UI, so it can't be bypassed by retrying or by another
      // device/session for the same order.
      await ref.read(outletPosRepositoryProvider).reprintBill(
            shiftId: _shift!.id,
            orderId: order.id,
          );
    } on StateError catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          SnackBar(content: Text(error.message)),
        );
      }
      return;
    } catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          SnackBar(content: Text('Could not check reprint limit: $error')),
        );
      }
      return;
    }

    try {
      await _printCustomerBillFromSavedOrder(
        order,
        fallbackTitle: 'CUSTOMER BILL (REPRINT)',
      );
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          const SnackBar(content: Text('Bill reprinted')),
        );
      }
    } catch (error) {
      if (!mounted) return;
    } finally {
      // Refresh so the menu item reflects the now-consumed reprint
      // allowance (it disables itself once canReprintBill is false).
      final repo = ref.read(outletPosRepositoryProvider);
      try {
        final refreshed = await repo.getOrders(_shift!.id);
        if (mounted) setState(() => _orders = refreshed);
      } catch (_) {
        // Best-effort refresh — the reprint itself already succeeded.
      }
    }
  }

  bool get _isRestaurant =>
      (_outlet?.outletType ?? widget.outletType).toLowerCase() == 'restaurant';

  bool get _usesLightPalette {
    final type = (_outlet?.outletType ?? widget.outletType).toLowerCase();
    return type == 'restaurant' || type == 'main_bar';
  }

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

  // A whole-bill void zeroes the order out (status/payment_status='voided',
  // balance/total collapsed to 0) — once that's happened there is nothing
  // left to act on, and leaving it sitting in the order history is a
  // loophole: it's a fully dead row a waiter/bartender could still tap into.
  // Drop it from the list entirely rather than just disabling its actions.
  List<OutletShiftOrder> get _visibleOrders => _orders.where((order) {
        final isVoided =
            order.status == 'voided' || order.paymentStatus == 'voided';
        final isZeroed = order.totalAmount <= 0;
        return !(isVoided && isZeroed);
      }).toList();

  List<OutletShiftOrder> get _mergeableOrders =>
      _orders.where(_canEditOrder).toList();

  bool _canEditOrder(OutletShiftOrder order) {
    return ['unpaid', 'partial'].contains(order.paymentStatus) &&
        !order.isSplit &&
        !order.isMerged &&
        order.status != 'cancelled' &&
        order.status != 'voided';
  }

  // Only a closed, paid bill can be exchanged — money has already changed
  // hands, so this is a separate flow from voiding an unpaid item.
  bool _canExchangeOrder(OutletShiftOrder order) {
    return ['paid', 'credit_bill'].contains(order.paymentStatus) &&
        !order.isExchange &&
        !order.hasActiveExchangeRequest;
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
      final childOrders = await repo.splitOrder(
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
      // Each split bill is printed locally from the till here — the backend
      // can't reach this printer (cloud-hosted, no path to branch hardware),
      // so it just returns the child orders for us to print client-side.
      for (final child in childOrders) {
        await _printCustomerBillFromSavedOrder(
          child,
          fallbackTitle: 'CUSTOMER BILL (SPLIT)',
        );
      }
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

  // Restaurant-only: bartenders no longer get this entry point at all (see
  // _isRestaurant gate on the popup menu item above) — all bar voids go
  // through the Cashier Void Management screen instead.
  Future<void> _showVoidOrderDialog(OutletShiftOrder order) async {
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => const _ReasonDialog(title: 'Request void approval'),
    );
    if (reason == null || reason.trim().isEmpty) return;

    setState(() => _busy = true);
    try {
      final repo = ref.read(outletPosRepositoryProvider);

      // Request void with explicit error handling
      await repo.requestVoidOrder(
        shiftId: _shift!.id,
        orderId: order.id,
        reason: reason.trim(),
      );

      // Refresh orders list to show updated status
      final updatedOrders = await repo.getOrders(_shift!.id);
      setState(() {
        _orders = updatedOrders;
        _busy = false;
      });

      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          const SnackBar(
            content: Text('Void request sent to branch accountant'),
            backgroundColor: Colors.green,
            duration: Duration(seconds: 3),
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        setState(() => _busy = false);
        AppNotifier.showSnackBar(
          context,
          SnackBar(
            content: Text('Failed to request void: $error'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 5),
          ),
        );
      }
    }
  }

  Future<void> _showExchangeRequestSheet(OutletShiftOrder order) async {
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _ExchangeRequestSheet(
        order: order,
        shiftId: _shift!.id,
        catalog: _items,
      ),
    );
    if (result != true) return;
    setState(() => _busy = true);
    try {
      final repo = ref.read(outletPosRepositoryProvider);
      _orders = await repo.getOrders(_shift!.id);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
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

class _NoShiftBanner extends StatelessWidget {
  const _NoShiftBanner({
    required this.stationLabel,
    required this.busy,
    required this.canOpenShift,
    required this.onOpenShift,
  });

  final String stationLabel;
  final bool busy;
  final bool canOpenShift;
  final Future<void> Function() onOpenShift;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _PosPalette.accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _PosPalette.accent.withValues(alpha: 0.5)),
      ),
      child: Row(children: [
        const Icon(Icons.lock_clock, color: _PosPalette.accent),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('$stationLabel shift is closed',
                  style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: _PosPalette.text,
                      fontSize: 15)),
              const SizedBox(height: 2),
              Text(
                canOpenShift
                    ? 'Open a shift to start taking orders for this station.'
                    : 'Orders cannot be placed until the station cashier opens a shift.',
                style: TextStyle(color: _PosPalette.text, fontSize: 12),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        // Only the cashier sees the Open Shift action — waiters cannot open it.
        if (canOpenShift)
          FilledButton.icon(
            onPressed: busy ? null : () => onOpenShift(),
            icon: const Icon(Icons.lock_open, size: 16),
            label: const Text('Open Shift'),
          ),
      ]),
    );
  }
}

class _OutletStationSnapshot {
  const _OutletStationSnapshot({
    required this.shift,
    required this.items,
    required this.orders,
  });

  final OutletShift? shift;
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

/// Restaurant/waiter stations get a soft cream palette; bar/outlet stations
/// get a dark slate palette with light text. [isDark] is set once per build
/// from `_isRestaurant` (see OutletPOSScreen.build) -- there is only ever one
/// outlet POS station mounted per terminal, so a static toggle is safe here
/// and avoids threading a palette object through every leaf widget below.
class _PosPalette {
  static bool isDark = false;

  static Color get canvas => isDark ? _darkCanvas : _lightCanvas;
  static Color get surface => isDark ? _darkSurface : _lightSurface;
  static Color get surfaceAlt => isDark ? _darkSurfaceAlt : _lightSurfaceAlt;
  static Color get border => isDark ? _darkBorder : _lightBorder;
  static const accent = Color(0xFFD9701F); // warm orange action, both themes
  static const onAccent = Color(0xFFFFFFFF); // white text on orange buttons
  static Color get text => isDark ? _darkText : _lightText;
  static Color get textMuted => isDark ? _darkTextMuted : _lightTextMuted;

  static const _lightCanvas = Color(0xFFFAF7F2);
  static const _lightSurface = Color(0xFFFFFFFF);
  static const _lightSurfaceAlt = Color(0xFFF2ECE2);
  static const _lightBorder = Color(0xFFE3DACB);
  static const _lightText = Color(0xFF3A2917); // warm dark brown (readable)
  static const _lightTextMuted = Color(0xFF8A7252);

  static const _darkCanvas = Color(0xFF2C3E50);
  static const _darkSurface = Color(0xFF34495E);
  static const _darkSurfaceAlt = Color(0xFF3D5266);
  static const _darkBorder = Color(0xFF4A6178);
  static const _darkText = Color(0xFFF5F7FA); // light text on dark slate
  static const _darkTextMuted = Color(0xFFAAB7C4);
}

class _Surface extends StatelessWidget {
  const _Surface({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context);
    final brightness =
        _PosPalette.isDark ? Brightness.dark : Brightness.light;
    final scheme = base.colorScheme.copyWith(
      brightness: brightness,
      primary: _PosPalette.accent,
      onPrimary: _PosPalette.onAccent,
      secondary: _PosPalette.accent,
      surface: _PosPalette.surface,
      onSurface: _PosPalette.text,
      surfaceTint: Colors.transparent,
      outline: _PosPalette.border,
    );
    // Scope the dark theme to the POS only (doesn't touch the rest of the app).
    return Theme(
      data: base.copyWith(
        brightness: brightness,
        scaffoldBackgroundColor: _PosPalette.canvas,
        canvasColor: _PosPalette.canvas,
        cardColor: _PosPalette.surface,
        dividerColor: _PosPalette.border,
        colorScheme: scheme,
        cardTheme: base.cardTheme.copyWith(
          color: _PosPalette.surface,
          elevation: 0.5,
          surfaceTintColor: Colors.transparent,
        ),
        textTheme: base.textTheme.apply(
          bodyColor: _PosPalette.text,
          displayColor: _PosPalette.text,
        ),
        iconTheme: base.iconTheme.copyWith(color: _PosPalette.text),
        inputDecorationTheme: base.inputDecorationTheme.copyWith(
          filled: true,
          fillColor: _PosPalette.surfaceAlt,
          hintStyle: TextStyle(color: _PosPalette.textMuted),
          labelStyle: TextStyle(color: _PosPalette.textMuted),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide(color: _PosPalette.border),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: _PosPalette.accent),
          ),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: _PosPalette.accent,
            foregroundColor: _PosPalette.onAccent,
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: _PosPalette.text,
            side: BorderSide(color: _PosPalette.border),
          ),
        ),
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(foregroundColor: _PosPalette.accent),
        ),
        dialogTheme: base.dialogTheme.copyWith(
          backgroundColor: _PosPalette.surface,
          surfaceTintColor: Colors.transparent,
        ),
      ),
      child: ColoredBox(color: _PosPalette.canvas, child: child),
    );
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
        color: _PosPalette.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _PosPalette.border),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0D000000),
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
    final background = selected ? _PosPalette.accent : _PosPalette.surfaceAlt;
    final foreground = selected ? _PosPalette.onAccent : _PosPalette.text;
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
    final outOfStock = item.trackStock && item.currentStock <= 0;
    return SizedBox(
      width: 190,
      height: 150,
      child: Opacity(
        opacity: outOfStock ? 0.45 : 1.0,
        child: Card(
          child: InkWell(
            onTap: outOfStock ? null : onTap,
            child: Stack(
              children: [
                Padding(
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
                          if (!outOfStock) const Icon(Icons.add_circle_outline),
                        ],
                      ),
                    ],
                  ),
                ),
                if (outOfStock)
                  Positioned(
                    top: 6,
                    right: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.red.shade700,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'Out of Stock',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ),
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
                      subtitle: Text(
                        item.notes == null || item.notes!.trim().isEmpty
                            ? formatKes(item.lineTotal)
                            : '${formatKes(item.lineTotal)} - ${item.notes}',
                      ),
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

// Manager/accountant tier allowed to approve or reject an item void --
// mirrors REVIEW_ROLES in outlet-pos.controller.ts exactly. The server
// re-checks this independently; this only controls which buttons render.
const Set<String> _itemVoidReviewRoles = {
  'super_admin',
  'general_manager',
  'director',
  'auditor',
  'finance_manager',
  'accountant',
  'branch_accountant',
  'branch_manager',
};

class _BillDetailSheet extends ConsumerStatefulWidget {
  const _BillDetailSheet({
    required this.order,
    required this.shiftId,
    required this.isRestaurant,
    required this.onPrintOriginal,
    required this.onPrintDuplicate,
    required this.onPrintUpdated,
  });

  final OutletShiftOrder order;
  final String shiftId;
  // Only restaurant waiters can start a per-item void from this sheet —
  // bartenders use the Cashier Void Management screen instead.
  final bool isRestaurant;
  final VoidCallback onPrintOriginal;
  final VoidCallback onPrintDuplicate;
  final VoidCallback onPrintUpdated;

  @override
  ConsumerState<_BillDetailSheet> createState() => _BillDetailSheetState();
}

class _BillDetailSheetState extends ConsumerState<_BillDetailSheet> {
  late OutletShiftOrder _order;
  List<ItemVoidRequest> _voidRequests = const [];
  bool _actioning = false;
  StreamSubscription<VoidRequestRealtimeEvent>? _realtimeSub;
  // Fallback timer when Realtime is unavailable.
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _order = widget.order;
    _poll();
    _initRealtime();
  }

  Future<void> _initRealtime() async {
    final storage = ref.read(secureStorageProvider);
    final branchIdStr =
        await storage.read(key: AuthRepository.branchIdKey) ?? '';
    final branchId = int.tryParse(branchIdStr.trim());

    if (branchId == null) {
      _startFallbackPolling();
      return;
    }

    final realtimeService = ref.read(realtimeServiceProvider);
    _realtimeSub = realtimeService.watchVoidRequests(branchId).listen(
      (event) {
        // Only refresh if the event concerns this order.
        if (event.orderId == _order.id || event.orderId.isEmpty) {
          _poll();
        }
      },
      onError: (Object err) {
        debugPrint('❌ BillDetailSheet Realtime error: $err — falling back to polling');
        _startFallbackPolling();
      },
    );
  }

  void _startFallbackPolling() {
    if (_pollTimer != null) return;
    _pollTimer = Timer.periodic(const Duration(seconds: 6), (_) => _poll());
  }

  @override
  void dispose() {
    _realtimeSub?.cancel();
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _poll() async {
    try {
      final repo = ref.read(outletPosRepositoryProvider);
      final results = await Future.wait([
        repo.getOrder(shiftId: widget.shiftId, orderId: _order.id),
        repo.getItemVoidRequestsForShift(widget.shiftId),
      ]);
      if (!mounted) return;
      final freshOrder = results[0] as OutletShiftOrder;
      final allRequests = results[1] as List<ItemVoidRequest>;
      setState(() {
        _order = freshOrder;
        _voidRequests = allRequests.where((r) => r.orderId == _order.id).toList();
      });
    } catch (_) {
      // Transient polling failures should not disrupt an open bill sheet.
    }
  }

  double _balance(OutletShiftOrder order) {
    if (order.balanceAmount > 0) return order.balanceAmount;
    if (['paid', 'credit_bill', 'voided'].contains(order.paymentStatus)) {
      return 0;
    }
    return (order.totalAmount - order.amountPaid)
        .clamp(0, order.totalAmount)
        .toDouble();
  }

  // Returns the active void request for an item if it's in any in-flight stage.
  ItemVoidRequest? _activeVoidFor(int itemIndex) {
    for (final request in _voidRequests) {
      if (request.itemIndex == itemIndex &&
          (request.isPending || request.isAcknowledged)) {
        return request;
      }
    }
    return null;
  }

  String get _role =>
      (ref.read(authNotifierProvider).valueOrNull?.role ?? '').toLowerCase();

  bool get _isReviewer => _itemVoidReviewRoles.contains(_role);
  bool get _isCashier => _role.contains('cashier');

  // Gates the "Print Updated Bill" action — only shown once a manager has
  // approved at least one item void on this order, per the requirement that
  // it must not appear during pending/rejected states.
  bool get _hasApprovedVoid => _voidRequests.any((r) => r.isApproved);

  bool get _billEditable =>
      ['unpaid', 'partial'].contains(_order.paymentStatus) &&
      !_order.isSplit &&
      !_order.isMerged &&
      _order.status != 'cancelled' &&
      _order.status != 'voided';

  Future<void> _openVoidItemSheet(int index, Map<String, dynamic> item, double activeQty) async {
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _VoidItemSheet(
        itemName: '${item['name'] ?? ''}',
        maxQty: activeQty,
      ),
    );
    if (result == null) return;
    setState(() => _actioning = true);
    try {
      await ref.read(outletPosRepositoryProvider).requestItemVoid(
            shiftId: widget.shiftId,
            orderId: _order.id,
            itemIndex: index,
            qtyToVoid: result['qty'] as double,
            reasonCategory: result['reasonCategory'] as String,
            note: result['note'] as String?,
          );
      await _poll();
      if (mounted) {
        AppNotifier.showSnackBar(context,
            const SnackBar(content: Text('Void request sent for approval')));
      }
    } catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text('Could not request void: $error')));
      }
    } finally {
      if (mounted) setState(() => _actioning = false);
    }
  }

  Future<void> _acknowledge(ItemVoidRequest request) async {
    setState(() => _actioning = true);
    try {
      await ref.read(outletPosRepositoryProvider).cashierAcknowledgeVoid(request.id);
      await _poll();
      if (mounted) {
        AppNotifier.showSnackBar(context,
            const SnackBar(content: Text('Acknowledged — sent to manager for approval')));
      }
    } on StateError catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(context, SnackBar(content: Text(error.message)));
      }
      await _poll();
    } finally {
      if (mounted) setState(() => _actioning = false);
    }
  }

  Future<void> _decline(ItemVoidRequest request) async {
    setState(() => _actioning = true);
    try {
      await ref.read(outletPosRepositoryProvider).cashierDeclineVoid(request.id);
      await _poll();
      if (mounted) {
        AppNotifier.showSnackBar(
            context, const SnackBar(content: Text('Void request declined — item stays on bill')));
      }
    } on StateError catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(context, SnackBar(content: Text(error.message)));
      }
      await _poll();
    } finally {
      if (mounted) setState(() => _actioning = false);
    }
  }

  Future<void> _approve(ItemVoidRequest request) async {
    setState(() => _actioning = true);
    try {
      await ref.read(outletPosRepositoryProvider).approveItemVoid(request.id);
      await _poll();
      if (mounted) {
        AppNotifier.showSnackBar(
            context, const SnackBar(content: Text('Void approved')));
      }
    } on StateError catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(context, SnackBar(content: Text(error.message)));
      }
      await _poll();
    } finally {
      if (mounted) setState(() => _actioning = false);
    }
  }

  Future<void> _reject(ItemVoidRequest request) async {
    final reason = await showDialog<String>(
      context: context,
      builder: (context) {
        final controller = TextEditingController();
        return AlertDialog(
          title: const Text('Reject void request'),
          content: TextField(
            controller: controller,
            decoration: const InputDecoration(
              labelText: 'Reason (optional)',
              border: OutlineInputBorder(),
            ),
            maxLines: 2,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(controller.text),
              child: const Text('Reject'),
            ),
          ],
        );
      },
    );
    if (reason == null) return;
    setState(() => _actioning = true);
    try {
      await ref.read(outletPosRepositoryProvider).rejectItemVoid(
            request.id,
            rejectionReason: reason,
          );
      await _poll();
      if (mounted) {
        AppNotifier.showSnackBar(
            context, const SnackBar(content: Text('Void rejected')));
      }
    } on StateError catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(context, SnackBar(content: Text(error.message)));
      }
      await _poll();
    } finally {
      if (mounted) setState(() => _actioning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = _order;
    final isOriginalUnprinted = order.originalBillPrintedAt == null;
    final canPrintOriginal = order.paymentStatus == 'unpaid';
    final canPrintDuplicate = order.paymentStatus == 'unpaid' && order.canReprintBill;
    final pendingTotal = _voidRequests
        .where((r) => r.isPending || r.isAcknowledged)
        .fold<double>(0, (sum, r) => sum + r.amount);

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: 20 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    order.orderNumber,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            if ((order.shortCode ?? '').isNotEmpty)
              Text('Code: ${order.shortCode}',
                  style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 4),
            Text(
              [
                order.customerName,
                if ((order.waiterName ?? '').isNotEmpty)
                  'Waiter: ${order.waiterName}',
                if ((order.tableNumber ?? '').isNotEmpty)
                  'Table ${order.tableNumber}',
                if ((order.roomNumber ?? '').isNotEmpty)
                  'Room ${order.roomNumber}',
              ].join(' • '),
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            if (pendingTotal > 0) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.orange.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  () {
                    final hasCashierPending = _voidRequests.any((r) => r.isPending);
                    final hasManagerPending = _voidRequests.any((r) => r.isAcknowledged);
                    if (_isCashier && hasCashierPending) {
                      return '⚠️ Item void awaiting your acknowledgment. May reduce total by ${formatKes(pendingTotal)}.';
                    }
                    if (_isReviewer && hasManagerPending) {
                      return '⚠️ Item void acknowledged by cashier — awaiting your approval. May reduce total by ${formatKes(pendingTotal)}.';
                    }
                    return '⏳ Void in progress — may reduce total by ${formatKes(pendingTotal)}.';
                  }(),
                  style: const TextStyle(fontSize: 12),
                ),
              ),
            ],
            const SizedBox(height: 16),
            const Divider(),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 360),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: order.items.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final raw =
                      Map<String, dynamic>.from(order.items[index] as Map);
                  final qty = (raw['quantity'] is num)
                      ? (raw['quantity'] as num).toDouble()
                      : double.tryParse('${raw['quantity']}') ?? 0;
                  final unitPrice = (raw['unit_price'] is num)
                      ? (raw['unit_price'] as num).toDouble()
                      : double.tryParse('${raw['unit_price']}') ?? 0;
                  final voidedQty = (raw['voided_qty'] is num)
                      ? (raw['voided_qty'] as num).toDouble()
                      : double.tryParse('${raw['voided_qty']}') ?? 0;
                  final activeQty = qty - voidedQty;
                  final name = '${raw['name'] ?? ''}';
                  final activeVoid = _activeVoidFor(index);
                  final isFullyVoided = activeQty <= 0;
                  final isHiddenFromCustomer = raw['void_pending_approval'] == true;

                  return ListTile(
                    dense: true,
                    tileColor: isHiddenFromCustomer
                        ? Colors.orange.withValues(alpha: 0.06)
                        : null,
                    // Restaurant-only: per-item void entry point. Bartenders never
                    // get this — all bar voids go through the Cashier Void Management
                    // screen instead.
                    leading: (widget.isRestaurant &&
                            _billEditable &&
                            activeVoid == null &&
                            activeQty > 0 &&
                            !_actioning)
                        ? IconButton(
                            icon: const Icon(Icons.remove_circle_outline, size: 20),
                            tooltip: 'Void item',
                            onPressed: () => _openVoidItemSheet(index, raw, activeQty),
                          )
                        : const SizedBox(width: 40),
                    title: Text(
                      voidedQty > 0
                          ? '${qty.toStringAsFixed(qty.truncateToDouble() == qty ? 0 : 1)}x $name (${voidedQty.toStringAsFixed(voidedQty.truncateToDouble() == voidedQty ? 0 : 1)} voided)'
                          : '${qty.toStringAsFixed(qty.truncateToDouble() == qty ? 0 : 1)}x $name',
                      style: isFullyVoided
                          ? const TextStyle(decoration: TextDecoration.lineThrough)
                          : isHiddenFromCustomer
                              ? TextStyle(color: Colors.orange.shade800)
                              : null,
                    ),
                    subtitle: activeVoid == null
                        ? (isHiddenFromCustomer
                            ? const Text('Hidden from customer bill — awaiting manager',
                                style: TextStyle(fontSize: 11))
                            : null)
                        : Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Wrap(
                              spacing: 8,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                if (activeVoid.isPending) ...[
                                  Chip(
                                    label: const Text('⏳ AWAITING CASHIER',
                                        style: TextStyle(fontSize: 11)),
                                    backgroundColor: Colors.orange.withValues(alpha: 0.15),
                                    visualDensity: VisualDensity.compact,
                                    padding: EdgeInsets.zero,
                                  ),
                                  Text(
                                    '${activeVoid.reason} • ${activeVoid.requestedByName ?? 'Unknown'}',
                                    style: Theme.of(context).textTheme.bodySmall,
                                  ),
                                  if (_isCashier) ...[
                                    TextButton(
                                      onPressed: _actioning ? null : () => _acknowledge(activeVoid),
                                      child: const Text('✓ ACKNOWLEDGE'),
                                    ),
                                    TextButton(
                                      onPressed: _actioning ? null : () => _decline(activeVoid),
                                      style: TextButton.styleFrom(
                                          foregroundColor: Colors.red),
                                      child: const Text('✗ DECLINE'),
                                    ),
                                  ],
                                ] else if (activeVoid.isAcknowledged) ...[
                                  Chip(
                                    label: const Text('⏳ AWAITING MANAGER',
                                        style: TextStyle(fontSize: 11)),
                                    backgroundColor: Colors.blue.withValues(alpha: 0.12),
                                    visualDensity: VisualDensity.compact,
                                    padding: EdgeInsets.zero,
                                  ),
                                  Text(
                                    '${activeVoid.reason} • cashier: ${activeVoid.cashierName ?? 'Unknown'}',
                                    style: Theme.of(context).textTheme.bodySmall,
                                  ),
                                  if (_isReviewer) ...[
                                    TextButton(
                                      onPressed: _actioning ? null : () => _approve(activeVoid),
                                      child: const Text('✓ APPROVE'),
                                    ),
                                    TextButton(
                                      onPressed: _actioning ? null : () => _reject(activeVoid),
                                      style: TextButton.styleFrom(
                                          foregroundColor: Colors.red),
                                      child: const Text('✗ REJECT'),
                                    ),
                                  ],
                                ],
                              ],
                            ),
                          ),
                    trailing: Text(formatKes(activeQty * unitPrice)),
                  );
                },
              ),
            ),
            const Divider(),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Total',
                    style: TextStyle(fontWeight: FontWeight.w700)),
                Text(formatKes(order.totalAmount),
                    style: const TextStyle(fontWeight: FontWeight.w700)),
              ],
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Paid'),
                Text(formatKes(order.amountPaid)),
              ],
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Balance'),
                Text(formatKes(_balance(order))),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: isOriginalUnprinted
                    ? (canPrintOriginal ? widget.onPrintOriginal : null)
                    : (canPrintDuplicate ? widget.onPrintDuplicate : null),
                icon: const Icon(Icons.print_outlined),
                label: Text(isOriginalUnprinted
                    ? (canPrintOriginal ? 'Print Customer Bill' : 'Bill must be unpaid to print')
                    : (canPrintDuplicate
                        ? 'Print duplicate bill'
                        : order.canReprintBill
                            ? 'Bill must be unpaid to print'
                            : 'Duplicate already printed')),
              ),
            ),
            if (_hasApprovedVoid) ...[
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: widget.onPrintUpdated,
                  icon: const Icon(Icons.receipt_long_outlined),
                  label: const Text('Print Updated Bill'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _VoidItemSheet extends StatefulWidget {
  const _VoidItemSheet({required this.itemName, required this.maxQty});

  final String itemName;
  final double maxQty;

  @override
  State<_VoidItemSheet> createState() => _VoidItemSheetState();
}

class _VoidItemSheetState extends State<_VoidItemSheet> {
  late double _qty;
  String _reasonCategory = 'wrong_order';
  final _noteController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _qty = widget.maxQty > 0 ? 1 : 0;
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: 20 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Void item', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 4),
            Text(widget.itemName, style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Quantity to void'),
                Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.remove),
                      onPressed: _qty > 1 ? () => setState(() => _qty -= 1) : null,
                    ),
                    Text(_qty.toStringAsFixed(0)),
                    IconButton(
                      icon: const Icon(Icons.add),
                      onPressed: _qty < widget.maxQty ? () => setState(() => _qty += 1) : null,
                    ),
                  ],
                ),
              ],
            ),
            DropdownButtonFormField<String>(
              initialValue: _reasonCategory,
              decoration: const InputDecoration(
                labelText: 'Reason',
                border: OutlineInputBorder(),
              ),
              items: itemVoidReasonCategories.entries
                  .map((entry) => DropdownMenuItem(value: entry.key, child: Text(entry.value)))
                  .toList(),
              onChanged: (value) {
                if (value != null) setState(() => _reasonCategory = value);
              },
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _noteController,
              decoration: const InputDecoration(
                labelText: 'Note (optional)',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _qty <= 0
                    ? null
                    : () => Navigator.of(context).pop({
                          'qty': _qty,
                          'reasonCategory': _reasonCategory,
                          'note': _noteController.text,
                        }),
                child: const Text('SEND FOR APPROVAL'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Post-payment item exchange: waiter selects item(s) to return from a
// closed/paid bill and item(s) the customer wants instead. The original bill
// is never touched here — submitting just creates a pending
// pos_item_exchange_requests row for the cashier to approve or reject.
class _ExchangeRequestSheet extends ConsumerStatefulWidget {
  const _ExchangeRequestSheet({
    required this.order,
    required this.shiftId,
    required this.catalog,
  });

  final OutletShiftOrder order;
  final String shiftId;
  final List<OutletPosItem> catalog;

  @override
  ConsumerState<_ExchangeRequestSheet> createState() => _ExchangeRequestSheetState();
}

class _ExchangeRequestSheetState extends ConsumerState<_ExchangeRequestSheet> {
  final Map<int, double> _oldQty = {};
  List<OutletCartItem> _newCart = [];
  final _searchController = TextEditingController();
  final _reasonController = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _searchController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  double _activeQtyAt(int index, Map<String, dynamic> raw) {
    final qty = (raw['quantity'] is num)
        ? (raw['quantity'] as num).toDouble()
        : double.tryParse('${raw['quantity']}') ?? 0;
    final voidedQty = (raw['voided_qty'] is num)
        ? (raw['voided_qty'] as num).toDouble()
        : double.tryParse('${raw['voided_qty']}') ?? 0;
    return qty - voidedQty;
  }

  double get _oldTotal {
    var sum = 0.0;
    for (final entry in _oldQty.entries) {
      if (entry.value <= 0) continue;
      final raw = Map<String, dynamic>.from(widget.order.items[entry.key] as Map);
      final unitPrice = (raw['unit_price'] is num)
          ? (raw['unit_price'] as num).toDouble()
          : double.tryParse('${raw['unit_price']}') ?? 0;
      sum += unitPrice * entry.value;
    }
    return sum;
  }

  double get _newTotal =>
      _newCart.fold<double>(0, (sum, entry) => sum + entry.lineTotal);

  double get _difference => _newTotal - _oldTotal;

  void _addToNewCart(OutletPosItem item) {
    final index = _newCart.indexWhere((entry) => entry.item.id == item.id);
    setState(() {
      if (index == -1) {
        _newCart = [..._newCart, OutletCartItem(item: item, quantity: 1)];
      } else {
        _newCart = [..._newCart]
          ..[index] = _newCart[index].copyWith(quantity: _newCart[index].quantity + 1);
      }
    });
  }

  void _setNewCartQty(String itemId, int qty) {
    setState(() {
      if (qty <= 0) {
        _newCart = _newCart.where((entry) => entry.item.id != itemId).toList();
      } else {
        _newCart = _newCart
            .map((entry) =>
                entry.item.id == itemId ? entry.copyWith(quantity: qty) : entry)
            .toList();
      }
    });
  }

  bool get _canSubmit =>
      !_submitting &&
      _oldQty.values.any((qty) => qty > 0) &&
      _newCart.isNotEmpty;

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      final oldItems = _oldQty.entries
          .where((entry) => entry.value > 0)
          .map((entry) => {'item_index': entry.key, 'quantity': entry.value})
          .toList();
      await ref.read(outletPosRepositoryProvider).requestItemExchange(
            shiftId: widget.shiftId,
            orderId: widget.order.id,
            oldItems: oldItems,
            newItems: _newCart.map((entry) => entry.toJson()).toList(),
            reason: _reasonController.text,
          );
      if (mounted) {
        AppNotifier.showSnackBar(context,
            const SnackBar(content: Text('Exchange request sent to cashier for approval')));
        Navigator.of(context).pop(true);
      }
    } on StateError catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(context, SnackBar(content: Text(error.message)));
      }
    } catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text('Could not send exchange request: $error')));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final search = _searchController.text.trim().toLowerCase();
    final filteredCatalog = search.isEmpty
        ? widget.catalog
        : widget.catalog
            .where((item) => item.name.toLowerCase().contains(search))
            .toList();
    final difference = _difference;
    final String summaryLabel;
    final Color summaryColor;
    if (difference > 0.004) {
      summaryLabel = 'Customer pays top-up of ${formatKes(difference)}';
      summaryColor = Colors.orange.shade800;
    } else if (difference < -0.004) {
      summaryLabel = 'Cashier refunds ${formatKes(-difference)}';
      summaryColor = Colors.red.shade700;
    } else {
      summaryLabel = 'Even exchange — no money movement';
      summaryColor = Colors.green.shade700;
    }

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: 20 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text('Request Exchange — ${order.orderNumber}',
                      style: Theme.of(context).textTheme.titleLarge),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text('Items to return', style: Theme.of(context).textTheme.titleSmall),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 220),
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: order.items.length,
                itemBuilder: (context, index) {
                  final raw = Map<String, dynamic>.from(order.items[index] as Map);
                  final activeQty = _activeQtyAt(index, raw);
                  if (activeQty <= 0) return const SizedBox.shrink();
                  final name = '${raw['name'] ?? ''}';
                  final selectedQty = _oldQty[index] ?? 0;
                  return CheckboxListTile(
                    dense: true,
                    value: selectedQty > 0,
                    title: Text(name),
                    subtitle: Text('Active qty: ${activeQty.toStringAsFixed(activeQty.truncateToDouble() == activeQty ? 0 : 1)}'),
                    secondary: selectedQty > 0
                        ? Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: const Icon(Icons.remove),
                                onPressed: selectedQty > 1
                                    ? () => setState(() => _oldQty[index] = selectedQty - 1)
                                    : null,
                              ),
                              Text(selectedQty.toStringAsFixed(0)),
                              IconButton(
                                icon: const Icon(Icons.add),
                                onPressed: selectedQty < activeQty
                                    ? () => setState(() => _oldQty[index] = selectedQty + 1)
                                    : null,
                              ),
                            ],
                          )
                        : null,
                    onChanged: (checked) => setState(() {
                      _oldQty[index] = checked == true ? 1 : 0;
                    }),
                  );
                },
              ),
            ),
            const Divider(),
            Text('Replacement items', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 4),
            TextField(
              controller: _searchController,
              decoration: const InputDecoration(
                hintText: 'Search menu items',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
                isDense: true,
              ),
              onChanged: (_) => setState(() {}),
            ),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 160),
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: filteredCatalog.length,
                itemBuilder: (context, index) {
                  final item = filteredCatalog[index];
                  return ListTile(
                    dense: true,
                    title: Text(item.name),
                    subtitle: Text(formatKes(item.sellingPrice)),
                    trailing: const Icon(Icons.add_circle_outline),
                    onTap: () => _addToNewCart(item),
                  );
                },
              ),
            ),
            if (_newCart.isNotEmpty) ...[
              const SizedBox(height: 8),
              ..._newCart.map((entry) => ListTile(
                    dense: true,
                    title: Text(entry.item.name),
                    subtitle: Text(formatKes(entry.item.sellingPrice)),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove),
                          onPressed: () =>
                              _setNewCartQty(entry.item.id, entry.quantity - 1),
                        ),
                        Text('${entry.quantity}'),
                        IconButton(
                          icon: const Icon(Icons.add),
                          onPressed: () =>
                              _setNewCartQty(entry.item.id, entry.quantity + 1),
                        ),
                      ],
                    ),
                  )),
            ],
            const Divider(),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Returned items total'),
                Text(formatKes(_oldTotal)),
              ],
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Replacement items total'),
                Text(formatKes(_newTotal)),
              ],
            ),
            const SizedBox(height: 4),
            Text(summaryLabel,
                style: TextStyle(color: summaryColor, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            TextField(
              controller: _reasonController,
              decoration: const InputDecoration(
                labelText: 'Reason (optional)',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _canSubmit ? _submit : null,
                child: Text(_submitting ? 'Sending…' : 'SEND FOR CASHIER APPROVAL'),
              ),
            ),
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

