import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/domain/auth_notifier.dart';
import '../data/outlet_pos_repository.dart';

/// Opens the cross-outlet "Customer Bills" panel where a waiter recalls all of
/// their own open orders across every outlet, combines them into ONE customer
/// bill, prints it, and settles it with a single tender.
Future<void> showCustomerBillsPanel(
  BuildContext context,
  WidgetRef ref, {
  String? waiterId,
  Future<void> Function(ConsolidatedBill bill)? onPrintBill,
}) {
  return showDialog<void>(
    context: context,
    builder: (_) => Dialog.fullscreen(
      child: _CustomerBillsPanel(waiterId: waiterId, onPrintBill: onPrintBill),
    ),
  );
}

class _CustomerBillsPanel extends ConsumerStatefulWidget {
  const _CustomerBillsPanel({this.waiterId, this.onPrintBill});
  final String? waiterId;
  final Future<void> Function(ConsolidatedBill bill)? onPrintBill;

  @override
  ConsumerState<_CustomerBillsPanel> createState() =>
      _CustomerBillsPanelState();
}

class _CustomerBillsPanelState extends ConsumerState<_CustomerBillsPanel> {
  List<ConsolidatedBill> _bills = [];
  bool _loading = true;
  bool _busy = false;
  String? _error;
  bool _combineMode = false;
  // Order ids selected for combining, keyed for quick toggle.
  final Set<String> _selectedOrderIds = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(outletPosRepositoryProvider);
      final bills = await repo.getWaiterOpenBills(waiterId: widget.waiterId);
      if (!mounted) return;
      setState(() {
        _bills = bills;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  String _money(num v) => 'KES ${v.toStringAsFixed(0)}';

  Future<void> _combineSelected() async {
    if (_selectedOrderIds.length < 2) return;
    setState(() => _busy = true);
    try {
      final repo = ref.read(outletPosRepositoryProvider);
      await repo.linkOrdersIntoBill(orderIds: _selectedOrderIds.toList());
      _selectedOrderIds.clear();
      _combineMode = false;
      await _load();
      _snack('Bills combined into one customer bill.');
    } catch (e) {
      _snack('Could not combine: $e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _snack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: error ? Colors.red : Colors.green,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Customer Bills — all outlets'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
          // Explicit Material + InkWell (not FilledButton) so no app-wide button
          // theme can wash the background out — this button stayed invisible on
          // the light AppBar when themed. Solid navy (red in cancel mode).
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
            child: Material(
              color: _bills.isEmpty
                  ? const Color(0xFF9AA5B1)
                  : (_combineMode
                      ? const Color(0xFFC62828)
                      : const Color(0xFF0F2E5E)),
              borderRadius: BorderRadius.circular(8),
              child: InkWell(
                borderRadius: BorderRadius.circular(8),
                onTap: _bills.isEmpty
                    ? null
                    : () => setState(() {
                          _combineMode = !_combineMode;
                          _selectedOrderIds.clear();
                        }),
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(_combineMode ? Icons.close : Icons.call_merge,
                          size: 18, color: Colors.white),
                      const SizedBox(width: 6),
                      Text(_combineMode ? 'Cancel' : 'Combine',
                          style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _errorView()
              : _bills.isEmpty
                  ? const Center(
                      child: Text('No open bills across your outlets.',
                          style: TextStyle(color: Colors.grey)))
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _bills.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (_, i) => _billCard(_bills[i], theme),
                    ),
      bottomNavigationBar: _combineMode
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: FilledButton.icon(
                  onPressed:
                      _selectedOrderIds.length < 2 || _busy ? null : _combineSelected,
                  icon: const Icon(Icons.call_merge),
                  label: Text(
                    'Combine ${_selectedOrderIds.length} order(s) into one bill',
                  ),
                ),
              ),
            )
          : null,
    );
  }

  Widget _errorView() => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: Colors.red, size: 40),
            const SizedBox(height: 12),
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(onPressed: _load, child: const Text('Retry')),
          ],
        ),
      );

  Widget _billCard(ConsolidatedBill bill, ThemeData theme) {
    final selectedHere =
        bill.orderIds.every((id) => _selectedOrderIds.contains(id)) &&
            bill.orderIds.isNotEmpty;
    return Card(
      child: InkWell(
        onTap: _combineMode
            ? () => setState(() {
                  if (selectedHere) {
                    _selectedOrderIds.removeAll(bill.orderIds);
                  } else {
                    _selectedOrderIds.addAll(bill.orderIds);
                  }
                })
            : () => _openBill(bill),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              if (_combineMode)
                Checkbox(
                  value: selectedHere,
                  onChanged: (_) => setState(() {
                    if (selectedHere) {
                      _selectedOrderIds.removeAll(bill.orderIds);
                    } else {
                      _selectedOrderIds.addAll(bill.orderIds);
                    }
                  }),
                ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(bill.label,
                              style: theme.textTheme.titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w700)),
                        ),
                        if (bill.isMultiOutlet)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.indigo.shade50,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text('${bill.outlets.length} outlets',
                                style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.indigo.shade700,
                                    fontWeight: FontWeight.w600)),
                          ),
                      ],
                    ),
                    if (bill.masterBillNumber != null) ...[
                      const SizedBox(height: 2),
                      Text('Master Bill ${bill.masterBillNumber}',
                          style: theme.textTheme.bodySmall?.copyWith(
                              color: Colors.indigo.shade700,
                              fontWeight: FontWeight.w600)),
                    ],
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        for (final o in bill.outlets)
                          Chip(
                            label: Text(o, style: const TextStyle(fontSize: 11)),
                            visualDensity: VisualDensity.compact,
                            materialTapTargetSize:
                                MaterialTapTargetSize.shrinkWrap,
                          ),
                      ],
                    ),
                    if (bill.outletBreakdown.length > 1) ...[
                      const SizedBox(height: 4),
                      for (final s in bill.outletBreakdown)
                        Padding(
                          padding: const EdgeInsets.only(top: 1),
                          child: Text(
                            '  • ${s.outletName ?? 'Outlet'}: ${_money(s.amount)}',
                            style: theme.textTheme.bodySmall
                                ?.copyWith(color: Colors.grey.shade700),
                          ),
                        ),
                    ],
                    const SizedBox(height: 6),
                    Text(
                      '${bill.orderCount} order(s) • Total ${_money(bill.totalAmount)}'
                      ' • Balance ${_money(bill.balanceAmount)}',
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              if (!_combineMode) const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openBill(ConsolidatedBill bill) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _BillDetailSheet(
        bill: bill,
        onPrintBill: widget.onPrintBill,
        onChanged: _load,
      ),
    );
  }
}

class _BillDetailSheet extends ConsumerStatefulWidget {
  const _BillDetailSheet({
    required this.bill,
    required this.onChanged,
    this.onPrintBill,
  });
  final ConsolidatedBill bill;
  final Future<void> Function() onChanged;
  final Future<void> Function(ConsolidatedBill bill)? onPrintBill;

  @override
  ConsumerState<_BillDetailSheet> createState() => _BillDetailSheetState();
}

class _BillDetailSheetState extends ConsumerState<_BillDetailSheet> {
  bool _busy = false;

  String _money(num v) => 'KES ${v.toStringAsFixed(0)}';

  void _snack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: error ? Colors.red : Colors.green,
    ));
  }

  bool get _isCashierOrManager {
    final u = ref.read(authNotifierProvider).valueOrNull;
    if (u == null) return false;
    final roles = <String>{
      u.role.toLowerCase(),
      u.primaryRole.toLowerCase(),
      ...u.roles.map((r) => r.toLowerCase()),
    };
    if (roles.any((r) => r.contains('cashier'))) return true;
    const mgr = {
      'super_admin', 'general_manager', 'director', 'branch_manager',
      'branch_accountant', 'accountant', 'finance_manager',
      'restaurant_manager', 'bar_manager',
    };
    return roles.any(mgr.contains);
  }

  /// Cashier/manager settles the whole combined bill with one tender. Each
  /// member order posts its payment to its OWN outlet shift (per-outlet revenue
  /// + stock); the other outlets confirm their share afterwards from the
  /// Cross-outlet Settlements panel.
  Future<void> _settleBill(ConsolidatedBill bill) async {
    final billId = bill.masterBillId;
    if (billId == null) return;
    final method = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text('Settle ${_money(bill.balanceAmount)} — choose tender',
                  style: const TextStyle(fontWeight: FontWeight.w700)),
            ),
            ListTile(
              leading: const Icon(Icons.payments_outlined),
              title: const Text('Cash'),
              onTap: () => Navigator.pop(ctx, 'cash'),
            ),
            ListTile(
              leading: const Icon(Icons.phone_android),
              title: const Text('M-Pesa'),
              onTap: () => Navigator.pop(ctx, 'mpesa'),
            ),
            ListTile(
              leading: const Icon(Icons.credit_card),
              title: const Text('Card'),
              onTap: () => Navigator.pop(ctx, 'card'),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (method == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(outletPosRepositoryProvider).payConsolidatedBill(
            masterBillId: billId,
            paymentMethod: method,
            reference: bill.masterBillNumber,
          );
      if (widget.onPrintBill != null) {
        try {
          await widget.onPrintBill!(bill);
        } catch (_) {/* printing is best-effort after a successful settle */}
      }
      if (mounted) Navigator.pop(context);
      await widget.onChanged();
      _snack(
          'Bill ${bill.masterBillNumber ?? ''} settled (${method.toUpperCase()}).');
    } catch (e) {
      _snack('Settle failed: $e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _addItems(ConsolidatedBill bill) async {
    final billId = bill.masterBillId;
    if (billId == null) return;
    final user = ref.read(authNotifierProvider).valueOrNull;
    final branchId = int.tryParse(user?.branchId ?? '');
    final added = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) =>
          _AddItemsFromOutletSheet(masterBillId: billId, branchId: branchId),
    );
    if (added == true) {
      if (mounted) Navigator.pop(context);
      await widget.onChanged();
    }
  }

  Future<void> _removeOrder(BillOrder order) async {
    final billId = widget.bill.masterBillId;
    if (billId == null) return;
    setState(() => _busy = true);
    try {
      final repo = ref.read(outletPosRepositoryProvider);
      await repo.unlinkOrderFromBill(
          masterBillId: billId, orderId: order.id);
      if (mounted) Navigator.pop(context);
      await widget.onChanged();
      _snack('Removed ${order.outletName ?? 'order'} from the bill.');
    } catch (e) {
      _snack('Could not remove: $e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bill = widget.bill;
    final theme = Theme.of(context);
    return DraggableScrollableSheet(
      initialChildSize: 0.8,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (_, scrollController) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(bill.label,
                          style: theme.textTheme.titleLarge
                              ?.copyWith(fontWeight: FontWeight.w700)),
                      if (bill.masterBillNumber != null)
                        Text('Master Bill ${bill.masterBillNumber}',
                            style: theme.textTheme.bodyMedium?.copyWith(
                                color: Colors.indigo.shade700,
                                fontWeight: FontWeight.w600)),
                      Text(
                        '${bill.orderCount} order(s) across ${bill.outlets.length} outlet(s)',
                        style: theme.textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: ListView(
              controller: scrollController,
              padding: const EdgeInsets.all(16),
              children: [
                for (final order in bill.orders) _orderBlock(order, theme),
              ],
            ),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Combined total', style: theme.textTheme.titleMedium),
                    Text(_money(bill.totalAmount),
                        style: theme.textTheme.titleLarge
                            ?.copyWith(fontWeight: FontWeight.w700)),
                  ],
                ),
                if (bill.amountPaid > 0)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Balance'),
                      Text(_money(bill.balanceAmount)),
                    ],
                  ),
                if (bill.masterBillId != null) ...[
                  const SizedBox(height: 12),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: OutlinedButton.icon(
                      onPressed: _busy ? null : () => _addItems(bill),
                      icon: const Icon(Icons.add_shopping_cart, size: 18),
                      label: const Text('Add items (another outlet)'),
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                // A cashier/manager settles the whole combined bill here with a
                // single tender; each outlet's share posts to its own shift and
                // the other outlets confirm their portion afterwards. A waiter
                // only builds/prints it and hands it to the cashier.
                if (_isCashierOrManager &&
                    bill.masterBillId != null &&
                    bill.balanceAmount > 0) ...[
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _busy ? null : () => _settleBill(bill),
                      icon: const Icon(Icons.point_of_sale),
                      label: Text('Settle & Pay  ${_money(bill.balanceAmount)}'),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.green.shade700,
                        foregroundColor: Colors.white,
                        minimumSize: const Size.fromHeight(48),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
                if (widget.onPrintBill != null)
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _busy
                          ? null
                          : () async {
                              try {
                                await widget.onPrintBill!(bill);
                              } catch (e) {
                                _snack('Print failed: $e', error: true);
                              }
                            },
                      icon: const Icon(Icons.print),
                      label: const Text('Print customer bill'),
                    ),
                  ),
                if (!_isCashierOrManager)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      'Give this bill to the customer — a cashier settles it.',
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: Colors.grey),
                      textAlign: TextAlign.center,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _orderBlock(BillOrder order, ThemeData theme) {
    final items = order.items.whereType<Map>().toList();
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(order.outletName ?? 'Outlet',
                      style: theme.textTheme.titleSmall
                          ?.copyWith(fontWeight: FontWeight.w700)),
                ),
                Text(_money(order.totalAmount),
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                if (widget.bill.isConsolidated)
                  IconButton(
                    tooltip: 'Remove from bill',
                    visualDensity: VisualDensity.compact,
                    onPressed: _busy ? null : () => _removeOrder(order),
                    icon: const Icon(Icons.link_off, size: 18),
                  ),
              ],
            ),
            if (order.shortCode != null)
              Text('#${order.shortCode}',
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: Colors.grey)),
            const SizedBox(height: 6),
            for (final raw in items)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  children: [
                    Text('${raw['quantity'] ?? 1}× ',
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    Expanded(child: Text('${raw['name'] ?? raw['item_name'] ?? 'Item'}')),
                    Text(_money(
                        ((raw['unit_price'] as num?)?.toDouble() ?? 0) *
                            ((raw['quantity'] as num?)?.toDouble() ?? 1))),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Bottom sheet: pick another outlet, choose items, and add them to the master
/// bill. The order is routed to that outlet's own open shift by the backend.
class _AddItemsFromOutletSheet extends ConsumerStatefulWidget {
  const _AddItemsFromOutletSheet({required this.masterBillId, this.branchId});
  final String masterBillId;
  final int? branchId;

  @override
  ConsumerState<_AddItemsFromOutletSheet> createState() =>
      _AddItemsFromOutletSheetState();
}

class _AddItemsFromOutletSheetState
    extends ConsumerState<_AddItemsFromOutletSheet> {
  bool _loading = true;
  bool _busy = false;
  String? _error;
  List<PosOutlet> _outlets = const [];
  PosOutlet? _outlet;
  List<OutletPosItem> _items = const [];
  final Map<String, int> _qty = {};
  String _search = '';

  @override
  void initState() {
    super.initState();
    _loadOutlets();
  }

  String _money(num v) => 'KES ${v.toStringAsFixed(0)}';

  Future<void> _loadOutlets() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(outletPosRepositoryProvider);
      final outlets = await repo.getOutlets(branchId: widget.branchId);
      if (!mounted) return;
      setState(() {
        _outlets = outlets.where((o) => o.isFoodOrBar).toList();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  Future<void> _loadItems(PosOutlet outlet) async {
    setState(() {
      _outlet = outlet;
      _loading = true;
      _error = null;
      _qty.clear();
    });
    try {
      final items = await ref
          .read(outletPosRepositoryProvider)
          .getItems(outlet.id, fallbackOutlet: outlet);
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  void _snack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: error ? Colors.red : Colors.green,
    ));
  }

  Future<void> _submit() async {
    final outlet = _outlet;
    if (outlet == null) return;
    final cart = <OutletCartItem>[
      for (final it in _items)
        if ((_qty[it.id] ?? 0) > 0)
          OutletCartItem(item: it, quantity: _qty[it.id]!),
    ];
    if (cart.isEmpty) {
      _snack('Pick at least one item.', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(outletPosRepositoryProvider).addItemsToMasterBill(
            masterBillId: widget.masterBillId,
            outletId: outlet.id,
            items: cart,
          );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      _snack('Add failed: $e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final filtered = _search.isEmpty
        ? _items
        : _items
            .where((i) => i.name.toLowerCase().contains(_search.toLowerCase()))
            .toList();
    final selectedCount = _qty.values.where((q) => q > 0).length;
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (_, controller) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    _outlet == null
                        ? 'Add items — pick an outlet'
                        : 'Add from ${_outlet!.name}',
                    style: theme.textTheme.titleLarge
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                if (_outlet != null)
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () => setState(() {
                              _outlet = null;
                              _items = const [];
                              _qty.clear();
                            }),
                    child: const Text('Change outlet'),
                  ),
                IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close)),
              ],
            ),
          ),
          if (_outlet != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search),
                  hintText: 'Search items',
                  isDense: true,
                  border: OutlineInputBorder(),
                ),
                onChanged: (v) => setState(() => _search = v),
              ),
            ),
          const SizedBox(height: 8),
          const Divider(height: 1),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(
                        child: Text('Failed: $_error',
                            style: const TextStyle(color: Colors.red)))
                    : _outlet == null
                        ? ListView(
                            controller: controller,
                            children: [
                              for (final o in _outlets)
                                ListTile(
                                  leading: const Icon(Icons.storefront),
                                  title: Text(o.name),
                                  subtitle: Text(o.outletType ?? ''),
                                  onTap: _busy ? null : () => _loadItems(o),
                                ),
                              if (_outlets.isEmpty)
                                const Padding(
                                  padding: EdgeInsets.all(24),
                                  child: Center(
                                      child:
                                          Text('No food/bar outlets found.')),
                                ),
                            ],
                          )
                        : ListView.separated(
                            controller: controller,
                            padding: const EdgeInsets.all(16),
                            itemCount: filtered.length,
                            separatorBuilder: (_, __) =>
                                const Divider(height: 1),
                            itemBuilder: (_, i) {
                              final it = filtered[i];
                              final q = _qty[it.id] ?? 0;
                              return Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(it.name,
                                            style: const TextStyle(
                                                fontWeight: FontWeight.w600)),
                                        Text(_money(it.sellingPrice),
                                            style: theme.textTheme.bodySmall),
                                      ],
                                    ),
                                  ),
                                  IconButton(
                                    onPressed: q > 0
                                        ? () =>
                                            setState(() => _qty[it.id] = q - 1)
                                        : null,
                                    icon: const Icon(
                                        Icons.remove_circle_outline),
                                  ),
                                  SizedBox(
                                      width: 24,
                                      child: Text('$q',
                                          textAlign: TextAlign.center)),
                                  IconButton(
                                    onPressed: () =>
                                        setState(() => _qty[it.id] = q + 1),
                                    icon:
                                        const Icon(Icons.add_circle_outline),
                                  ),
                                ],
                              );
                            },
                          ),
          ),
          if (_outlet != null)
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _busy || selectedCount == 0 ? null : _submit,
                    icon: _busy
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.add),
                    label: Text(selectedCount == 0
                        ? 'Add to bill'
                        : 'Add $selectedCount item(s) to bill'),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
