import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';

import '../../../core/widgets/master_dashboard_shell.dart';
import '../data/outlet_pos_repository.dart';
import '../domain/models.dart';

enum OutletPosSection { station, orders, stock, summary }

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
  List<OutletStockCount> _stockCounts = [];
  List<OutletStaffMember> _staff = [];
  Map<String, dynamic> _summary = {};
  final _closingCashController = TextEditingController();
  final _cashVarianceReasonController = TextEditingController();
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
    _closingCashController.dispose();
    _cashVarianceReasonController.dispose();
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
      final shift = await repo.getActiveShift(outlet.id);
      final items = await repo.getItems(outlet.id);
      final staff = await repo.getStaff();
      final orders =
          shift == null ? <OutletShiftOrder>[] : await repo.getOrders(shift.id);
      final stock = shift == null
          ? <OutletStockCount>[]
          : await repo.getStockCount(shift.id);
      final summary =
          shift == null ? <String, dynamic>{} : await repo.getSummary(shift.id);
      if (!mounted) return;
      setState(() {
        _outlet = outlet;
        _shift = shift;
        _items = items;
        _staff = staff;
        _orders = orders;
        _stockCounts = stock;
        _summary = summary;
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
            label: 'Station',
            icon: PhosphorIcons.money()),
        MasterNavItem(
            section: OutletPosSection.orders,
            label: 'Bills',
            icon: PhosphorIcons.receipt()),
        MasterNavItem(
            section: OutletPosSection.stock,
            label: 'Stock Count',
            icon: PhosphorIcons.clipboardText()),
        MasterNavItem(
            section: OutletPosSection.summary,
            label: 'Shift Logbook',
            icon: PhosphorIcons.trendUp()),
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
      OutletPosSection.stock => _stockView(),
      OutletPosSection.summary => _summaryView(),
    };
  }

  Widget _station() {
    if (_shift == null) return _openShiftView();
    final categories = {
      for (final item in _items) item.category,
    }.where((category) => category.trim().isNotEmpty).toList();
    final subtotal = _cart.fold<double>(0, (sum, item) => sum + item.lineTotal);

    return _Surface(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final menu = ListView(
            padding: const EdgeInsets.all(20),
            children: [
              _ShiftBanner(shift: _shift!, outlet: _outlet!, onRefresh: _load),
              const SizedBox(height: 16),
              if (categories.isNotEmpty)
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: categories
                      .map((category) => Chip(label: Text(category)))
                      .toList(),
                ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: _items
                    .map((item) => _ItemTile(
                          item: item,
                          onTap: () => _addToCart(item),
                        ))
                    .toList(),
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

  Widget _openShiftView() {
    final controller = TextEditingController(text: '0');
    return _Surface(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Open ${widget.title} shift',
                      style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 12),
                  TextField(
                    controller: controller,
                    keyboardType: TextInputType.number,
                    decoration:
                        const InputDecoration(labelText: 'Opening float'),
                  ),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: _busy
                        ? null
                        : () async {
                            await _run(() async {
                              _shift = await ref
                                  .read(outletPosRepositoryProvider)
                                  .openShift(
                                    _outlet!.id,
                                    double.tryParse(controller.text) ?? 0,
                                  );
                              _stockCounts = await ref
                                  .read(outletPosRepositoryProvider)
                                  .getStockCount(_shift!.id);
                            });
                          },
                    icon: const Icon(Icons.play_arrow),
                    label: const Text('Open Shift'),
                  ),
                ],
              ),
            ),
          ),
        ),
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
            Text('Bills awaiting clearance',
                style: Theme.of(context).textTheme.titleLarge),
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
                        FilledButton.tonalIcon(
                          onPressed: _busy ? null : () => _pay(order),
                          icon: const Icon(Icons.payments, size: 16),
                          label: const Text('Clear'),
                        ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _stockView() {
    return _Surface(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Row(
            children: [
              Text('Shift stock count',
                  style: Theme.of(context).textTheme.titleLarge),
              const Spacer(),
              FilledButton.icon(
                onPressed: _busy ? null : _saveStock,
                icon: const Icon(Icons.save),
                label: const Text('Save Counts'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          for (final count in _stockCounts)
            Card(
              child: ListTile(
                title: Text(count.itemName),
                subtitle: Text(
                    '${count.trackStock ? 'Tracked' : 'Sales only'} • Open ${count.openingStock} + Add ${count.additions} - Sold ${count.soldQuantity} = System ${count.systemClosingStock} ${count.unit}'),
                trailing: Wrap(
                  spacing: 12,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text('Physical: ${count.physicalCount ?? '-'}'),
                    Text('Var: ${count.variance.toStringAsFixed(2)}'),
                    IconButton(
                      onPressed: () => _editStock(count),
                      icon: const Icon(Icons.edit),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _summaryView() {
    final summary =
        _shift?.summary.isNotEmpty == true ? _shift!.summary : _summary;
    final canSeeProfit = summary.containsKey('total_cost_of_goods_sold') ||
        summary.containsKey('gross_profit');
    final expectedCash = _summaryNum(summary, 'expected_cash');
    final closingCash =
        double.tryParse(_closingCashController.text.trim()) ?? 0;
    final liveVariance = closingCash - expectedCash;
    return _Surface(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Row(
            children: [
              Text('Shift close and profit',
                  style: Theme.of(context).textTheme.titleLarge),
              const Spacer(),
              FilledButton.icon(
                onPressed:
                    _shift?.status == 'open' && !_busy ? _closeShift : null,
                icon: const Icon(Icons.lock_clock),
                label: const Text('Close Shift'),
              ),
              const SizedBox(width: 8),
              OutlinedButton.icon(
                onPressed:
                    _shift?.status == 'closed' && !_busy ? _submitShift : null,
                icon: const Icon(Icons.send),
                label: const Text('Submit'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _Metric('Sales', formatKes(_summaryNum(summary, 'total_sales'))),
              _Metric(
                  'Cash', formatKes(_summaryNum(summary, 'total_cash_sales'))),
              _Metric('M-Pesa',
                  formatKes(_summaryNum(summary, 'total_mpesa_sales'))),
              _Metric(
                  'Card', formatKes(_summaryNum(summary, 'total_card_sales'))),
              _Metric('Credit',
                  formatKes(_summaryNum(summary, 'total_credit_sales'))),
              _Metric('Expected Cash', formatKes(expectedCash)),
              if (_shift?.status == 'open' && expectedCash > 0)
                _Metric('Live Variance', formatKes(liveVariance)),
              if (canSeeProfit) ...[
                _Metric(
                    'COGS',
                    formatKes(
                        _summaryNum(summary, 'total_cost_of_goods_sold'))),
                _Metric(
                    'Profit', formatKes(_summaryNum(summary, 'gross_profit'))),
                _Metric('Margin',
                    '${_summaryNum(summary, 'profit_margin').toStringAsFixed(1)}%'),
              ],
            ],
          ),
          if (_shift?.status == 'open') ...[
            const SizedBox(height: 16),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text('Cash close',
                          style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _closingCashController,
                        keyboardType: TextInputType.number,
                        onChanged: (_) => setState(() {}),
                        decoration: const InputDecoration(
                          labelText: 'Actual cash counted',
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _cashVarianceReasonController,
                        minLines: 2,
                        maxLines: 3,
                        decoration: const InputDecoration(
                          labelText: 'Cash variance explanation',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),
          _itemSales(summary),
          const SizedBox(height: 16),
          Text('Shift status: ${_shift?.status ?? 'not open'}'),
        ],
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
      await ref
          .read(outletPosRepositoryProvider)
          .createOrder(shiftId: _shift!.id, items: _cart);
      _cart = [];
      _orders =
          await ref.read(outletPosRepositoryProvider).getOrders(_shift!.id);
      _stockCounts =
          await ref.read(outletPosRepositoryProvider).getStockCount(_shift!.id);
      _summary =
          await ref.read(outletPosRepositoryProvider).getSummary(_shift!.id);
    });
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

  Widget _itemSales(Map<String, dynamic> summary) {
    final rows = summary['item_sales'];
    if (rows is! List || rows.isEmpty) return const SizedBox.shrink();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Item sales totals',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            for (final raw in rows.take(12))
              if (raw is Map)
                ListTile(
                  dense: true,
                  title: Text('${raw['item_name'] ?? ''}'),
                  subtitle: Text('${raw['quantity_sold'] ?? 0} sold'),
                  trailing: Text(formatKes(_summaryNum(
                      Map<String, dynamic>.from(raw), 'sales_total'))),
                ),
          ],
        ),
      ),
    );
  }

  Future<_PaymentPayload?> _paymentPayload(OutletShiftOrder order) {
    final amount =
        TextEditingController(text: _orderBalance(order).toStringAsFixed(0));
    final reference = TextEditingController();
    String method = 'cash';
    OutletStaffMember? selectedStaff;

    return showDialog<_PaymentPayload>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text('Clear ${order.orderNumber}'),
          content: SizedBox(
            width: 460,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    const Expanded(child: Text('Balance')),
                    Text(formatKes(_orderBalance(order)),
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                  ],
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final entry in const {
                      'cash': 'Cash',
                      'mpesa': 'M-Pesa',
                      'card': 'Card',
                      'credit_bill': 'Credit Bill',
                    }.entries)
                      ChoiceChip(
                        selected: method == entry.key,
                        label: Text(entry.value),
                        onSelected: (_) =>
                            setDialogState(() => method = entry.key),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: amount,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Amount'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: reference,
                  decoration: InputDecoration(
                    labelText:
                        method == 'cash' ? 'Reference (optional)' : 'Reference',
                  ),
                ),
                if (method == 'credit_bill') ...[
                  const SizedBox(height: 12),
                  DropdownButtonFormField<OutletStaffMember>(
                    initialValue: selectedStaff,
                    decoration: const InputDecoration(
                        labelText: 'Branch staff account'),
                    items: _staff
                        .map(
                          (staff) => DropdownMenuItem(
                            value: staff,
                            child: Text([
                              staff.name,
                              if ((staff.role ?? '').isNotEmpty) staff.role!,
                            ].join(' • ')),
                          ),
                        )
                        .toList(),
                    onChanged: (staff) =>
                        setDialogState(() => selectedStaff = staff),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                final value = double.tryParse(amount.text.trim()) ?? 0;
                if (value <= 0 || value > _orderBalance(order) + 0.01) {
                  return;
                }
                if (method == 'credit_bill' && selectedStaff == null) {
                  return;
                }
                Navigator.pop(
                  context,
                  _PaymentPayload(
                    method: method,
                    amount: value,
                    reference: reference.text.trim(),
                    staff: selectedStaff,
                  ),
                );
              },
              child: const Text('Record Payment'),
            ),
          ],
        ),
      ),
    ).whenComplete(() {
      amount.dispose();
      reference.dispose();
    });
  }

  Future<void> _pay(OutletShiftOrder order) async {
    final payment = await _paymentPayload(order);
    if (payment == null) return;
    await _run(() async {
      await ref.read(outletPosRepositoryProvider).payOrder(
            shiftId: _shift!.id,
            orderId: order.id,
            paymentMethod: payment.method,
            amount: payment.amount,
            reference: payment.reference,
            creditBill: payment.staff == null
                ? null
                : {
                    'staff_id': payment.staff!.id,
                    'description': 'Credit bill for ${order.orderNumber}',
                    'amount': payment.amount,
                  },
          );
      _orders =
          await ref.read(outletPosRepositoryProvider).getOrders(_shift!.id);
      _summary =
          await ref.read(outletPosRepositoryProvider).getSummary(_shift!.id);
    });
  }

  Future<void> _saveStock() async {
    if (_shift == null) return;
    await _run(() async {
      _stockCounts = await ref
          .read(outletPosRepositoryProvider)
          .updateStockCount(_shift!.id, _stockCounts);
      _summary =
          await ref.read(outletPosRepositoryProvider).getSummary(_shift!.id);
    });
  }

  Future<void> _closeShift() async {
    if (_shift == null) return;
    final closingCash = double.tryParse(_closingCashController.text.trim());
    if (closingCash == null || closingCash < 0) {
      AppNotifier.showSnackBar(
        context,
        const SnackBar(content: Text('Enter actual cash counted.')),
      );
      return;
    }
    await _run(() async {
      _shift = await ref.read(outletPosRepositoryProvider).closeShift(
            _shift!.id,
            closingCashCounted: closingCash,
            varianceReason: _cashVarianceReasonController.text,
          );
      _summary = _shift!.summary;
    });
  }

  Future<void> _submitShift() async {
    if (_shift == null) return;
    await _run(() async {
      _shift =
          await ref.read(outletPosRepositoryProvider).submitShift(_shift!.id);
    });
  }

  Future<void> _editStock(OutletStockCount count) async {
    final additions = TextEditingController(text: '${count.additions}');
    final physical =
        TextEditingController(text: '${count.physicalCount ?? ''}');
    final reason = TextEditingController(text: count.varianceReason ?? '');
    final updated = await showDialog<OutletStockCount>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(count.itemName),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: additions,
              decoration: const InputDecoration(labelText: 'Additions'),
              keyboardType: TextInputType.number,
            ),
            TextField(
              controller: physical,
              decoration: const InputDecoration(labelText: 'Physical count'),
              keyboardType: TextInputType.number,
            ),
            TextField(
              controller: reason,
              decoration: const InputDecoration(labelText: 'Variance reason'),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(
              context,
              count.copyWith(
                additions: double.tryParse(additions.text) ?? count.additions,
                physicalCount: double.tryParse(physical.text),
                varianceReason: reason.text.trim(),
              ),
            ),
            child: const Text('Apply'),
          ),
        ],
      ),
    );
    additions.dispose();
    physical.dispose();
    reason.dispose();
    if (updated == null) return;
    setState(() {
      _stockCounts = _stockCounts
          .map((entry) => entry.id == updated.id ? updated : entry)
          .toList();
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
}

class _PaymentPayload {
  const _PaymentPayload({
    required this.method,
    required this.amount,
    required this.reference,
    this.staff,
  });

  final String method;
  final double amount;
  final String reference;
  final OutletStaffMember? staff;
}

class _Surface extends StatelessWidget {
  const _Surface({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(color: const Color(0xFFF6F7FB), child: child);
  }
}

class _ShiftBanner extends StatelessWidget {
  const _ShiftBanner({
    required this.shift,
    required this.outlet,
    required this.onRefresh,
  });

  final OutletShift shift;
  final PosOutlet outlet;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: const Icon(Icons.point_of_sale),
        title: Text(outlet.name),
        subtitle: Text('Shift ${shift.status} • ${shift.openedAt}'),
        trailing:
            IconButton(onPressed: onRefresh, icon: const Icon(Icons.refresh)),
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
      width: 180,
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
                const SizedBox(height: 8),
                Text(formatKes(item.sellingPrice)),
                Text('Cost ${formatKes(item.costPrice)}',
                    style: Theme.of(context).textTheme.bodySmall),
                Text(
                    'Stock ${item.currentStock.toStringAsFixed(1)} ${item.unit}',
                    style: Theme.of(context).textTheme.bodySmall),
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
              label: const Text('Send Bill To Clearance'),
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

class _Metric extends StatelessWidget {
  const _Metric(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 220,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 8),
              Text(value,
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.w900)),
            ],
          ),
        ),
      ),
    );
  }
}

double _summaryNum(Map<String, dynamic> summary, String key) {
  final value = summary[key];
  return value is num ? value.toDouble() : double.tryParse('$value') ?? 0;
}
